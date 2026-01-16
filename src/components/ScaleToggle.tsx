import { Grid3x3, Square, Map } from 'lucide-react';

interface ScaleToggleProps {
  scale: 'segment' | 'carreau200' | 'zoneTrafic';
  onScaleChange: (scale: 'segment' | 'carreau200' | 'zoneTrafic') => void;
  availableCarreau200?: boolean;
  availableZoneTrafic?: boolean;
}

export function ScaleToggle({
  scale,
  onScaleChange,
  availableCarreau200 = true,
  availableZoneTrafic = true
}: ScaleToggleProps) {
  return (
    <div className="bg-white rounded-full flex border border-[#D8D2CA] overflow-hidden">
      <button
        onClick={() => onScaleChange('segment')}
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'segment'
            ? 'bg-[#D35941] text-white'
            : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={{ fontFamily: 'Arial, sans-serif' }}
        title="Segment - Tronçon de rue"
      >
        <Grid3x3 className="w-3.5 h-3.5" />
        <span>Segment</span>
      </button>
      <div className="w-px bg-[#D8D2CA]" />
      <button
        onClick={() => onScaleChange('carreau200')}
        disabled={!availableCarreau200}
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'carreau200'
            ? 'bg-[#D35941] text-white'
            : availableCarreau200
              ? 'text-[#5A5A5A] hover:text-[#1A1A1A]'
              : 'text-[#A0A0A0] cursor-not-allowed'
        }`}
        style={{ fontFamily: 'Arial, sans-serif' }}
        title={availableCarreau200 ? 'Carreau 200m - Grille statistique' : 'Carreau 200m - données indisponibles'}
      >
        <Square className="w-3.5 h-3.5" />
        <span>Carreau 200</span>
        {!availableCarreau200 && (
          <span className="ml-1 rounded-full bg-[#EEE6DE] px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-[#8A2E23]">
            Données manquantes
          </span>
        )}
      </button>
      <div className="w-px bg-[#D8D2CA]" />
      <button
        onClick={() => onScaleChange('zoneTrafic')}
        disabled={!availableZoneTrafic}
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'zoneTrafic'
            ? 'bg-[#D35941] text-white'
            : availableZoneTrafic
              ? 'text-[#5A5A5A] hover:text-[#1A1A1A]'
              : 'text-[#A0A0A0] cursor-not-allowed'
        }`}
        style={{ fontFamily: 'Arial, sans-serif' }}
        title={availableZoneTrafic ? 'Zone de trafic - Quartiers fonctionnels' : 'Zone de trafic - données indisponibles'}
      >
        <Map className="w-3.5 h-3.5" />
        <span>Zone trafic</span>
        {!availableZoneTrafic && (
          <span className="ml-1 rounded-full bg-[#EEE6DE] px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-[#8A2E23]">
            Données manquantes
          </span>
        )}
      </button>
    </div>
  );
}
