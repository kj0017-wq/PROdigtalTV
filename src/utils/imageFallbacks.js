const fallbackImageUrls = {
  news: "/images/fallbacks/news.svg",
  topic: "/images/fallbacks/topic.svg",
  event: "/images/fallbacks/event.svg",
  member: "/images/fallbacks/member.svg",
  memberArea: "/images/fallbacks/member-area.svg",
  internal: "/images/fallbacks/internal.svg",
  gallery: "/images/fallbacks/gallery.svg",
  video: "/images/fallbacks/video.svg",
  document: "/images/fallbacks/document.svg",
  sponsor: "/images/fallbacks/sponsor.svg",
  default: "/images/fallbacks/default.svg"
};

export function fallbackImageUrl(type = "default") {
  return fallbackImageUrls[type] || fallbackImageUrls.default;
}

export function stableImageUrl(url = "", type = "default") {
  const value = String(url || "").trim();
  return value || fallbackImageUrl(type);
}

export function imageFallbackAttrs(type = "default") {
  const safeType = String(type || "default").replace(/[^a-z0-9_-]/gi, "") || "default";
  const fallback = fallbackImageUrl(safeType);
  return `onerror="this.onerror=null;this.src='${fallback}'" data-fallback-image="${safeType}" data-fallback-src="${fallback}"`;
}

export function fallbackUsedFor(url = "") {
  return !String(url || "").trim();
}

export const fallbackImageTypes = Object.freeze({ ...fallbackImageUrls });
