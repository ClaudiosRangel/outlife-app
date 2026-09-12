/**
 * Frente H (Req 1/2) — Curadoria de trilhas importadas (OSM/ICMBio).
 * Admin lista as trilhas importadas (via scripts/import-trails.mjs) e libera
 * ou oculta a exibição no app (toggle visible). A atribuição OSM é exibida.
 * A importação em lote roda server-side/local (não no device).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, MapPin, Search, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllImportedTrails, setImportedTrailVisible, type ImportedTrail } from "@/lib/api";

export const Route = createFileRoute("/admin/trilhas")({
  component: AdminTrilhasPage,
  head: () => ({
    meta: [
      { title: "Curadoria de Trilhas — OutVitar Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminTrilhasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

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

  const { data: trails = [], isLoading } = useQuery({
    queryKey: ["imported-trails-admin"],
    queryFn: fetchAllImportedTrails,
    enabled: isAdmin,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) => setImportedTrailVisible(id, visible),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["imported-trails-admin"] });
      qc.invalidateQueries({ queryKey: ["imported-trails-visible"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trails;
    return trails.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.region ?? "").toLowerCase().includes(q),
    );
  }, [trails, search]);

  const visibleCount = trails.filter((t) => t.visible).length;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva para administradores.</p>
        <Link to="/" className="mt-4 text-sm text-primary font-medium">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="pb-24 animate-float-up">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Trilhas e Destinos</span>
          <span className="w-9" />
        </div>
      </div>

      <section className="px-5 mt-4">
        <div className="rounded-2xl bg-primary/5 border border-primary/15 p-3 text-xs text-muted-foreground flex gap-2">
          <Info size={14} className="mt-0.5 shrink-0 text-primary" />
          <span>
            As trilhas são importadas de fontes públicas (OpenStreetMap/ICMBio) por um
            script. Aqui você libera (👁) ou oculta o que aparece no app. Trilhas de origem
            OSM exibem a atribuição © OpenStreetMap contributors.
          </span>
        </div>

        <div className="relative mt-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou região…"
            className="pl-9"
          />
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground">
          {trails.length} trilhas importadas • {visibleCount} visíveis no app
        </div>
      </section>

      <section className="px-5 mt-4 space-y-2">
        {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}

        {!isLoading && trails.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            <MapPin size={32} className="mx-auto mb-2 opacity-40" />
            Nenhuma trilha importada ainda. Rode o script de importação:
            <code className="mt-2 block text-[10px]">node scripts/import-trails.mjs osm "&lt;região&gt;" &lt;s&gt; &lt;w&gt; &lt;n&gt; &lt;e&gt;</code>
          </div>
        )}

        {filtered.map((t: ImportedTrail) => (
          <div key={t.id} className="rounded-2xl bg-card p-3 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-sm font-semibold">{t.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5 uppercase text-[10px] tracking-wide">
                    {t.external_source}
                  </span>
                  {t.region && <span className="flex items-center gap-1"><MapPin size={10} /> {t.region}</span>}
                </div>
                {t.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                {t.attribution && (
                  <p className="mt-1 text-[10px] text-muted-foreground/80">{t.attribution}{t.license ? ` · ${t.license}` : ""}</p>
                )}
              </div>
              <Button
                size="sm"
                variant={t.visible ? "default" : "outline"}
                className="shrink-0 rounded-xl"
                onClick={() => toggleMut.mutate({ id: t.id, visible: !t.visible })}
                disabled={toggleMut.isPending}
              >
                {toggleMut.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : t.visible ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} />
                )}
                {t.visible ? "Visível" : "Oculta"}
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
