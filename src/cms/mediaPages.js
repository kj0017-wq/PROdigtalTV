import { cmsShell, cmsTitle } from "./cmsLayout.js?v=461";
import { list, getOne } from "../firebase/dataService.js?v=465";
import { currentUser, canUseCms } from "../firebase/authService.js?v=464";
import { escapeHtml } from "../utils/format.js";

const mediaSections = [
  ["library", "Mediathek"],
  ["edit", "Bild bearbeiten"],
  ["ai", "KI-Grafik"],
  ["variants", "Varianten"]
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

function protect(content) {
  const user = currentUser();
  if (!canUseCms(user)) {
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Zugriff geschuetzt</p><h1>CMS-Login erforderlich</h1><p style="margin:14px 0 24px">Dieser Bereich steht Administratoren und Redakteuren zur Verfuegung.</p><a class="button button--primary" href="#/login">Anmelden</a></div></section>`;
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

function mediaUrl(asset = {}) {
  const url = asset.file_path_thumb_url || asset.file_path_web_url || asset.file_path_original_url || asset.imageUrl || asset.assetUrl || "";
  return url;
}

function mediaPreviewUrl(asset = {}) {
  return asset.file_path_original_url || asset.file_path_web_url || asset.imageUrl || asset.assetUrl || asset.file_path_thumb_url || "";
}

function mediaEditorUrl(asset = {}) {
  return asset.file_path_web_url || asset.file_path_original_url || asset.imageUrl || asset.assetUrl || asset.file_path_thumb_url || "";
}

function mediaUrlValues(asset = {}) {
  return [
    asset.file_path_thumb_url,
    asset.file_path_web_url,
    asset.file_path_original_url,
    asset.imageUrl,
    asset.assetUrl,
    asset.thumbnail_url,
    asset.thumbnailUrl
  ].filter(Boolean).map((value) => String(value));
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
  if (collection === "members") return "member";
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
  if (linkedType && ["upload", "thumb", "thumbnail", "ai", "article"].includes(current)) return linkedType;
  if (current !== "upload") return current;
  const values = mediaUrlValues(asset).join(" ");
  if (/assets(?:%2F|\/)official(?:%2F|\/)members/i.test(values)) return "member";
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

function inferredMediaContext(asset = {}, query = new URLSearchParams()) {
  const linkedCollection = asset.linked_collection || asset.target_collection || "";
  const linkedId = asset.linked_record_id || asset.target_id || "";
  const collection = query.get("targetCollection") || linkedCollection;
  const id = query.get("targetId") || linkedId;
  const field = collection === "members"
    ? "logoUrl"
    : query.get("targetField") || asset.linked_field || asset.target_field || "imageUrl";
  const returnTo = query.get("returnTo")
    || (collection === "members" && id ? `#/cms/edit?module=members&id=${id}&section=all` : "");
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
  assets.forEach((asset) => {
    const usedIn = [];
    if (asset.target_collection && asset.target_id) {
      usedIn.push({
        collection: asset.target_collection,
        id: asset.target_id,
        title: asset.target_title || asset.linked_title || asset.target_id,
        page: asset.target_page || asset.linked_page || asset.page,
        section: asset.target_section || asset.linked_section || asset.section,
        publication_target: asset.publication_target
      });
    } else if (asset.linked_collection && asset.linked_record_id) {
      usedIn.push({
        collection: asset.linked_collection,
        id: asset.linked_record_id,
        title: asset.linked_title || asset.linked_record_id,
        page: asset.linked_page || asset.page,
        section: asset.linked_section || asset.section,
        publication_target: asset.publication_target
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
          publication_target: match.publication_target
        });
      }
    });
    usage.set(asset.id, usedIn);
  });
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

function mediaAssetCard(asset, contextQuery = "", usageMap = new Map()) {
  const usedIn = usageMap.get(asset.id) || [];
  const isUsed = usedIn.length > 0;
  const usageLabel = mediaUsageLabel(usedIn);
  const editHref = `#/cms/media/edit?id=${encodeURIComponent(asset.id)}${contextQuery}`;
  const sourceGroup = mediaAssetSourceGroup(asset);
  const displayType = inferredMediaType(asset, usedIn);
  return `<article class="media-asset-card" data-media-card data-media-edit-link="${editHref}" data-search="${escapeHtml([asset.title, asset.filename_original, asset.filename_web, asset.filename_thumb, asset.tags, asset.description].flat().filter(Boolean).join(" ").toLowerCase())}" data-source="${escapeHtml(sourceGroup)}" data-type="${escapeHtml(displayType)}" data-format="${escapeHtml(asset.aspect_ratio || "")}" tabindex="0" role="button" aria-label="${escapeHtml(asset.title || asset.filename_original || "Bild")} bearbeiten">
      <figure style="--media-card-aspect:${mediaAspectStyle(mediaDisplayAspect(asset, usedIn))}">
        <a class="media-card-edit-picto" href="${editHref}" title="Bild bearbeiten" aria-label="Bild bearbeiten">${mediaEditIcon()}</a>
        ${mediaThumb(asset)}
      </figure>
        <div class="media-asset-card__body">
        <div class="media-asset-card__title-row">
          <div>
            <h3>${escapeHtml(asset.title || asset.filename_original || "Bild")}</h3>
          </div>
          <div class="media-card-actions-top">
            <details class="media-card-info">
              <summary class="media-card-info-picto" title="Bildinformationen" aria-label="Bildinformationen">${mediaInfoIcon()}</summary>
              <div class="media-card-info-panel">
                ${mediaCardInfoRows(asset, usedIn)}
                <div class="media-asset-card__meta">${asset.media_code ? `<span class="media-code">ID ${escapeHtml(asset.media_code)}</span>` : ""}<span>${escapeHtml(mediaTypeLabels[displayType] || displayType || "Bild")}</span><span>${escapeHtml(mediaDisplayAspect(asset, usedIn) || "-")}</span>${asset.image_width && asset.image_height ? `<span>${escapeHtml(`${asset.image_width} x ${asset.image_height}px`)}</span>` : ""}${asset.file_size_label ? `<span>${escapeHtml(asset.file_size_label)}</span>` : ""}${assetDate(asset) ? `<span>${escapeHtml(assetDate(asset))}</span>` : ""}</div>
              </div>
            </details>
            ${isUsed
              ? `<span class="media-asset-used" title="Bild wird verwendet">${escapeHtml(usageLabel || "Verwendet")}</span>`
              : `<button class="media-trash-button" type="button" data-media-delete="${escapeHtml(asset.id)}" data-media-title="${escapeHtml(asset.title || asset.filename_original || "Bild")}" title="Sofort loeschen" aria-label="Bild sofort loeschen">${mediaTrashIcon()}</button>`}
          </div>
        </div>
        <label class="media-card-assignment media-card-assignment--inline"><span>Quelle</span><select data-media-source-update="${escapeHtml(asset.id)}">${mediaSourceOptions(sourceGroup)}</select></label>
        <label class="media-card-assignment media-card-assignment--inline"><span>Zuordnung</span><select data-media-type-update="${escapeHtml(asset.id)}">${mediaTypeOptions(displayType)}</select></label>
      </div>
    </article>`;
}

function libraryPage(assets = [], query = new URLSearchParams(), usageMap = new Map()) {
  const visibleAssets = uniqueMediaAssets(assets.filter((asset) => asset.status !== "archived" && !asset.parent_media_asset_id && asset.source_type !== "edited"));
  const contextQuery = mediaContextQuery(query);
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
      </aside>
      <div class="media-library-main">
        <div class="media-toolbar">
          <div class="field"><label>Suche</label><input data-media-search placeholder="Titel, Datei, Schlagwort"></div>
          <div class="field media-source-switch-field">
            <label>Quelle</label>
            <div class="media-source-switch" role="group" aria-label="Bildquelle filtern">
              <button type="button" class="is-active" data-media-source-switch="">Alle</button>
              <button type="button" data-media-source-switch="upload">Hochgeladen</button>
              <button type="button" data-media-source-switch="ai">KI-Bilder</button>
            </div>
          </div>
          <div class="field"><label>Format</label><select data-media-filter="format"><option value="">Alle</option><option value="16x9">16x9</option><option value="4x3">4x3</option><option value="1x1">1x1</option><option value="4x5">4x5</option><option value="9x16">9x16</option></select></div>
          <div class="field"><label>Zuordnung</label><select data-media-filter="type"><option value="">Alle</option>${Object.entries(mediaTypeLabels).map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("")}</select></div>
        </div>
        <div class="media-library-grid">${visibleAssets.length ? visibleAssets.map((asset) => mediaAssetCard(asset, contextQuery, usageMap)).join("") : `<div class="alert">Noch keine Bilder gespeichert.</div>`}</div>
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

function editPage(asset = null, query = new URLSearchParams(), variants = [], assets = []) {
  const contextQuery = asset ? inferredMediaContext(asset, query) : query;
  const hasTarget = Boolean(contextQuery.get("targetCollection") && contextQuery.get("targetId"));
  return `<section class="panel media-work-panel">${asset ? `<form id="central-media-edit-form" class="form-grid" data-media-edit-form data-media-id="${escapeHtml(asset.id)}" data-media-aspect="${escapeHtml(asset.aspect_ratio || "16x9")}" ${mediaContextAttrs(contextQuery)}>
    <div class="media-editor-layout">
      <div class="media-editor-preview">
        <div class="media-crop-stage" data-media-crop-stage style="--media-crop-aspect:${mediaAspectStyle(asset.aspect_ratio)}">
          <button class="media-fullscreen-button" type="button" data-media-fullscreen-open data-media-fullscreen-src="${escapeHtml(mediaPreviewUrl(asset) || mediaUrl(asset))}" data-media-fullscreen-alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}" title="Bild gross anzeigen" aria-label="Bild gross anzeigen">${mediaFullscreenIcon()}</button>
          <img src="${escapeHtml(mediaEditorUrl(asset))}" alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}" crossorigin="anonymous" data-media-crop-image>
          <span class="media-crop-frame" aria-hidden="true"></span>
        </div>
        <div class="field media-editor-assignment"><label>Bildzuordnung</label><select name="media_type" data-media-editor-type-update>${mediaTypeOptions(asset.media_type || "upload")}</select><p class="media-preset-hint" data-media-preset-hint>${escapeHtml(mediaPresetSummary(asset.media_type || "upload"))}</p></div>
        ${mediaVariantChooser(asset, variants, assets)}
        <div class="media-crop-tools">
          <label><span>Zoom</span><input data-media-crop-scale type="range" min="1" max="3" step="0.01" value="${escapeHtml(asset.crop_scale ?? asset.crop_data?.scale ?? 1)}"></label>
          <div class="media-crop-actions">
            <button class="button button--primary button--small" type="button" data-media-crop-apply>OK uebernehmen</button>
            <button class="button button--secondary button--small" type="button" data-media-crop-reset>Zuruecksetzen</button>
          </div>
        </div>
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

export async function mediaPage(section = "library", query = new URLSearchParams()) {
  const activeSection = mediaSections.some(([key]) => key === section) ? section : "library";
  const [assets, variants] = await Promise.all([
    list("media_assets"),
    list("media_variants")
  ]);
  const targetRecord = query.get("targetCollection") && query.get("targetId")
    ? await getOne(query.get("targetCollection"), query.get("targetId")).catch(() => null)
    : null;
  const requestedAssetId = query.get("id") || (activeSection === "edit" ? lastMediaAssetId() : "");
  const selectedAsset = requestedAssetId ? assets.find((asset) => asset.id === requestedAssetId) : null;
  const usage = activeSection === "library" ? await mediaUsageMap(assets) : new Map();
  const title = mediaSections.find(([key]) => key === activeSection)?.[1] || "Mediathek";
  const content = {
    library: libraryPage(assets, query, usage),
    upload: uploadPage(),
    ai: aiPage(query, targetRecord),
    edit: editPage(selectedAsset, query, variants, assets),
    variants: variantsPage(assets, variants)
  }[activeSection];
  return protect(cmsShell(`cms/media/${activeSection}`, `${cmsTitle("Bilder", title)}${mediaTabs(activeSection)}${content}<p class="muted media-note">Einfaches Bildtool: hochladen, finden, bearbeiten und Varianten behalten.</p>`));
}
