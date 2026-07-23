export function route() {
  const hashRoute = window.location.hash.replace(/^#\/?/, "");
  const pathRoute = window.location.hash ? "" : window.location.pathname.replace(/^\/+/, "");
  const hash = hashRoute || pathRoute;
  const [path = "", query = ""] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  return { path: parts[0] || "home", id: parts[1], section: parts[2], query: new URLSearchParams(query) };
}

export function onRouteChange(callback) {
  window.addEventListener("hashchange", callback);
}

export function go(path) {
  window.location.hash = `#/${path}`;
}
