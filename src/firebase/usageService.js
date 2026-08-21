import { getFirebaseServices } from "./firebaseClient.js?v=1";

const SESSION_KEY = "pdtv_usage_session";

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sessionId() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const next = randomId();
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "anonymous-session";
  }
}

function usageViewport() {
  if (typeof window === "undefined") return "unknown";
  return window.matchMedia("(max-width: 820px)").matches ? "mobile" : "desktop";
}

function routeKey(current = {}) {
  return [current.path || "home", current.id || "", current.section || ""].filter(Boolean).join("/");
}

export async function logUsagePageView(current = {}) {
  if (typeof window === "undefined") return null;
  if (current?.path === "cms") return null;
  const route = routeKey(current);
  const payload = {
    type: "page_view",
    path: current.path || "home",
    routeId: current.id || "",
    section: current.section || "",
    route,
    hash: window.location.hash || "",
    pathname: window.location.pathname || "",
    viewport: usageViewport(),
    sessionId: sessionId()
  };
  try {
    const firebase = await getFirebaseServices();
    if (!firebase) return null;
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js")
      .then((analyticsLib) => {
        if (!analyticsLib.isSupported) return null;
        return analyticsLib.isSupported().then((supported) => {
          if (!supported) return null;
          const analytics = analyticsLib.getAnalytics(firebase.app);
          analyticsLib.logEvent(analytics, "page_view", {
            page_title: payload.route,
            page_path: payload.hash || payload.pathname || payload.route,
            pdtv_route: payload.route
          });
          return null;
        });
      })
      .catch(() => {});
    if (!firebase.functions || !firebase.functionsLib?.httpsCallable) return null;
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "logUsageEvent");
    return (await callable({ input: payload })).data;
  } catch (error) {
    console.warn("Nutzungsstatistik konnte nicht protokolliert werden.", error);
    return null;
  }
}
