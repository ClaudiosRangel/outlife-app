import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBar } from "@/components/StatusBar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/email-confirmado")({
  component: EmailConfirmado,
  head: () => ({
    meta: [
      { title: "E-mail confirmado — OutVitar" },
      { name: "description", content: "Seu e-mail foi confirmado. Entre no app OutVitar com seu login." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/email-confirmado" }],
  }),
});

/**
 * Página de destino do link de confirmação de e-mail. Propositalmente SÓ
 * informa o resultado: não abre o app, não leva a nenhum menu e não mantém
 * sessão. O usuário volta ao app por conta própria e entra com o login.
 */
function EmailConfirmado() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    if (params.get("error") || params.get("error_code")) {
      setFailed(true);
      return;
    }
    // O supabase-js cria sessão a partir do hash do link. A confirmação não
    // deve deixar o usuário logado aqui: o acesso é pelo login no app.
    if (params.get("access_token")) {
      void supabase.auth.signOut({ scope: "local" });
    }
  }, []);

  return (
    <div className="animate-float-up min-h-screen bg-background pb-12">
      <StatusBar />
      <div className="flex flex-col items-center px-6 pt-24 text-center">
        <span
          className={`grid h-16 w-16 place-items-center rounded-full ${
            failed ? "bg-red-500/10 text-red-600" : "bg-primary/10 text-primary"
          }`}
        >
          {failed ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-tight">
          {failed
            ? t("auth.emailLinkInvalidTitle", "Link inválido ou expirado")
            : t("auth.emailConfirmedTitle", "E-mail confirmado com sucesso!")}
        </h1>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">
          {failed
            ? t(
                "auth.emailLinkInvalidBody",
                "Abra o app OutVitar e entre com seu login. Se precisar, solicite um novo e-mail de confirmação.",
              )
            : t(
                "auth.emailConfirmedBody",
                "Agora é só abrir o app OutVitar e acessar com o seu login (e-mail e senha).",
              )}
        </p>
        {/* Só aparece na versão web; no app o usuário já está dentro dele. */}
        <Link
          to="/login"
          className="mt-8 w-full max-w-xs rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card"
        >
          {t("auth.goToLogin", "Ir para o login")}
        </Link>
      </div>
    </div>
  );
}
