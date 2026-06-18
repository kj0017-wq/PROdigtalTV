import { cmsShell, cmsTitle } from "./cmsLayout.js?v=467";
import { list, getOne } from "../firebase/dataService.js?v=487";
import { currentUser, canUseCms, waitForAuthReady } from "../firebase/authService.js?v=470";
import { escapeHtml } from "../utils/format.js";

const mediaSections = [
  ["library", "Bilder"],
  ["videos", "Videos"]
];

const mediaTypeLabels = {
  upload: "Upload",
  ai: "KI-Grafik",
  news: "News",
  event: "Eventbild",
  board: "Vorstand",
  article: "Artikelbild",
  topic: "Themenbild",
  member: "Mitglied",
  person: "Personenbild",
  logo: "Logo",
  thumb: "Thumbnail",
  thumbnail: "Thumbnail",
  web: "Web-Variante",
  landscape: "Landscape",
  portrait: "Hochkant",
  edited: "Bearbeitet"
};

const mediaSourceLabels = {
  upload: "Upload",
  ai: "KI-Bild",
  official: "Official-Bestand",
  edited: "Bearbeitet"
};

const lastMediaAssetKey = "pdt-last-media-asset-id";

const mediaUsagePresets = {
  upload: { label: "Upload", aspect: "16x9", width: 1600, height: 900, portal: "Allgemein / responsive", mobile: "Responsive mit Bildfokus" },
  ai: { label: "KI-Grafik", aspect: "16x9", width: 1600, height: 900, portal: "Redaktionelle Grafik", mobile: "Responsive 16:9" },
  news: { label: "News", aspect: "16x9", width: 1600, height: 900, portal: "News-Teaser und Artikelkopf", mobile: "Mobile News-Teaser 16:9" },
  event: { label: "Eventbild", aspect: "16x9", width: 1600, height: 900, portal: "Event-Teaser und Detailkopf", mobile: "Mobile Eventkarte 16:9" },
  article: { label: "Artikelbild", aspect: "16x9", width: 1600, height: 900, portal: "Artikel / Redaktion", mobile: "Mobile Artikelkarte 16:9" },
  topic: { label: "Themenbild", aspect: "16x9", width: 1600, height: 900, portal: "Themenkarte / Themenkopf", mobile: "Mobile Themenkarte 16:9" },
  board: { label: "Vorstand", aspect: "4x5", width: 1200, height: 1500, portal: "Vorstandsprofil", mobile: "Mobile Profilkarte 4:5" },
  member: { label: "Mitglied", aspect: "logo", width: 1530, height: 600, portal: "Mitgliederkarte / Logo 2.55:1", mobile: "Mobile Mitgliederkarte 2.55:1" },
  person: { label: "Personenbild", aspect: "4x5", width: 1200, height: 1500, portal: "Personenprofil", mobile: "Mobile Profilkarte 4:5" },
  logo: { label: "Logo", aspect: "logo", width: 1530, height: 600, portal: "Logo-Kachel 2.55:1", mobile: "Mobile Logo-Kachel 2.55:1" },
  thumb: { label: "Thumbnail", aspect: "1x1", width: 1200, height: 1200, portal: "Quadratisches Thumb", mobile: "Mobile Thumb 1:1" }
};

function mediaUsagePreset(type = "upload") {
  return mediaUsagePresets[type] || mediaUsagePresets.upload;
}

function mediaPresetSummary(type = "upload") {
  const preset = mediaUsagePreset(type);
  return `${preset.aspect} · ${preset.width} x ${preset.height}px · ${preset.portal} · ${preset.mobile}`;
}

function lastMediaAssetId() {
  try {
    return localStorage.getItem(lastMediaAssetKey) || "";
  } catch {
    return "";
  }
}

function localCmsAccessBypass() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function protect(content) {
  if (localCmsAccessBypass()) return content;
  const user = currentUser();
  if (!canUseCms(user)) {
    if (user) {
      return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">CMS-Zugriff fehlt</p><h1>Benutzer nicht freigeschaltet</h1><p style="margin:14px 0 18px">Sie sind angemeldet als <strong>${escapeHtml(user.email || user.displayName || user.uid || "Benutzer")}</strong>, erkannte Rolle: <strong>${escapeHtml(user.role || "guest")}</strong>.</p><p style="margin:0 0 24px">Fuer die Mediathek braucht der Firestore-Eintrag <code>users/${escapeHtml(user.uid || "")}</code> die Rolle <code>admin</code> oder <code>editor</code> und den Status <code>active</code>.</p><div class="actions"><button id="bootstrap-admin-button" class="button button--primary" type="button">Als ersten Admin freischalten</button><button id="logout-button" class="button button--secondary" type="button">Abmelden</button><a class="button button--secondary" href="#/portal">Freischaltung anzeigen</a></div><div id="bootstrap-admin-result"></div></div></section>`;
    }
    const returnTo = encodeURIComponent(window.location.hash || "#/cms/media/library");
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Zugriff geschuetzt</p><h1>CMS-Login erforderlich</h1><p style="margin:14px 0 24px">Dieser Bereich steht Administratoren und Redakteuren zur Verfuegung.</p><div class="actions"><a class="button button--primary" href="#/login?returnTo=${returnTo}">Anmelden</a>${user ? `<button id="logout-button" class="button button--secondary" type="button">Abmelden</button>` : ""}</div></div></section>`;
  }
  return content;
}

function mediaTabs(active) {
  return `<nav class="ai-editorial-tabs media-tabs">${mediaSections.map(([key, label]) => `<a href="#/cms/media/${key}" class="${active === key ? "active" : ""}">${escapeHtml(label)}</a>`).join("")}</nav>`;
}

function mediaThumb(asset = {}) {
  const url = mediaUrl(asset);
  return url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}">`
    : `<span>${escapeHtml((asset.media_type || "Bild").slice(0, 2).toUpperCase())}</span>`;
}

function usableMediaUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:|data:image\/|blob:|\/)/i.test(text)) return text;
  if (/^assets\//i.test(text)) return `/${text}`;
  return "";
}

function mediaUrlCandidates(asset = {}) {
  return [
    asset.file_path_thumb_url,
    asset.file_path_web_url,
    asset.file_path_original_url,
    asset.imageUrl,
    asset.assetUrl,
    asset.fileUrl,
    asset.url,
    asset.downloadUrl,
    asset.thumbnail_url,
    asset.thumbnailUrl,
    asset.file_url,
    asset.original_url,
    asset.web_url,
    asset.thumb_url,
    asset.file_path_thumb,
    asset.file_path_web,
    asset.file_path_original
  ].map(usableMediaUrl).filter(Boolean);
}

function mediaUrl(asset = {}) {
  return mediaUrlCandidates(asset)[0] || "";
}

function mediaPreviewUrl(asset = {}) {
  return [
    asset.file_path_original_url,
    asset.file_path_web_url,
    asset.imageUrl,
    asset.assetUrl,
    asset.fileUrl,
    asset.url,
    asset.downloadUrl,
    asset.file_path_thumb_url,
    asset.thumbnail_url,
    asset.thumbnailUrl,
    asset.file_path_original,
    asset.file_path_web,
    asset.file_path_thumb
  ].map(usableMediaUrl).find(Boolean) || "";
}

function mediaEditorUrl(asset = {}) {
  return [
    asset.file_path_original_url,
    asset.file_path_web_url,
    asset.imageUrl,
    asset.assetUrl,
    asset.fileUrl,
    asset.url,
    asset.downloadUrl,
    asset.file_path_thumb_url,
    asset.file_path_web,
    asset.file_path_original,
    asset.file_path_thumb,
    asset.thumbnail_url,
    asset.thumbnailUrl
  ].map(usableMediaUrl).find(Boolean) || "";
}

function mediaUrlValues(asset = {}) {
  return mediaUrlCandidates(asset);
}

function normalizedMediaUrl(value = "") {
  const text = usableMediaUrl(value);
  if (!text) return "";
  const withoutHost = text.replace(/^https?:\/\/[^/]+/i, "");
  const clean = withoutHost.split("?")[0];
  try {
    return decodeURIComponent(clean).replace(/\\/g, "/").toLowerCase();
  } catch {
    return clean.replace(/\\/g, "/").toLowerCase();
  }
}

function mediaAssetLinkedEvent(asset = {}, events = []) {
  if (!asset?.id) return null;
  const assetUrls = mediaUrlValues(asset).map(normalizedMediaUrl).filter(Boolean);
  return events.find((event) => {
    const eventAssetIds = [
      event.thumbnail_media_asset_id,
      event.mediaAssetId,
      event.media_asset_id
    ].filter(Boolean);
    if (eventAssetIds.includes(asset.id)) return true;
    const eventUrls = [
      event.imageUrl,
      event.thumbnail_url,
      event.thumbnailUrl,
      event.assetUrl
    ].map(normalizedMediaUrl).filter(Boolean);
    return eventUrls.some((eventUrl) => assetUrls.includes(eventUrl));
  }) || null;
}

function mediaAssetSourceGroup(asset = {}) {
  const values = mediaUrlValues(asset).join(" ");
  if (asset.source_type === "ai") return "ai";
  if (asset.source_type === "edited") return "edited";
  if (/assets%2Fofficial|assets\/official/i.test(values)) return "official";
  return "upload";
}

function mediaSourceOptions(selected = "upload") {
  return Object.entries(mediaSourceLabels).map(([key, label]) => `<option value="${key}" ${selected === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function mediaAssetFileName(asset = {}) {
  const url = mediaUrl(asset);
  const clean = url ? decodeURIComponent(String(url).split("?")[0]).replace(/\\/g, "/") : "";
  const urlName = clean.split("/").filter(Boolean).pop()?.toLowerCase() || "";
  if (mediaAssetSourceGroup(asset) === "official" && urlName) return urlName;
  const explicit = asset.filename_web || asset.filename_original || asset.original_filename || asset.filename_thumb || "";
  return String(explicit || urlName || "").toLowerCase();
}

function mediaTypeFromLinkedRecord(entry = {}) {
  const collection = entry.collection || "";
  if (collection === "topics") return "topic";
  if (collection === "events" || collection === "eventMedia" || entry.page === "events") return "event";
  if (collection === "members") return "logo";
  if (collection === "boardMembers") return "board";
  if (collection === "speakers") return "person";
  if (collection === "sponsors") return "logo";
  if (collection === "editorialContent") {
    if (entry.page === "news" || entry.section === "news" || entry.publication_target === "news") return "news";
    if (entry.page === "press" || entry.section === "press" || entry.section === "pressRelease" || entry.publication_target === "archive") return "article";
  }
  return "";
}

function inferredMediaType(asset = {}, usedIn = []) {
  const current = asset.media_type || "upload";
  const linkedType = [
    mediaTypeFromLinkedRecord({
      collection: asset.target_collection || asset.linked_collection,
      id: asset.target_id || asset.linked_record_id,
      page: asset.target_page || asset.linked_page || asset.page,
      section: asset.target_section || asset.linked_section || asset.section,
      publication_target: asset.publication_target
    }),
    ...usedIn.map(mediaTypeFromLinkedRecord)
  ].find(Boolean);
  if (linkedType && ["upload", "thumb", "thumbnail", "ai", "article", "person"].includes(current)) return linkedType;
  if (current !== "upload") return current;
  const values = mediaUrlValues(asset).join(" ");
  if (/assets(?:%2F|\/)official(?:%2F|\/)members/i.test(values)) return "logo";
  if (/assets(?:%2F|\/)official(?:%2F|\/)board/i.test(values)) return "board";
  if (/assets(?:%2F|\/)official(?:%2F|\/)events/i.test(values)) return "event";
  if (/assets(?:%2F|\/)official(?:%2F|\/)topics/i.test(values)) return "topic";
  if (/assets(?:%2F|\/)official(?:%2F|\/)news/i.test(values)) return "news";
  return current;
}

function uniqueMediaAssets(assets = []) {
  const seen = new Set();
  return assets.filter((asset) => {
    const fileName = mediaAssetFileName(asset);
    const key = [
      String(asset.title || "").trim().toLowerCase(),
      fileName,
      mediaAssetSourceGroup(asset)
    ].join("|");
    if (!fileName || !asset.title) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mediaAssetSortValue(asset = {}) {
  return String(asset.created_at || asset.createdAt || asset.updated_at || asset.updatedAt || asset.file_last_modified || asset.id || "");
}

function newestMediaAssetsFirst(assets = []) {
  return assets.slice().sort((a, b) =>
    mediaAssetSortValue(b).localeCompare(mediaAssetSortValue(a)) || String(b.id || "").localeCompare(String(a.id || ""))
  );
}

function mediaMemberAccessBlocked(member = {}, now = new Date()) {
  if (!["inactive", "cancelled"].includes(member.membershipAccessStatus)) return false;
  const effective = member.membershipAccessEffectiveAt;
  if (!effective) return true;
  const effectiveDate = effective.seconds ? new Date(effective.seconds * 1000) : new Date(effective);
  return !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= now;
}

function mediaMemberIsCurrent(member = {}) {
  const status = String(member.status || "active").toLowerCase();
  const accessStatus = String(member.membershipAccessStatus || "active").toLowerCase();
  return !["inactive", "cancelled", "archived", "deleted"].includes(status)
    && !["inactive", "cancelled", "archived", "deleted"].includes(accessStatus)
    && !mediaMemberAccessBlocked(member);
}

function mediaMemberIsFormer(member = {}) {
  const status = String(member.status || "").toLowerCase();
  const accessStatus = String(member.membershipAccessStatus || "").toLowerCase();
  return ["inactive", "cancelled", "archived", "deleted"].includes(status)
    || ["inactive", "cancelled", "archived", "deleted"].includes(accessStatus)
    || mediaMemberAccessBlocked(member);
}

function mediaPreferredMemberLogoAsset(member = {}, assets = []) {
  const directIds = [member.logo_media_asset_id, member.logoMediaAssetId, member.thumbnail_media_asset_id, member.mediaAssetId, member.media_asset_id].filter(Boolean);
  const logoUrl = member.logoUrl || "";
  return assets
    .filter((asset) => {
      const urls = [asset.file_path_web_url, asset.file_path_thumb_url, asset.file_path_original_url, asset.imageUrl, asset.assetUrl].filter(Boolean);
      return directIds.includes(asset.id)
        || (asset.target_collection === "members" && asset.target_id === member.id && (asset.target_field || "logoUrl") === "logoUrl")
        || (asset.targetCollection === "members" && asset.targetId === member.id && (asset.targetField || "logoUrl") === "logoUrl")
        || (asset.linked_collection === "members" && asset.linked_record_id === member.id && (asset.linked_field || "logoUrl") === "logoUrl")
        || (asset.linkedCollection === "members" && asset.linkedRecordId === member.id && (asset.linkedField || "logoUrl") === "logoUrl")
        || (logoUrl && urls.includes(logoUrl));
    })
    .filter((asset) => mediaUrl(asset))
    .sort((a, b) => {
      const score = (asset = {}) => [
        directIds.includes(asset.id) ? "5" : "0",
        asset.target_collection === "members" && asset.target_id === member.id && (asset.target_field || "logoUrl") === "logoUrl" ? "4" : "0",
        asset.targetCollection === "members" && asset.targetId === member.id && (asset.targetField || "logoUrl") === "logoUrl" ? "4" : "0",
        asset.linked_collection === "members" && asset.linked_record_id === member.id && (asset.linked_field || "logoUrl") === "logoUrl" ? "3" : "0",
        asset.linkedCollection === "members" && asset.linkedRecordId === member.id && (asset.linkedField || "logoUrl") === "logoUrl" ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.status === "active" ? "2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function mediaAssetMatchesMemberLogo(asset = {}, member = {}) {
  if (!asset?.id || !member?.id) return false;
  const directIds = [
    member.logo_media_asset_id,
    member.logoMediaAssetId,
    member.thumbnail_media_asset_id,
    member.mediaAssetId,
    member.media_asset_id
  ].filter(Boolean);
  if (directIds.includes(asset.id)) return true;
  const targetCollection = asset.target_collection || asset.targetCollection || "";
  const targetId = asset.target_id || asset.targetId || "";
  const targetField = asset.target_field || asset.targetField || "";
  const linkedCollection = asset.linked_collection || asset.linkedCollection || "";
  const linkedRecordId = asset.linked_record_id || asset.linkedRecordId || "";
  const linkedField = asset.linked_field || asset.linkedField || "";
  if (targetCollection === "members" && targetId === member.id && (!targetField || targetField === "logoUrl")) return true;
  if (linkedCollection === "members" && linkedRecordId === member.id && (!linkedField || linkedField === "logoUrl")) return true;
  const assetUrls = mediaUrlValues(asset).map(normalizedMediaUrl).filter(Boolean);
  const memberUrls = [
    member.logoUrl,
    member.imageUrl,
    member.thumbnail_url,
    member.thumbnailUrl,
    member.assetUrl
  ].map(normalizedMediaUrl).filter(Boolean);
  return memberUrls.some((url) => assetUrls.includes(url));
}

function memberLogoVirtualAssets(members = [], assets = []) {
  const existingKeys = new Set(assets.flatMap((asset) => [
    asset.id,
    ...mediaUrlValues(asset).map(normalizedMediaUrl)
  ].filter(Boolean)));
  return members
    .filter((member) => mediaMemberIsCurrent(member))
    .map((member) => {
      const logoUrl = member.logoUrl || member.logoDisplayUrl || member.imageUrl || "";
      if (!logoUrl) return null;
      const normalizedUrl = normalizedMediaUrl(logoUrl);
      const id = `member-logo-${member.id}`;
      if (existingKeys.has(id) || existingKeys.has(normalizedUrl)) return null;
      return {
        id,
        title: member.name || member.title || member.id,
        alt_text: `Logo ${member.name || member.title || member.id}`,
        description: member.description || "",
        media_type: "logo",
        source_type: "official",
        source_note: "Aktuelles Mitgliederlogo aus der Mitgliederverwaltung.",
        aspect_ratio: "logo",
        status: "active",
        visibility: "public",
        imageUrl: logoUrl,
        file_path_original_url: logoUrl,
        file_path_web_url: logoUrl,
        file_path_thumb_url: logoUrl,
        filename_original: logoUrl.split("/").pop() || `${member.id}.png`,
        filename_web: logoUrl.split("/").pop() || `${member.id}.png`,
        target_collection: "members",
        target_id: member.id,
        target_field: "logoUrl",
        target_title: member.name || member.title || member.id,
        linked_collection: "members",
        linked_record_id: member.id,
        linked_field: "logoUrl",
        linked_title: member.name || member.title || member.id,
        created_at: member.updatedAt || member.createdAt || "2026-06-18T00:00:00.000Z",
        updated_at: member.updatedAt || member.createdAt || "2026-06-18T00:00:00.000Z",
        virtual_asset: true
      };
    })
    .filter(Boolean);
}

function mediaAspectStyle(format = "16x9") {
  const clean = String(format || "16x9").toLowerCase();
  if (clean === "1x1") return "1 / 1";
  if (clean === "4x5") return "4 / 5";
  if (clean === "logo") return "2.55 / 1";
  if (clean === "4x3") return "4 / 3";
  if (clean === "9x16") return "9 / 16";
  if (clean === "portrait" || clean === "hochkant") return "9 / 16";
  if (clean === "landscape") return "16 / 9";
  return "16 / 9";
}

function mediaFormatFromDimensions(width = 0, height = 0) {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (!w || !h) return "";
  const ratio = w / h;
  const candidates = [
    ["16x9", 16 / 9],
    ["4x3", 4 / 3],
    ["1x1", 1],
    ["4x5", 4 / 5],
    ["9x16", 9 / 16]
  ];
  return candidates
    .map(([format, target]) => ({ format, distance: Math.abs(ratio - target) }))
    .sort((a, b) => a.distance - b.distance)[0]?.format || "";
}

function mediaDisplayAspect(asset = {}, usedIn = []) {
  const type = inferredMediaType(asset, usedIn);
  return asset.usage_preset_ratio
    || mediaUsagePreset(type).aspect
    || mediaFormatFromDimensions(asset.image_width, asset.image_height)
    || asset.detected_aspect_ratio
    || asset.aspect_ratio
    || "16x9";
}

function mediaFormatOptions(selected = "16x9") {
  return ["16x9", "4x3", "1x1", "4x5", "9x16"].map((format) => `<option value="${format}" ${selected === format ? "selected" : ""}>${format}</option>`).join("");
}

function mediaContextQuery(query = new URLSearchParams()) {
  const allowed = ["targetCollection", "targetId", "targetField", "targetAltField", "returnTo"];
  const params = new URLSearchParams();
  allowed.forEach((key) => {
    const value = query.get(key);
    if (value) params.set(key, value);
  });
  const text = params.toString();
  return text ? `&${text}` : "";
}

function mediaContextAttrs(query = new URLSearchParams()) {
  return [
    ["data-media-target-collection", query.get("targetCollection")],
    ["data-media-target-id", query.get("targetId")],
    ["data-media-target-field", query.get("targetField") || "imageUrl"],
    ["data-media-target-alt-field", query.get("targetAltField")],
    ["data-media-return-to", query.get("returnTo")]
  ].filter(([, value]) => value).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(" ");
}

function inferredMediaContext(asset = {}, query = new URLSearchParams(), inferredTarget = null) {
  const linkedCollection = inferredTarget?.collection || asset.linked_collection || asset.target_collection || "";
  const linkedId = inferredTarget?.id || asset.linked_record_id || asset.target_id || "";
  const collection = query.get("targetCollection") || linkedCollection;
  const id = query.get("targetId") || linkedId;
  const field = collection === "members"
    ? "logoUrl"
    : query.get("targetField") || asset.linked_field || asset.target_field || inferredTarget?.field || "imageUrl";
  const returnTo = query.get("returnTo")
    || (collection === "members" && id ? `#/cms/edit?module=members&id=${id}&section=all` : "")
    || (collection === "events" && id ? `#/cms/event/${id}?tab=base` : "");
  const params = new URLSearchParams(query);
  if (collection) params.set("targetCollection", collection);
  if (id) params.set("targetId", id);
  if (field) params.set("targetField", field);
  if (!params.get("targetAltField") && collection === "members") params.set("targetAltField", "altText");
  if (returnTo) params.set("returnTo", returnTo);
  return params;
}

function linkedMediaActions({ collection = "", id = "", field = "imageUrl", altField = "thumbnail_alt", returnTo = "" } = {}) {
  if (!collection || !id) return "";
  const params = new URLSearchParams({
    targetCollection: collection,
    targetId: id,
    targetField: field,
    targetAltField: altField,
    returnTo
  });
  return `<div class="linked-media-actions">
    <a class="button button--secondary button--small" href="#/cms/media/library?${params.toString()}">Thumb aus Mediathek waehlen</a>
    <a class="button button--secondary button--small" href="#/cms/media/ai?${params.toString()}">Thumb erstellen</a>
  </div>`;
}

function mediaPortalVariantButtons(active = "16x9") {
  const variants = [
    ["news", "News", "16 / 9", "16x9", "16:9", "wide"],
    ["landscape", "Landscape", "16 / 9", "landscape", "16:9", "wide"],
    ["portrait", "Hochkant", "9 / 16", "portrait", "9:16", "portrait"],
    ["board", "Vorstand", "1 / 1", "1x1", "1:1", "square"],
    ["logo", "Logo", "2.55 / 1", "logo", "2.55:1", "logo"]
  ];
  return `<div class="media-format-buttons" aria-label="Portalvarianten">${variants.map(([type, label, aspect, format, ratio, shape]) => {
    const isActive = active === format;
    return `<button class="media-format-button media-format-button--${shape} ${isActive ? "is-active" : ""}" type="button" data-media-variant-button="${type}" data-media-variant-aspect="${aspect}" data-media-variant-format="${format}" aria-pressed="${isActive ? "true" : "false"}"><i aria-hidden="true"></i><strong>${escapeHtml(label)}</strong><span>${escapeHtml(ratio)}</span></button>`;
  }).join("")}</div>`;
}

function mediaVariantUrl(variant = {}) {
  return variant.url || variant.file_url || variant.file_path_url || variant.file_path_thumb_url || variant.file_path_web_url || variant.file_path_original_url || "";
}

function mediaVariantChooser(asset = {}, variants = [], assets = []) {
  const duplicateOriginalTypes = new Set(["original"]);
  const variantKey = (variant = {}) => [
    variant.derived_media_asset_id || variant.id || "",
    variant.variant_type || variant.media_type || "",
    variant.format || variant.aspect_ratio || "",
    variant.filename || variant.filename_web || variant.filename_original || "",
    mediaVariantUrl(variant)
  ].join("|");
  const derivedAssets = assets
    .filter((item) => item.parent_media_asset_id === asset.id && mediaVariantUrl(item))
    .map((item) => ({
      id: item.id,
      variant_type: item.media_type || item.usage_preset || "edited",
      variant_label: item.title || mediaTypeLabels[item.media_type] || "Variante",
      format: item.aspect_ratio || item.usage_preset_ratio || mediaDisplayAspect(item),
      filename: item.filename_web || item.filename_original || item.original_filename || "",
      version: item.version || "v1",
      created_at: item.created_at || item.createdAt || item.updated_at || item.updatedAt || "",
      url: mediaVariantUrl(item)
    }));
  const derivedById = new Map(assets.filter((item) => item.id).map((item) => [item.id, item]));
  const relatedVariants = [...variants
    .filter((variant) => variant.media_asset_id === asset.id && !duplicateOriginalTypes.has(String(variant.variant_type || "").toLowerCase()))
    .map((variant) => {
      const derived = variant.derived_media_asset_id ? derivedById.get(variant.derived_media_asset_id) : null;
      return {
        ...variant,
        url: mediaVariantUrl(variant) || mediaVariantUrl(derived || {})
      };
    })
    .filter((variant) => mediaVariantUrl(variant)), ...derivedAssets]
    .filter((variant, index, items) => {
      const key = variantKey(variant);
      return items.findIndex((item) => variantKey(item) === key) === index;
    })
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  if (!relatedVariants.length) return "";
  const originalUrl = mediaPreviewUrl(asset) || mediaUrl(asset);
  const original = originalUrl
    ? `<button class="media-variant-choice is-active" type="button" data-media-load-variant data-media-variant-src="${escapeHtml(originalUrl)}" data-media-variant-format="${escapeHtml(asset.aspect_ratio || mediaDisplayAspect(asset) || "16x9")}" aria-pressed="true"><img src="${escapeHtml(originalUrl)}" alt=""><span><strong>Original</strong><small>${escapeHtml(asset.filename_original || asset.filename_web || "Ausgangsbild")}</small></span></button>`
    : "";
  const options = relatedVariants.map((variant) => {
    const label = variant.variant_label || mediaTypeLabels[variant.variant_type] || variant.variant_type || "Variante";
    const format = variant.format || asset.aspect_ratio || mediaDisplayAspect(asset) || "16x9";
    const url = mediaVariantUrl(variant);
    return `<button class="media-variant-choice" type="button" data-media-load-variant data-media-variant-src="${escapeHtml(url)}" data-media-variant-format="${escapeHtml(format)}" aria-pressed="false"><img src="${escapeHtml(url)}" alt=""><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml([format, variant.version, variant.filename].filter(Boolean).join(" · "))}</small></span></button>`;
  }).join("");
  return `<div class="media-editor-variants"><p>Varianten</p><div>${original}${options}</div></div>`;
}

function mediaTypeOptions(selected = "upload") {
  return Object.entries(mediaTypeLabels).map(([key, label]) => `<option value="${key}" ${selected === key ? "selected" : ""}>${label}</option>`).join("");
}

function mediaCreateChoice(active = "upload") {
  return `<div class="media-create-choice" aria-label="Bild erstellen">
    <a class="${active === "upload" ? "active" : ""}" href="#/cms/media/upload"><strong>Bild hochladen</strong><span>Lokale Datei speichern und weiterbearbeiten</span></a>
    <a class="${active === "ai" ? "active" : ""}" href="#/cms/media/ai"><strong>KI generieren</strong><span>Prompt anlegen und als Bildentwurf bearbeiten</span></a>
  </div>`;
}

function mediaTrashIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm3 2v8h2v-8H9Zm4 0v8h2v-8h-2Z"></path></svg>`;
}

function mediaInfoIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 10h2v8h-2v-8Zm0-4h2v2h-2V6Zm1-4a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"></path></svg>`;
}

function mediaEditIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16.9 3.6 20.4 7 8.7 18.7 4 20l1.3-4.7L16.9 3.6Zm1.4-1.4a1.6 1.6 0 0 1 2.2 0l1.3 1.3a1.6 1.6 0 0 1 0 2.2l-.8.8-3.5-3.5.8-.8Z"></path></svg>`;
}

function mediaEyeIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5c5 0 8.6 4.2 10 7-1.4 2.8-5 7-10 7s-8.6-4.2-10-7c1.4-2.8 5-7 10-7Zm0 2C8.8 7 6.2 9.3 4.3 12c1.9 2.7 4.5 5 7.7 5s5.8-2.3 7.7-5C17.8 9.3 15.2 7 12 7Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z"></path></svg>`;
}

function mediaEyeOffIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3.3 2 18.7 18.7-1.3 1.3-3.2-3.2A10.6 10.6 0 0 1 12 20c-5 0-8.6-4.2-10-7a15.3 15.3 0 0 1 4-4.9L2 3.3 3.3 2Zm4.1 7.5A13 13 0 0 0 4.3 13c1.9 2.7 4.5 5 7.7 5 1.5 0 2.9-.5 4.2-1.3l-2-2a2.8 2.8 0 0 1-3.9-3.9L7.4 9.5ZM12 6c5 0 8.6 4.2 10 7a15.8 15.8 0 0 1-2.9 4l-1.4-1.4a13.5 13.5 0 0 0 2-2.6c-1.9-2.7-4.5-5-7.7-5-1 0-2 .2-2.9.7L7.6 7.2A10.5 10.5 0 0 1 12 6Zm2.8 7.1-3.9-3.9A2.8 2.8 0 0 1 14.8 13.1Z"></path></svg>`;
}

function mediaPlayIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7L8 5Z"></path></svg>`;
}

function mediaRestoreIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5a7 7 0 1 1-6.4 4.2H3l4-4 4 4H8a5 5 0 1 0 4-2V5Zm-1 4h2v4.2l3 1.8-1 1.7-4-2.4V9Z"></path></svg>`;
}

function mediaFullscreenIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 4h7v2H7.4l4.3 4.3-1.4 1.4L6 7.4V11H4V4Zm9 0h7v7h-2V7.4l-4.3 4.3-1.4-1.4L16.6 6H13V4ZM4 13h2v3.6l4.3-4.3 1.4 1.4L7.4 18H11v2H4v-7Zm14 0h2v7h-7v-2h3.6l-4.3-4.3 1.4-1.4 4.3 4.3V13Z"></path></svg>`;
}

function assetDate(asset = {}) {
  const value = asset.updated_at || asset.created_at || "";
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("de-DE");
}

function mediaMetadataBox(asset = {}) {
  const rows = [
    ["Bild-ID", asset.media_code ? `ID ${asset.media_code}` : ""],
    ["Datei", asset.filename_web || asset.filename_original || asset.original_filename || ""],
    ["Original", asset.original_filename || ""],
    ["Format", asset.image_format || asset.mime_type || ""],
    ["Groesse", asset.file_size_label || (asset.file_size ? `${Math.round(Number(asset.file_size) / 1024)} KB` : "")],
    ["Pixel", asset.image_width && asset.image_height ? `${asset.image_width} x ${asset.image_height}px` : ""],
    ["Web-Datei", asset.web_image_width && asset.web_image_height ? `${asset.web_image_width} x ${asset.web_image_height}px · ${asset.web_file_size_label || ""} · ${asset.web_codec || asset.web_mime_type || ""}` : ""],
    ["Thumb", asset.thumb_image_width && asset.thumb_image_height ? `${asset.thumb_image_width} x ${asset.thumb_image_height}px · ${asset.thumb_file_size_label || ""} · ${asset.thumb_codec || asset.thumb_mime_type || ""}` : ""],
    ["Speicherpfad", asset.file_path_web || asset.file_path_original || ""],
    ["Geaendert", assetDate(asset)]
  ].filter(([, value]) => value);
  return `<details class="media-edit-meta"><summary><strong>Metadaten</strong><span>${rows.length} Angaben</span></summary><dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></details>`;
}

function valueUsesMedia(value, assetId, urls) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value === assetId || urls.includes(value);
  if (Array.isArray(value)) return value.some((item) => valueUsesMedia(item, assetId, urls));
  if (typeof value === "object") return Object.values(value).some((item) => valueUsesMedia(item, assetId, urls));
  return false;
}

function recordUsesMedia(record = {}, asset = {}) {
  return valueUsesMedia(record, asset.id, mediaUrlValues(asset));
}

async function mediaUsageMap(assets = []) {
  const collections = ["editorialContent", "topics", "events", "members", "boardMembers", "galleries", "eventMedia", "downloads", "sponsors", "speakers"];
  const usage = new Map();
  const collectionRecords = await Promise.all(collections.map(async (collection) => {
    try {
      return [collection, await list(collection)];
    } catch {
      return [collection, []];
    }
  }));
  const recordsByCollection = Object.fromEntries(collectionRecords);
  const currentMembers = (recordsByCollection.members || []).filter(mediaMemberIsCurrent);
  const currentMemberIds = new Set(currentMembers.map((member) => member.id).filter(Boolean));
  const preferredMemberLogoIds = new Set(currentMembers
    .map((member) => mediaPreferredMemberLogoAsset(member, assets)?.id)
    .filter(Boolean));
  assets.forEach((asset) => {
    const usedIn = [];
    const targetCollection = asset.target_collection || asset.targetCollection || "";
    const targetId = asset.target_id || asset.targetId || "";
    const targetField = asset.target_field || asset.targetField || "";
    const linkedCollection = asset.linked_collection || asset.linkedCollection || "";
    const linkedRecordId = asset.linked_record_id || asset.linkedRecordId || "";
    if (targetCollection && targetId) {
      const targetRecord = (recordsByCollection[targetCollection] || []).find((record) => record.id === targetId);
      usedIn.push({
        collection: targetCollection,
        id: targetId,
        title: asset.target_title || asset.targetTitle || asset.linked_title || asset.linkedTitle || targetRecord?.title || targetRecord?.name || targetId,
        page: asset.target_page || asset.linked_page || asset.page,
        section: asset.target_section || asset.linked_section || asset.section,
        publication_target: asset.publication_target,
        field: targetField,
        actual_reference: false,
        member_former: targetCollection === "members" ? mediaMemberIsFormer(targetRecord || {}) : undefined,
        member_current: targetCollection === "members" ? mediaMemberIsCurrent(targetRecord || {}) : undefined
      });
    } else if (linkedCollection && linkedRecordId) {
      const linkedRecord = (recordsByCollection[linkedCollection] || []).find((record) => record.id === linkedRecordId);
      usedIn.push({
        collection: linkedCollection,
        id: linkedRecordId,
        title: asset.linked_title || asset.linkedTitle || linkedRecord?.title || linkedRecord?.name || linkedRecordId,
        page: asset.linked_page || asset.page,
        section: asset.linked_section || asset.section,
        publication_target: asset.publication_target,
        actual_reference: false,
        member_former: linkedCollection === "members" ? mediaMemberIsFormer(linkedRecord || {}) : undefined,
        member_current: linkedCollection === "members" ? mediaMemberIsCurrent(linkedRecord || {}) : undefined
      });
    }
    collectionRecords.forEach(([collection, records]) => {
      const match = records.find((record) => recordUsesMedia(record, asset));
      if (match && !usedIn.some((entry) => entry.collection === collection && entry.id === match.id)) {
        usedIn.push({
          collection,
          id: match.id,
          title: match.title || match.name || match.headline || match.slug || match.id,
          page: match.page,
          section: match.section,
          publication_target: match.publication_target,
          actual_reference: true,
          member_former: collection === "members" ? mediaMemberIsFormer(match) : undefined,
          member_current: collection === "members" ? mediaMemberIsCurrent(match) : undefined
        });
      } else if (match) {
        const existing = usedIn.find((entry) => entry.collection === collection && entry.id === match.id);
        if (existing) {
          existing.actual_reference = true;
          if (collection === "members") existing.member_current = mediaMemberIsCurrent(match);
          if (collection === "members") existing.member_former = mediaMemberIsFormer(match);
        }
      }
    });
    currentMembers.forEach((member) => {
      if (!mediaAssetMatchesMemberLogo(asset, member)) return;
      if (usedIn.some((entry) => entry.collection === "members" && entry.id === member.id)) return;
      usedIn.push({
        collection: "members",
        id: member.id,
        title: member.name || member.title || member.id,
        field: "logoUrl",
        actual_reference: true,
        member_current: true
      });
    });
    usage.set(asset.id, usedIn);
  });
  usage.currentMemberIds = currentMemberIds;
  usage.preferredMemberLogoIds = preferredMemberLogoIds;
  return usage;
}

function mediaUsageLabel(usedIn = []) {
  if (!usedIn.length) return "";
  const first = usedIn[0];
  const collectionLabels = {
    editorialContent: "Redaktion",
    topics: "Thema",
    events: "Event",
    members: "Mitglied",
    boardMembers: "Vorstand",
    galleries: "Galerie",
    eventMedia: "Event-Medien",
    downloads: "Download",
    sponsors: "Sponsor",
    speakers: "Referent"
  };
  const suffix = usedIn.length > 1 ? ` +${usedIn.length - 1}` : "";
  return `${collectionLabels[first.collection] || first.collection}${suffix}`;
}

function mediaCardTypeLabel(type = "") {
  const labels = {
    event: "Event",
    news: "News",
    board: "Vorstand",
    logo: "Logo",
    member: "Mitglied",
    topic: "Thema",
    article: "Artikel",
    person: "Person",
    upload: "Upload",
    ai: "KI-Grafik"
  };
  return labels[type] || mediaTypeLabels[type] || type || "Bild";
}

function mediaLogoFlags(asset = {}, usedIn = [], usageMap = new Map()) {
  if (inferredMediaType(asset, usedIn) !== "logo") return { className: "", label: "" };
  const memberUses = usedIn.filter((entry) => entry.collection === "members");
  const currentMemberIds = usageMap.currentMemberIds || new Set();
  const preferredMemberLogoIds = usageMap.preferredMemberLogoIds || new Set();
  const linkedCurrentMember = memberUses.some((entry) => entry.id && currentMemberIds.has(entry.id));
  const explicitlyFormerMember = memberUses.length > 0 && memberUses.every((entry) => entry.member_former === true);
  const title = String(asset.title || asset.filename_original || asset.original_filename || "").toLowerCase();
  const protectedActiveLogo = title.includes("flame") && title.includes("media");
  if (explicitlyFormerMember && !linkedCurrentMember && !protectedActiveLogo) {
    return { className: "media-asset-card--former-logo", label: "Ausgeschieden" };
  }
  if (linkedCurrentMember && preferredMemberLogoIds.size && !preferredMemberLogoIds.has(asset.id)) {
    return { className: "media-asset-card--duplicate-logo", label: "Doppelt" };
  }
  return { className: "", label: "" };
}

function mediaCardInfoRows(asset = {}, usedIn = []) {
  const displayType = inferredMediaType(asset, usedIn);
  const sourceGroup = mediaAssetSourceGroup(asset);
  const sourceLabel = mediaSourceLabels[sourceGroup] || sourceGroup || "Upload";
  const linkedLabel = asset.linked_title || asset.target_title || usedIn.map((item) => item.title).filter(Boolean).join(", ");
  const rows = [
    ["Datei", asset.filename_web || asset.filename_original || asset.original_filename || "-"],
    ["Quelle", sourceLabel],
    ["Preset", mediaPresetSummary(displayType)],
    ["Ratio", mediaDisplayAspect(asset, usedIn) || asset.aspect_ratio || "-"],
    ["Pixel", asset.image_width && asset.image_height ? `${asset.image_width} x ${asset.image_height}px` : "-"],
    ["Web", asset.web_image_width && asset.web_image_height ? `${asset.web_image_width} x ${asset.web_image_height}px - ${asset.web_file_size_label || ""}` : ""],
    ["Thumb", asset.thumb_image_width && asset.thumb_image_height ? `${asset.thumb_image_width} x ${asset.thumb_image_height}px - ${asset.thumb_file_size_label || ""}` : ""],
    ["Groesse", asset.file_size_label || asset.web_file_size_label || asset.thumb_file_size_label || "-"],
    ["Verwendet", linkedLabel || mediaUsageLabel(usedIn) || "Frei"],
    ["Ziel", [asset.target_collection || asset.linked_collection, asset.target_id || asset.linked_record_id].filter(Boolean).join(" / ")],
    ["Pfad", asset.file_path_web || asset.file_path_original || asset.storage_path_web || asset.storage_path_original || ""],
    ["Datum", assetDate(asset) || "-"]
  ].filter(([, value]) => value);
  return `<dl class="media-card-info-table">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

function mediaAssetCard(asset, contextQuery = "", usageMap = new Map(), options = {}) {
  const usedIn = usageMap.get(asset.id) || [];
  const isUsed = usedIn.length > 0;
  const usageLabel = mediaUsageLabel(usedIn);
  const editHref = `#/cms/media/edit?id=${encodeURIComponent(asset.id)}${contextQuery}`;
  const selectAttrs = contextQuery
    ? ` data-media-select-asset="${escapeHtml(asset.id)}"`
    : "";
  const selectButton = contextQuery
    ? `<button class="button button--primary button--small media-card-select-button" type="button" data-media-select-button="${escapeHtml(asset.id)}" data-media-select-href="${escapeHtml(editHref)}">Bild uebernehmen</button>`
    : "";
  const sourceGroup = mediaAssetSourceGroup(asset);
  const displayType = inferredMediaType(asset, usedIn);
  const isBoardImage = displayType === "board"
    || usedIn.some((entry) => entry.collection === "boardMembers")
    || asset.target_collection === "boardMembers"
    || asset.targetCollection === "boardMembers"
    || asset.linked_collection === "boardMembers"
    || asset.linkedCollection === "boardMembers";
  const titleLabel = asset.title || asset.filename_original || "Bild";
  const titleMarkup = `<h3>${escapeHtml(titleLabel)}</h3>`;
  const typeLabel = mediaCardTypeLabel(isBoardImage ? "board" : displayType);
  const logoFlag = mediaLogoFlags(asset, usedIn, usageMap);
  const typeLine = [typeLabel, logoFlag.label].filter(Boolean).join(" ? ");
  const allowTrash = !isUsed || options.trashMode || Boolean(logoFlag.className);
  return `<article class="media-asset-card ${isUsed ? "media-asset-card--used" : "media-asset-card--free"} ${logoFlag.className}" data-media-card data-media-edit-link="${editHref}"${selectAttrs} data-search="${escapeHtml([asset.title, asset.filename_original, asset.filename_web, asset.filename_thumb, asset.tags, asset.description, logoFlag.label].flat().filter(Boolean).join(" ").toLowerCase())}" data-source="${escapeHtml(sourceGroup)}" data-type="${escapeHtml(displayType)}" data-format="${escapeHtml(asset.aspect_ratio || "")}" tabindex="0" role="button" aria-label="${escapeHtml(asset.title || asset.filename_original || "Bild")} ${contextQuery ? "auswaehlen" : "bearbeiten"}">
      <figure style="--media-card-aspect:${mediaAspectStyle(mediaDisplayAspect(asset, usedIn))}">
        <a class="media-card-edit-picto" href="${editHref}" title="Bild bearbeiten" aria-label="Bild bearbeiten">${mediaEditIcon()}</a>
        ${mediaThumb(asset)}
      </figure>
        <div class="media-asset-card__body">
        <div class="media-asset-card__title-row">
          <div>
            ${titleMarkup}
          </div>
        </div>
        <div class="media-card-type-row">
          <span>${escapeHtml(typeLine)}</span>
          <div class="media-card-actions-top">
            <details class="media-card-info">
              <summary class="media-card-info-picto" title="Bildinformationen" aria-label="Bildinformationen">${mediaInfoIcon()}</summary>
              <div class="media-card-info-panel">
                ${mediaCardInfoRows(asset, usedIn)}
                <div class="media-asset-card__meta">${asset.media_code ? `<span class="media-code">ID ${escapeHtml(asset.media_code)}</span>` : ""}<span>${escapeHtml(mediaTypeLabels[displayType] || displayType || "Bild")}</span><span>${escapeHtml(mediaDisplayAspect(asset, usedIn) || "-")}</span>${asset.image_width && asset.image_height ? `<span>${escapeHtml(`${asset.image_width} x ${asset.image_height}px`)}</span>` : ""}${asset.file_size_label ? `<span>${escapeHtml(asset.file_size_label)}</span>` : ""}${assetDate(asset) ? `<span>${escapeHtml(assetDate(asset))}</span>` : ""}</div>
              </div>
            </details>
            ${allowTrash ? `<button class="media-trash-button" type="button" data-media-delete="${escapeHtml(asset.id)}" data-media-delete-mode="${options.trashMode ? "permanent" : "trash"}" data-media-title="${escapeHtml(titleLabel)}" title="${options.trashMode ? "Endgueltig loeschen" : "In den Papierkorb verschieben"}" aria-label="${options.trashMode ? "Bild endgueltig loeschen" : "Bild in den Papierkorb verschieben"}">${mediaTrashIcon()}</button>` : ""}
          </div>
        </div>
        ${selectButton}
      </div>
    </article>`;
}

function lastEventEditorTarget(events = []) {
  try {
    const id = sessionStorage.getItem("pdt-last-event-editor-id") || "";
    const at = Number(sessionStorage.getItem("pdt-last-event-editor-at") || 0);
    if (!id || !at || Date.now() - at > 1000 * 60 * 60) return null;
    const event = events.find((item) => item.id === id);
    return event ? { collection: "events", id: event.id, field: "imageUrl" } : null;
  } catch {
    return null;
  }
}

function eventTargetOptions(events = [], selectedId = "") {
  return [`<option value="">Kein Event ausgewaehlt</option>`, ...events
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map((event) => `<option value="${escapeHtml(event.id)}" ${event.id === selectedId ? "selected" : ""}>${escapeHtml([event.date, event.title].filter(Boolean).join(" - "))}</option>`)]
    .join("");
}

function mediaTypeFilterOptions(assets = [], usageMap = new Map()) {
  const types = [...new Set(assets
    .map((asset) => inferredMediaType(asset, usageMap.get(asset.id) || []))
    .filter(Boolean))]
    .sort((a, b) => String(mediaTypeLabels[a] || a).localeCompare(String(mediaTypeLabels[b] || b), "de"));
  return [`<option value="">Alle</option>`, ...types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(mediaTypeLabels[type] || type)}</option>`)].join("");
}

function mediaSourceFilterOptions(assets = []) {
  const sources = [...new Set(assets.map(mediaAssetSourceGroup).filter(Boolean))]
    .sort((a, b) => String(mediaSourceLabels[a] || a).localeCompare(String(mediaSourceLabels[b] || b), "de"));
  return [`<option value="">Alle</option>`, ...sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(mediaSourceLabels[source] || source)}</option>`)].join("");
}

function mediaAssetVisibleInLibrary(asset = {}, usageMap = new Map()) {
  if (asset.status === "archived") return false;
  const usedIn = usageMap.get(asset.id) || [];
  if (inferredMediaType(asset, usedIn) === "logo") return true;
  const memberIds = new Set([
    asset.target_collection === "members" ? asset.target_id : "",
    asset.targetCollection === "members" ? asset.targetId : "",
    asset.linked_collection === "members" ? asset.linked_record_id : "",
    asset.linkedCollection === "members" ? asset.linkedRecordId : "",
    ...usedIn.filter((entry) => entry.collection === "members").map((entry) => entry.id)
  ].filter(Boolean));
  if (memberIds.size) {
    const currentMemberIds = usageMap.currentMemberIds || new Set();
    const belongsToCurrentMember = Array.from(memberIds).some((id) => currentMemberIds.has(id));
    if (!belongsToCurrentMember) return false;
    return true;
  }
  if (!asset.parent_media_asset_id) return true;
  return Boolean(usedIn.length || asset.target_collection || asset.linked_collection);
}

function trashAssetRow(asset = {}, usageMap = new Map()) {
  const usedIn = usageMap.get(asset.id) || [];
  const displayType = inferredMediaType(asset, usedIn);
  const title = asset.title || asset.filename_original || asset.original_filename || "Bild";
  const date = asset.deleted_at || asset.archivedAt || asset.updated_at || asset.updatedAt || "";
  const reason = asset.trash_reason || "Papierkorb";
  const linked = asset.linked_title || asset.target_title || mediaUsageLabel(usedIn) || [asset.linked_collection || asset.target_collection, asset.linked_record_id || asset.target_id].filter(Boolean).join(" / ") || "-";
  const dataSearch = [title, asset.filename_original, asset.filename_web, asset.tags, reason, linked].flat().filter(Boolean).join(" ").toLowerCase();
  return `<article class="media-trash-item" data-media-card data-search="${escapeHtml(dataSearch)}" data-type="${escapeHtml(displayType)}" data-format="${escapeHtml(asset.aspect_ratio || "")}">
    <figure class="media-trash-item__thumb">${mediaThumb(asset)}</figure>
    <div class="media-trash-item__body">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(asset.filename_web || asset.filename_original || asset.original_filename || asset.id)}</small>
      </div>
      <span>${escapeHtml(mediaTypeLabels[displayType] || displayType || "Bild")}</span>
      <span>${escapeHtml(reason)}${date ? ` ? ${escapeHtml(assetDate({ updated_at: date }))}` : ""}</span>
      <span>${escapeHtml(linked)}</span>
    </div>
    <div class="media-trash-item__actions">
      <button class="media-video-icon-button media-video-icon-button--visible" type="button" data-media-restore="${escapeHtml(asset.id)}" data-media-title="${escapeHtml(title)}" title="Wiederherstellen" aria-label="Bild wiederherstellen">${mediaRestoreIcon()}</button>
      <button class="media-video-icon-button media-video-icon-button--danger" type="button" data-media-delete="${escapeHtml(asset.id)}" data-media-delete-mode="permanent" data-media-title="${escapeHtml(title)}" title="Endgueltig loeschen" aria-label="Bild endgueltig loeschen">${mediaTrashIcon()}</button>
    </div>
  </article>`;
}

function libraryPage(assets = [], query = new URLSearchParams(), usageMap = new Map()) {
  const trashMode = query.get("trash") === "1";
  const visibleAssets = newestMediaAssetsFirst(uniqueMediaAssets(assets.filter((asset) => trashMode ? asset.status === "archived" : mediaAssetVisibleInLibrary(asset, usageMap))));
  const contextQuery = mediaContextQuery(query);
  if (trashMode) {
    const stats = visibleAssets.reduce((acc, asset) => {
      const type = inferredMediaType(asset, usageMap.get(asset.id) || []) || "Bild";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const statLine = Object.entries(stats).map(([type, count]) => `<span>${escapeHtml(mediaTypeLabels[type] || type)}: <strong>${count}</strong></span>`).join("");
    return `<section class="panel media-trash-tool">
      <div class="media-trash-tool__head">
        <div>
          <p class="eyebrow">Papierkorb</p>
          <h2>Geloeschte Bilder</h2>
          <p class="muted">Gel?schte Bilder koennen wiederhergestellt oder endgueltig entfernt werden.</p>
        </div>
        <a class="button button--secondary" href="#/cms/media/library">Zurueck zu Bilder</a>
      </div>
      <div class="media-trash-tool__stats">
        <span>Gesamt: <strong>${visibleAssets.length}</strong></span>
        ${statLine}
      </div>
      <div class="media-trash-toolbar">
        <div class="field"><label>Suche</label><input data-media-search placeholder="Titel, Datei, Schlagwort"></div>
        <div class="field"><label>Format</label><select data-media-filter="format"><option value="">Alle</option><option value="16x9">16x9</option><option value="4x3">4x3</option><option value="1x1">1x1</option><option value="4x5">4x5</option><option value="9x16">9x16</option></select></div>
        <div class="field"><label>Zuordnung</label><select data-media-filter="type">${mediaTypeFilterOptions(visibleAssets, usageMap)}</select></div>
      </div>
      <div class="media-trash-list">${visibleAssets.length ? visibleAssets.map((asset) => trashAssetRow(asset, usageMap)).join("") : `<div class="alert">Papierkorb ist leer.</div>`}</div>
      <div id="media-trash-result"></div>
    </section>`;
  }
  return `<section class="panel media-library-panel">
    <div class="media-library-layout">
      <aside class="media-library-sidebar">
        <form id="central-media-upload-form" class="media-library-upload" data-media-upload-form tabindex="0" aria-label="Bild per Upload oder Einfuegen speichern" ${mediaContextAttrs(query)}>
          <label class="button button--primary button--small">
            Datei hochladen
            <input class="media-hidden-file" type="file" name="mediaFile" accept="image/jpeg,image/png,image/webp,image/svg+xml" required>
          </label>
          <button class="button button--secondary button--small" type="button" data-media-paste-focus>Bild einfuegen</button>
          <p class="muted media-paste-hint">Bilddatei ablegen, Datei hochladen oder kopiertes Bild mit Strg+V einfuegen.</p>
          <input type="hidden" name="version" value="v1">
          <input type="hidden" name="media_code" data-media-auto-code>
          <input type="hidden" name="media_type" value="upload">
          <input type="hidden" name="aspect_ratio" value="16x9">
          <input type="hidden" name="image_width">
          <input type="hidden" name="image_height">
          <input type="hidden" name="image_format">
          <input type="hidden" name="file_size_label">
          <input type="hidden" name="original_filename">
          <input type="hidden" name="file_last_modified">
          <input type="hidden" name="title" data-media-auto-title>
          <input type="hidden" name="description" data-media-auto-description>
          <input type="hidden" name="tags" data-media-auto-tags>
          <input type="hidden" name="alt_text" data-media-auto-alt>
          <div class="media-file-meta" data-media-file-meta hidden></div>
          <div id="central-media-upload-result"></div>
        </form>
        <div class="media-library-upload media-library-sync">
          <button class="button button--secondary button--small" type="button" data-sync-local-media-assets>Codex-Bilder nach Firestore uebertragen</button>
          <button class="button button--secondary button--small" type="button" data-auto-classify-media-assets>Zuordnung automatisch aktualisieren</button>
          ${trashMode ? `<a class="button button--secondary button--small" href="#/cms/media/library">Zurueck zu Bilder</a>` : `<button class="button button--secondary button--small" type="button" data-archive-marked-media-assets>Markierte in Papierkorb</button>`}
          <p class="muted media-paste-hint">Gleicht lokale Browser-Bilder mit Firestore und Storage ab, damit Codex und externer Browser dieselben Bilder sehen.</p>
          <div id="local-media-sync-result"></div>
          <div id="media-auto-classify-result"></div>
          <div id="media-archive-marked-result"></div>
        </div>
      </aside>
      <div class="media-library-main">
        <div class="media-toolbar">
          <div class="field"><label>Suche</label><input data-media-search placeholder="Titel, Datei, Schlagwort"></div>
          <div class="field"><label>Format</label><select data-media-filter="format"><option value="">Alle</option><option value="16x9">16x9</option><option value="4x3">4x3</option><option value="1x1">1x1</option><option value="4x5">4x5</option><option value="9x16">9x16</option></select></div>
          <div class="field"><label>Zuordnung</label><select data-media-filter="type">${mediaTypeFilterOptions(visibleAssets, usageMap)}</select></div>
        </div>
        <div class="media-library-grid">${visibleAssets.length ? visibleAssets.map((asset) => mediaAssetCard(asset, contextQuery, usageMap, { trashMode })).join("") : `<div class="alert">${trashMode ? "Papierkorb ist leer." : "Noch keine Bilder gespeichert."}</div>`}</div>
      </div>
    </div>
  </section>`;
}

function uploadPage() {
  return `${mediaCreateChoice("upload")}<section class="panel media-work-panel media-upload-quick">
    <form id="central-media-upload-form" class="form-grid" data-media-upload-form tabindex="0" aria-label="Bild per Upload oder Einfuegen speichern">
      <div class="media-form-head"><div><p class="eyebrow">Upload</p><h2>Bild speichern</h2><p class="muted">Datei waehlen, die wichtigsten Angaben werden automatisch erzeugt.</p></div></div>
      <div class="media-upload-grid">
        <div class="media-upload-drop">
          <div class="field"><label>Datei</label><input type="file" name="mediaFile" accept="image/jpeg,image/png,image/webp,image/svg+xml" required></div>
          <button class="button button--secondary button--small" type="button" data-media-paste-focus>Bild aus Zwischenablage einfuegen</button>
          <p class="muted media-paste-hint">Auch Drag-and-drop direkt auf diese Flaeche ist moeglich.</p>
          <figure data-media-upload-preview><span>Vorschau</span></figure>
          <div class="media-file-meta" data-media-file-meta><span>Noch keine Datei ausgewaehlt.</span></div>
          <p class="muted" data-media-auto-filename>Der Dateiname wird beim Speichern automatisch erstellt.</p>
        </div>
        <div class="media-upload-fields">
          <input type="hidden" name="version" value="v1">
          <input type="hidden" name="media_code" data-media-auto-code>
          <input type="hidden" name="image_width">
          <input type="hidden" name="image_height">
          <input type="hidden" name="image_format">
          <input type="hidden" name="file_size_label">
          <input type="hidden" name="original_filename">
          <input type="hidden" name="file_last_modified">
          <div class="form-grid--two">
            <div class="field"><label>Bildtyp</label><select name="media_type">${mediaTypeOptions("upload")}</select></div>
            <div class="field"><label>Format</label><select name="aspect_ratio">${mediaFormatOptions("16x9")}</select></div>
          </div>
          <div class="field"><label>Titel</label><input name="title" required placeholder="wird aus Datei erzeugt" data-media-auto-title></div>
          <div class="field"><label>Beschreibung</label><textarea name="description" placeholder="wird automatisch vorgeschlagen" data-media-auto-description></textarea></div>
          <div class="field"><label>Schlagwoerter</label><input name="tags" placeholder="werden automatisch vorgeschlagen" data-media-auto-tags></div>
          <div class="field"><label>Alt-Text</label><input name="alt_text" placeholder="wird automatisch aus Titel erzeugt" data-media-auto-alt></div>
          <button class="button button--primary">Bild speichern</button>
          <div id="central-media-upload-result"></div>
        </div>
      </div>
    </form>
  </section>`;
}

function aiTargetContext(record = null) {
  if (!record) return { title: "", sourceText: "", prompt: "" };
  const keywords = Array.isArray(record.tags)
    ? record.tags.join(", ")
    : Array.isArray(record.keywords)
      ? record.keywords.join(", ")
      : record.tags || record.keywords || record.primary_keyword || "";
  const title = record.title || record.titel || record.headline || record.name || "";
  const subline = record.subtitle || record.subline || record.kurztext || record.introText || "";
  const body = record.bodyText || record.articleText || record.longDescription || record.langtext || record.description || "";
  const category = record.category || record.bereich || record.page || "";
  const sourceText = [
    title ? `Headline: ${title}` : "",
    subline ? `Subline: ${subline}` : "",
    category ? `Rubrik: ${category}` : "",
    keywords ? `Keywords: ${keywords}` : "",
    body ? `Text: ${String(body).replace(/\s+/g, " ").slice(0, 1800)}` : ""
  ].filter(Boolean).join("\n");
  return {
    title,
    sourceText,
    prompt: record.thumbnail_prompt || record.thumbnailPrompt || ""
  };
}

function aiPage(query = new URLSearchParams(), targetRecord = null) {
  const hasTarget = Boolean(query.get("targetCollection") && query.get("targetId"));
  const targetContext = aiTargetContext(targetRecord);
  return `${mediaCreateChoice("ai")}<section class="panel media-work-panel">
    <form id="media-ai-form" class="form-grid" data-media-ai-form ${mediaContextAttrs(query)}>
      <div class="media-form-head"><div><p class="eyebrow">KI-Grafik</p><h2>${hasTarget ? "KI-Thumb zum Beitrag erstellen" : "KI-Grafik erstellen"}</h2><p class="muted">${hasTarget ? "Das Bild wird als Mediathek-Asset gespeichert, mit dem redaktionellen Beitrag verknuepft und danach geht es zurueck in den Editor." : "Das Bild wird als Mediathek-Asset gespeichert und kann danach bearbeitet werden."}</p></div></div>
      <div class="form-grid--two">
        <div class="field"><label>Titel</label><input name="title" ${hasTarget ? "" : "required"} placeholder="${hasTarget ? "optional, sonst Beitragstitel" : ""}" value="${escapeHtml(targetContext.title)}"></div>
        <div class="field"><label>Format</label><select name="aspect_ratio">${mediaFormatOptions("16x9")}</select></div>
        <div class="field"><label>Stil</label><input name="style" value="professionell, sachlich, redaktionell"></div>
        <div class="field"><label>Farbwelt</label><input name="color_world" value="PROdigitalTV Rot, Blau, helle Flaechen"></div>
      </div>
      <div class="field"><label>Kontext aus Editor</label><textarea name="source_text" placeholder="Headline, Thema, Keywords oder kurzer Artikeltext">${escapeHtml(targetContext.sourceText)}</textarea></div>
      <div class="field"><label>Kreativ-Prompt</label><textarea name="generated_prompt" placeholder="Optional: Bildidee, Motiv, Stimmung oder kreative Richtung. Der Beitragskontext wird automatisch ergaenzt.">${escapeHtml(targetContext.prompt)}</textarea></div>
      <button class="button button--primary">${hasTarget ? "KI-Thumb erstellen und verknuepfen" : "KI-Grafik erstellen"}</button>
      <div id="media-ai-result"></div>
    </form>
  </section>`;
}

function editPage(asset = null, query = new URLSearchParams(), variants = [], assets = [], inferredTarget = null, events = []) {
  const contextQuery = asset ? inferredMediaContext(asset, query, inferredTarget) : query;
  const hasTarget = Boolean(contextQuery.get("targetCollection") && contextQuery.get("targetId"));
  const selectedEventTargetId = contextQuery.get("targetCollection") === "events" ? contextQuery.get("targetId") : "";
  const showEventAssignment = events.length && (!hasTarget || contextQuery.get("targetCollection") === "events");
  const editorUrl = asset ? mediaEditorUrl(asset) : "";
  const previewUrl = asset ? mediaPreviewUrl(asset) || editorUrl : "";
  return `<section class="panel media-work-panel">${asset ? `<form id="central-media-edit-form" class="form-grid" data-media-edit-form data-media-id="${escapeHtml(asset.id)}" data-media-aspect="${escapeHtml(asset.aspect_ratio || "16x9")}" ${mediaContextAttrs(contextQuery)}>
    <div class="media-editor-layout">
      <div class="media-editor-preview">
        <div class="media-crop-stage" data-media-crop-stage style="--media-crop-aspect:${mediaAspectStyle(asset.aspect_ratio)}">
          ${editorUrl ? `<button class="media-fullscreen-button" type="button" data-media-fullscreen-open data-media-fullscreen-src="${escapeHtml(previewUrl)}" data-media-fullscreen-alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}" title="Bild gross anzeigen" aria-label="Bild gross anzeigen">${mediaFullscreenIcon()}</button>
          <img src="${escapeHtml(editorUrl)}" alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}" data-media-crop-image>
          <span class="media-crop-frame" aria-hidden="true"></span>` : `<div class="alert alert--warning media-crop-empty">Dieses Bild hat noch keine verwendbare URL. Bitte ein anderes Bild waehlen oder die Datei neu hochladen.</div>`}
        </div>
        <div class="media-crop-tools">
          <div class="media-zoom-row">
            <button class="icon-button" type="button" data-media-zoom-step="-0.1" aria-label="Herauszoomen">-</button>
            <label><span>Zoom</span><input data-media-crop-scale type="range" min="0.2" max="4" step="0.01" value="${escapeHtml(asset.crop_scale ?? asset.crop_data?.scale ?? 1)}"></label>
            <button class="icon-button" type="button" data-media-zoom-step="0.1" aria-label="Hineinzoomen">+</button>
            <output data-media-zoom-label>${Math.round(Number(asset.crop_scale ?? asset.crop_data?.scale ?? 1) * 100)}%</output>
          </div>
          <div class="media-crop-actions">
            <button class="button button--secondary button--small" type="button" data-media-crop-fit>Original einpassen</button>
            <button class="button button--secondary button--small" type="button" data-media-crop-cover>Rahmen füllen</button>
            <button class="button button--primary button--small" type="button" data-media-crop-apply>OK übernehmen</button>
            <button class="button button--secondary button--small" type="button" data-media-crop-reset>Zurücksetzen</button>
          </div>
        </div>
        <div class="field media-editor-assignment"><label>Bildzuordnung</label><select name="media_type" data-media-editor-type-update>${mediaTypeOptions(asset.media_type || "upload")}</select><p class="media-preset-hint" data-media-preset-hint>${escapeHtml(mediaPresetSummary(asset.media_type || "upload"))}</p></div>
        ${mediaPortalVariantButtons(asset.aspect_ratio || "16x9")}
        <div class="media-adjust-tools">
          <label>Helligkeit <input name="brightness" type="range" min="-20" max="20" value="${escapeHtml(asset.brightness ?? 0)}"></label>
          <label>Kontrast <input name="contrast" type="range" min="-20" max="20" value="${escapeHtml(asset.contrast ?? 0)}"></label>
          <label>Saettigung <input name="saturation" type="range" min="-20" max="20" value="${escapeHtml(asset.saturation ?? 0)}"></label>
          <label>Schaerfe <input name="sharpness" type="range" min="0" max="20" value="${escapeHtml(asset.sharpness ?? 0)}"></label>
          <label class="media-toggle-line">Schwarz-Weiss <input name="black_white" type="checkbox" ${asset.black_white ? "checked" : ""}></label>
        </div>
        <input type="hidden" name="crop_x" data-media-crop-x value="${escapeHtml(asset.crop_x ?? asset.crop_data?.x ?? 0)}">
        <input type="hidden" name="crop_y" data-media-crop-y value="${escapeHtml(asset.crop_y ?? asset.crop_data?.y ?? 0)}">
        <input type="hidden" name="crop_scale" data-media-crop-scale-value value="${escapeHtml(asset.crop_scale ?? asset.crop_data?.scale ?? 1)}">
        <input type="hidden" name="version" value="v1">
        <input type="hidden" name="media_code" data-media-auto-code>
        <input type="hidden" name="media_type_current" value="${escapeHtml(asset.media_type || "upload")}">
        <input type="hidden" name="aspect_ratio" value="${escapeHtml(asset.usage_preset_ratio || mediaUsagePreset(asset.media_type).aspect || asset.aspect_ratio || "16x9")}">
        <input type="hidden" name="image_width">
        <input type="hidden" name="image_height">
        <input type="hidden" name="image_format">
        <input type="hidden" name="file_size_label">
        <input type="hidden" name="original_filename">
        <input type="hidden" name="file_last_modified">
        ${mediaVariantChooser(asset, variants, assets)}
      </div>
      <div class="form-grid">
        <div class="media-editor-topbar">
          <a class="button button--secondary button--small" href="#/cms/media/library${hasTarget ? `?${new URLSearchParams({
            targetCollection: contextQuery.get("targetCollection"),
            targetId: contextQuery.get("targetId"),
            targetField: contextQuery.get("targetField") || "imageUrl",
            targetAltField: contextQuery.get("targetAltField") || "",
            returnTo: contextQuery.get("returnTo") || ""
          }).toString()}` : ""}">Neues Bild waehlen</a>
        </div>
        ${showEventAssignment ? `<div class="field"><label>Event zuordnen</label><select name="mediaEventTargetId">${eventTargetOptions(events, selectedEventTargetId)}</select><p class="muted">Wenn dieses Bild aus dem Event-Editor kommt, wird es beim Speichern als Eventbild gesetzt und danach zum Event zurueckgesprungen.</p></div>` : ""}
        <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(asset.title || "")}" required></div>
        <div class="field"><label>Alt-Text</label><input name="alt_text" value="${escapeHtml(asset.alt_text || "")}"></div>
        <div class="field"><label>Beschreibung</label><textarea name="description">${escapeHtml(asset.description || "")}</textarea><button class="button button--secondary button--small" type="button" data-media-description-ai>Bildbeschreibung mit KI erzeugen</button></div>
        ${mediaMetadataBox(asset)}
        <input type="hidden" name="focal_point_x" value="${escapeHtml(asset.focal_point_x ?? 50)}">
        <input type="hidden" name="focal_point_y" value="${escapeHtml(asset.focal_point_y ?? 50)}">
        <label class="checkbox-line"><input type="checkbox" name="createVariant" value="1"> Als neue Variante speichern</label>
        <button class="button button--primary">${hasTarget ? "Als Thumb speichern" : "Aenderungen speichern"}</button><div id="media-edit-result"></div>
      </div>
    </div>
  </form>` : `<div class="alert">Bitte zuerst ein Bild aus der Mediathek auswaehlen.</div>`}</section>`;
}

function variantsPage(assets = [], variants = []) {
  const assetsById = new Map(assets.filter((asset) => asset.id).map((asset) => [asset.id, asset]));
  return `<section class="panel"><div class="table-wrap"><table class="table table--media-variants"><thead><tr><th>Thumb</th><th>Bild</th><th>Variante</th><th>Format</th><th>Datei</th><th>Version</th></tr></thead><tbody>${variants.length ? variants.map((variant) => {
    const asset = assets.find((item) => item.id === variant.media_asset_id);
    const derived = variant.derived_media_asset_id ? assetsById.get(variant.derived_media_asset_id) : null;
    const previewUrl = mediaVariantUrl(variant) || mediaUrl(derived || {}) || mediaUrl(asset || {});
    const editHref = asset?.id ? `#/cms/media/edit?id=${encodeURIComponent(asset.id)}` : "#/cms/media/library";
    const label = variant.variant_label || mediaTypeLabels[variant.variant_type] || variant.variant_type || "Variante";
    return `<tr>
      <td><a class="media-variant-table-thumb" href="${editHref}" title="Bild im Editor oeffnen" aria-label="Bild im Editor oeffnen">${previewUrl ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(label)}">` : `<span>${escapeHtml(String(label).slice(0, 2).toUpperCase())}</span>`}</a></td>
      <td><a class="link" href="${editHref}">${escapeHtml(asset?.title || variant.media_asset_id || "-")}</a></td>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(variant.format || derived?.aspect_ratio || asset?.aspect_ratio || "-")}</td>
      <td>${escapeHtml(variant.filename || derived?.filename_web || derived?.filename_original || variant.file_path || "-")}</td>
      <td>${escapeHtml(variant.version || derived?.version || "-")}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6">Noch keine Varianten gespeichert.</td></tr>`}</tbody></table></div></section>`;
}

function youtubeVideoIdFromValue(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  const match = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/i)
    || text.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
  return match?.[1] || "";
}

function normalizedVideoAttachments(item = {}) {
  const raw = Array.isArray(item.videoAttachments)
    ? item.videoAttachments
    : Array.isArray(item.videos)
      ? item.videos
      : [];
  return raw
    .map((video, index) => {
      const youtubeVideoId = video.youtubeVideoId || video.youtube_id || youtubeVideoIdFromValue(video.youtubeUrl || video.url || video.embedUrl || "");
      const youtubeUrl = video.youtubeUrl || video.url || (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : "");
      return {
        id: video.id || `video-${index + 1}`,
        youtubeVideoId,
        youtubeUrl,
        title: video.title || "",
        caption: video.caption || "",
        description: video.description || "",
        posterImageUrl: video.posterImageUrl || video.poster || video.thumbnailUrl || video.youtubeThumbnailUrl || "",
        posterImageAlt: video.posterImageAlt || video.alt || video.title || "Video starten",
        privacyStatus: video.privacyStatus || "unlisted",
        status: video.status || "ready",
        sortOrder: Number(video.sortOrder || index + 1)
      };
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function videoAreaLabel(item = {}) {
  const section = String(item.section || item.page || item.publication_target || item.category || "").toLowerCase();
  if (item.isRetrospective || item.linkedEventId || section.includes("rueckblick") || section.includes("rückblick")) return "Rückblick";
  if (section.includes("news")) return "News";
  if (section.includes("press") || section.includes("presse")) return "Presse";
  if (section.includes("topic") || section.includes("thema")) return "Themen";
  if (section.includes("interna") || section.includes("about")) return "Interna";
  return "Redaktion";
}

function videoAttachmentRow(video = {}, index = 0) {
  return `<fieldset class="video-attachment-row" data-video-attachment-row>
    <legend>Video ${index + 1}</legend>
    <input type="hidden" name="videoId${index}" value="${escapeHtml(video.id || `video-${index + 1}`)}">
    <div class="form-grid form-grid--video-attachment">
      <div class="field"><label>YouTube-URL oder ID</label><input name="videoYoutubeUrl${index}" value="${escapeHtml(video.youtubeUrl || video.youtubeVideoId || "")}" placeholder="https://www.youtube.com/watch?v=..."></div>
      <div class="field"><label>Titel</label><input name="videoTitle${index}" value="${escapeHtml(video.title || "")}"></div>
      <div class="field"><label>Caption</label><input name="videoCaption${index}" value="${escapeHtml(video.caption || "")}"></div>
      <div class="field"><label>Startbild / Posterbild</label><input name="videoPosterImageUrl${index}" value="${escapeHtml(video.posterImageUrl || "")}" placeholder="Bild-URL oder YouTube-Thumbnail"></div>
      <div class="field"><label>Alt-Text Startbild</label><input name="videoPosterImageAlt${index}" value="${escapeHtml(video.posterImageAlt || "")}"></div>
      <div class="field"><label>Sortierung</label><input name="videoSortOrder${index}" type="number" min="1" value="${escapeHtml(video.sortOrder || index + 1)}"></div>
      <div class="field"><label>Privacy</label><select name="videoPrivacyStatus${index}">
        ${["unlisted", "private", "public", "unknown"].map((value) => `<option value="${value}" ${value === (video.privacyStatus || "unlisted") ? "selected" : ""}>${value}</option>`).join("")}
      </select></div>
      <div class="field"><label>Status</label><select name="videoStatus${index}">
        ${["ready", "draft", "published", "hidden", "error"].map((value) => `<option value="${value}" ${value === (video.status || "ready") ? "selected" : ""}>${value}</option>`).join("")}
      </select></div>
      <div class="field field--wide"><label>Beschreibung</label><textarea name="videoDescription${index}">${escapeHtml(video.description || "")}</textarea></div>
    </div>
    <button class="icon-button icon-button--danger" type="button" data-remove-video-attachment title="Video entfernen" aria-label="Video entfernen">×</button>
  </fieldset>`;
}

function videoEditorPage(item = {}) {
  const videos = normalizedVideoAttachments(item);
  const rows = (videos.length ? videos : [{}]).map(videoAttachmentRow).join("");
  const title = item.title || item.headline || item.name || item.id || "Beitrag";
  return `<section class="panel media-video-editor">
    <div class="media-video-editor__head">
      <div>
        <p class="eyebrow">${escapeHtml(videoAreaLabel(item))}</p>
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">Videos werden am bestehenden Beitrag gespeichert und im Frontend dort ausgespielt.</p>
      </div>
      <div class="actions">
        <a class="button button--secondary button--small" href="#/cms/media/videos">Zur Videoliste</a>
        <a class="button button--secondary button--small" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(item.id)}&section=${encodeURIComponent(item.section || item.page || "news")}">Beitrag öffnen</a>
      </div>
    </div>
    <form id="media-video-form" data-content-id="${escapeHtml(item.id || "")}">
      <div class="video-attachment-editor" data-video-attachments>
        <div data-video-attachment-list>${rows}</div>
        <button class="button button--secondary button--small" type="button" data-add-video-attachment>Video hinzufügen</button>
      </div>
      <div class="sticky-actions sticky-actions--member">
        <button class="button button--primary" type="submit">Videos speichern</button>
        <div id="media-video-result"></div>
      </div>
    </form>
  </section>`;
}

function normalizedLibraryVideo(video = {}) {
  const youtubeVideoId = video.youtubeVideoId || youtubeVideoIdFromValue(video.youtubeUrl || video.url || video.embedUrl || "");
  const youtubeUrl = video.youtubeUrl || video.url || (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : "");
  const posterImageUrl = video.posterImageUrl || video.thumbnailUrl || video.youtubeThumbnailUrl || (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "");
  return {
    ...video,
    youtubeVideoId,
    youtubeUrl,
    embedUrl: youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : video.embedUrl || "",
    posterImageUrl,
    title: video.title || "",
    caption: video.caption || "",
    description: video.description || "",
    posterImageAlt: video.posterImageAlt || video.title || "Video starten",
    status: video.status || "ready",
    privacyStatus: video.privacyStatus || "unlisted"
  };
}

function attachedVideosFromContent(records = [], collection = "editorialContent") {
  return records.flatMap((record) => normalizedVideoAttachments(record).map((video, index) => ({
    ...video,
    id: video.id && !String(video.id).startsWith("video-")
      ? video.id
      : `${collection}-${record.id || index}-video-${index + 1}`,
    sourceCollection: collection,
    sourceId: record.id || "",
    sourceTitle: record.title || record.headline || record.name || record.id || "",
    title: video.title || record.title || record.headline || "Video",
    createdAt: record.createdAt || record.created_at || "",
    updatedAt: record.updatedAt || record.updated_at || ""
  })));
}

function uniqueVideos(videos = []) {
  const seen = new Set();
  return videos.filter((video) => {
    const key = video.youtubeVideoId || video.youtubeUrl || video.id;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function videoFormPage(video = {}, query = new URLSearchParams()) {
  const normalized = normalizedLibraryVideo(video);
  const id = normalized.id || `media-video-${crypto.randomUUID()}`;
  return `<section class="panel media-video-editor">
    <div class="media-video-editor__head">
      <div><p class="eyebrow">Videothek</p><h2>${video.id ? "Video bearbeiten" : "Video anlegen"}</h2><p class="muted">Minimaler Workflow: YouTube-Link eintragen, Metadaten laden, speichern.</p></div>
      <a class="button button--secondary button--small" href="#/cms/media/videos">Zur Videothek</a>
    </div>
    <form id="media-video-library-form" data-video-id="${escapeHtml(id)}" data-target-collection="${escapeHtml(query.get("targetCollection") || "")}" data-target-id="${escapeHtml(query.get("targetId") || "")}" data-return-to="${escapeHtml(query.get("returnTo") || "#/cms/media/videos")}">
      <div class="form-grid form-grid--two">
        <div class="field"><label>YouTube-URL oder ID</label><input name="youtubeUrl" value="${escapeHtml(normalized.youtubeUrl || "")}" placeholder="https://www.youtube.com/watch?v=..." required></div>
        <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(normalized.title || "")}" required></div>
        <div class="field"><label>Beschreibung</label><input name="description" value="${escapeHtml(normalized.description || normalized.caption || "")}" placeholder="wird soweit moeglich aus YouTube uebernommen"></div>
        <div class="field"><label>Coverbild</label><input name="posterImageUrl" value="${escapeHtml(normalized.posterImageUrl || "")}" placeholder="wird aus YouTube-Thumbnail gesetzt"></div>
        <div class="field"><label>Status</label><select name="status">${["ready", "draft", "hidden"].map((value) => `<option value="${value}" ${normalized.status === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="field"><label>Alt-Text Cover</label><input name="posterImageAlt" value="${escapeHtml(normalized.posterImageAlt || "")}"></div>
      </div>
      <div class="actions"><button class="button button--secondary button--small" type="button" data-video-oembed>Aus YouTube laden</button></div>
      <div class="media-video-preview" data-video-preview>${normalized.youtubeVideoId ? `<iframe src="https://www.youtube.com/embed/${escapeHtml(normalized.youtubeVideoId)}" title="${escapeHtml(normalized.title || "Video Vorschau")}" loading="lazy" allowfullscreen></iframe>` : `<span>Nach Eingabe einer YouTube-URL erscheint hier die Vorschau.</span>`}</div>
      <div class="sticky-actions sticky-actions--member"><button class="button button--primary" type="submit">${query.get("targetId") ? "Speichern und zuordnen" : "Video speichern"}</button><div id="media-video-library-result"></div></div>
    </form>
  </section>`;
}

function videosPage(videoLibrary = [], query = new URLSearchParams()) {
  const editId = query.get("id") || "";
  if (query.get("mode") === "new" || editId === "new") return videoFormPage({}, query);
  const selected = editId ? videoLibrary.find((video) => video.id === editId) : null;
  if (editId) return selected ? videoFormPage(selected, query) : `<section class="panel"><div class="alert alert--error">Video wurde nicht gefunden.</div><a class="button button--secondary" href="#/cms/media/videos">Zur Videothek</a></section>`;
  const targetCollection = query.get("targetCollection") || "";
  const targetId = query.get("targetId") || "";
  const returnTo = query.get("returnTo") || "#/cms/media/videos";
  const targetQuery = targetCollection && targetId ? `&targetCollection=${encodeURIComponent(targetCollection)}&targetId=${encodeURIComponent(targetId)}&returnTo=${encodeURIComponent(returnTo)}` : "";
  const rows = videoLibrary
    .map(normalizedLibraryVideo)
    .filter((video) => !["archived", "deleted"].includes(String(video.status || "").toLowerCase()) && video.trash_status !== "paperkorb")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .map((video) => {
      const isVisible = video.visible !== false && !["hidden", "draft", "archived", "deleted"].includes(String(video.status || "").toLowerCase());
      const title = video.title || video.youtubeVideoId || "Video";
      return `<tr>
        <td>${video.posterImageUrl ? `<img class="media-video-table-thumb" src="${escapeHtml(video.posterImageUrl)}" alt="${escapeHtml(video.posterImageAlt || title)}">` : `<span class="media-video-table-thumb media-video-table-thumb--empty">Video</span>`}</td>
        <td><strong>${escapeHtml(title)}</strong><br><small>${escapeHtml(video.youtubeUrl || "")}</small></td>
        <td><span class="media-video-status ${isVisible ? "is-visible" : "is-hidden"}">${isVisible ? "sichtbar" : "ausgeblendet"}</span></td>
        <td class="actions media-video-actions">
          ${video.youtubeVideoId ? `<a class="media-video-icon-button media-video-icon-button--preview" href="https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeVideoId)}" target="_blank" rel="noopener" title="Vorschau" aria-label="Vorschau">${mediaPlayIcon()}</a>` : ""}
          ${targetCollection && targetId ? `<button class="button button--primary button--small" type="button" data-assign-video="${escapeHtml(video.id)}" data-target-collection="${escapeHtml(targetCollection)}" data-target-id="${escapeHtml(targetId)}" data-return-to="${escapeHtml(returnTo)}">Zuordnen</button>` : ""}
          <a class="media-video-icon-button media-video-icon-button--edit" href="#/cms/media/videos?id=${encodeURIComponent(video.id)}${targetQuery}" title="Video bearbeiten" aria-label="Video bearbeiten">${mediaEditIcon()}</a>
          <button class="media-video-icon-button ${isVisible ? "media-video-icon-button--visible" : "media-video-icon-button--hidden"}" type="button" data-video-visible-toggle="${escapeHtml(video.id)}" data-next-visible="${isVisible ? "false" : "true"}" title="${isVisible ? "Video ausblenden" : "Video sichtbar schalten"}" aria-label="${isVisible ? "Video ausblenden" : "Video sichtbar schalten"}">${isVisible ? mediaEyeIcon() : mediaEyeOffIcon()}</button>
          <button class="media-video-icon-button media-video-icon-button--danger" type="button" data-video-trash="${escapeHtml(video.id)}" data-video-title="${escapeHtml(title)}" title="In den Papierkorb verschieben" aria-label="Video in den Papierkorb verschieben">${mediaTrashIcon()}</button>
        </td>
      </tr>`;
    }).join("");
  return `<section class="panel">
    <div class="media-library-summary"><div><strong>Zentrale Videothek</strong><br><span class="muted">Keine Beitragsliste: nur Videos zentral pflegen und bei Bedarf zuordnen.</span></div><a class="button button--primary button--small" href="#/cms/media/videos?mode=new${targetQuery}">Neues Video</a></div>
    <div class="table-wrap"><table class="table table--media-videos"><thead><tr><th>Cover</th><th>Video</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows || `<tr><td colspan="4">Noch keine Videos angelegt.</td></tr>`}</tbody></table></div>
    <div id="media-video-assign-result"></div>
  </section>`;
}

export async function mediaPage(section = "library", query = new URLSearchParams()) {
  const allowedSections = ["library", "edit", "ai", "variants", "videos"];
  const activeSection = allowedSections.includes(section) ? section : "library";
  await waitForAuthReady();
  if (!canUseCms(currentUser())) return protect("");
  let assets = [];
  let variants = [];
  let mediaAccessError = "";
  try {
    assets = await list("media_assets");
  } catch (error) {
    mediaAccessError = error.message || String(error);
  }
  const membersForMedia = activeSection === "library" || activeSection === "edit"
    ? await list("members").catch(() => [])
    : [];
  assets = [...assets, ...memberLogoVirtualAssets(membersForMedia, assets)];
  variants = await list("media_variants").catch(() => []);
  if (mediaAccessError && activeSection !== "videos") {
    return protect(cmsShell("cms/media/library", `${cmsTitle("Bilder", "Mediathek")}<section class="panel"><div class="alert alert--error"><strong>Mediathek konnte nicht geoeffnet werden.</strong><br>${escapeHtml(mediaAccessError)}<br><small>Bitte Firestore-Regeln fuer <code>media_assets</code> pruefen: Admins und Redakteure muessen lesen duerfen.</small></div></section>`));
  }
  const targetRecord = query.get("targetCollection") && query.get("targetId")
    ? await getOne(query.get("targetCollection"), query.get("targetId")).catch(() => null)
    : null;
  const requestedAssetId = query.get("id") || (activeSection === "edit" ? lastMediaAssetId() : "");
  const selectedAsset = requestedAssetId ? assets.find((asset) => asset.id === requestedAssetId) : null;
  const shouldLoadEventTargets = activeSection === "edit" && selectedAsset && !query.get("targetCollection") && !query.get("targetId");
  const eventTargets = shouldLoadEventTargets ? await list("events").catch(() => []) : [];
  const videoItems = activeSection === "videos"
    ? uniqueVideos([
        ...(await list("media_videos").catch(() => [])),
        ...attachedVideosFromContent(await list("editorialContent").catch(() => []), "editorialContent"),
        ...attachedVideosFromContent(await list("events").catch(() => []), "events")
      ])
    : [];
  const shouldInferEventTarget = activeSection === "edit"
    && selectedAsset
    && !query.get("targetCollection")
    && !query.get("targetId")
    && !selectedAsset.linked_collection
    && !selectedAsset.target_collection;
  const inferredEvent = shouldInferEventTarget
    ? mediaAssetLinkedEvent(selectedAsset, eventTargets)
    : null;
  const inferredTarget = lastEventEditorTarget(eventTargets)
    || (inferredEvent ? { collection: "events", id: inferredEvent.id, field: "imageUrl" } : null);
  const usage = activeSection === "library" ? await mediaUsageMap(assets) : new Map();
  const title = mediaSections.find(([key]) => key === activeSection)?.[1] || "Mediathek";
  const content = {
    library: libraryPage(assets, query, usage),
    upload: uploadPage(),
    ai: aiPage(query, targetRecord),
    edit: editPage(selectedAsset, query, variants, assets, inferredTarget, eventTargets),
    variants: variantsPage(assets, variants),
    videos: videosPage(videoItems, query)
  }[activeSection];
  const note = activeSection === "videos"
    ? `<p class="muted media-note">Videos werden zentral verwaltet und in Beitr?gen nur zugeordnet.</p>`
    : `<p class="muted media-note">Einfaches Bildtool: hochladen, finden, bearbeiten und Varianten behalten.</p>`;
  const activeRoute = activeSection === "library" && query.get("trash") === "1" ? "cms/media/library?trash=1" : `cms/media/${activeSection}`;
  const trashMode = activeSection === "library" && query.get("trash") === "1";
  return protect(cmsShell(activeRoute, `${cmsTitle(trashMode ? "System" : "Medien", trashMode ? "Papierkorb" : title)}${trashMode ? "" : mediaTabs(activeSection)}${content}${trashMode ? "" : note}`));
}
