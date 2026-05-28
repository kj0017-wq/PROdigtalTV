import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = "https://www.prodigitaltv.de";
const TARGET_COLLECTIONS = ["events", "editorialContent"];

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, true);
  else {
    args.set(key, next);
    index += 1;
  }
}

if (args.has("help")) {
  console.log(`PROdigitalTV Website-Import

Zweck:
  Parst Pressemitteilungen und Veranstaltungsseiten von www.prodigitaltv.de
  und importiert nur valide, strukturierte Daten in Firestore.

Modi:
  --scrape-only              Nur Website parsen, keine Firebase-Verbindung
  --import                   Import vorbereiten oder schreiben
  --restore <backup.json>    Backup wiederherstellen

Pflicht fuer --import/--restore:
  --service-account <pfad>   Firebase Service-Account JSON

Sicherheit:
  --dry-run                  Nur anzeigen, was passieren wuerde
  --yes                      Erforderlich fuer echte Schreibaktionen
  --overwrite                Bestehende Felder ueberschreiben (standard: aus)

Optional:
  --backup-dir <pfad>        Standard ./.secrets/backups
  --limit <zahl>             Max. Detailseiten pro Typ fuer Tests
  --output <pfad>            Scrape-/Import-Report als JSON schreiben

Beispiele:
  node scripts/importProdigitaltvWebsite.mjs --scrape-only --limit 10
  node scripts/importProdigitaltvWebsite.mjs --import --service-account ./.secrets/prodigitaltv-service-account.json --dry-run
  node scripts/importProdigitaltvWebsite.mjs --import --service-account ./.secrets/prodigitaltv-service-account.json --yes
  node scripts/importProdigitaltvWebsite.mjs --restore ./.secrets/backups/website-import-backup-...json --service-account ./.secrets/prodigitaltv-service-account.json --yes
`);
  process.exit(0);
}

const mode = args.has("restore") ? "restore" : args.has("import") ? "import" : "scrape-only";
const dryRun = args.has("dry-run") || mode === "scrape-only";
const yes = args.has("yes");
const overwrite = args.has("overwrite");
const limit = Number(args.get("limit") || 0);
const backupDir = resolve(args.get("backup-dir") || "./.secrets/backups");
const outputPath = args.get("output") ? resolve(args.get("output")) : "";
const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if ((mode === "import" || mode === "restore") && !serviceAccountPath) {
  throw new Error("Bitte --service-account <pfad> angeben oder GOOGLE_APPLICATION_CREDENTIALS setzen.");
}
if ((mode === "import" || mode === "restore") && !dryRun && !yes) {
  throw new Error("Echte Schreibaktionen brauchen --yes. Fuer eine Vorschau bitte --dry-run nutzen.");
}

const monthMap = new Map([
  ["januar", "01"], ["jan", "01"], ["februar", "02"], ["feb", "02"], ["maerz", "03"], ["marz", "03"], ["mae", "03"],
  ["april", "04"], ["apr", "04"], ["mai", "05"], ["juni", "06"], ["jun", "06"], ["juli", "07"], ["jul", "07"],
  ["august", "08"], ["aug", "08"], ["september", "09"], ["sep", "09"], ["oktober", "10"], ["okt", "10"],
  ["november", "11"], ["nov", "11"], ["dezember", "12"], ["dez", "12"]
]);

function normalize(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeHtml(value = "") {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
    auml: "ae", Auml: "Ae", ouml: "oe", Ouml: "Oe", uuml: "ue", Uuml: "Ue", szlig: "ss"
  };
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : match;
  });
}

function stripTags(html = "") {
  return normalize(decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " "));
}

function pageContentHtml(html = "") {
  const pageMatch = html.match(/<div\b[^>]*class=["'][^"']*\bpage\b[^"']*\blarge-9\b[^"']*\bcolumn\b[^"']*["'][^>]*>([\s\S]*?)(?:<div\b[^>]*class=["'][^"']*\blarge-3\b[^"']*\bcolumn\b|<footer\b|<\/body>)/i);
  const main = pageMatch?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<div\b[^>]*class=["'][^"']*(?:content|main|text|article)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || html;
  return main
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
}

function cleanImportedText(text = "", title = "") {
  const navigation = /^(PROdigital TV e\.V\.|-|Menu|AKTUELLES|MITGLIEDER|UNSERE MITGLIEDER|MITGLIED WERDEN|MITGLIEDER-BEREICH|VERANSTALTUNGEN|ANMELDUNG|ARCHIV|VORSTAND|PRESSE|SPONSOREN & PARTNER|LOGIN|Dates|NewsPresses)$/i;
  const lines = normalize(text).split("\n").map(normalize).filter(Boolean);
  const result = [];
  let started = false;
  for (const line of lines) {
    if (navigation.test(line)) continue;
    if (/^-\s*$/.test(line)) continue;
    if (!started && title && line === title) {
      started = true;
      continue;
    }
    if (!started && /^(PRESSEMITTEILUNG|EINLADUNG|Liebe Mitglieder|PROdigitalTV|Zur Berlinale|Veranstaltungstag:|Die Location)/i.test(line)) started = true;
    if (started) result.push(line);
  }
  const cleaned = result.length ? result.join("\n\n") : lines.filter((line) => !navigation.test(line)).join("\n\n");
  return normalize(cleaned);
}

function slugify(value = "") {
  return normalize(value).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "import";
}

function absoluteUrl(href) {
  return new URL(decodeHtml(href), BASE_URL).href.split("#")[0];
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: { "user-agent": "PROdigitalTV-import/1.0" } });
  if (!response.ok) throw new Error(`Fetch fehlgeschlagen ${response.status}: ${url}`);
  return response.text();
}

function linksFrom(html, pattern) {
  const links = new Set();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absoluteUrl(match[1]);
    if (pattern.test(url)) links.add(url);
  }
  return links;
}

function extractHeadings(html) {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .filter((title) => !["Pressemeldungen", "Dates", "NewsPresses"].includes(title));
}

function firstDate(text) {
  const numeric = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  const textual = text.toLowerCase().replace(/märz/g, "maerz").match(/\b(\d{1,2})\.\s*([a-zäöü]+)\s+(\d{4})\b/i);
  if (!textual) return "";
  const month = monthMap.get(textual[2].replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue"));
  return month ? `${textual[3]}-${month}-${textual[1].padStart(2, "0")}` : "";
}

function eventDateFrom(text) {
  const eventDay = text.match(/Veranstaltungstag:\s*(\d{1,2}\.\d{1,2}\.\d{4})(?:,\s*([^\n]+))?/i);
  if (eventDay) return { date: firstDate(eventDay[1]), city: normalize(eventDay[2] || "") };
  return { date: firstDate(text), city: "" };
}

function timeRangeFrom(text) {
  const range = text.match(/\b(?:von\s*)?(\d{1,2})[:.](\d{2})\s*(?:Uhr)?\s*(?:bis|-|–)\s*(\d{1,2})[:.](\d{2})/i);
  if (range) return { startTime: `${range[1].padStart(2, "0")}:${range[2]}`, endTime: `${range[3].padStart(2, "0")}:${range[4]}` };
  const start = text.match(/\b(\d{1,2})[:.](\d{2})\s*Uhr\b/i);
  return start ? { startTime: `${start[1].padStart(2, "0")}:${start[2]}`, endTime: "" } : { startTime: "", endTime: "" };
}

function locationFrom(text) {
  const lines = text.split("\n").map(normalize).filter(Boolean);
  const index = lines.findIndex((line) => /Die Location|Location:|Veranstaltungsort:/i.test(line));
  if (index < 0) return { locationName: "", address: "" };
  const details = [];
  for (const line of lines.slice(index + 1, index + 6)) {
    if (/Veranstaltungstag|Unser Sponsor|AGENDA|Einladung|^\*/i.test(line)) break;
    details.push(line);
  }
  return {
    locationName: details[0] || "",
    address: details.slice(1).join(", ")
  };
}

function classifyEventType(title, text) {
  const haystack = `${title} ${text}`.toLowerCase();
  if (/mitgliederversammlung|jahreshauptversammlung/.test(haystack)) return "Mitgliederveranstaltung";
  if (/mediatech hub|medientage|konferenz|kongress/.test(haystack)) return "Konferenz";
  if (/webinar|online/.test(haystack)) return "Webinar";
  if (/regionaltreffen/.test(haystack)) return "Netzwerkveranstaltung";
  return "Medienfruehstueck";
}

function statusFor(date) {
  const today = new Date().toISOString().slice(0, 10);
  if (!date || date < today) {
    return { status: "published", lifecyclePhase: "archive_published", registrationEnabled: false };
  }
  return { status: "published", lifecyclePhase: "planning", registrationEnabled: false };
}

function parsePressRelease(url, html) {
  const fullText = stripTags(html);
  const rawText = stripTags(pageContentHtml(html));
  const headings = extractHeadings(html);
  const officialId = url.match(/\/presse\/(\d+)\//)?.[1] || slugify(url);
  const title = headings.at(-1) || `Pressemeldung ${officialId}`;
  const text = cleanImportedText(rawText, title);
  const publishDate = firstDate(rawText) || firstDate(fullText) || firstDate(text);
  return {
    id: `press-${officialId}`,
    key: `press.${officialId}`,
    page: "press",
    section: "pressRelease",
    category: "Presse",
    title,
    subtitle: publishDate ? `Pressemeldung vom ${publishDate.split("-").reverse().join(".")}` : "Pressemeldung",
    introText: text.split("\n").find((line) => line.length > 90 && !line.includes(title))?.slice(0, 260) || "",
    bodyText: text,
    seoTitle: title,
    seoDescription: text.replace(/\s+/g, " ").slice(0, 155),
    publishDate,
    validFrom: publishDate,
    validTo: "",
    sourceUrl: url,
    sourceSystem: "prodigitaltv.de",
    visibility: "public",
    status: "published"
  };
}

function parseEvent(url, html) {
  const fullText = stripTags(html);
  const rawText = stripTags(pageContentHtml(html));
  const headings = extractHeadings(html);
  const officialId = url.match(/\/veranstaltungen\/(\d+)\//)?.[1] || slugify(url);
  const title = headings.at(-1) || `Veranstaltung ${officialId}`;
  const text = cleanImportedText(rawText, title);
  const { date, city: eventDayCity } = eventDateFrom(rawText).date ? eventDateFrom(rawText) : eventDateFrom(fullText);
  if (!date) return null;
  const { startTime, endTime } = timeRangeFrom(text);
  const { locationName, address } = locationFrom(text);
  const city = eventDayCity || (address.match(/\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)$/)?.[1] || "");
  return {
    id: `event-archive-${officialId}`,
    officialId,
    title,
    subtitle: "Importierte Veranstaltungsdaten von prodigitaltv.de",
    description: text.replace(/\s+/g, " ").slice(0, 500),
    date,
    validFrom: date,
    validTo: "",
    displayDate: date.split("-").reverse().join("."),
    startTime,
    endTime,
    locationName,
    address,
    city,
    eventType: classifyEventType(title, text),
    accessType: /members only|mitglieder|mitgliederversammlung|jahreshauptversammlung/i.test(`${title} ${text}`) ? "members_only" : "public",
    visibility: "public",
    showPublicTeaser: true,
    requiresLogin: /members only|mitglieder/i.test(`${title} ${text}`),
    allowPublicRegistration: false,
    allowMemberRegistration: false,
    invitationCodeRequired: false,
    ...statusFor(date),
    registrationRequired: false,
    maxParticipants: null,
    waitingListEnabled: false,
    registrationExportEnabled: false,
    topicIds: [],
    speakerIds: [],
    sponsorIds: [],
    hostId: "",
    postEventSummary: text,
    sourceUrl: url,
    sourceSystem: "prodigitaltv.de"
  };
}

async function scrapeWebsite() {
  const pressListingUrls = ["/presse", ...Array.from({ length: 12 }, (_, index) => `/presse/seite/${index + 2}`)].map((path) => `${BASE_URL}${path}`);
  const eventListingUrls = ["/veranstaltungen", "/veranstaltungen/archiv", ...Array.from({ length: 25 }, (_, index) => `/veranstaltungen/seite/${index + 2}`), ...Array.from({ length: 25 }, (_, index) => `/veranstaltungen/archiv/seite/${index + 2}`)].map((path) => `${BASE_URL}${path}`);
  const pressUrls = new Set();
  const eventUrls = new Set();

  for (const url of pressListingUrls) {
    try {
      const html = await fetchHtml(url);
      for (const link of linksFrom(html, /\/presse\/\d+\//)) pressUrls.add(link);
    } catch {}
  }
  for (const url of eventListingUrls) {
    try {
      const html = await fetchHtml(url);
      for (const link of linksFrom(html, /\/veranstaltungen\/\d+\//)) eventUrls.add(link);
    } catch {}
  }

  const pressDetails = [];
  for (const url of [...pressUrls].slice(0, limit || undefined)) {
    try {
      pressDetails.push(parsePressRelease(url, await fetchHtml(url)));
    } catch (error) {
      pressDetails.push({ sourceUrl: url, error: error.message });
    }
  }

  const eventDetails = [];
  for (const url of [...eventUrls].slice(0, limit || undefined)) {
    try {
      const parsed = parseEvent(url, await fetchHtml(url));
      if (parsed) eventDetails.push(parsed);
      else eventDetails.push({ sourceUrl: url, skipped: "Kein valides Veranstaltungsdatum gefunden" });
    } catch (error) {
      eventDetails.push({ sourceUrl: url, error: error.message });
    }
  }

  return {
    scrapedAt: new Date().toISOString(),
    press: pressDetails.filter((item) => !item.error && !item.skipped),
    events: eventDetails.filter((item) => !item.error && !item.skipped),
    skipped: [...pressDetails, ...eventDetails].filter((item) => item.error || item.skipped)
  };
}

async function initDb() {
  const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
  const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";
  const [{ initializeApp, cert }, { getFirestore, FieldValue, Timestamp }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore")
  ]);
  initializeApp({ credential: cert(serviceAccount), projectId });
  return { db: getFirestore(), FieldValue, Timestamp, projectId };
}

function serializeValue(value, Timestamp) {
  if (Timestamp && value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((item) => serializeValue(item, Timestamp));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item, Timestamp)]));
  return value;
}

async function readCollection(db, collectionName, Timestamp) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...serializeValue(document.data(), Timestamp) }));
}

async function backupCollections(db, Timestamp) {
  const collections = {};
  for (const collectionName of TARGET_COLLECTIONS) collections[collectionName] = await readCollection(db, collectionName, Timestamp);
  const path = resolve(backupDir, `website-import-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  if (!dryRun) {
    await mkdir(backupDir, { recursive: true });
    await writeFile(path, JSON.stringify({ exportedAt: new Date().toISOString(), collections }, null, 2), "utf8");
  }
  return { path, collections };
}

function isEmpty(value) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function mergeRecord(existing, incoming) {
  const result = { ...(existing || {}) };
  const importedExisting = existing?.sourceImport?.origin === "prodigitaltv.de" || existing?.sourceSystem === "prodigitaltv.de";
  const refreshImportedFields = new Set([
    "bodyText", "introText", "seoDescription", "description", "postEventSummary",
    "publishDate", "validFrom", "validTo", "date", "displayDate", "startTime", "endTime",
    "locationName", "address", "city"
  ]);
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "id") continue;
    if (overwrite || isEmpty(result[key]) || (importedExisting && refreshImportedFields.has(key))) result[key] = value;
  }
  result.sourceImport = {
    origin: "prodigitaltv.de",
    sourceUrl: incoming.sourceUrl,
    importedAt: new Date().toISOString(),
    overwrite
  };
  return result;
}

async function planImport(db, Timestamp, scraped) {
  const existingEvents = await readCollection(db, "events", Timestamp);
  const existingEditorial = await readCollection(db, "editorialContent", Timestamp);
  const eventsById = new Map(existingEvents.map((item) => [item.id, item]));
  const eventsByOfficialId = new Map(existingEvents.filter((item) => item.officialId).map((item) => [String(item.officialId), item]));
  const editorialById = new Map(existingEditorial.map((item) => [item.id, item]));

  const eventWrites = scraped.events.map((event) => {
    const existing = eventsByOfficialId.get(String(event.officialId)) || eventsById.get(event.id);
    const id = existing?.id || event.id;
    return { collection: "events", id, action: existing ? "update" : "create", before: existing || null, after: mergeRecord(existing, event) };
  });
  const pressWrites = scraped.press.map((item) => {
    const existing = editorialById.get(item.id);
    return { collection: "editorialContent", id: item.id, action: existing ? "update" : "create", before: existing || null, after: mergeRecord(existing, item) };
  });
  return [...eventWrites, ...pressWrites];
}

async function commitWrites(db, FieldValue, writes) {
  let batch = db.batch();
  let pending = 0;
  for (const write of writes) {
    batch.set(db.collection(write.collection).doc(write.id), {
      ...write.after,
      websiteImportedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    pending += 1;
    if (pending >= 450) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
}

async function restoreBackup(db, FieldValue, backupPath) {
  const backup = JSON.parse(await readFile(resolve(backupPath), "utf8"));
  let restored = 0;
  let deletedImported = 0;
  for (const collectionName of TARGET_COLLECTIONS) {
    const backupDocs = new Map((backup.collections?.[collectionName] || []).map((item) => [item.id, item]));
    const current = await db.collection(collectionName).get();
    let batch = db.batch();
    let pending = 0;
    for (const document of current.docs) {
      const data = document.data();
      if (!backupDocs.has(document.id) && data?.sourceImport?.origin === "prodigitaltv.de") {
        batch.delete(document.ref);
        pending += 1;
        deletedImported += 1;
      }
      if (pending >= 450) {
        if (!dryRun) await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    for (const [id, data] of backupDocs) {
      batch.set(db.collection(collectionName).doc(id), { ...data, websiteRestoredAt: FieldValue.serverTimestamp() });
      pending += 1;
      restored += 1;
      if (pending >= 450) {
        if (!dryRun) await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    if (pending && !dryRun) await batch.commit();
  }
  return { restored, deletedImported };
}

if (mode === "restore") {
  const { db, FieldValue, projectId } = await initDb();
  const result = await restoreBackup(db, FieldValue, args.get("restore"));
  console.log(JSON.stringify({ mode, dryRun, projectId, ...result }, null, 2));
  process.exit(0);
}

const scraped = await scrapeWebsite();
if (mode === "scrape-only") {
  const result = {
    mode,
    pressCount: scraped.press.length,
    eventCount: scraped.events.length,
    skippedCount: scraped.skipped.length,
    samplePress: scraped.press.slice(0, 5).map(({ id, title, publishDate, sourceUrl }) => ({ id, title, publishDate, sourceUrl })),
    sampleEvents: scraped.events.slice(0, 5).map(({ id, title, date, city, sourceUrl }) => ({ id, title, date, city, sourceUrl })),
    skipped: scraped.skipped.slice(0, 10)
  };
  if (outputPath) await writeFile(outputPath, JSON.stringify({ ...result, scraped }, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const { db, FieldValue, Timestamp, projectId } = await initDb();
const backup = await backupCollections(db, Timestamp);
const writes = await planImport(db, Timestamp, scraped);
if (!dryRun) await commitWrites(db, FieldValue, writes);

const report = {
  mode,
  dryRun,
  projectId,
  backupPath: dryRun ? `${backup.path} (dry-run, nicht geschrieben)` : backup.path,
  scrapedPress: scraped.press.length,
  scrapedEvents: scraped.events.length,
  skippedCount: scraped.skipped.length,
  creates: writes.filter((item) => item.action === "create").length,
  updates: writes.filter((item) => item.action === "update").length,
  sampleWrites: writes.slice(0, 20).map(({ collection, id, action, after }) => ({ collection, id, action, title: after.title, date: after.date || after.publishDate || "" }))
};
if (outputPath) await writeFile(outputPath, JSON.stringify({ ...report, scraped, writes }, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
