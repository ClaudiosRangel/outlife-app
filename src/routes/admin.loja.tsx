import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Image as ImageIcon, Store, Trash2, Plus, X, Pencil, Loader2 } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  isCurrentUserAdmin,
  adminListCampaigns,
  adminUpsertCampaign,
  adminDeleteCampaign,
  uploadCampaignImage,
  fetchPartnersLite,
  resolveAsset,
  type PartnerCampaign,
} from "@/lib/api";

export const Route = createFileRoute("/admin/loja")({
  component: AdminStore,
  head: () => ({
    meta: [
      { title: "Loja virtual — OutVitar Admin" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/loja" }],
  }),
});

type FormState = {
  id: string | null;
  partnerId: string | null;
  title: string;
  description: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
  price: string;
  showOnStart: boolean;
  postToCommunity: boolean;
  notifyUsers: boolean;
  status: "active" | "paused";
};

const emptyForm: FormState = {
  id: null,
  partnerId: null,
  title: "",
  description: "",
  imageUrl: null,
  ctaLabel: "",
  ctaUrl: "",
  price: "",
  showOnStart: true,
  postToCommunity: false,
  notifyUsers: false,
  status: "active",
};

function AdminStore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-current-user-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: adminListCampaigns,
    enabled: !!user && isAdmin === true,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-lite"],
    queryFn: fetchPartnersLite,
    enabled: !!user && isAdmin === true,
  });

  const upsertMut = useMutation({
    mutationFn: () =>
      adminUpsertCampaign({
        id: form.id,
        partnerId: form.partnerId,
        title: form.title,
        description: form.description || null,
        imageUrl: form.imageUrl,
        ctaLabel: form.ctaLabel || null,
        ctaUrl: form.ctaUrl || null,
        price: form.price || null,
        showOnStart: form.showOnStart,
        postToCommunity: form.postToCommunity,
        notifyUsers: form.notifyUsers,
        status: form.status,
      }),
    onSuccess: () => {
      toast.success(t("adminStore.saved", "Campanha salva."));
      setForm(emptyForm);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["start-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteCampaign(id),
    onSuccess: () => {
      toast.success(t("adminStore.deleted", "Campanha excluída."));
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["start-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadCampaignImage(f);
      setForm((s) => ({ ...s, imageUrl: url }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (c: PartnerCampaign) => {
    setForm({
      id: c.id,
      partnerId: c.partner_id,
      title: c.title,
      description: c.description ?? "",
      imageUrl: c.image_url,
      ctaLabel: c.cta_label ?? "",
      ctaUrl: c.cta_url ?? "",
      price: c.price ?? "",
      showOnStart: c.show_on_start,
      postToCommunity: c.post_to_community,
      notifyUsers: c.notify_users,
      status: c.status,
    });
    setEditing(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error(t("adminStore.titleRequired", "Informe um título."));
      return;
    }
    upsertMut.mutate();
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
        <div className="px-5 mt-4 space-y-3"><Skeleton className="h-40 w-full rounded-2xl" /></div>
      </div>
    );
  }

  if (!user) return null;
  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <ShieldAlert size={28} className="mb-3 text-muted-foreground" />
        <h2 className="font-display text-xl font-semibold">{t("adminCompliance.accessDeniedTitle")}</h2>
        <Link to="/" className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          {t("adminCompliance.backToHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">{t("admin.title", "Administração")}</span>
          <span className="w-9" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("adminStore.title", "Loja virtual")}</h1>
        <p className="mt-1 text-sm text-white/80">
          {t("adminStore.subtitle", "Campanhas de parceiros que aparecem no Iniciar e (opcional) na Comunidade.")}
        </p>
      </div>

      {/* Formulário criar/editar */}
      <section className="mx-5 mt-4 space-y-4 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {editing ? <Pencil size={16} /> : <Plus size={16} />}
          {editing ? t("adminStore.editCampaign", "Editar campanha") : t("adminStore.newCampaign", "Nova campanha")}
          {editing && (
            <button onClick={() => { setForm(emptyForm); setEditing(false); }} className="ml-auto text-xs text-muted-foreground underline">
              {t("common.cancel", "Cancelar")}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t("adminStore.partner", "Parceiro")}</Label>
          <Select value={form.partnerId ?? "none"} onValueChange={(v) => setForm((s) => ({ ...s, partnerId: v === "none" ? null : v }))}>
            <SelectTrigger><SelectValue placeholder={t("adminStore.selectPartner", "Selecione o parceiro")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("adminStore.noPartner", "Sem parceiro (institucional)")}</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("adminStore.campaignTitle", "Título")}</Label>
          <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder={t("adminStore.titlePlaceholder", "Ex.: 20% em aluguel de bikes")} maxLength={120} />
        </div>

        <div className="space-y-1.5">
          <Label>{t("adminStore.description", "Descrição")}</Label>
          <Textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} rows={3} placeholder={t("adminStore.descriptionPlaceholder", "Detalhe a oferta…")} />
        </div>

        {/* Imagem */}
        {form.imageUrl ? (
          <div className="relative overflow-hidden rounded-2xl">
            <img src={resolveAsset(form.imageUrl)} alt="" className="h-44 w-full object-cover" />
            <button onClick={() => setForm((s) => ({ ...s, imageUrl: null }))} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-6 text-sm font-medium text-muted-foreground"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
            {uploading ? t("common.loading", "Carregando…") : t("adminStore.addImage", "Adicionar imagem")}
          </button>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>{t("adminStore.ctaLabel", "Texto do botão")}</Label>
            <Input value={form.ctaLabel} onChange={(e) => setForm((s) => ({ ...s, ctaLabel: e.target.value }))} placeholder="Ver oferta" maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("adminStore.price", "Preço / obs.")}</Label>
            <Input value={form.price} onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))} placeholder="R$ 199" maxLength={40} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t("adminStore.ctaUrl", "Link (loja/WhatsApp)")}</Label>
          <Input value={form.ctaUrl} onChange={(e) => setForm((s) => ({ ...s, ctaUrl: e.target.value }))} placeholder="https://…" inputMode="url" />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary/50 p-3">
          <div className="text-sm">
            <div className="font-medium">{t("adminStore.showOnStart", "Aparecer no Iniciar")}</div>
            <div className="text-[11px] text-muted-foreground">{t("adminStore.showOnStartHint", "Banner na tela de gravar atividade")}</div>
          </div>
          <Switch checked={form.showOnStart} onCheckedChange={(v) => setForm((s) => ({ ...s, showOnStart: v }))} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary/50 p-3">
          <div className="text-sm">
            <div className="font-medium">{t("adminStore.postToCommunity", "Postar na Comunidade")}</div>
            <div className="text-[11px] text-muted-foreground">{t("adminStore.postToCommunityHint", "Cria uma publicação da campanha (uma vez)")}</div>
          </div>
          <Switch checked={form.postToCommunity} onCheckedChange={(v) => setForm((s) => ({ ...s, postToCommunity: v }))} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary/50 p-3">
          <div className="text-sm">
            <div className="font-medium">{t("adminStore.notifyUsers", "Notificar todos no sininho")}</div>
            <div className="text-[11px] text-muted-foreground">{t("adminStore.notifyUsersHint", "Envia uma notificação para todos os usuários (uma vez)")}</div>
          </div>
          <Switch checked={form.notifyUsers} onCheckedChange={(v) => setForm((s) => ({ ...s, notifyUsers: v }))} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary/50 p-3">
          <div className="text-sm font-medium">{t("adminStore.status", "Status")}</div>
          <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v as "active" | "paused" }))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("adminStore.statusActive", "Ativa")}</SelectItem>
              <SelectItem value="paused">{t("adminStore.statusPaused", "Pausada")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <button
          onClick={handleSave}
          disabled={upsertMut.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
        >
          {upsertMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
          {editing ? t("common.save", "Salvar") : t("adminStore.create", "Criar campanha")}
        </button>
      </section>

      {/* Lista de campanhas */}
      <section className="px-5 mt-5">
        <h2 className="mb-2 text-sm font-semibold">{t("adminStore.listTitle", "Campanhas")}</h2>
        {campaignsLoading ? (
          <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
            {t("adminStore.empty", "Nenhuma campanha ainda.")}
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                {c.image_url ? (
                  <img src={resolveAsset(c.image_url)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Store size={20} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.status === "active" ? "bg-green-500/15 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {c.status === "active" ? t("adminStore.statusActive", "Ativa") : t("adminStore.statusPaused", "Pausada")}
                    </span>
                    {c.show_on_start && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t("adminStore.tagStart", "Iniciar")}</span>}
                    {c.post_to_community && <span className="rounded-full bg-[var(--sun)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--earth)]">{t("adminStore.tagCommunity", "Comunidade")}</span>}
                  </div>
                </div>
                <button onClick={() => startEdit(c)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground/70" aria-label={t("common.edit", "Editar")}>
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => { if (window.confirm(t("adminStore.confirmDelete", "Excluir esta campanha?"))) deleteMut.mutate(c.id); }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-destructive"
                  aria-label={t("common.delete", "Excluir")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
