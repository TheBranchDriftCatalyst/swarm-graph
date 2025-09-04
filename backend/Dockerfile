# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /src

# Cache modules
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
# adjust output path and package path (./... or ./cmd/yourapp) as needed
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -ldflags="-s -w" -o /app/agent ./


# Final runtime stage
FROM alpine:3.18 AS runtime
RUN apk add --no-cache ca-certificates
WORKDIR /app

# copy the statically built binary from builder
COPY --from=builder /app/agent .

# drop privileges (optional)
RUN addgroup -S app && adduser -S -G app app
USER app

# configure as needed (EXPOSE, ENV)
ENTRYPOINT ["./agent"]

# Optional dev stage for live reload (use only in development)
# docker build --target=dev -t myapp:dev .
FROM golang:1.24-alpine AS dev
WORKDIR /app
RUN apk add --no-cache bash git
RUN go install github.com/air-verse/air@latest
COPY . .
CMD ["air"]
