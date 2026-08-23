(function () {
  const isStandalone = () =>
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isAndroid = () => /android/i.test(window.navigator.userAgent);
  const isMobile = () => isIos() || isAndroid() || window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 820;
  const currentCache = "prodigitaltv-pwa-v970";
  const dismissKey = "pdtv-pwa-install-dismissed-session";
  const privacyDismissKey = "pdtv-pwa-privacy-dismissed-session";
  const privacyConsentKey = "pdtv-pwa-privacy-consent";
  const privacyConsentLogKey = "pdtv-pwa-privacy-consent-log";
  const consentEndpoint = "https://europe-west3-prodigitaltv-da47b.cloudfunctions.net/logPwaPrivacyConsent";
  let deferredPrompt = null;

  function clearOldCaches() {
    if (!("caches" in window)) return Promise.resolve();
    return caches.keys().then((keys) => Promise.all(keys
      .filter((key) => (key.startsWith("prodigitaltv-pwa-") || key.startsWith("pdt-platform-")) && key !== currentCache)
      .map((key) => caches.delete(key))));
  }

  function updatePrompt() {
    const privacyPrompt = document.querySelector("[data-pwa-privacy]");
    const installPrompt = document.querySelector("[data-pwa-install]");
    if (!privacyPrompt && !installPrompt) return;

    if (isStandalone()) {
      if (privacyPrompt) privacyPrompt.hidden = true;
      if (installPrompt) installPrompt.hidden = true;
      return;
    }

    const android = isAndroid();
    const ios = isIos();
    const canNativeInstall = android && !!deferredPrompt;
    const privacyAccepted = localStorage.getItem(privacyConsentKey) === "1";

    if (privacyPrompt) {
      const consentInput = privacyPrompt.querySelector("[data-pwa-privacy-consent]");
      const confirmButton = privacyPrompt.querySelector("[data-pwa-privacy-confirm]");
      privacyPrompt.hidden = privacyAccepted || sessionStorage.getItem(privacyDismissKey) === "1";
      if (consentInput && privacyAccepted) consentInput.checked = true;
      if (confirmButton) confirmButton.disabled = !privacyAccepted && !consentInput?.checked;
    }

    if (!installPrompt) return;
    const showInstallFlow = privacyAccepted && isMobile() && sessionStorage.getItem(dismissKey) !== "1";
    installPrompt.hidden = !showInstallFlow;
    if (!showInstallFlow) return;
    const iosText = installPrompt.querySelector("[data-pwa-ios]");
    const androidText = installPrompt.querySelector("[data-pwa-android]");
    const fallbackText = installPrompt.querySelector("[data-pwa-fallback]");
    const statusText = installPrompt.querySelector("[data-pwa-status]");
    const installButton = installPrompt.querySelector("[data-pwa-install-button]");
    const instructionOkButton = installPrompt.querySelector("[data-pwa-instruction-ok]");
    const dismissButton = installPrompt.querySelector("[data-pwa-dismiss]");
    const installTitle = installPrompt.querySelector("[data-pwa-install-title]");

    if (iosText) iosText.hidden = !privacyAccepted || !ios;
    if (androidText) androidText.hidden = !privacyAccepted || !canNativeInstall;
    if (fallbackText) fallbackText.hidden = !privacyAccepted || ios || canNativeInstall;
    if (installTitle) installTitle.textContent = canNativeInstall ? "WebApp installieren" : "WebApp zum Homescreen hinzufuegen";
    if (statusText) {
      statusText.hidden = !privacyAccepted || !android || !canNativeInstall;
      statusText.textContent = "Chrome hat die Installation freigegeben.";
    }
    if (installButton) {
      installButton.hidden = !privacyAccepted || !canNativeInstall;
      installButton.disabled = false;
    }
    if (instructionOkButton) instructionOkButton.hidden = !privacyAccepted || canNativeInstall;
    if (dismissButton) dismissButton.hidden = privacyAccepted && !canNativeInstall;
  }

  async function logPrivacyConsent() {
    const response = await fetch(consentEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accepted: true,
        consentVersion: "pwa-homescreen-v1",
        legalTextKey: "pwa-local-storage-cache-ticket-token",
        source: "webapp_start_prompt",
        path: window.location.hash || "#/home",
        pathname: window.location.pathname || "/",
        userAgent: window.navigator.userAgent || ""
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "consent_log_failed");
    return data;
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
      if (localStorage.getItem(privacyConsentKey) !== "1") {
        updatePrompt();
        return;
      }
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

    const instructionOkButton = event.target.closest("[data-pwa-instruction-ok]");
    if (instructionOkButton) {
      sessionStorage.setItem(dismissKey, "1");
      const prompt = instructionOkButton.closest("[data-pwa-install]");
      if (prompt) prompt.hidden = true;
      return;
    }

    const consentInput = event.target.closest("[data-pwa-privacy-consent]");
    if (consentInput) {
      const privacyPrompt = consentInput.closest("[data-pwa-privacy]");
      const confirmButton = privacyPrompt?.querySelector("[data-pwa-privacy-confirm]");
      if (confirmButton) confirmButton.disabled = !consentInput.checked;
      updatePrompt();
      return;
    }

    const privacyConfirm = event.target.closest("[data-pwa-privacy-confirm]");
    if (privacyConfirm) {
      const privacyPrompt = privacyConfirm.closest("[data-pwa-privacy]");
      const consentInput = privacyPrompt?.querySelector("[data-pwa-privacy-consent]");
      const status = privacyPrompt?.querySelector("[data-pwa-privacy-status]");
      if (!consentInput?.checked) return;
      privacyConfirm.disabled = true;
      const oldText = privacyConfirm.textContent;
      privacyConfirm.textContent = "Speichere ...";
      if (status) {
        status.hidden = false;
        status.textContent = "Datenschutz-Bestaetigung wird gespeichert ...";
      }
      try {
        const result = await logPrivacyConsent();
        localStorage.setItem(privacyConsentKey, "1");
        localStorage.setItem(privacyConsentLogKey, JSON.stringify({
          consentId: result.consentId || "",
          acceptedAtIso: result.acceptedAtIso || new Date().toISOString()
        }));
        sessionStorage.removeItem(privacyDismissKey);
        updatePrompt();
      } catch (error) {
        privacyConfirm.disabled = false;
        privacyConfirm.textContent = oldText;
        if (status) {
          status.hidden = false;
          status.textContent = "Bestaetigung konnte nicht gespeichert werden. Bitte erneut versuchen.";
        }
      }
      return;
    }

    const dismissButton = event.target.closest("[data-pwa-dismiss]");
    if (dismissButton) {
      const prompt = dismissButton.closest("[data-pwa-install], [data-pwa-privacy]");
      if (prompt?.hasAttribute("data-pwa-privacy")) sessionStorage.setItem(privacyDismissKey, "1");
      else sessionStorage.setItem(dismissKey, "1");
      if (prompt) prompt.hidden = true;
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
