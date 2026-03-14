import { motion, AnimatePresence } from 'motion/react';
import { getPaletteColor, VALUE_PALETTE, VALUE_THRESHOLDS } from '../colors';
import { ChevronRight } from 'lucide-react';
import { SpiderChart } from './SpiderChart';
import { useState } from 'react';
import { DistributionChart, type DistributionData } from './DistributionChart';
import {
  MODE_CONFIGS,
  type AtlasClassScore,
  type AtlasDebugParams,
  type AtlasMode,
  type AtlasScale,
  type AtlasScores
} from '../config/modes';

interface AttributePanelProps {
  attributeData: AtlasScores;
  selectedAttribute: string | null;
  selectedClass: string | null;
  onSelectClass: (className: string) => void;
  onSelectAttribute: (className: string, attrName: string) => void;
  expandedClasses: Set<string>;
  onToggleClass: (className: string) => void;
  onReset: () => void;
  showDistribution: boolean;
  onToggleDistribution: () => void;
  scale: AtlasScale;
  distributionData: DistributionData | null;
  colorMode: 'linear' | 'quantile';
  mode: AtlasMode;
  debugParams?: AtlasDebugParams;
  onColorModeChange?: (mode: 'linear' | 'quantile') => void;
}

export function AttributePanel({ 
  attributeData, 
  selectedAttribute,
  selectedClass,
  onSelectClass,
  onSelectAttribute,
  expandedClasses,
  onToggleClass,
  onReset,
  showDistribution,
  onToggleDistribution,
  scale,
  distributionData,
  colorMode,
  mode,
  debugParams,
  onColorModeChange
}: AttributePanelProps) {
  const hasSelection = selectedAttribute || selectedClass;
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);
  const modeConfig = MODE_CONFIGS[mode];
  const theme = modeConfig.theme;
  const orderedClasses = modeConfig.classOrder
    .map((className) => {
      const classInfo = attributeData[className];
      return classInfo ? ([className, classInfo] as const) : null;
    })
    .filter((entry): entry is readonly [string, AtlasClassScore] => entry !== null);
  
  return (
    <div className="absolute right-0 top-0 bottom-0 z-20 w-[300px] pointer-events-none">
      <div className="h-full flex flex-col p-4 pt-20 pointer-events-auto">
        <div
          className="backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg max-h-full flex flex-col"
          style={{ backgroundColor: `${theme.panelBackground}F2`, border: `1px solid ${theme.accentBorder}` }}
        >
          
          {/* Spider Chart */}
          <div className="p-4 backdrop-blur-sm" style={{ borderBottom: `1px solid ${theme.accentBorder}`, backgroundColor: theme.panelBackground }}>
            <div className="text-[10px] mb-3 uppercase tracking-wider font-medium" style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}>
              Vue d'ensemble
            </div>
            <SpiderChart attributeData={attributeData} mode={mode} classOrder={modeConfig.classOrder} />
          </div>

          {/* Classes - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}>
                Classes
              </div>
              {hasSelection && (
                <button
                  onClick={onReset}
                  className="text-[10px] uppercase tracking-wider transition-colors font-medium"
                  style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}
                >
                  Clear
                </button>
              )}
            </div>
            
            {orderedClasses.map(([className, classInfo]) => {
              const isClassSelected = selectedClass === className;
              const isOtherSelected = hasSelection && !isClassSelected && !selectedAttribute?.startsWith(className + '.');
              
              return (
                <div 
                  key={className} 
                  className={`rounded-xl overflow-hidden transition-opacity ${
                    isOtherSelected ? 'opacity-30' : 'opacity-100'
                  }`}
                  style={{ backgroundColor: theme.panelMutedBackground }}
                  onMouseEnter={() => setHoveredClass(className)}
                  onMouseLeave={() => setHoveredClass(null)}
                >
                  <div className="flex items-stretch">
                    <button
                      onClick={() => onSelectClass(className)}
                      className={`flex-shrink-0 w-10 flex items-center justify-center transition-all ${
                        isClassSelected
                          ? ''
                          : 'bg-transparent'
                      }`}
                      style={isClassSelected ? { backgroundColor: theme.accent } : hoveredClass === className ? { backgroundColor: theme.accentLight } : undefined}
                      title="Visualiser cette classe"
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: isClassSelected ? theme.accentContrast : classInfo.color }} 
                      />
                    </button>
                    <button
                      onClick={() => onToggleClass(className)}
                      className="flex-1 flex flex-col items-start p-2.5 transition-all"
                      style={hoveredClass === className ? { backgroundColor: theme.panelBackground } : undefined}
                    >
                      <div className="w-full flex items-center justify-between mb-0.5">
                        <span className="text-xs text-[#1A1A1A]" style={{ fontFamily: 'Arial, sans-serif' }}>
                          {className}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#5A5A5A] tabular-nums" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {classInfo.average.toFixed(2)}
                          </span>
                          <motion.div
                            animate={{ rotate: expandedClasses.has(className) ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="w-3 h-3 text-[#AFAFAF]" />
                          </motion.div>
                        </div>
                      </div>
                      <AnimatePresence>
                        {hoveredClass === className && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className="text-[9px] text-[#AFAFAF] leading-relaxed overflow-hidden text-left"
                            style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}
                          >
                            {classInfo.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>

                  {/* Attributs de la classe */}
                  <AnimatePresence>
                    {expandedClasses.has(className) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 space-y-1.5" style={{ backgroundColor: theme.panelBackground }}>
                          {classInfo.attributes.map((attr, index: number) => {
                            const attrKey = `${className}.${attr.technicalName}`;
                            const isAttrSelected = selectedAttribute === attrKey;
                            const isOtherAttrSelected = hasSelection && !isAttrSelected;
                            
                            return (
                              <div 
                                key={index} 
                                className={`flex items-center gap-2 bg-white rounded-lg p-2 transition-opacity ${
                                  isOtherAttrSelected ? 'opacity-30' : 'opacity-100'
                                }`}
                              >
                                <button
                                  onClick={() => onSelectAttribute(className, attr.technicalName)}
                                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                    isAttrSelected
                                      ? ''
                                      : ''
                                  }`}
                                  style={{ backgroundColor: isAttrSelected ? theme.accent : theme.accentLight }}
                                  title="Visualiser cet attribut"
                                >
                                  <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: isAttrSelected ? theme.accentContrast : classInfo.color }}
                                  />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-[10px] text-[#1A1A1A]" style={{ fontFamily: 'Arial, sans-serif' }}>
                                      {attr.name}
                                    </span>
                                    <span className="text-[9px] text-[#AFAFAF]" style={{ fontFamily: 'Arial, sans-serif' }}>
                                      ({attr.technicalName})
                                    </span>
                                  </div>
                                  <div className="relative h-1.5 bg-[#E0DDD8] rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${attr.value * 100}%` }}
                                      transition={{ duration: 0.4, delay: index * 0.03 }}
                                      className="absolute inset-y-0 left-0 rounded-full"
                                      style={{ backgroundColor: getPaletteColor(attr.value) }}
                                    />
                                  </div>
                                </div>
                                <div className="text-[10px] text-[#5A5A5A] w-8 text-right tabular-nums" style={{ fontFamily: 'Arial, sans-serif' }}>
                                  {attr.value.toFixed(2)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Légende */}
          <div className="backdrop-blur-sm" style={{ borderTop: `1px solid ${theme.accentBorder}`, backgroundColor: theme.panelBackground }}>
            <div className="p-4">
              <div
                onClick={onToggleDistribution}
                className="w-full mb-4 cursor-pointer select-none"
              >
                <div className="text-[10px] uppercase tracking-wider flex items-center justify-between" style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Légende</span>
                    <span className="text-[8px] text-[#7A7A7A] normal-case font-normal">({colorMode === 'quantile' ? 'quantiles' : 'linéaire'})</span>
                  </div>
                  <ChevronRight className={`w-3 h-3 transition-transform ${showDistribution ? 'rotate-90' : ''}`} style={{ color: theme.accent }} />
                </div>
              </div>

              <div className="space-y-4">
                {/* Color mode toggle placed between header and color scale */}
                {onColorModeChange && (
                  <div className="inline-flex rounded-full bg-white overflow-hidden mt-1 mb-2" style={{ border: `1px solid ${theme.accentBorder}` }}>
                    <button
                      onClick={() => onColorModeChange('linear')}
                      className={`px-3 py-1.5 text-[10px] transition-all ${colorMode === 'linear' ? 'text-white' : 'text-[#5A5A5A] hover:text-[#1A1A1A]'}`}
                      style={colorMode === 'linear' ? { backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
                    >
                      Linéaire
                    </button>
                    <div className="w-px" style={{ backgroundColor: theme.accentBorder }} />
                    <button
                      onClick={() => onColorModeChange('quantile')}
                      className={`px-3 py-1.5 text-[10px] transition-all ${colorMode === 'quantile' ? 'text-white' : 'text-[#5A5A5A] hover:text-[#1A1A1A]'}`}
                      style={colorMode === 'quantile' ? { backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
                    >
                      Quantile
                    </button>
                  </div>
                )}
                {/* Color scale labels */}
                <div className="flex items-center justify-between text-[9px] text-[#5A5A5A] font-medium" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <span>Défavorable</span>
                  <span>Favorable</span>
                </div>
                
                {/* Color bar */}
                <div 
                  className="flex w-full h-3 rounded-full overflow-hidden cursor-pointer transition-all shadow-sm mt-2 mb-1"
                  style={{ boxShadow: `0 0 0 1px ${theme.accentBorder}` }}
                  onClick={onToggleDistribution}
                >
                  {VALUE_PALETTE.map((c, i) => (
                    <div
                      key={i}
                      className="h-full flex-1 first:rounded-l-full last:rounded-r-full"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                
                {/* Scale values */}
                <div className="flex justify-between">
                  <span className="text-[9px] text-[#5A5A5A] font-medium" style={{ fontFamily: 'Arial, sans-serif' }}>0.0</span>
                  <span className="text-[9px] text-[#5A5A5A] font-medium" style={{ fontFamily: 'Arial, sans-serif' }}>1.0</span>
                </div>

                
              </div>

              {/* Distribution histogram */}
              <AnimatePresence>
                {showDistribution && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mt-4 pt-3"
                    style={{ borderTop: `1px solid ${theme.accentBorder}` }}
                  >
                    {/* Vérification paramètres actifs (discret) */}
                    {debugParams && (
                      <div className="mb-3 text-[9px] text-[#6b7280] font-mono leading-relaxed">
                        <div>scale={scale} | mode={mode} | color={colorMode}</div>
                        <div>attr={debugParams.attr} | layer={debugParams.layerId}</div>
                        <div>th=[{debugParams.thresholds.map(t => t.toFixed(2)).join(', ')}]</div>
                      </div>
                    )}
                    <DistributionChart data={distributionData} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
