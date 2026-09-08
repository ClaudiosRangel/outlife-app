import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/hooks/use-auth";
import { fetchActivityRanking, resolveAsset } from "@/lib/api";
import { formatRankingValue, type RankingMetric, type RankingScope, type RankingPeriod } from "@/lib/ranking-format";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/ranking")({
  component: RankingScreen,
  head: () => ({
    meta: [
      { title: "Rankings — OutVitar" },
      { name: "description", content: "Rankings de atividades por distância, tempo e altimetria na OutVitar." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/ranking" }],
  }),
});

const METRICS: RankingMetric[] = ["distancia", "tempo", "altimetria"];
const SCOPES: RankingScope[] = ["global", "seguidos"];
const PERIODS: RankingPeriod[] = ["semana", "mes", "ano", "sempre"];

function RankingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [metric, setMetric] = useState<RankingMetric>("distancia");
  const [scope, setScope] = useState<RankingScope>("global");
  const [period, setPeriod] = useState<RankingPeriod>("sempre");

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["activity-ranking", metric, scope, period],
    queryFn: () => fetchActivityRanking({ metric, scope, period }),
  });

  return (
    <div className="animate-float-up min-h-full pb-20">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("ranking.title")}
          </span>
          <span className="w-9" />
        </div>
        <p className="mt-2 text-center text-xs text-white/70">{t("ranking.subtitle")}</p>
      </div>

      {/* Seletor de métrica */}
      <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide px-5">
        {METRICS.map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-base ${
              metric === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t(`ranking.metric.${m}`)}
          </button>
        ))}
      </div>

      {/* Seletor de escopo + período */}
      <div className="mt-2 flex items-center justify-between gap-2 px-5">
        <div className="flex gap-2">
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-base ${
                scope === s ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t(`ranking.scope.${s}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-base ${
                period === p ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t(`ranking.period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2 px-5">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
        ) : isError ? (
          <div className="rounded-2xl bg-card p-6 text-center text-xs text-destructive shadow-card">
            {t("ranking.loadError")}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
            {t("ranking.empty")}
          </div>
        ) : (
          rows.map((r, idx) => {
            const isMe = r.userId === user?.id;
            const position = idx + 1;
            return (
              <div
                key={r.userId}
                className={`flex items-center gap-3 rounded-2xl p-3 shadow-card ${
                  isMe ? "bg-primary/10 ring-1 ring-primary/40" : "bg-card"
                }`}
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
                    {isMe ? t("ranking.you") : r.fullName || (r.username ? `@${r.username}` : "Aventureiro")}
                  </div>
                  {r.username && !isMe && (
                    <div className="truncate text-[11px] text-muted-foreground">@{r.username}</div>
                  )}
                </div>
                <span className="shrink-0 font-display text-sm font-semibold text-primary tabular-nums">
                  {formatRankingValue(r.value, metric)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
