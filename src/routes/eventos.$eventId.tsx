import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Users, MessageCircle, Lock, Send, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/eventos/$eventId")({
  component: EventDetailPage,
  head: () => ({
    meta: [
      { title: "Evento — Outlife" },
      { name: "description", content: "Detalhes do evento outdoor." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  event_date: string;
  event_end_date: string | null;
  max_participants: number | null;
  image_url: string | null;
  status: string;
  created_by: string;
  destination: { id: string; name: string; region: string | null } | null;
  creator: { full_name: string | null; avatar_url: string | null } | null;
};

type Participant = {
  id: string;
  user_id: string;
  status: string;
  profile: { full_name: string | null; avatar_url: string | null } | null;
};

type Question = {
  id: string;
  author_id: string;
  text: string;
  is_private: boolean;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  author: { full_name: string | null; avatar_url: string | null } | null;
};

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [questionText, setQuestionText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  // Evento
  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events" as never)
        .select("*, destination:destinations(id, name, region), creator:created_by(full_name, avatar_url)")
        .eq("id", eventId)
        .maybeSingle();
      if (error || !data) return null;
      return data as unknown as EventDetail;
    },
  });

  // Participantes
  const { data: participants = [] } = useQuery({
    queryKey: ["event-participants", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_participants" as never)
        .select("id, user_id, status, profile:user_id(full_name, avatar_url)")
        .eq("event_id", eventId)
        .eq("status", "confirmed");
      return (data ?? []) as unknown as Participant[];
    },
  });

  // Perguntas
  const { data: questions = [] } = useQuery({
    queryKey: ["event-questions", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_questions" as never)
        .select("id, author_id, text, is_private, answer, answered_at, created_at, author:author_id(full_name, avatar_url)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      return (data ?? []) as unknown as Question[];
    },
  });

  const isCreator = user?.id === event?.created_by;
  const isParticipant = participants.some((p) => p.user_id === user?.id);

  // Confirmar presença
  const joinMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("event_participants" as never)
        .upsert({ event_id: eventId, user_id: user.id, status: "confirmed" } as never, { onConflict: "event_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presença confirmada!");
      qc.invalidateQueries({ queryKey: ["event-participants", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cancelar presença
  const leaveMut = useMutation({
    mutationFn: async () => {
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
      qc.invalidateQueries({ queryKey: ["event-participants", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Enviar pergunta
  const askMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!questionText.trim()) throw new Error("Pergunta vazia");
      const { error } = await supabase
        .from("event_questions" as never)
        .insert({
          event_id: eventId,
          author_id: user.id,
          text: questionText.trim(),
          is_private: isPrivate,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isPrivate ? "Pergunta privada enviada!" : "Pergunta enviada!");
      setQuestionText("");
      setIsPrivate(false);
      qc.invalidateQueries({ queryKey: ["event-questions", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Responder pergunta (só criador)
  const answerMut = useMutation({
    mutationFn: async () => {
      if (!user || !answeringId) throw new Error("Erro");
      if (!answerText.trim()) throw new Error("Resposta vazia");
      const { error } = await supabase
        .from("event_questions" as never)
        .update({
          answer: answerText.trim(),
          answered_by: user.id,
          answered_at: new Date().toISOString(),
        } as never)
        .eq("id", answeringId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta publicada!");
      setAnsweringId(null);
      setAnswerText("");
      qc.invalidateQueries({ queryKey: ["event-questions", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <p className="text-muted-foreground">Evento não encontrado</p>
        <Link to="/eventos" className="mt-4 text-sm text-primary font-medium">Voltar aos eventos</Link>
      </div>
    );
  }

  const isFull = event.max_participants != null && participants.length >= event.max_participants;

  return (
    <div className="pb-24 animate-float-up">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/eventos" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Evento</span>
          <span className="w-9" />
        </div>
      </div>

      {/* Info do evento */}
      <section className="px-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
            {event.category}
          </span>
          {isCreator && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Seu evento
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl font-semibold">{event.title}</h1>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={14} />
            <span>{new Date(event.event_date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {event.destination && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin size={14} />
              <span>{event.destination.name}{event.destination.region ? ` — ${event.destination.region}` : ""}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users size={14} />
            <span>{participants.length} confirmados{event.max_participants ? ` / ${event.max_participants} vagas` : ""}</span>
          </div>
        </div>

        {event.description && (
          <p className="mt-4 text-sm text-foreground/80 leading-relaxed">{event.description}</p>
        )}

        {/* Ação de presença */}
        <div className="mt-4">
          {!user ? (
            <Button className="w-full h-12 rounded-xl" onClick={() => navigate({ to: "/login" })}>
              Faça login para participar
            </Button>
          ) : isParticipant ? (
            <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}>
              <UserCheck size={16} className="mr-2" /> Presença confirmada — cancelar
            </Button>
          ) : (
            <Button className="w-full h-12 rounded-xl" onClick={() => joinMut.mutate()} disabled={joinMut.isPending || isFull}>
              {isFull ? "Evento lotado" : "Confirmar presença"}
            </Button>
          )}
        </div>

        {/* Organizador */}
        {event.creator && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
            <img src={resolveAsset(event.creator.avatar_url, avatarFallback)} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <div className="text-xs text-muted-foreground">Organizado por</div>
              <div className="text-sm font-semibold">{event.creator.full_name ?? "Aventureiro"}</div>
            </div>
          </div>
        )}
      </section>

      {/* Participantes */}
      <section className="px-5 mt-6">
        <h2 className="font-display text-lg font-semibold mb-3">Participantes ({participants.length})</h2>
        {participants.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum participante confirmado ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 shadow-sm border border-border">
                <img src={resolveAsset(p.profile?.avatar_url, avatarFallback)} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-xs font-medium">{p.profile?.full_name ?? "Aventureiro"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Q&A */}
      <section className="px-5 mt-6">
        <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageCircle size={18} /> Perguntas e Respostas
        </h2>

        {/* Lista de perguntas */}
        <div className="space-y-3">
          {questions.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma pergunta ainda. Seja o primeiro!</p>
          )}
          {questions.map((q) => (
            <div key={q.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <img src={resolveAsset(q.author?.avatar_url, avatarFallback)} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-xs font-semibold">{q.author?.full_name ?? "Alguém"}</span>
                {q.is_private && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                    <Lock size={10} /> Privada
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(q.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="text-sm text-foreground/90">{q.text}</p>

              {q.answer ? (
                <div className="mt-2 ml-4 border-l-2 border-primary/30 pl-3">
                  <div className="text-[10px] text-primary font-medium mb-0.5">Resposta do organizador</div>
                  <p className="text-sm text-foreground/80">{q.answer}</p>
                </div>
              ) : isCreator && answeringId !== q.id ? (
                <button onClick={() => { setAnsweringId(q.id); setAnswerText(""); }} className="mt-2 text-xs text-primary font-medium">
                  Responder
                </button>
              ) : null}

              {answeringId === q.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Sua resposta..."
                    className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none"
                  />
                  <button onClick={() => answerMut.mutate()} disabled={answerMut.isPending} className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white">
                    {answerMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                  <button onClick={() => setAnsweringId(null)} className="text-xs text-muted-foreground">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formulário de pergunta */}
        {user && (
          <div className="mt-4 rounded-2xl bg-card p-3 shadow-card">
            <div className="flex gap-2">
              <input
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Faça uma pergunta ao organizador..."
                className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
              />
              <button onClick={() => askMut.mutate()} disabled={askMut.isPending || !questionText.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white disabled:opacity-50">
                {askMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Switch id="private-q" checked={isPrivate} onCheckedChange={setIsPrivate} />
              <Label htmlFor="private-q" className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock size={10} /> Pergunta privada (só você e o organizador verão)
              </Label>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
