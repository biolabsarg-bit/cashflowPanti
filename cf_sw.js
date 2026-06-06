const CACHE_NAME = "cashflow-v1";
const ASSETS = ["/", "/index.html", "/app.js", "/manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  // API y Supabase siempre van a la red
  if (request.url.includes("/api/") || request.url.includes("supabase.co") || request.url.includes("dolarapi.com")) {
    event.respondWith(fetch(request));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
