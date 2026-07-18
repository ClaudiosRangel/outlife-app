import { useState, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  MapPin,
  Share2,
  Plus,
  Send,
  Camera,
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
  img: string;
  category: CommunityPostCategory;
  likes: number;
  comments: number;
  liked?: boolean;
  following?: boolean;
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
export type CommunityTab = "forYou" | "following" | "trails" | "camping" | "stories";

const TAB_TO_CATEGORY: Record<Exclude<CommunityTab, "forYou" | "following">, CommunityPostCategory> = {
  trails: "trilha",
  camping: "camping",
  stories: "relato",
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
      { title: "Comunidade — Outlife" },
      { name: "description", content: "Compartilhe relatos, fotos e dicas de aventuras outdoor com a comunidade Outlife." },
      { property: "og:title", content: "Comunidade — Outlife" },
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
    category: (p.category ?? "outro") as CommunityPostCategory,
    likes: p.likes ?? 0,
    comments: p.comments_count ?? 0,
  };
}

function Community() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState<CommunityPostCategory>("outro");
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

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
      return createCommunityPost({ text, place, category, image_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      toast.success(t("community.published"));
      closeDrawer();
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
    setPreview(null);
    setSelectedFile(null);
    setText("");
    setPlace("");
    setCategory("outro");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
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

  const handleShare = (p: UIPost) => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/comunidade#post-${p.id}`
      : `/comunidade#post-${p.id}`;
    shareContent({ title: p.user, text: p.text, url });
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
          {(["forYou", "following", "trails", "camping", "stories"] as const).map((k) => (
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

                <div className="relative aspect-[4/5]">
                  <img src={p.img} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>

                <div className="p-4">
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

            {/* Tipo de publicação */}
            <div>
              <label className="mb-2 block text-sm font-medium">{t("community.categoryLabel")}</label>
              <Select value={category} onValueChange={(v) => setCategory(v as CommunityPostCategory)}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder={t("community.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {(["trilha", "camping", "relato", "outro"] as const).map((c) => (
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
