package httpapi

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"swarm-graph/internal/mermaid"
	"swarm-graph/internal/store"
)

var uiFS embed.FS

func Handler(st *store.MemoryStore) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/graph.mmd", func(w http.ResponseWriter, r *http.Request) {
		g := st.Snapshot()
		txt, err := mermaid.Render(g, mermaid.DefaultOptions())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte(txt))
	})

  mux.HandleFunc("/graph.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		snap := st.Snapshot()
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		_ = enc.Encode(snap)
	})

	// Serve the D3 UI at /
	// mux.Handle("/", http.FileServer(http.FS(uiFS)))

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "ok")
	})

	return mux
}
