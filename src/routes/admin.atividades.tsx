import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  isCurrentUserAdmin,
  fetchAllActivityTypes,
  createActivityType,
  updateActivityType,
  deleteActivityType,
  reorderActivityTypes,
  type MetricFormCode,
  type ActivityTypeCatalogItem,
} from "@/lib/api";
import { ICON_MODEL_SET, getActivityIcon } from "@/lib/activity-icons";

export const Route = createFileRoute("/admin/atividades")({
  component: AdminActivityTypes,
  head: () => ({
    meta: [
      { title: "Tipos de atividade — OutVitar Admin" },
      { name: "description", content: "Cadastro de tipos de atividade do OutVitar." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/atividades" }],
  }),
});

const METRIC_FORMS: { value: MetricFormCode; labelKey: string }[] = [
  { value: "pace_km", labelKey: "adminActivities.metric.paceKm" },
  { value: "speed_elevation", labelKey: "adminActivities.metric.speedElevation" },
  { value: "pace_100m", labelKey: "adminActivities.metric.pace100m" },
];

function AdminActivityTypes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-current-user-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["admin-activity-types"],
    queryFn: fetchAllActivityTypes,
    enabled: !!user && isAdmin === true,
  });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<string>("run");
  const [metricForm, setMetricForm] = useState<MetricFormCode>("pace_km");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-activity-types"] });

  const createMut = useMutation({
    mutationFn: () => createActivityType({ code, name, icon_key: iconKey, metric_form: metricForm }),
    onSuccess: () => { invalidate(); setCode(""); setName(""); toast.success(t("adminActivities.created")); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; patch: Partial<ActivityTypeCatalogItem> }) => updateActivityType(v.id, v.patch),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteActivityType(id),
    onSuccess: () => { invalidate(); toast.success(t("adminActivities.deleted")); },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setToDelete(null),
  });
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderActivityTypes(ids),
    onSuccess: invalidate,
  });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...types];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderMut.mutate(next.map((x) => x.id));
  };

  const handleCreate = () => {
    if (!code.trim() || !name.trim()) { toast.error(t("adminActivities.errorFields")); return; }
    createMut.mutate();
  };

  if (authLoading || (!!user && isAdminLoading)) {
    return (
      <div className="pb-12">
        <div className="bg-gradient-forest px-5 pb-4 text-white">
          <StatusBar light />
          <div className="pt-2 text-center text-xs font-medium uppercase tracking-widest text-white/70">
            {t("admin.title", "Administração")}
          </div>
        </div>
        <div className="px-5 mt-4 space-y-2"><Skeleton className="h-24 w-full rounded-2xl" /></div>
      </div>
    );
  }

  if (!user) return null;

  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted"><ShieldAlert size={24} className="text-muted-foreground" /></div>
        <h2 className="mt-4 font-display text-xl font-semibold">{t("adminCompliance.accessDeniedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminCompliance.accessDeniedDescription")}</p>
        <Link to="/" className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">{t("adminCompliance.backToHome")}</Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md"><ArrowLeft size={16} /></Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">{t("admin.title", "Administração")}</span>
          <span className="w-9" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("adminActivities.title")}</h1>
        <p className="mt-1 text-sm text-white/80">{t("adminActivities.subtitle")}</p>
      </div>

      {/* Novo tipo */}
      <section className="px-5 mt-4">
        <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
          <h2 className="text-sm font-semibold">{t("adminActivities.newTitle")}</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="at-code">{t("adminActivities.code")}</Label>
              <Input id="at-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex.: corrida" /></div>
            <div className="space-y-1"><Label htmlFor="at-name">{t("adminActivities.name")}</Label>
              <Input id="at-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Corrida" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("adminActivities.icon")}</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_MODEL_SET.map((m) => {
                const Icon = m.Icon;
                const selected = iconKey === m.key;
                return (
                  <button key={m.key} type="button" onClick={() => setIconKey(m.key)}
                    className={`grid h-11 w-11 place-items-center rounded-xl border ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                    <Icon size={20} style={{ color: m.color }} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("adminActivities.metricForm")}</Label>
            <Select value={metricForm} onValueChange={(v) => setMetricForm(v as MetricFormCode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METRIC_FORMS.map((mf) => <SelectItem key={mf.value} value={mf.value}>{t(mf.labelKey)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <button onClick={handleCreate} disabled={createMut.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            <Plus size={16} /> {t("adminActivities.add")}
          </button>
        </div>
      </section>

      {/* Lista */}
      <section className="px-5 mt-4 space-y-2">
        {isLoading ? <Skeleton className="h-16 w-full rounded-2xl" /> : types.map((tp, i) => {
          const Icon = getActivityIcon(tp.icon_key).Icon;
          return (
            <div key={tp.id} className={`flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card ${tp.active ? "" : "opacity-60"}`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Icon size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{tp.name}</div>
                <div className="text-[11px] text-muted-foreground">{tp.code} · {t(`adminActivities.metric.${tp.metric_form === "pace_km" ? "paceKm" : tp.metric_form === "pace_100m" ? "pace100m" : "speedElevation"}`)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground"><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground"><ChevronDown size={16} /></button>
                <button onClick={() => updateMut.mutate({ id: tp.id, patch: { active: !tp.active } })}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground" aria-label={t("adminActivities.toggleActive")}>
                  {tp.active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => setToDelete(tp.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
              </div>
            </div>
          );
        })}
      </section>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminActivities.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("adminActivities.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMut.mutate(toDelete)}>{t("adminActivities.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
