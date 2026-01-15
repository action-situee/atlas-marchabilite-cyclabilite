import { PersonStanding, Bike } from 'lucide-react';

interface ModeToggleProps {
  mode: 'walkability' | 'bikeability';
  onModeChange: (mode: 'walkability' | 'bikeability') => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="bg-white rounded-full flex border border-[#D8D2CA] overflow-hidden">
      <button
        onClick={() => onModeChange('walkability')}
        className={`px-4 py-2 flex items-center gap-2 transition-all text-xs ${
          mode === 'walkability'
            ? 'bg-[#D35941] text-white'
            : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <PersonStanding className="w-4 h-4" />
        <span>Marchabilité</span>
      </button>
      <div className="w-px bg-[#D8D2CA]" />
      <button
        disabled={true}
        className="px-4 py-2 flex items-center gap-2 text-xs text-[#CCCCCC] cursor-not-allowed opacity-50"
        style={{ fontFamily: 'Arial, sans-serif' }}
        title="Cyclabilité - En développement"
      >
        <Bike className="w-4 h-4" />
        <span>Cyclabilité</span>
      </button>
    </div>
  );
}