import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play, Pause, Square, Trash2, ArrowLeft, MapPin, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
import {
  startActivity,
  updateActivityProgress,
  finishActivity,
  discardActivity,
  uploadActivityImage,
  uploadActivityMapSnapshot,
  type ActivityType,
} from "@/lib/api";
import { mapRateLimitErrorToMessage } from "@/lib/rate-limit-error";
import { Button } from "@/components/ui/button";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { enqueueActivity } from "@/lib/activity-storage";
import { useActivitySync } from "@/hooks/use-activity-sync";
import { ReviewPromptDialog } from "@/components/ReviewPromptDialog";
import { computeActivityMetrics } from "@/lib/activity-metrics";
import { generateActivityMapSnapshot } from "@/lib/activity-map-snapshot";

const ACTIVITY_TYPES: readonly ActivityType[] = ["caminhada", "pedalada", "trilha", "outro"];

const ActivityMap = lazy(() => import("@/components/ActivityMap"));

export const Route = createFileRoute("/atividade/rastrear")({
  component: TrackActivityPage,
  head: () => ({
    meta: [
      { title: "Rastrear atividade — Outlife" },
      { name: "description", content: "Registre sua trilha em tempo real." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/atividade/rastrear" }],
  }),
});

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function TrackActivityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const tracker = useActivityTracker();
  // Activity_Type selecionado antes de iniciar o rastreamento (Requirement
  // 4.1/4.2/4.3). Usa o valor restaurado do tracker quando disponível.
  const [activityType, setActivityType] = useState<ActivityType | null>(
    (tracker.activityType as ActivityType) ?? null
  );
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);
  const [reviewDestinationId, setReviewDestinationId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const lastSyncRef = useRef(0);
  useActivitySync();

  // activityId vem do tracker (persistido), não mais de um useState local
  const activityId = tracker.activityId;

  // Ao finalizar, antes de persistir, oferece descrição e foto opcionais
  // (pedido do usuário) através deste Sheet — em vez de salvar
  // imediatamente ao clicar em "Finalizar".
  const [finishSheetOpen, setFinishSheetOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const finishFileRef = useRef<HTMLInputElement>(null);

  const resetFinishForm = () => {
    setDescription("");
    setImagePreview(null);
    setImageFile(null);
  };

  const handleFinishImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Ao voltar para esta tela com uma atividade restaurada automaticamente
  // (tracker.status === "paused" com pontos > 0 e activityId ainda null),
  // não tenta retomar o GPS automaticamente — o usuário clica em "Retomar"
  // para reiniciar o rastreamento de onde parou. Isso cobre o cenário de
  // navegar para outro menu e voltar.

  const startMut = useMutation({
    mutationFn: () => startActivity(undefined, activityType ?? undefined),
    onSuccess: async (a) => {
      tracker.setActivityId(a.id);
      tracker.setActivityType(activityType);
      // Bug corrigido: `tracker.start()` é assíncrona (checa permissão de
      // localização em segundo plano antes de iniciar o rastreamento
      // nativo) e antes não era aguardada nem tinha tratamento de erro —
      // uma falha nela (ex.: exceção do plugin nativo) ficava
      // silenciosamente descartada, deixando a tela travada no estado
      // inicial (botão "Iniciar" continuava habilitado, contador em 0)
      // mesmo com o toast de sucesso já exibido, pois o registro da
      // atividade no banco (aqui) tinha sucesso mesmo que o rastreamento
      // em si falhasse depois. Esse bug provavelmente sempre existiu, mas
      // ficava mascarado pelo erro de coluna ausente no banco, que
      // interrompia o fluxo antes de chegar aqui.
      try {
        const started = await tracker.start();
        if (started) {
          toast.success(t("activity.toasts.started"));
        } else {
          // Bloqueado por permissão negada: `tracker.permissionDenied` já
          // expõe o aviso específico na tela — não é um erro inesperado.
          await discardActivity(a.id).catch(() => {});
          tracker.setActivityId(null);
        }
      } catch (err) {
        await discardActivity(a.id).catch(() => {});
        tracker.setActivityId(null);
        toast.error(err instanceof Error ? err.message : t("activity.toasts.trackingStartError"));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Requirement 4.1/4.2: início do rastreamento exige um Activity_Type
  // válido selecionado; se ausente, bloqueia o início e exibe mensagem
  // obrigatória em vez de chamar startMut.
  const handleStart = () => {
    if (!activityType) {
      toast.error(t("activity.activityTypeRequired"));
      return;
    }
    startMut.mutate();
  };

  const finishMut = useMutation({
    mutationFn: async (opts: { skipExtras?: boolean } = {}) => {
      if (!activityId) throw new Error("No activity");
      const result = tracker.finalize();
      if (!result.route) {
        await discardActivity(activityId).catch(() => {});
        throw new Error(t("activity.toasts.tooShort"));
      }
      try {
        const skipExtras = opts?.skipExtras ?? false;
        const image_url = !skipExtras && imageFile ? await uploadActivityImage(imageFile) : undefined;

        // Requirement 6.1/6.3: gera e envia o Activity_Map_Snapshot após
        // finalize(); qualquer falha aqui (geração ou upload) é isolada
        // neste try/catch e não impede o salvamento da atividade — apenas
        // o snapshot fica ausente.
        let map_snapshot_url: string | undefined;
        try {
          const snapshotBlob = await generateActivityMapSnapshot(result.points);
          if (snapshotBlob) {
            map_snapshot_url = await uploadActivityMapSnapshot(snapshotBlob);
          }
        } catch {
          // Requirement 6.3 — falha na geração/upload do snapshot nunca
          // impede o salvamento da atividade.
        }

        return await finishActivity(activityId, {
          distance_meters: result.distance,
          duration_seconds: result.duration,
          route_geojson: result.route,
          description: skipExtras ? undefined : description.trim() || undefined,
          image_url,
          activity_type: activityType ?? undefined,
          map_snapshot_url,
        });
      } catch (err) {
        const rateLimitMessage = mapRateLimitErrorToMessage(err);
        if (rateLimitMessage) {
          // Limite de chamadas atingido: nenhum efeito foi persistido pelo
          // rate limiter, então não faz sentido enfileirar para retry
          // imediato (voltaria a falhar até a janela expirar).
          throw new Error(rateLimitMessage);
        }
        // Offline / falha de rede: enfileira em IndexedDB para sincronização posterior.
        await enqueueActivity({
          localId: crypto.randomUUID(),
          remoteId: activityId,
          startTime: new Date(Date.now() - result.duration * 1000).toISOString(),
          endTime: new Date().toISOString(),
          distance_meters: result.distance,
          duration_seconds: result.duration,
          route_geojson: result.route,
        });
        throw new Error(
          err instanceof Error
            ? `${err.message} — atividade salva offline e será sincronizada.`
            : "Atividade salva offline e será sincronizada.",
        );
      }
    },
    onSuccess: (a) => {
      toast.success(t("activity.toasts.saved"));
      tracker.reset();
      tracker.setActivityId(null);
      setFinishSheetOpen(false);
      resetFinishForm();
      if (a.destination_id) {
        setSavedActivityId(a.id);
        setReviewDestinationId(a.destination_id);
        setReviewOpen(true);
      } else {
        navigate({ to: "/atividade/$activityId", params: { activityId: a.id } });
      }
    },
    onError: (e: Error) => {
      toast.error(e.message);
      tracker.reset();
      tracker.setActivityId(null);
    },
  });


  // Sync incremental ao banco a cada 10 pontos
  useEffect(() => {
    if (!activityId) return;
    if (tracker.status !== "tracking") return;
    if (tracker.points.length < 2) return;
    if (tracker.points.length - lastSyncRef.current < 10) return;
    lastSyncRef.current = tracker.points.length;
    const route: GeoJSON.LineString = {
      type: "LineString",
      coordinates: tracker.points.map((p) => [p.lng, p.lat]),
    };
    updateActivityProgress(activityId, {
      distance_meters: tracker.distanceMeters,
      route_geojson: route,
    }).catch(() => { /* silencioso; tentaremos no finish */ });
  }, [tracker.points, tracker.status, tracker.distanceMeters, activityId]);

  const handleDiscard = async () => {
    if (activityId) await discardActivity(activityId).catch(() => {});
    tracker.discard();
    tracker.setActivityId(null);
    toast(t("activity.toasts.discarded"));
  };

  const isIdle = tracker.status === "idle";
  const isTracking = tracker.status === "tracking";
  const isPaused = tracker.status === "paused";
  const isSaving = tracker.status === "saving" || startMut.isPending || finishMut.isPending;

  return (
    <div className="flex min-h-screen flex-col pb-6">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("activity.trackTitle")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      {tracker.permissionDenied && (
        <div className="mx-5 mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {t("activity.permissionDenied")}
        </div>
      )}

      {tracker.revokedDuringTracking && (
        <div className="mx-5 mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {t("activity.revokedDuringTracking")}
        </div>
      )}

      <div className="mx-5 mt-3">
        <Suspense fallback={<Skeleton className="h-[320px] w-full rounded-2xl" />}>
          <ActivityMap
            path={tracker.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
            current={tracker.currentPos ? { lat: tracker.currentPos.lat, lng: tracker.currentPos.lng } : null}
            follow={isTracking || isPaused}
            height={320}
          />
        </Suspense>
      </div>

      <div className="mx-5 mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-card p-4 shadow-card text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("activity.metrics.duration")}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-primary tabular-nums">
            {formatDuration(tracker.durationSeconds)}
          </div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-card text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("activity.metrics.distance")}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-primary tabular-nums">
            {formatDistance(tracker.distanceMeters)}
          </div>
        </div>
      </div>

      {/* Requirement 4.4/4.5/4.7: Average_Pace (quando Caminhada/Pedalada)
          e Average_Speed em tempo real, atualizados a cada segundo (mesmo
          intervalo do timer de duração), a partir de computeActivityMetrics
          — mesma função usada no resumo final (Requirement 4.6). Exibe "—"
          quando indisponível, nunca um valor calculado de dados inválidos. */}
      {(isTracking || isPaused) && (() => {
        const liveMetrics = computeActivityMetrics({
          activityType,
          distanceMeters: tracker.distanceMeters,
          durationSeconds: tracker.durationSeconds,
        });
        return (
          <div className="mx-5 mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-card p-3 shadow-card text-center">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("activity.metrics.speed")}
              </div>
              <div className="mt-1 font-display text-lg font-semibold text-primary tabular-nums">
                {liveMetrics.averageSpeedKmh ? `${liveMetrics.averageSpeedKmh} km/h` : "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-card p-3 shadow-card text-center">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("activity.metrics.pace")}
              </div>
              <div className="mt-1 font-display text-lg font-semibold text-primary tabular-nums">
                {liveMetrics.averagePaceLabel ?? "—"}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Requirement 4.1/4.2: seletor de Activity_Type obrigatório, exibido
          antes do botão "Iniciar" (mesmo padrão do seletor de categoria em
          comunidade.tsx). O botão só chama handleStart quando um valor
          válido estiver selecionado. */}
      {isIdle && !tracker.hasOrphan && (
        <div className="mx-5 mt-4">
          <Label className="mb-2 block text-sm font-medium">{t("activity.activityTypeLabel")}</Label>
          <Select
            value={activityType ?? undefined}
            onValueChange={(v) => { setActivityType(v as ActivityType); tracker.setActivityType(v); }}
          >
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder={t("activity.selectActivityType")} />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`activity.activityTypes.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mx-5 mt-4 flex flex-col gap-2">
        {isIdle && !tracker.hasOrphan && (
          <Button
            size="lg"
            className="h-14 rounded-2xl text-base font-semibold"
            onClick={handleStart}
            disabled={isSaving}
          >
            <Play size={18} /> {t("activity.start")}
          </Button>
        )}

        {tracker.hasOrphan && isIdle && (
          <div className="rounded-2xl border border-border bg-card p-3 text-sm">
            <p className="mb-2 font-medium">
              {tracker.orphanUnrecoverable ? t("activity.orphanUnrecoverable") : t("activity.orphanFound")}
            </p>
            <div className="flex gap-2">
              {/* Requirement 3.4/3.5: dados corrompidos (orphanUnrecoverable)
                  oferecem apenas descartar — sem exibir distância, duração
                  ou trajeto derivados, e sem oferecer retomar. A decisão
                  (retomar ou descartar) permanece pendente até uma ação
                  explícita do usuário; os pontos persistidos não são
                  alterados enquanto essa decisão não é tomada. */}
              {!tracker.orphanUnrecoverable && (
                <Button variant="outline" className="flex-1" onClick={tracker.restoreOrphan}>
                  {t("activity.resume")}
                </Button>
              )}
              <Button variant="ghost" className="flex-1" onClick={tracker.discard}>
                {t("activity.discard")}
              </Button>
            </div>
          </div>
        )}

        {isTracking && (
          <Button
            variant="secondary"
            size="lg"
            className="h-14 rounded-2xl text-base font-semibold"
            onClick={tracker.pause}
          >
            <Pause size={18} /> {t("activity.pause")}
          </Button>
        )}

        {isPaused && (
          <Button
            size="lg"
            className="h-14 rounded-2xl text-base font-semibold"
            onClick={tracker.resume}
          >
            <Play size={18} /> {t("activity.resume")}
          </Button>
        )}

        {(isTracking || isPaused) && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1 h-12 rounded-2xl"
              onClick={() => setFinishSheetOpen(true)}
              disabled={isSaving}
            >
              <Square size={16} /> {t("activity.finish")}
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-2xl"
              onClick={handleDiscard}
              disabled={isSaving}
            >
              <Trash2 size={16} /> {t("activity.discard")}
            </Button>
          </div>
        )}
      </div>

      {isIdle && !tracker.hasOrphan && (
        <p className="mx-5 mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin size={12} /> {t("activity.hint")}
        </p>
      )}

      {/* Sheet exibido ao clicar em "Finalizar": permite adicionar descrição
          e foto opcionais antes de persistir a atividade (pedido do
          usuário). Segue o mesmo padrão visual do drawer de nova postagem
          em `comunidade.tsx`. */}
      <Sheet
        open={finishSheetOpen}
        onOpenChange={(open) => {
          if (!open && !finishMut.isPending) resetFinishForm();
          setFinishSheetOpen(open);
        }}
      >
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{t("activity.finishSheetTitle")}</SheetTitle>
            <SheetDescription>{t("activity.finishSheetDescription")}</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-4">
            <div>
              <Label className="mb-2 block text-sm font-medium">{t("activity.descriptionLabel")}</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("activity.descriptionPlaceholder")}
                rows={4}
                className="w-full rounded-xl border border-border bg-card p-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">{t("activity.addPhoto")}</Label>
              <button
                onClick={() => finishFileRef.current?.click()}
                className="relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-6 text-muted-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <>
                    <Camera size={28} className="text-muted-foreground" />
                    <span className="text-sm">{t("activity.addPhoto")}</span>
                    <span className="text-xs text-muted-foreground/70">{t("activity.photoHint")}</span>
                  </>
                )}
                <input
                  ref={finishFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFinishImageChange}
                />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setFinishSheetOpen(false);
                  resetFinishForm();
                  handleDiscard();
                }}
                disabled={finishMut.isPending}
                className="flex-1 rounded-xl border border-destructive/30 bg-destructive/10 py-3.5 text-sm font-semibold text-destructive active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <Trash2 size={14} className="inline mr-1 -mt-0.5" />
                {t("activity.discard")}
              </button>
              <button
                onClick={() => finishMut.mutate({})}
                disabled={finishMut.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50 disabled:active:scale-100 active:scale-[0.98] transition-transform"
              >
                {finishMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                {t("activity.saveActivity")}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {savedActivityId && reviewDestinationId && (
        <ReviewPromptDialog
          open={reviewOpen}
          onOpenChange={(v) => {
            setReviewOpen(v);
            if (!v && savedActivityId) {
              const id = savedActivityId;
              setSavedActivityId(null);
              setReviewDestinationId(null);
              navigate({ to: "/atividade/$activityId", params: { activityId: id } });
            }
          }}
          targetId={reviewDestinationId}
          targetType="destination"
          targetLabel="este destino"
        />
      )}
    </div>
  );
}
