package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
)

// DockerClient wraps the Docker API client with common operations
type DockerClient struct {
	client *client.Client
	logger *slog.Logger
}

// NewDockerClient creates a new Docker client wrapper
func NewDockerClient(logger *slog.Logger) (*DockerClient, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	return &DockerClient{
		client: cli,
		logger: logger,
	}, nil
}

// Close closes the Docker client connection
func (dc *DockerClient) Close() error {
	return dc.client.Close()
}

// InspectContainer inspects a container by ID and returns the inspection data as JSON
func (dc *DockerClient) InspectContainer(ctx context.Context, containerID string) ([]byte, error) {
	inspect, err := dc.client.ContainerInspect(ctx, containerID)
	if err != nil {
		dc.logger.Warn("container inspect failed", "id", containerID, "err", err.Error())
		return nil, fmt.Errorf("container inspect failed: %w", err)
	}

	// Marshal to JSON to match the CLI output format
	data, err := json.Marshal([]types.ContainerJSON{inspect})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal container inspect data: %w", err)
	}

	return data, nil
}

// InspectImage inspects an image by ID and returns the inspection data as JSON
func (dc *DockerClient) InspectImage(ctx context.Context, imageID string) ([]byte, error) {
	inspect, _, err := dc.client.ImageInspectWithRaw(ctx, imageID)
	if err != nil {
		dc.logger.Warn("image inspect failed", "id", imageID, "err", err.Error())
		return nil, fmt.Errorf("image inspect failed: %w", err)
	}

	// Marshal to JSON to match the CLI output format
	data, err := json.Marshal([]types.ImageInspect{inspect})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal image inspect data: %w", err)
	}

	return data, nil
}

// InspectNetwork inspects a network by ID and returns the inspection data as JSON
func (dc *DockerClient) InspectNetwork(ctx context.Context, networkID string) ([]byte, error) {
	inspect, err := dc.client.NetworkInspect(ctx, networkID, network.InspectOptions{})
	if err != nil {
		dc.logger.Warn("network inspect failed", "id", networkID, "err", err.Error())
		return nil, fmt.Errorf("network inspect failed: %w", err)
	}

	// Marshal to JSON to match the CLI output format - wrap in array for consistency with CLI
	data, err := json.Marshal([]interface{}{inspect})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal network inspect data: %w", err)
	}

	return data, nil
}

// InspectVolume inspects a volume by name and returns the inspection data as JSON
func (dc *DockerClient) InspectVolume(ctx context.Context, volumeName string) ([]byte, error) {
	inspect, err := dc.client.VolumeInspect(ctx, volumeName)
	if err != nil {
		dc.logger.Warn("volume inspect failed", "name", volumeName, "err", err.Error())
		return nil, fmt.Errorf("volume inspect failed: %w", err)
	}

	// Marshal to JSON to match the CLI output format - wrap in array for consistency with CLI
	data, err := json.Marshal([]*volume.Volume{&inspect})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal volume inspect data: %w", err)
	}

	return data, nil
}

// InspectAny attempts to inspect a resource by ID, trying different resource types
func (dc *DockerClient) InspectAny(ctx context.Context, id string) ([]byte, error) {
	// Try container first (most common case)
	if data, err := dc.InspectContainer(ctx, id); err == nil {
		return data, nil
	}

	// Try image
	if data, err := dc.InspectImage(ctx, id); err == nil {
		return data, nil
	}

	// Try network
	if data, err := dc.InspectNetwork(ctx, id); err == nil {
		return data, nil
	}

	// Try volume
	if data, err := dc.InspectVolume(ctx, id); err == nil {
		return data, nil
	}

	return nil, fmt.Errorf("resource not found: %s", id)
}

// Ping performs a lightweight ping to the Docker daemon.
func (dc *DockerClient) Ping(ctx context.Context) (types.Ping, error) {
	resp, err := dc.client.Ping(ctx)
	if err != nil {
		dc.logger.Debug("docker ping failed", "err", err.Error())
		return types.Ping{}, err
	}
	dc.logger.Debug("docker ping ok", "apiVersion", resp.APIVersion)
	return resp, nil
}

// Events returns a Docker event stream for the caller to consume.
func (dc *DockerClient) Events(ctx context.Context, lo events.ListOptions) (<-chan events.Message, <-chan error) {
	dc.logger.Debug("docker events subscribe", "filters", lo.Filters)
	return dc.client.Events(ctx, lo)
}

// ListContainers lists containers; all=true includes stopped containers.

// ListImages lists images.
