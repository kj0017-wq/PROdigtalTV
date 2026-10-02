import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "public", "docs", "funktionsbeschreibung-komplett.md");
const targets = [
  path.join(root, "public", "docs", "funktionsbeschreibung.html"),
  path.join(root, "public", "docs", "funktionsbeschreibung-komplett.html")
];

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

function slug(value = "") {
  return value.toLocaleLowerCase("de")
    .replace(/[ä]/g, "ae").replace(/[ö]/g, "oe").replace(/[ü]/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function inline(value = "") {
  return escapeHtml(value)
    .replace(/„([^“]+)“/g, "<strong>„$1“</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const headings = [];
  const body = [];
  let paragraph = [];
  let listType = "";
  const closeParagraph = () => {
    if (!paragraph.length) return;
    body.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    body.push(`</${listType}>`);
    listType = "";
  };
  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (heading) {
      closeParagraph(); closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slug(text.replace(/^\d+\.\s*/, ""));
      if (level === 2) headings.push({ id, text });
      body.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }
    if (unordered || ordered) {
      closeParagraph();
      const wanted = unordered ? "ul" : "ol";
      if (listType && listType !== wanted) closeList();
      if (!listType) { listType = wanted; body.push(`<${wanted}>`); }
      body.push(`<li>${inline((unordered || ordered)[1])}</li>`);
      continue;
    }
    if (!line.trim()) {
      closeParagraph(); closeList();
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  closeParagraph(); closeList();
  return { body: body.join("\n"), headings };
}

const markdown = await readFile(sourcePath, "utf8");
const { body, headings } = markdownToHtml(markdown);
const navigation = headings.map(({ id, text }) => `<a href="#${id}">${escapeHtml(text)}</a>`).join("\n");
const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="Aktuelle Funktionsbeschreibung der PROdigitalTV-Website und des CMS">
    <title>PROdigitalTV – Funktionsbeschreibung</title>
    <style>
      :root{--red:#e30613;--navy:#071a33;--ink:#17263a;--muted:#647187;--line:#dce4ed;--soft:#f4f7fb;--white:#fff}
      *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--soft);color:var(--ink);font:16px/1.65 Arial,Helvetica,sans-serif}
      a{color:inherit}.hero{padding:54px 24px;background:linear-gradient(135deg,var(--navy),#173a62);color:#fff}.hero__inner{width:min(1180px,100%);margin:auto}.hero__brand{display:flex;align-items:center;gap:14px;margin-bottom:28px;font-weight:800;letter-spacing:.02em}.hero__mark{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:13px;background:var(--red);font-size:23px}.hero h1{max-width:900px;margin:0;font-size:clamp(34px,5vw,62px);line-height:1.03;letter-spacing:-.035em}.hero p{max-width:780px;margin:20px 0 0;color:#dbe7f5;font-size:18px}.layout{display:grid;grid-template-columns:290px minmax(0,1fr);gap:28px;width:min(1280px,calc(100% - 32px));margin:28px auto 64px}.toc{position:sticky;top:18px;align-self:start;max-height:calc(100vh - 36px);overflow:auto;padding:20px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 8px 30px rgba(7,26,51,.07)}.toc strong{display:block;margin-bottom:10px;color:var(--red);font-size:13px;letter-spacing:.08em;text-transform:uppercase}.toc a{display:block;padding:7px 8px;border-radius:8px;text-decoration:none;font-size:13px;line-height:1.35}.toc a:hover{background:var(--soft);color:var(--red)}article{min-width:0;padding:38px 46px;border:1px solid var(--line);border-radius:22px;background:#fff;box-shadow:0 8px 34px rgba(7,26,51,.07)}article>h1{display:none}h2{margin:48px 0 16px;padding-top:12px;border-top:1px solid var(--line);color:var(--navy);font-size:29px;line-height:1.18;letter-spacing:-.02em;scroll-margin-top:20px}h2:first-of-type{margin-top:0;border-top:0}h3{margin:28px 0 10px;color:var(--navy);font-size:20px;line-height:1.25}p{margin:0 0 15px}ul,ol{margin:0 0 20px;padding-left:24px}li+li{margin-top:6px}strong{color:var(--navy)}code{padding:2px 5px;border-radius:5px;background:var(--soft)}article>p:first-of-type{display:inline-block;margin:0 0 28px;padding:8px 12px;border-radius:999px;background:#ffecef;color:#9f1021;font-weight:800}.footer{padding:28px;text-align:center;color:var(--muted);font-size:13px}
      @media(max-width:900px){.layout{display:block}.toc{position:relative;top:auto;max-height:none;margin-bottom:18px}.toc a{display:none}.toc strong{margin:0}article{padding:26px 22px}.hero{padding:38px 20px}h2{font-size:25px}}
      @media print{body{background:#fff}.hero{padding:24px;background:#fff;color:#000;border-bottom:2px solid #000}.hero p{color:#333}.hero__mark{color:#fff}.layout{display:block;width:100%;margin:0}.toc{display:none}article{padding:20px;border:0;box-shadow:none}h2{break-after:avoid}h3{break-after:avoid}ul,ol,p{orphans:3;widows:3}.footer{display:none}}
    </style>
  </head>
  <body>
    <header class="hero"><div class="hero__inner"><div class="hero__brand"><span class="hero__mark">PRO</span><span>PROdigitalTV · Dokumentation</span></div><h1>Funktionsbeschreibung von Website und CMS</h1><p>Aktueller Überblick für Vorstand, Administration, Redaktion und Veranstaltungsteam.</p></div></header>
    <div class="layout"><nav class="toc" aria-label="Inhaltsverzeichnis"><strong>Inhalt</strong>${navigation}</nav><article>${body}</article></div>
    <footer class="footer">PROdigitalTV · Funktionsbeschreibung · Stand 1. Oktober 2026</footer>
  </body>
</html>`;

await Promise.all(targets.map(target => writeFile(target, html, "utf8")));
console.log(`Funktionsbeschreibung erzeugt: ${targets.length} HTML-Dateien, ${headings.length} Kapitel.`);
