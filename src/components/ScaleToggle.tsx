import { getModeTheme, type AtlasMode, type AtlasScale } from '../config/modes';
import { Route, LayoutGrid, Map } from 'lucide-react';

interface ScaleToggleProps {
  mode: AtlasMode;
  scale: AtlasScale;
  onScaleChange: (scale: AtlasScale) => void;
  availableCarreau200?: boolean;
  availableZoneTrafic?: boolean;
}

export function ScaleToggle({
  mode,
  scale,
  onScaleChange,
  availableCarreau200 = true,
  availableZoneTrafic = true
}: ScaleToggleProps) {
  const theme = getModeTheme(mode);
  const zoneLabel = 'Secteur';
  const zoneTitle = mode === 'bikeability'
    ? 'Secteur - Grand Genève'
    : 'Secteur - données GIREC';

  return (
    <div className="bg-white rounded-full flex overflow-hidden" style={{ border: `1px solid ${theme.accentBorder}` }}>
      <button
        onClick={() => onScaleChange('segment')}
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'segment'
            ? 'text-white'
            : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={scale === 'segment' ? { backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
        title="Rue - Tronçon de rue"
      >
        <Route className="w-3.5 h-3.5" />
        <span>Rue</span>
      </button>
      <div className="w-px" style={{ backgroundColor: theme.accentBorder }} />
      <button
        onClick={() => onScaleChange('carreau200')}
        disabled={!availableCarreau200}
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'carreau200'
            ? 'text-white'
            : availableCarreau200
              ? 'text-[#5A5A5A] hover:text-[#1A1A1A]'
              : 'text-[#A0A0A0] cursor-not-allowed'
        }`}
        style={scale === 'carreau200' ? { backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
        title={availableCarreau200 ? 'Quartier - Grille statistique 200 m' : 'Quartier - données indisponibles'}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Quartier</span>
        {!availableCarreau200 && (
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wide"
            style={{ backgroundColor: theme.accentLight, color: theme.accentDark }}
          >
            Données manquantes
          </span>
        )}
      </button>
      <div className="w-px" style={{ backgroundColor: theme.accentBorder }} />
      <button
        onClick={() => onScaleChange('zoneTrafic')}
        disabled={!availableZoneTrafic}
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'zoneTrafic'
            ? 'text-white'
            : availableZoneTrafic
              ? 'text-[#5A5A5A] hover:text-[#1A1A1A]'
              : 'text-[#A0A0A0] cursor-not-allowed'
        }`}
        style={scale === 'zoneTrafic' ? { backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
        title={availableZoneTrafic ? zoneTitle : `${zoneLabel} - données indisponibles`}
      >
        <Map className="w-3.5 h-3.5" />
        <span>{zoneLabel}</span>
        {!availableZoneTrafic && (
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wide"
            style={{ backgroundColor: theme.accentLight, color: theme.accentDark }}
          >
            Données manquantes
          </span>
        )}
      </button>
    </div>
  );
}
