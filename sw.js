/* Habit Tracker service worker: lets the app install, open offline and show reminder notifications.
   Bump VERSION when the precache list changes. Pages and scripts on this site are fetched network-first,
   so a normal deploy reaches users on their next visit without a version bump. */
const VERSION = "ht-v3";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js";
const PRECACHE = [
  "./", "index.html", "merge.js", "config.js", "manifest.webmanifest",
  "assets/logo-512.png", "assets/icon-192.png", "assets/icon-maskable-512.png", "assets/apple-touch-icon.png",
  "privacy.html", "terms.html", "support.html",
  SUPABASE_JS, // without it a signed-in user would open offline as a guest
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)) } return res };

/* network first, cache when offline; a slow network falls back to the cached copy after 4 s */
async function networkFirst(req, isPage) {
  const cached = () => caches.match(req, { ignoreSearch: isPage })
    .then(r => r || (isPage ? caches.match("./").then(x => x || caches.match("index.html")) : undefined));
  const net = fetch(req).then(r => put(req, r));
  const slow = new Promise(res => setTimeout(() => cached().then(c => c && res(c)), 4000));
  try { return await Promise.race([net, slow]) }
  catch (err) { const c = await cached(); if (c) return c; throw err }
}

async function cacheFirst(req) {
  return (await caches.match(req)) || put(req, await fetch(req));
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const net = fetch(req).then(r => put(req, r)).catch(() => cached);
  return cached || net;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) { e.respondWith(networkFirst(req, req.mode === "navigate")); return }
  if (req.url === SUPABASE_JS) { e.respondWith(cacheFirst(req)); return }
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") { e.respondWith(staleWhileRevalidate(req)); return }
  // everything else (Supabase API, sign-in, avatars) goes straight to the network
});

/* tapping a reminder opens the app, or focuses it if it's already open */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
