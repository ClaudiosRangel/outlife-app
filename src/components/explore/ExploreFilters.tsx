// Painel de filtros do Explorar (Bloco 3, Fase C). Bottom sheet com região,
// dificuldade, categoria, pet-friendly, pago/grátis e "rotas que curti".
// Estado controlado pelo pai; a aplicação é pura (explore-filters.ts).

import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PawPrint, DollarSign, Heart, MapPin } from "lucide-react";
import type { ExploreFilters as Filters } from "@/lib/explore-filters";
import { EMPTY_FILTERS } from "@/lib/explore-filters";

const DIFFICULTIES = ["Fácil", "Moderada", "Difícil", "Avançada"];
const CATEGORIES = ["cachoeira", "pico", "parque", "trilha", "montanha"];

export default function ExploreFilters({
  open,
  onOpenChange,
  value,
  onChange,
  hasSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: Filters;
  onChange: (f: Filters) => void;
  hasSaved: boolean;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });

  const Chip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-base ${
        active ? "bg-[#f97316] text-white" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {label}
    </button>
  );

  const Toggle = ({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-secondary/60 px-3 py-3">
      <span className="flex items-center gap-2 text-sm font-medium">{icon} {label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-base ${on ? "bg-[#f97316]" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-base ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">{t("exploreFilters.title", { defaultValue: "Filtros de Trilha" })}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Região */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("exploreFilters.region", { defaultValue: "Região (Cidade)" })}</label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl bg-secondary/60 px-3">
              <MapPin size={16} className="text-muted-foreground" />
              <Input
                value={value.region}
                onChange={(e) => set({ region: e.target.value })}
                placeholder={t("exploreFilters.regionPlaceholder", { defaultValue: "Ex: Ouro Preto" })}
                className="border-0 bg-transparent px-0 focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Dificuldade */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("exploreFilters.difficulty", { defaultValue: "Dificuldade" })}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={value.difficulty === null} label={t("ranking.allTypes", { defaultValue: "Todas" })} onClick={() => set({ difficulty: null })} />
              {DIFFICULTIES.map((d) => (
                <Chip key={d} active={value.difficulty === d} label={d} onClick={() => set({ difficulty: value.difficulty === d ? null : d })} />
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("exploreFilters.category", { defaultValue: "Categoria" })}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip active={value.category === null} label={t("ranking.allTypes", { defaultValue: "Todas" })} onClick={() => set({ category: null })} />
              {CATEGORIES.map((c) => (
                <Chip key={c} active={value.category === c} label={c} onClick={() => set({ category: value.category === c ? null : c })} />
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <Toggle on={value.petFriendly} onClick={() => set({ petFriendly: !value.petFriendly })} icon={<PawPrint size={16} className="text-[#f97316]" />} label={t("exploreFilters.petFriendly", { defaultValue: "Pet Friendly" })} />
            <Toggle on={value.paid === "free"} onClick={() => set({ paid: value.paid === "free" ? "all" : "free" })} icon={<DollarSign size={16} className="text-green-600" />} label={t("exploreFilters.free", { defaultValue: "Atração gratuita" })} />
            <Toggle on={value.paid === "paid"} onClick={() => set({ paid: value.paid === "paid" ? "all" : "paid" })} icon={<DollarSign size={16} className="text-red-500" />} label={t("exploreFilters.paid", { defaultValue: "Passeio pago" })} />
            {hasSaved && (
              <Toggle on={value.savedIds != null} onClick={() => set({ savedIds: value.savedIds != null ? null : [] })} icon={<Heart size={16} className="text-pink-500" />} label={t("exploreFilters.saved", { defaultValue: "Rotas que eu curti" })} />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => onChange(EMPTY_FILTERS)}>
              {t("exploreFilters.clear", { defaultValue: "Limpar" })}
            </Button>
            <Button className="flex-1 rounded-2xl bg-[#f97316] hover:bg-[#ea6a0c]" onClick={() => onOpenChange(false)}>
              {t("exploreFilters.apply", { defaultValue: "Aplicar filtros" })}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
