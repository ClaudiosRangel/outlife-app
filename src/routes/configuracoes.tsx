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
  fetchMyContacts,
  isUsernameTaken,
  resolveAsset,
  updateMyProfile,
  updateMyContacts,
  uploadAvatarImage,
  type PersonType,
} from "@/lib/api";
import { maskCPF, maskCNPJ, maskCEP, isValidCPF, isValidCNPJ } from "@/lib/document-validation";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/configuracoes")({
  component: SettingsScreen,
  head: () => ({
    meta: [
      { title: "Configurações — OutVitar" },
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

  // Cadastro completo (item 13). Dados owner-only vêm de fetchMyContacts.
  const { data: contacts } = useQuery({
    queryKey: ["my-contacts", user?.id],
    queryFn: fetchMyContacts,
    enabled: !!user,
  });

  const [personType, setPersonType] = useState<PersonType>("pf");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setUsername(profile.username ?? "");
      setLocation(profile.location ?? "");
      const p = profile as Record<string, unknown>;
      setPersonType(((p.person_type as PersonType) ?? "pf"));
      setZip((p.address_zip as string) ?? "");
      setStreet((p.address_street as string) ?? "");
      setAddrNumber((p.address_number as string) ?? "");
      setComplement((p.address_complement as string) ?? "");
      setNeighborhood((p.address_neighborhood as string) ?? "");
      setCity((p.address_city as string) ?? "");
      setUf((p.address_state as string) ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (contacts) {
      setCpf(contacts.cpf ?? "");
      setCnpj(contacts.cnpj ?? "");
      setPhone(contacts.phone ?? "");
    }
  }, [contacts]);

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
  // Salvamento ÚNICO (pedido do usuário: um só "Salvar alterações"): grava o
  // perfil básico (nome/username/localização) + cadastro completo (person_type/
  // endereço) via updateMyProfile, e documento/telefone owner-only via
  // updateMyContacts. Valida username (isUsernameTaken) e documento (dígito
  // verificador) antes de gravar — inválido é recusado, nada é persistido.
  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const trimmedUsername = username.trim();
      const usernameChanged = trimmedUsername !== (profile?.username ?? "");
      if (usernameChanged) {
        const taken = await isUsernameTaken(trimmedUsername);
        if (taken) throw new Error(t("settings.usernameTaken"));
      }
      if (personType === "pf" && cpf.trim() && !isValidCPF(cpf)) {
        throw new Error("CPF inválido.");
      }
      if (personType === "pj" && cnpj.trim() && !isValidCNPJ(cnpj)) {
        throw new Error("CNPJ inválido.");
      }
      await updateMyProfile({
        full_name: fullName.trim(),
        username: trimmedUsername,
        location: location.trim(),
        person_type: personType,
        address_zip: zip.trim() || null,
        address_street: street.trim() || null,
        address_number: addrNumber.trim() || null,
        address_complement: complement.trim() || null,
        address_neighborhood: neighborhood.trim() || null,
        address_city: city.trim() || null,
        address_state: uf.trim() || null,
      } as never);
      await updateMyContacts({
        phone: phone.trim() || null,
        cpf: personType === "pf" ? cpf.trim() || null : null,
        cnpj: personType === "pj" ? cnpj.trim() || null : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["my-contacts", user?.id] });
      toast.success(t("settings.saved"));
    },
    onError: (err: Error) => toast.error(err.message || t("settings.genericError")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveAllMutation.mutate();
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
            {/* Cadastro completo (item 13) — na mesma sessão/formulário, um
                único "Salvar alterações" no fim. Opcional para todos;
                obrigatório só no fluxo de verificação do parceiro (Compliance). */}
            <h2 className="mt-6 mb-1 font-display text-lg font-semibold">{t("settings.completeTitle")}</h2>
            {/* Tipo de pessoa */}
            <div className="space-y-1.5">
              <Label>{t("settings.personType")}</Label>
              <div className="flex gap-2">
                {(["pf", "pj"] as PersonType[]).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setPersonType(pt)}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-base ${
                      personType === pt ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {t(`settings.personTypes.${pt}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Documento conforme tipo */}
            {personType === "pf" ? (
              <div className="space-y-1.5">
                <Label htmlFor="cpf">{t("settings.cpf")}</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">{t("settings.cnpj")}</Label>
                <Input
                  id="cnpj"
                  inputMode="numeric"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            )}

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("settings.phone")}</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>

            {/* Endereço estruturado */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="zip">{t("settings.zip")}</Label>
                <Input id="zip" inputMode="numeric" value={zip} onChange={(e) => setZip(maskCEP(e.target.value))} placeholder="00000-000" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="street">{t("settings.street")}</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="addrNumber">{t("settings.number")}</Label>
                <Input id="addrNumber" value={addrNumber} onChange={(e) => setAddrNumber(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="complement">{t("settings.complement")}</Label>
                <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="neighborhood">{t("settings.neighborhood")}</Label>
              <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="city">{t("settings.city")}</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="uf">{t("settings.state")}</Label>
                <Input id="uf" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} placeholder="UF" />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saveAllMutation.isPending}>
              {saveAllMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {t("settings.save")}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
