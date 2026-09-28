// Rota-Destino da comunidade (spec rota-destino-comunidade). Tela/fluxo PRÓPRIO
// para "Criar rota" — separado da atividade diária. Pegada de aventura/desafio:
// o usuário classifica o lugar (categoria de aventura) e como percorre (a pé/
// bike), grava ao vivo OU reaproveita uma atividade já feita, e envia para
// aprovação dos administradores (destinos pending). Reusa useActivityTracker,
// createDestinationFull e buildAdventureDraft (lógica pura).

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Play, Camera, Loader2, Satellite, Footprints, Bike, Radio, Route as RouteIcon, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  createDestinationFull,
  uploadTrailImage,
  fetchUserPublicActivities,
  type UserActivity,
} from "@/lib/api";
import {
  ADVENTURE_CATEGORIES,
  toActivityType,
  buildAdventureDraft,
  type AdventureCategory,
  type TravelMode,
  type RecordedPoint,
} from "@/lib/adventure-route";

const ActivityMap = lazy(() => import("@/components/ActivityMap"));

export const Route = createFileRoute("/rota-nova")({
  component: RotaNovaScreen,
  head: () => ({
    meta: [
      { title: "Criar rota — OutVitar" },
      { name: "description", content: "Crie uma rota-destino para a comunidade." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/rota-nova" }],
  }),
});

type Step = "config" | "recording" | "pick-activity" | "form";

function formatDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function formatDistance(m: number) {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}

function RotaNovaScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const tracker = useActivityTracker();

  const [step, setStep] = useState<Step>("config");

  // Passo 1 — configuração da aventura.
  const [category, setCategory] = useState<AdventureCategory | null>(null);
  const [travel, setTravel] = useState<TravelMode | null>(null);

  // Pré-início (gravação ao vivo): calibração → contagem.
  const [preStart, setPreStart] = useState<null | "calibrating" | "countdown">(null);
  const [countdown, setCountdown] = useState(3);

  // Trajeto capturado (ao vivo ou reaproveitado) → alimenta o form.
  const pointsRef = useRef<RecordedPoint[]>([]);

  // Passo 3 — formulário.
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [difficulty, setDifficulty] = useState("Moderada");
  const [isPaid, setIsPaid] = useState<boolean | null>(null);
  const [priceText, setPriceText] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [petFriendly, setPetFriendly] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Atividades concluídas do usuário (modo "a partir de atividade").
  const { data: myActivities = [], isLoading: loadingActs } = useQuery({
    queryKey: ["my-public-activities", user?.id],
    queryFn: () => fetchUserPublicActivities(user!.id, 30),
    enabled: !!user && step === "pick-activity",
  });

  const activitiesWithRoute = myActivities.filter(
    (a) => (a.route_geojson?.coordinates?.length ?? 0) >= 2,
  );

  const canAdvanceConfig = category != null && travel != null;

  // ---- Gravação ao vivo ----
  const startLive = () => {
    if (!canAdvanceConfig) {
      toast.error(t("rotaNova.needCategoryTravel", { defaultValue: "Escolha a categoria e como vai se deslocar." }));
      return;
    }
    tracker.setActivityType(toActivityType(travel!));
    setStep("recording");
    setPreStart("calibrating");
  };

  const beginCountdown = () => {
    setCountdown(3);
    setPreStart("countdown");
  };
  useEffect(() => {
    if (preStart !== "countdown") return;
    if (countdown <= 0) {
      setPreStart(null);
      void tracker.start();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [preStart, countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishLive = () => {
    const result = tracker.finalize();
    const pts = (result.points ?? []) as RecordedPoint[];
    if (pts.length < 2) {
      toast.error(t("rotaNova.tooShort", { defaultValue: "Trajeto muito curto para virar um destino." }));
      return;
    }
    pointsRef.current = pts;
    tracker.reset();
    tracker.setActivityId(null);
    setStep("form");
  };

  const cancelLive = () => {
    tracker.discard();
    tracker.setActivityId(null);
    setPreStart(null);
    setStep("config");
  };

  // ---- A partir de atividade ----
  const pickActivity = (a: UserActivity) => {
    const coords = a.route_geojson?.coordinates ?? [];
    if (coords.length < 2) {
      toast.error(t("rotaNova.tooShort", { defaultValue: "Trajeto muito curto para virar um destino." }));
      return;
    }
    pointsRef.current = coords.map((c) => ({ lng: c[0], lat: c[1] }));
    setStep("form");
  };

  // ---- Envio ----
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const pts = pointsRef.current;
    if (!pts || pts.length < 2) {
      toast.error(t("rotaNova.tooShort", { defaultValue: "Trajeto muito curto para virar um destino." }));
      return;
    }
    if (!name.trim()) {
      toast.error(t("rotaNova.nameRequired", { defaultValue: "Dê um nome ao destino." }));
      return;
    }
    setSaving(true);
    try {
      const draft = buildAdventureDraft(pts);
      let mainImageUrl: string | null = null;
      if (imageFile) {
        try {
          mainImageUrl = await uploadTrailImage(imageFile);
        } catch {
          /* foto é opcional */
        }
      }
      await createDestinationFull({
        name: name.trim(),
        description: desc.trim() || null,
        latitude: draft.startLat,
        longitude: draft.startLng,
        startLat: draft.startLat,
        startLng: draft.startLng,
        difficulty,
        category: category ?? undefined,
        type: category ?? undefined,
        distanceKm: draft.distanceKm,
        elevation: draft.elevationGainM > 0 ? `${draft.elevationGainM} m` : null,
        isPaid: isPaid ?? undefined,
        priceText: isPaid ? priceText.trim() || null : null,
        openingHours: openingHours.trim() || null,
        petFriendly,
        mainImageUrl,
        routeGeojson: draft.routeGeojson,
        status: "pending",
      });
      toast.success(t("rotaNova.sent", { defaultValue: "Rota enviada para aprovação. Você será avisado quando for publicada." }));
      navigate({ to: "/explorar" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rotaNova.error", { defaultValue: "Não foi possível enviar a rota." }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col pb-8">
      {/* Header */}
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => (step === "config" ? navigate({ to: "/explorar" }) : setStep("config"))}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("rotaNova.title", { defaultValue: "Criar rota" })}
          </span>
          <span className="w-9" />
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold leading-tight">
          {t("rotaNova.headline", { defaultValue: "Compartilhe uma aventura" })}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {t("rotaNova.subtitle", { defaultValue: "Registre um lugar incrível para outros aventureiros. Passa por aprovação antes de virar destino." })}
        </p>
      </div>

      {/* PASSO 1 — CONFIG */}
      {step === "config" && (
        <div className="mx-5 mt-5 space-y-6">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("rotaNova.categoryLabel", { defaultValue: "Tipo de aventura" })}
            </div>
            <div className="flex flex-wrap gap-2">
              {ADVENTURE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-base ${
                    category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {t(`rotaNova.categories.${c}`, { defaultValue: c })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("rotaNova.travelLabel", { defaultValue: "Como você vai percorrer" })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTravel("foot")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-base ${
                  travel === "foot" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                <Footprints size={18} /> {t("rotaNova.travel.foot", { defaultValue: "A pé" })}
              </button>
              <button
                onClick={() => setTravel("bike")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-base ${
                  travel === "bike" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                <Bike size={18} /> {t("rotaNova.travel.bike", { defaultValue: "De bicicleta" })}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("rotaNova.modeLabel", { defaultValue: "Como criar a rota" })}
            </div>
            <button
              onClick={startLive}
              disabled={!canAdvanceConfig}
              className="flex w-full items-center gap-3 rounded-2xl bg-gradient-forest p-4 text-left text-white active:scale-[0.99] disabled:opacity-50"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
                <Radio size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{t("rotaNova.modeLive", { defaultValue: "Gravar ao vivo" })}</div>
                <div className="text-xs text-white/80">{t("rotaNova.modeLiveHint", { defaultValue: "Grave o trajeto real indo até o lugar." })}</div>
              </div>
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => {
                if (!canAdvanceConfig) {
                  toast.error(t("rotaNova.needCategoryTravel", { defaultValue: "Escolha a categoria e como vai se deslocar." }));
                  return;
                }
                setStep("pick-activity");
              }}
              disabled={!canAdvanceConfig}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left active:scale-[0.99] disabled:opacity-50"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <RouteIcon size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{t("rotaNova.modeFromActivity", { defaultValue: "Usar uma atividade que já fiz" })}</div>
                <div className="text-xs text-muted-foreground">{t("rotaNova.modeFromActivityHint", { defaultValue: "Reaproveite o trajeto de uma atividade concluída." })}</div>
              </div>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PASSO 2b — ESCOLHER ATIVIDADE */}
      {step === "pick-activity" && (
        <div className="mx-5 mt-5">
          <div className="mb-3 text-sm font-semibold">
            {t("rotaNova.pickActivityTitle", { defaultValue: "Escolha a atividade" })}
          </div>
          {loadingActs ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
          ) : activitiesWithRoute.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
              {t("rotaNova.noActivities", { defaultValue: "Você ainda não tem atividades com trajeto para reaproveitar." })}
            </div>
          ) : (
            <div className="space-y-2">
              {activitiesWithRoute.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pickActivity(a)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-card active:scale-[0.99]"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <RouteIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold capitalize">
                      {t(`activity.activityTypes.${a.activity_type ?? "outro"}`, { defaultValue: a.activity_type ?? "Atividade" })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistance(a.distance_meters ?? 0)}
                      {a.start_time ? ` · ${new Date(a.start_time).toLocaleDateString("pt-BR")}` : ""}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PASSO 2a — GRAVAÇÃO AO VIVO */}
      {step === "recording" && (
        <>
          <div className="mx-5 mt-3">
            <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-2xl" />}>
              <ActivityMap
                path={tracker.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
                current={tracker.currentPos ? { lat: tracker.currentPos.lat, lng: tracker.currentPos.lng } : null}
                follow={tracker.status === "tracking"}
                height={300}
              />
            </Suspense>
          </div>
          <div className="mx-5 mt-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("activity.metrics.distance", { defaultValue: "Distância" })}</div>
              <div className="mt-1 font-display text-3xl font-bold tabular-nums">{formatDistance(tracker.distanceMeters)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("activity.movingTime", { defaultValue: "Em movimento" })}</div>
              <div className="mt-1 font-display text-3xl font-bold tabular-nums">{formatDuration(tracker.durationSeconds)}</div>
            </div>
          </div>
          <div className="mx-5 mt-6 flex items-center justify-center gap-4">
            <button
              onClick={cancelLive}
              className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground/70 shadow-card active:scale-95"
              aria-label={t("activity.discard", { defaultValue: "Descartar" })}
            >
              <Trash2 size={18} />
            </button>
            {(tracker.status === "tracking" || tracker.status === "paused") && (
              <button
                onClick={finishLive}
                className="flex-1 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg active:scale-[0.98]"
              >
                {t("rotaNova.finishRecording", { defaultValue: "Finalizar e preencher" })}
              </button>
            )}
          </div>
        </>
      )}

      {/* PASSO 3 — FORMULÁRIO */}
      {step === "form" && (
        <div className="mx-5 mt-5 space-y-5">
          <div>
            <Label className="mb-2 block text-sm font-medium">{t("rotaNova.name", { defaultValue: "Nome do destino" })}</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("rotaNova.namePlaceholder", { defaultValue: "Ex.: Cachoeira do Vale" })} className="w-full rounded-xl border border-border bg-card p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium">{t("rotaNova.desc", { defaultValue: "Descrição" })}</Label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder={t("rotaNova.descPlaceholder", { defaultValue: "Como é o trajeto, o que ver, cuidados..." })} className="w-full resize-none rounded-xl border border-border bg-card p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium">{t("rotaNova.difficulty", { defaultValue: "Dificuldade" })}</Label>
            <div className="flex flex-wrap gap-2">
              {["Fácil", "Moderada", "Difícil", "Avançada"].map((d) => (
                <button key={d} onClick={() => setDifficulty(d)} className={`rounded-full px-4 py-2 text-sm font-medium transition-base ${difficulty === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium">{t("rotaNova.access", { defaultValue: "Acesso" })}</Label>
            <div className="flex gap-2">
              <button onClick={() => setIsPaid(false)} className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-base ${isPaid === false ? "bg-green-600 text-white" : "bg-secondary text-secondary-foreground"}`}>{t("rotaNova.free", { defaultValue: "Gratuito" })}</button>
              <button onClick={() => setIsPaid(true)} className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-base ${isPaid === true ? "bg-red-500 text-white" : "bg-secondary text-secondary-foreground"}`}>{t("rotaNova.paid", { defaultValue: "Pago" })}</button>
            </div>
            {isPaid && (
              <input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder={t("rotaNova.pricePlaceholder", { defaultValue: "Ex.: R$ 10 por pessoa" })} className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            )}
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium">{t("rotaNova.openingHours", { defaultValue: "Horário de visitação (opcional)" })}</Label>
            <input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder={t("rotaNova.hoursPlaceholder", { defaultValue: "Ex.: Fins de semana, 8h às 17h" })} className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button onClick={() => setPetFriendly((v) => !v)} className="flex w-full items-center justify-between rounded-2xl bg-secondary/60 px-3 py-3">
            <span className="text-sm font-medium">{t("rotaNova.petFriendly", { defaultValue: "Pet friendly" })}</span>
            <span className={`relative h-6 w-11 rounded-full transition-base ${petFriendly ? "bg-[#f97316]" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-base ${petFriendly ? "left-[22px]" : "left-0.5"}`} />
            </span>
          </button>
          <div>
            <Label className="mb-2 block text-sm font-medium">{t("rotaNova.photo", { defaultValue: "Foto (opcional)" })}</Label>
            <button onClick={() => fileRef.current?.click()} className="relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-6 text-muted-foreground active:scale-[0.98]">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-40 w-full rounded-xl object-cover" />
              ) : (
                <>
                  <Camera size={28} />
                  <span className="text-sm">{t("rotaNova.addPhoto", { defaultValue: "Adicionar foto" })}</span>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
            </button>
          </div>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
            {t("rotaNova.submit", { defaultValue: "Enviar para aprovação" })}
          </button>
        </div>
      )}

      {/* Overlay de calibração de GPS (gravação ao vivo). */}
      {step === "recording" && preStart === "calibrating" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary/10">
              <Satellite size={30} className="animate-pulse text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold">{t("destinationRecord.calibrating.title", { defaultValue: "Calibrando GPS" })}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("destinationRecord.calibrating.description", { defaultValue: "Aguarde um sinal estável para um traçado preciso." })}</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${tracker.gpsSignalState === "bom" ? "bg-green-500" : tracker.gpsSignalState === "fraco" ? "bg-amber-500" : "bg-red-500 animate-pulse"}`} />
              {tracker.gpsSignalState === "bom" && t("destinationRecord.calibrating.good", { defaultValue: "Sinal bom" })}
              {tracker.gpsSignalState === "aquisitando" && t("activity.gpsSignal.aquisitando", { defaultValue: "Buscando sinal…" })}
              {tracker.gpsSignalState === "fraco" && t("activity.gpsSignal.fraco", { defaultValue: "Sinal fraco" })}
              {tracker.gpsSignalState === "sem_sinal" && t("activity.gpsSignal.semSinal", { defaultValue: "Sem sinal" })}
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={beginCountdown} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest py-3.5 text-sm font-semibold text-white active:scale-[0.98]">
                <Play size={16} fill="currentColor" />
                {tracker.gpsSignalState === "bom" ? t("destinationRecord.calibrating.start", { defaultValue: "Iniciar" }) : t("destinationRecord.calibrating.startAnyway", { defaultValue: "Iniciar mesmo assim" })}
              </button>
              <button onClick={cancelLive} className="w-full rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground active:scale-[0.98]">
                {t("common.cancel", { defaultValue: "Cancelar" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de contagem 3-2-1. */}
      {step === "recording" && preStart === "countdown" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm">
          <div className="text-center">
            <div className="font-display text-[7rem] font-bold leading-none text-primary tabular-nums">{countdown > 0 ? countdown : "GO"}</div>
            <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">{t("destinationRecord.countdown.getReady", { defaultValue: "Prepare-se" })}</p>
          </div>
        </div>
      )}
    </div>
  );
}
