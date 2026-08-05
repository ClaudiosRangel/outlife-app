// Service Worker mínimo da OutLife_Application (Requirement 7.2).
//
// Faz apenas cache-first de assets estáticos (manifest, ícones), suficiente
// para o navegador identificar a PWA como instalável. Não implementa
// estratégias avançadas (stale-while-revalidate, background sync) — fora
// do escopo desta task.
//
// CACHE_NAME incrementado (v2) e `skipWaiting`/`clients.claim` adicionados:
// durante a investigação de um bug de digitação travada, descobrimos que o
// Service Worker anterior nunca substituía sua própria instância ativa
// (sem skipWaiting) nem assumia controle das abas já abertas (sem
// clients.claim) — então builds novos do app nunca eram de fato servidos
// enquanto o SW antigo continuava ativo, mesmo com o arquivo sw.js já
// atualizado no disco. Documento de navegação (HTML) agora é
// network-first, nunca cache-first: o "shell" do app (que referencia o
// hash do JS/CSS mais recente) precisa sempre vir da rede para o usuário
// ver builds novos sem precisar limpar cache manualmente.

const CACHE_NAME = 'outlife-static-v2';
const STATIC_ASSETS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Cache-first apenas para GET; qualquer outro método (POST/PUT/etc, ex:
  // chamadas ao Supabase) passa direto para a rede, sem interferência.
  if (event.request.method !== 'GET') {
    return;
  }

  // Requisições de navegação (o documento HTML principal, ex.: "/",
  // "/login") são sempre network-first: nunca serve uma versão em cache
  // desse documento, evitando o app ficar "preso" numa build antiga
  // enquanto o servidor já tem uma nova. Cai para cache/erro apenas se a
  // rede estiver genuinamente indisponível (offline).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    }),
  );
});

// Push_Notification via Web Push (Requirement 11.2): exibe a notificação
// do sistema a partir do payload enviado por `fn_send_web_push`.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Outlife', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Outlife', {
      body: payload.body,
      icon: '/icons/icon-192.png',
      data: payload,
    }),
  );
});

// Requirement 11.5: ao tocar/clicar numa Push_Notification (Web Push, fora
// do Outlife_Native_Shell), navega para `/notificacoes` — tanto quando o
// app já está aberto numa aba (foca e navega) quanto em cold start (abre
// uma nova janela). O equivalente para push nativo (Requirement 11.5,
// dentro do shell) é tratado em `src/lib/push-registration.ts` via
// `@capacitor/push-notifications`.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = '/notificacoes';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'outlife-notification-click', url: targetUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
