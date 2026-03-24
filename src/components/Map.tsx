import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getPaletteColor, VALUE_PALETTE, VALUE_THRESHOLDS } from '../colors';
import { Box, Compass, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
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

type BasemapMode = 'voyager' | 'swissLight' | 'swissImagery' | 'none';
type CameraState = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

type SpatialUnit = 'segment' | 'carreau200';

interface HoveredAtlasFeature {
  id: unknown;
  properties: Record<string, unknown>;
  geometry: unknown;
  spatial_unit: SpatialUnit;
  scores: AtlasScores;
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
const DEFAULT_PERIMETER_PMTILES = '/tiles/canton_perimeter.pmtiles';
const DEFAULT_PERIMETER_SOURCE_LAYER = 'canton_perimeter';
const SCALE_BLEND_START = 10.7;
const SCALE_BLEND_END = 11.2;
const LABEL_LAYER_PATTERN = /country|state|province|region|place|settlement|locality|commune|municipality|city|town|village|hamlet|admin|airport|airfield|aerodrome|aeroway/i;
const PLACE_LABEL_LAYER_PATTERN = /country|state|province|region|place|settlement|locality|commune|municipality|city|town|village|hamlet|admin/i;
const WATER_LAYER_PATTERN = /water|lake|ocean|river|canal|stream|reservoir/i;

interface MapProps {
  selectedAttribute: string | null;
  selectedClass: string | null;
  mode: AtlasMode;
  territory: AnalysisTerritory;
  scale: AtlasScale;
  colorMode: 'linear' | 'quantile';
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
  onHoverSegment,
  onResetScaleToDefault,
  onDistributionRequest,
  onDebugParamsChange,
  onStatsUpdate
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const scaleHostRef = useRef<HTMLDivElement>(null);
  const lastModeRef = useRef<AtlasMode>(mode);
  const lastTerritoryRef = useRef<AnalysisTerritory>(territory);
  const scaleRef = useRef<AtlasScale>(scale);
  const hoverSegmentRef = useRef(onHoverSegment);
  const distributionRequestRef = useRef(onDistributionRequest);
  const showLabelsRef = useRef(false);
  const showPerimeterRef = useRef(false);
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

  const modeConfig = MODE_CONFIGS[mode];
  const theme = modeConfig.theme;
  const attrKeys = getAttributeKeys(mode);
  const classFieldMap = getClassFieldMap(mode);
  const env = import.meta.env as Record<string, string | undefined>;
  const mapboxToken = env.VITE_MAPBOX_TOKEN || '';

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [quantileThresholds, setQuantileThresholds] = useState<number[]>([]);
  const [quantileMap, setQuantileMap] = useState<Record<string, number[]>>({});
  const [loadingStage, setLoadingStage] = useState<'initial' | 'tiles' | 'quantiles' | 'distribution' | 'done'>('initial');
  const [loadingDetail, setLoadingDetail] = useState('');
  const [attributeStats, setAttributeStats] = useState<Record<string, DataStats>>({});
  const [basemap, setBasemap] = useState<BasemapMode>('voyager');
  const [showLabels, setShowLabels] = useState(false);
  const [showPerimeter, setShowPerimeter] = useState(true);
  const [bearing, setBearing] = useState(DEFAULT_BEARING);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [labelsAvailable, setLabelsAvailable] = useState(true);
  const [cameraDebug, setCameraDebug] = useState<CameraState>(cameraStateRef.current);
  const [cursorDebug, setCursorDebug] = useState<{ lng: number; lat: number } | null>(null);

  scaleRef.current = scale;
  hoverSegmentRef.current = onHoverSegment;
  distributionRequestRef.current = onDistributionRequest;
  showLabelsRef.current = showLabels;
  showPerimeterRef.current = showPerimeter;

  const normalizePmtilesUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('pmtiles://')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return `pmtiles://${url}`;
    if (url.startsWith('/')) return `pmtiles://${url}`;
    return `pmtiles:///${url}`;
  };

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
      url: tilejsonUrl || normalizePmtilesUrl(pmtilesUrl),
      sourceLayer: resolveEnvValue(sourceConfig.sourceLayerEnvKeys) || sourceConfig.defaultSourceLayer
    };
  };

  const resolvePerimeterSource = () => {
    const tilejsonUrl = env.VITE_TILEJSON_PERIMETER || '';
    const pmtilesUrl = env.VITE_PM_TILES_PERIMETER || DEFAULT_PERIMETER_PMTILES;

    return {
      url: tilejsonUrl || normalizePmtilesUrl(pmtilesUrl),
      sourceLayer: env.VITE_PERIMETER_SOURCE_LAYER || DEFAULT_PERIMETER_SOURCE_LAYER
    };
  };

  const toNumeric = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
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
    return zoom <= SCALE_BLEND_START ? 'carreau200' : 'segment';
  };

  const buildSegmentScaleFadeExpression = () => [
    'case',
    ['<=', ['zoom'], SCALE_BLEND_START],
    0,
    ['>=', ['zoom'], SCALE_BLEND_END],
    1,
    ['interpolate', ['linear'], ['zoom'], SCALE_BLEND_START, 0, SCALE_BLEND_END, 1]
  ];

  const buildCarreauScaleFadeExpression = () => [
    'case',
    ['<=', ['zoom'], SCALE_BLEND_START],
    1,
    ['>=', ['zoom'], SCALE_BLEND_END],
    0,
    ['interpolate', ['linear'], ['zoom'], SCALE_BLEND_START, 1, SCALE_BLEND_END, 0]
  ];

  const buildSegmentBaseOpacityExpression = () => ['interpolate', ['linear'], ['zoom'], 6, 0.98, 8, 0.95, 11, 0.92, 15, 0.88];

  const normalizeFeatureToDomainObject = (
    feature: any,
    spatialUnit: SpatialUnit
  ): HoveredAtlasFeature | null => {
    if (!feature?.properties) return null;

    const properties = feature.properties as Record<string, unknown>;
    return {
      id: feature.id,
      properties,
      geometry: feature.geometry,
      spatial_unit: spatialUnit,
      scores: buildScoresFromProperties(properties)
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

    const hybridSegmentScale = nextScale === 'segment' && hasCarreau200Source(currentMode, currentTerritory) && map.getLayer('carreau200-fill');
    const currentZoom = map.getZoom();
    const showHybridCarreau = Boolean(hybridSegmentScale) && currentZoom <= SCALE_BLEND_END;

    setVisibility('segments-layer', nextScale === 'segment');
    setVisibility('segments-hit-area', nextScale === 'segment');
    setVisibility('carreau200-fill', showHybridCarreau || nextScale === 'carreau200');
    setVisibility('carreau200-outline', showHybridCarreau || nextScale === 'carreau200');
    setVisibility('zones-fill', nextScale === 'zoneTrafic');
    setVisibility('zones-outline', nextScale === 'zoneTrafic');

    if (map.getLayer('segments-layer')) {
      map.setPaintProperty(
        'segments-layer',
        'line-opacity',
        hybridSegmentScale
          ? ['*', buildSegmentBaseOpacityExpression(), buildSegmentScaleFadeExpression()]
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
          ? ['*', 0.6, buildCarreauScaleFadeExpression()]
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
          ? ['*', 0.5, buildCarreauScaleFadeExpression()]
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

  const getAnalyticsLayerId = (map: any = mapRef.current) => {
    return getLayerIdForScale(currentScale());
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
      'perimeter-outline',
      'perimeter-casing',
      'segments-hit-area',
      'segments-layer',
      'carreau200-outline',
      'carreau200-fill',
      'zones-outline',
      'zones-fill'
    ];
    const sourceIds = ['perimeter', 'segments', 'carreau200', 'zones_trafic'];

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
            'fill-opacity': 0.6,
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
            'line-opacity': 0.5
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
            'line-opacity': buildSegmentBaseOpacityExpression()
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
    moveWaterLayersAboveAtlas(map);
    for (const layerId of ['perimeter-casing', 'perimeter-outline']) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
    moveLabelLayersToTop(map);
    applyTextLayerVisibility(map, showLabelsRef.current);
    applyScaleVisibility(map, currentScale(), currentMode, currentTerritory);
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
      setQuantileThresholds([]);
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

      const attr = activeAttribute();
      const analyticsLayerId = getAnalyticsLayerId(map);
      const features = map.queryRenderedFeatures(undefined, { layers: [analyticsLayerId] });
      const valuesByAttr: Record<string, number[]> = {};

      for (const feature of features) {
        const props = feature.properties || {};
        for (const [key, value] of Object.entries(props)) {
          const numericValue = toNumeric(value);
          if (attrKeys.has(key) && numericValue !== null && numericValue >= 0 && numericValue <= 1) {
            if (!valuesByAttr[key]) valuesByAttr[key] = [];
            valuesByAttr[key].push(numericValue);
          }
        }
      }

      setLoadingStage('quantiles');
      setLoadingDetail('Calcul des quantiles');
      setLoadingProgress((previous) => Math.max(previous, 82));

      const paletteSteps = VALUE_PALETTE.length - 1;
      const nextQuantileMap: Record<string, number[]> = {};
      for (const [key, values] of Object.entries(valuesByAttr)) {
        if (values.length < 10) continue;
        const sorted = [...values].sort((a, b) => a - b);
        const thresholds: number[] = [];
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
        nextQuantileMap[key] = thresholds;
      }

      setQuantileMap(nextQuantileMap);
      const activeThresholds = nextQuantileMap[attr] || VALUE_THRESHOLDS;
      setQuantileThresholds(activeThresholds);

      const stats: Record<string, DataStats> = {};
      for (const [key, values] of Object.entries(valuesByAttr)) {
        stats[key] = computeStats(values as number[]);
      }
      setAttributeStats(stats);
      onStatsUpdate?.(stats);

      applyRamp(attr, colorMode === 'quantile' ? activeThresholds : undefined);

      setLoadingStage('distribution');
      setLoadingDetail('Mise à jour des panneaux');
      setLoadingProgress((previous) => Math.max(previous, 94));

      if (distributionRequestRef.current) {
        distributionRequestRef.current(
          computeDistribution(attr, colorMode === 'quantile' ? activeThresholds : VALUE_THRESHOLDS)
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

      const attr = activeAttribute();
      const thresholds = colorMode === 'quantile' ? quantileMap[attr] || VALUE_THRESHOLDS : undefined;
      applyRamp(attr, thresholds);
      syncScaleFromMapZoom(map, currentScale(), currentMode, currentTerritory);

      if (recomputeAnalytics) {
        runAnalytics();
      } else {
        if (distributionRequestRef.current) {
          distributionRequestRef.current(
            computeDistribution(attr, colorMode === 'quantile' ? quantileMap[attr] || VALUE_THRESHOLDS : VALUE_THRESHOLDS)
          );
        }
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

  const basemapSelectStyle: CSSProperties = {
    height: 40,
    borderRadius: 14,
    border: '1px solid #D8D2CA',
    background: 'rgba(255, 255, 255, 0.94)',
    color: '#5A5A5A',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    padding: '0 12px',
    fontFamily: 'Arial, sans-serif',
    fontSize: 11,
    fontWeight: 600,
    width: 118
  };

  const normalizedBearing = ((bearing % 360) + 360) % 360;
  const isNorthAligned = Math.min(normalizedBearing, 360 - normalizedBearing) < 1;
  const isPerspective = pitch > 10;

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
    };

    const handleResize = () => {
      applyAnalysisConstraints(map);
    };

    const handleZoomScaleSync = () => {
      syncScaleFromMapZoom(map);
    };

    map.on('rotate', updateOrientation);
    map.on('pitch', updateOrientation);
    map.on('move', queueCameraSync);
    map.on('moveend', persistCamera);
    map.on('zoom', handleZoomScaleSync);
    map.on('zoomend', handleZoomScaleSync);
    map.on('resize', handleResize);
    queueCameraSync();

    map.once('load', () => {
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

  const handleBasemapChange = (nextBasemap: BasemapMode) => {
    if (nextBasemap === basemap) return;
    setBasemap(nextBasemap);
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
    if (selectedAttribute) {
      const parts = selectedAttribute.split('.');
      if (parts.length === 2) {
        return parts[1];
      }
      return parts[0];
    }
    if (selectedClass) {
      return classFieldMap[selectedClass] || modeConfig.indexField;
    }
    return modeConfig.indexField;
  }

  function colorRamp(attr: string, overrideThresholds?: number[]) {
    const input = ['coalesce', ['to-number', ['get', attr]], 0];

    if (colorMode === 'linear') {
      const expr: any[] = ['step', input, VALUE_PALETTE[0]];
      VALUE_THRESHOLDS.forEach((threshold, index) => {
        expr.push(threshold, VALUE_PALETTE[index + 1]);
      });
      return expr;
    }

    const expr: any[] = ['step', input, VALUE_PALETTE[0]];
    const thresholds = overrideThresholds && overrideThresholds.length > 0 ? overrideThresholds : quantileThresholds;
    thresholds.forEach((threshold, index) => {
      expr.push(threshold, VALUE_PALETTE[index + 1]);
    });
    return expr;
  }

  function applyRamp(attr: string, thresholdsOverride?: number[]) {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const ramp = colorRamp(attr, thresholdsOverride);
    if (map.getLayer('segments-layer')) {
      map.setPaintProperty('segments-layer', 'line-color', ramp as any);
    }
    if (map.getLayer('carreau200-fill')) {
      map.setPaintProperty('carreau200-fill', 'fill-color', ramp as any);
    }
    if (map.getLayer('zones-fill')) {
      map.setPaintProperty('zones-fill', 'fill-color', ramp as any);
    }
    if (onDebugParamsChange) {
      const thresholds = colorMode === 'linear' ? VALUE_THRESHOLDS : thresholdsOverride && thresholdsOverride.length ? thresholdsOverride : quantileThresholds;
      onDebugParamsChange({ attr, layerId: getLayerIdForScale(scaleRef.current), thresholds });
    }
  }

  function colorForValue(value: number, thresholds?: number[]): string {
    return getPaletteColor(value, thresholds || VALUE_THRESHOLDS);
  }

  function computeDistribution(attrOverride?: string, thresholdsOverride?: number[]): DistributionData | null {
    if (!mapRef.current || !mapLoaded) return null;
    const map = mapRef.current;
    const attr = attrOverride || activeAttribute();
    const layerId = getLayerIdForScale(scaleRef.current);
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
      const value = toNumeric(feature.properties?.[attr]);
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

    const thresholds = colorMode === 'linear' ? VALUE_THRESHOLDS : thresholdsOverride || quantileThresholds;
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
      for (const layerId of ['perimeter-casing', 'perimeter-outline']) {
        if (mapRef.current.getLayer(layerId)) {
          mapRef.current.moveLayer(layerId);
        }
      }
      moveLabelLayersToTop(mapRef.current);
    }
  }, [mapLoaded, showPerimeter]);

  // Update layer visibility based on scale
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    applyScaleVisibility(mapRef.current, scale);
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

      const attr = activeAttribute();
      const thresholds = colorMode === 'quantile' ? quantileMap[attr] || VALUE_THRESHOLDS : undefined;
      applyRamp(attr, thresholds);
      distributionRequestRef.current?.(
        computeDistribution(attr, colorMode === 'quantile' ? quantileMap[attr] || VALUE_THRESHOLDS : VALUE_THRESHOLDS)
      );
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
  }, [mapLoaded, scale, mode, territory, colorMode, quantileMap]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const attr = activeAttribute();
    if (colorMode === 'quantile') {
      const thresholds = quantileMap[attr];
      if (thresholds && thresholds.length) {
        setQuantileThresholds(thresholds);
        applyRamp(attr, thresholds);
      } else {
        applyRamp(attr);
      }
    } else {
      applyRamp(attr);
    }
    if (distributionRequestRef.current) {
      const timer = setTimeout(() => {
        distributionRequestRef.current?.(computeDistribution(attr));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, selectedAttribute, selectedClass, mode, scale, colorMode]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const attr = activeAttribute();
    const activeThresholds = quantileMap[attr] || VALUE_THRESHOLDS;
    setQuantileThresholds(activeThresholds);
    applyRamp(attr, colorMode === 'quantile' ? activeThresholds : undefined);

    const recomputeDistribution = () => {
      if (distributionRequestRef.current) {
        const distribution = computeDistribution(attr, colorMode === 'quantile' ? activeThresholds : VALUE_THRESHOLDS);
        distributionRequestRef.current(distribution);
      }
    };
    map.once('idle', recomputeDistribution);
    return () => {
      map.off('idle', recomputeDistribution as any);
    };
  }, [mapLoaded, scale, colorMode, selectedAttribute, selectedClass, mode, quantileMap]);

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
        map.getCanvas().style.cursor = 'pointer';
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
        <div className="absolute left-1/2 z-50 -translate-x-1/2 pointer-events-none" style={{ top: 86 }}>
          <div
            className="rounded-2xl border shadow-lg"
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

      <div className="absolute z-10 pointer-events-auto" style={{ left: 16, bottom: 52 }}>
        <div style={{ display: 'flex', gap: 8 }}>
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
            style={buttonBaseStyle(isPerspective)}
            title="Perspective / orientation (O)"
            aria-pressed={isPerspective}
          >
            <Box className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowLabels((previous) => !previous)}
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
          <button
            onClick={handleResetNorth}
            style={buttonBaseStyle(!isNorthAligned)}
            title="Remettre le nord en haut (N)"
            aria-pressed={!isNorthAligned}
          >
            <Compass className="w-4 h-4" style={{ transform: `rotate(${-bearing}deg)` }} />
          </button>
          <select
            value={basemap}
            onChange={(event) => handleBasemapChange(event.target.value as BasemapMode)}
            style={basemapSelectStyle}
            title="Fond de carte"
          >
            <option value="voyager">Voyager</option>
            <option value="swissLight">Swiss Light</option>
            <option value="swissImagery">Swiss Imagerie</option>
            <option value="none">Sans fond</option>
          </select>
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
        className="absolute z-10 pointer-events-none"
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
