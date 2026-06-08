import { cmsShell, cmsTitle } from "./cmsLayout.js?v=460";
import { list } from "../firebase/dataService.js?v=460";
import { currentUser, canUseCms } from "../firebase/authService.js?v=460";
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
  thumb: "Thumbnail"
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
  member: { label: "Mitglied", aspect: "4x3", width: 1200, height: 900, portal: "Mitgliederkarte / Logo", mobile: "Mobile Mitgliederkarte 4:3" },
  person: { label: "Personenbild", aspect: "4x5", width: 1200, height: 1500, portal: "Personenprofil", mobile: "Mobile Profilkarte 4:5" },
  logo: { label: "Logo", aspect: "4x3", width: 1200, height: 900, portal: "Logo-Kachel", mobile: "Mobile Logo-Kachel 4:3" },
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

function mediaAspectStyle(format = "16x9") {
  const clean = String(format || "16x9").toLowerCase();
  if (clean === "1x1") return "1 / 1";
  if (clean === "4x5") return "4 / 5";
  if (clean === "4x3" || clean === "logo") return "4 / 3";
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

function mediaDisplayAspect(asset = {}) {
  return asset.usage_preset_ratio
    || mediaUsagePreset(asset.media_type).aspect
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
    ["logo", "Logo", "4 / 3", "logo", "4:3", "logo"]
  ];
  return `<div class="media-format-buttons" aria-label="Portalvarianten">${variants.map(([type, label, aspect, format, ratio, shape]) => {
    const isActive = active === format || (active === "4x3" && format === "logo");
    return `<button class="media-format-button media-format-button--${shape} ${isActive ? "is-active" : ""}" type="button" data-media-variant-button="${type}" data-media-variant-aspect="${aspect}" data-media-variant-format="${format}" aria-pressed="${isActive ? "true" : "false"}"><i aria-hidden="true"></i><strong>${escapeHtml(label)}</strong><span>${escapeHtml(ratio)}</span></button>`;
  }).join("")}</div>`;
}

function mediaVariantUrl(variant = {}) {
  return variant.file_url || variant.file_path_url || "";
}

function mediaVariantChooser(asset = {}, variants = []) {
  const hiddenTechnicalTypes = new Set(["original", "web", "thumb", "thumbnail"]);
  const relatedVariants = variants
    .filter((variant) => variant.media_asset_id === asset.id && mediaVariantUrl(variant) && !hiddenTechnicalTypes.has(String(variant.variant_type || "").toLowerCase()))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  if (!relatedVariants.length) return "";
  const originalUrl = mediaPreviewUrl(asset) || mediaUrl(asset);
  const original = originalUrl
    ? `<button class="media-variant-choice is-active" type="button" data-media-load-variant data-media-variant-src="${escapeHtml(originalUrl)}" data-media-variant-format="${escapeHtml(asset.aspect_ratio || mediaDisplayAspect(asset) || "16x9")}" aria-pressed="true"><strong>Original</strong><span>${escapeHtml(asset.filename_original || asset.filename_web || "Ausgangsbild")}</span></button>`
    : "";
  const options = relatedVariants.map((variant) => {
    const label = variant.variant_label || mediaTypeLabels[variant.variant_type] || variant.variant_type || "Variante";
    const format = variant.format || asset.aspect_ratio || mediaDisplayAspect(asset) || "16x9";
    return `<button class="media-variant-choice" type="button" data-media-load-variant data-media-variant-src="${escapeHtml(mediaVariantUrl(variant))}" data-media-variant-format="${escapeHtml(format)}" aria-pressed="false"><strong>${escapeHtml(label)}</strong><span>${escapeHtml([format, variant.version, variant.filename].filter(Boolean).join(" · "))}</span></button>`;
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
    collectionRecords.forEach(([collection, records]) => {
      const match = records.find((record) => recordUsesMedia(record, asset));
      if (match) usedIn.push({ collection, id: match.id, title: match.title || match.name || match.headline || match.slug || match.id });
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

function mediaAssetCard(asset, contextQuery = "", usageMap = new Map()) {
  const usedIn = usageMap.get(asset.id) || [];
  const isUsed = usedIn.length > 0;
  const usageLabel = mediaUsageLabel(usedIn);
  const editHref = `#/cms/media/edit?id=${encodeURIComponent(asset.id)}${contextQuery}`;
  return `<article class="media-asset-card" data-media-card data-media-edit-link="${editHref}" data-search="${escapeHtml([asset.title, asset.filename_original, asset.filename_web, asset.filename_thumb, asset.tags, asset.description].flat().filter(Boolean).join(" ").toLowerCase())}" data-source="${escapeHtml(asset.source_type || "")}" data-format="${escapeHtml(asset.aspect_ratio || "")}" tabindex="0" role="button" aria-label="${escapeHtml(asset.title || asset.filename_original || "Bild")} bearbeiten">
      <figure style="--media-card-aspect:${mediaAspectStyle(mediaDisplayAspect(asset))}">
        <a class="media-card-edit-picto" href="${editHref}" title="Bild bearbeiten" aria-label="Bild bearbeiten">${mediaEditIcon()}</a>
        ${mediaThumb(asset)}
      </figure>
        <div class="media-asset-card__body">
        <div class="media-asset-card__title-row">
          <div>
            <h3>${escapeHtml(asset.title || asset.filename_original || "Bild")}</h3>
          </div>
          ${isUsed
            ? `<span class="media-asset-used" title="Bild wird verwendet">${escapeHtml(usageLabel || "Verwendet")}</span>`
            : `<button class="media-trash-button" type="button" data-media-delete="${escapeHtml(asset.id)}" data-media-title="${escapeHtml(asset.title || asset.filename_original || "Bild")}" title="Sofort loeschen" aria-label="Bild sofort loeschen">${mediaTrashIcon()}</button>`}
        </div>
        <p>${escapeHtml(asset.filename_web || asset.filename_original || "-")}</p>
        <label class="media-card-assignment"><span>Zuordnung</span><select data-media-type-update="${escapeHtml(asset.id)}">${mediaTypeOptions(asset.media_type || "upload")}</select></label>
        <p class="media-preset-hint">${escapeHtml(mediaPresetSummary(asset.media_type || "upload"))}</p>
        <div class="media-asset-card__meta">${asset.media_code ? `<span class="media-code">ID ${escapeHtml(asset.media_code)}</span>` : ""}<span>${escapeHtml(mediaTypeLabels[asset.media_type] || asset.media_type || "Bild")}</span><span>${escapeHtml(mediaDisplayAspect(asset) || "-")}</span>${asset.image_width && asset.image_height ? `<span>${escapeHtml(`${asset.image_width} x ${asset.image_height}px`)}</span>` : ""}${asset.file_size_label ? `<span>${escapeHtml(asset.file_size_label)}</span>` : ""}${assetDate(asset) ? `<span>${escapeHtml(assetDate(asset))}</span>` : ""}</div>
      </div>
    </article>`;
}

function libraryPage(assets = [], query = new URLSearchParams(), usageMap = new Map()) {
  const visibleAssets = assets.filter((asset) => asset.status !== "archived" && !asset.parent_media_asset_id && asset.source_type !== "edited");
  const contextQuery = mediaContextQuery(query);
  return `<section class="panel media-library-panel">
    <div class="media-library-layout">
      <aside class="media-library-sidebar">
        <form id="central-media-upload-form" class="media-library-upload" data-media-upload-form ${mediaContextAttrs(query)}>
          <label class="button button--primary button--small">
            Datei hochladen
            <input class="media-hidden-file" type="file" name="mediaFile" accept="image/jpeg,image/png,image/webp,image/svg+xml" required>
          </label>
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
          <div class="field"><label>Quelle</label><select data-media-filter="source"><option value="">Alle</option><option value="upload">Upload</option><option value="ai">KI-Grafik</option></select></div>
          <div class="field"><label>Format</label><select data-media-filter="format"><option value="">Alle</option><option value="16x9">16x9</option><option value="4x3">4x3</option><option value="1x1">1x1</option><option value="4x5">4x5</option><option value="9x16">9x16</option></select></div>
        </div>
        <div class="media-library-grid">${visibleAssets.length ? visibleAssets.map((asset) => mediaAssetCard(asset, contextQuery, usageMap)).join("") : `<div class="alert">Noch keine Bilder gespeichert.</div>`}</div>
      </div>
    </div>
  </section>`;
}

function uploadPage() {
  return `${mediaCreateChoice("upload")}<section class="panel media-work-panel media-upload-quick">
    <form id="central-media-upload-form" class="form-grid" data-media-upload-form>
      <div class="media-form-head"><div><p class="eyebrow">Upload</p><h2>Bild speichern</h2><p class="muted">Datei waehlen, die wichtigsten Angaben werden automatisch erzeugt.</p></div></div>
      <div class="media-upload-grid">
        <div class="media-upload-drop">
          <div class="field"><label>Datei</label><input type="file" name="mediaFile" accept="image/jpeg,image/png,image/webp,image/svg+xml" required></div>
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

function aiPage(query = new URLSearchParams()) {
  return `${mediaCreateChoice("ai")}<section class="panel media-work-panel">
    <form id="media-ai-form" class="form-grid" data-media-ai-form ${mediaContextAttrs(query)}>
      <div class="media-form-head"><div><p class="eyebrow">KI-Grafik</p><h2>Einfachen Bildentwurf anlegen</h2><p class="muted">Hier wird ein Bildentwurf mit Prompt gespeichert. Die eigentliche Grafik kann danach ergänzt oder ersetzt werden.</p></div></div>
      <div class="form-grid--two">
        <div class="field"><label>Titel</label><input name="title" required></div>
        <div class="field"><label>Format</label><select name="aspect_ratio">${mediaFormatOptions("16x9")}</select></div>
        <div class="field"><label>Stil</label><input name="style" value="professionell, sachlich, redaktionell"></div>
        <div class="field"><label>Farbwelt</label><input name="color_world" value="PROdigitalTV Rot, Blau, helle Flaechen"></div>
      </div>
      <div class="field"><label>Kontext</label><textarea name="source_text" placeholder="Headline, Thema, Keywords oder kurzer Artikeltext"></textarea></div>
      <div class="field"><label>Prompt</label><textarea name="generated_prompt" required placeholder="Serioese redaktionelle Grafik fuer digitale Medien, Streaming, TV und Plattformen..."></textarea></div>
      <button class="button button--primary">Entwurf speichern</button>
      <div id="media-ai-result"></div>
    </form>
  </section>`;
}

function editPage(asset = null, query = new URLSearchParams(), variants = []) {
  const hasTarget = Boolean(query.get("targetCollection") && query.get("targetId"));
  return `<section class="panel media-work-panel">${asset ? `<form id="central-media-edit-form" class="form-grid" data-media-edit-form data-media-id="${escapeHtml(asset.id)}" data-media-aspect="${escapeHtml(asset.aspect_ratio || "16x9")}" ${mediaContextAttrs(query)}>
    <div class="media-editor-layout">
      <div class="media-editor-preview">
        <div class="media-crop-stage" data-media-crop-stage style="--media-crop-aspect:${mediaAspectStyle(asset.aspect_ratio)}">
          <button class="media-fullscreen-button" type="button" data-media-fullscreen-open data-media-fullscreen-src="${escapeHtml(mediaPreviewUrl(asset) || mediaUrl(asset))}" data-media-fullscreen-alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}" title="Bild gross anzeigen" aria-label="Bild gross anzeigen">${mediaFullscreenIcon()}</button>
          <img src="${escapeHtml(mediaEditorUrl(asset))}" alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}" crossorigin="anonymous" data-media-crop-image>
          <span class="media-crop-frame" aria-hidden="true"></span>
        </div>
        <div class="field media-editor-assignment"><label>Bildzuordnung</label><select name="media_type" data-media-editor-type-update>${mediaTypeOptions(asset.media_type || "upload")}</select><p class="media-preset-hint" data-media-preset-hint>${escapeHtml(mediaPresetSummary(asset.media_type || "upload"))}</p></div>
        ${mediaVariantChooser(asset, variants)}
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
            targetCollection: query.get("targetCollection"),
            targetId: query.get("targetId"),
            targetField: query.get("targetField") || "imageUrl",
            targetAltField: query.get("targetAltField") || "",
            returnTo: query.get("returnTo") || ""
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
  return `<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Bild</th><th>Variante</th><th>Format</th><th>Datei</th><th>Version</th></tr></thead><tbody>${variants.length ? variants.map((variant) => {
    const asset = assets.find((item) => item.id === variant.media_asset_id);
    return `<tr><td>${escapeHtml(asset?.title || variant.media_asset_id || "-")}</td><td>${escapeHtml(variant.variant_type || "-")}</td><td>${escapeHtml(variant.format || "-")}</td><td>${escapeHtml(variant.filename || variant.file_path || "-")}</td><td>${escapeHtml(variant.version || "-")}</td></tr>`;
  }).join("") : `<tr><td colspan="5">Noch keine Varianten gespeichert.</td></tr>`}</tbody></table></div></section>`;
}

export async function mediaPage(section = "library", query = new URLSearchParams()) {
  const activeSection = mediaSections.some(([key]) => key === section) ? section : "library";
  const [assets, variants] = await Promise.all([
    list("media_assets"),
    list("media_variants")
  ]);
  const requestedAssetId = query.get("id") || (activeSection === "edit" ? lastMediaAssetId() : "");
  const selectedAsset = requestedAssetId ? assets.find((asset) => asset.id === requestedAssetId) : null;
  const usage = activeSection === "library" ? await mediaUsageMap(assets) : new Map();
  const title = mediaSections.find(([key]) => key === activeSection)?.[1] || "Mediathek";
  const content = {
    library: libraryPage(assets, query, usage),
    upload: uploadPage(),
    ai: aiPage(query),
    edit: editPage(selectedAsset, query, variants),
    variants: variantsPage(assets, variants)
  }[activeSection];
  return protect(cmsShell(`cms/media/${activeSection}`, `${cmsTitle("Bilder", title)}${mediaTabs(activeSection)}${content}<p class="muted media-note">Einfaches Bildtool: hochladen, finden, bearbeiten und Varianten behalten.</p>`));
}
