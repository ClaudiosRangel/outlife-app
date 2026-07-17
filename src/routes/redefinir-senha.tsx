import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Mountain, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBar } from "@/components/StatusBar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Traduz mensagens de erro da API do Supabase para pt-BR (mesmo padrão de
// login.tsx/cadastro.tsx).
function translateAuthError(msg: string): string {
  const map: Record<string, string> = {
    "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
    "New password should be different from the old password.": "A nova senha deve ser diferente da senha atual.",
    "Auth session missing": "Link de redefinição inválido ou expirado. Solicite um novo.",
    "Email link is invalid or has expired": "Link de redefinição inválido ou expirado. Solicite um novo.",
  };
  for (const [key, value] of Object.entries(map)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return msg;
}

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenha,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Outlife" },
      { name: "description", content: "Defina uma nova senha para sua conta Outlife." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/redefinir-senha" }],
  }),
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // O link do e-mail de recuperação (`resetPasswordForEmail`) redireciona
  // para esta rota com `#access_token=...&type=recovery` na URL. O
  // supabase-js já processa esse hash automaticamente ao carregar a página
  // (client configurado com o padrão `detectSessionInUrl: true`), disparando
  // o evento `PASSWORD_RECOVERY` — usado aqui só para confirmar que a sessão
  // de recuperação foi estabelecida antes de habilitar o formulário.
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Fallback: se a sessão já existir ao montar (ex.: hash já processado
    // antes deste efeito rodar), libera o formulário mesmo sem o evento.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    // Se depois de um tempo razoável nenhuma sessão de recuperação foi
    // estabelecida, o link provavelmente é inválido/expirado.
    const timeout = setTimeout(() => {
      setSessionReady((ready) => {
        if (!ready) setSessionError(true);
        return ready;
      });
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("auth.resetPasswordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("auth.resetPasswordMismatch"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error.message) || t("auth.resetPasswordError"));
      return;
    }
    toast.success(t("auth.resetPasswordSuccess"));
    navigate({ to: "/perfil" });
  };

  return (
    <div className="animate-float-up min-h-screen bg-background pb-12">
      <StatusBar />
      <div className="px-5 pt-2 flex items-center justify-between">
        <Link to="/login" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
          <ChevronLeft size={18} />
        </Link>
        <span className="text-xs font-medium text-muted-foreground">{t("auth.resetPasswordTitle")}</span>
        <span className="w-10" />
      </div>

      <div className="px-5 mt-6 flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Mountain size={28} />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">{t("auth.resetPasswordTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.resetPasswordDescription")}</p>
      </div>

      {sessionError ? (
        <div className="mt-8 px-5 text-center">
          <p className="text-sm text-muted-foreground">{t("auth.resetPasswordLinkInvalid")}</p>
          <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary">
            {t("auth.backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 px-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.resetPasswordNewLabel")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={!sessionReady}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t("auth.resetPasswordConfirmLabel")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={!sessionReady}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !sessionReady}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading
              ? t("common.loading")
              : sessionReady
                ? t("auth.resetPasswordSubmit")
                : t("auth.resetPasswordLoading")}
          </button>
        </form>
      )}
    </div>
  );
}
