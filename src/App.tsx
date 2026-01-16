import { useEffect, useState } from 'react';
import { Map } from './components/Map';
import { AttributePanel } from './components/AttributePanel';
import { InfoDialog } from './components/InfoDialog';
import { ModeToggle } from './components/ModeToggle';
import { ScaleToggle } from './components/ScaleToggle';
import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './components/ui/tooltip';
import type { DistributionData } from './components/DistributionChart';

// Default empty/neutral scores for when no segment is hovered
const getDefaultScores = () => ({
  Commodité: {
    color: '#6B7C59',
    favorable: true,
    description: 'Est-ce commode de marcher ici ?',
    average: 0,
    attributes: [
      { name: 'Niveau sonore', technicalName: 'bruit', value: 0 },
      { name: 'Température', technicalName: 'temperature', value: 0 },
      { name: 'Conflits d\'usage', technicalName: 'conflit_usage', value: 0 },
  { name: 'Couverture végétale', technicalName: 'canopee', value: 0 }
    ]
  },
  Attractivité: {
    color: '#4A5F7F',
    favorable: true,
    description: 'Y a-t-il des raisons de venir ici ?',
    average: 0,
    attributes: [
      { name: 'Plans d\'eau', technicalName: 'lac_cours_deau', value: 0 },
      { name: 'Fontaines', technicalName: 'fontaines', value: 0 },
      { name: 'Espaces ouverts', technicalName: 'espaces_ouverts', value: 0 },
      { name: 'Commerces actifs', technicalName: 'rez_actif', value: 0 },
      { name: 'Transports publics', technicalName: 'tp', value: 0 },
      { name: 'Aménités', technicalName: 'amenite', value: 0 }
    ]
  },
  Sécurité: {
    color: '#A55A4A',
    favorable: false,
    description: 'Puis-je marcher ici en sécurité ?',
    average: 0,
    attributes: [
      { name: 'Historique accidents', technicalName: 'accident', value: 0 },
      { name: 'Zone apaisée', technicalName: 'zone_apaisee', value: 0 },
      { name: 'Zone piétonne', technicalName: 'zone_pietonne', value: 0 },
      { name: 'Limite de vitesse', technicalName: 'vitesse', value: 0 }
    ]
  },
  Infrastructure: {
    color: '#7A6B5D',
    favorable: true,
    description: 'Est-ce possible de marcher ici ?',
    average: 0,
    attributes: [
      { name: 'Connectivité réseau', technicalName: 'connectivite', value: 0 },
      { name: 'Largeur trottoir', technicalName: 'largeur_trottoir', value: 0 },
      { name: 'Revêtement', technicalName: 'chemin', value: 0 },
      { name: 'Stationnement gênant', technicalName: 'stationnement_genant', value: 0 },
      { name: 'Pente', technicalName: 'topographie', value: 0 }
    ]
  }
});

export default function App() {
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [mode, setMode] = useState<'walkability' | 'bikeability'>('walkability');
  const [scale, setScale] = useState<'segment' | 'carreau200' | 'zoneTrafic'>('segment');
  const [hoveredSegment, setHoveredSegment] = useState<any>(null);
  const [attributeData, setAttributeData] = useState(getDefaultScores());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showDistribution, setShowDistribution] = useState(false);
  const [distributionData, setDistributionData] = useState<DistributionData | null>(null);
  const [colorMode, setColorMode] = useState<'linear' | 'quantile'>('quantile');
  const [debugParams, setDebugParams] = useState<{ attr: string; layerId: string; thresholds: number[] } | null>(null);
  const [attributeStats, setAttributeStats] = useState<Record<string, any>>({});
  const hasCarreau200 = Boolean(import.meta.env.VITE_PM_TILES_CARREAU200 || import.meta.env.VITE_TILEJSON_CARREAU200);
  const hasZoneTrafic = Boolean(import.meta.env.VITE_PM_TILES_ZONETRAFIC || import.meta.env.VITE_TILEJSON_ZONETRAFIC);

  // Calculer le score global
  const calculateGlobalScore = (data: any) => {
    let totalScore = 0;
    let totalAttributes = 0;
    
    Object.entries(data).forEach(([className, classInfo]: [string, any]) => {
      classInfo.attributes.forEach((attr: any) => {
        totalScore += attr.value;
        totalAttributes++;
      });
    });
    
    return totalAttributes > 0 ? totalScore / totalAttributes : 0;
  };

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

  useEffect(() => {
    if (scale === 'carreau200' && !hasCarreau200) {
      setScale('segment');
    } else if (scale === 'zoneTrafic' && !hasZoneTrafic) {
      setScale('segment');
    }
  }, [scale, hasCarreau200, hasZoneTrafic]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#EAE4DD]">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-auto bg-white/90 backdrop-blur-sm border-b border-[#D8D2CA]">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[#1A1A1A] text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
              Atlas Action Située
            </h1>
            <p className="text-[#5A5A5A] text-[10px]" style={{ fontFamily: 'Arial, sans-serif' }}>
              Plateforme de recherche développée sur fonds propres pour accélérer la transition
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <ModeToggle mode={mode} onModeChange={setMode} />
            
            {/* Scale Toggle */}
            <ScaleToggle
              scale={scale}
              onScaleChange={setScale}
              availableCarreau200={hasCarreau200}
              availableZoneTrafic={hasZoneTrafic}
            />

            {/* Color Mode Toggle moved to Attribute Panel */}
            
            {/* Global Score */}
            <div className="bg-[#FDECEA] rounded-full px-4 py-2 flex items-center gap-2 border-2 border-[#D35941] shadow-sm">
              <span className="text-[#8A2E23] text-xs font-medium" style={{ fontFamily: 'Arial, sans-serif' }}>Score</span>
              <span className="text-sm text-[#1A1A1A] tabular-nums font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                {globalScore.toFixed(2)}
              </span>
            </div>
            
            <button
              onClick={() => setInfoOpen(true)}
              className="bg-white rounded-full w-8 h-8 flex items-center justify-center text-[#5A5A5A] hover:text-[#1A1A1A] transition-colors border border-[#D8D2CA]"
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
        attributeData={attributeData}
        mode={mode}
        scale={scale}
        colorMode={colorMode}
        onHoverSegment={(segment) => {
          setHoveredSegment(segment);
          if (segment && segment.scores) {
            setAttributeData(segment.scores);
          } else {
            setAttributeData(getDefaultScores());
          }
        }}
        onDistributionRequest={setDistributionData}
        onDebugParamsChange={setDebugParams}
        onStatsUpdate={setAttributeStats}
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
      <InfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
}
