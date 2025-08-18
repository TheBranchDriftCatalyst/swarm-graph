# Swarm Graph

Lightweight agent that watches the local Docker daemon, builds an in-memory graph of images, containers, networks and volumes, and exposes a small HTTP API and renderer.

## Prerequisites

- Go 1.23+
- Docker (for integration and building containers)
- Task (optional) — used for shortcuts in this repo
- air (optional) — used for live reload during development (we provide a Taskfile target)

## Quick start (development)

1. Install deps and tidy:

```sh
task deps
task tidy
```

2. Run with live reload (Air):

```sh
task dev
```

This will build `bin/agent` and run `air` which watches the repository and restarts the binary on changes. The agent serves an HTTP API on port `:9123` by default.

## Build and run locally

Build the agent binary and run it directly:

```sh
task build
task run
```

## Docker

Build a production image (uses multi-stage Dockerfile):

```sh
docker build -t swarm-graph:latest .
```

Use docker-compose for quick dev or prod runs (see `docker-compose.yml`):

```sh
# development (mounts code and runs air)
docker compose up --build agent-dev

# production (builds runtime image)
docker compose up --build agent
```

## Tasks

The `Taskfile.yml` includes shortcuts for common workflows:

- `task deps` — download go dependencies
- `task tidy` — run `go mod tidy`
- `task build` — build binary into `bin/agent`
- `task run` — run the agent via `go run`
- `task dev` — run air live reload
- `task docker:build` — build docker image
- `task docker:up` / `task docker:down` — manage compose

## Notes

- The agent relies on having access to the Docker socket or a reachable Docker daemon via `DOCKER_HOST`.
- The HTTP API is served on port `9123` by default. If the port is in use the server will log an error.
- If you want the dev container to access the host Docker daemon, mount your Docker socket into the container in `docker-compose.yml`.

## Troubleshooting

- If Air reports "no Go files in ..." ensure `go.mod` is present in the repository root and `module` is set correctly.
- If imports fail after upgrading Docker modules, run `task refresh` (get + tidy) to sync `go.mod`.

---

Happy hacking.
