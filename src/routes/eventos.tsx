import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Users, Plus, MessageCircle, Loader2, Image as ImageIcon, CalendarPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/eventos")({
  component: EventosPage,
  head: () => ({
    meta: [
      { title: "Eventos — Outlife" },
      { name: "description", content: "Encontre e crie eventos outdoor com a comunidade." },
    ],
    links: [{ rel: "canonical", href: "/eventos" }],
  }),
});

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  event_date: string;
  image_url: string | null;
  max_participants: number | null;
  status: string;
  created_by: string;
  destination: { id: string; name: string; region: string | null } | null;
  creator: { full_name: string | null; avatar_url: string | null } | null;
  participants_count: number;
};

const EVENT_CATEGORIES = ["trilha", "pedalada", "caminhada", "camping", "escalada", "caiaque", "outro"] as const;

function EventosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events" as never)
        .select("*, destination:destinations(id, name, region), creator:created_by(full_name, avatar_url)")
        .eq("status", "active")
        .order("event_date", { ascending: false });
      if (error) return [];

      // Contar participantes por evento
      const eventIds = (data ?? []).map((e: any) => e.id);
      const { data: counts } = await supabase
        .from("event_participants" as never)
        .select("event_id")
        .in("event_id", eventIds)
        .eq("status", "confirmed");

      const countMap = new Map<string, number>();
      for (const row of (counts ?? []) as any[]) {
        countMap.set(row.event_id, (countMap.get(row.event_id) ?? 0) + 1);
      }

      return (data ?? []).map((e: any) => ({
        ...e,
        participants_count: countMap.get(e.id) ?? 0,
      })) as EventItem[];
    },
  });

  // Meus eventos confirmados (para mostrar badge "Confirmado")
  const { data: myParticipations = [] } = useQuery({
    queryKey: ["my-event-participations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("event_participants" as never)
        .select("event_id, status")
        .eq("user_id", user.id);
      return (data ?? []) as Array<{ event_id: string; status: string }>;
    },
    enabled: !!user,
  });

  const myConfirmedIds = new Set(myParticipations.filter((p) => p.status === "confirmed").map((p) => p.event_id));

  const joinMut = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("event_participants" as never)
        .upsert({ event_id: eventId, user_id: user.id, status: "confirmed" } as never, { onConflict: "event_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presença confirmada!");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["my-event-participations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveMut = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("event_participants" as never)
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presença cancelada");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["my-event-participations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="pb-24 animate-float-up">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Eventos</span>
          {user && (
            <button onClick={() => setCreateOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
              <Plus size={16} />
            </button>
          )}
          {!user && <span className="w-9" />}
        </div>
      </div>

      <section className="px-5 mt-4 space-y-3">
        {isLoading && [0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
        ))}

        {!isLoading && events.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            <Calendar size={32} className="mx-auto mb-2 opacity-40" />
            <p>Nenhum evento próximo. Que tal criar um?</p>
          </div>
        )}

        {events.map((event) => {
          const isConfirmed = myConfirmedIds.has(event.id);
          const isFull = event.max_participants != null && event.participants_count >= event.max_participants;
          const isPast = new Date(event.event_date) < new Date();
          return (
            <div key={event.id} className={`rounded-2xl bg-card p-4 shadow-card ${isPast ? "opacity-75" : ""}`}>
              <Link to="/eventos/$eventId" params={{ eventId: event.id }} className="block">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-semibold truncate">{event.title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar size={12} />
                    <span>{new Date(event.event_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {event.destination && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} />
                      <span>{event.destination.name}</span>
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users size={12} />
                    <span>{event.participants_count} confirmados{event.max_participants ? ` / ${event.max_participants} vagas` : ""}</span>
                  </div>
                  {event.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                    {event.category}
                  </span>
                  {isPast && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Realizado
                    </span>
                  )}
                </div>
              </div>
              </Link>
              {isPast ? (
                <div className="mt-3">
                  <span className="block w-full rounded-xl bg-muted py-2.5 text-center text-xs font-medium text-muted-foreground">
                    ✓ Evento realizado
                  </span>
                </div>
              ) : (
              <div className="mt-3 flex gap-2">
                {isConfirmed ? (
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => leaveMut.mutate(event.id)} disabled={leaveMut.isPending}>
                    ✓ Confirmado (cancelar)
                  </Button>
                ) : (
                  <Button size="sm" className="flex-1 rounded-xl" onClick={() => { if (!user) { navigate({ to: "/login" }); return; } joinMut.mutate(event.id); }} disabled={joinMut.isPending || isFull}>
                    {isFull ? "Lotado" : "Confirmar presença"}
                  </Button>
                )}
                <Link to="/eventos/$eventId" params={{ eventId: event.id }} className="grid h-9 w-9 place-items-center rounded-xl border border-border">
                  <MessageCircle size={14} />
                </Link>
              </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Sheet criar evento */}
      <CreateEventSheet open={createOpen} onOpenChange={setCreateOpen} />

      {/* FAB — Botão flutuante para criar evento (estilo Instagram) */}
      {user && (
        <button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90 hover:shadow-xl"
          aria-label="Criar evento"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

function CreateEventSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("trilha");
  const [eventDate, setEventDate] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [destinationId, setDestinationId] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Carregar destinos para o select
  const { data: destinations = [] } = useQuery({
    queryKey: ["destinations-for-event"],
    queryFn: async () => {
      const { data } = await supabase
        .from("destinations")
        .select("id, name, region")
        .eq("status", "approved")
        .order("name");
      return (data ?? []) as Array<{ id: string; name: string; region: string | null }>;
    },
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!title.trim()) throw new Error("Título obrigatório");
      if (!eventDate) throw new Error("Data obrigatória");

      // Upload da imagem de banner se houver
      let imageUrl: string | null = null;
      if (imageFile) {
        const { resizeImageForUpload } = await import("@/lib/image-resize");
        const optimized = await resizeImageForUpload(imageFile);
        const ext = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
        const path = `events/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("community-post-images")
          .upload(path, optimized, { upsert: false, contentType: imageFile.type });
        if (upErr) throw new Error("Erro no upload da imagem: " + upErr.message);
        const { data: pub } = supabase.storage.from("community-post-images").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      const { error } = await supabase.from("events" as never).insert({
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category,
        event_date: new Date(eventDate).toISOString(),
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        destination_id: destinationId || null,
        image_url: imageUrl,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento criado!");
      qc.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
      setTitle(""); setDescription(""); setEventDate(""); setMaxParticipants(""); setDestinationId(""); setImageFile(null); setImagePreview(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Criar evento</SheetTitle>
          <SheetDescription>Organize uma aventura com a comunidade</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {/* Banner/Imagem — estilo Instagram story */}
          <div>
            <Label className="mb-1.5 text-sm font-medium">Capa do evento</Label>
            <button
              onClick={() => fileRef.current?.click()}
              className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-primary/5 via-secondary/30 to-primary/10 transition-all hover:border-primary/40 hover:shadow-lg active:scale-[0.98]"
            >
              {imagePreview ? (
                <div className="relative aspect-[16/9] w-full">
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                    Trocar imagem
                  </span>
                </div>
              ) : (
                <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 text-muted-foreground">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
                    <ImageIcon size={22} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium">Adicionar banner</span>
                  <span className="text-[11px] text-muted-foreground/70">JPG, PNG ou WEBP • Recomendado 16:9</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
            </button>
          </div>

          <div>
            <Label className="mb-1 text-sm font-medium">Título *</Label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Trilha do Pico da Bandeira" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Destino</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione um destino" /></SelectTrigger>
              <SelectContent>
                {destinations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} — {d.region}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Data e hora *</Label>
            <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Vagas (opcional)</Label>
            <input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="Sem limite" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Descrição</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do evento, ponto de encontro, o que levar..." rows={3} className="w-full rounded-xl border border-border bg-card p-3 text-sm resize-none outline-none focus:ring-1 ring-ring" />
          </div>
          <Button className="w-full h-12 rounded-xl" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <CalendarPlus size={16} className="mr-2" />}
            Criar evento
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
