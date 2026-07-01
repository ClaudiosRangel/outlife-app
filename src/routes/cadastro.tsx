import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Compass, Briefcase, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { StatusBar } from "@/components/StatusBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Traduz mensagens de erro da API do Supabase para pt-BR
function translateAuthError(msg: string): string {
  const map: Record<string, string> = {
    "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
    "Password is too weak": "A senha é muito fraca. Use letras, números e símbolos.",
    "Unable to validate email address: invalid format": "E-mail inválido.",
    "User already registered": "Este e-mail já está cadastrado.",
    "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
    "Signup requires a valid password": "Informe uma senha válida.",
    "Invalid login credentials": "E-mail ou senha incorretos.",
  };
  // Busca correspondência parcial
  for (const [key, value] of Object.entries(map)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return msg;
}

export const Route = createFileRoute("/cadastro")({
  component: Cadastro,
  head: () => ({
    meta: [
      { title: "Criar conta — Outlife" },
      { name: "description", content: "Cadastre-se gratuitamente como aventureiro ou parceiro no Outlife." },
      { property: "og:title", content: "Criar conta — Outlife" },
      { property: "og:url", content: "/cadastro" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/cadastro" }],
  }),
});

const baseSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(100),
});

const partnerSchema = baseSchema.extend({
  category: z.string().min(1, "Selecione uma categoria"),
});

const partnerCategories = [
  "Guias",
  "Agências",
  "Hotéis e Pousadas",
  "Restaurantes",
  "Fotógrafos",
  "Equipamentos",
  "Experiências",
  "Lifestyle Outdoor",
];

function Cadastro() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"adventurer" | "partner" | null>(null);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const doSignUp = async (extra: Record<string, unknown> = {}) => {
    setLoading(true);
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { role, full_name: name, ...extra },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return false;
    }
    toast.success(t("auth.signupSuccess"));
    navigate({ to: "/perfil" });
    return true;
  };

  const handleRoleNext = async () => {
    if (!role) return;
    if (role === "partner") {
      setStep(2);
      return;
    }
    const parsed = baseSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("auth.fillAll"));
      return;
    }
    await doSignUp();
  };

  const finalize = async () => {
    const parsed = partnerSchema.safeParse({ name, email, password, category });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("auth.fillAll"));
      return;
    }
    await doSignUp({ category });
  };

  const totalSteps = role === "partner" ? 2 : 1;

  return (
    <div className="animate-float-up min-h-screen bg-background pb-12">
      <StatusBar />
      <div className="px-5 pt-2 flex items-center justify-between">
        <button
          onClick={() => (step === 2 ? setStep(1) : history.back())}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs font-medium text-muted-foreground">
          {t("signup.stepOf", { step, total: totalSteps })}
        </span>
        <span className="w-10" />
      </div>

      {step === 1 && (
        <div className="px-5 mt-6">
          <h1 className="font-display text-3xl font-semibold leading-tight">{t("signup.howUse")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("signup.chooseProfile")}</p>

          <div className="mt-6 space-y-3">
            {[
              { id: "adventurer", icon: Compass, title: t("signup.adventurer"), desc: t("signup.adventurerDesc") },
              { id: "partner", icon: Briefcase, title: t("signup.partner"), desc: t("signup.partnerDesc") },
            ].map((opt) => {
              const Icon = opt.icon;
              const selected = role === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setRole(opt.id as "adventurer" | "partner")}
                  className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-base ${
                    selected ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    <Icon size={20} />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{opt.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                  {selected && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {role === "adventurer" && (
            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("auth.fullName")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("signup.yourName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
          )}

          <button
            onClick={handleRoleNext}
            disabled={!role || loading}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? t("auth.wait") : t("common.continue")}
          </button>

          <Link to="/login" className="mt-4 block text-center text-sm text-primary font-medium">
            {t("signup.alreadyHave")}
          </Link>
        </div>
      )}

      {step === 2 && (
        <div className="px-5 mt-6">
          <h1 className="font-display text-3xl font-semibold leading-tight">{t("signup.aboutBusiness")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("signup.chooseCategory")}</p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>{t("signup.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t("signup.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {partnerCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("signup.businessName")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Rafa Trilhas" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@negocio.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          <button
            onClick={finalize}
            disabled={!category || loading}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? t("auth.wait") : t("signup.finalize")}
          </button>
        </div>
      )}
    </div>
  );
}
