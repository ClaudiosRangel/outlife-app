import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Check, FileText, ShieldAlert, X } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  approveCadasturRequest,
  fetchPendingCadasturRequests,
  isCurrentUserAdmin,
  rejectCadasturRequest,
  type CadasturRequest,
} from "@/lib/api";

export const Route = createFileRoute("/admin/compliance")({
  component: AdminComplianceScreen,
  head: () => ({
    meta: [
      { title: "Moderação Cadastur — Outlife Admin" },
      { name: "description", content: "Aprovação ou rejeição de solicitações de verificação Cadastur." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/compliance" }],
  }),
});

// Requirement 11.4, 11.8 — a Admin_Compliance_Screen é exclusiva de
// usuários com Admin_Role. A RLS de `cadastur_verification_requests` já
// impede a leitura real dos dados de outros parceiros por quem não é
// admin, então este guard client-side existe apenas para não renderizar a
// UI de moderação para quem não deveria vê-la — não é a defesa real.
function AdminComplianceScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-current-user-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  const { data: pendingRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["pending-cadastur-requests"],
    queryFn: fetchPendingCadasturRequests,
    enabled: !!user && isAdmin === true,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveCadasturRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-cadastur-requests"] });
      toast.success(t("adminCompliance.approved"));
    },
    onError: (err: Error) => toast.error(err.message || t("adminCompliance.genericError")),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectCadasturRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-cadastur-requests"] });
      toast.success(t("adminCompliance.rejected"));
    },
    onError: (err: Error) => toast.error(err.message || t("adminCompliance.genericError")),
  });

  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const [pendingRejectionId, setPendingRejectionId] = useState<string | null>(null);

  const openDocument = async (documentUrl: string) => {
    const { data, error } = await supabase.storage
      .from("compliance-documents")
      .createSignedUrl(documentUrl, 60);
    if (error || !data?.signedUrl) {
      toast.error(t("adminCompliance.documentUnavailable"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (authLoading || (!!user && isAdminLoading)) {
    return (
      <div className="pb-12">
        <div className="bg-gradient-forest px-5 pb-4 text-white">
          <StatusBar light />
          <div className="flex items-center justify-between pt-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
              <ArrowLeft size={16} />
            </span>
            <span className="text-xs font-medium uppercase tracking-widest text-white/70">
              {t("adminCompliance.title")}
            </span>
            <span className="w-9" />
          </div>
        </div>
        <div className="px-5 mt-4 space-y-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Requirement 11.4, 11.8 — sem Admin_Role, a lista de pendentes nunca é
  // renderizada, independentemente do que a RLS retornaria.
  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
          <ShieldAlert size={24} className="text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">{t("adminCompliance.accessDeniedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminCompliance.accessDeniedDescription")}</p>
        <Link
          to="/"
          className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t("adminCompliance.backToHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("adminCompliance.title")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      <section className="px-5 mt-4 space-y-3">
        {requestsLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">
            {t("adminCompliance.emptyPending")}
          </div>
        ) : (
          pendingRequests.map((request) => (
            <CadasturRequestCard
              key={request.id}
              request={request}
              onViewDocument={() => openDocument(request.document_url)}
              onApprove={() => setPendingApprovalId(request.id)}
              onReject={() => setPendingRejectionId(request.id)}
            />
          ))
        )}
      </section>

      <AlertDialog open={!!pendingApprovalId} onOpenChange={(open) => !open && setPendingApprovalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminCompliance.confirmApprove")}</AlertDialogTitle>
            <AlertDialogDescription>{t("adminCompliance.confirmApproveDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingApprovalId && approveMutation.mutate(pendingApprovalId)}
            >
              {t("adminCompliance.approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingRejectionId} onOpenChange={(open) => !open && setPendingRejectionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminCompliance.confirmReject")}</AlertDialogTitle>
            <AlertDialogDescription>{t("adminCompliance.confirmRejectDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRejectionId && rejectMutation.mutate(pendingRejectionId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("adminCompliance.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CadasturRequestCard({
  request,
  onViewDocument,
  onApprove,
  onReject,
}: {
  request: CadasturRequest;
  onViewDocument: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const createdAt = new Date(request.created_at).toLocaleDateString("pt-BR");

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{request.company_name}</div>
          <div className="text-[11px] text-muted-foreground">
            {t("adminCompliance.submittedAt")} {createdAt}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("adminCompliance.cnpj")}</dt>
          <dd className="font-medium">{request.cnpj}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("adminCompliance.cadasturNumber")}</dt>
          <dd className="font-medium">{request.cadastur_number}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("adminCompliance.category")}</dt>
          <dd className="font-medium">{request.category}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("adminCompliance.responsible")}</dt>
          <dd className="font-medium">{request.responsible}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("adminCompliance.email")}</dt>
          <dd className="truncate font-medium">{request.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("adminCompliance.phone")}</dt>
          <dd className="font-medium">{request.phone}</dd>
        </div>
      </dl>

      <div className="mt-2">
        <dt className="text-xs text-muted-foreground">{t("adminCompliance.description")}</dt>
        <dd className="mt-0.5 text-xs leading-relaxed text-foreground/80">{request.description}</dd>
      </div>

      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onViewDocument}>
        <FileText size={14} className="mr-1" /> {t("adminCompliance.viewDocument")}
      </Button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" onClick={onApprove} className="shrink-0">
          <Check size={14} className="mr-1" /> {t("adminCompliance.approve")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReject}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <X size={14} className="mr-1" /> {t("adminCompliance.reject")}
        </Button>
      </div>
    </div>
  );
}
