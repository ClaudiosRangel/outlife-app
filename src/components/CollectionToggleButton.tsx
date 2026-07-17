import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import {
  saveDestination,
  unsaveDestination,
  favoritePartner,
  unfavoritePartner,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export type CollectionToggleKind = "destination" | "partner";

export type CollectionToggleButtonProps = {
  /** Qual entidade este controle representa. */
  kind: CollectionToggleKind;
  /** Id do destino (kind="destination") ou do parceiro (kind="partner"). */
  id: string;
  /** Estado inicial "já salvo/favoritado", vindo do carregamento da tela. */
  isActive: boolean;
  /**
   * Estilo visual: "overlay" (círculo translúcido sobre imagem, como o
   * botão de coração já usado em `parceiro.$partnerId.tsx`) ou "solid"
   * (botão sólido com rótulo, em fluxo normal de layout).
   */
  variant?: "overlay" | "solid";
  size?: "sm" | "md";
  className?: string;
  /** Notificado após a confirmação bem-sucedida da mutação, com o novo estado. */
  onChange?: (active: boolean) => void;
};

const activateFn: Record<CollectionToggleKind, (id: string) => Promise<void>> = {
  destination: saveDestination,
  partner: favoritePartner,
};

const deactivateFn: Record<CollectionToggleKind, (id: string) => Promise<void>> = {
  destination: unsaveDestination,
  partner: unfavoritePartner,
};

// Chaves de query invalidadas na confirmação, para que as abas "Salvos"/
// "Favoritos" de `/perfil` reflitam a mudança na próxima exibição (Req. 2.8).
const invalidateQueryKey: Record<CollectionToggleKind, string> = {
  destination: "saved-destinations",
  partner: "fav-partners",
};

/**
 * Botão de toggle reutilizável para Saved_Destination_Action e
 * Favorite_Partner_Action (Requirement 2). Chama `saveDestination`/
 * `unsaveDestination` ou `favoritePartner`/`unfavoritePartner` conforme
 * `kind`, com atualização otimista e rollback em caso de erro.
 *
 * Guarda de autenticação consistente com o padrão já usado em
 * `comunidade.tsx`: sem usuário autenticado, apenas solicita login via
 * toast e retorna, sem chamar nenhuma função de mutação.
 */
export function CollectionToggleButton({
  kind,
  id,
  isActive,
  variant = "overlay",
  size = "md",
  className,
  onChange,
}: CollectionToggleButtonProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(isActive);

  const mutation = useMutation({
    mutationFn: async (nextActive: boolean) => {
      if (nextActive) {
        await activateFn[kind](id);
      } else {
        await deactivateFn[kind](id);
      }
      return nextActive;
    },
    onMutate: (nextActive: boolean) => {
      const previous = active;
      setActive(nextActive);
      return { previous };
    },
    onError: (_err, _nextActive, context) => {
      if (context) setActive(context.previous);
      toast.error(t("collection.toggleError"));
    },
    onSuccess: (nextActive) => {
      queryClient.invalidateQueries({ queryKey: [invalidateQueryKey[kind]] });
      onChange?.(nextActive);
    },
  });

  // Ressincroniza com o estado vindo do carregamento da tela (ex.: refetch),
  // desde que não haja uma mutação otimista em andamento.
  useEffect(() => {
    if (!mutation.isPending) setActive(isActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleClick = () => {
    if (!user) {
      toast.error(t("collection.loginRequired"));
      return;
    }
    mutation.mutate(!active);
  };

  const Icon = kind === "destination" ? Bookmark : Heart;
  const activeColorClass = kind === "destination" ? "text-primary" : "text-red-500";
  const label =
    kind === "destination"
      ? active
        ? t("collection.savedLabel")
        : t("collection.saveLabel")
      : active
        ? t("collection.favoritedLabel")
        : t("collection.favoriteLabel");

  const iconSize = size === "sm" ? 16 : 18;
  const overlaySizeClass = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const baseClasses =
    variant === "overlay"
      ? cn(
          "grid place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition-base hover:bg-black/60",
          overlaySizeClass,
        )
      : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-base hover:bg-secondary";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mutation.isPending}
      aria-pressed={active}
      aria-label={label}
      className={cn(baseClasses, className)}
    >
      <Icon size={iconSize} fill={active ? "currentColor" : "none"} className={active ? activeColorClass : undefined} />
      {variant === "solid" && <span>{label}</span>}
    </button>
  );
}
