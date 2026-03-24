#!/usr/bin/env bash
set -euo pipefail

# Dockerized alternative to build walkability and bikeability tiles.
# Requires: Docker.

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
RAW_DIR="$ROOT_DIR/data_raw"
OUT_DIR="$ROOT_DIR/data_tiles"
PUB_TILES_DIR="$ROOT_DIR/public/tiles"
TMP_DIR="$OUT_DIR/tmp"

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

resolve_input() {
  local preferred="$1"
  local fallback="${2:-}"

  if [ -n "$preferred" ] && [ -f "$RAW_DIR/$preferred" ]; then
    printf '%s\n' "/work/data_raw/$preferred"
    return 0
  fi

  if [ -n "$fallback" ] && [ -f "$RAW_DIR/$fallback" ]; then
    printf '%s\n' "/work/data_raw/$fallback"
    return 0
  fi

  return 1
}

build_vector_tiles() {
  local label="$1"
  local input="$2"
  local basename="$3"
  local layer="$4"
  local mbtiles_name="$5"
  local pmtiles_name="$6"
  shift 6

  if [ -z "$input" ]; then
    echo "⚠️  Skipping $label: input parquet not found"
    return 0
  fi

  local ogr_wgs84="/work/data_tiles/tmp/${basename}_wgs84.parquet"
  local ndjson="/work/data_tiles/tmp/${basename}.ndjson"
  local mbtiles="/work/data_tiles/$mbtiles_name"
  local pmtiles="/work/public/tiles/$pmtiles_name"

  echo "➡️  [$label] Reproject to WGS84"
  rm -f "$OUT_DIR/$mbtiles_name" "$PUB_TILES_DIR/$pmtiles_name"
  run_gdal -f Parquet "$ogr_wgs84" "$input" -t_srs EPSG:4326

  echo "➡️  [$label] Export to GeoJSONSeq"
  run_gdal -f GeoJSONSeq "$ndjson" "$ogr_wgs84"

  echo "➡️  [$label] tippecanoe → MBTiles ($mbtiles_name)"
  run_tippecanoe -o "$mbtiles" "$ndjson" -l "$layer" "$@"

  echo "➡️  [$label] pmtiles convert → PMTiles ($pmtiles_name)"
  run_pmtiles convert "$mbtiles" "$pmtiles"

  ls -lh "$OUT_DIR/$mbtiles_name" "$PUB_TILES_DIR/$pmtiles_name"
  echo "✅ [$label] Tiles ready: $PUB_TILES_DIR/$pmtiles_name"
}

build_carreau_tiles() {
  local label="$1"
  local input="$2"
  local basename="$3"
  local mbtiles_name="$4"
  local pmtiles_name="$5"
  local minzoom="${6:-8}"

  if [ -z "$input" ]; then
    echo "⚠️  Skipping $label/carreau200: input parquet not found"
    return 0
  fi

  local ndjson="/work/data_tiles/tmp/${basename}.ndjson"
  local mbtiles="/work/data_tiles/$mbtiles_name"
  local pmtiles="/work/public/tiles/$pmtiles_name"

  echo "➡️  [$label/carreau200] Export to GeoJSONSeq"
  rm -f "$OUT_DIR/$mbtiles_name" "$PUB_TILES_DIR/$pmtiles_name"
  run_gdal -f GeoJSONSeq "$ndjson" "$input"

  echo "➡️  [$label/carreau200] tippecanoe strict tiling"
  local -a tippecanoe_args=(
    -o "$mbtiles" "$ndjson" \
    -l "carreau200" \
    -Z"$minzoom" -z15 \
    --no-feature-limit \
    --no-tile-size-limit \
    --no-simplification \
    --no-clipping \
    --no-line-simplification \
    --detect-shared-borders \
    --no-tiny-polygon-reduction \
    --buffer=4 \
    --no-tile-stats
  )
  run_tippecanoe "${tippecanoe_args[@]}"

  echo "➡️  [$label/carreau200] pmtiles convert → PMTiles ($pmtiles_name)"
  run_pmtiles convert "$mbtiles" "$pmtiles"

  ls -lh "$OUT_DIR/$mbtiles_name" "$PUB_TILES_DIR/$pmtiles_name"
  echo "✅ [$label/carreau200] Tiles ready: $PUB_TILES_DIR/$pmtiles_name"
}

WALK_GG_SEG_INPUT="$(resolve_input "walkability/AggloGG/step3_index.parquet" "walkability/step3_index.parquet" || true)"
WALK_GG_CAR_INPUT="$(resolve_input "walkability/AggloGG/step3_aggregated_index_carreau200.parquet" "walkability/step3_aggregated_index_carreau200.parquet" || true)"
WALK_GG_ZT_INPUT="$(resolve_input "walkability/AggloGG/step3_aggregated_index_gg_infra_communal.parquet" "walkability/AggloGG/step3_aggregated_index_girec.parquet" || true)"
WALK_CANTON_SEG_INPUT="$(resolve_input "walkability/CantonGE/step3_index.parquet" || true)"
WALK_CANTON_CAR_INPUT="$(resolve_input "walkability/CantonGE/step3_aggregated_index_carreau200.parquet" || true)"
WALK_CANTON_ZT_INPUT="$(resolve_input "walkability/CantonGE/step3_aggregated_index_girec.parquet" || true)"

BIKE_GG_SEG_INPUT="$(resolve_input "cyclability/AggloGG/step3_index.parquet" "cyclability/step3_index.parquet" || true)"
BIKE_GG_CAR_INPUT="$(resolve_input "cyclability/AggloGG/step3_aggregated_index_carreau200.parquet" "cyclability/step3_aggregated_index_carreau200.parquet" || true)"
BIKE_GG_ZT_INPUT="$(resolve_input "cyclability/AggloGG/step3_aggregated_index_gg_infra_communal.parquet" "cyclability/AggloGG/step3_aggregated_index_girec.parquet" || true)"
BIKE_CANTON_SEG_INPUT="$(resolve_input "cyclability/CantonGE/step3_index.parquet" || true)"
BIKE_CANTON_CAR_INPUT="$(resolve_input "cyclability/CantonGE/step3_aggregated_index_carreau200.parquet" || true)"
BIKE_CANTON_ZT_INPUT="$(resolve_input "cyclability/CantonGE/step3_aggregated_index_gg_infra_communal.parquet" "cyclability/CantonGE/step3_aggregated_index_girec.parquet" || true)"
PERIMETER_INPUT="$(resolve_input "perimeter/CAD_LIMITE_CANTON_SANS_LAC.parquet" "perimeter/CAD_LIMITE_CANTON.parquet" || true)"

build_vector_tiles \
  "walkability/AggloGG/segment" \
  "$WALK_GG_SEG_INPUT" \
  "walk_agglo_segment" \
  "walknet" \
  "walk_agglo_segment.mbtiles" \
  "walk_agglo_segment.pmtiles" \
  -Z8 -z15 \
  --base-zoom=11 \
  --drop-rate=1.1 \
  --maximum-tile-bytes=2000000 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --no-tile-stats

build_carreau_tiles \
  "walkability/AggloGG" \
  "$WALK_GG_CAR_INPUT" \
  "walk_agglo_carreau200" \
  "walk_agglo_carreau200.mbtiles" \
  "walk_agglo_carreau200.pmtiles"

build_vector_tiles \
  "walkability/AggloGG/infracommunal" \
  "$WALK_GG_ZT_INPUT" \
  "walk_agglo_infracommunal" \
  "zone_trafic" \
  "walk_agglo_infracommunal.mbtiles" \
  "walk_agglo_infracommunal.pmtiles" \
  -Z7 -z13 \
  --no-feature-limit \
  --no-tile-size-limit \
  --no-simplification \
  --no-clipping \
  --no-line-simplification \
  --detect-shared-borders \
  --no-tiny-polygon-reduction \
  --buffer=4 \
  --no-tile-stats

build_vector_tiles \
  "walkability/CantonGE/segment" \
  "$WALK_CANTON_SEG_INPUT" \
  "walk_canton_segment" \
  "walknet" \
  "walk_canton_segment.mbtiles" \
  "walk_canton_segment.pmtiles" \
  -Z8 -z15 \
  --base-zoom=11 \
  --drop-rate=1.1 \
  --maximum-tile-bytes=2000000 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --no-tile-stats

build_carreau_tiles \
  "walkability/CantonGE" \
  "$WALK_CANTON_CAR_INPUT" \
  "walk_canton_carreau200" \
  "walk_canton_carreau200.mbtiles" \
  "walk_canton_carreau200.pmtiles"

build_vector_tiles \
  "walkability/CantonGE/infracommunal" \
  "$WALK_CANTON_ZT_INPUT" \
  "walk_canton_infracommunal" \
  "zone_trafic" \
  "walk_canton_infracommunal.mbtiles" \
  "walk_canton_infracommunal.pmtiles" \
  -Z7 -z13 \
  --no-feature-limit \
  --no-tile-size-limit \
  --no-simplification \
  --no-clipping \
  --no-line-simplification \
  --detect-shared-borders \
  --no-tiny-polygon-reduction \
  --buffer=4 \
  --no-tile-stats

build_vector_tiles \
  "bikeability/AggloGG/segment" \
  "$BIKE_GG_SEG_INPUT" \
  "bike_agglo_segment" \
  "bikenet" \
  "bike_agglo_segment.mbtiles" \
  "bike_agglo_segment.pmtiles" \
  -Z8 -z15 \
  --base-zoom=11 \
  --drop-rate=1.1 \
  --maximum-tile-bytes=2000000 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --no-tile-stats

build_carreau_tiles \
  "bikeability/AggloGG" \
  "$BIKE_GG_CAR_INPUT" \
  "bike_agglo_carreau200" \
  "bike_agglo_carreau200.mbtiles" \
  "bike_agglo_carreau200.pmtiles" \
  7

build_vector_tiles \
  "bikeability/AggloGG/infra_communal" \
  "$BIKE_GG_ZT_INPUT" \
  "bike_agglo_infracommunal" \
  "infra_communal" \
  "bike_agglo_infracommunal.mbtiles" \
  "bike_agglo_infracommunal.pmtiles" \
  -Z7 -z13 \
  --no-feature-limit \
  --no-tile-size-limit \
  --no-simplification \
  --no-clipping \
  --no-line-simplification \
  --detect-shared-borders \
  --no-tiny-polygon-reduction \
  --buffer=4 \
  --no-tile-stats

build_vector_tiles \
  "bikeability/CantonGE/segment" \
  "$BIKE_CANTON_SEG_INPUT" \
  "bike_canton_segment" \
  "bikenet" \
  "bike_canton_segment.mbtiles" \
  "bike_canton_segment.pmtiles" \
  -Z8 -z15 \
  --base-zoom=11 \
  --drop-rate=1.1 \
  --maximum-tile-bytes=2000000 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --no-tile-stats

build_carreau_tiles \
  "bikeability/CantonGE" \
  "$BIKE_CANTON_CAR_INPUT" \
  "bike_canton_carreau200" \
  "bike_canton_carreau200.mbtiles" \
  "bike_canton_carreau200.pmtiles" \
  7

build_vector_tiles \
  "bikeability/CantonGE/infra_communal" \
  "$BIKE_CANTON_ZT_INPUT" \
  "bike_canton_infracommunal" \
  "infra_communal" \
  "bike_canton_infracommunal.mbtiles" \
  "bike_canton_infracommunal.pmtiles" \
  -Z7 -z13 \
  --no-feature-limit \
  --no-tile-size-limit \
  --no-simplification \
  --no-clipping \
  --no-line-simplification \
  --detect-shared-borders \
  --no-tiny-polygon-reduction \
  --buffer=4 \
  --no-tile-stats

build_vector_tiles \
  "perimeter/canton" \
  "$PERIMETER_INPUT" \
  "canton_perimeter" \
  "canton_perimeter" \
  "canton_perimeter.mbtiles" \
  "canton_perimeter.pmtiles" \
  -Z0 -z16 \
  --no-tile-stats

echo "✅ All requested tiles were built into $PUB_TILES_DIR"
