import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchMyProfile,
  isUsernameTaken,
  resolveAsset,
  updateMyProfile,
  uploadAvatarImage,
} from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/configuracoes")({
  component: SettingsScreen,
  head: () => ({
    meta: [
      { title: "Configurações — Outlife" },
      { name: "description", content: "Troque sua foto de perfil e edite seus dados pessoais." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/configuracoes" }],
  }),
});

function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });

  // Requirement 10.5 — formulário local populado a partir do perfil carregado.
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setUsername(profile.username ?? "");
      setLocation(profile.location ?? "");
    }
  }, [profile]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUrl = resolveAsset(profile?.avatar_url, avatarFallback);

  // Requirement 10.3, 10.4 — upload de nova foto seguida da atualização de
  // `avatar_url`, invalidando ["my-profile", ...] para refletir em /perfil.
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadAvatarImage(file);
      await updateMyProfile({ avatar_url: url });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      toast.success(t("settings.avatarUpdated"));
    },
    onError: (err: Error) => toast.error(err.message || t("settings.genericError")),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatarMutation.mutate(file);
    e.target.value = "";
  };

  // Requirement 10.5, 10.6 — atualização de nome/username/localização, com
  // verificação prévia de `isUsernameTaken` quando o username foi alterado.
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const trimmedUsername = username.trim();
      const usernameChanged = trimmedUsername !== (profile?.username ?? "");
      if (usernameChanged) {
        const taken = await isUsernameTaken(trimmedUsername);
        if (taken) {
          throw new Error(t("settings.usernameTaken"));
        }
      }
      await updateMyProfile({
        full_name: fullName.trim(),
        username: trimmedUsername,
        location: location.trim(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      toast.success(t("settings.saved"));
    },
    onError: (err: Error) => toast.error(err.message || t("settings.genericError")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  return (
    <div className="pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("settings.title")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      <section className="px-5 mt-6 flex flex-col items-center">
        {profileLoading ? (
          <Skeleton className="h-24 w-24 rounded-full" />
        ) : (
          <div className="relative">
            <img
              src={avatarUrl}
              alt={profile?.full_name || ""}
              className="h-24 w-24 rounded-full border-4 border-border object-cover shadow-card"
              width={512}
              height={512}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatarMutation.isPending}
              aria-label={t("settings.changePhoto")}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-card disabled:opacity-50"
            >
              {uploadAvatarMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} />
              )}
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAvatarMutation.isPending}
          className="mt-3 text-xs font-medium text-primary disabled:opacity-50"
        >
          {t("settings.changePhoto")}
        </button>
      </section>

      <section className="px-5 mt-6">
        {profileLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t("settings.fullNameLabel")}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">{t("settings.usernameLabel")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">{t("settings.locationLabel")}</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : null}
              {t("settings.save")}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
