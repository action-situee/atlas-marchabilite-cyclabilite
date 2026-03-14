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
    subtitle: "Lecture territoriale de la qualité des déplacements à pied",
    about:
      "L'indice de marchabilité estime, à partir de données objectivables, dans quelle mesure un segment de rue ou une maille offre des conditions favorables à la marche. Il permet de repérer les continuités confortables, les manques d'aménités, les ruptures d'infrastructure et les zones où la sécurité ou le confort piéton doivent être renforcés.",
    methodology:
      "Le score agrège quatre classes complémentaires : Commodité, Attractivité, Infrastructure et Sécurité. Chaque attribut est normalisé entre 0 et 1 puis combiné au sein de sa classe avant de contribuer au score global. La lecture peut se faire au segment, au carreau de 200 m ou à l'échelle infra-communale.",
    limits:
      "L'indice n'a pas vocation à remplacer un diagnostic de terrain. Il ne restitue pas entièrement les ressentis, la qualité d'usage selon les heures, les obstacles temporaires, ni certains effets très locaux comme l'encombrement ponctuel, l'ambiance nocturne ou la perception sociale des lieux.",
    usage:
      "Survolez un objet sur la carte pour afficher son profil détaillé. Le radar synthétise les classes, la colonne de droite détaille les attributs, et la légende permet de passer d'une lecture linéaire à une lecture en quantiles selon le besoin d'analyse.",
    partners: [{ name: 'GENF', src: GENF_LOGO_URL }]
  },
  bikeability: {
    subtitle: "Lecture territoriale de l'attractivité et du confort du réseau vélo",
    about:
      "L'indice de cyclabilité met en évidence la qualité potentielle d'un déplacement à vélo en combinant des informations sur l'attractivité du parcours, le confort environnemental, la présence d'équipements, la qualité de l'infrastructure et les conditions de sécurité.",
    methodology:
      "Le score vélo repose sur cinq classes : Attractivité, Confort, Équipement, Infrastructure et Sécurité. Les attributs sont normalisés puis agrégés pour produire un score par classe et un score global. L'analyse peut être lue au segment, au carreau de 200 m et à l'échelle infra-communale.",
    limits:
      "Comme pour tout indicateur synthétique, certains éléments restent partiellement représentés : charge réelle du trafic selon les heures, comportements d'usage, continuités vécues, qualité perçue des intersections, ou conflits ponctuels liés à des travaux et à des situations temporaires.",
    usage:
      "Utilisez la carte pour repérer les continuités favorables ou les points de fragilité du réseau. Le radar donne une lecture rapide des cinq classes, tandis que la colonne de droite permet d'entrer dans le détail des attributs et de leur contribution.",
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
        className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] overflow-hidden rounded-2xl sm:w-[70vw] sm:max-w-[32rem]"
        style={{ backgroundColor: theme.panelBackground, border: `1px solid ${theme.accentBorder}` }}
      >
        <DialogHeader>
          <DialogTitle className="text-[#1A1A1A] text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
            {modeConfig.title}
          </DialogTitle>
          <DialogDescription className="text-sm" style={{ color: theme.accentDark, fontFamily: 'Arial, sans-serif' }}>
            {content.subtitle}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto pr-1 text-[#1A1A1A] text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
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
