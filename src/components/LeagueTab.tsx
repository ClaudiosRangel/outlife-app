// Aba "Liga" do Ranking (Bloco 2): mostra a divisão do usuário, os standings da
// sua divisão na semana corrente (destaque "Você"), zonas de promoção (topo) e
// rebaixamento (base), e quantos dias faltam para fechar a semana. Segmentado
// pelo tipo de atividade selecionado no Ranking (null = geral).

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trophy, ChevronsUp, ChevronsDown, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/SafeImage";
import { fetchLeagueStandings, type LeagueDivision } from "@/lib/league";
import { resolveAsset } from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";

const DIVISION_LABEL: Record<LeagueDivision, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
};
const DIVISION_COLOR: Record<LeagueDivision, string> = {
  bronze: "#b45309",
  prata: "#94a3b8",
  ouro: "#eab308",
  diamante: "#22d3ee",
};

const PROMOTE_N = 3;
const RELEGATE_N = 3;

/** Dias restantes até domingo 23:59 (fim da semana da liga). */
function daysUntilWeekEnd(): number {
  const now = new Date();
  const dow = now.getDay(); // 0=dom
  // dias até o próximo domingo (inclusive hoje se domingo → 0 → mostra "hoje")
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  return daysToSunday;
}

export default function LeagueTab({ activityType }: { activityType: string | null }) {
  const { t } = useTranslation();

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["league-standings", activityType],
    queryFn: () => fetchLeagueStandings(activityType),
  });

  const myDivision = (rows.find((r) => r.isMe)?.division ?? "bronze") as LeagueDivision;
  const total = rows.length;
  const daysLeft = daysUntilWeekEnd();

  return (
    <div className="mt-4 px-5">
      {/* Card da divisão + contagem regressiva */}
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 place-items-center rounded-full"
            style={{ backgroundColor: `${DIVISION_COLOR[myDivision]}22`, color: DIVISION_COLOR[myDivision] }}
          >
            <Medal size={22} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("league.yourDivision", { defaultValue: "Sua divisão" })}
            </div>
            <div className="font-display text-lg font-bold" style={{ color: DIVISION_COLOR[myDivision] }}>
              {t(`league.division.${myDivision}`, { defaultValue: DIVISION_LABEL[myDivision] })}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-bold tabular-nums text-primary">
            {daysLeft === 0 ? t("league.lastDay", { defaultValue: "Último dia" }) : `${daysLeft}d`}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t("league.untilReset", { defaultValue: "para fechar" })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
        </div>
      ) : isError ? (
        <div className="rounded-2xl bg-card p-6 text-center text-xs text-destructive shadow-card">
          {t("ranking.loadError")}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
          {t("league.empty", { defaultValue: "Grave uma atividade nesta semana para entrar na liga!" })}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, idx) => {
            const position = idx + 1;
            const inPromotion = position <= PROMOTE_N && r.points > 0;
            const inRelegation = total >= 8 && position > total - RELEGATE_N;
            return (
              <div key={r.userId}>
                {idx === PROMOTE_N && total > PROMOTE_N && (
                  <div className="my-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-green-600">
                    <ChevronsUp size={12} /> {t("league.promotionZone", { defaultValue: "Zona de promoção" })}
                  </div>
                )}
                {total >= 8 && idx === total - RELEGATE_N && (
                  <div className="my-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-red-500">
                    <ChevronsDown size={12} /> {t("league.relegationZone", { defaultValue: "Zona de rebaixamento" })}
                  </div>
                )}
                <div
                  className={`flex items-center gap-3 rounded-2xl p-3 shadow-card ${
                    r.isMe ? "bg-primary/10 ring-1 ring-primary/40" : "bg-card"
                  } ${inPromotion ? "ring-1 ring-green-500/40" : ""} ${inRelegation ? "ring-1 ring-red-500/30" : ""}`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      position <= 3 ? "bg-[var(--sun)]/20 text-[var(--earth)]" : "text-muted-foreground"
                    }`}
                  >
                    {position <= 3 ? <Trophy size={14} /> : position}
                  </span>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
                    <SafeImage
                      src={resolveAsset(r.avatarUrl, avatarFallback)}
                      alt={r.fullName ?? ""}
                      aspectClassName="aspect-square"
                      fallbackSrc={avatarFallback}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {r.isMe ? t("ranking.you") : r.fullName || (r.username ? `@${r.username}` : "Aventureiro")}
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-sm font-semibold text-primary tabular-nums">
                    {r.points} {t("league.pts", { defaultValue: "pts" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
