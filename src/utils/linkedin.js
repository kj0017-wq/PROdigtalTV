export const LINKEDIN_STATUSES = ["draft", "approved", "published", "error"];

export function normalizeLinkedIn(value = {}, defaults = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    enabled: Boolean(source.enabled ?? defaults.enabled ?? false),
    text: String(source.text || defaults.text || ""),
    hashtags: (Array.isArray(source.hashtags) ? source.hashtags : defaults.hashtags || [])
      .map((tag) => String(tag || "").trim())
      .filter(Boolean),
    imageUrl: String(source.imageUrl || defaults.imageUrl || "").trim(),
    useArticleImage: source.useArticleImage !== false,
    articleUrl: String(source.articleUrl || defaults.articleUrl || "").trim(),
    status: LINKEDIN_STATUSES.includes(source.status) ? source.status : "draft",
    scheduledAt: String(source.scheduledAt || "").trim(),
    publishedAt: String(source.publishedAt || "").trim(),
    linkedinPostId: String(source.linkedinPostId || "").trim()
  };
}

export function normalizeLinkedInHashtags(value = "") {
  const values = Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/);
  return Array.from(new Set(values.map((tag) => String(tag || "").trim().replace(/^#+/, "").replace(/\s+/g, "-")).filter(Boolean)))
    .map((tag) => `#${tag}`);
}

export function linkedInFromForm(form, existing = {}, defaults = {}) {
  const get = (name) => form.elements?.[name]?.value ?? "";
  const checked = (name, fallback = false) => form.elements?.[name] ? Boolean(form.elements[name].checked) : fallback;
  const current = normalizeLinkedIn(existing.linkedin, defaults);
  const rawArticleUrl = String(get("linkedinArticleUrl") || current.articleUrl || defaults.articleUrl || "").trim();
  let articleUrl = rawArticleUrl;
  try { articleUrl = rawArticleUrl ? new URL(rawArticleUrl, typeof window !== "undefined" ? window.location.origin : "https://prodigitaltv.de").href : ""; } catch {}
  return {
    ...current,
    enabled: checked("linkedinEnabled", current.enabled),
    text: String(get("linkedinText") || "").trim(),
    hashtags: normalizeLinkedInHashtags(get("linkedinHashtags")),
    imageUrl: String(get("linkedinImageUrl") || "").trim(),
    useArticleImage: checked("linkedinUseArticleImage", true),
    articleUrl,
    status: LINKEDIN_STATUSES.includes(get("linkedinStatus")) ? get("linkedinStatus") : current.status,
    scheduledAt: String(get("linkedinScheduledAt") || "").trim(),
    publishedAt: current.publishedAt,
    linkedinPostId: current.linkedinPostId
  };
}
