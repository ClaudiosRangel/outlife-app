import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play, Pause, Square, Trash2, ArrowLeft, MapPin, Camera, Video, Loader2, Mountain, PauseCircle, Satellite, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
import { useLiveActivityPublisher } from "@/hooks/use-live-activity-publisher";
import { useQuery } from "@tanstack/react-query";
import {
  startActivity,
  updateActivityProgress,
  finishActivity,
  discardActivity,
  detectAndRecordEfforts,
  uploadActivityImage,
  uploadActivityMapSnapshot,
  uploadCommunityPostVideo,
  fetchMyProfile,
  fetchActivityTypes,
  createDestinationFull,
  uploadTrailImage,
  type ActivityType,
  type LocationSharingMode,
} from "@/lib/api";
import { buildDestinationDraft } from "@/lib/route-to-destination";
import {
  validateVideoFileMeta,
  validateVideoDuration,
  videoRejectionMessage,
} from "@/lib/video-validation";
import { readVideoDurationSeconds } from "@/lib/video-duration";
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
import { Label } from "@/components/ui/label";
import { enqueueActivity } from "@/lib/activity-storage";
import { useActivitySync } from "@/hooks/use-activity-sync";
import { ReviewPromptDialog } from "@/components/ReviewPromptDialog";
import { computeActivityMetrics } from "@/lib/activity-metrics";
import { mpsToKmh } from "@/lib/instant-speed";
import { generateActivityMapSnapshot } from "@/lib/activity-map-snapshot";
import { getActivityIcon } from "@/lib/activity-icons";

const ACTIVITY_TYPES: readonly ActivityType[] = ["caminhada", "pedalada", "trilha", "outro"];

const ActivityMap = lazy(() => import("@/components/ActivityMap"));

export const Route = createFileRoute("/atividade/rastrear")({
  component: TrackActivityPage,
  // Item 4: modo "destino" — quando iniciado pelo "Criar rota" do Explorar, ao
  // finalizar a gravação vira um destino pendente para aprovação (não é uma
  // atividade normal do feed).
  validateSearch: (search: Record<string, unknown>): { mode?: "destino" } => {
    return { mode: search.mode === "destino" ? "destino" : undefined };
  },
  head: () => ({
    meta: [
      { title: "Rastrear atividade — OutVitar" },
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

  // Modo de compartilhamento de localização do próprio usuário
  // (profiles.location_sharing_mode). Enquanto a atividade estiver em
  // andamento, o publisher abaixo republica a posição automaticamente de
  // tempo em tempo (LIVE_PUBLISH_INTERVAL_MS) para amigos/todos — sem o
  // usuário precisar clicar em "Atualizar agora".
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });
  const sharingMode = (myProfile?.location_sharing_mode as LocationSharingMode | undefined) ?? undefined;

  // Tipos de atividade vêm do catálogo administrável (Frente D). Fallback para
  // o enum fixo enquanto a query não carrega ou se o catálogo estiver vazio.
  const { data: catalogTypes = [] } = useQuery({
    queryKey: ["activity-types-catalog"],
    queryFn: fetchActivityTypes,
    enabled: !!user,
  });
  // icon_key por código base (usado no fallback do enum, quando o catálogo
  // ainda não carregou). O catálogo já traz icon_key próprio.
  const FALLBACK_ICON_KEY: Record<string, string> = {
    corrida: "run",
    caminhada: "walk",
    trilha: "trail",
    pedalada: "bike",
    natacao: "swim",
    remo: "row",
    escalada: "climb",
    voo_livre: "flight",
    surf: "surf",
    skate: "skate",
    outro: "activity",
  };
  const typeOptions: { code: string; name: string; iconKey: string }[] =
    catalogTypes.length > 0
      ? catalogTypes.map((c) => ({ code: c.code, name: c.name, iconKey: c.icon_key }))
      : ACTIVITY_TYPES.map((v) => ({ code: v, name: v, iconKey: FALLBACK_ICON_KEY[v] ?? "activity" }));

  // Conecta o rastreador ao canal de compartilhamento ao vivo. Reaproveita a
  // posição já capturada pelo tracker (não abre um segundo watchPosition) e só
  // publica quando status === 'tracking' e o modo != 'none' (respeitando o
  // consentimento configurado pelo usuário).
  useLiveActivityPublisher({
    status: tracker.status,
    currentPos: tracker.currentPos,
    sharingMode,
    permissionDenied: tracker.permissionDenied,
  });

  // Activity_Type selecionado antes de iniciar o rastreamento (Requirement
  // 4.1/4.2/4.3). Usa o valor restaurado do tracker quando disponível.
  const [activityType, setActivityType] = useState<ActivityType | null>(
    (tracker.activityType as ActivityType) ?? null
  );
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);
  const [reviewDestinationId, setReviewDestinationId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Item 5: lembrete de checklist ao iniciar trilha/escalada.
  const [checklistReminderOpen, setChecklistReminderOpen] = useState(false);
  const lastSyncRef = useRef(0);
  useActivitySync();

  // Item 4: modo destino (via ?mode=destino do Explorar) + calibração/contagem.
  const { mode } = Route.useSearch();
  const isDestinationMode = mode === "destino";
  // Etapa pré-início: null (nada), "calibrating" (aguardando GPS), "countdown".
  const [preStart, setPreStart] = useState<null | "calibrating" | "countdown">(null);
  const [countdown, setCountdown] = useState(3);
  // Sheet de criação de destino ao finalizar (modo destino).
  const [destSheetOpen, setDestSheetOpen] = useState(false);
  const [destName, setDestName] = useState("");
  const [destDesc, setDestDesc] = useState("");
  const [destDifficulty, setDestDifficulty] = useState("Moderada");
  const [destCategory, setDestCategory] = useState("trilha");
  const [savingDest, setSavingDest] = useState(false);
  const [destImageFile, setDestImageFile] = useState<File | null>(null);
  const [destImagePreview, setDestImagePreview] = useState<string | null>(null);
  const destFileRef = useRef<HTMLInputElement>(null);
  // Guarda o resultado do finalize() do modo destino, para montar o rascunho
  // ao confirmar no sheet (o tracker é resetado logo após finalizar).
  const destResultRef = useRef<{ points: { lat: number; lng: number; ts?: number; alt?: number }[] } | null>(null);

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
  // Vídeo opcional no finish (Req 5). Preview via Object_URL (nunca base64),
  // com revogação disciplinada ao trocar/limpar/desmontar (memória — Bloco B).
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const finishVideoRef = useRef<HTMLInputElement>(null);
  const videoUrlRef = useRef<string | null>(null);
  // Estado de conexão: o vídeo é desabilitado offline (Req 5.4) — não
  // enfileiramos blobs grandes na Sync_Queue.
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const revokeVideoPreview = () => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
  };

  const resetFinishForm = () => {
    setDescription("");
    setImagePreview(null);
    setImageFile(null);
    revokeVideoPreview();
    setVideoPreview(null);
    setVideoFile(null);
  };

  // Revoga o Object_URL do vídeo ao desmontar a tela (memória — Bloco B).
  useEffect(() => revokeVideoPreview, []);

  const handleFinishImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFinishVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isOnline) {
      toast.error(t("activity.videoOfflineDisabled"));
      return;
    }
    const meta = validateVideoFileMeta({ type: file.type, size: file.size });
    if (!meta.ok) {
      toast.error(videoRejectionMessage(meta.reason));
      return;
    }
    const seconds = await readVideoDurationSeconds(file);
    if (!validateVideoDuration(seconds).ok) {
      toast.error(videoRejectionMessage("duration"));
      return;
    }
    revokeVideoPreview();
    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setVideoFile(file);
    setVideoPreview(url);
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
    // O tipo de atividade (como você se move: corrida/caminhada/trilha/
    // pedalada/...) é sempre obrigatório — inclusive no modo destino, onde
    // define o rastreamento e o KOM. A CATEGORIA do destino (o tipo de lugar:
    // cachoeira/montanha/...) é escolhida à parte, só no sheet ao finalizar.
    if (!activityType) {
      toast.error(t("activity.activityTypeRequired"));
      return;
    }
    // Item 5: em trilha/escalada, lembra o checklist antes de iniciar.
    if (!isDestinationMode && (activityType === "trilha" || activityType === "escalada")) {
      setChecklistReminderOpen(true);
      return;
    }
    // Item 4: calibração de GPS antes de iniciar (contagem vem depois).
    setPreStart("calibrating");
  };

  // Início efetivo (usado após o lembrete de checklist, ou direto).
  const proceedStart = () => {
    setChecklistReminderOpen(false);
    setPreStart("calibrating");
  };

  // Item 4: calibração → contagem regressiva → start. A calibração observa o
  // gpsSignalState; quando "otimo"/"bom" OU o usuário força, entra na contagem.
  const beginCountdown = () => {
    setCountdown(3);
    setPreStart("countdown");
  };
  useEffect(() => {
    if (preStart !== "countdown") return;
    if (countdown <= 0) {
      setPreStart(null);
      startMut.mutate();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [preStart, countdown]);

  const finishMut = useMutation({
    mutationFn: async (opts: { skipExtras?: boolean } = {}) => {
      if (!activityId) throw new Error("No activity");
      const result = tracker.finalize();
      if (!result.route) {
        await discardActivity(activityId).catch(() => {});
        throw new Error(t("activity.toasts.tooShort"));
      }
      // Blob do snapshot gerado dentro do try abaixo. Declarado no escopo
      // do mutationFn para que, em caso de falha de rede, o `catch` externo
      // possa enfileirá-lo na Sync_Queue (Requirement 2.2). Fica `null`
      // quando a geração falha ou não produz imagem (Requirement 2.5).
      let snapshotBlob: Blob | null = null;
      try {
        const skipExtras = opts?.skipExtras ?? false;
        const image_url = !skipExtras && imageFile ? await uploadActivityImage(imageFile) : undefined;
        // Req 5.2: sobe o vídeo (se houver) antes de finalizar; a URL entra no
        // post automático via finish_user_activity. Vídeo só existe online
        // (desabilitado na seleção offline — Req 5.4).
        const video_url = !skipExtras && videoFile ? await uploadCommunityPostVideo(videoFile) : undefined;

        // Requirement 6.1/6.3: gera e envia o Activity_Map_Snapshot após
        // finalize(); qualquer falha aqui (geração ou upload) é isolada
        // neste try/catch e não impede o salvamento da atividade — apenas
        // o snapshot fica ausente.
        let map_snapshot_url: string | undefined;
        try {
          // Composição do snapshot: quando há foto anexada (e não é
          // skipExtras), a imagem do post fica lado a lado — foto 60% à
          // esquerda + mapa 40% à direita. Sem foto, o mapa ocupa 100%.
          snapshotBlob = await generateActivityMapSnapshot(result.points, {
            photo: !skipExtras && imageFile ? imageFile : null,
          });
          if (snapshotBlob) {
            map_snapshot_url = await uploadActivityMapSnapshot(snapshotBlob);
          }
        } catch {
          // Requirement 6.3 — falha na geração/upload do snapshot nunca
          // impede o salvamento da atividade.
        }

        const finished = await finishActivity(activityId, {
          distance_meters: result.distance,
          duration_seconds: result.duration,
          elapsed_seconds: result.elapsed,
          route_geojson: result.route,
          description: skipExtras ? undefined : description.trim() || undefined,
          image_url,
          activity_type: activityType ?? undefined,
          map_snapshot_url,
          // Requirement 1.1: persiste o ganho de elevação no fluxo online.
          elevation_gain: result.elevationGain,
          video_url,
        });

        // Segmentos (spec segmentos, Req 2.5): detecta e grava esforços de
        // segmento a partir dos pontos gravados (com timestamp). Best-effort —
        // já é try/catch interno em detectAndRecordEfforts; nunca bloqueia o
        // salvamento. Usa o id remoto da atividade quando disponível.
        void detectAndRecordEfforts(activityId, result.points, activityType ?? undefined);

        return finished;
      } catch (err) {
        const rateLimitMessage = mapRateLimitErrorToMessage(err);
        if (rateLimitMessage) {
          // Limite de chamadas atingido: nenhum efeito foi persistido pelo
          // rate limiter, então não faz sentido enfileirar para retry
          // imediato (voltaria a falhar até a janela expirar).
          throw new Error(rateLimitMessage);
        }
        // Offline / falha de rede: enfileira em IndexedDB para sincronização
        // posterior com o payload completo (Requirements 2.1, 2.2, 1.4) —
        // Activity_Type, ganho de elevação e o blob do snapshot já gerado
        // (quando houver). Se a geração do snapshot falhou, `snapshotBlob`
        // permanece `null` e o snapshot fica ausente (Requirement 2.5).
        await enqueueActivity({
          localId: crypto.randomUUID(),
          remoteId: activityId,
          startTime: new Date(Date.now() - result.elapsed * 1000).toISOString(),
          endTime: new Date().toISOString(),
          distance_meters: result.distance,
          duration_seconds: result.duration,
          elapsed_seconds: result.elapsed,
          route_geojson: result.route,
          activity_type: activityType ?? null,
          elevation_gain: result.elevationGain,
          map_snapshot_blob: snapshotBlob,
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
        // Tela comemorativa de atividade concluída (Rodada 3).
        navigate({ to: "/atividade/concluida/$activityId", params: { activityId: a.id } });
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

  // Clique em "Finalizar": no modo destino captura os pontos e abre o sheet de
  // criação de destino (não salva atividade no feed). Fora do modo destino,
  // segue o fluxo normal (sheet de descrição/foto/vídeo da atividade).
  const handleFinishClick = () => {
    if (isDestinationMode) {
      const result = tracker.finalize();
      const pts = result.points ?? [];
      if (pts.length < 2) {
        toast.error(t("destinationRecord.tooShort", { defaultValue: "Trajeto muito curto para virar um destino." }));
        return;
      }
      destResultRef.current = { points: pts };
      // A categoria do destino (tipo de lugar) é independente do tipo de
      // atividade — o usuário escolhe no sheet (default "trilha").
      setDestSheetOpen(true);
      return;
    }
    setFinishSheetOpen(true);
  };

  const handleDestImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDestImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setDestImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetDestForm = () => {
    setDestName("");
    setDestDesc("");
    setDestDifficulty("Moderada");
    setDestCategory("trilha");
    setDestImageFile(null);
    setDestImagePreview(null);
    destResultRef.current = null;
  };

  // Confirma a criação do destino pendente a partir da rota gravada.
  const submitDestination = async () => {
    const pts = destResultRef.current?.points;
    if (!pts || pts.length < 2) {
      toast.error(t("destinationRecord.tooShort", { defaultValue: "Trajeto muito curto para virar um destino." }));
      return;
    }
    if (!destName.trim()) {
      toast.error(t("destinationRecord.nameRequired", { defaultValue: "Dê um nome ao destino." }));
      return;
    }
    setSavingDest(true);
    try {
      const draft = buildDestinationDraft(pts);
      let mainImageUrl: string | null = null;
      if (destImageFile) {
        try {
          mainImageUrl = await uploadTrailImage(destImageFile);
        } catch {
          // Foto é opcional — falha no upload não impede a criação (design).
        }
      }
      await createDestinationFull({
        name: destName.trim(),
        description: destDesc.trim() || null,
        latitude: draft.startLat,
        longitude: draft.startLng,
        startLat: draft.startLat,
        startLng: draft.startLng,
        difficulty: destDifficulty,
        category: destCategory,
        type: destCategory,
        distanceKm: draft.distanceKm,
        elevation: draft.elevationGainM > 0 ? `${draft.elevationGainM} m` : null,
        mainImageUrl,
        routeGeojson: draft.routeGeojson,
        status: "pending",
      });
      // Descarta a atividade de trabalho (não vai para o feed nesse modo).
      if (activityId) await discardActivity(activityId).catch(() => {});
      tracker.reset();
      tracker.setActivityId(null);
      setDestSheetOpen(false);
      resetDestForm();
      toast.success(
        t("destinationRecord.sentForApproval", {
          defaultValue: "Rota enviada para aprovação dos administradores. Você será avisado quando for publicada.",
        }),
      );
      navigate({ to: "/explorar" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("destinationRecord.error", { defaultValue: "Não foi possível enviar a rota." }));
    } finally {
      setSavingDest(false);
    }
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
            {isDestinationMode ? t("destinationRecord.mode", { defaultValue: "Criar destino" }) : t("activity.trackTitle")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      {/* Modo destino: explica o fluxo (escolha a atividade → grave o trajeto →
          envie para aprovação). A categoria do lugar é definida ao finalizar. */}
      {isDestinationMode && isIdle && !tracker.hasOrphan && (
        <div className="mx-5 mt-3 rounded-2xl border border-[#f97316]/30 bg-[#f97316]/10 p-3 text-xs text-[#c2410c] dark:text-[#f97316]">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin size={14} /> {t("destinationRecord.banner.title", { defaultValue: "Você está criando um destino" })}
          </div>
          <p className="mt-1 leading-relaxed">
            {t("destinationRecord.banner.text", {
              defaultValue: "Escolha como vai se deslocar, grave o trajeto real indo até o local e, ao finalizar, envie para aprovação. O tipo de lugar (cachoeira, trilha…) você escolhe no final.",
            })}
          </p>
        </div>
      )}

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

      {/* Requirement 3.1/3.2/3.4: indicador visual explícito de pausa
          automática (estilo Strava), visualmente distinto da pausa manual
          (que exibe o botão "Retomar" sem este banner). Permanece visível
          enquanto o Auto_Pause estiver ativo e desaparece no auto-resume. */}
      {tracker.autoPaused && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-50 p-3 text-xs text-amber-700 animate-pulse">
          <PauseCircle size={16} />
          {t("activity.autoPaused")}
        </div>
      )}

      {/* Indicador de qualidade do sinal de GPS (Requirement 6.5/6.7/6.8):
          exibido durante o rastreamento apenas quando o estado é diferente
          de "bom"; some assim que o sinal fica bom. */}
      {(isTracking || isPaused) && tracker.gpsSignalState !== "bom" && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-50 p-3 text-xs text-amber-700">
          <Satellite size={16} />
          {tracker.gpsSignalState === "aquisitando" && t("activity.gpsSignal.aquisitando")}
          {tracker.gpsSignalState === "fraco" && t("activity.gpsSignal.fraco")}
          {tracker.gpsSignalState === "sem_sinal" && t("activity.gpsSignal.semSinal")}
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

      {/* Painel de gravação estilo Strava: Tempo em destaque no topo, depois
          Distância e métricas por tipo — grandes e centralizados. Só aparece
          durante a gravação/pausa. */}
      {(isTracking || isPaused) && (
        <div className="mx-5 mt-5 text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("activity.movingTime", { defaultValue: "Em movimento" })}
          </div>
          <div className="font-display text-6xl font-bold tabular-nums leading-none">
            {formatDuration(tracker.durationSeconds)}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("activity.metrics.distance")}
              </div>
              <div className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">
                {formatDistance(tracker.distanceMeters)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Elevação
              </div>
              <div className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">
                {tracker.elevationGainMeters > 0 ? `${Math.round(tracker.elevationGainMeters)}m` : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

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
        // Requirement 4.2/4.3/4.4/4.5: ao vivo, exibe a Smoothed_Speed
        // (velocidade instantânea suavizada), não a média — reflete o
        // movimento atual. "—" quando indisponível (null); zero durante
        // pausa. O ritmo médio permanece derivado dos totais.
        const smoothed = tracker.smoothedSpeedMps;
        const speedLabel = smoothed == null ? "—" : `${mpsToKmh(smoothed).toFixed(1)} km/h`;
        return (
          <div className="mx-5 mt-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("activity.metrics.currentSpeed")}
              </div>
              <div className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">
                {speedLabel}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("activity.metrics.pace")}
              </div>
              <div className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">
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
      {/* Seletor de tipo por ÍCONES (estilo Strava): faixa horizontal de
          atividades; o selecionado fica destacado. Substitui o dropdown. */}
      {isIdle && !tracker.hasOrphan && (
        <div className="mx-5 mt-5">
          <div className="mb-2 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("activity.activityTypeLabel")}
          </div>
          {/* overflow-x-auto SEM justify-center: com justify-center o primeiro
              item ficava cortado na borda esquerda quando a faixa transborda
              (não dava para rolar até ele). O inner `w-max mx-auto` centraliza
              quando cabe e, ao transbordar, começa da esquerda sem cortar.
              `px-1` garante folga nas bordas. */}
          <div className="overflow-x-auto scrollbar-hide pb-1">
            <div className="flex w-max mx-auto gap-2 px-1">
              {typeOptions.map((opt) => {
                const { Icon } = getActivityIcon(opt.iconKey);
                const active = activityType === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => { setActivityType(opt.code as ActivityType); tracker.setActivityType(opt.code); }}
                    aria-label={t(`activity.activityTypes.${opt.code}`, { defaultValue: opt.name })}
                    className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-base ${
                      active ? "bg-primary text-primary-foreground shadow-card" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <Icon size={22} aria-hidden />
                    <span className="text-[10px] font-medium">
                      {t(`activity.activityTypes.${opt.code}`, { defaultValue: opt.name })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mx-5 mt-4 flex flex-col gap-2">
        {isIdle && !tracker.hasOrphan && (
          <div className="flex flex-col items-center py-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={isSaving || !activityType}
              className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full text-white shadow-xl transition-transform active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: "#f97316" }}
              aria-label={t("activity.start")}
            >
              <Play size={28} fill="currentColor" />
              <span className="text-xs font-bold uppercase tracking-wide">{t("activity.startShort", "Iniciar")}</span>
            </button>
            {!activityType && (
              <span className="mt-2 text-[11px] text-muted-foreground">
                {t("activity.selectActivityType")}
              </span>
            )}
          </div>
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

        {/* Controles de gravação estilo Strava: botão circular central de
            pausar/retomar, com Finalizar e Descartar como botões laterais
            menores. */}
        {(isTracking || isPaused) && (
          <div className="flex items-center justify-center gap-6 py-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              aria-label={t("activity.discard")}
              className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground/70 shadow-card active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>

            {isTracking ? (
              <button
                type="button"
                onClick={tracker.pause}
                aria-label={t("activity.pause")}
                className="grid h-20 w-20 place-items-center rounded-full text-white shadow-xl active:scale-95"
                style={{ backgroundColor: "#f97316" }}
              >
                <Pause size={30} />
              </button>
            ) : (
              <button
                type="button"
                onClick={tracker.resume}
                aria-label={t("activity.resume")}
                className="grid h-20 w-20 place-items-center rounded-full text-white shadow-xl active:scale-95"
                style={{ backgroundColor: "#16a34a" }}
              >
                <Play size={30} />
              </button>
            )}

            <button
              type="button"
              onClick={handleFinishClick}
              disabled={isSaving}
              aria-label={t("activity.finish")}
              className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-card active:scale-95 disabled:opacity-50"
            >
              <Square size={18} />
            </button>
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

            {/* Vídeo opcional (Req 5) — limites 30 MB / 60 s. Desabilitado
                offline (Req 5.4): não enfileiramos blobs grandes. */}
            <div>
              <Label className="mb-2 block text-sm font-medium">{t("activity.addVideo")}</Label>
              <button
                onClick={() => {
                  if (!isOnline) {
                    toast.error(t("activity.videoOfflineDisabled"));
                    return;
                  }
                  finishVideoRef.current?.click();
                }}
                disabled={!isOnline}
                className="relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-6 text-muted-foreground transition-colors hover:bg-secondary active:scale-[0.98] disabled:opacity-50"
              >
                {videoPreview ? (
                  <video
                    src={videoPreview}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <>
                    <Video size={28} className="text-muted-foreground" />
                    <span className="text-sm">{t("activity.addVideo")}</span>
                    <span className="text-xs text-muted-foreground/70">
                      {isOnline ? t("activity.videoHint") : t("activity.videoOfflineDisabled")}
                    </span>
                  </>
                )}
                <input
                  ref={finishVideoRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={handleFinishVideoChange}
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

      {/* Item 5: lembrete de checklist ao iniciar trilha/escalada. */}
      <Sheet open={checklistReminderOpen} onOpenChange={setChecklistReminderOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display flex items-center gap-2">
              <ListChecks size={18} className="text-primary" />
              {t("activity.checklistReminder.title")}
            </SheetTitle>
            <SheetDescription>
              {t("activity.checklistReminder.description", {
                activity: t(`activity.activityTypes.${activityType ?? "trilha"}`, { defaultValue: activityType ?? "" }).toLowerCase(),
              })}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-2 pb-4">
            <Link
              to="/perfil"
              onClick={() => setChecklistReminderOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
            >
              <ListChecks size={16} /> {t("activity.checklistReminder.view")}
            </Link>
            <button
              onClick={proceedStart}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest py-3.5 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
            >
              <Play size={16} fill="currentColor" /> {t("activity.checklistReminder.proceed")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Item 4: overlay de CALIBRAÇÃO de GPS antes de iniciar. Mostra o
          estado do sinal (tracker.gpsSignalState) e, quando "bom", habilita
          o início; o usuário também pode forçar ("Iniciar mesmo assim"). */}
      {preStart === "calibrating" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary/10">
              <Satellite size={30} className="text-primary animate-pulse" />
            </div>
            <h2 className="font-display text-xl font-bold">
              {t("destinationRecord.calibrating.title", { defaultValue: "Calibrando GPS" })}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("destinationRecord.calibrating.description", {
                defaultValue: "Aguarde um sinal estável para um traçado preciso.",
              })}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  tracker.gpsSignalState === "bom"
                    ? "bg-green-500"
                    : tracker.gpsSignalState === "fraco"
                      ? "bg-amber-500"
                      : "bg-red-500 animate-pulse"
                }`}
              />
              {tracker.gpsSignalState === "bom" && t("destinationRecord.calibrating.good", { defaultValue: "Sinal bom" })}
              {tracker.gpsSignalState === "aquisitando" && t("activity.gpsSignal.aquisitando")}
              {tracker.gpsSignalState === "fraco" && t("activity.gpsSignal.fraco")}
              {tracker.gpsSignalState === "sem_sinal" && t("activity.gpsSignal.semSinal")}
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={beginCountdown}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest py-3.5 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
              >
                <Play size={16} fill="currentColor" />
                {tracker.gpsSignalState === "bom"
                  ? t("destinationRecord.calibrating.start", { defaultValue: "Iniciar" })
                  : t("destinationRecord.calibrating.startAnyway", { defaultValue: "Iniciar mesmo assim" })}
              </button>
              <button
                type="button"
                onClick={() => setPreStart(null)}
                className="w-full rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground active:scale-[0.98] transition-transform"
              >
                {t("common.cancel", { defaultValue: "Cancelar" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item 4: overlay de CONTAGEM regressiva 3-2-1 antes do start efetivo. */}
      {preStart === "countdown" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm">
          <div className="text-center">
            <div className="font-display text-[7rem] font-bold leading-none text-primary tabular-nums">
              {countdown > 0 ? countdown : "GO"}
            </div>
            <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">
              {t("destinationRecord.countdown.getReady", { defaultValue: "Prepare-se" })}
            </p>
          </div>
        </div>
      )}

      {/* Item 4: sheet de criação de DESTINO ao finalizar em modo destino.
          A rota gravada vira um destino pendente para aprovação admin. */}
      <Sheet
        open={destSheetOpen}
        onOpenChange={(open) => {
          if (!open && !savingDest) {
            // Fechar sem confirmar descarta a atividade de trabalho e reseta.
            if (activityId) discardActivity(activityId).catch(() => {});
            tracker.reset();
            tracker.setActivityId(null);
            resetDestForm();
          }
          setDestSheetOpen(open);
        }}
      >
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">
              {t("destinationRecord.sheet.title", { defaultValue: "Enviar rota como destino" })}
            </SheetTitle>
            <SheetDescription>
              {t("destinationRecord.sheet.description", {
                defaultValue: "Preencha os dados. Será revisado pelos administradores antes de aparecer no Explorar.",
              })}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-4">
            <div>
              <Label className="mb-2 block text-sm font-medium">
                {t("destinationRecord.sheet.name", { defaultValue: "Nome do destino" })}
              </Label>
              <input
                value={destName}
                onChange={(e) => setDestName(e.target.value)}
                placeholder={t("destinationRecord.sheet.namePlaceholder", { defaultValue: "Ex.: Cachoeira do Vale" })}
                className="w-full rounded-xl border border-border bg-card p-3.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">
                {t("destinationRecord.sheet.desc", { defaultValue: "Descrição" })}
              </Label>
              <textarea
                value={destDesc}
                onChange={(e) => setDestDesc(e.target.value)}
                placeholder={t("destinationRecord.sheet.descPlaceholder", { defaultValue: "Conte como é o trajeto, o que ver, cuidados..." })}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-card p-3.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">
                {t("destinationRecord.sheet.difficulty", { defaultValue: "Dificuldade" })}
              </Label>
              <div className="flex flex-wrap gap-2">
                {["Fácil", "Moderada", "Difícil"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDestDifficulty(d)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-base ${
                      destDifficulty === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">
                {t("destinationRecord.sheet.category", { defaultValue: "Categoria" })}
              </Label>
              <div className="flex flex-wrap gap-2">
                {["trilha", "cachoeira", "montanha", "praia", "ciclismo", "outro"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDestCategory(c)}
                    className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-base ${
                      destCategory === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">
                {t("destinationRecord.sheet.photo", { defaultValue: "Foto (opcional)" })}
              </Label>
              <button
                type="button"
                onClick={() => destFileRef.current?.click()}
                className="relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-6 text-muted-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                {destImagePreview ? (
                  <img src={destImagePreview} alt="Preview" className="h-40 w-full rounded-xl object-cover" />
                ) : (
                  <>
                    <Camera size={28} className="text-muted-foreground" />
                    <span className="text-sm">{t("destinationRecord.sheet.addPhoto", { defaultValue: "Adicionar foto" })}</span>
                  </>
                )}
                <input
                  ref={destFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleDestImageChange}
                />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDestSheetOpen(false)}
                disabled={savingDest}
                className="flex-1 rounded-xl border border-destructive/30 bg-destructive/10 py-3.5 text-sm font-semibold text-destructive active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <Trash2 size={14} className="inline mr-1 -mt-0.5" />
                {t("activity.discard")}
              </button>
              <button
                type="button"
                onClick={submitDestination}
                disabled={savingDest || !destName.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50 disabled:active:scale-100 active:scale-[0.98] transition-transform"
              >
                {savingDest ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                {t("destinationRecord.sheet.submit", { defaultValue: "Enviar para aprovação" })}
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
              navigate({ to: "/atividade/concluida/$activityId", params: { activityId: id } });
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
