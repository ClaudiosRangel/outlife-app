// Admin: criar destino a partir de um arquivo GPX (Bloco 3, Fase D). Faz upload
// do GPX (parse local), busca elevação (Open-Meteo), preview do traçado, e
// grava o destino APROVADO com foto + dados. Só admins (admin_emails).

import { lazy, Suspense, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Upload, Loader2, ImagePlus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { parseGpx, buildElevationProfile, elevationGain, type GpxRoute } from "@/lib/gpx-import";
import { fetchElevations } from "@/lib/weather-forecast";
import { createDestinationFull, uploadTrailImage } from "@/lib/api";

const DestinationRouteMap = lazy(() => import("@/components/DestinationRouteMap"));

export const Route = createFileRoute("/admin/destino-novo")({
  component: AdminDestinoNovoPage,
  head: () => ({ meta: [{ title: "Novo destino — OutVitar Admin" }, { name: "robots", content: "noindex" }] }),
});

const DIFFICULTIES = ["Fácil", "Moderada", "Difícil", "Avançada", "Muito difícil"];
const CATEGORIES = ["cachoeira", "pico", "parque", "trilha", "montanha"];

function AdminDestinoNovoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      const { data } = await supabase.from("admin_emails" as never).select("id").eq("email", user.email).maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const [route, setRoute] = useState<GpxRoute | null>(null);
  const [elevProfile, setElevProfile] = useState<{ d: number; e: number | null }[] | null>(null);
  const [gain, setGain] = useState<number | null>(null);
  const [parsing, setParsing] = useState(false);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  // Campos editáveis (pré-preenchidos pelo GPX).
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [state, setState] = useState("");
  const [difficulty, setDifficulty] = useState("Fácil");
  const [category, setCategory] = useState("cachoeira");
  const [isPaid, setIsPaid] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [petFriendly, setPetFriendly] = useState(false);

  const handleGpx = async (file: File) => {
    setParsing(true);
    try {
      const xml = await file.text();
      const r = parseGpx(xml);
      setRoute(r);
      setName(r.name ?? "");
      setDescription(r.description ?? "");
      // Elevação (Open-Meteo) quando o GPX não traz.
      let eles: (number | null)[] = r.points.map((p) => p.ele);
      if (!r.hasElevation) {
        eles = await fetchElevations(r.points.map((p) => ({ lat: p.lat, lng: p.lng })));
      }
      setElevProfile(buildElevationProfile(r.points, eles));
      setGain(elevationGain(eles));
      toast.success(`GPX lido: ${r.points.length} pontos, ${(r.distanceMeters / 1000).toFixed(2)} km`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "GPX inválido");
    } finally {
      setParsing(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!route || route.points.length < 2) throw new Error("Envie um GPX válido primeiro.");
      if (!name.trim()) throw new Error("Informe o nome do destino.");
      let mainImageUrl: string | null = null;
      if (imgFile) mainImageUrl = await uploadTrailImage(imgFile);
      const start = route.start!;
      const distanceKm = +(route.distanceMeters / 1000).toFixed(2);
      return createDestinationFull({
        name: name.trim(),
        description: description.trim() || null,
        latitude: start.lat,
        longitude: start.lng,
        startLat: start.lat,
        startLng: start.lng,
        region: region.trim() || null,
        state: state.trim() || null,
        difficulty,
        category,
        type: category.charAt(0).toUpperCase() + category.slice(1),
        distanceKm,
        isPaid,
        priceText: isPaid ? (priceText.trim() || null) : null,
        openingHours: openingHours.trim() || null,
        petFriendly,
        mainImageUrl,
        routeGeojson: route.geojson,
        elevationProfile: elevProfile,
        elevation: gain != null ? `${gain}m` : null,
        status: "approved",
      });
    },
    onSuccess: (r) => {
      toast.success("Destino criado e aprovado!");
      navigate({ to: "/destino/$destinationId", params: { destinationId: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-8 text-center text-sm text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  const coords = route?.points.map((p) => ({ lat: p.lat, lng: p.lng })) ?? [];

  return (
    <div className="pb-28">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/admin/destinos" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Novo destino (GPX)</span>
          <span className="w-9" />
        </div>
      </div>

      <div className="mx-5 mt-4 space-y-4">
        {/* Upload GPX */}
        <input ref={gpxInputRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGpx(f); e.currentTarget.value = ""; }} />
        <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => gpxInputRef.current?.click()} disabled={parsing}>
          {parsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {route ? "Trocar GPX" : "Enviar arquivo GPX"}
        </Button>

        {route && (
          <>
            <div className="rounded-2xl bg-card p-3 text-xs text-muted-foreground shadow-card">
              {route.points.length} pontos · {(route.distanceMeters / 1000).toFixed(2)} km
              {gain != null && ` · ganho ${gain} m`}
            </div>

            {/* Preview do traçado */}
            {coords.length >= 2 && (
              <Suspense fallback={null}>
                <DestinationRouteMap path={coords} height={200} />
              </Suspense>
            )}

            {/* Foto */}
            <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImgFile(f); setImgPreview(URL.createObjectURL(f)); } e.currentTarget.value = ""; }} />
            <button onClick={() => imgInputRef.current?.click()} className="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card">
              {imgPreview ? <img src={imgPreview} alt="" className="h-full w-full object-cover" /> : <span className="flex items-center gap-2 text-sm text-muted-foreground"><ImagePlus size={18} /> Adicionar foto</span>}
            </button>

            {/* Campos */}
            <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl" /></Field>
            <Field label="Descrição (Sobre a trilha)">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                className="w-full rounded-2xl border border-border bg-card p-3 text-sm" />
            </Field>
            <div className="flex gap-2">
              <Field label="Região/Cidade" className="flex-1"><Input value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-2xl" /></Field>
              <Field label="UF" className="w-20"><Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} className="rounded-2xl" /></Field>
            </div>

            <Field label="Dificuldade">
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <Chip key={d} active={difficulty === d} label={d} onClick={() => setDifficulty(d)} />
                ))}
              </div>
            </Field>
            <Field label="Categoria">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Chip key={c} active={category === c} label={c} onClick={() => setCategory(c)} />
                ))}
              </div>
            </Field>

            <div className="space-y-2">
              <ToggleRow on={isPaid} onClick={() => setIsPaid((v) => !v)} label="Passeio pago" />
              {isPaid && <Field label="Valor (texto)"><Input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="Ex.: R$ 10,00 por pessoa" className="rounded-2xl" /></Field>}
              <ToggleRow on={petFriendly} onClick={() => setPetFriendly((v) => !v)} label="Pet friendly" />
            </div>
            <Field label="Horário de funcionamento"><Input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Ex.: Fins de semana e feriados, 8h às 17h" className="rounded-2xl" /></Field>
          </>
        )}
      </div>

      {route && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)] backdrop-blur">
          <Button className="h-12 w-full rounded-2xl bg-[#f97316] hover:bg-[#ea6a0c]" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
            Criar e publicar destino
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-base ${active ? "bg-[#f97316] text-white" : "bg-secondary text-secondary-foreground"}`}>
      {label}
    </button>
  );
}

function ToggleRow({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-secondary/60 px-3 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-base ${on ? "bg-[#f97316]" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-base ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
