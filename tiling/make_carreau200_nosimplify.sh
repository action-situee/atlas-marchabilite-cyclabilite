#!/usr/bin/env bash
set -euo pipefail

# Carreau200 with Web Mercator intermediate + ZERO simplification

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
RAW_DIR="$ROOT_DIR/data_raw"
OUT_DIR="$ROOT_DIR/data_tiles"
PUB_TILES_DIR="$ROOT_DIR/public/tiles"
TMP_DIR="$OUT_DIR/tmp"

INPUT_PARQUET="$RAW_DIR/step3_aggregated_index_carreau200.parquet"
LAYER_NAME="carreau200"
MBTILES_NAME="carreau200.mbtiles"
PMTILES_NAME="carreau200.pmtiles"

mkdir -p "$OUT_DIR" "$TMP_DIR" "$PUB_TILES_DIR"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' is required but not installed."; exit 127; }; }
need ogr2ogr
need tippecanoe
need pmtiles

if [ ! -f "$INPUT_PARQUET" ]; then
  echo "⚠️  Error: $INPUT_PARQUET not found"; exit 1;
fi

echo "➡️  Step 1: Reproject to Web Mercator (EPSG:3857)"
OGR_MERC="$TMP_DIR/carreau200_merc.parquet"
rm -f "$OGR_MERC"
ogr2ogr -f Parquet "$OGR_MERC" "$INPUT_PARQUET" -t_srs EPSG:3857

echo "➡️  Step 2: Export to NDJSON with WGS84 (RFC7946)"
NDJSON="$TMP_DIR/carreau200.ndjson"
rm -f "$NDJSON"
ogr2ogr -f GeoJSONSeq "$NDJSON" "$OGR_MERC" -lco RFC7946=YES -t_srs EPSG:4326

echo "➡️  Step 3: tippecanoe with ZERO simplification"
MBTILES="$OUT_DIR/$MBTILES_NAME"
rm -f "$MBTILES"
tippecanoe -o "$MBTILES" "$NDJSON" \
  -l "$LAYER_NAME" \
  -Z8 -z14 \
  --no-feature-limit \
  --no-tile-size-limit \
  --no-line-simplification \
  --no-tiny-polygon-reduction \
  --no-simplification-of-shared-nodes \
  --buffer=0 \
  --drop-densest-as-needed

echo "➡️  Step 4: pmtiles convert"
PMTILES="$PUB_TILES_DIR/$PMTILES_NAME"
rm -f "$PMTILES"
pmtiles convert "$MBTILES" "$PMTILES"

ls -lh "$MBTILES" "$PMTILES"
echo "✅ Carreau200 tiles ready: $PMTILES"
