const CACHE = "pdt-platform-v945";

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
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("pdt-platform-") || key.startsWith("prodigitaltv-pwa-"))
    .map((key) => caches.delete(key)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key !== CACHE && (key.startsWith("pdt-platform-") || key.startsWith("prodigitaltv-pwa-"))
    )
    .map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.hostname.includes("firebasestorage.googleapis.com") || url.hostname.includes("storage.googleapis.com")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request, { cache: "no-store" }));
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
