import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { MODE_CONFIGS, getModeTheme, type AtlasMode } from '../config/modes';

const GENF_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/refs/heads/main/images/Logo_Genf.svg';
const MODUS_LOGO_URL = 'https://github.com/action-situee/assets/blob/380a38d67ffe6f8270cf52c0d9431d1f05f3b12e/images/modus-2025.png?raw=true';

const INFO_CONTENT: Record<
  AtlasMode,
  {
    subtitle: string;
    about: string;
    methodology: string;
    limits: string;
    usage: string;
    partners: Array<{ name: string; src: string }>;
  }
> = {
  walkability: {
    subtitle: 'Lecture territoriale de la qualité des déplacements à pied',
    about:
      "Développée par le Bureau Action Située pour le Canton de Genève, cette carte interactive propose un indice de marchabilité pour aider au diagnostic et à la planification des mobilités actives. L’outil permet d’identifier les continuités favorables à la marche, les ruptures de parcours et les secteurs où le confort ou la sécurité piétonne peuvent être renforcés, à l’échelle de la rue, du quartier ou du secteur. ",
    methodology:
      "L’indice repose sur un réseau marchable construit à partir de données existantes, principalement OSM et SITG, puis nettoyé et segmenté. Les attributs retenus ont été sélectionnés à partir d’une revue de littérature et d’un travail avec des expert·es, puis organisés en quatre classes : attractivité, commodité, infrastructure et sécurité. Chaque attribut est normalisé, pondéré puis agrégé pour produire un score compris entre 0 et 1.",
    limits:
      "L’indice constitue un diagnostic opérationnel, mais ne remplace pas une observation de terrain. Il ne restitue pas pleinement les ambiances, les variations temporelles, les obstacles temporaires ou certaines dimensions sensibles comme le sentiment d’insécurité, l’encombrement ou la perception sociale des lieux.",
    usage:
      "Survolez un objet pour afficher son profil détaillé. Le radar synthétise les classes, le panneau latéral détaille les attributs, et les menus permettent de changer d’échelle d’analyse et de territoire.",
    partners: [{ name: 'GENF', src: GENF_LOGO_URL }]
  },

  bikeability: {
    subtitle: 'Lecture territoriale de la qualité des déplacements à vélo',
    about:
      "Développée par le Bureau Action Située pour le Canton de Genève, cette carte interactive propose un indice de cyclabilité pour aider au diagnostic et à la planification des mobilités actives. L’outil permet d’identifier les continuités favorables au vélo, les ruptures d’itinéraire et les secteurs où le confort ou la sécurité cyclable peuvent être renforcés, à l’échelle de la rue, du quartier ou du secteur.",
    methodology:
      "L’indice repose sur un réseau cyclable construit à partir de données existantes, principalement OSM et SITG, puis nettoyé et structuré. Les attributs retenus ont été sélectionnés à partir de la littérature et d’un travail avec des expert·es, puis organisés en cinq classes : attractivité, confort, équipement, infrastructure et sécurité. Chaque attribut est normalisé, pondéré puis agrégé pour produire un score compris entre 0 et 1.",
    limits:
      "L’indice constitue un diagnostic opérationnel, mais ne remplace pas une observation de terrain. Il ne restitue pas pleinement les variations de trafic selon les heures, les obstacles temporaires, les conflits d’usage ou certaines dimensions sensibles comme le stress ressenti aux intersections et la qualité perçue des continuités cyclables.",
    usage:
      "Survolez un objet pour afficher son profil détaillé. Le radar synthétise les classes, le panneau latéral détaille les attributs, et les menus permettent de changer d’échelle d’analyse et de territoire.",
    partners: [
      { name: 'GENF', src: GENF_LOGO_URL },
      { name: 'Modus', src: MODUS_LOGO_URL }
    ]
  }
};

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AtlasMode;
}

export function InfoDialog({ open, onOpenChange, mode }: InfoDialogProps) {
  const modeConfig = MODE_CONFIGS[mode];
  const theme = getModeTheme(mode);
  const content = INFO_CONTENT[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl sm:w-[70vw] sm:max-w-[32rem]"
        style={{
          backgroundColor: theme.panelBackground,
          border: `1px solid ${theme.accentBorder}`,
          height: 'min(42rem, calc(100vh - 2rem))',
          maxHeight: 'calc(100vh - 2rem)'
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[#1A1A1A] text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
            {modeConfig.title}
          </DialogTitle>
          <DialogDescription className="text-sm" style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}>
            {content.subtitle}
          </DialogDescription>
        </DialogHeader>
        
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 text-[#1A1A1A] text-sm"
          style={{ fontFamily: 'Arial, sans-serif', overscrollBehavior: 'contain' }}
        >
          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>À propos</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              {content.about}
            </p>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Méthodologie</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              {content.methodology}
            </p>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Classes d'attributs</h3>
            <div className="grid grid-cols-2 gap-3">
              {modeConfig.classes.map((classDef) => (
                <div key={classDef.displayName} className="rounded-xl p-3" style={{ backgroundColor: theme.panelMutedBackground }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: classDef.color }} />
                    <span className="text-[#1A1A1A] text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>
                      {classDef.displayName}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#5A5A5A]" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {classDef.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Limites de l'indice</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              {content.limits}
            </p>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Utilisation</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              {content.usage}
            </p>
          </div>

          <div className="pt-4" style={{ borderTop: `1px solid ${theme.accentBorder}` }}>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[#5A5A5A] mb-3 text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>
                  Partenaires
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {content.partners.map((partner) => (
                    <img
                      key={partner.name}
                      src={partner.src}
                      alt={partner.name}
                      className="h-auto w-auto object-contain shrink-0"
                      style={{ maxHeight: '18px', maxWidth: '88px' }}
                    />
                  ))}
                </div>
              </div>

              <div className="text-right">
                <p className="text-[#5A5A5A] mb-3 text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>
                  Questions sur la méthodologie ?
                </p>
                <a
                  href="mailto:contact@situee.ch"
                  className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-full transition-colors text-xs"
                  style={{ backgroundColor: theme.accent, color: theme.accentContrast, fontFamily: 'Arial, sans-serif' }}
                >
                  Nous contacter
                </a>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
