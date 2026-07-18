import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  Award,
  Mountain,
  Tent,
  Footprints,
  CheckCircle2,
  CloudSun,
  ListChecks,
  TrendingUp,
  Camera,
  Globe,
  Droplets,
  Moon,
  Briefcase,
  LogOut,
  Users,
} from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Stars } from "@/components/Stars";
import avatar from "@/assets/avatar-rafael.jpg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { shouldShowForecast } from "@/lib/profile-decorative";
import {
  fetchMyProfile,
  resolveAsset,
  fetchUserTrails,
  fetchSavedDestinations,
  fetchFavoritePartners,
  fetchUserAchievements,
  fetchNextAdventure,
  fetchUserChecklists,
  fetchUserActivities,
  fetchMyFollowers,
  fetchMyFollowing,
} from "@/lib/api";
import { Activity as ActivityIcon, Clock, Route as RouteIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ChecklistCreateDialog } from "@/components/ChecklistCreateDialog";
import { LocationSharingCard } from "@/components/LocationSharingCard";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/perfil")({
  component: Profile,
  head: () => ({
    meta: [
      { title: "Meu perfil — Outlife" },
      { name: "description", content: "Seu painel pessoal: trilhas, destinos salvos, parceiros favoritos e conquistas." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/perfil" }],
  }),
});

const achievementIconMap: Record<string, typeof Mountain> = {
  summit: Mountain,
  camper: Tent,
  "100km": Footprints,
  topguide: Award,
  "500km": TrendingUp,
  photo: Camera,
  nomad: Globe,
  rain: Droplets,
};



function Profile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });

  const { data: myTrails = [], isLoading: trailsLoading } = useQuery({
    queryKey: ["user-trails", user?.id],
    queryFn: () => fetchUserTrails(user?.id),
    enabled: !!user,
  });
  const { data: savedDestinations = [], isLoading: savedLoading } = useQuery({
    queryKey: ["saved-destinations", user?.id],
    queryFn: () => fetchSavedDestinations(user?.id),
    enabled: !!user,
  });
  const { data: favPartners = [], isLoading: favLoading } = useQuery({
    queryKey: ["fav-partners", user?.id],
    queryFn: () => fetchFavoritePartners(user?.id),
    enabled: !!user,
  });
  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements", user?.id],
    queryFn: () => fetchUserAchievements(user?.id),
    enabled: !!user,
  });
  const { data: nextAdventure } = useQuery({
    queryKey: ["next-adventure", user?.id],
    queryFn: () => fetchNextAdventure(user?.id),
    enabled: !!user,
  });
  const { data: checklists = [], isLoading: checklistsLoading } = useQuery({
    queryKey: ["user-checklists"],
    queryFn: fetchUserChecklists,
    enabled: !!user,
  });
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["user-activities", user?.id],
    queryFn: fetchUserActivities,
    enabled: !!user,
  });

  // Bug corrigido (Requirement 12.3): os botões "Seguidores"/"Seguindo"
  // mostram `profiles.followers_count`/`following_count`, que contam
  // Post_Follow (`user_friends.status = 'following'`, ver migration
  // `20260718100000_sync-follow-counts.sql`) — não Friendship (`status =
  // 'accepted'`). Antes, ao clicar, a lista abria com `fetchFriends`
  // filtrado por `accepted`, mostrando amigos em vez de seguidores/
  // seguidos reais, o que fazia o número do card não corresponder à lista
  // exibida. `fetchMyFollowers`/`fetchMyFollowing` buscam exatamente o
  // mesmo dado usado para os contadores.
  const [openFriendList, setOpenFriendList] = useState<"followers" | "following" | null>(null);
  const { data: friendProfiles = [], isLoading: friendProfilesLoading } = useQuery({
    queryKey: ["profile-follow-list", user?.id, openFriendList],
    queryFn: () => (openFriendList === "following" ? fetchMyFollowing() : fetchMyFollowers()),
    enabled: !!user && openFriendList !== null,
  });


  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("darkMode") : null;
    const enabled = stored === "true";
    setDarkMode(enabled);
    if (enabled) document.documentElement.classList.add("dark");
  }, []);

  const toggleDark = (v: boolean) => {
    setDarkMode(v);
    if (v) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("darkMode", String(v));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success(t("profile.signedOut"));
    navigate({ to: "/login" });
  };


  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Aventureiro";
  const handle = profile?.username ? `@${profile.username}` : user?.email || "";
  const location = profile?.location || "";
  const rating = Number(profile?.rating ?? 4.9);
  const avatarUrl = resolveAsset(profile?.avatar_url, avatar);

  return (
    <div className="animate-float-up pb-12">
      <div className="relative bg-gradient-forest pb-16 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between px-5 pt-2">
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">{t("profile.title")}</span>
          <div className="flex gap-2">
            <button
              onClick={handleSignOut}
              aria-label={t("profile.signOut")}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-md"
            >
              <LogOut size={16} />
            </button>
            <Link
              to="/configuracoes"
              aria-label={t("settings.title")}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-md"
            >
              <Settings size={16} />
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center text-center">
          <div className="relative">
            <img src={avatarUrl} alt={displayName} className="h-24 w-24 rounded-full border-4 border-white/30 object-cover shadow-float" width={512} height={512} />
            {profile?.is_verified && (
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[var(--verified)] text-white border-2 border-[var(--forest-deep)]">
                <CheckCircle2 size={14} strokeWidth={3} />
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold">{displayName}</h1>
          <p className="text-xs text-white/70">{handle}{location ? ` · ${location}` : ""}</p>
          <div className="mt-2 flex items-center gap-2">
            <Stars value={rating} size={14} />
            <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="mx-5 -mt-10 grid grid-cols-3 gap-2 rounded-2xl bg-card p-4 shadow-card relative z-10">
        {profileLoading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        ) : (
          [
            { v: String(myTrails.length), l: t("profile.stats.trails") },
            { v: String(savedDestinations.length), l: t("profile.stats.destinations") },
            { v: String(profile?.reviews_count ?? 0), l: t("profile.stats.reviews") },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="font-display text-xl font-semibold text-primary">{s.v}</div>
              <div className="text-[11px] text-muted-foreground">{s.l}</div>
            </div>
          ))
        )}
      </div>


      <div className="mx-5 mt-3 grid grid-cols-2 items-center rounded-2xl bg-card p-3 shadow-card relative">
        <button onClick={() => setOpenFriendList("followers")} className="flex flex-col items-center">
          <span className="font-display text-base font-semibold">{profile?.followers_count ?? 0}</span>
          <span className="text-[11px] text-muted-foreground">{t("profile.followers")}</span>
        </button>
        <div className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-border" />
        <button onClick={() => setOpenFriendList("following")} className="flex flex-col items-center">
          <span className="font-display text-base font-semibold">{profile?.following_count ?? 0}</span>
          <span className="text-[11px] text-muted-foreground">{t("profile.following")}</span>
        </button>
      </div>


      <div className="mx-5 mt-3">
        <Link to="/amigos" className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users size={16} />
            </span>
            <span className="text-sm font-semibold">{t("friends.cta")}</span>
          </div>
          <span className="text-xs text-primary font-medium">{t("common.open")}</span>
        </Link>
      </div>

      {profile?.role === "partner" && (
        <div className="mx-5 mt-3">
          <Link to="/parceiro/painel" className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Briefcase size={16} />
              </span>
              <span className="text-sm font-semibold">{t("profile.partnerPanel")}</span>
            </div>
            <span className="text-xs text-primary font-medium">{t("common.open")}</span>

          </Link>
        </div>
      )}

      <div className="mx-5 mt-3">
        <Link
          to="/atividade/rastrear"
          className="flex items-center justify-between rounded-2xl bg-gradient-forest p-3 text-white shadow-card"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur-md">
              <ActivityIcon size={16} />
            </span>
            <span className="text-sm font-semibold">{t("profile.trackCta")}</span>
          </div>
          <span className="text-xs font-medium text-white/80">{t("common.open")}</span>
        </Link>
      </div>

      <section className="px-5 mt-6">
        <Tabs defaultValue="trilhas">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="trilhas">{t("profile.tabs.trails")}</TabsTrigger>
            <TabsTrigger value="atividades">{t("profile.tabs.activities")}</TabsTrigger>
            <TabsTrigger value="salvos">{t("profile.tabs.saved")}</TabsTrigger>
            <TabsTrigger value="favoritos">{t("profile.tabs.favorites")}</TabsTrigger>
          </TabsList>
          <TabsContent value="trilhas" className="mt-3 space-y-2">
            {trailsLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
            ) : myTrails.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
                {t("common.empty", "Nada por aqui ainda.")}
              </div>
            ) : myTrails.map((tr) => (
              <div key={tr.name} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card">
                <div className="flex items-center gap-3">
                  <Mountain size={16} className="text-primary" />
                  <span className="text-sm font-medium">{tr.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{tr.distance}</span>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="atividades" className="mt-3 space-y-2">
            {activitiesLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
            ) : activities.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
                {t("activity.emptyList")}
              </div>
            ) : activities.map((a) => {
              const km = a.distance_meters != null ? (a.distance_meters / 1000).toFixed(2) : "—";
              const mins = a.duration_seconds != null ? Math.round(a.duration_seconds / 60) : 0;
              return (
                <Link
                  key={a.id}
                  to="/atividade/$activityId"
                  params={{ activityId: a.id }}
                  className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <RouteIcon size={16} />
                    </span>
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(a.start_time).toLocaleDateString(i18n.language)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock size={11} /> {mins} min · {km} km
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-primary font-medium">{t("common.open")}</span>
                </Link>
              );
            })}
          </TabsContent>
          <TabsContent value="salvos" className="mt-3 space-y-2">
            {savedLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
            ) : savedDestinations.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
                {t("common.empty", "Nada por aqui ainda.")}
              </div>
            ) : savedDestinations.map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card">
                <span className="text-sm font-medium">{d.name}</span>
                <span className="text-xs text-muted-foreground">{d.region}</span>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="favoritos" className="mt-3 space-y-2">
            {favLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
            ) : favPartners.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
                {t("common.empty", "Nada por aqui ainda.")}
              </div>
            ) : favPartners.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card">
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.category}</span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </section>


      <section className="px-5 mt-6">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("profile.level", { level: profile?.level ?? 1 })}</span>
            <span className="text-xs text-muted-foreground">{profile?.progress_to_next_level ?? 0}%</span>
          </div>
          <Progress value={profile?.progress_to_next_level ?? 0} className="mt-3" />
          <p className="mt-2 text-[11px] text-muted-foreground">{t("profile.levelHint", { remaining: 100 - (profile?.progress_to_next_level ?? 0) })}</p>
        </div>
      </section>
      <LocationSharingCard
        currentMode={(profile?.location_sharing_mode as "none" | "friends" | "public" | undefined) ?? "none"}
        lastUpdate={(profile as { location_updated_at?: string | null } | undefined)?.location_updated_at ?? null}
      />



      <section className="px-5 mt-6">
        <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <Moon size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold">{t("profile.darkMode")}</div>
              <div className="text-[11px] text-muted-foreground">{t("profile.appearance")}</div>
            </div>
          </div>
          <Switch checked={darkMode} onCheckedChange={toggleDark} />
        </div>
      </section>

      {achievements.length > 0 && (
        <section className="px-5 mt-6">
          <h2 className="font-display text-lg font-semibold">{t("profile.achievements")}</h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {achievements.map((a) => {
              const Icon = achievementIconMap[a.key] ?? Award;
              return (
                <div key={a.id} className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 shadow-card">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--sun)]/15 text-[var(--earth)]">
                    <Icon size={18} />
                  </span>
                  <span className="text-[10px] font-medium">{a.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {nextAdventure && shouldShowForecast(nextAdventure.forecast) && (
        <section className="px-5 mt-6">
          <h2 className="font-display text-lg font-semibold">{t("profile.nextAdventure")}</h2>
          <div className="mt-3 rounded-2xl bg-gradient-sky p-4 text-white shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/70">{nextAdventure.date}</div>
                <div className="font-display text-lg font-semibold">{nextAdventure.title}</div>
              </div>
              <CloudSun size={36} strokeWidth={1.5} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
              {nextAdventure.forecast.map((c) => (
                <div key={c.label} className="rounded-xl bg-white/15 py-2 backdrop-blur-md">
                  <div className="opacity-80">{c.label}</div>
                  <div className="font-semibold">{c.temp}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-5 mt-6 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("profile.checklist")}</h2>
          <button
            onClick={() => setChecklistDialogOpen(true)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            + {t("checklist.createCta")}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {checklistsLoading && (
            <>
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </>
          )}
          {!checklistsLoading && checklists.length === 0 && (
            <div className="rounded-2xl bg-card p-5 text-center shadow-card">
              <ListChecks className="mx-auto mb-2 text-muted-foreground" size={28} />
              <p className="text-sm text-muted-foreground">{t("checklist.emptyState")}</p>
              <button
                onClick={() => setChecklistDialogOpen(true)}
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                + {t("checklist.createCta")}
              </button>
            </div>
          )}
          {checklists.map((cl) => {
            const totalCl = cl.items.length;
            const doneCl = cl.items.filter((i) => i.is_checked).length;
            const pct = totalCl > 0 ? Math.round((doneCl / totalCl) * 100) : 0;
            return (
              <Link
                key={cl.id}
                to="/checklist/$checklistId"
                params={{ checklistId: cl.id }}
                className="block rounded-2xl bg-card p-4 shadow-card transition-base active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{cl.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("checklist.progress", { done: doneCl, total: totalCl })}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>

        <ChecklistCreateDialog
          open={checklistDialogOpen}
          onOpenChange={setChecklistDialogOpen}
        />



        <div className="mt-6 rounded-2xl bg-card p-3 shadow-card">
          <div className="flex items-center gap-3">
            <Globe size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium flex-1">{t("profile.language", "Idioma / Language")}</span>
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              {[
                { code: "pt-BR", label: "PT" },
                { code: "en", label: "EN" },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => i18n.changeLanguage(l.code)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-base ${i18n.language === l.code ? "bg-primary text-primary-foreground" : "text-secondary-foreground"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
        >
          <LogOut size={16} /> {t("profile.signOut")}
        </button>
      </section>

      <Sheet open={openFriendList !== null} onOpenChange={(open) => !open && setOpenFriendList(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">
              {openFriendList === "following" ? t("profile.following") : t("profile.followers")}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 pb-4">
            {friendProfilesLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
            ) : friendProfiles.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
                {t("common.empty", "Nada por aqui ainda.")}
              </div>
            ) : (
              friendProfiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                  <img
                    src={resolveAsset(p.avatar_url, avatar)}
                    alt={p.full_name || ""}
                    className="h-10 w-10 rounded-full object-cover"
                    width={80}
                    height={80}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.full_name || t("profile.title")}</div>
                    {p.username && <div className="truncate text-xs text-muted-foreground">@{p.username}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
