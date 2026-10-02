const PUBLIC_APP_BASE_URL = "https://prodigitaltv.de";
const appHosts = new Set([
  "prodigitaltv.de", "www.prodigitaltv.de", "prodigitaltv-da47b.web.app",
  "prodigitaltv.web.app", "prodigtaltv.web.app", "prodigitaltv-da47b.firebaseapp.com",
  "prodigitaltv.firebaseapp.com"
]);
function canonicalPublicAppUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, PUBLIC_APP_BASE_URL);
    if (!["https:", "http:"].includes(url.protocol) || !appHosts.has(url.hostname)) return raw;
    url.protocol = "https:";
    url.hostname = "prodigitaltv.de";
    url.port = "";
    return url.href;
  } catch { return raw; }
}
module.exports = { PUBLIC_APP_BASE_URL, canonicalPublicAppUrl };
