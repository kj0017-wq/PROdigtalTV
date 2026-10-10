const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const LABEL_WIDTH_MM = 80;
const LABEL_HEIGHT_MM = 50;
const PAGE_LEFT_MM = 25;
const PAGE_TOP_MM = 23.5;
const LABELS_PER_PAGE = 10;
const LOGO_URL = "/assets/official/brand/prodigitaltv-logo-claim.png";

function clean(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

export function buildNameBadgePages(people = [], startPosition = 1) {
  const start = Math.min(10, Math.max(1, Number(startPosition) || 1));
  const slots = Array.from({ length: start - 1 }, () => null).concat(people);
  if (!slots.length) slots.push(null);
  const pages = [];
  for (let index = 0; index < slots.length; index += LABELS_PER_PAGE) {
    pages.push(Array.from({ length: LABELS_PER_PAGE }, (_, offset) => slots[index + offset] || null));
  }
  return pages;
}

export function nameBadgeFontSize(text = "", { company = false } = {}) {
  const length = clean(text).length;
  if (company) return length <= 26 ? 11 : length <= 42 ? 9.5 : length <= 62 ? 8.25 : 7.25;
  return length <= 18 ? 25 : length <= 25 ? 21 : length <= 33 ? 17.5 : length <= 42 ? 14.5 : length <= 55 ? 11.5 : 9;
}

function labelMarkup(person, { guides = false } = {}) {
  if (!person) return `<div class="name-badge-label name-badge-label--empty${guides ? " is-guided" : ""}" aria-hidden="true"></div>`;
  const name = clean(person.name) || "Teilnehmende Person";
  const company = clean(person.company);
  return `<article class="name-badge-label${guides ? " is-guided" : ""}${company ? "" : " name-badge-label--without-company"}">
    <div class="name-badge-label__content">
      <img class="name-badge-label__logo" src="${LOGO_URL}" alt="PROdigitalTV">
      <strong class="name-badge-label__name" style="font-size:${nameBadgeFontSize(name)}pt">${escapeHtml(name)}</strong>
      ${company ? `<span class="name-badge-label__company" style="font-size:${nameBadgeFontSize(company, { company: true })}pt">${escapeHtml(company)}</span>` : ""}
    </div>
  </article>`;
}

function sheetMarkup(page, { guides = false, preview = false, eventTitle = "", eventDate = "" } = {}) {
  return `<section class="name-badge-sheet${preview ? " name-badge-sheet--preview" : ""}" aria-label="A4-Etikettenbogen">${page.map(person => labelMarkup(person, { guides })).join("")}<div class="name-badge-sheet__info"><span>Avery Zweckform L4785-20 · 80 × 50 mm</span><strong>${escapeHtml(eventTitle)}</strong><span>${escapeHtml(badgeEventDate(eventDate))}</span></div></section>`;
}

function badgeEventDate(value = "") {
  const date = new Date(String(value).slice(0, 10) + "T12:00:00");
  return Number.isNaN(date.getTime()) ? clean(value) : date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("PROdigitalTV-Logo konnte nicht geladen werden."));
    image.src = source;
  });
}

function nameSplitCandidates(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(1).map((_, index) => [words.slice(0, index + 1).join(" "), words.slice(index + 1).join(" ")]);
  const candidates = [];
  for (let index = Math.ceil(text.length * 0.35); index <= Math.floor(text.length * 0.65); index += 1) candidates.push([text.slice(0, index), text.slice(index)]);
  return candidates;
}

function fitCanvasName(context, text, maxWidth, pixelsPerPoint) {
  for (let size = 25; size >= 14; size -= 0.5) {
    context.font = `400 ${size * pixelsPerPoint}px Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) return { lines: [text], size };
  }
  const candidates = nameSplitCandidates(text);
  for (let size = 18; size >= 5; size -= 0.5) {
    context.font = `400 ${size * pixelsPerPoint}px Arial, sans-serif`;
    const fitting = candidates.filter(lines => lines.every(line => context.measureText(line).width <= maxWidth));
    if (fitting.length) {
      fitting.sort((left, right) => Math.abs(context.measureText(left[0]).width - context.measureText(left[1]).width) - Math.abs(context.measureText(right[0]).width - context.measureText(right[1]).width));
      return { lines: fitting[0], size };
    }
  }
  return { lines: [text], size: Math.max(3, 5 * maxWidth / Math.max(1, context.measureText(text).width)) };
}

function companyLines(context, company, maxWidth, startPt, pixelsPerPoint) {
  let size = startPt;
  const words = company.split(/\s+/).filter(Boolean);
  while (size >= 7) {
    context.font = `500 ${size * pixelsPerPoint}px Arial, sans-serif`;
    const lines = [];
    let line = "";
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    });
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every(value => context.measureText(value).width <= maxWidth)) return { lines, size };
    size -= 0.5;
  }
  context.font = `500 7px Arial, sans-serif`;
  return { lines: [company.slice(0, 58), company.slice(58, 116)].filter(Boolean), size: 7 };
}

function drawBadge(context, person, logo, x, y, width, height, pxPerMm) {
  if (!person) return;
  const name = clean(person.name) || "Teilnehmende Person";
  const company = clean(person.company);
  const centerX = x + width / 2;
  const maxTextWidth = 72 * pxPerMm;
  const logoMaxWidth = 40 * pxPerMm;
  const logoMaxHeight = 8.5 * pxPerMm;
  const logoScale = Math.min(logoMaxWidth / logo.naturalWidth, logoMaxHeight / logo.naturalHeight);
  const logoWidth = logo.naturalWidth * logoScale;
  const logoHeight = logo.naturalHeight * logoScale;
  const logoTop = y + (company ? 5 : 9) * pxPerMm;
  context.drawImage(logo, centerX - logoWidth / 2, logoTop, logoWidth, logoHeight);
  context.fillStyle = "#071a33";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  const pixelsPerPoint = pxPerMm * 25.4 / 72;
  const nameLayout = fitCanvasName(context, name, maxTextWidth, pixelsPerPoint);
  context.font = `400 ${nameLayout.size * pixelsPerPoint}px Arial, sans-serif`;
  const nameLineHeight = nameLayout.size * pixelsPerPoint * 1.04;
  const nameCenter = y + (company ? 27 : 33) * pxPerMm;
  const firstNameBaseline = nameCenter - ((nameLayout.lines.length - 1) * nameLineHeight) / 2;
  nameLayout.lines.forEach((line, index) => context.fillText(line, centerX, firstNameBaseline + index * nameLineHeight));
  if (!company) return;
  const result = companyLines(context, company, maxTextWidth, 11, pixelsPerPoint);
  context.font = `500 ${result.size * pixelsPerPoint}px Arial, sans-serif`;
  const lineHeight = result.size * pixelsPerPoint * 1.15;
  const firstBaseline = y + 37 * pxPerMm - ((result.lines.length - 1) * lineHeight) / 2;
  result.lines.slice(0, 2).forEach((line, index) => context.fillText(line, centerX, firstBaseline + index * lineHeight));
}

async function renderPageJpeg(page, { eventTitle = "", eventDate = "" } = {}) {
  const dpi = 150;
  const pxPerMm = dpi / 25.4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_WIDTH_MM * pxPerMm);
  canvas.height = Math.round(PAGE_HEIGHT_MM * pxPerMm);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("PDF-Vorschau kann in diesem Browser nicht erzeugt werden.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const logo = await loadImage(LOGO_URL);
  page.forEach((person, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawBadge(context, person, logo,
      (PAGE_LEFT_MM + column * LABEL_WIDTH_MM) * pxPerMm,
      (PAGE_TOP_MM + row * LABEL_HEIGHT_MM) * pxPerMm,
      LABEL_WIDTH_MM * pxPerMm, LABEL_HEIGHT_MM * pxPerMm, pxPerMm);
  });
  context.fillStyle = "#555";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = `400 ${7 * pxPerMm * 25.4 / 72}px Arial, sans-serif`;
  context.fillText("Avery Zweckform L4785-20 · 80 × 50 mm", PAGE_LEFT_MM * pxPerMm, 6 * pxPerMm);
  context.fillText(clean(eventTitle), PAGE_LEFT_MM * pxPerMm, 10 * pxPerMm, 160 * pxPerMm);
  context.fillText(badgeEventDate(eventDate), PAGE_LEFT_MM * pxPerMm, 14 * pxPerMm);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
  const binary = atob(dataUrl.split(",")[1]);
  return { width: canvas.width, height: canvas.height, bytes: Uint8Array.from(binary, character => character.charCodeAt(0)) };
}

function ascii(value) {
  return new TextEncoder().encode(value);
}

function pdfFromImages(images) {
  const chunks = [];
  const offsets = [0];
  let length = 0;
  const push = value => { const bytes = typeof value === "string" ? ascii(value) : value; chunks.push(bytes); length += bytes.length; };
  const objectCount = 2 + images.length * 3;
  const objects = new Map();
  objects.set(1, [`<< /Type /Catalog /Pages 2 0 R >>`]);
  const pageIds = images.map((_, index) => 3 + index * 3);
  objects.set(2, [`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`]);
  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const commands = `q\n595.276 0 0 841.89 0 0 cm\n/${imageName} Do\nQ\n`;
    objects.set(pageId, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
    objects.set(contentId, [`<< /Length ${ascii(commands).length} >>\nstream\n${commands}endstream`]);
    objects.set(imageId, [`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`, image.bytes, `\nendstream`]);
  });
  push("%PDF-1.4\n");
  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    objects.get(id).forEach(push);
    push("\nendobj\n");
  }
  const xref = length;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach(chunk => { output.set(chunk, offset); offset += chunk.length; });
  return new Blob([output], { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function safeFilename(value = "Event") {
  return clean(value).replace(/[^a-z0-9äöüß_-]+/gi, "-").replace(/^-+|-+$/g, "") || "Event";
}

export function openNameBadgePrintDialog({ people = [], eventTitle = "Event", eventDate = "" } = {}) {
  if (document.querySelector("[data-name-badge-dialog]")) return;
  const normalized = people.map((person, index) => ({ id: person.id || `person-${index}`, name: clean(person.name), company: clean(person.company) })).filter(person => person.name);
  if (!normalized.length) throw new Error("Für dieses Event sind keine druckbaren Teilnehmer vorhanden.");
  const dialog = document.createElement("dialog");
  dialog.className = "name-badge-dialog";
  dialog.dataset.nameBadgeDialog = "";
  dialog.innerHTML = `<form method="dialog" class="name-badge-dialog__header"><div><p class="eyebrow">Avery Zweckform L4785-20</p><h2>Namensetiketten drucken</h2><p>${escapeHtml(eventTitle)} · 80 × 50 mm · 10 Etiketten pro A4-Bogen</p></div><button class="button button--secondary" value="cancel">Abbrechen</button></form>
    <div class="name-badge-dialog__body">
      <aside class="name-badge-controls">
        <label class="checkbox"><input type="checkbox" data-name-badge-all checked> Alle Teilnehmer auswählen</label>
        <div class="name-badge-person-list">${normalized.map(person => `<label><input type="checkbox" data-name-badge-person value="${escapeHtml(person.id)}" checked><span><strong>${escapeHtml(person.name)}</strong>${person.company ? `<small>${escapeHtml(person.company)}</small>` : ""}</span></label>`).join("")}</div>
        <label class="field"><span>Startposition auf dem ersten Bogen</span><select data-name-badge-start>${Array.from({ length: 10 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("")}</select></label>
        <label class="checkbox"><input type="checkbox" data-name-badge-guides> Hilfslinien in der Vorschau anzeigen</label>
        <p class="muted">Beim Drucken: Papierformat A4, Maßstab 100 %, keine Seitenränder sowie Kopf- und Fußzeilen ausschalten.</p>
        <p class="name-badge-dialog__status" role="status" aria-live="polite"></p>
      </aside>
      <main class="name-badge-preview"><div data-name-badge-preview></div></main>
    </div>
    <footer class="name-badge-dialog__footer"><button class="button button--primary" type="button" data-name-badge-print>Drucken</button><button class="button button--secondary" type="button" data-name-badge-pdf>PDF erzeugen</button><button class="button button--secondary" type="button" data-name-badge-cancel>Abbrechen</button></footer>`;
  document.body.append(dialog);
  const preview = dialog.querySelector("[data-name-badge-preview]");
  const all = dialog.querySelector("[data-name-badge-all]");
  const checks = [...dialog.querySelectorAll("[data-name-badge-person]")];
  const start = dialog.querySelector("[data-name-badge-start]");
  const guides = dialog.querySelector("[data-name-badge-guides]");
  const status = dialog.querySelector(".name-badge-dialog__status");
  const printButton = dialog.querySelector("[data-name-badge-print]");
  const pdfButton = dialog.querySelector("[data-name-badge-pdf]");
  const selected = () => checks.filter(check => check.checked).map(check => normalized.find(person => person.id === check.value)).filter(Boolean);
  const pages = () => buildNameBadgePages(selected(), start.value);
  const update = () => {
    const chosen = selected();
    all.checked = chosen.length === normalized.length;
    all.indeterminate = chosen.length > 0 && chosen.length < normalized.length;
    printButton.disabled = pdfButton.disabled = chosen.length === 0;
    preview.innerHTML = pages().map(page => sheetMarkup(page, { guides: guides.checked, preview: true, eventTitle, eventDate })).join("");
    status.textContent = chosen.length ? `${chosen.length} Etikett${chosen.length === 1 ? "" : "en"} auf ${pages().length} A4-Bogen${pages().length === 1 ? "" : "en"}.` : "Bitte mindestens eine Person auswählen.";
  };
  all.addEventListener("change", () => { checks.forEach(check => { check.checked = all.checked; }); update(); });
  checks.forEach(check => check.addEventListener("change", update));
  start.addEventListener("change", update);
  guides.addEventListener("change", update);
  const close = () => dialog.close();
  dialog.querySelector("[data-name-badge-cancel]").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  printButton.addEventListener("click", async () => {
    const printRoot = document.createElement("div");
    printRoot.id = "name-badge-print-root";
    printRoot.innerHTML = pages().map(page => sheetMarkup(page, { eventTitle, eventDate })).join("");
    document.body.append(printRoot);
    status.textContent = "Druckvorschau wird vorbereitet …";
    await Promise.all([...printRoot.querySelectorAll("img")].map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); })));
    document.body.classList.add("name-badge-printing");
    const cleanup = () => { document.body.classList.remove("name-badge-printing"); printRoot.remove(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.print();
    status.textContent = "Druckdialog geöffnet.";
    window.setTimeout(() => { if (printRoot.isConnected) cleanup(); }, 60000);
  });
  pdfButton.addEventListener("click", async () => {
    printButton.disabled = pdfButton.disabled = true;
    status.textContent = "PDF wird erzeugt …";
    try {
      const images = [];
      for (const page of pages()) images.push(await renderPageJpeg(page, { eventTitle, eventDate }));
      downloadBlob(pdfFromImages(images), `Namensetiketten-${safeFilename(eventTitle)}.pdf`);
      status.textContent = "PDF wurde erzeugt.";
    } catch (error) { status.textContent = error.message || "PDF konnte nicht erzeugt werden."; }
    finally { printButton.disabled = pdfButton.disabled = selected().length === 0; }
  });
  update();
  dialog.showModal();
}