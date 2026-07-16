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
  } as never);
  if (error) throw error;
  return data as unknown as UserActivity;
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

export async function fetchPartnerChart(_partnerId: string): Promise<PartnerChartPoint[]> {
  return [
    { day: "Seg", v: 38 },
    { day: "Ter", v: 62 },
    { day: "Qua", v: 45 },
    { day: "Qui", v: 80 },
    { day: "Sex", v: 70 },
    { day: "Sáb", v: 95 },
    { day: "Dom", v: 58 },
  ];
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
