import { Grid3x3, Square, Map } from 'lucide-react';

interface ScaleToggleProps {
  scale: 'segment' | 'carreau200' | 'zoneTrafic';
  onScaleChange: (scale: 'segment' | 'carreau200' | 'zoneTrafic') => void;
}

export function ScaleToggle({ scale, onScaleChange }: ScaleToggleProps) {
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
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'carreau200'
            ? 'bg-[#D35941] text-white'
            : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={{ fontFamily: 'Arial, sans-serif' }}
        title="Carreau 200m - Grille statistique"
      >
        <Square className="w-3.5 h-3.5" />
        <span>Carreau 200</span>
      </button>
      <div className="w-px bg-[#D8D2CA]" />
      <button
        onClick={() => onScaleChange('zoneTrafic')}
        className={`px-3 py-2 flex items-center gap-2 transition-all text-xs ${
          scale === 'zoneTrafic'
            ? 'bg-[#D35941] text-white'
            : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={{ fontFamily: 'Arial, sans-serif' }}
        title="Zone de trafic - Quartiers fonctionnels"
      >
        <Map className="w-3.5 h-3.5" />
        <span>Zone trafic</span>
      </button>
    </div>
  );
}
