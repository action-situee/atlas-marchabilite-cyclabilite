import { getModeTheme, type AnalysisTerritory, type AtlasMode } from '../config/modes';

interface TerritoryToggleProps {
  mode: AtlasMode;
  territory: AnalysisTerritory;
  onTerritoryChange: (territory: AnalysisTerritory) => void;
  disabled?: boolean;
}

export function TerritoryToggle({ mode, territory, onTerritoryChange, disabled = false }: TerritoryToggleProps) {
  const theme = getModeTheme(mode);

  return (
    <div
      className="bg-white rounded-full flex overflow-hidden"
      style={{
        border: `1px solid ${theme.accentBorder}`,
        opacity: disabled ? 0.5 : 1
      }}
    >
      <button
        onClick={() => !disabled && onTerritoryChange('grandGeneve')}
        disabled={disabled}
        className={`px-4 py-2 flex items-center gap-2 transition-all text-xs ${
          territory === 'grandGeneve'
            ? 'text-white'
            : disabled
              ? 'text-[#8A8A8A] cursor-not-allowed'
              : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={territory === 'grandGeneve' ? { backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
        title={disabled ? 'Sélecteur de territoire bientôt disponible' : "Afficher l'ensemble du territoire d'analyse"}
      >
        <span>Grand Genève</span>
      </button>
      <div className="w-px" style={{ backgroundColor: theme.accentBorder }} />
      <button
        onClick={() => !disabled && onTerritoryChange('cantonGeneve')}
        disabled={disabled}
        className={`px-4 py-2 flex items-center gap-2 transition-all text-xs ${
          territory === 'cantonGeneve'
            ? 'text-white'
            : disabled
              ? 'text-[#8A8A8A] cursor-not-allowed'
              : 'text-[#5A5A5A] hover:text-[#1A1A1A]'
        }`}
        style={territory === 'cantonGeneve' ? { backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' } : { fontFamily: 'Arial, sans-serif' }}
        title={disabled ? 'Sélecteur de territoire bientôt disponible' : 'Limiter l’affichage au Canton de Genève'}
      >
        <span>Canton de Genève</span>
      </button>
    </div>
  );
}
