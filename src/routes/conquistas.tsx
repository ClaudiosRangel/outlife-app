// Tela de Conquistas (Bloco 2): lista as badges do usuário (obtidas x a obter),
// com progresso. Consome list_my_badges (RPC). Rota flat /conquistas
// (routeTree manual). Acessível do Perfil e do Ranking.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Award, Footprints, Route as RouteIcon, Mountain, MapPin, Star,
  Flame, Bike, Trophy, type LucideIcon,
} from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyBadges, type BadgeItem } from "@/lib/league";

export const Route = createFileRoute("/conquistas")({
  component: ConquistasScreen,
  head: () => ({
    meta: [
      { title: "Conquistas — OutVitar" },
      { name: "description", content: "Suas conquistas e troféus na OutVitar." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/conquistas" }],
  }),
});

// Metadados visuais por código de badge (título/desc default + ícone + cor).
const BADGE_META: Record<string, { icon: LucideIcon; color: string; title: string; desc: string }> = {
  first_activity: { icon: Footprints, color: "#22c55e", title: "Primeira aventura", desc: "Conclua sua 1ª atividade" },
  km_100: { icon: RouteIcon, color: "#3b82f6", title: "100 km", desc: "Percorra 100 km somados" },
  km_500: { icon: RouteIcon, color: "#6366f1", title: "500 km", desc: "Percorra 500 km somados" },
  explorer: { icon: MapPin, color: "#f97316", title: "Explorador", desc: "Visite 5 destinos diferentes" },
  top_reviewer: { icon: Star, color: "#eab308", title: "Avaliador", desc: "Publique 5 avaliações com foto" },
  destinos_1: { icon: MapPin, color: "#10b981", title: "Primeiro destino", desc: "Visite 1 destino" },
  destinos_5: { icon: MapPin, color: "#0ea5e9", title: "5 destinos", desc: "Visite 5 destinos" },
  destinos_10: { icon: MapPin, color: "#8b5cf6", title: "10 destinos", desc: "Visite 10 destinos" },
  pedalada_10: { icon: Bike, color: "#f59e0b", title: "Pedal 10", desc: "10 pedaladas concluídas" },
  corrida_10: { icon: Footprints, color: "#ef4444", title: "Corredor 10", desc: "10 corridas concluídas" },
  trilha_10: { icon: Mountain, color: "#16a34a", title: "Trilheiro 10", desc: "10 trilhas concluídas" },
  streak_7: { icon: Flame, color: "#f97316", title: "7 dias seguidos", desc: "Ative-se 7 dias seguidos" },
  streak_30: { icon: Flame, color: "#dc2626", title: "30 dias seguidos", desc: "Ative-se 30 dias seguidos" },
};

function ConquistasScreen() {
  const { t } = useTranslation();
  const { data: badges = [], isLoading } = useQuery({
    queryKey: ["my-badges"],
    queryFn: fetchMyBadges,
  });

  const earned = badges.filter((b) => b.earned);
  const toEarn = badges.filter((b) => !b.earned);

  return (
    <div className="animate-float-up min-h-full pb-20">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-white/70">
            <Award size={14} /> {t("achievements.title", { defaultValue: "Conquistas" })}
          </span>
          <span className="w-9" />
        </div>
        {!isLoading && (
          <p className="mt-2 text-center text-xs text-white/70">
            {t("achievements.summary", {
              defaultValue: "{{earned}} de {{total}} conquistadas",
              earned: earned.length,
              total: badges.length,
            })}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 px-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {earned.length > 0 && (
            <Section title={t("achievements.earned", { defaultValue: "Conquistadas" })}>
              {earned.map((b) => <BadgeCard key={b.code} badge={b} />)}
            </Section>
          )}
          {toEarn.length > 0 && (
            <Section title={t("achievements.toEarn", { defaultValue: "A conquistar" })}>
              {toEarn.map((b) => <BadgeCard key={b.code} badge={b} />)}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 px-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeItem }) {
  const { t } = useTranslation();
  const meta = BADGE_META[badge.code] ?? { icon: Trophy, color: "#64748b", title: badge.code, desc: "" };
  const Icon = meta.icon;
  const pct = Math.round(Math.min(1, Math.max(0, badge.progress)) * 100);
  return (
    <div className={`rounded-2xl bg-card p-4 shadow-card ${badge.earned ? "" : "opacity-70"}`}>
      <div
        className="grid h-11 w-11 place-items-center rounded-full"
        style={{ backgroundColor: `${meta.color}22`, color: badge.earned ? meta.color : "#94a3b8" }}
      >
        <Icon size={22} />
      </div>
      <div className="mt-2 text-sm font-semibold leading-tight">
        {t(`achievements.badges.${badge.code}.title`, { defaultValue: meta.title })}
      </div>
      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
        {t(`achievements.badges.${badge.code}.desc`, { defaultValue: meta.desc })}
      </div>
      {!badge.earned && badge.progress > 0 && badge.progress < 1 && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
          </div>
          <div className="mt-1 text-right text-[10px] text-muted-foreground">{pct}%</div>
        </div>
      )}
    </div>
  );
}
