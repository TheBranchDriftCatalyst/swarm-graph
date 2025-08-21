package docker

import (
	"context"
	"errors"
	"log/slog"
	"math/rand"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"

	"swarm-graph/internal/model"
	"swarm-graph/internal/store"
)

type Watcher struct {
	cli      *client.Client
	store    *store.MemoryStore
	log      *slog.Logger
	opts     Options
	workCh   chan workItem
	wg       sync.WaitGroup
	lastSeen sync.Map // key: containerID, val: time.Time (debounce)
}

type Options struct {
	LogLevel          slog.Level // default: Info
	WorkerCount       int        // default: GOMAXPROCS
	QueueSize         int        // default: 2048
	InspectDebounce   time.Duration // default: 250ms
	BackoffBase       time.Duration // default: 500ms
	BackoffMax        time.Duration // default: 10s
	AddSource         bool
	EventDebugSampleN int // sample 1/N debug events; 0 disables debug logs
}

func NewWatcher(store *store.MemoryStore, optFns ...func(*Options)) (*Watcher, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	opts := Options{
		LogLevel:        slog.LevelInfo,
		WorkerCount:     max(2, runtime.GOMAXPROCS(0)),
		QueueSize:       2048,
		InspectDebounce: 250 * time.Millisecond,
		BackoffBase:     500 * time.Millisecond,
		BackoffMax:      10 * time.Second,
		AddSource:       true,
	}
	for _, fn := range optFns {
		fn(&opts)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     opts.LogLevel,
		AddSource: opts.AddSource,
	}))
	return &Watcher{
		cli:    cli,
		store:  store,
		log:    logger.With("component", "dockerwatch"),
		opts:   opts,
		workCh: make(chan workItem, opts.QueueSize),
	}, nil
}

func (w *Watcher) Run(ctx context.Context) error {
	// Workers
	w.startWorkers(ctx)
	defer w.stopWorkers()

	// Initial snapshot (parallelized)
	if err := w.snapshot(ctx); err != nil {
		return err
	}
	w.log.Info("snapshot complete")

	// Build event filter
	args := filters.NewArgs()
	args.Add("type", string(events.ContainerEventType))
	args.Add("type", string(events.NetworkEventType))
	args.Add("type", string(events.VolumeEventType))
	args.Add("type", string(events.ImageEventType))
	// Optional: narrow common noisy actions
	// _ = args.Add("event", "create")
	// _ = args.Add("event", "start")
	// _ = args.Add("event", "die")
	// _ = args.Add("event", "destroy")
	// (You can tune per your needs.)

	backoff := w.opts.BackoffBase
	for {
		stream, errs := w.cli.Events(ctx, events.ListOptions{Filters: args})

	loop:
		for {
			select {
			case <-ctx.Done():
				w.log.Info("context canceled; stopping watcher")
				return ctx.Err()
			case err := <-errs:
				if errors.Is(err, context.Canceled) {
					return nil
				}
				if err != nil {
					w.log.Warn("docker event stream error", "err", err.Error())
					break loop // break out to re-subscribe with backoff
				}
			case evt, ok := <-stream:
				if !ok {
					w.log.Warn("docker event stream closed")
					break loop
				}
				w.onEvent(ctx, evt)
			}
		}

		// Exponential backoff with jitter
		jitter := time.Duration(rand.Int63n(int64(backoff / 2)))
		sleep := minDuration(w.opts.BackoffMax, backoff+jitter)
		w.log.Info("reconnecting event stream", "backoff", sleep.String())
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(sleep):
		}
		backoff = minDuration(w.opts.BackoffMax, time.Duration(float64(backoff)*1.8))
	}
}

func (w *Watcher) startWorkers(ctx context.Context) {
	for i := 0; i < w.opts.WorkerCount; i++ {
		w.wg.Add(1)
		go func(id int) {
			defer w.wg.Done()
			log := w.log.With("worker", id)
			for {
				select {
				case <-ctx.Done():
					return
				case item := <-w.workCh:
					switch item.kind {
					case kindContainer:
						w.inspectContainer(ctx, item.id, log)
					case kindImage:
						w.inspectImage(ctx, item.id, log)
					case kindNetwork:
						w.inspectNetwork(ctx, item.id, log)
					case kindVolume:
						w.inspectVolume(ctx, item.id, log)
					}
				}
			}
		}(i)
	}
}
func (w *Watcher) stopWorkers() {
	close(w.workCh)
	w.wg.Wait()
}

/* ===================== Snapshot ===================== */

func (w *Watcher) snapshot(ctx context.Context) error {
	// List basic types
	imgs, err := w.cli.ImageList(ctx, image.ListOptions{All: true})
	if err != nil {
		return err
	}
	nets, err := w.cli.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return err
	}
	vols, err := w.cli.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return err
	}
	ctrs, err := w.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return err
	}

	// Seed static-ish nodes first (images, networks, volumes)
	w.store.Mutate(func(g *model.InfraGraph) {
		for _, img := range imgs {
			name := firstNonEmpty(img.RepoTags...)
			g.UpsertNode(model.Node{
				ID:   img.ID,
				Kind: model.NodeImage,
				Name: nameOrShortID(name, img.ID),
				Attributes: map[string]string{
					"size":    itoa64(img.Size),
					"tags":    strings.Join(img.RepoTags, ","),
					"digests": strings.Join(img.RepoDigests, ","),
				},
			})
		}
		for _, nw := range nets {
			g.UpsertNode(model.Node{
				ID:   nw.ID,
				Kind: model.NodeNetwork,
				Name: nw.Name,
				Attributes: map[string]string{
					"driver": nw.Driver,
					"scope":  nw.Scope,
				},
			})
		}
		for _, v := range vols.Volumes {
			g.UpsertNode(model.Node{
				ID:   v.Name,
				Kind: model.NodeVolume,
				Name: v.Name,
				Attributes: map[string]string{
					"driver":     v.Driver,
					"mountpoint": v.Mountpoint,
				},
			})
		}
	})

	// Containers: enqueue parallel inspect (we need mounts/labels/IPs)
	for _, c := range ctrs {
		w.enqueueDebounced(kindContainer, c.ID)
	}
	return nil
}

/* ===================== Event handling ===================== */

func (w *Watcher) onEvent(ctx context.Context, evt events.Message) {
	if w.opts.EventDebugSampleN > 0 && w.log.Enabled(ctx, slog.LevelDebug) {
		if rand.Intn(w.opts.EventDebugSampleN) == 0 {
			w.log.Debug("evt",
				"type", string(evt.Type),
				"action", string(evt.Action),
				"id", evt.Actor.ID,
			)
		}
	}

	switch evt.Type {
	case events.ContainerEventType:
		switch evt.Action {
		case "create", "start", "restart":
			w.enqueueDebounced(kindContainer, evt.Actor.ID)
		case "die", "stop":
			// Light-touch status refresh
			w.enqueue(kindContainer, evt.Actor.ID)
		case "destroy", "remove":
			id := evt.Actor.ID
			w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(id) })
		}
	case events.ImageEventType:
		switch evt.Action {
		case "pull", "load", "tag":
			w.enqueue(kindImage, evt.Actor.ID)
		case "untag", "delete", "remove":
			id := evt.Actor.ID
			w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(id) })
		}
	case events.NetworkEventType:
		switch evt.Action {
		case "create", "connect", "disconnect":
			w.enqueue(kindNetwork, evt.Actor.ID)
		case "destroy", "remove":
			id := evt.Actor.ID
			w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(id) })
		}
	case events.VolumeEventType:
		switch evt.Action {
		case "create":
			w.enqueue(kindVolume, evt.Actor.ID)
		case "remove", "destroy":
			name := evt.Actor.ID
			w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(name) })
		}
	}
}

/* ===================== Inspect workers ===================== */

func (w *Watcher) inspectContainer(ctx context.Context, id string, log *slog.Logger) {
	info, err := w.cli.ContainerInspect(ctx, id)
	if err != nil {
		// container might be gone; warn at debug to avoid noise
		log.Debug("inspect container failed", "id", id, "err", err.Error())
		return
	}

	labels := info.Config.Labels
	stack := labels["com.docker.stack.namespace"]
	if stack == "" {
		stack = labels["com.docker.compose.project"]
	}
	svc := labels["com.docker.swarm.service.name"]
	if svc == "" {
		svc = labels["com.docker.compose.service"]
	}
	name := nameTrimLeading(info.Name)

	w.store.Mutate(func(g *model.InfraGraph) {
		// Upsert node
		g.UpsertNode(model.Node{
			ID:   info.ID,
			Kind: model.NodeContainer,
			Name: name,
			Attributes: map[string]string{
				"image":   info.Image,
				"status":  info.State.Status,
				"created": info.Created,
				"stack":   stack,
				"service": svc,
			},
		})

		// Rewire edges for this container (prune first)
		g.RemoveEdgesWhere(func(e model.Edge) bool { return e.Src == info.ID || e.Dst == info.ID })

		// derived_from (prefer exact image ID if known in graph)
		imgID := info.Image
		if _, ok := g.Nodes[imgID]; ok && imgID != "" {
			g.AddEdge(model.Edge{Src: info.ID, Dst: imgID, Kind: model.EdgeDerivedFrom})
		}

		// connected_to: networks
		for nwName, ep := range info.NetworkSettings.Networks {
			nwID := ep.NetworkID
			if nwID == "" {
				// best-effort: lookup by name
				if nw, err := w.cli.NetworkInspect(ctx, nwName, network.InspectOptions{}); err == nil {
					nwID = nw.ID
				}
			}
			if nwID != "" {
				if _, ok := g.Nodes[nwID]; ok {
					g.AddEdge(model.Edge{
						Src:  info.ID,
						Dst:  nwID,
						Kind: model.EdgeConnectedTo,
						Attributes: map[string]string{
							"ip": ep.IPAddress,
						},
					})
				}
			}
		}

		// mounted_into: volumes
		for _, m := range info.Mounts {
			if m.Type == mount.TypeVolume && m.Name != "" {
				if _, ok := g.Nodes[m.Name]; ok {
					g.AddEdge(model.Edge{
						Src:  m.Name,
						Dst:  info.ID,
						Kind: model.EdgeMountedInto,
						Attributes: map[string]string{
							"target": m.Destination,
							"rw":     boolStr(m.RW),
						},
					})
				}
			}
		}
	})
}

func (w *Watcher) inspectImage(ctx context.Context, id string, log *slog.Logger) {
	img, _, err := w.cli.ImageInspectWithRaw(ctx, id)
	if err != nil {
		// Fallback by name (actor attr "name" often contains reference) — best-effort
		log.Debug("inspect image failed", "id", id, "err", err.Error())
		return
	}
	name := firstNonEmpty(img.RepoTags...)
	w.store.Mutate(func(g *model.InfraGraph) {
		g.UpsertNode(model.Node{
			ID:   img.ID,
			Kind: model.NodeImage,
			Name: nameOrShortID(name, img.ID),
			Attributes: map[string]string{
				"size": itoa64(img.Size),
			},
		})
	})
}

func (w *Watcher) inspectNetwork(ctx context.Context, id string, log *slog.Logger) {
	nw, err := w.cli.NetworkInspect(ctx, id, network.InspectOptions{})
	if err != nil {
		log.Debug("inspect network failed", "id", id, "err", err.Error())
		return
	}
	w.store.Mutate(func(g *model.InfraGraph) {
		g.UpsertNode(model.Node{
			ID:   nw.ID,
			Kind: model.NodeNetwork,
			Name: nw.Name,
			Attributes: map[string]string{
				"driver": nw.Driver,
				"scope":  nw.Scope,
			},
		})
	})
	// connect/disconnect edges are rebuilt on container inspect; no-op here
}

func (w *Watcher) inspectVolume(ctx context.Context, name string, log *slog.Logger) {
	vol, err := w.cli.VolumeInspect(ctx, name)
	if err != nil {
		log.Debug("inspect volume failed", "name", name, "err", err.Error())
		return
	}
	w.store.Mutate(func(g *model.InfraGraph) {
		g.UpsertNode(model.Node{
			ID:   vol.Name,
			Kind: model.NodeVolume,
			Name: vol.Name,
			Attributes: map[string]string{
				"driver":     vol.Driver,
				"mountpoint": vol.Mountpoint,
			},
		})
	})
}

/* ===================== Work queue helpers ===================== */

type workKind uint8

const (
	kindContainer workKind = iota + 1
	kindImage
	kindNetwork
	kindVolume
)

type workItem struct {
	kind workKind
	id   string
}

func (w *Watcher) enqueue(k workKind, id string) {
	select {
	case w.workCh <- workItem{kind: k, id: id}:
	default:
		w.log.Warn("work queue full; dropping", "kind", k, "id", id)
	}
}

func (w *Watcher) enqueueDebounced(k workKind, id string) {
	if k != kindContainer || w.opts.InspectDebounce <= 0 {
		w.enqueue(k, id)
		return
	}
	now := time.Now()
	lastI, _ := w.lastSeen.LoadOrStore(id, now)
	last := lastI.(time.Time)
	if now.Sub(last) >= w.opts.InspectDebounce {
		w.lastSeen.Store(id, now)
		w.enqueue(k, id)
	}
}

/* ===================== Utilities ===================== */

func firstNonEmpty(ss ...string) string {
	for _, s := range ss {
		if s != "" {
			return s
		}
	}
	return ""
}
func nameOrShortID(name, id string) string {
	if name != "" {
		return name
	}
	if len(id) > 12 {
		return id[:12]
	}
	return id
}
func nameTrimLeading(s string) string {
	for len(s) > 0 && s[0] == '/' {
		s = s[1:]
	}
	return s
}
func itoa64(n int64) string { return strconvI64(n) }

// inline minimal fast int64 -> string without fmt (small win)
func strconvI64(n int64) string { return (func() string { return strconv.FormatInt(n, 10) })() }

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
