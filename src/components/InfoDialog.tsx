import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InfoDialog({ open, onOpenChange }: InfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white rounded-2xl border border-[#D8D2CA]">
        <DialogHeader>
          <DialogTitle className="text-[#1A1A1A] text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
            Atlas Action Située
          </DialogTitle>
          <DialogDescription className="text-[#5A5A5A] text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
            Analyse de marchabilité et cyclabilité
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 text-[#1A1A1A] text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>À propos</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
              incididunt ut labore et dolore magna aliqua.
            </p>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Méthodologie</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt 
              mollit anim id est laborum.
            </p>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Classes d'attributs</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F5F3F0] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#6B7C59]" />
                  {/* Label centralisé via config for future-proofing */}
                  <span className="text-[#1A1A1A] text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>Commodité</span>
                </div>
                <p className="text-[10px] text-[#5A5A5A]" style={{ fontFamily: 'Arial, sans-serif' }}>
                  Confort et ambiance
                </p>
              </div>
              <div className="bg-[#F5F3F0] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#4A5F7F]" />
                  <span className="text-[#1A1A1A] text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>Attractivité</span>
                </div>
                <p className="text-[10px] text-[#5A5A5A]" style={{ fontFamily: 'Arial, sans-serif' }}>
                  Points d'intérêt
                </p>
              </div>
              <div className="bg-[#F5F3F0] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#A55A4A]" />
                  <span className="text-[#1A1A1A] text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>Sécurité</span>
                </div>
                <p className="text-[10px] text-[#5A5A5A]" style={{ fontFamily: 'Arial, sans-serif' }}>
                  Sécurité routière
                </p>
              </div>
              <div className="bg-[#F5F3F0] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#7A6B5D]" />
                  <span className="text-[#1A1A1A] text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>Infrastructure</span>
                </div>
                <p className="text-[10px] text-[#5A5A5A]" style={{ fontFamily: 'Arial, sans-serif' }}>
                  Qualité aménagements
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Limites de l'indice</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              Cet indice est construit sur des choix méthodologiques opérationnels. 
              Certains aspects comme le sentiment d'insécurité, l'éclairage nocturne, 
              ou encore la perception subjective du confort ne sont pas pris en compte 
              dans cette version. L'indice se concentre sur des critères objectifs et mesurables.
            </p>
          </div>

          <div>
            <h3 className="text-[#1A1A1A] mb-2 text-xs uppercase tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>Utilisation</h3>
            <p className="text-[#5A5A5A] text-xs leading-relaxed">
              Cliquez sur le cercle à gauche d'une classe pour la visualiser. 
              Survolez un tronçon pour ses scores détaillés.
            </p>
          </div>

          <div className="pt-4 border-t border-[#D8D2CA]">
            <p className="text-[#5A5A5A] mb-3 text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>
              Questions sur la méthodologie ?
            </p>
            <a
              href="mailto:contact@atlas-action-situee.fr"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D35941] text-white rounded-full hover:bg-[#C14931] transition-colors text-xs"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              Nous contacter
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}