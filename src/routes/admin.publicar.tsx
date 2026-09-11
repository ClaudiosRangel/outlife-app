import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Image as ImageIcon, Video, Send, X } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  isCurrentUserAdmin,
  createCommunityPost,
  uploadCommunityPostImage,
  uploadCommunityPostVideo,
  type CommunityPostCategory,
} from "@/lib/api";
import { validateVideoFileMeta, videoRejectionMessage } from "@/lib/video-validation";
import { readVideoDurationSeconds } from "@/lib/video-duration";

export const Route = createFileRoute("/admin/publicar")({
  component: AdminPublish,
  head: () => ({
    meta: [
      { title: "Publicar interação — OutVitar Admin" },
      { name: "description", content: "Crie uma publicação com imagem ou vídeo em qualquer categoria." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/publicar" }],
  }),
});

// As categorias correspondem aos "menus" do app (mesmo CHECK de
// community_posts.category). Publicar aqui faz a interação aparecer na
// Comunidade, filtrável pela aba correspondente.
const CATEGORIES: { value: CommunityPostCategory; labelKey: string }[] = [
  { value: "relato", labelKey: "adminPublish.cat.relato" },
  { value: "trilha", labelKey: "adminPublish.cat.trilha" },
  { value: "camping", labelKey: "adminPublish.cat.camping" },
  { value: "pedalada", labelKey: "adminPublish.cat.pedalada" },
  { value: "caminhada", labelKey: "adminPublish.cat.caminhada" },
  { value: "outro", labelKey: "adminPublish.cat.outro" },
];

function AdminPublish() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-current-user-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState<CommunityPostCategory>("relato");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setVideoFile(null);
    setImageFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handlePickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const meta = validateVideoFileMeta({ type: f.type, size: f.size });
    if (!meta.ok) {
      toast.error(videoRejectionMessage(meta.reason));
      return;
    }
    try {
      const seconds = await readVideoDurationSeconds(f);
      if (seconds > 60) {
        toast.error(t("adminPublish.videoTooLong"));
        return;
      }
    } catch {
      // se não conseguir ler a duração, segue (o backend/limite de tamanho protege)
    }
    setImageFile(null);
    setVideoFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const clearMedia = () => {
    setImageFile(null);
    setVideoFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      let image_url: string | undefined;
      let video_url: string | undefined;
      if (imageFile) image_url = await uploadCommunityPostImage(imageFile);
      if (videoFile) video_url = await uploadCommunityPostVideo(videoFile);
      await createCommunityPost({
        text: text.trim(),
        place: place.trim() || undefined,
        category,
        image_url,
        video_url,
      });
    },
    onSuccess: () => {
      toast.success(t("adminPublish.published"));
      setText("");
      setPlace("");
      clearMedia();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePublish = () => {
    if (!text.trim()) {
      toast.error(t("adminPublish.errorText"));
      return;
    }
    publishMutation.mutate();
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
        <div className="px-5 mt-4 space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
          <ShieldAlert size={24} className="text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">{t("adminCompliance.accessDeniedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminCompliance.accessDeniedDescription")}</p>
        <Link to="/" className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
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
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("admin.title", "Administração")}
          </span>
          <span className="w-9" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("adminPublish.title")}</h1>
        <p className="mt-1 text-sm text-white/80">{t("adminPublish.subtitle")}</p>
      </div>

      <section className="px-5 mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>{t("adminPublish.categoryLabel")}</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as CommunityPostCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-text">{t("adminPublish.textLabel")}</Label>
          <Textarea id="pub-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={t("adminPublish.textPlaceholder")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-place">{t("adminPublish.placeLabel")}</Label>
          <Input id="pub-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t("adminPublish.placePlaceholder")} />
        </div>

        {/* Mídia */}
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-2xl">
            {videoFile ? (
              <video src={previewUrl} className="h-56 w-full object-cover" controls />
            ) : (
              <img src={previewUrl} alt="" className="h-56 w-full object-cover" />
            )}
            <button
              onClick={clearMedia}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
              aria-label={t("adminPublish.removeMedia")}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground"
            >
              <ImageIcon size={18} /> {t("adminPublish.addImage")}
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground"
            >
              <Video size={18} /> {t("adminPublish.addVideo")}
            </button>
          </div>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handlePickVideo} />

        <button
          onClick={handlePublish}
          disabled={publishMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <Send size={16} /> {publishMutation.isPending ? t("common.loading") : t("adminPublish.publish")}
        </button>
      </section>
    </div>
  );
}
