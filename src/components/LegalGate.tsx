import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { acceptLegalTerms, fetchMyLegalStatus } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_DOC_VERSION } from "@/lib/legal-content";
import { shouldShowLegalGate } from "@/lib/legal-gate";

/**
 * Modal bloqueante de aceite dos Termos/Privacidade. Montado no root, dentro
 * do AuthProvider. Aparece quando o usuário logado ainda não aceitou a versão
 * vigente (fora de rotas públicas). Spec conta-privacidade-termos, Req 2.
 */
export function LegalGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);

  const pathname = router.state.location.pathname;

  const { data: legal } = useQuery({
    queryKey: ["my-legal-status", user?.id],
    queryFn: fetchMyLegalStatus,
    enabled: !!user && !loading,
    staleTime: 60_000,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const platform = Capacitor.isNativePlatform() ? "native" : "web";
      await acceptLegalTerms(LEGAL_DOC_VERSION, platform);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-legal-status", user?.id] });
      qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message || t("common.error", "Erro")),
  });

  const show = shouldShowLegalGate({
    isAuthenticated: !!user,
    acceptedVersion: legal?.acceptedVersion,
    currentVersion: LEGAL_DOC_VERSION,
    pathname,
  });

  // Só decide quando já temos o status carregado, para evitar flash.
  if (!show || legal === undefined) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.navigate({ to: "/login" });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-xl sm:rounded-3xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck size={24} />
        </div>
        <h2 className="mt-4 text-center text-lg font-semibold">
          {t("legal.gateTitle", "Termos de Uso e Privacidade")}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          {t(
            "legal.gateBody",
            "Para continuar usando o OutVitar, leia e aceite nossos Termos de Uso e nossa Política de Privacidade.",
          )}
        </p>

        <div className="mt-4 flex justify-center gap-4 text-sm font-medium text-primary">
          <Link to="/termos" className="underline">
            {t("legal.termsLink", "Termos de Uso")}
          </Link>
          <Link to="/privacidade" className="underline">
            {t("legal.privacyLink", "Política de Privacidade")}
          </Link>
        </div>

        <Button
          className="mt-6 h-12 w-full rounded-full text-sm font-semibold"
          disabled={acceptMutation.isPending}
          onClick={() => acceptMutation.mutate()}
        >
          {acceptMutation.isPending ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : null}
          {t("legal.accept", "Li e aceito")}
        </Button>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-3 w-full text-center text-xs font-medium text-muted-foreground underline disabled:opacity-50"
        >
          {t("legal.decline", "Não aceito — sair")}
        </button>
      </div>
    </div>
  );
}
