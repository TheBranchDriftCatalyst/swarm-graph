#!/bin/bash

# Production Build and Release Script for Swarm Graph
# This script handles versioning, building, tagging, and pushing to Docker registry

set -euo pipefail

# Load environment variables from .env file if it exists
if [[ -f ".env" ]]; then
    set -a  # automatically export all variables
    source .env
    set +a  # disable automatic export
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY_URL="${REGISTRY_URL:-}"
IMAGE_NAME="${IMAGE_NAME:-swarm-graph}"
DOCKERFILE="Dockerfile.production"
VERSION_FILE="VERSION"
BUILDX_ENABLED="${BUILDX_ENABLED:-false}"
BUILD_ARCHS="${BUILD_ARCHS:-linux/amd64,linux/arm64}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Display current configuration
show_config() {
    log_info "Configuration:"
    echo "  REGISTRY_URL: ${REGISTRY_URL:-"(not set)"}"
    echo "  IMAGE_NAME: ${IMAGE_NAME}"
    echo "  DOCKERFILE: ${DOCKERFILE}"
    echo "  VERSION_FILE: ${VERSION_FILE}"
    echo "  PUSH_GIT_TAGS: ${PUSH_GIT_TAGS:-true}"
    if [[ -n "$REGISTRY_URL" ]]; then
        echo "  Full image name: ${REGISTRY_URL}/${IMAGE_NAME}"
    else
        echo "  Full image name: ${IMAGE_NAME} (local only)"
    fi
    echo
}

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository!"
        exit 1
    fi
}

# Check for uncommitted changes
check_clean_working_tree() {
    if ! git diff-index --quiet HEAD --; then
        log_error "Working tree is not clean. Please commit or stash your changes."
        git status --porcelain
        exit 1
    fi
}

# Get current version from VERSION file or git tags
get_current_version() {
    if [[ -f "$VERSION_FILE" ]]; then
        cat "$VERSION_FILE"
    else
        # Try to get latest git tag, fallback to 0.0.0
        git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0"
    fi
}

# Increment version based on type (patch, minor, major)
increment_version() {
    local version=$1
    local type=${2:-patch}
    
    IFS='.' read -ra PARTS <<< "$version"
    local major=${PARTS[0]:-0}
    local minor=${PARTS[1]:-0}
    local patch=${PARTS[2]:-0}
    
    case $type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            log_error "Invalid version type: $type. Use major, minor, or patch."
            exit 1
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# Build the application
build_app() {
    log_info "Building frontend and backend..."
    
    # Use task if available, otherwise use direct commands
    if command -v task &> /dev/null; then
        task build
    else
        log_info "Task not found, using direct commands..."
        cd frontend && yarn install && yarn build && cd ..
        cd backend && go build -o bin/agent ./cmd/agent && cd ..
    fi
    
    log_success "Application build completed"
}

# Build Docker image with multiple tags
build_docker_image() {
    local version=$1
    local image_base="${REGISTRY_URL:+$REGISTRY_URL/}$IMAGE_NAME"
    
    log_info "Building Docker image: $image_base:$version"
    
    # Build with version tag and latest tag
    if [[ "$BUILDX_ENABLED" == "true" ]]; then
        log_info "Building multi-arch images with buildx for: ${BUILD_ARCHS}"
        ensure_buildx
        # buildx will create a manifest list and push multi-arch images when --push is used
        docker buildx build --platform "$BUILD_ARCHS" \
            -f "$DOCKERFILE" \
            -t "$image_base:$version" \
            -t "$image_base:latest" \
            --push \
            .
        # Some registries or buildx setups may not create the 'latest' manifest list
        # consistently. Ensure 'latest' points to the same multi-arch manifest as the
        # versioned tag by explicitly creating/pushing it from the version manifest.
        if command -v docker > /dev/null 2>&1 && docker buildx imagetools > /dev/null 2>&1; then
            log_info "Ensuring '${image_base}:latest' manifest points to '${image_base}:${version}'"
            if docker buildx imagetools create --tag "${image_base}:latest" "${image_base}:${version}" > /dev/null 2>&1; then
                log_info "Created/updated manifest for ${image_base}:latest"
                docker buildx imagetools inspect "${image_base}:latest" || true
            else
                log_warning "Failed to create imagetools manifest for ${image_base}:latest; trying docker manifest fallback"
                if command -v docker > /dev/null 2>&1 && docker manifest > /dev/null 2>&1; then
                    docker manifest create "${image_base}:latest" "${image_base}:${version}" || true
                    docker manifest push "${image_base}:latest" || true
                fi
            fi
        fi
        # In buildx push mode images are already pushed; set DOCKER_IMAGE_* to the remote references
    else
        docker build -f "$DOCKERFILE" \
            -t "$image_base:$version" \
            -t "$image_base:latest" \
            .
    fi
    
    log_success "Docker image built successfully"
    
    # Export image names for later use
    export DOCKER_IMAGE_VERSIONED="$image_base:$version"
    export DOCKER_IMAGE_LATEST="$image_base:latest"
}

# Push to Docker registry
push_docker_images() {
    if [[ -z "$REGISTRY_URL" ]]; then
        log_warning "No registry URL specified. Skipping push to registry."
        log_info "To push to a registry, set REGISTRY_URL environment variable"
        log_info "Example: export REGISTRY_URL=your-registry.com"
        return 0
    fi
    
    log_info "Pushing Docker images to registry..."
    
    docker push "$DOCKER_IMAGE_VERSIONED"
    docker push "$DOCKER_IMAGE_LATEST"
    
    log_success "Docker images pushed to registry"
}

# Ensure buildx is available and qemu registered for multi-arch builds
ensure_buildx() {
    if ! docker buildx version > /dev/null 2>&1; then
        log_error "docker buildx is not available. Please enable Docker Buildx on your host."
        log_info "See: https://docs.docker.com/buildx/working-with-buildx/"
        exit 1
    fi

    # Try to register qemu emulators for cross-building (best-effort)
    if ! docker run --rm --privileged tonistiigi/binfmt --version > /dev/null 2>&1; then
        log_info "Registering QEMU emulators for cross-building..."
        if docker run --rm --privileged tonistiigi/binfmt --install all > /dev/null 2>&1; then
            log_info "QEMU emulators registered"
        else
            log_warning "Failed to register QEMU emulators. Cross-builds may fail on some hosts."
            log_info "If you are on a Linux host, ensure binfmt_misc and qemu-user-static are available."
        fi
    fi

    # Ensure a buildx builder exists and is bootstrapped
    local builder_name=${BUILDX_BUILDER_NAME:-swarmgraph-builder}
    if ! docker buildx inspect "$builder_name" > /dev/null 2>&1; then
        log_info "Creating buildx builder: $builder_name"
        docker buildx create --name "$builder_name" --use > /dev/null
    else
        # Use the builder if it exists
        docker buildx use "$builder_name" > /dev/null 2>&1 || true
    fi
    log_info "Bootstrapping buildx builder..."
    docker buildx inspect --bootstrap > /dev/null 2>&1 || true
}

# Save version to file
save_version() {
    local version=$1
    echo "$version" > "$VERSION_FILE"
    git add "$VERSION_FILE"
    git commit -m "Bump version to $version"
    log_success "Version saved to $VERSION_FILE and committed"
}

# Rollback version commit if something fails
rollback_version() {
    local current_version=$1
    log_warning "Rolling back version commit..."
    
    # Reset to previous commit (undo the version bump commit)
    git reset --hard HEAD~1
    
    # Restore previous version
    echo "$current_version" > "$VERSION_FILE"
    
    log_success "Version rollback completed"
}

# Create git tag (only called after successful build and push)
create_git_tag() {
    local version=$1
    local tag="v$version"
    
    log_info "Creating git tag: $tag"
    
    # Create annotated tag with build info
    git tag -a "$tag" -m "Release $tag

Built on: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
Commit: $(git rev-parse HEAD)
Docker Images:
- ${DOCKER_IMAGE_VERSIONED}
- ${DOCKER_IMAGE_LATEST}"
    
    log_success "Git tag $tag created"
}

# Push git tags (only called after successful tag creation)
push_git_tags() {
    local push_tags=${PUSH_GIT_TAGS:-true}
    
    if [[ "$push_tags" == "true" ]]; then
        log_info "Pushing git tags to remote..."
        git push origin --tags
        log_success "Git tags pushed to remote"
    else
        log_info "Skipping git tag push (PUSH_GIT_TAGS=false)"
    fi
}

# Main function
main() {
    local version_type="${1:-patch}"
    local force_version="${2:-}"
    
    log_info "Starting production build and release process..."
    
    # Show current configuration
    show_config
    
    # Pre-flight checks
    check_git_repo
    check_clean_working_tree
    
    # Determine version
    local current_version
    current_version=$(get_current_version)
    log_info "Current version: $current_version"
    
    local new_version
    if [[ -n "$force_version" ]]; then
        new_version="$force_version"
        log_info "Using forced version: $new_version"
    else
        new_version=$(increment_version "$current_version" "$version_type")
        log_info "New version ($version_type bump): $new_version"
    fi
    
    # Confirm with user
    echo
    log_warning "This will:"
    echo "  1. Build frontend and backend"
    echo "  2. Bump version and commit changes"
    echo "  3. Create Docker image: ${REGISTRY_URL:+$REGISTRY_URL/}$IMAGE_NAME:$new_version"
    if [[ -n "$REGISTRY_URL" ]]; then
        echo "  4. Push to Docker registry: $REGISTRY_URL"
    else
        echo "  4. Push to Docker registry: SKIPPED (no REGISTRY_URL set)"
    fi
    echo "  5. Create git tag: v$new_version (only after successful build/push)"
    echo "  6. Push git tags to remote"
    echo
    
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Aborted by user"
        exit 0
    fi
    
    # Execute build and release steps with proper error handling
    local success=true
    
    # Step 1: Build application
    if ! build_app; then
        log_error "Application build failed"
        exit 1
    fi
    
    # Step 2: Save version (this creates a commit we might need to rollback)
    if ! save_version "$new_version"; then
        log_error "Version save failed"
        exit 1
    fi
    
    # Step 3: Build Docker image
    if ! build_docker_image "$new_version"; then
        log_error "Docker build failed, rolling back version commit"
        rollback_version "$current_version"
        exit 1
    fi
    
    # Step 4: Push Docker images (if registry configured)
    if [[ -n "$REGISTRY_URL" ]]; then
        # If buildx was used with --push the images were already pushed
        if [[ "$BUILDX_ENABLED" == "true" ]]; then
            log_info "Buildx push was used; images should already be available in the registry"
            # Show manifest info to verify multi-arch images
            if command -v docker > /dev/null 2>&1; then
                log_info "Inspecting image manifest for verification"
                docker buildx imagetools inspect "${DOCKER_IMAGE_VERSIONED}" || docker manifest inspect "${DOCKER_IMAGE_VERSIONED}" || true
                docker buildx imagetools inspect "${DOCKER_IMAGE_LATEST}" || docker manifest inspect "${DOCKER_IMAGE_LATEST}" || true
            fi
        else
            if ! push_docker_images; then
                log_error "Docker push failed, rolling back version commit"
                rollback_version "$current_version"
                exit 1
            fi
        fi
    fi
    
    # Step 5: Create git tag (only after successful build and push)
    if ! create_git_tag "$new_version"; then
        log_error "Git tag creation failed, rolling back version commit"
        rollback_version "$current_version"
        exit 1
    fi
    
    # Step 6: Push git tags
    if ! push_git_tags; then
        log_warning "Git tag push failed, but local operations completed successfully"
        log_info "You can manually push tags later with: git push origin --tags"
        success=false
    fi
    
    # Success message
    echo
    if [[ "$success" == "true" ]]; then
        log_success "🚀 Production build and release completed successfully!"
    else
        log_success "🚀 Production build completed with warnings (see above)"
    fi
    log_success "Version: $new_version"
    log_success "Docker Images:"
    log_success "  - ${DOCKER_IMAGE_VERSIONED}"
    log_success "  - ${DOCKER_IMAGE_LATEST}"
    if [[ -n "$REGISTRY_URL" ]]; then
        log_success "Images pushed to: $REGISTRY_URL"
    fi
    echo
}

# Usage help
usage() {
    echo "Usage: $0 [VERSION_TYPE] [FORCE_VERSION]"
    echo
    echo "VERSION_TYPE (optional, default: patch):"
    echo "  patch   - Increment patch version (0.0.X)"
    echo "  minor   - Increment minor version (0.X.0)"
    echo "  major   - Increment major version (X.0.0)"
    echo
    echo "FORCE_VERSION (optional):"
    echo "  Specify exact version (e.g., 1.2.3)"
    echo
    echo "Environment Variables:"
    echo "  REGISTRY_URL     - Docker registry URL (e.g., docker.io/username)"
    echo "  IMAGE_NAME       - Docker image name (default: swarm-graph)"
    echo "  PUSH_GIT_TAGS    - Push git tags to remote (default: true)"
    echo
    echo "Examples:"
    echo "  $0                    # Patch version bump"
    echo "  $0 minor              # Minor version bump"
    echo "  $0 major              # Major version bump"
    echo "  $0 patch 1.2.3       # Force specific version"
    echo
    echo "  REGISTRY_URL=docker.io/myuser $0 minor"
    echo "  REGISTRY_URL=gcr.io/myproject IMAGE_NAME=swarm-graph $0"
}

# Handle help flag
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Run main function
main "$@"