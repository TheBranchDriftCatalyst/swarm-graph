package docker

import (
	"context"
	"fmt"
	"log/slog"
	"os"
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
	cli   *client.Client
	store *store.MemoryStore
	log   *slog.Logger
}

func NewWatcher(store *store.MemoryStore) (*Watcher, error) {
	// Use DOCKER_HOST/DOCKER_SOCKET env if set; default to system defaults.
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	return &Watcher{
		cli:   cli,
		store: store,
		log:   logger.With(slog.String("component", "dockerwatch")),
	}, nil
}

func (w *Watcher) Run(ctx context.Context) error {
	// Seed with a full snapshot.
	if err := w.snapshot(ctx); err != nil {
		return fmt.Errorf("initial snapshot: %w", err)
	}
	w.log.Info("initial snapshot complete")

	// Listen to events.
	args := filters.NewArgs()
	// we can scope to types we care about
	// container, network, volume, image
	stream, errs := w.cli.Events(ctx, events.ListOptions{
		Filters: args,
	})

	for {
		select {
		case <-ctx.Done():
			w.log.Info("context canceled; stopping watcher")
			return ctx.Err()
		case err := <-errs:
			if err == context.Canceled {
				return nil
			}
			if err != nil {
				w.log.Error("docker events error", slog.String("error", err.Error()))
				// Backoff a bit before attempting to re-establish events.
				time.Sleep(2 * time.Second)
				// naive restart
				stream, errs = w.cli.Events(ctx, events.ListOptions{Filters: args})
			}
		case evt := <-stream:
			w.handleEvent(ctx, evt)
		}
	}
}

func (w *Watcher) snapshot(ctx context.Context) error {
	// Images
	imgs, err := w.cli.ImageList(ctx, image.ListOptions{All: true})
	if err != nil {
		return err
	}

	// Networks
	nets, err := w.cli.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return err
	}

	// Volumes
	vols, err := w.cli.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return err
	}

	// Containers
	ctrs, err := w.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return err
	}

	w.store.Mutate(func(g *model.InfraGraph) {
		// Images
		for _, img := range imgs {
			id := img.ID
			name := firstNonEmpty(img.RepoTags...)
			n := model.Node{
				ID:   id,
				Kind: model.NodeImage,
				Name: nameOrShortID(name, id),
				Attributes: map[string]string{
					"size": fmt.Sprintf("%d", img.Size),
					"tags": fmt.Sprintf("%v", img.RepoTags),
					"digests": fmt.Sprintf("%v", img.RepoDigests),
				},
			}
			g.UpsertNode(n)
		}

		// Networks
		for _, nw := range nets {
			id := nw.ID
			n := model.Node{
				ID:   id,
				Kind: model.NodeNetwork,
				Name: nw.Name,
				Attributes: map[string]string{
					"driver": nw.Driver,
					"scope":  nw.Scope,
				},
			}
			g.UpsertNode(n)
		}

		// Volumes
		for _, v := range vols.Volumes {
			id := v.Name // volumes are usually keyed by name
			n := model.Node{
				ID:   id,
				Kind: model.NodeVolume,
				Name: v.Name,
				Attributes: map[string]string{
					"driver": v.Driver,
					"mountpoint": v.Mountpoint,
				},
			}
			g.UpsertNode(n)
		}

		// Containers and edges
		for _, c := range ctrs {
      info, err := w.cli.ContainerInspect(ctx, c.ID)
      if err != nil { continue }

      labels := info.Config.Labels
      stack := labels["com.docker.stack.namespace"]
      if stack == "" {
          stack = labels["com.docker.compose.project"]
      }
      svc := labels["com.docker.swarm.service.name"]
      if svc == "" {
          svc = labels["com.docker.compose.service"]
      }

      cNode := model.Node{
          ID:   info.ID,
          Kind: model.NodeContainer,
          Name: nameTrimLeading(info.Name),
			Attributes: map[string]string{
				"image":   info.Image,
				"state":   info.State.Status,
				"status":  info.State.Status,
				"created": info.Created,
				"stack":   stack,
				"service": svc,
			},
      }
      g.UpsertNode(cNode)

			// container -> image edge (best effort: by image ID if present)
			imgID := c.ImageID
			if _, ok := g.Nodes[imgID]; ok && imgID != "" {
				g.AddEdge(model.Edge{Src: c.ID, Dst: imgID, Kind: model.EdgeDerivedFrom})
			}

			// container -> network edges
			for _, nw := range c.NetworkSettings.Networks {
				if nw.NetworkID != "" {
					if _, ok := g.Nodes[nw.NetworkID]; ok {
						g.AddEdge(model.Edge{Src: c.ID, Dst: nw.NetworkID, Kind: model.EdgeConnectedTo,
							Attributes: map[string]string{
								"ip": nw.IPAddress,
							},
						})
					}
				}
			}

			// volume -> container edges (from mounts)
			for _, m := range c.Mounts {
				if m.Type == mount.TypeVolume && m.Name != "" {
					if _, ok := g.Nodes[m.Name]; ok {
						g.AddEdge(model.Edge{Src: m.Name, Dst: c.ID, Kind: model.EdgeMountedInto,
							Attributes: map[string]string{
								"target": m.Destination,
								"rw":     fmt.Sprintf("%t", m.RW),
							},
						})
					}
				}
			}
		}
	})

	return nil
}

func (w *Watcher) handleEvent(ctx context.Context, evt events.Message) {
	// Minimal logging for now.
	w.log.Debug("event",
		slog.String("type", string(evt.Type)),
		slog.String("action", string(evt.Action)),
		slog.String("id", evt.ID),
	)

	switch evt.Type {
	case events.ContainerEventType:
		w.handleContainerEvent(ctx, evt)
	case events.ImageEventType:
		w.handleImageEvent(ctx, evt)
	case events.NetworkEventType:
		w.handleNetworkEvent(ctx, evt)
	case events.VolumeEventType:
		w.handleVolumeEvent(ctx, evt)
	default:
		// ignore others
    // TODO what other events are there that we can look into
	}
}

func (w *Watcher) handleContainerEvent(ctx context.Context, evt events.Message) {
	id := evt.Actor.ID

	switch evt.Action {
	case "create", "start", "restart":
		// Re-pull container inspect to refresh node + edges.
		info, err := w.cli.ContainerInspect(ctx, id)
		if err != nil {
			w.log.Warn("inspect container failed", slog.String("id", id), slog.String("err", err.Error()))
			return
		}
		w.store.Mutate(func(g *model.InfraGraph) {
			name := info.Name
			n := model.Node{
				ID:   info.ID,
				Kind: model.NodeContainer,
				Name: nameTrimLeading(name),
				Attributes: map[string]string{
					"image":   info.Image,
					"state":   info.State.Status,
					"status":  info.State.Status,
					"created": info.Created,
				},
			}
			g.UpsertNode(n)

			// prune existing edges from this container, we'll rewire
			g.RemoveEdgesWhere(func(e model.Edge) bool { return e.Src == info.ID || e.Dst == info.ID })

			// derived_from
			if _, ok := g.Nodes[info.Image]; ok && info.Image != "" {
				g.AddEdge(model.Edge{Src: info.ID, Dst: info.Image, Kind: model.EdgeDerivedFrom})
			}

			// connected_to: networks
			for nwName, ep := range info.NetworkSettings.Networks {
				// need network id; fallback to network name if missing
				nwID := ep.NetworkID
				if nwID == "" {
					// try lookup by name
					nw, err := w.cli.NetworkInspect(ctx, nwName, network.InspectOptions{})
					if err == nil {
						nwID = nw.ID
					}
				}
				if nwID != "" {
					if _, ok := g.Nodes[nwID]; ok {
						g.AddEdge(model.Edge{Src: info.ID, Dst: nwID, Kind: model.EdgeConnectedTo,
							Attributes: map[string]string{"ip": ep.IPAddress}})
					}
				}
			}

			// mounted_into: volumes
			for _, m := range info.Mounts {
				if m.Type == mount.TypeVolume && m.Name != "" {
					if _, ok := g.Nodes[m.Name]; ok {
						g.AddEdge(model.Edge{Src: m.Name, Dst: info.ID, Kind: model.EdgeMountedInto,
							Attributes: map[string]string{"target": m.Destination, "rw": fmt.Sprintf("%t", m.RW)}})
					}
				}
			}
		})

	case "die", "stop":
		// Update status but keep node (so graph reflects stopped state).
		info, err := w.cli.ContainerInspect(ctx, id)
		if err != nil {
			w.log.Warn("inspect container failed", slog.String("id", id), slog.String("err", err.Error()))
			return
		}
		w.store.Mutate(func(g *model.InfraGraph) {
			if n, ok := g.Nodes[id]; ok {
				n.Attributes["state"] = info.State.Status
				n.Attributes["status"] = info.State.Status
				g.UpsertNode(n)
			}
		})

	case "destroy", "remove":
		// Remove node + incident edges.
		w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(id) })
	}
}

func (w *Watcher) handleImageEvent(ctx context.Context, evt events.Message) {
	id := evt.Actor.ID
	switch evt.Action {
	case "pull", "load", "tag":
		img, _, err := w.cli.ImageInspectWithRaw(ctx, id)
		if err != nil {
			// Sometimes ID is a digest or short — try actor attributes
			if ref := evt.Actor.Attributes["name"]; ref != "" {
				img2, _, err2 := w.cli.ImageInspectWithRaw(ctx, ref)
				if err2 != nil {
					w.log.Warn("inspect image failed", slog.String("id", id), slog.String("err", err.Error()))
					return
				}
				img = img2
			} else {
				w.log.Warn("inspect image failed", slog.String("id", id), slog.String("err", err.Error()))
				return
			}
		}
		name := firstNonEmpty(img.RepoTags...)
		n := model.Node{
			ID:   img.ID,
			Kind: model.NodeImage,
			Name: nameOrShortID(name, img.ID),
			Attributes: map[string]string{
				"size": fmt.Sprintf("%d", img.Size),
			},
		}
		w.store.Mutate(func(g *model.InfraGraph) { g.UpsertNode(n) })

	case "untag", "delete", "remove":
		w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(id) })
	}
}

func (w *Watcher) handleNetworkEvent(ctx context.Context, evt events.Message) {
	id := evt.Actor.ID
	switch evt.Action {
	case "create":
		nw, err := w.cli.NetworkInspect(ctx, id, network.InspectOptions{})
		if err != nil {
			w.log.Warn("inspect network failed", slog.String("id", id), slog.String("err", err.Error()))
			return
		}
		n := model.Node{
			ID:   nw.ID,
			Kind: model.NodeNetwork,
			Name: nw.Name,
			Attributes: map[string]string{"driver": nw.Driver, "scope": nw.Scope},
		}
		w.store.Mutate(func(g *model.InfraGraph) { g.UpsertNode(n) })

	case "destroy", "remove":
		w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(id) })

	case "connect":
		ctr := evt.Actor.Attributes["container"]
		if ctr == "" {
			return
		}
		w.store.Mutate(func(g *model.InfraGraph) {
			if _, ok := g.Nodes[ctr]; ok {
				if _, ok2 := g.Nodes[id]; ok2 {
					g.AddEdge(model.Edge{Src: ctr, Dst: id, Kind: model.EdgeConnectedTo})
				}
			}
		})

	case "disconnect":
		ctr := evt.Actor.Attributes["container"]
		w.store.Mutate(func(g *model.InfraGraph) {
			g.RemoveEdgesWhere(func(e model.Edge) bool {
				return e.Kind == model.EdgeConnectedTo && e.Src == ctr && e.Dst == id
			})
		})
	}
}

func (w *Watcher) handleVolumeEvent(ctx context.Context, evt events.Message) {
	name := evt.Actor.ID // volume id is usually the name
	switch evt.Action {
	case "create":
		vol, err := w.cli.VolumeInspect(ctx, name)
		if err != nil {
			w.log.Warn("inspect volume failed", slog.String("name", name), slog.String("err", err.Error()))
			return
		}
		n := model.Node{
			ID:   vol.Name,
			Kind: model.NodeVolume,
			Name: vol.Name,
			Attributes: map[string]string{
				"driver":     vol.Driver,
				"mountpoint": vol.Mountpoint,
			},
		}
		w.store.Mutate(func(g *model.InfraGraph) { g.UpsertNode(n) })

	case "remove", "destroy":
		w.store.Mutate(func(g *model.InfraGraph) { g.RemoveNode(name) })
	}
}

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

func nameTrimSlash(names []string) string {
	if len(names) == 0 {
		return ""
	}
	return nameTrimLeading(names[0])
}
func nameTrimLeading(s string) string {
	for len(s) > 0 && s[0] == '/' {
		s = s[1:]
	}
	return s
}
