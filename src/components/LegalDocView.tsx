import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { LegalDoc } from "@/lib/legal-content";

/**
 * Renderiza um documento legal (Termos ou Privacidade) em leitura.
 * Usado pelas rotas públicas /termos e /privacidade e reutilizável em modais.
 */
export function LegalDocView({ doc, backTo = "/perfil" }: { doc: LegalDoc; backTo?: string }) {
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to={backTo}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="font-serif text-lg font-semibold leading-tight">{doc.title}</h1>
            <p className="text-xs text-muted-foreground">
              {doc.updatedLabel}: {doc.version}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          {doc.disclaimer}
        </p>

        <div className="mt-4 space-y-6">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-sm font-semibold text-foreground">{s.heading}</h2>
              <div className="mt-1.5 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[13px] leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
