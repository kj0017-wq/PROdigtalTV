(function (scope) {
  function safeLink(value) {
    try {
      const url = new URL(value || "/", scope.location.origin);
      const aliases = ["prodigitaltv.de", "www.prodigitaltv.de", "prodigitaltv.web.app", "prodigitaltv.firebaseapp.com", "prodigitaltv-da47b.web.app", "prodigitaltv-da47b.firebaseapp.com"];
      const local = url.origin === scope.location.origin && ["localhost", "127.0.0.1"].includes(url.hostname);
      if ((url.protocol === "https:" && (url.origin === scope.location.origin || aliases.includes(url.hostname))) || local) {
        if (!["/", "/index.html", "/website.html", "/checkin.html"].includes(url.pathname)) return `${scope.location.origin}/`;
        const target = new URL("/", scope.location.origin);
        target.search = url.search;
        target.searchParams.delete("v");
        target.hash = url.hash;
        return target.href;
      }
    } catch {}
    return `${scope.location.origin}/`;
  }
  async function show(registration, payload = {}) {
    const data = payload.data || {};
    const notification = payload.notification || {};
    // Notification `badge` below is an icon, not the iOS Home Screen counter.
    if (/^\d+$/.test(String(data.badgeCount ?? ""))) {
      const count = Number(data.badgeCount);
      if (Number.isSafeInteger(count)) {
        try {
          if (count > 0) await scope.navigator?.setAppBadge?.(count);
          else await scope.navigator?.clearAppBadge?.();
        } catch { /* Badging must never prevent notification delivery. */ }
      }
    }
    return registration.showNotification(String(data.title || notification.title || "PROdigitalTV"), {
      body: String(data.body || notification.body || ""),
      icon: "/images/icon-192.png", badge: "/images/icon-192.png",
      ...(data.notificationId ? { tag: `pdtv-${data.notificationId}`, renotify: false } : {}),
      data: { pdtPush: true, link: safeLink(data.link || payload.fcmOptions?.link), notificationId: data.notificationId || "", interactionId: data.interactionId || "" }
    });
  }
  scope.PROdigitalTVPush = { safeLink, show };
})(self);
