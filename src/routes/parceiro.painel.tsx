import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  ChevronLeft,
  Eye,
  MessageSquare,
  ShieldCheck,
  Users,
  CheckCircle2,
  Edit3,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBar } from "@/components/StatusBar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  fetchMyProfile,
  updateMyProfile,
  fetchPartnerMetrics,
  fetchPartnerChart,
  fetchPartnerTrialStatus,
  uploadPartnerGalleryImage,
  resolveAsset,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/parceiro/painel")({
  component: PartnerPanel,
  head: () => ({
    meta: [
      { title: "Painel do parceiro — Outlife" },
      { name: "description", content: "Gerencie seu perfil, galeria, serviços e métricas como parceiro Outlife." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/parceiro/painel" }],
  }),
});



function PartnerPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ["partner-metrics", user?.id],
    queryFn: () => fetchPartnerMetrics(user!.id),
    enabled: !!user,
  });

  const { data: chartData = [], isLoading: chartLoading } = useQuery({
    queryKey: ["partner-chart", user?.id],
    queryFn: () => fetchPartnerChart(user!.id),
    enabled: !!user,
  });

  const { data: trial, isLoading: trialLoading } = useQuery({
    queryKey: ["partner-trial", user?.id],
    queryFn: () => fetchPartnerTrialStatus(user!.id),
    enabled: !!user,
  });

  const { data: phoneData } = useQuery({
    queryKey: ["my-contact", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profile_contacts").select("phone").eq("id", user!.id).maybeSingle();
      return data?.phone ?? "";
    },
    enabled: !!user,
  });


  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Guias");
  const [phone, setPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setDesc(profile.description ?? "");
      setCat(profile.category ?? "Guias");
    }
  }, [profile]);

  useEffect(() => {
    if (phoneData !== undefined) setPhone(phoneData);
  }, [phoneData]);

  const gallery: string[] = Array.isArray(profile?.gallery) ? profile!.gallery : [];

  const seals = [
    ...(profile?.is_verified ? [{ icon: ShieldCheck, label: "Cadastur" }] : []),
    { icon: Users, label: "Comunidade" },
    ...(profile?.is_verified ? [{ icon: CheckCircle2, label: t("common.verified") }] : []),
  ];

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateMyProfile({ full_name: name, description: desc, category: cat });
      if (user) {
        await supabase
          .from("profile_contacts")
          .upsert({ id: user.id, phone } as never, { onConflict: "id" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-contact", user?.id] });
      setEditOpen(false);
      toast.success(t("panel.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadPartnerGalleryImage(file);
      await updateMyProfile({ gallery: [...gallery, url] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      toast.success(t("panel.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadMutation.mutate(f);
    e.target.value = "";
  };

  const displayName = profile?.full_name?.split(" ")[0] ?? "Parceiro";

  return (
    <div className="animate-float-up pb-24">
      <StatusBar />

      <div className="px-5 pt-2 flex items-center justify-between">
        <Link to="/perfil" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
          <ChevronLeft size={18} />
        </Link>
        <span className="text-xs font-medium text-muted-foreground">{t("panel.title")}</span>
        <button onClick={() => setEditOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
          <Edit3 size={16} />
        </button>
      </div>

      <div className="px-5 mt-4">
        {profileLoading ? (
          <>
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold leading-tight">{t("panel.hello", { name: displayName })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("panel.performance")}</p>
          </>
        )}
      </div>

      <div className="mt-5 px-5 grid grid-cols-2 gap-3">
        {metricsLoading ? (
          <>
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </>
        ) : (
          <>
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-card shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-[11px] uppercase tracking-widest">
                    Visualizações do perfil
                  </CardDescription>
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
                    <Eye size={16} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="font-display text-3xl font-semibold tabular-nums">
                  {metrics.find((m) => m.key === "views")?.value ?? "0"}
                </CardTitle>
                <p className="mt-1 text-[11px] text-muted-foreground">Total acumulado</p>
              </CardContent>
            </Card>

            <Card className="border-[var(--verified)]/30 bg-gradient-to-br from-[var(--verified)]/10 to-card shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-[11px] uppercase tracking-widest">
                    Cliques em contato
                  </CardDescription>
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--verified)]/15 text-[var(--verified)]">
                    <MessageSquare size={16} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="font-display text-3xl font-semibold tabular-nums">
                  {metrics.find((m) => m.key === "whatsapp")?.value ?? "0"}
                </CardTitle>
                <p className="mt-1 text-[11px] text-muted-foreground">Leads recebidos</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Banner do Trial baseado em performance */}
      {!trialLoading && trial && (
        <div className="mt-4 px-5">
          {trial.trialActive ? (
            <Alert className="border-primary/30 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle className="font-semibold">Teste gratuito ativo</AlertTitle>
              <AlertDescription className="mt-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Faltam <span className="font-semibold text-foreground">{trial.remainingClicks}</span>{" "}
                  cliques de clientes para finalizar seu trial.
                </p>
                <Progress
                  value={Math.min((trial.contactClicks / trial.threshold) * 100, 100)}
                  className="h-2"
                />
                <p className="text-[11px] text-muted-foreground">
                  {trial.contactClicks} / {trial.threshold} cliques em contato
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-[var(--sun)]/40 bg-[var(--sun)]/10">
              <Sparkles className="h-4 w-4 text-[var(--sun)]" />
              <AlertTitle className="font-semibold">Trial encerrado</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Você atingiu {trial.threshold} cliques em contato. Ative seu plano para continuar
                recebendo leads sem interrupção.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}


      <div className="mt-5 px-5 grid grid-cols-3 gap-2">
        {seals.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2 rounded-xl bg-[var(--verified)]/10 px-3 py-2.5">
              <Icon size={16} className="text-[var(--verified)]" />
              <span className="text-[11px] font-semibold text-[var(--verified)]">{s.label}</span>
            </div>
          );
        })}
      </div>

      <section className="mt-6 px-5">
        <h2 className="font-display text-lg font-semibold">{t("panel.last7days")}</h2>
        <div className="mt-3 rounded-2xl bg-card p-4 shadow-card">
          {chartLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="flex h-32 items-end justify-between gap-2">
              {chartData.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="w-full rounded-t-lg bg-primary/60" style={{ height: `${d.v}px` }} />
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>



      <section className="mt-6 px-5">
        <button
          onClick={() => setEditOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform"
        >
          <Edit3 size={16} /> {t("panel.edit")}
        </button>
      </section>

      <section className="mt-6 px-5">
        <h2 className="font-display text-lg font-semibold">{t("panel.gallery")}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {gallery.map((g, i) => (
            <img key={i} src={resolveAsset(g)} alt="" className="h-24 w-full rounded-xl object-cover" />
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="grid h-24 w-full place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground disabled:opacity-50"
          >
            <Plus size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-display">{t("panel.editTitle")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">{t("panel.name")}</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc">{t("panel.description")}</Label>
              <Textarea id="p-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("panel.category")}</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Guias", "Agências", "Hotéis e Pousadas", "Restaurantes", "Fotógrafos", "Equipamentos", "Experiências", "Lifestyle Outdoor"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">{t("compliance.phone")}</Label>
              <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="mt-2 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-60"
            >
              {saveMutation.isPending ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
