const CACHE = "pdt-platform-v959";
const IMAGE_CACHE = "pdt-platform-images-v959";
const APP_SHELL = [
  "/",
  "/index.html",
  "/website.html",
  "/assets/js/pwa.js",
  "/assets/official/brand/prodigitaltv-logo-claim.png",
  "/images/icon-192.png"
];

try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");
  firebase.initializeApp({
    apiKey: "AIzaSyDM7fo7ApSXixviFaphnSFosW7gjWvHRNg",
    authDomain: "prodigitaltv-da47b.firebaseapp.com",
    projectId: "prodigitaltv-da47b",
    storageBucket: "prodigitaltv-da47b.firebasestorage.app",
    messagingSenderId: "769486150443",
    appId: "1:769486150443:web:7cb4e407c58c56362d836e"
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(notification.title || "PROdigitalTV", {
      body: notification.body || "",
      icon: "/images/icon-192.png",
      badge: "/images/icon-192.png",
      data: { link: data.link || "/" }
    });
  });
} catch (error) {
  console.warn("Firebase Messaging konnte im Service Worker nicht initialisiert werden.", error);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => ![CACHE, IMAGE_CACHE].includes(key) && (key.startsWith("pdt-platform-") || key.startsWith("prodigitaltv-pwa-"))
    )
    .map((key) => caches.delete(key)))));
  self.clients.claim();
});

function cacheFirstWithRefresh(request, cacheName) {
  return caches.match(request).then((cached) => {
    const fresh = fetch(request)
      .then((response) => {
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();
          caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => cached);
    return cached || fresh;
  });
}

function networkFirstWithCache(request, cacheName) {
  return fetch(request, { cache: "no-store" })
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => undefined);
      }
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isImageRequest = event.request.destination === "image" || /\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/i.test(url.pathname);
  if ((url.hostname.includes("firebasestorage.googleapis.com") || url.hostname.includes("storage.googleapis.com")) && isImageRequest) {
    event.respondWith(cacheFirstWithRefresh(event.request, IMAGE_CACHE));
    return;
  }
  if (url.hostname.includes("firebasestorage.googleapis.com") || url.hostname.includes("storage.googleapis.com")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === "navigate" || ["", "/", "/index.html", "/website.html", "/cms.html"].includes(url.pathname);
  if (isNavigation) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  if (/\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith(networkFirstWithCache(event.request, CACHE));
    return;
  }

  if (/\.(?:png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirstWithRefresh(event.request, isImageRequest ? IMAGE_CACHE : CACHE));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    const absoluteLink = new URL(link, self.location.origin).href;
    for (const client of clientList) {
      if ("focus" in client && client.url === absoluteLink) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(absoluteLink);
    return undefined;
  }));
});
