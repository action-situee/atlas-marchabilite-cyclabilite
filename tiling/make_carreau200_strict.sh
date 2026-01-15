#!/usr/bin/env bash
set -euo pipefail

# Strict preservation tiling for carreau200 (attempt to minimize perceived distortion)
# Strategy:
#  - Input already in EPSG:4326 (confirmed via ogrinfo)
#  - Avoid simplification & clipping so shared edges remain aligned across tiles
#  - Keep a modest buffer to avoid edge cut artifacts (default ~5; we use 8)
#  - Disable tiny polygon reduction
#  - Use explicit min/max zoom suited for 200m cells

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
RAW_DIR="$ROOT_DIR/data_raw"
OUT_DIR="$ROOT_DIR/data_tiles"
TMP_DIR="$OUT_DIR/tmp"
PUB_TILES_DIR="$ROOT_DIR/public/tiles"
INPUT="$RAW_DIR/step3_aggregated_index_carreau200.parquet"
LAYER="carreau200"
NDJSON="$TMP_DIR/carreau200_strict.ndjson"
MBTILES="$OUT_DIR/carreau200_strict.mbtiles"
PMTILES="$PUB_TILES_DIR/carreau200.pmtiles"  # overwrite production filename

mkdir -p "$OUT_DIR" "$TMP_DIR" "$PUB_TILES_DIR"

if ! command -v ogr2ogr >/dev/null; then echo "Need ogr2ogr"; exit 1; fi
if ! command -v tippecanoe >/dev/null; then echo "Need tippecanoe"; exit 1; fi
if ! command -v pmtiles >/dev/null; then echo "Need pmtiles"; exit 1; fi

if [ ! -f "$INPUT" ]; then
  echo "Input parquet not found: $INPUT"; exit 1;
fi

echo "➡️  Export Parquet → NDJSON (reprojecting to EPSG:3857)"
rm -f "$NDJSON"
ogr2ogr -f GeoJSONSeq "$NDJSON" "$INPUT" -t_srs EPSG:3857 -lco RFC7946=YES

echo "➡️  tippecanoe strict tiling"
rm -f "$MBTILES"
# Notes:
#  --no-simplification avoids geometry alteration
#  --no-clipping keeps full polygons (can increase tile size)
#  --buffer preserves edge continuity for rendering
#  --no-tiny-polygon-reduction ensures small cells kept
#  -Z8: cells appear at mid zoom; -z14: allow inspection detail
#  --no-feature-limit / --no-tile-size-limit allow larger tiles due to no clipping
#  --drop-densest-as-needed fallback if something extreme occurs
#  -aC: Coalesce smallest fragments to avoid gaps
#  -aD: Drop features that are too small to be represented

TIPPECANOE_FLAGS=(
  -o "$MBTILES" "$NDJSON"
  -l "$LAYER"
  -Z8 -z14
  --no-feature-limit
  --no-tile-size-limit
  --no-simplification
  --no-clipping
  --no-line-simplification
  --no-tiny-polygon-reduction
  --buffer=8
  --drop-densest-as-needed
  -aC
  -aD
)

tippecanoe "${TIPPECANOE_FLAGS[@]}"

echo "➡️  Convert to PMTiles (overwrite main carreau200.pmtiles)"
rm -f "$PMTILES"
pmtiles convert "$MBTILES" "$PMTILES"

ls -lh "$MBTILES" "$PMTILES"
echo "✅ Strict carreau200 tiles ready: $PMTILES"
