import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, Flag, Loader2, MapPin, Globe, Users, Lock, Trash2 } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchSegmentById,
  fetchActivityTypes,
  updateSegment,
  deleteSegment,
  type SegmentVisibility,
} from "@/lib/api";
import type { LatLng } from "@/components/SegmentDrawMap";

const SegmentDrawMap = lazy(() => import("@/components/SegmentDrawMap"));

export const Route = createFileRoute("/segmento/editar/$segmentId")({
  component: EditSegmentPage,
  head: () => ({
    meta: [
      { title: "Editar segmento — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/segmento/editar" }],
  }),
});

function EditSegmentPage() {
  const { segmentId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();

  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState<string>("");
  const [visibility, setVisibility] = useState<SegmentVisibility>("public");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: segment, isLoading } = useQuery({
    queryKey: ["segment", segmentId],
    queryFn: () => fetchSegmentById(segmentId),
  });
  const { data: types = [] } = useQuery({
    queryKey: ["activity-types"],
    queryFn: fetchActivityTypes,
  });

  // Carrega os valores atuais uma vez.
  useEffect(() => {
    if (segment && !loaded) {
      setName(segment.name);
      setActivityType(segment.activity_type ?? "");
      setVisibility(segment.visibility ?? "public");
      if (segment.start_lat != null && segment.start_lng != null) {
        setStart({ lat: segment.start_lat, lng: segment.start_lng });
      }
      if (segment.end_lat != null && segment.end_lng != null) {
        setEnd({ lat: segment.end_lat, lng: segment.end_lng });
      }
      setLoaded(true);
    }
  }, [segment, loaded]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!start || !end) throw new Error(t("segments.markBoth", "Marque o início e o fim no mapa."));
      if (!name.trim()) throw new Error(t("segments.nameRequired", "Dê um nome ao segmento."));
      if (!activityType) throw new Error(t("segments.typeRequired", "Escolha a modalidade do segmento."));
      const polyline: [number, number][] = [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ];
      return updateSegment(segmentId, {
        name: name.trim(),
        activityType,
        visibility,
        polyline,
      });
    },
    onSuccess: () => {
      toast.success(t("segments.updated", "Segmento atualizado!"));
      qc.invalidateQueries({ queryKey: ["segment", segmentId] });
      qc.invalidateQueries({ queryKey: ["my-segments"] });
      navigate({ to: "/segmento/$segmentId", params: { segmentId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSegment(segmentId),
    onSuccess: () => {
      toast.success(t("segments.deleted", "Segmento excluído."));
      qc.invalidateQueries({ queryKey: ["my-segments"] });
      navigate({ to: "/perfil" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOwner = segment && segment.created_by === user?.id;

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="mx-5 mt-4 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-[340px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (segment && !isOwner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold">{t("segments.notOwner", "Só o criador pode editar este segmento.")}</h1>
        <button onClick={() => window.history.back()} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          {t("common.back", "Voltar")}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-float-up pb-24">
      <StatusBar />
      <div className="flex items-center gap-3 px-5 pt-2">
        <button onClick={() => window.history.back()} className="grid h-9 w-9 place-items-center rounded-full bg-muted">
          <ChevronLeft size={18} />
        </button>
        <h1 className="flex-1 truncate font-display text-lg font-semibold">
          {t("segments.editTitle", "Editar segmento")}
        </h1>
      </div>

      <p className="mx-5 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin size={12} /> {t("segments.editHint", "Toque no mapa para remarcar início e fim.")}
      </p>

      <div className="mx-5 mt-3">
        <Suspense fallback={<Skeleton className="h-[340px] w-full rounded-2xl" />}>
          <SegmentDrawMap
            start={start}
            end={end}
            center={start}
            onChange={({ start: s, end: e }) => { setStart(s); setEnd(e); }}
          />
        </Suspense>
      </div>

      <div className="mx-5 mt-3 flex gap-2 text-xs">
        <span className={`flex-1 rounded-xl px-3 py-2 text-center ${start ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
          {start ? t("segments.startSet", "Início marcado") : t("segments.startPending", "Marque o início")}
        </span>
        <span className={`flex-1 rounded-xl px-3 py-2 text-center ${end ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
          {end ? t("segments.endSet", "Fim marcado") : t("segments.endPending", "Marque o fim")}
        </span>
      </div>

      <div className="mx-5 mt-4 space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("segments.namePlaceholder", "Nome do segmento")}
          maxLength={80}
        />
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            {t("segments.typeLabel", "Modalidade (obrigatória — o ranking é por modalidade)")}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {types.map((tp) => (
              <button
                key={tp.code}
                type="button"
                onClick={() => setActivityType(tp.code)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-base ${
                  activityType === tp.code ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {t(`activity.activityTypes.${tp.code}`, { defaultValue: tp.name })}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            {t("segments.visibility.label", "Quem pode ver")}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "public" as const, Icon: Globe, label: t("segments.visibility.public", "Público") },
              { v: "friends" as const, Icon: Users, label: t("segments.visibility.friends", "Amigos") },
              { v: "private" as const, Icon: Lock, label: t("segments.visibility.private", "Só eu") },
            ]).map(({ v, Icon, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-xs font-medium transition-base ${
                  visibility === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-secondary-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          className="h-12 w-full rounded-2xl text-sm font-semibold"
          disabled={!start || !end || !name.trim() || !activityType || saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Flag size={16} className="mr-2" />}
          {t("common.save", "Salvar")}
        </Button>

        <button
          onClick={() => {
            if (window.confirm(t("segments.confirmDelete", "Excluir este segmento? Esta ação não pode ser desfeita."))) {
              deleteMut.mutate();
            }
          }}
          disabled={deleteMut.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 py-3 text-sm font-semibold text-destructive active:scale-[0.99] disabled:opacity-50"
        >
          <Trash2 size={16} /> {t("segments.delete", "Excluir segmento")}
        </button>
      </div>
    </div>
  );
}
