#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT_DIR, 'data_tiles', 'tmp');
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'attribute_thresholds.json');
const MODE_CONFIG_PATH = path.join(ROOT_DIR, 'src', 'config', 'modes.ts');
const PALETTE_STEPS = 10;

const DATASETS = [
  ['walkability', 'grandGeneve', 'segment', 'walk_agglo_segment'],
  ['walkability', 'grandGeneve', 'carreau200', 'walk_agglo_carreau200'],
  ['walkability', 'grandGeneve', 'zoneTrafic', 'walk_agglo_infracommunal'],
  ['walkability', 'cantonGeneve', 'segment', 'walk_canton_segment'],
  ['walkability', 'cantonGeneve', 'carreau200', 'walk_canton_carreau200'],
  ['walkability', 'cantonGeneve', 'zoneTrafic', 'walk_canton_infracommunal'],
  ['bikeability', 'grandGeneve', 'segment', 'bike_agglo_segment'],
  ['bikeability', 'grandGeneve', 'carreau200', 'bike_agglo_carreau200'],
  ['bikeability', 'grandGeneve', 'zoneTrafic', 'bike_agglo_infracommunal'],
  ['bikeability', 'cantonGeneve', 'segment', 'bike_canton_segment'],
  ['bikeability', 'cantonGeneve', 'carreau200', 'bike_canton_carreau200'],
  ['bikeability', 'cantonGeneve', 'zoneTrafic', 'bike_canton_infracommunal']
];

function loadModeConfigs() {
  const source = fs.readFileSync(MODE_CONFIG_PATH, 'utf8');
  const compiled = esbuild.transformSync(source, {
    format: 'cjs',
    loader: 'ts',
    target: 'node18'
  }).code;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
    console
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(compiled, sandbox, { filename: MODE_CONFIG_PATH });
  return sandbox.module.exports.MODE_CONFIGS;
}

function getAttributeKeys(config) {
  return new Set([
    config.indexField,
    ...config.classes.flatMap((classDef) => [
      classDef.field,
      ...classDef.attributes.map((attribute) => attribute.technicalName)
    ])
  ]);
}

function toNumeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function quantileThresholds(values) {
  if (values.length < 10) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const thresholds = [];

  for (let i = 1; i <= PALETTE_STEPS; i += 1) {
    const p = i / PALETTE_STEPS;
    const pos = (sorted.length - 1) * p;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    const weight = pos - lower;
    const value = sorted[lower] * (1 - weight) + sorted[upper] * weight;
    thresholds.push(Number(value.toFixed(6)));
  }

  for (let i = 1; i < thresholds.length; i += 1) {
    if (thresholds[i] <= thresholds[i - 1]) {
      thresholds[i] = Number((thresholds[i - 1] + 1e-6).toFixed(6));
    }
  }

  return thresholds;
}

function stats(values) {
  if (values.length === 0) return { count: 0, min: 0, max: 1, mean: 0.5 };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  return {
    count: values.length,
    min: Number(min.toFixed(6)),
    max: Number(max.toFixed(6)),
    mean: Number((sum / values.length).toFixed(6))
  };
}

async function readDataset(filePath, config) {
  const keys = getAttributeKeys(config);
  const rawValues = {};
  const colorValues = {};
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const line of lines) {
    if (!line.trim()) continue;

    const feature = JSON.parse(line);
    const props = feature.properties || {};

    for (const key of keys) {
      const rawValue = toNumeric(props[key]);
      if (rawValue === null || rawValue < 0 || rawValue > 1) continue;

      if (!rawValues[key]) rawValues[key] = [];
      if (!colorValues[key]) colorValues[key] = [];

      rawValues[key].push(rawValue);
      colorValues[key].push(rawValue);
    }
  }

  const thresholds = {};
  const rawStats = {};

  for (const [key, values] of Object.entries(rawValues)) {
    rawStats[key] = stats(values);
  }

  for (const [key, values] of Object.entries(colorValues)) {
    const fieldThresholds = quantileThresholds(values);
    if (fieldThresholds) thresholds[key] = fieldThresholds;
  }

  return { thresholds, stats: rawStats };
}

function ensureNested(root, mode, territory, scale) {
  root.modes[mode] ||= {};
  root.modes[mode][territory] ||= {};
  root.modes[mode][territory][scale] ||= {};
  return root.modes[mode][territory][scale];
}

async function main() {
  const modeConfigs = loadModeConfigs();
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'tiling/compute_quantiles.js',
    valueSpace: 'color',
    modes: {}
  };

  for (const [mode, territory, scale, basename] of DATASETS) {
    const filePath = path.join(TMP_DIR, `${basename}.ndjson`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[compute_quantiles] Skip ${mode}/${territory}/${scale}: ${path.relative(ROOT_DIR, filePath)} not found`);
      continue;
    }

    const result = await readDataset(filePath, modeConfigs[mode]);
    const target = ensureNested(manifest, mode, territory, scale);
    target.thresholds = result.thresholds;
    target.stats = result.stats;
    target.source = path.relative(ROOT_DIR, filePath);
    console.log(`[compute_quantiles] ${mode}/${territory}/${scale}: ${Object.keys(result.thresholds).length} threshold fields`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[compute_quantiles] Wrote ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
