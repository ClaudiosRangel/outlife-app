// Perfil de elevação (Bloco 3, Fase B) — gráfico de área em SVG puro (sem lib
// pesada), a partir de elevation_profile [{d(m), e(m)}]. Mostra métricas
// (mín/máx/ganho). Silencioso quando não há dados de elevação úteis.

import { useTranslation } from "react-i18next";

export type ElevationPoint = { d: number; e: number | null };

function computeStats(points: ElevationPoint[]) {
  const eles = points.map((p) => p.e).filter((e): e is number => e != null && Number.isFinite(e));
  if (eles.length < 2) return null;
  let gain = 0;
  for (let i = 1; i < eles.length; i++) if (eles[i] > eles[i - 1]) gain += eles[i] - eles[i - 1];
  return { min: Math.min(...eles), max: Math.max(...eles), gain: Math.round(gain) };
}

export default function ElevationChart({ points, height = 140 }: { points: ElevationPoint[]; height?: number }) {
  const { t } = useTranslation();
  const stats = computeStats(points);
  if (!stats) return null;

  const W = 320, H = height, PAD = 4;
  const valid = points.filter((p) => p.e != null) as { d: number; e: number }[];
  const maxD = Math.max(...valid.map((p) => p.d), 1);
  const { min, max } = stats;
  const span = max - min || 1;
  const x = (d: number) => PAD + (d / maxD) * (W - PAD * 2);
  const y = (e: number) => H - PAD - ((e - min) / span) * (H - PAD * 2 - 16);

  const line = valid.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.d).toFixed(1)},${y(p.e).toFixed(1)}`).join(" ");
  const area = `${line} L${x(valid[valid.length - 1].d).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

  return (
    <div className="mx-5 mt-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t("destination.elevationProfile", { defaultValue: "Perfil de elevação" })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#elevGrad)" />
        <path d={line} fill="none" stroke="#16a34a" strokeWidth="2" />
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Metric label={t("destination.elevMin", { defaultValue: "Alt. mínima" })} value={`${Math.round(stats.min)} m`} />
        <Metric label={t("destination.elevMax", { defaultValue: "Alt. máxima" })} value={`${Math.round(stats.max)} m`} />
        <Metric label={t("destination.elevGain", { defaultValue: "Subida acum." })} value={`${stats.gain} m`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-sm font-semibold tabular-nums text-primary">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
