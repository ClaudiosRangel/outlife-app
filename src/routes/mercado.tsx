import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Briefcase, ArrowRight } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import seloCadastur from "@/assets/selo-cadastur.jpg";

export const Route = createFileRoute("/mercado")({
  component: MercadoPage,
  head: () => ({
    meta: [
      { title: "Mercado — Outlife" },
      { name: "description", content: "Encontre parceiros outdoor ou cadastre-se como parceiro." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function MercadoPage() {
  return (
    <div className="pb-24 animate-float-up">
      <div className="bg-gradient-forest px-5 pb-6 text-white">
        <StatusBar light />
        <div className="pt-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Mercado Outlife</h1>
          <p className="mt-1 text-sm text-white/70">Conecte-se ao ecossistema outdoor</p>
        </div>
      </div>

      <div className="px-5 -mt-4 space-y-4">
        {/* Opção 1: Encontre parceiros */}
        <Link
          to="/marketplace"
          className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-card border border-border transition-all active:scale-[0.98]"
        >
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-primary/10">
            <Search size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold">Encontre parceiros</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Guias, pousadas, equipamentos, fotógrafos e mais — todos verificados.
            </p>
          </div>
          <ArrowRight size={18} className="text-muted-foreground flex-shrink-0" />
        </Link>

        {/* Opção 2: Seja um parceiro */}
        <Link
          to="/compliance"
          className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-card border border-border transition-all active:scale-[0.98]"
        >
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-amber-50">
            <Briefcase size={24} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold">Seja um parceiro</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cadastre sua empresa, valide seu Cadastur e apareça para milhares de aventureiros.
            </p>
          </div>
          <ArrowRight size={18} className="text-muted-foreground flex-shrink-0" />
        </Link>

        {/* Selo Cadastur */}
        <div className="rounded-2xl bg-card p-5 shadow-card border border-border text-center">
          <img src={seloCadastur} alt="Selo Cadastur" className="mx-auto h-16 w-auto object-contain rounded-lg" />
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            O <strong>Cadastur</strong> é o cadastro obrigatório do Ministério do Turismo (Lei 11.771/2008).
            Parceiros verificados recebem o selo de confiança e prioridade na busca.
          </p>
        </div>
      </div>
    </div>
  );
}
