import { PersonStanding, Bike } from 'lucide-react';
import { getModeTheme, type AtlasMode } from '../config/modes';

interface ModeToggleProps {
  mode: AtlasMode;
  onModeChange: (mode: AtlasMode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  const currentTheme = getModeTheme(mode);
  const walkTheme = getModeTheme('walkability');
  const bikeTheme = getModeTheme('bikeability');

  return (
    <div className="bg-white rounded-full flex overflow-hidden" style={{ border: `1px solid ${currentTheme.accentBorder}` }}>
      <button
        onClick={() => onModeChange('walkability')}
        className={`px-4 py-2 flex items-center gap-2 transition-all text-xs ${
          mode === 'walkability'
            ? 'text-white'
            : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={mode === 'walkability' ? { backgroundColor: walkTheme.accent, color: walkTheme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
      >
        <PersonStanding className="w-4 h-4" />
        <span>Marchabilité</span>
      </button>
      <div className="w-px" style={{ backgroundColor: currentTheme.accentBorder }} />
      <button
        onClick={() => onModeChange('bikeability')}
        className={`px-4 py-2 flex items-center gap-2 transition-all text-xs ${
          mode === 'bikeability'
            ? 'text-white'
            : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={mode === 'bikeability' ? { backgroundColor: bikeTheme.accent, color: bikeTheme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
        title="Cyclabilité"
      >
        <Bike className="w-4 h-4" />
        <span>Cyclabilité</span>
      </button>
    </div>
  );
}
