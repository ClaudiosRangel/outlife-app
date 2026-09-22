import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, Flag, Loader2, MapPin } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { createSegment, fetchMyProfile, fetchActivityTypes } from "@/lib/api";
import type { LatLng } from "@/components/SegmentDrawMap";

const SegmentDrawMap = lazy(() => import("@/components/SegmentDrawMap"));

export const Route = createFileRoute("/segmento/criar")({
  component: CreateSegmentPage,
  head: () => ({
    meta: [
      { title: "Criar segmento — OutVitar" },
      { name: "description", content: "Crie um segmento marcando início e fim no mapa." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/segmento/criar" }],
  }),
});

function CreateSegmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });
  const { data: types = [] } = useQuery({
    queryKey: ["activity-types"],
    queryFn: fetchActivityTypes,
  });

  const center: LatLng | null =
    profile?.latitude != null && profile?.longitude != null
      ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
      : null;

  const createMut = useMutation({
    mutationFn: async () => {
      if (!start || !end) throw new Error(t("segments.markBoth", "Marque o início e o fim no mapa."));
      if (!name.trim()) throw new Error(t("segments.nameRequired", "Dê um nome ao segmento."));
      // Polilinha simples início→fim ([lng,lat]). O matcher usa início/fim +
      // distância; uma reta de 2 pontos é suficiente para o esforço básico.
      const polyline: [number, number][] = [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ];
      return createSegment({ name: name.trim(), activityType: activityType || null, polyline });
    },
    onSuccess: (seg) => {
      toast.success(t("segments.created", "Segmento criado!"));
      navigate({ to: "/segmento/$segmentId", params: { segmentId: seg.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="animate-float-up pb-24">
      <StatusBar />
      <div className="flex items-center gap-3 px-5 pt-2">
        <button onClick={() => window.history.back()} className="grid h-9 w-9 place-items-center rounded-full bg-muted">
          <ChevronLeft size={18} />
        </button>
        <h1 className="flex-1 truncate font-display text-lg font-semibold">
          {t("segments.createTitle", "Criar segmento")}
        </h1>
      </div>

      <p className="mx-5 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin size={12} /> {t("segments.mapHint", "Toque no mapa para marcar o início e depois o fim.")}
      </p>

      <div className="mx-5 mt-3">
        <Suspense fallback={<Skeleton className="h-[340px] w-full rounded-2xl" />}>
          <SegmentDrawMap
            start={start}
            end={end}
            center={center}
            onChange={({ start: s, end: e }) => {
              setStart(s);
              setEnd(e);
            }}
          />
        </Suspense>
      </div>

      {/* Estado dos pontos */}
      <div className="mx-5 mt-3 flex gap-2 text-xs">
        <span className={`flex-1 rounded-xl px-3 py-2 text-center ${start ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
          {start ? t("segments.startSet", "Início marcado") : t("segments.startPending", "Marque o início")}
        </span>
        <span className={`flex-1 rounded-xl px-3 py-2 text-center ${end ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
          {end ? t("segments.endSet", "Fim marcado") : t("segments.endPending", "Marque o fim")}
        </span>
      </div>
      {(start || end) && (
        <button
          onClick={() => { setStart(null); setEnd(null); }}
          className="mx-5 mt-2 text-xs font-medium text-muted-foreground underline"
        >
          {t("segments.clearPoints", "Limpar pontos")}
        </button>
      )}

      <div className="mx-5 mt-4 space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("segments.namePlaceholder", "Nome do segmento (ex.: Subida do Cristo)")}
          maxLength={80}
        />
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {types.map((tp) => (
            <button
              key={tp.code}
              type="button"
              onClick={() => setActivityType(activityType === tp.code ? "" : tp.code)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-base ${
                activityType === tp.code ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t(`activity.activityTypes.${tp.code}`, { defaultValue: tp.name })}
            </button>
          ))}
        </div>
        <Button
          className="h-12 w-full rounded-2xl text-sm font-semibold"
          disabled={!start || !end || !name.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Flag size={16} className="mr-2" />}
          {t("segments.create", "Criar segmento")}
        </Button>
      </div>
    </div>
  );
}
