#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
TILES_DIR="$ROOT_DIR/public/tiles"
PORT="${1:-${PORT:-3000}}"

DOCKER_BIN="$(command -v docker || true)"
if [ -z "$DOCKER_BIN" ]; then
  # Fallback: common Homebrew path on macOS Apple Silicon
  if [ -x "/opt/homebrew/bin/docker" ]; then
    DOCKER_BIN="/opt/homebrew/bin/docker"
  elif [ -x "/usr/local/bin/docker" ]; then
    DOCKER_BIN="/usr/local/bin/docker"
  else
    echo "❌ Docker is required to run Martin locally. Install Docker Desktop first."
    exit 127
  fi
fi

if [ -z "$(ls -1 "$TILES_DIR"/*.pmtiles 2>/dev/null || true)" ]; then
  echo "❌ No .pmtiles found in $TILES_DIR. Run 'npm run tile' first."
  exit 2
fi

# Run Martin and expose all .pmtiles in the mounted directory
# Each PMTiles will be available as /<basename>.json (TileJSON)

echo "➡️  Starting Martin on http://localhost:$PORT (serving $(basename \"$TILES_DIR\")/*.pmtiles)"
# Choose interactive when attached to TTY, detached otherwise
if [ -t 1 ]; then
  FLAGS="-it --rm"
else
  FLAGS="-d --rm"
fi
exec "$DOCKER_BIN" run $FLAGS -p "$PORT:3000" -v "$TILES_DIR:/tiles" ghcr.io/maplibre/martin:latest /tiles
