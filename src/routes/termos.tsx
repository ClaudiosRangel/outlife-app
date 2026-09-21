import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LegalDocView } from "@/components/LegalDocView";
import { getTermsDoc } from "@/lib/legal-content";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — OutVitar" },
      { name: "description", content: "Termos de Uso do aplicativo OutVitar." },
    ],
    links: [{ rel: "canonical", href: "/termos" }],
  }),
});

function TermosPage() {
  const { i18n } = useTranslation();
  return <LegalDocView doc={getTermsDoc(i18n.language)} />;
}
