#!/usr/bin/env bash
set -euo pipefail

# Dockerized alternative to build tiles without installing GDAL/Tippecanoe/PMTiles on host.
# Requires: Docker.
# Images used:
# - GDAL: ghcr.io/osgeo/gdal:alpine-small-latest
# - Tippecanoe: ghcr.io/felt/tippecanoe:latest (or developmentseed/tippecanoe:latest)
# - PMTiles: ghcr.io/protomaps/pmtiles:latest (or use host pmtiles if preferred)

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
RAW_DIR="$ROOT_DIR/data_raw"
OUT_DIR="$ROOT_DIR/data_tiles"
PUB_TILES_DIR="$ROOT_DIR/public/tiles"
TMP_DIR="$OUT_DIR/tmp"

INPUT_PARQUET_STEP3="/work/data_raw/step3_index.parquet"
LAYER_NAME="walknet"
MBTILES_NAME="step3_index.mbtiles"
PMTILES_NAME="step3_index.pmtiles"

mkdir -p "$OUT_DIR" "$TMP_DIR" "$PUB_TILES_DIR"

run_gdal(){
  docker run --rm -u $(id -u):$(id -g) -v "$ROOT_DIR:/work" ghcr.io/osgeo/gdal:alpine-small-latest \
    ogr2ogr "$@"
}

run_tippecanoe(){
  docker run --rm -u $(id -u):$(id -g) -v "$ROOT_DIR:/work" ghcr.io/felt/tippecanoe:latest \
    tippecanoe "$@"
}

run_pmtiles(){
  docker run --rm -u $(id -u):$(id -g) -v "$ROOT_DIR:/work" ghcr.io/protomaps/pmtiles:latest \
    pmtiles "$@"
}

if [ ! -f "$RAW_DIR/step3_index.parquet" ]; then
  echo "❌ Missing input parquet: $RAW_DIR/step3_index.parquet"
  exit 2
fi

echo "➡️  Reproject to WGS84 (if needed)"
OGR_WGS84="/work/data_tiles/tmp/step3_index_wgs84.parquet"
run_gdal -f Parquet "$OGR_WGS84" "$INPUT_PARQUET_STEP3" -t_srs EPSG:4326

# Optionally select attributes (uncomment and edit to slim down)
# OGR_SEL="/work/data_tiles/tmp/step3_index_sel.parquet"
# docker run ... ogr2ogr -f Parquet "$OGR_SEL" "$OGR_WGS84" -select "i_zscore,ratio_trottoir,rez_actif,mode,quartier_id,dist_m"
# SRC_FOR_NDJSON="$OGR_SEL"
SRC_FOR_NDJSON="$OGR_WGS84"

echo "➡️  Export to GeoJSONSeq (NDJSON)"
NDJSON="/work/data_tiles/tmp/step3_index.ndjson"
docker run --rm -u $(id -u):$(id -g) -v "$ROOT_DIR:/work" ghcr.io/osgeo/gdal:alpine-small-latest \
  ogr2ogr -f GeoJSONSeq "$NDJSON" "$SRC_FOR_NDJSON" -lco RFC7946=YES

echo "➡️  tippecanoe → MBTiles ($MBTILES_NAME)"
MBTILES="/work/data_tiles/$MBTILES_NAME"
rm -f "$OUT_DIR/$MBTILES_NAME"
run_tippecanoe -o "$MBTILES" "/work/data_tiles/tmp/step3_index.ndjson" \
  -l "$LAYER_NAME" -zg \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --no-feature-limit --no-tile-size-limit \
  --coalesce --coalesce-densest

echo "➡️  pmtiles convert → PMTiles ($PMTILES_NAME)"
pmtiles_path="$PUB_TILES_DIR/$PMTILES_NAME"
rm -f "$pmtiles_path"
run_pmtiles convert "$MBTILES" "/work/public/tiles/$PMTILES_NAME"

ls -lh "$OUT_DIR/$MBTILES_NAME" "$pmtiles_path"
echo "✅ Tiles ready: $pmtiles_path"
