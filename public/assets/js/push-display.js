(function (scope) {
  function safeLink(value) {
    try {
      const url = new URL(value || "/", scope.location.origin);
      if (url.protocol === "https:" || (url.origin === scope.location.origin && ["localhost", "127.0.0.1"].includes(url.hostname))) return url.href;
    } catch {}
    return `${scope.location.origin}/`;
  }
  function show(registration, payload = {}) {
    const data = payload.data || {};
    const notification = payload.notification || {};
    return registration.showNotification(String(data.title || notification.title || "PROdigitalTV"), {
      body: String(data.body || notification.body || ""),
      icon: "/images/icon-192.png", badge: "/images/icon-192.png",
      ...(data.notificationId ? { tag: `pdtv-${data.notificationId}`, renotify: false } : {}),
      data: { pdtPush: true, link: safeLink(data.link || payload.fcmOptions?.link), notificationId: data.notificationId || "" }
    });
  }
  scope.PROdigitalTVPush = { safeLink, show };
})(self);
