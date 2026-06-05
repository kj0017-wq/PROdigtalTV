(function () {
  const isStandalone = () =>
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isAndroid = () => /android/i.test(window.navigator.userAgent);
  const currentCache = "prodigitaltv-pwa-v7";
  let deferredPrompt = null;

  function clearOldCaches() {
    if (!("caches" in window)) return Promise.resolve();
    return caches.keys().then((keys) => Promise.all(keys
      .filter((key) => (key.startsWith("prodigitaltv-pwa-") || key.startsWith("pdt-platform-")) && key !== currentCache)
      .map((key) => caches.delete(key))));
  }

  function updatePrompt() {
    const prompt = document.querySelector("[data-pwa-install]");
    if (!prompt) return;

    const iosText = prompt.querySelector("[data-pwa-ios]");
    const androidText = prompt.querySelector("[data-pwa-android]");
    const fallbackText = prompt.querySelector("[data-pwa-fallback]");
    const statusText = prompt.querySelector("[data-pwa-status]");
    const installButton = prompt.querySelector("[data-pwa-install-button]");

    if (isStandalone()) {
      prompt.hidden = true;
      return;
    }

    const android = isAndroid();
    const ios = isIos();
    prompt.hidden = !(android || ios);
    if (iosText) iosText.hidden = !ios;
    if (androidText) androidText.hidden = !android || !deferredPrompt;
    if (fallbackText) fallbackText.hidden = !android || !!deferredPrompt;
    if (statusText) {
      statusText.hidden = !android;
      statusText.textContent = deferredPrompt
        ? "Chrome hat die Installation freigegeben."
        : "Falls kein Installationsdialog erscheint: Chrome-Menue oeffnen und App installieren waehlen.";
    }
    if (installButton) installButton.hidden = !android || !deferredPrompt;
  }

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", () => {
      clearOldCaches()
        .then(() => navigator.serviceWorker.register("/sw.js"))
        .then((registration) => registration.update())
        .catch(() => undefined);
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updatePrompt();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updatePrompt();
  });

  document.addEventListener("click", async (event) => {
    const installButton = event.target.closest("[data-pwa-install-button]");
    if (installButton && deferredPrompt) {
      installButton.disabled = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => undefined);
      deferredPrompt = null;
      installButton.disabled = false;
      updatePrompt();
      return;
    }
    if (installButton) {
      updatePrompt();
      return;
    }

    const link = event.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#/") || href.startsWith("/") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin && !link.target) {
      link.target = "_blank";
      link.rel = "noopener";
    }
  });

  window.addEventListener("hashchange", () => window.setTimeout(updatePrompt, 0));
  document.addEventListener("DOMContentLoaded", updatePrompt);
  navigator.serviceWorker?.ready?.then(updatePrompt).catch(() => undefined);
  window.PROdigitalTVPwa = { isStandalone, updatePrompt };
})();
