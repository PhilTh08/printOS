const CACHE_NAME = "philamentix-hub-v2";

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
      .then(async (cache) => {
        // Einzelne fehlgeschlagene Shell-Dateien dürfen die Installation
        // nicht komplett abbrechen (z. B. geschützte Vercel-Previews).
        await Promise.allSettled(
          APP_SHELL.map(async (path) => {
            try {
              const response = await fetch(path, { cache: "no-store" });
              if (response.ok && response.type !== "opaqueredirect") {
                await cache.put(path, response.clone());
              }
            } catch {
              // Preview-/SSO-Fehler bewusst ignorieren.
            }
          }),
        );
      })
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

  // Manifest-Dateien werden vom Browser selbst geladen. Auf geschützten
  // Vercel-Preview-URLs können sie zu Vercel SSO umgeleitet werden; wenn
  // der Service Worker diese Requests übernimmt, entsteht eine CORS-Schleife.
  if (
    request.destination === "manifest" ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith("manifest.json")
  ) {
    return;
  }

  // Fremde Origins nie durch den App-Service-Worker behandeln.
  if (url.origin !== self.location.origin) {
    return;
  }

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
          if (
            response.ok &&
            response.type !== "opaqueredirect" &&
            response.url.startsWith(self.location.origin)
          ) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return (
            cached ||
            new Response("Philamentix Hub ist momentan nicht erreichbar.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );

    return;
  }

  // Statische Dateien zuerst aus dem Cache laden.
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (
          response.ok &&
          response.type !== "opaqueredirect" &&
          response.url.startsWith(self.location.origin)
        ) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      } catch {
        // Niemals ein unbehandeltes Promise aus dem Service Worker werfen.
        return new Response("", { status: 503, statusText: "Offline" });
      }
    }),
  );
});
