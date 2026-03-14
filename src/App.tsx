import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { AttributePanel } from './components/AttributePanel';
import { InfoDialog } from './components/InfoDialog';
import { ModeToggle } from './components/ModeToggle';
import { ScaleToggle } from './components/ScaleToggle';
import { TerritoryToggle } from './components/TerritoryToggle';
import { Info } from 'lucide-react';
import type { DistributionData } from './components/DistributionChart';
import {
  buildEmptyScores,
  MODE_CONFIGS,
  type AnalysisTerritory,
  type AtlasDebugParams,
  type AtlasMode,
  type AtlasScale,
  type AtlasScores
} from './config/modes';

const SITUATED_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/380a38d67ffe6f8270cf52c0d9431d1f05f3b12e/images/Fichier_36-5.svg';

const MODE_HASHES: Record<AtlasMode, string> = {
  walkability: '#marchabilite',
  bikeability: '#cyclabilite'
};
const MODE_PATHS: Record<AtlasMode, string> = {
  walkability: '/marchabilite',
  bikeability: '/cyclabilite'
};
const DEFAULT_SCALE: AtlasScale = 'segment';

const getModeFromHash = (hash: string): AtlasMode | null => {
  const normalizedHash = hash.toLowerCase();
  if (normalizedHash === MODE_HASHES.bikeability) return 'bikeability';
  if (normalizedHash === MODE_HASHES.walkability) return 'walkability';
  return null;
};

const getModeFromPathname = (pathname: string): AtlasMode => {
  const normalizedPath = pathname.toLowerCase();
  if (normalizedPath === MODE_PATHS.bikeability || normalizedPath.startsWith(`${MODE_PATHS.bikeability}/`)) {
    return 'bikeability';
  }
  if (normalizedPath === MODE_PATHS.walkability || normalizedPath.startsWith(`${MODE_PATHS.walkability}/`)) {
    return 'walkability';
  }
  return 'walkability';
};

const getModeFromLocation = (location: Location): AtlasMode => {
  const hashMode = getModeFromHash(location.hash);
  if (hashMode) return hashMode;
  return getModeFromPathname(location.pathname);
};

const buildModeUrl = (mode: AtlasMode, search = window.location.search) => `/${search}${MODE_HASHES[mode]}`;

const calculateGlobalScore = (data: AtlasScores) => {
  const classes = Object.values(data);
  if (classes.length === 0) return 0;

  const total = classes.reduce((sum, classInfo) => sum + classInfo.average, 0);
  return total / classes.length;
};

export default function App() {
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [mode, setMode] = useState<AtlasMode>(() => getModeFromLocation(window.location));
  const [territory, setTerritory] = useState<AnalysisTerritory>('cantonGeneve');
  const [scale, setScale] = useState<AtlasScale>(DEFAULT_SCALE);
  const [attributeData, setAttributeData] = useState<AtlasScores>(() => buildEmptyScores(getModeFromLocation(window.location)));
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showDistribution, setShowDistribution] = useState(false);
  const [distributionData, setDistributionData] = useState<DistributionData | null>(null);
  const [colorMode, setColorMode] = useState<'linear' | 'quantile'>('quantile');
  const [debugParams, setDebugParams] = useState<AtlasDebugParams | null>(null);
  const modeConfig = MODE_CONFIGS[mode];
  const theme = modeConfig.theme;
  const env = import.meta.env as Record<string, string | undefined>;
  const hasSource = ({
    pmtilesEnvKeys,
    tilejsonEnvKeys,
    territoryPmtilesEnvKeys,
    territoryTilejsonEnvKeys,
    defaultPmtiles,
    defaultTilejson,
    defaultPmtilesByTerritory,
    defaultTilejsonByTerritory
  }: (typeof modeConfig.sources)[AtlasScale]) => {
    if (territoryPmtilesEnvKeys?.[territory]?.some((key) => Boolean(env[key]))) return true;
    if (territoryTilejsonEnvKeys?.[territory]?.some((key) => Boolean(env[key]))) return true;
    if (defaultPmtilesByTerritory?.[territory] || defaultTilejsonByTerritory?.[territory]) return true;
    if (pmtilesEnvKeys.some((key) => Boolean(env[key]))) return true;
    if (tilejsonEnvKeys.some((key) => Boolean(env[key]))) return true;
    return Boolean(defaultPmtiles || defaultTilejson);
  };
  const hasCarreau200 = hasSource(modeConfig.sources.carreau200);
  const hasZoneTrafic = hasSource(modeConfig.sources.zoneTrafic);

  const globalScore = calculateGlobalScore(attributeData);

  const toggleClass = (className: string) => {
    const newExpanded = new Set(expandedClasses);
    if (newExpanded.has(className)) {
      newExpanded.delete(className);
    } else {
      newExpanded.add(className);
    }
    setExpandedClasses(newExpanded);
  };

  const handleSelectClass = (className: string) => {
    if (selectedClass === className) {
      setSelectedClass(null);
    } else {
      setSelectedClass(className);
      setSelectedAttribute(null); // Désélectionner l'attribut si une classe est sélectionnée
    }
  };

  const handleSelectAttribute = (className: string, attrName: string) => {
    const key = `${className}.${attrName}`;
    if (selectedAttribute === key) {
      setSelectedAttribute(null);
    } else {
      setSelectedAttribute(key);
      setSelectedClass(null); // Désélectionner la classe si un attribut est sélectionné
    }
  };

  const handleReset = () => {
    setSelectedAttribute(null);
    setSelectedClass(null);
  };

  const syncModeHash = (nextMode: AtlasMode, replace = false) => {
    const nextUrl = buildModeUrl(nextMode);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentUrl === nextUrl) return;

    if (replace) {
      window.history.replaceState({}, '', nextUrl);
    } else {
      window.history.pushState({}, '', nextUrl);
    }
  };

  const handleModeChange = (nextMode: AtlasMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setScale(DEFAULT_SCALE);
    syncModeHash(nextMode);
  };

  const resetScaleToDefault = () => {
    setScale(DEFAULT_SCALE);
  };

  useEffect(() => {
    const syncModeFromUrl = () => {
      const nextMode = getModeFromLocation(window.location);
      setMode(nextMode);
      setScale(DEFAULT_SCALE);
    };

    window.addEventListener('popstate', syncModeFromUrl);
    window.addEventListener('hashchange', syncModeFromUrl);
    return () => {
      window.removeEventListener('popstate', syncModeFromUrl);
      window.removeEventListener('hashchange', syncModeFromUrl);
    };
  }, []);

  useEffect(() => {
    syncModeHash(mode, true);
  }, [mode]);

  useEffect(() => {
    setSelectedAttribute(null);
    setSelectedClass(null);
    setExpandedClasses(new Set());
    setDistributionData(null);
    setDebugParams(null);
    setAttributeData(buildEmptyScores(mode));
  }, [mode]);

  useEffect(() => {
    if (scale === DEFAULT_SCALE && !hasCarreau200) {
      setScale('segment');
    } else if (scale === 'zoneTrafic' && !hasZoneTrafic) {
      setScale('segment');
    }
  }, [scale, hasCarreau200, hasZoneTrafic]);

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: theme.pageBackground }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-auto bg-white/90 backdrop-blur-sm border-b" style={{ borderColor: theme.accentBorder }}>
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="https://situee.ch"
              target="_blank"
              rel="noreferrer"
              aria-label="Située"
              className="shrink-0"
            >
              <img
                src={SITUATED_LOGO_URL}
                alt="Située"
                className="h-10 w-auto object-contain"
              />
            </a>
            <div className="flex flex-col gap-0">
              <h1 className="text-[#1A1A1A] text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
                Marchabilité & Cyclabilité
              </h1>
              <p className="text-[10px]" style={{ color: '#1A1A1A', fontFamily: 'Arial, sans-serif' }}>
                Plateforme de recherche développée sur fonds propres pour accélérer la transition
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <ModeToggle mode={mode} onModeChange={handleModeChange} />
            
            {/* Scale Toggle */}
            <ScaleToggle
              mode={mode}
              scale={scale}
              onScaleChange={setScale}
              availableCarreau200={hasCarreau200}
              availableZoneTrafic={hasZoneTrafic}
            />

            <TerritoryToggle mode={mode} territory={territory} onTerritoryChange={setTerritory} disabled />

            {/* Color Mode Toggle moved to Attribute Panel */}
            
            {/* Global Score */}
            <div
              className="rounded-full px-4 py-2 flex items-center gap-2 border-2 shadow-sm"
              style={{ backgroundColor: theme.accentLight, borderColor: theme.accent }}
            >
              <span className="text-xs font-medium" style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}>Score</span>
              <span className="text-sm text-[#1A1A1A] tabular-nums font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                {globalScore.toFixed(2)}
              </span>
            </div>
            
            <button
              onClick={() => setInfoOpen(true)}
              className="bg-white rounded-full w-8 h-8 flex items-center justify-center transition-colors border"
              style={{ color: theme.accentDark, borderColor: theme.accentBorder }}
              title="Informations"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <Map
        selectedAttribute={selectedAttribute}
        selectedClass={selectedClass}
        mode={mode}
        territory={territory}
        scale={scale}
        colorMode={colorMode}
        onHoverSegment={(segment) => {
          if (segment && segment.scores) {
            setAttributeData(segment.scores);
          } else {
            setAttributeData(buildEmptyScores(mode));
          }
        }}
        onResetScaleToDefault={resetScaleToDefault}
        onDistributionRequest={setDistributionData}
        onDebugParamsChange={setDebugParams}
      />

      {/* Attribute Panel */}
      <AttributePanel
        attributeData={attributeData}
        selectedAttribute={selectedAttribute}
        selectedClass={selectedClass}
        onSelectClass={handleSelectClass}
        onSelectAttribute={handleSelectAttribute}
        expandedClasses={expandedClasses}
        onToggleClass={toggleClass}
        onReset={handleReset}
        showDistribution={showDistribution}
        onToggleDistribution={() => setShowDistribution(!showDistribution)}
        scale={scale}
        mode={mode}
        distributionData={distributionData}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        debugParams={debugParams || undefined}
      />

      {/* Info Dialog */}
      <InfoDialog open={infoOpen} onOpenChange={setInfoOpen} mode={mode} />
    </div>
  );
}
