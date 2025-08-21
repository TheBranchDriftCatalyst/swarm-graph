// This file documents how to fetch the vendored mermaid ESM build.
// Run with: go generate ./...

package assets

//go:generate curl -fsSL https://cdn.jsdelivr.net/npm/mermaid@11.10.0/+esm -o mermaid.esm.mjs
