# Swarm Graph - Docker Container Topology Visualizer

A lightweight agent that watches a Docker daemon and provides real-time visualization of your container topology through a beautiful web interface.

## 🚀 Quick Start

```bash
# Run with your local Docker daemon
docker run -d \
  --name swarm-graph \
  -p 9123:9123 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  commandopanda/swarm-graph:latest
```

or docker-compose:

```yaml
version: '3.8'
services:
  swarm-graph:
    image: commandopanda/swarm-graph:latest
    ports:
      - "9123:9123"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

```

Then visit: http://localhost:9123

## ✨ Features

- **Real-time Docker topology** - Watch containers, images, networks, and volumes
- **Interactive visualization** - D3.js-powered graph with filtering and search
- **Multiple export formats** - JSON, Mermaid, SVG, PNG via Kroki integration
- **REST API** - Programmatic access to topology data
- **Zero configuration** - Just mount the Docker socket and go

## 🔧 Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARN, ERROR) |
| `KROKI_URL` | `https://kroki.io` | Kroki server for diagram rendering |

## 📊 API Endpoints

- `GET /` - Web interface
- `GET /graph.json` - Topology data (JSON)
- `GET /graph.mmd` - Mermaid diagram source
- `GET /graph.svg` - Rendered SVG diagram
- `GET /graph.png` - Rendered PNG diagram
- `GET /health` - Health check

## 🏗️ Development

This is an open-source project. Check out the [GitHub repository](https://github.com/TheBranchDriftCatalyst/swarm-graph) for:

- Source code and documentation
- Development setup instructions
- Contributing guidelines
- Issue tracking

## 📜 License

MIT License - see the [repository](https://github.com/TheBranchDriftCatalyst/swarm-graph) for details.

---

**Tags:** docker, container, visualization, topology, monitoring, devops