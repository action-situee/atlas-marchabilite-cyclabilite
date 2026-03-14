#!/usr/bin/env bash
set -euo pipefail

# Strict preservation tiling for 200m grid polygons.
# Strategy:
#  - Keep source geometry intact across zoom levels
#  - Avoid clipping and simplification so shared edges remain aligned
#  - Allow larger tiles because the user explicitly prefers fidelity over size

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
OUT_DIR="$ROOT_DIR/data_tiles"
TMP_DIR="$OUT_DIR/tmp"
PUB_TILES_DIR="$ROOT_DIR/public/tiles"
INPUT="${INPUT:-$ROOT_DIR/data_raw/step3_aggregated_index_carreau200.parquet}"
LAYER="${LAYER:-carreau200}"
NDJSON="${NDJSON:-$TMP_DIR/carreau200_strict.ndjson}"
MBTILES="${MBTILES:-$OUT_DIR/carreau200_strict.mbtiles}"
PMTILES="${PMTILES:-$PUB_TILES_DIR/carreau200.pmtiles}"
TILE_LABEL="${TILE_LABEL:-carreau200}"
MINZOOM="${MINZOOM:-8}"
MAXZOOM="${MAXZOOM:-15}"
BUFFER="${BUFFER:-4}"

mkdir -p "$OUT_DIR" "$TMP_DIR" "$PUB_TILES_DIR"

if ! command -v ogr2ogr >/dev/null; then echo "Need ogr2ogr"; exit 1; fi
if ! command -v tippecanoe >/dev/null; then echo "Need tippecanoe"; exit 1; fi
if ! command -v pmtiles >/dev/null; then echo "Need pmtiles"; exit 1; fi

if [ ! -f "$INPUT" ]; then
  echo "Input parquet not found: $INPUT"; exit 1;
fi

echo "➡️  Export Parquet → NDJSON (EPSG:4326)"
rm -f "$NDJSON"
ogr2ogr -f GeoJSONSeq "$NDJSON" "$INPUT"

echo "➡️  tippecanoe strict tiling ($TILE_LABEL)"
rm -f "$MBTILES"

TIPPECANOE_FLAGS=(
  -o "$MBTILES" "$NDJSON"
  -l "$LAYER"
  -Z"$MINZOOM" -z"$MAXZOOM"
  --no-feature-limit
  --no-tile-size-limit
  --no-simplification
  --no-clipping
  --no-line-simplification
  --detect-shared-borders
  --no-tiny-polygon-reduction
  --buffer="$BUFFER"
  --no-tile-stats
)

tippecanoe "${TIPPECANOE_FLAGS[@]}"

echo "➡️  Convert to PMTiles ($TILE_LABEL)"
rm -f "$PMTILES"
pmtiles convert "$MBTILES" "$PMTILES"

ls -lh "$MBTILES" "$PMTILES"
echo "✅ Strict tiles ready: $PMTILES"
