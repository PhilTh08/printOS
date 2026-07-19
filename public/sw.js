const CACHE_NAME = "philamentix-hub-v1";

const APP_SHELL = [
  "/",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Supabase- und API-Anfragen nicht zwischenspeichern.
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Seitenaufrufe zuerst online laden, bei Verbindungsfehler
  // auf die gespeicherte Startseite zurückfallen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put("/", copy));

          return response;
        })
        .catch(() => caches.match("/")),
    );

    return;
  }

  // Statische Dateien zuerst aus dem Cache laden.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (
          response.ok &&
          url.origin === self.location.origin
        ) {
          const copy = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) =>
              cache.put(request, copy),
            );
        }

        return response;
      });
    }),
  );
});