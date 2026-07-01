import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  COLOR_SCALE_OPTIONS,
  getColorScale,
  getPaletteColor,
  VALUE_THRESHOLDS,
  type AtlasColorScale
} from '../colors';
import { Box, CircleSlash, Compass, Download, Maximize2, Palette, Star, ZoomIn, ZoomOut } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PMTiles, Protocol } from 'pmtiles';
import type { DistributionData } from './DistributionChart';
import { computeStats, type DataStats } from '../utils/normalize';
import {
  MODE_CONFIGS,
  getAttributeKeys,
  getClassFieldMap,
  type AnalysisTerritory,
  type AtlasDebugParams,
  type AtlasMode,
  type AtlasScale,
  type AtlasScores
} from '../config/modes';

type BasemapMode = 'voyager' | 'swissLight' | 'swissImagery' | 'openFreeMap3d' | 'none';
type CameraState = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};
type ExportWritableFileStream = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort?: () => Promise<void>;
};
type ExportFileHandle = {
  createWritable: () => Promise<ExportWritableFileStream>;
};
type ExportSavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
  }) => Promise<ExportFileHandle>;
};
type ExportSaveChoice =
  | { type: 'download' }
  | { type: 'file'; handle: ExportFileHandle }
  | { type: 'cancelled' };

type SpatialUnit = 'segment' | 'carreau200';
type ProveloQualificationKey = 'rustineDor' | 'pneuCreuve';

type ProveloQualificationState = Record<ProveloQualificationKey, boolean>;
type RenderedValueMapper = (key: string, value: unknown) => number | null;
type ThresholdStats = DataStats & { count?: number };
interface AttributeThresholdScale {
  thresholds?: Record<string, number[]>;
  stats?: Record<string, ThresholdStats>;
}
type AttributeThresholdByScale = Partial<Record<AtlasScale, AttributeThresholdScale>>;
type AttributeThresholdByTerritory = Partial<Record<AnalysisTerritory, AttributeThresholdByScale>>;
interface AttributeThresholdManifest {
  modes?: Partial<Record<AtlasMode, AttributeThresholdByTerritory>>;
}

interface HoveredAtlasFeature {
  id: unknown;
  properties: Record<string, unknown>;
  geometry: unknown;
  spatial_unit: SpatialUnit;
  scores: AtlasScores | null;
  hoverNote?: string | null;
  isMasked?: boolean;
}

const ANALYSIS_BOUNDS: [[number, number], [number, number]] = [
  [5.600526, 45.857307],
  [6.646596, 46.635298]
];
const ANALYSIS_MAX_BOUNDS: [[number, number], [number, number]] = [
  [5.100526, 45.507307],
  [7.086596, 46.995298]
];
const ANALYSIS_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };
const ANALYSIS_MIN_ZOOM_FLOOR = 8;
const DEFAULT_CENTER: [number, number] = [6.1600, 46.2300];
const DEFAULT_ZOOM = 11;
const DEFAULT_BEARING = 0;
const DEFAULT_PITCH = 0;
const DEFAULT_VOYAGER_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const DEFAULT_SWISS_LIGHT_STYLE = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json';
const DEFAULT_SWISS_IMAGERY_STYLE = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.imagerybasemap.vt/style.json';
const DEFAULT_OPENFREEMAP_3D_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const DEFAULT_OPENFREEMAP_PLANET_SOURCE = 'https://tiles.openfreemap.org/planet';
const ACTION_SITUEE_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/380a38d67ffe6f8270cf52c0d9431d1f05f3b12e/images/Fichier_36-5.svg';
const GENF_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/refs/heads/main/images/Logo_Genf.svg';
const FNS_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/refs/heads/main/images/logo-fns.png';
const MODUS_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/380a38d67ffe6f8270cf52c0d9431d1f05f3b12e/images/modus-2025.png';
const DEFAULT_PERIMETER_PMTILES = '/tiles/canton_perimeter.pmtiles';
const DEFAULT_PERIMETER_SOURCE_LAYER = 'canton_perimeter';
const DEFAULT_FAISCEAU_GAILLARD_GEOJSON_URL = '/data/perimeter/f3_perimetre_arrondi.geojson';
const DEFAULT_FAISCEAU_STJULIEN_GEOJSON_URL = '/data/perimeter/f4_perimetre_arrondi.geojson';
const DEFAULT_PROVELO_GEOJSON_URL = '/data/perimeter/points_noirs_provelo.geojson';
const DEFAULT_ATTRIBUTE_THRESHOLDS_URL = '/data/attribute_thresholds.json';
const TILE_CACHE_KEY_PARAM = 'atlas_tiles_version';
const PROVELO_QUALIFICATIONS: Record<ProveloQualificationKey, { value: string; label: string; color: string }> = {
  rustineDor: { value: "rustine d'or", label: "Rustine d'or", color: '#D69E1E' },
  pneuCreuve: { value: 'pneu creuve', label: 'Pneu crevé', color: '#A83A32' }
};
const EMPTY_PROVELO_QUALIFICATIONS: ProveloQualificationState = {
  rustineDor: false,
  pneuCreuve: false
};
const A3_EXPORT_WIDTH = 4961;
const A3_EXPORT_HEIGHT = 3508;
const A3_EXPORT_BORDER = 18;
const A3_EXPORT_CARTOUCHE_HEIGHT = 360;
const A3_EXPORT_MAX_BYTES = 12 * 1024 * 1024;
const WEB_MERCATOR_WORLD_METERS = 40075016.686;
const SEGMENT_DETAIL_ZOOM = 11;
const SCALE_BLEND_START = 10.7;
const SCALE_BLEND_END = 11.2;
const SEGMENT_NO_DATA_COLOR = '#9CA3AF';
const COLOR_INPUT_FALLBACK = -1;
const SEGMENT_MASK_FIELD = 'rd_hors_agglo_masked';
const SEGMENT_MASK_HOVER_NOTE = 'Tronçon de Route Départementale hors agglomération (rd_hors_agglo_masked)';
const OPENFREEMAP_3D_SOURCE_ID = 'openfreemap-planet';
const OPENFREEMAP_3D_LAYER_ID = '3d-buildings';
const OPENFREEMAP_3D_MIN_ZOOM = 14;
const OPENFREEMAP_3D_TARGET_ZOOM = 14.2;
const OPENFREEMAP_3D_TARGET_PITCH = 48;
const OPENFREEMAP_3D_TARGET_BEARING = -18;
const segmentOpacity = [
  'interpolate',
  ['linear'],
  ['zoom'],
  6, 0,
  8, 0,
  10, 0,
  SCALE_BLEND_START, 0,
  SCALE_BLEND_END, 0.92,
  15, 0.96
];
const carreauFillOpacity = [
  'interpolate',
  ['linear'],
  ['zoom'],
  6, 0.72,
  8, 0.78,
  10, 0.84,
  SCALE_BLEND_START, 0.84,
  SCALE_BLEND_END, 0,
  12, 0
];
const carreauOutlineOpacity = [
  'interpolate',
  ['linear'],
  ['zoom'],
  6, 0.16,
  8, 0.22,
  10, 0.30,
  SCALE_BLEND_START, 0.30,
  SCALE_BLEND_END, 0,
  12, 0
];
const LABEL_LAYER_PATTERN = /country|state|province|region|place|settlement|locality|commune|municipality|city|town|village|hamlet|admin|airport|airfield|aerodrome|aeroway/i;
const PLACE_LABEL_LAYER_PATTERN = /country|state|province|region|place|settlement|locality|commune|municipality|city|town|village|hamlet|admin/i;
const ADDRESS_LABEL_LAYER_PATTERN = /address|addr|house.?number|housenumber|building.?number/i;
const WATER_LAYER_PATTERN = /water|lake|ocean|river|canal|stream|reservoir/i;
const TRANSPORT_LAYER_PATTERN = /road|street|highway|motorway|trunk|primary|secondary|tertiary|rail|railway/i;
const BASEMAP_ROAD_LAYER_PATTERN = /road|street|highway|motorway|trunk|primary|secondary|tertiary|minor|major|service|path/i;
const BASEMAP_ROAD_SOURCE_LAYER_PATTERN = /transportation|transport|road|street|highway/i;
const BASEMAP_ROAD_EXCLUDE_PATTERN = /(^|[-_])rail(way)?($|[-_])|ferry|aerialway|runway|aeroway/i;
const MUTED_BASEMAP_ROAD_COLOR = '#CFCFCC';
const MUTED_BASEMAP_ROAD_OPACITY = 0.34;
const MUTED_BASEMAP_ROAD_CASING_OPACITY = 0.22;
const MUTED_BASEMAP_ROAD_3D_OPACITY = 0.26;
const MUTED_BASEMAP_ROAD_3D_CASING_OPACITY = 0.16;

interface MapProps {
  selectedAttribute: string | null;
  selectedClass: string | null;
  mode: AtlasMode;
  territory: AnalysisTerritory;
  scale: AtlasScale;
  colorMode: 'linear' | 'quantile';
  colorScale: AtlasColorScale;
  onColorScaleChange: (colorScale: AtlasColorScale) => void;
  showDistribution: boolean;
  onHoverSegment: (segment: HoveredAtlasFeature | null) => void;
  onResetScaleToDefault?: () => void;
  onDistributionRequest?: (data: DistributionData | null) => void;
  onDebugParamsChange?: (params: AtlasDebugParams) => void;
  onStatsUpdate?: (stats: Record<string, DataStats>) => void;
}

export function Map({
  selectedAttribute,
  selectedClass,
  mode,
  territory,
  scale,
  colorMode,
  colorScale,
  onColorScaleChange,
  showDistribution,
  onHoverSegment,
  onResetScaleToDefault,
  onDistributionRequest,
  onDebugParamsChange,
  onStatsUpdate
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const scaleHostRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<AtlasMode>(mode);
  const territoryRef = useRef<AnalysisTerritory>(territory);
  const selectedAttributeRef = useRef<string | null>(selectedAttribute);
  const selectedClassRef = useRef<string | null>(selectedClass);
  const colorModeRef = useRef<'linear' | 'quantile'>(colorMode);
  const colorScaleRef = useRef<AtlasColorScale>(colorScale);
  const lastModeRef = useRef<AtlasMode>(mode);
  const lastTerritoryRef = useRef<AnalysisTerritory>(territory);
  const scaleRef = useRef<AtlasScale>(scale);
  const hoverSegmentRef = useRef(onHoverSegment);
  const distributionRequestRef = useRef(onDistributionRequest);
  const showLabelsRef = useRef(false);
  const showPerimeterRef = useRef(false);
  const showDistributionRef = useRef(showDistribution);
  const showCorridorMaskOverviewRef = useRef(false);
  const proveloQualificationStateRef = useRef<ProveloQualificationState>(EMPTY_PROVELO_QUALIFICATIONS);
  const cameraStateRef = useRef<CameraState>({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    bearing: DEFAULT_BEARING,
    pitch: DEFAULT_PITCH
  });
  const cameraAnimationFrameRef = useRef<number | null>(null);
  const cursorAnimationFrameRef = useRef<number | null>(null);
  const cursorPositionRef = useRef<{ lng: number; lat: number } | null>(null);
  const initialAnalyticsDoneRef = useRef(false);
  const loadRequestRef = useRef(0);
  const loadingCleanupRef = useRef<(() => void) | null>(null);
  const loadingTimeoutRef = useRef<number | null>(null);
  const protocolRef = useRef<Protocol | null>(null);
  const displayScaleRef = useRef<AtlasScale>(scale);
  const basemapRef = useRef<BasemapMode>('voyager');
  const thresholdManifestRef = useRef<AttributeThresholdManifest | null>(null);
  const thresholdManifestLoadedRef = useRef(false);
  const corridorOverviewDataRef = useRef<{ corridors: any; mask: any } | null>(null);
  const proveloOverviewDataRef = useRef<{ shapes: any } | null>(null);

  const modeConfig = MODE_CONFIGS[mode];
  const theme = modeConfig.theme;
  const attrKeys = getAttributeKeys(mode);
  const env = import.meta.env as Record<string, string | undefined>;
  const mapboxToken = env.VITE_MAPBOX_TOKEN || '';

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [quantileMap, setQuantileMap] = useState<Record<string, number[]>>({});
  const [thresholdManifest, setThresholdManifest] = useState<AttributeThresholdManifest | null>(null);
  const [thresholdManifestLoaded, setThresholdManifestLoaded] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'initial' | 'tiles' | 'quantiles' | 'distribution' | 'done'>('initial');
  const [loadingDetail, setLoadingDetail] = useState('');
  const [attributeStats, setAttributeStats] = useState<Record<string, DataStats>>({});
  const [basemap, setBasemap] = useState<BasemapMode>('voyager');
  const [showLabels, setShowLabels] = useState(false);
  const [showPerimeter, setShowPerimeter] = useState(true);
  const [showCorridorMaskOverview, setShowCorridorMaskOverview] = useState(false);
  const [proveloQualificationState, setProveloQualificationState] = useState<ProveloQualificationState>(EMPTY_PROVELO_QUALIFICATIONS);
  const [isExporting, setIsExporting] = useState(false);
  const [bearing, setBearing] = useState(DEFAULT_BEARING);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [labelsAvailable, setLabelsAvailable] = useState(true);
  const [cameraDebug, setCameraDebug] = useState<CameraState>(cameraStateRef.current);
  const [cursorDebug, setCursorDebug] = useState<{ lng: number; lat: number } | null>(null);

  modeRef.current = mode;
  territoryRef.current = territory;
  scaleRef.current = scale;
  selectedAttributeRef.current = selectedAttribute;
  selectedClassRef.current = selectedClass;
  colorModeRef.current = colorMode;
  colorScaleRef.current = colorScale;
  basemapRef.current = basemap;
  hoverSegmentRef.current = onHoverSegment;
  distributionRequestRef.current = onDistributionRequest;
  showDistributionRef.current = showDistribution;
  showLabelsRef.current = showLabels;
  showPerimeterRef.current = showPerimeter;
  showCorridorMaskOverviewRef.current = showCorridorMaskOverview;
  proveloQualificationStateRef.current = proveloQualificationState;
  thresholdManifestRef.current = thresholdManifest;
  thresholdManifestLoadedRef.current = thresholdManifestLoaded;

  const normalizePmtilesUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('pmtiles://')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return `pmtiles://${url}`;
    if (url.startsWith('/')) return `pmtiles://${url}`;
    return `pmtiles:///${url}`;
  };

  const appendTileCacheKey = (url: string) => {
    const cacheKey = (env.VITE_TILES_VERSION || env.VITE_PM_TILES_VERSION || '').trim();
    if (!url || !cacheKey || url.includes(`${TILE_CACHE_KEY_PARAM}=`)) return url;

    const hashIndex = url.indexOf('#');
    const baseUrl = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
    const joiner = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${joiner}${TILE_CACHE_KEY_PARAM}=${encodeURIComponent(cacheKey)}${hash}`;
  };

  const resolvePmtilesUrl = (url: string) => normalizePmtilesUrl(appendTileCacheKey(url));

  const resolveEnvValue = (keys: string[]) => {
    const key = keys.find((candidate) => Boolean(env[candidate]));
    return key ? env[key] || '' : '';
  };

  const appendAccessToken = (url: string) => {
    if (!mapboxToken || url.includes('access_token=')) return url;
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}access_token=${mapboxToken}`;
  };

  const rewriteMapboxUrl = (url: string) => {
    if (url.startsWith('mapbox://styles/')) {
      const path = url.replace('mapbox://styles/', '');
      return appendAccessToken(`https://api.mapbox.com/styles/v1/${path}`);
    }
    if (url.startsWith('mapbox://sprites/')) {
      const path = url.replace('mapbox://sprites/', '');
      return appendAccessToken(`https://api.mapbox.com/styles/v1/${path}/sprite`);
    }
    if (url.startsWith('mapbox://fonts/')) {
      const path = url.replace('mapbox://fonts/', '');
      return appendAccessToken(`https://api.mapbox.com/fonts/v1/${path}`);
    }
    if (url.startsWith('mapbox://')) {
      const path = url.replace('mapbox://', '');
      return appendAccessToken(`https://api.mapbox.com/v4/${path}.json`);
    }
    if (url.startsWith('https://api.mapbox.com/')) {
      return appendAccessToken(url);
    }
    return url;
  };

  const resolveStyleUrl = (styleUrl: string) => {
    if (styleUrl.startsWith('mapbox://') && !mapboxToken) {
      console.warn('Mapbox style detected but VITE_MAPBOX_TOKEN is missing.');
    }
    return rewriteMapboxUrl(styleUrl);
  };

  const buildEmptyBasemapStyle = () => ({
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#FFFFFF'
        }
      }
    ]
  });

  const resolveBasemapStyle = (currentBasemap: BasemapMode) => {
    if (currentBasemap === 'none') {
      return buildEmptyBasemapStyle();
    }
    if (currentBasemap === 'swissLight') {
      return resolveStyleUrl(env.VITE_MAP_STYLE_SWISS_LIGHT || DEFAULT_SWISS_LIGHT_STYLE);
    }
    if (currentBasemap === 'swissImagery') {
      return resolveStyleUrl(env.VITE_MAP_STYLE_SWISS_IMAGERY || DEFAULT_SWISS_IMAGERY_STYLE);
    }
    if (currentBasemap === 'openFreeMap3d') {
      return resolveStyleUrl(env.VITE_MAP_STYLE_3D || DEFAULT_OPENFREEMAP_3D_STYLE);
    }
    return resolveStyleUrl(env.VITE_MAP_STYLE_VOYAGER || env.VITE_MAP_STYLE_POSITRON || env.VITE_MAP_STYLE_LIGHT || DEFAULT_VOYAGER_STYLE);
  };

  const resolveSource = (
    sourceKey: AtlasScale,
    currentMode: AtlasMode = mode,
    currentTerritory: AnalysisTerritory = territory
  ) => {
    const sourceConfig = MODE_CONFIGS[currentMode].sources[sourceKey];
    const tilejsonUrl =
      resolveEnvValue(sourceConfig.territoryTilejsonEnvKeys?.[currentTerritory] || []) ||
      sourceConfig.defaultTilejsonByTerritory?.[currentTerritory] ||
      resolveEnvValue(sourceConfig.tilejsonEnvKeys) ||
      sourceConfig.defaultTilejson ||
      '';
    const pmtilesUrl =
      resolveEnvValue(sourceConfig.territoryPmtilesEnvKeys?.[currentTerritory] || []) ||
      sourceConfig.defaultPmtilesByTerritory?.[currentTerritory] ||
      resolveEnvValue(sourceConfig.pmtilesEnvKeys) ||
      sourceConfig.defaultPmtiles ||
      '';

    return {
      url: tilejsonUrl || resolvePmtilesUrl(pmtilesUrl),
      sourceLayer: resolveEnvValue(sourceConfig.sourceLayerEnvKeys) || sourceConfig.defaultSourceLayer
    };
  };

  const resolvePerimeterSource = () => {
    const tilejsonUrl = env.VITE_TILEJSON_PERIMETER || '';
    const pmtilesUrl = env.VITE_PM_TILES_PERIMETER || DEFAULT_PERIMETER_PMTILES;

    return {
      url: tilejsonUrl || resolvePmtilesUrl(pmtilesUrl),
      sourceLayer: env.VITE_PERIMETER_SOURCE_LAYER || DEFAULT_PERIMETER_SOURCE_LAYER
    };
  };

  const resolveFaisceauGeoJsonUrl = (envKey: 'VITE_FAISCEAU_GAILLARD_GEOJSON_URL' | 'VITE_FAISCEAU_STJULIEN_GEOJSON_URL') => {
    if (envKey === 'VITE_FAISCEAU_GAILLARD_GEOJSON_URL') {
      return env[envKey] || DEFAULT_FAISCEAU_GAILLARD_GEOJSON_URL;
    }
    return env[envKey] || DEFAULT_FAISCEAU_STJULIEN_GEOJSON_URL;
  };

  const resolveProveloGeoJsonUrl = () => {
    return env.VITE_PROVELO_GEOJSON_URL || DEFAULT_PROVELO_GEOJSON_URL;
  };

  const resolveAttributeThresholdsUrl = () => {
    return appendTileCacheKey(env.VITE_ATTRIBUTE_THRESHOLDS_URL || DEFAULT_ATTRIBUTE_THRESHOLDS_URL);
  };

  const getActiveProveloQualificationValues = (
    qualifications: ProveloQualificationState = proveloQualificationStateRef.current
  ) => (Object.entries(qualifications) as Array<[ProveloQualificationKey, boolean]>)
    .filter(([, active]) => active)
    .map(([key]) => PROVELO_QUALIFICATIONS[key].value);

  const hasActiveProveloQualifications = (
    qualifications: ProveloQualificationState = proveloQualificationStateRef.current
  ) => getActiveProveloQualificationValues(qualifications).length > 0;

  const getActiveProveloQualificationLabels = (
    qualifications: ProveloQualificationState = proveloQualificationStateRef.current
  ) => (Object.entries(qualifications) as Array<[ProveloQualificationKey, boolean]>)
    .filter(([, active]) => active)
    .map(([key]) => PROVELO_QUALIFICATIONS[key].label);

  const toNumeric = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const computeQuantileThresholds = (values: number[]) => {
    if (values.length < 10) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const thresholds: number[] = [];
    const paletteSteps = getColorScale(colorScaleRef.current).palette.length - 1;

    for (let i = 1; i <= paletteSteps; i += 1) {
      const p = i / paletteSteps;
      const pos = (sorted.length - 1) * p;
      const lower = Math.floor(pos);
      const upper = Math.ceil(pos);
      const weight = pos - lower;
      const quantileValue = sorted[lower] * (1 - weight) + sorted[upper] * weight;
      thresholds.push(Number(quantileValue.toFixed(6)));
    }

    for (let i = 1; i < thresholds.length; i += 1) {
      if (thresholds[i] <= thresholds[i - 1]) {
        thresholds[i] = Number((thresholds[i - 1] + 1e-6).toFixed(6));
      }
    }

    return thresholds;
  };

  const toColorNumeric = (_key: string, value: unknown): number | null => {
    const numericValue = toNumeric(value);
    if (numericValue === null || numericValue < 0 || numericValue > 1) return null;
    return numericValue;
  };

  const toRawRenderedNumeric = (_key: string, value: unknown): number | null => {
    const numericValue = toNumeric(value);
    return numericValue !== null && numericValue >= 0 && numericValue <= 1 ? numericValue : null;
  };

  const collectRenderedValuesByAttr = (
    map: any,
    layerId: string,
    keys: Set<string> = attrKeys,
    valueMapper: RenderedValueMapper = toRawRenderedNumeric
  ) => {
    const features = map.queryRenderedFeatures(undefined, { layers: [layerId] });
    const valuesByAttr: Record<string, number[]> = {};

    for (const feature of features) {
      const props = feature.properties || {};
      for (const [key, value] of Object.entries(props)) {
        const numericValue = keys.has(key) ? valueMapper(key, value) : null;
        if (numericValue !== null) {
          if (!valuesByAttr[key]) valuesByAttr[key] = [];
          valuesByAttr[key].push(numericValue);
        }
      }
    }

    return valuesByAttr;
  };

  const getQuantileMapKey = (layerId: string, attr: string) => `${layerId}::${attr}`;

  const getQuantileLayerId = (map: any = mapRef.current) => {
    return map ? getAnalyticsLayerId(map) : getLayerIdForScale(displayScaleRef.current);
  };

  const getThresholdManifestScale = (
    map: any = mapRef.current,
    currentMode: AtlasMode = modeRef.current,
    currentTerritory: AnalysisTerritory = territoryRef.current,
    currentScale: AtlasScale = map ? getDisplayScale(map) : displayScaleRef.current
  ) => thresholdManifestRef.current?.modes?.[currentMode]?.[currentTerritory]?.[currentScale] || null;

  const getPrecomputedThresholdsForAttr = (attr: string, map: any = mapRef.current, currentScale?: AtlasScale) => {
    return getThresholdManifestScale(
      map,
      modeRef.current,
      territoryRef.current,
      currentScale || (map ? getDisplayScale(map) : displayScaleRef.current)
    )?.thresholds?.[attr] || null;
  };

  const getPrecomputedStatsForMap = (map: any = mapRef.current): Record<string, DataStats> | null => {
    const stats = getThresholdManifestScale(map)?.stats;
    if (!stats) return null;

    return Object.fromEntries(
      Object.entries(stats).map(([key, value]) => [
        key,
        {
          min: value.min,
          max: value.max,
          mean: value.mean
        }
      ])
    );
  };

  const applyPrecomputedStatsForMap = (map: any = mapRef.current) => {
    const stats = getPrecomputedStatsForMap(map);
    if (!stats) return false;

    setAttributeStats(stats);
    onStatsUpdate?.(stats);
    return true;
  };

  const getQuantileThresholdsForAttr = (attr: string, thresholdsOverride?: number[], map: any = mapRef.current) => {
    if (thresholdsOverride && thresholdsOverride.length > 0) return thresholdsOverride;
    const precomputedThresholds = getPrecomputedThresholdsForAttr(attr, map);
    if (precomputedThresholds) return precomputedThresholds;
    const layerId = getQuantileLayerId(map);
    const thresholds = quantileMap[getQuantileMapKey(layerId, attr)] || quantileMap[attr];
    return thresholds && thresholds.length > 0 ? thresholds : VALUE_THRESHOLDS;
  };

  const getQuantileThresholdsForScaleAttr = (
    attr: string,
    currentScale: AtlasScale,
    map: any = mapRef.current,
    thresholdsOverride?: number[]
  ) => {
    if (thresholdsOverride && currentScale === getDisplayScale(map)) return thresholdsOverride;

    const precomputedThresholds = getPrecomputedThresholdsForAttr(attr, map, currentScale);
    if (precomputedThresholds) return precomputedThresholds;

    const layerId = getLayerIdForScale(currentScale);
    const thresholds = quantileMap[getQuantileMapKey(layerId, attr)] || quantileMap[attr];
    return thresholds && thresholds.length > 0 ? thresholds : VALUE_THRESHOLDS;
  };

  const thresholdsEqual = (left?: number[], right?: number[]) => {
    if (!left || !right || left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  };

  const rememberQuantileThresholds = (layerId: string, attr: string, thresholds: number[]) => {
    const key = getQuantileMapKey(layerId, attr);
    setQuantileMap((previous) => {
      if (thresholdsEqual(previous[key], thresholds)) return previous;
      return { ...previous, [key]: thresholds };
    });
  };

  const computeRenderedQuantileThresholdsForAttr = (map: any, layerId: string, attr: string) => {
    if (!map.getLayer(layerId)) return null;
    const values = collectRenderedValuesByAttr(map, layerId, new Set([attr]), toColorNumeric)[attr] || [];
    return computeQuantileThresholds(values);
  };

  const getFreshQuantileThresholdsForAttr = (attr: string, map: any = mapRef.current) => {
    const precomputedThresholds = getPrecomputedThresholdsForAttr(attr, map);
    if (precomputedThresholds) return precomputedThresholds;
    if (!map) return getQuantileThresholdsForAttr(attr);
    const layerId = getQuantileLayerId(map);
    const thresholds = computeRenderedQuantileThresholdsForAttr(map, layerId, attr);
    if (!thresholds) return getQuantileThresholdsForAttr(attr, undefined, map);

    rememberQuantileThresholds(layerId, attr, thresholds);
    return thresholds;
  };

  const hasCarreau200Source = (
    currentMode: AtlasMode = mode,
    currentTerritory: AnalysisTerritory = territory
  ) => Boolean(resolveSource('carreau200', currentMode, currentTerritory).url);

  const getScaleForZoom = (
    zoom: number,
    requestedScale: AtlasScale = scaleRef.current,
    currentMode: AtlasMode = mode,
    currentTerritory: AnalysisTerritory = territory
  ): AtlasScale => {
    if (requestedScale !== 'segment') return requestedScale;
    if (!hasCarreau200Source(currentMode, currentTerritory)) return 'segment';
    return zoom <= SEGMENT_DETAIL_ZOOM ? 'carreau200' : 'segment';
  };

  const buildSegmentBaseOpacityExpression = () => ['interpolate', ['linear'], ['zoom'], 6, 0.98, 8, 0.95, 11, 0.92, 15, 0.88];

  const shouldHideSegmentScores = (properties: Record<string, unknown>, spatialUnit: SpatialUnit) => {
    if (spatialUnit !== 'segment') return false;
    const maskValue = properties[SEGMENT_MASK_FIELD];
    return maskValue === true || maskValue === 1 || maskValue === 'true' || maskValue === '1';
  };

  const normalizeFeatureToDomainObject = (
    feature: any,
    spatialUnit: SpatialUnit
  ): HoveredAtlasFeature | null => {
    if (!feature?.properties) return null;

    const properties = feature.properties as Record<string, unknown>;
    const hideScores = shouldHideSegmentScores(properties, spatialUnit);
    return {
      id: feature.id,
      properties,
      geometry: feature.geometry,
      spatial_unit: spatialUnit,
      scores: hideScores ? null : buildScoresFromProperties(properties),
      hoverNote: hideScores ? SEGMENT_MASK_HOVER_NOTE : null,
      isMasked: hideScores
    };
  };

  const syncCameraState = (map: any) => {
    const center = map.getCenter();
    cameraStateRef.current = {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch()
    };
    setCameraDebug(cameraStateRef.current);
    setBearing(cameraStateRef.current.bearing);
    setPitch(cameraStateRef.current.pitch);
  };

  const getLabelLayerIds = (map: any) => {
    const layers = map.getStyle()?.layers || [];
    const textLayers = layers.filter((layer: any) => {
      if (layer.type !== 'symbol') return false;
      return typeof layer.layout?.['text-field'] !== 'undefined';
    });
    return textLayers
      .filter((layer: any) => {
        const layerId = String(layer.id || '');
        const sourceLayer = String(layer['source-layer'] || '');
        return LABEL_LAYER_PATTERN.test(layerId) || LABEL_LAYER_PATTERN.test(sourceLayer);
      })
      .map((layer: any) => layer.id);
  };

  const getPlaceLabelLayerIds = (map: any) => {
    const layers = map.getStyle()?.layers || [];
    const textLayers = layers.filter((layer: any) => {
      if (layer.type !== 'symbol') return false;
      return typeof layer.layout?.['text-field'] !== 'undefined';
    });
    return textLayers
      .filter((layer: any) => {
        const layerId = String(layer.id || '');
        const sourceLayer = String(layer['source-layer'] || '');
        return PLACE_LABEL_LAYER_PATTERN.test(layerId) || PLACE_LABEL_LAYER_PATTERN.test(sourceLayer);
      })
      .map((layer: any) => layer.id);
  };

  const getAddressLabelLayerIds = (map: any) => {
    const layers = map.getStyle()?.layers || [];
    const textLayers = layers.filter((layer: any) => {
      if (layer.type !== 'symbol') return false;
      return typeof layer.layout?.['text-field'] !== 'undefined';
    });
    return textLayers
      .filter((layer: any) => {
        const layerId = String(layer.id || '');
        const sourceLayer = String(layer['source-layer'] || '');
        return ADDRESS_LABEL_LAYER_PATTERN.test(layerId) || ADDRESS_LABEL_LAYER_PATTERN.test(sourceLayer);
      })
      .map((layer: any) => layer.id);
  };

  const getFirstLabelLayerId = (map: any) => {
    const layers = map.getStyle()?.layers || [];
    return layers.find((layer: any) => (
      layer.type === 'symbol' && typeof layer.layout?.['text-field'] !== 'undefined'
    ))?.id;
  };

  const add3dBuildings = (map: any) => {
    if (map.getLayer(OPENFREEMAP_3D_LAYER_ID)) return;

    if (!map.getSource(OPENFREEMAP_3D_SOURCE_ID)) {
      map.addSource(OPENFREEMAP_3D_SOURCE_ID, {
        type: 'vector',
        url: env.VITE_OPENFREEMAP_PLANET_SOURCE || DEFAULT_OPENFREEMAP_PLANET_SOURCE
      });
    }

    const heightExpression: any[] = ['to-number', ['get', 'render_height'], 0];
    const layerDefinition = {
      id: OPENFREEMAP_3D_LAYER_ID,
      source: OPENFREEMAP_3D_SOURCE_ID,
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: OPENFREEMAP_3D_MIN_ZOOM,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], heightExpression,
          0, '#ded6cc',
          30, '#c6bdb2',
          80, '#a8a097'
        ],
        'fill-extrusion-height': [
          'interpolate', ['linear'], ['zoom'],
          OPENFREEMAP_3D_MIN_ZOOM, 0,
          16, heightExpression
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 1
      }
    };
    const labelLayerId = getFirstLabelLayerId(map);
    if (labelLayerId) {
      map.addLayer(layerDefinition, labelLayerId);
    } else {
      map.addLayer(layerDefinition);
    }
  };

  const apply3dCamera = (map: any) => {
    const nextBearing = Math.abs(map.getBearing()) < 1 ? OPENFREEMAP_3D_TARGET_BEARING : map.getBearing();
    map.easeTo({
      zoom: Math.max(map.getZoom(), OPENFREEMAP_3D_TARGET_ZOOM),
      pitch: Math.max(map.getPitch(), OPENFREEMAP_3D_TARGET_PITCH),
      bearing: nextBearing,
      duration: 650
    });
  };

  const applyFrenchPlaceLabels = (map: any) => {
    const placeLabelIds = getPlaceLabelLayerIds(map);
    const frenchLabelExpression: any[] = [
      'coalesce',
      ['get', 'name_fr'],
      ['get', 'name:fr'],
      ['get', 'name_fr_latin'],
      ['get', 'name:fr-Latn'],
      ['get', 'name'],
      ['get', 'name_en']
    ];

    for (const layerId of placeLabelIds) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'text-field', frenchLabelExpression as any);
      }
    }
  };

  const applyTextLayerVisibility = (map: any, visible: boolean) => {
    const labelLayerIds = getLabelLayerIds(map);
    setLabelsAvailable(labelLayerIds.length > 0);
    for (const layerId of labelLayerIds) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    }
    if (basemapRef.current === 'openFreeMap3d') {
      for (const layerId of getAddressLabelLayerIds(map)) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      }
    }
  };

  const move3dBuildingsAboveGroundLayers = (map: any) => {
    if (map.getLayer(OPENFREEMAP_3D_LAYER_ID)) {
      map.moveLayer(OPENFREEMAP_3D_LAYER_ID);
    }
  };

  const moveLabelLayersToTop = (map: any) => {
    const labelLayerIds = getLabelLayerIds(map);
    for (const layerId of labelLayerIds) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  };

  const getWaterLayerIds = (map: any) => {
    const layers = map.getStyle()?.layers || [];
    return layers
      .filter((layer: any) => {
        if (!['fill', 'line'].includes(layer.type)) return false;
        const layerId = String(layer.id || '');
        const sourceLayer = String(layer['source-layer'] || '');
        return WATER_LAYER_PATTERN.test(layerId) || WATER_LAYER_PATTERN.test(sourceLayer);
      })
      .map((layer: any) => layer.id);
  };

  const moveWaterLayersAboveAtlas = (map: any) => {
    const waterLayerIds = getWaterLayerIds(map);
    for (const layerId of waterLayerIds) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  };

  const getTransportLayerIds = (map: any) => {
    const layers = map.getStyle()?.layers || [];
    return layers
      .filter((layer: any) => {
        if (layer.type !== 'line') return false;
        const layerId = String(layer.id || '');
        const sourceLayer = String(layer['source-layer'] || '');
        return TRANSPORT_LAYER_PATTERN.test(layerId) || TRANSPORT_LAYER_PATTERN.test(sourceLayer);
      })
      .map((layer: any) => layer.id)
      .filter((layerId: string) => !layerId.startsWith('corridor') && !layerId.startsWith('provelo') && !layerId.startsWith('perimeter') && !layerId.startsWith('segments') && !layerId.startsWith('carreau200') && !layerId.startsWith('zones-'));
  };

  const getBasemapRoadLayerIds = (map: any) => {
    const layers = map.getStyle()?.layers || [];
    return layers
      .filter((layer: any) => {
        if (layer.type !== 'line') return false;
        const layerId = String(layer.id || '');
        const sourceLayer = String(layer['source-layer'] || '');
        if (BASEMAP_ROAD_EXCLUDE_PATTERN.test(layerId) || BASEMAP_ROAD_EXCLUDE_PATTERN.test(sourceLayer)) return false;
        return BASEMAP_ROAD_LAYER_PATTERN.test(layerId) ||
          BASEMAP_ROAD_LAYER_PATTERN.test(sourceLayer) ||
          BASEMAP_ROAD_SOURCE_LAYER_PATTERN.test(sourceLayer);
      })
      .map((layer: any) => layer.id)
      .filter((layerId: string) => !layerId.startsWith('corridor') && !layerId.startsWith('provelo') && !layerId.startsWith('perimeter') && !layerId.startsWith('segments') && !layerId.startsWith('carreau200') && !layerId.startsWith('zones-'));
  };

  const applyMutedBasemapRoadPaint = (map: any, currentBasemap: BasemapMode = basemapRef.current) => {
    if (currentBasemap !== 'voyager' && currentBasemap !== 'openFreeMap3d') return;

    const is3dBasemap = currentBasemap === 'openFreeMap3d';
    for (const layerId of getBasemapRoadLayerIds(map)) {
      if (!map.getLayer(layerId)) continue;
      const isCasingLayer = /case|casing|tunnel|bridge/i.test(layerId);
      const opacity = is3dBasemap
        ? isCasingLayer ? MUTED_BASEMAP_ROAD_3D_CASING_OPACITY : MUTED_BASEMAP_ROAD_3D_OPACITY
        : isCasingLayer ? MUTED_BASEMAP_ROAD_CASING_OPACITY : MUTED_BASEMAP_ROAD_OPACITY;
      map.setPaintProperty(layerId, 'line-color', MUTED_BASEMAP_ROAD_COLOR);
      map.setPaintProperty(layerId, 'line-opacity', opacity);
    }
  };

  const getAtlasLayerIds = () => [
    'zones-fill',
    'zones-outline',
    'segments-layer',
    'segments-hit-area',
    'carreau200-fill',
    'carreau200-outline'
  ];

  const setCorridorMaskOverviewVisibility = (
    map: any,
    visible: boolean,
    currentMode: AtlasMode = mode
  ) => {
    const nextVisibility = currentMode === 'bikeability' && visible ? 'visible' : 'none';
    for (const layerId of ['corridor-mask-overview-fill']) {
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(layerId, 'visibility', nextVisibility);
    }
    map.triggerRepaint();
  };

  const setCorridorsOverviewVisibility = (
    map: any,
    visible: boolean,
    currentMode: AtlasMode = mode
  ) => {
    const nextVisibility = currentMode === 'bikeability' && visible ? 'visible' : 'none';
    for (const layerId of ['corridors-overview-hit-area', 'corridors-overview-halo', 'corridors-overview-outline']) {
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(layerId, 'visibility', nextVisibility);
    }
    map.triggerRepaint();
  };

  const setProveloOverviewVisibility = (
    map: any,
    visible: boolean,
    currentMode: AtlasMode = mode
  ) => {
    const nextVisibility = currentMode === 'bikeability' && visible ? 'visible' : 'none';
    for (const layerId of [
      'provelo-mask-overview-fill',
      'provelo-overview-hit-area',
      'provelo-overview-fill',
      'provelo-overview-halo',
      'provelo-overview-outline'
    ]) {
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(layerId, 'visibility', nextVisibility);
    }
    map.triggerRepaint();
  };

  const extractOuterRings = (geometry: any): number[][][] => {
    if (!geometry?.type || !geometry?.coordinates) return [];
    if (geometry.type === 'Polygon') {
      return geometry.coordinates[0] ? [geometry.coordinates[0]] : [];
    }
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.map((polygon: any) => polygon[0]).filter(Boolean);
    }
    return [];
  };

  const extendBoundsWithCoordinates = (
    coordinates: any,
    bounds: [number, number, number, number]
  ) => {
    if (!coordinates) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      bounds[0] = Math.min(bounds[0], coordinates[0]);
      bounds[1] = Math.min(bounds[1], coordinates[1]);
      bounds[2] = Math.max(bounds[2], coordinates[0]);
      bounds[3] = Math.max(bounds[3], coordinates[1]);
      return;
    }
    for (const child of coordinates) {
      extendBoundsWithCoordinates(child, bounds);
    }
  };

  const getGeoJsonBounds = (geoJson: any): [[number, number], [number, number]] | null => {
    const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const feature of geoJson?.features || []) {
      extendBoundsWithCoordinates(feature.geometry?.coordinates, bounds);
    }
    if (bounds.some((value) => !Number.isFinite(value))) return null;
    return [[bounds[0], bounds[1]], [bounds[2], bounds[3]]];
  };

  const buildFocusMaskGeoJson = (focusGeoJson: any, id: string) => {
    const outerRing = [
      [ANALYSIS_MAX_BOUNDS[0][0], ANALYSIS_MAX_BOUNDS[0][1]],
      [ANALYSIS_MAX_BOUNDS[1][0], ANALYSIS_MAX_BOUNDS[0][1]],
      [ANALYSIS_MAX_BOUNDS[1][0], ANALYSIS_MAX_BOUNDS[1][1]],
      [ANALYSIS_MAX_BOUNDS[0][0], ANALYSIS_MAX_BOUNDS[1][1]],
      [ANALYSIS_MAX_BOUNDS[0][0], ANALYSIS_MAX_BOUNDS[0][1]]
    ];
    const holes = (focusGeoJson.features || []).flatMap((feature: any) => extractOuterRings(feature.geometry));

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id,
            kind: 'mask'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [outerRing, ...holes]
          }
        }
      ]
    };
  };

  const filterProveloGeoJson = (geoJson: any, activeQualificationValues: string[]) => ({
    type: 'FeatureCollection',
    features: (geoJson?.features || []).filter((feature: any) => (
      activeQualificationValues.includes(String(feature.properties?.Qualification || ''))
    ))
  });

  const buildOverviewCorridorsGeoJson = (gaillardData: any, stJulienData: any) => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: 'thonex_gaillard',
          nom: 'Gaillard - Thonex - Eaux-Vives',
          color: '#2E6A4A'
        },
        geometry: gaillardData.features?.[0]?.geometry || null
      },
      {
        type: 'Feature',
        properties: {
          id: 'plo_stjulien',
          nom: 'Saint-Julien - PLO - Carouge',
          color: '#2E6A4A'
        },
        geometry: stJulienData.features?.[0]?.geometry || null
      }
    ].filter((feature) => feature.geometry)
  });

  const buildCorridorMaskGeoJson = (corridorsGeoJson: any) => buildFocusMaskGeoJson(corridorsGeoJson, 'all');

  const loadGeoJsonUrl = async (url: string) => {
    if (!url) return null;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Unable to load ${url}.`, error);
      return null;
    }
  };

  const loadGeoJsonFile = async (
    envKey: 'VITE_FAISCEAU_GAILLARD_GEOJSON_URL' | 'VITE_FAISCEAU_STJULIEN_GEOJSON_URL',
    fallbackUrl: string
  ) => {
    return loadGeoJsonUrl(env[envKey] || fallbackUrl || resolveFaisceauGeoJsonUrl(envKey));
  };

  const getCorridorOverviewData = async () => {
    if (corridorOverviewDataRef.current) return corridorOverviewDataRef.current;

    const [gaillardData, stJulienData] = await Promise.all([
      loadGeoJsonFile('VITE_FAISCEAU_GAILLARD_GEOJSON_URL', DEFAULT_FAISCEAU_GAILLARD_GEOJSON_URL),
      loadGeoJsonFile('VITE_FAISCEAU_STJULIEN_GEOJSON_URL', DEFAULT_FAISCEAU_STJULIEN_GEOJSON_URL)
    ]);
    const corridors = buildOverviewCorridorsGeoJson(gaillardData, stJulienData);
    const mask = buildCorridorMaskGeoJson(corridors);

    corridorOverviewDataRef.current = { corridors, mask };
    return corridorOverviewDataRef.current;
  };

  const ensureCorridorOverviewGeoJsonLayers = async (map: any, currentMode: AtlasMode = mode) => {
    if (currentMode !== 'bikeability') return;

    const data = await getCorridorOverviewData();

    if (!map.getSource('corridors-overview-geojson')) {
      map.addSource('corridors-overview-geojson', {
        type: 'geojson',
        data: data.corridors
      });
    } else {
      map.getSource('corridors-overview-geojson').setData(data.corridors);
    }

    if (!map.getSource('corridor-mask-overview-geojson')) {
      map.addSource('corridor-mask-overview-geojson', {
        type: 'geojson',
        data: data.mask
      });
    } else {
      map.getSource('corridor-mask-overview-geojson').setData(data.mask);
    }

    if (!map.getLayer('corridor-mask-overview-fill')) {
      map.addLayer({
        id: 'corridor-mask-overview-fill',
        type: 'fill',
        source: 'corridor-mask-overview-geojson',
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 0.78,
          'fill-antialias': true
        },
        layout: {
          visibility: showCorridorMaskOverviewRef.current ? 'visible' : 'none'
        }
      });
    }

    if (!map.getLayer('corridors-overview-halo')) {
      map.addLayer({
        id: 'corridors-overview-halo',
        type: 'line',
        source: 'corridors-overview-geojson',
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 14, 10, 18, 12, 24, 14, 30],
          'line-opacity': 0.5,
          'line-blur': 8
        },
        layout: {
          visibility: showCorridorMaskOverviewRef.current ? 'visible' : 'none',
          'line-join': 'round',
          'line-cap': 'round'
        }
      });
    }

    if (!map.getLayer('corridors-overview-hit-area')) {
      map.addLayer({
        id: 'corridors-overview-hit-area',
        type: 'fill',
        source: 'corridors-overview-geojson',
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0
        },
        layout: {
          visibility: showCorridorMaskOverviewRef.current ? 'visible' : 'none'
        }
      });
    }

    if (!map.getLayer('corridors-overview-outline')) {
      map.addLayer({
        id: 'corridors-overview-outline',
        type: 'line',
        source: 'corridors-overview-geojson',
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#2E6A4A'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 10, 1.8, 12, 2.4, 14, 3],
          'line-opacity': 0.95
        },
        layout: {
          visibility: showCorridorMaskOverviewRef.current ? 'visible' : 'none',
          'line-join': 'round',
          'line-cap': 'round'
        }
      });
    }
  };

  const getProveloOverviewData = async () => {
    if (proveloOverviewDataRef.current) return proveloOverviewDataRef.current;

    const shapes = await loadGeoJsonUrl(resolveProveloGeoJsonUrl());
    if (!shapes?.features?.length) return null;

    proveloOverviewDataRef.current = { shapes };
    return proveloOverviewDataRef.current;
  };

  const ensureProveloOverviewGeoJsonLayers = async (
    map: any,
    currentMode: AtlasMode = mode,
    qualifications: ProveloQualificationState = proveloQualificationStateRef.current
  ) => {
    if (currentMode !== 'bikeability') return;

    const data = await getProveloOverviewData();
    if (!data) return;

    const activeQualificationValues = getActiveProveloQualificationValues(qualifications);
    const selectedShapes = filterProveloGeoJson(data.shapes, activeQualificationValues);
    const selectedMask = buildFocusMaskGeoJson(selectedShapes, 'provelo');
    const hasActiveSelection = activeQualificationValues.length > 0;

    if (!map.getSource('provelo-overview-geojson')) {
      map.addSource('provelo-overview-geojson', {
        type: 'geojson',
        data: selectedShapes
      });
    } else {
      map.getSource('provelo-overview-geojson').setData(selectedShapes);
    }

    if (!map.getSource('provelo-mask-overview-geojson')) {
      map.addSource('provelo-mask-overview-geojson', {
        type: 'geojson',
        data: selectedMask
      });
    } else {
      map.getSource('provelo-mask-overview-geojson').setData(selectedMask);
    }

    if (!map.getLayer('provelo-mask-overview-fill')) {
      map.addLayer({
        id: 'provelo-mask-overview-fill',
        type: 'fill',
        source: 'provelo-mask-overview-geojson',
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 0.78,
          'fill-antialias': true
        },
        layout: {
          visibility: hasActiveSelection ? 'visible' : 'none'
        }
      });
    }

    if (!map.getLayer('provelo-overview-fill')) {
      map.addLayer({
        id: 'provelo-overview-fill',
        type: 'fill',
        source: 'provelo-overview-geojson',
        paint: {
          'fill-color': [
            'match',
            ['get', 'Qualification'],
            PROVELO_QUALIFICATIONS.rustineDor.value,
            PROVELO_QUALIFICATIONS.rustineDor.color,
            PROVELO_QUALIFICATIONS.pneuCreuve.value,
            PROVELO_QUALIFICATIONS.pneuCreuve.color,
            '#101010'
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.04, 12, 0.08, 14, 0.12],
          'fill-antialias': true
        },
        layout: {
          visibility: hasActiveSelection ? 'visible' : 'none'
        }
      });
    }

    if (!map.getLayer('provelo-overview-halo')) {
      map.addLayer({
        id: 'provelo-overview-halo',
        type: 'line',
        source: 'provelo-overview-geojson',
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 8, 12, 12, 14, 16],
          'line-opacity': 0.72,
          'line-blur': 5
        },
        layout: {
          visibility: hasActiveSelection ? 'visible' : 'none',
          'line-join': 'round',
          'line-cap': 'round'
        }
      });
    }

    if (!map.getLayer('provelo-overview-hit-area')) {
      map.addLayer({
        id: 'provelo-overview-hit-area',
        type: 'fill',
        source: 'provelo-overview-geojson',
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0
        },
        layout: {
          visibility: hasActiveSelection ? 'visible' : 'none'
        }
      });
    }

    if (!map.getLayer('provelo-overview-outline')) {
      map.addLayer({
        id: 'provelo-overview-outline',
        type: 'line',
        source: 'provelo-overview-geojson',
        paint: {
          'line-color': [
            'match',
            ['get', 'Qualification'],
            PROVELO_QUALIFICATIONS.rustineDor.value,
            PROVELO_QUALIFICATIONS.rustineDor.color,
            PROVELO_QUALIFICATIONS.pneuCreuve.value,
            PROVELO_QUALIFICATIONS.pneuCreuve.color,
            '#101010'
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 12, 2.1, 14, 3],
          'line-opacity': 0.96,
          'line-dasharray': [1.2, 0.7]
        },
        layout: {
          visibility: hasActiveSelection ? 'visible' : 'none',
          'line-join': 'round',
          'line-cap': 'round'
        }
      });
    }

    setProveloOverviewVisibility(map, hasActiveSelection, currentMode);
  };

  const moveCorridorMaskLayer = (map: any, currentMode: AtlasMode = mode) => {
    if (currentMode !== 'bikeability') return;
    const maskLayerId = map.getLayer('corridor-mask-overview-fill') ? 'corridor-mask-overview-fill' : null;
    if (!maskLayerId) return;
    map.moveLayer(maskLayerId);
  };

  const moveCorridorsOverviewLayers = (map: any, currentMode: AtlasMode = mode) => {
    if (currentMode !== 'bikeability') return;
    for (const layerId of ['corridors-overview-hit-area', 'corridors-overview-halo', 'corridors-overview-outline']) {
      if (!map.getLayer(layerId)) continue;
      map.moveLayer(layerId);
    }
  };

  const moveProveloMaskLayer = (map: any, currentMode: AtlasMode = mode) => {
    if (currentMode !== 'bikeability') return;
    if (map.getLayer('provelo-mask-overview-fill')) {
      map.moveLayer('provelo-mask-overview-fill');
    }
  };

  const moveProveloOverviewLayers = (map: any, currentMode: AtlasMode = mode) => {
    if (currentMode !== 'bikeability') return;
    for (const layerId of ['provelo-overview-hit-area', 'provelo-overview-fill', 'provelo-overview-halo', 'provelo-overview-outline']) {
      if (!map.getLayer(layerId)) continue;
      map.moveLayer(layerId);
    }
  };

  const moveAtlasLayers = (map: any) => {
    for (const layerId of getAtlasLayerIds()) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  };

  const moveTransportLayersAboveAtlas = (map: any) => {
    for (const layerId of getTransportLayerIds(map)) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  };

  const moveSegmentLayersAboveWater = (map: any) => {
    for (const layerId of ['segments-layer', 'segments-hit-area']) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  };

  const reorderMapLayers = (
    map: any,
    currentMode: AtlasMode = mode,
    requestedScale: AtlasScale = scaleRef.current
  ) => {
    moveAtlasLayers(map);
    moveWaterLayersAboveAtlas(map);
    moveSegmentLayersAboveWater(map);
    if (requestedScale !== 'segment') {
      moveTransportLayersAboveAtlas(map);
    }
    move3dBuildingsAboveGroundLayers(map);
    moveLabelLayersToTop(map);
    moveCorridorMaskLayer(map, currentMode);
    moveCorridorsOverviewLayers(map, currentMode);
    moveProveloMaskLayer(map, currentMode);
    moveProveloOverviewLayers(map, currentMode);
    for (const layerId of ['perimeter-casing', 'perimeter-outline']) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  };

  const applyScaleVisibility = (
    map: any,
    nextScale: AtlasScale,
    currentMode: AtlasMode = mode,
    currentTerritory: AnalysisTerritory = territory
  ) => {
    const setVisibility = (layerId: string, visible: boolean) => {
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    };

    const hybridSegmentScale =
      nextScale === 'segment' &&
      hasCarreau200Source(currentMode, currentTerritory) &&
      map.getLayer('carreau200-fill');

    setVisibility('segments-layer', nextScale === 'segment');
    setVisibility('segments-hit-area', nextScale === 'segment');
    setVisibility('carreau200-fill', Boolean(hybridSegmentScale) || nextScale === 'carreau200');
    setVisibility('carreau200-outline', Boolean(hybridSegmentScale) || nextScale === 'carreau200');
    setVisibility('zones-fill', nextScale === 'zoneTrafic');
    setVisibility('zones-outline', nextScale === 'zoneTrafic');

    if (map.getLayer('segments-layer')) {
      map.setPaintProperty(
        'segments-layer',
        'line-opacity',
        hybridSegmentScale
          ? segmentOpacity
          : nextScale === 'segment'
            ? buildSegmentBaseOpacityExpression()
            : 0
      );
    }

    if (map.getLayer('carreau200-fill')) {
      map.setPaintProperty(
        'carreau200-fill',
        'fill-opacity',
        hybridSegmentScale
          ? carreauFillOpacity
          : nextScale === 'carreau200'
            ? 0.6
            : 0
      );
    }

    if (map.getLayer('carreau200-outline')) {
      map.setPaintProperty(
        'carreau200-outline',
        'line-opacity',
        hybridSegmentScale
          ? carreauOutlineOpacity
          : nextScale === 'carreau200'
            ? 0.5
            : 0
      );
    }
  };

  const syncScaleFromMapZoom = (
    map: any,
    requestedScale: AtlasScale = scaleRef.current,
    currentMode: AtlasMode = mode,
    currentTerritory: AnalysisTerritory = territory
  ) => {
    const previousDisplayScale = displayScaleRef.current;
    const nextDisplayScale = getScaleForZoom(map.getZoom(), requestedScale, currentMode, currentTerritory);

    displayScaleRef.current = nextDisplayScale;
    applyScaleVisibility(map, requestedScale, currentMode, currentTerritory);

    if (previousDisplayScale !== nextDisplayScale) {
      hoverSegmentRef.current(null);
      const attr = activeAttribute();
      if (colorModeRef.current === 'quantile' && !getPrecomputedThresholdsForAttr(attr, map, nextDisplayScale)) {
        refreshActiveRampForMap(map);
      }
    }

    return nextDisplayScale;
  };

  const setPerimeterVisibility = (map: any, visible: boolean) => {
    if (map.getLayer('perimeter-casing')) {
      map.setPaintProperty('perimeter-casing', 'line-opacity', visible ? 0 : 0);
    }
    if (map.getLayer('perimeter-outline')) {
      map.setPaintProperty(
        'perimeter-outline',
        'line-opacity',
        visible ? ['interpolate', ['linear'], ['zoom'], 8, 0.18, 10, 0.32, 12, 0.62, 14, 0.92] : 0
      );
    }
    map.triggerRepaint();
  };

  const currentScale = () => scaleRef.current;

  const getSourceIdForScale = (nextScale: AtlasScale = currentScale()) => {
    if (nextScale === 'carreau200') return 'carreau200';
    if (nextScale === 'zoneTrafic') return 'zones_trafic';
    return 'segments';
  };

  const getLayerIdForScale = (nextScale: AtlasScale = currentScale()) => {
    if (nextScale === 'carreau200') return 'carreau200-fill';
    if (nextScale === 'zoneTrafic') return 'zones-fill';
    return 'segments-layer';
  };

  const getDisplayScale = (map: any = mapRef.current) => {
    if (!map) return currentScale();
    return getScaleForZoom(map.getZoom(), currentScale(), modeRef.current, territoryRef.current);
  };

  const getAnalyticsLayerId = (map: any = mapRef.current) => {
    return getLayerIdForScale(getDisplayScale(map));
  };

  const applyAnalysisConstraints = (map: any) => {
    const camera = map.cameraForBounds(ANALYSIS_BOUNDS, { padding: ANALYSIS_PADDING });
    if (camera?.zoom && Number.isFinite(camera.zoom)) {
      map.setMinZoom(Math.max(ANALYSIS_MIN_ZOOM_FLOOR, camera.zoom - 2.1));
    } else {
      map.setMinZoom(ANALYSIS_MIN_ZOOM_FLOOR);
    }
    map.setMaxBounds(ANALYSIS_MAX_BOUNDS);
  };

  const clearLoadingArtifacts = () => {
    if (loadingCleanupRef.current) {
      loadingCleanupRef.current();
      loadingCleanupRef.current = null;
    }
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  const preloadPmtilesHeaders = (currentMode: AtlasMode, currentTerritory: AnalysisTerritory) => {
    if (!protocolRef.current) return;

    const sourceUrls = [
      resolveSource('segment', currentMode, currentTerritory).url,
      resolveSource('carreau200', currentMode, currentTerritory).url,
      resolveSource('zoneTrafic', currentMode, currentTerritory).url,
      resolvePerimeterSource().url
    ];

    for (const sourceUrl of sourceUrls) {
      if (!sourceUrl.startsWith('pmtiles://')) continue;
      const rawUrl = sourceUrl.replace(/^pmtiles:\/\//, '');
      let archive = protocolRef.current.get(rawUrl);
      if (!archive) {
        archive = new PMTiles(rawUrl);
        protocolRef.current.add(archive);
      }
      void archive.getHeader().catch(() => undefined);
    }
  };

  const preloadAdjacentHeaders = (currentMode: AtlasMode, currentTerritory: AnalysisTerritory) => {
    preloadPmtilesHeaders(currentMode, currentTerritory);
    preloadPmtilesHeaders(currentMode === 'walkability' ? 'bikeability' : 'walkability', currentTerritory);
  };

  const getTrackedSourceIds = (currentMode: AtlasMode = mode, currentTerritory: AnalysisTerritory = territory) => {
    const activeScale = currentScale();
    if (activeScale === 'segment') {
      const sourceIds = ['segments'];
      if (hasCarreau200Source(currentMode, currentTerritory)) {
        sourceIds.push('carreau200');
      }
      return sourceIds;
    }

    const activeSourceUrl = resolveSource(activeScale, currentMode, currentTerritory).url;
    if (!activeSourceUrl) return ['segments'];
    return [getSourceIdForScale(activeScale)];
  };

  const removeAtlasLayersAndSources = (map: any) => {
    const layerIds = [
      'corridors-overview-outline',
      'corridors-overview-halo',
      'corridors-overview-hit-area',
      'corridor-mask-overview-fill',
      'provelo-overview-outline',
      'provelo-overview-halo',
      'provelo-overview-hit-area',
      'provelo-overview-fill',
      'provelo-mask-overview-fill',
      'perimeter-outline',
      'perimeter-casing',
      'segments-hit-area',
      'segments-layer',
      'carreau200-outline',
      'carreau200-fill',
      'zones-outline',
      'zones-fill'
    ];
    const sourceIds = [
      'corridors-overview-geojson',
      'corridor-mask-overview-geojson',
      'provelo-overview-geojson',
      'provelo-mask-overview-geojson',
      'perimeter',
      'segments',
      'carreau200',
      'zones_trafic'
    ];

    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    for (const sourceId of sourceIds) {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  };

  const finishLoading = (requestId: number, detail = 'Sources prêtes') => {
    if (loadRequestRef.current !== requestId) return;

    setLoadingStage('done');
    setLoadingDetail(detail);
    setLoadingProgress(100);

    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = window.setTimeout(() => {
      if (loadRequestRef.current !== requestId) return;
      setIsLoading(false);
      setLoadingDetail('');
      loadingTimeoutRef.current = null;
    }, 180);
  };

  const ensureAtlasLayers = (
    map: any,
    currentMode: AtlasMode = mode,
    currentTerritory: AnalysisTerritory = territory
  ) => {
    const segmentSource = resolveSource('segment', currentMode, currentTerritory);
    const carreau200Source = resolveSource('carreau200', currentMode, currentTerritory);
    const zoneTraficSource = resolveSource('zoneTrafic', currentMode, currentTerritory);
    const perimeterSource = resolvePerimeterSource();

    const SEG_URL = segmentSource.url;
    const CAR_URL = carreau200Source.url;
    const ZT_URL = zoneTraficSource.url;
    const PERIMETER_URL = perimeterSource.url;
    const hasCar = Boolean(CAR_URL);
    const hasZt = Boolean(ZT_URL);
    const hasPerimeter = Boolean(PERIMETER_URL);

    if (!map.getSource('segments')) {
      map.addSource('segments', { type: 'vector', url: SEG_URL });
    }
    if (hasCar && !map.getSource('carreau200')) {
      map.addSource('carreau200', { type: 'vector', url: CAR_URL });
    }
    if (hasZt && !map.getSource('zones_trafic')) {
      map.addSource('zones_trafic', { type: 'vector', url: ZT_URL });
    }
    if (hasPerimeter && !map.getSource('perimeter')) {
      map.addSource('perimeter', { type: 'vector', url: PERIMETER_URL });
    }

    const SEG_LAYER = segmentSource.sourceLayer;
    const CAR_LAYER = carreau200Source.sourceLayer;
    const ZT_LAYER = zoneTraficSource.sourceLayer;
    const PERIMETER_LAYER = perimeterSource.sourceLayer;

    if (hasZt && !map.getLayer('zones-fill')) {
      map.addLayer(
        {
          id: 'zones-fill',
          type: 'fill',
          source: 'zones_trafic',
          'source-layer': ZT_LAYER,
          paint: {
            'fill-color': '#96C8A6',
            'fill-opacity': 0.5
          },
          layout: { visibility: 'none' }
        }
      );
    }

    if (hasZt && !map.getLayer('zones-outline')) {
      map.addLayer(
        {
          id: 'zones-outline',
          type: 'line',
          source: 'zones_trafic',
          'source-layer': ZT_LAYER,
          paint: { 'line-color': '#333', 'line-width': 0.3 },
          layout: { visibility: 'none' }
        }
      );
    }

    if (hasCar && !map.getLayer('carreau200-fill')) {
      map.addLayer(
        {
          id: 'carreau200-fill',
          type: 'fill',
          source: 'carreau200',
          'source-layer': CAR_LAYER,
          paint: {
            'fill-color': '#96C8A6',
            'fill-opacity': carreauFillOpacity,
            'fill-antialias': true
          },
          layout: { visibility: 'none' }
        }
      );
    }

    if (hasCar && !map.getLayer('carreau200-outline')) {
      map.addLayer(
        {
          id: 'carreau200-outline',
          type: 'line',
          source: 'carreau200',
          'source-layer': CAR_LAYER,
          paint: {
            'line-color': '#666',
            'line-width': 0.3,
            'line-opacity': carreauOutlineOpacity
          },
          layout: { visibility: 'none' }
        }
      );
    }

    if (!map.getLayer('segments-layer')) {
      map.addLayer(
        {
          id: 'segments-layer',
          type: 'line',
          source: 'segments',
          'source-layer': SEG_LAYER,
          paint: {
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.05, 8, 1.35, 10, 1.55, 11, 1.7, 15, 2.2],
            'line-color': '#96C8A6',
            'line-opacity': hasCar ? segmentOpacity : buildSegmentBaseOpacityExpression()
          },
          layout: { visibility: 'visible' }
        }
      );
    }

    if (!map.getLayer('segments-hit-area')) {
      map.addLayer(
        {
          id: 'segments-hit-area',
          type: 'line',
          source: 'segments',
          'source-layer': SEG_LAYER,
          paint: {
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 8, 8, 9, 10, 11, 15, 15],
            'line-color': 'transparent',
            'line-opacity': 0
          },
          layout: { visibility: 'visible' }
        }
      );
    }

    if (hasPerimeter && !map.getLayer('perimeter-casing')) {
      map.addLayer({
        id: 'perimeter-casing',
        type: 'line',
        source: 'perimeter',
        'source-layer': PERIMETER_LAYER,
        paint: {
          'line-color': '#FF2B2B',
          'line-width': 1,
          'line-opacity': 0
        },
        layout: { visibility: 'visible' }
      });
    }

    if (hasPerimeter && !map.getLayer('perimeter-outline')) {
      map.addLayer({
        id: 'perimeter-outline',
        type: 'line',
        source: 'perimeter',
        'source-layer': PERIMETER_LAYER,
        paint: {
          'line-color': '#000000',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 10, 2.2, 12, 2.9, 14, 3.6],
          'line-opacity': showPerimeterRef.current ? ['interpolate', ['linear'], ['zoom'], 8, 0.18, 10, 0.32, 12, 0.62, 14, 0.92] : 0
        },
        layout: {
          visibility: 'visible',
          'line-cap': 'round',
          'line-join': 'round'
        }
      });
    }

    applyFrenchPlaceLabels(map);
    applyMutedBasemapRoadPaint(map);
    reorderMapLayers(map, currentMode, currentScale());
    applyTextLayerVisibility(map, showLabelsRef.current);
    applyScaleVisibility(map, currentScale(), currentMode, currentTerritory);
    setCorridorMaskOverviewVisibility(map, showCorridorMaskOverviewRef.current, currentMode);
    setProveloOverviewVisibility(map, hasActiveProveloQualifications(), currentMode);
    setPerimeterVisibility(map, showPerimeterRef.current);
  };

  const refreshAtlasData = (
    map: any,
    recomputeAnalytics: boolean,
    currentMode: AtlasMode = mode,
    currentTerritory: AnalysisTerritory = territory
  ) => {
    const requestId = ++loadRequestRef.current;
    clearLoadingArtifacts();

    lastModeRef.current = currentMode;
    lastTerritoryRef.current = currentTerritory;
    hoverSegmentRef.current(null);
    setLabelsAvailable(true);
    setLoadingStage('initial');
    setLoadingDetail(recomputeAnalytics ? 'Préparation des sources' : 'Mise à jour des couches');
    setLoadingProgress(recomputeAnalytics ? 8 : 16);
    setIsLoading(true);

    if (recomputeAnalytics) {
      initialAnalyticsDoneRef.current = false;
      setQuantileMap({});
      setAttributeStats({});
    }

    removeAtlasLayersAndSources(map);
    ensureAtlasLayers(map, currentMode, currentTerritory);
    syncScaleFromMapZoom(map, currentScale(), currentMode, currentTerritory);
    applyTextLayerVisibility(map, showLabelsRef.current);
    setPerimeterVisibility(map, showPerimeterRef.current);

    const trackedSourceIds = getTrackedSourceIds(currentMode, currentTerritory);

    const updateSourceProgress = () => {
      const totalCount = trackedSourceIds.length;
      const loadedCount = trackedSourceIds.filter((sourceId) => {
        if (!map.getSource(sourceId)) return true;
        try {
          return map.isSourceLoaded(sourceId);
        } catch {
          return false;
        }
      }).length;
      const ratio = totalCount === 0 ? 1 : loadedCount / totalCount;
      const baseProgress = recomputeAnalytics ? 18 : 28;
      const maxProgress = recomputeAnalytics ? 72 : 94;

      setLoadingStage('tiles');
      setLoadingDetail(totalCount > 0 ? `${loadedCount}/${totalCount} sources prêtes` : 'Sources prêtes');
      setLoadingProgress((previous) => Math.max(previous, baseProgress + ratio * (maxProgress - baseProgress)));

      return { loadedCount, totalCount, ratio };
    };

    const runAnalytics = () => {
      if (loadRequestRef.current !== requestId) return;
      if (!thresholdManifestLoadedRef.current) {
        setLoadingStage('quantiles');
        setLoadingDetail('Chargement des seuils précalculés');
        setLoadingProgress((previous) => Math.max(previous, 78));
        window.setTimeout(runAnalytics, 40);
        return;
      }

      const attr = activeAttribute();
      const analyticsLayerId = getAnalyticsLayerId(map);
      const precomputedScale = getThresholdManifestScale(map, currentMode, currentTerritory);

      if (precomputedScale?.thresholds) {
        const stats = getPrecomputedStatsForMap(map);
        if (stats) {
          setAttributeStats(stats);
          onStatsUpdate?.(stats);
        }

        const activeThresholds = precomputedScale.thresholds[attr] || VALUE_THRESHOLDS;
        applyRamp(attr, colorModeRef.current === 'quantile' ? activeThresholds : undefined);

        if (showDistributionRef.current && distributionRequestRef.current) {
          distributionRequestRef.current(
            computeDistribution(attr, colorModeRef.current === 'quantile' ? activeThresholds : VALUE_THRESHOLDS)
          );
        }

        initialAnalyticsDoneRef.current = true;
        preloadAdjacentHeaders(currentMode, currentTerritory);
        finishLoading(requestId, 'Seuils précalculés chargés');
        return;
      }

      const rawValuesByAttr = collectRenderedValuesByAttr(map, analyticsLayerId);
      const colorValuesByAttr = collectRenderedValuesByAttr(map, analyticsLayerId, attrKeys, toColorNumeric);

      setLoadingStage('quantiles');
      setLoadingDetail('Calcul des quantiles');
      setLoadingProgress((previous) => Math.max(previous, 82));

      const nextQuantileMap: Record<string, number[]> = {};
      for (const [key, values] of Object.entries(colorValuesByAttr)) {
        const thresholds = computeQuantileThresholds(values);
        if (thresholds) nextQuantileMap[getQuantileMapKey(analyticsLayerId, key)] = thresholds;
      }

      setQuantileMap(nextQuantileMap);
      const activeThresholds = nextQuantileMap[getQuantileMapKey(analyticsLayerId, attr)] || VALUE_THRESHOLDS;

      const stats: Record<string, DataStats> = {};
      for (const [key, values] of Object.entries(rawValuesByAttr)) {
        stats[key] = computeStats(values as number[]);
      }
      setAttributeStats(stats);
      onStatsUpdate?.(stats);

      applyRamp(attr, colorModeRef.current === 'quantile' ? activeThresholds : undefined);

      setLoadingStage('distribution');
      setLoadingDetail('Mise à jour des panneaux');
      setLoadingProgress((previous) => Math.max(previous, 94));

      if (showDistributionRef.current && distributionRequestRef.current) {
        distributionRequestRef.current(
          computeDistribution(attr, colorModeRef.current === 'quantile' ? activeThresholds : VALUE_THRESHOLDS)
        );
      }

      initialAnalyticsDoneRef.current = true;
      preloadAdjacentHeaders(currentMode, currentTerritory);
      finishLoading(requestId, 'Marchabilité et cyclabilité synchronisées');
    };

    let handledIdle = false;
    const handleSourceLoading = (event: any) => {
      if (loadRequestRef.current !== requestId) return;
      if (trackedSourceIds.includes(String(event.sourceId || ''))) {
        updateSourceProgress();
      }
    };

    const handleSourceData = (event: any) => {
      if (loadRequestRef.current !== requestId) return;
      if (trackedSourceIds.includes(String(event.sourceId || ''))) {
        updateSourceProgress();
      }
    };

    const handleIdle = () => {
      if (loadRequestRef.current !== requestId || handledIdle) return;
      const { ratio } = updateSourceProgress();
      if (ratio < 1 || !map.areTilesLoaded()) return;

      handledIdle = true;
      clearLoadingArtifacts();

      syncScaleFromMapZoom(map, currentScale(), currentMode, currentTerritory);

      if (recomputeAnalytics) {
        runAnalytics();
      } else {
        refreshActiveRampForMap(map);
        preloadAdjacentHeaders(currentMode, currentTerritory);
        finishLoading(requestId);
      }
    };

    map.on('sourcedataloading', handleSourceLoading);
    map.on('sourcedata', handleSourceData);
    map.on('idle', handleIdle);

    loadingCleanupRef.current = () => {
      map.off('sourcedataloading', handleSourceLoading);
      map.off('sourcedata', handleSourceData);
      map.off('idle', handleIdle);
    };

    updateSourceProgress();
    requestAnimationFrame(() => handleIdle());
  };

  const buttonBaseStyle = (active = false, compact = false): CSSProperties => ({
    width: compact ? 34 : 40,
    height: compact ? 34 : 40,
    borderRadius: compact ? 10 : 14,
    border: '1px solid #D8D2CA',
    background: active ? '#1A1A1A' : 'rgba(255, 255, 255, 0.94)',
    color: active ? '#FFFFFF' : '#5A5A5A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    transition: 'all 150ms ease'
  });

  const proveloPillStyle: CSSProperties = {
    height: 40,
    borderRadius: 999,
    border: '1px solid #D8D2CA',
    background: 'rgba(255, 255, 255, 0.94)',
    color: '#5A5A5A',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
  };

  const proveloPillButtonStyle = (qualification: ProveloQualificationKey): CSSProperties => {
    const active = proveloQualificationState[qualification];
    return {
      width: 34,
      height: 32,
      borderRadius: 999,
      border: 'none',
      background: active ? PROVELO_QUALIFICATIONS[qualification].color : 'transparent',
      color: active ? '#FFFFFF' : '#5A5A5A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 150ms ease'
    };
  };

  const basemapSelectStyle: CSSProperties = {
    height: 40,
    borderRadius: 14,
    border: '1px solid #D8D2CA',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1L5 5L9 1\' stroke=\'%235A5A5A\' stroke-width=\'1.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '10px 6px',
    color: '#5A5A5A',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    padding: '0 34px 0 12px',
    fontFamily: 'Arial, sans-serif',
    fontSize: 11,
    fontWeight: 600,
    width: 124,
    appearance: 'none',
    WebkitAppearance: 'none'
  };
  const paletteSelectStyle: CSSProperties = {
    ...basemapSelectStyle,
    width: 132,
    padding: '0 34px 0 34px'
  };

  const normalizedBearing = ((bearing % 360) + 360) % 360;
  const isNorthAligned = Math.min(normalizedBearing, 360 - normalizedBearing) < 1;
  const isPerspective = pitch > 10;

  useEffect(() => {
    let cancelled = false;

    fetch(resolveAttributeThresholdsUrl(), { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) return null;
        return response.json() as Promise<AttributeThresholdManifest>;
      })
      .then((manifest) => {
        if (!cancelled) setThresholdManifest(manifest);
      })
      .catch(() => {
        if (!cancelled) setThresholdManifest(null);
      })
      .finally(() => {
        if (!cancelled) setThresholdManifestLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize MapLibre and recreate it when the basemap changes.
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const shouldRecomputeAnalytics =
      lastModeRef.current !== mode ||
      lastTerritoryRef.current !== territory ||
      !initialAnalyticsDoneRef.current;

    setMapLoaded(false);
    setLabelsAvailable(true);
    setBearing(cameraStateRef.current.bearing);
    setPitch(cameraStateRef.current.pitch);
    setLoadingStage('initial');
    setLoadingDetail('Initialisation du fond de carte');
    setLoadingProgress(shouldRecomputeAnalytics ? 4 : 8);
    setIsLoading(true);

    const maplibreAny = maplibregl as typeof maplibregl & {
      addProtocol?: (name: string, handler: (params: any, callback: any) => void) => void;
      removeProtocol?: (name: string) => void;
    };
    protocolRef.current ||= new Protocol();
    maplibreAny.addProtocol?.('pmtiles', protocolRef.current.tile);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: resolveBasemapStyle(basemap) as any,
      center: cameraStateRef.current.center,
      zoom: cameraStateRef.current.zoom,
      bearing: cameraStateRef.current.bearing,
      pitch: cameraStateRef.current.pitch,
      maxPitch: 60,
      transformRequest: (url) => ({ url: rewriteMapboxUrl(url) }),
      attributionControl: false
    });

    mapRef.current = map;
    applyAnalysisConstraints(map);

    const scaleControl = new maplibregl.ScaleControl({
      maxWidth: 120,
      unit: 'metric'
    });
    map.addControl(scaleControl, 'bottom-left');
    requestAnimationFrame(() => {
      const scaleElement = mapContainerRef.current?.querySelector('.mapboxgl-ctrl-scale') as HTMLElement | null;
      const scaleWrapper = scaleElement?.parentElement as HTMLElement | null;
      if (scaleWrapper && scaleHostRef.current) {
        scaleWrapper.style.margin = '0';
        scaleWrapper.style.display = 'flex';
        scaleWrapper.style.alignItems = 'center';
        scaleWrapper.style.pointerEvents = 'none';
        scaleHostRef.current.appendChild(scaleWrapper);
      }
      if (scaleElement) {
        scaleElement.style.background = 'rgba(255, 255, 255, 0.94)';
        scaleElement.style.border = '1px solid #D8D2CA';
        scaleElement.style.borderTop = 'none';
        scaleElement.style.borderRadius = '10px';
        scaleElement.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
        scaleElement.style.color = '#1A1A1A';
        scaleElement.style.fontFamily = 'Arial, sans-serif';
        scaleElement.style.fontSize = '10px';
        scaleElement.style.padding = '3px 8px';
      }
    });

    const updateOrientation = () => {
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };

    const queueCameraSync = () => {
      if (cameraAnimationFrameRef.current !== null) return;
      cameraAnimationFrameRef.current = requestAnimationFrame(() => {
        cameraAnimationFrameRef.current = null;
        syncCameraState(map);
      });
    };

    const persistCamera = () => {
      syncCameraState(map);
      const attr = activeAttribute();
      if (colorModeRef.current === 'quantile' && !getPrecomputedThresholdsForAttr(attr, map)) {
        window.requestAnimationFrame(() => refreshActiveRampForMap(map));
      }
    };

    const handleResize = () => {
      applyAnalysisConstraints(map);
    };

    const handleZoomScaleSync = () => {
      syncScaleFromMapZoom(map);
    };

    const handleStyleLoad = () => {
      applyMutedBasemapRoadPaint(map, basemap);
      if (basemap === 'openFreeMap3d') {
        add3dBuildings(map);
      }
    };

    map.on('rotate', updateOrientation);
    map.on('pitch', updateOrientation);
    map.on('move', queueCameraSync);
    map.on('moveend', persistCamera);
    map.on('zoom', handleZoomScaleSync);
    map.on('zoomend', handleZoomScaleSync);
    map.on('resize', handleResize);
    map.on('style.load', handleStyleLoad);
    queueCameraSync();

    map.once('load', () => {
      handleStyleLoad();
      if (basemap === 'openFreeMap3d') {
        apply3dCamera(map);
      }
      setMapLoaded(true);
      refreshAtlasData(map, shouldRecomputeAnalytics, mode, territory);
    });

    return () => {
      loadRequestRef.current += 1;
      clearLoadingArtifacts();
      syncCameraState(map);
      map.off('rotate', updateOrientation);
      map.off('pitch', updateOrientation);
      map.off('move', queueCameraSync);
      map.off('moveend', persistCamera);
      map.off('zoom', handleZoomScaleSync);
      map.off('zoomend', handleZoomScaleSync);
      map.off('resize', handleResize);
      map.off('style.load', handleStyleLoad);
      if (cameraAnimationFrameRef.current !== null) {
        cancelAnimationFrame(cameraAnimationFrameRef.current);
        cameraAnimationFrameRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
      maplibreAny.removeProtocol?.('pmtiles');
    };
  }, [basemap]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (lastModeRef.current === mode && lastTerritoryRef.current === territory) return;

    refreshAtlasData(mapRef.current, true, mode, territory);
  }, [mapLoaded, mode, territory]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleResetView = () => {
    mapRef.current?.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      bearing: DEFAULT_BEARING,
      pitch: DEFAULT_PITCH
    });
  };

  const handleTogglePerspective = () => {
    const map = mapRef.current;
    if (!map) return;
    const enablePerspective = map.getPitch() < 10;
    const nextBearing = enablePerspective && Math.abs(map.getBearing()) < 1 ? -18 : map.getBearing();
    map.easeTo({
      pitch: enablePerspective ? 55 : 0,
      bearing: nextBearing,
      duration: 500
    });
  };

  const handleResetNorth = () => {
    mapRef.current?.easeTo({
      bearing: 0,
      duration: 350
    });
  };

  const getFocusPadding = () => {
    if (window.innerWidth < 640) {
      return { top: 76, right: 32, bottom: 112, left: 32 };
    }
    return { top: 104, right: 360, bottom: 72, left: 72 };
  };

  const flyToProveloOverview = async (
    qualifications: ProveloQualificationState = proveloQualificationStateRef.current
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const data = await getProveloOverviewData();
    if (!data) return;

    const activeQualificationValues = getActiveProveloQualificationValues(qualifications);
    const selectedShapes = filterProveloGeoJson(data.shapes, activeQualificationValues);
    const selectedBounds = getGeoJsonBounds(selectedShapes);
    if (!selectedBounds) return;

    map.fitBounds(selectedBounds, {
      padding: getFocusPadding(),
      maxZoom: 13.6,
      duration: 700
    });
  };

  const handleToggleProveloQualification = (qualification: ProveloQualificationKey) => {
    const map = mapRef.current;
    const activeQualificationValues = getActiveProveloQualificationValues();
    const isOnlyActiveQualification = proveloQualificationStateRef.current[qualification] && activeQualificationValues.length === 1;
    const nextQualifications: ProveloQualificationState = isOnlyActiveQualification
      ? EMPTY_PROVELO_QUALIFICATIONS
      : {
          rustineDor: qualification === 'rustineDor',
          pneuCreuve: qualification === 'pneuCreuve'
        };
    const hasNextProveloSelection = hasActiveProveloQualifications(nextQualifications);

    setProveloQualificationState(nextQualifications);
    if (hasNextProveloSelection) {
      setShowCorridorMaskOverview(false);
      if (!map) return;
      void ensureProveloOverviewGeoJsonLayers(map, mode, nextQualifications).then(() => {
        if (!mapRef.current) return;
        setProveloOverviewVisibility(mapRef.current, true, mode);
        setCorridorsOverviewVisibility(mapRef.current, false, mode);
        setCorridorMaskOverviewVisibility(mapRef.current, false, mode);
        reorderMapLayers(mapRef.current, mode, scaleRef.current);
      });
      void flyToProveloOverview(nextQualifications);
      return;
    }

    if (map) {
      void ensureProveloOverviewGeoJsonLayers(map, mode, nextQualifications).then(() => {
        if (!mapRef.current) return;
        setProveloOverviewVisibility(mapRef.current, false, mode);
        reorderMapLayers(mapRef.current, mode, scaleRef.current);
      });
    }
  };

  const handleToggleCorridorMaskOverview = () => {
    const nextVisible = !showCorridorMaskOverviewRef.current;
    setShowCorridorMaskOverview(nextVisible);
    if (nextVisible) {
      setProveloQualificationState(EMPTY_PROVELO_QUALIFICATIONS);
    }
  };

  const handleBasemapChange = (nextBasemap: BasemapMode) => {
    if (nextBasemap === basemap) return;
    setBasemap(nextBasemap);
  };

  const handleColorScaleChange = (nextColorScale: AtlasColorScale) => {
    if (nextColorScale === colorScaleRef.current) return;
    onColorScaleChange(nextColorScale);
  };

  // Keyboard shortcuts for labels, perspective, north reset and perimeter.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (isEditable || event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 't') {
        event.preventDefault();
        setShowLabels((previous) => !previous);
      }
      if (key === 'o') {
        event.preventDefault();
        const map = mapRef.current;
        if (!map) return;
        const enablePerspective = map.getPitch() < 10;
        const nextBearing = enablePerspective && Math.abs(map.getBearing()) < 1 ? -18 : map.getBearing();
        map.easeTo({
          pitch: enablePerspective ? 55 : 0,
          bearing: nextBearing,
          duration: 500
        });
      }
      if (key === 'n') {
        event.preventDefault();
        handleResetNorth();
      }
      if (key === 'f' || key === 'p') {
        event.preventDefault();
        setShowPerimeter((previous) => !previous);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Compute active attribute key from UI state
  function activeAttribute(): string {
    const currentSelectedAttribute = selectedAttributeRef.current;
    const currentSelectedClass = selectedClassRef.current;
    const currentMode = modeRef.current;
    const currentModeConfig = MODE_CONFIGS[currentMode];
    const currentClassFieldMap = getClassFieldMap(currentMode);

    if (currentSelectedAttribute) {
      const parts = currentSelectedAttribute.split('.');
      if (parts.length === 2) {
        return parts[1];
      }
      return parts[0];
    }
    if (currentSelectedClass) {
      return currentClassFieldMap[currentSelectedClass] || currentModeConfig.indexField;
    }
    return currentModeConfig.indexField;
  }

  function colorRamp(attr: string, overrideThresholds?: number[], noDataColor?: string) {
    const input = noDataColor
      ? ['to-number', ['get', attr], COLOR_INPUT_FALLBACK]
      : ['coalesce', ['to-number', ['get', attr]], 0];
    const currentColorMode = colorModeRef.current;
    const palette = getColorScale(colorScaleRef.current).palette;

    if (currentColorMode === 'linear') {
      const expr: any[] = ['step', input, palette[0]];
      VALUE_THRESHOLDS.forEach((threshold, index) => {
        expr.push(threshold, palette[index + 1] || palette[palette.length - 1]);
      });
      if (!noDataColor) return expr;
      return [
        'case',
        ['boolean', ['get', SEGMENT_MASK_FIELD], false],
        noDataColor,
        ['all', ['>=', input, 0], ['<=', input, 1]],
        expr,
        noDataColor
      ];
    }

    const expr: any[] = ['step', input, palette[0]];
    const thresholds = getQuantileThresholdsForAttr(attr, overrideThresholds);
    thresholds.forEach((threshold, index) => {
      expr.push(threshold, palette[index + 1] || palette[palette.length - 1]);
    });
    if (!noDataColor) return expr;
    return [
      'case',
      ['boolean', ['get', SEGMENT_MASK_FIELD], false],
      noDataColor,
      ['all', ['>=', input, 0], ['<=', input, 1]],
      expr,
      noDataColor
    ];
  }

  function applyRampToMap(map: any, attr: string, thresholdsOverride?: number[]) {
    if (map.getLayer('segments-layer')) {
      const ramp = colorRamp(
        attr,
        colorModeRef.current === 'quantile'
          ? getQuantileThresholdsForScaleAttr(attr, 'segment', map, thresholdsOverride)
          : undefined,
        SEGMENT_NO_DATA_COLOR
      );
      map.setPaintProperty('segments-layer', 'line-color', ramp as any);
    }
    if (map.getLayer('carreau200-fill')) {
      const ramp = colorRamp(
        attr,
        colorModeRef.current === 'quantile'
          ? getQuantileThresholdsForScaleAttr(attr, 'carreau200', map, thresholdsOverride)
          : undefined
      );
      map.setPaintProperty('carreau200-fill', 'fill-color', ramp as any);
    }
    if (map.getLayer('zones-fill')) {
      const ramp = colorRamp(
        attr,
        colorModeRef.current === 'quantile'
          ? getQuantileThresholdsForScaleAttr(attr, 'zoneTrafic', map, thresholdsOverride)
          : undefined
      );
      map.setPaintProperty('zones-fill', 'fill-color', ramp as any);
    }
  }

  function applyRamp(attr: string, thresholdsOverride?: number[]) {
    if (!mapRef.current) return;
    const map = mapRef.current;
    applyRampToMap(map, attr, thresholdsOverride);
    if (onDebugParamsChange) {
      const thresholds =
        colorModeRef.current === 'linear'
          ? VALUE_THRESHOLDS
          : thresholdsOverride && thresholdsOverride.length
            ? thresholdsOverride
            : getQuantileThresholdsForAttr(attr);
      onDebugParamsChange({ attr, layerId: getLayerIdForScale(getDisplayScale(map)), thresholds });
    }
  }

  function refreshActiveRampForMap(map: any) {
    applyPrecomputedStatsForMap(map);

    const attr = activeAttribute();
    const thresholds = colorModeRef.current === 'quantile' ? getFreshQuantileThresholdsForAttr(attr, map) : undefined;
    applyRamp(attr, thresholds);

    if (showDistributionRef.current && distributionRequestRef.current) {
      distributionRequestRef.current(
        computeDistribution(attr, colorModeRef.current === 'quantile' ? thresholds || VALUE_THRESHOLDS : VALUE_THRESHOLDS)
      );
    }
  }

  const waitForMapIdle = (map: any, timeoutMs = 30000) => new Promise<void>((resolve) => {
    let done = false;
    let attempts = 0;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      map.off('idle', checkReady);
      resolve();
    };
    const checkReady = () => {
      if (done) return;
      attempts += 1;
      if (map.areTilesLoaded() || attempts > 8) {
        finish();
        return;
      }
      map.once('idle', checkReady);
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    map.once('idle', checkReady);
    requestAnimationFrame(checkReady);
  });

  const getExportDataLayerIds = (requestedScale: AtlasScale) => {
    if (requestedScale === 'zoneTrafic') return ['zones-fill'];
    if (requestedScale === 'carreau200') return ['carreau200-fill'];
    return ['segments-layer'];
  };

  const getExportDataSourceIds = (requestedScale: AtlasScale) => {
    if (requestedScale === 'zoneTrafic') return ['zones_trafic'];
    if (requestedScale === 'carreau200') return ['carreau200'];
    return ['segments'];
  };

  const waitForExportDataRender = (
    map: any,
    requestedScale: AtlasScale,
    timeoutMs = 45000
  ) => new Promise<boolean>((resolve) => {
    const layerIds = getExportDataLayerIds(requestedScale).filter((layerId) => map.getLayer(layerId));
    const sourceIds = getExportDataSourceIds(requestedScale).filter((sourceId) => map.getSource(sourceId));

    if (!layerIds.length || !sourceIds.length) {
      resolve(false);
      return;
    }

    let done = false;
    const startedAt = window.performance.now();
    const finish = (ready: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      map.off('idle', checkReady);
      map.off('render', checkReady);
      resolve(ready);
    };
    const sourcesLoaded = () => sourceIds.every((sourceId) => {
      try {
        return map.isSourceLoaded(sourceId);
      } catch {
        return false;
      }
    });
    const hasRenderedFeatures = () => {
      try {
        return map.queryRenderedFeatures(undefined, { layers: layerIds }).length > 0;
      } catch {
        return false;
      }
    };
    const checkReady = () => {
      if (done) return;
      if (sourcesLoaded() && hasRenderedFeatures()) {
        finish(true);
        return;
      }
      if (window.performance.now() - startedAt >= timeoutMs) {
        finish(false);
      }
    };
    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    map.on('idle', checkReady);
    map.on('render', checkReady);
    map.triggerRepaint?.();
    requestAnimationFrame(checkReady);
  });

  const loadCanvasImage = (url: string) => new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });

  const canvasToPngBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });

  const downscaleCanvas = (sourceCanvas: HTMLCanvasElement, scaleFactor: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceCanvas.width * scaleFactor);
    canvas.height = Math.round(sourceCanvas.height * scaleFactor);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const canvasToSizeAwarePngBlob = async (canvas: HTMLCanvasElement) => {
    const originalBlob = await canvasToPngBlob(canvas);
    if (!originalBlob || originalBlob.size <= A3_EXPORT_MAX_BYTES) return { blob: originalBlob, width: canvas.width, height: canvas.height };

    for (const scaleFactor of [0.94, 0.9, 0.86, 0.82, 0.78, 0.76, 0.74]) {
      const resizedCanvas = downscaleCanvas(canvas, scaleFactor);
      if (!resizedCanvas) continue;
      const blob = await canvasToPngBlob(resizedCanvas);
      if (!blob) continue;
      if (blob.size <= A3_EXPORT_MAX_BYTES || scaleFactor === 0.74) {
        return { blob, width: resizedCanvas.width, height: resizedCanvas.height };
      }
    }

    return { blob: originalBlob, width: canvas.width, height: canvas.height };
  };

  const wrapCanvasText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const truncateCanvasText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    if (context.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && context.measureText(`${truncated}...`).width > maxWidth) {
      truncated = truncated.slice(0, -1).trimEnd();
    }
    return `${truncated}...`;
  };

  const getScaleLabel = (nextScale: AtlasScale) => {
    if (nextScale === 'segment') return 'Rue';
    if (nextScale === 'carreau200') return 'Quartier';
    return 'Secteur';
  };

  const getTerritoryLabel = (nextTerritory: AnalysisTerritory) => {
    if (nextTerritory === 'cantonGeneve') return 'Canton de Genève';
    return 'Grand Genève';
  };

  const getBasemapLabel = (nextBasemap: BasemapMode) => {
    if (nextBasemap === 'openFreeMap3d') return '3D bâtiments';
    if (nextBasemap === 'swissLight') return 'Swisstopo';
    if (nextBasemap === 'swissImagery') return 'Satellite';
    if (nextBasemap === 'none') return 'Sans fond';
    return 'Voyager';
  };

  const getExportFilename = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    return `mobilite-active-${mode}-${getScaleLabel(scale).toLowerCase()}-${dateStamp}-a3.png`;
  };

  const isAbortError = (error: unknown) => (
    typeof error === 'object'
    && error !== null
    && 'name' in error
    && (error as { name?: string }).name === 'AbortError'
  );

  const resolveExportSaveChoice = async (filename: string): Promise<ExportSaveChoice> => {
    const showSaveFilePicker = typeof window !== 'undefined'
      ? (window as ExportSavePickerWindow).showSaveFilePicker
      : undefined;
    if (!showSaveFilePicker) return { type: 'download' };

    try {
      const handle = await showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Image PNG',
            accept: { 'image/png': ['.png'] }
          }
        ],
        excludeAcceptAllOption: false
      });
      return { type: 'file', handle };
    } catch (error) {
      if (isAbortError(error)) return { type: 'cancelled' };
      console.warn('Sélecteur de fichier indisponible pour l’export PNG.', error);
      return { type: 'download' };
    }
  };

  const triggerPngDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const savePngBlob = async (blob: Blob, filename: string, saveChoice: ExportSaveChoice) => {
    if (saveChoice.type !== 'file') {
      triggerPngDownload(blob, filename);
      return;
    }

    const writable = await saveChoice.handle.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      await writable.abort?.().catch(() => undefined);
      console.warn('Écriture directe du PNG impossible, repli sur le téléchargement navigateur.', error);
      triggerPngDownload(blob, filename);
    }
  };

  const getExportConsideredDetails = () => {
    if (selectedAttribute) {
      const [className, technicalName] = selectedAttribute.split('.');
      const classDef = modeConfig.classes.find((candidate) => candidate.displayName === className);
      const attributeDef = classDef?.attributes.find((candidate) => candidate.technicalName === technicalName);
      return {
        classes: className || '[À COMPLÉTER]',
        attributes: attributeDef?.name || technicalName || selectedAttribute
      };
    }

    if (selectedClass) {
      const classDef = modeConfig.classes.find((candidate) => candidate.displayName === selectedClass);
      const attributeNames = classDef?.attributes.map((attribute) => attribute.name).join(', ');
      return {
        classes: selectedClass,
        attributes: attributeNames || '[À COMPLÉTER]'
      };
    }

    return {
      classes: modeConfig.classOrder.join(', '),
      attributes: 'Tous les attributs agrégés dans l’indice global'
    };
  };

  const getExportPartners = () => {
    if (mode === 'bikeability') {
      return [
        { name: 'Modus', src: MODUS_LOGO_URL },
        { name: 'GENF', src: GENF_LOGO_URL }
      ];
    }
    return [
      { name: 'GENF', src: GENF_LOGO_URL },
      { name: 'FNS', src: FNS_LOGO_URL }
    ];
  };

  const drawExportImage = (
    context: CanvasRenderingContext2D,
    image: HTMLImageElement | null,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ) => {
    if (!image) return 0;
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    context.drawImage(image, x, y + (maxHeight - height) / 2, width, height);
    return width;
  };

  const getExportCamera = (map: any, mapWidth: number, mapHeight: number): CameraState => {
    const canvas = map.getCanvas();
    const sourceWidth = canvas.clientWidth || canvas.width || mapWidth;
    const sourceHeight = canvas.clientHeight || canvas.height || mapHeight;
    const widthRatio = mapWidth / sourceWidth;
    const heightRatio = mapHeight / sourceHeight;
    const zoomOffset = Math.max(0, Math.log2(Math.min(widthRatio, heightRatio)));
    return {
      center: [map.getCenter().lng, map.getCenter().lat],
      zoom: map.getZoom() + zoomOffset,
      bearing: map.getBearing(),
      pitch: map.getPitch()
    };
  };

  const niceScaleDistance = (targetMeters: number) => {
    if (!Number.isFinite(targetMeters) || targetMeters <= 0) return 1000;
    const magnitude = 10 ** Math.floor(Math.log10(targetMeters));
    const normalized = targetMeters / magnitude;
    const multiplier = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
    return multiplier * magnitude;
  };

  const formatScaleDistance = (meters: number) => {
    if (meters >= 1000) {
      const kilometers = meters / 1000;
      return Number.isInteger(kilometers) ? `${kilometers} km` : `${kilometers.toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const getMetersPerPixel = (camera: CameraState) => {
    const latitude = Math.max(-85, Math.min(85, camera.center[1]));
    return (WEB_MERCATOR_WORLD_METERS * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** camera.zoom);
  };

  const formatExportCoordinate = (value: number) => value.toFixed(5);

  const formatBearing = (value: number) => {
    const normalized = ((value % 360) + 360) % 360;
    return `${normalized.toFixed(0)}°`;
  };

  const drawExportScaleBar = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    camera: CameraState,
    targetWidth = 300
  ) => {
    const metersPerPixel = getMetersPerPixel(camera);
    const distanceMeters = niceScaleDistance(targetWidth * metersPerPixel);
    const barWidth = Math.max(90, Math.min(470, distanceMeters / metersPerPixel));
    const label = formatScaleDistance(distanceMeters);
    const barY = y + 30;

    context.save();
    context.lineCap = 'butt';
    context.lineJoin = 'miter';
    context.font = '500 20px Arial, sans-serif';
    context.strokeStyle = 'rgba(254, 253, 251, 0.92)';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(x, barY - 14);
    context.lineTo(x, barY);
    context.lineTo(x + barWidth, barY);
    context.lineTo(x + barWidth, barY - 14);
    context.stroke();
    context.strokeStyle = 'rgba(24, 24, 22, 0.88)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, barY - 14);
    context.lineTo(x, barY);
    context.lineTo(x + barWidth, barY);
    context.lineTo(x + barWidth, barY - 14);
    context.stroke();
    context.lineWidth = 4;
    context.strokeStyle = 'rgba(254, 253, 251, 0.92)';
    context.strokeText(label, x, y + 12);
    context.fillStyle = 'rgba(24, 24, 22, 0.92)';
    context.fillText(label, x, y + 12);
    context.restore();
  };

  const drawExportNorthIndicator = (
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    bearing: number
  ) => {
    const length = 54;
    const northAngle = ((-90 - bearing) * Math.PI) / 180;
    const startX = centerX - Math.cos(northAngle) * (length * 0.38);
    const startY = centerY - Math.sin(northAngle) * (length * 0.38);
    const endX = centerX + Math.cos(northAngle) * (length * 0.62);
    const endY = centerY + Math.sin(northAngle) * (length * 0.62);
    const labelX = endX + Math.cos(northAngle) * 18;
    const labelY = endY + Math.sin(northAngle) * 18;

    context.save();
    context.lineCap = 'round';
    context.strokeStyle = 'rgba(254, 253, 251, 0.94)';
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.strokeStyle = 'rgba(24, 24, 22, 0.88)';
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.font = '700 18px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 4;
    context.strokeStyle = 'rgba(254, 253, 251, 0.94)';
    context.strokeText('N', labelX, labelY);
    context.fillStyle = 'rgba(24, 24, 22, 0.92)';
    context.fillText('N', labelX, labelY);
    context.restore();
  };

  const interpolateZoomValue = (zoom: number, stops: Array<[number, number]>) => {
    if (zoom <= stops[0][0]) return stops[0][1];
    for (let index = 1; index < stops.length; index += 1) {
      const [stopZoom, stopValue] = stops[index];
      const [previousZoom, previousValue] = stops[index - 1];
      if (zoom <= stopZoom) {
        const ratio = (zoom - previousZoom) / (stopZoom - previousZoom);
        return previousValue + ratio * (stopValue - previousValue);
      }
    }
    return stops[stops.length - 1][1];
  };

  const applyExportScalePaint = (
    exportMap: any,
    sourceZoom: number,
    requestedScale: AtlasScale
  ) => {
    const setVisibility = (layerId: string, visible: boolean) => {
      if (!exportMap.getLayer(layerId)) return;
      exportMap.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    };

    if (requestedScale === 'zoneTrafic') {
      setVisibility('segments-layer', false);
      setVisibility('segments-hit-area', false);
      setVisibility('carreau200-fill', false);
      setVisibility('carreau200-outline', false);
      setVisibility('zones-fill', true);
      setVisibility('zones-outline', true);
      return;
    }

    if (requestedScale === 'carreau200') {
      setVisibility('segments-layer', false);
      setVisibility('segments-hit-area', false);
      setVisibility('carreau200-fill', true);
      setVisibility('carreau200-outline', true);
      setVisibility('zones-fill', false);
      setVisibility('zones-outline', false);
      if (exportMap.getLayer('carreau200-fill')) exportMap.setPaintProperty('carreau200-fill', 'fill-opacity', 0.6);
      if (exportMap.getLayer('carreau200-outline')) exportMap.setPaintProperty('carreau200-outline', 'line-opacity', 0.5);
      return;
    }

    setVisibility('segments-layer', true);
    setVisibility('segments-hit-area', true);
    setVisibility('carreau200-fill', false);
    setVisibility('carreau200-outline', false);
    setVisibility('zones-fill', false);
    setVisibility('zones-outline', false);

    if (exportMap.getLayer('segments-layer')) {
      const dezoomedPrint = sourceZoom <= SEGMENT_DETAIL_ZOOM;
      const opacity = dezoomedPrint ? 1 : interpolateZoomValue(sourceZoom, [[11, 0.92], [15, 0.88]]);
      exportMap.setPaintProperty('segments-layer', 'line-opacity', opacity);
      exportMap.setPaintProperty(
        'segments-layer',
        'line-width',
        dezoomedPrint
          ? ['interpolate', ['linear'], ['zoom'], 6, 2.1, 8, 2.35, 10, 2.7, 11, 2.65, 12, 2.45, 15, 2.2]
          : ['interpolate', ['linear'], ['zoom'], 11, 1.7, 12, 1.85, 15, 2.2]
      );
    }
    if (exportMap.getLayer('carreau200-fill')) {
      exportMap.setPaintProperty('carreau200-fill', 'fill-opacity', 0);
    }
    if (exportMap.getLayer('carreau200-outline')) {
      exportMap.setPaintProperty('carreau200-outline', 'line-opacity', 0);
    }
  };

  const composeA3ExportCanvas = async (
    mapCanvas: HTMLCanvasElement,
    sourceCamera: CameraState,
    exportCamera: CameraState
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = A3_EXPORT_WIDTH;
    canvas.height = A3_EXPORT_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas export indisponible.');

    const pageWidth = A3_EXPORT_WIDTH;
    const pageHeight = A3_EXPORT_HEIGHT;
    const border = A3_EXPORT_BORDER;
    const cartoucheHeight = A3_EXPORT_CARTOUCHE_HEIGHT;
    const mapX = border;
    const mapY = border;
    const mapWidth = pageWidth - border * 2;
    const mapHeight = pageHeight - cartoucheHeight - border * 2;
    const cartoucheY = mapY + mapHeight;
    const cartoucheBottom = pageHeight - border;
    const cartoucheInnerHeight = cartoucheBottom - cartoucheY;
    const now = new Date();
    const exportDate = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long' }).format(now);
    const analysisScaleLabel = getScaleLabel(scale);
    const consideredDetails = getExportConsideredDetails();
    const [logo, ...partnerLogos] = await Promise.all([
      loadCanvasImage(ACTION_SITUEE_LOGO_URL),
      ...getExportPartners().map((partner) => loadCanvasImage(partner.src))
    ]);

    context.fillStyle = '#FEFDFB';
    context.fillRect(0, 0, pageWidth, pageHeight);
    context.drawImage(mapCanvas, mapX, mapY, mapWidth, mapHeight);
    drawExportScaleBar(context, mapX + 54, mapY + mapHeight - 76, exportCamera, 300);
    drawExportNorthIndicator(context, mapX + mapWidth - 118, mapY + 126, sourceCamera.bearing);

    context.fillStyle = '#FEFDFB';
    context.fillRect(border, cartoucheY, pageWidth - border * 2, cartoucheInnerHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.strokeRect(border, cartoucheY, pageWidth - border * 2, cartoucheInnerHeight);

    const padding = 56;
    const logoBox = 154;
    const contentX = border + padding;
    const contentY = cartoucheY + 38;
    const sideWidth = 1080;
    const sideX = pageWidth - border - padding - sideWidth;
    const mainX = contentX + logoBox + 66;
    const mainWidth = sideX - mainX - 92;
    const logoWidth = drawExportImage(context, logo, contentX, contentY + 6, logoBox, 142);
    if (!logoWidth) {
      context.fillStyle = '#1A1A1A';
      context.font = '700 34px Arial, sans-serif';
      context.fillText('action', contentX, contentY + 42);
      context.fillText('située', contentX, contentY + 80);
    }

    const title = `Indice de ${modeConfig.title}`;
    context.fillStyle = '#111111';
    context.font = '700 40px Arial, sans-serif';
    context.fillText(title, mainX, contentY + 32);

    context.font = '400 22px Arial, sans-serif';
    context.fillStyle = '#4A4A4A';
    const detailY = contentY + 82;
    const cartoucheDetailLines = [
      { text: `Indicateur : ${modeConfig.title}`, maxLines: 1 },
      { text: `Échelle d’analyse : ${analysisScaleLabel}`, maxLines: 1 },
      { text: `Classes considérées : ${consideredDetails.classes}`, maxLines: 1 },
      { text: `Attributs considérés : ${consideredDetails.attributes}`, maxLines: 2 },
      { text: `Fond de carte : ${getBasemapLabel(basemap)}`, maxLines: 1 }
    ].flatMap(({ text, maxLines }) => {
      const wrappedLines = wrapCanvasText(context, text, mainWidth);
      const visibleLines = (wrappedLines.length > 0 ? wrappedLines : [text]).slice(0, maxLines);
      if (wrappedLines.length > maxLines && visibleLines.length > 0) {
        visibleLines[visibleLines.length - 1] = truncateCanvasText(context, visibleLines[visibleLines.length - 1], mainWidth);
      }
      return visibleLines;
    });
    cartoucheDetailLines.slice(0, 6).forEach((line, index) => {
      context.fillText(line, mainX, detailY + index * 27);
    });
    context.fillStyle = '#333333';
    context.fillText(`Centre : lat ${formatExportCoordinate(sourceCamera.center[1])}, lon ${formatExportCoordinate(sourceCamera.center[0])} | Orientation : ${formatBearing(sourceCamera.bearing)}`, mainX, contentY + 280);
    context.fillText(`${exportDate} | https://active.situee.ch | contact@situee.ch`, mainX, contentY + 306);

    context.fillStyle = '#111111';
    context.font = '700 26px Arial, sans-serif';
    context.fillText('Partenaires', sideX, contentY + 28);
    let partnerX = sideX;
    partnerLogos.forEach((partnerLogo, index) => {
      const drawnWidth = drawExportImage(context, partnerLogo, partnerX, contentY + 46, index === 0 ? 145 : 130, 54);
      partnerX += Math.max(drawnWidth, 92) + 42;
    });

    context.fillStyle = '#111111';
    context.font = '700 26px Arial, sans-serif';
    context.fillText('Sources et crédits', sideX, contentY + 132);
    context.font = '400 22px Arial, sans-serif';
    context.fillStyle = '#333333';
    [
      'Bureau Action Située',
      '© Données par contributeurs OSM et SITG',
      hasActiveProveloQualifications() ? `Zones PROVELO : ${getActiveProveloQualificationLabels().join(', ')}` : null,
      `Attribution fond : ${basemap === 'none' ? 'aucun fond de carte' : getBasemapLabel(basemap)}`
    ].filter((line): line is string => Boolean(line)).forEach((line, index) => {
      context.fillText(line, sideX, contentY + 166 + index * 29);
    });

    context.strokeStyle = '#000000';
    context.lineWidth = 6;
    context.strokeRect(border / 2, border / 2, pageWidth - border, pageHeight - border);

    return canvas;
  };

  const createExportMap = (container: HTMLDivElement, exportCamera: CameraState) => new maplibregl.Map({
    container,
    style: resolveBasemapStyle(basemap) as any,
    center: exportCamera.center,
    zoom: exportCamera.zoom,
    bearing: exportCamera.bearing,
    pitch: exportCamera.pitch,
    maxPitch: 60,
    interactive: false,
    preserveDrawingBuffer: true,
    pixelRatio: 1,
    transformRequest: (url) => ({ url: rewriteMapboxUrl(url) }),
    attributionControl: false
  });

  async function handleExportA3Png() {
    const map = mapRef.current;
    if (!map || isExporting) return;

    setIsExporting(true);
    const filename = getExportFilename();
    const saveChoice = await resolveExportSaveChoice(filename);
    if (saveChoice.type === 'cancelled') {
      setIsExporting(false);
      return;
    }

    const mapWidth = A3_EXPORT_WIDTH - A3_EXPORT_BORDER * 2;
    const mapHeight = A3_EXPORT_HEIGHT - A3_EXPORT_CARTOUCHE_HEIGHT - A3_EXPORT_BORDER * 2;
    const sourceCamera: CameraState = {
      center: [map.getCenter().lng, map.getCenter().lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch()
    };
    const exportCamera = getExportCamera(map, mapWidth, mapHeight);
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-100000px';
    exportContainer.style.top = '0';
    exportContainer.style.width = `${mapWidth}px`;
    exportContainer.style.height = `${mapHeight}px`;
    exportContainer.style.opacity = '0.01';
    exportContainer.style.pointerEvents = 'none';
    document.body.appendChild(exportContainer);

    let exportMap: any = null;
    try {
      exportMap = createExportMap(exportContainer, exportCamera);
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Chargement de la carte d’export trop long.')), 30000);
        exportMap.once('load', () => {
          window.clearTimeout(timeout);
          resolve();
        });
        exportMap.once('error', (event: any) => {
          if (event?.error?.message) {
            console.warn('Erreur MapLibre pendant l’export.', event.error);
          }
        });
      });

      if (basemap === 'openFreeMap3d') {
        add3dBuildings(exportMap);
      }
      applyMutedBasemapRoadPaint(exportMap, basemap);
      ensureAtlasLayers(exportMap, mode, territory);
      if (mode === 'bikeability' && showCorridorMaskOverviewRef.current) {
        await ensureCorridorOverviewGeoJsonLayers(exportMap, mode);
        setCorridorsOverviewVisibility(exportMap, showCorridorMaskOverviewRef.current, mode);
        setCorridorMaskOverviewVisibility(exportMap, showCorridorMaskOverviewRef.current, mode);
      }
      if (mode === 'bikeability' && hasActiveProveloQualifications()) {
        await ensureProveloOverviewGeoJsonLayers(exportMap, mode);
        setProveloOverviewVisibility(exportMap, true, mode);
      }
      applyRampToMap(
        exportMap,
        activeAttribute(),
        colorModeRef.current === 'quantile' ? getQuantileThresholdsForAttr(activeAttribute()) : undefined
      );
      applyExportScalePaint(exportMap, sourceCamera.zoom, scale);
      reorderMapLayers(exportMap, mode, scale);
      exportMap.resize();
      await waitForMapIdle(exportMap);
      const hasRenderedAtlasData = await waitForExportDataRender(exportMap, scale);
      if (!hasRenderedAtlasData) {
        console.warn('Export PNG sans objet atlas rendu dans le cadrage courant.');
      }
      await waitForMapIdle(exportMap, 8000);

      const exportCanvas = await composeA3ExportCanvas(exportMap.getCanvas(), sourceCamera, exportCamera);
      const { blob } = await canvasToSizeAwarePngBlob(exportCanvas);
      if (!blob) throw new Error('Impossible de générer le PNG.');

      await savePngBlob(blob, filename, saveChoice);
    } catch (error) {
      console.error(error);
      window.alert("L’export PNG n’a pas pu être généré. Le fond de carte ou certaines tuiles peuvent bloquer l’export canvas.");
    } finally {
      exportMap?.remove();
      exportContainer.remove();
      setIsExporting(false);
    }
  }

  function colorForValue(value: number, thresholds?: number[]): string {
    return getPaletteColor(value, thresholds || VALUE_THRESHOLDS, getColorScale(colorScaleRef.current).palette);
  }

  function computeDistribution(attrOverride?: string, thresholdsOverride?: number[]): DistributionData | null {
    if (!mapRef.current || !mapLoaded) return null;
    const map = mapRef.current;
    const attr = attrOverride || activeAttribute();
    const layerId = getLayerIdForScale(getDisplayScale(map));
    if (!map.getLayer(layerId)) return null;

    const features = map.queryRenderedFeatures(undefined, {
      layers: [layerId]
    });

    if (!features || features.length === 0) return null;

    const BIN_COUNT = 20;
    const bins = Array.from({ length: BIN_COUNT }, (_, index) => ({
      min: index / BIN_COUNT,
      max: (index + 1) / BIN_COUNT,
      count: 0,
      color: '#000'
    }));
    let total = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const feature of features) {
      const value = toColorNumeric(attr, feature.properties?.[attr]);
      if (value !== null) {
        total += 1;
        sum += value;
        if (value < min) min = value;
        if (value > max) max = value;
        let index = Math.floor(value * BIN_COUNT);
        if (index < 0) index = 0;
        if (index >= BIN_COUNT) index = BIN_COUNT - 1;
        bins[index].count += 1;
      }
    }
    if (total === 0) return null;

    const thresholds = colorModeRef.current === 'linear' ? VALUE_THRESHOLDS : getQuantileThresholdsForAttr(attr, thresholdsOverride);
    for (let i = 0; i < BIN_COUNT; i += 1) {
      const center = (bins[i].min + bins[i].max) / 2;
      bins[i].color = colorForValue(center, thresholds);
    }

    return {
      bins,
      total,
      min,
      max,
      mean: sum / total,
      thresholds
    };
  }

  // Apply label visibility when the style changes or the user toggles it.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    applyTextLayerVisibility(mapRef.current, showLabels);
  }, [mapLoaded, showLabels]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    hoverSegmentRef.current(null);
  }, [mapLoaded, territory]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    setPerimeterVisibility(mapRef.current, showPerimeter);
    if (showPerimeter) {
      reorderMapLayers(mapRef.current, mode, scale);
    }
  }, [mapLoaded, mode, scale, showPerimeter]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (showCorridorMaskOverview && mode === 'bikeability') {
      void ensureCorridorOverviewGeoJsonLayers(mapRef.current, mode).then(() => {
        setCorridorsOverviewVisibility(mapRef.current, showCorridorMaskOverviewRef.current, mode);
        setCorridorMaskOverviewVisibility(mapRef.current, showCorridorMaskOverviewRef.current, mode);
        reorderMapLayers(mapRef.current, mode, scaleRef.current);
      });
    }
    setCorridorsOverviewVisibility(mapRef.current, showCorridorMaskOverview, mode);
    setCorridorMaskOverviewVisibility(mapRef.current, showCorridorMaskOverview, mode);
    if (showCorridorMaskOverview) {
      reorderMapLayers(mapRef.current, mode, scale);
    }
  }, [mapLoaded, mode, scale, showCorridorMaskOverview, territory]);

  useEffect(() => {
    if (mode !== 'bikeability' && hasActiveProveloQualifications(proveloQualificationState)) {
      setProveloQualificationState(EMPTY_PROVELO_QUALIFICATIONS);
    }
  }, [mode, proveloQualificationState]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const hasProveloSelection = hasActiveProveloQualifications(proveloQualificationState);
    if (hasProveloSelection && mode === 'bikeability') {
      void ensureProveloOverviewGeoJsonLayers(mapRef.current, mode, proveloQualificationState).then(() => {
        setProveloOverviewVisibility(mapRef.current, hasActiveProveloQualifications(proveloQualificationStateRef.current), mode);
        reorderMapLayers(mapRef.current, mode, scaleRef.current);
      });
    }
    setProveloOverviewVisibility(mapRef.current, hasProveloSelection, mode);
    if (hasProveloSelection) {
      reorderMapLayers(mapRef.current, mode, scale);
    }
  }, [mapLoaded, mode, scale, proveloQualificationState, territory]);

  // Update layer visibility based on scale
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    applyScaleVisibility(mapRef.current, scale, mode, territory);
    reorderMapLayers(mapRef.current, mode, scale);
  }, [mapLoaded, scale, mode, territory, attributeStats]);

  useEffect(() => {
    if (scale === 'segment') return;
    displayScaleRef.current = scale;
    hoverSegmentRef.current(null);
  }, [scale]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (!initialAnalyticsDoneRef.current) return;
    if (lastModeRef.current !== mode || lastTerritoryRef.current !== territory) return;

    const map = mapRef.current;
    const sourceIds = getTrackedSourceIds(mode, territory);
    const layerId = getLayerIdForScale(getScaleForZoom(map.getZoom(), scale, mode, territory));
    const scaleLabel = scale === 'segment' ? 'Rue' : scale === 'carreau200' ? 'Quartier' : 'Secteur';
    const areTrackedSourcesLoaded = () => sourceIds.every((sourceId) => {
      if (!map.getSource(sourceId)) return false;
      try {
        return map.isSourceLoaded(sourceId);
      } catch {
        return false;
      }
    });

    syncScaleFromMapZoom(map, scale, mode, territory);
    if (sourceIds.every((sourceId) => map.getSource(sourceId)) && areTrackedSourcesLoaded()) return;

    const requestId = ++loadRequestRef.current;
    clearLoadingArtifacts();
    setLoadingStage('tiles');
    setLoadingDetail(`Chargement ${scaleLabel}`);
    setLoadingProgress(16);
    setIsLoading(true);

    const updateScaleProgress = () => {
      if (loadRequestRef.current !== requestId) return false;
      const loaded = areTrackedSourcesLoaded();
      setLoadingStage('tiles');
      setLoadingDetail(`${scaleLabel} · ${loaded ? 'sources prêtes' : 'réception des tuiles'}`);
      setLoadingProgress((previous) => Math.max(previous, loaded ? 84 : 28));
      return loaded;
    };

    const finishScaleLoading = () => {
      if (loadRequestRef.current !== requestId) return;
      if (!map.getLayer(layerId) || !areTrackedSourcesLoaded() || !map.areTilesLoaded()) return;

      refreshActiveRampForMap(map);
      finishLoading(requestId, `${scaleLabel} prêt`);
    };

    const handleSourceLoading = (event: any) => {
      if (!sourceIds.includes(String(event.sourceId || ''))) return;
      updateScaleProgress();
    };

    const handleSourceData = (event: any) => {
      if (!sourceIds.includes(String(event.sourceId || ''))) return;
      updateScaleProgress();
      finishScaleLoading();
    };

    const handleIdle = () => {
      updateScaleProgress();
      finishScaleLoading();
    };

    map.on('sourcedataloading', handleSourceLoading);
    map.on('sourcedata', handleSourceData);
    map.on('idle', handleIdle);

    loadingCleanupRef.current = () => {
      map.off('sourcedataloading', handleSourceLoading);
      map.off('sourcedata', handleSourceData);
      map.off('idle', handleIdle);
    };

    updateScaleProgress();
    requestAnimationFrame(handleIdle);
  }, [mapLoaded, scale, mode, territory, colorMode, colorScale, quantileMap, thresholdManifest]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const attr = activeAttribute();
    const thresholds = colorModeRef.current === 'quantile' ? getFreshQuantileThresholdsForAttr(attr, map) : undefined;
    applyRamp(attr, thresholds);

    if (!showDistributionRef.current) return;
    const timer = window.setTimeout(() => {
      distributionRequestRef.current?.(
        computeDistribution(attr, colorModeRef.current === 'quantile' ? thresholds || VALUE_THRESHOLDS : VALUE_THRESHOLDS)
      );
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mapLoaded, selectedAttribute, selectedClass, mode, scale, colorMode, colorScale, showDistribution, quantileMap, thresholdManifest]);

  function buildScoresFromProperties(props: Record<string, unknown>): AtlasScores {
    const normalizeValue = (rawValue: unknown, attrName: string): number => {
      const value = toNumeric(rawValue);
      if (value === null) return 0;
      const stats = attributeStats[attrName];
      if (!stats || stats.max <= stats.min) return Math.max(0, Math.min(1, value));
      return Math.max(0, Math.min(1, (value - stats.min) / (stats.max - stats.min)));
    };

    return Object.fromEntries(
      modeConfig.classes.map((classDef) => [
        classDef.displayName,
        {
          color: classDef.color,
          favorable: classDef.favorable,
          description: classDef.description,
          average: normalizeValue(props[classDef.field], classDef.field),
          attributes: classDef.attributes.map((attribute) => ({
            ...attribute,
            value: normalizeValue(props[attribute.technicalName], attribute.technicalName)
          }))
        }
      ])
    );
  }

  // Hover interaction (segments and polygons)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const queueCursorUpdate = (lng: number, lat: number) => {
      cursorPositionRef.current = { lng, lat };
      if (cursorAnimationFrameRef.current !== null) return;
      cursorAnimationFrameRef.current = requestAnimationFrame(() => {
        cursorAnimationFrameRef.current = null;
        setCursorDebug(cursorPositionRef.current);
      });
    };

    const onMove = (event: any) => {
      if (event.lngLat) {
        queueCursorUpdate(event.lngLat.lng, event.lngLat.lat);
      }
      if (mode === 'bikeability' && showCorridorMaskOverviewRef.current && map.getLayer('corridors-overview-hit-area')) {
        const corridorFeatures = map.queryRenderedFeatures(event.point, { layers: ['corridors-overview-hit-area'] });
        if (!corridorFeatures.length) {
          hoverSegmentRef.current(null);
          map.getCanvas().style.cursor = '';
          return;
        }
      }
      if (mode === 'bikeability' && hasActiveProveloQualifications() && map.getLayer('provelo-overview-hit-area')) {
        const proveloFeatures = map.queryRenderedFeatures(event.point, { layers: ['provelo-overview-hit-area'] });
        if (!proveloFeatures.length) {
          hoverSegmentRef.current(null);
          map.getCanvas().style.cursor = '';
          return;
        }
      }
      const displayScale = getScaleForZoom(map.getZoom(), scale);
      const layerId = displayScale === 'segment' ? 'segments-hit-area' : displayScale === 'carreau200' ? 'carreau200-fill' : 'zones-fill';
      if (!map.getLayer(layerId)) {
        hoverSegmentRef.current(null);
        map.getCanvas().style.cursor = '';
        return;
      }
      const features = map.queryRenderedFeatures(event.point, { layers: [layerId] });
      const feature = features[0];
      const normalizedFeature = feature
        ? normalizeFeatureToDomainObject(feature, displayScale === 'segment' ? 'segment' : 'carreau200')
        : null;
      if (normalizedFeature) {
        hoverSegmentRef.current(normalizedFeature);
        map.getCanvas().style.cursor = normalizedFeature.isMasked ? 'not-allowed' : 'pointer';
      } else {
        hoverSegmentRef.current(null);
        map.getCanvas().style.cursor = '';
      }
    };

    const onLeave = () => {
      hoverSegmentRef.current(null);
      map.getCanvas().style.cursor = '';
      cursorPositionRef.current = null;
      if (cursorAnimationFrameRef.current !== null) {
        cancelAnimationFrame(cursorAnimationFrameRef.current);
        cursorAnimationFrameRef.current = null;
      }
      setCursorDebug(null);
    };

    map.on('mousemove', onMove);
    map.getCanvas().addEventListener('mouseleave', onLeave);
    return () => {
      map.off('mousemove', onMove);
      map.getCanvas().removeEventListener('mouseleave', onLeave);
      if (cursorAnimationFrameRef.current !== null) {
        cancelAnimationFrame(cursorAnimationFrameRef.current);
        cursorAnimationFrameRef.current = null;
      }
    };
  }, [mapLoaded, scale, mode, attributeStats]);

  const formatCoordinate = (value: number) => value.toFixed(5);
  const formatAngle = (value: number) => value.toFixed(1);
  const formatZoom = (value: number) => value.toFixed(2);

  return (
    <div className="absolute inset-0">
      {isLoading && (
        <div className="map-loading-indicator absolute left-1/2 z-50 -translate-x-1/2 pointer-events-none">
          <div
            className="map-loading-card rounded-2xl border shadow-lg"
            style={{
              width: 304,
              height: 72,
              padding: '10px 12px',
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.7)',
              borderColor: 'rgba(0, 0, 0, 0.08)'
            }}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#5A5A5A] truncate leading-none">
                  {modeConfig.title}
                </div>
                <div className="text-[10px] text-[#1A1A1A] mt-1 h-[12px] truncate leading-[12px]">
                  {loadingStage === 'initial' && 'Initialisation'}
                  {loadingStage === 'tiles' && 'Chargement des données'}
                  {loadingStage === 'quantiles' && 'Calcul des quantiles'}
                  {loadingStage === 'distribution' && 'Mise à jour des panneaux'}
                  {loadingStage === 'done' && 'Prêt'}
                </div>
                <div className="text-[10px] text-[#6B6B6B] mt-0.5 h-[12px] truncate leading-[12px]">
                  {loadingDetail || '\u00A0'}
                </div>
              </div>
              <div className="shrink-0 text-right" style={{ width: 34, paddingTop: 1 }}>
                <div className="text-[10px] font-medium tabular-nums text-[#4B4B4B] leading-none">
                  {Math.round(loadingProgress)}%
                </div>
              </div>
            </div>
            <div className="mt-2.5 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%`, backgroundColor: theme.accent }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ minHeight: '100vh' }} />

      <div className="map-controls absolute z-10 pointer-events-auto">
        <div className="map-controls-row">
          <button
            onClick={() => handleExportA3Png()}
            style={{
              ...buttonBaseStyle(isExporting),
              opacity: isExporting ? 0.72 : 1,
              cursor: isExporting ? 'wait' : 'pointer'
            }}
            disabled={isExporting}
            title={isExporting ? 'Export A3 en cours' : 'Exporter la carte en PNG A3'}
            aria-label="Exporter la carte en PNG A3"
          >
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleZoomIn} style={buttonBaseStyle()} title="Zoom avant">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut} style={buttonBaseStyle()} title="Zoom arrière">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleResetView} style={buttonBaseStyle()} title="Recentrer">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleTogglePerspective}
            className="map-secondary-control"
            style={buttonBaseStyle(isPerspective)}
            title="Perspective / orientation (O)"
            aria-pressed={isPerspective}
          >
            <Box className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowLabels((previous) => !previous)}
            className="map-secondary-control"
            style={{
              ...buttonBaseStyle(showLabels),
              opacity: labelsAvailable ? 1 : 0.58,
              fontFamily: 'Arial, sans-serif',
              fontSize: 14,
              fontWeight: 700
            }}
            title="Afficher les noms (T)"
            aria-pressed={showLabels}
          >
            T
          </button>
          <button
            onClick={() => setShowPerimeter((previous) => !previous)}
            className="map-secondary-control"
            style={{
              ...buttonBaseStyle(showPerimeter),
              fontFamily: 'Arial, sans-serif',
              fontSize: 14,
              fontWeight: 700
            }}
            title="Afficher / masquer la frontière cantonale (F)"
            aria-pressed={showPerimeter}
          >
            F
          </button>
          {mode === 'bikeability' && (
            <button
              onClick={handleToggleCorridorMaskOverview}
              className="map-secondary-control"
              style={{
                ...buttonBaseStyle(showCorridorMaskOverview),
                fontFamily: 'Arial, sans-serif',
                fontSize: 14,
                fontWeight: 700
              }}
              title="Afficher / masquer le corridor mask d'ensemble (C)"
              aria-pressed={showCorridorMaskOverview}
            >
              C
            </button>
          )}
          {mode === 'bikeability' && (
            <div
              className="map-secondary-control"
              style={proveloPillStyle}
              role="group"
              aria-label="Filtres PROVELO"
            >
              <button
                onClick={() => handleToggleProveloQualification('rustineDor')}
                style={proveloPillButtonStyle('rustineDor')}
                title="Afficher / masquer les Rustines d'or PROVELO"
                aria-label="Afficher / masquer les Rustines d'or PROVELO"
                aria-pressed={proveloQualificationState.rustineDor}
              >
                <Star className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleProveloQualification('pneuCreuve')}
                style={proveloPillButtonStyle('pneuCreuve')}
                title="Afficher / masquer les Pneus crevés PROVELO"
                aria-label="Afficher / masquer les Pneus crevés PROVELO"
                aria-pressed={proveloQualificationState.pneuCreuve}
              >
                <CircleSlash className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            onClick={handleResetNorth}
            className="map-secondary-control"
            style={buttonBaseStyle(!isNorthAligned)}
            title="Remettre le nord en haut (N)"
            aria-pressed={!isNorthAligned}
          >
            <Compass className="w-4 h-4" style={{ transform: `rotate(${-bearing}deg)` }} />
          </button>
          <select
            value={basemap}
            onChange={(event) => handleBasemapChange(event.target.value as BasemapMode)}
            className="map-basemap-select"
            style={basemapSelectStyle}
            title="Fond de carte"
          >
            <option value="voyager">Voyager</option>
            <option value="openFreeMap3d">3D bâtiments</option>
            <option value="swissLight">Swisstopo</option>
            <option value="swissImagery">Satellite</option>
            <option value="none">Sans fond</option>
          </select>
          <div
            className="map-secondary-control map-palette-select-wrap"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '0 0 auto' }}
          >
            <Palette
              className="w-3.5 h-3.5"
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 12,
                color: '#5A5A5A',
                pointerEvents: 'none'
              }}
            />
            <select
              value={colorScale}
              onChange={(event) => handleColorScaleChange(event.target.value as AtlasColorScale)}
              className="map-palette-select"
              style={paletteSelectStyle}
              title="Échelle de couleur"
              aria-label="Échelle de couleur"
            >
              {COLOR_SCALE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div
            ref={scaleHostRef}
            style={{
              minHeight: 40,
              display: 'flex',
              alignItems: 'center'
            }}
          />
        </div>
      </div>

      <div
        className="map-debug absolute z-10 pointer-events-none"
        style={{
          right: 16,
          bottom: 16,
          color: '#7A7A7A',
          fontFamily: 'Arial, sans-serif',
          fontSize: 10,
          lineHeight: 1.2,
          whiteSpace: 'nowrap'
        }}
      >
        z {formatZoom(cameraDebug.zoom)} | cursor {cursorDebug ? `${formatCoordinate(cursorDebug.lng)}, ${formatCoordinate(cursorDebug.lat)}` : '-, -'} | cam {formatCoordinate(cameraDebug.center[0])}, {formatCoordinate(cameraDebug.center[1])} | b {formatAngle(cameraDebug.bearing)} | p {formatAngle(cameraDebug.pitch)}
      </div>
    </div>
  );
}
