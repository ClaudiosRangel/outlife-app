// Card de indicação no perfil: mostra o código de convite do usuário, um
// resumo (quantos convidou / recompensados) e botões para compartilhar o
// convite ao app (com o código embutido) e copiar o código. Faz parte da
// frente "WhatsApp PRO + Programa de indicação".

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Gift, Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { fetchMyReferralStats } from "@/lib/api";
import { buildAppInviteUrl, buildInviteUrl } from "@/lib/whatsapp-link";
import { APP_INSTALL_URL } from "@/lib/app-links";

export function ReferralCard({ inviterName }: { inviterName?: string | null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["referral-stats"],
    queryFn: fetchMyReferralStats,
  });

  const code = stats?.code ?? null;
  const total = stats?.total ?? 0;
  const rewarded = stats?.rewarded ?? 0;

  const share = () => {
    const url = buildAppInviteUrl({
      inviterName: inviterName ?? null,
      referralCode: code,
      appUrl: APP_INSTALL_URL,
    });
    window.open(url, "_blank");
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(t("referral.codeCopied", { defaultValue: "Código copiado!" }));
    } catch {
      toast.error(t("common.error", { defaultValue: "Não foi possível copiar." }));
    }
  };

  const copyLink = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(buildInviteUrl(APP_INSTALL_URL, code));
      toast.success(t("referral.linkCopied", { defaultValue: "Link de convite copiado!" }));
    } catch {
      toast.error(t("common.error", { defaultValue: "Não foi possível copiar." }));
    }
  };

  return (
    <div className="mx-5 mt-3">
      <div className="overflow-hidden rounded-2xl bg-gradient-forest p-4 text-white shadow-card">
        <div className="flex items-center gap-2">
          <Gift size={18} />
          <span className="text-sm font-semibold">
            {t("referral.title", { defaultValue: "Convide amigos e ganhe" })}
          </span>
        </div>
        <p className="mt-1 text-xs text-white/85">
          {t("referral.subtitle", {
            defaultValue:
              "A cada amigo que se cadastrar pelo seu convite, você ganha um cupom de desconto para usar nas lojas dos parceiros.",
          })}
        </p>

        {code && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 backdrop-blur-md">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-white/70">
                {t("referral.yourCode", { defaultValue: "Seu código" })}
              </div>
              <div className="font-mono text-lg font-bold tracking-wider">{code}</div>
            </div>
            <button
              onClick={copyCode}
              aria-label={t("referral.copyCode", { defaultValue: "Copiar código" })}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 active:scale-95"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={share}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-[var(--forest,#166534)] active:scale-[0.98]"
          >
            <Share2 size={16} />
            {t("referral.invite", { defaultValue: "Convidar pelo WhatsApp" })}
          </button>
          <button
            onClick={copyLink}
            className="rounded-xl bg-white/20 px-3 py-2.5 text-sm font-semibold active:scale-[0.98]"
          >
            {t("referral.copyLink", { defaultValue: "Copiar link" })}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-around border-t border-white/15 pt-3 text-center">
          <div>
            <div className="text-lg font-bold">{total}</div>
            <div className="text-[10px] uppercase tracking-wide text-white/70">
              {t("referral.invited", { defaultValue: "Convidados" })}
            </div>
          </div>
          <div>
            <div className="text-lg font-bold">{rewarded}</div>
            <div className="text-[10px] uppercase tracking-wide text-white/70">
              {t("referral.rewards", { defaultValue: "Cupons ganhos" })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
