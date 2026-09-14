/**
 * Ponto 4 — Chat privado 1:1 com um usuário (mesmo sem ser amigo).
 * Histórico + envio de mensagens. Marca as recebidas como lidas ao abrir.
 * Atualização por polling leve (a base é Supabase; realtime opcional futuro).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchPublicProfile,
  fetchMessagesWith,
  sendDirectMessage,
  markMessagesRead,
  resolveAsset,
} from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/chat/$userId")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Conversa — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ChatPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: other } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => fetchPublicProfile(userId),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", userId],
    queryFn: () => fetchMessagesWith(userId),
    enabled: !!user,
    refetchInterval: 5000,
  });

  // Marca as recebidas como lidas ao abrir/atualizar.
  useEffect(() => {
    if (user)
      void markMessagesRead(userId).then(() => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
        qc.invalidateQueries({ queryKey: ["unread-messages-count"] });
      });
  }, [userId, user, messages.length, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: (t: string) => sendDirectMessage(userId, t),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", userId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    sendMut.mutate(t);
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="bg-gradient-forest px-5 pb-3 text-white">
        <StatusBar light />
        <div className="flex items-center gap-3 pt-2">
          <Link to="/mensagens" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <img src={resolveAsset(other?.avatar_url, avatarFallback)} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{other?.full_name ?? "Aventureiro"}</div>
            {other?.username && <div className="truncate text-[11px] text-white/70">@{other.username}</div>}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-background px-4 py-4">
        {messages.length === 0 ? (
          <div className="mt-8 text-center text-xs text-muted-foreground">
            Nenhuma mensagem ainda. Diga olá! 👋
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-card shadow-card"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-card p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Escreva uma mensagem…"
          className="flex-1"
        />
        <Button size="icon" className="shrink-0 rounded-full" onClick={handleSend} disabled={sendMut.isPending}>
          {sendMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
