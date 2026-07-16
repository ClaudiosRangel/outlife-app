// Service Worker mínimo da OutLife_Application (Requirement 7.2).
//
// Faz apenas cache-first de assets estáticos (manifest, ícones, CSS/JS
// versionados pelo build), suficiente para o navegador identificar a PWA
// como instalável. Não implementa estratégias avançadas (stale-while-
// revalidate, background sync, push) — fora do escopo desta task.

const CACHE_NAME = 'outlife-static-v1';
const STATIC_ASSETS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  // Cache-first apenas para GET; qualquer outro método (POST/PUT/etc, ex:
  // chamadas ao Supabase) passa direto para a rede, sem interferência.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    }),
  );
});
