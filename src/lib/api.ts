// Camada de dados Outlife — todos os dados vêm do Supabase.
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { resizeImageForUpload } from "@/lib/image-resize";

import waterfall from "@/assets/cachoeira_do_tabuleiro.jpg";
import trail from "@/assets/trilha_pedra_do_sino.jpg";
import camp from "@/assets/camping_vale_estelar.jpg";
import peak from "@/assets/pico_agulhas_negras.jpg";
import guide from "@/assets/partner-guide.jpg";
import lodge from "@/assets/partner-lodge.jpg";
import photographer from "@/assets/partner-photographer.jpg";

// ============ Tipos ============
export type Destination = {
  id: string;
  name: string;
  region: string;
  difficulty: string;
  img: string;
  rating: number;
  distance: string;
  elevation: number;
  duration: string;
  type: string;
  trailType: string;
};

// Chaves de filtro exibidas como chips em /explorar (exclui "all", que representa "sem filtro").
export type Difficulty = "easy" | "moderate" | "hard" | "accessible" | "near";

export type Partner = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  img: string;
  rating: number;
  reviews: number;
  verified: boolean;
  location: string;
  description: string;
  tags: string[];
  price: string;
  gallery: string[];
  available: boolean;
  coords: { lat: number; lng: number } | null;
};

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null } | null;
};

// Mapeia paths salvos no seed para imports reais (assets locais)
const assetMap: Record<string, string> = {
  "/src/assets/cachoeira_do_tabuleiro.jpg": waterfall,
  "/src/assets/trilha_pedra_do_sino.jpg": trail,
  "/src/assets/camping_vale_estelar.jpg": camp,
  "/src/assets/pico_agulhas_negras.jpg": peak,
  "/src/assets/partner-guide.jpg": guide,
  "/src/assets/partner-lodge.jpg": lodge,
  "/src/assets/partner-photographer.jpg": photographer,
};

export function resolveAsset(url?: string | null, fallback: string = guide): string {
  if (!url) return fallback;
  if (assetMap[url]) return assetMap[url];
  return url;
}

// ============ Destinos ============
export async function fetchDestinations(): Promise<Destination[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    region: d.region ?? "",
    difficulty: d.difficulty ?? "",
    img: resolveAsset(d.main_image_url, waterfall),
    rating: Number(d.rating ?? 0),
    distance: d.distance ?? "",
    elevation: Number(String(d.elevation ?? "0").replace(/[^0-9]/g, "")) || 0,
    duration: d.duration ?? "",
    type: d.type ?? "",
    trailType: d.trail_type ?? "",
  }));
}

export type DestinationDetail = {
  id: string;
  name: string;
  description: string | null;
  img: string;
  difficulty: string;
  distance: string;
  duration: string;
  elevation: number;
  type: string;
  status: "pending" | "approved" | "rejected";
  created_by: string | null;
};

// Busca um destino por id sem filtrar por status: a política de RLS de
// `destinations` já retorna a linha apenas quando `status = 'approved'` ou
// `auth.uid() = created_by` (ver migration 20260521193007), então `null`
// aqui cobre tanto "não existe" quanto "pending de outro usuário" — a tela
// de detalhe trata ambos como "destino não encontrado" sem distinção.
export async function fetchDestinationById(id: string): Promise<DestinationDetail | null> {
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    img: resolveAsset(data.main_image_url, waterfall),
    difficulty: data.difficulty ?? "",
    distance: data.distance ?? "",
    duration: data.duration ?? "",
    elevation: Number(String(data.elevation ?? "0").replace(/[^0-9]/g, "")) || 0,
    type: data.type ?? "",
    status: data.status,
    created_by: data.created_by,
  };
}

export type DbDestination = {
  id: string;
  name: string;
  region: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  description: string | null;
  main_image_url: string | null;
};

export async function fetchDestinationsRaw(): Promise<DbDestination[]> {
  const { data, error } = await supabase
    .from("destinations")
    .select("id, name, region, state, latitude, longitude, status, description, main_image_url")
    .order("name");
  if (error) throw error;
  return (data ?? []) as DbDestination[];
}

export async function findSimilarDestinations(name: string, lat?: number, lng?: number) {
  const { data, error } = await supabase.rpc("find_similar_destinations" as never, {
    _name: name,
    _lat: lat ?? null,
    _lng: lng ?? null,
    _radius_meters: 100,
  } as never);
  if (error) throw error;
  return (data ?? []) as DbDestination[];
}

export async function createPendingDestination(input: {
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  state?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("destinations")
    .insert({
      name: input.name,
      description: input.description ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      region: input.region ?? null,
      state: input.state ?? null,
      status: "pending",
      created_by: userData.user.id,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ Parceiros ============
function enrichPartner(profile: any): Partner {
  const lat = profile.latitude != null ? Number(profile.latitude) : null;
  const lng = profile.longitude != null ? Number(profile.longitude) : null;
  return {
    id: profile.id,
    name: profile.full_name ?? "Parceiro",
    category: profile.category ?? "Outros",
    subcategory: profile.category ?? "",
    img: resolveAsset(profile.avatar_url, guide),
    rating: Number(profile.rating ?? 0),
    reviews: Number(profile.reviews_count ?? 0),
    verified: Boolean(profile.is_verified),
    location: profile.location ?? "",
    description: profile.description ?? "",
    tags: Array.isArray(profile.tags) ? profile.tags : [],
    price: profile.price ?? "Sob consulta",
    gallery: Array.isArray(profile.gallery)
      ? profile.gallery.map((u: string) => resolveAsset(u, guide))
      : [],
    available: true,
    coords: lat != null && lng != null ? { lat, lng } : null,
  };
}

export async function fetchPartners(): Promise<Partner[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "partner")
    .order("rating", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(enrichPartner);
}

export async function fetchPartnerById(id: string): Promise<Partner | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "partner")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return enrichPartner(data);
}

// ============ Profile do usuário logado ============
export async function fetchMyProfile() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Allowlist de campos editáveis pelo próprio dono do perfil.
// Campos sensíveis (is_verified, rating, reviews_count, followers_count, role, status)
// permanecem protegidos pelo trigger `protect_profile_trust_fields` no Postgres.
const PROFILE_EDITABLE_FIELDS = [
  "full_name",
  "username",
  "avatar_url",
  "description",
  "category",
  "location",
  "website",
  "price",
  "tags",
  "gallery",
  "latitude",
  "longitude",
] as const;

export type ProfilePatch = Partial<Record<(typeof PROFILE_EDITABLE_FIELDS)[number], unknown>>;

export async function updateMyProfile(patch: ProfilePatch) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  // Filtra apenas as chaves permitidas, descartando silenciosamente o restante.
  const safe: Record<string, unknown> = {};
  for (const key of PROFILE_EDITABLE_FIELDS) {
    if (key in patch) safe[key] = (patch as Record<string, unknown>)[key];
  }
  if (Object.keys(safe).length === 0) throw new Error("Nenhum campo válido para atualizar");

  const { data, error } = await supabase
    .from("profiles")
    .update(safe as never)
    .eq("id", userData.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ Serviços ============
export async function fetchMyServices() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("services")
    .select("*, destination:destinations(id, name, region)")
    .eq("partner_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchServicesByPartner(partnerId: string) {
  const { data, error } = await supabase
    .from("services")
    .select("*, destination:destinations(id, name, region)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createService(input: {
  destination_id: string;
  title: string;
  description?: string;
  price?: number;
  images_urls?: string[];
  tags?: string[];
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("services")
    .insert({ ...input, partner_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(id: string) {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

// ============ Comunidade ============
export async function fetchCommunityPosts() {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*, author:profiles(full_name, username, avatar_url)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const MAX_COMMUNITY_POST_IMAGE_BYTES = 5 * 1024 * 1024;

// Envia a foto anexada a um Community_Post para o bucket
// `community-post-images` (migration `20260717120000_community-post-images-bucket.sql`),
// seguindo exatamente o mesmo padrão de resize client-side/validação/upload
// de `uploadAvatarImage`/`uploadPartnerGalleryImage`. Sem isso, o formulário
// de "Novo relato" só gerava uma preview local (base64) e nunca enviava a
// foto de fato — todo post caía no fallback de imagem padrão. Retorna a URL
// pública do arquivo, para ser passada como `image_url` em `createCommunityPost`.
export async function uploadCommunityPostImage(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const mime = file.type;
  const ext = ALLOWED_IMAGE_TYPES[mime];
  if (!ext) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  const optimized = await resizeImageForUpload(file, MAX_COMMUNITY_POST_IMAGE_BYTES);
  if (optimized.size > MAX_COMMUNITY_POST_IMAGE_BYTES) {
    throw new Error("Imagem muito grande (máx. 5 MB).");
  }
  const path = `${userData.user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("community-post-images")
    .upload(path, optimized, { upsert: false, contentType: mime });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("community-post-images").getPublicUrl(path);
  return pub.publicUrl;
}

export async function createCommunityPost(input: {
  text: string;
  place?: string;
  image_url?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Você precisa estar logado para publicar.");
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      text: input.text,
      place: input.place ?? null,
      image_url: input.image_url ?? null,
      author_id: userData.user.id,
    } as never)
    .select("*, author:profiles(full_name, username, avatar_url)")
    .single();
  if (error) throw error;
  return data;
}

// Exclui um Community_Post do próprio autor autenticado. A RLS de
// `community_posts` ("Users can delete their own posts", USING auth.uid() =
// author_id, migration 20260521193007) já restringe isso a nível de banco;
// aqui só propagamos o erro/sucesso da chamada.
export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) throw error;
}

// ============ Avaliações ============
export async function submitReview(
  targetId: string,
  targetType: "destination" | "partner",
  rating: number,
  comment?: string | null,
  imageUrl?: string | null,
): Promise<{ ok: true; xp: number }> {
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("A nota deve estar entre 1 e 5.");
  }
  const cleanComment = (comment ?? "").trim();
  if (cleanComment.length > 2000) {
    throw new Error("Comentário muito longo (máx. 2000 caracteres).");
  }
  const cleanImage = (imageUrl ?? "").trim() || null;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error("Você precisa estar logado para avaliar.");
  }
  const row: Record<string, unknown> = {
    author_id: userData.user.id,
    rating,
    comment: cleanComment.length > 0 ? cleanComment : null,
    image_url: cleanImage,
  };
  if (targetType === "destination") row.destination_id = targetId;
  else row.partner_id = targetId;

  const { data, error } = await supabase
    .from("reviews")
    .insert(row as never)
    .select("xp_awarded")
    .single();
  if (error) throw error;
  const xp = Number((data as { xp_awarded?: number } | null)?.xp_awarded ?? 0);
  return { ok: true, xp };
}

export async function uploadReviewPhoto(file: File): Promise<string> {
  const ALLOWED: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Formato não suportado. Use JPG, PNG ou WEBP.");

  // Redimensiona/comprime antes de validar o tamanho; em caso de falha,
  // resizeImageForUpload retorna o próprio arquivo original (fallback),
  // deixando a validação abaixo como última linha de defesa.
  const optimized = await resizeImageForUpload(file);
  if (optimized.size > 5 * 1024 * 1024) throw new Error("Imagem maior que 5MB.");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado.");

  const path = `${userData.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("review-photos")
    .upload(path, optimized, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path);
  return pub.publicUrl;
}

export async function fetchReviewsByDestination(destinationId: string): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, created_at, rating, comment, author:profiles(full_name, avatar_url)")
    .eq("destination_id", destinationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReviewItem[];
}

export async function fetchReviewsByPartner(partnerId: string): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, created_at, rating, comment, author:profiles(full_name, avatar_url)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReviewItem[];
}

// ============ Atividades (rastreio GPS) ============
export type UserActivity = {
  id: string;
  user_id: string;
  destination_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  route_geojson: GeoJSON.LineString | null;
  status: "in_progress" | "completed";
  description: string | null;
  image_url: string | null;
};

export async function startActivity(destinationId?: string | null): Promise<UserActivity> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("user_activities" as never)
    .insert({
      user_id: userData.user.id,
      destination_id: destinationId ?? null,
      status: "in_progress",
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as UserActivity;
}

export async function updateActivityProgress(
  id: string,
  patch: { distance_meters: number; route_geojson: GeoJSON.LineString },
) {
  const { error } = await supabase
    .from("user_activities" as never)
    .update({
      distance_meters: patch.distance_meters,
      route_geojson: patch.route_geojson as never,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function finishActivity(
  id: string,
  payload: {
    distance_meters: number;
    duration_seconds: number;
    route_geojson: GeoJSON.LineString;
    description?: string | null;
    image_url?: string | null;
  },
): Promise<UserActivity> {
  if (payload.route_geojson.type !== "LineString" || payload.route_geojson.coordinates.length < 2) {
    throw new Error("Trajeto inválido (mínimo 2 pontos).");
  }
  const { data, error } = await supabase.rpc("finish_user_activity" as never, {
    _id: id,
    _geojson: payload.route_geojson as never,
    _distance: payload.distance_meters,
    _duration: payload.duration_seconds,
    _description: payload.description ?? null,
    _image_url: payload.image_url ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as UserActivity;
}

const MAX_ACTIVITY_IMAGE_BYTES = 5 * 1024 * 1024;

// Envia a foto opcional anexada ao finalizar uma User_Activity para o
// bucket `activity-images` (migration
// `20260719090000_activity-description-and-image.sql`), seguindo o mesmo
// padrão de resize/validação/upload de `uploadAvatarImage`/
// `uploadCommunityPostImage`. Retorna a URL pública, passada como
// `image_url` para `finishActivity`.
export async function uploadActivityImage(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const mime = file.type;
  const ext = ALLOWED_IMAGE_TYPES[mime];
  if (!ext) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  const optimized = await resizeImageForUpload(file, MAX_ACTIVITY_IMAGE_BYTES);
  if (optimized.size > MAX_ACTIVITY_IMAGE_BYTES) {
    throw new Error("Imagem muito grande (máx. 5 MB).");
  }
  const path = `${userData.user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("activity-images")
    .upload(path, optimized, { upsert: false, contentType: mime });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("activity-images").getPublicUrl(path);
  return pub.publicUrl;
}

export async function discardActivity(id: string) {
  const { error } = await supabase.from("user_activities" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function fetchUserActivities(): Promise<UserActivity[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("user_activities" as never)
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("status", "completed")
    .order("start_time", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as UserActivity[];
}

export async function fetchActivityById(id: string): Promise<UserActivity | null> {
  const { data, error } = await supabase
    .from("user_activities" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as UserActivity | null;
}

// ============ Placeholders (preparados para integração futura) ============
// TODO: ligar a tabelas reais quando o schema for criado.

export type UserTrail = { id: string; name: string; distance: string };
export type SavedDestination = { id: string; name: string; region: string };
export type FavoritePartner = { id: string; name: string; category: string };
export type Achievement = { id: string; key: string; label: string; achievedAt?: string };
export type NextAdventure = {
  id: string;
  title: string;
  date: string;
  forecast: { label: string; temp: string }[];
} | null;
export type PartnerMetric = { key: string; value: string; delta: string };
export type PartnerChartPoint = { day: string; v: number };

export async function fetchUserTrails(_userId?: string): Promise<UserTrail[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("user_activities" as never)
    .select("id, distance_meters, destination:destinations(name)")
    .eq("user_id", userData.user.id)
    .eq("status", "completed")
    .order("start_time", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    id: string;
    distance_meters: number | null;
    destination: { name: string } | null;
  }>).map((row) => ({
    id: row.id,
    name: row.destination?.name ?? "Trilha",
    distance: row.distance_meters != null ? `${(Number(row.distance_meters) / 1000).toFixed(1)} km` : "—",
  }));
}

export async function saveDestination(destinationId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("saved_destinations" as never)
    .insert({ user_id: userData.user.id, destination_id: destinationId } as never);
  if (error) throw error;
}

export async function unsaveDestination(destinationId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("saved_destinations" as never)
    .delete()
    .eq("user_id", userData.user.id)
    .eq("destination_id", destinationId);
  if (error) throw error;
}

export async function fetchSavedDestinations(_userId?: string): Promise<SavedDestination[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("saved_destinations" as never)
    .select("destination_id, destination:destinations(id, name, region)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    destination_id: string;
    destination: { id: string; name: string; region: string | null } | null;
  }>).map((row) => ({
    id: row.destination?.id ?? row.destination_id,
    name: row.destination?.name ?? "Destino",
    region: row.destination?.region ?? "",
  }));
}

export async function favoritePartner(partnerId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("favorite_partners" as never)
    .insert({ user_id: userData.user.id, partner_id: partnerId } as never);
  if (error) throw error;
}

export async function unfavoritePartner(partnerId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("favorite_partners" as never)
    .delete()
    .eq("user_id", userData.user.id)
    .eq("partner_id", partnerId);
  if (error) throw error;
}

export async function fetchFavoritePartners(_userId?: string): Promise<FavoritePartner[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("favorite_partners" as never)
    .select("partner_id, partner:profiles(id, full_name, category)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    partner_id: string;
    partner: { id: string; full_name: string | null; category: string | null } | null;
  }>).map((row) => ({
    id: row.partner?.id ?? row.partner_id,
    name: row.partner?.full_name ?? "Parceiro",
    category: row.partner?.category ?? "",
  }));
}

// Mapa rule_code -> rótulo amigável. Fallback para o próprio rule_code
// quando a regra ainda não tiver um rótulo mapeado aqui.
const ACHIEVEMENT_RULE_LABELS: Record<string, string> = {
  first_activity: "Primeira Aventura",
  km_100: "100 km Percorridos",
  km_500: "500 km Percorridos",
  explorer: "Explorador",
  top_reviewer: "Avaliador Top",
};

export async function fetchUserAchievements(_userId?: string): Promise<Achievement[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("achievement_records" as never)
    .select("id, rule_code, achieved_at")
    .eq("user_id", userData.user.id)
    .order("achieved_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    id: string;
    rule_code: string;
    achieved_at: string;
  }>).map((row) => ({
    id: row.id,
    key: row.rule_code,
    label: ACHIEVEMENT_RULE_LABELS[row.rule_code] ?? row.rule_code,
    achievedAt: row.achieved_at,
  }));
}

export async function fetchNextAdventure(_userId?: string): Promise<NextAdventure> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("user_activities" as never)
    .select("id, start_time, destination:destinations(name)")
    .eq("user_id", userData.user.id)
    .eq("status", "scheduled")
    .gt("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data as unknown as {
    id: string;
    start_time: string;
    destination: { name: string } | null;
  } | null;
  if (!row) return null;
  return {
    id: row.id,
    title: row.destination?.name ?? "Próxima aventura",
    date: format(new Date(row.start_time), "EEE · d MMM", { locale: ptBR }),
    forecast: [],
  };
}


export type PartnerTrialStatus = {
  trialActive: boolean;
  contactClicks: number;
  remainingClicks: number;
  threshold: number;
};

export const PARTNER_TRIAL_CLICK_THRESHOLD = 15;

export async function fetchPartnerMetrics(partnerId: string): Promise<PartnerMetric[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("profile_views, contact_clicks")
    .eq("id", partnerId)
    .maybeSingle();
  if (error) throw error;
  const views = Number(data?.profile_views ?? 0);
  const clicks = Number(data?.contact_clicks ?? 0);
  return [
    { key: "views", value: views.toLocaleString("pt-BR"), delta: "" },
    { key: "whatsapp", value: clicks.toLocaleString("pt-BR"), delta: "" },
    { key: "instagram", value: "0", delta: "" },
  ];
}

export async function fetchPartnerTrialStatus(partnerId: string): Promise<PartnerTrialStatus> {
  const { data, error } = await supabase
    .from("profiles")
    .select("contact_clicks, trial_active")
    .eq("id", partnerId)
    .maybeSingle();
  if (error) throw error;
  const clicks = Number(data?.contact_clicks ?? 0);
  const trialActive = Boolean(data?.trial_active ?? true);
  return {
    trialActive,
    contactClicks: clicks,
    threshold: PARTNER_TRIAL_CLICK_THRESHOLD,
    remainingClicks: Math.max(PARTNER_TRIAL_CLICK_THRESHOLD - clicks, 0),
  };
}

export async function trackPartnerProfileView(partnerId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_partner_profile_view", { _partner_id: partnerId });
  if (error) throw error;
}

export async function trackPartnerContactClick(partnerId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_partner_contact_click", { _partner_id: partnerId });
  if (error) throw error;
}

// Agrega `partner_metric_daily` dos últimos 7 dias (hoje e os 6 anteriores)
// para o gráfico real do painel do parceiro (Requirement 12.2), substituindo
// o array fixo anterior. `v` reflete `views + contact_clicks` do dia — o
// gráfico exibe uma única série (barra por dia), então combinamos as duas
// métricas em um só valor em vez de introduzir uma segunda série na UI.
// Dias sem registro em `partner_metric_daily` são preenchidos com zero no
// cliente, e o rótulo de dia da semana é calculado a partir da data real
// (em vez de fixo), usando a primeira letra maiúscula do nome abreviado em
// português (mesmo padrão de abreviação de `date-fns`/`ptBR`).
export async function fetchPartnerChart(partnerId: string): Promise<PartnerChartPoint[]> {
  const today = new Date();
  const sixDaysAgo = new Date(today);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  const sixDaysAgoStr = format(sixDaysAgo, "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("partner_metric_daily" as never)
    .select("day, views, contact_clicks")
    .eq("partner_id", partnerId)
    .gte("day", sixDaysAgoStr)
    .order("day", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as { day: string; views: number; contact_clicks: number }[];
  const byDay = new Map(rows.map((r) => [r.day, r]));

  const points: PartnerChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = format(date, "yyyy-MM-dd");
    const row = byDay.get(key);
    const views = Number(row?.views ?? 0);
    const clicks = Number(row?.contact_clicks ?? 0);
    const weekdayAbbrev = format(date, "EEEEEE", { locale: ptBR });
    points.push({
      day: weekdayAbbrev.charAt(0).toUpperCase() + weekdayAbbrev.slice(1),
      v: views + clicks,
    });
  }
  return points;
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_GALLERY_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadPartnerGalleryImage(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const mime = file.type;
  const ext = ALLOWED_IMAGE_TYPES[mime];
  if (!ext) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  // Redimensiona/comprime antes de validar o tamanho; em caso de falha,
  // resizeImageForUpload retorna o próprio arquivo original (fallback),
  // deixando a validação abaixo como última linha de defesa.
  const optimized = await resizeImageForUpload(file, MAX_GALLERY_IMAGE_BYTES);
  if (optimized.size > MAX_GALLERY_IMAGE_BYTES) {
    throw new Error("Imagem muito grande (máx. 5 MB).");
  }
  const path = `${userData.user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("partner-gallery")
    .upload(path, optimized, { upsert: false, contentType: mime });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("partner-gallery").getPublicUrl(path);
  return pub.publicUrl;
}


// ============ Checklists do usuário ============
export type ChecklistItem = { id: string; text: string; is_checked: boolean };

export type UserChecklist = {
  id: string;
  user_id: string;
  name: string;
  destination_id: string | null;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
};

const MAX_NAME = 80;
const MAX_ITEM_TEXT = 80;
const MAX_ITEMS = 100;

function normalizeItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .map((it) => ({
      id: String(it.id ?? crypto.randomUUID()),
      text: String(it.text ?? "").slice(0, MAX_ITEM_TEXT),
      is_checked: Boolean(it.is_checked),
    }))
    .slice(0, MAX_ITEMS);
}

function mapChecklist(row: Record<string, unknown>): UserChecklist {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    destination_id: (row.destination_id as string | null) ?? null,
    items: normalizeItems(row.items),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function validateName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 1) throw new Error("Nome muito curto.");
  if (trimmed.length > MAX_NAME) throw new Error(`Nome deve ter no máximo ${MAX_NAME} caracteres.`);
  return trimmed;
}

function validateItems(items: ChecklistItem[]) {
  if (items.length > MAX_ITEMS) throw new Error(`Máximo de ${MAX_ITEMS} itens.`);
  return items.map((i) => {
    const text = (i.text ?? "").trim();
    if (text.length < 1) throw new Error("Item vazio.");
    if (text.length > MAX_ITEM_TEXT) throw new Error(`Item muito longo (máx. ${MAX_ITEM_TEXT}).`);
    return { id: i.id || crypto.randomUUID(), text, is_checked: !!i.is_checked };
  });
}

export async function fetchUserChecklists(): Promise<UserChecklist[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("user_checklists")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapChecklist(r as Record<string, unknown>));
}

export async function fetchChecklistById(id: string): Promise<UserChecklist | null> {
  const { data, error } = await supabase
    .from("user_checklists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapChecklist(data as Record<string, unknown>) : null;
}

export async function createChecklist(input: {
  name: string;
  destinationId?: string | null;
  items?: ChecklistItem[];
}): Promise<UserChecklist> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const name = validateName(input.name);
  const items = validateItems(input.items ?? []);
  const { data, error } = await supabase
    .from("user_checklists")
    .insert({
      user_id: userData.user.id,
      name,
      destination_id: input.destinationId ?? null,
      items: items as never,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return mapChecklist(data as Record<string, unknown>);
}

export async function updateChecklist(
  id: string,
  updates: { name?: string; destinationId?: string | null; items?: ChecklistItem[] },
): Promise<UserChecklist> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = validateName(updates.name);
  if (updates.destinationId !== undefined) patch.destination_id = updates.destinationId;
  if (updates.items !== undefined) patch.items = validateItems(updates.items) as never;
  if (Object.keys(patch).length === 0) throw new Error("Nada para atualizar.");
  const { data, error } = await supabase
    .from("user_checklists")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapChecklist(data as Record<string, unknown>);
}

export async function deleteChecklist(id: string): Promise<void> {
  const { error } = await supabase.from("user_checklists").delete().eq("id", id);
  if (error) throw error;
}

// ============ Compartilhamento de localização ============
export type LocationSharingMode = "none" | "friends" | "public";

export type SharedLocation = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  latitude: number;
  longitude: number;
  location_updated_at: string;
  location_sharing_mode: LocationSharingMode;
};

function validateCoord(lat: number, lng: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Latitude inválida");
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("Longitude inválida");
}

export async function updateMyLocation(input: {
  latitude: number;
  longitude: number;
  mode: LocationSharingMode;
}) {
  validateCoord(input.latitude, input.longitude);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("profiles")
    .update({
      latitude: input.latitude,
      longitude: input.longitude,
      location_sharing_mode: input.mode,
      location_updated_at: new Date().toISOString(),
    } as never)
    .eq("id", userData.user.id);
  if (error) throw error;
}

export async function updateLocationSharingMode(mode: LocationSharingMode) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const patch: Record<string, unknown> = { location_sharing_mode: mode };
  if (mode === "none") {
    patch.latitude = null;
    patch.longitude = null;
    patch.location_updated_at = null;
  }
  const { error } = await supabase
    .from("profiles")
    .update(patch as never)
    .eq("id", userData.user.id);
  if (error) throw error;
}

export async function fetchSharedUserLocations(): Promise<SharedLocation[]> {
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData.user?.id ?? null;
  const { data, error } = await supabase
    .from("public_user_locations" as never)
    .select("id, full_name, username, avatar_url, latitude, longitude, location_updated_at, location_sharing_mode");
  if (error) throw error;
  return ((data ?? []) as unknown as SharedLocation[])
    .filter((r) => r.id !== myId)
    .map((r) => ({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude) }));
}

// ============ Amizades ============
export type FriendRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
};

export async function fetchFriends(): Promise<FriendRow[]> {
  const { data, error } = await supabase
    .from("user_friends" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FriendRow[];
}

export async function sendFriendRequest(addresseeId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  if (addresseeId === userData.user.id) throw new Error("Não é possível adicionar você mesmo");
  const { error } = await supabase
    .from("user_friends" as never)
    .insert({ requester_id: userData.user.id, addressee_id: addresseeId, status: "pending" } as never);
  if (error) throw error;
}

export async function acceptFriendRequest(id: string) {
  const { error } = await supabase
    .from("user_friends" as never)
    .update({ status: "accepted" } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function removeFriend(id: string) {
  const { error } = await supabase.from("user_friends" as never).delete().eq("id", id);
  if (error) throw error;
}

export type UserSearchResult = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// Escapa valor para uso seguro dentro do filtro `.or()` do PostgREST, onde
// `"` e `\` têm significado sintático quando o valor é envolvido em aspas.
function escapeForOrFilter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${escapeForOrFilter(trimmed)}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .or(`full_name.ilike."${pattern}",username.ilike."${pattern}"`);
  if (error) throw error;
  return (data ?? []) as UserSearchResult[];
}

// ============ Comunidade — curtidas e follow (Requirements 6, 7) ============

// Alterna o Post_Like do usuário autenticado para `postId` através da RPC
// `toggle_post_like` (SECURITY DEFINER, delete-then-insert idempotente por
// par post/usuário — ver migration 20260716090000). O erro de "não
// autenticado" é levantado pela própria função no banco quando `auth.uid()`
// é nulo, então nenhuma guarda de sessão client-side é necessária aqui além
// de propagar o erro do Supabase.
export async function togglePostLike(postId: string): Promise<{ liked: boolean; likes: number }> {
  const { data, error } = await supabase.rpc("toggle_post_like" as never, {
    _post_id: postId,
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { liked: boolean; likes: number } | null;
  if (!row) throw new Error("Falha ao alternar curtida.");
  return { liked: Boolean(row.liked), likes: Number(row.likes) };
}

// Retorna os `post_id` de todos os Post_Like do usuário autenticado, usado
// para hidratar o estado inicial do controle de curtida em cada
// Community_Post ao carregar a tela de comunidade (Requirement 6.4) — sem
// isso, o estado "curtido" reiniciaria para "não curtido" a cada
// recarregamento mesmo com a curtida persistida via `toggle_post_like`.
export async function fetchMyLikedPostIds(): Promise<string[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("post_likes" as never)
    .select("post_id")
    .eq("user_id", userData.user.id);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ post_id: string }>).map((row) => row.post_id);
}

// Alterna o Post_Follow (Requirement 7): reaproveita `user_friends` com uma
// linha assimétrica `status = 'following'` (requester_id = quem segue,
// addressee_id = autor seguido), sem afetar `are_friends`/Friendship
// (Requirement 3), que continuam filtrando estritamente por `status =
// 'accepted'`. Toggle feito no cliente (verifica existência, depois
// DELETE ou INSERT) já que não há RPC dedicada para este caso.
export async function toggleAuthorFollow(authorId: string): Promise<{ following: boolean }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  if (authorId === userData.user.id) throw new Error("Não é possível seguir você mesmo");

  const { data: existing, error: selErr } = await supabase
    .from("user_friends" as never)
    .select("id")
    .eq("requester_id", userData.user.id)
    .eq("addressee_id", authorId)
    .eq("status", "following")
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error: delErr } = await supabase
      .from("user_friends" as never)
      .delete()
      .eq("id", (existing as unknown as { id: string }).id);
    if (delErr) throw delErr;
    return { following: false };
  }

  const { error: insErr } = await supabase
    .from("user_friends" as never)
    .insert({ requester_id: userData.user.id, addressee_id: authorId, status: "following" } as never);
  if (insErr) throw insErr;
  return { following: true };
}

// Retorna os `addressee_id` de todos os Post_Follow (`status = 'following'`)
// do usuário autenticado, usado para hidratar o estado inicial do controle
// de seguir em cada Community_Post ao carregar a tela de comunidade.
export async function fetchMyFollowedAuthorIds(): Promise<string[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("user_friends" as never)
    .select("addressee_id")
    .eq("requester_id", userData.user.id)
    .eq("status", "following");
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ addressee_id: string }>).map((row) => row.addressee_id);
}

export type FollowProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// Bug corrigido: a tela de perfil abria a lista de "Seguidores"/"Seguindo"
// chamando `fetchFriends` filtrado por `status = 'accepted'` (Friendship,
// ou seja, amizade confirmada) — mas os números exibidos nos botões vêm de
// `profiles.followers_count`/`following_count`, que contam linhas
// `status = 'following'` (Post_Follow, criado por `toggleAuthorFollow` na
// Comunidade — ver migration `20260718100000_sync-follow-counts.sql`).
// São dois conceitos diferentes no schema (amizade vs. seguir), então o
// número no painel nunca correspondia à lista de pessoas mostrada ao
// clicar. `fetchMyFollowers`/`fetchMyFollowing` abaixo buscam exatamente o
// mesmo dado (`status = 'following'`) usado para os contadores.

// Quem segue o usuário autenticado (aparece como addressee_id nas linhas
// `following`, i.e. quem foi seguido é o usuário atual).
export async function fetchMyFollowers(): Promise<FollowProfile[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data: rows, error } = await supabase
    .from("user_friends" as never)
    .select("requester_id")
    .eq("addressee_id", userData.user.id)
    .eq("status", "following");
  if (error) throw error;
  const ids = ((rows ?? []) as unknown as Array<{ requester_id: string }>).map((r) => r.requester_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .in("id", ids);
  if (profErr) throw profErr;
  return (profiles ?? []) as unknown as FollowProfile[];
}

// Quem o usuário autenticado segue (aparece como addressee_id nas linhas
// `following` criadas pelo próprio usuário como requester_id).
export async function fetchMyFollowing(): Promise<FollowProfile[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data: rows, error } = await supabase
    .from("user_friends" as never)
    .select("addressee_id")
    .eq("requester_id", userData.user.id)
    .eq("status", "following");
  if (error) throw error;
  const ids = ((rows ?? []) as unknown as Array<{ addressee_id: string }>).map((r) => r.addressee_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .in("id", ids);
  if (profErr) throw profErr;
  return (profiles ?? []) as unknown as FollowProfile[];
}

// ============ Comunidade — comentários (Requirement 8) ============

export type PostComment = {
  id: string;
  post_id: string;
  text: string;
  created_at: string;
  author: { full_name: string | null; avatar_url: string | null } | null;
};

// Busca os Post_Comment reais de um Community_Post (Requirement 8.2),
// ordenados do mais antigo para o mais novo, com o autor embutido via
// join implícito do supabase-js sobre a FK `post_comments.author_id ->
// profiles.id` (mesmo padrão usado por `fetchReviewsByDestination`).
export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from("post_comments" as never)
    .select("id, post_id, text, created_at, author:profiles(full_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PostComment[];
}

// Persiste um Post_Comment através da RPC `create_post_comment`
// (SECURITY DEFINER), que também incrementa `community_posts.comments_count`
// de forma atômica, contornando o trigger `prevent_post_counter_tampering`
// (Requirement 8.3, 8.4). A RPC não retorna o autor embutido, então
// buscamos o perfil do usuário autenticado para preencher o campo `author`
// e manter o formato consistente com `fetchPostComments`.
export async function createPostComment(postId: string, text: string): Promise<PostComment> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const { data, error } = await supabase.rpc("create_post_comment" as never, {
    _post_id: postId,
    _text: text,
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string;
    post_id: string;
    text: string;
    created_at: string;
  } | null;
  if (!row) throw new Error("Falha ao criar comentário.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userData.user.id)
    .maybeSingle();

  return {
    id: row.id,
    post_id: row.post_id,
    text: row.text,
    created_at: row.created_at,
    author: profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : null,
  };
}

// ============ Notificações (Requirement 9) ============

export type Notification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

// Lista as Notification do usuário autenticado em ordem cronológica
// decrescente (Requirement 9.3). A RLS de `notifications` já restringe a
// leitura a `auth.uid() = recipient_id`, mas filtramos explicitamente por
// `recipient_id` também no client para deixar a intenção clara e evitar
// depender apenas da política de banco.
export async function fetchNotifications(): Promise<Notification[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("notifications" as never)
    .select("id, type, payload, is_read, created_at")
    .eq("recipient_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Notification[];
}

// Conta as Notification não lidas do usuário autenticado (Requirement 9.5,
// 9.6), usada para o indicador visual do sino de notificação. Usa
// `count: "exact", head: true` para que o Supabase retorne apenas a
// contagem, sem trazer as linhas.
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;
  const { count, error } = await supabase
    .from("notifications" as never)
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", userData.user.id)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

// Marca as Notification indicadas como lidas (Requirement 9.7, 9.8). A RLS
// de `UPDATE` já restringe a alteração a `auth.uid() = recipient_id`. Se
// `ids` estiver vazio, retorna sem fazer nenhuma chamada ao banco.
export async function markNotificationsAsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications" as never)
    .update({ is_read: true } as never)
    .in("id", ids);
  if (error) throw error;
}

// ============ Perfil — avatar e unicidade de username (Requirement 10) ============

const MAX_AVATAR_IMAGE_BYTES = 5 * 1024 * 1024;

// Envia uma nova foto de perfil para o bucket `avatars` (Requirement 10.3,
// 10.4), seguindo exatamente o mesmo padrão de resize client-side/validação/
// upload de `uploadPartnerGalleryImage`: mesma allowlist de mime types
// (`ALLOWED_IMAGE_TYPES`), mesmo redimensionamento via `resizeImageForUpload`,
// mesmo limite de 5 MB como última linha de defesa. O path é prefixado pela
// pasta do usuário autenticado (`${userId}/...`), consistente com a policy
// de storage `auth.uid()::text = (storage.foldername(name))[1]` da migration
// `20260716090400_avatars-bucket.sql`. Retorna a URL pública do arquivo.
export async function uploadAvatarImage(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const mime = file.type;
  const ext = ALLOWED_IMAGE_TYPES[mime];
  if (!ext) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  const optimized = await resizeImageForUpload(file, MAX_AVATAR_IMAGE_BYTES);
  if (optimized.size > MAX_AVATAR_IMAGE_BYTES) {
    throw new Error("Imagem muito grande (máx. 5 MB).");
  }
  const path = `${userData.user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, optimized, { upsert: false, contentType: mime });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  return pub.publicUrl;
}

// Verifica se `username` já está em uso por outro perfil (Requirement 10.6).
// A comparação é case-sensitive, consistente com a constraint `UNIQUE` de
// `profiles.username` (sem `citext`/índice funcional de lowercase no
// schema) e com `searchUsers`, que também usa o valor de `username` como
// texto puro. Exclui o próprio usuário autenticado da checagem: se o
// usuário já tem esse username, não é considerado "taken" para ele mesmo.
export async function isUsernameTaken(username: string): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData.user?.id ?? null;

  let query = supabase.from("profiles").select("id").eq("username", trimmed).limit(1);
  if (myId) {
    query = query.neq("id", myId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length > 0;
}

// ============ Compliance / admin (Requirement 11) ============

// Campos exibidos pela tela de compliance do parceiro (badge de status) e
// pela Admin_Compliance_Screen (lista de pendentes), refletindo as colunas
// relevantes de `cadastur_verification_requests` (migration
// `20260716090500_cadastur-verification-requests.sql`).
export type CadasturRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  company_name: string;
  cnpj: string;
  cadastur_number: string;
  category: string;
  responsible: string;
  email: string;
  phone: string;
  description: string;
  document_url: string;
};

// Persiste uma Cadastur_Verification_Request com `status = 'pending'`
// (Requirement 11.2), em vez da simulação de aprovação automática por
// `setTimeout` anteriormente existente em `compliance.tsx`. O índice único
// parcial `cadastur_requests_one_pending_per_partner` (`WHERE status =
// 'pending'`) é a última linha de defesa contra uma segunda submissão
// pendente do mesmo parceiro (Requirement 11.9): a violação chega aqui como
// erro Postgres `23505` (unique_violation), mapeada para uma mensagem de UI
// explicando o motivo, em vez de propagar o erro genérico do banco.
export async function submitCadasturRequest(input: {
  companyName: string;
  cnpj: string;
  cadastur: string;
  category: string;
  responsible: string;
  email: string;
  phone: string;
  description: string;
  documentUrl: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");

  const { error } = await supabase.from("cadastur_verification_requests" as never).insert({
    partner_id: userData.user.id,
    company_name: input.companyName,
    cnpj: input.cnpj,
    cadastur_number: input.cadastur,
    category: input.category,
    responsible: input.responsible,
    email: input.email,
    phone: input.phone,
    description: input.description,
    document_url: input.documentUrl,
    status: "pending",
  } as never);

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("Você já tem uma solicitação em análise.");
    }
    throw error;
  }
}

// Busca a Cadastur_Verification_Request mais recente do parceiro
// autenticado (Requirement 11.7), usada para exibir o badge de status real
// (`pending`/`approved`/`rejected`) na tela de compliance em vez do estado
// local anteriormente usado. Retorna `null` quando o parceiro nunca
// submeteu nenhuma solicitação. A RLS de `SELECT` já restringe a leitura ao
// próprio parceiro ou a um admin.
export async function fetchMyCadasturRequest(): Promise<CadasturRequest | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("cadastur_verification_requests" as never)
    .select("*")
    .eq("partner_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CadasturRequest) ?? null;
}

const ALLOWED_COMPLIANCE_DOCUMENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
const MAX_COMPLIANCE_DOCUMENT_BYTES = 5 * 1024 * 1024;

// Envia o documento comprobatório do Cadastur para o bucket privado
// `compliance-documents` (Requirement 11.1, 11.2). PDFs não passam pelo
// redimensionamento de imagem de `resizeImageForUpload` (que decodifica o
// arquivo como bitmap) — apenas jpeg/png são otimizados antes do upload,
// seguindo o mesmo padrão de `uploadPartnerGalleryImage`/`uploadAvatarImage`;
// para PDF, o limite de 5 MB é a única validação de tamanho.
//
// Decisão de retorno: como o bucket é privado (sem policy pública de
// SELECT), esta função retorna apenas o PATH de storage (não uma URL
// pública nem uma signed URL de validade fixa). Persistir o path em
// `cadastur_verification_requests.document_url` mantém a leitura posterior
// flexível: quem tiver permissão (o próprio parceiro ou um admin, via RLS
// de `storage.objects`) gera uma signed URL sob demanda no momento da
// exibição (`supabase.storage.from("compliance-documents").createSignedUrl(path, ttl)`),
// em vez de depender de uma URL assinada que pode expirar antes de ser
// usada ou de expor uma URL pública que não existe para este bucket.
export async function uploadComplianceDocument(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado");
  const mime = file.type;
  const ext = ALLOWED_COMPLIANCE_DOCUMENT_TYPES[mime];
  if (!ext) {
    throw new Error("Formato inválido. Use JPG, PNG ou PDF.");
  }

  const optimized =
    mime === "application/pdf" ? file : await resizeImageForUpload(file, MAX_COMPLIANCE_DOCUMENT_BYTES);
  if (optimized.size > MAX_COMPLIANCE_DOCUMENT_BYTES) {
    throw new Error("Arquivo muito grande (máx. 5 MB).");
  }

  const path = `${userData.user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("compliance-documents")
    .upload(path, optimized, { upsert: false, contentType: mime });
  if (upErr) throw upErr;
  return path;
}

// Lista as Cadastur_Verification_Request com `status = 'pending'`
// (Requirement 11.4), usada pela Admin_Compliance_Screen. A RLS de `SELECT`
// já restringe esta leitura a `auth.uid() = partner_id OR
// is_admin(auth.uid())` — para um usuário sem Admin_Role, a query retorna
// apenas a própria solicitação pendente (se houver), nunca as de outros
// parceiros; a tela de admin só funciona corretamente para quem tem
// Admin_Role (Requirement 11.8), confiando na RLS em vez de reimplementar
// essa checagem aqui.
export async function fetchPendingCadasturRequests(): Promise<CadasturRequest[]> {
  const { data, error } = await supabase
    .from("cadastur_verification_requests" as never)
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CadasturRequest[];
}

// Aprova/rejeita uma Cadastur_Verification_Request através das RPCs
// `approve_cadastur_request`/`reject_cadastur_request` (Requirement 11.5,
// 11.6), ambas `SECURITY DEFINER` checando `is_admin(auth.uid())`
// explicitamente no banco — um usuário sem Admin_Role recebe o erro "not
// authorized" lançado pela própria função (Requirement 11.8).
export async function approveCadasturRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("approve_cadastur_request" as never, { _id: id } as never);
  if (error) throw error;
}

export async function rejectCadasturRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("reject_cadastur_request" as never, { _id: id } as never);
  if (error) throw error;
}

// Retorna o `role` (`app_role`: `adventurer` | `partner`) do usuário
// autenticado, lido de `profiles.role` (mesma coluna já usada por
// `fetchMyProfile`). Não inclui `admin`, que é um papel adicional
// modelado separadamente em `user_roles`/`app_role_enum` (ver
// `isCurrentUserAdmin`), não em `profiles.role`.
export async function fetchMyRole(): Promise<"adventurer" | "partner" | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as "adventurer" | "partner" | undefined) ?? null;
}

// Verifica se o usuário autenticado possui o Admin_Role (Requirement 11.4,
// 11.8), através da função `is_admin` já existente (migration
// `20260522193933_...sql`), consultada via RPC em vez de uma query direta a
// `user_roles` — mesmo mecanismo já usado pela RLS/RPCs de decisão desta
// mesma migration, mantendo uma única fonte de verdade para "é admin".
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data, error } = await supabase.rpc("is_admin" as never, {
    _user_id: userData.user.id,
  } as never);
  if (error) throw error;
  return Boolean(data);
}
