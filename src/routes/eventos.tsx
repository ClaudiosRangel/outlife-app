import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Users, Plus, MessageCircle, Loader2, Image as ImageIcon, CalendarPlus, Pencil } from "lucide-react";
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
  meeting_point: string | null;
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
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // "now" fixado no mount para evitar hydration mismatch (server vs client timezone)
  const [now] = useState(() => new Date());

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
          const isPast = new Date(event.event_date) < now;
          return (
            <div key={event.id} className={`rounded-2xl bg-card overflow-hidden shadow-card ${isPast ? "opacity-75" : ""}`}>
              <Link to="/eventos/$eventId" params={{ eventId: event.id }} className="block">
              {event.image_url && (
                <div className="relative aspect-[2.5/1] w-full">
                  <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
                  {isPast && <div className="absolute inset-0 bg-black/20" />}
                </div>
              )}
              <div className="p-4">
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
                  {(event as any).meeting_point && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} className="text-primary" />
                      <span className="font-medium">Encontro: {(event as any).meeting_point}</span>
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
              </div>
              </Link>
              <div className="px-4 pb-4">
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
                <button onClick={() => setDetailEvent(event)} className="grid h-9 w-9 place-items-center rounded-xl border border-border">
                  <MessageCircle size={14} />
                </button>
                {user?.id === event.created_by && (
                  <button onClick={() => { setDetailEvent(event); setEditOpen(true); }} className="text-[10px] font-medium text-primary underline">
                    Editar
                  </button>
                )}
              </div>
              )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Sheet criar evento */}
      <CreateEventSheet open={createOpen} onOpenChange={setCreateOpen} />

      {/* Sheet detalhe/edição do evento */}
      <EventDetailSheet event={detailEvent} open={!!detailEvent && !editOpen} onClose={() => setDetailEvent(null)} onEdit={() => setEditOpen(true)} />
      <EditEventSheet event={detailEvent} open={editOpen} onClose={() => { setEditOpen(false); setDetailEvent(null); }} />

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
  const [meetingPoint, setMeetingPoint] = useState("");
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
        meeting_point: meetingPoint.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento criado!");
      qc.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
      setTitle(""); setDescription(""); setEventDate(""); setMaxParticipants(""); setDestinationId(""); setMeetingPoint(""); setImageFile(null); setImagePreview(null);
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
            <Label className="mb-1 text-sm font-medium">Ponto de encontro</Label>
            <input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} placeholder="Ex: Portaria do parque, estacionamento principal" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
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


/* ====== Sheet de detalhe do evento ====== */
function EventDetailSheet({ event, open, onClose, onEdit }: { event: EventItem | null; open: boolean; onClose: () => void; onEdit: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");

  // Perguntas/mensagens do evento
  const { data: messages = [] } = useQuery({
    queryKey: ["event-questions", event?.id],
    queryFn: async () => {
      if (!event) return [];
      const { data } = await supabase
        .from("event_questions" as never)
        .select("id, author_id, text, answer, answered_at, created_at, author:author_id(full_name, avatar_url)")
        .eq("event_id", event.id)
        .eq("is_private", false)
        .order("created_at", { ascending: true });
      return (data ?? []) as Array<{
        id: string;
        author_id: string;
        text: string;
        answer: string | null;
        answered_at: string | null;
        created_at: string;
        author: { full_name: string | null; avatar_url: string | null } | null;
      }>;
    },
    enabled: open && !!event,
    refetchInterval: open ? 5000 : false, // atualiza a cada 5s enquanto aberto
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!user || !event) throw new Error("Não autenticado");
      if (!msg.trim()) return;
      const { error } = await supabase
        .from("event_questions" as never)
        .insert({
          event_id: event.id,
          author_id: user.id,
          text: msg.trim(),
          is_private: false,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: ["event-questions", event?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!event) return null;
  const isCreator = user?.id === event.created_by;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="font-display flex items-center gap-2">
            <MessageCircle size={18} className="text-primary" />
            {event.title}
            {isCreator && (
              <button onClick={onEdit} className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                <Pencil size={14} />
              </button>
            )}
          </SheetTitle>
          <SheetDescription>
            {event.destination?.name ?? event.category} • {new Date(event.event_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            {(event as any).meeting_point ? ` • Encontro: ${(event as any).meeting_point}` : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Área de mensagens (scroll) */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem ainda. Inicie a conversa!</p>
          )}
          {messages.map((m) => {
            const isMe = m.author_id === user?.id;
            return (
              <div key={m.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                <div className="h-7 w-7 flex-shrink-0 rounded-full bg-primary/10 grid place-items-center text-[10px] font-bold text-primary">
                  {(m.author?.full_name ?? "?")[0]?.toUpperCase()}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {!isMe && (
                    <div className="text-[10px] font-semibold opacity-70 mb-0.5">{m.author?.full_name ?? "Alguém"}</div>
                  )}
                  <p className="text-sm leading-relaxed">{m.text}</p>
                  <div className={`text-[9px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input de mensagem (fixo no fundo) */}
        {user ? (
          <div className="flex-shrink-0 border-t border-border pt-3 pb-1">
            <div className="flex gap-2">
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMut.mutate(); } }}
                placeholder="Escreva uma mensagem..."
                className="flex-1 h-10 rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-1 ring-ring"
              />
              <button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending || !msg.trim()}
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              >
                {sendMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground py-3 border-t border-border">
            Faça login para participar da conversa
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ====== Sheet de edição do evento (só criador) ====== */
function EditEventSheet({ event, open, onClose }: { event: EventItem | null; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [eventDate, setEventDate] = useState("");

  useEffect(() => {
    if (event && open) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setMeetingPoint((event as any).meeting_point ?? "");
      setMaxParticipants(event.max_participants?.toString() ?? "");
      // Converter ISO para datetime-local format
      if (event.event_date) {
        const d = new Date(event.event_date);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setEventDate(local);
      }
    }
  }, [event, open]);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!user || !event) throw new Error("Erro");
      if (!title.trim()) throw new Error("Título obrigatório");
      const { error } = await supabase
        .from("events" as never)
        .update({
          title: title.trim(),
          description: description.trim() || null,
          meeting_point: meetingPoint.trim() || null,
          max_participants: maxParticipants ? parseInt(maxParticipants) : null,
          event_date: eventDate ? new Date(eventDate).toISOString() : undefined,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento atualizado!");
      qc.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!event) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Editar evento</SheetTitle>
          <SheetDescription>Altere as informações do evento</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="mb-1 text-sm font-medium">Título *</Label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Data e hora</Label>
            <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Vagas</Label>
            <input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="Sem limite" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Ponto de encontro</Label>
            <input value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} placeholder="Ex: Portaria do parque" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Descrição</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-border bg-card p-3 text-sm resize-none outline-none focus:ring-1 ring-ring" />
          </div>
          <Button className="w-full h-12 rounded-xl" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
            {updateMut.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Pencil size={16} className="mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
