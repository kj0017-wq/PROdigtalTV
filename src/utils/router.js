export function route() {
  const hashRoute = window.location.hash.replace(/^#\/?/, "");
  const rawPathRoute = window.location.pathname
    .replace(/^\/+/, "")
    .replace(/^(index|website)\.html\/?/i, "")
    .replace(/^user-invite\.html\/?/i, "user-invite/");
  const pathRoute = window.location.hash ? "" : `${rawPathRoute}${window.location.search || ""}`;
  const hash = hashRoute || pathRoute;
  const [path = "", query = ""] = hash.split("?");
  const decodePart = (value = "") => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const normalizePath = (value = "") => {
    const decoded = decodePart(value);
    return decoded === "über-uns" ? "ueber-uns" : decoded;
  };
  const normalizedPath = path === "user-invite.html" ? "user-invite" : path;
  const parts = normalizedPath.split("/").filter(Boolean).map(decodePart);
  return { path: normalizePath(parts[0] || "home"), id: parts[1], section: parts[2], query: new URLSearchParams(query) };
}

export function onRouteChange(callback) {
  window.addEventListener("hashchange", callback);
}

export function go(path) {
  window.location.hash = `#/${path}`;
}
