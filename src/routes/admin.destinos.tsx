/**
 * Tela de moderação de destinos pendentes — acessível pelos admins
 * (e-mails listados em admin_emails). Lista destinos com status 'pending'
 * e permite aprovar ou rejeitar.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/api";

export const Route = createFileRoute("/admin/destinos")({
  component: AdminDestinosPage,
  head: () => ({
    meta: [
      { title: "Moderação de Destinos — Outlife Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type PendingDestination = {
  id: string;
  name: string;
  description: string | null;
  region: string | null;
  state: string | null;
  difficulty: string | null;
  type: string | null;
  distance: string | null;
  duration: string | null;
  elevation: string | null;
  main_image_url: string | null;
  created_at: string;
  created_by: string;
  creator: { full_name: string | null; email?: string } | null;
};

function AdminDestinosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Verifica se o usuário é admin
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      const { data } = await supabase
        .from("admin_emails" as never)
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["pending-destinations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("destinations")
        .select("*, creator:created_by(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as PendingDestination[];
    },
    enabled: isAdmin,
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("destinations")
        .update({ status: "approved" } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Destino aprovado!");
      qc.invalidateQueries({ queryKey: ["pending-destinations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("destinations")
        .update({ status: "rejected" } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Destino rejeitado");
      qc.invalidateQueries({ queryKey: ["pending-destinations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva para moderadores.</p>
        <Link to="/" className="mt-4 text-sm text-primary font-medium">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="pb-24 animate-float-up">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Moderar Destinos</span>
          <span className="w-9" />
        </div>
      </div>

      <section className="px-5 mt-4 space-y-3">
        {isLoading && [0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
        ))}

        {!isLoading && pending.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            <Check size={32} className="mx-auto mb-2 text-green-500 opacity-60" />
            Nenhum destino pendente de aprovação.
          </div>
        )}

        {pending.map((d) => (
          <div key={d.id} className="rounded-2xl bg-card p-4 shadow-card">
            {d.main_image_url && (
              <img src={d.main_image_url} alt={d.name} className="w-full h-32 rounded-xl object-cover mb-3" />
            )}
            <h3 className="font-display text-base font-semibold">{d.name}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {d.region && <span className="flex items-center gap-1"><MapPin size={10} /> {d.region}{d.state ? ` — ${d.state}` : ""}</span>}
              {d.difficulty && <span>• {d.difficulty}</span>}
              {d.type && <span>• {d.type}</span>}
            </div>
            {d.description && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{d.description}</p>
            )}
            <div className="mt-2 text-[10px] text-muted-foreground">
              Sugerido por {d.creator?.full_name ?? "Usuário"} em {new Date(d.created_at).toLocaleDateString("pt-BR")}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1 rounded-xl" onClick={() => approveMut.mutate(d.id)} disabled={approveMut.isPending}>
                {approveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Aprovar
              </Button>
              <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => rejectMut.mutate(d.id)} disabled={rejectMut.isPending}>
                <X size={14} /> Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
