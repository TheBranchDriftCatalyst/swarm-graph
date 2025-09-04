Swarm Graph HTTP API — Swagger integration

This package includes a minimal integration with swaggo/http-swagger to serve
Swagger UI at /swagger/ and the JSON at /swagger/doc.json.

To generate richer API documentation and have the UI display full endpoint
specs, install the swag CLI and generate docs:

1. Install swag CLI (requires Go 1.20+):

   go install github.com/swaggo/swag/cmd/swag@latest

2. From the repository root run:

   swag init -g internal/httpapi/server.go -o internal/httpapi/docs

This will overwrite the placeholder `internal/httpapi/docs/docs.go` with
generated docs. Then run `go mod tidy` to fetch the http-swagger module and
start your server. The Swagger UI will be available at http://localhost:PORT/swagger/.

If you prefer not to install the CLI, the placeholder docs will still allow the
server to compile and show an empty UI shell.
