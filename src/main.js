import { route, onRouteChange, go } from "./utils/router.js";
import { currentUser, canUseCms, isAdmin, login, loginWithGoogle, logout, refreshAuthToken, waitForAuthReady } from "./firebase/authService.js?v=471";
import { getOne, list, upsert, remove } from "./firebase/dataService.js?v=511";
import { escapeHtml, formatDate } from "./utils/format.js";

const root = document.querySelector("#app");
const mobilePublicOrigin = "https://prodigitaltv-da47b.web.app";
const mediaProxyFunctionUrl = "https://europe-west3-prodigitaltv-da47b.cloudfunctions.net/mediaAssetProxy";
const defaultAiEditorialThumbnailPrompt = "Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV: serioeser moderner Business-Look, TV-, Streaming- und digitale Medienbranche, klare Komposition, natuerliches Licht, keine echten Logos, keine realen Personen, keine Comic-Optik, keine irrefuehrenden Bildinhalte.";

const lazy = {};
const publicPages = () => lazy.publicPages ||= import("./pages/publicPages.js?v=654");
const cmsPages = () => lazy.cmsPages ||= import("./cms/cmsPages.js?v=597");
const aiEditorialPages = () => lazy.aiEditorialPages ||= import("./cms/aiEditorialPages.js?v=491");
const mediaPages = () => lazy.mediaPages ||= import("./cms/mediaPages.js?v=103");
const registrationService = () => lazy.registrationService ||= import("./firebase/registrationService.js");
const storageService = () => lazy.storageService ||= import("./firebase/storageService.js?v=13");
const firebaseClientService = () => lazy.firebaseClientService ||= import("./firebase/firebaseClient.js?v=1");
const setupService = () => lazy.setupService ||= import("./firebase/setupService.js");
const csvService = () => lazy.csvService ||= import("./utils/csv.js");
const openaiService = () => lazy.openaiService ||= import("./ai/openaiService.js?v=326");
const ttsService = () => lazy.ttsService ||= import("./ai/ttsService.js?v=2");
const audioService = () => lazy.audioService ||= import("./ai/audioService.js");
const aiSourceCatalogService = () => lazy.aiSourceCatalog ||= import("./data/aiSourceCatalog.js");

const createRegistration = async (...args) => (await registrationService()).createRegistration(...args);
const deleteStoredAsset = async (...args) => (await storageService()).deleteStoredAsset(...args);
const uploadEntityImage = async (...args) => (await storageService()).uploadEntityImage(...args);
const uploadEventMedia = async (...args) => (await storageService()).uploadEventMedia(...args);
const uploadGalleryImages = async (...args) => (await storageService()).uploadGalleryImages(...args);
const uploadMediaAsset = async (...args) => (await storageService()).uploadMediaAsset(...args);
const getFirebaseStorageServices = async () => (await firebaseClientService()).getFirebaseServices();
const checkFirebaseConnection = async (...args) => (await setupService()).checkFirebaseConnection(...args);
const checkFirestoreStructure = async (...args) => (await setupService()).checkFirestoreStructure(...args);
const initializeDatabase = async (...args) => (await setupService()).initializeDatabase(...args);
const downloadRegistrationsCsv = async (...args) => (await csvService()).downloadRegistrationsCsv(...args);
const callChatGptAction = async (...args) => (await openaiService()).callChatGptAction(...args);
const generateCmsThumbCollage = async (...args) => (await openaiService()).generateCmsThumbCollage(...args);
const saveAiDraft = async (...args) => (await openaiService()).saveAiDraft(...args);
const runAiEditorialTask = async (...args) => (await openaiService()).runAiEditorialTask(...args);
const runMorningBriefingTask = async (...args) => (await openaiService()).runMorningBriefingTask(...args);
const saveAiEditorialSettings = async (...args) => (await openaiService()).saveAiEditorialSettings(...args);
const generateAiEditorialThumbnail = async (...args) => (await openaiService()).generateAiEditorialThumbnail(...args);
const generateAiTopicSuggestions = async (...args) => (await openaiService()).generateAiTopicSuggestions(...args);
const importGermanPressReleases = async (...args) => (await openaiService()).importGermanPressReleases(...args);
const importNewsFromSources = async (...args) => (await openaiService()).importNewsFromSources(...args);
const importNewsUrlText = async (...args) => (await openaiService()).importNewsUrlText(...args);
const generateArticleSpeechAsset = async (...args) => (await ttsService()).generateArticleSpeechAsset(...args);
const saveProviderConfig = async (...args) => (await audioService()).saveProviderConfig(...args);
const testAudioProviderConnection = async (...args) => (await audioService()).testConnection(...args);
const loadAudioProviderVoices = async (...args) => (await audioService()).loadVoices(...args);
const previewAudioProviderVoice = async (...args) => (await audioService()).previewVoice(...args);
const getAiSourceCatalog = async () => (await aiSourceCatalogService()).aiSourceCatalog;

function storedTheme() {
  return localStorage.getItem("pdtv-theme") || localStorage.getItem("pdtTheme") || "day";
}

function applyTheme(theme = storedTheme()) {
  const currentRoute = route();
  const nextTheme = currentRoute.path === "cms" ? "day" : theme === "night" ? "night" : "day";
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme === "night" ? "dark" : "light";
  document.body?.classList.toggle("theme-night", nextTheme === "night");
  document.body?.classList.toggle("theme-light", nextTheme !== "night");
  document.querySelectorAll("[data-theme-label]").forEach((label) => {
    label.textContent = nextTheme === "night" ? "Day" : "Night";
  });
  document.querySelectorAll("[data-theme-icon]").forEach((icon) => {
    icon.textContent = nextTheme === "night" ? "\u263e" : "\u2600";
  });
}

function mobileCmsDisabled() {
  return window.matchMedia?.("(max-width: 820px), (pointer: coarse)")?.matches;
}

function mobileCmsPlaceholder() {
  return `<section class="login-wrap"><div class="form-card login-card">
    <p class="eyebrow">CMS</p>
    <h1>CMS nur am Desktop</h1>
    <p style="margin:14px 0 24px">Die mobile CMS-Version wird spaeter als reduzierte Oberflaeche umgesetzt.</p>
    <a class="button button--primary" href="#/home">Zur Website</a>
  </div></section>`;
}

async function mobileQualityPage() {
  const user = currentUser();
  if (!canUseCms(user)) {
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Qualitaetspruefung</p><h1>Login erforderlich</h1><p style="margin:14px 0 24px">Bitte im CMS anmelden. Danach diese Seite erneut oeffnen.</p><a class="button button--primary" href="#/login">Zum Login</a></div></section>`;
  }
  const names = ["events", "editorialContent", "topics", "members", "galleries", "eventMedia", "media_assets", "downloads", "memberDocuments", "videos", "sponsors"];
  const loadOne = async (name) => {
    try {
      const records = await Promise.race([
        list(name),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error("Timeout")), 3500))
      ]);
      return [name, Array.isArray(records) ? records : [], ""];
    } catch (error) {
      return [name, [], String(error?.message || error || "nicht lesbar")];
    }
  };
  const loaded = await Promise.all(names.map(loadOne));
  const data = Object.fromEntries(loaded.map(([name, records]) => [name, records]));
  const issues = [];
  const push = (area, type, title, fault, description, severity = "warning", href = "") => issues.push({ area, type, title: title || "Ohne Titel", fault, description, severity, href });
  loaded.filter(([, , error]) => error).forEach(([name, , error]) => push("System", "Collection", name, "Nicht eindeutig pruefbar", `Collection konnte mobil nicht gelesen werden: ${error}`, "warning"));
  const visiblePublic = (item = {}) => ["published", "active", "aktiv", "approved"].includes(String(item.status || "").toLowerCase()) && ["public", "oeffentlich", "", "Ã¶ffentlich"].includes(String(item.visibility || item.sichtbarkeit || "").toLowerCase());
  const liveMember = (item = {}) => item.visible !== false && item.isLive !== false && !["inactive", "cancelled", "archived", "deleted"].includes(String(item.status || "").toLowerCase());
  const image = (item = {}) => item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || item.logoUrl || item.logoDisplayUrl || item.photoUrl || item.file_path_web_url || item.file_path_thumb_url || "";
  (data.events || []).forEach((item) => {
    if (visiblePublic(item) && !image(item)) push("Events", "Event", item.title, "Eventbild fehlt", "Event ist oeffentlich, aber kein Bild ist hinterlegt.", "error");
  });
  (data.editorialContent || []).forEach((item) => {
    const visible = visiblePublic(item) || item.visible === true || item.visibility === "members";
    const internal = ["home", "about", "join", "imprint", "privacy", "legal", "contact", "login", "members", "board"].includes(item.page) || ["intro", "hero", "legal", "internal", "footer"].includes(item.section);
    if (visible && !internal && !image(item)) push(item.visibility === "members" ? "Mitgliederbereich" : "Redaktion", item.visibility === "members" ? "Mitgliederbeitrag" : "Beitrag", item.title, "Beitragsbild fehlt", "Sichtbarer Beitrag hat kein Bild.", "error");
    if (image(item) && !(item.thumbnailUrl || item.thumbnail_url)) push("Redaktion", "Beitrag", item.title, "Thumbnail fehlt", "Originalbild ist vorhanden, aber kein Thumbnail-Feld.", "warning", image(item));
  });
  (data.topics || []).forEach((item) => {
    if (!["inactive", "archived", "deleted", "hidden"].includes(String(item.status || "").toLowerCase()) && !image(item)) push("Themen", "Thema", item.title, "Themenbild fehlt", "Aktives Thema hat kein Themenbild.", "error");
  });
  (data.sponsors || []).forEach((item) => {
    if (String(item.status || "").toLowerCase() === "published" && !image(item)) push("Events", "Sponsor", item.name || item.title, "Sponsorenlogo fehlt", "Veroeffentlichter Sponsor hat kein Logo.", "error");
  });
  (data.galleries || []).forEach((item) => {
    const images = Array.isArray(item.images) ? item.images : [];
    if (visiblePublic(item) && !images.length) push("Galerien", "Galerie", item.title, "Galerie ist leer", "Diese Galerie enthaelt keine Bilder.", "error");
    images.forEach((entry, index) => {
      const src = entry.url || entry.imageUrl || entry.assetUrl || entry.downloadUrl || "";
      if (!src) push("Galerien", "Galeriebild", item.title, "Galeriebild fehlt", `Bild ${index + 1} hat keinen Bildpfad.`, "error");
    });
  });
  [...(data.downloads || []), ...(data.memberDocuments || [])].forEach((item) => {
    const url = item.documentUrl || item.assetUrl || item.fileUrl || item.downloadUrl || item.url || "";
    if (!url) push("Downloads", "Download", item.title || item.fileName, "Download-Datei fehlt", "Download-Datensatz hat keine Datei-URL.", "error");
  });
  (data.videos || []).forEach((item) => {
    if (!(item.youtubeVideoId || item.youtubeUrl || item.url || item.videoId)) push("Medien", "Video", item.title, "Video-ID fehlt", "Videoeintrag hat keine YouTube-ID oder URL.", "error");
    if ((item.youtubeVideoId || item.youtubeUrl || item.url) && !(item.posterImageUrl || item.thumbnailUrl || item.youtubeThumbnailUrl)) push("Medien", "Video", item.title, "Videostartbild fehlt", "Videoeintrag hat kein gespeichertes Startbild.", "warning");
  });
  const rows = issues.sort((a, b) => a.severity === b.severity ? String(a.area).localeCompare(String(b.area), "de") : a.severity === "error" ? -1 : 1).map((issue) => `<tr><td>${escapeHtml(issue.area)}</td><td>${escapeHtml(issue.type)}</td><td>${escapeHtml(issue.title)}</td><td>${escapeHtml(issue.fault)}</td><td>${escapeHtml(issue.description)}</td><td>${escapeHtml(issue.href || "-")}</td><td>${issue.severity === "error" ? "Fehler" : "Warnung"}</td></tr>`).join("");
  return `<main class="cms-app"><section class="cms-main"><div class="cms-title"><div><p class="eyebrow">Mobile Nur-Lese-Ansicht</p><h1>Qualitaetspruefung</h1><p>Schnelle mobile Auswertung ohne externe Netzwerkpruefung und ohne Bearbeitung.</p></div></div><section class="panel"><div class="setup-steps"><div class="setup-step"><span>Fehler</span><strong>${issues.filter((issue) => issue.severity === "error").length}</strong></div><div class="setup-step"><span>Warnungen</span><strong>${issues.filter((issue) => issue.severity !== "error").length}</strong></div><div class="setup-step"><span>Collections</span><strong>${names.length}</strong></div></div></section><section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Bereich</th><th>Typ</th><th>Titel</th><th>Fehler</th><th>Beschreibung</th><th>Pfad</th><th>Einstufung</th></tr></thead><tbody>${rows || `<tr><td colspan="7">Keine Fehler oder Warnungen gefunden.</td></tr>`}</tbody></table></div></section></section></main>`;
}
async function viewForRoute(current) {
  window.__pdtCmsStage = `route:${current.path}/${current.id || ""}`;
  if (current.path === "cms" && mobileCmsDisabled() && current.id !== "quality") return mobileCmsPlaceholder();
  if (current.path === "cms" && current.id === "quality" && mobileCmsDisabled()) return mobileQualityPage();
  if (current.path === "cms" && current.id === "media") {
    const { mediaPage } = await mediaPages();
    return mediaPage(current.section || "library", current.query);
  }
  if (current.path === "cms" && current.id === "ai-editorial") {
    const { aiEditorialPage } = await aiEditorialPages();
    return aiEditorialPage(current.section || "dashboard", current.query);
  }
  if (current.path === "cms") {
    window.__pdtCmsStage = "import:cmsPages";
    const {
      dashboardPage, eventsAdminPage, eventFollowUpPage, eventEditPage, registrationsPage,
      moduleListPage, contentEditPage, setupPage, chatGptPage, aiSettingsPage, aiAccessPage, mailAdminPage, audioAdminPage, memberAreaAdminPage, qualityPage
    } = await cmsPages();
    window.__pdtCmsStage = `cms:${current.id || "dashboard"}`;
    if (!current.id) return dashboardPage();
    if (current.id === "events") return eventsAdminPage();
    if (current.id === "event") {
      try {
        sessionStorage.setItem("pdt-last-event-editor-id", current.section || "");
        sessionStorage.setItem("pdt-last-event-editor-tab", current.query.get("tab") || "base");
        sessionStorage.setItem("pdt-last-event-editor-at", String(Date.now()));
      } catch {}
      return eventEditPage(current.section, current.query.get("tab") || "base", current.query);
    }
    if (current.id === "registrations") return registrationsPage();
    if (current.id === "followup") return eventFollowUpPage();
    if (current.id === "topics") return moduleListPage("topics");
    if (current.id === "galleries") return moduleListPage("galleries");
    if (current.id === "speakers") return moduleListPage("speakers");
    if (current.id === "sponsors") return moduleListPage("sponsors");
    if (current.id === "members") {
      window.__pdtCmsStage = "cms:members:list";
      return moduleListPage("members");
    }
    if (current.id === "membership-applications") return moduleListPage("membershipApplications");
    if (current.id === "member-area") return memberAreaAdminPage();
    if (current.id === "member-documents") return moduleListPage("memberDocuments");
    if (current.id === "member-directories") return moduleListPage("memberDirectories");
    if (current.id === "users") return moduleListPage("users");
    if (current.id === "quality") return qualityPage();
    if (current.id === "board") return moduleListPage("boardMembers");
    if (current.id === "editorial") return moduleListPage("editorialContent", current.section || "press");
    if (current.id === "mail") return moduleListPage("mailQueue");
    if (current.id === "audio") return audioAdminPage();
    if (current.id === "mail-admin") return mailAdminPage();
    if (current.id === "chatgpt") return chatGptPage();
    if (current.id === "ai-access") return aiAccessPage();
    if (current.id === "ai-settings") return aiSettingsPage();
    if (current.id === "edit") return contentEditPage(current.query.get("module"), current.query.get("id"), current.query);
    if (current.id === "setup") return setupPage();
  }
  const {
    homePage, eventsPage, eventDetailPage, registrationPage, topicsPage, topicDetailPage,
    newsPage, newsDetailPage, aboutPage, internalDetailPage, membersPage, boardPage, archivePage,
    downloadsPage, joinPage, loginPage, memberPortalPage, memberArticleDetailPage, legalPage,
    notFoundPage, webappQrPage
  } = await publicPages();
  if (current.path === "home") return homePage();
  if (current.path === "events") return eventsPage();
  if (current.path === "event") return eventDetailPage(current.id);
  if (current.path === "register") return registrationPage(current.id);
  if (current.path === "topics") return topicsPage();
  if (current.path === "topic") return topicDetailPage(current.id);
  if (current.path === "news" && current.id) return newsDetailPage(current.id);
  if (current.path === "news") return newsPage(current.query);
  if (current.path === "retrospective" && current.id) return newsDetailPage(current.id);
  if (current.path === "about" && current.id) return internalDetailPage("ueber_uns", current.id);
  if (current.path === "ueber-uns" && current.id) return internalDetailPage("ueber_uns", current.id);
  if (current.path === "ueber-uns") return aboutPage();
  if (current.path === "about") return aboutPage();
  if (current.path === "board") return boardPage();
  if (current.path === "members") return membersPage();
  if (current.path === "join" && current.id) return internalDetailPage("mitglied_werden", current.id);
  if (current.path === "mitglied-werden" && current.id) return internalDetailPage("mitglied_werden", current.id);
  if (current.path === "mitglied-werden") return joinPage();
  if (current.path === "join") return joinPage();
  if (current.path === "downloads") return downloadsPage();
  if (current.path === "archive") return archivePage();
  if (current.path === "webapp-qr") return webappQrPage();
  if (current.path === "login") return loginPage();
  if (current.path === "portal" && current.id === "article") return memberArticleDetailPage(current.section);
  if (current.path === "portal") return memberPortalPage();
  if (current.path === "imprint") return legalPage("imprint");
  if (current.path === "privacy") return legalPage("privacy");
  return notFoundPage();
}

function redirectPublicRouteOutOfCms(current) {
  if (current.path === "cms") return false;
  if (!String(window.location.pathname || "").endsWith("/cms.html")) return false;
  window.location.replace(`${window.location.origin}/${window.location.search}${window.location.hash || "#/home"}`);
  return true;
}

async function render() {
  let currentRoute;
  try {
    applyTheme();
    stopAllAudioPlayback();
    currentRoute = route();
    if (redirectPublicRouteOutOfCms(currentRoute)) return;
    if (root && !root.innerHTML) {
      root.innerHTML = `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">CMS</p><h1>Lade Inhalte ...</h1></div></section>`;
    }
    const viewPromise = viewForRoute(currentRoute);
    root.innerHTML = await viewPromise;
    wireActions();
    updateMobileQrCode();
    window.scrollTo({ top: 0 });
    schedulePublicGermanTextNormalization();
    clearRoutePending();
  } catch (error) {
    clearRoutePending();
    console.error(error);
    const isLocalCmsRoute = currentRoute?.path === "cms" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    root.innerHTML = `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Seite konnte nicht geladen werden</p><h1>Bitte neu laden</h1><p style="margin:14px 0 24px">${escapeHtml(error.message || String(error))}</p>${isLocalCmsRoute ? `<button class="button button--primary" type="button" onclick="window.location.reload()">Neu laden</button>` : `<a class="button button--primary" href="#/login">Zum Login</a>`}</div></section>`;
  }
}

async function goOrRefresh(path) {
  const targetHash = `#/${path}`;
  if (window.location.hash === targetHash) {
    await render();
  } else {
    go(path);
  }
}

function mobileUrlForCurrentRoute() {
  const current = route();
  const query = current.query;
  let hash = location.hash || "#/home";
  let path = location.pathname || "/";
  if (current.path === "cms") {
    path = "/";
    if (current.id === "events") hash = "#/events";
    else if (current.id === "event" && current.section) hash = `#/event/${current.section}`;
    else if (current.id === "topics") hash = "#/topics";
    else if (current.id === "members") hash = "#/members";
    else if (current.id === "board") hash = "#/board";
    else if (current.id === "editorial" && current.section === "news") hash = "#/news";
    else if (current.id === "edit" && query.get("module") === "topics" && query.get("id")) hash = `#/topic/${query.get("id")}`;
    else if (current.id === "edit" && query.get("module") === "editorialContent" && query.get("section") === "news" && query.get("id")) hash = `#/news/${query.get("id")}`;
    else hash = "#/home";
  }
  const search = location.search || "";
  const origin = ["localhost", "127.0.0.1", ""].includes(location.hostname) || location.protocol === "file:"
    ? mobilePublicOrigin
    : location.origin;
  return `${origin}${path}${search}${hash}`;
}

function updateMobileQrCode() {
  const link = document.querySelector("[data-mobile-qr-link]");
  const image = document.querySelector("[data-mobile-qr-code]");
  if (!link || !image) return;
  if (window.matchMedia?.("(max-width: 899px)").matches) return;
  const mobileUrl = mobileUrlForCurrentRoute();
  link.href = mobileUrl;
  link.title = mobileUrl;
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=1&data=${encodeURIComponent(mobileUrl)}`;
}

function showRoutePending(link) {
  if (!root || !link) return;
  const href = link.getAttribute("href") || "";
  const target = href.replace(/^#\/?/, "").split("?")[0].split("/")[0] || "home";
  if (!window.matchMedia?.("(max-width: 820px), (pointer: coarse)")?.matches) return;
  if (target === "cms" || target === "login") return;
  root.setAttribute("aria-busy", "true");
  document.body.classList.add("is-route-pending");
  let indicator = document.querySelector("[data-route-pending]");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.dataset.routePending = "1";
    indicator.className = "route-pending-indicator";
    indicator.innerHTML = `<span></span>`;
    document.body.appendChild(indicator);
  }
}

function clearRoutePending() {
  root?.removeAttribute("aria-busy");
  document.body?.classList.remove("is-route-pending");
  document.querySelector("[data-route-pending]")?.remove();
}

function clickedAnchor(event) {
  return event.target?.closest?.("a[href]") || null;
}

function linkTargetHash(link) {
  try {
    return new URL(link.getAttribute("href") || "", window.location.href).hash;
  } catch {
    return link?.getAttribute("href") || "";
  }
}

function isCurrentInternalRouteLink(link) {
  const targetHash = linkTargetHash(link) || "#/home";
  return targetHash === (window.location.hash || "#/home");
}

function isExternalPortalLink(link) {
  const href = link?.getAttribute("href") || "";
  if (!href || href.startsWith("#/") || href.startsWith("#")) return false;
  if (/^(mailto|tel):/i.test(href)) return false;
  try {
    const url = new URL(href, window.location.href);
    return ["http:", "https:"].includes(url.protocol) && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function germanizeVisibleText(text = "") {
  let next = String(text);
  next = next
    .replace(/R\ufffdckblicke/g, "R\u00fcckblicke")
    .replace(/R\ufffdckblick/g, "R\u00fcckblick")
    .replace(/r\ufffdckblick/g, "r\u00fcckblick");
  [
    ["\u00c3\u0192\u00e2\u20ac\u017e", "\u00c4"],
    ["\u00c3\u0192\u00e2\u20ac\u201c", "\u00d6"],
    ["\u00c3\u0192\u00c5\u201c", "\u00dc"],
    ["\u00c3\u0192\u00c2\u00a4", "\u00e4"],
    ["\u00c3\u0192\u00c2\u00b6", "\u00f6"],
    ["\u00c3\u0192\u00c2\u00bc", "\u00fc"],
    ["\u00c3\u0192\u00c5\u00b8", "\u00df"],
    ["\u00c3\u201e", "\u00c4"],
    ["\u00c3\u2013", "\u00d6"],
    ["\u00c3\u0153", "\u00dc"],
    ["\u00c3\u00a4", "\u00e4"],
    ["\u00c3\u00b6", "\u00f6"],
    ["\u00c3\u00bc", "\u00fc"],
    ["\u00c3\u0178", "\u00df"],
    ["\u00c2\u00b7", "\u00b7"],
    ["\u00e2\u02dc\u20ac", "\u2600"],
    ["\u00e2\u02dc\u00be", "\u263e"],
    ["&rarr;", "\u2192"]
  ].forEach(([broken, fixed]) => {
    next = next.split(broken).join(fixed);
  });
  [
    [/\bUeber\b/g, "\u00dcber"], [/\bueber\b/g, "\u00fcber"],
    [/\bFuer\b/g, "F\u00fcr"], [/\bfuer\b/g, "f\u00fcr"],
    [/\bWofuer\b/g, "Wof\u00fcr"], [/\bwofuer\b/g, "wof\u00fcr"],
    [/\bGaeste\b/g, "G\u00e4ste"], [/\bgaeste\b/g, "g\u00e4ste"],
    [/\bMuenchen\b/g, "M\u00fcnchen"], [/\bMuenchner\b/g, "M\u00fcnchner"],
    [/\bKoeln\b/g, "K\u00f6ln"], [/\bDuesseldorf\b/g, "D\u00fcsseldorf"],
    [/\bRueckblicke\b/g, "R\u00fcckblicke"], [/\bRueckblick\b/g, "R\u00fcckblick"], [/\brueckblick\b/g, "r\u00fcckblick"],
    [/\bMedienfruehstuecke\b/g, "Medienfr\u00fchst\u00fccke"], [/\bMedienfruehstuecks\b/g, "Medienfr\u00fchst\u00fccks"], [/\bMedienfruehstueck\b/g, "Medienfr\u00fchst\u00fcck"],
    [/\bmedienfruehstuecke\b/g, "medienfr\u00fchst\u00fccke"], [/\bmedienfruehstuecks\b/g, "medienfr\u00fchst\u00fccks"], [/\bmedienfruehstueck\b/g, "medienfr\u00fchst\u00fcck"],
    [/\bZurueck\b/g, "Zur\u00fcck"], [/\bzurueck\b/g, "zur\u00fcck"],
    [/\bOeffentlichkeit\b/g, "\u00d6ffentlichkeit"], [/\bOeffentliche\b/g, "\u00d6ffentliche"], [/\boeffentlich\b/g, "\u00f6ffentlich"],
    [/\bOeffnen\b/g, "\u00d6ffnen"], [/\boeffnen\b/g, "\u00f6ffnen"],
    [/\bPersoenlich\b/g, "Pers\u00f6nlich"], [/\bpersoenlich\b/g, "pers\u00f6nlich"], [/\bpersoenliche\b/g, "pers\u00f6nliche"], [/\bpersoenlichen\b/g, "pers\u00f6nlichen"],
    [/\bPersoenlichkeiten\b/g, "Pers\u00f6nlichkeiten"], [/\bpersoenlichkeiten\b/g, "pers\u00f6nlichkeiten"], [/\bBranchenpersoenlichkeiten\b/g, "Branchenpers\u00f6nlichkeiten"],
    [/\bGespraeche\b/g, "Gespr\u00e4che"], [/\bgespraeche\b/g, "gespr\u00e4che"], [/\bGespraech\b/g, "Gespr\u00e4ch"], [/\bgespraech\b/g, "gespr\u00e4ch"],
    [/\bBestaetigt\b/g, "Best\u00e4tigt"], [/\bbestaetigt\b/g, "best\u00e4tigt"], [/\bBestaetigen\b/g, "Best\u00e4tigen"], [/\bbestaetigen\b/g, "best\u00e4tigen"], [/\bbestaetigte\b/g, "best\u00e4tigte"],
    [/\bgeprueft\b/g, "gepr\u00fcft"], [/\bPruefung\b/g, "Pr\u00fcfung"], [/\bpruefen\b/g, "pr\u00fcfen"], [/\bPruefen\b/g, "Pr\u00fcfen"],
    [/\bKuenstliche\b/g, "K\u00fcnstliche"], [/\bkuenstliche\b/g, "k\u00fcnstliche"], [/\bkuenftig\b/g, "k\u00fcnftig"], [/\bKuerze\b/g, "K\u00fcrze"], [/\bkuerzen\b/g, "k\u00fcrzen"],
    [/\bgeschuetzten\b/g, "gesch\u00fctzten"], [/\bgeschuetzte\b/g, "gesch\u00fctzte"], [/\bgeschuetzt\b/g, "gesch\u00fctzt"],
    [/\bmoeglich\b/g, "m\u00f6glich"], [/\bMoeglichkeit\b/g, "M\u00f6glichkeit"], [/\bmoeglichen\b/g, "m\u00f6glichen"],
    [/\bkoennen\b/g, "k\u00f6nnen"], [/\bKoennen\b/g, "K\u00f6nnen"], [/\bkoennte\b/g, "k\u00f6nnte"], [/\bKoennte\b/g, "K\u00f6nnte"],
    [/\bmuesse\b/g, "m\u00fcsse"], [/\bmuessen\b/g, "m\u00fcssen"], [/\bMuessen\b/g, "M\u00fcssen"], [/\bduerfen\b/g, "d\u00fcrfen"], [/\bDuerfen\b/g, "D\u00fcrfen"],
    [/\bunterstuetzt\b/g, "unterst\u00fctzt"], [/\bUnterstuetzung\b/g, "Unterst\u00fctzung"],
    [/\belbstverstaendnis\b/g, "elbstverst\u00e4ndnis"], [/\bselbstverstaendlich\b/g, "selbstverst\u00e4ndlich"],
    [/\bunabhaengig\b/g, "unabh\u00e4ngig"], [/\bunabhaengiger\b/g, "unabh\u00e4ngiger"], [/\bunabhaengiges\b/g, "unabh\u00e4ngiges"],
    [/\bstaendig\b/g, "st\u00e4ndig"], [/\bverstaendlich\b/g, "verst\u00e4ndlich"], [/\bfruehzeitig\b/g, "fr\u00fchzeitig"],
    [/\bausgewaehlte\b/g, "ausgew\u00e4hlte"], [/\bhaeufig\b/g, "h\u00e4ufig"], [/\bAtmosphaere\b/g, "Atmosph\u00e4re"], [/\bFuehrungskraefte\b/g, "F\u00fchrungskr\u00e4fte"],
    [/\bveraendert\b/g, "ver\u00e4ndert"], [/\bveraendern\b/g, "ver\u00e4ndern"], [/\bVeraenderung\b/g, "Ver\u00e4nderung"], [/\bveraenderte\b/g, "ver\u00e4nderte"],
    [/\bberuehren\b/g, "ber\u00fchren"], [/\bueberdehnen\b/g, "\u00fcberdehnen"], [/\berschliessen\b/g, "erschlie\u00dfen"],
    [/\bQualitaet\b/g, "Qualit\u00e4t"], [/\bKreativitaet\b/g, "Kreativit\u00e4t"], [/\bProduktivitaet\b/g, "Produktivit\u00e4t"],
    [/\bVerguetung\b/g, "Verg\u00fctung"], [/\bVerfuegung\b/g, "Verf\u00fcgung"], [/\bverfuegbar\b/g, "verf\u00fcgbar"],
    [/\bveroeffentlicht\b/g, "ver\u00f6ffentlicht"], [/\bVeroeffentlicht\b/g, "Ver\u00f6ffentlicht"], [/\bVeroeffentlichungen\b/g, "Ver\u00f6ffentlichungen"],
    [/\btraegt\b/g, "tr\u00e4gt"], [/\bhaette\b/g, "h\u00e4tte"], [/\bwaeren\b/g, "w\u00e4ren"], [/\bwaechst\b/g, "w\u00e4chst"],
    [/\bMedienhaeusern\b/g, "Medienh\u00e4usern"], [/\bMedienhaeuser\b/g, "Medienh\u00e4user"], [/\bmittelstaendische\b/g, "mittelst\u00e4ndische"],
    [/\bMassnahmen\b/g, "Ma\u00dfnahmen"], [/\bgross\b/g, "gro\u00df"], [/\bGross\b/g, "Gro\u00df"], [/\bAusserdem\b/g, "Au\u00dferdem"], [/\bausserdem\b/g, "au\u00dferdem"],
    [/\btrasse\b/g, "tra\u00dfe"], [/\bMass\b/g, "Ma\u00df"]
  ].forEach(([pattern, fixed]) => {
    next = next.replace(pattern, fixed);
  });
  return next;
}
function normalizePublicGermanText() {
  if (!root || route().path === "cms") return;
  const walker = document.createTreeWalker(root, NodeFilter.HOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["CRIPT", "TYLE", "TEXTAREA", "INPUT", "CODE"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const next = germanizeVisibleText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  });
}

let activePublicTts = null;

function clearInlineTtsHighlight(state = activePublicTts) {
  state?.inlineRestore?.forEach(({ node, html }) => {
    if (node) node.innerHTML = html;
  });
  if (state) {
    state.inlineRestore = [];
    state.inlineWordNodes = [];
  }
}

function closePublicTts() {
  if (!activePublicTts) return;
  activePublicTts.audio?.pause();
  activePublicTts.timer && clearInterval(activePublicTts.timer);
  clearInlineTtsHighlight(activePublicTts);
  activePublicTts.node?.remove();
  if (activePublicTts.button) {
    activePublicTts.button.classList.remove("is-playing", "is-paused");
    activePublicTts.button.setAttribute("aria-pressed", "false");
    if (activePublicTts.originalLabel) activePublicTts.button.innerHTML = activePublicTts.originalLabel;
  }
  activePublicTts = null;
}

function stopAllAudioPlayback() {
  closePublicTts();
  document.querySelectorAll("audio").forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
    if (audio.dataset.listAudioPlayer === "1") audio.remove();
  });
  document.querySelectorAll(".audio-play-button.is-playing").forEach((button) => button.classList.remove("is-playing"));
  document.querySelectorAll("[data-audio-provider-preview-player]").forEach((audio) => {
    audio.hidden = true;
    audio.removeAttribute("src");
    audio.load?.();
  });
  document.querySelectorAll("[data-youtube-video].is-playing").forEach((box) => {
    const iframe = box.querySelector("iframe");
    try {
      iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "stopVideo", args: [] }), "*");
    } catch {}
    if (iframe) {
      iframe.removeAttribute("src");
      iframe.load?.();
    }
    box.classList.remove("is-playing", "is-fullscreen-requested");
  });
  if (document.fullscreenElement?.matches?.("[data-youtube-video]")) {
    try { document.exitFullscreen?.(); } catch {}
  }
}

function schedulePublicGermanTextNormalization() {
  if (!root || route().path === "cms") return;
  const run = () => normalizePublicGermanText();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 800 });
  } else {
    window.setTimeout(run, 0);
  }
}

function ttsWords(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(isSpeakableTtsWord);
}

function isSpeakableTtsWord(word = "") {
  return /[\p{L}\p{N}]/u.test(String(word || ""));
}

function ttsWordWeights(words = []) {
  return words.map((word) => {
    const cleanLength = Math.max(1, String(word).replace(/[^\p{L}\p{N}]/gu, "").length);
    const punctuationPause = /[.!?;:]$/.test(word) ? 3.2 : /[,)]$/.test(word) ? 1.8 : 0;
    return Math.max(1.2, cleanLength * 0.42) + punctuationPause;
  });
}

function cropTimedWordsToSource(timedWords = [], sourceWords = []) {
  if (!timedWords.length || !sourceWords.length) return { timedWords, stopAtTime: 0, legacyOverrun: false };
  if (timedWords.length <= sourceWords.length + 8) return { timedWords, stopAtTime: 0, legacyOverrun: false };
  const cropped = timedWords.slice(0, sourceWords.length);
  return { timedWords: cropped, stopAtTime: cropped.at(-1)?.end || 0, legacyOverrun: true };
}

function ttsWordIndexForTime(state) {
  const leadSeconds = Number(state.displayLeadSeconds || 0);
  if (state.timedWords?.length) {
    const current = (state.audio.currentTime || 0) + leadSeconds;
    const index = state.timedWords.findIndex((slot) => current >= slot.start && current < slot.end);
    if (index >= 0) return index;
    return current >= state.timedWords[state.timedWords.length - 1].end ? state.timedWords.length - 1 : 0;
  }
  const duration = Number.isFinite(state.audio.duration) && state.audio.duration > 0
    ? state.audio.duration
    : Math.max(1, state.words.length * 0.62);
  if (!state.wordWeights?.length || state.weightedDuration !== duration) {
    const weights = ttsWordWeights(state.words);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    let cursor = 0;
    state.wordWeights = weights.map((weight) => {
      const start = cursor;
      const seconds = (weight / totalWeight) * duration;
      cursor += seconds;
      return { start, end: cursor };
    });
    state.weightedDuration = duration;
  }
  const current = (state.audio.currentTime || 0) + leadSeconds;
  const index = state.wordWeights.findIndex((slot) => current >= slot.start && current < slot.end);
  return index >= 0 ? index : Math.max(0, Math.min(state.words.length - 1, state.words.length - 1));
}

function stopPublicTtsAtSourceEnd(state) {
  if (!state?.stopAtTime || !state.audio) return;
  if ((state.audio.currentTime || 0) >= state.stopAtTime + 0.16) {
    closePublicTts();
  }
}

function ttsSourceText(reader) {
  const template = reader?.querySelector("[data-tts-source]");
  return template?.content?.textContent || template?.textContent || "";
}

function inlineTtsTokenMarkup(text = "") {
  const parts = String(text || "").match(/\S+|\s+/g) || [];
  return parts.map((part) => {
    if (!part.trim()) return escapeHtml(part);
    return `<span class="tts-inline-token" data-tts-inline-word>${escapeHtml(part)}</span>`;
  }).join("");
}

function prepareInlineTtsHighlight(reader) {
  const container = reader?.closest(".topic-article, .news-detail, .news-detail-clean, .internal-about-text");
  const article = container?.querySelector(".editorial-text") || container;
  if (!article) return { restore: [], nodes: [] };
  const paragraphs = Array.from(article.querySelectorAll("p"))
    .filter((paragraph) => paragraph.textContent.trim() && !paragraph.closest("[data-tts-reader], .tts-natural-player, .tts-reading-layer"));
  const restore = paragraphs.map((node) => ({ node, html: node.innerHTML }));
  paragraphs.forEach((paragraph) => {
    paragraph.innerHTML = inlineTtsTokenMarkup(paragraph.textContent || "");
  });
  return { restore, nodes: Array.from(article.querySelectorAll("[data-tts-inline-word]")) };
}

function timingToTimedWords(timing = {}) {
  const characters = Array.isArray(timing.characters) ? timing.characters : [];
  const starts = Array.isArray(timing.character_start_times_seconds) ? timing.character_start_times_seconds : [];
  const ends = Array.isArray(timing.character_end_times_seconds) ? timing.character_end_times_seconds : [];
  const words = [];
  let current = "";
  let start = null;
  let end = null;
  const pushWord = () => {
    const text = current.trim();
    if (text) words.push({ text, start: Number(start) || 0, end: Number(end ?? start) || 0 });
    current = "";
    start = null;
    end = null;
  };
  characters.forEach((character, index) => {
    const value = String(character || "");
    if (!value.trim()) {
      pushWord();
      return;
    }
    if (start === null) start = starts[index] ?? ends[index] ?? 0;
    end = ends[index] ?? starts[index] ?? start;
    current += value;
  });
  pushWord();
  return words.filter((word) => word.end >= word.start);
}

async function loadTtsTiming(url = "") {
  if (!url) return [];
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return [];
    return timingToTimedWords(await response.json());
  } catch (error) {
    console.warn("TTS-Timing konnte nicht geladen werden", error);
    return [];
  }
}

function updateAccessibleTtsWord(state) {
  if (!state?.words.length) return;
  const index = ttsWordIndexForTime(state);
  if (state.wordNode) state.wordNode.textContent = state.words[index] || state.words[0] || "";
  if (state.wordNodes?.length) {
    const wordNode = state.wordNodes[index];
    state.wordNodes.forEach((node, nodeIndex) => node.classList.toggle("is-active", nodeIndex === index));
    wordNode?.scrollIntoView({ block: "center", inline: "nearest" });
  }
  if (state.inlineWordNodes?.length) {
    const inlineIndex = Math.max(0, index - Number(state.inlineWordOffset || 0));
    state.inlineWordNodes.forEach((node, nodeIndex) => node.classList.toggle("is-active", nodeIndex === inlineIndex));
    const inlineNode = state.inlineWordNodes[inlineIndex];
    if (inlineNode) {
      const rect = inlineNode.getBoundingClientRect();
      const topLimit = 92;
      const bottomLimit = window.innerHeight - 92;
      if (rect.top < topLimit || rect.bottom > bottomLimit) {
        inlineNode.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
    }
  }
}

async function startPublicTts(button) {
  const reader = button.closest("[data-tts-reader]");
  const mode = button.dataset.ttsMode || "natural";
  let audioUrl = button.dataset.audioUrl || "";
  if (mode === "natural" && !audioUrl) {
    audioUrl = reader?.querySelector('[data-tts-mode="accessible"]')?.dataset.audioUrl || "";
  }
  if (!reader || !audioUrl) throw new Error("Keine Audiodatei fuer diesen Inhalt vorhanden.");
  if (activePublicTts && (button.classList.contains("is-playing") || button.classList.contains("is-paused"))) {
    if (button.classList.contains("is-paused")) {
      await activePublicTts.audio.play();
      button.classList.add("is-playing");
      button.classList.remove("is-paused");
      button.setAttribute("aria-pressed", "true");
      button.innerHTML = activePublicTts.activeLabel || activePublicTts.originalLabel || button.innerHTML;
      return;
    }
    activePublicTts.audio?.pause();
    button.classList.remove("is-playing");
    button.classList.add("is-paused");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = activePublicTts.pausedLabel || activePublicTts.originalLabel || button.innerHTML;
    return;
  }

  stopAllAudioPlayback();
  const originalLabel = button.dataset.ttsOriginalLabel || button.innerHTML;
  const isAccessible = mode === "accessible";
  const activeLabel = isAccessible
    ? '<span class="tts-control-icon tts-control-icon--search" aria-hidden="true"></span>'
    : '<span class="tts-control-icon tts-control-icon--pause" aria-hidden="true"></span>';
  const pausedLabel = isAccessible
    ? originalLabel
    : '<span class="tts-control-icon tts-control-icon--play" aria-hidden="true"></span>';
  button.dataset.ttsOriginalLabel = originalLabel;
  button.classList.add("is-playing");
  button.classList.remove("is-paused");
  button.setAttribute("aria-pressed", "true");
  button.innerHTML = activeLabel;

  const audio = new Audio(audioUrl);
  audio.preload = "metadata";
  const rawTimedWords = (await loadTtsTiming(button.dataset.timingUrl || reader?.dataset.timingUrl || ""))
    .filter((word) => isSpeakableTtsWord(word.text));
  const sourceWords = ttsWords(ttsSourceText(reader));
  const timingScope = cropTimedWordsToSource(rawTimedWords, sourceWords);
  const timedWords = timingScope.timedWords;
  const words = timedWords.length ? timedWords.map((word) => word.text) : sourceWords;
  const inlineHighlight = { restore: [], nodes: [] };
  const inlineWordOffset = Number(reader?.dataset.ttsInlineOffset || 0) || 0;
  const readingText = words.map((word, index) => `<span class="tts-reading-layer__token" data-tts-word-index="${index}">${escapeHtml(word)}</span>`).join(" ");
  const node = document.createElement("div");
  node.className = isAccessible ? "tts-reading-layer" : "tts-natural-player";
  node.setAttribute("role", isAccessible ? "dialog" : "status");
  node.innerHTML = isAccessible
    ? `<div class="tts-reading-layer__box" aria-modal="false">
        <div class="tts-reading-layer__head"><div><p class="eyebrow">Gro&szlig;er Text</p><strong>Lesedisplay</strong></div><button type="button" class="tts-reading-layer__stop" data-tts-stop aria-label="Audio stoppen">Stop</button></div>
        <div class="tts-reading-layer__word" data-tts-current-word>${escapeHtml(words[0] || "Bereit")}</div>
        <div class="tts-reading-layer__text" data-tts-text>${readingText}</div>
      </div>`
    : "";
  if (node.innerHTML) reader.after(node);

  activePublicTts = {
    audio,
    node: node.innerHTML ? node : null,
    reader,
    mode,
    button,
    originalLabel,
    activeLabel,
    pausedLabel,
    words,
    timedWords,
    stopAtTime: timingScope.stopAtTime,
    displayLeadSeconds: isAccessible ? (timedWords.length ? 0 : 0.45) : 0,
    inlineRestore: inlineHighlight.restore,
    inlineWordNodes: inlineHighlight.nodes,
    inlineWordOffset,
    wordNode: node.querySelector("[data-tts-current-word]"),
    wordNodes: Array.from(node.querySelectorAll("[data-tts-word-index]")),
    timer: null
  };

  audio.addEventListener("ended", closePublicTts, { once: true });
  audio.addEventListener("error", () => {
    if (activePublicTts?.node) activePublicTts.node.innerHTML = `<div class="alert alert--warning">Audio ist fuer diesen Text noch nicht verfuegbar. Bitte im CMS neu erzeugen.</div>`;
  }, { once: true });
  if (isAccessible) {
    activePublicTts.timer = setInterval(() => updateAccessibleTtsWord(activePublicTts), 140);
    audio.addEventListener("timeupdate", () => {
      updateAccessibleTtsWord(activePublicTts);
      stopPublicTtsAtSourceEnd(activePublicTts);
    });
  } else if (activePublicTts.stopAtTime) {
    audio.addEventListener("timeupdate", () => stopPublicTtsAtSourceEnd(activePublicTts));
  }
  await audio.play();
}

document.addEventListener("click", (event) => {
  const stopButton = event.target.closest?.("[data-tts-stop]");
  if (!stopButton) return;
  event.preventDefault();
  closePublicTts();
});

document.addEventListener("click", (event) => {
  const link = clickedAnchor(event);
  if (!link || !isExternalPortalLink(link)) return;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  event.stopPropagation();
  stopAllAudioPlayback();
  window.open(link.href, link.target || "_blank", "noopener,noreferrer");
}, true);

document.addEventListener("click", (event) => {
  const link = clickedAnchor(event);
  if (!link || !link.matches('a[href^="#/"]')) return;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (isCurrentInternalRouteLink(link)) {
    event.preventDefault();
    clearRoutePending();
    window.scrollTo({ top: 0 });
    return;
  }
  stopAllAudioPlayback();
  showRoutePending(link);
});

window.addEventListener("hashchange", stopAllAudioPlayback, true);
window.addEventListener("pagehide", stopAllAudioPlayback);
window.addEventListener("beforeunload", stopAllAudioPlayback);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") stopAllAudioPlayback();
});

function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach((item) => {
    data[item.name] = item.checked;
  });
  return data;
}

function youtubeVideoIdFromValue(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  const match = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/i)
    || text.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
  return match?.[1] || "";
}

function collectVideoAttachments(form, values = {}) {
  const rows = Array.from(form.querySelectorAll("[data-video-attachment-row]"));
  const videos = rows.map((row, index) => {
    const url = String(values[`videoYoutubeUrl${index}`] || "").trim();
    const youtubeVideoId = youtubeVideoIdFromValue(url);
    const poster = String(values[`videoPosterImageUrl${index}`] || "").trim()
      || (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "");
    const title = String(values[`videoTitle${index}`] || "").trim();
    const caption = String(values[`videoCaption${index}`] || "").trim();
    const description = String(values[`videoDescription${index}`] || "").trim();
    const sortOrder = Number(values[`videoSortOrder${index}`] || index + 1);
    if (!youtubeVideoId && !title && !caption && !poster && !description) return null;
    return {
      id: String(values[`videoId${index}`] || `video-${crypto.randomUUID()}`),
      youtubeVideoId,
      youtubeUrl: url,
      embedUrl: youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : "",
      title,
      caption,
      description,
      posterImageUrl: poster,
      posterImageAlt: String(values[`videoPosterImageAlt${index}`] || title || caption || "Video starten").trim(),
      posterImageCaption: String(values[`videoPosterImageCaption${index}`] || "").trim(),
      posterImageSource: poster && youtubeVideoId && poster.includes(youtubeVideoId) ? "youtube_thumbnail" : poster ? "custom" : "",
      youtubeThumbnailUrl: youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "",
      sourceType: "youtube_import",
      privacyStatus: String(values[`videoPrivacyStatus${index}`] || "unlisted"),
      visibility: String(values[`videoVisibility${index}`] || "public"),
      status: String(values[`videoStatus${index}`] || "ready"),
      uploadStatus: youtubeVideoId ? "ready" : "not_uploaded",
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : index + 1,
      updatedAt: new Date().toISOString()
    };
  }).filter(Boolean);
  Object.keys(values).forEach((key) => {
    if (/^video(?:Id|YoutubeUrl|Title|Caption|Description|PosterImageUrl|PosterImageAlt|PosterImageCaption|SortOrder|PrivacyStatus|Visibility|Status)\d+$/.test(key)) {
      delete values[key];
    }
  });
  return videos.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function countWords(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function normalizeFourKeywords(values = "", fallbackText = "") {
  const stop = new Set(["gepr", "pruef", "pruefen", "geprueft", "redaktionell", "wird", "sind", "sein", "eine", "eines", "einen", "einem", "einer", "diese", "dieser", "diesen", "werden", "wurde", "wurden", "haben", "hatte", "hatten", "ueber", "fuer", "nicht", "auch", "oder", "und", "der", "die", "das", "dem", "den", "des", "mit", "von", "zur", "zum", "aus", "bei", "auf", "als", "dass", "wenn", "weil", "nach", "vor", "wie", "was"]);
  const raw = [
    ...String(values || "").split(/[,;\s]+/),
    ...String(fallbackText || "").split(/\s+/)
  ];
  const seen = new Set();
  return raw
    .map((word) => word.replace(/[^A-Za-z0-9Ã„Ã–ÃœÃ¤Ã¶Ã¼ÃŸ-]/g, "").replace(/^-+|-+$/g, "").trim())
    .filter((word) => word.length >= 4 && word.length <= 22)
    .filter((word) => !stop.has(word.toLowerCase()))
    .filter((word) => !/^(gepr|pruef|redakt|quelle|quellen|status)$/i.test(word))
    .filter((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function newsSourceSentences(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/^Pressemitteilung[:\s-]*/i, "").trim())
    .filter((sentence) => sentence.length > 45)
    .filter((sentence, index, list) => list.findIndex((item) => item.toLowerCase() === sentence.toLowerCase()) === index)
    .slice(0, 14);
}

function cleanNewsSentence(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(und|oder|aber|denn|weil|dass)\s+/i, "")
    .replace(/[â€žâ€œ"']+/g, "")
    .trim();
}

function keyNewsFacts(sourceText = "", limit = 5) {
  const sentences = newsSourceSentences(sourceText);
  const scored = sentences.map((sentence, index) => {
    const score = (/\b\d{4}|\b\d{1,2}\.\s*[A-ZÃ„Ã–Ãœa-zÃ¤Ã¶Ã¼]+|\b[A-ZÃ„Ã–Ãœ]{2,}\b|Landgericht|GEMA|Suno|EU|AI|KI|Urteil|Klage|Pflicht|Recht|Lizenz|Verguetung|Streaming|TV|Medien|Plattform|Musik|Urheber/i.test(sentence) ? 30 : 0)
      + Math.max(0, 12 - index)
      + Math.min(18, Math.round(sentence.length / 18));
    return { sentence: cleanNewsSentence(sentence), score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sentence)
    .filter(Boolean)
    .slice(0, limit);
}

function trimTextToWordGoal(value = "", targetWords = 300) {
  const target = Math.max(120, Math.min(900, Number(targetWords || 300)));
  const paragraphs = String(value || "").split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const kept = [];
  for (const paragraph of paragraphs) {
    const next = [...kept, paragraph].join("\n\n");
    if (countWords(next) <= target + 25) {
      kept.push(paragraph);
      continue;
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
    for (const sentence of sentences) {
      const sentenceNext = [...kept, sentence].join("\n\n");
      if (countWords(sentenceNext) <= target + 10) kept.push(sentence);
      if (countWords(kept.join("\n\n")) >= target - 15) break;
    }
    break;
  }
  let text = kept.join("\n\n").trim();
  if (countWords(text) <= target + 20) return text;
  const words = text.split(/\s+/).slice(0, target);
  text = words.join(" ").replace(/[,:;-]\s*$/, "").trim();
  const lastSentenceEnd = Math.max(text.lastIndexOf("."), text.lastIndexOf("!"), text.lastIndexOf("?"));
  if (lastSentenceEnd > text.length * 0.75) return text.slice(0, lastSentenceEnd + 1).trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function rewriteNewsBodyClient({ sourceText = "", headline = "", subline = "", tags = [], targetWords = 300 } = {}) {
  const goal = Math.max(120, Math.min(900, Number(targetWords || 300)));
  const sentences = newsSourceSentences(sourceText);
  const facts = keyNewsFacts(sourceText, 5);
  const subject = cleanNewsSentence(headline || tags[0] || "die Entwicklung");
  const mainTag = tags[0] || "Medienbranche";
  const secondTag = tags[1] || "digitale Medien";
  const fact = (index, fallback) => cleanNewsSentence(facts[index] || sentences[index] || fallback);
  let body = [
    `Die Entwicklung rund um ${subject} rÃ¼ckt eine konkrete Frage fÃ¼r die digitale Medienwirtschaft in den Mittelpunkt. ${fact(0, subline || `${mainTag} gewinnt fÃ¼r Anbieter, Plattformen und Partner der Medienbranche an Bedeutung.`)} Damit geht es nicht um eine abstrakte Trendmeldung, sondern um eine Entwicklung mit praktischen Folgen fÃ¼r Produktion, Verbreitung, Rechte, Refinanzierung und strategische Positionierung.`,
    `Der Kern der Meldung bleibt dabei klar: ${fact(1, `die Verbindung von ${mainTag} und ${secondTag} verÃ¤ndert die Rahmenbedingungen fÃ¼r Medienanbieter.`)} FÃ¼r Sender, Produzenten, Streaminganbieter, Vermarkter und regionale Medien ist wichtig, welche Akteure betroffen sind, welche Regeln oder Marktbewegungen dahinterstehen und welche Entscheidungen daraus entstehen kÃ¶nnen.`,
    `Besonders relevant ist auch dieser Punkt: ${fact(2, `Medienunternehmen mÃ¼ssen neue Entwicklungen frÃ¼h einordnen, ohne die konkreten Aussagen des Ausgangsmaterials zu verwischen.`)} Daraus ergibt sich ein Branchenbezug, weil digitale Medienangebote heute stark von Plattformlogik, Daten, Regulierung, Lizenzmodellen und neuen Nutzungsformen geprÃ¤gt werden.`,
    `Die Einordnung darf den Inhalt nicht verallgemeinern. ${fact(3, `Entscheidend bleibt, welche unmittelbaren Folgen sich aus dem beschriebenen Vorgang ergeben.`)} Genau deshalb sollte die weitere Bewertung an den belegten Aussagen ansetzen: Was wurde beschlossen, verhandelt, angekÃ¼ndigt oder kritisiert? Welche Fristen, Verfahren, Unternehmen oder Rechte sind genannt? Und welche Bedeutung hat das fÃ¼r die praktische Arbeit der Medienbranche?`,
    `FÃ¼r PROdigitalTV liegt die Relevanz des Themas darin, diese konkreten Punkte fÃ¼r die Branche nutzbar zu machen. ${fact(4, `Die Entwicklung zeigt, dass technische Innovation, rechtliche Sicherheit und wirtschaftliche TragfÃ¤higkeit zusammen betrachtet werden mÃ¼ssen.`)} So entsteht ein Beitrag, der den Kern der Ausgangsinformation bewahrt und zugleich erklÃ¤rt, warum er fÃ¼r digitale Medienanbieter wichtig ist.`
  ].join("\n\n");
  let index = 4;
  while (countWords(body) < goal) {
    const extra = fact(index, `Zugleich bleibt ${secondTag} ein Feld, in dem technische MÃ¶glichkeiten, wirtschaftliche Interessen und publizistische Verantwortung zusammen gedacht werden mÃ¼ssen.`);
    body += `\n\n${extra} FÃ¼r die Branche ist deshalb entscheidend, nicht nur auf einzelne Schlagworte zu reagieren, sondern den konkreten Nutzen, die rechtlichen Rahmenbedingungen und die Auswirkungen auf Nutzerinnen und Nutzer mitzudenken.`;
    index += 1;
    if (index > 12 && countWords(body) > goal) break;
  }
  return trimTextToWordGoal(body, goal);
}

const AI_EDITORIAL_BANNED_PHRASES = [
  /\bFuer PROdigitalTV liegt die Relevanz des Themas darin[^.?!]*[.?!]\s*/gi,
  /\bFÃ¼r PROdigitalTV liegt die Relevanz des Themas darin[^.?!]*[.?!]\s*/gi,
  /\bDie Meldung ist fuer PROdigitalTV relevant[^.?!]*[.?!]\s*/gi,
  /\bDie Meldung ist fÃ¼r PROdigitalTV relevant[^.?!]*[.?!]\s*/gi,
  /\bFuer die Branche ist deshalb entscheidend[^.?!]*[.?!]\s*/gi,
  /\bFÃ¼r die Branche ist deshalb entscheidend[^.?!]*[.?!]\s*/gi,
  /\bDamit geht es nicht um eine abstrakte Trendmeldung[^.?!]*[.?!]\s*/gi,
  /\bDaraus ergibt sich ein Branchenbezug[^.?!]*[.?!]\s*/gi,
  /\bDie Einordnung darf den Inhalt nicht verallgemeinern[^.?!]*[.?!]\s*/gi,
  /\bGenau deshalb sollte die weitere Bewertung[^.?!]*[.?!]\s*/gi,
  /\bSo entsteht ein Beitrag[^.?!]*[.?!]\s*/gi,
  /\bVor einer Veroeffentlichung[^.?!]*[.?!]\s*/gi,
  /\bVor einer VerÃ¶ffentlichung[^.?!]*[.?!]\s*/gi,
  /\bredaktionell pruefen\b/gi,
  /\bredaktionell prÃ¼fen\b/gi,
  /\bPruefpflichtig\b/gi,
  /\bPrÃ¼fpflichtig\b/gi,
  /\bArbeitsentwurf\b/gi,
  /\bMorgenbriefing-Meldung\b/gi,
  /\bThemenkandidat\b/gi,
  /\bVorschlag\b/gi
];

function stripEditorialProcessPhrases(value = "") {
  let text = String(value || "").normalize("NFC").replace(/\r/g, "\n");
  AI_EDITORIAL_BANNED_PHRASES.forEach((pattern) => {
    text = text.replace(pattern, " ");
  });
  return text
    .replace(/\bKI-Redaktion\b/g, "Redaktion")
    .replace(/\bVeroeffentlichung\b/g, "VerÃ¶ffentlichung")
    .replace(/\bFuer\b/g, "FÃ¼r")
    .replace(/\bfuer\b/g, "fÃ¼r")
    .replace(/\bkoennen\b/g, "kÃ¶nnen")
    .replace(/\bmuessen\b/g, "mÃ¼ssen")
    .replace(/\bwaere\b/g, "wÃ¤re")
    .replace(/\bhaette\b/g, "hÃ¤tte")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function neutralEditorialRewrite({ sourceText = "", headline = "", subline = "", targetWords = 360 } = {}) {
  const cleaned = stripEditorialProcessPhrases(sourceText);
  const sentences = cleaned
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÃ„Ã–Ãœ0-9])/)
    .map((sentence) => cleanNewsSentence(sentence))
    .filter((sentence) => sentence.length > 18)
    .filter((sentence) => !/^(Quelle|Status|Kategorie|Relevanz|Keywords?)\s*:/i.test(sentence))
    .filter((sentence) => !/^(Was ist passiert|Warum ist das relevant|Welche Auswirkungen)/i.test(sentence));
  const unique = [];
  const seen = new Set();
  sentences.forEach((sentence) => {
    const key = sentence.toLowerCase().replace(/[^a-z0-9Ã¤Ã¶Ã¼ÃŸ]+/gi, " ").slice(0, 90);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(sentence);
  });
  const facts = unique.slice(0, 9).map((sentence) => limitText(sentence, 260)).filter(Boolean);
  const title = cleanNewsSentence(headline || facts[0] || "die Entwicklung");
  const lead = cleanNewsSentence(subline || facts[0] || title);
  const fact = (index, fallback = "") => facts[index] || fallback || lead;
  const topic = title.replace(/[.!?]+$/g, "");
  const paragraphs = [
    `${lead} ${fact(0, topic)}.`,
    `${fact(1)} ${fact(2, "Die Entwicklung betrifft damit einen Bereich, der fuer Medienunternehmen, Plattformen, Produktion oder Regulierung praktische Bedeutung haben kann.")}`,
    `${fact(3)} ${fact(4, "Relevant ist vor allem, welche Akteure genannt werden und welche konkreten Schritte aus der Mitteilung hervorgehen.")}`,
    `${fact(5)} ${fact(6, "Fuer den Markt kann daraus ein Hinweis auf Veraenderungen bei Rechten, Verbreitung, Vermarktung, Technologie oder Medienpolitik entstehen.")}`,
    `${fact(7)} ${fact(8, "Offen bleibt, welche weiteren Folgen sich aus der angekuendigten Entwicklung ergeben.")}`
  ];
  let text = paragraphs.join("\n\n").trim();
  if (!text) text = cleaned;
  return trimTextToWordGoal(stripEditorialProcessPhrases(text), Math.max(120, Math.min(650, Number(targetWords || 360))));
}

async function activeAiPromptConfig(promptType = "Beitragstext") {
  const prompts = await list("ai_prompts").catch(() => []);
  const active = prompts
    .filter((prompt) => {
      const type = prompt.prompt_type || prompt.promptType || "";
      const status = String(prompt.status || "").toLowerCase();
      return type === promptType && !status.includes("archiviert") && !status.includes("geloescht") && prompt.deleted_at == null && prompt.deletedAt == null;
    })
    .sort((a, b) => String(b.updated_at || b.updatedAt || b.created_at || "").localeCompare(String(a.updated_at || a.updatedAt || a.created_at || "")))[0];
  return active || null;
}

async function generateAiArticleBodyWithNewsPrompt({ article = {}, formValues = {}, sources = [], keywords = [] } = {}) {
  const sourceText = String(
    article.imported_full_text
    || article.source_full_text
    || article.ai_original_suggested_text
    || article.aiOriginalSuggestedText
    || article.source_suggested_text
    || article.bodyText
    || article.body
    || formValues.bodyText
    || ""
  ).trim();
  const currentText = String(formValues.bodyText || article.bodyText || article.body || "").trim();
  const headline = String(formValues.headline || article.headline || article.title || "").trim();
  const subline = String(formValues.subline || article.subline || article.subtitle || "").trim();
  const keywordList = keywords.length
    ? keywords.map((keyword) => keyword.keyword || keyword).filter(Boolean)
    : toList(article.keyword_json || article.tags || article.keywords || article.primary_keyword).map((keyword) => keyword.keyword || keyword).filter(Boolean);
  const activePrompt = await activeAiPromptConfig("Beitragstext");
  const result = await callChatGptAction("improveText", {
    module: "ai-editorial",
    entityType: "editorialContent",
    entityId: article.id || "",
    fieldName: "bodyText",
    originalText: sourceText || currentText,
    context: {
      prompt_type: "Beitragstext",
      workflow: "KI-News erstellen",
      title: headline,
      headline,
      subtitle: subline,
      subline,
      category: formValues.category || article.category || "",
      keywords: keywordList,
      prompt_id: activePrompt?.id || "",
      prompt_text: activePrompt?.prompt_text || activePrompt?.promptText || "",
      system_instructions: activePrompt?.system_instructions || activePrompt?.systemInstructions || "",
      model: activePrompt?.model || "",
      sources: sources.map((source) => ({
        title: source.title || "",
        publisher: source.publisher || "",
        url: source.url || "",
        domain: source.domain || "",
        source_type: source.source_type || source.sourceType || "",
        claim_reference: source.claim_reference || "",
        relevance_note: source.relevance_note || ""
      })),
      sourceText,
      currentText
    }
  });
  return cleanRawImportText(result?.suggestedText || result?.text || "");
}

function showAiArticleRewriteDialog({ article = {}, formValues = {}, sources = [], keywords = [], revisedText = "" } = {}) {
  document.querySelector(".ai-dialog-backdrop")?.remove();
  const sourceText = String(article.ai_original_suggested_text || article.aiOriginalSuggestedText || article.source_suggested_text || article.bodyText || article.body || formValues.bodyText || "").trim();
  const currentText = String(formValues.bodyText || article.bodyText || article.body || sourceText || "").trim();
  const headline = String(formValues.headline || article.headline || article.title || "").trim();
  const subline = String(formValues.subline || article.subline || article.subtitle || "").trim();
  const sourceNames = sources.map((source) => source.publisher || source.title || source.domain).filter(Boolean).slice(0, 3).join(", ");
  const revised = revisedText || neutralEditorialRewrite({ sourceText: sourceText || currentText, headline, subline, targetWords: Math.max(180, Math.min(520, countWords(currentText || sourceText) || 360)) });
  const wrapper = document.createElement("div");
  wrapper.className = "ai-dialog-backdrop";
  wrapper.innerHTML = `<div class="ai-dialog ai-dialog--news-review" role="dialog" aria-modal="true">
    <div class="actions" style="justify-content:space-between"><div><p class="eyebrow">KI-Redaktion</p><h2>Vorschlag und Neufassung vergleichen</h2></div><button type="button" class="link-button" data-ai-close>Schliessen</button></div>
    <div class="ai-dialog-grid ai-dialog-grid--review">
      <div class="field"><label>Ãœbernommener Vorschlag <span>${countWords(sourceText || currentText)} WÃ¶rter</span></label><textarea readonly>${escapeHtml(sourceText || currentText || "Noch kein Vorschlag gespeichert.")}</textarea></div>
      <div class="field"><label>Neu formuliert <span data-ai-rewrite-count>${countWords(revised)} WÃ¶rter</span></label><textarea data-ai-article-rewrite>${escapeHtml(revised)}</textarea></div>
    </div>
    <div class="alert"><strong>Leitlinie:</strong> keine Eigenphrasen, keine Bewertungen ohne Quelle, keine beitragsfremden Formulierungen.${sourceNames ? ` Quellenhinweise: ${escapeHtml(sourceNames)}.` : ""}</div>
    <div class="actions"><button type="button" class="button button--primary" data-ai-rewrite-accept>Neufassung uebernehmen</button><button type="button" class="button button--secondary" data-ai-rewrite-regenerate>Nochmals neutral formulieren</button><button type="button" class="button button--secondary" data-ai-close>Verwerfen</button></div>
    <p class="muted">Erst â€žNeufassung Ã¼bernehmenâ€œ schreibt den Text in den Beitragseditor. Danach bitte speichern.</p>
  </div>`;
  document.body.append(wrapper);
  wrapper.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => wrapper.remove()));
  const outputField = wrapper.querySelector("[data-ai-article-rewrite]");
  const countNode = wrapper.querySelector("[data-ai-rewrite-count]");
  const updateCount = () => {
    if (countNode) countNode.textContent = `${countWords(outputField?.value || "")} WÃ¶rter`;
  };
  outputField?.addEventListener("input", updateCount);
  wrapper.querySelector("[data-ai-rewrite-regenerate]")?.addEventListener("click", async (event) => {
    if (!outputField) return;
    const button = event.currentTarget;
    const oldLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Erzeuge ...";
    try {
      const generated = await generateAiArticleBodyWithNewsPrompt({ article, formValues, sources, keywords });
      outputField.value = generated || neutralEditorialRewrite({ sourceText: sourceText || currentText || outputField.value, headline, subline, targetWords: Math.max(180, Math.min(520, countWords(outputField.value) || 360)) });
      updateCount();
    } catch (error) {
      console.warn("Beitragstext-Prompt nicht erreichbar, lokaler Fallback genutzt.", error);
      outputField.value = neutralEditorialRewrite({ sourceText: sourceText || currentText || outputField.value, headline, subline, targetWords: Math.max(180, Math.min(520, countWords(outputField.value) || 360)) });
      updateCount();
    } finally {
      button.disabled = false;
      button.textContent = oldLabel;
    }
  });
  wrapper.querySelector("[data-ai-rewrite-accept]")?.addEventListener("click", () => {
    const form = document.querySelector(`#ai-article-edit-form[data-article-id="${CSS.escape(article.id || "")}"]`);
    const bodyField = form?.querySelector('[name="bodyText"]');
    if (bodyField) {
      bodyField.value = outputField?.value || "";
      bodyField.dispatchEvent(new Event("input", { bubbles: true }));
      bodyField.dispatchEvent(new Event("change", { bubbles: true }));
    }
    wrapper.remove();
  });
}

const AI_NEWS_TEXT_TYPES = new Set([
  "text/plain",
  "text/html",
  "application/xhtml+xml"
]);

const AI_NEWS_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const AI_NEWS_EXTRA_TEXT_EXTENSIONS = /\.(txt|html?|pdf|docx)$/i;
const AI_NEWS_SUPPORTED_EXTENSIONS = /\.(txt|html?|pdf|docx|jpe?g|png|webp)$/i;

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function cleanImportedHtml(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function collectAiNewsImportSources(form) {
  const fileInput = form.querySelector('input[name="sourceFiles"]');
  const files = Array.from(fileInput?.files || []);
  const invalid = files.filter((file) => !AI_NEWS_SUPPORTED_EXTENSIONS.test(file.name) && !AI_NEWS_TEXT_TYPES.has(file.type) && !AI_NEWS_IMAGE_TYPES.has(file.type));
  if (invalid.length) throw new Error(`Nicht unterstuetzte Datei: ${invalid.map((file) => file.name).join(", ")}`);
  const textSources = [];
  const imageFiles = [];
  const imageSources = [];
  const unsupportedTextFiles = [];
  for (const file of files) {
    if (AI_NEWS_IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)) {
      imageFiles.push(file);
      imageSources.push({
        name: file.name,
        type: file.type || "Bilddatei",
        size: file.size,
        dataUrl: await readFileAsDataUrl(file)
      });
      continue;
    }
    if (AI_NEWS_TEXT_TYPES.has(file.type) || /\.(txt|html?)$/i.test(file.name)) {
      const rawText = await readFileAsText(file);
      textSources.push({
        name: file.name,
        type: file.type || "Textdatei",
        text: file.type === "text/html" || /\.html?$/i.test(file.name) ? cleanImportedHtml(rawText) : rawText
      });
      continue;
    }
    if (AI_NEWS_EXTRA_TEXT_EXTENSIONS.test(file.name)) {
      unsupportedTextFiles.push(file.name);
      textSources.push({
        name: file.name,
        type: file.type || "Textdatei",
        text: "",
        note: "Datei wurde angenommen. Bitte serverseitige Textextraktion fuer PDF/DOCX nutzen oder den Text zusaetzlich einfuegen."
      });
    }
  }
  return {
    textSources,
    imageFiles,
    imageSources,
    unsupportedTextFiles
  };
}

function renderAiNewsImportFileList(form) {
  const fileInput = form.querySelector('input[name="sourceFiles"]');
  const output = form.querySelector("[data-ai-news-file-list]");
  if (!fileInput || !output) return;
  const files = Array.from(fileInput.files || []);
  output.innerHTML = files.length
    ? `<div class="ai-news-file-pills">${files.map((file) => `<span>${escapeHtml(file.name)} <small>${Math.round(file.size / 1024)} KB</small></span>`).join("")}</div>`
    : `<p class="muted">Noch keine Dateien ausgewaehlt.</p>`;
}

function mailAdminConfig() {
  const baseInput = document.querySelector("#mail-admin-base-url");
  const tokenInput = document.querySelector("#mail-admin-token");
  const isLocalMailAdmin = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  const defaultBaseUrl = isLocalMailAdmin
    ? `${mobilePublicOrigin}/mail-api`
    : "/mail-api";
  const storedBaseUrl = isLocalMailAdmin && sessionStorage.mailAdminBaseUrl === "/mail-api"
    ? defaultBaseUrl
    : sessionStorage.mailAdminBaseUrl;
  if (baseInput && (!baseInput.value || (isLocalMailAdmin && baseInput.value === "/mail-api"))) baseInput.value = storedBaseUrl || defaultBaseUrl;
  if (tokenInput && !tokenInput.value) tokenInput.value = sessionStorage.mailAdminToken || "";
  const baseUrl = (baseInput?.value || storedBaseUrl || defaultBaseUrl).replace(/\/$/, "");
  const token = tokenInput?.value || sessionStorage.mailAdminToken || "";
  if (baseInput) sessionStorage.mailAdminBaseUrl = baseUrl;
  if (tokenInput) sessionStorage.mailAdminToken = token;
  return { baseUrl, token };
}

async function mailAdminRequest(path, options = {}) {
  const { baseUrl, token } = mailAdminConfig();
  if (!token) throw new Error("Bitte Admin Token eintragen.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Mailservice Fehler ${response.status}`);
  return data;
}

function renderMailAdminLists(accounts = [], templates = []) {
  const accountList = document.querySelector("#mail-accounts-list");
  const templateList = document.querySelector("#mail-templates-list");
  window.mailAdminAccounts = accounts;
  const accountOptions = accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.label || account.id)}</option>`).join("");
  document.querySelectorAll('select[name="accountId"]').forEach((select) => {
    select.innerHTML = accountOptions || `<option value="">Noch keine Accounts</option>`;
  });
  const templateOptions = templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.label || template.id)}</option>`).join("");
  document.querySelectorAll('select[name="templateId"]').forEach((select) => {
    select.innerHTML = templateOptions || `<option value="">Noch keine Templates</option>`;
  });
  if (accountList) {
    accountList.innerHTML = accounts.length
      ? accounts.map((account) => `<div class="setup-step"><span><strong>${escapeHtml(account.label || account.id)}</strong><br><small>SMTP: ${escapeHtml(account.smtpHost || "-")}:${escapeHtml(account.smtpPort || "-")}<br>Benutzer: ${escapeHtml(account.smtpUser || "-")}<br>Absender: ${escapeHtml([account.fromName, account.fromEmail].filter(Boolean).join(" / ") || "-")}</small></span><span class="actions"><strong>${account.hasPassword ? "Passwort gespeichert" : "Passwort fehlt"}</strong><button type="button" class="button button--secondary button--small" data-mail-account-edit="${escapeHtml(account.id)}">In Maske laden</button></span></div>`).join("")
      : `<div class="alert">Noch keine Mailaccounts vorhanden.</div>`;
  }
  if (templateList) {
    templateList.innerHTML = templates.length
      ? templates.map((template) => `<div class="setup-step"><span><strong>${escapeHtml(template.label || template.id)}</strong><br><small>${escapeHtml([template.accountId, template.subject].filter(Boolean).join(" - "))}</small></span><strong>${template.active === false ? "Inaktiv" : "Aktiv"}</strong></div>`).join("")
      : `<div class="alert">Noch keine Mailtemplates vorhanden.</div>`;
  }
}

async function loadMailAdminData() {
  const result = document.querySelector("#mail-admin-connection-result");
  if (result) result.innerHTML = `<span class="muted">Lade Mailservice ...</span>`;
  const [{ accounts = [] }, { templates = [] }] = await Promise.all([
    mailAdminRequest("/admin/accounts"),
    mailAdminRequest("/admin/templates")
  ]);
  renderMailAdminLists(accounts, templates);
  if (result) result.innerHTML = `<span class="tag">Verbunden</span>`;
  return { accounts, templates };
}

function cleanSpeechTextPart(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/(?:^|\s)(keywords?|schlagworte|quelle|quellen)\s*:.*/is, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primarySpeechBody(item = {}, fields = []) {
  return fields.map((field) => cleanSpeechTextPart(item[field])).find((value) => value.length > 20) || "";
}

function speechSourceText(collection, item = {}) {
  const subtitle = cleanSpeechTextPart(item.subtitle);
  const body = collection === "topics"
    ? primarySpeechBody(item, ["longDescription", "bodyText", "shortDescription"])
    : primarySpeechBody(item, ["bodyText", "articleText", "longDescription", "archiveText", "introText", "shortText", "teaserText", "postEventSummary"]);
  return [subtitle, body].filter(Boolean).join("\n\n");
}

function speechTextSignature(collection, item = {}) {
  const text = speechSourceText(collection, item).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function shouldAutoGenerateSpeech(collection, previous = {}, next = {}) {
  if (!["editorialContent", "topics"].includes(collection)) return false;
  const text = speechSourceText(collection, next);
  if (text.replace(/\s+/g, "").length < 80) return false;
  const signature = speechTextSignature(collection, next);
  return !next.audioNaturalUrl
    || !next.audioAccessibleUrl
    || next.audioNaturalTextSignature !== signature
    || next.audioAccessibleTextSignature !== signature
    || speechTextSignature(collection, previous) !== signature;
}

function audioStatusUpdate(collection, item = {}, status = "aktuell") {
  const signature = speechTextSignature(collection, item);
  return {
    contentId: `${collection}/${item.id || ""}`,
    contentVersion: Number(item.contentVersion || item.audioContentVersion || 1),
    contentTextSignature: signature,
    audioStatus: status,
    audioNaturalStatus: status,
    audioAccessibleStatus: status,
    audioNaturalTextSignature: status === "aktuell" ? signature : item.audioNaturalTextSignature || "",
    audioAccessibleTextSignature: status === "aktuell" ? signature : item.audioAccessibleTextSignature || "",
    audioTextSignature: status === "aktuell" ? signature : item.audioTextSignature || ""
  };
}

function withContentVersionMetadata(collection, previous = {}, next = {}) {
  if (!["editorialContent", "topics"].includes(collection)) return next;
  const currentSignature = speechTextSignature(collection, next);
  const previousSignature = previous.contentTextSignature || speechTextSignature(collection, previous);
  const textChanged = Boolean(previous.id) && previousSignature !== currentSignature;
  const hasAudio = Boolean(previous.audioUrl || previous.audioNaturalUrl || previous.audioAccessibleUrl);
  const version = textChanged ? Number(previous.contentVersion || 1) + 1 : Number(previous.contentVersion || next.contentVersion || 1);
  const stale = textChanged && hasAudio;
  return {
    ...next,
    contentId: `${collection}/${next.id || previous.id || ""}`,
    contentVersion: version,
    contentTextSignature: currentSignature,
    contentChangedAt: textChanged ? new Date().toISOString() : previous.contentChangedAt || next.contentChangedAt || new Date().toISOString(),
    audioStatus: stale ? "veraltet" : next.audioStatus || previous.audioStatus || "deaktiviert",
    audioNaturalStatus: stale ? "veraltet" : next.audioNaturalStatus || previous.audioNaturalStatus || "deaktiviert",
    audioAccessibleStatus: stale ? "veraltet" : next.audioAccessibleStatus || previous.audioAccessibleStatus || "deaktiviert"
  };
}

function normalizeMemberContactValues(values = {}) {
  const normalized = { ...values };
  if (Object.prototype.hasOwnProperty.call(normalized, "contactName") || Object.prototype.hasOwnProperty.call(normalized, "profileContactName")) {
    const name = normalized.contactName || normalized.profileContactName || "";
    normalized.contactName = name;
    normalized.profileContactName = name;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "contactPhone") || Object.prototype.hasOwnProperty.call(normalized, "phone") || Object.prototype.hasOwnProperty.call(normalized, "contactMobile") || Object.prototype.hasOwnProperty.call(normalized, "mobile")) {
    const split = splitPhoneAndMobile(normalized.contactPhone || normalized.phone || "", normalized.contactMobile || normalized.mobile || "");
    normalized.contactPhone = split.phone;
    normalized.phone = split.phone;
    normalized.contactMobile = split.mobile;
    normalized.mobile = split.mobile;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "contactEmail") || Object.prototype.hasOwnProperty.call(normalized, "email")) {
    const email = normalized.contactEmail || normalized.email || "";
    normalized.contactEmail = email;
    normalized.email = email;
  }
  return normalized;
}

function normalizedPhoneDigits(value = "") {
  let text = String(value || "").trim().replace(/[^\d+]/g, "");
  text = text.replace(/^\++/, "+");
  if (text.startsWith("00")) text = `+${text.slice(2)}`;
  if (text.startsWith("0") && !text.startsWith("00")) text = `+49${text.slice(1)}`;
  return text.replace(/[^\d+]/g, "");
}

function cleanPhoneDisplay(value = "") {
  return String(value || "").trim().replace(/^\++/, "+");
}

function phoneLooksMobile(value = "") {
  const phone = normalizedPhoneDigits(value);
  const digits = phone.replace(/\D/g, "");
  return phone.startsWith("+4915")
    || phone.startsWith("+4916")
    || phone.startsWith("+4917")
    || phone.startsWith("+436")
    || phone.startsWith("+447")
    || /^491[567]/.test(digits)
    || /^436/.test(digits)
    || /^447/.test(digits);
}

function splitPhoneAndMobile(phone = "", mobile = "") {
  const tel = cleanPhoneDisplay(phone);
  const mob = cleanPhoneDisplay(mobile);
  if (tel && !mob && phoneLooksMobile(tel)) return { phone: "", mobile: tel };
  if (!tel && mob && !phoneLooksMobile(mob)) return { phone: mob, mobile: "" };
  if (tel && mob && phoneLooksMobile(tel) && !phoneLooksMobile(mob)) return { phone: mob, mobile: tel };
  return { phone: tel, mobile: mob };
}

function memberEventContactLimit(membershipType = "") {
  return membershipType === "company" ? 5 : 1;
}

function memberMembershipLabel(membershipType = "") {
  if (membershipType === "company") return "Firmenmitglied";
  if (membershipType === "individual") return "Einzelmitglied";
  return "";
}

function collectMemberEventContacts(form, membershipType = "") {
  const limit = memberEventContactLimit(membershipType);
  const contacts = [];
  for (let index = 0; index < limit; index += 1) {
    const legacyName = String(form.querySelector(`[name="eventContactName${index}"]`)?.value || "").trim();
    const firstName = String(form.querySelector(`[name="eventContactFirstName${index}"]`)?.value || "").trim();
    const lastName = String(form.querySelector(`[name="eventContactLastName${index}"]`)?.value || "").trim();
    const name = [firstName, lastName].filter(Boolean).join(" ") || legacyName;
    const role = String(form.querySelector(`[name="eventContactRole${index}"]`)?.value || "").trim();
    const email = String(form.querySelector(`[name="eventContactEmail${index}"]`)?.value || "").trim();
    const phone = String(form.querySelector(`[name="eventContactPhone${index}"]`)?.value || "").trim();
    if (!firstName && !lastName && !legacyName && !role && !email && !phone) continue;
    if (!firstName || !lastName || !email || !phone) {
      throw new Error(`Eventkontakt ${index + 1} bitte mit Name, E-Mail und Telefon vollstÃ¤ndig ausfÃ¼llen.`);
    }
    contacts.push({ firstName, lastName, name, role, email, phone });
  }
  if (!contacts.length) throw new Error("Bitte mindestens einen eventberechtigten Kontakt mit Name, E-Mail und Telefon eintragen.");
  return contacts;
}

function removeMemberEventContactFormFields(values = {}) {
  const normalized = { ...values };
  Object.keys(normalized).forEach((key) => {
    if (/^eventContact(?:Name|FirstName|LastName|Role|Email|Phone)\d+$/.test(key)) delete normalized[key];
  });
  return normalized;
}

function syncPrimaryMemberContact(values = {}) {
  const normalized = { ...values };
  const first = Array.isArray(normalized.eventContacts) ? normalized.eventContacts[0] || {} : {};
  if (!first.name && !first.email && !first.phone) return normalized;
  const split = splitPhoneAndMobile(first.phone || "", "");
  normalized.contactName = first.name || "";
  normalized.profileContactName = first.name || "";
  normalized.firstName = first.firstName || "";
  normalized.lastName = first.lastName || "";
  normalized.contactEmail = first.email || "";
  normalized.email = first.email || "";
  normalized.contactPhone = split.phone;
  normalized.phone = split.phone;
  normalized.contactMobile = split.mobile || normalized.contactMobile || "";
  normalized.mobile = split.mobile || normalized.mobile || "";
  normalized.contactRole = first.role || "";
  return normalized;
}

function normalizeMembershipAccessValues(values = {}) {
  const normalized = { ...values };
  const accessStatus = normalized.membershipAccessStatus || "active";
  normalized.membershipAccessStatus = accessStatus;
  if (accessStatus === "active") {
    normalized.membershipAccessEffectiveAt = "";
    return normalized;
  }
  if (normalized.membershipAccessEffectiveAt) {
    const effectiveDate = new Date(`${normalized.membershipAccessEffectiveAt}T00:00:00`);
    if (Number.isNaN(effectiveDate.getTime())) throw new Error("Bitte ein gueltiges Wirksamkeitsdatum fuer den Mitgliedschaftsstatus eintragen.");
    normalized.membershipAccessEffectiveAt = effectiveDate;
  } else {
    normalized.membershipAccessEffectiveAt = new Date();
  }
  return normalized;
}

async function autoGenerateSpeechIfNeeded(collection, previous, next, result) {
  if (!shouldAutoGenerateSpeech(collection, previous, next)) return false;
  if (result) result.innerHTML = `<div class="alert">${progressMarkup("Texte gespeichert. Natural Voice und barrierefreie TTS werden aktualisiert ...", 70)}</div>`;
  await upsert(collection, { id: next.id, ...audioStatusUpdate(collection, next, "in_erstellung") });
  try {
    await generateArticleSpeechAsset({ collection, id: next.id, variant: "all" });
  } catch (error) {
    await upsert(collection, { id: next.id, ...audioStatusUpdate(collection, next, "fehler"), audioErrorMessage: error.message || String(error), audioErrorAt: new Date().toISOString() });
    throw error;
  }
  await upsert(collection, { id: next.id, ...audioStatusUpdate(collection, next, "aktuell"), audioGeneratedAt: new Date().toISOString(), audioErrorMessage: "" });
  if (result) result.innerHTML = `<div class="alert alert--success">Gespeichert. Audio-Varianten wurden aktualisiert.</div>`;
  return true;
}

function isProtectedInternalEditorialRecord(collection, record = {}) {
  if (collection !== "editorialContent") return false;
  if (record.section === "download" || String(record.migratedTo || "").startsWith("downloads/")) return false;
  if (["press", "news"].includes(record.page) || ["pressRelease", "news"].includes(record.section)) return false;
  if (["ueber_uns", "mitglied_werden"].includes(record.bereich)) return true;
  return ["home", "about", "join", "imprint", "privacy", "legal", "contact", "login", "members", "board"].includes(record.page)
    || ["intro", "hero", "legal", "footer"].includes(record.section);
}

function normalizeInternalEditorialValues(values = {}) {
  if (!["ueber_uns", "mitglied_werden"].includes(values.bereich)) return values;
  const slug = String(values.slug || values.id || "").trim();
  const page = values.bereich === "ueber_uns" ? "about" : "join";
  const publicVisibility = values.sichtbarkeit === "oeffentlich" ? "public" : values.sichtbarkeit === "mitglieder" ? "members" : "internal";
  return {
    ...values,
    ...(values.id ? { id: values.id } : {}),
    slug,
    page,
    section: "internal",
    key: `${values.bereich}.${slug || values.key || ""}`,
    title: values.titel || values.title || "",
    introText: values.kurztext || values.introText || "",
    bodyText: values.langtext || values.bodyText || "",
    sortOrder: Number(values.sortierung || values.sortOrder || 0),
    buttonText: values.button_text || values.buttonText || "",
    buttonUrl: values.button_ziel || values.buttonUrl || "",
    downloadId: values.downloadId || values.download_id || "",
    download_id: values.downloadId || values.download_id || "",
    visibility: publicVisibility,
    editorialManaged: true
  };
}

function dataUrlToFile(dataUrl, fileName) {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: mime });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Bilddaten konnten nicht geladen werden.")), { once: true });
    image.src = dataUrl;
  });
}

async function generatedThumbToJpeg(dataUrl, fileName, size = { width: 1200, height: 675 }) {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size.width || 1200;
  canvas.height = size.height || 675;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("KI-Bild konnte nicht komprimiert werden.");
  const safeName = String(fileName || "ki-collage.jpg").replace(/\.[^.]+$/, "") + `-${canvas.width}x${canvas.height}.jpg`;
  return {
    file: new File([blob], safeName, { type: "image/jpeg" }),
    dataUrl: canvas.toDataURL("image/jpeg", 0.82)
  };
}

async function generatedImageToOriginalFile(dataUrl, fileName) {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 1536;
  canvas.height = image.naturalHeight || 1024;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
  if (!blob) throw new Error("KI-Originalbild konnte nicht gespeichert werden.");
  const safeName = String(fileName || "ki-original.webp").replace(/\.[^.]+$/, "") + `-${canvas.width}x${canvas.height}.webp`;
  return {
    file: new File([blob], safeName, { type: "image/webp" }),
    dataUrl: canvas.toDataURL("image/webp", 0.92),
    width: canvas.width,
    height: canvas.height
  };
}

async function mediaAiReferenceImageData(file) {
  if (!file) return null;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
    throw new Error("Bitte ein JPG-, PNG- oder WebP-Referenzbild waehlen.");
  }
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(originalDataUrl);
  const maxEdge = 1400;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || maxEdge, image.naturalHeight || maxEdge));
  const width = Math.max(1, Math.round((image.naturalWidth || maxEdge) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || maxEdge) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
  return {
    dataUrl,
    fileName: file.name || "stilreferenz.jpg",
    mimeType: "image/jpeg",
    width,
    height,
    originalSize: file.size || 0
  };
}

const mediaAiAreaReferenceCollection = "ai_image_area_references";

function mediaAiAreaReferenceId(area = "general") {
  return `area-reference-${String(area || "general").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "general"}`;
}

async function saveMediaAiAreaReference(area = "general", file) {
  const normalized = await mediaAiReferenceImageData(file);
  const uploadFile = dataUrlToFile(normalized.dataUrl, `${normalizeMediaSlug(area || "general")}-referenzfoto.jpg`);
  if (!uploadFile) throw new Error("Referenzfoto konnte nicht vorbereitet werden.");
  const now = new Date().toISOString();
  const path = `images/ai-area-references/${normalizeMediaSlug(area || "general")}/${Date.now()}-${uploadFile.name}`;
  const uploaded = await uploadMediaAsset(uploadFile, path);
  const record = await upsert(mediaAiAreaReferenceCollection, {
    id: mediaAiAreaReferenceId(area),
    area,
    title: `Referenzfoto ${area}`,
    file_url: uploaded?.url || normalized.dataUrl,
    storage_path: uploaded?.storagePath || "",
    original_filename: file?.name || normalized.fileName || "",
    mime_type: uploadFile.type || "image/jpeg",
    width: normalized.width || 0,
    height: normalized.height || 0,
    status: "active",
    updated_at: now,
    updatedAt: now,
    updated_by: currentUser()?.email || currentUser()?.uid || "cms"
  });
  return record;
}

async function loadMediaAiAreaReference(area = "general") {
  const record = await getOne(mediaAiAreaReferenceCollection, mediaAiAreaReferenceId(area)).catch(() => null);
  if (!record || record.status === "deleted" || !record.file_url) return null;
  return record;
}

async function resetMediaAiAreaReference(area = "general") {
  const record = await loadMediaAiAreaReference(area);
  if (record?.storage_path) await deleteStoredAsset({ storagePath: record.storage_path }).catch(() => {});
  await remove(mediaAiAreaReferenceCollection, mediaAiAreaReferenceId(area)).catch(() => {});
}

function fileToInput(input, file) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

function filesToInput(input, files) {
  if (!input) return;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

function clipboardImageFile(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.kind === "file" && String(item.type || "").startsWith("image/"));
  const file = imageItem?.getAsFile?.();
  if (!file) return null;
  const extension = mediaFileExtension(file, "png");
  const fileName = file.name && file.name !== "image.png"
    ? file.name
    : `zwischenablage-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  return new File([file], fileName, { type: file.type || `image/${extension}`, lastModified: Date.now() });
}

function imageFileFromDropzone(form, inputName, entityId) {
  const input = form.querySelector(`input[name="${inputName}"]`);
  const file = input?.files?.[0];
  if (file) return file;
  const dataUrl = form.elements[`${inputName}DataUrl`]?.value;
  const fileName = form.elements[`${inputName}FileName`]?.value || `${entityId || "image"}-240x180.jpg`;
  return dataUrlToFile(dataUrl, fileName);
}

function findAiSource(button) {
  const form = button.closest("form") || document;
  const target = button.dataset.aiTarget;
  const field = form.querySelector(`[name="${target}"]`) || document.getElementById(target);
  if (!field) return { text: "", field: null };
  return { text: field.value ?? field.textContent ?? "", field };
}

function eventContext(button) {
  const form = button.closest("form");
  const formValues = form ? formObject(form) : {};
  const linkedEventOption = form?.elements.linkedEventId?.selectedOptions?.[0]?.textContent || "";
  const sponsorOption = form?.elements.sponsorId?.selectedOptions?.[0]?.textContent || "";
  const hiddenContext = document.getElementById(button.dataset.aiTarget)?.textContent;
  let parsedContext = {};
  if (hiddenContext) {
    try { parsedContext = JSON.parse(hiddenContext); } catch { parsedContext = { notes: hiddenContext }; }
  }
  return {
    ...parsedContext,
    ...formValues,
    linkedEventLabel: linkedEventOption,
    sponsorLabel: sponsorOption,
    placeholders: ["{{firstName}}", "{{lastName}}", "{{eventTitle}}", "{{eventDate}}", "{{eventLocation}}", "{{confirmationLink}}"]
  };
}

function imageGenerationContext(form) {
  const values = formObject(form);
  return {
    title: values.title || "",
    subtitle: values.subtitle || values.shortDescription || values.introText || "",
    bodyText: values.bodyText || values.longDescription || "",
    shortDescription: values.shortDescription || values.introText || "",
    category: values.category || "",
    module: form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent")
  };
}

function structuredToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function compactAiText(value = "", maxLength = 12000) {
  const clean = String(value || "").replace(/\r/g, "").trim();
  if (clean.length <= maxLength) return clean;
  const headLength = Math.floor(maxLength * 0.72);
  const tailLength = maxLength - headLength;
  return `${clean.slice(0, headLength).trim()}\n\n[Ausgangstext gekuerzt]\n\n${clean.slice(-tailLength).trim()}`;
}

const AI_FIELD_LIMITS = {
  title: 90,
  subtitle: 150,
  shortDescription: 180,
  introText: 220,
  seoTitle: 70,
  seoDescription: 160
};

function limitText(value = "", maxLength = 0) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!maxLength || clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength + 1);
  const boundary = clipped.lastIndexOf(" ");
  return clipped.slice(0, boundary > Math.floor(maxLength * 0.65) ? boundary : maxLength).trim();
}

function parsePromptTestInput(raw = "") {
  if (!String(raw || "").trim()) {
    return {
      THEMA: "Barrierefreiheit in Streaming-Angeboten",
      KATEGORIE: "Barrierefreiheit",
      QUELLEN: "EU-Kommission; W3C; HbbTV Association",
      TEXTLAENGE: "250 bis 350 Woerter",
      SPRACHSTIL: "sachlich, klar, leicht verstaendlich",
      HEUTIGES_DATUM: new Date().toISOString().slice(0, 10)
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { FREITEXT: raw };
  }
}

function renderPromptPreview(promptText = "", input = {}) {
  return String(promptText || "").replace(/\{\{\s*([A-ZAEIOU_]+)\s*\}\}/gi, (match, key) => {
    const value = input[key] ?? input[key.toUpperCase()] ?? input[key.toLowerCase()];
    return value === undefined ? match : String(value);
  });
}

function evaluatePromptSafety(values = {}, testInput = {}) {
  const combined = `${values.system_instructions || ""}\n${values.prompt_text || ""}`.toLowerCase();
  const warnings = [];
  [
    ["quellen", "Quellenpflicht fehlt"],
    ["halluzination", "Halluzinationsschutz fehlt"],
    ["beleg", "Belegstellenpflicht fehlt"]
  ].forEach(([needle, warning]) => {
    if (!combined.includes(needle)) warnings.push(warning);
  });
  if (Number(values.temperature || 0) > 0.4) warnings.push("Temperatur fuer Faktenaufgaben zu hoch");
  if (!String(values.output_format || "").trim()) warnings.push("Output-Format fehlt");
  if (!Object.keys(testInput || {}).length) warnings.push("Keine Testdaten erkannt");
  return warnings;
}

function promptTemplateChat(template = "") {
  const templates = {
    article_text: [
      "Redaktion: Wir brauchen einen Prompt fuer den Beitragstext.",
      "Der Text soll wie ein echter redaktioneller Nachrichtenbeitrag aufgebaut sein: Lead mit konkreter Nachricht, danach Quellenfakten und Einordnung.",
      "Die KI darf nur Akteure, Zahlen, Termine, Zitate und Folgen verwenden, die in Quellen oder Belegstellen stehen.",
      "Wenn nur Titel, URL oder Quellenname vorhanden sind, soll sie keinen fertigen Artikel vortaeuschen, sondern Recherchebedarf ausgeben."
    ].join("\n"),
    source_check: [
      "Redaktion: Erstelle einen Prompt fuer die Quellenpruefung.",
      "Der Prompt soll Domain, Herausgeber, Trust-Score, Quellentyp und belegte Aussage pruefen.",
      "Gesperrte oder ungepruefte Quellen duerfen keine automatische Veroeffentlichung erlauben."
    ].join("\n"),
    final_check: [
      "Redaktion: Erstelle einen Prompt fuer die Endpruefung.",
      "Der Prompt muss Halluzinationen, Quellenpflicht, Belegstellen, Rechtsrisiken und Pflichtfelder pruefen.",
      "Ausgabe bitte als JSON mit Status, Warnungen, Sperrgruenden und Freigabeempfehlung."
    ].join("\n"),
    thumbnail: [
      "Redaktion: Erstelle einen Prompt fuer eine Thumbnail-Idee.",
      "Das Bild soll serioes, modern und medienbranchenbezogen sein.",
      "Keine Logos, keine realen Personen ohne Rechteklaerung und keine irrefuehrenden Inhalte."
    ].join("\n"),
    thumbnail_generation: [
      "Redaktion: Erstelle einen Prompt fuer die Thumbnail-Erstellung.",
      "Die Bild-KI soll ein fotorealistisches oder serioes redaktionelles 16:9-Vorschaubild erzeugen.",
      "Keine echten Logos, keine realen Personen ohne Rechteklaerung, keine Comic-Optik und keine irrefuehrenden Bildinhalte.",
      "Der Prompt soll Motiv, Stil, Komposition, Licht und Ausschlussregeln klar enthalten.",
      `Default-Prompt, falls keine Details vorhanden sind: ${defaultAiEditorialThumbnailPrompt}`
    ].join("\n"),
    keywords: [
      "Redaktion: Erstelle einen Prompt fuer Keywords und Tags.",
      "Die KI soll Hauptkeyword, Nebenkeywords, Keyword-Typen und Relevanz-Scores erzeugen.",
      "Keywords unter Relevanz 50 sollen nicht automatisch gespeichert werden."
    ].join("\n"),
    seo: [
      "Redaktion: Erstelle einen Prompt fuer SEO-Daten.",
      "Die KI soll Slug, Meta-Titel, Meta-Beschreibung und SEO-Keywords vorbereiten.",
      "Die Angaben muessen sachlich bleiben und duerfen keine unbelegten Versprechen enthalten."
    ].join("\n")
  };
  return templates[template] || "";
}

function inferPromptTypeFromText(text = "") {
  const clean = String(text || "").toLowerCase();
  if (clean.includes("quelle")) return "Quellenpruefung";
  if (clean.includes("headline")) return "Headline";
  if (clean.includes("subline") || clean.includes("thubline")) return "Subline / Thubline";
  if (clean.includes("thumbnail") && (clean.includes("erstell") || clean.includes("generier") || clean.includes("bild-ki") || clean.includes("bild ki"))) return "Thumbnail-Erstellung";
  if (clean.includes("thumbnail")) return clean.includes("prompt") ? "Thumbnail-Prompt" : "Thumbnail-Idee";
  if (clean.includes("keyword") || clean.includes("tag")) return "Keywords";
  if (clean.includes("seo")) return "SEO / Meta";
  if (clean.includes("sprachstil") || clean.includes("stil")) return "Sprachstil";
  if (clean.includes("endpruefung") || clean.includes("freigabe") || clean.includes("halluzination")) return "Endpruefung";
  if (clean.includes("themenbewertung") || clean.includes("bewertung")) return "Themenbewertung";
  if (clean.includes("thema")) return "Themenrecherche";
  return "Beitragstext";
}

function buildPromptFromSource(values = {}) {
  const source = [promptTemplateChat(values.prompt_chat_template), values.prompt_seed_text].filter(Boolean).join("\n\n").trim();
  const promptType = inferPromptTypeFromText(`${values.prompt_type || ""}\n${source}`);
  const name = `${promptType} - KI-Redaktion`;
  const description = limitText(`Aus einfacher Redaktionsvorgabe vorbereitet: ${source}`, 180);
  const systemInstructions = [
    "Du arbeitest fuer die KI-Redaktion von PROdigitalTV.",
    "Erfinde keine Fakten, Zahlen, Zitate, Quellen, URLs, Personen, Organisationen, Studien oder Rechtsstaende.",
    "Jede zentrale Aussage muss durch belastbare Quellen und Belegstellen gedeckt sein.",
    "Keine Veroeffentlichung bei ungeprueften Quellen, gesperrten Quellen oder unklarer Faktenlage.",
    "Schreibe sachlich, klar, journalistisch und leicht verstaendlich."
  ].join("\n");
  const promptText = [
    `Aufgabe: ${source || "Fuehre den angeforderten redaktionellen Pruef- oder Erzeugungsschritt aus."}`,
    "",
    "Nutze ausschliesslich diese CMS-Daten:",
    "- Thema: {{THEMA}}",
    "- Kategorie: {{KATEGORIE}}",
    "- Quellen: {{QUELLEN}}",
    "- Bestehende Beitraege: {{BESTEHENDE_BEITRAEGE}}",
    "- Quellenstatus: {{QUELLENSTATUS}}",
    "- Beitragstext: {{BEITRAGSTEXT}}",
    "- Headline: {{HEADLINE}}",
    "- Subline: {{SUBLINE}}",
    "- Keywords: {{KEYWORDS}}",
    "- Heutiges Datum: {{HEUTIGES_DATUM}}",
    "",
    "Wenn eine Information nicht belegbar ist, lasse sie weg und markiere den Vorgang als pruefpflichtig.",
    promptType === "Thumbnail-Erstellung" ? `Nutze als Default fuer die Bild-KI, wenn keine spezifischen Details vorliegen: ${defaultAiEditorialThumbnailPrompt}` : "",
    "Gib das Ergebnis strukturiert im verlangten Output-Format zurueck."
  ].filter(Boolean).join("\n");
  return {
    name,
    prompt_type: promptType,
    description,
    system_instructions: systemInstructions,
    prompt_text: promptText,
    output_format: promptType === "Beitragstext" ? "markdown + pruefhinweise_json" : "json",
    temperature: promptType === "Beitragstext" ? "0.2" : "0.1",
    max_tokens: promptType === "Beitragstext" ? "1600" : "1200",
    status: "Entwurf",
    change_note: "Aus Fliesstext- oder Chat-Vorgabe vorbereitet.",
    test_input_json: JSON.stringify(parsePromptTestInput(""), null, 2)
  };
}

function aiFieldLimit(button, sourceField) {
  const fieldName = button.dataset.aiField || sourceField?.name || button.dataset.aiTarget || "";
  const tag = sourceField?.tagName?.toLowerCase() || "";
  if (AI_FIELD_LIMITS[fieldName]) return AI_FIELD_LIMITS[fieldName];
  if (tag === "input") return 120;
  return 0;
}

function articleCanPublish(article = {}) {
  const sourceStatus = article.source_status || article.sourceStatus || "";
  const duplicateStatus = String(article.duplicate_status || article.duplicateStatus || "").toLowerCase();
  const aiStatus = article.ai_check_status || article.aiCheckStatus || "";
  const bodyText = String(article.bodyText || article.body || "");
  const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(bodyText);
  return sourceStatus === "geprueft"
    && !duplicateStatus.includes("dublette")
    && aiStatus === "bestanden"
    && article.headline
    && (article.subline || article.subtitle)
    && bodyText
    && !unresolvedDraft
    && (article.thumbnail_idea || article.thumbnailIdea || article.imageUrl)
    && (article.primary_keyword || article.primaryKeyword || (Array.isArray(article.tags) && article.tags.length));
}

function safeLocalArticleDraft(article = {}, sources = [], keywords = []) {
  const sourceLabels = sources.slice(0, 3).map((source) => source.publisher || source.title || source.domain).filter(Boolean);
  const mainKeyword = article.primary_keyword || keywords.find((keyword) => keyword.is_primary)?.keyword || article.category || "das Thema";
  const headline = String(article.headline || article.title || "Der Beitrag").replace(/^Themenvorschlag:\s*/i, "");
  const subline = cleanEditorialSentence(article.subline || article.subtitle || article.introText || "");
  const category = article.category || "Medienbranche";
  const sourceSentence = sourceLabels.length
    ? `Vorhandene Quellenhinweise: ${sourceLabels.join(", ")}.`
    : "Es ist noch keine belastbare Quellenbasis mit inhaltlichem Auszug hinterlegt.";
  return [
    "Quelleninhalt fehlt fuer fertigen Beitrag.",
    subline || headline,
    `${sourceSentence} Dieser Text ist deshalb nur ein redaktioneller Arbeitsentwurf und kein veroeffentlichungsfaehiger Beitrag.`,
    `Fuer einen echten Beitrag zu ${category} muessen aus der Quelle konkret ermittelt werden: Was ist passiert, wer ist beteiligt, wann oder wo passiert es, welche Zahlen oder Entscheidungen sind belegt und welche Folge ergibt sich fuer ${mainKeyword}?`,
    "Erst danach kann daraus ein journalistischer Lead, ein Faktenabsatz und eine belastbare Einordnung entstehen."
  ].join("\n\n");
}

function loginReturnTarget() {
  const target = route().query.get("returnTo") || "";
  if (!target) return "";
  try {
    const decoded = decodeURIComponent(target);
    if (/^#\/[a-z0-9/?=&._%-]+$/i.test(decoded)) return decoded.replace(/^#\/?/, "");
  } catch {}
  return "";
}

function cleanEditorialSentence(value = "") {
  return String(value || "")
    .replace(/\b(redaktioneller Themenkandidat|Themenkandidat|Vorschlag|Quellenfund|redaktionell pruefen|redaktionell prÃ¼fen)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function draftArticleTextFromTopic(topic = {}) {
  const title = String(topic.headline || topic.title || "Medienthema").replace(/^Themenvorschlag:\s*/i, "");
  const keywordList = Array.isArray(topic.keywords) ? topic.keywords : [];
  const mainKeyword = keywordList[0] || topic.category || "das Thema";
  const category = topic.category || "Medienbranche";
  const topicParagraph = cleanMorningFullText(topic.themenabsatz || topic.themen_absatz || topic.editorial_paragraph || topic.topic_paragraph || "");
  const pdtvApproach = cleanMorningFullText(topic.pdtv_ansatz || topic.pdtvAnsatz || topic.pdtv_approach || topic.pdtvApproach || "");
  const teaser = cleanEditorialSentence(topic.teaser || topic.summary || topic.reason || topic.subline || "");
  const subline = cleanEditorialSentence(topic.subline || "");
  if (topicParagraph || pdtvApproach) {
    return [topicParagraph || teaser || subline || title, pdtvApproach].filter(Boolean).join("\n\n");
  }
  const sources = [
    ...(Array.isArray(topic.source_candidates) ? topic.source_candidates : []),
    ...(Array.isArray(topic.sources) ? topic.sources : [])
  ];
  const sourceNames = [
    ...(Array.isArray(topic.source_names) ? topic.source_names : []),
    ...sources.map((source) => source.publisher || source.name || source.title || source.domain)
  ].map((item) => String(item || "").trim()).filter(Boolean);
  const uniqueSourceNames = [...new Set(sourceNames)].slice(0, 3);
  const sourceSentence = uniqueSourceNames.length
    ? `Vorhandene Quellenhinweise: ${uniqueSourceNames.join(", ")}.`
    : "Es ist noch keine belastbare Quellenbasis mit inhaltlichem Auszug hinterlegt.";
  return [
    "Quelleninhalt fehlt fuer fertigen Beitrag.",
    teaser || subline || title,
    `${sourceSentence} Dieser Eintrag ist nur die Themenbasis. Er darf nicht wie ein fertiger redaktioneller Beitrag behandelt werden.`,
    `Fuer einen echten Beitrag muessen konkrete Quellenfakten erfasst werden: Akteure, Entscheidung oder Ereignis, Datum, betroffene Angebote oder Maerkte und belegbare Folgen fuer ${category}.`,
    "Sobald diese Informationen im Editor hinterlegt sind, kann die KI daraus einen journalistischen Beitrag mit Nachricht, Faktenabsatz und Einordnung formulieren."
  ].join("\n\n");
}

function shortTextFromTopic(topic = {}, bodyText = "") {
  return limitText(String(topic.subline || topic.reason || bodyText || "").replace(/\s+/g, " ").trim(), 180);
}

function domainFromUrl(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function isOversizedInlineImage(value = "") {
  return String(value || "").startsWith("data:image/") && String(value || "").length > 900000;
}

function generateLocalEditorialThumbnail(article = {}) {
  const title = String(article.headline || article.title || "PROdigitalTV").replace(/^Themenvorschlag:\s*/i, "").slice(0, 56);
  const category = String(article.category || "KI-Redaktion").slice(0, 34);
  const keyword = String(article.primary_keyword || "Medienbranche").slice(0, 28);
  const safe = (value) => String(value || "").replace(/[<&>"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[char]));
  const key = `${category} ${keyword} ${title}`.toLowerCase();
  const variants = [
    {
      match: ["hbbtv", "smart-tv"],
      label: "Smart-TV Studio",
      accent: "#1d9bf0",
      scene: `<rect x="96" y="108" width="566" height="332" rx="24" fill="#111827" stroke="#dbeafe" stroke-width="16"/>
        <rect x="132" y="146" width="494" height="248" rx="12" fill="#dbeafe"/>
        <rect x="176" y="184" width="168" height="92" rx="10" fill="#0f3a68" opacity=".92"/>
        <rect x="372" y="184" width="198" height="34" rx="17" fill="#ffffff" opacity=".94"/>
        <rect x="372" y="238" width="154" height="24" rx="12" fill="#ffffff" opacity=".72"/>
        <path d="M251 468h256M379 438v30" stroke="#e5edf7" stroke-width="20" stroke-linecap="round"/>
        <circle cx="908" cy="242" r="96" fill="#ffffff" opacity=".15"/>
        <path d="M855 242h106M908 189v106" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity=".82"/>`
    },
    {
      match: ["fast", "distribution", "ott"],
      label: "Distribution Control Room",
      accent: "#00a878",
      scene: `<rect x="92" y="122" width="318" height="194" rx="18" fill="#e8f2ff" opacity=".95"/>
        <rect x="446" y="96" width="318" height="194" rx="18" fill="#f5f8fb" opacity=".92"/>
        <rect x="800" y="136" width="280" height="172" rx="18" fill="#dfefff" opacity=".88"/>
        <path d="M250 350c142 88 324 88 506 0s270-55 346 3" fill="none" stroke="#ffffff" stroke-width="20" opacity=".72"/>
        <g fill="#071a33" opacity=".68"><rect x="130" y="162" width="96" height="18" rx="9"/><rect x="484" y="136" width="146" height="18" rx="9"/><rect x="836" y="174" width="116" height="18" rx="9"/></g>
        <circle cx="960" cy="430" r="70" fill="#ffffff" opacity=".16"/><path d="M925 430h72" stroke="#ffffff" stroke-width="18" stroke-linecap="round"/>`
    },
    {
      match: ["musik", "gema", "rechte", "verwertung"],
      label: "Audio Rights Desk",
      accent: "#e30613",
      scene: `<rect x="120" y="132" width="310" height="330" rx="28" fill="#f8fafc" opacity=".94"/>
        <path d="M168 218c28-76 92-76 120 0s92 76 120 0" fill="none" stroke="#071a33" stroke-width="16" stroke-linecap="round" opacity=".78"/>
        <rect x="520" y="118" width="342" height="244" rx="18" fill="#fff" opacity=".86"/>
        <rect x="560" y="162" width="222" height="18" rx="9" fill="#071a33" opacity=".72"/>
        <rect x="560" y="214" width="258" height="16" rx="8" fill="#071a33" opacity=".36"/>
        <rect x="560" y="258" width="198" height="16" rx="8" fill="#071a33" opacity=".28"/>
        <circle cx="950" cy="250" r="82" fill="#ffffff" opacity=".18"/><path d="M910 250h80M950 210v80" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity=".72"/>`
    },
    {
      match: ["ki", "redaktion", "produktion"],
      label: "Editorial AI Desk",
      accent: "#7c3aed",
      scene: `<rect x="96" y="124" width="450" height="284" rx="22" fill="#edf2ff" opacity=".92"/>
        <rect x="132" y="166" width="190" height="30" rx="15" fill="#071a33" opacity=".72"/>
        <rect x="132" y="226" width="340" height="18" rx="9" fill="#071a33" opacity=".34"/>
        <rect x="132" y="270" width="294" height="18" rx="9" fill="#071a33" opacity=".28"/>
        <path d="M694 148c120 0 216 96 216 216" fill="none" stroke="#ffffff" stroke-width="18" opacity=".5"/>
        <circle cx="760" cy="274" r="96" fill="#ffffff" opacity=".17"/>
        <path d="M710 274h100M760 224v100" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity=".8"/>`
    },
    {
      match: ["barriere", "untertitel", "accessibility"],
      label: "Accessible Streaming",
      accent: "#f59e0b",
      scene: `<rect x="100" y="114" width="562" height="320" rx="24" fill="#0f172a" stroke="#fff7ed" stroke-width="16"/>
        <rect x="144" y="158" width="474" height="232" rx="12" fill="#e8eef7"/>
        <rect x="188" y="318" width="386" height="44" rx="10" fill="#071a33" opacity=".82"/>
        <rect x="220" y="334" width="168" height="12" rx="6" fill="#ffffff" opacity=".92"/>
        <rect x="414" y="334" width="104" height="12" rx="6" fill="#ffffff" opacity=".7"/>
        <circle cx="916" cy="256" r="86" fill="#ffffff" opacity=".18"/>
        <path d="M872 256h88M916 212v88" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity=".76"/>`
    }
  ];
  const variant = variants.find((item) => item.match.some((token) => key.includes(token))) || variants[Math.abs([...key].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length];
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="${safe(title)}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#09111f"/>
        <stop offset="0.52" stop-color="#193a5c"/>
        <stop offset="1" stop-color="${variant.accent}"/>
      </linearGradient>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer></filter>
      <radialGradient id="lens" cx=".72" cy=".32" r=".65"><stop offset="0" stop-color="#ffffff" stop-opacity=".34"/><stop offset=".44" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#000000" stop-opacity=".18"/></radialGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#bg)"/>
    <rect width="1200" height="675" fill="url(#lens)"/>
    <rect width="1200" height="675" filter="url(#grain)" opacity=".85"/>
    <path d="M0 540c160-92 319-106 485-38 190 78 346 69 715-106v279H0z" fill="#ffffff" opacity=".1"/>
    <path d="M78 94c72-52 155-78 248-78h710c56 0 101 45 101 101v354c0 63-51 114-114 114H92c-46 0-83-37-83-83V184c0-36 25-68 69-90z" fill="#ffffff" opacity=".07"/>
    ${variant.scene}
    <rect x="0" y="496" width="1200" height="179" fill="#06111f" opacity=".72"/>
    <text x="96" y="552" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${safe(category)}</text>
    <text x="96" y="610" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800">${safe(title)}</text>
    <text x="842" y="552" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800">${safe(keyword)}</text>
    <text x="842" y="588" fill="#ffffff" opacity=".72" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">${safe(variant.label)}</text>
  </svg>`);
}

function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/Ã¤/g, "ae")
    .replace(/Ã¶/g, "oe")
    .replace(/Ã¼/g, "ue")
    .replace(/ÃŸ/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function approveEventMediaToGallery(mediaId) {
  const medium = await getOne("eventMedia", mediaId);
  if (!medium) return null;
  const event = medium.eventId ? await getOne("events", medium.eventId).catch(() => null) : null;
  const now = new Date().toISOString();
  const isImage = String(medium.mediaType || medium.fileType || "").toLowerCase().includes("image") || /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i.test(medium.fileUrl || "");
  let galleryId = medium.galleryId || event?.galleryId || (medium.eventId ? `gallery-${slugify(medium.eventId)}` : "member-upload-gallery");
  if (isImage && galleryId) {
    const existingGallery = await getOne("galleries", galleryId).catch(() => null);
    const existingImages = Array.isArray(existingGallery?.images) ? existingGallery.images : [];
    const alreadyAttached = existingImages.some((image) => image.eventMediaId === medium.id || image.url === medium.fileUrl);
    const images = alreadyAttached ? existingImages : [
      ...existingImages,
      {
        id: `gallery-image-${crypto.randomUUID()}`,
        eventMediaId: medium.id,
        fileName: medium.fileName || medium.title || "Event-Material",
        url: medium.fileUrl || medium.url || "",
        thumbUrl: medium.thumbUrl || medium.fileUrl || "",
        storagePath: medium.storagePath || "",
        contentType: medium.fileType || "",
        caption: medium.caption || medium.description || "",
        altText: medium.altText || medium.caption || medium.title || "Event-Material",
        sortOrder: existingImages.length + 1,
        uploadedAt: medium.uploadedAt || now
      }
    ];
    await upsert("galleries", {
      ...(existingGallery || {}),
      id: galleryId,
      title: existingGallery?.title || medium.galleryTitle || `Galerie ${event?.title || medium.eventId || "Material Uploads"}`.trim(),
      description: existingGallery?.description || "",
      eventId: medium.eventId || existingGallery?.eventId || "",
      linkedEventId: medium.eventId || existingGallery?.linkedEventId || "",
      status: existingGallery?.status || "published",
      visibility: existingGallery?.visibility || event?.visibility || "public",
      images,
      createdAt: existingGallery?.createdAt || now,
      updatedAt: now
    });
    if (event && event.galleryId !== galleryId) {
      await upsert("events", { ...event, galleryId, updatedAt: now });
    }
  }
  await upsert("eventMedia", {
    ...medium,
    galleryId,
    status: "approved",
    visibility: "public",
    approvedAt: now,
    updatedAt: now
  });
  return { medium, galleryId, attachedToGallery: isImage && Boolean(galleryId) };
}
function eventRetrospectiveArticleId(eventId = "") {
  return `retrospective-${slugify(eventId) || crypto.randomUUID()}`;
}

function eventRetrospectiveBody(event = {}) {
  const summary = event.longDescription || event.bodyText || event.articleText || event.archiveText || event.postEventSummary || event.postEventummary || event.description || "";
  const facts = [
    event.date ? `Die Veranstaltung fand am ${formatDate(event.date)} statt.` : "",
    [event.locationName, event.city].filter(Boolean).length ? `Veranstaltungsort war ${[event.locationName, event.city].filter(Boolean).join(", ")}.` : "",
    event.subtitle ? `Im Mittelpunkt stand: ${event.subtitle}` : ""
  ].filter(Boolean).join(" ");
  const closing = "Der RÃ¼ckblick dokumentiert die wichtigsten Impulse, EindrÃ¼cke und AnknÃ¼pfungspunkte fÃ¼r die digitale Medienwirtschaft.";
  return [summary, facts, closing].filter(Boolean).join("\n\n");
}

function eventRetrospectiveIntro(event = {}) {
  return event.postEventSummary || event.postEventummary || event.description || event.subtitle || "Redaktioneller RÃ¼ckblick auf ein PROdigitalTV-Event.";
}

function eventRetrospectiveImageUrl(event = {}) {
  return event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "";
}

function normalizeMediaSlug(value = "") {
  return slugify(value)
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "prodigitaltv-bild";
}

function mediaFileExtension(file = {}, fallback = "webp") {
  const extension = String(file.name || "").includes(".") ? String(file.name).split(".").pop().toLowerCase() : "";
  const normalized = extension === "jpeg" ? "jpg" : extension;
  return ["jpg", "png", "webp", "svg"].includes(normalized) ? normalized : fallback;
}

function mediaFolderForType(type = "upload") {
  const folders = {
    upload: "uploads",
    ai: "ai",
    event: "events",
    article: "articles",
    news: "news",
    topic: "articles",
    board: "board",
    member: "members",
    person: "persons",
    logo: "logos",
    thumb: "thumbs",
    landscape: "variants",
    portrait: "variants",
    social: "social",
    archive: "archive"
  };
  return folders[type] || "uploads";
}

function normalizedMediaType(type = "upload") {
  const allowed = new Set(["upload", "ai", "event", "article", "news", "topic", "board", "member", "person", "logo", "thumb", "landscape", "portrait", "social", "archive"]);
  return allowed.has(type) ? type : "upload";
}

const mediaUsagePresets = {
  upload: { aspect: "16x9", width: 1600, height: 900, portal: "Allgemein / responsive", mobile: "Responsive mit Bildfokus" },
  ai: { aspect: "16x9", width: 1600, height: 900, portal: "Redaktionelle Grafik", mobile: "Responsive 16:9" },
  news: { aspect: "16x9", width: 1600, height: 900, portal: "News-Teaser und Artikelkopf", mobile: "Mobile News-Teaser 16:9" },
  event: { aspect: "16x9", width: 1600, height: 900, portal: "Event-Teaser und Detailkopf", mobile: "Mobile Eventkarte 16:9" },
  article: { aspect: "16x9", width: 1600, height: 900, portal: "Artikel / Redaktion", mobile: "Mobile Artikelkarte 16:9" },
  topic: { aspect: "16x9", width: 1600, height: 900, portal: "Themenkarte / Themenkopf", mobile: "Mobile Themenkarte 16:9" },
  board: { aspect: "4x5", width: 1200, height: 1500, portal: "Vorstandsprofil", mobile: "Mobile Profilkarte 4:5" },
  member: { aspect: "logo", width: 1530, height: 600, portal: "Mitgliederkarte / Logo 2.55:1", mobile: "Mobile Mitgliederkarte 2.55:1" },
  person: { aspect: "4x5", width: 1200, height: 1500, portal: "Personenprofil", mobile: "Mobile Profilkarte 4:5" },
  logo: { aspect: "logo", width: 1530, height: 600, portal: "Logo-Kachel 2.55:1", mobile: "Mobile Logo-Kachel 2.55:1" },
  thumb: { aspect: "1x1", width: 1200, height: 1200, portal: "Quadratisches Thumb", mobile: "Mobile Thumb 1:1" }
};

const MEDIA_VARIANT_DEFINITIONS = Object.freeze({
  news_desktop: { key: "news_desktop", label: "News Desktop", width: 1200, height: 675, aspect: "16x9", format: "image/webp", quality: .86, usage: "news_header", storageSuffix: "news-desktop" },
  news_mobile: { key: "news_mobile", label: "News Mobile", width: 800, height: 1000, aspect: "4x5", format: "image/webp", quality: .86, usage: "news_mobile", storageSuffix: "news-mobile" },
  hero_desktop: { key: "hero_desktop", label: "Hero Desktop", width: 1920, height: 800, aspect: "12x5", format: "image/webp", quality: .88, usage: "hero", storageSuffix: "hero-desktop" },
  thumbnail: { key: "thumbnail", label: "Thumbnail", width: 480, height: 320, aspect: "3x2", format: "image/webp", quality: .82, usage: "thumbnail", storageSuffix: "thumbnail" },
  square: { key: "square", label: "Square", width: 800, height: 800, aspect: "1x1", format: "image/webp", quality: .84, usage: "square", storageSuffix: "square" },
  event_header: { key: "event_header", label: "Event Header", width: 1600, height: 700, aspect: "16x7", format: "image/webp", quality: .86, usage: "event_header", storageSuffix: "event-header" },
  member_teaser: { key: "member_teaser", label: "Member Teaser", width: 900, height: 600, aspect: "3x2", format: "image/webp", quality: .84, usage: "member_teaser", storageSuffix: "member-teaser" },
  sponsor_logo: { key: "sponsor_logo", label: "Sponsor Logo", width: 600, height: 300, aspect: "2x1", format: "image/webp", quality: .9, usage: "sponsor_logo", storageSuffix: "sponsor-logo" },
  social_share: { key: "social_share", label: "Social Share", width: 1200, height: 630, aspect: "social", format: "image/webp", quality: .86, usage: "social_share", storageSuffix: "social-share" }
});

const MEDIA_VARIANT_ORDER = Object.freeze(Object.keys(MEDIA_VARIANT_DEFINITIONS));

function mediaUsagePreset(type = "upload") {
  return mediaUsagePresets[normalizedMediaType(type)] || mediaUsagePresets.upload;
}

function mediaPresetFields(type = "upload") {
  const normalized = normalizedMediaType(type);
  const preset = mediaUsagePreset(normalized);
  return {
    usage_preset: normalized,
    usage_preset_ratio: preset.aspect,
    usage_preset_width: preset.width,
    usage_preset_height: preset.height,
    portal_usage: preset.portal,
    mobile_usage: preset.mobile,
    aspect_ratio: preset.aspect
  };
}

function mediaVariantDefinition(key = "", asset = {}) {
  const cleanKey = String(key || "").trim().toLowerCase();
  if (MEDIA_VARIANT_DEFINITIONS[cleanKey]) return MEDIA_VARIANT_DEFINITIONS[cleanKey];
  const fallbackKey = mediaDefaultVariantKey(asset);
  return MEDIA_VARIANT_DEFINITIONS[fallbackKey] || MEDIA_VARIANT_DEFINITIONS.news_desktop;
}

function mediaDefaultVariantKey(asset = {}) {
  const type = normalizedMediaType(asset.media_type || asset.usage_preset || "upload");
  if (["member", "logo"].includes(type)) return "sponsor_logo";
  if (["board", "person"].includes(type)) return "news_mobile";
  if (type === "thumb") return "square";
  if (type === "event") return "event_header";
  return "news_desktop";
}

function mediaVariantAspectCss(key = "", asset = {}) {
  return mediaAspectCss(mediaVariantDefinition(key, asset).aspect);
}

function mediaStagePreviewSize(width = 1, height = 1, maxWidth = 420, maxHeight = 360) {
  const safeWidth = Math.max(1, Number(width || 1));
  const safeHeight = Math.max(1, Number(height || 1));
  const scale = Math.min(maxWidth / safeWidth, maxHeight / safeHeight, 1);
  return {
    width: Math.max(160, Math.round(safeWidth * scale)),
    height: Math.max(120, Math.round(safeHeight * scale))
  };
}

function mediaVariantCanvasSize(format = "16x9", asset = {}) {
  const clean = String(format || "16x9").toLowerCase();
  if (MEDIA_VARIANT_DEFINITIONS[clean]) {
    const variant = MEDIA_VARIANT_DEFINITIONS[clean];
    return { width: variant.width, height: variant.height, aspect: variant.aspect, key: variant.key };
  }
  const variant = Object.values(MEDIA_VARIANT_DEFINITIONS).find((entry) => entry.aspect === clean);
  if (variant) return { width: variant.width, height: variant.height, aspect: variant.aspect, key: variant.key };
  if (clean === "1x1") return { width: 1200, height: 1200, aspect: "1x1", key: "square" };
  if (clean === "4x5") return { width: 800, height: 1000, aspect: "4x5", key: "news_mobile" };
  if (clean === "9x16" || clean === "portrait" || clean === "hochkant") return { width: 1080, height: 1920, aspect: "9x16", key: "portrait" };
  if (clean === "logo") return { width: 600, height: 300, aspect: "2x1", key: "sponsor_logo" };
  if (clean === "4x3") return { width: 1200, height: 900, aspect: "4x3", key: "legacy_4x3" };
  if (clean === "3x2") return { width: 900, height: 600, aspect: "3x2", key: "member_teaser" };
  if (clean === "12x5") return { width: 1920, height: 800, aspect: "12x5", key: "hero_desktop" };
  if (clean === "16x7") return { width: 1600, height: 700, aspect: "16x7", key: "event_header" };
  if (clean === "social") return { width: 1200, height: 630, aspect: "social", key: "social_share" };
  const fallback = mediaVariantDefinition("", asset);
  return { width: fallback.width, height: fallback.height, aspect: fallback.aspect, key: fallback.key };
}

function mediaVariantFileCore(asset = {}) {
  const preferred = asset.original_filename || asset.filename_original || asset.filename_web || asset.title || asset.slug || asset.id || "bild";
  const cleanBase = String(preferred).split("/").pop().split("\\").pop().replace(/\.[^.]+$/, "");
  return normalizeMediaSlug(cleanBase) || normalizeMediaSlug(asset.title || "bild") || "bild";
}

function mediaVariantOutputFileName(asset = {}, variantKey = "") {
  const variant = mediaVariantDefinition(variantKey, asset);
  return `${mediaVariantFileCore(asset)}_${variant.key}_${variant.width}x${variant.height}.webp`;
}

function mediaVariantOutputPath(asset = {}, variantKey = "") {
  const variant = mediaVariantDefinition(variantKey, asset);
  const basePath = String(asset.file_path_original || asset.file_path_web || asset.file_path_thumb || "").trim();
  const baseDir = basePath ? basePath.replace(/\/[^/]*$/, "") : mediaStoragePath("placeholder.webp", normalizedMediaType(asset.media_type || "upload"), asset.media_code || "").replace(/\/[^/]*$/, "");
  return `${baseDir}/${mediaVariantOutputFileName(asset, variant.key)}`;
}

function mediaAiStyleCatalog() {
  return {
    photorealistic: {
      direction: "Strictly photorealistic editorial image, like a real full-frame camera photograph with believable materials, natural light and authentic media-industry atmosphere.",
      composition: "Clear photographic depth, real-world scene, grounded lens perspective, credible camera optics, not illustration, not painting, not synthetic stock-like CGI.",
      palette: "Color palette may be realistic and situation-driven, not forced into brand colors.",
      freedom: "Vary setting, camera distance and mood boldly as long as the image stays credible as photography."
    },
    editorial_magazine: {
      direction: "High-end editorial magazine visual language with crafted composition, restrained elegance and clear visual hierarchy.",
      composition: "Art-directed composition, layered foreground/background, premium magazine pacing, strong crop discipline.",
      palette: "Use a curated palette with a subtle PROdigitalTV accent only where it strengthens the image.",
      freedom: "Seek a distinctive cover-story feeling, not a generic business visual."
    },
    classic_serious: {
      direction: "Classic, serious and trustworthy visual tone with quiet authority and institutional clarity.",
      composition: "Balanced geometry, measured framing, controlled light, low visual noise.",
      palette: "Muted, elegant, sober colors; avoid loud trend aesthetics.",
      freedom: "Stay conservative but not boring; use subtle symbolic depth."
    },
    modern_gloss: {
      direction: "Modern premium high-gloss visual world with polished surfaces, cinematic highlights and confident graphic impact.",
      composition: "Striking hero composition, premium reflections, decisive silhouettes, clean focal path.",
      palette: "Controlled luxe palette with richer contrast and accent colors when useful.",
      freedom: "Allow stronger style and visual confidence, but avoid cheesy ad aesthetics."
    },
    premium_event_keyvisual: {
      direction: "Photorealistic luxury corporate event keyvisual for an international business, media and networking event with agency-level premium marketing polish.",
      composition: "Real high-end event photography in a split or layered 16:9 composition with conference, breakfast, city/location and event-atmosphere cues, plus calm premium whitespace for text.",
      palette: "Cream white, champagne, gold, dark blue, anthracite, warm golden-hour light and refined glass/wood reflections.",
      freedom: "Use real-camera photorealism mixed with elegant editorial design discipline; avoid illustration, painting, cheap stock-photo mood and crowded layouts."
    },
    technical_futuristic: {
      direction: "Technical futuristic world around media tech, broadcast infrastructure, streaming systems, signal paths and AI interfaces.",
      composition: "Layered systems view, architectural depth, luminous interfaces, infrastructural detail.",
      palette: "Can use cold technical palettes, electric accents, dark control-room atmospheres or data-light gradients.",
      freedom: "Push into abstract systems imagery instead of default office scenes."
    },
    minimalistic: {
      direction: "Minimalist visual language with generous empty space, a single strong idea and reduced formal vocabulary.",
      composition: "Few elements, strong negative space, precise placement, calm confidence.",
      palette: "Highly reduced palette; use color with discipline.",
      freedom: "Allow radical simplicity and silence instead of filling the frame."
    },
    illustration: {
      direction: "Sophisticated editorial illustration rather than photo realism, with conceptual clarity and crafted symbolic form.",
      composition: "Readable conceptual scene, graphic shapes, metaphor-first thinking, polished illustration finish.",
      palette: "Illustrative palette may be bolder, flatter or more stylized if coherent.",
      freedom: "Move clearly away from the photo schema when this style is chosen."
    },
    documentary: {
      direction: "Photorealistic raw documentary editorial mood, believable everyday reality, unstaged press-photo energy.",
      composition: "Observed real-camera moment, imperfect realism, situational framing, atmospheric authenticity, no illustration or painted finish.",
      palette: "Natural or slightly gritty tones; no glossy over-stylization.",
      freedom: "Prefer truthfulness, texture and atmosphere over polish."
    },
    retro_broadcast: {
      direction: "Retro broadcast design language inspired by archive TV, analog control rooms, CRT glow and legacy broadcast graphics.",
      composition: "Vintage framing, layered screens, archive-era visual cues, broadcast nostalgia with contemporary control.",
      palette: "Analog reds, faded blues, phosphor greens, warm grey plastics, tape-era tones.",
      freedom: "Allow deliberate temporal character and media-history references."
    },
    cinematic_noir: {
      direction: "Cinematic noir atmosphere with dramatic light, shadows, tension and moody editorial storytelling.",
      composition: "Directional light, asymmetry, selective visibility, dramatic depth and suspense.",
      palette: "Dark, contrast-rich palette with selective accent color and controlled glow.",
      freedom: "May feel filmic, urban or psychologically charged rather than corporate."
    },
    surreal_concept: {
      direction: "Surreal concept art with a serious editorial mind-set, not fantasy clichÃ©; strong metaphor over literal scene building.",
      composition: "Unexpected spatial logic, impossible scale, symbolic juxtapositions and striking concept image-making.",
      palette: "Palette may be poetic, uncanny or sharply symbolic if it supports the concept.",
      freedom: "Break realism decisively; do not fall back to default business visuals."
    },
    paper_collage: {
      direction: "Editorial collage world using paper texture, cutout logic, layered fragments, print feel and tactile composition.",
      composition: "Layered collage, torn edges, poster fragments, tactile surfaces, deliberate handmade rhythm.",
      palette: "Print-like palette, paper tones, overprints, restrained but characterful color decisions.",
      freedom: "Can be materially tactile and visibly constructed rather than clean digital."
    },
    bold_brutalist: {
      direction: "Bold brutalist poster aesthetic with oversized shapes, assertive geometry and unapologetic visual force.",
      composition: "Large forms, hard structure, poster-scale hierarchy, radical cropping and strong silhouette logic.",
      palette: "High-contrast graphic palette allowed; can be stark, loud or reduced.",
      freedom: "Reject safe corporate imagery; pursue a striking statement image."
    },
    luminous_abstract: {
      direction: "Atmospheric abstract lightscape with signal energy, gradients, reflections, glass, haze and spatial ambiguity.",
      composition: "No need for literal scene; create a believable abstract environment with depth and directional energy.",
      palette: "Light-driven palette, luminous transitions, colored haze, optical glow, subtle material reflections.",
      freedom: "Can be almost fully non-literal as long as it feels intentional and premium."
    },
    free_style: {
      direction: "Create a completely fresh style world based primarily on the user's own style references and prompt, not on a fixed house schema.",
      composition: "Choose the composition logic that best matches the requested style world rather than the default editorial recipe.",
      palette: "Palette is entirely open and should follow the requested style direction.",
      freedom: "Actively avoid falling back to the usual PROdigitalTV business-editorial pattern unless the user explicitly asks for it."
    }
  };
}

function imageGenerationContextFromRecord(record = {}, module = "editorialContent") {
  return {
    title: record.title || record.titel || record.headline || record.name || "",
    subtitle: record.subtitle || record.subline || record.kurztext || record.introText || "",
    bodyText: record.bodyText || record.articleText || record.longDescription || record.langtext || record.description || "",
    shortDescription: record.shortDescription || record.introText || record.teaserText || record.kurztext || "",
    category: record.category || record.bereich || record.page || "",
    module
  };
}

function creativeThumbPrompt(context = {}, userPrompt = "", variantNumber = 1) {
  const title = context.title || "PROdigitalTV Redaktion";
  const category = context.category ? `Rubrik: ${context.category}.` : "";
  const subtitle = context.subtitle ? `Subline: ${context.subtitle}.` : "";
  const bodyHint = context.bodyText ? `Inhaltlicher Kontext: ${String(context.bodyText).replace(/\s+/g, " ").slice(0, 520)}.` : "";
  const areaCatalog = {
    news: "Bereich/Anlass: News. Aktuelle redaktionelle Bildlogik, klare journalistische Relevanz, Website-Teaser-tauglich, nicht boulevardesk.",
    press: "Bereich/Anlass: Presse/Mitteilung. Glaubwuerdige PR-/Kommunikationsoptik, institutionelle Klarheit, professioneller Ankuendigungscharakter.",
    medienfruehstueck: "Bereich/Anlass: Medienfruehstueck. Business-Fruehstueck, Networking, Morgenlicht, Tischkultur, hochwertige Event-Atmosphaere.",
    von_den_besten: "Bereich/Anlass: Von den Besten. Dialog, Lernen von Expertinnen und Experten, Premium-Gespraech, Wissenstransfer, menschlicher Austausch ohne Promi-Imitation.",
    rueckblick: "Bereich/Anlass: Rueckblick. Erinnerung, Event-Atmosphaere, dokumentarischer Nachklang, Reflexion, wertige Recap-Energie.",
    versammlung: "Bereich/Anlass: Versammlungen. Mitglieder, Beschluesse, Verein, Tagesordnung, Konferenztisch, professionelle Governance-Atmosphaere.",
    member: "Bereich/Anlass: Mitglieder/Netzwerk. Partnerschaft, Kompetenz, Vertrauen, Branchenvernetzung, Business-Netzwerk.",
    general: "Bereich/Anlass: Allgemein. PROdigitalTV-Kontext aus dem CMS und gewaehlt Stilwelt bestimmen die Bildidee."
  };
  const styleCatalog = mediaAiStyleCatalog();
  const styleMeta = context.stylePreset && styleCatalog[context.stylePreset] ? styleCatalog[context.stylePreset] : styleCatalog.editorial_magazine;
  const stylePreset = styleMeta?.direction ? `Stilwelt: ${styleMeta.direction}` : "";
  const styleComposition = styleMeta?.composition ? `Kompositionslogik: ${styleMeta.composition}` : "";
  const stylePalette = styleMeta?.palette ? `Farb-/Materialwelt: ${styleMeta.palette}` : "";
  const styleFreedom = styleMeta?.freedom ? `Freiheitsgrad: ${styleMeta.freedom}` : "";
  const customStyle = context.style ? `Eigene Stilreferenz des Users: ${context.style}. Diese Referenz hat Vorrang vor Standardmustern.` : "";
  const colorWorld = context.colorWorld ? `Gewuenschte Farbwelt: ${context.colorWorld}.` : "";
  const motifType = context.motifType ? `Motivart: ${context.motifType}.` : "";
  const imageEffect = context.imageEffect ? `Bildwirkung: ${context.imageEffect}.` : "";
  const textArea = context.textArea && context.textArea !== "none" ? `Textflaeche: ${context.textArea} frei halten.` : "";
  const textOverlay = context.textOverlay
    ? `Text-Overlay/Covertext: Setze diesen Text exakt und gut lesbar im Bild: "${String(context.textOverlay).slice(0, 180)}". Nutze hochwertige Typografie, viel Weissraum und keine zusaetzlichen Fantasiewoerter.`
    : "";
  const targetArea = context.targetArea && areaCatalog[context.targetArea] ? areaCatalog[context.targetArea] : "";
  const baseIdea = context.stylePreset === "free_style"
    ? "Bildidee: entwickle eine eigenstaendige visuelle Welt, die sich klar vom Standard-Redaktionslook unterscheidet und den Prompt ernst nimmt."
    : "Bildidee: finde eine eigenstaendige visuelle Idee statt einer austauschbaren Standard-Thumbnail-Loesung.";
  const antiGeneric = context.stylePreset === "free_style"
    ? "Wichtig: kein Rueckfall in generische Business-, Stockfoto- oder Default-Editorial-Bilder. Lieber mutig, spezifisch und unverwechselbar."
    : "Wichtig: nicht generisch, keine austauschbare Stockfoto-Optik, keine schematische Standard-Business-Komposition.";
  const brandConstraint = context.stylePreset === "free_style"
    ? ""
    : "PROdigitalTV-Farbakzente nur einsetzen, wenn sie stilistisch wirklich passen; nicht in jedem Bild denselben Rot-Blau-Reflex wiederholen.";
  return [
    userPrompt,
    `Erzeuge Variante ${variantNumber} als eigenstaendiges, kreatives redaktionelles Thumbnail fuer den Beitrag "${title}".`,
    subtitle,
    category,
    bodyHint,
    stylePreset,
    styleComposition,
    stylePalette,
    styleFreedom,
    customStyle,
    colorWorld,
    motifType,
    imageEffect,
    textArea,
    textOverlay,
    targetArea,
    baseIdea,
    antiGeneric,
    brandConstraint,
    "Der thematische Bezug zu digitaler Medienwirtschaft, Streaming, TV, Plattformen, Redaktion, Technologie oder Netzwerk soll spuÌˆrbar sein, darf aber metaphorisch, abstrakt oder unerwartet geloest werden.",
    "Einschraenkungen: keine echten Logos, keine identifizierbaren realen Personen, keine Textfehler im Bild, keine Comic-Optik, keine irrefuehrenden Fakten.",
    "Format: 16:9, geeignet als Website-Thumbnail und Artikelkopf."
  ].filter(Boolean).join("\n");
}

function generatedThumbTitle(context = {}, variantNumber = 1) {
  return `${context.title || "PROdigitalTV Thumb"} - KI-Variante ${variantNumber}`;
}

function mediaPresetSummary(type = "upload") {
  const preset = mediaUsagePreset(type);
  return `${preset.aspect} Â· ${preset.width} x ${preset.height}px Â· ${preset.portal} Â· ${preset.mobile}`;
}

function mediaShortCode() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    return Array.from(values).map((value) => alphabet[value % alphabet.length]).join("");
  }
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function buildMediaFileName({ title = "", mediaType = "upload", format = "16x9", version = "v1", extension = "webp", code = "" } = {}) {
  const slug = normalizeMediaSlug(title);
  const type = normalizedMediaType(mediaType);
  const safeFormat = String(format || "16x9").toLowerCase().replace(/[^0-9x]/g, "") || "16x9";
  const safeVersion = /^v[0-9]+$/.test(String(version || "")) ? String(version) : "v1";
  const safeExtension = String(extension || "webp").toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const safeCode = String(code || mediaShortCode()).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || mediaShortCode();
  return `${slug}_${safeCode}_${type}_${safeFormat}_${safeVersion}.${safeExtension}`;
}

function mediaStoragePath(filename = "", mediaType = "upload", code = "") {
  const folder = mediaFolderForType(normalizedMediaType(mediaType));
  const safeCode = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return safeCode ? `images/${folder}/${safeCode}/${filename}` : `images/${folder}/${filename}`;
}

function mediaTags(value = "") {
  return String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function mediaTitleFromFileName(fileName = "") {
  const baseName = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/\b(v|version)[-_ ]?[0-9]+\b/gi, " ")
    .replace(/\b[0-9]{3,5}x[0-9]{3,5}\b/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!baseName) return "PROdigitalTV Bild";
  return baseName.split(" ").map((word) => {
    if (/^(tv|ki|cms|pdtv|pro)$/i.test(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

function mediaAutoTags(title = "", mediaType = "upload") {
  const stopWords = new Set(["bild", "image", "foto", "photo", "final", "neu", "new", "copy", "kopie", "version", "upload"]);
  const tokens = String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token.toLowerCase()));
  return Array.from(new Set(["PROdigitalTV", mediaType === "ai" ? "KI-Grafik" : "Bild", ...tokens])).slice(0, 8).join(", ");
}

function mediaKeywordsFromDescription(description = "", fallback = "") {
  const stopWords = new Set([
    "aber", "alle", "auch", "auf", "aus", "bei", "bild", "das", "dem", "den", "der", "die", "ein", "eine", "einem", "einen", "einer",
    "fuer", "mit", "oder", "und", "von", "vor", "zur", "zum", "als", "ist", "sind", "wird", "werden", "webseite", "mediathek",
    "image", "photo", "foto", "zeigt", "sichtbar", "motiv", "aufnahme", "darstellung"
  ]);
  const base = `${description || ""} ${fallback || ""}`;
  const counts = new Map();
  String(base)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !stopWords.has(token.toLowerCase()))
    .forEach((token) => {
      const key = token.toLowerCase();
      counts.set(key, { label: token.charAt(0).toUpperCase() + token.slice(1), count: (counts.get(key)?.count || 0) + 1 });
    });
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count).map((item) => item.label);
  return Array.from(new Set(["PROdigitalTV", "Bild", ...ranked])).slice(0, 10);
}

function mediaAutoDescription(title = "") {
  return `${title || "Bild"} fuer die PROdigitalTV-Mediathek.`;
}

function mediaSizeLabel(bytes = 0) {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function detectMediaAspectRatio({ width = 0, height = 0 } = {}) {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (!w || !h) return "16x9";
  const ratio = w / h;
  const candidates = [
    ["16x9", 16 / 9],
    ["3x2", 3 / 2],
    ["1x1", 1],
    ["4x5", 4 / 5],
    ["9x16", 9 / 16],
    ["4x3", 4 / 3],
    ["12x5", 12 / 5],
    ["16x7", 16 / 7],
    ["2x1", 2],
    ["social", 1200 / 630],
    ["logo", 2.55]
  ];
  return candidates
    .map(([format, target]) => ({ format, distance: Math.abs(ratio - target) }))
    .sort((a, b) => a.distance - b.distance)[0]?.format || "16x9";
}

function mediaAspectCss(format = "16x9") {
  const clean = String(format || "16x9").toLowerCase();
  if (clean === "1x1") return "1 / 1";
  if (clean === "4x5") return "4 / 5";
  if (clean === "9x16" || clean === "portrait" || clean === "hochkant") return "9 / 16";
  if (clean === "3x2") return "3 / 2";
  if (clean === "12x5") return "12 / 5";
  if (clean === "16x7") return "16 / 7";
  if (clean === "2x1") return "2 / 1";
  if (clean === "social") return "1200 / 630";
  if (clean === "logo") return "2.55 / 1";
  if (clean === "4x3") return "4 / 3";
  return "16 / 9";
}

function legacyMediaVariantCanvasSize(format = "16x9") {
  const clean = String(format || "16x9").toLowerCase();
  if (clean === "1x1") return { width: 1200, height: 1200, aspect: "1x1" };
  if (clean === "4x5") return { width: 1200, height: 1500, aspect: "4x5" };
  if (clean === "9x16" || clean === "portrait" || clean === "hochkant") return { width: 1080, height: 1920, aspect: "9x16" };
  if (clean === "logo") return { width: 1530, height: 600, aspect: "logo" };
  if (clean === "4x3") return { width: 1200, height: 900, aspect: "4x3" };
  return { width: 1600, height: 900, aspect: "16x9" };
}

function canvasToFile(canvas, filename = "bild.webp", type = "image/webp", quality = .9) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof canvas.toBlob !== "function") {
        const dataUrl = canvas.toDataURL(type, quality);
        const file = dataUrlToFile(dataUrl, filename);
        if (file) {
          resolve(file);
          return;
        }
        reject(new Error("Bildvariante konnte nicht erzeugt werden."));
        return;
      }
      canvas.toBlob((blob) => {
        if (!blob) {
          try {
            const dataUrl = canvas.toDataURL(type, quality);
            const file = dataUrlToFile(dataUrl, filename);
            if (file) {
              resolve(file);
              return;
            }
          } catch {}
          reject(new Error("Bildvariante konnte nicht erzeugt werden."));
          return;
        }
        resolve(new File([blob], filename, { type }));
      }, type, quality);
    } catch (error) {
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const file = dataUrlToFile(dataUrl, filename);
        if (file) {
          resolve(file);
          return;
        }
      } catch {}
      reject(new Error(error?.message || "Bildvariante konnte nicht erzeugt werden."));
    }
  });
}

function mediaOptimizedExtension(file = {}, mediaType = "upload") {
  if (file.type === "image/svg+xml") return "svg";
  return mediaType === "logo" && file.type === "image/png" ? "png" : "webp";
}

function mediaOptimizedMime(file = {}, mediaType = "upload") {
  if (file.type === "image/svg+xml") return "image/svg+xml";
  return mediaOptimizedExtension(file, mediaType) === "png" ? "image/png" : "image/webp";
}

function mediaVariantFileName(baseFilename = "", suffix = "web", extension = "webp") {
  const cleanSuffix = String(suffix || "web").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "web";
  const cleanExtension = String(extension || "webp").replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  return String(baseFilename || `bild.${cleanExtension}`).replace(/\.[^.]+$/, `_${cleanSuffix}.${cleanExtension}`);
}

function mediaVariantStoragePath(basePath = "", variantFilename = "") {
  const cleanBase = String(basePath || "").replace(/\/[^/]*$/, "");
  return `${cleanBase}/${variantFilename}`;
}

function mediaContainSize(width = 0, height = 0, maxWidth = 1600, maxHeight = 900) {
  const w = Math.max(1, Number(width || maxWidth));
  const h = Math.max(1, Number(height || maxHeight));
  const scale = Math.min(1, Number(maxWidth || w) / w, Number(maxHeight || h) / h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale
  };
}

async function optimizedMediaFile(file, { filename = "bild.webp", mediaType = "upload", maxWidth = 1600, maxHeight = 900, quality = .82 } = {}) {
  if (!file?.type?.startsWith("image/") || file.type === "image/svg+xml") {
    return { file, width: 0, height: 0, optimized: false, codec: file?.type || "" };
  }
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    const objectUrl = URL.createObjectURL(file);
    element.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);
      resolve(element);
    });
    element.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Bild konnte nicht fuer Web optimiert werden."));
    });
    element.src = objectUrl;
  });
  const size = mediaContainSize(image.naturalWidth, image.naturalHeight, maxWidth, maxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const mimeType = mediaOptimizedMime(file, mediaType);
  const output = await canvasToFile(canvas, filename, mimeType, quality);
  return {
    file: output,
    width: canvas.width,
    height: canvas.height,
    optimized: true,
    codec: mimeType,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    scale: size.scale
  };
}

async function createOptimizedMediaUploads(file, { filename = "", path = "", mediaType = "upload", preset = mediaUsagePreset(mediaType) } = {}) {
  if (!file || !filename || !path) return null;
  if (file.type === "image/svg+xml") {
    return {
      original: { file, filename, path, width: 0, height: 0, codec: file.type },
      web: { file, filename, path, width: 0, height: 0, codec: file.type, optimized: false },
      thumb: { file, filename, path, width: 0, height: 0, codec: file.type, optimized: false }
    };
  }
  const extension = mediaOptimizedExtension(file, mediaType);
  const webFilename = mediaVariantFileName(filename, "web", extension);
  const thumbFilename = mediaVariantFileName(filename, "thumb", extension);
  const webPath = mediaVariantStoragePath(path, webFilename);
  const thumbPath = mediaVariantStoragePath(path, thumbFilename);
  const web = await optimizedMediaFile(file, {
    filename: webFilename,
    mediaType,
    maxWidth: preset.width || 1600,
    maxHeight: preset.height || 900,
    quality: mediaType === "logo" ? .9 : .82
  });
  const thumb = await optimizedMediaFile(file, {
    filename: thumbFilename,
    mediaType,
    maxWidth: 640,
    maxHeight: 640,
    quality: .76
  });
  return {
    original: { file, filename, path, width: web.originalWidth || 0, height: web.originalHeight || 0, codec: file.type },
    web: { ...web, filename: webFilename, path: webPath },
    thumb: { ...thumb, filename: thumbFilename, path: thumbPath }
  };
}

function cropOffsetRatio(value = 0, size = 1) {
  return Math.abs(Number(size || 1)) > 0 ? Number(value || 0) / Number(size || 1) : 0;
}

function mediaCoverScaleForDimensions(sourceWidth = 1, sourceHeight = 1, viewportWidth = 1, viewportHeight = 1) {
  const imageAspect = Math.max(1, Number(sourceWidth || 1)) / Math.max(1, Number(sourceHeight || 1));
  const viewportAspect = Math.max(1, Number(viewportWidth || 1)) / Math.max(1, Number(viewportHeight || 1));
  return imageAspect > viewportAspect ? imageAspect / viewportAspect : viewportAspect / imageAspect;
}

function mediaRenderMetrics({ sourceWidth = 1, sourceHeight = 1, viewportWidth = 1, viewportHeight = 1, zoomFactor = 1, offsetXRatio = 0, offsetYRatio = 0 } = {}) {
  const vw = Math.max(1, Number(viewportWidth || 1));
  const vh = Math.max(1, Number(viewportHeight || 1));
  const sw = Math.max(1, Number(sourceWidth || 1));
  const sh = Math.max(1, Number(sourceHeight || 1));
  const baseScale = Math.min(vw / sw, vh / sh);
  const drawWidth = sw * baseScale * Math.max(.05, Number(zoomFactor || 1));
  const drawHeight = sh * baseScale * Math.max(.05, Number(zoomFactor || 1));
  const drawX = (vw - drawWidth) / 2 + Number(offsetXRatio || 0) * vw;
  const drawY = (vh - drawHeight) / 2 + Number(offsetYRatio || 0) * vh;
  return { viewportWidth: vw, viewportHeight: vh, sourceWidth: sw, sourceHeight: sh, baseScale, drawWidth, drawHeight, drawX, drawY };
}

function mediaCropDataFromEditorState({ variant = {}, stageWidth = 1, stageHeight = 1, sourceWidth = 1, sourceHeight = 1, zoomFactor = 1, offsetX = 0, offsetY = 0, adjustments = {} } = {}) {
  const metrics = mediaRenderMetrics({
    sourceWidth,
    sourceHeight,
    viewportWidth: stageWidth,
    viewportHeight: stageHeight,
    zoomFactor,
    offsetXRatio: cropOffsetRatio(offsetX, stageWidth),
    offsetYRatio: cropOffsetRatio(offsetY, stageHeight)
  });
  const pixelsPerSourceX = metrics.drawWidth / metrics.sourceWidth;
  const pixelsPerSourceY = metrics.drawHeight / metrics.sourceHeight;
  const cropX = Math.max(0, (-metrics.drawX) / Math.max(.0001, pixelsPerSourceX));
  const cropY = Math.max(0, (-metrics.drawY) / Math.max(.0001, pixelsPerSourceY));
  const cropWidth = Math.min(metrics.sourceWidth, metrics.viewportWidth / Math.max(.0001, pixelsPerSourceX));
  const cropHeight = Math.min(metrics.sourceHeight, metrics.viewportHeight / Math.max(.0001, pixelsPerSourceY));
  return {
    variantKey: variant.key || "",
    viewportWidth: Math.round(stageWidth),
    viewportHeight: Math.round(stageHeight),
    zoomFactor: Number(zoomFactor || 1),
    offsetXRatio: cropOffsetRatio(offsetX, stageWidth),
    offsetYRatio: cropOffsetRatio(offsetY, stageHeight),
    cropX: Math.max(0, Math.round(cropX)),
    cropY: Math.max(0, Math.round(cropY)),
    cropWidth: Math.max(1, Math.round(cropWidth)),
    cropHeight: Math.max(1, Math.round(cropHeight)),
    targetWidth: variant.width || 0,
    targetHeight: variant.height || 0,
    aspect: variant.aspect || "",
    brightness: Number(adjustments.brightness || 0),
    contrast: Number(adjustments.contrast || 0),
    saturation: Number(adjustments.saturation || 0),
    sharpness: Number(adjustments.sharpness || 0),
    black_white: Boolean(adjustments.black_white),
    isManual: true
  };
}

function mediaDefaultCropData(asset = {}, variantKey = "") {
  const variant = mediaVariantDefinition(variantKey, asset);
  const sourceWidth = Number(asset.image_width || asset.file_metadata?.width || variant.width || 1);
  const sourceHeight = Number(asset.image_height || asset.file_metadata?.height || variant.height || 1);
  const zoomFactor = Math.max(1, mediaCoverScaleForDimensions(sourceWidth, sourceHeight, variant.width, variant.height));
  return mediaCropDataFromEditorState({
    variant,
    stageWidth: variant.width,
    stageHeight: variant.height,
    sourceWidth,
    sourceHeight,
    zoomFactor,
    offsetX: 0,
    offsetY: 0,
    adjustments: {}
  });
}

function mediaRenderableSourceCandidates(asset = {}, preferredUrl = "") {
  const candidates = [
    preferredUrl,
    asset.file_path_original_url,
    asset.file_path_web_url,
    asset.file_path_thumb_url,
    asset.original_url,
    asset.web_url,
    asset.thumb_url,
    asset.imageUrl,
    asset.assetUrl,
    asset.fileUrl,
    asset.url,
    asset.downloadUrl,
    asset.thumbnail_url,
    asset.thumbnailUrl,
    asset.file_url,
    mediaAssetUrl(asset)
  ].map((value) => usableMediaAssetUrl(value)).filter(Boolean);
  return [...new Set(candidates)];
}

function mediaAsyncTimeout(promise, timeoutMs = 12000, label = "Medienvorgang") {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error(`${label} hat nicht rechtzeitig geantwortet.`)), timeoutMs))
  ]);
}

function mediaStoragePathFromDownloadUrl(url = "") {
  const text = String(url || "").trim();
  if (!text.includes("/o/")) return "";
  try {
    const match = text.match(/\/o\/([^?]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

function mediaSourceCanRenderSafely(source = "") {
  const value = String(source || "").trim();
  if (!value) return false;
  if (/^(data:image\/|blob:)/i.test(value)) return true;
  if (value.startsWith("/")) return true;
  try {
    const resolved = new URL(value, window.location.href);
    return resolved.origin === window.location.origin;
  } catch {
    return false;
  }
}

function mediaProxyUrl(source = "", asset = {}) {
  const url = String(source || "").trim();
  const storagePath = [
    asset.storage_path_original,
    asset.storage_path_web,
    asset.storage_path_thumb,
    asset.file_path_original,
    asset.file_path_web,
    asset.file_path_thumb,
    mediaStoragePathFromDownloadUrl(url)
  ].find(Boolean);
  try {
    if (storagePath) return `${mediaProxyFunctionUrl}?path=${encodeURIComponent(String(storagePath).replace(/^\/+/, ""))}`;
    if (/^https?:\/\//i.test(url)) return `${mediaProxyFunctionUrl}?url=${encodeURIComponent(url)}`;
    return "";
  } catch {
    return "";
  }
}

async function mediaDownloadObjectUrl(source = "") {
  const url = String(source || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return new Promise((resolve) => {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.responseType = "blob";
      request.timeout = 10000;
      request.onload = () => {
        if (request.status >= 200 && request.status < 300 && request.response) {
          const objectUrl = URL.createObjectURL(request.response);
          resolve({
            url: objectUrl,
            cleanup: () => URL.revokeObjectURL(objectUrl)
          });
          return;
        }
        resolve(null);
      };
      request.onerror = () => resolve(null);
      request.ontimeout = () => resolve(null);
      request.send();
    } catch {
      resolve(null);
    }
  });
}

async function mediaBlobObjectUrlForSource(source = "", asset = {}) {
  const storagePath = [
    asset.storage_path_original,
    asset.storage_path_web,
    asset.storage_path_thumb,
    asset.file_path_original,
    asset.file_path_web,
    asset.file_path_thumb,
    mediaStoragePathFromDownloadUrl(source)
  ].find(Boolean);
  const firebase = await getFirebaseStorageServices().catch(() => null);
  if (storagePath && firebase?.storageLib?.ref && (firebase?.storageLib?.getBlob || firebase?.storageLib?.getBytes)) {
    try {
      const reference = firebase.storageLib.ref(firebase.storage, String(storagePath).replace(/^\/+/, ""));
      let blob = null;
      if (firebase.storageLib.getBlob) {
        blob = await mediaAsyncTimeout(
          firebase.storageLib.getBlob(reference),
          10000,
          `Storage-Blob (${storagePath})`
        );
      } else if (firebase.storageLib.getBytes) {
        const bytes = await mediaAsyncTimeout(
          firebase.storageLib.getBytes(reference),
          10000,
          `Storage-Bytes (${storagePath})`
        );
        blob = new Blob([bytes], { type: asset.mime_type || asset.web_mime_type || "image/jpeg" });
      }
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        return {
          url: objectUrl,
          cleanup: () => URL.revokeObjectURL(objectUrl)
        };
      }
    } catch {
      // Fall through to direct download fallback when Storage blob access is unavailable.
    }
  }
  return await mediaDownloadObjectUrl(source);
}

async function loadMediaRenderableImage(input = "", asset = {}) {
  const candidates = Array.isArray(input)
    ? [...new Set(input.map((value) => usableMediaAssetUrl(value)).filter(Boolean))]
    : mediaRenderableSourceCandidates(asset, input);
  const directStorageSource = await mediaBlobObjectUrlForSource("", asset);
  if (directStorageSource?.url) {
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img), { once: true });
        img.addEventListener("error", () => reject(new Error("Originalbild konnte nicht aus dem Storage geladen werden.")), { once: true });
        img.src = directStorageSource.url;
      });
      return {
        image,
        sourceUrl: asset.file_path_original_url || asset.file_path_web_url || asset.file_path_thumb_url || "",
        cleanup: directStorageSource.cleanup || null
      };
    } catch {
      directStorageSource.cleanup?.();
    }
  }
  if (!candidates.length) throw new Error("Originalbild nicht gefunden.");
  let lastError = null;
  for (const source of candidates) {
    const proxySource = mediaProxyUrl(source, asset);
    const blobSource = /^https?:\/\//i.test(source)
      ? await mediaBlobObjectUrlForSource(source, asset)
      : null;
    const sourceCandidates = [
      blobSource?.url,
      proxySource,
      mediaSourceCanRenderSafely(source) ? source : ""
    ].filter(Boolean);
    if (!sourceCandidates.length) {
      blobSource?.cleanup?.();
      lastError = new Error("Remote-Bild konnte nicht canvas-sicher geladen werden.");
      continue;
    }
    for (const crossOriginMode of [true, false]) {
      for (const candidateSource of sourceCandidates) {
        try {
          const image = await new Promise((resolve, reject) => {
            const img = new Image();
            if (crossOriginMode && !candidateSource.startsWith("data:") && !candidateSource.startsWith("blob:")) img.crossOrigin = "anonymous";
            img.addEventListener("load", () => resolve(img), { once: true });
            img.addEventListener("error", () => reject(new Error("Originalbild konnte nicht geladen werden.")), { once: true });
            img.src = candidateSource;
          });
          return { image, sourceUrl: source, cleanup: blobSource?.cleanup || null };
        } catch (error) {
          lastError = error;
        }
      }
    }
    blobSource?.cleanup?.();
  }
  throw lastError || new Error("Originalbild konnte nicht geladen werden.");
}

async function listAssetVariantRecords(assetId = "") {
  if (!assetId) return [];
  return (await list("media_variants").catch(() => [])).filter((variant) => variant.media_asset_id === assetId);
}

function mediaVariantTimestamp(record = {}) {
  return Date.parse(record.updated_at || record.updatedAt || record.created_at || record.createdAt || 0) || 0;
}

function mediaVariantSortScore(record = {}, preferredId = "") {
  return [
    record.id === preferredId ? 1 : 0,
    record.file_url || record.file_path ? 1 : 0,
    record.derived_media_asset_id ? 1 : 0,
    mediaVariantTimestamp(record)
  ];
}

function compareMediaVariantRecords(left = {}, right = {}, preferredId = "") {
  const leftScore = mediaVariantSortScore(left, preferredId);
  const rightScore = mediaVariantSortScore(right, preferredId);
  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] === rightScore[index]) continue;
    return rightScore[index] - leftScore[index];
  }
  return String(right.id || "").localeCompare(String(left.id || ""));
}

async function removeDuplicateVariantAsset(assetId = "") {
  if (!assetId) return;
  const derivedAsset = await getOne("media_assets", assetId).catch(() => null);
  if (!derivedAsset) return;
  await deleteStoredAsset(derivedAsset).catch((error) => {
    console.warn("Varianten-Datei konnte nicht aus dem Storage geloescht werden:", assetId, error);
  });
  await remove("media_assets", assetId).catch((error) => {
    console.warn("Varianten-Asset konnte nicht geloescht werden:", assetId, error);
  });
}

async function normalizeAssetVariantRecords(asset = {}) {
  if (!asset?.id) return [];
  const existing = await listAssetVariantRecords(asset.id);
  if (!existing.length) return [];
  const grouped = new Map();
  existing.forEach((record) => {
    const key = String(record.variant_key || record.variant_type || "").trim().toLowerCase();
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  });
  const normalized = [];
  for (const key of MEDIA_VARIANT_ORDER) {
    const records = grouped.get(String(key).toLowerCase()) || [];
    if (!records.length) continue;
    const canonicalId = `media-variant-${asset.id}-${key}`;
    const preferred = [...records].sort((left, right) => compareMediaVariantRecords(left, right, canonicalId))[0];
    const variant = mediaVariantDefinition(key, asset);
    const canonicalRecord = await upsert("media_variants", {
      ...preferred,
      id: canonicalId,
      media_asset_id: asset.id,
      variant_key: key,
      variant_type: key,
      variant_label: preferred.variant_label || variant.label,
      format: preferred.format || variant.aspect,
      width: preferred.width || variant.width,
      height: preferred.height || variant.height,
      updated_at: new Date().toISOString()
    });
    normalized.push(canonicalRecord);
    for (const record of records) {
      if (record.id === canonicalId) continue;
      if (record.derived_media_asset_id && record.derived_media_asset_id !== canonicalRecord.derived_media_asset_id) {
        await removeDuplicateVariantAsset(record.derived_media_asset_id);
      }
      await remove("media_variants", record.id).catch((error) => {
        console.warn("Doppelte Varianten-Referenz konnte nicht geloescht werden:", record.id, error);
      });
    }
  }
  return normalized;
}

function variantCropRecordByKey(records = [], key = "") {
  const clean = String(key || "").trim().toLowerCase();
  return records.find((record) => String(record.variant_key || record.variant_type || "").toLowerCase() === clean) || null;
}

async function ensureAssetVariantRecords(asset = {}) {
  if (!asset?.id) return [];
  const existing = await normalizeAssetVariantRecords(asset);
  const byKey = new Map(existing.map((record) => [String(record.variant_key || record.variant_type || "").toLowerCase(), record]));
  const now = new Date().toISOString();
  for (const key of MEDIA_VARIANT_ORDER) {
    if (byKey.has(key)) continue;
    const variant = mediaVariantDefinition(key, asset);
    const cropData = mediaDefaultCropData(asset, key);
    const created = await upsert("media_variants", {
      id: `media-variant-${asset.id}-${key}`,
      media_asset_id: asset.id,
      variant_key: key,
      variant_type: key,
      variant_label: variant.label,
      format: variant.aspect,
      width: variant.width,
      height: variant.height,
      file_format: "webp",
      quality: variant.quality,
      render_status: "pending",
      crop_data: cropData,
      crop_x: cropData.cropX,
      crop_y: cropData.cropY,
      crop_width: cropData.cropWidth,
      crop_height: cropData.cropHeight,
      zoom_factor: cropData.zoomFactor,
      offset_x_ratio: cropData.offsetXRatio,
      offset_y_ratio: cropData.offsetYRatio,
      source_original_url: asset.file_path_original_url || asset.file_path_web_url || "",
      created_at: now,
      updated_at: now,
      created_by: currentUser()?.email || currentUser()?.uid || "cms"
    });
    byKey.set(key, created);
  }
  return [...byKey.values()];
}

function mediaDescriptionSuggestion(asset = {}, values = {}) {
  const title = values.title || asset.title || asset.filename_original || "PROdigitalTV Bild";
  const labels = { upload: "Upload-Bild", ai: "KI-Grafik", event: "Eventbild", article: "Artikelbild", news: "Newsbild", topic: "Themenbild", board: "Vorstandsbild", member: "Mitgliederbild", person: "Personenbild", logo: "Logo", thumb: "Thumbnail" };
  const type = labels[asset.media_type] || asset.media_type || "Bild";
  const format = values.active_variant_format || asset.aspect_ratio || "16x9";
  const tags = Array.isArray(asset.tags) ? asset.tags.join(", ") : String(asset.tags || "");
  return [
    `${title} als ${type} fuer die PROdigitalTV-Mediathek.`,
    `Das Motiv ist fuer das Format ${format} vorgesehen und kann redaktionell fuer Webseite, CMS und Medienbeitraege eingesetzt werden.`,
    tags ? `Schlagworte: ${tags}.` : ""
  ].filter(Boolean).join(" ");
}

function mediaAiDescriptionFromResult(result = {}, fallback = "") {
  const structured = result.structured || result.data || {};
  const parseJsonDescription = (value) => {
    const raw = String(value || "").trim();
    if (!raw || !raw.startsWith("{")) return "";
    try {
      const parsed = JSON.parse(raw);
      const firstImage = Array.isArray(parsed.images) ? parsed.images[0] : null;
      return firstImage?.beschreibung || firstImage?.description || parsed.beschreibung || parsed.description || "";
    } catch {
      return "";
    }
  };
  const suggestedText = String(result.suggestedText || "").trim();
  const candidates = [
    structured.images?.[0]?.beschreibung,
    structured.images?.[0]?.description,
    structured.beschreibung,
    structured.description,
    structured.image_description,
    structured.imageDescription,
    structured.alt_text,
    structured.altText,
    result.description,
    result.image_description,
    result.imageDescription,
    result.alt_text,
    result.altText,
    parseJsonDescription(suggestedText),
    suggestedText.startsWith("{") ? "" : suggestedText
  ];
  return String(candidates.find((value) => String(value || "").trim()) || fallback).trim();
}

function mediaAiThumbTextFromResult(result = {}, description = "") {
  const structured = result.structured || result.data || {};
  const parseJsonThumb = (value) => {
    const raw = String(value || "").trim();
    if (!raw || !raw.startsWith("{")) return "";
    try {
      const parsed = JSON.parse(raw);
      const firstImage = Array.isArray(parsed.images) ? parsed.images[0] : null;
      return firstImage?.thumbnail_alt || firstImage?.thumbnailAlt || firstImage?.thumb || parsed.thumbnail_alt || parsed.thumbnailAlt || parsed.thumbnail_description || "";
    } catch {
      return "";
    }
  };
  const suggestedText = String(result.suggestedText || "").trim();
  const candidates = [
    structured.thumbnail_alt,
    structured.thumbnailAlt,
    structured.thumbnail_description,
    structured.thumbnailDescription,
    structured.images?.[0]?.thumbnail_alt,
    structured.images?.[0]?.thumbnailAlt,
    structured.images?.[0]?.thumb,
    result.thumbnail_alt,
    result.thumbnailAlt,
    result.thumbnail_description,
    parseJsonThumb(suggestedText)
  ];
  const value = String(candidates.find((item) => String(item || "").trim()) || "").trim();
  return value || String(description || "").replace(/\s+/g, " ").slice(0, 160);
}

function wireMediaCardLinks() {
  const selectAssetForTarget = async (assetId = "", href = "", sourceNode = null) => {
    if (!assetId || !href) return false;
    const context = mediaContextFromHash(href);
    if (!context.targetCollection || !context.targetId) return false;
    const asset = await getOne("media_assets", assetId);
    if (!asset) return false;
    sourceNode?.classList?.add("is-saving");
    await attachMediaAssetToTarget(asset, context);
    if (context.returnTo) {
      window.location.hash = context.returnTo.replace(/^#\/?/, "#/");
      return true;
    }
    return false;
  };
  document.querySelectorAll("[data-media-select-button]").forEach((button) => {
    if (button.dataset.mediaSelectButtonWired === "1") return;
    button.dataset.mediaSelectButtonWired = "1";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const card = button.closest("[data-media-card]");
      const originalLabel = button.textContent;
      try {
        button.disabled = true;
        button.textContent = "Uebernehme ...";
        const jumped = await selectAssetForTarget(button.dataset.mediaSelectButton, button.dataset.mediaSelectHref, card || button);
        if (!jumped) {
          button.textContent = "Uebernommen";
          window.location.hash = button.dataset.mediaSelectHref || card?.dataset.mediaEditLink || window.location.hash;
        }
      } catch (error) {
        button.disabled = false;
        button.textContent = originalLabel;
        card?.classList?.remove("is-saving");
        console.error("Media asset selection failed", error);
      }
    });
  });
  document.querySelectorAll("[data-media-edit-link]").forEach((card) => {
    if (card.dataset.mediaEditLinkWired === "1") return;
    card.dataset.mediaEditLinkWired = "1";
    const open = async () => {
      if (card.dataset.mediaEditLink) {
        try {
          const id = new URLSearchParams(card.dataset.mediaEditLink.split("?")[1] || "").get("id");
          if (id) localStorage.setItem("pdt-last-media-asset-id", id);
        } catch {}
        if (card.dataset.mediaSelectAsset && await selectAssetForTarget(card.dataset.mediaSelectAsset, card.dataset.mediaEditLink, card)) return;
        window.location.hash = card.dataset.mediaEditLink;
      }
    };
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input, select, textarea, label, summary, details")) return;
      open().catch((error) => {
        card.classList.remove("is-saving");
        console.error("Media asset selection failed", error);
      });
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open().catch((error) => {
        card.classList.remove("is-saving");
        console.error("Media asset selection failed", error);
      });
    });
  });
}

function setaveButtonFeedback(button, state, label) {
  if (!button) return;
  if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
  button.classList.remove("is-save-success", "is-save-error");
  if (state === "saving") {
    button.disabled = true;
    button.textContent = label || "peichere ...";
    return;
  }
  if (state === "success" || state === "error") {
    button.disabled = false;
    button.classList.add(state === "success" ? "is-save-success" : "is-save-error");
    button.textContent = label || (state === "success" ? "Gespeichert" : "Fehler");
    window.setTimeout(() => {
      button.classList.remove("is-save-success", "is-save-error");
      button.textContent = button.dataset.originalLabel || "Speichern";
    }, 1400);
    return;
  }
  button.disabled = false;
  button.textContent = button.dataset.originalLabel || button.textContent;
}

function mediaFormatLabel(file = {}) {
  const extension = String(file.name || "").includes(".") ? String(file.name).split(".").pop().toUpperCase() : "";
  const mime = String(file.type || "").replace(/^image\//, "").toUpperCase();
  return extension || mime || "Bild";
}

function readImageDimensions(file) {
  if (!file?.type?.startsWith("image/") || file.type === "image/svg+xml") return Promise.resolve({ width: 0, height: 0 });
  return new Promise((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.addEventListener("load", () => {
      const dimensions = { width: image.naturalWidth || 0, height: image.naturalHeight || 0 };
      URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 0, height: 0 });
    });
    image.src = objectUrl;
  });
}

function renderMediaFileMeta(form, file, dimensions = {}) {
  const meta = form.querySelector("[data-media-file-meta]");
  if (!meta) return;
  if (!file) {
    meta.innerHTML = `<span>Noch keine Datei ausgewaehlt.</span>`;
    return;
  }
  const changed = file.lastModified ? new Date(file.lastModified).toLocaleDateString("de-DE") : "-";
  const pixel = dimensions.width && dimensions.height ? `${dimensions.width} x ${dimensions.height}px` : "Pixelmasse unbekannt";
  const aspect = detectMediaAspectRatio(dimensions);
  meta.innerHTML = `<dl>
    <div><dt>Format</dt><dd>${escapeHtml(mediaFormatLabel(file))}</dd></div>
    <div><dt>Ratio</dt><dd>${escapeHtml(aspect)}</dd></div>
    <div><dt>Groesse</dt><dd>${escapeHtml(mediaSizeLabel(file.size))}</dd></div>
    <div><dt>Pixel</dt><dd>${escapeHtml(pixel)}</dd></div>
    <div><dt>Datei</dt><dd>${escapeHtml(file.name || "-")}</dd></div>
    <div><dt>Geaendert</dt><dd>${escapeHtml(changed)}</dd></div>
  </dl>`;
}

function writeMediaFileMetaFields(form, file, dimensions = {}) {
  if (!form || !file) return;
  if (form.elements.image_width) form.elements.image_width.value = dimensions.width || "";
  if (form.elements.image_height) form.elements.image_height.value = dimensions.height || "";
  if (form.elements.image_format) form.elements.image_format.value = mediaFormatLabel(file);
  if (form.elements.file_size_label) form.elements.file_size_label.value = mediaSizeLabel(file.size);
  if (form.elements.original_filename) form.elements.original_filename.value = file.name || "";
  if (form.elements.file_last_modified) form.elements.file_last_modified.value = file.lastModified ? new Date(file.lastModified).toISOString() : "";
  if (form.elements.aspect_ratio && dimensions.width && dimensions.height) form.elements.aspect_ratio.value = detectMediaAspectRatio(dimensions);
}

async function saveCentralMediaUpload(form, file, { result = null, auto = false } = {}) {
  if (!form || !file) return null;
  const dimensions = (!form.elements.image_width?.value || !form.elements.image_height?.value)
    ? await readImageDimensions(file)
    : { width: Number(form.elements.image_width.value || 0), height: Number(form.elements.image_height.value || 0) };
  writeMediaFileMetaFields(form, file, dimensions);
  const values = formObject(form);
  const mediaType = normalizedMediaType(values.media_type || "upload");
  const mediaCode = /^[A-Z0-9]{4}$/.test(String(values.media_code || "")) ? values.media_code : ensureMediaCode(form);
  const detectedAspect = detectMediaAspectRatio(dimensions);
  const aspectRatio = values.aspect_ratio || detectedAspect || "16x9";
  const presetFields = mediaPresetFields(mediaType);
  const preset = mediaUsagePreset(mediaType);
  const extension = mediaFileExtension(file, mediaType === "logo" ? "png" : "webp");
  const filename = buildMediaFileName({ title: values.title || file.name, mediaType, format: aspectRatio, version: values.version, extension, code: mediaCode });
  const path = mediaStoragePath(filename, mediaType, mediaCode);
  if (result) result.innerHTML = `<div class="alert">${progressMarkup(auto ? "Bild wird gespeichert und fuer Web optimiert ..." : "Bild wird skaliert und fuer Web optimiert ...", auto ? 35 : 45)}</div>`;
  const optimizedUploads = await createOptimizedMediaUploads(file, { filename, path, mediaType, preset });
  if (result) result.innerHTML = `<div class="alert">${progressMarkup("Original, WebP und Thumb werden gespeichert ...", 64)}</div>`;
  const uploadedOriginal = await uploadMediaAsset(optimizedUploads.original.file, optimizedUploads.original.path);
  const [uploadedWeb, uploadedThumb] = await Promise.all([
    optimizedUploads.web.path === optimizedUploads.original.path
      ? Promise.resolve(uploadedOriginal)
      : uploadMediaAsset(optimizedUploads.web.file, optimizedUploads.web.path),
    optimizedUploads.thumb.path === optimizedUploads.original.path
      ? Promise.resolve(uploadedOriginal)
      : uploadMediaAsset(optimizedUploads.thumb.file, optimizedUploads.thumb.path)
  ]);
  const uploaded = uploadedWeb || uploadedOriginal;
  const now = new Date().toISOString();
  const assetId = `media-asset-${crypto.randomUUID()}`;
  const asset = await upsert("media_assets", {
    id: assetId,
    media_code: mediaCode,
    title: values.title || file.name,
    slug: normalizeMediaSlug(values.title || file.name),
    media_type: mediaType,
    ...presetFields,
    filename_original: filename,
    filename_web: optimizedUploads.web.filename,
    filename_thumb: optimizedUploads.thumb.filename,
    file_path_original: path,
    file_path_web: optimizedUploads.web.path,
    file_path_thumb: optimizedUploads.thumb.path,
    file_path_original_url: uploadedOriginal?.url || "",
    file_path_web_url: uploadedWeb?.url || uploadedOriginal?.url || "",
    file_path_thumb_url: uploadedThumb?.url || uploadedWeb?.url || uploadedOriginal?.url || "",
    storage_path_original: uploadedOriginal?.storagePath || path,
    storage_path_web: uploadedWeb?.storagePath || optimizedUploads.web.path,
    storage_path_thumb: uploadedThumb?.storagePath || optimizedUploads.thumb.path,
    mime_type: file.type,
    web_mime_type: optimizedUploads.web.file.type,
    thumb_mime_type: optimizedUploads.thumb.file.type,
    aspect_ratio: aspectRatio,
    detected_aspect_ratio: detectedAspect,
    aspect_css: mediaAspectCss(aspectRatio),
    file_size: file.size,
    file_size_label: values.file_size_label || mediaSizeLabel(file.size),
    web_file_size: optimizedUploads.web.file.size,
    web_file_size_label: mediaSizeLabel(optimizedUploads.web.file.size),
    thumb_file_size: optimizedUploads.thumb.file.size,
    thumb_file_size_label: mediaSizeLabel(optimizedUploads.thumb.file.size),
    image_width: Number(values.image_width || dimensions.width || 0),
    image_height: Number(values.image_height || dimensions.height || 0),
    web_image_width: optimizedUploads.web.width || Number(values.image_width || dimensions.width || 0),
    web_image_height: optimizedUploads.web.height || Number(values.image_height || dimensions.height || 0),
    thumb_image_width: optimizedUploads.thumb.width || 0,
    thumb_image_height: optimizedUploads.thumb.height || 0,
    image_format: values.image_format || mediaFormatLabel(file),
    web_image_format: String(optimizedUploads.web.file.type || "").replace(/^image\//, "").toUpperCase() || "WEBP",
    thumb_image_format: String(optimizedUploads.thumb.file.type || "").replace(/^image\//, "").toUpperCase() || "WEBP",
    web_codec: optimizedUploads.web.codec || optimizedUploads.web.file.type || "image/webp",
    thumb_codec: optimizedUploads.thumb.codec || optimizedUploads.thumb.file.type || "image/webp",
    optimization_status: optimizedUploads.web.optimized ? "optimized" : "original",
    optimization_quality: mediaType === "logo" ? .9 : .82,
    optimization_note: optimizedUploads.web.optimized ? "Web- und Thumb-Dateien fuer schnelle Portal-Auslieferung erzeugt." : "SVG oder nicht optimierbares Bild unveraendert uebernommen.",
    original_filename: values.original_filename || file.name,
    file_last_modified: values.file_last_modified || "",
    file_metadata: {
      format: values.image_format || mediaFormatLabel(file),
      mime_type: file.type,
      size_bytes: file.size,
      size_label: values.file_size_label || mediaSizeLabel(file.size),
      width: Number(values.image_width || dimensions.width || 0),
      height: Number(values.image_height || dimensions.height || 0),
      web: {
        filename: optimizedUploads.web.filename,
        mime_type: optimizedUploads.web.file.type,
        codec: optimizedUploads.web.codec || optimizedUploads.web.file.type,
        size_bytes: optimizedUploads.web.file.size,
        size_label: mediaSizeLabel(optimizedUploads.web.file.size),
        width: optimizedUploads.web.width || 0,
        height: optimizedUploads.web.height || 0,
        max_width: preset.width || 1600,
        max_height: preset.height || 900
      },
      thumb: {
        filename: optimizedUploads.thumb.filename,
        mime_type: optimizedUploads.thumb.file.type,
        codec: optimizedUploads.thumb.codec || optimizedUploads.thumb.file.type,
        size_bytes: optimizedUploads.thumb.file.size,
        size_label: mediaSizeLabel(optimizedUploads.thumb.file.size),
        width: optimizedUploads.thumb.width || 0,
        height: optimizedUploads.thumb.height || 0,
        max_width: 640,
        max_height: 640
      },
      aspect_ratio: aspectRatio,
      detected_aspect_ratio: detectedAspect,
      original_filename: values.original_filename || file.name,
      last_modified: values.file_last_modified || ""
    },
    source_type: "upload",
    created_by: currentUser()?.email || currentUser()?.uid || "cms",
    created_at: now,
    updated_at: now,
    status: "active",
    alt_text: values.alt_text || values.title || file.name,
    description: values.description || "",
    tags: mediaTags(values.tags)
  });
  await upsert("media_variants", {
    id: `media-variant-${crypto.randomUUID()}`,
    media_asset_id: asset.id,
    variant_type: "original",
    format: aspectRatio,
    detected_aspect_ratio: detectedAspect,
    file_path: path,
    file_url: uploadedOriginal?.url || "",
    filename,
    version: values.version || "v1",
    created_at: now,
    created_by: currentUser()?.email || currentUser()?.uid || "cms"
  });
  await Promise.all([
    upsert("media_variants", {
      id: `media-variant-${asset.id}-web`,
      media_asset_id: asset.id,
      variant_type: "web",
      variant_label: "Web optimiert",
      format: aspectRatio,
      file_path: optimizedUploads.web.path,
      file_url: uploadedWeb?.url || uploadedOriginal?.url || "",
      filename: optimizedUploads.web.filename,
      width: optimizedUploads.web.width || 0,
      height: optimizedUploads.web.height || 0,
      file_size: optimizedUploads.web.file.size,
      codec: optimizedUploads.web.codec || optimizedUploads.web.file.type,
      version: values.version || "v1",
      created_at: now,
      created_by: currentUser()?.email || currentUser()?.uid || "cms"
    }),
    upsert("media_variants", {
      id: `media-variant-${asset.id}-thumb`,
      media_asset_id: asset.id,
      variant_type: "thumb",
      variant_label: "Thumbnail optimiert",
      format: "thumb",
      file_path: optimizedUploads.thumb.path,
      file_url: uploadedThumb?.url || uploadedWeb?.url || uploadedOriginal?.url || "",
      filename: optimizedUploads.thumb.filename,
      width: optimizedUploads.thumb.width || 0,
      height: optimizedUploads.thumb.height || 0,
      file_size: optimizedUploads.thumb.file.size,
      codec: optimizedUploads.thumb.codec || optimizedUploads.thumb.file.type,
      version: values.version || "v1",
      created_at: now,
      created_by: currentUser()?.email || currentUser()?.uid || "cms"
    })
  ]);
  await ensureAssetVariantRecords(asset).catch((error) => {
    console.warn("Variant records could not be initialized", error);
  });
  if (result) {
    const note = uploaded?.fallback
      ? `Bild-ID ${escapeHtml(mediaCode)} gespeichert. Storage war nicht erreichbar, deshalb wurde eine optimierte Web-Version in der Datenbank abgelegt. Bildbearbeitung wird geoeffnet, KI-Beschreibung laeuft nach ...`
      : `Bild-ID ${escapeHtml(mediaCode)} gespeichert (${escapeHtml(aspectRatio)}, Web: ${escapeHtml(mediaSizeLabel(optimizedUploads.web.file.size))}, Thumb: ${escapeHtml(mediaSizeLabel(optimizedUploads.thumb.file.size))}). Bildbearbeitung wird geoeffnet, KI-Beschreibung und Keywords laufen nach ...`;
    result.innerHTML = `<div class="alert alert--success">${note}</div>`;
  }
  enrichUploadedMediaAsset(asset, { form, file, values, uploaded, mediaCode, filename, mediaType, aspectRatio, dimensions }).catch((error) => {
    console.warn("KI-Bildbeschreibung nach Upload fehlgeschlagen:", error);
  });
  return asset;
}

async function saveGeneratedThumbMediaAsset(form, file, { dataUrl = "", prompt = "", result = null, variantNumber = 1, contextOverride = null, targetContextOverride = null, attachToTarget = true } = {}) {
  const context = contextOverride || imageGenerationContext(form);
  const targetContext = targetContextOverride || {
    targetCollection: form?.dataset.module || (form?.id === "topic-editor-form" ? "topics" : "editorialContent"),
    targetId: form?.dataset.id || form?.dataset.topicId || "",
    targetField: "imageUrl",
    targetAltField: "thumbnail_alt"
  };
  const mediaCode = mediaShortCode();
  const mediaType = context.module === "topics" ? "topic" : "news";
  const aspectRatio = "16x9";
  const preset = mediaUsagePreset(mediaType);
  const title = generatedThumbTitle(context, variantNumber);
  const extension = mediaFileExtension(file, "webp");
  const filename = buildMediaFileName({ title, mediaType, format: aspectRatio, version: `v${variantNumber}`, extension, code: mediaCode });
  const path = mediaStoragePath(filename, mediaType, mediaCode);
  if (result) result.innerHTML = `<div class="alert">${progressMarkup("KI-Thumb wird in der Mediathek gespeichert ...", 64)}</div>`;
  const optimizedUploads = await createOptimizedMediaUploads(file, { filename, path, mediaType, preset });
  let uploadedOriginal;
  let uploadedWeb;
  let uploadedThumb;
  try {
    uploadedOriginal = await uploadMediaAsset(optimizedUploads.original.file, optimizedUploads.original.path);
    [uploadedWeb, uploadedThumb] = await Promise.all([
      optimizedUploads.web.path === optimizedUploads.original.path ? Promise.resolve(uploadedOriginal) : uploadMediaAsset(optimizedUploads.web.file, optimizedUploads.web.path),
      optimizedUploads.thumb.path === optimizedUploads.original.path ? Promise.resolve(uploadedOriginal) : uploadMediaAsset(optimizedUploads.thumb.file, optimizedUploads.thumb.path)
    ]);
  } catch (error) {
    throw new Error(`Storage-Upload fuer KI-Thumb fehlgeschlagen: ${error.message || String(error)}`);
  }
  const now = new Date().toISOString();
  const description = [
    `KI-Thumbnail-Variante ${variantNumber} fuer ${context.title || targetContext.targetId}.`,
    context.subtitle || "",
    context.category ? `Rubrik: ${context.category}` : ""
  ].filter(Boolean).join(" ");
  let asset;
  try {
    asset = await upsert("media_assets", {
    id: `media-asset-${crypto.randomUUID()}`,
    media_code: mediaCode,
    title,
    slug: normalizeMediaSlug(title),
    media_type: mediaType,
    ...mediaPresetFields(mediaType),
    filename_original: filename,
    filename_web: optimizedUploads.web.filename,
    filename_thumb: optimizedUploads.thumb.filename,
    file_path_original: optimizedUploads.original.path,
    file_path_web: optimizedUploads.web.path,
    file_path_thumb: optimizedUploads.thumb.path,
    file_path_original_url: uploadedOriginal?.url || dataUrl || "",
    file_path_web_url: uploadedWeb?.url || uploadedOriginal?.url || dataUrl || "",
    file_path_thumb_url: uploadedThumb?.url || uploadedWeb?.url || uploadedOriginal?.url || dataUrl || "",
    storage_path_original: uploadedOriginal?.storagePath || optimizedUploads.original.path,
    storage_path_web: uploadedWeb?.storagePath || optimizedUploads.web.path,
    storage_path_thumb: uploadedThumb?.storagePath || optimizedUploads.thumb.path,
    mime_type: optimizedUploads.web.file.type,
    aspect_ratio: aspectRatio,
    detected_aspect_ratio: aspectRatio,
    file_size: optimizedUploads.web.file.size,
    file_size_label: mediaSizeLabel(optimizedUploads.web.file.size),
    image_width: optimizedUploads.web.width || 1600,
    image_height: optimizedUploads.web.height || 900,
    image_format: mediaFormatLabel(optimizedUploads.web.file),
    original_filename: file.name,
    source_type: "ai",
    source_note: `KI-Thumbnail-Variante ${variantNumber}`,
    generated_prompt: prompt,
    prompt,
    ai_style_preset: context.stylePreset || "",
    ai_style_text: context.style || "",
    ai_motif_type: context.motifType || "",
    ai_image_effect: context.imageEffect || "",
    ai_text_area: context.textArea || "",
    ai_created_at: now,
    alt_text: context.title || title,
    thumbnail_alt: context.title || title,
    thumbnail_description: description,
    description,
    tags: mediaKeywordsFromDescription(`${description} ${prompt}`, context.category || mediaType),
    target_collection: targetContext.targetCollection,
    target_id: targetContext.targetId,
    target_field: targetContext.targetField,
    target_title: context.title || targetContext.targetId,
    linked_collection: targetContext.targetCollection,
    linked_record_id: targetContext.targetId,
    linked_field: targetContext.targetField,
    linked_title: context.title || targetContext.targetId,
    created_by: currentUser()?.email || currentUser()?.uid || "cms",
    created_at: now,
    updated_at: now,
    updatedAt: now,
    status: "active"
    });
  } catch (error) {
    throw new Error(`Mediathek-Asset konnte nicht gespeichert werden: ${error.message || String(error)}`);
  }
  try {
    await Promise.all([
      upsert("media_variants", {
        id: `media-variant-${asset.id}-web`,
        media_asset_id: asset.id,
        variant_type: "web",
        variant_label: "Web optimiert",
        format: aspectRatio,
        file_path: optimizedUploads.web.path,
        file_url: uploadedWeb?.url || uploadedOriginal?.url || dataUrl || "",
        filename: optimizedUploads.web.filename,
        width: optimizedUploads.web.width || 0,
        height: optimizedUploads.web.height || 0,
        file_size: optimizedUploads.web.file.size,
        codec: optimizedUploads.web.codec || optimizedUploads.web.file.type,
        version: `v${variantNumber}`,
        created_at: now,
        created_by: currentUser()?.email || currentUser()?.uid || "cms"
      }),
      upsert("media_variants", {
        id: `media-variant-${asset.id}-thumb`,
        media_asset_id: asset.id,
        variant_type: "thumb",
        variant_label: "Thumbnail optimiert",
        format: "thumb",
        file_path: optimizedUploads.thumb.path,
        file_url: uploadedThumb?.url || uploadedWeb?.url || uploadedOriginal?.url || dataUrl || "",
        filename: optimizedUploads.thumb.filename,
        width: optimizedUploads.thumb.width || 0,
        height: optimizedUploads.thumb.height || 0,
        file_size: optimizedUploads.thumb.file.size,
        codec: optimizedUploads.thumb.codec || optimizedUploads.thumb.file.type,
        version: `v${variantNumber}`,
        created_at: now,
        created_by: currentUser()?.email || currentUser()?.uid || "cms"
      })
    ]);
    await ensureAssetVariantRecords(asset).catch((error) => {
      console.warn("AI variant records could not be initialized", error);
    });
  } catch (error) {
    throw new Error(`Mediathek-Varianten konnten nicht gespeichert werden: ${error.message || String(error)}`);
  }
  if (attachToTarget) {
    try {
      await attachMediaAssetToTarget(asset, targetContext);
    } catch (error) {
      throw new Error(`Thumb konnte nicht mit dem Beitrag verknuepft werden: ${error.message || String(error)}`);
    }
  }
  return asset;
}

async function enrichUploadedMediaAsset(asset, { form, file, values, uploaded, mediaCode, filename, mediaType, aspectRatio, dimensions } = {}) {
  try {
    const aiResult = await callChatGptAction("generateImageAltText", {
      module: "media_library",
      entityType: "media_assets",
      entityId: asset.id,
      fieldName: "description",
      originalText: "",
      imageUrl: uploaded?.url || "",
      context: {
        mediaCode,
        title: asset.title || "",
        filename,
        originalFilename: file?.name || "",
        mediaType,
        format: aspectRatio,
        width: Number(values?.image_width || dimensions?.width || 0),
        height: Number(values?.image_height || dimensions?.height || 0)
      }
    });
    const fallbackDescription = values?.description || mediaAutoDescription(values?.title || file?.name);
    const aiDescription = mediaAiDescriptionFromResult(aiResult, fallbackDescription);
    const thumbText = mediaAiThumbTextFromResult(aiResult, aiDescription);
    const keywordList = mediaKeywordsFromDescription(aiDescription, `${values?.title || file?.name || ""} ${mediaType || ""}`);
    const enriched = await upsert("media_assets", {
      ...asset,
      description: aiDescription,
      alt_text: values?.alt_text || thumbText || aiDescription.slice(0, 180) || asset.alt_text,
      thumbnail_alt: thumbText,
      thumbnailAlt: thumbText,
      thumbnail_description: thumbText,
      thumb_text: thumbText,
      tags: keywordList,
      ai_description_status: "generated",
      ai_description_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (form?.elements?.description) form.elements.description.value = aiDescription;
    if (form?.elements?.tags) form.elements.tags.value = keywordList.join(", ");
    if (form?.elements?.alt_text && !String(form.elements.alt_text.value || "").trim()) form.elements.alt_text.value = enriched.alt_text || "";
    return enriched;
  } catch (error) {
    const fallbackDescription = values?.description || mediaAutoDescription(values?.title || file?.name);
    const keywordList = mediaKeywordsFromDescription(fallbackDescription, `${values?.title || file?.name || ""} ${mediaType || ""}`);
    await upsert("media_assets", {
      ...asset,
      description: fallbackDescription,
      tags: keywordList,
      ai_description_status: "fallback",
      ai_description_error: error?.message || String(error),
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (form?.elements?.description) form.elements.description.value = fallbackDescription;
    if (form?.elements?.tags) form.elements.tags.value = keywordList.join(", ");
    throw error;
  }
}

function updateMediaAutoFileName(form) {
  const output = form.querySelector("[data-media-auto-filename]");
  if (!output) return;
  const file = form.elements.mediaFile?.files?.[0];
  if (!file) {
    output.textContent = "Der Dateiname wird beim Speichern automatisch erstellt.";
    return;
  }
  const values = formObject(form);
  const mediaType = normalizedMediaType(values.media_type || "upload");
  const extension = mediaFileExtension(file, mediaType === "logo" ? "png" : "webp");
  const filename = buildMediaFileName({
    title: values.title || file.name,
    mediaType,
    format: values.aspect_ratio,
    version: values.version || "v1",
    extension,
    code: values.media_code || ensureMediaCode(form)
  });
  output.textContent = `Speichername: ${mediaStoragePath(filename, mediaType, values.media_code || ensureMediaCode(form))}`;
}

function ensureMediaCode(form) {
  const input = form?.elements?.media_code || form?.querySelector("[data-media-auto-code]");
  if (!input) return mediaShortCode();
  if (!/^[A-Z0-9]{4}$/.test(String(input.value || ""))) input.value = mediaShortCode();
  return input.value;
}

function setAutoField(field, value, force = false) {
  if (!field) return;
  if (force || !field.value || field.dataset.autoValue === "1") {
    field.value = value;
    field.dataset.autoValue = "1";
  }
}

function wireMediaUploadAutomation(form) {
  if (!form || form.dataset.mediaAutomationWired === "1") return;
  form.dataset.mediaAutomationWired = "1";
  const fileInput = form.elements.mediaFile;
  const title = form.elements.title;
  const description = form.elements.description;
  const tags = form.elements.tags;
  const alt = form.elements.alt_text;
  const mediaType = form.elements.media_type;
  const format = form.elements.aspect_ratio;
  const preview = form.querySelector("[data-media-upload-preview]");
  const pasteButton = form.querySelector("[data-media-paste-focus]");
  const applyDroppedFile = (file) => {
    if (!file || !fileInput) return false;
    if (!String(file.type || "").startsWith("image/")) return false;
    filesToInput(fileInput, [file]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  pasteButton?.addEventListener("click", () => {
    form.focus();
    const result = form.querySelector("#central-media-upload-result");
    if (result) result.innerHTML = `<div class="alert">Bereit: Bild kopieren und mit Strg+V einfuegen oder eine Bilddatei hier ablegen.</div>`;
  });
  form.addEventListener("paste", (event) => {
    const file = clipboardImageFile(event);
    const result = form.querySelector("#central-media-upload-result");
    if (!file) {
      if (result) result.innerHTML = `<div class="alert alert--error">In der Zwischenablage wurde kein Bild gefunden.</div>`;
      return;
    }
    event.preventDefault();
    if (result) result.innerHTML = `<div class="alert">Bild aus Zwischenablage eingefuegt. Speichere in der Mediathek ...</div>`;
    applyDroppedFile(file);
  });
  form.addEventListener("dragover", (event) => {
    event.preventDefault();
    form.classList.add("is-drag-over");
  });
  form.addEventListener("dragleave", (event) => {
    if (event.relatedTarget && form.contains(event.relatedTarget)) return;
    form.classList.remove("is-drag-over");
  });
  form.addEventListener("drop", (event) => {
    event.preventDefault();
    form.classList.remove("is-drag-over");
    const file = Array.from(event.dataTransfer?.files || []).find((item) => String(item.type || "").startsWith("image/"));
    const result = form.querySelector("#central-media-upload-result");
    if (!applyDroppedFile(file) && result) result.innerHTML = `<div class="alert alert--error">Bitte eine Bilddatei ablegen.</div>`;
  });
  const refreshGeneratedFields = (force = false) => {
    const file = fileInput?.files?.[0];
    if (file) ensureMediaCode(form);
    const nextTitle = title?.value || mediaTitleFromFileName(file?.name || "");
    setAutoField(title, nextTitle, force);
    setAutoField(description, mediaAutoDescription(title?.value || nextTitle), force);
    setAutoField(tags, mediaAutoTags(title?.value || nextTitle, mediaType?.value || "upload"), force);
    setAutoField(alt, title?.value || nextTitle, force);
    updateMediaAutoFileName(form);
  };
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    const dimensions = file ? await readImageDimensions(file) : { width: 0, height: 0 };
    writeMediaFileMetaFields(form, file, dimensions);
    renderMediaFileMeta(form, file, dimensions);
    if (preview) {
      if (file && file.type?.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${url}" alt="">`;
      } else {
        preview.innerHTML = `<span>Vorschau</span>`;
      }
    }
    refreshGeneratedFields(true);
    if (!file || form.dataset.mediaAutoSaving === "1") return;
    form.dataset.mediaAutoSaving = "1";
    const result = form.querySelector("#central-media-upload-result");
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = "Bild wird gespeichert ...";
    }
    try {
      const asset = await saveCentralMediaUpload(form, file, { result, auto: true });
      if (asset?.id) window.setTimeout(() => { window.location.hash = mediaEditHash(asset.id, form); }, 500);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Automatisches Speichern fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
      form.dataset.mediaAutoSaving = "0";
      if (button) {
        button.disabled = false;
        button.textContent = "Bild speichern";
      }
    }
  });
  title?.addEventListener("input", () => {
    title.dataset.autoValue = "0";
    refreshGeneratedFields(false);
  });
  [description, tags, alt].forEach((field) => field?.addEventListener("input", () => {
    field.dataset.autoValue = "0";
  }));
  mediaType?.addEventListener("change", () => refreshGeneratedFields(false));
  format?.addEventListener("change", () => updateMediaAutoFileName(form));
  refreshGeneratedFields(false);
}

function localSeoDescription(article = {}) {
  const text = String(article.subline || article.subtitle || article.bodyText || article.body || "").replace(/\s+/g, " ").trim();
  return limitText(text || "Redaktionelle Einordnung fuer TV-, Streaming- und Medienanbieter.", 158);
}

function localArticleKeywords(article = {}, fallbackKeywords = []) {
  const title = String(article.headline || article.title || "");
  const subline = String(article.subline || article.subtitle || "");
  const body = String(article.bodyText || article.body || "");
  const category = String(article.category || "");
  const sourceKeywords = [
    ...(Array.isArray(fallbackKeywords) ? fallbackKeywords : []),
    ...(Array.isArray(article.tags) ? article.tags : []),
    article.primary_keyword || article.primaryKeyword || "",
    category,
    ...(`${title} ${subline}`).match(/[A-Za-zÃ„Ã–ÃœÃ¤Ã¶Ã¼ÃŸ][A-Za-zÃ„Ã–ÃœÃ¤Ã¶Ã¼ÃŸ-]{3,}/g) || []
  ];
  const stopWords = new Set([
    "eine", "einer", "eines", "einem", "einen", "auch", "oder", "und", "fuer", "mit", "auf", "aus", "das", "der", "die",
    "den", "dem", "des", "zur", "zum", "von", "als", "ist", "sind", "werden", "wird", "kann", "soll", "thema", "beitrag",
    "redaktionelle", "redaktioneller", "digitale", "digitalen", "branche", "medienbranche"
  ]);
  const frequency = new Map();
  sourceKeywords.forEach((raw) => {
    const keyword = String(raw || "").replace(/^Themenvorschlag:\s*/i, "").trim();
    if (!keyword || keyword.length < 4) return;
    const normalized = keyword.toLowerCase();
    if (stopWords.has(normalized)) return;
    frequency.set(keyword, (frequency.get(keyword) || 0) + 1);
  });
  String(body).match(/[A-ZÃ„Ã–Ãœ][A-Za-zÃ„Ã–ÃœÃ¤Ã¶Ã¼ÃŸ-]{4,}(?:\s+[A-ZÃ„Ã–Ãœ][A-Za-zÃ„Ã–ÃœÃ¤Ã¶Ã¼ÃŸ-]{3,})?/g)?.slice(0, 18).forEach((keyword) => {
    const clean = keyword.trim();
    if (!stopWords.has(clean.toLowerCase())) frequency.set(clean, (frequency.get(clean) || 0) + 1);
  });
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .slice(0, 12)
    .map(([keyword], index) => ({
      keyword,
      keyword_type: index === 0 ? "Hauptkeyword" : category.toLowerCase().includes("recht") ? "Rechtskeyword" : "Branchenkeyword",
      relevance_score: index === 0 ? 95 : Math.max(58, 88 - index * 4),
      is_primary: index === 0,
      explanation: index === 0 ? "Zentrales Thema aus Headline, Kategorie und Beitragstext." : "Automatisch aus Artikelinhalt und Themenkontext abgeleitet."
    }));
}

function localEditorialKeywords(article = {}, fallbackKeywords = []) {
  const title = String(article.headline || article.title || "");
  const subline = String(article.subline || article.subtitle || "");
  const body = String(article.bodyText || article.body || "");
  const category = String(article.category || "");
  const rules = [
    ["KI", [" ki ", "kuenstliche intelligenz", "kunstliche intelligenz", "artificial intelligence"]],
    ["KI in Redaktion", ["ki in redaktion", "redaktionelle ki", "ki redaktion"]],
    ["Voice-Cloning", ["voice cloning", "voice-cloning", "ki stimmen", "ki-stimmen"]],
    ["Streaming", ["streaming", "streamingdienst", "streaming angebot"]],
    ["OTT", [" ott ", "over the top", "over-the-top"]],
    ["FAST-Channels", ["fast channel", "fast-channel", "fast channels", "fast-channels"]],
    ["HbbTV", ["hbbtv"]],
    ["Smart-TV", ["smart tv", "smart-tv", "connected tv", "ctv"]],
    ["Addressable TV", ["addressable tv", "adressierbare werbung"]],
    ["Mediathek", ["mediathek", "mediatheken"]],
    ["Distribution", ["distribution", "ausspielung", "verbreitung"]],
    ["CDN", [" cdn ", "content delivery network"]],
    ["Produktion", ["produktion", "produktionsprozess", "produktionsprozesse"]],
    ["Postproduktion", ["postproduktion", "post-production"]],
    ["Synchronbranche", ["synchron", "synchronbranche", "synchronisation"]],
    ["Vermarktung", ["vermarktung", "vermarkter"]],
    ["Werbung", ["werbung", "werbemarkt", "werbestrategie"]],
    ["Reichweite", ["reichweite", "reichweiten"]],
    ["Plattformregulierung", ["plattformregulierung", "plattformregeln", "digital services act", " dsa "]],
    ["Medienrecht", ["medienrecht", "rundfunkrecht"]],
    ["Urheberrecht", ["urheberrecht", "copyright"]],
    ["Verwertungsrecht", ["verwertungsrecht", "rechteklaerung", "rechteklarung"]],
    ["Musikrechte", ["musikrechte", "gema", "vg wort"]],
    ["Barrierefreiheit", ["barrierefreiheit", "accessibility"]],
    ["Untertitel", ["untertitel", "subtitles", "captioning"]],
    ["Leichte Sprache", ["leichte sprache"]],
    ["Medienpolitik", ["medienpolitik", "medienaufsicht"]],
    ["Digitalmedien", ["digitalmedien", "digitale medien"]]
  ];
  const stopWords = new Set([
    "quelle", "quellen", "quellenlage", "quellenfund", "redaktionell", "redaktionelle", "redaktioneller",
    "pruefen", "prufen", "veroeffentlichung", "veroeffentlichungen", "gefunden", "aktuell", "aktuelle",
    "thema", "themen", "vorschlag", "themenvorschlag", "presse", "meldung", "meldungen", "news",
    "artikel", "beitrag", "branche", "medienbranche", "digital", "digitale", "digitalen"
  ]);
  const normalizeKeyword = (value = "") => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const haystack = (...parts) => ` ${normalizeKeyword(parts.filter(Boolean).join(" ")).replace(/[^a-z0-9+.-]+/g, " ")} `;
  const cleanKeyword = (value = "") => String(value || "").replace(/^Themenvorschlag:\s*/i, "").replace(/\s+/g, " ").trim().replace(/^[-:]+|[-:]+$/g, "");
  const keywordKey = (value = "") => normalizeKeyword(cleanKeyword(value)).replace(/[^a-z0-9+]+/g, " ").trim();
  const candidates = new Map();
  const addKeyword = (raw, score = 60) => {
    const keyword = cleanKeyword(raw);
    const key = keywordKey(keyword);
    if (!keyword || keyword.length < 2 || keyword.length > 44 || stopWords.has(key)) return;
    if (/^(bei|von|mit|fuer|fur|und|oder|aus|zur|zum|der|die|das)\b/i.test(keyword)) return;
    const existing = candidates.get(key);
    if (!existing || existing.score < score) candidates.set(key, { keyword, score });
  };
  [
    ...(Array.isArray(fallbackKeywords) ? fallbackKeywords : []),
    ...(Array.isArray(article.tags) ? article.tags : []),
    article.primary_keyword || article.primaryKeyword || "",
    ...String(category || "").split(/\s*\/\s*/)
  ].forEach((keyword) => addKeyword(keyword, 82));
  const text = haystack(title, subline, body, category);
  rules.forEach(([label, terms]) => {
    if (terms.some((term) => text.includes(haystack(term)))) {
      addKeyword(label, haystack(title, category).includes(haystack(label)) ? 100 : 90);
    }
  });
  String(title || "").match(/\b[A-Z][A-Za-z0-9+]*(?:-[A-Z0-9][A-Za-z0-9+]*)+\b/g)?.forEach((keyword) => addKeyword(keyword, 74));
  if (!candidates.size) ["TV", "Streaming", "Digitalmedien"].forEach((keyword, index) => addKeyword(keyword, 70 - index * 4));
  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword, "de"))
    .slice(0, 12)
    .map(({ keyword }, index) => ({
      keyword,
      keyword_type: index === 0 ? "Hauptkeyword" : category.toLowerCase().includes("recht") ? "Rechtskeyword" : "Branchenkeyword",
      relevance_score: index === 0 ? 95 : Math.max(58, 88 - index * 4),
      is_primary: index === 0,
      explanation: index === 0 ? "Zentrales Fachkeyword aus Headline, Kategorie und Beitragstext." : "Aus kuratiertem Branchenvokabular und Themenkontext abgeleitet."
    }));
}

function localSeoPayload(article = {}, keywords = []) {
  const headline = String(article.headline || article.title || "").replace(/^Themenvorschlag:\s*/i, "").trim();
  const seoTitle = limitText(headline || "PROdigitalTV Branchenbeitrag", 68);
  const seoDescription = localSeoDescription(article);
  const seoKeywords = keywords.map((keyword) => keyword.keyword || keyword).filter(Boolean).slice(0, 8).join(", ");
  return {
    slug: article.slug || slugify(seoTitle),
    seoTitle,
    seo_title: seoTitle,
    seoDescription,
    seo_description: seoDescription,
    seoKeywords,
    seo_keywords: seoKeywords
  };
}

function normalizeMorningText(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function cleanMorningFullText(value = "") {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeMorningKey(value = "") {
  return normalizeMorningText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceIsApprovedForMorning(source = {}) {
  const status = normalizeMorningKey(source.source_status || source.review_status || source.check_status || "");
  return ["erlaubt", "bevorzugt"].includes(status);
}

function isMorningBriefingWorkItem(item = {}) {
  const marker = normalizeMorningKey([item.workflow, item.content_type, item.contentType, item.origin, item.source, item.category].join(" "));
  return marker.includes("morning") || marker.includes("morgenbriefing");
}

function verifiedSourceForMorning(item = {}, sources = []) {
  const sourceText = normalizeMorningKey([item.source, item.source_name, item.sourceName, item.original_url, item.originalUrl, item.source_url, item.url].join(" "));
  return sources.find((source) => {
    if (!sourceIsApprovedForMorning(source)) return false;
    const keys = [source.id, source.name, source.title, source.domain, source.url].map(normalizeMorningKey).filter(Boolean);
    return keys.some((key) => key && sourceText.includes(key));
  }) || null;
}

function parseMorningMeta(meta = "") {
  const raw = normalizeMorningText(meta);
  return {
    is_regulator: /\b(regulator|behoerde|behorde|bundestag|bundesnetzagentur|eu|parlament|zak|dlm|medienanstalt)\b/i.test(raw),
    source_type: /regulator/i.test(raw) ? "Behoerde" : raw || ""
  };
}

function parseMorningBriefingPipeRows(text = "") {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, index) => {
      const [headline = "", summary = "", relevance = "", source = "", originalUrl = "", firstSeen = "", meta = "", ...fullTextParts] = line.split("|").map((part) => part.trim());
      if (!headline || !summary) throw new Error(`Zeile ${index + 1}: Headline und Summary sind Pflicht.`);
      const parsedMeta = parseMorningMeta(meta);
      const now = new Date().toISOString();
      const sourceKey = slugify([headline, source, originalUrl].filter(Boolean).join("-")).slice(0, 90) || crypto.randomUUID();
      const fullText = cleanMorningFullText(fullTextParts.join(" | "));
      return {
        id: `morning-item-${sourceKey}`,
        workflow: "morning_briefing",
        content_type: "morning_news_item",
        headline,
        title: headline,
        summary,
        teaser: summary,
        relevance,
        source,
        source_name: source,
        original_url: originalUrl,
        url: originalUrl,
        first_seen: firstSeen || now,
        category: relevance || "Morgenbriefing",
        score: parsedMeta.is_regulator ? 85 : 70,
        status: "Neu",
        morning_status: "Neu",
        source_type: parsedMeta.source_type || "Importquelle",
        is_regulator: parsedMeta.is_regulator,
        duplicate_of: "",
        full_text: fullText,
        fullText,
        text_length: fullText.length || summary.length,
        created_at: now,
        updated_at: now,
        origin: "morning_briefing_pipe_import",
        keywords: singleMorningKeywords([headline, summary, fullText, relevance, source].join(" "))
      };
    });
}

function morningUrlKey(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    [...url.searchParams.keys()].forEach((key) => {
      if (/^(utm_|fbclid|gclid|mc_|pk_)/i.test(key)) url.searchParams.delete(key);
    });
    url.hash = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function morningRawText(raw = {}) {
  return cleanMorningFullText(raw.full_text || raw.fullText || raw.bodyText || raw.text || raw.content || raw.summary || "");
}

function findRawMorningSource(row = {}, rawRows = []) {
  const rowUrl = morningUrlKey(row.original_url || row.originalUrl || row.url || "");
  const rowTitle = normalizeMorningKey(row.headline || row.title || "");
  const rowSource = normalizeMorningKey(row.source || row.source_name || "");
  if (rowUrl) {
    const exact = rawRows.find((raw) => morningUrlKey(raw.original_url || raw.originalUrl || raw.url || raw.source_url || raw.sourceUrl || "") === rowUrl);
    if (exact) return exact;
  }
  return rawRows.find((raw) => {
    const rawTitle = normalizeMorningKey(raw.headline || raw.title || "");
    const rawSource = normalizeMorningKey(raw.source || raw.source_name || raw.sourceName || raw.source_domain || "");
    if (!rowTitle || !rawTitle) return false;
    const titleMatch = rawTitle.includes(rowTitle.slice(0, 42)) || rowTitle.includes(rawTitle.slice(0, 42));
    const sourceMatch = !rowSource || !rawSource || rawSource.includes(rowSource.slice(0, 24)) || rowSource.includes(rawSource.slice(0, 24));
    return titleMatch && sourceMatch;
  }) || null;
}

function enrichMorningRowsWithRawText(rows = [], rawRows = []) {
  return rows.map((row) => {
    const existingText = normalizeMorningText(row.full_text || row.fullText || "");
    const raw = existingText ? null : findRawMorningSource(row, rawRows);
    const rawText = raw ? morningRawText(raw) : "";
    const fullText = existingText || rawText;
    if (!fullText) return row;
    return {
      ...row,
      full_text: fullText,
      fullText,
      text_length: fullText.length,
      raw_data_id: raw?.id || row.raw_data_id || "",
      source_raw_id: raw?.id || row.source_raw_id || "",
      summary: row.summary || limitText(fullText, 450),
      teaser: row.teaser || row.summary || limitText(fullText, 450),
      keywords: singleMorningKeywords([row.headline, row.summary, fullText, row.relevance, row.source].join(" "))
    };
  });
}

function singleMorningKeywords(text = "") {
  return localEditorialKeywords({ title: text, bodyText: text, category: text }, [])
    .map((item) => item.keyword)
    .slice(0, 12);
}

function findMorningDuplicate(item = {}, existing = []) {
  const url = normalizeMorningText(item.original_url || item.originalUrl || item.url || "");
  const headline = normalizeMorningKey(item.headline || item.title || "");
  return existing.find((candidate) => {
    if (candidate.id === item.id) return false;
    const candidateUrl = normalizeMorningText(candidate.original_url || candidate.originalUrl || candidate.url || candidate.source_url || "");
    if (url && candidateUrl && url === candidateUrl) return true;
    const candidateTitle = normalizeMorningKey(candidate.headline || candidate.title || "");
    if (!headline || !candidateTitle) return false;
    return candidateTitle.includes(headline.slice(0, 40)) || headline.includes(candidateTitle.slice(0, 40));
  }) || null;
}

function morningArticleBody(item = {}) {
  const summary = cleanMorningFullText(item.summary || item.teaser || item.subline || "");
  const sourceText = cleanMorningFullText(item.full_text || item.fullText || item.bodyText || item.text || "");
  return sourceText || summary || cleanMorningFullText(item.headline || item.title || "Morgenbriefing-Meldung");
}

async function morningArticleDraftFromItem(item = {}) {
  const now = new Date().toISOString();
  const sources = await list("verified_sources").catch(() => []);
  const approvedSource = verifiedSourceForMorning(item, sources);
  const originalUrl = item.original_url || item.originalUrl || item.url || "";
  const sourceStatus = approvedSource && originalUrl ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen";
  const status = "Entwurf";
  const title = limitText(normalizeMorningText(item.headline || item.title || "Morgenbriefing-Meldung"), 80);
  const subline = limitText(normalizeMorningText(item.summary || item.teaser || ""), 180);
  const bodyText = morningArticleBody(item);
  const importedFullText = cleanMorningFullText(item.full_text || item.fullText || item.bodyText || item.text || "");
  const keywords = localEditorialKeywords({ title, subline, bodyText, category: item.category || item.relevance || "" }, item.keywords || []);
  const seo = localSeoPayload({ title, headline: title, subline, bodyText, slug: slugify(title) }, keywords);
  const articleId = `morning-article-${slugify([item.first_seen || now.slice(0, 10), title].join("-")).slice(0, 90) || crypto.randomUUID()}`;
  const sourceSnapshot = [{
    title: item.source || item.source_name || approvedSource?.name || "Originalquelle",
    publisher: item.source || item.source_name || approvedSource?.name || "",
    domain: originalUrl ? domainFromUrl(originalUrl) : approvedSource?.domain || "",
    url: originalUrl,
    source_type: item.source_type || approvedSource?.source_type || "Morgenbriefing",
    trust_score: Number(approvedSource?.trust_score || 0),
    check_status: sourceStatus
  }];
  return {
    id: articleId,
    title,
    headline: title,
    subtitle: subline,
    subline,
    introText: subline,
    shortText: subline,
    teaserText: subline,
    bodyText,
    ai_original_suggested_text: bodyText,
    source_suggested_text: bodyText,
    imported_full_text: importedFullText,
    source_full_text: importedFullText,
    text_length: bodyText.length,
    page: "news",
    section: "news",
    key: `news.${articleId}`,
    slug: seo.slug || articleId,
    ...seo,
    category: item.category || item.relevance || "Morgenbriefing",
    tags: keywords.map((keyword) => keyword.keyword),
    primary_keyword: keywords[0]?.keyword || "",
    keyword_json: keywords,
    thumbnail_idea: item.thumbnail_idea || `Redaktionelles Branchenmotiv zur Meldung: ${title}.`,
    thumbnail_prompt: item.thumbnail_prompt || `Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV zur Meldung "${title}". Sachlicher Business-Look, TV-, Streaming- und digitale Medienwirtschaft, keine Logos, keine realen Personen, keine erfundenen Fakten.`,
    source_snapshot_json: sourceSnapshot,
    source_status: sourceStatus,
    duplicate_status: "redaktioneller Hinweis",
    ai_check_status: "vorbereitet",
    legal_check_status: "offen",
    publication_status: status,
    status: "draft",
    visibility: "internal",
    relevance_score: Number(item.score || item.relevance_score || 0),
    relevance_reason: item.relevance || "",
    author_type: "ai",
    author_name: "KI-Redaktion",
    generation_origin: "morning_briefing",
    content_type: "morning_briefing_article",
    editorialType: "morning_briefing",
    publication_target: "news",
    morning_briefing_item_id: item.id,
    topic_suggestion_id: item.id,
    original_url: originalUrl,
    ai_log_json: {
      workflow: "morning_briefing",
      rule: "editor_decides",
      sourceApproved: Boolean(approvedSource),
      sourceId: approvedSource?.id || ""
    },
    publishDate: now.slice(0, 10),
    validFrom: now.slice(0, 10),
    createdAt: now,
    updatedAt: now
  };
}

function cleanPressArticleText(value = "") {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanPressArticleIntro(release = {}) {
  const text = cleanPressArticleText(release.summary || release.full_text || release.fullText || "");
  const sentence = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2).join(" ");
  return limitText(sentence || "Aktuelle Pressemitteilung zur redaktionellen Weiterverarbeitung.", 260);
}

function pressArticleSlug(release = {}) {
  const sourcePart = release.source_domain || release.sourceDomain || release.source_name || release.sourceName || "";
  return slugify([release.published_at || release.publishedAt || "", sourcePart, release.title || ""].filter(Boolean).join("-"))
    || `pressemitteilung-${Date.now().toString(36)}`;
}

function pressArticleId(release = {}) {
  const rawId = String(release.id || "").replace(/^press-/i, "");
  const safeId = slugify(rawId) || pressArticleSlug(release) || crypto.randomUUID();
  return `ai-press-article-${safeId}`;
}

function editorialDraftFromPressRelease(release = {}, profile = {}) {
  const now = new Date().toISOString();
  const title = cleanPressArticleText(release.title || "Pressemitteilung");
  const intro = cleanPressArticleIntro(release);
  const bodyText = cleanPressArticleText(release.full_text || release.fullText || release.summary || "");
  const slug = pressArticleSlug({ ...release, title });
  const sourceName = cleanPressArticleText(release.source_name || release.sourceName || release.source_domain || release.sourceDomain || "");
  const sourceDomain = cleanPressArticleText(release.source_domain || release.sourceDomain || "");
  const sourceUrl = cleanPressArticleText(release.url || "");
  const importedBy = profile.email || profile.uid || "system";
  return {
    id: pressArticleId(release),
    title,
    headline: title,
    subtitle: intro,
    subline: intro,
    introText: intro,
    shortText: intro,
    teaserText: intro,
    bodyText,
    body: bodyText,
    page: "news",
    section: "news",
    key: `news.${slug}`,
    slug,
    seoTitle: title.slice(0, 70),
    seo_title: title.slice(0, 70),
    seoDescription: intro.slice(0, 155),
    seo_description: intro.slice(0, 155),
    category: "Presseimport",
    tags: ["Pressemitteilung", sourceName, sourceDomain].filter(Boolean),
    primary_keyword: "Pressemitteilung",
    source_status: "Originalquelle importiert",
    duplicate_status: "noch nicht geprueft",
    ai_check_status: "offen",
    legal_check_status: "offen",
    publication_status: "Entwurf",
    status: "draft",
    visibility: "internal",
    author_type: "ai",
    author_name: "KI-Redaktion",
    publication_target: "news",
    imported_press_release_id: release.id,
    original_source_url: sourceUrl,
    original_source_name: sourceName,
    original_published_at: release.published_at || release.publishedAt || "",
    publishDate: release.published_at || release.publishedAt || "",
    validFrom: release.published_at || release.publishedAt || "",
    ai_log_json: {
      import_flow: "german_press_release_import",
      imported_by: importedBy,
      source_url: sourceUrl,
      source_name: sourceName,
      note: "Volltext aus aktueller Pressemitteilung importiert. Redaktionell pruefen, einordnen und erst dann veroeffentlichen."
    },
    createdAt: release.imported_at || release.importedAt || now,
    created_at: release.imported_at || release.importedAt || now,
    updatedAt: now,
    updated_at: now
  };
}

function articleSourceFromPressRelease(articleId, release = {}) {
  const now = new Date().toISOString();
  const sourceName = cleanPressArticleText(release.source_name || release.sourceName || release.source_domain || release.sourceDomain || "Originalquelle");
  return {
    id: `${articleId}-original-press-source`,
    article_id: articleId,
    articleId,
    title: cleanPressArticleText(release.title || "Pressemitteilung"),
    publisher: sourceName,
    domain: cleanPressArticleText(release.source_domain || release.sourceDomain || ""),
    url: cleanPressArticleText(release.url || ""),
    source_type: "Pressemitteilung",
    trust_score: 70,
    check_status: "ungeprueft",
    relevance_note: "Originalquelle der importierten Pressemitteilung.",
    claim_reference: "Volltext muss redaktionell eingeordnet werden.",
    accessed_at: now,
    created_at: now,
    updated_at: now
  };
}

function optimizeLocalEditorialText(value = "") {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (!text) return "";
  const paragraphs = text.split(/\n+/).map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean);
  return paragraphs.map((paragraph) => {
    return paragraph
      .replace(/\bsehr sehr\b/gi, "sehr")
      .replace(/\bKI-Redaktion\b/g, "Redaktion")
      .replace(/\bArbeitsentwurf\b/g, "Entwurf")
      .replace(/\bVeroeffentlichung bleibt blockiert\b/g, "Veroeffentlichung bleibt an die Pruefung gebunden");
  }).join("\n\n");
}

function summarizeLocalEditorialText(article = {}) {
  const body = String(article.bodyText || article.body || "").replace(/\s+/g, " ").trim();
  const firstSentence = body.split(/(?<=[.!?])\s+/).find(Boolean) || article.subline || article.subtitle || "";
  return limitText(firstSentence || "Redaktionelle Einordnung fuer die digitale Medienwirtschaft.", 90);
}

async function writeAiArticleLog(articleId, status, message, details = {}) {
  await upsert("ai_editorial_logs", {
    id: `ai-editorial-log-${crypto.randomUUID()}`,
    article_id: articleId,
    task_name: "KI_Redaktion_Manuelle_Pruefung",
    status,
    message,
    found_topics_json: [],
    rejected_topics_json: [],
    used_sources_json: details.usedSources || [],
    source_check_json: details.sourceCheck || {},
    duplicate_check_json: details.duplicateCheck || {},
    keyword_result_json: details.keywordResult || {},
    ai_check_json: details.aiCheck || {},
    error_json: details.error || {},
    created_at: new Date().toISOString()
  });
}

function normalizeAiSuggestion(value, button, sourceField) {
  const maxLength = aiFieldLimit(button, sourceField);
  return maxLength ? limitText(value, maxLength) : String(value || "").trim();
}

function progressMarkup(label, width = 45) {
  return `<span class="cms-progress"><span>${escapeHtml(label)}</span><span class="progress progress--indeterminate"><i style="width:${width}%"></i></span></span>`;
}

const mediaAiProgressSteps = [
  ["context", "Kontext"],
  ["prompt", "Prompt"],
  ["generate", "KI-Grafik"],
  ["save", "Speichern"],
  ["variants", "Varianten"],
  ["link", "Verknuepfen"]
];

function mediaAiProgressMarkup(activeStep, label, width = 20, detail = "") {
  const activeIndex = Math.max(0, mediaAiProgressSteps.findIndex(([key]) => key === activeStep));
  const stepItems = mediaAiProgressSteps.map(([key, name], index) => {
    const state = index < activeIndex ? "is-done" : index === activeIndex ? "is-active" : "";
    return `<li class="${state}"><span>${index < activeIndex ? "ok" : index + 1}</span>${escapeHtml(name)}</li>`;
  }).join("");
  return `<div class="media-ai-progress">
    ${progressMarkup(label, width)}
    ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
    <ol>${stepItems}</ol>
  </div>`;
}

function setMediaAiProgress(form, activeStep, label, width = 20, detail = "") {
  const result = form?.querySelector("#media-ai-result");
  const pipeline = form?.querySelector("[data-media-ai-pipeline]");
  form?.classList.add("is-generating");
  form?.setAttribute("aria-busy", "true");
  const markup = mediaAiProgressMarkup(activeStep, label, width, detail);
  if (pipeline) {
    pipeline.hidden = false;
    pipeline.innerHTML = markup;
    if (activeStep === "context") {
      pipeline.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  if (result) result.innerHTML = "";
}

function clearMediaAiProgress(form) {
  form?.classList.remove("is-generating");
  form?.removeAttribute("aria-busy");
}

function mediaAiReviewMarkup(asset = {}, mediaContext = {}, imageUrl = "") {
  const title = asset.title || "KI-Grafik";
  const previewUrl = imageUrl || mediaAssetUrl(asset);
  return `<div class="media-ai-review" data-media-ai-review data-media-ai-asset-id="${escapeHtml(asset.id || "")}">
    <div class="media-ai-review__image">${previewUrl ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(title)}">` : `<span>Vorschau nicht verfuegbar</span>`}</div>
    <div class="media-ai-review__body">
      <p class="eyebrow">KI-Grafik erzeugt</p>
      <h3>${escapeHtml(title)}</h3>
      <p>Bitte pruefen: Erst nach der Freigabe wird das Bild ${mediaContext?.targetId ? "mit dem Beitrag verknuepft und im Bildeditor geoeffnet" : "im Bildeditor geoeffnet"}.</p>
      <div class="actions">
        <button class="button button--primary" type="button" data-media-ai-approve="${escapeHtml(asset.id || "")}">Freigeben und bearbeiten</button>
        <button class="button button--secondary" type="button" data-media-ai-discard="${escapeHtml(asset.id || "")}">Verwerfen</button>
        <button class="button button--secondary" type="submit">Neu erstellen</button>
      </div>
    </div>
  </div>`;
}

function wireMediaAiReviewActions(form, asset, mediaContext = {}) {
  const result = form?.querySelector("#media-ai-result");
  result?.querySelector("[data-media-ai-approve]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Freigabe wird gespeichert ...";
    try {
      if (mediaContext.targetCollection && mediaContext.targetId) {
        await attachMediaAssetToTarget(asset, mediaContext);
      }
      await upsert("media_assets", {
        ...asset,
        review_status: "approved",
        ai_review_status: "approved",
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      window.location.hash = mediaEditHash(asset.id, form);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Freigabe konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>${mediaAiReviewMarkup(asset, mediaContext)}`;
      wireMediaAiReviewActions(form, asset, mediaContext);
    }
  });
  result?.querySelector("[data-media-ai-discard]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Wird verworfen ...";
    try {
      await deleteMediaAssetCascade(asset);
      if (result) result.innerHTML = `<div class="alert alert--success">KI-Kandidat wurde verworfen. Du kannst direkt eine neue Grafik erzeugen.</div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">KI-Kandidat konnte nicht geloescht werden: ${escapeHtml(error.message || String(error))}</div>${mediaAiReviewMarkup(asset, mediaContext)}`;
      wireMediaAiReviewActions(form, asset, mediaContext);
    }
  });
}

function setAudioGenerationProgress(scope, result, label, width = 45) {
  scope?.classList.add("is-generating");
  scope?.setAttribute("aria-busy", "true");
  if (result) result.innerHTML = `<div class="alert">${progressMarkup(label, width)}</div>`;
}

function clearAudioGenerationProgress(scope) {
  scope?.classList.remove("is-generating");
  scope?.removeAttribute("aria-busy");
}

function applyAudioAreaFilter(control) {
  const panel = control?.closest(".panel");
  const areaValue = panel?.querySelector("[data-audio-area-filter]")?.value || "";
  const subareaValue = panel?.querySelector("[data-audio-subarea-filter]")?.value || "";
  const table = panel?.querySelector(".table--audio-service");
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tbody tr[data-audio-area]"));
  let visibleCount = 0;
  rows.forEach((row) => {
    const visible = (!areaValue || row.dataset.audioArea === areaValue)
      && (!subareaValue || row.dataset.audioSubarea === subareaValue);
    row.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  const count = panel?.querySelector("[data-audio-area-count]");
  const label = subareaValue || areaValue;
  if (count) count.textContent = label ? `${visibleCount} Inhalte in ${label}` : `${visibleCount} Inhalte`;
}

const TOPIC_RESEARCH_STEPS = [
  "CMS-Kontext und Eingaben vorbereiten",
  "Quellenliste laden und nach Kategorie priorisieren",
  "Quellenveroeffentlichungen abrufen",
  "Aktuelle Themen aus den Quellen ableiten",
  "Themen nach Aktualitaet und Branchenrelevanz sortieren",
  "Belastbare Vorschlaege speichern und Liste aktualisieren"
];

const PRESS_IMPORT_STEPS = [
  "Presseimport vorbereiten",
  "Portale und Quellenstatus laden",
  "Pressebereiche abrufen",
  "Aktuelle Pressemitteilungen pruefen",
  "Dubletten und Altlasten abgleichen",
  "Presseliste speichern und aktualisieren"
];

const MORNING_BRIEFING_STEPS = [
  "Morgenbriefing vorbereiten",
  "Freigegebene Quellen laden",
  "Quellen abrufen und neue Meldungen erkennen",
  "Quellenfunde speichern",
  "Dubletten pruefen und Relevanz bewerten",
  "Briefing-Meldungen zusammenstellen"
];

function sourceSearchText(source = {}) {
  return [
    source.name,
    source.title,
    source.publisher,
    source.domain,
    source.category,
    source.default_for_categories,
    source.source_type,
    source.notes
  ].flatMap((item) => Array.isArray(item) ? item : [item]).filter(Boolean).join(" ").toLowerCase();
}

function normalizeResearchTerm(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sourceMatchesUiCategory(source = {}, category = "") {
  const categoryKey = normalizeResearchTerm(category);
  if (!categoryKey) return true;
  const categoryTokens = (value = "") => normalizeResearchTerm(value)
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !["in", "und", "oder", "der", "die", "das", "fuer", "fur"].includes(item));
  const sourceText = normalizeResearchTerm([
    source.category,
    source.default_for_categories,
    source.defaultForCategories,
    source.source_type,
    source.sourceType,
    source.notes
  ].flatMap((item) => Array.isArray(item) ? item : [item]).filter(Boolean).join(" "));
  const requestedTokens = categoryTokens(categoryKey);
  const sourceTokens = categoryTokens(sourceText);
  return sourceText.includes(categoryKey)
    || requestedTokens.every((token) => sourceTokens.includes(token))
    || requestedTokens.some((token) => token.length > 3 && sourceText.includes(token));
}

function uniqueResearchSources(sources = []) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = String(source.domain || source.url || source.name || source.id || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function researchSourceIsExcluded(source = {}) {
  const text = normalizeResearchTerm([source.id, source.name, source.domain, source.url].join(" "));
  return /\brtl\b|rtl deutschland|rtl\.com|rtl\.de/.test(text);
}

function researchSourceHasKnownHub(source = {}) {
  const text = normalizeResearchTerm([source.id, source.name, source.domain, source.url].join(" "));
  return /(vaunet|die-medienanstalten|bitkom|anga|agf|gema|bsi|hbbtv|fraunhofer|ard|zdf|meedia|dwdl)/.test(text);
}

async function topicResearchSourcePool(category = "", keywords = "", sourceId = "") {
  let verifiedSources = [];
  try {
    verifiedSources = await list("verified_sources");
  } catch {
    verifiedSources = [];
  }
  const categoryParts = normalizeResearchTerm(category).split(/[^a-z0-9]+/i).filter((part) => part.length > 3);
  const keywordParts = normalizeResearchTerm(keywords).split(/[,;\s]+/).filter((part) => part.length > 3);
  const terms = [...categoryParts, ...keywordParts];
  const aiSourceCatalog = await getAiSourceCatalog();
  const allowedSources = uniqueResearchSources([...verifiedSources, ...aiSourceCatalog])
    .filter((source) => !researchSourceIsExcluded(source))
    .filter((source) => !String(source.source_status || source.review_status || "").toLowerCase().includes("gesperrt"))
    .filter((source) => Number(source.trust_score || source.suggested_trust_score || 0) >= 70);
  const sourceFilter = String(sourceId || "").trim().toLowerCase();
  const filteredSources = sourceFilter
    ? allowedSources.filter((source) => [source.id, source.domain, source.url, source.name, source.title].some((value) => String(value || "").trim().toLowerCase() === sourceFilter))
    : allowedSources;
  const matchingSources = category ? filteredSources.filter((source) => sourceMatchesUiCategory(source, category)) : filteredSources;
  const minimumPoolSize = sourceFilter ? 1 : category ? Math.min(30, filteredSources.length) : 0;
  const displayPool = category && matchingSources.length < minimumPoolSize
    ? uniqueResearchSources([...matchingSources, ...filteredSources]).slice(0, minimumPoolSize)
    : matchingSources;
  return displayPool.sort((a, b) => {
      const aText = normalizeResearchTerm(sourceSearchText(a));
      const bText = normalizeResearchTerm(sourceSearchText(b));
      const aHits = terms.filter((term) => aText.includes(term)).length;
      const bHits = terms.filter((term) => bText.includes(term)).length;
      const aHubBoost = researchSourceHasKnownHub(a) ? 120 : 0;
      const bHubBoost = researchSourceHasKnownHub(b) ? 120 : 0;
      return (bHubBoost + bHits * 20) - (aHubBoost + aHits * 20)
        || Number(a.priority || 99) - Number(b.priority || 99)
        || Number(b.trust_score || b.suggested_trust_score || 0) - Number(a.trust_score || a.suggested_trust_score || 0);
    });
}

async function morningBriefingSourcePool() {
  let verifiedSources = [];
  try {
    verifiedSources = await list("verified_sources");
  } catch {
    verifiedSources = [];
  }
  const aiSourceCatalog = await getAiSourceCatalog();
  return uniqueResearchSources([...verifiedSources, ...aiSourceCatalog])
    .filter((source) => ["erlaubt", "bevorzugt"].includes(normalizeResearchTerm(source.source_status || source.review_status || source.check_status)))
    .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99)
      || Number(b.trust_score || b.suggested_trust_score || 0) - Number(a.trust_score || a.suggested_trust_score || 0));
}

function researchSourceLabel(source = {}) {
  return source.name || source.title || source.publisher || source.domain || "Quelle";
}

function recordTimestampMs(record = {}) {
  const value = record.created_at || record.createdAt || record.imported_at || record.importedAt || record.updated_at || record.updatedAt || "";
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function countMorningRawFindsSince(startedAtMs = Date.now()) {
  const rows = await list("ai_topic_raw_data").catch(() => []);
  const threshold = Math.max(0, startedAtMs - 120000);
  return rows.filter((row) => recordTimestampMs(row) >= threshold).length;
}

function morningBriefingStatusMarkup({ startedAt = Date.now(), stepIndex = 0, done = false, sourcePool = [], sourceIndex = 0, result = null } = {}) {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  const boundedStep = Math.max(0, Math.min(MORNING_BRIEFING_STEPS.length - 1, stepIndex));
  const totalSources = Number(result?.totalSources || result?.total_sources || sourcePool.length || 0);
  const researchedSources = Number(result?.researchedSources || result?.researched_sources || 0);
  const sourcePublications = Number(result?.sourcePublications || result?.source_publications || result?.liveSourcePublications || 0);
  const percent = done
    ? 100
    : totalSources && researchedSources
      ? Math.max(12, Math.min(94, Math.round((researchedSources / Math.max(1, totalSources)) * 88)))
      : Math.max(12, Math.min(92, Math.round(((boundedStep + 1) / MORNING_BRIEFING_STEPS.length) * 86)));
  const headline = done ? "Morgenbriefing abgeschlossen" : "Morgenbriefing laeuft";
  const activeSourcePosition = sourcePool.length ? Math.min(sourceIndex + 1, sourcePool.length) : 0;
  const activeSource = !done && sourcePool.length ? sourcePool[activeSourcePosition - 1] : null;
  const upcomingSources = sourcePool.length ? sourcePool.slice(activeSourcePosition, activeSourcePosition + 3) : [];
  return `<div class="ai-research-status ${done ? "ai-research-status--done" : ""}">
    ${progressMarkup(headline, percent)}
    <div class="ai-research-status__meta"><strong>Status:</strong> ${escapeHtml(MORNING_BRIEFING_STEPS[boundedStep])}<span>${elapsedSeconds}s</span></div>
    ${activeSource ? `<div class="ai-research-current-source"><span>Aktuelle Quelle ${activeSourcePosition} von ${sourcePool.length}</span><strong>${escapeHtml(researchSourceLabel(activeSource))}</strong><small>${escapeHtml(activeSource.domain || activeSource.url || "")}</small></div>` : ""}
    ${!done && upcomingSources.length ? `<div class="ai-research-source-strip">${upcomingSources.map((source) => `<span>${escapeHtml(researchSourceLabel(source))}</span>`).join("")}</div>` : ""}
    <ol class="ai-research-steps">${MORNING_BRIEFING_STEPS.map((step, index) => `<li class="${done || index < boundedStep ? "is-done" : index === boundedStep ? "is-active" : ""}"><span>${index + 1}</span>${escapeHtml(step)}</li>`).join("")}</ol>
    <div class="ai-press-progress__stats"><span>Quellen: ${researchedSources || activeSourcePosition || 0}/${totalSources || sourcePool.length || "?"}</span><span>Quellenfunde: ${sourcePublications}</span><span>Briefing: ${Number(result?.items || 0)}</span></div>
    <p class="muted">Hinweis: Das Morgenbriefing erzeugt Arbeitsdaten. Veroeffentlicht wird erst nach redaktioneller Freigabe.</p>
  </div>`;
}

function topicResearchStatusMarkup({ contextLabel = "", startedAt = Date.now(), stepIndex = 0, done = false, sourcePool = [], sourceIndex = 0 }) {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  const boundedStep = Math.max(0, Math.min(TOPIC_RESEARCH_STEPS.length - 1, stepIndex));
  const percent = done
    ? 100
    : Math.max(12, Math.min(92, Math.round(((boundedStep + 1) / TOPIC_RESEARCH_STEPS.length) * 86)));
  const headline = done
    ? "Themenrecherche abgeschlossen"
    : `Themenrecherche laeuft${contextLabel ? ` fuer ${contextLabel}` : ""}`;
  const activeSourcePosition = sourcePool.length ? Math.min(sourceIndex + 1, sourcePool.length) : 0;
  const activeSource = !done && sourcePool.length ? sourcePool[activeSourcePosition - 1] : null;
  const upcomingSources = sourcePool.length
    ? sourcePool.slice(activeSourcePosition, activeSourcePosition + 3)
    : [];
  const sourceNote = sourcePool.length && sourceIndex + 1 > sourcePool.length
    ? `<small>Alle angezeigten Quellen wurden durchlaufen. Warte auf Speicherung und Auswertung.</small>`
    : "";
  return `<div class="ai-research-status ${done ? "ai-research-status--done" : ""}">
    ${progressMarkup(headline, percent)}
    <div class="ai-research-status__meta"><strong>Status:</strong> ${escapeHtml(TOPIC_RESEARCH_STEPS[boundedStep])}<span>${elapsedSeconds}s</span></div>
    ${activeSource ? `<div class="ai-research-current-source"><span>Aktuelle Quelle ${activeSourcePosition} von ${sourcePool.length}</span><strong>${escapeHtml(researchSourceLabel(activeSource))}</strong><small>${escapeHtml(activeSource.domain || activeSource.url || "")}</small>${sourceNote}</div>` : ""}
    ${!done && upcomingSources.length ? `<div class="ai-research-source-strip">${upcomingSources.map((source) => `<span>${escapeHtml(researchSourceLabel(source))}</span>`).join("")}</div>` : ""}
    <ol class="ai-research-steps">${TOPIC_RESEARCH_STEPS.map((step, index) => `<li class="${done || index < boundedStep ? "is-done" : index === boundedStep ? "is-active" : ""}"><span>${index + 1}</span>${escapeHtml(step)}</li>`).join("")}</ol>
    <p class="muted">Hinweis: Das ist eine laufende Themenrecherche, noch keine Quellen- oder Faktenfreigabe.</p>
  </div>`;
}

function pressImportStatusMarkup({ startedAt = Date.now(), run = null, stepIndex = 0, done = false }) {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  const boundedStep = Math.max(0, Math.min(PRESS_IMPORT_STEPS.length - 1, stepIndex));
  const scanned = Number(run?.scanned_sources || 0);
  const planned = Number(run?.planned_sources || 0);
  const percent = done
    ? 100
    : planned
      ? Math.max(12, Math.min(94, Math.round((scanned / Math.max(1, planned)) * 92)))
      : Math.max(12, Math.min(92, Math.round(((boundedStep + 1) / PRESS_IMPORT_STEPS.length) * 86)));
  const scans = Array.isArray(run?.scans) ? run.scans : [];
  const currentScan = !done ? scans[scans.length - 1] : null;
  const recentScans = scans.slice(-4).reverse();
  const headline = done ? "Presseimport abgeschlossen" : (run?.message || "Presseimport laeuft");
  return `<div class="ai-research-status ${done ? "ai-research-status--done" : ""}">
    ${progressMarkup(headline, percent)}
    <div class="ai-research-status__meta"><strong>Status:</strong> ${escapeHtml(PRESS_IMPORT_STEPS[boundedStep])}<span>${elapsedSeconds}s</span></div>
    ${currentScan ? `<div class="ai-research-current-source"><span>Aktuelles Portal ${scanned || recentScans.length} von ${planned || "?"}</span><strong>${escapeHtml(currentScan.source_name || currentScan.source_domain || "Portal")}</strong><small>${escapeHtml(currentScan.reason || currentScan.status || "")}</small></div>` : ""}
    ${recentScans.length ? `<div class="ai-research-source-strip">${recentScans.map((scan) => `<span>${escapeHtml(scan.source_name || scan.source_domain || "Portal")} Â· ${Number(scan.count || 0)}</span>`).join("")}</div>` : ""}
    <ol class="ai-research-steps">${PRESS_IMPORT_STEPS.map((step, index) => `<li class="${done || index < boundedStep ? "is-done" : index === boundedStep ? "is-active" : ""}"><span>${index + 1}</span>${escapeHtml(step)}</li>`).join("")}</ol>
    <div class="ai-press-progress__stats"><span>Importiert: ${Number(run?.imported || 0)}</span><span>Dubletten: ${Number(run?.duplicates || 0)}</span><span>Ausgespart: ${Number(run?.skipped_sources || 0)}</span></div>
    <p class="muted">Hinweis: Importierte Pressemitteilungen werden nicht automatisch geloescht oder als Beitrag angelegt.</p>
  </div>`;
}

function submitFormAndWait(form) {
  if (!form) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      form.removeEventListener("cms-form-saved", onSaved);
      form.removeEventListener("cms-form-save-failed", onFailed);
    };
    const onSaved = (event) => {
      cleanup();
      resolve(event.detail || {});
    };
    const onFailed = (event) => {
      cleanup();
      reject(event.detail?.error || new Error("Speichern fehlgeschlagen."));
    };
    form.addEventListener("cms-form-saved", onSaved, { once: true });
    form.addEventListener("cms-form-save-failed", onFailed, { once: true });
    form.requestSubmit();
  });
}

function showAiDialog({ button, originalText, result, sourceField }) {
  document.querySelector(".ai-dialog-backdrop")?.remove();
  const suggestedText = normalizeAiSuggestion(result.suggestedText || structuredToText(result.structured), button, sourceField);
  const wrapper = document.createElement("div");
  wrapper.className = "ai-dialog-backdrop";
  wrapper.innerHTML = `<div class="ai-dialog" role="dialog" aria-modal="true">
    <div class="actions" style="justify-content:space-between"><div><p class="eyebrow">ChatGPT-Vorschlag</p><h2>${escapeHtml(button.textContent.trim())}</h2></div><button type="button" class="link-button" data-ai-close>Schliessen</button></div>
    <div class="ai-dialog-grid">
      <div class="field"><label>Originaltext</label><textarea readonly>${escapeHtml(originalText)}</textarea></div>
      <div class="field"><label>KI-Vorschlag</label><textarea data-ai-suggestion>${escapeHtml(suggestedText)}</textarea></div>
    </div>
    ${result.structured ? `<pre class="ai-structured">${escapeHtml(JSON.stringify(result.structured, null, 2))}</pre>` : ""}
    <div class="actions"><button type="button" class="button button--primary" data-ai-accept>Uebernehmen</button><button type="button" class="button button--secondary" data-ai-save-draft>Als Entwurf speichern</button><button type="button" class="button button--secondary" data-ai-regenerate>Neu generieren</button><button type="button" class="button button--secondary" data-ai-close>Verwerfen</button></div>
    <p class="muted">Der Vorschlag wird erst nach Uebernehmen ins Feld geschrieben.</p>
  </div>`;
  document.body.append(wrapper);
  wrapper.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => wrapper.remove()));
  wrapper.querySelector("[data-ai-accept]").addEventListener("click", async (event) => {
    const acceptButton = event.currentTarget;
    const value = normalizeAiSuggestion(wrapper.querySelector("[data-ai-suggestion]").value, button, sourceField);
    if (sourceField && "value" in sourceField) sourceField.value = value;
    sourceField?.dispatchEvent(new Event("input", { bubbles: true }));
    sourceField?.dispatchEvent(new Event("change", { bubbles: true }));
    if (button.dataset.aiAction === "rewritePressRetrospective") {
      markPressRetrospectiveForm(button);
    }
    const postEventForm = sourceField?.closest?.('#event-edit-form[data-event-form-section="post"]');
    if (postEventForm) {
      const note = wrapper.querySelector(".muted");
      acceptButton.disabled = true;
      acceptButton.textContent = "Speichert ...";
      if (note) note.textContent = "KI-Vorschlag wird Ã¼bernommen und der RÃ¼ckblicktext gespeichert.";
      try {
        await submitFormAndWait(postEventForm);
      } catch (error) {
        acceptButton.disabled = false;
        acceptButton.textContent = "Uebernehmen";
        if (note) note.textContent = `Speichern fehlgeschlagen: ${error.message || String(error)}`;
        return;
      }
    }
    wrapper.remove();
  });
  wrapper.querySelector("[data-ai-save-draft]").addEventListener("click", async () => {
    const value = wrapper.querySelector("[data-ai-suggestion]").value;
    await saveAiDraft({
      entityType: button.dataset.aiEntityType,
      entityId: button.dataset.aiEntityId,
      fieldName: button.dataset.aiField,
      originalText,
      suggestedText: value,
      action: button.dataset.aiAction
    });
    wrapper.querySelector(".muted").textContent = "KI-Entwurf wurde in aiDrafts gespeichert.";
  });
  wrapper.querySelector("[data-ai-regenerate]").addEventListener("click", () => {
    wrapper.remove();
    button.click();
  });
}

function confirmAiNewsImportDraft({ sourceText = "", draft = {}, regenerateDraft = null } = {}) {
  document.querySelector(".ai-dialog-backdrop")?.remove();
  return new Promise((resolve) => {
    const wrapper = document.createElement("div");
    const headline = String(draft.headline || draft.title || "Importierte News").trim();
    const subline = String(draft.subline || draft.subtitle || "").trim();
    const body = String(draft.body || draft.bodyText || "").trim();
    const category = String(draft.category || "News").trim();
    const tags = normalizeFourKeywords(Array.isArray(draft.tags) ? draft.tags.join(", ") : String(draft.tags || ""), `${headline} ${subline} ${body}`).join(", ");
    const sourceWords = countWords(sourceText);
    const bodyWords = countWords(body);
    const initialTargetWords = Math.max(120, Math.min(900, Number(draft.targetWords || bodyWords || 300)));
    wrapper.className = "ai-dialog-backdrop";
    wrapper.innerHTML = `<div class="ai-dialog ai-dialog--news-review" role="dialog" aria-modal="true">
      <div class="actions" style="justify-content:space-between"><div><p class="eyebrow">News-Import</p><h2>Textvorschlag abstimmen</h2></div><button type="button" class="link-button" data-ai-news-cancel>SchlieÃŸen</button></div>
      <div class="ai-dialog-grid ai-dialog-grid--review">
        <div class="field"><label>Ausgangstext / Quelle <span data-word-count-source>${sourceWords} WÃ¶rter</span></label><textarea readonly>${escapeHtml(sourceText || "Keine Textquelle eingefÃ¼gt.")}</textarea></div>
        <form class="ai-news-review-fields">
          <div class="field"><label>Headline</label><input name="headline" value="${escapeHtml(headline)}"></div>
          <div class="field"><label>Subline</label><textarea name="subline" rows="3">${escapeHtml(subline)}</textarea></div>
          <div class="ai-news-review-controls">
            <div class="field"><label>Wortmenge neuer Text</label><input name="targetWords" type="number" min="120" max="900" step="25" value="${initialTargetWords}"></div>
            <button type="button" class="button button--secondary" data-ai-news-rewrite>Neu formulieren</button>
          </div>
          <div class="field"><label>Beitragstext <span data-word-count-body>${bodyWords} WÃ¶rter${bodyWords < 300 ? " - mindestens 300" : ""}</span></label><textarea name="body" rows="12">${escapeHtml(body)}</textarea></div>
          <div class="form-grid form-grid--compact">
            <div class="field"><label>Kategorie</label><input name="category" value="${escapeHtml(category)}"></div>
            <div class="field"><label>Keywords</label><input name="tags" value="${escapeHtml(tags)}"></div>
          </div>
        </form>
      </div>
      <div class="actions"><button type="button" class="button button--primary" data-ai-news-accept>Ãœbernehmen und speichern</button><button type="button" class="button button--secondary" data-ai-news-cancel>Verwerfen</button></div>
      <p class="muted">Neu formulieren nutzt immer die linke Datenbasis. Gespeichert wird erst nach deiner Auswahl.</p>
    </div>`;
    const close = (value) => {
      wrapper.remove();
      resolve(value);
    };
    wrapper.querySelectorAll("[data-ai-news-cancel]").forEach((button) => button.addEventListener("click", () => close(null)));
    const bodyField = wrapper.querySelector('textarea[name="body"]');
    const bodyCount = wrapper.querySelector("[data-word-count-body]");
    const targetWordsField = wrapper.querySelector('input[name="targetWords"]');
    const readTargetWords = () => Math.max(120, Math.min(900, Number(targetWordsField?.value || 300)));
    const updateBodyCount = () => {
      const words = countWords(bodyField?.value || "");
      const target = readTargetWords();
      bodyCount.textContent = `${words} WÃ¶rter - Ziel ${target}${words > target + 25 ? " - zu lang" : words < target - 25 ? " - zu kurz" : ""}`;
    };
    bodyField?.addEventListener("input", () => {
      updateBodyCount();
    });
    targetWordsField?.addEventListener("input", updateBodyCount);
    wrapper.querySelector("[data-ai-news-rewrite]")?.addEventListener("click", async (event) => {
      const rewriteButton = event.currentTarget;
      const fields = wrapper.querySelector(".ai-news-review-fields");
      const values = formObject(fields);
      const targetWords = readTargetWords();
      const oldLabel = rewriteButton.textContent;
      rewriteButton.disabled = true;
      rewriteButton.textContent = "Formuliere neu ...";
      try {
        const nextHeadline = String(values.headline || headline || "").trim();
        const nextSubline = String(values.subline || subline || "").trim();
        const nextTags = normalizeFourKeywords(values.tags || "", `${nextHeadline} ${nextSubline} ${sourceText}`);
        const nextBody = rewriteNewsBodyClient({
          sourceText,
          headline: nextHeadline,
          subline: nextSubline,
          tags: nextTags,
          targetWords
        });
        fields.elements.headline.value = nextHeadline;
        fields.elements.subline.value = nextSubline;
        fields.elements.body.value = nextBody;
        fields.elements.tags.value = nextTags.join(", ");
        updateBodyCount();
      } catch (error) {
        const note = wrapper.querySelector(".muted");
        if (note) note.textContent = `Neuformulierung fehlgeschlagen: ${error.message || String(error)}`;
      } finally {
        rewriteButton.disabled = false;
        rewriteButton.textContent = oldLabel;
      }
    });
    wrapper.querySelector("[data-ai-news-accept]").addEventListener("click", () => {
      const values = formObject(wrapper.querySelector(".ai-news-review-fields"));
      close({
        ...draft,
        headline: values.headline || headline,
        title: values.headline || headline,
        subline: values.subline || "",
        subtitle: values.subline || "",
        body: values.body || "",
        bodyText: values.body || "",
        category: values.category || category,
        targetWords: readTargetWords(),
        tags: normalizeFourKeywords(values.tags || "", `${values.headline || headline} ${values.subline || ""} ${values.body || ""}`)
      });
    });
    document.body.append(wrapper);
  });
}

function cleanRawImportText(value = "") {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function rawImportHeadline(value = "", fallback = "Importierte News") {
  const line = cleanRawImportText(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .find((item) => item.length >= 6) || fallback;
  return limitText(line.replace(/^Pressemitteilung[:\s-]*/i, ""), 90) || fallback;
}

function importedTitleLooksLikeSource(title = "", source = "", url = "") {
  const normalizeImportLabel = (value = "") => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const cleanTitle = normalizeImportLabel(title);
  const cleanSource = normalizeImportLabel(source);
  let host = "";
  try {
    host = normalizeImportLabel(new URL(url).hostname.replace(/^www\./i, ""));
  } catch {}
  if (!cleanTitle) return true;
  if (cleanSource && (cleanTitle === cleanSource || cleanTitle.includes(cleanSource))) return true;
  if (host && (cleanTitle === host || cleanTitle.includes(host))) return true;
  return /\b(zeitverlag|zeit verlag|verlagsgruppe|publisher|newsroom|presseportal|pressebereich|pressemitteilungen|homepage|startseite)\b/.test(cleanTitle);
}

function normalizedImportUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return /^https?:$/i.test(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function rawImportHeadlineFromUrl(url = "") {
  try {
    const parsed = new URL(url);
    return limitText(`URL-Import: ${parsed.hostname.replace(/^www\./i, "")}`, 90);
  } catch {
    return "URL-Import";
  }
}

async function importUrlIntoNewsImportForm(form, sourceUrl = "") {
  const output = form?.querySelector("#ai-news-import-result");
  const textarea = form?.querySelector('textarea[name="sourceText"]');
  const urlField = form?.querySelector('input[name="sourceUrl"]');
  const cleanUrl = normalizedImportUrl(sourceUrl || urlField?.value || "");
  if (!form || !cleanUrl) return null;
  if (output) output.innerHTML = `<div class="alert">${progressMarkup("URL wird geoeffnet und in den KI-News-Import geladen ...", 35)}</div>`;
  const imported = await importNewsUrlText(cleanUrl);
  if (textarea) {
    textarea.value = cleanRawImportText(imported?.text || "");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (urlField) urlField.value = cleanUrl;
  if (output) output.innerHTML = `<div class="alert alert--success">${Number(imported?.chars || imported?.text?.length || 0).toLocaleString("de-DE")} Zeichen aus der URL in den KI-News-Import geladen. Bitte pruefen und dann mit "KI-News erstellen" weiterarbeiten.</div>`;
  return imported;
}

function markPressRetrospectiveForm(button) {
  const form = button.closest("form");
  if (!form) return;
  const retrospectiveField = form.querySelector('[name="isRetrospective"]');
  if (retrospectiveField) retrospectiveField.checked = true;
  const categoryField = form.querySelector('[name="category"]');
  if (categoryField) categoryField.value = "R\u00fcckblick";
  const statusField = form.querySelector('[name="status"]');
  if (statusField && ["", "draft", "archived"].includes(statusField.value)) {
    statusField.value = "published";
  }
  const visibilityField = form.querySelector('[name="visibility"]');
  if (visibilityField) visibilityField.value = "public";
  form.classList.remove("is-saved");
}

function wireImageDropzones() {
  document.querySelectorAll("[data-image-dropzone]").forEach((zone) => {
    const form = zone.closest("form");
    const input = zone.querySelector('input[type="file"]');
    const removeInput = zone.querySelector('input[type="hidden"]');
    const dataInput = zone.querySelector(`input[name="${input?.name}DataUrl"]`);
    const fileNameInput = zone.querySelector(`input[name="${input?.name}FileName"]`);
    const preview = zone.querySelector("[data-image-preview]");
    const selectButton = zone.querySelector("[data-image-select]");
    const removeButton = zone.querySelector("[data-image-remove]");
    const tools = zone.querySelector("[data-image-tools]");
    const zoom = zone.querySelector("[data-image-zoom]");
    const sizeSelect = zone.querySelector("[data-image-size]");
    const resolution = zone.querySelector("[data-image-resolution]");
    const cropButton = zone.querySelector("[data-image-crop]");
    const status = zone.querySelector("[data-image-status]");
    const emptyText = preview?.querySelector("span")?.textContent || "Bild per Drag-and-drop oder Klick hochladen";
    zone.querySelectorAll("[data-image-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.imageMode;
        zone.querySelectorAll("[data-image-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
        zone.querySelectorAll("[data-image-mode-panel]").forEach((panel) => {
          panel.hidden = panel.dataset.imageModePanel !== mode;
        });
      });
    });
    const crop = { file: null, src: "", img: null, x: 0, y: 0, scale: 1, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 };
    const selectedSize = () => {
      const [width, height] = String(sizeSelect?.value || "240x180").split("x").map((value) => Number(value));
      return { width: width || 240, height: height || 180 };
    };
    const updateResolution = () => {
      const size = selectedSize();
      if (resolution) resolution.textContent = `Ausgabeformat: ${size.width} x ${size.height} px.`;
      if (preview) {
        const availableWidth = Math.max(240, Math.min(640, (zone.clientWidth || 720) - 28));
        const previewWidth = size.width / size.height > 1.4 ? availableWidth : Math.min(420, availableWidth);
        preview.style.width = `${previewWidth}px`;
        preview.style.height = `${Math.round(previewWidth * size.height / size.width)}px`;
      }
    };
    const renderCrop = () => {
      if (!crop.img) return;
      crop.img.style.width = "100%";
      crop.img.style.height = "100%";
      crop.img.style.maxWidth = "100%";
      crop.img.style.maxHeight = "100%";
      crop.img.style.objectFit = "contain";
      crop.img.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`;
      crop.img.style.transformOrigin = "center";
    };
    const showFile = (file, options = {}) => {
      if (!file || !file.type.startsWith("image/")) return;
      form?.classList.remove("is-saved");
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        crop.file = file;
        crop.src = reader.result;
        crop.x = 0;
        crop.y = 0;
        crop.scale = 1;
        preview.innerHTML = `<img src="${reader.result}" alt="">`;
        crop.img = preview.querySelector("img");
        preview.classList.add("has-image");
        if (removeButton) removeButton.hidden = false;
        tools.hidden = false;
        zoom.value = "1";
        removeInput.value = "";
        if (dataInput) dataInput.value = options.dataUrl || "";
        if (fileNameInput) fileNameInput.value = options.fileName || "";
        updateResolution();
        status.textContent = options.statusText || "Neues Bild ausgewaehlt. Das gesamte Motiv ist sichtbar. Bei Bedarf zoomen/verschieben oder direkt speichern.";
        renderCrop();
      });
      reader.readAsDataURL(file);
    };
    preview?.addEventListener("click", () => {
      if (preview.classList.contains("has-image")) return;
      input.click();
    });
    selectButton?.addEventListener("click", () => input.click());
    input?.addEventListener("change", () => showFile(input.files?.[0]));
    preview?.addEventListener("pointerdown", (event) => {
      if (!crop.img) return;
      crop.dragging = true;
      crop.startX = event.clientX;
      crop.startY = event.clientY;
      crop.originX = crop.x;
      crop.originY = crop.y;
      preview.setPointerCapture(event.pointerId);
    });
    preview?.addEventListener("pointermove", (event) => {
      if (!crop.dragging) return;
      crop.x = crop.originX + event.clientX - crop.startX;
      crop.y = crop.originY + event.clientY - crop.startY;
      renderCrop();
    });
    preview?.addEventListener("pointerup", () => { crop.dragging = false; });
    zoom?.addEventListener("input", () => {
      crop.scale = Number(zoom.value || 1);
      renderCrop();
    });
    sizeSelect?.addEventListener("change", () => {
      form?.classList.remove("is-saved");
      updateResolution();
    });
    cropButton?.addEventListener("click", async () => {
      if (!crop.img || !crop.file) return;
      const size = selectedSize();
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const baseScale = Math.max(canvas.width / crop.img.naturalWidth, canvas.height / crop.img.naturalHeight);
      const width = crop.img.naturalWidth * baseScale * crop.scale;
      const height = crop.img.naturalHeight * baseScale * crop.scale;
      const previewRect = preview.getBoundingClientRect();
      const offsetX = crop.x * (canvas.width / Math.max(1, previewRect.width));
      const offsetY = crop.y * (canvas.height / Math.max(1, previewRect.height));
      ctx.drawImage(crop.img, (canvas.width - width) / 2 + offsetX, (canvas.height - height) / 2 + offsetY, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
      const croppedFile = new File([blob], crop.file.name.replace(/\.[^.]+$/, "") + `-${size.width}x${size.height}.jpg`, { type: "image/jpeg" });
      fileToInput(input, croppedFile);
      crop.file = croppedFile;
      crop.src = canvas.toDataURL("image/jpeg", .9);
      if (dataInput) dataInput.value = crop.src;
      if (fileNameInput) fileNameInput.value = croppedFile.name;
      preview.innerHTML = `<img src="${crop.src}" alt="">`;
      crop.img = preview.querySelector("img");
      crop.x = 0;
      crop.y = 0;
      crop.scale = 1;
      zoom.value = "1";
      tools.hidden = true;
      status.textContent = `Bild zugeschnitten (${size.width} x ${size.height} px). Bitte speichern.`;
      renderCrop();
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("is-dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      fileToInput(input, file);
      showFile(file);
    });
    zone.querySelector("[data-ai-image-generate]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const promptField = zone.querySelector("[data-ai-image-prompt]");
      const originalLabel = button.textContent;
      const targetCollection = form?.dataset.module || (form?.id === "topic-editor-form" ? "topics" : "editorialContent");
      const targetId = form?.dataset.id || form?.dataset.topicId || "";
      const targetRecord = targetCollection && targetId ? await getOne(targetCollection, targetId).catch(() => null) : null;
      const variantNumber = Math.max(1, (Array.isArray(targetRecord?.thumbnail_variant_asset_ids) ? targetRecord.thumbnail_variant_asset_ids.length : 0) + 1);
      const context = form ? imageGenerationContext(form) : {};
      const creativePrompt = creativeThumbPrompt(context, promptField?.value || "", variantNumber);
      button.disabled = true;
      button.textContent = variantNumber > 1 ? "KI erzeugt Variante ..." : "KI erzeugt Thumb ...";
      status.innerHTML = progressMarkup(variantNumber > 1 ? "KI erzeugt eine weitere Thumbnail-Variante ..." : "KI erzeugt ein redaktionelles Thumbnail ...", 35);
      try {
        const generated = await generateCmsThumbCollage({
          entityType: form?.dataset.module || "cms",
          entityId: form?.dataset.id || form?.dataset.topicId || "",
          prompt: creativePrompt,
          context: {
            ...context,
            variantNumber,
            creativePrompt
          },
          size: "1536x1024",
          quality: "medium"
        });
        if (promptField && generated.prompt) promptField.value = generated.prompt;
        const normalized = await generatedThumbToJpeg(generated.imageDataUrl, generated.fileName || `${form?.dataset.id || form?.dataset.topicId || "cms-thumb"}-ki-collage.png`, selectedSize());
        const file = normalized.file;
        fileToInput(input, file);
        showFile(file, {
          dataUrl: normalized.dataUrl,
          fileName: file.name,
          statusText: "KI-Thumb erzeugt. peichere als Mediathek-Variante ..."
        });
        status.innerHTML = progressMarkup("KI-Thumb erzeugt. Bild wird in der Mediathek gespeichert ...", 78);
        const asset = await saveGeneratedThumbMediaAsset(form, file, {
          dataUrl: normalized.dataUrl,
          prompt: generated.prompt || creativePrompt,
          result: status,
          variantNumber
        });
        const savedImageUrl = mediaAssetUrl(asset) || normalized.dataUrl;
        updateDropzoneavedImage(form, savedImageUrl);
        if (form?.elements?.thumbnail_alt && !String(form.elements.thumbnail_alt.value || "").trim()) {
          form.elements.thumbnail_alt.value = asset.thumbnail_alt || asset.alt_text || "";
        }
        status.innerHTML = `<span>KI-Thumb Variante ${variantNumber} wurde gespeichert, dem Beitrag zugeordnet und ist in der Mediathek auswÃ¤hlbar.</span>`;
      } catch (error) {
        status.textContent = `KI-Bild konnte nicht erzeugt werden: ${error.message || String(error)}`;
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
    removeButton?.addEventListener("click", () => {
      form?.classList.remove("is-saved");
      input.value = "";
      removeInput.value = "1";
      if (dataInput) dataInput.value = "";
      if (fileNameInput) fileNameInput.value = "";
      crop.file = null;
      crop.src = "";
      crop.img = null;
      tools.hidden = true;
      preview.innerHTML = `<span>${emptyText}</span>`;
      preview.classList.remove("has-image");
      if (removeButton) removeButton.hidden = true;
      status.textContent = "Bild zum LÃ¶schen markiert. Bitte speichern.";
    });
    updateResolution();
  });
}

function wireGalleryEditor() {
  const form = document.querySelector("#gallery-edit-form");
  if (!form) return;
  const dropzone = form.querySelector("[data-gallery-dropzone]");
  const dropInput = form.elements.galleryImagesDrop;
  const buttonInput = form.elements.galleryImages;
  const result = form.querySelector("#gallery-save-result");
  const updateDropzoneText = (files) => {
    const count = files?.length || 0;
    const label = dropzone?.querySelector("span");
    if (label && count) label.textContent = `${count} Datei${count === 1 ? "" : "en"} ausgewaehlt. Upload startet automatisch.`;
  };
  const autosaveDroppedFiles = (images) => {
    if (!images.length) return;
    if (!form.elements.title.value.trim()) form.elements.title.value = "Neue Bildergalerie";
    updateDropzoneText(images);
    if (result) result.innerHTML = `<div class="alert">${progressMarkup("Bilder abgelegt. Galerie wird automatisch gespeichert ...", 35)}</div>`;
    window.setTimeout(() => form.requestSubmit(), 0);
  };
  const acceptFiles = (files, autosave = false) => {
    const images = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    filesToInput(dropInput, images);
    if (buttonInput) buttonInput.value = "";
    updateDropzoneText(images);
    if (autosave) autosaveDroppedFiles(images);
  };
  const hasImageFiles = (files) => Array.from(files || []).some((file) => file.type.startsWith("image/"));
  dropzone?.addEventListener("click", () => dropInput?.click());
  dropInput?.addEventListener("change", () => acceptFiles(dropInput.files, true));
  dropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
  dropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    acceptFiles(event.dataTransfer?.files, true);
  });

  const sortable = form.querySelector("[data-gallery-sortable]");
  let dragged = null;
  sortable?.addEventListener("dragover", (event) => {
    if (!hasImageFiles(event.dataTransfer?.files)) return;
    event.preventDefault();
    dropzone?.classList.add("is-dragover");
  });
  sortable?.addEventListener("dragleave", () => dropzone?.classList.remove("is-dragover"));
  sortable?.addEventListener("drop", (event) => {
    if (!hasImageFiles(event.dataTransfer?.files)) return;
    event.preventDefault();
    event.stopPropagation();
    dropzone?.classList.remove("is-dragover");
    acceptFiles(event.dataTransfer?.files, true);
  });
  sortable?.querySelectorAll("[data-gallery-image-item]").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragged = item;
      item.classList.add("is-dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
      dragged = null;
    });
    item.addEventListener("dragover", (event) => {
      if (hasImageFiles(event.dataTransfer?.files)) return;
      event.preventDefault();
    });
    item.addEventListener("drop", (event) => {
      if (hasImageFiles(event.dataTransfer?.files)) return;
      event.preventDefault();
      const target = event.currentTarget;
      if (!dragged || dragged === target) return;
      const rect = target.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2 || event.clientX > rect.left + rect.width / 2;
      sortable.insertBefore(dragged, after ? target.nextSibling : target);
    });
  });
}

function openGalleryPlayer(gallery) {
  const images = Array.isArray(gallery?.images) ? gallery.images.filter((image) => image.url) : [];
  if (!images.length) return;
  let index = 0;
  let timer = null;
  const overlay = document.createElement("div");
  overlay.className = "gallery-player";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const renderSlide = () => {
    const image = images[index];
    overlay.innerHTML = `<div class="gallery-player__panel">
      <div class="gallery-player__top"><strong>${escapeHtml(gallery.title || "Bildergalerie")}</strong><button class="gallery-player__close" type="button" data-gallery-close aria-label="SchlieÃŸen">Ã—</button></div>
      <figure class="gallery-player__stage"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText || image.caption || "Galeriebild")}">${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}</figure>
      <div class="gallery-player__controls">
        <button type="button" data-gallery-prev aria-label="Vorheriges Bild">â€¹</button>
        <span>${index + 1} / ${images.length}</span>
        <button type="button" data-gallery-next aria-label="NÃ¤chstes Bild">â€º</button>
        <button type="button" data-gallery-toggle data-gallery-state="${timer ? "pause" : "play"}"><span aria-hidden="true"></span></button>
      </div>
    </div>`;
  };
  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };
  const next = () => {
    index = (index + 1) % images.length;
    renderSlide();
  };
  const previous = () => {
    index = (index - 1 + images.length) % images.length;
    renderSlide();
  };
  const start = () => {
    stop();
    timer = window.setInterval(next, 3600);
  };
  const close = () => {
    stop();
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowRight") next();
    if (event.key === "ArrowLeft") previous();
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-gallery-close]")) close();
    if (event.target.closest("[data-gallery-next]")) next();
    if (event.target.closest("[data-gallery-prev]")) previous();
    if (event.target.closest("[data-gallery-toggle]")) {
      if (timer) stop();
      else start();
      renderSlide();
    }
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  renderSlide();
  start();
  renderSlide();
}

function openPdfOverlay(url = "", title = "PDF") {
  if (!url) return;
  const overlay = document.createElement("div");
  overlay.className = "pdf-player";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `<div class="pdf-player__panel">
    <div class="pdf-player__top"><strong>${escapeHtml(title || "PDF")}</strong><div><a class="button button--secondary button--small" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" download>PDF speichern</a><button class="gallery-player__close" type="button" data-pdf-close aria-label="SchlieÃŸen">Ã—</button></div></div>
    <iframe class="pdf-player__frame" src="${escapeHtml(url)}" title="${escapeHtml(title || "PDF")}" loading="eager"></iframe>
  </div>`;
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-pdf-close]")) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

function wirePdfOverlays() {
  document.querySelectorAll("[data-pdf-overlay]").forEach((button) => {
    if (button.dataset.pdfOverlayWired === "1") return;
    button.dataset.pdfOverlayWired = "1";
    button.addEventListener("click", () => openPdfOverlay(button.dataset.pdfUrl || "", button.dataset.pdfTitle || button.textContent?.trim() || "PDF"));
  });
}
function wireGalleryPlayers() {
  document.querySelectorAll("[data-gallery-play]").forEach((button) => {
    if (button.dataset.galleryPlayerWired === "1") return;
    button.dataset.galleryPlayerWired = "1";
    button.addEventListener("click", () => {
    try {
      openGalleryPlayer(JSON.parse(button.dataset.galleryPayload || "{}"));
    } catch (error) {
      console.error("Galerie konnte nicht geoeffnet werden", error);
    }
    });
  });
}

function videoAttachmentRowTemplate(index = 0) {
  return `<fieldset class="video-attachment-row" data-video-attachment-row>
    <legend>Video ${index + 1}</legend>
    <input type="hidden" name="videoId${index}" value="video-${crypto.randomUUID()}">
    <div class="form-grid form-grid--video-attachment">
      <div class="field"><label>YouTube-URL oder ID</label><input name="videoYoutubeUrl${index}" placeholder="https://www.youtube.com/watch?v=..."></div>
      <div class="field"><label>Titel</label><input name="videoTitle${index}"></div>
      <div class="field"><label>Caption</label><input name="videoCaption${index}"></div>
      <div class="field"><label>Startbild / Posterbild</label><input name="videoPosterImageUrl${index}" placeholder="Bild-URL oder YouTube-Thumbnail"></div>
      <div class="field"><label>Alt-Text Startbild</label><input name="videoPosterImageAlt${index}"></div>
      <div class="field"><label>Sortierung</label><input name="videoSortOrder${index}" type="number" min="1" value="${index + 1}"></div>
      <div class="field"><label>Privacy</label><select name="videoPrivacyStatus${index}"><option value="unlisted" selected>unlisted</option><option value="private">private</option><option value="public">public</option><option value="unknown">unknown</option></select></div>
      <div class="field"><label>Status</label><select name="videoStatus${index}"><option value="ready" selected>ready</option><option value="draft">draft</option><option value="published">published</option><option value="hidden">hidden</option><option value="error">error</option></select></div>
      <div class="field field--wide"><label>Beschreibung</label><textarea name="videoDescription${index}"></textarea></div>
    </div>
    <button class="icon-button icon-button--danger" type="button" data-remove-video-attachment title="Video entfernen" aria-label="Video entfernen">Ã—</button>
  </fieldset>`;
}

function normalizedVideoLibraryPayload(video = {}, index = 0) {
  const youtubeVideoId = video.youtubeVideoId || youtubeVideoIdFromValue(video.youtubeUrl || video.url || video.embedUrl || "");
  const youtubeUrl = video.youtubeUrl || video.url || (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : "");
  const posterImageUrl = video.posterImageUrl || video.thumbnailUrl || video.youtubeThumbnailUrl || (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "");
  return {
    id: video.id || `video-${crypto.randomUUID()}`,
    youtubeVideoId,
    youtubeUrl,
    embedUrl: youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : video.embedUrl || "",
    title: video.title || "Video",
    caption: video.caption || video.description || "",
    description: video.description || video.caption || "",
    posterImageUrl,
    posterImageAlt: video.posterImageAlt || video.title || "Video starten",
    privacyStatus: video.privacyStatus || "unlisted",
    status: video.status || "ready",
    sortOrder: Number(video.sortOrder || index + 1)
  };
}

function videoAssignmentRowTemplate(video = {}, index = 0) {
  const item = normalizedVideoLibraryPayload(video, index);
  return `<div class="video-assignment-row" data-video-attachment-row>
    <input type="hidden" name="videoId${index}" value="${escapeHtml(item.id)}">
    <input type="hidden" name="videoYoutubeUrl${index}" value="${escapeHtml(item.youtubeUrl)}">
    <input type="hidden" name="videoTitle${index}" value="${escapeHtml(item.title)}">
    <input type="hidden" name="videoCaption${index}" value="${escapeHtml(item.caption)}">
    <input type="hidden" name="videoPosterImageUrl${index}" value="${escapeHtml(item.posterImageUrl)}">
    <input type="hidden" name="videoPosterImageAlt${index}" value="${escapeHtml(item.posterImageAlt)}">
    <input type="hidden" name="videoSortOrder${index}" value="${escapeHtml(item.sortOrder)}">
    <input type="hidden" name="videoPrivacyStatus${index}" value="${escapeHtml(item.privacyStatus)}">
    <input type="hidden" name="videoStatus${index}" value="${escapeHtml(item.status)}">
    <input type="hidden" name="videoDescription${index}" value="${escapeHtml(item.description)}">
    ${item.posterImageUrl ? `<img src="${escapeHtml(item.posterImageUrl)}" alt="">` : `<span class="video-assignment-row__empty">Video</span>`}
    <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.youtubeUrl || item.youtubeVideoId || "")}</small></div>
    <button class="icon-button icon-button--danger" type="button" data-remove-video-attachment title="Video entfernen" aria-label="Video entfernen">Ã—</button>
  </div>`;
}

function renumberVideoAttachmentRows(container) {
  Array.from(container.querySelectorAll("[data-video-attachment-row]")).forEach((row, index) => {
    const legend = row.querySelector("legend");
    if (legend) legend.textContent = `Video ${index + 1}`;
    row.querySelectorAll("[name]").forEach((field) => {
      field.name = field.name.replace(/\d+$/, String(index));
    });
  });
}

function wireVideoAttachmentEditor() {
  document.querySelectorAll("[data-video-attachments]").forEach((box) => {
    if (box.dataset.videoAttachmentsWired === "1") return;
    box.dataset.videoAttachmentsWired = "1";
    const listBox = box.querySelector("[data-video-attachment-list]");
    box.querySelector("[data-add-video-attachment]")?.addEventListener("click", () => {
      const index = listBox.querySelectorAll("[data-video-attachment-row]").length;
      listBox.insertAdjacentHTML("beforeend", videoAttachmentRowTemplate(index));
    });
    box.querySelector("[data-add-video-from-library]")?.addEventListener("click", () => {
      const select = box.querySelector("[data-video-library-select]");
      const option = select?.selectedOptions?.[0];
      if (!option?.dataset.videoPayload || !listBox) return;
      let payload = null;
      try {
        payload = JSON.parse(option.dataset.videoPayload);
      } catch (error) {
        console.error("Video konnte nicht gelesen werden", error);
      }
      if (!payload) return;
      const existingIds = Array.from(listBox.querySelectorAll('input[name^="videoId"]')).map((field) => field.value);
      if (payload.id && existingIds.includes(payload.id)) return;
      listBox.querySelector(".muted")?.remove();
      const index = listBox.querySelectorAll("[data-video-attachment-row]").length;
      listBox.insertAdjacentHTML("beforeend", videoAssignmentRowTemplate(payload, index));
    });
    box.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-video-attachment]");
      if (!removeButton) return;
      const rows = listBox.querySelectorAll("[data-video-attachment-row]");
      const row = removeButton.closest("[data-video-attachment-row]");
      if (row?.classList.contains("video-assignment-row")) {
        row.remove();
        renumberVideoAttachmentRows(listBox);
      } else if (rows.length <= 1) {
        row.querySelectorAll("input, textarea").forEach((field) => { field.value = ""; });
        row.querySelectorAll("select").forEach((field) => { field.selectedIndex = 0; });
      } else {
        row.remove();
        renumberVideoAttachmentRows(listBox);
      }
      if (!listBox.querySelector("[data-video-attachment-row]")) {
        listBox.innerHTML = `<p class="muted">Noch kein Video zugeordnet.</p>`;
      }
    });
  });
}

async function requestVideoFullscreen(element) {
  if (!element) return;
  const mobileLike = window.matchMedia?.("(max-width: 820px), (pointer: coarse)")?.matches;
  if (!mobileLike) return;
  try {
    const fullscreen =
      element.requestFullscreen?.bind(element)
      || element.webkitRequestFullscreen?.bind(element)
      || element.msRequestFullscreen?.bind(element);
    if (fullscreen) await fullscreen({ navigationUI: "hide" });
  } catch {}
  try {
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch {}
}

function wireArticleVideos() {
  document.querySelectorAll("[data-youtube-video]").forEach((box) => {
    if (box.dataset.youtubeVideoWired === "1") return;
    box.dataset.youtubeVideoWired = "1";
    const stop = () => {
      const iframe = box.querySelector("iframe");
      try {
        iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "stopVideo", args: [] }), "*");
      } catch {}
      if (iframe) {
        iframe.removeAttribute("src");
        iframe.load?.();
      }
      box.classList.remove("is-playing", "is-fullscreen-requested");
    };
    const start = async () => {
      const id = box.dataset.youtubeVideo || "";
      if (!id) return;
      const origin = window.location?.origin ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
      const autoplaySrc = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1&autoplay=1&rel=0&fs=1&playsinline=0${origin}`;
      let iframe = box.querySelector("iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.title = box.dataset.youtubeTitle || "Video";
        iframe.loading = "eager";
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
        iframe.allowFullscreen = true;
        box.appendChild(iframe);
      }
      if (!iframe.src || !iframe.src.includes("autoplay=1")) iframe.src = autoplaySrc;
      box.classList.add("is-playing", "is-fullscreen-requested");
      box.appendChild(iframe);
      iframe.focus();
      try {
        iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      } catch {}
      await requestVideoFullscreen(box);
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
        } catch {}
      }, 250);
    };
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0.22) return;
          if (box.classList.contains("is-playing")) stop();
        });
      }, { threshold: [0, 0.22, 0.5] });
      observer.observe(box);
    }
    box.addEventListener("click", start);
    box.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      start();
    });
  });
}

function renderEditorGalleryPreview(select) {
  const preview = select.closest("form")?.querySelector("[data-editor-gallery-preview]");
  if (!preview) return;
  const option = select.selectedOptions?.[0];
  const payloadText = option?.dataset.galleryPayload || "";
  if (!payloadText) {
    preview.className = "editor-gallery-preview editor-gallery-preview--empty";
    preview.innerHTML = `<p class="muted">Keine Galerie verknuepft. Galerie auswaehlen und speichern, um sie mit diesem Inhalt zu verbinden.</p>`;
    return;
  }
  try {
    const gallery = JSON.parse(payloadText);
    const imageCount = Array.isArray(gallery.images) ? gallery.images.length : 0;
    preview.className = "editor-gallery-preview";
    preview.innerHTML = `<div><strong>${escapeHtml(gallery.title || "Bildergalerie")}</strong><span>${imageCount} Bilder</span></div><button class="gallery-play-button" type="button" data-gallery-play data-gallery-payload="${escapeHtml(payloadText)}" title="Galerie abspielen" aria-label="Galerie abspielen"><span aria-hidden="true"></span></button>`;
    wireGalleryPlayers();
  wirePdfOverlays();
  } catch (error) {
    preview.className = "editor-gallery-preview editor-gallery-preview--empty";
    preview.innerHTML = `<p class="muted">Galerie-Vorschau konnte nicht geladen werden.</p>`;
  }
}

function wireEditorGallerySelects() {
  document.querySelectorAll('select[name="galleryId"]').forEach((select) => {
    if (select.dataset.editorGalleryWired === "1") return;
    select.dataset.editorGalleryWired = "1";
    select.addEventListener("change", () => renderEditorGalleryPreview(select));
  });
}

function wireGalleryLinkSaves() {
  document.querySelectorAll("[data-save-gallery-link]").forEach((button) => {
    if (button.dataset.galleryLinkWired === "1") return;
    button.dataset.galleryLinkWired = "1";
    button.addEventListener("click", async () => {
      const form = button.closest("form");
      const select = form?.querySelector('select[name="galleryId"]');
      const result = form?.querySelector("[data-gallery-link-result]");
      if (!form || !select) return;
      const module = form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent");
      const id = form.dataset.id || form.dataset.topicId;
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Galerie-Verknuepfung wird gespeichert...</div>`;
      try {
        const existing = (await getOne(module, id)) || { id, createdAt: new Date().toISOString() };
        await upsert(module, {
          ...existing,
          galleryId: select.value || "",
          updatedAt: new Date().toISOString()
        });
        if (result) result.innerHTML = `<div class="alert alert--success">Galerie-Verknuepfung gespeichert.</div>`;
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Galerie konnte nicht verknuepft werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  });
}

function wireLinkedMediaClears() {
  document.querySelectorAll("[data-clear-linked-media]").forEach((button) => {
    if (button.dataset.clearLinkedMediaWired === "1") return;
    button.dataset.clearLinkedMediaWired = "1";
    button.addEventListener("click", async () => {
      const form = button.closest("form");
      if (!form) return;
      const module = form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent");
      const id = form.dataset.id || form.dataset.topicId;
      const kind = button.dataset.clearLinkedMedia;
      const result = kind === "audio"
        ? form.querySelector("[data-speech-result]")
        : form.querySelector("[data-gallery-link-result]");
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Verknuepfung wird geloest...</div>`;
      try {
        const existing = (await getOne(module, id)) || { id, createdAt: new Date().toISOString() };
        const update = kind === "audio"
          ? {
              audioUrl: "",
              audioStoragePath: "",
              audioMimeType: "",
              audioTextLength: 0,
              audioTextTruncated: false,
              audioAccessibleUrl: "",
              audioAccessibleStoragePath: "",
              audioAccessibleMimeType: "",
              audioAccessibleTextLength: 0,
              audioAccessibleTextTruncated: false,
              audioNaturalUrl: "",
              audioNaturalStoragePath: "",
              audioNaturalMimeType: "",
              audioNaturalTextLength: 0,
              audioNaturalTextTruncated: false
            }
          : { galleryId: "" };
        await upsert(module, { ...existing, ...update, updatedAt: new Date().toISOString() });
        if (kind === "gallery") {
          const select = form.querySelector('select[name="galleryId"]');
          if (select) {
            await selectOptionByValue(select, "");
            renderEditorGalleryPreview(select);
          }
        }
        if (kind === "audio") {
          button.closest(".audio-generation-panel")?.querySelector("audio")?.remove();
        }
        if (result) result.innerHTML = `<div class="alert alert--success">Verknuepfung geloest.</div>`;
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Verknuepfung konnte nicht geloest werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function selectOptionByValue(select, value) {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function updateTopicThumbInList(topicId, imageUrl) {
  const safeId = window.CSS?.escape ? CSS.escape(topicId) : topicId.replace(/"/g, '\\"');
  const thumb = document.querySelector(`[data-topic-drag-id="${safeId}"] .topic-thumb`);
  if (!thumb) return;
  thumb.innerHTML = imageUrl ? `<img src="${imageUrl}" alt="">` : "<span>Bild</span>";
}

function updateDropzoneSavedImage(form, imageUrl) {
  const preview = form.querySelector("[data-image-preview]");
  const tools = form.querySelector("[data-image-tools]");
  const input = form.querySelector("[data-image-dropzone] input[type='file']");
  const dataInput = form.querySelector(`[name="${input?.name}DataUrl"]`);
  const fileNameInput = form.querySelector(`[name="${input?.name}FileName"]`);
  if (!preview) return;
  if (imageUrl) {
    preview.innerHTML = `<img src="${imageUrl}" alt="">`;
    preview.classList.add("has-image");
  } else {
    preview.innerHTML = "<span>Bild per Drag-and-drop oder Klick hochladen</span>";
    preview.classList.remove("has-image");
  }
  const removeButton = form.querySelector("[data-image-remove]");
  if (removeButton) removeButton.hidden = !imageUrl;
  if (input) input.value = "";
  if (dataInput) dataInput.value = "";
  if (fileNameInput) fileNameInput.value = "";
  if (tools) tools.hidden = true;
}

async function saveEventTopicSpeakerForm(form) {
  const existingEvent = await getOne("events", form.dataset.eventId);
  const speakerId = form.dataset.speakerId || `speakers-${crypto.randomUUID()}`;
  const existingSpeaker = form.dataset.speakerId ? await getOne("speakers", speakerId) : { id: speakerId, status: "published", visibility: "public", createdAt: new Date().toISOString() };
  const topicIdsForSpeaker = new Set(existingSpeaker.topicIds || []);
  topicIdsForSpeaker.add(form.dataset.topicId);
  const eventIdsForSpeaker = new Set(existingSpeaker.eventIds || []);
  eventIdsForSpeaker.add(form.dataset.eventId);
  const eventSpeakerIds = Array.from(new Set([...(existingEvent.speakerIds || []), speakerId]));
  const image = imageFileFromDropzone(form, "speakerImage", speakerId);
  const imageUpdate = {};
  if (form.elements.removeSpeakerImage?.value === "1") {
    await deleteStoredAsset(existingSpeaker);
    imageUpdate.photoUrl = "";
    imageUpdate.assetStoragePath = "";
  }
  if (image) {
    await deleteStoredAsset(existingSpeaker);
    const asset = await uploadEntityImage("speakers", speakerId, image);
    imageUpdate.photoUrl = asset.url;
    imageUpdate.assetStoragePath = asset.storagePath;
  }
  await upsert("speakers", {
    ...existingSpeaker,
    id: speakerId,
    name: form.elements.name.value,
    company: form.elements.company.value,
    position: form.elements.position.value,
    ...imageUpdate,
    topicId: existingSpeaker.topicId || form.dataset.topicId,
    topicIds: Array.from(topicIdsForSpeaker),
    eventIds: Array.from(eventIdsForSpeaker),
    updatedAt: new Date().toISOString()
  });
  await upsert("events", { ...existingEvent, speakerIds: eventSpeakerIds, updatedAt: new Date().toISOString() });
  form.dataset.speakerId = speakerId;
  form.querySelector("#event-topic-speaker-result").innerHTML = `<div class="alert alert--success">Referent wurde gespeichert.</div>`;
  const imageStatus = form.querySelector("[data-image-status]");
  if (imageStatus) imageStatus.textContent = imageUpdate.photoUrl ? "Bild wurde gespeichert." : imageUpdate.photoUrl === "" ? "Bild wurde gelÃ¶scht." : imageStatus.textContent;
  form.classList.add("is-saved");
  if (!new URLSearchParams(location.hash.split("?")[1] || "").get("speaker")) {
    history.replaceState(null, "", `#/cms/event/${form.dataset.eventId}?tab=topics&mode=referent&topic=${form.dataset.topicId}&speaker=${speakerId}`);
  }
}

function wireCmsMenu() {
  const shell = document.querySelector(".cms-shell");
  const toggle = document.querySelector("[data-cms-menu-toggle]");
  const closeTargets = document.querySelectorAll("[data-cms-menu-close], .cms-side a");
  if (!shell || !toggle) return;
  const setOpen = (open) => {
    shell.classList.toggle("is-menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "CMS-Menue schliessen" : "CMS-Menue oeffnen");
  };
  toggle.addEventListener("click", () => setOpen(!shell.classList.contains("is-menu-open")));
  closeTargets.forEach((target) => target.addEventListener("click", () => setOpen(false)));
}

function wirePublicMenu() {
  const topbar = document.querySelector(".topbar");
  const toggle = document.querySelector("[data-public-menu-toggle]");
  const closeTargets = document.querySelectorAll("[data-public-menu-close]");
  if (!topbar || !toggle) return;
  const setOpen = (open) => {
    topbar.classList.toggle("is-public-menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Menue schliessen" : "Menue oeffnen");
  };
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!topbar.classList.contains("is-public-menu-open"));
  });
  closeTargets.forEach((target) => target.addEventListener("click", () => setOpen(false)));
}

function wireFastMobileNavFeedback() {
  const navLinks = document.querySelectorAll(".pdtv-mobile-bottom-nav a, .public-mobile-menu a");
  navLinks.forEach((link) => {
    link.addEventListener("pointerdown", () => {
      if (!window.matchMedia?.("(max-width: 899px)").matches) return;
      const nav = link.closest("nav");
      nav?.querySelectorAll("a.active").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    }, { passive: true });
  });
}

function wireAboutJumps() {
  const jumpToBlock = (trigger, event) => {
    const slug = trigger.getAttribute("data-about-jump");
      const target = slug ? document.getElementById(`about-text-${slug}`) : null;
      if (!target) return;
      event.preventDefault();
      const headerOffset = (document.querySelector(".topbar")?.getBoundingClientRect().height || 0) + 18;
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
  };
  document.querySelectorAll("[data-about-jump]").forEach((link) => {
    link.addEventListener("click", (event) => {
      jumpToBlock(link, event);
    });
    link.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") jumpToBlock(link, event);
    });
  });
}

function scrollToInternalOverviewTop() {
  const target = document.querySelector(".internal-page-heading") || document.querySelector(".internal-overview");
  if (!target) return;
  const headerOffset = (document.querySelector(".topbar")?.getBoundingClientRect().height || 0) + 18;
  const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function wireInternalScrollTop() {
  document.querySelectorAll("[data-internal-scroll-top]").forEach((button) => {
    button.addEventListener("click", () => scrollToInternalOverviewTop());
  });
}

function scrollToMembershipForm() {
  const form = document.querySelector("#membership-application-form");
  if (!form) return;
  const headerOffset = (document.querySelector(".topbar")?.getBoundingClientRect().height || 0) + 18;
  const top = form.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function wireJoinScroll() {
  document.querySelectorAll("[data-join-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollToMembershipForm();
    });
  });
}

function wireStickyRotators() {
  document.querySelectorAll("[data-sticky-rotator], [data-rubric-rotator]").forEach((rotator) => {
    const slides = Array.from(rotator.querySelectorAll("[data-sticky-slide], [data-rubric-slide]"));
    const dots = Array.from(rotator.querySelectorAll(".internal-sticky-dots span"));
    if (slides.length < 2) return;
    let index = slides.findIndex((slide) => slide.classList.contains("is-active"));
    if (index < 0) index = 0;
    const activate = (nextIndex) => {
      index = nextIndex % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
      dots.forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === index));
    };
    activate(index);
    window.setInterval(() => activate(index + 1), 4200);
  });
}

function wireMediaLibraryFilters() {
  const cards = Array.from(document.querySelectorAll("[data-media-card]"));
  if (!cards.length) return;
  const search = document.querySelector("[data-media-search]");
  const filters = Array.from(document.querySelectorAll("[data-media-filter]"));
  const sourceButtons = Array.from(document.querySelectorAll("[data-media-source-switch]"));
  let activeSource = sourceButtons.find((button) => button.classList.contains("is-active"))?.dataset.mediaSourceSwitch || "";
  const apply = () => {
    const term = String(search?.value || "").trim().toLowerCase();
    const activeFilters = filters.map((filter) => [filter.dataset.mediaFilter, filter.value]).filter(([, value]) => value);
    cards.forEach((card) => {
      const matchesTerm = !term || String(card.dataset.search || "").includes(term);
      const matchesSource = !activeSource || card.dataset.source === activeSource;
      const matchesFilters = activeFilters.every(([key, value]) => card.dataset[key] === value);
      card.hidden = !(matchesTerm && matchesSource && matchesFilters);
    });
  };
  search?.addEventListener("input", apply);
  filters.forEach((filter) => filter.addEventListener("change", apply));
  sourceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeSource = button.dataset.mediaSourceSwitch || "";
      sourceButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      apply();
    });
  });
  apply();
}

function wireExistingThumbImport() {
  const button = document.querySelector("[data-import-existing-thumbs]");
  if (!button || button.dataset.importThumbsWired === "1") return;
  button.dataset.importThumbsWired = "1";
  button.addEventListener("click", async () => {
    const result = document.querySelector("#media-import-result");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Importiere ...";
    try {
      const summary = await importExistingThumbsToMediaLibrary(result);
      button.textContent = "Importiert";
      window.setTimeout(() => render(), summary.created ? 650 : 1200);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Thumb-Import fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
      button.textContent = originalLabel;
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel;
      }, 900);
    }
  });
}

function wireMediaAutoClassify() {
  const button = document.querySelector("[data-auto-classify-media-assets]");
  if (!button || button.dataset.mediaAutoClassifyWired === "1") return;
  button.dataset.mediaAutoClassifyWired = "1";
  button.addEventListener("click", async () => {
    const result = document.querySelector("#media-auto-classify-result");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Aktualisiere ...";
    try {
      if (!currentUser() || !canUseCms()) throw new Error("Bitte zuerst im CMS einloggen.");
      const summary = await autoClassifyMediaAssets(result);
      if (result) result.innerHTML = `<div class="alert alert--success">Mediathek aktualisiert: ${summary.updated} Bilder neu zugeordnet, ${summary.free} Bilder ohne aktuelle Verlinkung markiert.</div>`;
      window.setTimeout(() => render(), 900);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Automatische Zuordnung fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel;
      }, 1200);
    }
  });
}

function mediaContextFromNode(node) {
  const selectedEventTargetId = node?.elements?.mediaEventTargetId?.value || "";
  const canUseEventFallback = selectedEventTargetId && !node?.dataset.mediaTargetCollection && Boolean(node?.querySelector?.('[name="mediaEventTargetId"]'));
  if (canUseEventFallback) {
    return {
      targetCollection: "events",
      targetId: selectedEventTargetId,
      targetField: "imageUrl",
      targetAltField: "thumbnail_alt",
      returnTo: `#/cms/event/${selectedEventTargetId}?tab=base`
    };
  }
  return {
    targetCollection: node?.dataset.mediaTargetCollection || "",
    targetId: node?.dataset.mediaTargetId || "",
    targetField: node?.dataset.mediaTargetField || "imageUrl",
    targetAltField: node?.dataset.mediaTargetAltField || "",
    returnTo: node?.dataset.mediaReturnTo || ""
  };
}

function mediaContextFromHash(hash = "") {
  const queryText = String(hash || "").split("?")[1] || "";
  const params = new URLSearchParams(queryText);
  return {
    targetCollection: params.get("targetCollection") || "",
    targetId: params.get("targetId") || "",
    targetField: params.get("targetField") || "imageUrl",
    targetAltField: params.get("targetAltField") || "",
    returnTo: params.get("returnTo") || ""
  };
}

function isLogoMediaTarget(context = {}) {
  return ["members", "sponsors"].includes(context.targetCollection)
    && (context.targetField || "logoUrl") === "logoUrl";
}

function mediaContextQueryFromNode(node) {
  const context = mediaContextFromNode(node);
  const params = new URLSearchParams();
  Object.entries(context).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const text = params.toString();
  return text ? `&${text}` : "";
}

function mediaEditHash(assetId, node) {
  return `#/cms/media/edit?id=${encodeURIComponent(assetId)}${mediaContextQueryFromNode(node)}`;
}

function usableMediaAssetUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:|data:image\/|blob:|\/)/i.test(text)) return text;
  if (/^assets\//i.test(text)) return `/${text}`;
  return "";
}

function mediaAssetUrl(asset = {}) {
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
  ].map(usableMediaAssetUrl).find(Boolean) || "";
}

function mediaAssetUrlValues(asset = {}) {
  return [
    asset.id,
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
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function valueReferencesMediaAsset(value, assetId = "", urls = []) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value === assetId || urls.includes(value);
  if (Array.isArray(value)) return value.some((item) => valueReferencesMediaAsset(item, assetId, urls));
  if (typeof value === "object") return Object.values(value).some((item) => valueReferencesMediaAsset(item, assetId, urls));
  return false;
}

function mediaTypeForLinkedCollection(collectionName = "", record = {}) {
  if (collectionName === "events" || collectionName === "eventMedia") return "event";
  if (collectionName === "topics") return "topic";
  if (collectionName === "members" || collectionName === "sponsors") return "logo";
  if (collectionName === "boardMembers") return "board";
  if (collectionName === "speakers") return "person";
  if (collectionName === "editorialContent") {
    if (record.page === "news" || record.section === "news" || record.publication_target === "news") return "news";
    if (record.page === "home" || record.section === "internal" || record.section === "intro" || record.section === "hero") return "article";
    return "article";
  }
  return "upload";
}

async function autoClassifyMediaAssets(result) {
  const collections = ["editorialContent", "topics", "events", "members", "boardMembers", "speakers", "sponsors", "galleries", "eventMedia"];
  if (result) result.innerHTML = `<div class="alert">${progressMarkup("Mediathek-Verlinkungen werden geprueft ...", 20)}</div>`;
  const [assets, ...collectionEntries] = await Promise.all([
    list("media_assets"),
    ...collections.map(async (collection) => [collection, await list(collection).catch(() => [])])
  ]);
  const recordsByCollection = Object.fromEntries(collectionEntries);
  let updated = 0;
  let free = 0;
  for (const [index, asset] of assets.entries()) {
    const urls = mediaAssetUrlValues(asset);
    let match = null;
    for (const collection of collections) {
      const record = (recordsByCollection[collection] || []).find((item) => valueReferencesMediaAsset(item, asset.id, urls));
      if (record) {
        match = { collection, record };
        break;
      }
    }
    if (!match) {
      free += 1;
      continue;
    }
    const nextType = normalizedMediaType(mediaTypeForLinkedCollection(match.collection, match.record));
    const presetFields = mediaPresetFields(nextType);
    const targetTitle = match.record.title || match.record.headline || match.record.name || match.record.company || match.record.id || "";
    const update = {
      ...asset,
      media_type: nextType,
      ...presetFields,
      linked_collection: match.collection,
      linked_record_id: match.record.id,
      linked_title: targetTitle,
      linked_page: match.record.page || "",
      linked_section: match.record.section || "",
      target_collection: asset.target_collection || match.collection,
      target_id: asset.target_id || match.record.id,
      target_title: asset.target_title || targetTitle,
      target_page: asset.target_page || match.record.page || "",
      target_section: asset.target_section || match.record.section || "",
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (JSON.stringify({
      media_type: asset.media_type,
      linked_collection: asset.linked_collection,
      linked_record_id: asset.linked_record_id,
      linked_title: asset.linked_title
    }) !== JSON.stringify({
      media_type: update.media_type,
      linked_collection: update.linked_collection,
      linked_record_id: update.linked_record_id,
      linked_title: update.linked_title
    })) {
      await upsert("media_assets", update);
      updated += 1;
    }
    if (result && index % 8 === 0) {
      result.innerHTML = `<div class="alert">${progressMarkup(`Mediathek-Zuordnung ${index + 1} von ${assets.length} ...`, 20 + Math.round(((index + 1) / Math.max(1, assets.length)) * 70))}</div>`;
    }
  }
  return { updated, free, total: assets.length };
}

function imageDimensionsFromUrl(url = "") {
  if (!url || url.startsWith("data:")) return Promise.resolve({ width: 0, height: 0 });
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 }));
    image.addEventListener("error", () => resolve({ width: 0, height: 0 }));
    image.src = url;
  });
}

function mediaUrlExtension(url = "") {
  const clean = String(url || "").split("?")[0].split("#")[0];
  const extension = clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  if (["jpg", "jpeg", "png", "webp", "svg", "gif"].includes(extension)) return extension === "jpeg" ? "jpg" : extension;
  if (url.startsWith("data:image/svg")) return "svg";
  if (url.startsWith("data:image/png")) return "png";
  if (url.startsWith("data:image/webp")) return "webp";
  return "webp";
}

function mediaTitleForRecord(record = {}, fallback = "Bild") {
  return record.title || record.titel || record.name || record.headline || record.company || fallback;
}

function collectExistingThumbCandidates(recordsByCollection = {}) {
  const fieldMap = {
    editorialContent: ["imageUrl", "thumbnail_url", "thumbnailUrl", "assetUrl"],
    topics: ["imageUrl", "thumbnail_url", "thumbnailUrl", "assetUrl"],
    events: ["imageUrl"],
    members: ["logoUrl", "imageUrl"],
    boardMembers: ["photoUrl", "imageUrl"],
    speakers: ["photoUrl", "imageUrl"],
    sponsors: ["logoUrl", "imageUrl"]
  };
  const seen = new Set();
  return Object.entries(fieldMap).flatMap(([collection, fields]) => {
    return (recordsByCollection[collection] || []).flatMap((record) => fields.map((field) => {
      const url = String(record[field] || "").trim();
      if (!url || url.startsWith("blob:")) return null;
      const key = `${collection}:${record.id}:${url}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        collection,
        id: record.id,
        field,
        url,
        title: mediaTitleForRecord(record),
        alt: record.thumbnail_alt || record.thumbnailAlt || record.alt_text || record.altText || mediaTitleForRecord(record),
        sourceType: url.startsWith("data:image/") || /ki|ai/i.test(record.source_type || record.assetType || "") ? "ai" : "upload"
      };
    }).filter(Boolean));
  });
}

async function importExistingThumbsToMediaLibrary(result) {
  const collections = ["editorialContent", "topics", "events", "members", "boardMembers", "speakers", "sponsors"];
  if (result) result.innerHTML = `<div class="alert">${progressMarkup("Vorhandene Thumbs werden gesucht ...", 18)}</div>`;
  const entries = await Promise.all(collections.map(async (collection) => [collection, await list(collection)]));
  const recordsByCollection = Object.fromEntries(entries);
  const existingAssets = await list("media_assets");
  const knownAssetKeys = new Set(existingAssets.flatMap((asset) => [
    `${asset.target_collection || ""}:${asset.target_id || ""}:${asset.target_field || "imageUrl"}`,
    asset.original_source_url || "",
    mediaAssetUrl(asset) || ""
  ].filter(Boolean)));
  const candidates = collectExistingThumbCandidates(recordsByCollection)
    .filter((candidate) => {
      const keys = [`${candidate.collection}:${candidate.id}:${candidate.field}`, candidate.url];
      if (keys.some((key) => knownAssetKeys.has(key))) return false;
      keys.forEach((key) => knownAssetKeys.add(key));
      return true;
    });
  let created = 0;
  let linked = 0;
  for (const [index, candidate] of candidates.entries()) {
    if (result) result.innerHTML = `<div class="alert">${progressMarkup(`Thumb ${index + 1} von ${candidates.length} wird in die Mediathek Ã¼bernommen ...`, 25 + Math.round(((index + 1) / Math.max(1, candidates.length)) * 65))}</div>`;
    const dimensions = await imageDimensionsFromUrl(candidate.url);
    const aspect = detectMediaAspectRatio(dimensions);
    const mediaCode = mediaShortCode();
    const extension = mediaUrlExtension(candidate.url);
    const filename = buildMediaFileName({ title: candidate.title || candidate.id, mediaType: candidate.sourceType === "ai" ? "ai" : "upload", format: aspect, version: "v1", extension, code: mediaCode });
    const now = new Date().toISOString();
    const asset = await upsert("media_assets", {
      id: `media-asset-${crypto.randomUUID()}`,
      media_code: mediaCode,
      title: candidate.title || "PROdigitalTV Bild",
      slug: normalizeMediaSlug(`${candidate.title || candidate.id}-${mediaCode}`),
      media_type: candidate.sourceType === "ai" ? "ai" : "upload",
      ...mediaPresetFields(candidate.sourceType === "ai" ? "ai" : "upload"),
      filename_original: filename,
      filename_web: filename,
      filename_thumb: filename,
      file_path_original: "",
      file_path_web: "",
      file_path_thumb: "",
      file_path_original_url: candidate.url,
      file_path_web_url: candidate.url,
      file_path_thumb_url: candidate.url,
      storage_path_original: "",
      storage_path_web: "",
      storage_path_thumb: "",
      mime_type: `image/${extension === "jpg" ? "jpeg" : extension}`,
      aspect_ratio: aspect,
      detected_aspect_ratio: aspect,
      aspect_css: mediaAspectCss(aspect),
      image_width: dimensions.width || 0,
      image_height: dimensions.height || 0,
      image_format: extension.toUpperCase(),
      original_filename: filename,
      source_type: candidate.sourceType,
      source_note: "Aus vorhandenem Thumb-Bestand importiert.",
      original_source_url: candidate.url,
      alt_text: candidate.alt || candidate.title || "",
      description: `Importiertes Thumb fuer ${candidate.title || candidate.id}.`,
      target_collection: candidate.collection,
      target_id: candidate.id,
      target_field: candidate.field,
      linked_collection: candidate.collection,
      linked_record_id: candidate.id,
      linked_field: candidate.field,
      created_by: currentUser()?.email || currentUser()?.uid || "cms",
      created_at: now,
      updated_at: now,
      status: "active"
    });
    created += 1;
    const target = (recordsByCollection[candidate.collection] || []).find((record) => record.id === candidate.id);
    if (target) {
      const variantIds = Array.isArray(target.thumbnail_variant_asset_ids) ? target.thumbnail_variant_asset_ids : [];
      await upsert(candidate.collection, {
        ...target,
        thumbnail_media_asset_id: asset.id,
        mediaAssetId: asset.id,
        thumbnail_url: target.thumbnail_url || candidate.url,
        thumbnailUrl: target.thumbnailUrl || candidate.url,
        thumbnail_variant_asset_ids: Array.from(new Set([asset.id, ...variantIds].filter(Boolean))).slice(0, 24),
        updatedAt: new Date().toISOString()
      });
      linked += 1;
    }
  }
  if (result) {
    result.innerHTML = `<div class="alert alert--success">${created} Thumb${created === 1 ? "" : "s"} in die Mediathek Ã¼bernommen, ${linked} VerknÃ¼pfung${linked === 1 ? "" : "en"} aktualisiert.</div>`;
  }
  return { created, linked, skipped: collectExistingThumbCandidates(recordsByCollection).length - created };
}

async function markMediaAssetLinkedToTarget(asset = {}, context = {}, target = {}) {
  if (!asset?.id || !context.targetCollection || !context.targetId) return asset;
  return upsert("media_assets", {
    ...asset,
    target_collection: context.targetCollection,
    target_id: context.targetId,
    target_field: context.targetField || "imageUrl",
    target_title: target.title || target.titel || target.name || target.headline || context.targetId,
    linked_collection: context.targetCollection,
    linked_record_id: context.targetId,
    linked_field: context.targetField || "imageUrl",
    linked_title: target.title || target.titel || target.name || target.headline || context.targetId,
    updated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

async function attachMediaAssetToTarget(asset = {}, context = {}) {
  if (!context.targetCollection || !context.targetId) return null;
  const target = await getOne(context.targetCollection, context.targetId);
  if (!target) throw new Error("Zieldatensatz fuer das Thumb wurde nicht gefunden.");
  const url = mediaAssetUrl(asset);
  if (!url) throw new Error("Das Bild hat noch keine verwendbare URL.");
  const update = {
    ...target,
    [context.targetField || "imageUrl"]: url,
    mediaAssetId: asset.id,
    thumbnail_media_asset_id: asset.id,
    thumbnail_url: url,
    thumbnailUrl: url,
    assetUrl: url,
    assetType: "image",
    updatedAt: new Date().toISOString()
  };
  if (context.targetCollection === "events") {
    update.imageUrl = url;
    update.thumbnail_url = url;
    update.thumbnailUrl = url;
    update.assetUrl = url;
  }
  if (isLogoMediaTarget(context)) {
    update.logo_media_asset_id = asset.id;
    update.logoMediaAssetId = asset.id;
  }
  const variantIds = Array.isArray(target.thumbnail_variant_asset_ids) ? target.thumbnail_variant_asset_ids : [];
  update.thumbnail_variant_asset_ids = Array.from(new Set([asset.id, ...variantIds].filter(Boolean))).slice(0, 24);
  if (context.targetAltField) update[context.targetAltField] = asset.thumbnail_alt || asset.thumbnailAlt || asset.alt_text || asset.description || target[context.targetAltField] || "";
  await upsert(context.targetCollection, update);
  await markMediaAssetLinkedToTarget(asset, context, target);
  return update;
}

async function createMediaAssetFromEntityImage({ collection = "", entity = {}, file = null, uploaded = null, field = "imageUrl", mediaType = "upload" } = {}) {
  const url = uploaded?.url || "";
  if (!collection || !entity?.id || !file || !url) return null;
  const dimensions = await readImageDimensions(file).catch(() => ({ width: 0, height: 0 }));
  const aspect = detectMediaAspectRatio(dimensions);
  const mediaCode = mediaShortCode();
  const extension = mediaFileExtension(file, "jpg");
  const filename = buildMediaFileName({
    title: entity.title || entity.name || entity.headline || file.name || "bild",
    mediaType,
    format: aspect,
    version: "v1",
    extension,
    code: mediaCode
  });
  const now = new Date().toISOString();
  return upsert("media_assets", {
    id: `media-asset-${crypto.randomUUID()}`,
    media_code: mediaCode,
    title: entity.title || entity.name || entity.headline || file.name || "PROdigitalTV Bild",
    slug: normalizeMediaSlug(`${entity.title || entity.name || entity.headline || file.name || "bild"}-${mediaCode}`),
    media_type: mediaType,
    ...mediaPresetFields(mediaType),
    filename_original: file.name || filename,
    filename_web: file.name || filename,
    filename_thumb: file.name || filename,
    file_path_original: uploaded?.storagePath || "",
    file_path_web: uploaded?.storagePath || "",
    file_path_thumb: uploaded?.storagePath || "",
    file_path_original_url: url,
    file_path_web_url: url,
    file_path_thumb_url: url,
    storage_path_original: uploaded?.storagePath || "",
    storage_path_web: uploaded?.storagePath || "",
    storage_path_thumb: uploaded?.storagePath || "",
    mime_type: file.type || "",
    aspect_ratio: aspect,
    detected_aspect_ratio: aspect,
    aspect_css: mediaAspectCss(aspect),
    file_size: file.size || 0,
    file_size_label: mediaSizeLabel(file.size || 0),
    image_width: dimensions.width || 0,
    image_height: dimensions.height || 0,
    image_format: mediaFormatLabel(file),
    original_filename: file.name || filename,
    source_type: "upload",
    source_note: "Direkt im Datensatz hochgeladen und automatisch in der Mediathek verknuepft.",
    target_collection: collection,
    target_id: entity.id,
    target_field: field,
    target_title: entity.title || entity.name || entity.headline || entity.id,
    linked_collection: collection,
    linked_record_id: entity.id,
    linked_field: field,
    linked_title: entity.title || entity.name || entity.headline || entity.id,
    alt_text: entity.thumbnail_alt || entity.thumbnailAlt || entity.title || entity.name || entity.headline || file.name || "",
    description: entity.description || "",
    created_by: currentUser()?.email || currentUser()?.uid || "cms",
    created_at: now,
    updated_at: now,
    status: "active"
  });
}

async function createMediaAssetFromGalleryImage(gallery = {}, image = {}) {
  const url = usableMediaAssetUrl(image.url || "");
  if (!gallery?.id || !url) throw new Error("Galeriebild hat keine verwendbare Bild-URL.");
  const existingAssets = await list("media_assets").catch(() => []);
  const existingAsset = existingAssets.find((asset) => mediaAssetUrlValues(asset).includes(url));
  if (existingAsset?.id) return existingAsset;
  const dimensions = await imageDimensionsFromUrl(url).catch(() => ({ width: 0, height: 0 }));
  const aspect = detectMediaAspectRatio(dimensions);
  const mediaCode = mediaShortCode();
  const extension = mediaUrlExtension(url);
  const title = image.caption || image.title || image.altText || gallery.title || image.fileName || "Galeriebild";
  const filename = image.fileName || buildMediaFileName({ title, mediaType: "upload", format: aspect, version: "v1", extension, code: mediaCode });
  const now = new Date().toISOString();
  return upsert("media_assets", {
    id: `media-asset-${crypto.randomUUID()}`,
    media_code: mediaCode,
    title,
    slug: normalizeMediaSlug(`${title}-${mediaCode}`),
    media_type: "upload",
    ...mediaPresetFields("upload"),
    filename_original: filename,
    filename_web: filename,
    filename_thumb: filename,
    file_path_original: image.storagePath || "",
    file_path_web: image.storagePath || "",
    file_path_thumb: image.storagePath || "",
    file_path_original_url: url,
    file_path_web_url: url,
    file_path_thumb_url: url,
    storage_path_original: image.storagePath || "",
    storage_path_web: image.storagePath || "",
    storage_path_thumb: image.storagePath || "",
    mime_type: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
    aspect_ratio: aspect,
    detected_aspect_ratio: aspect,
    aspect_css: mediaAspectCss(aspect),
    file_size: 0,
    file_size_label: "",
    image_width: dimensions.width || 0,
    image_height: dimensions.height || 0,
    image_format: extension.toUpperCase(),
    original_filename: image.fileName || filename,
    source_type: "gallery",
    source_note: "Manuell aus einer bestehenden Galerie in die Mediathek verschoben. Es wird keine Datei kopiert; Originaldatei und Galeriepfad bleiben unveraendert.",
    target_collection: "galleries",
    target_id: gallery.id,
    target_field: "images",
    target_title: gallery.title || gallery.id,
    linked_collection: "galleries",
    linked_record_id: gallery.id,
    linked_field: "images",
    linked_title: gallery.title || gallery.id,
    alt_text: image.altText || image.caption || title,
    description: gallery.description || "",
    visibility: gallery.visibility || "public",
    created_by: currentUser()?.email || currentUser()?.uid || "cms",
    created_at: now,
    updated_at: now,
    status: "active"
  });
}
function wireCentralMediaUpload() {
  const uploadForm = document.querySelector("[data-media-upload-form]");
  wireMediaUploadAutomation(uploadForm);
  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#central-media-upload-result");
    const file = form.elements.mediaFile?.files?.[0];
    if (!file) return;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const asset = await saveCentralMediaUpload(form, file, { result });
      const mediaContext = mediaContextFromNode(form);
      if (mediaContext.targetCollection && mediaContext.targetId) {
        await attachMediaAssetToTarget(asset, mediaContext);
        const assignmentLabel = isLogoMediaTarget(mediaContext) ? "Logo" : "Bild";
        if (result) result.innerHTML = `<div class="alert alert--success">${assignmentLabel} wurde hochgeladen und zugeordnet.</div>`;
        if (mediaContext.returnTo) {
          window.setTimeout(() => { window.location.hash = mediaContext.returnTo.replace(/^#\/?/, "#/"); }, 500);
          return;
        }
      }
      window.setTimeout(() => { window.location.hash = mediaEditHash(asset.id, form); }, 700);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Upload fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function wireMediaAiDraft() {
  const aiForm = document.querySelector("[data-media-ai-form]");
  if (!aiForm) return;
  const referenceInput = aiForm.elements.reference_image;
  const referenceDropzone = aiForm.querySelector("[data-media-ai-reference-dropzone]");
  const areaReferencePreview = aiForm.querySelector("[data-media-ai-area-reference-preview]");
  const areaSelect = aiForm.elements.target_area;
  let activeAreaReference = null;
  const renderAreaReferencePreview = (record = null, area = areaSelect?.value || "general") => {
    activeAreaReference = record;
    if (!areaReferencePreview) return;
    if (record?.file_url) {
      areaReferencePreview.innerHTML = `<img src="${escapeHtml(record.file_url)}" alt="Bereichsreferenz"><span>Gespeichert fuer ${escapeHtml(area)} <small>${escapeHtml(record.original_filename || "Referenzfoto")}</small></span>`;
      return;
    }
    areaReferencePreview.innerHTML = `<span>Default fuer ${escapeHtml(area)}: kein Bereichs-Referenzfoto gespeichert.</span>`;
  };
  const refreshAreaReferencePreview = async () => {
    const area = areaSelect?.value || "general";
    renderAreaReferencePreview(await loadMediaAiAreaReference(area), area);
  };
  const storeAreaReferenceFile = async (file) => {
    const area = areaSelect?.value || "general";
    const result = aiForm.querySelector("#media-ai-result");
    if (!file) return;
    if (result) result.innerHTML = `<div class="alert">${progressMarkup(`Referenzfoto fuer ${area} wird gespeichert ...`, 45)}</div>`;
    const record = await saveMediaAiAreaReference(area, file);
    renderAreaReferencePreview(record, area);
    if (result) result.innerHTML = `<div class="alert alert--success">Referenzfoto fuer ${escapeHtml(area)} gespeichert. Es wird fuer kommende KI-Bilder in diesem Bereich genutzt.</div>`;
  };
  aiForm.querySelectorAll("[data-media-ai-template]").forEach((button) => {
    button.addEventListener("click", () => {
      aiForm.querySelectorAll("[data-media-ai-template]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      if (aiForm.elements.style_preset) aiForm.elements.style_preset.value = button.dataset.stylePreset || "free_style";
      if (aiForm.elements.motif_type) aiForm.elements.motif_type.value = button.dataset.motifType || "symbol";
      if (aiForm.elements.image_effect) aiForm.elements.image_effect.value = button.dataset.imageEffect || "premium";
      if (aiForm.elements.color_world) aiForm.elements.color_world.value = button.dataset.colorWorld || "";
      if (aiForm.elements.style) aiForm.elements.style.value = button.dataset.style || "";
      const result = aiForm.querySelector("#media-ai-result");
      if (result) result.innerHTML = `<div class="alert">Stilvorlage uebernommen. Du kannst Prompt, Stil oder ein echtes Referenzbild jetzt noch verfeinern.</div>`;
    });
  });
  const refreshReferencePreview = async () => {
    const preview = aiForm.querySelector("[data-media-ai-reference-preview]");
    const file = referenceInput?.files?.[0];
    if (!preview) return;
    if (!file) {
      preview.innerHTML = `<span>Noch kein Referenzbild gewaehlt.</span>`;
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const mode = aiForm.elements.reference_mode?.value || "style";
      preview.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="Referenzfoto"><span>${escapeHtml(file.name)} <small>${mode === "area" ? "fuer diesen Bereich merken" : "nur fuer diese Grafik"} Â· ${escapeHtml(mediaSizeLabel(file.size || 0))}</small></span>`;
      if (mode === "area") await storeAreaReferenceFile(file);
    } catch (error) {
      preview.innerHTML = `<span>Referenzbild konnte nicht gelesen werden.</span>`;
    }
  };
  referenceInput?.addEventListener("change", refreshReferencePreview);
  aiForm.querySelectorAll('input[name="reference_mode"]').forEach((input) => input.addEventListener("change", refreshReferencePreview));
  referenceDropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    referenceDropzone.classList.add("is-drag-over");
  });
  referenceDropzone?.addEventListener("dragleave", (event) => {
    if (event.relatedTarget && referenceDropzone.contains(event.relatedTarget)) return;
    referenceDropzone.classList.remove("is-drag-over");
  });
  referenceDropzone?.addEventListener("drop", async (event) => {
    event.preventDefault();
    referenceDropzone.classList.remove("is-drag-over");
    const file = Array.from(event.dataTransfer?.files || []).find((item) => /^image\/(jpeg|png|webp)$/i.test(item.type || ""));
    const preview = aiForm.querySelector("[data-media-ai-reference-preview]");
    if (!file || !referenceInput) {
      if (preview) preview.innerHTML = `<span>Bitte ein JPG-, PNG- oder WebP-Bild ablegen.</span>`;
      return;
    }
    filesToInput(referenceInput, [file]);
    await refreshReferencePreview();
  });
  areaSelect?.addEventListener("change", () => {
    refreshAreaReferencePreview().catch((error) => {
      if (areaReferencePreview) areaReferencePreview.innerHTML = `<span>Referenzfoto konnte nicht geladen werden.</span>`;
      console.warn("Area reference load failed", error);
    });
  });
  aiForm.querySelector("[data-media-ai-area-reference-reset]")?.addEventListener("click", async () => {
    const area = areaSelect?.value || "general";
    const result = aiForm.querySelector("#media-ai-result");
    try {
      await resetMediaAiAreaReference(area);
      renderAreaReferencePreview(null, area);
      if (result) result.innerHTML = `<div class="alert alert--success">Bereichsreferenz fuer ${escapeHtml(area)} zurueckgesetzt. Es gilt wieder der Default.</div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Bereichsreferenz konnte nicht zurueckgesetzt werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });
  refreshAreaReferencePreview().catch(() => renderAreaReferencePreview(null, areaSelect?.value || "general"));
  aiForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formObject(form);
    const result = form.querySelector("#media-ai-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    const originalLabel = submitButton?.textContent || "";
    const mediaContext = mediaContextFromNode(form);
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = mediaContext.targetId ? "KI-Thumb wird erstellt ..." : "KI-Grafik wird erstellt ...";
    }
    let step = "Vorbereitung";
    try {
      setMediaAiProgress(form, "context", "KI-Grafik wird vorbereitet ...", 12, "Formularwerte und Zielkontext werden gelesen.");
      step = "Zieldatensatz lesen";
      const target = mediaContext.targetCollection && mediaContext.targetId ? await getOne(mediaContext.targetCollection, mediaContext.targetId) : null;
      setMediaAiProgress(form, "context", target ? "Beitragskontext wurde geladen ..." : "Freie KI-Grafik wird vorbereitet ...", 20, target ? "Der verknuepfte CMS-Datensatz ist gefunden." : "Es wird ohne Beitragsverknuepfung gearbeitet.");
      step = "Referenzbild vorbereiten";
      const referenceMode = values.reference_mode || "style";
      const referenceFile = form.elements.reference_image?.files?.[0] || null;
      const referenceImage = referenceFile && referenceMode !== "area"
        ? await mediaAiReferenceImageData(referenceFile)
        : null;
      if (referenceImage) {
        setMediaAiProgress(form, "context", "Referenzbild wurde vorbereitet ...", 24, `${referenceImage.fileName} (${referenceImage.width} x ${referenceImage.height}px) dient nur als Stilreferenz.`);
      } else if (activeAreaReference?.file_url) {
        setMediaAiProgress(form, "context", "Bereichsreferenz wird verwendet ...", 24, `${activeAreaReference.original_filename || "Referenzfoto"} dient als thematische Vorlage fuer ${values.target_area || "general"}.`);
      }
      step = "Kontext vorbereiten";
      const targetContext = target
        ? imageGenerationContextFromRecord(target, mediaContext.targetCollection)
        : {
            title: values.title || "PROdigitalTV KI-Grafik",
            subtitle: "",
            bodyText: values.source_text || "",
            shortDescription: values.source_text || "",
            category: "",
            module: "media_assets"
          };
      const variantNumber = Math.max(1, (Array.isArray(target?.thumbnail_variant_asset_ids) ? target.thumbnail_variant_asset_ids.length : 0) + 1);
      setMediaAiProgress(form, "prompt", "Prompt und Stilwelt werden aufgebaut ...", 30, `${values.style_preset || "free_style"} / ${values.motif_type || "symbol"}`);
      const prompt = creativeThumbPrompt({
        ...targetContext,
        title: values.title || targetContext.title,
        bodyText: [targetContext.bodyText, values.source_text].filter(Boolean).join("\n\n"),
        stylePreset: values.style_preset || "",
        motifType: values.motif_type || "",
        imageEffect: values.image_effect || "",
        textArea: values.text_area || "",
        textOverlay: values.text_overlay || "",
        targetArea: values.target_area || ""
      }, values.generated_prompt || "", variantNumber);
      setMediaAiProgress(form, "generate", mediaContext.targetId ? "KI erzeugt den Thumb zum Beitrag ..." : "KI erzeugt die Grafik ...", 42, "Das kann je nach Modell und Bildgroesse etwas dauern.");
      step = "KI-Thumb erzeugen";
      const generated = await generateCmsThumbCollage({
        entityType: mediaContext.targetCollection || "media_assets",
        entityId: mediaContext.targetId || "",
        prompt,
        context: {
          ...targetContext,
          sourceText: values.source_text || "",
          stylePreset: values.style_preset || "",
          style: values.style || "",
          colorWorld: values.color_world || "",
          motifType: values.motif_type || "",
          imageEffect: values.image_effect || "",
          textArea: values.text_area || "",
          textOverlay: values.text_overlay || "",
          targetArea: values.target_area || "",
          areaReferenceImageFileName: activeAreaReference?.original_filename || "",
          referenceImageFileName: referenceImage?.fileName || "",
          variantNumber
        },
        referenceImageDataUrl: referenceImage?.dataUrl || activeAreaReference?.file_url || "",
        referenceImageName: referenceImage?.fileName || activeAreaReference?.original_filename || "",
        referenceImageRole: referenceImage ? "style" : activeAreaReference?.file_url ? "area_theme" : "",
        size: "1536x1024",
        quality: "medium"
      });
      setMediaAiProgress(form, "save", "KI-Bild wurde erzeugt und wird vorbereitet ...", 68, generated.fileName || "Originaldatei wird normalisiert.");
      step = "Bild normalisieren";
      const normalized = await generatedImageToOriginalFile(generated.imageDataUrl, generated.fileName || `${mediaContext.targetId || values.title || "ki-original"}-v${variantNumber}.webp`);
      setMediaAiProgress(form, "save", "KI-Bild wird in der Mediathek gespeichert ...", 76, "Original, Metadaten und Vorschau werden angelegt.");
      step = "Mediathek speichern";
      const asset = await saveGeneratedThumbMediaAsset(form, normalized.file, {
        dataUrl: normalized.dataUrl,
        prompt: generated.prompt || prompt,
        result,
        variantNumber,
        contextOverride: {
          ...targetContext,
          title: values.title || targetContext.title,
          stylePreset: values.style_preset || "",
          style: values.style || "",
          motifType: values.motif_type || "",
          imageEffect: values.image_effect || "",
          textArea: values.text_area || "",
          textOverlay: values.text_overlay || "",
          targetArea: values.target_area || ""
        },
        targetContextOverride: mediaContext.targetCollection && mediaContext.targetId ? mediaContext : null,
        attachToTarget: false
      });
      setMediaAiProgress(form, "variants", "Webvarianten werden erzeugt ...", 84, "Die Mediathek rendert die passenden Ausspielgroessen.");
      step = "Webvarianten erzeugen";
      await generateAssetVariants(asset, {
        mode: "all",
        result
      });
      setMediaAiProgress(form, "link", mediaContext.targetId ? "Bild wird verknuepft und protokolliert ..." : "KI-Erzeugung wird protokolliert ...", 94, mediaContext.targetId ? "Der Beitrag bekommt die neue Grafik als Bild." : "Das Asset bleibt als Hauptbild in der Mediathek.");
      step = "KI-Generierung protokollieren";
      await upsert("ai_image_generations", {
        id: `ai-image-generation-${crypto.randomUUID()}`,
        media_asset_id: asset.id,
        prompt_id: "",
        source_text: values.source_text || "",
        generated_prompt: generated.prompt || prompt,
        negative_prompt: "",
        model_name: "OpenAI Image",
        generation_status: "generated",
        review_status: "pending_review",
        style_preset: values.style_preset || "",
        reference_image_name: referenceImage?.fileName || "",
        reference_image_used: Boolean(referenceImage),
        area_reference_image_name: activeAreaReference?.original_filename || "",
        area_reference_image_used: Boolean(!referenceImage && activeAreaReference?.file_url),
        motif_type: values.motif_type || "",
        image_effect: values.image_effect || "",
        text_area: values.text_area || "",
        text_overlay: values.text_overlay || "",
        target_area: values.target_area || "",
        created_by: currentUser()?.email || currentUser()?.uid || "cms",
        created_at: new Date().toISOString()
      });
      const reviewAsset = await upsert("media_assets", {
        ...asset,
        review_status: "pending_review",
        ai_review_status: "pending_review",
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const pipeline = form.querySelector("[data-media-ai-pipeline]");
      if (pipeline) {
        pipeline.innerHTML = `<div class="media-ai-progress media-ai-progress--done">${progressMarkup("KI-Bild erzeugt. Bitte Ergebnis pruefen ...", 100)}<p>Die Grafik wartet jetzt auf Freigabe oder Verwerfen.</p></div>`;
      }
      if (result) {
        result.innerHTML = `<div class="alert alert--success">KI-Bild wurde erzeugt. Bitte vor dem Bildeditor freigeben oder verwerfen.</div>${mediaAiReviewMarkup(reviewAsset, mediaContext, normalized.dataUrl)}`;
        wireMediaAiReviewActions(form, reviewAsset, mediaContext);
      }
    } catch (error) {
      const code = error?.code ? ` (${error.code})` : "";
      const pipeline = form.querySelector("[data-media-ai-pipeline]");
      if (pipeline) {
        pipeline.hidden = false;
        pipeline.innerHTML = `<div class="media-ai-progress media-ai-progress--error"><strong>Pipeline gestoppt</strong><p>${escapeHtml(step)}${escapeHtml(code)} - ${escapeHtml(error.message || String(error))}</p></div>`;
      }
      if (result) result.innerHTML = `<div class="alert alert--error">KI-Thumb konnte nicht erstellt werden: ${escapeHtml(step)}${escapeHtml(code)} - ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      clearMediaAiProgress(form);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });
}

function wireMediaEdit() {
  wireMediaCropMask();
  const editForm = document.querySelector("[data-media-edit-form]");
  if (editForm?.dataset.mediaId) {
    try {
      localStorage.setItem("pdt-last-media-asset-id", editForm.dataset.mediaId);
    } catch {}
  }
  editForm?.querySelector("[data-media-editor-type-update]")?.addEventListener("change", async (event) => {
    const select = event.currentTarget;
    const result = editForm.querySelector("#media-edit-result");
    const assetId = editForm.dataset.mediaId;
    const nextType = normalizedMediaType(select.value || "upload");
    const presetFields = mediaPresetFields(nextType);
    select.disabled = true;
    try {
      const asset = await getOne("media_assets", assetId);
      if (!asset) throw new Error("Bild wurde nicht gefunden.");
      await upsert("media_assets", {
        ...asset,
        media_type: nextType,
        ...presetFields,
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (editForm.elements.aspect_ratio) editForm.elements.aspect_ratio.value = presetFields.aspect_ratio;
      editForm.dataset.mediaAspect = presetFields.aspect_ratio;
      editForm.dataset.activeVariantFormat = presetFields.aspect_ratio;
      document.querySelector("[data-media-crop-stage]")?.style.setProperty("--media-crop-aspect", mediaAspectCss(presetFields.aspect_ratio));
      const hint = editForm.querySelector("[data-media-preset-hint]");
      if (hint) hint.textContent = mediaPresetSummary(nextType);
      if (result) result.innerHTML = `<div class="alert alert--success">Bildzuordnung gespeichert.</div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Zuordnung konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      select.disabled = false;
    }
  });
  const editorUpload = editForm?.querySelector("[data-media-editor-upload]");
  editorUpload?.addEventListener("change", async () => {
    const file = editorUpload.files?.[0];
    if (!file || editForm.dataset.mediaEditorUploading === "1") return;
    editForm.dataset.mediaEditorUploading = "1";
    const result = editForm.querySelector("#media-edit-result");
    const uploadBox = editorUpload.closest(".media-editor-upload");
    const uploadLabel = uploadBox?.querySelector("label.button");
    const originalLabel = uploadLabel?.textContent || "Datei hochladen";
    try {
      const dimensions = await readImageDimensions(file);
      writeMediaFileMetaFields(editForm, file, dimensions);
      renderMediaFileMeta(editForm, file, dimensions);
      if (uploadLabel) uploadLabel.textContent = "Speichert ...";
      const asset = await saveCentralMediaUpload(editForm, file, { result, auto: true });
      if (asset?.id) window.setTimeout(() => { window.location.hash = mediaEditHash(asset.id, editForm); }, 500);
    } catch (error) {
      editForm.dataset.mediaEditorUploading = "0";
      if (result) result.innerHTML = `<div class="alert alert--error">Upload im Editor fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
      if (uploadLabel) uploadLabel.textContent = originalLabel;
    }
  });
  editForm?.querySelector("[data-media-description-ai]")?.addEventListener("click", async () => {
    const button = editForm.querySelector("[data-media-description-ai]");
    const originalLabel = button?.textContent || "";
    const asset = await getOne("media_assets", editForm.dataset.mediaId);
    if (!asset) return;
    const values = { ...formObject(editForm), active_variant_format: editForm.dataset.activeVariantFormat || asset.aspect_ratio || "16x9" };
    const fallback = `Keine echte Bildbeschreibung erzeugt. Bitte Cloud-KI deployen oder den sichtbaren Bildinhalt manuell beschreiben.`;
    const result = editForm.querySelector("#media-edit-result");
    if (button) {
      button.disabled = true;
      button.textContent = "KI beschreibt ...";
    }
    if (result) result.innerHTML = `<div class="alert">${progressMarkup("KI-Bildbeschreibung wird erzeugt ...", 55)}</div>`;
    try {
      const aiResult = await callChatGptAction("generateImageAltText", {
        module: "media_library",
        entityType: "media_assets",
        entityId: asset.id,
        fieldName: "description",
        originalText: "",
        imageUrl: asset.file_path_web_url || asset.file_path_original_url || asset.imageUrl || asset.assetUrl || "",
        context: {
          title: values.title || asset.title || "",
          altText: values.alt_text || asset.alt_text || "",
          description: values.description || asset.description || "",
          mediaType: asset.media_type || "",
          format: values.active_variant_format || asset.aspect_ratio || "",
          filename: asset.filename_web || asset.filename_original || "",
          mediaCode: asset.media_code || "",
          tags: asset.tags || []
        }
      });
      const description = mediaAiDescriptionFromResult(aiResult, fallback);
      const thumbText = mediaAiThumbTextFromResult(aiResult, description);
      editForm.elements.description.value = description;
      if (!String(editForm.elements.alt_text.value || "").trim()) editForm.elements.alt_text.value = description.slice(0, 180);
      const now = new Date().toISOString();
      await upsert("media_assets", {
        ...asset,
        title: values.title || asset.title || "",
        alt_text: editForm.elements.alt_text.value || asset.alt_text || "",
        description,
        thumbnail_alt: thumbText,
        thumbnailAlt: thumbText,
        thumbnail_description: thumbText,
        thumb_text: thumbText,
        thumbnail_url: asset.file_path_thumb_url || asset.file_path_web_url || asset.imageUrl || asset.assetUrl || "",
        updated_at: now,
        updatedAt: now
      });
      if (result) result.innerHTML = `<div class="alert alert--success">KI-Bildbeschreibung und Thumb-Text wurden erzeugt und gespeichert.</div>`;
    } catch (error) {
      editForm.elements.description.value = fallback;
      if (result) result.innerHTML = `<div class="alert alert--warning">KI-Bildanalyse war nicht erreichbar. Es wurde nur ein Hinweis eingesetzt, keine echte Bildbeschreibung.</div>`;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  });
  editForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formObject(form);
    const result = form.querySelector("#media-edit-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    setaveButtonFeedback(submitButton, "saving", "peichere ...");
    const asset = await getOne("media_assets", form.dataset.mediaId);
    if (!asset) {
      setaveButtonFeedback(submitButton, "error", "Fehler");
      return;
    }
    const mediaContext = mediaContextFromNode(form);
    const saveEditedTargetThumb = mediaContext.targetCollection
      && mediaContext.targetId
      && form.querySelector("[data-media-crop-apply]");
    if (saveEditedTargetThumb) {
      const assignmentLabel = isLogoMediaTarget(mediaContext) ? "Logo" : "Thumb";
      if (result) result.innerHTML = `<div class="alert">Bearbeitetes ${assignmentLabel} wird gespeichert und zugeordnet ...</div>`;
      form.querySelector("[data-media-crop-apply]")?.click();
      setaveButtonFeedback(submitButton, "success", `${assignmentLabel} wird gespeichert`);
      return;
    }
    const now = new Date().toISOString();
    try {
      const update = {
        ...asset,
        title: values.title || asset.title,
        media_type: normalizedMediaType(values.media_type || asset.media_type || "upload"),
        ...mediaPresetFields(values.media_type || asset.media_type || "upload"),
        alt_text: values.alt_text || "",
        description: values.description || "",
        status: asset.status || "active",
        focal_point_x: Number(values.focal_point_x || 50),
        focal_point_y: Number(values.focal_point_y || 50),
        crop_x: Number(values.crop_x || 0),
        crop_y: Number(values.crop_y || 0),
        crop_scale: Number(values.crop_scale || 1),
        brightness: Number(values.brightness || 0),
        contrast: Number(values.contrast || 0),
        saturation: Number(values.saturation || 0),
        sharpness: Number(values.sharpness || 0),
        black_white: Boolean(values.black_white),
        updated_at: now
      };
      await upsert("media_assets", update);
      const presetVariants = mediaPresetVariants(update, values);
      await Promise.all(presetVariants.map((variant) => upsert("media_variants", variant)));
      if (mediaContext.targetCollection && mediaContext.targetId) {
        await attachMediaAssetToTarget(update, mediaContext);
        const assignmentLabel = isLogoMediaTarget(mediaContext) ? "Logo" : "Bild";
        if (result) result.innerHTML = `<div class="alert alert--success">Bilddaten gespeichert und als ${assignmentLabel} zugeordnet.</div>`;
        if (mediaContext.returnTo) window.setTimeout(() => { window.location.hash = mediaContext.returnTo.replace(/^#\/?/, "#/"); }, 700);
      } else if (result) {
        result.innerHTML = `<div class="alert alert--success">Bilddaten gespeichert.</div>`;
      }
      setaveButtonFeedback(submitButton, "success", "Gespeichert");
    } catch (error) {
      setaveButtonFeedback(submitButton, "error", "Fehler");
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });
}

function mediaPresetVariants(asset = {}, values = {}) {
  const now = new Date().toISOString();
  const extension = String(asset.filename_web || asset.filename_original || "webp").split(".").pop();
  const base = {
    media_asset_id: asset.id,
    file_path: asset.file_path_web || asset.file_path_original || "",
    file_url: asset.file_path_web_url || asset.file_path_original_url || "",
    source_filename: asset.filename_web || asset.filename_original || "",
    crop_data: {
      x: asset.crop_x || 0,
      y: asset.crop_y || 0,
      scale: asset.crop_scale || 1,
      brightness: asset.brightness || 0,
      contrast: asset.contrast || 0,
      saturation: asset.saturation || 0,
      sharpness: asset.sharpness || 0,
      black_white: Boolean(asset.black_white)
    },
    created_at: now,
    created_by: currentUser()?.email || currentUser()?.uid || "cms"
  };
  const presets = [
    values.variant_news ? { type: "news", label: "News / Artikel", format: "16x9", usage_type: "news_header" } : null,
    values.variant_landscape ? { type: "landscape", label: "Thumb", format: "3x2", usage_type: "thumbnail" } : null,
    values.variant_portrait ? { type: "portrait", label: "Hochkant", format: "9x16", usage_type: "portrait" } : null,
    values.variant_board ? { type: "board", label: "Vorstand / Person", format: "1x1", usage_type: "profile" } : null,
    values.variant_logo ? { type: "logo", label: "Logo / Mitglieder", format: "logo", usage_type: "logo_card" } : null
  ].filter(Boolean);
  return presets.map((preset) => ({
    ...base,
    id: `media-variant-${asset.id}-${preset.type}`,
    variant_type: preset.type,
    variant_label: preset.label,
    usage_type: preset.usage_type,
    format: preset.format,
    filename: buildMediaFileName({
      title: asset.title || asset.filename_original || "bild",
      mediaType: preset.type === "board" ? "person" : preset.type,
      format: preset.format,
      version: "v1",
      extension,
      code: asset.media_code || ""
    }),
    version: "v1",
    updated_at: now
  }));
}

async function renderVariantFromOriginalAsset(asset = {}, variantKey = "", cropData = null, options = {}) {
  if (!asset?.id) throw new Error("Bilddatensatz fehlt.");
  const variant = mediaVariantDefinition(variantKey, asset);
  const requestedSourceUrl = options.sourceUrl || asset.file_path_original_url || asset.file_path_web_url || asset.file_path_thumb_url || mediaAssetUrl(asset);
  const candidateSources = [
    ...(Array.isArray(options.sourceCandidates) ? options.sourceCandidates : []),
    requestedSourceUrl
  ];
  const sharedImage = options.originalImage ? {
    image: options.originalImage,
    sourceUrl: options.originalSourceUrl || requestedSourceUrl,
    cleanup: null
  } : await loadMediaRenderableImage(candidateSources, asset);
  const { image: originalImage, sourceUrl, cleanup } = sharedImage;
  let file = null;
  let upload = null;
  let fallbackReason = "";
  let effectiveCrop = cropData || mediaDefaultCropData({
    ...asset,
    image_width: originalImage.naturalWidth || asset.image_width,
    image_height: originalImage.naturalHeight || asset.image_height
  }, variant.key);
  const filename = mediaVariantOutputFileName(asset, variant.key);
  const path = mediaVariantOutputPath(asset, variant.key);
  try {
    const metrics = mediaRenderMetrics({
      sourceWidth: originalImage.naturalWidth || asset.image_width || variant.width,
      sourceHeight: originalImage.naturalHeight || asset.image_height || variant.height,
      viewportWidth: variant.width,
      viewportHeight: variant.height,
      zoomFactor: effectiveCrop.zoomFactor || 1,
      offsetXRatio: effectiveCrop.offsetXRatio || 0,
      offsetYRatio: effectiveCrop.offsetYRatio || 0
    });
    const canvas = document.createElement("canvas");
    canvas.width = variant.width;
    canvas.height = variant.height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const brightness = 1 + (Number(effectiveCrop.brightness || 0) / 100);
    const contrast = 1 + (Number(effectiveCrop.contrast || 0) / 100);
    const saturation = 1 + (Number(effectiveCrop.saturation || 0) / 100);
    context.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})${effectiveCrop.black_white ? " grayscale(1)" : ""}`;
    context.drawImage(originalImage, metrics.drawX, metrics.drawY, metrics.drawWidth, metrics.drawHeight);
    context.filter = "none";
    try {
      file = await canvasToFile(canvas, filename, variant.format || "image/webp", variant.quality || .86);
      upload = await uploadMediaAsset(file, path);
    } catch (error) {
      fallbackReason = error?.message || "WebP-Render fehlgeschlagen.";
      throw new Error(fallbackReason);
    }
  } finally {
    cleanup?.();
  }
  const now = new Date().toISOString();
  const existingRecord = options.existingRecord || null;
  const cropState = {
    ...effectiveCrop,
    variantKey: variant.key,
    targetWidth: variant.width,
    targetHeight: variant.height,
    aspect: variant.aspect
  };
  const derivedAssetId = existingRecord?.derived_media_asset_id || `media-asset-${crypto.randomUUID()}`;
  const derivedAsset = await upsert("media_assets", {
    ...asset,
    id: derivedAssetId,
    parent_media_asset_id: asset.id,
    variant_key: variant.key,
    usage_preset: variant.key,
    usage_preset_ratio: variant.aspect,
    title: `${asset.title || asset.filename_original || "Bild"} ${variant.label}`,
    slug: normalizeMediaSlug(`${asset.title || asset.filename_original || "bild"}-${variant.key}-${asset.media_code || ""}`),
    media_type: asset.media_type || "upload",
    filename_original: filename,
    filename_web: filename,
    filename_thumb: filename,
    file_path_original: path,
    file_path_web: path,
    file_path_thumb: path,
    file_path_original_url: upload?.url || "",
    file_path_web_url: upload?.url || "",
    file_path_thumb_url: upload?.url || "",
    storage_path_original: upload?.storagePath || path,
    storage_path_web: upload?.storagePath || path,
    storage_path_thumb: upload?.storagePath || path,
    mime_type: file?.type || "image/webp",
    web_mime_type: file?.type || "image/webp",
    thumb_mime_type: file?.type || "image/webp",
    aspect_ratio: variant.aspect,
    image_width: variant.width,
    image_height: variant.height,
    web_image_width: variant.width,
    web_image_height: variant.height,
    thumb_image_width: Math.min(variant.width, 640),
    thumb_image_height: Math.min(variant.height, 640),
    image_format: "WEBP",
    web_image_format: "WEBP",
    thumb_image_format: "WEBP",
    source_type: "edited",
    source_note: `Originalbasierte Webvariante ${variant.label}`,
    alt_text: options.altText || asset.alt_text || asset.title || "",
    description: options.description || asset.description || "",
    crop_data: cropState,
    crop_x: cropState.cropX,
    crop_y: cropState.cropY,
    crop_scale: cropState.zoomFactor,
    brightness: cropState.brightness,
    contrast: cropState.contrast,
    saturation: cropState.saturation,
    sharpness: cropState.sharpness,
    black_white: cropState.black_white,
    file_size: file?.size || 0,
    file_size_label: mediaSizeLabel(file?.size || 0),
    created_by: currentUser()?.email || currentUser()?.uid || "cms",
    created_at: existingRecord?.derived_media_asset_id ? asset.created_at || now : now,
    updated_at: now,
    status: "active"
  });
  const variantRecord = await upsert("media_variants", {
    id: existingRecord?.id || `media-variant-${asset.id}-${variant.key}`,
    media_asset_id: asset.id,
    derived_media_asset_id: derivedAsset.id,
    variant_key: variant.key,
    variant_type: variant.key,
    variant_label: variant.label,
    format: variant.aspect,
    width: variant.width,
    height: variant.height,
    file_path: path,
    file_url: upload?.url || "",
    filename,
    file_format: "webp",
    codec: file?.type || "image/webp",
    quality: variant.quality,
    crop_data: cropState,
    crop_x: cropState.cropX,
    crop_y: cropState.cropY,
    crop_width: cropState.cropWidth,
    crop_height: cropState.cropHeight,
    zoom_factor: cropState.zoomFactor,
    offset_x_ratio: cropState.offsetXRatio,
    offset_y_ratio: cropState.offsetYRatio,
    source_original_url: sourceUrl,
    render_status: "rendered",
    error_text: fallbackReason,
    is_manual_crop: Boolean(cropState.isManual),
    version: existingRecord?.version || "v1",
    created_at: existingRecord?.created_at || now,
    updated_at: now,
    created_by: currentUser()?.email || currentUser()?.uid || "cms"
  });
  return { variant, cropState, derivedAsset, variantRecord };
}

async function generateAssetVariants(asset = {}, { mode = "missing", activeVariantKey = "", cropData = null, result = null, targetContext = null, sourceCandidates = [] } = {}) {
  const variantKeys = activeVariantKey ? [activeVariantKey] : MEDIA_VARIANT_ORDER;
  const existing = await ensureAssetVariantRecords(asset);
  const existingByKey = new Map(existing.map((record) => [String(record.variant_key || record.variant_type || "").toLowerCase(), record]));
  const rendered = [];
  const errors = [];
  const plannedVariants = variantKeys
    .map((key) => ({ key, record: existingByKey.get(String(key).toLowerCase()) || null }))
    .filter(({ record }) => !(mode === "missing" && (record?.file_url || record?.derived_media_asset_id)));
  if (!plannedVariants.length) return { rendered, errors };

  const firstSourceUrl = asset.file_path_original_url || asset.file_path_web_url || asset.file_path_thumb_url || mediaAssetUrl(asset);
  const sharedSource = await loadMediaRenderableImage([...(Array.isArray(sourceCandidates) ? sourceCandidates : []), firstSourceUrl], asset);
  try {
    for (const [index, item] of plannedVariants.entries()) {
      const { key, record } = item;
      if (result) {
        const variantMeta = mediaVariantDefinition(key, asset);
        result.innerHTML = `<div class="alert">${progressMarkup(`Variante ${index + 1} von ${plannedVariants.length}: ${variantMeta.label} (${variantMeta.width} x ${variantMeta.height}) wird gerendert ...`, 35 + Math.round(((index + 1) / Math.max(1, plannedVariants.length)) * 45))}</div>`;
      }
      try {
        const renderResult = await renderVariantFromOriginalAsset(asset, key, cropData && key === activeVariantKey ? cropData : (record?.crop_data || mediaDefaultCropData(asset, key)), {
          sourceCandidates,
          originalImage: sharedSource.image,
          originalSourceUrl: sharedSource.sourceUrl,
          existingRecord: record
        });
        rendered.push(renderResult);
        if (renderResult?.variantRecord) existingByKey.set(String(key).toLowerCase(), renderResult.variantRecord);
      } catch (error) {
        errors.push(`${key}: ${error.message || String(error)}`);
        if (record?.id) {
          await upsert("media_variants", {
            ...record,
            render_status: "error",
            error_text: error.message || String(error),
            updated_at: new Date().toISOString()
          });
        }
      }
    }
  } finally {
    sharedSource.cleanup?.();
  }
  if (targetContext?.targetCollection && targetContext?.targetId && activeVariantKey) {
    const activeRender = rendered.find((entry) => entry.variant.key === activeVariantKey);
    if (activeRender) await attachMediaAssetToTarget(activeRender.derivedAsset, targetContext);
  }
  return { rendered, errors };
}

function wireMediaCropMask() {
  const stage = document.querySelector("[data-media-crop-stage]");
  const image = document.querySelector("[data-media-crop-image]");
  const scaleInput = document.querySelector("[data-media-crop-scale]");
  const scaleValue = document.querySelector("[data-media-crop-scale-value]");
  const xInput = document.querySelector("[data-media-crop-x]");
  const yInput = document.querySelector("[data-media-crop-y]");
  const reset = document.querySelector("[data-media-crop-reset]");
  const apply = document.querySelector("[data-media-crop-apply]");
  const coverButton = document.querySelector("[data-media-crop-cover]");
  const centerButton = document.querySelector("[data-media-crop-center]");
  const renderVariantsButton = document.querySelector("[data-media-render-variants]");
  const zoomLabel = document.querySelector("[data-media-zoom-label]");
  const targetSizeLabel = document.querySelector("[data-media-target-size]");
  const sourceSizeLabel = document.querySelector("[data-media-source-size]");
  const form = document.querySelector("[data-media-edit-form]");
  const variantSelect = form?.querySelector("[data-media-active-variant]");
  if (!stage || !image || !scaleInput || !scaleValue || !xInput || !yInput || stage.dataset.mediaCropWired === "1") return;
  stage.dataset.mediaCropWired = "1";
  const variantButtons = Array.from(document.querySelectorAll("[data-media-variant-button]"));
  const result = form?.querySelector("#media-edit-result");
  const neutralValues = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, black_white: false };
  const minCropScale = Number(scaleInput.min || 0.2) || 0.2;
  const state = {
    x: 0,
    y: 0,
    scale: 1,
    format: form?.dataset.activeVariantFormat || form?.dataset.mediaAspect || "16x9",
    activeVariantKey: variantSelect?.value || form?.dataset.activeVariantKey || "news_desktop",
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  };
  let variantRecords = [];
  let assetRecord = null;
  let imageNatural = { width: 0, height: 0 };
  const render = () => {
    state.scale = Math.max(minCropScale, Number(state.scale || 1));
    image.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    const brightness = 1 + (Number(form?.elements.brightness?.value || 0) / 100);
    const contrast = 1 + (Number(form?.elements.contrast?.value || 0) / 100);
    const saturation = 1 + (Number(form?.elements.saturation?.value || 0) / 100);
    const sharpness = Number(form?.elements.sharpness?.value || 0);
    const grayscale = form?.elements.black_white?.checked ? " grayscale(1)" : "";
    image.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})${grayscale}`;
    stage.style.setProperty("--media-crop-sharpness", `${Math.min(.28, sharpness / 80)}px`);
    scaleInput.value = String(state.scale);
    scaleValue.value = String(state.scale);
    xInput.value = String(Math.round(state.x));
    yInput.value = String(Math.round(state.y));
    if (zoomLabel) zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  };
  const stageSize = () => {
    const rect = stage.getBoundingClientRect();
    return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
  };
  const currentAdjustments = () => ({
    brightness: Number(form?.elements.brightness?.value || 0),
    contrast: Number(form?.elements.contrast?.value || 0),
    saturation: Number(form?.elements.saturation?.value || 0),
    sharpness: Number(form?.elements.sharpness?.value || 0),
    black_white: Boolean(form?.elements.black_white?.checked)
  });
  const currentVariant = () => mediaVariantDefinition(state.activeVariantKey, assetRecord || {});
  const editorSourceCandidates = () => [
    image?.dataset.mediaPreviewSrc,
    image?.dataset.mediaEditorSrc,
    form?.dataset.mediaPreviewSrc,
    form?.dataset.mediaEditorSrc,
    image?.currentSrc,
    image?.src
  ].filter(Boolean);
  const syncStagePreviewSize = () => {
    const variant = currentVariant();
    const preview = mediaStagePreviewSize(variant.width, variant.height);
    stage.style.setProperty("--media-stage-preview-width", `${preview.width}px`);
    if (targetSizeLabel) targetSizeLabel.textContent = `Zielrahmen: ${variant.width} x ${variant.height}px`;
    const sourceWidth = imageNatural.width || image.naturalWidth || assetRecord?.image_width || 0;
    const sourceHeight = imageNatural.height || image.naturalHeight || assetRecord?.image_height || 0;
    if (sourceSizeLabel) sourceSizeLabel.textContent = sourceWidth && sourceHeight ? `Original: ${sourceWidth} x ${sourceHeight}px` : "Original: wird geladen";
  };
  const syncVariantAspect = () => {
    const variant = currentVariant();
    state.format = variant.aspect;
    form.dataset.activeVariantFormat = variant.aspect;
    form.dataset.activeVariantKey = variant.key;
    stage.style.setProperty("--media-crop-aspect", mediaVariantAspectCss(variant.key, assetRecord || {}));
    syncStagePreviewSize();
    if (variantSelect) variantSelect.value = variant.key;
  };
  const applyCrop = () => {
    xInput.value = String(Math.round(state.x));
    yInput.value = String(Math.round(state.y));
    scaleValue.value = String(state.scale);
    apply?.classList.add("is-applied");
    if (apply) apply.textContent = "Uebernommen";
  };
  const markDirty = () => {
    if (form) form.dataset.mediaCropDirty = "1";
    apply?.classList.remove("is-applied");
    if (apply) apply.textContent = "OK uebernehmen";
  };
  const imageAspect = () => Math.max(1, image.naturalWidth || 1) / Math.max(1, image.naturalHeight || 1);
  const stageAspect = () => {
    const size = stageSize();
    return size.width / size.height;
  };
  const coverScaleForStage = () => {
    const currentImageAspect = imageAspect();
    const currentStageAspect = stageAspect();
    if (!currentImageAspect || !currentStageAspect) return 1;
    return currentImageAspect > currentStageAspect
      ? currentImageAspect / currentStageAspect
      : currentStageAspect / currentImageAspect;
  };
  const fillCropFrame = ({ dirty = true } = {}) => {
    state.x = 0;
    state.y = 0;
    state.scale = Math.max(1, coverScaleForStage());
    if (dirty) markDirty();
    render();
  };
  const centerCrop = ({ dirty = true } = {}) => {
    state.x = 0;
    state.y = 0;
    if (dirty) markDirty();
    render();
  };
  const currentCropData = () => {
    const variant = currentVariant();
    const size = stageSize();
    return mediaCropDataFromEditorState({
      variant,
      stageWidth: size.width,
      stageHeight: size.height,
      sourceWidth: imageNatural.width || image.naturalWidth || assetRecord?.image_width || variant.width,
      sourceHeight: imageNatural.height || image.naturalHeight || assetRecord?.image_height || variant.height,
      zoomFactor: state.scale,
      offsetX: state.x,
      offsetY: state.y,
      adjustments: currentAdjustments()
    });
  };
  const applyCropDataToStage = (cropData = null) => {
    const variant = currentVariant();
    const effective = cropData || mediaDefaultCropData({
      ...assetRecord,
      image_width: imageNatural.width || assetRecord?.image_width || variant.width,
      image_height: imageNatural.height || assetRecord?.image_height || variant.height
    }, variant.key);
    const size = stageSize();
    state.scale = Number(effective.zoomFactor || 1);
    state.x = Number(effective.offsetXRatio || 0) * size.width;
    state.y = Number(effective.offsetYRatio || 0) * size.height;
    if (form?.elements.brightness) form.elements.brightness.value = effective.brightness ?? neutralValues.brightness;
    if (form?.elements.contrast) form.elements.contrast.value = effective.contrast ?? neutralValues.contrast;
    if (form?.elements.saturation) form.elements.saturation.value = effective.saturation ?? neutralValues.saturation;
    if (form?.elements.sharpness) form.elements.sharpness.value = effective.sharpness ?? neutralValues.sharpness;
    if (form?.elements.black_white) form.elements.black_white.checked = Boolean(effective.black_white);
    render();
    applyCrop();
  };
  const setAspect = (control) => {
    if (!control) return;
    const format = control.dataset.mediaVariantFormat || "16x9";
    const quickMap = { "16x9": "news_desktop", "3x2": "thumbnail", "9x16": "news_mobile", "1x1": "square", logo: "sponsor_logo" };
    state.activeVariantKey = quickMap[format] || state.activeVariantKey;
    syncVariantAspect();
    variantButtons.forEach((button) => {
      const active = button === control;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    fillCropFrame({ dirty: false });
    applyCrop();
  };
  const loadVariantState = async (key = "") => {
    state.activeVariantKey = key || state.activeVariantKey;
    syncVariantAspect();
    if (!assetRecord?.id) return;
    variantRecords = variantRecords.length ? variantRecords : await ensureAssetVariantRecords(assetRecord);
    const record = variantCropRecordByKey(variantRecords, state.activeVariantKey);
    applyCropDataToStage(record?.crop_data || mediaDefaultCropData(assetRecord, state.activeVariantKey));
  };
  const loadVariantPreview = async (control) => {
    const key = control?.dataset.mediaLoadVariantKey || control?.dataset.mediaVariantKey || "";
    await loadVariantState(key || state.activeVariantKey);
    document.querySelectorAll("[data-media-load-variant]").forEach((button) => {
      const active = button === control;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };
  const renderVariantAction = async (mode = "active") => {
    applyCrop();
    assetRecord = assetRecord || await getOne("media_assets", form.dataset.mediaId);
    if (!assetRecord) return;
    const values = formObject(form);
    const cropData = currentCropData();
    const targetContext = mediaContextFromNode(form);
    const runMode = mode === "active" ? "all" : mode;
    const activeKey = mode === "active" ? state.activeVariantKey : "";
    const { rendered, errors } = await generateAssetVariants(assetRecord, {
      mode: runMode,
      activeVariantKey: activeKey,
      cropData,
      result,
      targetContext,
      sourceCandidates: editorSourceCandidates()
    });
    variantRecords = await ensureAssetVariantRecords(assetRecord);
    if (result) {
      if (errors.length) {
        result.innerHTML = `<div class="alert alert--warning">${rendered.length} Variante(n) gerendert. Fehler: ${escapeHtml(errors.join(" | "))}</div>`;
      } else {
        result.innerHTML = `<div class="alert alert--success">${rendered.length || (mode === "missing" ? 0 : 1)} Variante(n) aus dem Originalbild gerendert.</div>`;
      }
    }
    const activeDerived = rendered.find((entry) => entry.variant.key === state.activeVariantKey)?.derivedAsset;
    if (targetContext.targetCollection && targetContext.targetId && activeDerived && targetContext.returnTo) {
      window.setTimeout(() => { window.location.hash = targetContext.returnTo.replace(/^#\/?/, "#/"); }, 700);
    }
    const update = {
      ...assetRecord,
      title: values.title || assetRecord.title,
      alt_text: values.alt_text || assetRecord.alt_text || "",
      description: values.description || assetRecord.description || "",
      crop_x: cropData.cropX,
      crop_y: cropData.cropY,
      crop_scale: cropData.zoomFactor,
      crop_data: cropData,
      brightness: cropData.brightness,
      contrast: cropData.contrast,
      saturation: cropData.saturation,
      sharpness: cropData.sharpness,
      black_white: cropData.black_white,
      updated_at: new Date().toISOString()
    };
    assetRecord = await upsert("media_assets", update);
    delete form.dataset.mediaCropDirty;
    applyCrop();
  };
  const refreshAssetContext = async () => {
    assetRecord = await getOne("media_assets", form.dataset.mediaId);
    if (!assetRecord) return;
    const fallbackSource = editorSourceCandidates()[0] || "";
    if (fallbackSource) {
      assetRecord = {
        ...assetRecord,
        file_path_original_url: assetRecord.file_path_original_url || fallbackSource,
        file_path_web_url: assetRecord.file_path_web_url || fallbackSource,
        file_path_thumb_url: assetRecord.file_path_thumb_url || fallbackSource
      };
    }
    variantRecords = await ensureAssetVariantRecords(assetRecord);
    state.activeVariantKey = variantSelect?.value || mediaDefaultVariantKey(assetRecord);
    syncVariantAspect();
  };
  stage.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    state.x = state.originX + event.clientX - state.startX;
    state.y = state.originY + event.clientY - state.startY;
    markDirty();
    render();
  });
  const stop = () => { state.dragging = false; };
  stage.addEventListener("pointerup", stop);
  stage.addEventListener("pointerleave", stop);
  scaleInput.addEventListener("input", () => {
    state.scale = Math.max(minCropScale, Number(scaleInput.value || 1));
    markDirty();
    render();
  });
  document.querySelectorAll("[data-media-zoom-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scale = Math.max(minCropScale, Math.min(Number(scaleInput.max || 4), state.scale + Number(button.dataset.mediaZoomStep || 0)));
      markDirty();
      render();
    });
  });
  coverButton?.addEventListener("click", () => fillCropFrame());
  centerButton?.addEventListener("click", () => centerCrop());
  variantButtons.forEach((button) => button.addEventListener("click", () => setAspect(button)));
  document.querySelectorAll("[data-media-load-variant]").forEach((button) => {
    button.addEventListener("click", () => loadVariantPreview(button));
  });
  variantSelect?.addEventListener("change", async () => {
    await loadVariantState(variantSelect.value || state.activeVariantKey);
  });
  apply?.addEventListener("click", async () => {
    setaveButtonFeedback(apply, "saving", "peichere ...");
    try {
      await renderVariantAction("active");
      setaveButtonFeedback(apply, "success", "Gespeichert");
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Variante konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
      setaveButtonFeedback(apply, "error", "Fehler");
    } finally {
      if (!apply.classList.contains("is-save-success") && !apply.classList.contains("is-save-error")) apply.disabled = false;
    }
  });
  renderVariantsButton?.addEventListener("click", async () => {
    setaveButtonFeedback(renderVariantsButton, "saving", "rendere ...");
    try {
      await renderVariantAction("missing");
      setaveButtonFeedback(renderVariantsButton, "success", "Fertig");
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Varianten konnten nicht erzeugt werden: ${escapeHtml(error.message || String(error))}</div>`;
      setaveButtonFeedback(renderVariantsButton, "error", "Fehler");
    }
  });
  reset?.addEventListener("click", () => {
    fillCropFrame({ dirty: false });
    ["brightness", "contrast", "saturation", "sharpness"].forEach((name) => {
      if (form?.elements[name]) form.elements[name].value = neutralValues[name];
    });
    if (form?.elements.black_white) form.elements.black_white.checked = false;
    render();
    xInput.value = "0";
    yInput.value = "0";
    scaleValue.value = "1";
    markDirty();
  });
  ["brightness", "contrast", "saturation", "sharpness", "black_white"].forEach((name) => {
    form?.elements[name]?.addEventListener("input", () => {
      markDirty();
      render();
    });
    form?.elements[name]?.addEventListener("change", () => {
      markDirty();
      render();
    });
  });
  const activeButton = variantButtons.find((button) => button.classList.contains("is-active"));
  if (activeButton) {
    setAspect(activeButton);
  } else {
    syncVariantAspect();
  }
  image.addEventListener("load", () => {
    imageNatural = { width: image.naturalWidth || 0, height: image.naturalHeight || 0 };
    syncStagePreviewSize();
    loadVariantState(state.activeVariantKey).catch((error) => {
      console.warn("Variant state load failed", error);
      fillCropFrame({ dirty: false });
      applyCrop();
    });
  });
  refreshAssetContext().then(() => {
    imageNatural = { width: image.naturalWidth || 0, height: image.naturalHeight || 0 };
    syncVariantAspect();
    syncStagePreviewSize();
    render();
    loadVariantState(state.activeVariantKey).catch(() => {
      fillCropFrame({ dirty: false });
      applyCrop();
    });
  }).catch(() => {
    render();
    applyCrop();
  });
}

function wireMediaDelete() {
  document.querySelectorAll("[data-media-delete]").forEach((button) => {
    if (button.dataset.mediaDeleteWired === "1") return;
    button.dataset.mediaDeleteWired = "1";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const assetId = button.dataset.mediaDelete;
      const title = button.dataset.mediaTitle || "Bild";
      if (!assetId) return;
      const permanent = button.dataset.mediaDeleteMode === "permanent";
      if (!window.confirm(permanent ? `Bild "${title}" endgueltig loeschen?` : `Bild "${title}" in den Papierkorb verschieben?`)) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "...";
      try {
        const asset = await getOne("media_assets", assetId);
        if (!asset) throw new Error("Bild wurde nicht gefunden.");
        if (permanent) {
          await deleteMediaAssetCascade(asset);
        } else {
          await archiveMediaAssetCascade(asset);
        }
        const card = button.closest("[data-media-card]");
        if (card) card.remove();
      } catch (error) {
        window.alert(`Papierkorb fehlgeschlagen: ${error.message || String(error)}`);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

async function relatedMediaVariantBundle(asset = {}) {
  const assetId = asset?.parent_media_asset_id || asset?.id || "";
  if (!assetId) return { rootId: "", childAssets: [], variantRecords: [] };
  const [assets, variants] = await Promise.all([
    list("media_assets").catch(() => []),
    list("media_variants").catch(() => [])
  ]);
  const variantRecords = variants.filter((variant) => variant.media_asset_id === assetId || variant.derived_media_asset_id === asset.id);
  const derivedIds = new Set(variantRecords.map((variant) => variant.derived_media_asset_id).filter(Boolean));
  const childAssets = assets.filter((item) => item.parent_media_asset_id === assetId || derivedIds.has(item.id));
  return { rootId: assetId, childAssets, variantRecords };
}

async function archiveMediaAssetCascade(asset = {}) {
  const now = new Date().toISOString();
  const archivePatch = (item) => ({
    ...item,
    status: "archived",
    deleted_at: now,
    trash_status: "paperkorb",
    updatedAt: now,
    updated_at: now
  });
  const { childAssets, variantRecords } = await relatedMediaVariantBundle(asset);
  await upsert("media_assets", archivePatch(asset));
  await Promise.all(childAssets.filter((item) => item.id !== asset.id).map((item) => upsert("media_assets", archivePatch(item))));
  await Promise.all(variantRecords.map((variant) => upsert("media_variants", {
    ...variant,
    render_status: "archived",
    updated_at: now
  })));
}

async function deleteMediaAssetCascade(asset = {}) {
  const { rootId, childAssets, variantRecords } = await relatedMediaVariantBundle(asset);
  const assetsToDelete = [asset, ...childAssets].filter((item, index, items) => item?.id && items.findIndex((candidate) => candidate.id === item.id) === index);
  for (const item of assetsToDelete) {
    await deleteStoredAsset(item);
    await remove("media_assets", item.id);
  }
  const variantIds = new Set([
    ...variantRecords.map((variant) => variant.id),
    ...variantRecords.filter((variant) => variant.media_asset_id === rootId).map((variant) => variant.id)
  ].filter(Boolean));
  await Promise.all([...variantIds].map((id) => remove("media_variants", id)));
}

function wireMediaRestore() {
  document.querySelectorAll("[data-media-restore]").forEach((button) => {
    if (button.dataset.mediaRestoreWired === "1") return;
    button.dataset.mediaRestoreWired = "1";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const assetId = button.dataset.mediaRestore;
      const title = button.dataset.mediaTitle || "Bild";
      const result = document.querySelector("#media-trash-result");
      if (!assetId) return;
      if (!window.confirm(`Bild "${title}" wiederherstellen?`)) return;
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Bild wird wiederhergestellt...</div>`;
      try {
        const asset = await getOne("media_assets", assetId);
        if (!asset) throw new Error("Bild wurde nicht gefunden.");
        await restoreMediaAssetCascade(asset);
        const row = button.closest("[data-media-card]");
        if (row) row.remove();
        if (result) result.innerHTML = `<div class="alert alert--success">Bild wurde wiederhergestellt.</div>`;
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Wiederherstellen fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  });
}

function wireArchiveMarkedMediaAssets() {
  const button = document.querySelector("[data-archive-marked-media-assets]");
  if (!button || button.dataset.archiveMarkedMediaWired === "1") return;
  button.dataset.archiveMarkedMediaWired = "1";
  button.addEventListener("click", async () => {
    const result = document.querySelector("#media-archive-marked-result");
    const cards = Array.from(document.querySelectorAll(".media-asset-card--duplicate-logo, .media-asset-card--former-logo"));
    const ids = [...new Set(cards.map((card) => card.querySelector("[data-media-delete]")?.dataset.mediaDelete || card.dataset.mediaEditLink?.match(/id=([^&]+)/)?.[1] || "").map((id) => decodeURIComponent(id)).filter(Boolean))];
    if (!ids.length) {
      if (result) result.innerHTML = `<div class="alert">Keine markierten Logos fuer den Papierkorb gefunden.</div>`;
      return;
    }
    if (!window.confirm(`${ids.length} markierte Logo-Datei${ids.length === 1 ? "" : "en"} in den Papierkorb verschieben?`)) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Verschiebe ...";
    if (result) result.innerHTML = `<div class="alert">Markierte Logos werden in den Papierkorb verschoben ...</div>`;
    try {
      let done = 0;
      for (const id of ids) {
        const asset = await getOne("media_assets", id);
        if (asset) {
          await archiveMediaAssetCascade(asset);
          done += 1;
        }
      }
      if (result) result.innerHTML = `<div class="alert alert--success">${done} Logo-Datei${done === 1 ? "" : "en"} in den Papierkorb verschoben.</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Papierkorb fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
}

function wireMediaTypeUpdates() {
  document.querySelectorAll("[data-media-type-update]").forEach((select) => {
    if (select.dataset.mediaTypeWired === "1") return;
    select.dataset.mediaTypeWired = "1";
    select.addEventListener("change", async () => {
      const assetId = select.dataset.mediaTypeUpdate;
      if (!assetId) return;
      const nextType = normalizedMediaType(select.value || "upload");
      const presetFields = mediaPresetFields(nextType);
      select.disabled = true;
      try {
        const asset = await getOne("media_assets", assetId);
        if (!asset) throw new Error("Bild wurde nicht gefunden.");
        await upsert("media_assets", {
          ...asset,
          media_type: nextType,
          ...presetFields,
          updated_at: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        const card = select.closest("[data-media-card]");
        if (card) card.dataset.type = nextType;
        const usage = card?.querySelector(".media-asset-card__usage");
        const metaType = card?.querySelector(".media-asset-card__meta span:not(.media-code)");
        const label = select.options[select.selectedIndex]?.textContent || nextType;
        if (usage && usage.textContent.startsWith("Zuordnung:")) usage.textContent = `Zuordnung: ${label}`;
        if (metaType) metaType.textContent = label;
        const presetHint = card?.querySelector(".media-preset-hint");
        if (presetHint) presetHint.textContent = mediaPresetSummary(nextType);
        const formatBadge = card?.querySelector(".media-asset-card__meta span:nth-child(3)");
        if (formatBadge) formatBadge.textContent = presetFields.aspect_ratio;
      } catch (error) {
        window.alert(`Zuordnung konnte nicht gespeichert werden: ${error.message || String(error)}`);
      } finally {
        select.disabled = false;
      }
    });
  });
}

function wireMediaourceUpdates() {
  document.querySelectorAll("[data-media-source-update]").forEach((select) => {
    if (select.dataset.mediaourceWired === "1") return;
    select.dataset.mediaourceWired = "1";
    select.addEventListener("change", async () => {
      const assetId = select.dataset.mediaourceUpdate;
      if (!assetId) return;
      const nextource = select.value || "upload";
      select.disabled = true;
      try {
        const asset = await getOne("media_assets", assetId);
        if (!asset) throw new Error("Bild wurde nicht gefunden.");
        await upsert("media_assets", {
          ...asset,
          source_type: nextource,
          updated_at: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        const card = select.closest("[data-media-card]");
        if (card) card.dataset.source = nextource;
        const sourceRow = Array.from(card?.querySelectorAll(".media-card-info-table div") || [])
          .find((row) => row.querySelector("dt")?.textContent?.trim().toLowerCase() === "quelle");
        const label = select.options[select.selectedIndex]?.textContent || nextource;
        const dd = sourceRow?.querySelector("dd");
        if (dd) dd.textContent = label;
      } catch (error) {
        window.alert(`Quelle konnte nicht gespeichert werden: ${error.message || String(error)}`);
      } finally {
        select.disabled = false;
      }
    });
  });
}

function wireMediaFullscreenViewer() {
  document.querySelectorAll("[data-media-fullscreen-open]").forEach((button) => {
    if (button.dataset.mediaFullscreenWired === "1") return;
    button.dataset.mediaFullscreenWired = "1";
    button.addEventListener("click", () => {
      const src = button.dataset.mediaFullscreenSrc || "";
      if (!src) return;
      const alt = button.dataset.mediaFullscreenAlt || "Medienbild";
      const viewer = document.createElement("div");
      viewer.className = "media-fullscreen-viewer";
      viewer.innerHTML = `<button class="media-fullscreen-close" type="button" aria-label="Schliessen">&times;</button><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
      const close = () => viewer.remove();
      viewer.addEventListener("click", (event) => {
        if (event.target === viewer || event.target.closest(".media-fullscreen-close")) close();
      });
      document.addEventListener("keydown", function onKey(event) {
        if (event.key !== "Escape") return;
        document.removeEventListener("keydown", onKey);
        close();
      });
      document.body.appendChild(viewer);
      viewer.querySelector(".media-fullscreen-close")?.focus();
    });
  });
}

function editorialPreviewParagraphs(value = "") {
  const blocks = String(value || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return `<p class="muted">Noch kein Haupttext vorhanden.</p>`;
  return blocks.map((block) => {
    const clean = block.replace(/\n/g, "<br>");
    if (block.length <= 90 && !/[.!?]$/.test(block)) {
      return `<h3>${escapeHtml(block)}</h3>`;
    }
    return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}


function editorialPreviewVideoId(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const direct = text.match(/^[a-zA-Z0-9_-]{8,}$/);
  if (direct && !text.includes("/") && !text.includes(".")) return text;
  try {
    const url = new URL(text);
    if (url.hostname.includes("youtu.be")) return url.pathname.split("/").filter(Boolean)[0] || "";
    if (url.searchParams.get("v")) return url.searchParams.get("v") || "";
    const embedMatch = url.pathname.match(/\/(?:embed|shorts)\/([^/?#]+)/);
    return embedMatch?.[1] || "";
  } catch {
    const match = text.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{8,})/);
    return match?.[1] || "";
  }
}

function editorialPreviewVideos(form) {
  const rows = Array.from(form.querySelectorAll("[data-video-attachment-row]"));
  const videos = rows.map((row, index) => {
    const get = (prefix) => row.querySelector(`[name="${prefix}${index}"]`)?.value || "";
    const youtubeValue = get("videoYoutubeUrl");
    const youtubeVideoId = editorialPreviewVideoId(youtubeValue);
    const title = get("videoTitle") || "Video";
    const poster = get("videoPosterImageUrl") || (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "");
    return { youtubeVideoId, youtubeValue, title, poster };
  }).filter((video) => video.youtubeVideoId || video.youtubeValue || video.title !== "Video");
  if (!videos.length) return "";
  return `<section class="editorial-preview-video-hero" aria-label="Video">${videos.slice(0, 1).map((video) => {
    const title = video.title || "Video abspielen";
    const iframe = video.youtubeVideoId ? `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(video.youtubeVideoId)}?enablejsapi=1&rel=0&fs=1" title="${escapeHtml(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen tabindex="-1"></iframe>` : "";
    return `<div class="article-video-poster editorial-preview-video-poster" data-youtube-video="${escapeHtml(video.youtubeVideoId)}" data-youtube-title="${escapeHtml(title)}" role="button" tabindex="0" aria-label="${escapeHtml(`${title} abspielen`)}">${video.poster ? `<img src="${escapeHtml(video.poster)}" alt="${escapeHtml(title)}">` : ""}${iframe}<span class="article-video-play" aria-hidden="true"></span><small>Mit Klick wird das Video gestartet.</small></div><h3>${escapeHtml(title)}</h3>`;
  }).join("")}</section>`;
}

function editorialPreviewSources(form) {
  const raw = form.querySelector('[name="source_snapshot_json_text"]')?.value || "";
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean).slice(0, 5);
  } catch {
    return raw.split(/\n+/).map((line) => ({ title: line.trim() })).filter((source) => source.title).slice(0, 5);
  }
}

function editorialPreviewChips(value = "") {
  return String(value || "")
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function openEditorialPreviewLayer(form) {
  const values = formObject(form);
  const title = values.title || values.titel || "Redaktioneller Beitrag";
  const subtitle = values.subtitle || values.subline || "";
  const intro = values.introText || values.shortDescription || values.kurztext || "";
  const body = values.bodyText || values.longDescription || values.langtext || "";
  const category = values.category || values.page || "Redaktion";
  const date = values.publishDate || values.validFrom || "";
  const imageUrl = form.querySelector("[data-image-preview] img")?.getAttribute("src") || "";
  const videoPreview = editorialPreviewVideos(form);
  const isNewsPreview = values.page === "news" || values.section === "news";
  const sources = editorialPreviewSources(form);
  const tags = editorialPreviewChips(values.tags || values.seoKeywords || "");
  const galleryLabel = form.querySelector('[name="galleryId"] option:checked')?.textContent?.trim() || "";
  const documentLabel = form.querySelector('[name="downloadId"] option:checked')?.textContent?.trim() || "";
  const hasGallery = Boolean(values.galleryId);
  const hasDocument = Boolean(values.downloadId || values.documentId || values.documentUrl);
  const previewHeaderHtml = isNewsPreview
    ? (imageUrl ? `<figure class="editorial-preview-news-hero"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}"><figcaption><p class="eyebrow">${escapeHtml(category)}${date ? ` / ${escapeHtml(date)}` : ""}</p><h1>${escapeHtml(title)}</h1></figcaption></figure>` : `<div class="editorial-preview-news-head"><p class="eyebrow">${escapeHtml(category)}${date ? ` / ${escapeHtml(date)}` : ""}</p><h1>${escapeHtml(title)}</h1></div>`)
    : (imageUrl ? `<figure class="editorial-preview-hero"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}"><figcaption><p class="eyebrow">${escapeHtml(category)}${date ? ` / ${escapeHtml(date)}` : ""}</p><h1>${escapeHtml(title)}</h1></figcaption></figure>` : `<p class="eyebrow">${escapeHtml(category)}${date ? ` / ${escapeHtml(date)}` : ""}</p><h1>${escapeHtml(title)}</h1>`);
  document.querySelector(".editorial-preview-backdrop")?.remove();
  const wrapper = document.createElement("div");
  wrapper.className = "editorial-preview-backdrop";
  wrapper.innerHTML = `<div class="editorial-preview-layer ${isNewsPreview ? "editorial-preview-layer--news" : ""}" role="dialog" aria-modal="true" aria-label="Redaktionelle Vorschau">
    <div class="editorial-preview-top">
      <div><p class="eyebrow">Vorschau</p><h2>${escapeHtml(title)}</h2></div>
      <button type="button" class="link-button" data-editorial-preview-close>Schliessen</button>
    </div>
    <article class="editorial-preview-article ${isNewsPreview ? "editorial-preview-article--news" : ""}">
      ${isNewsPreview ? `<div class="editorial-preview-news-grid"><section class="editorial-preview-news-main">` : ""}
      ${videoPreview}
      ${previewHeaderHtml}
      ${subtitle ? `<p class="editorial-preview-subline">${escapeHtml(subtitle)}</p>` : ""}
      ${intro ? `<p class="editorial-preview-intro">${escapeHtml(intro)}</p>` : ""}
      <div class="editorial-preview-body">${editorialPreviewParagraphs(body)}</div>
      ${isNewsPreview ? `</section><aside class="editorial-preview-side">
        <section>
          <p class="eyebrow">Status</p>
          <dl class="editorial-preview-meta-list">
            <div><dt>Rubrik</dt><dd>${escapeHtml(category || "-")}</dd></div>
            <div><dt>Datum</dt><dd>${escapeHtml(date || "-")}</dd></div>
            <div><dt>Sichtbar</dt><dd>${escapeHtml(values.visibility || "-")}</dd></div>
            <div><dt>Status</dt><dd>${escapeHtml(values.status || "-")}</dd></div>
          </dl>
        </section>
        <section>
          <p class="eyebrow">Quellen</p>
          ${sources.length ? `<ul class="editorial-preview-source-list">${sources.map((source) => {
            const label = source.publisher || source.source || source.title || source.name || source.domain || source.url || "Quelle";
            const url = source.url || source.original_url || source.originalUrl || "";
            return `<li><strong>${escapeHtml(label)}</strong>${url ? `<small>${escapeHtml(url)}</small>` : ""}</li>`;
          }).join("")}</ul>` : `<p class="muted">Keine Quellen im Editor hinterlegt.</p>`}
        </section>
        <section>
          <p class="eyebrow">Assets</p>
          <div class="editorial-preview-asset-list">
            <span class="${imageUrl ? "is-ready" : ""}">Bild ${imageUrl ? "vorhanden" : "fehlt"}</span>
            <span class="${hasGallery ? "is-ready" : ""}">Galerie ${hasGallery ? escapeHtml(galleryLabel) : "nicht verknuepft"}</span>
            <span class="${hasDocument ? "is-ready" : ""}">PDF ${hasDocument ? escapeHtml(documentLabel) : "nicht verknuepft"}</span>
          </div>
        </section>
        ${tags.length ? `<section><p class="eyebrow">Keywords</p><div class="editorial-preview-chip-list">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div></section>` : ""}
      </aside></div>` : ""}
    </article>
  </div>`;
  document.body.append(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelectorAll("[data-editorial-preview-close]").forEach((button) => button.addEventListener("click", close));
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper) close();
  });
  wireArticleVideos();
  wrapper.querySelector("[data-editorial-preview-close]")?.focus();
}

function internalPreviewLabel(record = {}) {
  if (record.bereich === "ueber_uns" || record.page === "about") return "Ãœber uns";
  if (record.bereich === "mitglied_werden" || record.page === "join") return "Mitglied werden";
  if (record.section === "footer") return "Footer";
  if (record.section === "legal" || ["imprint", "privacy", "legal"].includes(record.page)) return "Rechtliches";
  return "Interna";
}

function openInternalPreviewLayer(record = {}) {
  const title = record.titel || record.title || record.headline || record.id || "Interna-Block";
  const intro = record.kurztext || record.introText || record.subtitle || "";
  const body = record.langtext || record.bodyText || record.articleText || record.text || "";
  const type = record.typ || record.type || record.section || "-";
  const statusLabel = record.status || record.visibility || record.sichtbarkeit || "-";
  document.querySelector(".editorial-preview-backdrop")?.remove();
  const wrapper = document.createElement("div");
  wrapper.className = "editorial-preview-backdrop";
  wrapper.innerHTML = `<div class="editorial-preview-layer editorial-preview-layer--internal" role="dialog" aria-modal="true" aria-label="Interna Vorschau">
    <div class="editorial-preview-top">
      <div><p class="eyebrow">Vorschau</p><h2>${escapeHtml(title)}</h2></div>
      <button type="button" class="link-button" data-editorial-preview-close>Schliessen</button>
    </div>
    <article class="editorial-preview-article editorial-preview-article--internal">
      <p class="eyebrow">${escapeHtml(internalPreviewLabel(record))}</p>
      <h1>${escapeHtml(title)}</h1>
      <dl class="internal-preview-meta">
        <div><dt>Typ</dt><dd>${escapeHtml(type)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(statusLabel)}</dd></div>
        <div><dt>Sortierung</dt><dd>${escapeHtml(String(record.sortOrder ?? record.sortierung ?? "-"))}</dd></div>
      </dl>
      ${intro ? `<p class="editorial-preview-intro">${escapeHtml(intro)}</p>` : ""}
      <div class="editorial-preview-body">${editorialPreviewParagraphs(body)}</div>
      <div class="editorial-preview-actions"><a class="button button--secondary button--small" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(record.id)}&section=interna" data-editorial-preview-edit>Bearbeiten</a></div>
    </article>
  </div>`;
  document.body.append(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelectorAll("[data-editorial-preview-close]").forEach((button) => button.addEventListener("click", close));
  wrapper.querySelectorAll("[data-editorial-preview-edit]").forEach((link) => link.addEventListener("click", close));
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper) close();
  });
  document.addEventListener("keydown", function onKey(event) {
    if (event.key !== "Escape") return;
    document.removeEventListener("keydown", onKey);
    close();
  });
  wrapper.querySelector("[data-editorial-preview-close]")?.focus();
}

function wireEditorialPreviewLayer() {
  document.querySelectorAll("[data-editorial-preview-layer]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("form");
      if (form) openEditorialPreviewLayer(form);
    });
  });
  document.querySelectorAll("[data-internal-preview]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = await getOne("editorialContent", button.dataset.internalPreview).catch(() => null);
      if (record) openInternalPreviewLayer(record);
    });
  });
}

async function restoreMediaAssetCascade(asset = {}) {
  const now = new Date().toISOString();
  const restorePatch = (item) => ({
    ...item,
    status: item.restore_status || "ready",
    trash_status: "",
    trash_reason: "",
    deleted_at: "",
    archivedAt: "",
    updatedAt: now,
    updated_at: now
  });
  const { childAssets, variantRecords } = await relatedMediaVariantBundle(asset);
  await upsert("media_assets", restorePatch(asset));
  await Promise.all(childAssets.filter((item) => item.id !== asset.id).map((item) => upsert("media_assets", restorePatch(item))));
  await Promise.all(variantRecords.map((variant) => upsert("media_variants", {
    ...variant,
    render_status: variant.file_url || variant.derived_media_asset_id ? "rendered" : "pending",
    updated_at: now
  })));
}

function wireEditorialToolJumps() {
  document.querySelectorAll("[data-editor-tool-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.editorToolOpen || "";
      const panel = document.querySelector(`[data-editor-tool-panel="${target}"]`);
      if (!panel) return;
      panel.open = true;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        panel.querySelector("button, a, select, input, textarea")?.focus({ preventScroll: true });
      }, 180);
    });
  });
}

function wireStickyBoxWheel() {
  document.querySelectorAll(".internal-about-sticky, .join-aside").forEach((box) => {
    if (box.dataset.stickyWheelWired === "1") return;
    box.dataset.stickyWheelWired = "1";
    box.addEventListener("wheel", (event) => {
      const maxScroll = box.scrollHeight - box.clientHeight;
      if (maxScroll <= 1) {
        window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
        event.preventDefault();
        return;
      }
      const atTop = box.scrollTop <= 0;
      const atBottom = box.scrollTop >= maxScroll - 1;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
        event.preventDefault();
      }
    }, { passive: false });
  });
}

function wireQualityInspection() {
  const table = document.querySelector("[data-quality-table]");
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("[data-quality-row]"));
  const filterButtons = Array.from(document.querySelectorAll("[data-quality-filter]"));
  const sortSelect = document.querySelector("[data-quality-sort]");
  const storageKey = "pdt-quality-done-session";
  const readDone = () => {
    try { return new Set(JSON.parse(sessionStorage.getItem(storageKey) || "[]")); }
    catch { return new Set(); }
  };
  const writeDone = (done) => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(Array.from(done))); } catch {}
  };
  let activeFilter = "all";
  const rowValue = (row, name) => String(row.dataset[`quality${name}`] || "").toLowerCase();
  const updateStatusCells = () => {
    const done = readDone();
    rows.forEach((row) => {
      const key = row.dataset.qualityKey || "";
      const isDone = done.has(key);
      const cell = row.querySelector("[data-quality-status-cell]");
      if (!cell) return;
      cell.innerHTML = `<span class="status">${isDone ? "erledigt" : "offen"}</span> <button class="button button--secondary button--small" type="button" data-quality-toggle="${key}">${isDone ? "offen" : "erledigt"}</button>`;
    });
  };
  const rowMatches = (row) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "errors") return row.dataset.qualitySeverity === "error";
    if (activeFilter === "warnings") return row.dataset.qualitySeverity !== "error";
    if (activeFilter === "desktop") return row.dataset.qualityDesktop === "1";
    if (activeFilter === "mobile") return row.dataset.qualityMobile === "1";
    return row.dataset.qualityCategory === activeFilter;
  };
  const sortRows = () => {
    const mode = sortSelect?.value || "errors";
    const sorted = [...rows].sort((a, b) => {
      if (mode === "errors") return (a.dataset.qualitySeverity === "error" ? 0 : 1) - (b.dataset.qualitySeverity === "error" ? 0 : 1);
      if (mode === "warnings") return (a.dataset.qualitySeverity === "error" ? 1 : 0) - (b.dataset.qualitySeverity === "error" ? 1 : 0);
      if (mode === "checked") return String(b.dataset.qualityChecked || "").localeCompare(String(a.dataset.qualityChecked || ""));
      const key = mode === "area" ? "Area" : mode === "type" ? "Type" : "Title";
      return rowValue(a, key).localeCompare(rowValue(b, key), "de", { sensitivity: "base" });
    });
    sorted.forEach((row) => table.appendChild(row));
  };
  const apply = () => {
    rows.forEach((row) => { row.hidden = !rowMatches(row); });
    filterButtons.forEach((button) => button.classList.toggle("active", button.dataset.qualityFilter === activeFilter));
    sortRows();
    updateStatusCells();
  };
  filterButtons.forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.qualityFilter || "all";
    apply();
  }));
  sortSelect?.addEventListener("change", apply);
  table.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quality-toggle]");
    if (!button) return;
    const key = button.dataset.qualityToggle || "";
    const done = readDone();
    if (done.has(key)) done.delete(key);
    else done.add(key);
    writeDone(done);
    updateStatusCells();
  });
  apply();
}
function wireActions() {
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "night" ? "day" : "night";
    localStorage.setItem("pdtv-theme", next);
    localStorage.setItem("pdtTheme", next);
    applyTheme(next);
  });
  document.querySelector("[data-audio-area-filter]")?.addEventListener("change", (event) => applyAudioAreaFilter(event.currentTarget));
  document.querySelector("[data-audio-subarea-filter]")?.addEventListener("change", (event) => applyAudioAreaFilter(event.currentTarget));
  applyTheme();
  wirePublicMenu();
  wireFastMobileNavFeedback();
  wireAboutJumps();
  wireInternalScrollTop();
  wireJoinScroll();
  wireStickyRotators();
  wireStickyBoxWheel();
  wireMediaLibraryFilters();
  wireExistingThumbImport();
  wireMediaAutoClassify();
  wireArchiveMarkedMediaAssets();
  wireMediaCardLinks();
  wireCentralMediaUpload();
  wireMediaAiDraft();
  wireMediaEdit();
  wireMediaDelete();
  wireMediaRestore();
  wireMediaTypeUpdates();
  wireMediaourceUpdates();
  wireMediaFullscreenViewer();
  wireEditorialPreviewLayer();
  wireEditorialToolJumps();
  wireCmsMenu();
  wireImageDropzones();
  wireGalleryEditor();
  wireGalleryPlayers();
  wirePdfOverlays();
  wireVideoAttachmentEditor();
  wireArticleVideos();
  wireEditorGallerySelects();
  wireGalleryLinkSaves();
  wireLinkedMediaClears();
  wireQualityInspection();
  if (document.querySelector("#mail-admin-base-url")) {
    mailAdminConfig();
  }
  document.querySelector("[data-mail-admin-load]")?.addEventListener("click", async () => {
    const result = document.querySelector("#mail-admin-connection-result");
    try {
      await loadMailAdminData();
    } catch (error) {
      if (result) result.innerHTML = `<span class="alert alert--error" style="display:inline-block;margin:0">${escapeHtml(error.message || String(error))}</span>`;
    }
  });
  document.querySelector("#mail-accounts-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mail-account-edit]");
    if (!button) return;
    const account = (window.mailAdminAccounts || []).find((item) => item.id === button.dataset.mailAccountEdit);
    const form = document.querySelector("#mail-account-form");
    if (!account || !form) return;
    ["id", "label", "smtpHost", "smtpPort", "smtpUser", "fromEmail", "fromName"].forEach((field) => {
      if (form.elements[field]) form.elements[field].value = account[field] ?? "";
    });
    if (form.elements.smtpPass) {
      form.elements.smtpPass.value = "";
      form.elements.smtpPass.placeholder = account.hasPassword ? "Passwort bleibt gespeichert; nur bei Aenderung eintragen" : "Passwort eintragen";
    }
    form.querySelector("#mail-account-result").innerHTML = `<div class="alert">Account geladen. Das SMTP-Passwort wird aus Sicherheitsgruenden nicht angezeigt.</div>`;
  });
  document.querySelector("#mail-account-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#mail-account-result");
    const submitButton = form.querySelector('button[type="submit"], button');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Mailaccount wird gespeichert ...</div>`;
    try {
      let values = formObject(form);
      values = normalizeInternalEditorialValues(values);
      values.smtpPort = Number(values.smtpPort || 587);
      if (!values.smtpPass) delete values.smtpPass;
      await mailAdminRequest("/admin/accounts", { method: "POST", body: JSON.stringify(values) });
      form.reset();
      form.elements.smtpPort.value = "587";
      if (result) result.innerHTML = `<div class="alert alert--success">Mailaccount wurde gespeichert.</div>`;
      await loadMailAdminData();
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
  document.querySelector("#mail-template-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#mail-template-result");
    const submitButton = form.querySelector('button[type="submit"], button');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Template wird gespeichert ...</div>`;
    try {
      await mailAdminRequest("/admin/templates", { method: "POST", body: JSON.stringify(formObject(form)) });
      form.reset();
      if (result) result.innerHTML = `<div class="alert alert--success">Template wurde gespeichert.</div>`;
      await loadMailAdminData();
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
  document.querySelector("#mail-test-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#mail-test-result");
    const submitButton = form.querySelector('button[type="submit"], button');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Testmail wird gesendet ...</div>`;
    try {
      let values = formObject(form);
      values = normalizeInternalEditorialValues(values);
      const variables = values.variablesJson ? JSON.parse(values.variablesJson) : {};
      delete values.variablesJson;
      await mailAdminRequest("/send", { method: "POST", body: JSON.stringify({ ...values, variables }) });
      if (result) result.innerHTML = `<div class="alert alert--success">Testmail wurde gesendet.</div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Testversand fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
  document.querySelectorAll("[data-tts-play]").forEach((button) => {
    if (button.dataset.ttsWired === "1") return;
    button.dataset.ttsWired = "1";
    button.addEventListener("click", async () => {
      try {
        await startPublicTts(button);
      } catch (error) {
        alert(error.message || "Audio konnte nicht gestartet werden.");
      }
    });
  });
  document.querySelectorAll("[data-tts-toggle]").forEach((button) => {
    if (button.dataset.ttsToggleWired === "1") return;
    button.dataset.ttsToggleWired = "1";
    button.addEventListener("click", () => {
      const reader = button.closest("[data-tts-reader]");
      const actions = reader?.querySelector("[data-tts-actions]");
      if (!actions) return;
      const open = actions.hasAttribute("hidden");
      actions.toggleAttribute("hidden", !open);
      reader.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  document.querySelectorAll("[data-generate-article-speech]").forEach((button) => button.addEventListener("click", async () => {
    const scope = button.closest(".audio-list-cell, .audio-generation-panel");
    const result = scope?.querySelector("[data-speech-result]");
    const audioUrl = button.dataset.audioUrl || "";
    if (audioUrl && button.classList.contains("audio-play-button")) {
      const activeAudio = document.querySelector("audio[data-list-audio-player]");
      const activeButton = document.querySelector(".audio-play-button.is-playing");
      if (button.classList.contains("is-playing") && activeAudio) {
        activeAudio.pause();
        activeAudio.remove();
        button.classList.remove("is-playing");
        return;
      }
      stopAllAudioPlayback();
      const audio = document.createElement("audio");
      audio.dataset.listAudioPlayer = "1";
      audio.src = audioUrl;
      audio.hidden = true;
      document.body.append(audio);
      button.classList.add("is-playing");
      audio.addEventListener("ended", () => {
        button.classList.remove("is-playing");
        audio.remove();
      });
      audio.addEventListener("pause", () => {
        if (!audio.ended) button.classList.remove("is-playing");
      });
      await audio.play();
      return;
    }
    const isIconAudioButton = button.classList.contains("audio-play-button");
    const originalLabel = button.textContent;
    const originalAriaLabel = button.getAttribute("aria-label") || "";
    button.disabled = true;
    button.classList.add("is-generating");
    if (isIconAudioButton) button.setAttribute("aria-label", "Audio wird erzeugt");
    else button.textContent = "Audio wird erzeugt ...";
    const form = button.closest("form");
    setAudioGenerationProgress(scope, result, form ? "Aktuelle Texte werden zuerst gespeichert ..." : "Audio-Auftrag wird vorbereitet ...", 30);
    let generationItem = null;
    try {
      if (form?.matches("#topic-editor-form, #content-edit-form, #ai-article-edit-form")) {
        await submitFormAndWait(form);
        setAudioGenerationProgress(scope, result, "Texte gespeichert. Audio-Service startet ...", 45);
      }
      generationItem = await getOne(button.dataset.collection, button.dataset.recordId);
      if (generationItem) {
        await upsert(button.dataset.collection, { id: generationItem.id, ...audioStatusUpdate(button.dataset.collection, generationItem, "in_erstellung") });
        setAudioGenerationProgress(scope, result, "Audio wird serverseitig erzeugt. Bitte warten ...", 68);
      }
      const speech = await generateArticleSpeechAsset({ collection: button.dataset.collection, id: button.dataset.recordId, variant: button.dataset.ttsVariant || "all" });
      setAudioGenerationProgress(scope, result, "Audiodatei wurde erzeugt. Status wird aktualisiert ...", 88);
      const generatedItem = await getOne(button.dataset.collection, button.dataset.recordId);
      if (generatedItem) await upsert(button.dataset.collection, { id: generatedItem.id, ...audioStatusUpdate(button.dataset.collection, generatedItem, "aktuell"), audioGeneratedAt: new Date().toISOString() });
      const truncated = speech.truncated || Object.values(speech.variants || {}).some((item) => item.truncated);
      if (result) result.innerHTML = `<div class="alert alert--success">Audio-Varianten gespeichert.${truncated ? " Der Text wurde fuer die Sprachausgabe gekuerzt." : ""}</div>`;
      await render();
    } catch (error) {
      if (generationItem) await upsert(button.dataset.collection, { id: generationItem.id, ...audioStatusUpdate(button.dataset.collection, generationItem, "fehler"), audioErrorMessage: error.message || String(error), audioErrorAt: new Date().toISOString() });
      if (result) result.innerHTML = `<div class="alert alert--error">Audio konnte nicht erzeugt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      clearAudioGenerationProgress(scope);
      button.disabled = false;
      button.classList.remove("is-generating");
      if (isIconAudioButton) button.setAttribute("aria-label", originalAriaLabel);
      else button.textContent = originalLabel;
    }
  }));
  document.querySelectorAll("form.is-save-aware input, form.is-save-aware textarea, form.is-save-aware select").forEach((field) => {
    field.addEventListener("input", () => field.form?.classList.remove("is-saved"));
    field.addEventListener("change", () => field.form?.classList.remove("is-saved"));
  });
  document.querySelectorAll(".ai-action").forEach((button) => button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    const { text, field } = findAiSource(button);
    const form = button.closest("form");
    const promptField = button.dataset.aiPromptField ? form?.querySelector(`[name="${button.dataset.aiPromptField}"]`) : null;
    const prompt = promptField?.value || "";
    const compactText = compactAiText(text, button.dataset.aiAction === "generateEventRetrospective" ? 9000 : 12000);
    button.disabled = true;
    button.textContent = "ChatGPT arbeitet ...";
    try {
      const result = await callChatGptAction(button.dataset.aiAction, {
        module: "event-admin",
        entityType: button.dataset.aiEntityType,
        entityId: button.dataset.aiEntityId,
        fieldName: button.dataset.aiField,
        originalText: compactText,
        prompt,
        context: eventContext(button)
      });
      showAiDialog({ button, originalText: text, result, sourceField: field });
    } catch (error) {
      alert(error.message || String(error));
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-editor-tab]").forEach((button) => button.addEventListener("click", () => {
    const target = button.dataset.aiEditorTab;
    const section = document.querySelector(`[data-ai-editor-section="${target}"]`);
    if (!section) return;
    document.querySelectorAll("[data-ai-editor-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  document.querySelectorAll("[data-ai-editorial-run]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-editorial-run-result") || button.closest("section")?.querySelector(".alert");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Pruefung laeuft ...";
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("KI-Redaktion startet sichere Pruefkette ...", 35)}</div>`;
    try {
      const result = await runAiEditorialTask(button.dataset.aiEditorialRun || "manual");
      if (output) {
        output.innerHTML = `<div class="alert ${result.ok ? "alert--success" : "alert--warning"}">${escapeHtml(result.message || "KI-Redaktion abgeschlossen.")}</div>`;
      }
      if (result.ok && result.articleId) {
        window.setTimeout(() => {
          window.location.hash = `#/cms/ai-editorial/editor?id=${encodeURIComponent(result.articleId)}`;
        }, 450);
      } else {
        window.setTimeout(render, 700);
      }
    } catch (error) {
      const message = String(error.message || error || "");
      const authHint = /login erforderlich|unauthenticated|permission-denied/i.test(message)
        ? `<br><small>Gemeint ist dein CMS-/Firebase-Login fuer diese Website, nicht OpenAI. Bitte oben im CMS abmelden/anmelden oder direkt <a class="link" href="#/login">zum Login</a> gehen und danach die KI-Aktion erneut starten.</small>`
        : "";
      if (output) output.innerHTML = `<div class="alert alert--error">KI-Redaktion konnte nicht ausgefuehrt werden: ${escapeHtml(message)}${authHint}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-topic-research]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-topic-research-result") || document.querySelector("#ai-editorial-run-result");
    const panel = button.closest(".ai-topic-research-panel") || document;
    const category = panel.querySelector("#ai-topic-research-category")?.value || "";
    const sourceId = panel.querySelector("#ai-topic-research-source")?.value || "";
    const sourceLabel = panel.querySelector("#ai-topic-research-source")?.selectedOptions?.[0]?.textContent || "";
    const keywords = panel.querySelector("#ai-topic-research-keywords")?.value || "";
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Recherchiere ...";
    const contextLabel = [category, sourceId ? sourceLabel : "", keywords].filter(Boolean).join(" / ");
    const startedAt = Date.now();
    let sourcePool = [];
    let progressTimer = null;
    const renderResearchStatus = () => {
      if (!output) return;
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      const stepIndex = elapsedSeconds < 2
        ? 0
        : elapsedSeconds < 6
          ? 1
          : elapsedSeconds < 18
            ? 2
            : elapsedSeconds < 45
              ? 3
              : elapsedSeconds < 90
                ? 4
                : 5;
      const sourceIndex = Math.max(0, Math.floor(elapsedSeconds / 3));
      output.innerHTML = `<div class="alert">${topicResearchStatusMarkup({ contextLabel, startedAt, stepIndex, sourcePool, sourceIndex })}</div>`;
    };
    try {
      sourcePool = await topicResearchSourcePool(category, keywords, sourceId);
      renderResearchStatus();
      progressTimer = window.setInterval(renderResearchStatus, 2500);
      const result = await generateAiTopicSuggestions({ category, keywords, sourceId });
      if (progressTimer) window.clearInterval(progressTimer);
      const alertTone = result?.ok === false ? "alert--warning" : "alert--success";
      if (output) output.innerHTML = `<div class="alert ${alertTone}">${topicResearchStatusMarkup({ contextLabel, startedAt, stepIndex: TOPIC_RESEARCH_STEPS.length - 1, done: true, sourcePool, sourceIndex: Math.max(0, sourcePool.length - 1) })}<strong>${escapeHtml(result.message || "Themenvorschlaege wurden erstellt.")}</strong></div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (progressTimer) window.clearInterval(progressTimer);
      if (output) output.innerHTML = `<div class="alert alert--error">Themenrecherche konnte nicht ausgefuehrt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-press-import]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-press-import-result") || document.querySelector("#ai-editorial-run-result");
    const originalLabel = button.textContent;
    const runId = `press-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    let pollTimer = 0;
    let pollStopped = false;
    const renderPressRun = async () => {
      if (!output || pollStopped) return;
      const run = await getOne("ai_press_import_runs", runId).catch(() => null);
      if (!output || pollStopped) return;
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      const stepIndex = run
        ? Number(run.scanned_sources || 0) <= 0
          ? 1
          : Number(run.scanned_sources || 0) < Number(run.planned_sources || 1)
            ? elapsedSeconds < 12 ? 2 : elapsedSeconds < 45 ? 3 : 4
            : 5
        : 0;
      output.innerHTML = `<div class="alert">${pressImportStatusMarkup({ startedAt, run, stepIndex })}</div>`;
    };
    button.disabled = true;
    button.textContent = "Importiere ...";
    if (output) output.innerHTML = `<div class="alert">${pressImportStatusMarkup({ startedAt, stepIndex: 0 })}</div>`;
    pollTimer = window.setInterval(renderPressRun, 1800);
    try {
      const result = await importGermanPressReleases({ runId, months: 2, perSourceLimit: 4 });
      pollStopped = true;
      if (pollTimer) window.clearInterval(pollTimer);
      const finalRun = await getOne("ai_press_import_runs", runId).catch(() => null);
      if (output) output.innerHTML = `<div class="alert ${result.ok ? "alert--success" : "alert--warning"}">${pressImportStatusMarkup({ startedAt, run: finalRun || result, stepIndex: PRESS_IMPORT_STEPS.length - 1, done: true })}<strong>${escapeHtml(result.message || "Presseimport abgeschlossen.")}</strong><br><small>${Number(result.duplicates || 0)} Dubletten ausgelassen, ${Number(result.skippedSources || 0)} Quellen ausgespart.</small></div>`;
      window.setTimeout(() => {
        if (output) output.innerHTML = "";
        render();
      }, 1200);
    } catch (error) {
      pollStopped = true;
      if (pollTimer) window.clearInterval(pollTimer);
      if (output) output.innerHTML = `<div class="alert alert--error">Pressemitteilungen konnten nicht importiert werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      pollStopped = true;
      if (pollTimer) window.clearInterval(pollTimer);
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-press-create-article]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-press-delete-result") || document.querySelector("#ai-press-import-result");
    const releaseId = button.dataset.aiPressCreateArticle;
    if (!releaseId) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Oeffne ...";
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("Beitragsentwurf wird vorbereitet ...", 45)}</div>`;
    try {
      const release = await getOne("ai_press_releases", releaseId);
      if (!release) throw new Error("Pressemitteilung nicht gefunden.");
      const draft = editorialDraftFromPressRelease(release, currentUser() || {});
      const existingArticle = await getOne("editorialContent", draft.id).catch(() => null);
      if (!existingArticle) {
        await upsert("editorialContent", draft);
        await upsert("article_sources", articleSourceFromPressRelease(draft.id, release));
      } else {
        await upsert("article_sources", {
          ...articleSourceFromPressRelease(draft.id, release),
          created_at: existingArticle.created_at || existingArticle.createdAt || new Date().toISOString()
        });
      }
      await upsert("ai_press_releases", {
        ...release,
        editorial_status: "Beitrag erstellt",
        article_id: draft.id,
        article_created_at: existingArticle?.article_created_at || release.article_created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Beitragsentwurf ist bereit und wird im Editor geoeffnet.</div>`;
      window.location.hash = `#/cms/ai-editorial/editor?id=${encodeURIComponent(draft.id)}`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Beitrag konnte nicht erstellt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("#ai-news-import-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-news-import-result");
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("KI-News-Entwurf wird aus dem Import vorbereitet ...", 45)}</div>`;
    try {
      const values = formObject(form);
      const { textSources, imageFiles, imageSources, unsupportedTextFiles } = await collectAiNewsImportSources(form);
      const sourceUrl = normalizedImportUrl(values.sourceUrl || "");
      if (String(values.sourceUrl || "").trim() && !sourceUrl) {
        throw new Error("Bitte eine gueltige http- oder https-URL eintragen.");
      }
      if (!String(values.sourceText || "").trim() && !sourceUrl && !textSources.length && !imageFiles.length) {
        throw new Error("Bitte Text einfuegen, eine URL eintragen oder mindestens eine Text- oder Bilddatei hochladen.");
      }
      let importedUrl = null;
      if (sourceUrl && !String(values.sourceText || "").trim() && !textSources.length) {
        importedUrl = await importUrlIntoNewsImportForm(form, sourceUrl);
        values.sourceText = importedUrl?.text || "";
      }
      const sourcePreviewText = [
        values.sourceText || "",
        importedUrl?.text || "",
        ...textSources.map((source) => source.text || source.content || "")
      ].filter(Boolean).join("\n\n").trim();
      const rawText = cleanRawImportText(sourcePreviewText);
      if (!rawText) {
        throw new Error("Es konnte kein Beitragstext importiert werden.");
      }
      if (output) output.innerHTML = `<div class="alert">${progressMarkup("Import wird als KI-News-Entwurf gespeichert ...", 78)}</div>`;
      const now = new Date().toISOString();
      const importedTitle = importedUrl?.title || "";
      const importedTitleIsSource = importedTitleLooksLikeSource(importedTitle, importedUrl?.source || "", sourceUrl);
      const cleanHeadline = importedTitle && !importedTitleIsSource
        ? rawImportHeadline(importedTitle)
        : sourcePreviewText
          ? rawImportHeadline(rawText || imageFiles[0]?.name || "Importierte News")
          : sourceUrl
            ? rawImportHeadlineFromUrl(sourceUrl)
            : rawImportHeadline(rawText || imageFiles[0]?.name || "Importierte News");
      const articleId = `news-import-${crypto.randomUUID()}`;
      let imageUrl = "";
      let assetStoragePath = "";
      let galleryId = "";
      let galleryImages = [];
      if (imageFiles[0]) {
        const uploaded = await uploadEntityImage("editorialContent", articleId, imageFiles[0]);
        imageUrl = uploaded?.url || "";
        assetStoragePath = uploaded?.storagePath || "";
      }
      if (imageFiles.length > 1) {
        galleryId = `gallery-${articleId}`;
        galleryImages = await uploadGalleryImages(galleryId, imageFiles);
        await upsert("galleries", {
          id: galleryId,
          title: `Galerie: ${cleanHeadline}`,
          description: "Aus dem Rohimport uebernommene Bildquellen.",
          status: "draft",
          visibility: "internal",
          images: galleryImages.map((image, index) => ({
            ...image,
            caption: image.caption || image.fileName || "",
            altText: image.altText || image.fileName || ""
          })),
          createdAt: now,
          updatedAt: now
        });
      }
      const tags = [];
      const sourceSnapshot = [
        ...(sourceUrl ? [{
          title: importedUrl?.source || domainFromUrl(sourceUrl),
          publisher: importedUrl?.source || domainFromUrl(sourceUrl),
          url: sourceUrl,
          source_type: "URL"
        }] : []),
        ...textSources.map((source, index) => ({
          title: source.name || source.fileName || `Textquelle ${index + 1}`,
          publisher: source.name || source.fileName || "",
          url: source.url || "",
          source_type: source.type || source.mimeType || "Textquelle"
        })),
        ...imageSources.map((source, index) => ({
          title: source.name || source.fileName || `Bildquelle ${index + 1}`,
          publisher: source.name || source.fileName || "",
          url: "",
          source_type: source.type || source.mimeType || "Bildquelle"
        }))
      ];
      await upsert("editorialContent", {
        id: articleId,
        title: cleanHeadline,
        headline: cleanHeadline,
        subtitle: "",
        subline: "",
        introText: "",
        shortText: "",
        teaserText: "",
        bodyText: rawText,
        ai_original_suggested_text: rawText,
        source_suggested_text: rawText,
        imported_full_text: rawText,
        source_full_text: rawText,
        page: "news",
        section: "news",
        key: `news.${articleId}`,
        slug: slugify(cleanHeadline),
        category: "KI-News-Import",
        tags,
        primary_keyword: tags[0] || "",
        keyword_json: tags.map((tag, index) => ({ keyword: tag, relevance_score: index === 0 ? 90 : 70 })),
        source_snapshot_json: sourceSnapshot,
        original_url: sourceUrl,
        source_url: sourceUrl,
        thumbnail_idea: "",
        thumbnail_prompt: "",
        thumbnail_alt: cleanHeadline,
        imageUrl,
        thumbnail_url: imageUrl,
        assetUrl: imageUrl,
        assetFileName: imageFiles[0]?.name || "",
        assetType: imageUrl ? "image" : "",
        assetStoragePath,
        galleryId,
        gallery_suggestions: [],
        editorial_note: [
          "KI-News-Import: Inhalt wurde als Quellenbasis uebernommen. Keine automatische Veroeffentlichung.",
          unsupportedTextFiles.length ? `PDF/DOCX-Text bitte pruefen oder separat einfuegen: ${unsupportedTextFiles.join(", ")}` : ""
        ].filter(Boolean).join("\n\n"),
        relevance_score: 0,
        relevance_reason: "",
        visible: false,
        status: "draft",
        visibility: "internal",
        author_type: "ki_news_import",
        author_name: "KI-News-Import",
        generation_origin: "ki_news_import",
        ai_log_json: {
          import_flow: "ki_news_import",
          raw_import_only: true,
          no_ai_interpretation: true,
          no_status_logic: true,
          visible: false,
          sourceUrl,
          textSourceCount: textSources.length,
          imageSourceCount: imageFiles.length,
          unsupportedTextFiles
        },
        publishDate: "",
        validFrom: importedUrl?.publishedAt || now.slice(0, 10),
        createdAt: now,
        updatedAt: now
      });
      await Promise.all(sourceSnapshot.map((source, index) => upsert("article_sources", {
        id: `article-source-${crypto.randomUUID()}`,
        article_id: articleId,
        title: source.title || `Quelle ${index + 1}`,
        publisher: source.title || source.publisher || "",
        domain: source.url ? domainFromUrl(source.url) : "",
        url: source.url || "",
        source_type: source.source_type || source.sourceType || "Importquelle",
        relevance_note: "Aus dem Rohimport uebernommen.",
        claim_reference: "",
        trust_score: 0,
        check_status: "ungeprueft",
        created_at: now,
        updated_at: now
      })));
      await Promise.all(tags.slice(0, 10).map((tag, index) => upsert("article_keywords", {
        id: `article-keyword-${crypto.randomUUID()}`,
        article_id: articleId,
        keyword: tag,
        keyword_type: index === 0 ? "Hauptkeyword" : "Branchenkeyword",
        relevance_score: index === 0 ? 90 : 70,
        is_primary: index === 0,
        explanation: "Aus dem Rohimport uebernommen.",
        ai_generated: true,
        manually_confirmed: false,
        created_at: now,
        updated_at: now
      })));
      if (output) output.innerHTML = `<div class="alert alert--success">KI-News-Import wurde als Entwurf gespeichert. Redaktion > News bearbeiten wird geoeffnet.</div>`;
      window.location.hash = `#/cms/edit?module=editorialContent&id=${encodeURIComponent(articleId)}&section=news`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">KI-News-Import fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  const newsImportForm = document.querySelector("#ai-news-import-form");
  if (newsImportForm) {
    const hashQuery = String(window.location.hash || "").split("?")[1] || "";
    const query = new URLSearchParams(hashQuery);
    const sourceUrl = normalizedImportUrl(query.get("sourceUrl") || "");
    const autoImportKey = `ai-news-import:${sourceUrl}`;
    if (sourceUrl && query.get("autoImport") === "1" && sessionStorage.getItem(autoImportKey) !== "1") {
      sessionStorage.setItem(autoImportKey, "1");
      window.setTimeout(async () => {
        if (document.body.contains(newsImportForm)) {
          try {
            await importUrlIntoNewsImportForm(newsImportForm, sourceUrl);
          } catch (error) {
            const output = newsImportForm.querySelector("#ai-news-import-result");
            if (output) output.innerHTML = `<div class="alert alert--error">URL konnte nicht in den KI-News-Import geladen werden: ${escapeHtml(error.message || String(error))}</div>`;
          }
        }
      }, 120);
    }
  }

  document.querySelector("#ai-news-import-form input[name='sourceFiles']")?.addEventListener("change", (event) => {
    renderAiNewsImportFileList(event.currentTarget.closest("form"));
  });
  document.querySelector("[data-ai-news-add-source]")?.addEventListener("click", () => {
    document.querySelector("#ai-news-import-form textarea[name='sourceText']")?.focus();
  });
  document.querySelectorAll("[data-ai-news-dropzone]").forEach((dropzone) => {
    const form = dropzone.closest("form");
    const input = dropzone.querySelector('input[type="file"]');
    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
      if (!input) return;
      input.files = event.dataTransfer.files;
      renderAiNewsImportFileList(form);
    });
  });

  document.querySelector("[data-ai-morning-briefing-run]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const output = document.querySelector("#ai-morning-briefing-result") || document.querySelector("#ai-editorial-run-result");
    const originalLabel = button.textContent;
    const startedAt = Date.now();
    let sourcePool = [];
    let progressTimer = null;
    let liveSourcePublications = 0;
    let livePollRunning = false;
    const refreshLiveFinds = async () => {
      if (livePollRunning) return;
      livePollRunning = true;
      try {
        liveSourcePublications = Math.max(liveSourcePublications, await countMorningRawFindsSince(startedAt));
      } catch {
        // Live-Zaehler ist Komfortanzeige; der eigentliche Scan laeuft unabhaengig weiter.
      } finally {
        livePollRunning = false;
      }
    };
    const renderMorningStatus = (stepIndex = null, result = null, done = false) => {
      if (!output) return;
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      const fallbackStep = elapsedSeconds < 2
        ? 0
        : elapsedSeconds < 6
          ? 1
          : elapsedSeconds < 35
            ? 2
            : elapsedSeconds < 55
              ? 3
              : elapsedSeconds < 90
                ? 4
                : 5;
      const sourceIndex = Math.max(0, Math.floor(elapsedSeconds / 3));
      const liveResult = {
        ...(result || {}),
        sourcePublications: Math.max(Number(result?.sourcePublications || result?.source_publications || 0), liveSourcePublications),
        liveSourcePublications
      };
      output.innerHTML = `<div class="alert">${morningBriefingStatusMarkup({ startedAt, stepIndex: stepIndex ?? fallbackStep, sourcePool, sourceIndex, result: liveResult, done })}</div>`;
    };
    button.disabled = true;
    button.textContent = "Briefing laeuft ...";
    try {
      sourcePool = await morningBriefingSourcePool();
      renderMorningStatus(1);
      await refreshLiveFinds();
      progressTimer = window.setInterval(() => {
        refreshLiveFinds().finally(() => renderMorningStatus());
      }, 2500);
      const research = await generateAiTopicSuggestions({ limit: 10, allSources: true, researchMode: "all_sources", requireLive: true });
      if (progressTimer) window.clearInterval(progressTimer);
      liveSourcePublications = Math.max(liveSourcePublications, Number(research?.sourcePublications || research?.source_publications || 0));
      if (output) {
        renderMorningStatus(4, research);
      }
      progressTimer = window.setInterval(() => {
        refreshLiveFinds().finally(() => renderMorningStatus(4, research));
      }, 2500);
      const result = await runMorningBriefingTask({ mode: "manual" });
      if (progressTimer) window.clearInterval(progressTimer);
      liveSourcePublications = Math.max(liveSourcePublications, Number(result?.sourcePublications || result?.source_publications || 0));
      if (output) {
        const researchInfo = Number(research?.totalSources || 0)
          ? `<small>${escapeHtml(`${Number(research.researchedSources || 0)} von ${Number(research.totalSources || 0)} freigegebenen Quellen abgearbeitet. ${Number(research.sourcePublications || 0)} Quellenfunde gespeichert.${research.stoppedByTimeBudget ? " Zeitbudget erreicht; weitere Quellen folgen im naechsten Lauf." : ""}`)}</small>`
          : "";
        output.innerHTML = `<div class="alert ${result.ok ? "alert--success" : "alert--warning"}">${morningBriefingStatusMarkup({ startedAt, stepIndex: MORNING_BRIEFING_STEPS.length - 1, done: true, sourcePool, sourceIndex: Math.max(0, sourcePool.length - 1), result: { ...research, ...result, sourcePublications: Math.max(Number(research?.sourcePublications || 0), Number(result?.sourcePublications || 0), liveSourcePublications), liveSourcePublications } })}<strong>${escapeHtml(result.message || "Morgenbriefing abgeschlossen.")}</strong>${researchInfo}</div>`;
      }
      window.setTimeout(render, 900);
    } catch (error) {
      if (progressTimer) window.clearInterval(progressTimer);
      if (output) output.innerHTML = `<div class="alert alert--error">Morgenbriefing konnte nicht erzeugt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  document.querySelector("[data-ai-morning-reset]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const output = document.querySelector("#ai-morning-briefing-result") || document.querySelector("#ai-editorial-run-result");
    if (!window.confirm("Morgenbriefing-Arbeitsliste zuruecksetzen? Bestehende Artikel bleiben erhalten, Meldungen werden nur archiviert.")) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "...";
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("Morgenbriefing-Arbeitsliste wird archiviert ...", 35)}</div>`;
    try {
      const now = new Date().toISOString();
      const items = (await list("ai_topic_suggestions")).filter((item) => isMorningBriefingWorkItem(item));
      const activeItems = items.filter((item) => !["archiviert", "ignoriert"].includes(normalizeMorningKey(item.morning_status || item.status)));
      let done = 0;
      for (const item of activeItems) {
        await upsert("ai_topic_suggestions", {
          ...item,
          status: "Archiviert",
          morning_status: "Archiviert",
          reset_at: now,
          updated_at: now
        });
        done += 1;
        if (output) output.innerHTML = `<div class="alert">${progressMarkup(`${done} von ${activeItems.length} Morgenbriefing-Meldungen archiviert ...`, 20 + Math.round((done / Math.max(1, activeItems.length)) * 70))}</div>`;
      }
      await upsert("ai_editorial_logs", {
        id: `ai-editorial-log-${crypto.randomUUID()}`,
        article_id: "",
        task_name: "Morgenbriefing_Reset",
        status: "archived",
        message: `${activeItems.length} Morgenbriefing-Meldung${activeItems.length === 1 ? "" : "en"} archiviert. Artikel bleiben erhalten.`,
        found_topics_json: activeItems.map((item) => ({ id: item.id, headline: item.headline || item.title || "", previous_status: item.morning_status || item.status || "" })),
        created_at: now
      });
      if (output) output.innerHTML = `<div class="alert alert--success">${activeItems.length} Morgenbriefing-Meldung${activeItems.length === 1 ? "" : "en"} archiviert. Bestehende Artikel bleiben erhalten.</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Reset fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  document.querySelector("#ai-morning-briefing-import-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = document.querySelector("#ai-morning-briefing-result");
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("Meldungen werden importiert ...", 55)}</div>`;
    try {
      const parsedRows = parseMorningBriefingPipeRows(formObject(form).pipeText || "");
      if (!parsedRows.length) throw new Error("Bitte mindestens eine Pipe-Zeile einfuegen.");
      const [existingTopics, existingArticles, rawData] = await Promise.all([
        list("ai_topic_suggestions").catch(() => []),
        list("editorialContent").catch(() => []),
        list("ai_topic_raw_data").catch(() => [])
      ]);
      const rows = enrichMorningRowsWithRawText(parsedRows, rawData);
      const now = new Date().toISOString();
      const saved = [];
      for (const row of rows) {
        const next = { ...row, status: "Neu", morning_status: "Neu", duplicate_of: "", updated_at: now };
        await upsert("ai_topic_suggestions", next);
        saved.push(next);
      }
      const fullTextCount = saved.filter((item) => normalizeMorningText(item.full_text || item.fullText || "").length > normalizeMorningText(item.summary || "").length + 80).length;
      await upsert("ai_editorial_logs", {
        id: `ai-editorial-log-${crypto.randomUUID()}`,
        article_id: "",
        task_name: "Morgenbriefing_Import",
        status: "imported",
        message: `${saved.length} Morgenbriefing-Meldung${saved.length === 1 ? "" : "en"} importiert. ${fullTextCount} mit Quellenvolltext.`,
        found_topics_json: saved,
        duplicate_check_json: { disabled: true },
        source_ingest_json: { full_text_items: fullTextCount, raw_items_checked: rawData.length },
        ai_check_json: { status: "vorbereitet", publication_status: "Entwurf" },
        created_at: now
      });
      if (output) output.innerHTML = `<div class="alert alert--success">${saved.length} Meldung${saved.length === 1 ? "" : "en"} importiert. ${fullTextCount} mit Quellenvolltext verknuepft.</div>`;
      form.reset();
      window.setTimeout(render, 900);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Import fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelectorAll("[data-ai-morning-status]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.aiMorningStatus;
    const status = button.dataset.status || "Neu";
    const output = document.querySelector("#ai-morning-briefing-result");
    if (!id) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "...";
    try {
      const item = await getOne("ai_topic_suggestions", id);
      if (!item) throw new Error("Meldung nicht gefunden.");
      await upsert("ai_topic_suggestions", { ...item, status, morning_status: status, updated_at: new Date().toISOString() });
      if (output) output.innerHTML = `<div class="alert alert--success">Status auf ${escapeHtml(status)} gesetzt.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Status konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-morning-delete]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.aiMorningDelete;
    const output = document.querySelector("#ai-morning-briefing-result");
    if (!id) return;
    if (!window.confirm("Diese Morgenbriefing-Meldung verwerfen und aus der Arbeitsliste loeschen? Bestehende Artikel bleiben erhalten.")) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Loesche ...";
    try {
      const item = await getOne("ai_topic_suggestions", id).catch(() => null);
      await remove("ai_topic_suggestions", id);
      await upsert("ai_editorial_logs", {
        id: `ai-editorial-log-${crypto.randomUUID()}`,
        article_id: "",
        task_name: "Morgenbriefing_Verwerfen",
        status: "deleted",
        message: "Morgenbriefing-Meldung verworfen und aus der Arbeitsliste geloescht.",
        found_topics_json: item ? [{ id: item.id, headline: item.headline || item.title || "" }] : [{ id }],
        created_at: new Date().toISOString()
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Meldung verworfen und aus der Morgenbriefing-Arbeitsliste geloescht.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Meldung konnte nicht verworfen werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-morning-article-delete]").forEach((button) => button.addEventListener("click", async () => {
    const articleId = button.dataset.aiMorningArticleDelete;
    const output = document.querySelector("#ai-morning-briefing-result");
    if (!articleId) return;
    if (!window.confirm("Diesen Briefing-Artikel aus der Liste entfernen? Der oeffentliche News-Beitrag wird geloescht, falls er nur als Entwurf existiert.")) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "...";
    try {
      const article = await getOne("editorialContent", articleId).catch(() => null);
      await remove("editorialContent", articleId);
      const [sources, keywords] = await Promise.all([
        list("article_sources").catch(() => []),
        list("article_keywords").catch(() => [])
      ]);
      await Promise.all([
        ...sources.filter((source) => source.article_id === articleId || source.articleId === articleId).map((source) => remove("article_sources", source.id)),
        ...keywords.filter((keyword) => keyword.article_id === articleId || keyword.articleId === articleId).map((keyword) => remove("article_keywords", keyword.id))
      ]);
      const morningId = article?.morning_briefing_item_id || article?.topic_suggestion_id || article?.source_item_id || "";
      if (morningId) {
        const item = await getOne("ai_topic_suggestions", morningId).catch(() => null);
        if (item) await upsert("ai_topic_suggestions", { ...item, article_id: "", articleId: "", status: "Briefing", morning_status: "Briefing", updated_at: new Date().toISOString() });
      }
      if (output) output.innerHTML = `<div class="alert alert--success">Briefing-Artikel wurde entfernt.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Briefing-Artikel konnte nicht entfernt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-morning-create-article]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.aiMorningCreateArticle;
    const output = document.querySelector("#ai-morning-briefing-result");
    if (!id) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Erzeuge ...";
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("Artikelentwurf wird im bestehenden Editor vorbereitet ...", 65)}</div>`;
    try {
      const item = await getOne("ai_topic_suggestions", id);
      if (!item) throw new Error("Morgenbriefing-Meldung nicht gefunden.");
      let briefingItem = item;
      const sourceUrl = normalizedImportUrl(item.original_url || item.originalUrl || item.source_url || item.sourceUrl || item.url || "");
      if (sourceUrl) {
        if (output) output.innerHTML = `<div class="alert">${progressMarkup("Quelle wird geoeffnet und Text wird importiert ...", 45)}</div>`;
        try {
          const imported = await importNewsUrlText(sourceUrl);
          if (imported?.text) {
            briefingItem = {
              ...item,
              headline: item.headline || item.title || imported.title || "",
              title: item.title || item.headline || imported.title || "",
              summary: item.summary || item.teaser || limitText(imported.text, 360),
              teaser: item.teaser || item.summary || limitText(imported.text, 360),
              full_text: imported.text,
              fullText: imported.text,
              source_full_text: imported.text,
              imported_full_text: imported.text,
              source: item.source || imported.source || domainFromUrl(sourceUrl),
              source_name: item.source_name || item.sourceName || imported.source || domainFromUrl(sourceUrl),
              original_url: sourceUrl,
              source_url: sourceUrl,
              first_seen: item.first_seen || item.firstSeen || imported.publishedAt || new Date().toISOString()
            };
          }
        } catch (importError) {
          console.warn("Morgenbriefing-Quelle konnte nicht live importiert werden, Kurzfassung wird genutzt.", importError);
          if (output) output.innerHTML = `<div class="alert alert--warning">Quelle konnte nicht automatisch importiert werden. Es wird die gespeicherte Kurzfassung in den Editor uebernommen.</div>`;
        }
      }
      const article = await morningArticleDraftFromItem(briefingItem);
      const existingArticle = await getOne("editorialContent", article.id).catch(() => null);
      await upsert("editorialContent", { ...(existingArticle || {}), ...article, createdAt: existingArticle?.createdAt || article.createdAt, updatedAt: new Date().toISOString() });
      await Promise.all((article.source_snapshot_json || []).map((source, index) => upsert("article_sources", {
        id: `article-source-${article.id}-${index + 1}`,
        article_id: article.id,
        title: source.title || `Quelle ${index + 1}`,
        publisher: source.publisher || source.title || "",
        domain: source.domain || "",
        url: source.url || "",
        source_type: source.source_type || "Morgenbriefing",
        relevance_note: "Aus Morgenbriefing-Meldung uebernommen. Redaktionell vor Veroeffentlichung pruefen.",
        claim_reference: item.summary || "",
        trust_score: Number(source.trust_score || 0),
        check_status: source.check_status || "redaktionell pruefen",
        created_at: existingArticle?.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })));
      await Promise.all((article.keyword_json || []).slice(0, 15).map((keyword, index) => upsert("article_keywords", {
        id: `article-keyword-${article.id}-${index + 1}`,
        article_id: article.id,
        keyword: keyword.keyword,
        keyword_type: keyword.keyword_type || keyword.type || (index === 0 ? "Thema" : "Branchenkeyword"),
        relevance_score: Number(keyword.relevance_score || keyword.relevance || (index === 0 ? 95 : 70)),
        type: keyword.type || keyword.keyword_type || "Thema",
        reason: keyword.reason || keyword.explanation || "Aus Morgenbriefing-Meldung abgeleitet.",
        explanation: keyword.explanation || keyword.reason || "Aus Morgenbriefing-Meldung abgeleitet.",
        ai_generated: true,
        manually_confirmed: false,
        is_primary: index === 0,
        created_at: existingArticle?.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })));
      await upsert("ai_topic_suggestions", {
        ...item,
        article_id: article.id,
        status: "Artikel erstellt",
        morning_status: "Artikel erstellt",
        updated_at: new Date().toISOString()
      });
      if (output) output.innerHTML = `<div class="alert alert--success">News-Entwurf wurde im vorhandenen Beitragseditor angelegt.</div>`;
      window.location.hash = `#/cms/edit?module=editorialContent&id=${encodeURIComponent(article.id)}&section=news`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Artikel konnte nicht erzeugt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-topic-raw-clear]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-topic-research-result") || document.querySelector("#ai-editorial-run-result");
    if (!window.confirm("Alle Rawdaten der Themenrecherche loeschen? Themenvorschlaege, Queue und Artikel bleiben erhalten.")) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Loesche ...";
    try {
      const rows = await list("ai_topic_raw_data");
      await Promise.all(rows.map((row) => remove("ai_topic_raw_data", row.id)));
      if (output) output.innerHTML = `<div class="alert alert--success">${rows.length} Rawdaten-Zeilen wurden geloescht.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Rawdaten konnten nicht geloescht werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-topic-create-article]").forEach((button) => button.addEventListener("click", () => {
    const form = button.closest("form");
    if (!form) return;
    form.querySelectorAll('input[name="topicSuggestionIds"]').forEach((input) => { input.checked = false; });
    const checkbox = form.querySelector(`input[name="topicSuggestionIds"][value="${CSS.escape(button.dataset.aiTopicCreateArticle || "")}"]`);
    if (!checkbox) return;
    checkbox.checked = true;
    form.requestSubmit();
  }));

  document.querySelector("#ai-topic-suggestions-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = document.querySelector("#ai-topic-research-result");
    const selectedIds = Array.from(form.querySelectorAll('input[name="topicSuggestionIds"]:checked')).map((input) => input.value);
    if (!selectedIds.length) {
      if (output) output.innerHTML = `<div class="alert alert--warning">Bitte mindestens ein Thema auswaehlen.</div>`;
      return;
    }
    const now = new Date().toISOString();
    try {
      const createdArticleIds = [];
      for (const id of selectedIds) {
        const suggestion = await getOne("ai_topic_suggestions", id);
        if (!suggestion) continue;
        const articleId = `ai-article-${crypto.randomUUID()}`;
        const cleanTitle = suggestion.headline || suggestion.title || "KI-Thema";
        const bodyText = draftArticleTextFromTopic(suggestion);
        const shortText = shortTextFromTopic(suggestion, bodyText);
        const generatedKeywords = localEditorialKeywords({ ...suggestion, headline: cleanTitle, bodyText }, suggestion.keywords || []);
        const generatedSeo = localSeoPayload({ ...suggestion, headline: cleanTitle, bodyText, subline: suggestion.subline || "", slug: slugify(cleanTitle) }, generatedKeywords);
        const thumbnailIdea = suggestion.thumbnail_idea || suggestion.thumbnailIdea || `Redaktionelles Vorschaubild zum Thema ${suggestion.title || cleanTitle}.`;
        const thumbnailPrompt = [
          "Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV.",
          thumbnailIdea,
          "Serioeser moderner Business-Look, TV-, Streaming- und digitale Medienbranche, natuerliches Licht, keine echten Logos, keine realen Personen, keine Comic-Optik."
        ].join(" ");
        const thumbnailUrl = generateLocalEditorialThumbnail({
          headline: cleanTitle,
          title: cleanTitle,
          category: suggestion.category || "",
          primary_keyword: Array.isArray(suggestion.keywords) ? suggestion.keywords[0] || "" : ""
        });
        await upsert("editorialContent", {
          id: articleId,
          title: cleanTitle,
          headline: cleanTitle,
          subtitle: suggestion.subline || "",
          subline: suggestion.subline || "",
          introText: shortText,
          shortText,
          teaserText: shortText,
          bodyText,
          ai_original_suggested_text: bodyText,
          source_suggested_text: bodyText,
          themenabsatz: suggestion.themenabsatz || suggestion.themen_absatz || "",
          pdtv_ansatz: suggestion.pdtv_ansatz || suggestion.pdtvAnsatz || "",
          quellenhinweis: suggestion.quellenhinweis || suggestion.quellen_hinweis || "",
          quellenstatus: suggestion.quellenstatus || suggestion.quellen_status || suggestion.source_status || "",
          page: "news",
          section: "news",
          key: `news.${articleId}`,
          slug: generatedSeo.slug || articleId,
          seoTitle: generatedSeo.seoTitle,
          seo_title: generatedSeo.seo_title,
          seoDescription: generatedSeo.seoDescription,
          seo_description: generatedSeo.seo_description,
          seoKeywords: generatedSeo.seoKeywords,
          seo_keywords: generatedSeo.seo_keywords,
          category: suggestion.category || "",
          tags: generatedKeywords.map((item) => item.keyword),
          primary_keyword: generatedKeywords[0]?.keyword || "",
          keyword_json: generatedKeywords,
          thumbnail_idea: thumbnailIdea,
          thumbnail_prompt: thumbnailPrompt,
          thumbnail_url: thumbnailUrl,
          imageUrl: thumbnailUrl,
          source_status: (suggestion.source_candidates || []).length || (suggestion.source_ids || []).length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen",
          duplicate_status: "nicht geprueft",
          ai_check_status: "vorbereitet",
          legal_check_status: "offen",
          publication_status: "Entwurf",
          status: "draft",
          visibility: "internal",
          relevance_score: Number(suggestion.relevance_score || suggestion.actuality_score || 0),
          author_type: "ai",
          author_name: "KI-Redaktion",
          publication_target: "news",
          topic_suggestion_id: id,
          ai_log_json: {
            manual_flow: true,
            source_note: "Eine valide Quelle reicht fuer die Themenliste. Weitere Quellen koennen im Editor ergaenzt werden.",
            note: "Aus redaktionell ausgewaehltem Themenvorschlag angelegt. Text, Quellen, Thumbnail, Audio, Keywords und Rubrik im Editor ausarbeiten. Die Redaktion entscheidet ueber Verwerfen, Bearbeiten und Veroeffentlichen."
          },
          createdAt: now,
          updatedAt: now
        });
        if (generatedKeywords.length) {
          await Promise.all(generatedKeywords.slice(0, 10).map((keyword, index) => upsert("article_keywords", {
            id: `article-keyword-${crypto.randomUUID()}`,
            article_id: articleId,
            keyword: keyword.keyword,
            keyword_type: keyword.keyword_type || (index === 0 ? "Hauptkeyword" : "Branchenkeyword"),
            relevance_score: keyword.relevance_score || (index === 0 ? 95 : 70),
            is_primary: Boolean(keyword.is_primary),
            explanation: keyword.explanation || "Aus redaktionell ausgewaehltem Themenvorschlag uebernommen.",
            ai_generated: true,
            manually_confirmed: false,
            created_at: now,
            updated_at: now
          })));
        }
        createdArticleIds.push(articleId);
        await upsert("ai_topic_queue", {
          ...suggestion,
          id: `ai-topic-queue-${suggestion.topic_key || id}`,
          suggestion_id: id,
          article_id: articleId,
          status: "Entwurf angelegt",
          queue_status: "uebernommen",
          queued_at: now,
          updated_at: now
        });
        await upsert("ai_topic_suggestions", {
          ...suggestion,
          queue_status: "uebernommen",
          status: "uebernommen",
          updated_at: now
        });
      }
      if (output) output.innerHTML = `<div class="alert alert--success">${createdArticleIds.length} Beitrag/Beitraege wurden als Entwurf angelegt. ${createdArticleIds.length === 1 ? "Der Beitragseditor wird geoeffnet." : "Die Beitragsliste wird geoeffnet."}</div>`;
      window.setTimeout(() => {
        window.location.hash = createdArticleIds.length === 1
          ? `#/cms/ai-editorial/editor?id=${encodeURIComponent(createdArticleIds[0])}`
          : "#/cms/ai-editorial/articles";
      }, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Queue konnte nicht aktualisiert werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-editorial-automation]").forEach((button) => button.addEventListener("click", async () => {
    const enabled = button.dataset.aiEditorialAutomation === "start";
    const output = document.querySelector("#ai-editorial-run-result");
    try {
      const existing = (await getOne("settings", "aiEditorial")) || { id: "aiEditorial" };
      const settings = { ...existing, automationEnabled: enabled, updatedAt: new Date().toISOString() };
      const result = await saveAiEditorialSettings(settings);
      if (result.localOnly) await upsert("settings", settings);
      if (output) output.innerHTML = `<div class="alert alert--success">Automatisierung wurde ${enabled ? "aktiviert" : "pausiert"}.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelector("#ai-editorial-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-editorial-settings-result");
    const values = formObject(form);
    const settings = {
      id: "aiEditorial",
      automationEnabled: Boolean(values.automationEnabled),
      allowAutoPublish: Boolean(values.allowAutoPublish),
      scheduleLabel: values.scheduleLabel || "Taeglich 06:00 Uhr",
      publicationMode: values.publicationMode || "draft_only",
      minimumSources: Math.max(1, Number(values.minimumSources || 1)),
      minimumTrustScore: Number(values.minimumTrustScore || 70),
      updatedAt: new Date().toISOString()
    };
    try {
      const result = await saveAiEditorialSettings(settings);
      if (result.localOnly) await upsert("settings", settings);
      if (output) output.innerHTML = `<div class="alert alert--success">KI-Redaktions-Einstellungen wurden gespeichert.</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#ai-prompt-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-prompt-result");
    let values = formObject(form);
    if (!String(values.name || "").trim() || !String(values.prompt_text || "").trim()) {
      values = { ...values, ...buildPromptFromSource(values) };
    }
    const existingPrompt = values.prompt_id ? await getOne("ai_prompts", values.prompt_id) : null;
    const promptId = values.prompt_id || `ai-prompts-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const nextVersion = existingPrompt ? Number(existingPrompt.version || 1) + 1 : 1;
    const prompt = {
      ...(existingPrompt || {}),
      id: promptId,
      name: values.name || "",
      prompt_type: values.prompt_type || "",
      description: values.description || "",
      prompt_text: values.prompt_text || "",
      system_instructions: values.system_instructions || "",
      output_format: values.output_format || "json",
      model: values.model || "gpt-4.1-mini",
      is_active: Boolean(values.is_active),
      temperature: Number(values.temperature || 0.2),
      max_tokens: Number(values.max_tokens || 1200),
      status: values.status || "Entwurf",
      version: nextVersion,
      created_at: existingPrompt?.created_at || existingPrompt?.createdAt || now,
      updated_at: now
    };
    try {
      await upsert("ai_prompts", prompt);
      await upsert("ai_prompt_versions", {
        id: `ai-prompt-versions-${crypto.randomUUID()}`,
        prompt_id: promptId,
        version: nextVersion,
        prompt_text: prompt.prompt_text,
        system_instructions: prompt.system_instructions,
        output_format: prompt.output_format || "json",
        model: prompt.model,
        temperature: prompt.temperature,
        max_tokens: prompt.max_tokens,
        change_note: values.change_note || "Erste Version im CMS angelegt.",
        status: prompt.status,
        created_at: now
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Prompt wurde ${existingPrompt ? "aktualisiert" : "angelegt"} und als Version ${nextVersion} gespeichert.</div>`;
      form.reset();
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-prompt-edit]").forEach((button) => button.addEventListener("click", async () => {
    const form = document.querySelector("#ai-prompt-form");
    const output = form?.querySelector("#ai-prompt-result");
    try {
      const prompt = await getOne("ai_prompts", button.dataset.aiPromptEdit);
      if (!prompt || !form) throw new Error("Prompt wurde nicht gefunden.");
      const values = {
        prompt_id: prompt.id,
        name: prompt.name || "",
        prompt_type: prompt.prompt_type || "",
        description: prompt.description || "",
        system_instructions: prompt.system_instructions || "",
        prompt_text: prompt.prompt_text || "",
        test_input_json: JSON.stringify(parsePromptTestInput(""), null, 2),
        model: prompt.model || "gpt-4.1-mini",
        temperature: prompt.temperature ?? 0.2,
        max_tokens: prompt.max_tokens ?? 1200,
        output_format: prompt.output_format || "json",
        status: prompt.status || "Entwurf",
        change_note: "",
        prompt_seed_text: prompt.prompt_text || prompt.description || "",
        prompt_seed_mode: "free_text",
        prompt_chat_template: ""
      };
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements[name];
        if (!field) return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else field.value = value;
      });
      form.querySelector("[data-prompt-meta-name]").textContent = prompt.name || "Neuer Prompt";
      form.querySelector("[data-prompt-meta-type]").textContent = prompt.prompt_type || "Prompt";
      form.querySelector("[data-prompt-meta-system]").textContent = `${prompt.model || "gpt-4.1-mini"} Â· Temp. ${prompt.temperature ?? 0.2} Â· ${prompt.max_tokens ?? 1200} Tokens`;
      if (form.elements.is_active) form.elements.is_active.checked = Boolean(prompt.is_active);
      form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      if (output) output.innerHTML = `<div class="alert">Prompt geladen. Aendern und mit â€žPrompt speichernâ€œ als neue Version sichern.</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelector("[data-ai-prompt-select]")?.addEventListener("change", async (event) => {
    const select = event.currentTarget;
    const selected = select.selectedOptions?.[0];
    const form = document.querySelector("#ai-prompt-form");
    const output = form?.querySelector("#ai-prompt-result");
    if (!select.value || !selected) return;
    if (!form) return;
    if (selected.dataset.createType) {
      document.querySelector(`[data-ai-prompt-create-type="${CSS.escape(selected.dataset.createType)}"]`)?.click();
      return;
    }
    try {
      const prompt = await getOne("ai_prompts", select.value);
      if (!prompt) throw new Error("Prompt wurde nicht gefunden.");
      const values = {
        prompt_id: prompt.id,
        name: prompt.name || "",
        prompt_type: prompt.prompt_type || "",
        description: prompt.description || "",
        system_instructions: prompt.system_instructions || "",
        prompt_text: prompt.prompt_text || "",
        test_input_json: JSON.stringify(parsePromptTestInput(""), null, 2),
        model: prompt.model || "gpt-4.1-mini",
        temperature: prompt.temperature ?? 0.2,
        max_tokens: prompt.max_tokens ?? 1200,
        output_format: prompt.output_format || "json",
        status: prompt.status || "Entwurf",
        change_note: "",
        prompt_seed_text: prompt.prompt_text || prompt.description || "",
        prompt_seed_mode: "free_text",
        prompt_chat_template: ""
      };
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements[name];
        if (!field) return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else field.value = value;
      });
      const metaName = form.querySelector("[data-prompt-meta-name]");
      const metaType = form.querySelector("[data-prompt-meta-type]");
      const metaSystem = form.querySelector("[data-prompt-meta-system]");
      if (metaName) metaName.textContent = prompt.name || "Neuer Prompt";
      if (metaType) metaType.textContent = prompt.prompt_type || "Prompt";
      if (metaSystem) metaSystem.textContent = `${prompt.model || "gpt-4.1-mini"} - Temp. ${prompt.temperature ?? 0.2} - ${prompt.max_tokens ?? 1200} Tokens`;
      if (form.elements.is_active) form.elements.is_active.checked = Boolean(prompt.is_active);
      if (output) output.innerHTML = `<div class="alert">Prompt gewechselt. Die Ansicht wurde aktualisiert.</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-prompt-create-type]").forEach((button) => button.addEventListener("click", () => {
    const form = document.querySelector("#ai-prompt-form");
    const output = form?.querySelector("#ai-prompt-result");
    if (!form) return;
    const type = button.dataset.aiPromptCreateType || "Beitragstext";
    const name = button.dataset.aiPromptCreateName || `${type} - KI-Redaktion`;
    const seedText = [
      `Die KI soll den Systemschritt "${name}" fuer die KI-Redaktion ausfuehren.`,
      "Sie soll nur mit CMS-Daten, geprueften Quellen und belegbaren Aussagen arbeiten.",
      "Wenn Quellen oder Belege unklar sind, soll sie Warnungen ausgeben und keine Freigabe empfehlen."
    ].join(" ");
    const generated = buildPromptFromSource({
      prompt_type: type,
      prompt_seed_mode: "free_text",
      prompt_chat_template: "",
      prompt_seed_text: seedText
    });
    const values = {
      ...generated,
      prompt_id: "",
      name,
      prompt_type: type,
      prompt_seed_mode: "free_text",
      prompt_chat_template: "",
      prompt_seed_text: seedText
    };
    Object.entries(values).forEach(([fieldName, value]) => {
      const field = form.elements[fieldName];
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value;
    });
    form.querySelector("[data-prompt-meta-name]").textContent = name;
    form.querySelector("[data-prompt-meta-type]").textContent = type;
    form.querySelector("[data-prompt-meta-system]").textContent = `${values.model || "gpt-4.1-mini"} Â· Temp. ${values.temperature ?? 0.2} Â· ${values.max_tokens ?? 1200} Tokens`;
    form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    if (output) output.innerHTML = `<div class="alert">System-Prompt â€ž${escapeHtml(name)}â€œ vorbereitet. Bitte testen und speichern.</div>`;
  }));

  document.querySelectorAll("[data-ai-prompt-delete]").forEach((button) => button.addEventListener("click", async () => {
    const promptId = button.dataset.aiPromptDelete;
    const output = document.querySelector("#ai-prompt-result");
    if (!window.confirm("Diesen Prompt vorsichtig archivieren? Er wird deaktiviert, Versionen und Tests bleiben erhalten. Der System-Fallback uebernimmt danach.")) return;
    try {
      const prompt = await getOne("ai_prompts", promptId);
      if (!prompt) throw new Error("Prompt wurde nicht gefunden.");
      await upsert("ai_prompts", {
        ...prompt,
        is_active: false,
        status: "archiviert",
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser()?.email || currentUser()?.displayName || "local",
        updated_at: new Date().toISOString()
      });
      await upsert("ai_prompt_versions", {
        id: `ai-prompt-versions-${crypto.randomUUID()}`,
        prompt_id: promptId,
        version: Number(prompt.version || 1) + 1,
        prompt_text: prompt.prompt_text || "",
        system_instructions: prompt.system_instructions || "",
        output_format: prompt.output_format || "json",
        model: prompt.model || "gpt-4.1-mini",
        temperature: Number(prompt.temperature ?? 0.2),
        max_tokens: Number(prompt.max_tokens || 1200),
        change_note: "Prompt vorsichtig archiviert. System-Fallback bleibt aktiv.",
        status: "archiviert",
        created_at: new Date().toISOString(),
        created_by: currentUser()?.email || currentUser()?.displayName || "local"
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Prompt wurde archiviert. Versionen und Tests bleiben erhalten; der Fallback-Prompt uebernimmt.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelector("[data-ai-prompt-generate-from-source]")?.addEventListener("click", (event) => {
    const form = event.currentTarget.closest("form");
    const output = form?.querySelector("#ai-prompt-result");
    if (!form) return;
    const values = formObject(form);
    const generated = buildPromptFromSource(values);
    Object.entries(generated).forEach(([name, value]) => {
      const field = form.elements[name];
      if (!field) return;
      field.value = value;
    });
    form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
    if (output) {
      output.innerHTML = `<div class="alert alert--success">Die Eingabe wurde vorbereitet. Die technischen Felder sind automatisch gefuellt und koennen bei Bedarf angepasst werden.</div>`;
    }
  });

  document.querySelector("[data-ai-prompt-test]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const form = button.closest("form");
    const output = form?.querySelector("#ai-prompt-result");
    const values = formObject(form);
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Teste ...";
    try {
      const now = new Date().toISOString();
      const testInput = parsePromptTestInput(values.test_input_json);
      const renderedPrompt = renderPromptPreview(values.prompt_text, testInput);
      const unresolvedPlaceholders = renderedPrompt.match(/\{\{[^}]+\}\}/g) || [];
      const warnings = [
        ...evaluatePromptSafety(values, testInput),
        ...unresolvedPlaceholders.map((placeholder) => `Platzhalter nicht ersetzt: ${placeholder}`)
      ];
      const testStatus = warnings.length ? "Warnung" : "bestanden";
      const promptId = values.name ? `test-${slugify(values.name)}` : `test-prompt-${crypto.randomUUID()}`;
      await upsert("ai_prompt_tests", {
        id: `ai-prompt-test-${crypto.randomUUID()}`,
        prompt_id: promptId,
        prompt_name: values.name || "Unbenannter Prompt",
        prompt_version_id: "",
        test_input_json: testInput,
        test_output_json: {
          rendered_prompt_preview: limitText(renderedPrompt, 1200),
          output_format: values.output_format || "json",
          model: values.model || "",
          safety_result: testStatus
        },
        test_status: testStatus,
        warnings_json: warnings,
        created_at: now,
        created_by: currentUser()?.email || currentUser()?.displayName || "local"
      });
      if (output) {
        output.innerHTML = `<div class="alert ${warnings.length ? "alert--warning" : "alert--success"}"><strong>Prompt-Test: ${escapeHtml(testStatus)}</strong><br>${escapeHtml(warnings.length ? warnings.join(", ") : "Platzhalter ersetzt, Schutzregeln erkannt.")}</div>`;
      }
      window.setTimeout(render, 900);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  document.querySelectorAll("[data-ai-source-review]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-source-review-result");
    try {
      const source = await getOne("verified_sources", button.dataset.aiSourceReview);
      await upsert("verified_sources", {
        ...source,
        review_status: button.dataset.reviewStatus || "in Pruefung",
        updated_at: new Date().toISOString()
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Quellenvorschlag wurde aktualisiert.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelector("#ai-verified-source-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-source-management-result");
    const values = formObject(form);
    const now = new Date().toISOString();
    try {
      const url = new URL(values.url);
      const name = values.name || url.hostname;
      await upsert("verified_sources", {
        id: `verified-source-${slugify(name || url.hostname)}`,
        name,
        domain: url.hostname.replace(/^www\./, ""),
        url: values.url,
        source_type: values.source_type || "Fachquelle",
        source_status: values.source_status || "erlaubt",
        category: values.category || "",
        default_for_categories: values.category ? [values.category] : [],
        trust_score: Number(values.trust_score || 70),
        notes: values.notes || "",
        language: "de/en",
        country: "international",
        priority: Number(values.trust_score || 70) >= 90 ? 1 : 2,
        created_at: now,
        updated_at: now,
        checked_at: now,
        checked_by: currentUser()?.email || currentUser()?.displayName || "local"
      });
      form.reset();
      if (output) output.innerHTML = `<div class="alert alert--success">Quelle wurde hinzugefuegt.</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Quelle konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-source-auto-expand]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-source-management-result");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Erweitere ...";
    try {
      const now = new Date().toISOString();
      const aiSourceCatalog = await getAiSourceCatalog();
      await Promise.all(aiSourceCatalog.map((source) => upsert("verified_sources", {
        ...source,
        source_status: source.source_status || "erlaubt",
        review_status: "freigegeben",
        checked_at: source.checked_at || now,
        checked_by: source.checked_by || "System",
        updated_at: now
      })));
      if (output) output.innerHTML = `<div class="alert alert--success">${aiSourceCatalog.length} Quellen aus dem Systemkatalog wurden uebernommen oder aktualisiert.</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Automatische Erweiterung fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelectorAll("[data-ai-source-delete]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.aiSourceDelete;
    const output = document.querySelector("#ai-source-management-result");
    if (!window.confirm("Diese Quelle aus der aktiven Quellenliste entfernen?")) return;
    try {
      const source = await getOne("verified_sources", id);
      await upsert("verified_sources", {
        ...(source || { id }),
        id,
        source_status: "gesperrt",
        review_status: "geloescht",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Quelle wurde aus der aktiven Liste entfernt.</div>`;
      window.setTimeout(render, 500);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Quelle konnte nicht geloescht werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  }));

  document.querySelectorAll("[data-ai-article-action]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-article-action-result");
    const articleId = button.dataset.articleId;
    const action = button.dataset.aiArticleAction;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "...";
    try {
      const article = await getOne("editorialContent", articleId);
      if (!article) throw new Error("Artikel wurde nicht gefunden.");
      if (/^Themenvorschlag:\s*/i.test(String(article.title || article.headline || ""))) {
        await upsert("editorialContent", {
          ...article,
          title: String(article.title || "").replace(/^Themenvorschlag:\s*/i, ""),
          headline: String(article.headline || article.title || "").replace(/^Themenvorschlag:\s*/i, ""),
          updatedAt: new Date().toISOString()
        });
        article.title = String(article.title || "").replace(/^Themenvorschlag:\s*/i, "");
        article.headline = String(article.headline || article.title || "").replace(/^Themenvorschlag:\s*/i, "");
      }
      const sources = (await list("article_sources")).filter((source) => source.article_id === articleId || source.articleId === articleId);
      const keywords = (await list("article_keywords")).filter((keyword) => keyword.article_id === articleId || keyword.articleId === articleId);
      const hasEnoughSources = sources.filter((source) => source.check_status === "geprueft" && Number(source.trust_score || 0) >= 70).length >= 2;
      const duplicateBlocked = String(article.duplicate_status || "").toLowerCase().includes("dublette");
      let update = { updatedAt: new Date().toISOString() };
      let message = "";
      let status = "warning";

      if (action === "preview") {
        const publicSlug = article.slug || articleId;
        const isPublicArticle = article.visible === true && article.visibility !== "internal" && !["draft", "archived"].includes(String(article.status || "").toLowerCase());
        window.location.hash = isPublicArticle
          ? `#/news/${encodeURIComponent(publicSlug)}`
          : `#/cms/edit?module=editorialContent&id=${encodeURIComponent(articleId)}&section=news`;
        return;
      }

      if (action === "reviewRelease") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const mergedArticle = { ...article, ...formValues };
        const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(String(mergedArticle.bodyText || ""));
        const checkedSources = sources.filter((source) => source.check_status === "geprueft" && Number(source.trust_score || 0) >= 70);
        const blockers = [
          checkedSources.length >= 2 ? "" : "Mindestens zwei gepruefte Quellen mit Trust-Score ab 70 fehlen.",
          duplicateBlocked ? "Dublettenstatus blockiert die Freigabe." : "",
          mergedArticle.headline || mergedArticle.title ? "" : "Headline fehlt.",
          mergedArticle.subline || mergedArticle.subtitle ? "" : "Subline fehlt.",
          mergedArticle.bodyText || mergedArticle.body ? "" : "Haupttext fehlt.",
          mergedArticle.primary_keyword || keywords.length ? "" : "Keywords fehlen.",
          unresolvedDraft ? "Arbeitsentwurf oder fehlende Belegstellen im Text erkannt." : ""
        ].filter(Boolean);
        const publicationTarget = formValues.publication_target || article.publication_target || "news";
        const targetLabel = publicationTarget === "monthly_topic" ? "Thema des Monats" : publicationTarget === "topic" ? "Langfristiges Thema" : "Daily News / News";
        document.querySelector(".ai-dialog-backdrop")?.remove();
        const wrapper = document.createElement("div");
        wrapper.className = "ai-dialog-backdrop";
        wrapper.innerHTML = `<div class="ai-dialog ai-release-dialog" role="dialog" aria-modal="true">
          <div class="actions" style="justify-content:space-between"><div><p class="eyebrow">Freigabepruefung</p><h2>${escapeHtml(mergedArticle.headline || mergedArticle.title || "KI-Beitrag")}</h2></div><button type="button" class="link-button" data-ai-close>Schliessen</button></div>
          <div class="ai-release-grid">
            <section class="ai-release-card"><h3>Pflichtstatus</h3><div class="ai-status-stack"><span class="ai-status ${checkedSources.length >= 2 ? "ai-status--success" : "ai-status--danger"}">Quellen ${checkedSources.length}/2</span><span class="ai-status ${duplicateBlocked ? "ai-status--danger" : "ai-status--success"}">${duplicateBlocked ? "Dublette" : "Keine Dublette"}</span><span class="ai-status ${blockers.length ? "ai-status--warning" : "ai-status--success"}">${blockers.length ? "Pruefpflichtig" : "Freigabefaehig"}</span></div></section>
            <section class="ai-release-card"><h3>Veroeffentlichungsziel</h3><p>${escapeHtml(targetLabel)}</p><small>Veroeffentlicht wird danach im Meta-Bereich oder ueber die redaktionelle News-/Themenverwaltung.</small></section>
            <section class="ai-release-card"><h3>Quellen</h3>${sources.length ? sources.map((source) => `<p><strong>${escapeHtml(source.publisher || source.title || "Quelle")}</strong><br><small>${escapeHtml(source.domain || source.url || "")} Â· Trust ${Number(source.trust_score || 0)} Â· ${escapeHtml(source.check_status || "ungeprueft")}</small></p>`).join("") : `<p class="muted">Keine Quellen gespeichert.</p>`}</section>
            <section class="ai-release-card"><h3>Keywords</h3>${keywords.length ? `<div class="ai-keyword-cloud">${keywords.slice(0, 8).map((keyword) => `<span>${escapeHtml(keyword.keyword)} <strong>${Number(keyword.relevance_score || 0)}</strong></span>`).join("")}</div>` : `<p class="muted">Keine Keywords gespeichert.</p>`}</section>
          </div>
          ${blockers.length ? `<div class="alert alert--warning"><strong>Freigabe noch blockiert:</strong><ul>${blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : `<div class="alert alert--success">Alle zentralen Freigaberegeln sind erfuellt. Der Beitrag kann redaktionell freigegeben werden.</div>`}
          <div class="actions"><button type="button" class="button button--primary" data-ai-release-confirm ${blockers.length ? "disabled" : ""}>Freigabe setzen</button><button type="button" class="button button--secondary" data-ai-close>Zurueck zum Editor</button></div>
        </div>`;
        document.body.appendChild(wrapper);
        wrapper.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => wrapper.remove()));
        wrapper.querySelector("[data-ai-release-confirm]")?.addEventListener("click", async (event) => {
          const confirmButton = event.currentTarget;
          confirmButton.disabled = true;
          confirmButton.textContent = "Speichere ...";
          const now = new Date().toISOString();
          await upsert("editorialContent", {
            ...article,
            title: formValues.headline || article.title || article.headline || "",
            headline: formValues.headline || article.headline || article.title || "",
            subtitle: formValues.subline || article.subline || article.subtitle || "",
            subline: formValues.subline || article.subline || article.subtitle || "",
            bodyText: formValues.bodyText || article.bodyText || article.body || "",
            introText: formValues.introText || article.introText || article.shortText || "",
            source_status: "geprueft",
            ai_check_status: "bestanden",
            publication_status: "freigegeben",
            final_check_json: { status: "bestanden", blockers: [], checked_at: now },
            updatedAt: now
          });
          await writeAiArticleLog(articleId, "success", "Beitrag wurde ueber Freigabe-Overlay redaktionell freigegeben.", {
            usedSources: sources,
            sourceCheck: { source_status: "geprueft", checkedSources: checkedSources.length },
            keywordResult: keywords,
            aiCheck: { status: "bestanden" }
          });
          const dialog = wrapper.querySelector(".ai-dialog");
          if (dialog) {
            dialog.innerHTML = `<div class="alert alert--success"><strong>OK.</strong> Freigabe wurde gesetzt.</div>`;
          }
          if (output) output.innerHTML = `<div class="alert alert--success">Beitrag wurde freigegeben. Veroeffentlichen erfolgt im Meta-Bereich oder spaeter in der Redaktion.</div>`;
          window.setTimeout(() => {
            wrapper.remove();
            render();
          }, 850);
        });
        return;
      }

      if (action === "sources") {
        update.source_status = sources.length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen";
        message = sources.length ? "Quellenhinweise wurden als redaktionelle Information gespeichert." : "Quelle bitte redaktionell pruefen.";
        status = "success";
      }

      if (action === "mapClaims") {
        if (!sources.length) {
          update.source_status = "Quelle bitte redaktionell pruefen";
          message = "Keine Quelle hinterlegt. Quelle bitte redaktionell pruefen.";
          status = "warning";
        } else {
          const bodyLead = String(article.bodyText || article.body || "").split(/[.!?]\s/).filter(Boolean).slice(0, 2).join(". ");
          await Promise.all(sources.map((source, index) => upsert("article_sources", {
            ...source,
            claim_reference: source.claim_reference && source.claim_reference !== "Noch keine finale zentrale Aussage erzeugt."
              ? source.claim_reference
              : index === 0
                ? (bodyLead || "Einordnung des Themas fuer die digitale Medienwirtschaft.")
                : "Branchenrelevanz, technische oder regulatorische Einordnung.",
            relevance_note: source.relevance_note || "Quelle wurde dem Artikel fuer die redaktionelle Belegpruefung zugeordnet.",
            check_status: Number(source.trust_score || 0) >= 70 ? "geprueft" : "teilweise geprueft",
            updated_at: new Date().toISOString()
          })));
          update.source_status = "Quelle vorhanden";
          update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
          message = "Quellenhinweise wurden dem Beitrag zugeordnet.";
          status = "success";
        }
      }

      if (action === "keywords") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const generatedKeywords = localEditorialKeywords({ ...article, ...formValues }, article.tags || []);
        const fallbackKeywords = generatedKeywords.length ? generatedKeywords : localEditorialKeywords(article, ["TV", "Streaming", "Medienbranche", "Produktion", "Plattformregulierung"]);
        const existing = new Set(keywords.map((keyword) => String(keyword.keyword || "").toLowerCase()));
        const keywordsToSave = fallbackKeywords.filter((keyword) => !existing.has(String(keyword.keyword || keyword).toLowerCase()));
        await Promise.all(keywordsToSave.map((keyword, index) => upsert("article_keywords", {
          id: `article-keyword-${crypto.randomUUID()}`,
          article_id: articleId,
          keyword: keyword.keyword || keyword,
          keyword_type: keyword.keyword_type || (index === 0 ? "Hauptkeyword" : "Branchenkeyword"),
          relevance_score: keyword.relevance_score || (index === 0 ? 95 : 72),
          is_primary: Boolean(keyword.is_primary || index === 0),
          explanation: keyword.explanation || "Automatisch aus Artikelinhalt nacherzeugt.",
          ai_generated: true,
          manually_confirmed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })));
        update.primary_keyword = article.primary_keyword || fallbackKeywords[0]?.keyword || fallbackKeywords[0] || "";
        update.tags = Array.from(new Set([...(Array.isArray(article.tags) ? article.tags : []), ...fallbackKeywords.map((keyword) => keyword.keyword || keyword)]));
        update.keyword_json = fallbackKeywords;
        const seoPayload = localSeoPayload({ ...article, ...formValues }, fallbackKeywords);
        update.seoKeywords = seoPayload.seoKeywords;
        update.seo_keywords = seoPayload.seo_keywords;
        const keywordCloud = document.querySelector("#ai-editor-section-keywords .ai-keyword-cloud");
        if (keywordCloud) {
          keywordCloud.innerHTML = fallbackKeywords.map((keyword) => `<span>${escapeHtml(keyword.keyword || keyword)} <strong>${Number(keyword.relevance_score || 70)}</strong></span>`).join("");
        }
        message = `${keywordsToSave.length ? keywordsToSave.length : fallbackKeywords.length} Keywords wurden automatisch erzeugt und gespeichert.`;
        status = "success";
      }

      if (action === "compareRewrite") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const existingText = String(formValues.bodyText || article.bodyText || article.body || "").trim();
        const suggestedText = String(article.ai_original_suggested_text || article.aiOriginalSuggestedText || article.source_suggested_text || "").trim();
        const preparedText = existingText || suggestedText || safeLocalArticleDraft(article, sources, keywords);
        if (output) output.innerHTML = `<div class="alert">${progressMarkup("Beitragstext-Prompt wird angewendet ...", 55)}</div>`;
        let revisedText = "";
        try {
          revisedText = await generateAiArticleBodyWithNewsPrompt({
            article: {
              ...article,
              bodyText: existingText || preparedText,
              ai_original_suggested_text: suggestedText || preparedText,
              source_suggested_text: article.source_suggested_text || suggestedText || preparedText
            },
            formValues: { ...formValues, bodyText: existingText || preparedText },
            sources,
            keywords
          });
        } catch (error) {
          console.warn("Cloud-Neufassung nicht erreichbar, lokale Arbeitsfassung genutzt.", error);
          revisedText = neutralEditorialRewrite({
            sourceText: preparedText,
            headline: formValues.headline || article.headline || article.title || "",
            subline: formValues.subline || article.subline || article.subtitle || "",
            targetWords: Math.max(180, Math.min(520, countWords(preparedText) || 360))
          });
          if (output) output.innerHTML = `<div class="alert">Cloud-KI ist gerade nicht erreichbar. Eine lokale Arbeitsfassung wurde geoeffnet.</div>`;
        }
        showAiArticleRewriteDialog({
          article: {
            ...article,
            bodyText: existingText || preparedText,
            ai_original_suggested_text: suggestedText || preparedText,
            source_suggested_text: article.source_suggested_text || suggestedText || preparedText
          },
          formValues: { ...formValues, bodyText: existingText || preparedText },
          sources,
          keywords,
          revisedText
        });
        if (output && revisedText) output.innerHTML = `<div class="alert alert--success">Neufassung wurde vorbereitet.</div>`;
        return;
      }

      if (action === "thumbnail") {
        if (output) output.innerHTML = `<div class="alert">${progressMarkup("Thumbnail wird erzeugt ...", 45)}</div>`;
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const articleForThumbnail = {
          ...article,
          thumbnail_idea: formValues.thumbnail_idea || article.thumbnail_idea || article.thumbnailIdea || "",
          thumbnail_prompt: formValues.thumbnail_prompt || article.thumbnail_prompt || article.thumbnailPrompt || "",
          headline: formValues.headline || article.headline || article.title || "",
          title: formValues.headline || article.title || article.headline || "",
          subline: formValues.subline || article.subline || article.subtitle || "",
          category: formValues.category || article.category || ""
        };
        let thumbnailUrl = "";
        let generatedPrompt = articleForThumbnail.thumbnail_prompt || "";
        try {
          const generated = await generateAiEditorialThumbnail(articleForThumbnail);
          thumbnailUrl = generated?.imageDataUrl || "";
          generatedPrompt = generated?.prompt || generatedPrompt;
        } catch (thumbnailError) {
          console.warn("KI-Thumbnail nicht verfuegbar, lokaler Fallback wird genutzt.", thumbnailError);
        }
        if (!thumbnailUrl || isOversizedInlineImage(thumbnailUrl)) thumbnailUrl = generateLocalEditorialThumbnail(articleForThumbnail);
        update.imageUrl = thumbnailUrl;
        update.thumbnail_url = thumbnailUrl;
        update.thumbnail_idea = articleForThumbnail.thumbnail_idea || "Serioeses redaktionelles Vorschaubild fuer die digitale Medienwirtschaft.";
        update.thumbnail_prompt = generatedPrompt || defaultAiEditorialThumbnailPrompt;
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
        message = "Thumbnail wurde lokal erzeugt und am Artikel gespeichert.";
        status = "success";
      }

      if (action === "seo") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const generatedKeywords = keywords.length ? keywords : localEditorialKeywords({ ...article, ...formValues }, article.tags || []);
        Object.assign(update, localSeoPayload({ ...article, ...formValues }, generatedKeywords));
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
        message = "SEO-Titel, Meta-Beschreibung, Slug und SEO-Keywords wurden automatisch erzeugt.";
        status = "success";
      }

      if (action === "draftText") {
        update.bodyText = safeLocalArticleDraft(article, sources, keywords);
        update.ai_check_status = "vorbereitet";
        update.publication_status = "Entwurf";
        update.final_check_json = {
          status: "Warnung",
          blockers: [],
          note: "Lokaler Arbeitsentwurf erzeugt. Redaktion entscheidet ueber weitere Bearbeitung."
        };
        message = "Redaktioneller Arbeitsentwurf wurde vorbereitet.";
        status = "success";
      }

      if (action === "headline") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const bodyLead = String(formValues.bodyText || article.bodyText || article.body || "").split(/(?<=[.!?])\s+/).find(Boolean) || "";
        const rawHeadline = String(formValues.headline || article.headline || article.title || bodyLead || article.category || "PROdigitalTV Beitrag").replace(/^Themenvorschlag:\s*/i, "");
        const cleanHeadline = limitText(rawHeadline, 72);
        update.title = cleanHeadline;
        update.headline = cleanHeadline;
        update.slug = article.slug || slugify(cleanHeadline);
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
        message = "Headline wurde vorbereitet.";
        status = "success";
      }

      if (action === "optimizeText") {
        const optimized = optimizeLocalEditorialText(article.bodyText || article.body || "");
        if (!optimized) {
          message = "Textoptimierung nicht moeglich: Beitragstext fehlt.";
          status = "warning";
        } else {
          update.bodyText = optimized;
          update.ai_check_status = "vorbereitet";
          update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
          message = "Text wurde redaktionell geglaettet.";
          status = "success";
        }
      }

      if (action === "summary") {
        const summary = summarizeLocalEditorialText(article);
        update.subline = summary;
        update.subtitle = summary;
        update.seoDescription = localSeoDescription({ ...article, subline: summary });
        update.seo_description = update.seoDescription;
        update.ai_check_status = "vorbereitet";
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
        message = "Zusammenfassung wurde als Subline und Meta-Beschreibung vorbereitet.";
        status = "success";
      }

      if (action === "confirmClaims") {
        if (!hasEnoughSources) {
          update.source_status = sources.length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen";
          update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
          update.ai_check_status = "vorbereitet";
          message = "Quelle bitte redaktionell pruefen.";
          status = "warning";
        } else {
          const cleanBody = String(article.bodyText || "")
            .replace(/Dieser Arbeitsentwurf fasst noch keine externen Fakten als gesichert zusammen\.?\s*/i, "")
            .replace(/Dieser Text ist deshalb nur ein redaktioneller Arbeitsentwurf\. Belegstellen fehlen noch auf Aussage-Ebene\.?\s*/i, "")
            .replace(/Eine automatische Veroeffentlichung bleibt blockiert, bis Quellen, Dubletten, Keywords, KI-Pruefung und redaktionelle Freigabe vollstaendig bestanden sind\.?/i, "Die Redaktion hat die Belegstellen im CMS geprueft. Die Veroeffentlichung bleibt an die weiteren Statuspruefungen gebunden.");
          update.bodyText = cleanBody;
          update.source_status = "geprueft";
          update.final_check_json = {
            status: "Belege redaktionell bestaetigt",
            blockers: [],
            note: "Manuelle Bestaetigung im lokalen CMS-Workflow."
          };
          message = "Quellenhinweise wurden redaktionell bestaetigt.";
          status = "success";
        }
      }

      if (action === "check") {
        const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(String(article.bodyText || ""));
        update.source_status = sources.length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen";
        update.ai_check_status = "vorbereitet";
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf";
        message = "Beitrag ist als Entwurf vorbereitet. Die Redaktion entscheidet ueber Bearbeitung und Veroeffentlichung.";
        status = "success";
      }

      if (action === "approve") {
        update.source_status = sources.length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen";
        update.ai_check_status = "vorbereitet";
        update.publication_status = "freigegeben";
        message = "Beitrag wurde redaktionell freigegeben.";
        status = "success";
      }

      if (action === "publish") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const publicationTarget = formValues.publication_target || article.publication_target || article.publicationTarget || "news";
        if (publicationTarget === "topic" || publicationTarget === "monthly_topic") {
          const cleanTitle = String(formValues.headline || article.headline || article.title || "KI-Thema").replace(/^Themenvorschlag:\s*/i, "").trim();
          const topicId = article.published_topic_id || article.topic_id || article.slug || slugify(cleanTitle) || `ki-topic-${crypto.randomUUID()}`;
          await upsert("topics", {
            id: topicId,
            title: cleanTitle,
            subtitle: formValues.subline || article.subline || article.subtitle || "",
            shortDescription: formValues.introText || article.introText || article.shortText || formValues.subline || article.subline || article.subtitle || "",
            longDescription: formValues.bodyText || article.bodyText || article.body || "",
            introText: formValues.introText || article.introText || article.shortText || "",
            shortText: formValues.introText || article.introText || article.shortText || "",
            category: formValues.category || article.category || "Thema",
            imageUrl: article.imageUrl || article.thumbnail_url || article.thumbnailUrl || "",
            galleryId: article.galleryId || "",
            status: "active",
            visibility: "public",
            publishDate: new Date().toISOString().slice(0, 10),
            validFrom: new Date().toISOString().slice(0, 10),
            sourceAiArticleId: articleId,
            editorialFormat: publicationTarget,
            isMonthlyTopic: publicationTarget === "monthly_topic",
            tags: Array.isArray(article.tags) ? article.tags : [],
            updatedAt: new Date().toISOString()
          });
          update.status = "draft";
          update.visibility = "internal";
          update.publication_target = publicationTarget;
          update.published_topic_id = topicId;
          update.publication_status = "veroeffentlicht";
          update.published_at = new Date().toISOString();
          message = publicationTarget === "monthly_topic" ? "Beitrag wurde als Thema des Monats veroeffentlicht." : "Beitrag wurde als langfristiges Thema veroeffentlicht.";
          status = "success";
        } else {
          update.status = "published";
          update.visibility = "public";
          update.page = "news";
          update.section = "news";
          update.key = article.key || `news.${articleId}`;
          update.introText = formValues.introText || article.introText || article.shortText || "";
          update.shortText = formValues.introText || article.introText || article.shortText || "";
          update.teaserText = formValues.introText || article.introText || article.shortText || "";
          update.publication_target = "news";
          update.publication_status = "veroeffentlicht";
          update.published_at = new Date().toISOString();
          update.publishDate = new Date().toISOString().slice(0, 10);
          message = "Beitrag wurde als News veroeffentlicht.";
          status = "success";
        }
      }

      if (action === "block") {
        update.status = "draft";
        update.visibility = "internal";
        update.publication_status = "Entwurf";
        update.ai_check_status = "vorbereitet";
        message = "Beitrag wurde als interner Entwurf gespeichert.";
        status = "success";
      }

      await upsert("editorialContent", { ...article, ...update });
      await writeAiArticleLog(articleId, status, message, {
        usedSources: sources,
        sourceCheck: { source_status: update.source_status || article.source_status || "", checkedSources: sources.length },
        duplicateCheck: { duplicate_status: article.duplicate_status || "" },
        keywordResult: keywords,
        aiCheck: { status: update.ai_check_status || article.ai_check_status || "" }
      });
      if (output) output.innerHTML = `<div class="alert ${status === "success" ? "alert--success" : "alert--warning"}">${escapeHtml(message)}</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("#ai-article-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-article-save-result");
    const articleId = form.dataset.articleId;
    const values = formObject(form);
    const cleanHeadline = String(values.headline || "").replace(/^Themenvorschlag:\s*/i, "").trim();
    try {
      const article = await getOne("editorialContent", articleId);
      if (!article) throw new Error("Artikel wurde nicht gefunden.");
      const updated = {
        ...article,
        title: cleanHeadline,
        headline: cleanHeadline,
        subtitle: values.subline || "",
        subline: values.subline || "",
        category: values.category || "",
        publication_target: values.publication_target || article.publication_target || "news",
        page: article.page || "news",
        section: article.section || "news",
        key: article.key || `news.${articleId}`,
        primary_keyword: values.primary_keyword || "",
        bodyText: values.bodyText || "",
        ai_original_suggested_text: article.ai_original_suggested_text || article.aiOriginalSuggestedText || article.source_suggested_text || article.bodyText || article.body || values.bodyText || "",
        source_suggested_text: article.source_suggested_text || article.ai_original_suggested_text || article.aiOriginalSuggestedText || article.bodyText || article.body || values.bodyText || "",
        introText: values.introText || "",
        shortText: values.introText || "",
        teaserText: values.introText || "",
        thumbnail_idea: values.thumbnail_idea || "",
        thumbnail_prompt: values.thumbnail_prompt || "",
        slug: values.slug || slugify(cleanHeadline),
        seoTitle: values.seoTitle || "",
        seo_title: values.seoTitle || "",
        seoDescription: values.seoDescription || "",
        seo_description: values.seoDescription || "",
        seoKeywords: values.seoKeywords || "",
        seo_keywords: values.seoKeywords || "",
        publication_status: article.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf",
        ai_check_status: article.publication_status === "veroeffentlicht" ? article.ai_check_status : "vorbereitet",
        updatedAt: new Date().toISOString()
      };
      await upsert("editorialContent", updated);
      await writeAiArticleLog(articleId, "success", "Artikel wurde manuell bearbeitet und als Entwurf gespeichert.", {
        aiCheck: { status: updated.ai_check_status },
        sourceCheck: { source_status: updated.source_status || "" }
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Aenderungen gespeichert.</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: { id: articleId } }));
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || String(error))}</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-save-failed", { detail: { error } }));
    }
  });

  document.querySelector("#ai-article-source-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-source-save-result");
    const articleId = form.dataset.articleId;
    const values = formObject(form);
    const url = String(values.url || "").trim();
    const domain = domainFromUrl(url);
    if (!domain) {
      if (output) output.innerHTML = `<div class="alert alert--error">Bitte eine gueltige URL eintragen. Quellen duerfen nicht erfunden werden.</div>`;
      return;
    }
    try {
      const now = new Date().toISOString();
      await upsert("article_sources", {
        id: `article-source-${crypto.randomUUID()}`,
        article_id: articleId,
        title: values.title || "",
        publisher: values.publisher || "",
        domain,
        url,
        source_type: values.source_type || "Quelle",
        published_at: "",
        accessed_at: now,
        relevance_note: values.relevance_note || "",
        claim_reference: values.claim_reference || "",
        trust_score: Number(values.trust_score || 0),
        check_status: values.check_status || "ungeprueft",
        created_at: now,
        updated_at: now
      });

      const article = await getOne("editorialContent", articleId);
      const articleSources = (await list("article_sources")).filter((source) => source.article_id === articleId || source.articleId === articleId);
      const checkedSources = articleSources.filter((source) => source.check_status === "geprueft" && Number(source.trust_score || 0) >= 70);
      const sourceStatus = articleSources.length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen";

      await upsert("editorialContent", {
        ...(article || { id: articleId }),
        source_status: sourceStatus,
        publication_status: article?.publication_status === "veroeffentlicht" ? article.publication_status : "Entwurf",
        ai_check_status: article?.publication_status === "veroeffentlicht" ? article.ai_check_status : "vorbereitet",
        updatedAt: now
      });
      await writeAiArticleLog(articleId, "success", "Quelle wurde manuell erfasst. Quellenhinweis aktualisiert.", {
        usedSources: articleSources,
        sourceCheck: { source_status: sourceStatus, checkedSources: checkedSources.length }
      });
      if (output) {
        output.innerHTML = `<div class="alert alert--success">Quelle gespeichert. Die Redaktion entscheidet ueber die weitere Verwendung.</div>`;
      }
      form.reset();
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Quelle konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#ai-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
    const payload = formObject(form);
    payload.allowedRoles = [payload.allowAdmin ? "admin" : "", payload.allowEditor ? "editor" : ""].filter(Boolean);
    payload.enabled = Boolean(payload.enabled);
    payload.loggingEnabled = Boolean(payload.loggingEnabled);
    delete payload.allowAdmin;
    delete payload.allowEditor;
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "saveAiSettings");
    await callable(payload);
    form.querySelector("#ai-settings-result").innerHTML = `<div class="alert alert--success">ChatGPT-Einstellungen wurden gespeichert.</div>`;
  });

  document.querySelector("#ai-test-connection")?.addEventListener("click", async () => {
    const output = document.querySelector("#ai-settings-result");
    try {
      const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "testOpenAiConnection");
      const result = await callable({});
      output.innerHTML = `<div class="alert alert--success">Verbindung erfolgreich: ${escapeHtml(result.data.preview || "ok")}</div>`;
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#audio-provider-config-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const output = form.querySelector("#ai-access-result");
    try {
      const values = formObject(form);
      await saveProviderConfig({
        enabled: Boolean(values.enabled),
        modelId: values.modelId,
        voiceId: values.voiceId,
        voiceName: values.voiceName
      });
      if (output) output.innerHTML = `<div class="alert alert--success">ElevenLabs-Konfiguration gespeichert. API-Keys bleiben serverseitige Firebase Secrets.</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-audio-provider-test]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-access-result") || document.querySelector("#ai-access-test-result");
    const form = document.querySelector("#audio-provider-config-form");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Teste ...";
    try {
      await testAudioProviderConnection(button.dataset.audioProviderTest || "elevenlabs");
      if (form) {
        const enabled = form.querySelector('input[name="enabled"]');
        if (enabled) enabled.checked = true;
        const values = formObject(form);
        await saveProviderConfig({
          enabled: true,
          modelId: values.modelId,
          voiceId: values.voiceId,
          voiceName: values.voiceName
        });
      }
      if (output) output.innerHTML = `<div class="alert alert--success">ElevenLabs-Verbindung erfolgreich. Anbieter wurde aktiviert und gespeichert.</div>`;
      window.setTimeout(render, 900);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("[data-audio-provider-load-voices]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const form = button.closest("form");
    const output = form?.querySelector("#ai-access-result");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Lade Stimmen ...";
    try {
      const result = await loadAudioProviderVoices("elevenlabs", true);
      const select = form?.querySelector("[data-elevenlabs-voice-select]");
      if (select) {
        select.innerHTML = `<option value="">Stimme waehlen</option>${(result.voices || []).map((voice) => `<option value="${escapeHtml(voice.voiceId)}" data-voice-name="${escapeHtml(voice.voiceName)}">${escapeHtml(voice.voiceName)} (${escapeHtml(voice.voiceId)})</option>`).join("")}`;
      }
      if (output) output.innerHTML = `<div class="alert alert--success">${Number(result.voices?.length || 0)} ElevenLabs-Stimmen geladen.</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  document.querySelector("[data-audio-provider-preview]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const form = button.closest("form");
    const output = form?.querySelector("#ai-access-result");
    const preview = form?.querySelector("[data-audio-provider-preview-player]");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Erzeuge Leseprobe ...";
    try {
      const values = formObject(form);
      const result = await previewAudioProviderVoice({
        modelId: values.modelId,
        voiceId: values.voiceId,
        voiceName: values.voiceName,
        text: values.previewText
      });
      const src = `data:${result.mimeType || "audio/mpeg"};base64,${result.audioBase64}`;
      if (preview) {
        preview.src = src;
        preview.hidden = false;
        await preview.play().catch(() => {});
      }
      if (output) output.innerHTML = `<div class="alert alert--success">Leseprobe erzeugt: ${escapeHtml(result.voiceName || values.voiceName || "Stimme")}</div>`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  document.querySelector("[data-elevenlabs-voice-select]")?.addEventListener("change", (event) => {
    const option = event.currentTarget.selectedOptions?.[0];
    const form = event.currentTarget.closest("form");
    const voiceId = form?.querySelector("[data-elevenlabs-voice-id]");
    const voiceName = form?.querySelector("[data-elevenlabs-voice-name]");
    if (voiceId) voiceId.value = option?.value || "";
    if (voiceName) voiceName.value = option?.dataset.voiceName || "";
  });

  const registrationForm = document.querySelector("#registration-form");
  registrationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = registrationForm.querySelector("#form-result");
    try {
      await createRegistration(registrationForm.dataset.eventId, formObject(registrationForm));
      result.innerHTML = `<div class="alert alert--success">Vielen Dank. Bitte pruefen Sie Ihre E-Mail und bestaetigen Sie die Anmeldung ueber den zugesandten Link.</div>`;
      registrationForm.querySelector("button[type=submit]").disabled = true;
    } catch (error) {
      result.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const values = formObject(form);
      const user = await login(values.email, values.password, values.role);
      const returnTarget = loginReturnTarget();
      go(returnTarget || (["admin", "editor"].includes(user.role) ? "cms" : "portal"));
    } catch (error) {
      form.querySelector("#login-result").innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#google-login-button")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const form = document.querySelector("#login-form");
    try {
      const values = formObject(form);
      const user = await loginWithGoogle(values.role);
      const returnTarget = loginReturnTarget();
      go(returnTarget || (["admin", "editor"].includes(user.role) ? "cms" : "portal"));
    } catch (error) {
      form.querySelector("#login-result").innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#bootstrap-admin-button")?.addEventListener("click", async () => {
    const output = document.querySelector("#bootstrap-admin-result");
    output.innerHTML = `<div class="alert">Admin-Freischaltung wird geprueft ...</div>`;
    try {
      const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "bootstrapFirstAdmin");
      await callable({});
      await refreshAuthToken(true);
      output.innerHTML = `<div class="alert alert--success">Erster Admin wurde freigeschaltet. CMS wird geoeffnet ...</div>`;
      go("cms");
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await logout();
    go("home");
  });

  document.querySelectorAll("[data-event-tab]").forEach((button) => button.addEventListener("click", async () => {
    const form = document.querySelector("#event-edit-form");
    if (form?.dataset.eventId === button.dataset.eventId && form.dataset.eventFormSection === "pre") {
      const saved = await saveEventEditForm(form, { silent: true });
      if (!saved) return;
    }
    go(`cms/event/${button.dataset.eventId}?tab=${button.dataset.eventTab}`);
  }));

  let draggedTopicCard = null;
  document.querySelectorAll("[data-topic-drag-id]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      draggedTopicCard = card;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.topicDragId);
    });
    card.addEventListener("dragend", async () => {
      card.classList.remove("is-dragging");
      document.querySelectorAll("[data-topic-drag-id]").forEach((item) => item.classList.remove("is-drop-target"));
      const cards = Array.from(document.querySelectorAll("[data-topic-drag-id]"));
      const topicIds = cards.map((item) => item.dataset.topicDragId);
      const eventId = card.dataset.eventId;
      const existingEvent = await getOne("events", eventId);
      await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
      draggedTopicCard = null;
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!draggedTopicCard || draggedTopicCard === card) return;
      card.classList.add("is-drop-target");
      const list = card.parentElement;
      const rect = card.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      list.insertBefore(draggedTopicCard, after ? card.nextSibling : card);
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
  });

  async function upsertEventRetrospectiveArticle(sourceEvent = {}, videoAttachments = null) {
    if (!sourceEvent?.id) throw new Error("Event wurde nicht gefunden.");
    const articleId = document.querySelector("[data-retrospective-article-id]")?.value
      || sourceEvent.retrospectiveArticleId
      || eventRetrospectiveArticleId(sourceEvent.id);
    const existingArticle = await getOne("editorialContent", articleId).catch(() => null);
    const title = sourceEvent.retrospectiveTitle || existingArticle?.title || `RÃ¼ckblick: ${sourceEvent.title || "PROdigitalTV Event"}`;
    const eventBodyText = sourceEvent.longDescription || sourceEvent.bodyText || sourceEvent.articleText || sourceEvent.archiveText || "";
    const bodyText = eventBodyText || existingArticle?.longDescription || existingArticle?.articleText || existingArticle?.bodyText || eventRetrospectiveBody(sourceEvent);
    const eventImage = eventRetrospectiveImageUrl(sourceEvent);
    const articleImage = existingArticle?.imageUrl || eventImage;
    const articleAssetId = existingArticle?.thumbnail_media_asset_id || existingArticle?.mediaAssetId || sourceEvent.thumbnail_media_asset_id || sourceEvent.mediaAssetId || "";
    const now = new Date().toISOString();
    const article = {
      ...(existingArticle || { id: articleId, createdAt: now }),
      id: articleId,
      page: "press",
      section: "pressRelease",
      key: existingArticle?.key || `press.${articleId}`,
      category: "RÃ¼ckblicke",
      title,
      headline: title,
      subtitle: existingArticle?.subtitle || sourceEvent.subtitle || "",
      introText: sourceEvent.postEventSummary || sourceEvent.postEventummary || existingArticle?.introText || eventRetrospectiveIntro(sourceEvent),
      longDescription: bodyText,
      bodyText,
      articleText: bodyText,
      archiveText: bodyText,
      body: bodyText,
      status: "published",
      visible: existingArticle?.visible !== false,
      visibility: "public",
      publishDate: existingArticle?.publishDate || sourceEvent.date || new Date().toISOString().slice(0, 10),
      validFrom: existingArticle?.validFrom || sourceEvent.date || new Date().toISOString().slice(0, 10),
      linkedEventId: sourceEvent.id,
      galleryEventId: sourceEvent.id,
      galleryId: existingArticle?.galleryId || sourceEvent.galleryId || "",
      sponsorId: existingArticle?.sponsorId || sourceEvent.hostId || "",
      imageUrl: articleImage,
      thumbnail_url: existingArticle?.thumbnail_url || existingArticle?.thumbnailUrl || articleImage,
      thumbnailUrl: existingArticle?.thumbnailUrl || existingArticle?.thumbnail_url || articleImage,
      assetUrl: existingArticle?.assetUrl || articleImage,
      thumbnail_media_asset_id: articleAssetId,
      mediaAssetId: articleAssetId,
      thumbnail_alt: existingArticle?.thumbnail_alt || sourceEvent.thumbnail_alt || sourceEvent.thumbnailAlt || `Eventbild ${sourceEvent.title || ""}`.trim(),
      videoAttachments: Array.isArray(videoAttachments) ? videoAttachments : (existingArticle?.videoAttachments || []),
      isRetrospective: true,
      showGallery: existingArticle?.showGallery ?? true,
      updatedAt: now
    };
    await upsert("editorialContent", withContentVersionMetadata("editorialContent", existingArticle || {}, article));
    await upsert("events", {
      ...sourceEvent,
      lifecyclePhase: sourceEvent.lifecyclePhase === "archived" ? "archive_published" : (sourceEvent.lifecyclePhase || "archive_published"),
      retrospectiveTitle: title,
      retrospectiveArticleId: articleId,
      updatedAt: now
    });
    return { articleId, article };
  }

  document.querySelectorAll("[data-create-event-retrospective]").forEach((button) => button.addEventListener("click", async () => {
    const eventId = button.dataset.createEventRetrospective;
    const result = document.querySelector("#event-retrospective-result");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Erstelle ...";
    if (result) result.innerHTML = `<div class="alert">Redaktioneller RÃ¼ckblick wird vorbereitet ...</div>`;
    try {
      const sourceEvent = await getOne("events", eventId);
      if (!sourceEvent) throw new Error("Event wurde nicht gefunden.");
      const articleId = document.querySelector("[data-retrospective-article-id]")?.value || eventRetrospectiveArticleId(eventId);
      const existingArticle = await getOne("editorialContent", articleId).catch(() => null);
      const title = existingArticle?.title || `RÃ¼ckblick: ${sourceEvent.title || "PROdigitalTV Event"}`;
      const eventBodyText = sourceEvent.longDescription || sourceEvent.bodyText || sourceEvent.articleText || sourceEvent.archiveText || "";
      const bodyText = eventBodyText || existingArticle?.longDescription || existingArticle?.articleText || existingArticle?.bodyText || eventRetrospectiveBody(sourceEvent);
      const eventImage = eventRetrospectiveImageUrl(sourceEvent);
      const articleImage = existingArticle?.imageUrl || eventImage;
      const articleAssetId = existingArticle?.thumbnail_media_asset_id || existingArticle?.mediaAssetId || sourceEvent.thumbnail_media_asset_id || sourceEvent.mediaAssetId || "";
      const now = new Date().toISOString();
      const article = {
        ...(existingArticle || { id: articleId, createdAt: now }),
        id: articleId,
        page: "press",
        section: "pressRelease",
        key: existingArticle?.key || `press.${articleId}`,
        category: "RÃ¼ckblicke",
        title,
        headline: title,
        subtitle: existingArticle?.subtitle || sourceEvent.subtitle || "",
        introText: existingArticle?.introText || eventRetrospectiveIntro(sourceEvent),
        longDescription: bodyText,
        bodyText,
        articleText: bodyText,
        archiveText: bodyText,
        body: bodyText,
        status: existingArticle?.status || "published",
        visible: existingArticle?.visible !== false,
        visibility: "public",
        publishDate: existingArticle?.publishDate || sourceEvent.date || new Date().toISOString().slice(0, 10),
        validFrom: existingArticle?.validFrom || sourceEvent.date || new Date().toISOString().slice(0, 10),
        linkedEventId: sourceEvent.id,
        galleryEventId: sourceEvent.id,
        galleryId: existingArticle?.galleryId || sourceEvent.galleryId || "",
        sponsorId: existingArticle?.sponsorId || sourceEvent.hostId || "",
        imageUrl: articleImage,
        thumbnail_url: existingArticle?.thumbnail_url || existingArticle?.thumbnailUrl || articleImage,
        thumbnailUrl: existingArticle?.thumbnailUrl || existingArticle?.thumbnail_url || articleImage,
        assetUrl: existingArticle?.assetUrl || articleImage,
        thumbnail_media_asset_id: articleAssetId,
        mediaAssetId: articleAssetId,
        thumbnail_alt: existingArticle?.thumbnail_alt || sourceEvent.thumbnail_alt || sourceEvent.thumbnailAlt || `Eventbild ${sourceEvent.title || ""}`.trim(),
        isRetrospective: true,
        showGallery: existingArticle?.showGallery ?? true,
        updatedAt: now
      };
      await upsert("editorialContent", withContentVersionMetadata("editorialContent", existingArticle || {}, article));
      await upsert("events", {
        ...sourceEvent,
        retrospectiveArticleId: articleId,
        updatedAt: now
      });
      if (result) result.innerHTML = `<div class="alert alert--success">RÃ¼ckblick-Beitrag wurde gespeichert. <a class="link" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(articleId)}&section=press">Beitrag Ã¶ffnen</a></div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">RÃ¼ckblick konnte nicht erstellt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  async function saveEventEditForm(form, { silent = false } = {}) {
    const result = form.querySelector("#event-save-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    const originalLabel = submitButton?.textContent || "";
    if (submitButton && !silent) {
      submitButton.disabled = true;
      submitButton.textContent = "Speichert ...";
    }
    try {
      const existing = (await getOne("events", form.dataset.eventId)) || { id: form.dataset.eventId, topicIds: [], speakerIds: [], sponsorIds: [], status: "draft" };
      const values = formObject(form);
      const formVideoAttachments = form.dataset.eventFormSection === "post" && form.querySelector("[data-video-attachments]")
        ? collectVideoAttachments(form, values)
        : null;
      if (form.dataset.eventFormSection === "pre") {
        const preStatus = values.preStatus || "save_the_date";
        await upsert("events", {
          ...existing,
          preStatus,
          registrationEnabled: preStatus === "invitation_published",
          saveTheDateText: values.saveTheDateText || "",
          invitationText: values.invitationText || "",
          updatedAt: new Date().toISOString()
        });
        if (result && !silent) result.innerHTML = `<div class="alert alert--success">Vorlauf wurde gespeichert.</div>`;
        form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: { id: form.dataset.eventId, section: "pre" } }));
        return true;
      }
      const image = imageFileFromDropzone(form, "eventImage", form.dataset.eventId);
      const removeEventImageRequested = values.removeEventImage === "1";
      const newEventType = values.newEventType?.trim();
      if (image) {
        const asset = await uploadEntityImage("events", form.dataset.eventId, image);
        values.imageUrl = asset.url;
        values.assetStoragePath = asset.storagePath;
        const mediaAsset = await createMediaAssetFromEntityImage({
          collection: "events",
          entity: { ...existing, ...values, id: form.dataset.eventId },
          file: image,
          uploaded: asset,
          field: "imageUrl",
          mediaType: "event"
        });
        if (mediaAsset?.id) {
          values.thumbnail_media_asset_id = mediaAsset.id;
          values.mediaAssetId = mediaAsset.id;
          values.thumbnail_url = asset.url;
          values.thumbnailUrl = asset.url;
          values.assetUrl = asset.url;
          values.assetType = "image";
        }
      }
      if (removeEventImageRequested) {
        values.imageUrl = "";
        values.assetStoragePath = "";
        values.thumbnail_media_asset_id = "";
        values.mediaAssetId = "";
      }
      if (newEventType) {
        const eventTypesSetting = (await getOne("settings", "eventTypes")) || {
          id: "eventTypes",
          key: "eventTypes",
          group: "events",
          value: []
        };
        const eventTypes = Array.isArray(eventTypesSetting.value) ? eventTypesSetting.value : [];
        const nextEventTypes = Array.from(new Set([...eventTypes, newEventType])).sort((a, b) => a.localeCompare(b, "de"));
        await upsert("settings", {
          ...eventTypesSetting,
          value: nextEventTypes,
          description: "Eventtypen fuer CMS-Auswahl"
        });
        values.eventType = newEventType;
      }
      delete values.eventImage;
      delete values.removeEventImage;
      delete values.eventImageDataUrl;
      delete values.eventImageFileName;
      delete values.newEventType;
      if (Object.prototype.hasOwnProperty.call(values, "longDescription")) {
        values.bodyText = values.longDescription;
        values.articleText = values.longDescription;
        values.archiveText = values.longDescription;
      }
      const savedEvent = await upsert("events", { ...existing, ...values });
      let retrospectiveArticleId = "";
      if (form.dataset.eventFormSection === "post") {
        const retrospective = await upsertEventRetrospectiveArticle(savedEvent, formVideoAttachments);
        retrospectiveArticleId = retrospective.articleId;
      }
      if (image || removeEventImageRequested) updateDropzoneSavedImage(form, savedEvent.imageUrl || "");
      if (result && !silent) result.innerHTML = retrospectiveArticleId
        ? `<div class="alert alert--success">RÃ¼ckblicktext und Ã¶ffentlicher RÃ¼ckblick wurden gespeichert. <a class="link" href="#/retrospective/${encodeURIComponent(retrospectiveArticleId)}">RÃ¼ckblick ansehen</a></div>`
        : `<div class="alert alert--success">Event wurde gespeichert.</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: { id: savedEvent.id || form.dataset.eventId, section: form.dataset.eventFormSection || "base", retrospectiveArticleId } }));
      return true;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Event konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-save-failed", { detail: { error } }));
      return false;
    } finally {
      if (submitButton && !silent) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  }

  document.querySelector("#event-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEventEditForm(event.currentTarget);
  });

  document.querySelector("#event-speakers-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const speakerIds = Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value);
    await upsert("events", { ...existing, speakerIds });
    form.querySelector("#speaker-assignment-result").innerHTML = `<div class="alert alert--success">Referentenzuordnung wurde gespeichert.</div>`;
  });

  document.querySelector("#event-topic-assignment-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const topicIds = Array.from(form.querySelectorAll('input[name="topicIds"]:checked')).map((input) => input.value);
    const speakerIds = Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value);
    const topics = await list("topics");
    const speakers = await list("speakers");
    for (const topic of topics) {
      if (!form.elements[`edit-topic-${topic.id}-title`]) continue;
      await upsert("topics", {
        ...topic,
        title: form.elements[`edit-topic-${topic.id}-title`].value,
        shortDescription: form.elements[`edit-topic-${topic.id}-shortDescription`].value,
        updatedAt: new Date().toISOString()
      });
    }
    for (const speaker of speakers) {
      if (!form.elements[`edit-speaker-${speaker.id}-name`]) continue;
      await upsert("speakers", {
        ...speaker,
        name: form.elements[`edit-speaker-${speaker.id}-name`].value,
        company: form.elements[`edit-speaker-${speaker.id}-company`].value,
        position: form.elements[`edit-speaker-${speaker.id}-position`].value,
        shortBio: form.elements[`edit-speaker-${speaker.id}-shortBio`].value,
        updatedAt: new Date().toISOString()
      });
    }
    const newTopicTitle = form.elements.newTopicTitle?.value?.trim();
    if (newTopicTitle) {
      const id = `topics-${crypto.randomUUID()}`;
      await upsert("topics", {
        id,
        title: newTopicTitle,
        shortDescription: form.elements.newTopicShortDescription.value,
        status: "active",
        visibility: "public",
        sortOrder: topics.length + 1,
        createdAt: new Date().toISOString()
      });
      topicIds.push(id);
    }
    const newSpeakerName = form.elements.newSpeakerName?.value?.trim();
    if (newSpeakerName) {
      const id = `speakers-${crypto.randomUUID()}`;
      await upsert("speakers", {
        id,
        name: newSpeakerName,
        company: form.elements.newSpeakerCompany.value,
        position: form.elements.newSpeakerPosition.value,
        shortBio: form.elements.newSpeakerShortBio.value,
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
      speakerIds.push(id);
    }
    await upsert("events", { ...existing, topicIds, speakerIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-assignment-result").innerHTML = `<div class="alert alert--success">Zuordnung wurde gespeichert.</div>`;
    await render();
  });

  document.querySelector("#event-topic-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existingEvent = await getOne("events", form.dataset.eventId);
    const topicId = form.dataset.topicId || `topics-${crypto.randomUUID()}`;
    const existingTopic = form.dataset.topicId ? await getOne("topics", topicId) : { id: topicId, status: "active", visibility: "public", createdAt: new Date().toISOString() };
    if (!form.dataset.topicId && (existingEvent.topicIds || []).length >= 6) {
      form.querySelector("#event-topic-editor-result").innerHTML = `<div class="alert alert--error">Maximal 6 Vortraege pro Medienfruehstueck sind moeglich.</div>`;
      return;
    }
    const topicIds = Array.from(new Set([...(existingEvent.topicIds || []), topicId]));
    const image = imageFileFromDropzone(form, "topicImage", topicId);
    const imageUpdate = {};
    if (form.elements.removeTopicImage?.value === "1") {
      imageUpdate.imageUrl = "";
      imageUpdate.assetStoragePath = "";
    }
    if (image) {
      await deleteStoredAsset(existingTopic);
      const asset = await uploadEntityImage("topics", topicId, image);
      imageUpdate.imageUrl = asset.url;
      imageUpdate.assetStoragePath = asset.storagePath;
    }
    await upsert("topics", {
      ...existingTopic,
      id: topicId,
      title: form.elements.title.value,
      shortDescription: form.elements.text.value,
      longDescription: form.elements.text.value,
      ...imageUpdate,
      updatedAt: new Date().toISOString()
    });
    await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-editor-result").innerHTML = `<div class="alert alert--success">Vortrag wurde gespeichert.</div>`;
    const imageStatus = form.querySelector("[data-image-status]");
    if (imageStatus) imageStatus.textContent = imageUpdate.imageUrl ? "Bild wurde gespeichert." : imageUpdate.imageUrl === "" ? "Bild wurde gelÃ¶scht." : imageStatus.textContent;
    if (Object.prototype.hasOwnProperty.call(imageUpdate, "imageUrl")) {
      updateDropzoneSavedImage(form, imageUpdate.imageUrl);
      updateTopicThumbInList(topicId, imageUpdate.imageUrl);
    }
    if (!form.dataset.topicId) go(`cms/event/${form.dataset.eventId}?tab=topics&mode=edit&topic=${topicId}`);
  });

  document.querySelector("#event-topic-assign-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existingEvent = await getOne("events", form.dataset.eventId);
    if ((existingEvent.topicIds || []).length >= 6) {
      form.querySelector("#event-topic-assign-result").innerHTML = `<div class="alert alert--error">Maximal 6 Vortraege pro Medienfruehstueck sind moeglich.</div>`;
      return;
    }
    const topicIds = Array.from(new Set([...(existingEvent.topicIds || []), form.elements.topicId.value]));
    await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-assign-result").innerHTML = `<div class="alert alert--success">Vortrag wurde zugeordnet.</div>`;
    go(`cms/event/${form.dataset.eventId}?tab=topics&mode=edit&topic=${form.elements.topicId.value}`);
  });

  document.querySelectorAll("[data-unassign-event-topic]").forEach((button) => button.addEventListener("click", async () => {
    const existingEvent = await getOne("events", button.dataset.eventId);
    const topicIds = (existingEvent.topicIds || []).filter((topicId) => topicId !== button.dataset.unassignEventTopic);
    const speakerIds = [];
    for (const speakerId of existingEvent.speakerIds || []) {
      const speaker = await getOne("speakers", speakerId);
      if (speaker?.topicId !== button.dataset.unassignEventTopic && !(speaker?.topicIds || []).includes(button.dataset.unassignEventTopic)) speakerIds.push(speakerId);
    }
    await upsert("events", { ...existingEvent, topicIds, speakerIds, updatedAt: new Date().toISOString() });
    await render();
  }));

  document.querySelector("#event-topic-speaker-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEventTopicSpeakerForm(event.currentTarget);
  });
  document.querySelector("#event-topic-speaker-form button[type='submit']")?.addEventListener("click", async (event) => {
    const form = event.currentTarget.form;
    if (!form || form.classList.contains("is-saving")) return;
    if (form.reportValidity && !form.reportValidity()) return;
    event.preventDefault();
    form.classList.add("is-saving");
    try {
      await saveEventTopicSpeakerForm(form);
    } finally {
      form.classList.remove("is-saving");
    }
  });

  document.querySelectorAll("[data-remove-event-topic-speaker]").forEach((button) => button.addEventListener("click", async () => {
    const speaker = await getOne("speakers", button.dataset.removeEventTopicSpeaker);
    const existingEvent = await getOne("events", button.dataset.eventId);
    if (!speaker || !existingEvent) return;
    if (!window.confirm(`${speaker.name || "Referent"} aus diesem Vortrag entfernen?`)) return;
    const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
    topicIds.delete(button.dataset.topicId);
    const remainingEventTopicIds = Array.from(topicIds).filter((topicId) => (existingEvent.topicIds || []).includes(topicId));
    const stillInEvent = remainingEventTopicIds.length > 0 || (speaker.topicId && speaker.topicId !== button.dataset.topicId && (existingEvent.topicIds || []).includes(speaker.topicId));
    const eventIds = new Set(Array.isArray(speaker.eventIds) ? speaker.eventIds : []);
    if (!stillInEvent) eventIds.delete(button.dataset.eventId);
    const speakerIds = stillInEvent
      ? Array.from(new Set(existingEvent.speakerIds || []))
      : (existingEvent.speakerIds || []).filter((speakerId) => speakerId !== speaker.id);
    await upsert("speakers", {
      ...speaker,
      topicId: speaker.topicId === button.dataset.topicId ? "" : speaker.topicId,
      topicIds: Array.from(topicIds),
      eventIds: Array.from(eventIds),
      updatedAt: new Date().toISOString()
    });
    await upsert("events", { ...existingEvent, speakerIds, updatedAt: new Date().toISOString() });
    go(`cms/event/${button.dataset.eventId}?tab=topics&mode=edit&topic=${button.dataset.topicId}`);
  }));

  document.querySelectorAll("[data-copy-talk-to-topic]").forEach((button) => button.addEventListener("click", async () => {
    const talk = await getOne("topics", button.dataset.copyTalkToTopic);
    if (!talk) return;
    const id = `topics-${crypto.randomUUID()}`;
    await upsert("topics", {
      ...talk,
      id,
      title: talk.title || "Neues Thema",
      sourceTalkId: talk.id,
      sourceEventId: button.dataset.eventId || "",
      eventIds: [],
      topicIds: [],
      isEditorialTopic: true,
      status: talk.status || "active",
      visibility: talk.visibility || "public",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    go(`cms/edit?module=topics&id=${id}`);
  }));

  document.querySelector("#event-partners-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    let hostId = form.elements.hostId?.value || "";
    const sponsors = await list("sponsors");
    for (const sponsor of sponsors) {
      if (!form.elements[`edit-sponsor-${sponsor.id}-name`]) continue;
      await upsert("sponsors", {
        ...sponsor,
        name: form.elements[`edit-sponsor-${sponsor.id}-name`].value,
        role: "Co-Gastgeber",
        website: form.elements[`edit-sponsor-${sponsor.id}-website`].value,
        description: form.elements[`edit-sponsor-${sponsor.id}-description`].value,
        status: sponsor.status || "published",
        updatedAt: new Date().toISOString()
      });
    }
    const newSponsorName = form.elements.newSponsorName?.value?.trim();
    if (newSponsorName) {
      const id = `sponsors-${crypto.randomUUID()}`;
      await upsert("sponsors", {
        id,
        name: newSponsorName,
        role: "Co-Gastgeber",
        website: form.elements.newSponsorWebsite.value,
        description: form.elements.newSponsorDescription.value,
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
      hostId = id;
    }
    await upsert("events", { ...existing, sponsorIds: hostId ? [hostId] : [], hostId, updatedAt: new Date().toISOString() });
    form.querySelector("#event-partners-result").innerHTML = `<div class="alert alert--success">Co-Gastgeber wurde gespeichert.</div>`;
    await render();
  });

  document.querySelectorAll("[data-gallery-image-to-media]").forEach((button) => {
    if (button.dataset.galleryMediaTransferWired === "1") return;
    button.dataset.galleryMediaTransferWired = "1";
    button.addEventListener("click", async () => {
      const form = button.closest("#gallery-edit-form");
      const item = button.closest("[data-gallery-image-item]");
      const result = form?.querySelector("#gallery-save-result");
      const galleryId = form?.dataset.galleryId || "";
      if (!form || !item || !galleryId) return;
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Bild wird in die Mediathek verschoben ...</div>`;
      try {
        const gallery = await getOne("galleries", galleryId);
        if (!gallery) throw new Error("Galerie wurde nicht gefunden.");
        const image = {
          id: item.querySelector('input[name$="-id"]')?.value || button.dataset.galleryImageId || "",
          url: item.querySelector('input[name$="-url"]')?.value || "",
          storagePath: item.querySelector('input[name$="-storagePath"]')?.value || "",
          fileName: item.querySelector('input[name$="-fileName"]')?.value || "",
          caption: item.querySelector('input[name$="-caption"]')?.value || "",
          altText: item.querySelector('input[name$="-altText"]')?.value || ""
        };
        const asset = await createMediaAssetFromGalleryImage(gallery, image);
        const images = (Array.isArray(gallery.images) ? gallery.images : []).map((entry) => {
          const match = (image.id && entry.id === image.id) || (image.url && entry.url === image.url);
          return match ? { ...entry, mediaAssetId: asset.id, media_asset_id: asset.id } : entry;
        });
        await upsert("galleries", { ...gallery, images, updatedAt: new Date().toISOString() });
        if (result) result.innerHTML = `<div class="alert alert--success">Bild wurde in die Mediathek verschoben.</div>`;
        await render();
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Bild konnte nicht in die Mediathek verschoben werden: ${escapeHtml(error.message || String(error))}</div>`;
        button.disabled = false;
      }
    });
  });
  document.querySelector("#gallery-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#gallery-save-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">${progressMarkup("Galerie wird gespeichert ...", 20)}</div>`;
    try {
      const galleryId = form.dataset.galleryId;
      const existing = (await getOne("galleries", galleryId)) || { id: galleryId, createdAt: new Date().toISOString() };
      const keptImages = [];
      form.querySelectorAll("[data-gallery-image-item]").forEach((item) => {
        if (item.querySelector('input[name$="-remove"]')?.checked) return;
        keptImages.push({
          id: item.querySelector('input[name$="-id"]')?.value || `gallery-image-${crypto.randomUUID()}`,
          url: item.querySelector('input[name$="-url"]')?.value || "",
          storagePath: item.querySelector('input[name$="-storagePath"]')?.value || "",
          fileName: item.querySelector('input[name$="-fileName"]')?.value || "",
          mediaAssetId: item.querySelector('input[name$="-mediaAssetId"]')?.value || "",
          caption: item.querySelector('input[name$="-caption"]')?.value || "",
          altText: item.querySelector('input[name$="-altText"]')?.value || "",
          sortOrder: keptImages.length + 1
        });
      });
      const files = [...Array.from(form.elements.galleryImages?.files || []), ...Array.from(form.elements.galleryImagesDrop?.files || [])];
      const uploadedImages = files.length
        ? await uploadGalleryImages(galleryId, files, (progress) => {
            if (result) result.innerHTML = `<div class="alert">${progressMarkup(`Bilder werden hochgeladen (${progress}%) ...`, Math.max(30, progress))}</div>`;
          })
        : [];
      const selectedMediaImages = [];
      const selectedMediaUpdates = [];
      form.querySelectorAll(".gallery-editor__item--candidate").forEach((item) => {
        const attach = item.querySelector('input[name$="-attach"]')?.checked;
        if (!attach) return;
        const mediaId = item.querySelector('input[name$="-id"]')?.value || "";
        selectedMediaImages.push({
          id: mediaId || `gallery-image-${crypto.randomUUID()}`,
          url: item.querySelector('input[name$="-url"]')?.value || "",
          storagePath: item.querySelector('input[name$="-storagePath"]')?.value || "",
          fileName: item.querySelector('input[name$="-fileName"]')?.value || "",
          mediaAssetId: item.querySelector('input[name$="-mediaAssetId"]')?.value || "",
          caption: item.querySelector('input[name$="-caption"]')?.value || "",
          altText: item.querySelector('input[name$="-altText"]')?.value || "",
          sortOrder: keptImages.length + uploadedImages.length + selectedMediaImages.length + 1
        });
        if (mediaId) {
          selectedMediaUpdates.push({
            mediaId,
            approve: item.querySelector('input[name$="-approve"]')?.checked
          });
        }
      });
      const linkedEventId = form.elements.eventId?.value || "";
      const images = [
        ...keptImages,
        ...uploadedImages.map((image, index) => ({ ...image, sortOrder: keptImages.length + index + 1 })),
        ...selectedMediaImages
      ];
      await upsert("galleries", {
        ...existing,
        id: galleryId,
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        eventId: linkedEventId,
        status: form.elements.status.value,
        visibility: form.elements.visibility.value || "public",
        images,
        updatedAt: new Date().toISOString()
      });
      for (const update of selectedMediaUpdates) {
        if (!update.approve) continue;
        const medium = await getOne("eventMedia", update.mediaId);
        if (!medium) continue;
        await upsert("eventMedia", {
          ...medium,
          galleryId,
          eventId: linkedEventId || medium.eventId || "",
          status: "approved",
          visibility: "public",
          updatedAt: new Date().toISOString()
        });
      }
      const previousEventId = existing.eventId || "";
      if (previousEventId && previousEventId !== linkedEventId) {
        const previousEvent = await getOne("events", previousEventId);
        if (previousEvent?.galleryId === galleryId) {
          await upsert("events", { ...previousEvent, galleryId: "", updatedAt: new Date().toISOString() });
        }
      }
      if (linkedEventId) {
        const linkedEvent = await getOne("events", linkedEventId);
        if (linkedEvent) await upsert("events", { ...linkedEvent, galleryId, updatedAt: new Date().toISOString() });
      }
      if (result) {
        result.innerHTML = `<div class="alert alert--success">Galerie gespeichert. ${images.length} Bild${images.length === 1 ? "" : "er"} sind zugeordnet.</div>`;
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      form.elements.galleryImages.value = "";
      form.elements.galleryImagesDrop.value = "";
      const current = route();
      const target = `cms/edit?module=galleries&id=${galleryId}`;
      if (current.path === "cms" && current.id === "edit" && current.query.get("module") === "galleries" && current.query.get("id") !== galleryId) {
        go(target);
      } else {
        await render();
      }
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Galerie konnte nicht gespeichert werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelector("#content-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#content-save-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    setaveButtonFeedback(submitButton, "saving", "peichere ...");
    if (result) result.innerHTML = `<div class="alert">Speichere...</div>`;
    try {
      const existing = (await getOne(form.dataset.module, form.dataset.id)) || { id: form.dataset.id, createdAt: new Date().toISOString() };
      let values = formObject(form);
      if (form.dataset.module === "editorialContent") {
        values.videoAttachments = collectVideoAttachments(form, values);
        ["category", "linkedEventId", "galleryId", "sponsorId", "retrospectivePrompt", "galleryEventId"].forEach((name) => {
          if (!Object.prototype.hasOwnProperty.call(values, name)) {
            const field = document.querySelector(`[name="${name}"]`);
            if (field) values[name] = field.value || "";
          }
        });
        ["isRetrospective", "showGallery"].forEach((name) => {
          if (!Object.prototype.hasOwnProperty.call(values, name)) {
            const field = document.querySelector(`[name="${name}"]`);
            if (field) values[name] = Boolean(field.checked);
          }
        });
      }
      values = normalizeInternalEditorialValues(values);
      if (form.dataset.module === "editorialContent" && Object.prototype.hasOwnProperty.call(values, "tags")) {
        values.tags = String(values.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
        values.primary_keyword = values.tags[0] || values.primary_keyword || "";
        values.keyword_json = values.tags.map((tag, index) => ({ keyword: tag, relevance_score: index === 0 ? 90 : 70 }));
      }
      if (form.dataset.module === "editorialContent" && Object.prototype.hasOwnProperty.call(values, "source_snapshot_json_text")) {
        try {
          values.source_snapshot_json = values.source_snapshot_json_text.trim() ? JSON.parse(values.source_snapshot_json_text) : [];
        } catch {
          throw new Error("Quellen muessen als gueltiges JSON gespeichert werden.");
        }
      }
      const removeAssetRequested = values.removeAssetFile === "1";
      if (form.dataset.module === "editorialContent" && values.publishDate) values.validFrom = values.publishDate;
      if (form.dataset.module === "editorialContent" && Object.prototype.hasOwnProperty.call(values, "linkedEventId")) {
        values.galleryEventId = values.linkedEventId || "";
        if (values.isRetrospective) values.category = "R\u00fcckblick";
      }
      if (form.dataset.module === "editorialContent" && Object.prototype.hasOwnProperty.call(values, "bodyText")) {
        values.longDescription = values.bodyText;
        values.articleText = values.bodyText;
      }
      if (form.dataset.module === "editorialContent" && Object.prototype.hasOwnProperty.call(values, "downloadId")) {
        const selectedDownloadId = values.downloadId || "";
        values.download_id = selectedDownloadId;
        values.documentId = selectedDownloadId;
        values.document_id = selectedDownloadId;
        if (selectedDownloadId) {
          const linkedDocument = await getOne("downloads", selectedDownloadId).catch(() => null)
            || await getOne("memberDocuments", selectedDownloadId).catch(() => null);
          if (!linkedDocument) throw new Error("Das ausgewaehlte Dokument wurde nicht gefunden.");
          const documentUrl = linkedDocument.documentUrl || linkedDocument.assetUrl || linkedDocument.fileUrl || linkedDocument.downloadUrl || linkedDocument.url || "";
          if (!documentUrl) throw new Error("Das ausgewaehlte Dokument hat keinen Datei-Link.");
          values.documentUrl = documentUrl;
          values.documentFileName = linkedDocument.fileName || linkedDocument.assetFileName || linkedDocument.title || "PDF";
          values.documentTitle = linkedDocument.title || linkedDocument.fileName || linkedDocument.assetFileName || "PDF";
          values.documentType = linkedDocument.documentType || linkedDocument.assetType || "application/pdf";
          values.documentStoragePath = linkedDocument.documentStoragePath || linkedDocument.assetStoragePath || linkedDocument.storagePath || "";
        } else {
          values.documentUrl = "";
          values.documentFileName = "";
          values.documentTitle = "";
          values.documentType = "";
          values.documentStoragePath = "";
        }
      }
      const image = imageFileFromDropzone(form, "assetFile", form.dataset.id);
      if (removeAssetRequested) {
        values.imageUrl = "";
        values.documentUrl = "";
        values.assetUrl = "";
        values.assetFileName = "";
        values.assetType = "";
        values.logoUrl = "";
        values.photoUrl = "";
        values.assetStoragePath = "";
      }
      if (image) {
        await deleteStoredAsset(existing);
        const asset = await uploadEntityImage(form.dataset.module, form.dataset.id, image);
        if (form.dataset.module === "topics") values.imageUrl = asset.url;
        if (form.dataset.module === "members") values.logoUrl = asset.url;
        if (form.dataset.module === "boardMembers") values.photoUrl = asset.url;
        if (form.dataset.module === "speakers") values.photoUrl = asset.url;
        if (form.dataset.module === "sponsors") values.logoUrl = asset.url;
        if (["memberDocuments", "memberDirectories"].includes(form.dataset.module)) {
          values.documentUrl = asset.url;
          values.assetUrl = asset.url;
          values.fileName = image.name;
          values.assetFileName = image.name;
          values.assetType = image.type.startsWith("image/") ? "image" : "document";
        }
        if (form.dataset.module === "editorialContent") {
          values.assetUrl = asset.url;
          values.assetFileName = image.name;
          values.assetType = image.type.startsWith("image/") ? "image" : "document";
          if (image.type.startsWith("image/")) {
            values.imageUrl = asset.url;
            values.documentUrl = "";
          } else {
            values.documentUrl = asset.url;
            values.imageUrl = "";
          }
        }
        values.assetStoragePath = asset.storagePath;
      }
      delete values.assetFile;
      delete values.assetFileDataUrl;
      delete values.documentFile;
      delete values.documentFileDataUrl;
      delete values.removeAssetFile;
      delete values.removeDocumentFile;
      delete values.source_snapshot_json_text;
      if (form.dataset.module === "members") {
        const membershipType = values.membershipType || existing.membershipType || "";
        values.eventContacts = collectMemberEventContacts(form, membershipType);
        values = normalizeMembershipAccessValues(syncPrimaryMemberContact(normalizeMemberContactValues(removeMemberEventContactFormFields(values))));
        values.membershipLabel = memberMembershipLabel(values.membershipType || membershipType);
      }
      const savedValues = withContentVersionMetadata(form.dataset.module, existing, { ...existing, ...values });
      await upsert(form.dataset.module, savedValues);
      if (image || removeAssetRequested) {
        updateDropzoneSavedImage(form, savedValues.imageUrl || savedValues.logoUrl || savedValues.photoUrl || "");
      }
      if (result) {
        const audioHint = ["editorialContent", "topics"].includes(form.dataset.module) && savedValues.audioStatus === "veraltet"
          ? " Audio ist als veraltet markiert und kann im CMS manuell neu erzeugt werden."
          : "";
        result.innerHTML = `<div class="alert alert--success">Gespeichert.${audioHint}</div>`;
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      setaveButtonFeedback(submitButton, "success", "Gespeichert");
      form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: savedValues }));
      if (form.dataset.module === "members") window.setTimeout(render, 450);
    } catch (error) {
      setaveButtonFeedback(submitButton, "error", "Fehler");
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-save-failed", { detail: { error } }));
    } finally {
      if (submitButton && !submitButton.classList.contains("is-save-success") && !submitButton.classList.contains("is-save-error")) submitButton.disabled = false;
    }
  });

  document.querySelector("#media-video-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#media-video-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    const contentId = form.dataset.contentId || "";
    if (!contentId) return;
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Speichere Videos...</div>`;
    try {
      const existing = await getOne("editorialContent", contentId);
      if (!existing) throw new Error("Beitrag wurde nicht gefunden.");
      const values = formObject(form);
      const videoAttachments = collectVideoAttachments(form, values);
      await upsert("editorialContent", {
        ...existing,
        videoAttachments,
        updatedAt: new Date().toISOString()
      });
      if (result) result.innerHTML = `<div class="alert alert--success">Videos gespeichert.</div>`;
      window.setTimeout(render, 350);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Videos konnten nicht gespeichert werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  const navigateToCmsReturn = (returnTo = "#/cms/media/videos") => {
    const target = returnTo || "#/cms/media/videos";
    if (target.startsWith("#/")) {
      go(target.slice(2));
      return;
    }
    if (target.startsWith("#")) {
      window.location.hash = target;
      return;
    }
    go(target.replace(/^\/+/, ""));
  };

  const videoFromLibraryForm = (form) => {
    const values = formObject(form);
    const youtubeVideoId = youtubeVideoIdFromValue(values.youtubeUrl || "");
    const youtubeUrl = values.youtubeUrl || (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : "");
    const posterImageUrl = values.posterImageUrl || (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "");
    return {
      id: form.dataset.videoId || `media-video-${crypto.randomUUID()}`,
      sourceType: "youtube",
      youtubeVideoId,
      youtubeUrl,
      url: youtubeUrl,
      embedUrl: youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : "",
      title: values.title || "YouTube-Video",
      description: values.description || "",
      caption: values.description || "",
      posterImageUrl,
      posterImageAlt: values.posterImageAlt || values.title || "Video starten",
      thumbnailUrl: posterImageUrl,
      privacyStatus: values.privacyStatus || "unlisted",
      status: values.status || "ready",
      updatedAt: new Date().toISOString()
    };
  };

  const assignVideoToTarget = async (targetCollection, targetId, video) => {
    if (!targetCollection || !targetId) return;
    const existing = await getOne(targetCollection, targetId);
    if (!existing) throw new Error("Zielbeitrag wurde nicht gefunden.");
    const snapshot = normalizedVideoLibraryPayload(video, (existing.videoAttachments || []).length);
    const current = Array.isArray(existing.videoAttachments) ? existing.videoAttachments : [];
    const filtered = current.filter((item) => (item.id || item.youtubeVideoId || item.youtubeUrl) !== (snapshot.id || snapshot.youtubeVideoId || snapshot.youtubeUrl));
    await upsert(targetCollection, {
      ...existing,
      videoAttachments: [...filtered, snapshot].map((item, index) => ({ ...item, sortOrder: index + 1 })),
      updatedAt: new Date().toISOString()
    });
  };

  document.querySelectorAll("[data-video-oembed]").forEach((button) => {
    if (button.dataset.videoOembedWired === "1") return;
    button.dataset.videoOembedWired = "1";
    button.addEventListener("click", async () => {
      const form = button.closest("form");
      const result = form?.querySelector("#media-video-library-result");
      const urlField = form?.querySelector('[name="youtubeUrl"]');
      const titleField = form?.querySelector('[name="title"]');
      const descriptionField = form?.querySelector('[name="description"]');
      const posterField = form?.querySelector('[name="posterImageUrl"]');
      const altField = form?.querySelector('[name="posterImageAlt"]');
      const preview = form?.querySelector("[data-video-preview]");
      const youtubeVideoId = youtubeVideoIdFromValue(urlField?.value || "");
      if (!youtubeVideoId) {
        if (result) result.innerHTML = `<div class="alert alert--error">Bitte eine gueltige YouTube-URL eintragen.</div>`;
        return;
      }
      const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
      const poster = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
      if (urlField) urlField.value = youtubeUrl;
      if (posterField) posterField.value = poster;
      if (preview) preview.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(youtubeVideoId)}" title="Video Vorschau" loading="lazy" allowfullscreen></iframe>`;
      if (result) result.innerHTML = `<div class="alert">YouTube-Daten werden geladen...</div>`;
      try {
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
        if (response.ok) {
          const data = await response.json();
          if (data.title && titleField && !titleField.value.trim()) titleField.value = data.title;
          if (data.title && descriptionField && !descriptionField.value.trim()) descriptionField.value = data.title;
          if (data.thumbnail_url && posterField) posterField.value = data.thumbnail_url;
          if (data.title && altField && !altField.value.trim()) altField.value = data.title;
        }
        if (result) result.innerHTML = `<div class="alert alert--success">YouTube-Daten uebernommen.</div>`;
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--success">Cover und Vorschau wurden gesetzt. Titel/Beschreibung bitte pruefen.</div>`;
      }
    });
  });

  document.querySelector("#media-video-library-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#media-video-library-result");
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Video wird gespeichert...</div>`;
    try {
      const video = videoFromLibraryForm(form);
      if (!video.youtubeVideoId) throw new Error("Bitte eine gueltige YouTube-URL eintragen.");
      const existing = await getOne("media_videos", video.id).catch(() => null);
      await upsert("media_videos", {
        ...existing,
        ...video,
        createdAt: existing?.createdAt || new Date().toISOString()
      });
      const targetCollection = form.dataset.targetCollection || "";
      const targetId = form.dataset.targetId || "";
      if (targetCollection && targetId) {
        await assignVideoToTarget(targetCollection, targetId, video);
        if (result) result.innerHTML = `<div class="alert alert--success">Video gespeichert und zugeordnet.</div>`;
        window.setTimeout(() => navigateToCmsReturn(form.dataset.returnTo), 350);
      } else {
        if (result) result.innerHTML = `<div class="alert alert--success">Video gespeichert.</div>`;
        window.setTimeout(render, 350);
      }
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Video konnte nicht gespeichert werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelectorAll("[data-assign-video]").forEach((button) => {
    if (button.dataset.assignVideoWired === "1") return;
    button.dataset.assignVideoWired = "1";
    button.addEventListener("click", async () => {
      const result = document.querySelector("#media-video-assign-result");
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Video wird zugeordnet...</div>`;
      try {
        const video = await getOne("media_videos", button.dataset.assignVideo);
        if (!video) throw new Error("Video wurde nicht gefunden.");
        await assignVideoToTarget(button.dataset.targetCollection, button.dataset.targetId, video);
        if (result) result.innerHTML = `<div class="alert alert--success">Video zugeordnet.</div>`;
        window.setTimeout(() => navigateToCmsReturn(button.dataset.returnTo), 300);
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Video konnte nicht zugeordnet werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-video-visible-toggle]").forEach((button) => {
    if (button.dataset.videoVisibleWired === "1") return;
    button.dataset.videoVisibleWired = "1";
    button.addEventListener("click", async () => {
      const result = document.querySelector("#media-video-assign-result");
      const videoId = button.dataset.videoVisibleToggle;
      const nextVisible = button.dataset.nextVisible === "true";
      if (!videoId) return;
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Sichtbarkeit wird gespeichert...</div>`;
      try {
        const video = await getOne("media_videos", videoId);
        if (!video) throw new Error("Video wurde nicht gefunden.");
        await upsert("media_videos", {
          ...video,
          visible: nextVisible,
          status: nextVisible ? "ready" : "hidden",
          updatedAt: new Date().toISOString()
        });
        if (result) result.innerHTML = `<div class="alert alert--success">${nextVisible ? "Video ist sichtbar." : "Video ist ausgeblendet."}</div>`;
        window.setTimeout(render, 300);
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Sichtbarkeit konnte nicht gespeichert werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-video-trash]").forEach((button) => {
    if (button.dataset.videoTrashWired === "1") return;
    button.dataset.videoTrashWired = "1";
    button.addEventListener("click", async () => {
      const result = document.querySelector("#media-video-assign-result");
      const videoId = button.dataset.videoTrash;
      const title = button.dataset.videoTitle || "Video";
      if (!videoId) return;
      if (!window.confirm(`"${title}" in den Papierkorb verschieben?`)) return;
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Video wird in den Papierkorb verschoben...</div>`;
      try {
        const video = await getOne("media_videos", videoId);
        if (!video) throw new Error("Video wurde nicht gefunden.");
        await upsert("media_videos", {
          ...video,
          visible: false,
          status: "archived",
          trash_status: "paperkorb",
          deleted_at: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        if (result) result.innerHTML = `<div class="alert alert--success">Video wurde in den Papierkorb verschoben.</div>`;
        window.setTimeout(render, 300);
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Video konnte nicht verschoben werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-clear-member-logo]").forEach((button) => {
    if (button.dataset.clearMemberLogoWired === "1") return;
    button.dataset.clearMemberLogoWired = "1";
    button.addEventListener("click", async () => {
      const memberId = button.dataset.clearMemberLogo;
      const form = button.closest("form");
      const result = form?.querySelector("#content-save-result");
      if (!memberId) return;
      button.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Logo wird geloescht...</div>`;
      try {
        const member = await getOne("members", memberId);
        if (!member) throw new Error("Mitglied wurde nicht gefunden.");
        await upsert("members", {
          ...member,
          logoUrl: "",
          imageUrl: "",
          thumbnail_url: "",
          thumbnailUrl: "",
          thumbnail_media_asset_id: "",
          mediaAssetId: "",
          assetUrl: "",
          updatedAt: new Date().toISOString()
        });
        const assets = await list("media_assets").catch(() => []);
        await Promise.all(assets
          .filter((asset) => (asset.linked_collection === "members" && asset.linked_record_id === memberId) || (asset.target_collection === "members" && asset.target_id === memberId))
          .map((asset) => upsert("media_assets", {
            ...asset,
            linked_collection: "",
            linked_record_id: "",
            linked_field: "",
            target_collection: "",
            target_id: "",
            target_field: "",
            updated_at: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })));
        if (result) result.innerHTML = `<div class="alert alert--success">Logo geloescht.</div>`;
        window.setTimeout(render, 500);
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Logo konnte nicht geloescht werden: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-news-visible-toggle]").forEach((button) => button.addEventListener("click", async () => {
    const articleId = button.dataset.newsVisibleToggle;
    const nextVisible = button.dataset.visible === "true";
    const form = button.closest("form");
    const result = form?.querySelector("#content-save-result") || button.closest(".editorial-meta-panel");
    const originalLabel = button.textContent;
    const originalTitle = button.getAttribute("title") || "";
    button.disabled = true;
    if (!originalLabel.trim()) button.setAttribute("title", nextVisible ? "schalte frei ..." : "blende aus ...");
    try {
      const existing = await getOne("editorialContent", articleId);
      if (!existing) throw new Error("News-Beitrag nicht gefunden.");
      await upsert("editorialContent", {
        ...existing,
        visible: nextVisible,
        status: nextVisible ? "published" : "draft",
        visibility: nextVisible ? "public" : "internal",
        page: "news",
        section: "news",
        validFrom: nextVisible ? existing.validFrom || existing.publishDate || new Date().toISOString().slice(0, 10) : existing.validFrom || "",
        publishDate: nextVisible ? existing.publishDate || new Date().toISOString().slice(0, 10) : existing.publishDate || "",
        updatedAt: new Date().toISOString()
      });
      button.dataset.visible = nextVisible ? "false" : "true";
      button.classList.toggle("icon-button--visible", nextVisible);
      button.classList.toggle("icon-button--hidden", !nextVisible);
      const nextLabel = nextVisible ? "Sichtbar: ausblenden" : "Unsichtbar: sichtbar machen";
      button.setAttribute("title", nextLabel);
      button.setAttribute("aria-label", nextLabel);
      if (result) result.insertAdjacentHTML("beforeend", `<div class="alert alert--success">${nextVisible ? "News ist freigeschaltet." : "News ist unsichtbar geschaltet."}</div>`);
    } catch (error) {
      if (result) result.insertAdjacentHTML("beforeend", `<div class="alert alert--error">Sichtbarkeit konnte nicht geaendert werden: ${escapeHtml(error.message || String(error))}</div>`);
    } finally {
      button.disabled = false;
      if (!button.getAttribute("title")) button.setAttribute("title", originalTitle);
    }
  }));

  document.querySelectorAll("[data-disabled-news-publish]").forEach((button) => button.addEventListener("click", async () => {
    const articleId = button.dataset.newsPublishNow;
    const form = button.closest("form");
    const result = form?.querySelector("#content-save-result");
    const originalLabel = button.textContent;
    if (!articleId) return;
    button.disabled = true;
    button.textContent = "Veroeffentliche ...";
    if (result) result.innerHTML = `<div class="alert">Beitrag wird gespeichert und veroeffentlicht...</div>`;
    try {
      if (form?.matches("#content-edit-form")) {
        await submitFormAndWait(form);
      }
      const existing = await getOne("editorialContent", articleId);
      if (!existing) throw new Error("News-Beitrag nicht gefunden.");
      const today = new Date().toISOString().slice(0, 10);
      const titleForSlug = existing.title || existing.headline || existing.name || articleId;
      const published = {
        ...existing,
        slug: existing.slug || String(titleForSlug)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 90) || articleId,
        page: "news",
        section: "news",
        status: "published",
        visibility: "public",
        visible: true,
        publishDate: existing.publishDate || existing.validFrom || today,
        validFrom: existing.validFrom || existing.publishDate || today,
        updatedAt: new Date().toISOString()
      };
      await upsert("editorialContent", published);
      if (result) {
        result.innerHTML = `<div class="alert alert--success">Beitrag ist veroeffentlicht und im Redaktionsbereich unter News sichtbar. <a href="#/cms/editorial/news">Zur News-Liste</a> Â· <a href="/?real=1#/news/${escapeHtml(articleId)}" target="_blank" rel="noopener">Artikel anzeigen</a></div>`;
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      window.setTimeout(render, 700);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Veroeffentlichen fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("[data-admin-member-select]")?.addEventListener("change", (event) => {
    const memberId = event.currentTarget.value || "";
    if (!memberId) return;
    window.location.hash = `#/portal?memberId=${encodeURIComponent(memberId)}`;
  });

  document.querySelector("#member-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#member-profile-result");
    const submitButton = form.querySelector('button[type="submit"]');
    const user = currentUser();
    const adminMode = isAdmin(user);
    const memberId = form.dataset.memberId || user?.memberId || "";
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Profil wird gespeichert...</div>`;
    try {
      if (!adminMode && !user?.memberId) throw new Error("Ihr Login ist keinem Mitgliedsprofil zugeordnet.");
      if (!adminMode && user.memberId !== memberId) throw new Error("Sie koennen nur Ihr eigenes Mitgliedsprofil bearbeiten.");
      const existing = await getOne("members", memberId);
      if (!existing) throw new Error("Das verknuepfte Mitgliedsprofil wurde nicht gefunden.");
      let values = normalizeMemberContactValues(removeMemberEventContactFormFields(formObject(form)));
      values.eventContacts = collectMemberEventContacts(form, existing.membershipType || "");
      values = syncPrimaryMemberContact(values);
      const allowedFields = ["firstName", "lastName", "company", "name", "description", "website", "street", "houseNumber", "postalCode", "city", "country", "contactEmail", "email", "phone", "contactPhone", "mobile", "contactMobile", "profileContactName", "contactName", "contactRole", "position", "allowContact", "contactAllowed", "eventContacts"];
      const update = {
        id: memberId,
        profileUpdatedAt: new Date().toISOString(),
        profileUpdatedBy: user.uid || user.email || ""
      };
      allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(values, field)) update[field] = values[field] || "";
      });
      await upsert("members", update);
      if (result) result.innerHTML = `<div class="alert alert--success">${adminMode ? "Mitgliedsprofil wurde gespeichert." : "Ihr Mitgliedsprofil wurde gespeichert."}</div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelector("#membership-application-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#membership-application-result");
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Antrag wird gespeichert...</div>`;
    try {
      const values = formObject(form);
      if (!values.privacyAccepted) throw new Error("Bitte Datenschutzerklaerung akzeptieren.");
      if (!values.statutesAccepted) throw new Error("Bitte Vereinssatzung akzeptieren.");
      if (!values.feeInfoAccepted) throw new Error("Bitte Beitragsinformationen bestaetigen.");
      const id = `membershipApplications-${crypto.randomUUID()}`;
      await upsert("membershipApplications", {
        id,
        ...values,
        status: "new",
        mailStatus: "queued",
        source: "website",
        submittedAt: new Date().toISOString()
      });
      form.reset();
      if (result) result.innerHTML = `<div class="alert alert--success">Vielen Dank. Der Mitgliedsantrag wurde uebermittelt.</div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Absenden fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.querySelector("#topic-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#topic-editor-result");
    const submitButton = form.querySelector('button[type="submit"], .actions .button');
    setaveButtonFeedback(submitButton, "saving", "peichere ...");
    if (result) result.innerHTML = `<div class="alert">Thema wird gespeichert ...</div>`;
    try {
    const topicId = form.dataset.topicId;
    const topic = (await getOne("topics", topicId)) || { id: topicId, status: "active", visibility: "public" };
    const image = imageFileFromDropzone(form, "topicImage", topicId);
    const imageUpdate = {};
    if (form.elements.removeTopicImage?.value === "1") {
      imageUpdate.imageUrl = "";
      imageUpdate.assetStoragePath = "";
    }
    if (image) {
      await deleteStoredAsset(topic);
      const asset = await uploadEntityImage("topics", topicId, image);
      imageUpdate.imageUrl = asset.url;
      imageUpdate.assetStoragePath = asset.storagePath;
    }
    const savedTopic = {
      ...topic,
      title: form.elements.title?.value || "",
      subtitle: form.elements.subtitle?.value || "",
      category: form.elements.category?.value || "Thema",
      publishDate: form.elements.publishDate?.value || "",
      validFrom: form.elements.publishDate?.value || topic.validFrom || "",
      validTo: form.elements.validTo?.value || "",
      shortDescription: form.elements.shortDescription?.value || "",
      introText: form.elements.shortDescription?.value || "",
      longDescription: form.elements.longDescription?.value || "",
      bodyText: form.elements.longDescription?.value || "",
      articleText: form.elements.longDescription?.value || "",
      galleryId: form.elements.galleryId?.value || "",
      status: form.elements.status?.value || topic.status || "active",
      ...imageUpdate,
      updatedAt: new Date().toISOString()
    };
    await upsert("topics", savedTopic);
    const selected = new Set(Array.from(form.querySelectorAll('input[name="assignedSpeakerIds"]:checked')).map((input) => input.value));
    const speakers = await list("speakers");
    await Promise.all(speakers.map((speaker) => {
      const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
      if (selected.has(speaker.id)) topicIds.add(topicId);
      if (!selected.has(speaker.id)) topicIds.delete(topicId);
      const values = {
        ...speaker,
        topicId: selected.has(speaker.id) ? speaker.topicId || topicId : speaker.topicId === topicId ? "" : speaker.topicId,
        topicIds: Array.from(topicIds),
        updatedAt: new Date().toISOString()
      };
      if (form.elements[`speaker-${speaker.id}-name`]) values.name = form.elements[`speaker-${speaker.id}-name`].value;
      if (form.elements[`speaker-${speaker.id}-company`]) values.company = form.elements[`speaker-${speaker.id}-company`].value;
      if (form.elements[`speaker-${speaker.id}-position`]) values.position = form.elements[`speaker-${speaker.id}-position`].value;
      if (form.elements[`speaker-${speaker.id}-shortBio`]) values.shortBio = form.elements[`speaker-${speaker.id}-shortBio`].value;
      return upsert("speakers", values);
    }));

    const newSpeakerName = form.elements.newSpeakerName?.value?.trim();
    if (newSpeakerName) {
      const id = `speakers-${crypto.randomUUID()}`;
      await upsert("speakers", {
        id,
        name: newSpeakerName,
        company: form.elements.newSpeakerCompany.value,
        position: form.elements.newSpeakerPosition.value,
        shortBio: form.elements.newSpeakerShortBio.value,
        topicId,
        topicIds: [topicId],
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
    }
    const imageStatus = form.querySelector("[data-image-status]");
    if (imageStatus) imageStatus.textContent = imageUpdate.imageUrl ? "Bild wurde gespeichert." : imageUpdate.imageUrl === "" ? "Bild wurde geloescht." : imageStatus.textContent;
    if (Object.prototype.hasOwnProperty.call(imageUpdate, "imageUrl")) updateDropzoneSavedImage(form, imageUpdate.imageUrl);
    if (result) {
      const audioHint = savedTopic.audioStatus === "veraltet" ? " Audio ist als veraltet markiert und kann im CMS manuell neu erzeugt werden." : "";
      result.innerHTML = `<div class="alert alert--success">Thema wurde gespeichert.${imageUpdate.imageUrl ? " Bild wurde hochgeladen." : ""}${audioHint}</div>`;
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    setaveButtonFeedback(submitButton, "success", "Gespeichert");
    form.classList.add("is-saved");
    form.dispatchEvent(new CustomEvent("cms-form-saved", { detail: savedTopic }));
    } catch (error) {
      setaveButtonFeedback(submitButton, "error", "Fehler");
      if (result) result.innerHTML = `<div class="alert alert--error">Speichern fehlgeschlagen: ${escapeHtml(error.message || "Unbekannter Fehler")}</div>`;
      form.dispatchEvent(new CustomEvent("cms-form-save-failed", { detail: { error } }));
    } finally {
      if (submitButton && !submitButton.classList.contains("is-save-success") && !submitButton.classList.contains("is-save-error")) submitButton.disabled = false;
    }
  });

  document.querySelector("#topic-speakers-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const topicId = form.dataset.topicId;
    const selected = new Set(Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value));
    const speakers = await list("speakers");
    await Promise.all(speakers.map((speaker) => {
      const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
      if (selected.has(speaker.id)) topicIds.add(topicId);
      if (!selected.has(speaker.id)) topicIds.delete(topicId);
      const next = { ...speaker, topicIds: Array.from(topicIds) };
      if (selected.has(speaker.id)) next.topicId = speaker.topicId || topicId;
      if (!selected.has(speaker.id) && speaker.topicId === topicId) next.topicId = "";
      return upsert("speakers", next);
    }));
    form.querySelector("#topic-speakers-result").innerHTML = `<div class="alert alert--success">Referentenauswahl wurde gespeichert.</div>`;
    await render();
  });

  document.querySelector("#topic-speaker-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formObject(form);
    const id = `speakers-${crypto.randomUUID()}`;
    const image = form.querySelector('input[name="assetFile"]')?.files?.[0];
    if (image) {
      const asset = await uploadEntityImage("speakers", id, image);
      values.photoUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    delete values.assetFile;
    await upsert("speakers", {
      id,
      ...values,
      topicId: form.dataset.topicId,
      topicIds: [form.dataset.topicId],
      status: "published",
      visibility: "public",
      createdAt: new Date().toISOString()
    });
    form.querySelector("#topic-speaker-create-result").innerHTML = `<div class="alert alert--success">Referent wurde angelegt.</div>`;
    await render();
  });

  document.querySelectorAll(".topic-speaker-edit-form").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const existing = await getOne("speakers", form.dataset.speakerId);
    const values = formObject(form);
    const topicIds = new Set(Array.isArray(existing.topicIds) ? existing.topicIds : []);
    topicIds.add(form.dataset.topicId);
    const image = form.querySelector('input[name="assetFile"]')?.files?.[0];
    if (image) {
      const asset = await uploadEntityImage("speakers", form.dataset.speakerId, image);
      values.photoUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    delete values.assetFile;
    await upsert("speakers", {
      ...existing,
      ...values,
      topicId: existing.topicId || form.dataset.topicId,
      topicIds: Array.from(topicIds),
      updatedAt: new Date().toISOString()
    });
    form.querySelector(".topic-speaker-edit-result").innerHTML = `<div class="alert alert--success">Referent wurde gespeichert.</div>`;
  }));

  document.querySelectorAll("[data-unassign-topic-speaker]").forEach((button) => button.addEventListener("click", async () => {
    const speaker = await getOne("speakers", button.dataset.unassignTopicSpeaker);
    const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
    topicIds.delete(button.dataset.topicId);
    await upsert("speakers", {
      ...speaker,
      topicId: speaker.topicId === button.dataset.topicId ? "" : speaker.topicId,
      topicIds: Array.from(topicIds),
      updatedAt: new Date().toISOString()
    });
    await render();
  }));

  document.querySelectorAll("[data-delete-event]").forEach((button) => button.addEventListener("click", async (event) => {
    if (!window.confirm("Dieses Event wirklich loeschen? Zugeordnete Daten muessen separat geprueft werden.")) return;
    await remove("events", event.currentTarget.dataset.deleteEvent);
    event.currentTarget.closest("tr")?.remove();
    await goOrRefresh(event.currentTarget.dataset.deleteReturn || "cms/events");
  }));

  document.querySelector("#media-upload-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#upload-result");
    const files = Array.from(form.querySelector('input[type="file"]').files || []);
    if (!files.length) {
      result.innerHTML = `<div class="alert alert--warning" style="margin-top:14px">Bitte mindestens eine Datei auswaehlen.</div>`;
      return;
    }
    result.innerHTML = `<div class="progress"><span style="width:0"></span></div>`;
    await uploadEventMedia(form.dataset.eventId, files, {
      source: "cms-event-upload",
      status: "new",
      rightsConfirmed: Boolean(form.elements.rightsConfirmed?.checked),
      uploadedBy: currentUser()?.uid || currentUser()?.email || "cms",
      uploadedByEmail: currentUser()?.email || ""
    }, (progress) => {
      result.querySelector("span").style.width = `${progress}%`;
    });
    result.innerHTML += `<div class="alert alert--success" style="margin-top:12px">Upload abgeschlossen. Medien warten auf Freigabe.</div>`;
    await render();
  });

  document.querySelector("[data-member-portal-select]")?.addEventListener("change", (event) => {
    const target = event.currentTarget.value || "#/portal";
    window.location.hash = target.replace(/^#/, "");
  });
  document.querySelector("[data-member-photo-input]")?.addEventListener("change", (event) => {
    const count = event.currentTarget.files?.length || 0;
    const state = event.currentTarget.form?.querySelector("[data-member-photo-state]");
    if (state) state.textContent = count ? `${count} Bild${count === 1 ? "" : "er"} ausgewaehlt.` : "Keine Bilder ausgewaehlt.";
  });
  document.querySelector("#member-material-upload-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#member-material-upload-result");
    const files = Array.from(form.elements.files?.files || []);
    const invalidFiles = files.filter((file) => !String(file.type || "").startsWith("image/"));
    const requestedEventId = form.elements.eventId?.value || "";
    if (!files.length || invalidFiles.length) {
      result.innerHTML = `<div class="alert alert--warning" style="margin-top:14px">Bitte nur Bilder auswaehlen.</div>`;
      return;
    }
    if (!form.elements.rightsConfirmed?.checked) {
      result.innerHTML = `<div class="alert alert--warning" style="margin-top:14px">Bitte die Nutzungsfreigabe bestaetigen.</div>`;
      return;
    }
    result.innerHTML = `<div class="progress"><span style="width:0"></span></div>`;
    await uploadEventMedia("", files, {
      source: "member-material-upload",
      status: "new",
      eventId: "",
      requestedEventId,
      galleryId: "",
      galleryTitle: "Mitglieder Uploads",
      caption: form.elements.note?.value?.trim() || "",
      note: form.elements.note?.value?.trim() || "",
      rightsConfirmed: true,
      uploadedBy: currentUser()?.uid || currentUser()?.email || "member",
      uploadedByName: currentUser()?.displayName || "",
      uploadedByEmail: currentUser()?.email || ""
    }, (progress) => {
      result.querySelector("span").style.width = `${progress}%`;
    });
    form.reset();
    const state = form.querySelector("[data-member-photo-state]");
    if (state) state.textContent = "Keine Bilder ausgewaehlt.";
    result.innerHTML = `<div class="alert alert--success" style="margin-top:12px">Danke. Die Bilder wurden an die Redaktion uebertragen.</div>`;
  });  document.querySelectorAll("[data-media-approve], [data-event-media-approve]").forEach((button) => button.addEventListener("click", async () => {
    await approveEventMediaToGallery(button.dataset.mediaApprove || button.dataset.eventMediaApprove);
    await render();
  }));

  document.querySelectorAll("[data-event-media-reject]").forEach((button) => button.addEventListener("click", async () => {
    const medium = await getOne("eventMedia", button.dataset.eventMediaReject);
    if (!medium) return;
    await upsert("eventMedia", { ...medium, status: "rejected", visibility: "internal", rejectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await render();
  }));
  document.querySelectorAll("[data-record-status]").forEach((button) => button.addEventListener("click", async () => {
    const record = await getOne(button.dataset.recordStatus, button.dataset.recordId);
    if (button.dataset.recordStatus === "members") {
      const nextVisible = button.dataset.status === "active";
      await upsert("members", {
        id: button.dataset.recordId,
        visible: nextVisible,
        isLive: nextVisible,
      });
      await render();
      return;
    }
    const updates = { ...record, status: button.dataset.status };
    if (button.dataset.recordStatus === "eventMedia") {
      updates.visibility = button.dataset.status === "approved" ? "public" : "internal";
    }
    await upsert(button.dataset.recordStatus, updates);
    await render();
  }));

  document.querySelectorAll("[data-record-visibility]").forEach((button) => button.addEventListener("click", async () => {
    const record = await getOne(button.dataset.recordVisibility, button.dataset.recordId);
    if (isProtectedInternalEditorialRecord(button.dataset.recordVisibility, record)) {
      window.alert("CMS-Interna duerfen nicht unsichtbar geschaltet werden.");
      return;
    }
    await upsert(button.dataset.recordVisibility, {
      ...record,
      visibility: button.dataset.visibility,
      status: button.dataset.status || record.status,
      updatedAt: new Date().toISOString()
    });
    await render();
  }));

  const cmsBulkToolbar = document.querySelector("[data-cms-bulk-toolbar]");
  const cmsBulkItems = Array.from(document.querySelectorAll("[data-cms-bulk-item]"));
  if (cmsBulkToolbar && cmsBulkItems.length) {
    const collection = cmsBulkToolbar.dataset.cmsBulkCollection || "editorialContent";
    const label = cmsBulkToolbar.dataset.cmsBulkLabel || "Eintraege";
    const selectAllControls = Array.from(document.querySelectorAll("[data-cms-bulk-select-all]"));
    const clearButton = document.querySelector("[data-cms-bulk-clear]");
    const showButton = document.querySelector("[data-cms-bulk-show]");
    const hideButton = document.querySelector("[data-cms-bulk-hide]");
    const deleteButton = document.querySelector("[data-cms-bulk-delete]");
    const countLabel = document.querySelector("[data-cms-bulk-count]");
    const result = document.querySelector("[data-cms-bulk-result]");
    const selectedIds = () => cmsBulkItems.filter((item) => item.checked).map((item) => item.dataset.cmsBulkItem).filter(Boolean);
    const syncBulkState = () => {
      const ids = selectedIds();
      const allSelected = ids.length > 0 && ids.length === cmsBulkItems.length;
      selectAllControls.forEach((control) => {
        control.checked = allSelected;
        control.indeterminate = ids.length > 0 && ids.length < cmsBulkItems.length;
      });
      if (showButton) showButton.disabled = ids.length === 0;
      if (hideButton) hideButton.disabled = ids.length === 0;
      if (deleteButton) deleteButton.disabled = ids.length === 0;
      if (countLabel) countLabel.textContent = `${ids.length} ausgewaehlt`;
    };
    cmsBulkItems.forEach((item) => item.addEventListener("change", syncBulkState));
    selectAllControls.forEach((control) => control.addEventListener("change", () => {
      cmsBulkItems.forEach((item) => { item.checked = control.checked; });
      syncBulkState();
    }));
    clearButton?.addEventListener("click", () => {
      cmsBulkItems.forEach((item) => { item.checked = false; });
      syncBulkState();
    });
    const setBulkVisibility = async (nextVisible, actionButton) => {
      const ids = selectedIds();
      if (!ids.length) return;
      actionButton.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Ausgewaehlte ${escapeHtml(label)} werden ${nextVisible ? "sichtbar" : "unsichtbar"} geschaltet ...</div>`;
      try {
        const now = new Date().toISOString();
        await Promise.all(ids.map(async (id) => {
          const existing = await getOne(collection, id);
          if (!existing) return;
          const updates = { ...existing, updatedAt: now };
          if (collection === "topics") {
            updates.status = nextVisible ? "published" : "inactive";
            updates.visibility = nextVisible ? "public" : "internal";
          } else {
            updates.visible = nextVisible;
            updates.visibility = nextVisible ? "public" : "internal";
            updates.status = nextVisible ? "published" : "draft";
            updates.page = updates.page || "news";
            updates.section = updates.section || "news";
            if (nextVisible) {
              const today = new Date().toISOString().slice(0, 10);
              updates.publishDate = updates.publishDate || today;
              updates.validFrom = updates.validFrom || updates.publishDate || today;
            }
          }
          await upsert(collection, updates);
        }));
        if (result) result.innerHTML = `<div class="alert alert--success">${ids.length} ${escapeHtml(label)} ${nextVisible ? "sichtbar" : "unsichtbar"} geschaltet.</div>`;
        window.setTimeout(render, 350);
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Sammelaktion fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
      } finally {
        actionButton.disabled = false;
      }
    };
    showButton?.addEventListener("click", () => setBulkVisibility(true, showButton));
    hideButton?.addEventListener("click", async () => {
      await setBulkVisibility(false, hideButton);
    });
    deleteButton?.addEventListener("click", async () => {
      const ids = selectedIds();
      if (!ids.length) return;
      if (!window.confirm(`${ids.length} ausgewaehlte ${label} wirklich loeschen?`)) return;
      deleteButton.disabled = true;
      if (result) result.innerHTML = `<div class="alert">Ausgewaehlte ${escapeHtml(label)} werden geloescht ...</div>`;
      try {
        await Promise.all(ids.map(async (id) => {
          const record = await getOne(collection, id);
          if (!record) return;
          await deleteStoredAsset(record);
          await remove(collection, id);
        }));
        if (result) result.innerHTML = `<div class="alert alert--success">${ids.length} ${escapeHtml(label)} geloescht.</div>`;
        window.setTimeout(render, 350);
      } catch (error) {
        if (result) result.innerHTML = `<div class="alert alert--error">Loeschen fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
      } finally {
        deleteButton.disabled = false;
      }
    });
    syncBulkState();
  }

  document.querySelectorAll("[data-event-status]").forEach((button) => button.addEventListener("click", async () => {
    const existing = await getOne("events", button.dataset.eventStatus);
    const updates = { ...existing, status: button.dataset.status };
    if (button.dataset.lifecyclePhase) updates.lifecyclePhase = button.dataset.lifecyclePhase;
    await upsert("events", updates);
    await render();
  }));

  document.querySelectorAll("[data-delete-record]").forEach((button) => button.addEventListener("click", async () => {
    const collection = button.dataset.deleteRecord;
    const record = await getOne(collection, button.dataset.recordId);
    if (isProtectedInternalEditorialRecord(collection, record)) {
      window.alert("CMS-Interna duerfen nicht geloescht werden.");
      return;
    }
    if (!window.confirm(`${record?.name || record?.title || "Eintrag"} wirklich loeschen?`)) return;
    await deleteStoredAsset(record);
    await remove(collection, button.dataset.recordId);
    button.closest("tr")?.remove();
    await render();
  }));

  document.querySelector("[data-delete-internal-legacy]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const rows = Array.from(document.querySelectorAll('[data-internal-usage="legacy"][data-record-id]'));
    const ids = rows.map((row) => row.dataset.recordId).filter(Boolean);
    const result = document.querySelector("#internal-legacy-delete-result");
    if (!ids.length) {
      if (result) result.innerHTML = `<div class="alert">Kein Altbestand gefunden.</div>`;
      return;
    }
    if (!window.confirm(`${ids.length} Altbestand-Eintraege wirklich loeschen?`)) return;
    button.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Altbestand wird geloescht ...</div>`;
    try {
      await Promise.all(ids.map(async (id) => {
        const record = await getOne("editorialContent", id);
        if (!record || isProtectedInternalEditorialRecord("editorialContent", record)) return;
        await deleteStoredAsset(record);
        await remove("editorialContent", id);
      }));
      if (result) result.innerHTML = `<div class="alert alert--success">${ids.length} Altbestand-Eintraege geloescht.</div>`;
      rows.forEach((row) => row.remove());
      window.setTimeout(render, 350);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Altbestand konnte nicht geloescht werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-export-event]").forEach((button) => button.addEventListener("click", async () => {
    const event = await getOne("events", button.dataset.exportEvent);
    const registrations = (await list("registrations")).filter((item) => item.eventId === event.id);
    await downloadRegistrationsCsv(event, registrations);
  }));

  const memberSearch = document.querySelector("[data-member-search]");
  if (memberSearch) {
    const applyMemberSearch = () => {
      const term = String(memberSearch.value || "").trim().toLowerCase();
      const cards = Array.from(document.querySelectorAll("[data-member-card]"));
      let visibleCount = 0;
      cards.forEach((card) => {
        const match = !term || String(card.dataset.search || card.textContent || "").toLowerCase().includes(term);
        card.hidden = !match;
        if (match) visibleCount += 1;
      });
      const empty = document.querySelector("[data-member-empty]");
      if (empty) empty.hidden = visibleCount > 0;
    };
    memberSearch.addEventListener("input", applyMemberSearch);
    applyMemberSearch();
  }

  document.querySelectorAll("[data-setup-action]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#setup-result");
    const actions = { connection: checkFirebaseConnection, structure: checkFirestoreStructure, initialize: initializeDatabase };
    try {
      const result = await actions[button.dataset.setupAction]();
      const message = Array.isArray(result) ? `${result.filter((item) => item.available).length} von ${result.length} Collections enthalten Daten.` : result.message || "Aktion erfolgreich abgeschlossen.";
      output.innerHTML = `<div class="alert alert--success">${escapeHtml(message)}</div>`;
      if (button.dataset.setupAction === "initialize") setTimeout(render, 500);
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  }));
}

async function clearPreviewCaches() {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.getRegistrations?.()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  }
  if ("caches" in window) {
    await caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("pdt-platform-") || key.startsWith("prodigitaltv-pwa-"))
        .map((key) => caches.delete(key))))
      .catch(() => {});
  }
}

async function resetInstalledAppCachesIfRequested() {
  const params = new URLSearchParams(location.search || "");
  if (!params.has("resetApp")) return false;
  await clearPreviewCaches();
  params.delete("resetApp");
  params.set("v", "917");
  const nextSearch = params.toString();
  location.replace(`${location.origin}${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash || "#/home"}`);
  return true;
}

async function refreshInstalledAppShellIfNeeded() {
  if (["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:") return false;
  const version = "917";
  const key = "prodigitaltv-live-shell-version";
  try {
    if (localStorage.getItem(key) === version) return false;
    await clearPreviewCaches();
    localStorage.setItem(key, version);
    const params = new URLSearchParams(location.search || "");
    if (params.get("v") !== version) {
      params.set("v", version);
      const nextSearch = params.toString();
      location.replace(`${location.origin}${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash || "#/home"}`);
      return true;
    }
  } catch (error) {
    await clearPreviewCaches();
  }
  return false;
}

resetInstalledAppCachesIfRequested().then((didReset) => {
  if (didReset) return;
  refreshInstalledAppShellIfNeeded().then((didRefresh) => {
    if (didRefresh) return;
    onRouteChange(render);
    render();
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) {
      waitForAuthReady().finally(render);
    }
  });
});

