import { cmsShell, cmsTitle } from "./cmsLayout.js?v=460";
import { list } from "../firebase/dataService.js?v=460";
import { currentUser, canUseCms } from "../firebase/authService.js?v=460";
import { escapeHtml } from "../utils/format.js";

const mediaSections = [
  ["library", "Mediathek"],
  ["upload", "Bild hochladen"],
  ["ai", "KI-Grafik"],
  ["edit", "Bild bearbeiten"],
  ["variants", "Varianten"]
];

const mediaTypeLabels = {
  upload: "Upload",
  ai: "KI-Grafik",
  event: "Eventbild",
  article: "Artikelbild",
  topic: "Themenbild",
  person: "Personenbild",
  logo: "Logo",
  thumb: "Thumbnail"
};

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

function mediaAspectStyle(format = "16x9") {
  const clean = String(format || "16x9").toLowerCase();
  if (clean === "1x1") return "1 / 1";
  if (clean === "4x5") return "4 / 5";
  if (clean === "9x16") return "9 / 16";
  if (clean === "portrait" || clean === "hochkant") return "9 / 16";
  if (clean === "landscape") return "16 / 9";
  return "16 / 9";
}

function mediaFormatOptions(selected = "16x9") {
  return ["16x9", "1x1", "4x5", "9x16"].map((format) => `<option value="${format}" ${selected === format ? "selected" : ""}>${format}</option>`).join("");
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
    ["Speicherpfad", asset.file_path_web || asset.file_path_original || ""],
    ["Geaendert", assetDate(asset)]
  ].filter(([, value]) => value);
  return `<details class="media-edit-meta"><summary><strong>Metadaten</strong><span>${rows.length} Angaben</span></summary><dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></details>`;
}

function libraryPage(assets = []) {
  const visibleAssets = assets.filter((asset) => asset.status !== "archived");
  return `<section class="panel media-library-panel">
    <div class="media-toolbar">
      <div class="field"><label>Suche</label><input data-media-search placeholder="Titel, Datei, Schlagwort"></div>
      <div class="field"><label>Quelle</label><select data-media-filter="source"><option value="">Alle</option><option value="upload">Upload</option><option value="ai">KI-Grafik</option></select></div>
      <div class="field"><label>Format</label><select data-media-filter="format"><option value="">Alle</option><option value="16x9">16x9</option><option value="1x1">1x1</option><option value="4x5">4x5</option><option value="9x16">9x16</option></select></div>
    </div>
    <div class="media-library-grid">${visibleAssets.length ? visibleAssets.map((asset) => `<article class="media-asset-card" data-media-card data-media-edit-link="#/cms/media/edit?id=${encodeURIComponent(asset.id)}" data-search="${escapeHtml([asset.title, asset.filename_original, asset.filename_web, asset.filename_thumb, asset.tags, asset.description].flat().filter(Boolean).join(" ").toLowerCase())}" data-source="${escapeHtml(asset.source_type || "")}" data-format="${escapeHtml(asset.aspect_ratio || "")}" tabindex="0" role="button" aria-label="${escapeHtml(asset.title || asset.filename_original || "Bild")} bearbeiten">
      <figure>${mediaThumb(asset)}</figure>
        <div class="media-asset-card__body">
        <h3>${escapeHtml(asset.title || asset.filename_original || "Bild")}</h3>
        <p>${escapeHtml(asset.filename_web || asset.filename_original || "-")}</p>
        <div class="media-asset-card__meta">${asset.media_code ? `<span class="media-code">ID ${escapeHtml(asset.media_code)}</span>` : ""}<span>${escapeHtml(mediaTypeLabels[asset.media_type] || asset.media_type || "Bild")}</span><span>${escapeHtml(asset.aspect_ratio || "-")}</span>${asset.image_width && asset.image_height ? `<span>${escapeHtml(`${asset.image_width} x ${asset.image_height}px`)}</span>` : ""}${asset.file_size_label ? `<span>${escapeHtml(asset.file_size_label)}</span>` : ""}${assetDate(asset) ? `<span>${escapeHtml(assetDate(asset))}</span>` : ""}</div>
        <div class="media-asset-card__actions">
          <a class="button button--secondary button--small" href="#/cms/media/edit?id=${encodeURIComponent(asset.id)}">Bearbeiten</a>
          <button class="button button--secondary button--small" type="button" data-media-delete="${escapeHtml(asset.id)}" data-media-title="${escapeHtml(asset.title || asset.filename_original || "Bild")}">Loeschen</button>
        </div>
      </div>
    </article>`).join("") : `<div class="alert">Noch keine Bilder gespeichert.</div>`}</div>
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

function aiPage() {
  return `${mediaCreateChoice("ai")}<section class="panel media-work-panel">
    <form id="media-ai-form" class="form-grid" data-media-ai-form>
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

function editPage(asset = null) {
  return `<section class="panel media-work-panel">${asset ? `<form id="central-media-edit-form" class="form-grid" data-media-edit-form data-media-id="${escapeHtml(asset.id)}">
    <div class="media-editor-layout">
      <div class="media-editor-preview">
        <div class="media-crop-stage" data-media-crop-stage style="--media-crop-aspect:${mediaAspectStyle(asset.aspect_ratio)}">
          <img src="${escapeHtml(mediaUrl(asset))}" alt="${escapeHtml(asset.alt_text || asset.title || "Medienbild")}" crossorigin="anonymous" data-media-crop-image>
          <span class="media-crop-frame" aria-hidden="true"></span>
        </div>
        <div class="media-crop-tools">
          <label><span>Zoom</span><input data-media-crop-scale type="range" min="1" max="3" step="0.01" value="${escapeHtml(asset.crop_scale ?? asset.crop_data?.scale ?? 1)}"></label>
          <div class="media-crop-actions">
            <button class="button button--primary button--small" type="button" data-media-crop-apply>OK uebernehmen</button>
            <button class="button button--secondary button--small" type="button" data-media-crop-reset>Zuruecksetzen</button>
          </div>
        </div>
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
      </div>
      <div class="form-grid">
        <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(asset.title || "")}" required></div>
        <div class="field"><label>Alt-Text</label><input name="alt_text" value="${escapeHtml(asset.alt_text || "")}"></div>
        <div class="field"><label>Beschreibung</label><textarea name="description">${escapeHtml(asset.description || "")}</textarea><button class="button button--secondary button--small" type="button" data-media-description-ai>Bildbeschreibung mit KI erzeugen</button></div>
        ${mediaMetadataBox(asset)}
        <input type="hidden" name="focal_point_x" value="${escapeHtml(asset.focal_point_x ?? 50)}">
        <input type="hidden" name="focal_point_y" value="${escapeHtml(asset.focal_point_y ?? 50)}">
        <label class="checkbox-line"><input type="checkbox" name="createVariant" value="1"> Als neue Variante speichern</label>
        <div class="media-variant-presets">
          <strong>Portal-Varianten erzeugen</strong>
          <label class="media-format-picto media-format-picto--wide"><input type="checkbox" name="variant_news" data-media-variant-aspect="16 / 9" data-media-variant-format="16x9"><i></i><span><b>News</b>16:9 Header und Thumbnail</span></label>
          <label class="media-format-picto media-format-picto--wide"><input type="checkbox" name="variant_landscape" data-media-variant-aspect="16 / 9" data-media-variant-format="landscape"><i></i><span><b>Landscape</b>Querformat fuer Beitragsbilder</span></label>
          <label class="media-format-picto media-format-picto--portrait"><input type="checkbox" name="variant_portrait" data-media-variant-aspect="9 / 16" data-media-variant-format="portrait"><i></i><span><b>Hochkant</b>Story und mobile Teaser</span></label>
          <label class="media-format-picto media-format-picto--square"><input type="checkbox" name="variant_board" data-media-variant-aspect="1 / 1" data-media-variant-format="1x1"><i></i><span><b>Vorstand</b>1:1 Profilbild</span></label>
          <label class="media-format-picto media-format-picto--logo"><input type="checkbox" name="variant_logo" data-media-variant-aspect="4 / 3" data-media-variant-format="logo"><i></i><span><b>Logo</b>Mitglieder- und Logo-Kachel</span></label>
        </div>
        <button class="button button--primary">Aenderungen speichern</button><div id="media-edit-result"></div>
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
  const selectedAsset = query.get("id") ? assets.find((asset) => asset.id === query.get("id")) : null;
  const title = mediaSections.find(([key]) => key === activeSection)?.[1] || "Mediathek";
  const content = {
    library: libraryPage(assets),
    upload: uploadPage(),
    ai: aiPage(),
    edit: editPage(selectedAsset),
    variants: variantsPage(assets, variants)
  }[activeSection];
  return protect(cmsShell(`cms/media/${activeSection}`, `${cmsTitle("Bilder", title, `<a href="#/cms/media/upload" class="button button--primary button--small">Bild hochladen</a>`)}${mediaTabs(activeSection)}${content}<p class="muted media-note">Einfaches Bildtool: hochladen, finden, bearbeiten und Varianten behalten.</p>`));
}
