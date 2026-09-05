export function stableImageUrl(url = "") {
  return String(url || "").trim();
}

export function liveImageAttrs(type = "image") {
  const safeType = String(type || "image").replace(/[^a-z0-9_-]/gi, "");
  return `data-live-image="${safeType}" onerror="this.classList.add('is-broken-image');if(this.parentElement)this.parentElement.classList.add('image-load-failed')"`;
}
