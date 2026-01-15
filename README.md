
  # Atlas Marchabilité & Cyclabilité

  This is the app for the Marchabilité & Cyclabilité atlas. It now includes a simple, efficient data tiling pipeline using GDAL, Tippecanoe and PMTiles, and supports serving via Martin or directly from static PMTiles.

  ## Quick start (local)

  - Install dependencies:
    - `npm i`
  - Put your raw parquet in `data_raw/step3_index.parquet`
  - Build tiles:
    - Native toolchain: `npm run tile`
    - Or Docker toolchain: `bash ./tiling/make_tiles_docker.sh`
  - Run the app: `npm run dev` (http://localhost:5173)
  - Tiles server (TileJSON) required: `npm run martin` (http://localhost:3000)

  By default the app reads `public/tiles/step3_index.pmtiles`. You can switch to Martin (TileJSON) by setting `VITE_TILEJSON_WALKNET`.

  ## Data → Tiles pipeline

  See `tiling/README.md` for full details. In short, the pipeline does:
  1) Reproject Parquet to WGS84 (EPSG:4326) if needed
  2) Export to NDJSON (GeoJSON Sequence)
  3) Tippecanoe → `.mbtiles` (layer name `walknet`)
  4) PMTiles convert → `.pmtiles` into `public/tiles/`

  ### End-to-end rebuild (after data or folder moves)

  If you have updated data and/or moved this repository, follow these steps to fully rebuild tiles and confirm the app:

  - Clean old artifacts (optional but recommended):
    ```sh
    rm -rf data_tiles/* public/tiles/*.pmtiles
    ```
  - Make sure your new raw file is here:
    ```
    data_raw/step3_index.parquet
    ```
  - Rebuild tiles (choose ONE):
    - Native:
      ```sh
      npm run tile
      ```
    - Docker:
      ```sh
      bash ./tiling/make_tiles_docker.sh
      ```
  - Verify `public/tiles/step3_index.pmtiles` was created.
  - Start the app locally:
    ```sh
    npm run dev
    ```
  - Start Martin (TileJSON) alongside the app (required):
    ```sh
    # Default port 3000
    npm run martin
    # Or choose a different port if 3000 is busy
    PORT=3001 npm run martin
    ```
    Or run Martin via Docker (one-liner, recommended):
    ```sh
    # Terminal 1: Martin server
    docker run --rm -p 3001:3000 -v "$PWD/public/tiles:/tiles:ro" ghcr.io/maplibre/martin:latest /tiles
    # Note: Newer images expect the tiles directory as a positional arg ("/tiles")
    # If your image uses the legacy flag, use: ghcr.io/maplibre/martin:latest --dir /tiles
    ```
    Then set in `.env.local`:
    ```sh
    VITE_TILEJSON_WALKNET=http://localhost:3001/step3_index
    VITE_WALK_SOURCE_LAYER=walknet
    ```

  ### Switching between PMTiles and Martin

  - PMTiles (default): ensure `public/tiles/step3_index.pmtiles` exists or set `VITE_PM_TILES_URL` to an external PMTiles URL
  - Martin (TileJSON): set `VITE_TILEJSON_WALKNET=http://localhost:3000/step3_index` (or your server URL) and ensure `VITE_WALK_SOURCE_LAYER=walknet`

  Create a `.env.local` in repo root to override these during development.

  ## Configuration

  - Create `.env.local` for local overrides (not committed)
  - PMTiles (static): `VITE_PM_TILES_URL=/tiles/step3_index.pmtiles` or your R2 URL
  - Martin (TileJSON): `VITE_TILEJSON_WALKNET=http://localhost:3000/step3_index`
  - Layer name expected by the app: `VITE_WALK_SOURCE_LAYER=walknet`

  ## Deploy on Cloudflare

  Recommended setup:
  - Cloudflare Pages for the app (connect your GitHub repo; framework preset: Vite)
  - Cloudflare R2 for the `.pmtiles` (public bucket)

  Steps:
  1) Upload your `step3_index.pmtiles` to R2 (public)
  2) In Cloudflare Pages Project → Environment Variables, set `VITE_PM_TILES_URL` to your R2 public URL
  3) Each push to `master` (or your chosen branch) will build and deploy

  Optional GitHub Actions workflow is provided at `.github/workflows/cloudflare-pages.yml` (requires secrets: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_PROJECT_NAME`). You can also rely on Pages’ native GitHub integration without Actions.

  ## Notes

    - Dev server runs on port 5173; Martin on 3000 (or 3001 via Docker example)
    - Run two terminals side by side in development:
     - Terminal 1: start Martin (TileJSON) via `npm run martin` or the Docker command above
     - Terminal 2: start the Vite dev server via `npm run dev`
  - Keep repo lean: avoid committing large tiles; prefer external hosting
  - `Example/` contains a Vue demo and alternative pipeline for reference



  ### Troubleshooting

  - If the app shows mismatched colors or attributes after data changes:
    - Ensure `public/tiles/step3_index.pmtiles` was regenerated
    - Confirm `.env.local` points to the intended source (PMTiles vs Martin)
    - Hard reload the page (cache)
  - Tippecanoe errors: check your NDJSON schema and geometry validity
  - Docker path issues: run from repo root so relative paths resolve
  