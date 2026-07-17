import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Building2, Upload, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { ComplianceBadge, type ComplianceStatus } from "@/components/ComplianceBadge";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchMyCadasturRequest,
  fetchMyProfile,
  submitCadasturRequest,
  uploadComplianceDocument,
} from "@/lib/api";

export const Route = createFileRoute("/compliance")({
  component: CompliancePage,
  head: () => ({
    meta: [
      { title: "Compliance Outlife — Verificação Cadastur" },
      { name: "description", content: "Cadastre sua empresa, envie o Cadastur e receba o selo de verificação Outlife." },
      { property: "og:title", content: "Compliance Outlife — Verificação Cadastur" },
      { property: "og:url", content: "/compliance" },
    ],
    links: [{ rel: "canonical", href: "/compliance" }],
  }),
});

// Cadastur: 11 digits formatted as 00.000000.00-0
const cadasturRegex = /^\d{2}\.\d{6}\.\d{2}-\d{1}$/;

const schema = z.object({
  companyName: z.string().trim().min(2, "Informe o nome da empresa").max(120),
  cnpj: z
    .string()
    .trim()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido (formato 00.000.000/0000-00)"),
  cadastur: z
    .string()
    .trim()
    .regex(cadasturRegex, "Cadastur inválido (formato 00.000000.00-0)"),
  category: z.string().min(1, "Selecione uma categoria"),
  responsible: z.string().trim().min(2, "Informe o responsável").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z.string().trim().min(10, "Telefone inválido").max(20),
  description: z.string().trim().min(20, "Descreva sua operação (mín. 20 caracteres)").max(500),
});

function maskCadastur(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 10) return `${d.slice(0, 2)}.${d.slice(2, 8)}.${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 8)}.${d.slice(8, 10)}-${d.slice(10)}`;
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const CATEGORIES = ["Guias", "Pousadas", "Fotógrafos", "Aluguel", "Restaurantes", "Agências"];

function CompliancePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    companyName: "",
    cnpj: "",
    cadastur: "",
    category: "",
    responsible: "",
    email: "",
    phone: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const docName = selectedFile?.name ?? null;

  const { data: myCadasturRequest } = useQuery({
    queryKey: ["my-cadastur-request", user?.id],
    queryFn: fetchMyCadasturRequest,
    enabled: !!user,
  });
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });

  // Requirement 11.7 — o badge reflete o estado real persistido, nunca mais
  // o selo de "verificado" incondicional da simulação anterior.
  const status: ComplianceStatus = profile?.is_verified
    ? "verified"
    : myCadasturRequest?.status === "pending"
      ? "pending"
      : "unverified";

  const completion = useMemo(() => {
    const total = Object.keys(form).length + 1; // +1 for doc
    const filled =
      Object.values(form).filter((v) => v.trim().length > 0).length + (docName ? 1 : 0);
    return Math.round((filled / total) * 100);
  }, [form, docName]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error(t("compliance.attachDoc"));
      const documentUrl = await uploadComplianceDocument(selectedFile);
      await submitCadasturRequest({
        companyName: form.companyName,
        cnpj: form.cnpj,
        cadastur: form.cadastur,
        category: form.category,
        responsible: form.responsible,
        email: form.email,
        phone: form.phone,
        description: form.description,
        documentUrl,
      });
    },
    onSuccess: () => {
      toast.success(t("compliance.submitted"));
      qc.invalidateQueries({ queryKey: ["my-cadastur-request", user?.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("compliance.genericError"));
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        const path = i.path[0];
        if (typeof path === "string") fieldErrors[path] = i.message;
      });
      setErrors(fieldErrors);
      toast.error(t("compliance.checkFields"));
      return;
    }
    if (!selectedFile) {
      toast.error(t("compliance.attachDoc"));
      return;
    }

    submitMutation.mutate();
  };


  return (
    <div className="bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            to="/marketplace"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label={t("compliance.back")}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="font-serif text-lg font-semibold leading-tight">{t("compliance.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("compliance.subtitle")}</p>
          </div>
          <ComplianceBadge status={status} size="sm" />
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{t("compliance.progress")}</span>
            <span>{completion}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

      </header>

      {/* Status banner */}
      <section className="px-4 pt-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold">{t("compliance.whyTitle")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("compliance.whyDesc")}
              </p>

            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ComplianceBadge status="verified" size="sm" />
            <ComplianceBadge status="pending" size="sm" />
            <ComplianceBadge status="unverified" size="sm" />
          </div>
        </div>
      </section>

      {/* Form */}
      <form onSubmit={onSubmit} className="px-4 pt-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Building2 size={16} className="text-primary" />
          {t("compliance.businessData")}
        </h3>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <Field label={t("compliance.companyName")} error={errors.companyName}>
            <Input
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="Ex.: Rafa Trilhas Expedições"
              maxLength={120}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4">
            <Field label={t("compliance.cnpj")} error={errors.cnpj}>
              <Input
                value={form.cnpj}
                onChange={(e) => update("cnpj", maskCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </Field>

            <Field
              label={t("compliance.cadasturNumber")}
              error={errors.cadastur}
              hint={t("compliance.cadasturHint")}
            >
              <Input
                value={form.cadastur}
                onChange={(e) => update("cadastur", maskCadastur(e.target.value))}
                placeholder="00.000000.00-0"
                inputMode="numeric"
              />
            </Field>
          </div>

          <Field label={t("compliance.category")} error={errors.category}>
            <Select value={form.category} onValueChange={(v) => update("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("compliance.selectCategory")} />
              </SelectTrigger>

              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("compliance.description")} error={errors.description}>
            <Textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder={t("compliance.descriptionPlaceholder")}
              rows={4}
              maxLength={500}
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground">
              {form.description.length}/500
            </div>
          </Field>

        </div>

        <h3 className="mb-3 mt-5 text-sm font-semibold">{t("compliance.responsibleSection")}</h3>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <Field label={t("compliance.fullName")} error={errors.responsible}>
            <Input
              value={form.responsible}
              onChange={(e) => update("responsible", e.target.value)}
              placeholder="Ex.: Rafael Costa"
              maxLength={120}
            />
          </Field>
          <Field label={t("compliance.corpEmail")} error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="contato@empresa.com"
              maxLength={255}
            />
          </Field>
          <Field label={t("compliance.phone")} error={errors.phone}>
            <Input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              maxLength={20}
            />
          </Field>
        </div>


        <h3 className="mb-3 mt-5 text-sm font-semibold">{t("compliance.uploadSection")}</h3>
        <div className="rounded-2xl border border-dashed border-border bg-card p-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload size={18} />
            </div>
            <span className="text-sm font-medium">
              {docName ? docName : t("compliance.uploadCta")}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("compliance.uploadHint")}
            </span>
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) {
                  toast.error(t("compliance.fileTooBig"));
                  return;
                }
                setSelectedFile(f);
              }}
            />
          </label>
        </div>

        <Button
          type="submit"
          className="mt-6 h-12 w-full rounded-full text-sm font-semibold"
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? t("common.loading") : t("compliance.submit")}
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {t("compliance.termsNote")}
        </p>

      </form>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-[11px] font-medium text-destructive">{error}</p>}
    </div>
  );
}
