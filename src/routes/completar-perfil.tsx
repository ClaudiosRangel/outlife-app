import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { User, Loader2, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBar } from "@/components/StatusBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { fetchMyProfile, updateMyProfile } from "@/lib/api";
import { ageFromBirthDate, validateBirthDate, toISODate, MIN_AGE } from "@/lib/age-gate";

export const Route = createFileRoute("/completar-perfil")({
  component: CompletarPerfil,
  head: () => ({
    meta: [
      { title: "Complete seu perfil — OutVitar" },
      { name: "description", content: "Complete seu perfil para usar o OutVitar." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/completar-perfil" }],
  }),
});

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - 13 - i); // 13 a 112 anos atrás
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function CompletarPerfil() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [day, setDay] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const MONTHS = useMemo(
    () => [
      t("months.jan", "janeiro"), t("months.feb", "fevereiro"), t("months.mar", "março"),
      t("months.apr", "abril"), t("months.may", "maio"), t("months.jun", "junho"),
      t("months.jul", "julho"), t("months.aug", "agosto"), t("months.sep", "setembro"),
      t("months.oct", "outubro"), t("months.nov", "novembro"), t("months.dec", "dezembro"),
    ],
    [t],
  );

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Pré-preenche o nome; se já tem data de nascimento, o perfil já está
  // completo → volta para a Home (não força de novo).
  useEffect(() => {
    if (!profile) return;
    setFullName((profile as { full_name?: string }).full_name ?? "");
    setGender((profile as { gender?: string }).gender ?? "");
    const bd = (profile as { birth_date?: string }).birth_date;
    if (bd) {
      navigate({ to: "/" });
    }
  }, [profile, navigate]);

  const birthISO = useMemo(() => {
    if (!day || !month || !year) return null;
    return toISODate(Number(year), Number(month), Number(day));
  }, [day, month, year]);

  const age = useMemo(() => (birthISO ? ageFromBirthDate(birthISO) : null), [birthISO]);
  const validation = useMemo(() => validateBirthDate(birthISO), [birthISO]);

  const handleSubmit = async () => {
    if (fullName.trim().length < 2) {
      toast.error(t("completeProfile.nameRequired", { defaultValue: "Informe como quer ser chamado." }));
      return;
    }
    if (!gender) {
      toast.error(t("completeProfile.genderRequired", { defaultValue: "Selecione seu gênero." }));
      return;
    }
    if (!validation.ok) {
      if (validation.reason === "too_young") {
        toast.error(
          t("completeProfile.tooYoung", {
            defaultValue: "Você precisa ter pelo menos {{min}} anos para usar o OutVitar.",
            min: MIN_AGE,
          }),
        );
      } else {
        toast.error(t("completeProfile.birthRequired", { defaultValue: "Informe uma data de nascimento válida." }));
      }
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({ full_name: fullName.trim(), gender, birth_date: birthISO });
      toast.success(t("completeProfile.saved", { defaultValue: "Perfil completo! Bem-vindo ao OutVitar." }));
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const tooYoung = validation.reason === "too_young";

  return (
    <div className="animate-float-up min-h-screen bg-background pb-12">
      <StatusBar />
      <div className="px-5 pt-6">
        <h1 className="font-display text-3xl font-semibold leading-tight">
          {t("completeProfile.title", { defaultValue: "Complete seu perfil" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("completeProfile.subtitle", {
            defaultValue: "Escolha como quer ser chamado, seu gênero e confirme sua idade para usar o app.",
          })}
        </p>

        <div className="mt-6 space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User size={14} className="text-primary" /> {t("auth.fullName")}
            </Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("signup.yourName")} />
          </div>

          {/* Gênero */}
          <div className="space-y-1.5">
            <Label>{t("completeProfile.gender", { defaultValue: "Gênero" })}</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder={t("completeProfile.selectGender", { defaultValue: "Selecione" })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("completeProfile.male", { defaultValue: "Homem" })}</SelectItem>
                <SelectItem value="female">{t("completeProfile.female", { defaultValue: "Mulher" })}</SelectItem>
                <SelectItem value="other">{t("completeProfile.other", { defaultValue: "Outro" })}</SelectItem>
                <SelectItem value="undisclosed">{t("completeProfile.undisclosed", { defaultValue: "Prefiro não dizer" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data de nascimento (dia/mês/ano) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <CalendarDays size={14} className="text-primary" />
              {t("completeProfile.birthDate", { defaultValue: "Data de nascimento" })}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger><SelectValue placeholder={t("completeProfile.day", { defaultValue: "Dia" })} /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {DAYS.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue placeholder={t("completeProfile.month", { defaultValue: "Mês" })} /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue placeholder={t("completeProfile.year", { defaultValue: "Ano" })} /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Idade calculada / aviso 13+ */}
            {age != null && (
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                  tooYoung ? "bg-red-500/10 text-red-600" : "bg-primary/10 text-primary"
                }`}
              >
                {tooYoung
                  ? t("completeProfile.tooYoungShort", { defaultValue: "Mínimo {{min}} anos", min: MIN_AGE })
                  : t("completeProfile.ageLabel", { defaultValue: "{{age}} anos", age })}
              </div>
            )}
            {tooYoung && (
              <p className="mt-1 text-xs text-red-600">
                {t("completeProfile.tooYoung", {
                  defaultValue: "Você precisa ter pelo menos {{min}} anos para usar o OutVitar.",
                  min: MIN_AGE,
                })}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || !validation.ok || !gender || fullName.trim().length < 2}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? t("common.saving") : t("completeProfile.submit", { defaultValue: "Confirmar e continuar" })}
        </button>
      </div>
    </div>
  );
}
