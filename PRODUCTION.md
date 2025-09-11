# Production Build Guide

This document describes how to build and run the Swarm Graph application as a single production image where the Go backend serves the built React frontend.

## Changes Made

### 1. Backend Changes (Go)

- **Modified `backend/internal/httpapi/server.go`**:
  - Added `StaticPath` option to the `Options` struct
  - Added `createStaticHandler()` function for serving static files with SPA routing support
  - Updated the main handler to serve static files when `StaticPath` is configured
  - Added proper SPA routing (serves `index.html` for non-API routes)

- **Modified `backend/cmd/agent/main.go`**:
  - Added support for `STATIC_PATH` environment variable to configure static file serving

### 2. Build System Changes

- **Added production build tasks to `Taskfile.yml`**:
  - `frontend:build` - Builds the React frontend for production
  - `build` - Builds the complete application (frontend + backend)
  - `run:production` - Runs the production build locally
  - `docker:build:production` - Builds production Docker image
  - `docker:run:production` - Runs production Docker container
  - `clean` - Cleans build artifacts

- **Created `Dockerfile.production`**:
  - Multi-stage build with frontend, backend, and final production stages
  - Uses Node.js 20 and Go 1.22 with Alpine Linux for security
  - Optimized for production with minimal final image size

## Usage

### Local Production Build

1. **Build the complete application**:
   ```bash
   task build
   ```
   This will:
   - Install frontend dependencies
   - Build the React app to `frontend/dist`
   - Build the Go binary to `backend/bin/agent`

2. **Run the production build locally**:
   ```bash
   task run:production
   ```
   This runs the Go backend with `STATIC_PATH=../frontend/dist`, serving the built React app.

### Docker Production Build

1. **Build the production Docker image**:
   ```bash
   task docker:build:production
   ```

2. **Run the production Docker container**:
   ```bash
   task docker:run:production
   ```
   This will build and run the container, exposing the application on port 9123.

### Manual Docker Commands

```bash
# Build the production image
docker build -f Dockerfile.production -t swarm-graph:production .

# Run the production container
docker run -p 9123:9123 -v /var/run/docker.sock:/var/run/docker.sock swarm-graph:production
```

## How It Works

### Static File Serving

The Go backend now includes a static file server that:

1. **Serves static assets** from the configured `STATIC_PATH` directory
2. **Handles SPA routing** by serving `index.html` for non-API routes
3. **Preserves API endpoints** at their original paths:
   - `/graph.json`, `/graph.mmd`, `/graph.svg`, `/graph.png`
   - `/docker/inspect`
   - `/health`
   - `/swagger/*`

### Environment Configuration

- **`STATIC_PATH`**: Path to the built frontend files (e.g., `./frontend/dist`)
- **`LOG_LEVEL`**: Logging level (default: INFO)
- **`CORS_ORIGIN`**: CORS origin setting (default: *)

### Production vs Development

- **Development**: Frontend runs on port 5173 (Vite dev server), backend on 9123
- **Production**: Single Go application serves everything on port 9123

## File Structure After Build

```
backend/
├── bin/
│   └── agent              # Production Go binary
frontend/
├── dist/                  # Built React app
│   ├── index.html
│   ├── assets/
│   └── ...
```

## Health Check

The production Docker image includes a health check that pings `/health` every 30 seconds.

## Clean Up

To clean build artifacts:
```bash
task clean
```

This removes:
- `frontend/dist/`
- `backend/bin/agent`