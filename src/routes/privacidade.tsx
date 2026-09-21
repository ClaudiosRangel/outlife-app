import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LegalDocView } from "@/components/LegalDocView";
import { getPrivacyDoc } from "@/lib/legal-content";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — OutVitar" },
      { name: "description", content: "Política de Privacidade do aplicativo OutVitar." },
    ],
    links: [{ rel: "canonical", href: "/privacidade" }],
  }),
});

function PrivacidadePage() {
  const { i18n } = useTranslation();
  return <LegalDocView doc={getPrivacyDoc(i18n.language)} />;
}
