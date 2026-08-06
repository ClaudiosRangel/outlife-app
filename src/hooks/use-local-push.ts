/**
 * Hook que simula push notifications exibindo notificações locais
 * (Web Notifications API / Capacitor Local Notifications) quando novas
 * notificações in-app são detectadas por polling.
 *
 * Funciona sem FCM/APNs — enquanto não houver google-services.json
 * configurado, este é o mecanismo que faz aparecer notificações na
 * central do celular quando alguém curte um post ou envia solicitação
 * de amizade.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

const POLL_INTERVAL_MS = 30_000;

/** Solicita permissão de notificação (Web API) se ainda não concedida. */
async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** Exibe uma notificação na central do sistema via Web Notifications API. */
function showLocalNotification(title: string, body: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: `outlife-${Date.now()}`,
    });
  } catch {
    // Fallback para service worker notifications (requerido em mobile)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: "/icons/icon-192.png",
          tag: `outlife-${Date.now()}`,
        });
      }).catch(() => {});
    }
  }
}

function getNotificationText(type: string, payload: Record<string, unknown>): { title: string; body: string } | null {
  switch (type) {
    case "friend_request":
      return { title: "OutLife", body: "Você recebeu uma solicitação de amizade!" };
    case "post_like":
      return { title: "OutLife", body: "Alguém curtiu sua publicação!" };
    case "destination_approved":
      return { title: "OutLife", body: `Seu destino "${(payload as any).destinationName ?? ""}" foi aprovado!` };
    default:
      return { title: "OutLife", body: "Você tem uma nova notificação" };
  }
}

export function useLocalPushNotifications() {
  const { user } = useAuth();
  const lastCheckedRef = useRef<string | null>(null);
  const permissionGrantedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Solicita permissão ao montar
    ensureNotificationPermission().then((granted) => {
      permissionGrantedRef.current = granted;
    });

    let cancelled = false;

    const poll = async () => {
      if (cancelled || !permissionGrantedRef.current) return;

      try {
        // Busca notificações não lidas criadas depois do último check
        let query = supabase
          .from("notifications")
          .select("id, type, payload, created_at")
          .eq("recipient_id", user.id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(5);

        if (lastCheckedRef.current) {
          query = query.gt("created_at", lastCheckedRef.current);
        }

        const { data } = await query;

        if (data && data.length > 0 && lastCheckedRef.current) {
          // Só notifica se não for a primeira carga (evita spam ao abrir o app)
          for (const n of data) {
            const notif = getNotificationText(n.type, n.payload as Record<string, unknown>);
            if (notif) showLocalNotification(notif.title, notif.body);
          }
        }

        if (data && data.length > 0) {
          lastCheckedRef.current = data[0].created_at;
        } else if (!lastCheckedRef.current) {
          // Primeira carga: marca o timestamp atual para não notificar as existentes
          lastCheckedRef.current = new Date().toISOString();
        }
      } catch {
        // Silencioso — não deve impedir o app de funcionar
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);
}
