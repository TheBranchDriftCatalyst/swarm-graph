package utils

import (
	"context"
	"log/slog"
	"testing"
)

func TestDockerClient(t *testing.T) {
	logger := slog.Default()

	// Test creating a Docker client
	client, err := NewDockerClient(logger)
	if err != nil {
		t.Skipf("Docker client creation failed (likely Docker not available): %v", err)
	}
	defer client.Close()

	ctx := context.Background()

	// Test inspecting a non-existent resource
	_, err = client.InspectAny(ctx, "non-existent-id")
	if err == nil {
		t.Error("Expected error when inspecting non-existent resource")
	}
}
