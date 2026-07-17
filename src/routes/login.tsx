import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Mountain, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusBar } from "@/components/StatusBar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

// Traduz mensagens de erro da API do Supabase para pt-BR
function translateAuthError(msg: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed": "Confirme seu e-mail antes de entrar.",
    "Invalid Refresh Token": "Sessão expirada. Faça login novamente.",
    "User not found": "Usuário não encontrado.",
    "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
    "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  };
  for (const [key, value] of Object.entries(map)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return msg;
}

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({
    meta: [
      { title: "Entrar — Outlife" },
      { name: "description", content: "Acesse sua conta Outlife para continuar suas aventuras." },
      { property: "og:title", content: "Entrar — Outlife" },
      { property: "og:url", content: "/login" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
});

function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Fluxo de recuperação de senha ("Esqueci minha senha"): coleta o e-mail
  // num Sheet separado e chama `resetPasswordForEmail`, que já está
  // configurado e validado no Production_Supabase_Project (SMTP customizado
  // via Resend, spec email-transacional-dominio-proprio). O e-mail recebido
  // leva para `/redefinir-senha`, que define a nova senha.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error.message) || t("auth.loginError"));
      return;
    }
    toast.success(t("auth.loginSuccess"));
    navigate({ to: "/perfil" });
  };

  const submitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = forgotEmail.trim();
    if (!trimmed) {
      toast.error(t("auth.forgotPasswordEmailRequired"));
      return;
    }
    setForgotLoading(true);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    setForgotLoading(false);
    if (error) {
      toast.error(translateAuthError(error.message) || t("auth.forgotPasswordError"));
      return;
    }
    toast.success(t("auth.forgotPasswordSuccess"));
    setForgotOpen(false);
    setForgotEmail("");
  };

  return (
    <div className="animate-float-up min-h-screen bg-background pb-12">
      <StatusBar />
      <div className="px-5 pt-2 flex items-center justify-between">
        <Link to="/" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
          <ChevronLeft size={18} />
        </Link>
        <span className="text-xs font-medium text-muted-foreground">{t("auth.signIn")}</span>
        <span className="w-10" />
      </div>

      <div className="px-5 mt-6 flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Mountain size={28} />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">{t("auth.welcomeBack")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.continueJourney")}</p>
      </div>

      <form onSubmit={submit} className="mt-8 px-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="block text-right text-xs font-medium text-primary"
          >
            {t("auth.forgotPassword")}
          </button>
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-60">
          {loading ? t("common.loading") : t("auth.signIn")}
        </button>
        <Link to="/cadastro" className="block text-center text-sm text-primary font-medium">
          {t("auth.noAccount")}
        </Link>
      </form>

      <Sheet open={forgotOpen} onOpenChange={setForgotOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display">{t("auth.forgotPasswordTitle")}</SheetTitle>
            <SheetDescription>{t("auth.forgotPasswordDescription")}</SheetDescription>
          </SheetHeader>
          <form onSubmit={submitForgotPassword} className="mt-4 space-y-4 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">{t("auth.email")}</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="voce@email.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={forgotLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {forgotLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              {forgotLoading ? t("common.loading") : t("auth.forgotPasswordSubmit")}
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
