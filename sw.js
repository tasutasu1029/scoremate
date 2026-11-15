// スコアメイト（iPad 版）: オフラインでも開けるようにファイルを端末に保存しておく
const VERSION = "1428f835881a";
const CACHE = "scoremate-" + VERSION;
const FILES = ["./", "index.html", "sitelib.js", "manifest.webmanifest", "icon-180.png", "icon-512.png", "score-1.html"];
const CDN = "https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES);
    try { await cache.add(new Request(CDN, { mode: "no-cors" })); } catch (e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// 新しい版があればそれを使い、ネットにつながらないときは保存しておいた版を使う
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && req.url !== CDN) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") { const home = await cache.match("./"); if (home) return home; }
      throw e;
    }
  })());
});
