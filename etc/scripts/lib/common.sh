#!/bin/bash

# Shared logging utilities
# This file contains common logging functions used across scripts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Load environment variables from .env file if it exists
load_env() {
    if [[ -f ".env" ]]; then
        set -a  # automatically export all variables
        source .env
        set +a  # disable automatic export
        log_info "Loaded environment from .env file"
    fi
}