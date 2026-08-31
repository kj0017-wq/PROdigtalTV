(function () {
  const isStandalone = () =>
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isAndroid = () => /android/i.test(window.navigator.userAgent);
  const isMobile = () => isIos() || isAndroid() || window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 820;
  const currentCache = "prodigitaltv-pwa-v985";
  const activeCacheNames = new Set([currentCache, "pdt-platform-v959", "pdt-platform-images-v959"]);
  const dismissKey = "pdtv-pwa-install-dismissed-session";
  const privacyDismissKey = "pdtv-pwa-privacy-dismissed-session";
  const cookieSettingsOpenKey = "pdtv-cookie-settings-open-session";
  const privacyConsentKey = "pdtv-pwa-privacy-consent";
  const cookieConsentKey = "pdtv-cookie-consent";
  const analyticsConsentKey = "pdtv-cookie-analytics";
  const privacyConsentLogKey = "pdtv-pwa-privacy-consent-log";
  const consentEndpoint = "https://europe-west3-prodigitaltv-da47b.cloudfunctions.net/logPwaPrivacyConsent";
  let deferredPrompt = null;
  let consentSaveInFlight = false;
  let lastFooterTouchHref = "";
  let lastFooterTouchAt = 0;

  function privacyPromptSuppressedForRoute() {
    const routeKey = `${window.location.pathname || ""} ${window.location.hash || ""}`.toLowerCase();
    return /(?:^|\/|#\/)(user-invite|survey|notifications\/unsubscribe|registration\/cancel)(?:\/|\?|#|$)/.test(routeKey);
  }

  function installPromptSuppressedForRoute() {
    const routeKey = `${window.location.pathname || ""} ${window.location.hash || ""}`.toLowerCase();
    return /(?:^|\/|#\/)(user-invite|survey|notifications\/unsubscribe|registration\/cancel|event|events|register|registration|ticket|event-checkin)(?:\/|\?|#|$)/.test(routeKey);
  }

  function clearOldCaches() {
    if (!("caches" in window)) return Promise.resolve();
    return caches.keys().then((keys) => Promise.all(keys
      .filter((key) => (key.startsWith("prodigitaltv-pwa-") || key.startsWith("pdt-platform-")) && !activeCacheNames.has(key))
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

    const suppressPrivacyPrompt = privacyPromptSuppressedForRoute();
    const suppressInstallPrompt = installPromptSuppressedForRoute();
    const android = isAndroid();
    const ios = isIos();
    const canNativeInstall = android && !!deferredPrompt;
    const cookieAccepted = localStorage.getItem(cookieConsentKey) === "1";
    const analyticsAccepted = localStorage.getItem(analyticsConsentKey) === "1";
    const cookieSettingsOpen = sessionStorage.getItem(cookieSettingsOpenKey) === "1";

    if (privacyPrompt) {
      const consentInput = privacyPrompt.querySelector("[data-pwa-privacy-consent]");
      const analyticsInput = privacyPrompt.querySelector("[data-pwa-analytics-consent]");
      const confirmButton = privacyPrompt.querySelector("[data-pwa-privacy-confirm]");
      const necessaryButton = privacyPrompt.querySelector("[data-pwa-cookie-necessary]");
      const acceptAllButton = privacyPrompt.querySelector("[data-pwa-cookie-accept-all]");
      privacyPrompt.hidden = (!cookieSettingsOpen && suppressPrivacyPrompt) || (cookieAccepted && !cookieSettingsOpen) || sessionStorage.getItem(privacyDismissKey) === "1";
      if (consentInput && (cookieAccepted || cookieSettingsOpen)) consentInput.checked = true;
      if (analyticsInput) analyticsInput.checked = analyticsAccepted;
      if (!consentSaveInFlight) {
        if (necessaryButton) necessaryButton.disabled = false;
        if (acceptAllButton) acceptAllButton.disabled = false;
        if (confirmButton) {
          confirmButton.disabled = !consentInput?.checked;
          confirmButton.textContent = "Auswahl speichern";
        }
      }
    }

    if (!installPrompt) return;
    const showInstallFlow = !cookieSettingsOpen && !suppressInstallPrompt && cookieAccepted && isMobile() && sessionStorage.getItem(dismissKey) !== "1";
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

    if (iosText) iosText.hidden = !cookieAccepted || !ios;
    if (androidText) androidText.hidden = !cookieAccepted || !canNativeInstall;
    if (fallbackText) fallbackText.hidden = !cookieAccepted || ios || canNativeInstall;
    if (installTitle) installTitle.textContent = canNativeInstall ? "WebApp installieren" : "WebApp zum Homescreen hinzufuegen";
    if (statusText) {
      statusText.hidden = !cookieAccepted || !android || !canNativeInstall;
      statusText.textContent = "Chrome hat die Installation freigegeben.";
    }
    if (installButton) {
      installButton.hidden = !cookieAccepted || !canNativeInstall;
      installButton.disabled = false;
    }
    if (instructionOkButton) instructionOkButton.hidden = !cookieAccepted || canNativeInstall;
    if (dismissButton) dismissButton.hidden = cookieAccepted && !canNativeInstall;
  }

  async function logPrivacyConsent({ analyticsAccepted = false, source = "webapp_cookie_consent", timeoutMs = 5000 } = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(consentEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        accepted: true,
        analyticsAccepted: Boolean(analyticsAccepted),
        consentVersion: "cookie-consent-v1",
        legalTextKey: "local-storage-cache-ticket-token-analytics-optional",
        source,
        path: window.location.hash || "#/home",
        pathname: window.location.pathname || "/",
        userAgent: window.navigator.userAgent || ""
      })
    }).finally(() => window.clearTimeout(timeout));
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "consent_log_failed");
    return data;
  }

  function setConsentButtonsDisabled(privacyPrompt, disabled) {
    privacyPrompt?.querySelectorAll("[data-pwa-cookie-necessary], [data-pwa-privacy-confirm], [data-pwa-cookie-accept-all]")
      .forEach((button) => {
        button.disabled = disabled || (button.hasAttribute("data-pwa-privacy-confirm") && !privacyPrompt.querySelector("[data-pwa-privacy-consent]")?.checked);
      });
  }

  function openCookieSettingsFromEvent(event) {
    const link = event.target?.closest?.("[data-cookie-settings]");
    if (!link) return false;
    event.preventDefault();
    event.stopPropagation();
    sessionStorage.setItem(cookieSettingsOpenKey, "1");
    sessionStorage.setItem(dismissKey, "1");
    sessionStorage.removeItem(privacyDismissKey);
    const installPrompt = document.querySelector("[data-pwa-install]");
    if (installPrompt) installPrompt.hidden = true;
    updatePrompt();
    window.setTimeout(updatePrompt, 0);
    return true;
  }

  function handleFooterLinkFromEvent(event) {
    const link = event.target?.closest?.(".footer a[href]");
    if (!link) return false;
    if (link.hasAttribute("data-cookie-settings")) return openCookieSettingsFromEvent(event);
    const href = link.getAttribute("href");
    if (!href) return false;
    const now = Date.now();
    if (event.type === "click" && href === lastFooterTouchHref && now - lastFooterTouchAt < 700) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    if (event.type === "touchend") {
      lastFooterTouchHref = href;
      lastFooterTouchAt = now;
    }
    event.preventDefault();
    event.stopPropagation();
    if (href.startsWith("#/")) {
      window.location.hash = href;
      window.setTimeout(updatePrompt, 0);
      return true;
    }
    window.location.href = href;
    return true;
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

  document.addEventListener("click", openCookieSettingsFromEvent, true);
  document.addEventListener("touchend", openCookieSettingsFromEvent, { capture: true, passive: false });
  document.addEventListener("click", handleFooterLinkFromEvent, true);
  document.addEventListener("touchend", handleFooterLinkFromEvent, { capture: true, passive: false });

  document.addEventListener("click", async (event) => {
    const installButton = event.target.closest("[data-pwa-install-button]");
    if (installButton && deferredPrompt) {
      if (localStorage.getItem(cookieConsentKey) !== "1") {
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

    const analyticsInput = event.target.closest("[data-pwa-analytics-consent]");
    if (analyticsInput) {
      updatePrompt();
      return;
    }

    async function storeCookieConsent(privacyPrompt, analyticsAccepted, source) {
      if (consentSaveInFlight) return;
      consentSaveInFlight = true;
      setConsentButtonsDisabled(privacyPrompt, true);
      const status = privacyPrompt?.querySelector("[data-pwa-privacy-status]");
      if (status) {
        status.hidden = false;
        status.textContent = "Einstellungen werden gespeichert ...";
      }
      const acceptedAtIso = new Date().toISOString();
      let result = {};
      let pendingSync = false;
      try {
        result = await logPrivacyConsent({ analyticsAccepted, source });
      } catch (error) {
        pendingSync = true;
      }
      localStorage.setItem(privacyConsentKey, "1");
      localStorage.setItem(cookieConsentKey, "1");
      localStorage.setItem(analyticsConsentKey, analyticsAccepted ? "1" : "0");
      localStorage.setItem(privacyConsentLogKey, JSON.stringify({
        consentId: result.consentId || "",
        acceptedAtIso: result.acceptedAtIso || acceptedAtIso,
        analyticsAccepted: Boolean(analyticsAccepted),
        pendingSync,
        source
      }));
      sessionStorage.removeItem(privacyDismissKey);
      sessionStorage.removeItem(cookieSettingsOpenKey);
      if (status && pendingSync) {
        status.hidden = false;
        status.textContent = "Einstellungen gespeichert. Protokollierung wird spaeter erneut versucht.";
      }
      consentSaveInFlight = false;
      updatePrompt();
      window.dispatchEvent(new CustomEvent("pdtv-cookie-consent-changed", { detail: { analyticsAccepted: Boolean(analyticsAccepted) } }));
    }

    const privacyConfirm = event.target.closest("[data-pwa-privacy-confirm]");
    if (privacyConfirm) {
      const privacyPrompt = privacyConfirm.closest("[data-pwa-privacy]");
      const consentInput = privacyPrompt?.querySelector("[data-pwa-privacy-consent]");
      const analyticsInput = privacyPrompt?.querySelector("[data-pwa-analytics-consent]");
      if (!consentInput?.checked) return;
      privacyConfirm.disabled = true;
      const oldText = privacyConfirm.textContent;
      privacyConfirm.textContent = "Speichere ...";
      try {
        await storeCookieConsent(privacyPrompt, !!analyticsInput?.checked, "webapp_cookie_selection");
      } catch (error) {
        privacyConfirm.disabled = false;
        privacyConfirm.textContent = oldText;
      }
      return;
    }

    const necessaryButton = event.target.closest("[data-pwa-cookie-necessary]");
    if (necessaryButton) {
      const privacyPrompt = necessaryButton.closest("[data-pwa-privacy]");
      necessaryButton.disabled = true;
      try {
        await storeCookieConsent(privacyPrompt, false, "webapp_cookie_necessary");
      } catch {
        necessaryButton.disabled = false;
      }
      return;
    }

    const acceptAllButton = event.target.closest("[data-pwa-cookie-accept-all]");
    if (acceptAllButton) {
      const privacyPrompt = acceptAllButton.closest("[data-pwa-privacy]");
      const consentInput = privacyPrompt?.querySelector("[data-pwa-privacy-consent]");
      const analyticsInput = privacyPrompt?.querySelector("[data-pwa-analytics-consent]");
      if (consentInput) consentInput.checked = true;
      if (analyticsInput) analyticsInput.checked = true;
      acceptAllButton.disabled = true;
      try {
        await storeCookieConsent(privacyPrompt, true, "webapp_cookie_accept_all");
      } catch {
        acceptAllButton.disabled = false;
      }
      return;
    }

    const cookieSettingsLink = event.target.closest("[data-cookie-settings]");
    if (cookieSettingsLink) {
      openCookieSettingsFromEvent(event);
      return;
    }

    const dismissButton = event.target.closest("[data-pwa-dismiss]");
    if (dismissButton) {
      const prompt = dismissButton.closest("[data-pwa-install], [data-pwa-privacy]");
      if (prompt?.hasAttribute("data-pwa-privacy")) {
        sessionStorage.setItem(privacyDismissKey, "1");
        sessionStorage.removeItem(cookieSettingsOpenKey);
      } else sessionStorage.setItem(dismissKey, "1");
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
