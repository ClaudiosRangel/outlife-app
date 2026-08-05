// Registro dual de Push_Notification: Native_Push_Token (via
// @capacitor/push-notifications, dentro do Outlife_Native_Shell) e
// Web_Push_Subscription (fora do shell, padrão Web Push do navegador).
//
// Requirement 11.1: dentro do Outlife_Native_Shell, ao conceder permissão
// de notificações, a OutLife_Application deve registrar um Native_Push_Token.
// Requirement 11.2: fora do shell, com suporte a Web Push, deve registrar
// uma Web_Push_Subscription.
// Requirement 11.7: iOS Safari sem instalação como PWA não suporta Web
// Push — a tentativa de registro deve ser evitada nesse caso, e a
// limitação informada na UI de configurações (fora do escopo desta task).
//
// `registerPushForCurrentPlatform` é o único ponto de entrada, ramificando
// por `Capacitor.isNativePlatform()`.

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Callback de navegação para o deep-link de Push_Notification nativa
 * (Requirement 11.5), injetada por `registerPushNotificationTapNavigation`
 * — evita importar o router do TanStack diretamente aqui, mantendo este
 * módulo desacoplado da árvore de rotas.
 */
let notificationTapNavigationHandler: ((url: string) => void) | null = null;

/**
 * Registra o listener de toque em uma Push_Notification nativa
 * (`@capacitor/push-notifications`, evento `pushNotificationActionPerformed`),
 * navegando para `/notificacoes` — tanto em cold start (app fechado, toque
 * abre e a ação já está disponível) quanto em background (app em segundo
 * plano). Chamado uma vez a partir do componente raiz da aplicação
 * (Requirement 11.5).
 */
export function registerPushNotificationTapNavigation(navigate: (url: string) => void): void {
  notificationTapNavigationHandler = navigate;
  if (!Capacitor.isNativePlatform()) return;
  PushNotifications.addListener("pushNotificationActionPerformed", () => {
    notificationTapNavigationHandler?.("/notificacoes");
  });
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";
const DEVICE_ID_STORAGE_KEY = "outlife_device_id";
const PUSH_REGISTRATION_TIMEOUT_MS = 10_000;

/**
 * Detecta iOS Safari executando fora do Outlife_Native_Shell e sem estar
 * instalado como PWA na tela inicial — a única combinação em que Web Push
 * não é suportado (Requirement 11.7). Função pura de detecção de
 * plataforma/instalação: não lê nem escreve nenhum estado, apenas inspeciona
 * `navigator`/`window` no momento da chamada.
 */
export function isIosBrowserWithoutInstalledPwa(): boolean {
  if (typeof navigator === "undefined") return false;
  if (Capacitor.isNativePlatform()) return false;

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!isIos) return false;

  const isStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches);

  return !isStandalone;
}

/** Lê (ou gera e persiste) um identificador estável de instalação para este dispositivo/navegador. */
function getOrCreateDeviceId(): string {
  if (typeof localStorage === "undefined") return "unknown-device";
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

/**
 * Lê o access token da sessão Supabase atual, para autenticar a chamada aos
 * endpoints de registro de push (mesmo padrão de `external-api.ts`). Nunca
 * lança: qualquer falha ao obter a sessão resolve com `null`.
 */
async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** POST autenticado a um endpoint de registro de push, com timeout. Lança em caso de falha. */
async function postPushRegistration(path: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PUSH_REGISTRATION_TIMEOUT_MS);
  try {
    const token = await getSupabaseAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Falha ao registrar push (${path}): HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Registra um Native_Push_Token no endpoint `/api/push/register-native`
 * (task 12.5), associado ao dispositivo atual.
 */
export async function registerNativePushToken(token: string, platform: "android" | "ios"): Promise<void> {
  await postPushRegistration("/api/push/register-native", {
    token,
    platform,
    deviceId: getOrCreateDeviceId(),
  });
}

/**
 * Registra uma Web_Push_Subscription no endpoint `/api/push/register-web`
 * (task 12.5).
 */
export async function registerWebPushSubscription(subscriptionJson: PushSubscriptionJSON): Promise<void> {
  await postPushRegistration("/api/push/register-web", subscriptionJson);
}

/**
 * Invalida (marca `is_active = false`, nunca `DELETE`, preservando
 * histórico para auditoria) o registro de push do dispositivo/navegador
 * atual, associado ao usuário autenticado.
 *
 * Chamada em três pontos (Requirement 11.8): `signOut()` (`perfil.tsx`),
 * revogação de permissão de notificações nativas, e revogação de permissão
 * de localização em segundo plano durante o rastreamento (que também
 * implica que o usuário não deseja mais push relacionado a essa
 * atividade). Nunca lança: qualquer falha na invalidação é registrada mas
 * não deve bloquear o fluxo que a acionou (logout, etc.).
 */
export async function invalidatePushRegistration(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await postPushRegistration("/api/push/invalidate-native", {
        deviceId: getOrCreateDeviceId(),
      });
      return;
    }
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await postPushRegistration("/api/push/invalidate-web", { endpoint: subscription.endpoint });
  } catch {
    // Requirement 11.8 — falha na invalidação nunca deve bloquear o fluxo
    // que a acionou (logout, revogação de permissão).
  }
}

/**
 * Ponto de entrada único do registro de push, ramificando por plataforma
 * (Requirements 11.1, 11.2, 11.7):
 * - Dentro do Outlife_Native_Shell: solicita permissão nativa, registra via
 *   `@capacitor/push-notifications`, e no listener `registration` grava o
 *   Native_Push_Token.
 * - Fora do shell: verifica a restrição de iOS sem PWA instalada antes de
 *   solicitar permissão de Web Push e assinar via `pushManager.subscribe`.
 */
export async function registerPushForCurrentPlatform(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { receive } = await PushNotifications.checkPermissions();
    if (receive !== "granted") {
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== "granted") return;
    }
    await PushNotifications.register();
    PushNotifications.addListener("registration", async (token) => {
      await registerNativePushToken(token.value, Capacitor.getPlatform() as "android" | "ios");
    });
    // Requirement 11.8: se a permissão de notificações nativas for
    // revogada pelo usuário posteriormente (fora do app, nas
    // configurações do sistema), invalida o Native_Push_Token registrado
    // assim que essa mudança for detectada.
    PushNotifications.addListener("registrationError", async () => {
      await invalidatePushRegistration();
    });
    return;
  }

  if (isIosBrowserWithoutInstalledPwa()) {
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });
  await registerWebPushSubscription(subscription.toJSON());
}
