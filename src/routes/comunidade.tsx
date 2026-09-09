import { useState, useRef, useCallback, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  MapPin,
  Share2,
  Plus,
  Send,
  Camera,
  Video,
  Loader2,
  Trash2,
} from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import community1 from "@/assets/community-1.jpg";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchCommunityPosts,
  createCommunityPost,
  uploadCommunityPostImage,
  uploadCommunityPostVideo,
  deleteCommunityPost,
  resolveAsset,
  togglePostLike,
  fetchMyLikedPostIds,
  toggleAuthorFollow,
  fetchMyFollowedAuthorIds,
  fetchPostComments,
  createPostComment,
  type PostComment,
  type CommunityPostCategory,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { shareContent } from "@/lib/share";
import { generatePostBanner } from "@/lib/banner-generator";
import { communityCategoryTranslationKey } from "@/lib/community-category-label";
import { createObjectUrlManager } from "@/lib/object-url-preview";
import { SafeImage } from "@/components/SafeImage";
import { SafeVideo } from "@/components/SafeVideo";
import {
  validateVideoFileMeta,
  validateVideoDuration,
  videoRejectionMessage,
} from "@/lib/video-validation";
import { readVideoDurationSeconds } from "@/lib/video-duration";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";


type UIPost = {
  id: string;
  authorId: string;
  user: string;
  handle: string;
  avatar: string;
  time: string;
  place: string;
  text: string;
  /** Imagem exibida (com fallback genérico quando o post não tem mídia). */
  img: string;
  /** Imagem REAL do post (image_url), ou null quando não há foto própria.
   *  Usada como poster de vídeo e base do banner de compartilhamento — nunca
   *  cai no fallback genérico, para não pôr uma foto que não é do post. */
  realImg: string | null;
  /** URL do vídeo do post (Req 1.3/4.4): quando presente, o feed mostra
   *  SafeVideo usando `realImg` como poster (se houver); senão SafeImage. */
  videoUrl?: string | null;
  category: CommunityPostCategory;
  likes: number;
  comments: number;
  liked?: boolean;
  following?: boolean;
  /** Quando o post foi gerado ao finalizar uma atividade, o id dela — permite
   *  abrir o detalhe da atividade e incluir o deep link no compartilhamento. */
  activityId?: string | null;
};

// As abas "Para você"/"Seguindo"/"Trilhas"/"Camping"/"Relatos" agora
// filtram por `community_posts.category` real (Requirement solicitado pelo
// usuário: combobox de tipo de publicação no formulário de criação, e o
// menu de abas deve respeitar esse tipo em vez da correspondência por
// palavra-chave usada anteriormente como aproximação).
// - "forYou": sem filtro (todos os posts).
// - "following": filtro por autor seguido, reaproveita `followedAuthorIds`
//   já carregado para o botão de seguir de cada post.
// - "trails"/"camping"/"stories": filtro exato por `category`.
export type CommunityTab =
  | "forYou"
  | "following"
  | "trails"
  | "camping"
  | "stories"
  | "biking"
  | "walking";

const TAB_TO_CATEGORY: Record<Exclude<CommunityTab, "forYou" | "following">, CommunityPostCategory> = {
  trails: "trilha",
  camping: "camping",
  stories: "relato",
  biking: "pedalada",
  walking: "caminhada",
};

export function filterPostsByTab(posts: UIPost[], tab: CommunityTab): UIPost[] {
  if (tab === "forYou") return posts;
  if (tab === "following") return posts.filter((p) => p.following);
  return posts.filter((p) => p.category === TAB_TO_CATEGORY[tab]);
}

export const Route = createFileRoute("/comunidade")({
  component: Community,
  head: () => ({
    meta: [
      { title: "Comunidade — OutVitar" },
      { name: "description", content: "Compartilhe relatos, fotos e dicas de aventuras outdoor com a comunidade OutVitar." },
      { property: "og:title", content: "Comunidade — OutVitar" },
      { property: "og:description", content: "Relatos, fotos e dicas da comunidade outdoor." },
      { property: "og:url", content: "/comunidade" },
    ],
    links: [{ rel: "canonical", href: "/comunidade" }],
  }),
});

function toUIPost(p: any): UIPost {
  const author = p.author ?? {};
  const created = p.created_at ? new Date(p.created_at) : new Date();
  return {
    id: p.id,
    authorId: p.author_id,
    user: author.full_name || "Aventureiro",
    handle: author.username ? `@${author.username}` : "@outlife",
    avatar: resolveAsset(author.avatar_url, community1),
    time: created.toLocaleDateString("pt-BR"),
    place: p.place || "Brasil",
    text: p.text || "",
    img: resolveAsset(p.image_url, community1),
    realImg: p.image_url ? resolveAsset(p.image_url, community1) : null,
    videoUrl: p.video_url ?? null,
    category: (p.category ?? "outro") as CommunityPostCategory,
    likes: p.likes ?? 0,
    comments: p.comments_count ?? 0,
    activityId: p.activity_id ?? null,
  };
}

function Community() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Poll a cada 20s para refletir novos posts/curtidas/comentários de
  // outros usuários sem precisar recarregar a página manualmente
  // (Requirement solicitado pelo usuário: "ter uma atualização de tempo em
  // tempo para os comentários").
  const { data: rawPosts = [], isLoading } = useQuery({
    queryKey: ["community-posts"],
    queryFn: fetchCommunityPosts,
    refetchInterval: 20_000,
  });

  const { data: likedPostIds = [] } = useQuery({
    queryKey: ["my-liked-post-ids"],
    queryFn: fetchMyLikedPostIds,
    enabled: !!user,
  });

  const { data: followedAuthorIds = [] } = useQuery({
    queryKey: ["my-followed-author-ids"],
    queryFn: fetchMyFollowedAuthorIds,
    enabled: !!user,
  });

  const remotePosts: UIPost[] = (rawPosts as any[]).map(toUIPost);
  const likedPostIdSet = new Set(likedPostIds);
  const followedAuthorIdSet = new Set(followedAuthorIds);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<UIPost>>>({});
  const posts: UIPost[] = remotePosts.map((p) => ({
    ...p,
    liked: likedPostIdSet.has(p.id),
    following: followedAuthorIdSet.has(p.authorId),
    ...(localOverrides[p.id] ?? {}),
  }));

  const [activeTab, setActiveTab] = useState<CommunityTab>("forYou");
  const visiblePosts = filterPostsByTab(posts, activeTab);

  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState<CommunityPostCategory>("outro");
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  // Object_URL do preview atual (spec estabilidade-comunidade-midia): usamos
  // URL.createObjectURL em vez de FileReader.readAsDataURL para não
  // materializar a imagem inteira como base64 em memória (causa de crash em
  // fotos grandes). A ref guarda o URL vigente para revogá-lo ao trocar de
  // foto, fechar o formulário, publicar ou desmontar.
  const previewManagerRef = useRef(
    createObjectUrlManager({
      create: (f) => URL.createObjectURL(f),
      revoke: (u) => URL.revokeObjectURL(u),
    }),
  );
  // Gerenciador de Object_URL separado para o preview de VÍDEO (mesma
  // disciplina de memória do Bloco B: nunca base64, revogar ao trocar/limpar).
  const videoPreviewManagerRef = useRef(
    createObjectUrlManager({
      create: (f) => URL.createObjectURL(f),
      revoke: (u) => URL.revokeObjectURL(u),
    }),
  );

  const setPreviewFromFile = useCallback((file: File) => {
    const url = previewManagerRef.current.set(file); // revoga anterior (Req 1.3)
    setSelectedFile(file);
    setPreview(url);
  }, []);

  const clearPreview = useCallback(() => {
    previewManagerRef.current.clear(); // revoga atual (Req 1.2)
    setSelectedFile(null);
    setPreview(null);
  }, []);

  const setVideoFromFile = useCallback((file: File) => {
    const url = videoPreviewManagerRef.current.set(file); // revoga anterior (Req 1.2)
    setSelectedVideo(file);
    setVideoPreview(url);
  }, []);

  const clearVideo = useCallback(() => {
    videoPreviewManagerRef.current.clear();
    setSelectedVideo(null);
    setVideoPreview(null);
  }, []);

  // Revoga qualquer Object_URL pendente ao desmontar (Req 1.2).
  useEffect(() => {
    const manager = previewManagerRef.current;
    const videoManager = videoPreviewManagerRef.current;
    return () => {
      manager.clear();
      videoManager.clear();
    };
  }, []);

  // Corrige o bug em que toda foto escolhida caía sempre na imagem padrão:
  // antes, o formulário só gerava uma preview local (base64, `handleFile`) e
  // `createCommunityPost` era chamado sem `image_url`. Agora o arquivo real
  // é enviado via `uploadCommunityPostImage` antes de criar o post.
  const createMutation = useMutation({
    mutationFn: async ({
      text,
      place,
      category,
    }: { text: string; place?: string; category: CommunityPostCategory }) => {
      const image_url = selectedFile ? await uploadCommunityPostImage(selectedFile) : undefined;
      // Vídeo é enviado ANTES de criar o post; se o upload falhar, a exceção
      // sobe (onError) e o post não é criado com `video_url` quebrado (Req 3.3).
      const video_url = selectedVideo ? await uploadCommunityPostVideo(selectedVideo) : undefined;
      return createCommunityPost({ text, place, category, image_url, video_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      toast.success(t("community.published"));
      closeDrawer(); // já revoga o Object_URL via clearPreview (Req 1.2)
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDrawer = () => {
    if (!user) {
      toast.error(t("community.loginRequired"));
      return;
    }
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setIsOpen(false);
    clearPreview(); // revoga o Object_URL e limpa preview/arquivo (Req 1.2)
    clearVideo();
    setText("");
    setPlace("");
    setCategory("outro");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFromFile(file); // Object_URL em vez de base64 (Req 1.1/1.3)
  };

  // Seleção de vídeo: valida tipo/tamanho (puro) e duração (via <video>
  // metadata) ANTES de aceitar — recusa com mensagem clara, sem travar
  // (Req 2.1/2.2/2.3/2.5). Só cria o preview se passar em tudo.
  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite reescolher o mesmo arquivo depois (reset do input).
    e.target.value = "";
    if (!file) return;

    const meta = validateVideoFileMeta({ type: file.type, size: file.size });
    if (!meta.ok) {
      toast.error(videoRejectionMessage(meta.reason));
      return;
    }
    const seconds = await readVideoDurationSeconds(file);
    if (!validateVideoDuration(seconds).ok) {
      toast.error(videoRejectionMessage("duration"));
      return;
    }
    setVideoFromFile(file); // Object_URL, nunca base64 (Req 1.2)
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    createMutation.mutate({ text: text.trim(), place: place.trim() || undefined, category });
  };

  const likeMutation = useMutation({
    mutationFn: (postId: string) => togglePostLike(postId),
    onMutate: (postId: string) => {
      const previous = localOverrides[postId];
      setLocalOverrides((prev) => {
        const cur = prev[postId] ?? {};
        const base = remotePosts.find((p) => p.id === postId);
        const baseLiked = likedPostIdSet.has(postId);
        const liked = !(cur.liked ?? baseLiked);
        const baseLikes = base?.likes ?? 0;
        return { ...prev, [postId]: { ...cur, liked, likes: liked ? baseLikes + 1 : baseLikes } };
      });
      return { previous, postId };
    },
    onError: (_err, _postId, context) => {
      if (!context) return;
      setLocalOverrides((prev) => ({ ...prev, [context.postId]: context.previous ?? {} }));
      toast.error(t("community.likeError"));
    },
    onSuccess: (result, postId) => {
      setLocalOverrides((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? {}), liked: result.liked, likes: result.likes },
      }));
    },
  });

  const handleToggleLike = useCallback((postId: string) => {
    if (!user) {
      toast.error(t("community.loginRequired"));
      return;
    }
    likeMutation.mutate(postId);
  }, [user, likeMutation, t]);

  const followMutation = useMutation({
    mutationFn: ({ authorId }: { postId: string; authorId: string }) => toggleAuthorFollow(authorId),
    onMutate: ({ postId }: { postId: string; authorId: string }) => {
      const previous = localOverrides[postId];
      setLocalOverrides((prev) => {
        const cur = prev[postId] ?? {};
        const post = remotePosts.find((p) => p.id === postId);
        const baseFollowing = post ? followedAuthorIdSet.has(post.authorId) : false;
        const following = !(cur.following ?? baseFollowing);
        return { ...prev, [postId]: { ...cur, following } };
      });
      return { previous, postId };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      setLocalOverrides((prev) => ({ ...prev, [context.postId]: context.previous ?? {} }));
      toast.error(t("community.followError"));
    },
    onSuccess: (result, { postId }) => {
      setLocalOverrides((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? {}), following: result.following },
      }));
    },
  });

  const handleToggleFollow = useCallback((postId: string, authorId: string) => {
    if (!user) {
      toast.error(t("community.loginRequired"));
      return;
    }
    followMutation.mutate({ postId, authorId });
  }, [user, followMutation, t]);

  const toggleComments = (id: string) => {
    setShowComments((s) => ({ ...s, [id]: !s[id] }));
  };

  // Requirement solicitado pelo usuário: permitir excluir a própria
  // publicação da comunidade. A RLS de `community_posts` ("Users can delete
  // their own posts", USING auth.uid() = author_id) já restringe isso a
  // nível de banco; o botão de excluir só é exibido no próprio post (ver
  // `p.authorId === user?.id` no JSX) e a confirmação evita exclusão
  // acidental.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deleteCommunityPost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      toast.success(t("community.postDeleted"));
      setPendingDeleteId(null);
    },
    onError: () => {
      toast.error(t("community.deleteError"));
    },
  });

  // Requirement 10.1/10.3: reaproveita o botão de compartilhar já existente
  // no card, agora gerando o Share_Banner_Image (foto + categoria + texto)
  // via Banner_Generator em vez de compartilhar apenas um link de texto.
  const handleShare = async (p: UIPost) => {
    try {
      const blob = await generatePostBanner({
        // Usa a imagem REAL do post (nunca o fallback genérico). Sem foto real
        // (ex.: post só com vídeo), o banner usa o fundo padrão — não uma foto
        // que não é do post.
        photoUrl: p.realImg,
        categoryLabel: t(communityCategoryTranslationKey(p.category)),
        text: p.text,
      });
      // Quando o post veio de uma atividade, inclui o deep link /a/:id no
      // texto do compartilhamento (mesmo padrão da tela de detalhe da
      // atividade): abrir o link leva ao app (se instalado) ou à página de
      // preview. Posts manuais compartilham só o banner, sem link.
      const shareText = p.activityId
        ? `${p.text ? p.text + " " : ""}${window.location.origin}/a/${p.activityId}`
        : undefined;
      await shareContent({
        title: p.user,
        file: blob,
        fileName: "outlife-comunidade.webp",
        text: shareText,
      });
    } catch {
      // Requirement 7.7/10.4 — falha na geração do banner (incluindo
      // timeout) nunca aciona o compartilhamento com um resultado
      // incompleto; exibe erro reexecutável em vez de propagar.
      toast.error(t("community.shareBannerError"));
    }
  };


  return (
    <div className="animate-float-up relative min-h-full pb-20">
      <StatusBar />
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">{t("community.title")}</h1>
          <button
            onClick={openDrawer}
            aria-label={t("community.newPost")}
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-card active:scale-95 transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {(["forYou", "following", "trails", "camping", "stories", "biking", "walking"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setActiveTab(k)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-base ${
                activeTab === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t(`community.tabs.${k}`)}
            </button>
          ))}
        </div>
      </div>


      <div className="space-y-4 px-5 pb-6">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-3xl bg-card shadow-card">
                <div className="flex items-center gap-3 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="aspect-[4/5] w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          : visiblePosts.length === 0
          ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
                {t("community.emptyTab", "Nenhuma publicação por aqui ainda.")}
              </div>
            )
          : visiblePosts.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-3xl bg-card shadow-card">
                <header className="flex items-center gap-3 p-4">
                  <img
                    src={p.avatar}
                    alt={p.user}
                    loading="lazy"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight">{p.user}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin size={10} /> {p.place} · {p.time}
                    </div>
                  </div>
                  {/* Requirement 7.2/7.3 — o botão de seguir não faz sentido no
                      próprio post; exibi-lo levava ao erro genérico "Não foi
                      possível seguir" (toggleAuthorFollow rejeita seguir a si
                      mesmo). Ocultado quando o autor é o usuário autenticado. */}
                  {p.authorId !== user?.id && (
                    <button
                      onClick={() => handleToggleFollow(p.id, p.authorId)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-base ${
                        p.following
                          ? "bg-secondary text-foreground/60"
                          : "text-primary"
                      }`}
                    >
                      {p.following ? t("community.following") : t("community.follow")}
                    </button>
                  )}
                  {/* Excluir a própria publicação: só aparece no post do
                      próprio usuário autenticado. */}
                  {p.authorId === user?.id && (
                    <button
                      onClick={() => setPendingDeleteId(p.id)}
                      aria-label={t("community.deletePost")}
                      className="ml-2 shrink-0 text-muted-foreground transition-base hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </header>

                {/* Post de atividade (activityId presente): a imagem vira um
                    botão que leva ao detalhe da atividade (/atividade/:id).
                    Posts manuais (sem activityId) seguem como imagem estática. */}
                {p.videoUrl ? (
                  // Precedência (Req 1.3/4.4): quando há vídeo, ele é a mídia
                  // principal; a imagem do post vira o poster. SafeVideo não faz
                  // autoplay/preload — só o poster é decodificado até o play.
                  <SafeVideo src={p.videoUrl} posterSrc={p.realImg ?? undefined} />
                ) : p.activityId ? (
                  <SafeImage
                    src={p.img}
                    alt=""
                    fallbackSrc={community1}
                    onClick={() => navigate({ to: "/atividade/$activityId", params: { activityId: p.activityId! } })}
                    ariaLabel={t("activity.detailTitle")}
                  />
                ) : (
                  <SafeImage src={p.img} alt="" fallbackSrc={community1} />
                )}

                <div className="p-4">
                  {/* Requirement 9.1/9.2/9.3: rótulo da categoria, sempre
                      visível sem exigir toque/rolagem, na mesma tradução
                      usada no seletor do formulário de criação (mesma
                      fonte, `communityCategoryTranslationKey`). */}
                  <span className="mb-2 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {t(communityCategoryTranslationKey(p.category))}
                  </span>
                  <div className="flex items-center gap-4 text-foreground">
                    <button
                      onClick={() => handleToggleLike(p.id)}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${
                        p.liked ? "text-red-500" : ""
                      }`}
                    >
                      <Heart size={20} fill={p.liked ? "currentColor" : "none"} />
                      <span className="font-medium">{p.likes}</span>
                    </button>
                    <button onClick={() => toggleComments(p.id)} className="flex items-center gap-1.5 text-sm">
                      <MessageCircle size={20} />
                      <span className="font-medium">{p.comments}</span>
                    </button>
                    <button onClick={() => handleShare(p)} className="ml-auto" aria-label={t("common.share")}>
                      <Share2 size={20} />
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">
                    <span className="font-semibold">{p.handle}</span> {p.text}
                  </p>
                  {p.comments > 0 && (
                    <button onClick={() => toggleComments(p.id)} className="mt-2 text-xs text-muted-foreground">
                      {showComments[p.id] ? t("community.hideComments") : t("community.showComments", { count: p.comments })}
                    </button>
                  )}


                  {showComments[p.id] && (
                    <PostComments postId={p.id} currentUserId={user?.id} />
                  )}
                </div>
              </article>
            ))}
      </div>

      {/* Drawer de criação — usa o componente Sheet (renderiza via portal do
          Radix) em vez de uma `div fixed inset-0` manual. O modal manual
          antigo ficava preso dentro do PhoneFrame (que tem `overflow-hidden`
          + `relative`), quebrando o posicionamento fixo em mobile e
          obrigando a rolar a tela para encontrar o conteúdo do formulário. */}
      <Sheet open={isOpen} onOpenChange={(open) => (open ? openDrawer() : closeDrawer())}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{t("community.drawerTitle")}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 py-4">
            {/* Foto */}
            <div>
              <label className="mb-2 block text-sm font-medium">{t("community.photoLabel")}</label>
              <button
                onClick={() => fileRef.current?.click()}
                className="relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-6 text-muted-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <>
                    <Camera size={28} className="text-muted-foreground" />
                    <span className="text-sm">{t("community.addPhoto")}</span>
                    <span className="text-xs text-muted-foreground/70">{t("community.photoHint")}</span>
                  </>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFile}
                />
              </button>
            </div>

            {/* Vídeo (opcional) — limites 30 MB / 60 s validados na seleção.
                Sem autoplay no preview; preview via Object_URL (nunca base64). */}
            <div>
              <label className="mb-2 block text-sm font-medium">{t("community.videoLabel")}</label>
              <button
                onClick={() => videoRef.current?.click()}
                className="relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-6 text-muted-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                {videoPreview ? (
                  <video
                    src={videoPreview}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <>
                    <Video size={28} className="text-muted-foreground" />
                    <span className="text-sm">{t("community.addVideo")}</span>
                    <span className="text-xs text-muted-foreground/70">{t("community.videoHint")}</span>
                  </>
                )}

                <input
                  ref={videoRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={handleVideoFile}
                />
              </button>
              {videoPreview && (
                <button
                  onClick={clearVideo}
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline"
                >
                  {t("community.removeVideo")}
                </button>
              )}
            </div>

            {/* Tipo de publicação */}
            <div>
              <label className="mb-2 block text-sm font-medium">{t("community.categoryLabel")}</label>
              <Select value={category} onValueChange={(v) => setCategory(v as CommunityPostCategory)}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder={t("community.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {(["trilha", "camping", "relato", "outro", "pedalada", "caminhada"] as const).map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`community.categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Local */}
            <div>
              <label className="mb-2 block text-sm font-medium">{t("community.placeLabel")}</label>
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder={t("community.placePlaceholder")}
                  className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Texto */}
            <div>
              <label className="mb-2 block text-sm font-medium">{t("community.textLabel")}</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("community.textPlaceholder")}
                rows={4}
                className="w-full rounded-xl border border-border bg-card p-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {text.length}/500
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={closeDrawer}
                className="flex-1 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || createMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50 disabled:active:scale-100 active:scale-[0.98] transition-transform"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {createMutation.isPending ? t("community.publishing") : t("community.publish")}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmação de exclusão da própria publicação */}
      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("community.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("community.confirmDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("common.loading") : t("community.deletePost")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PostComments({ postId, currentUserId }: { postId: string; currentUserId: string | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  // Mesmo requisito de atualização periódica, aplicado aos comentários de
  // cada post aberto: novos comentários de outros usuários aparecem sem
  // precisar fechar/reabrir a seção.
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => fetchPostComments(postId),
    refetchInterval: 20_000,
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => createPostComment(postId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      setCommentText("");
    },
    onError: () => {
      toast.error(t("community.commentError"));
    },
  });

  const handleSubmitComment = () => {
    if (!currentUserId) {
      toast.error(t("community.loginRequired"));
      return;
    }
    const trimmed = commentText.trim();
    if (trimmed.length === 0) return;
    commentMutation.mutate(trimmed);
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("community.noComments")}</p>
      ) : (
        comments.map((c: PostComment) => {
          const name = c.author?.full_name || "Aventureiro";
          const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={c.id} className="flex items-start gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                {initials}
              </span>
              <div className="flex-1 rounded-2xl bg-secondary/60 px-3 py-2">
                <div className="text-[12px] font-semibold">{name}</div>
                <div className="text-[12px] text-foreground/80">{c.text}</div>
              </div>
            </div>
          );
        })
      )}
      <div className="flex items-center gap-2">
        {/* Bug corrigido: `text-xs` (12px) fica abaixo do limite de 16px que
            Safari/Chrome no iOS respeitam sem forçar um zoom automático da
            página ao focar um campo de texto. Esse zoom empurrava o botão
            de enviar para fora da área visível (parecia "sumir" atrás do
            scroll). `text-base` no mobile (16px) evita o zoom; `md:text-sm`
            mantém o visual compacto original em telas maiores, mesmo padrão
            já usado pelo componente <Input> em outras telas. */}
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t("community.commentPlaceholder")}
          className="flex-1 rounded-full border border-border bg-card px-3 py-2 text-base outline-none md:text-xs"
        />
        <button
          onClick={handleSubmitComment}
          disabled={commentMutation.isPending || commentText.trim().length === 0}
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
