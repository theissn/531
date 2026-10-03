// Bump this version whenever the app shell or icons change.
const APP_ROOT = new URL("./", self.location.href);
const CACHE_PREFIX = `lift-sheet-531-${APP_ROOT.pathname}-shell-`;
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const SHELL_URLS = [
  "./", "./index.html", "./styles.css", "./app.js", "./pwa.js",
  "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
].map((path) => new URL(path, APP_ROOT).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(
    SHELL_URLS.map((url) => new Request(url, { cache: "reload" }))
  )));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  // Cache only this app's known files, including when hosted in a subdirectory.
  if (!SHELL_URLS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(url.href) || fetch(event.request);
  })());
});
