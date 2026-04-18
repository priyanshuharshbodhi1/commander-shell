#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Installing dependencies..."
pnpm install

echo "Building all packages..."
pnpm build

echo "Setup complete."
