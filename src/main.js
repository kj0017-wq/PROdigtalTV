import { route, onRouteChange, go } from "./utils/router.js";
import {
  homePage, eventsPage, eventDetailPage, registrationPage, topicsPage, topicDetailPage,
  newsPage, newsDetailPage, aboutPage, internalDetailPage, membersPage, boardPage, archivePage, downloadsPage, joinPage, loginPage, memberPortalPage, legalPage, notFoundPage, webappQrPage
} from "./pages/publicPages.js?v=493";
import { currentUser, login, loginWithGoogle, logout, refreshAuthToken, waitForAuthReady } from "./firebase/authService.js?v=464";
import { getOne, list, upsert, remove } from "./firebase/dataService.js?v=465";
import { escapeHtml, formatDate } from "./utils/format.js";

const root = document.querySelector("#app");
const mobilePublicOrigin = "https://prodigitaltv-da47b.web.app";
const defaultAiEditorialThumbnailPrompt = "Fotorealistisches redaktionelles 16:9-Vorschaubild fuer PROdigitalTV: serioeser moderner Business-Look, TV-, Streaming- und digitale Medienbranche, klare Komposition, natuerliches Licht, keine echten Logos, keine realen Personen, keine Comic-Optik, keine irrefuehrenden Bildinhalte.";

const lazy = {};
const cmsPages = () => lazy.cmsPages ||= import("./cms/cmsPages.js?v=491");
const aiEditorialPages = () => lazy.aiEditorialPages ||= import("./cms/aiEditorialPages.js?v=462");
const mediaPages = () => lazy.mediaPages ||= import("./cms/mediaPages.js?v=49");
const registrationService = () => lazy.registrationService ||= import("./firebase/registrationService.js");
const storageService = () => lazy.storageService ||= import("./firebase/storageService.js?v=5");
const setupService = () => lazy.setupService ||= import("./firebase/setupService.js");
const csvService = () => lazy.csvService ||= import("./utils/csv.js");
const openaiService = () => lazy.openaiService ||= import("./ai/openaiService.js?v=316");
const ttsService = () => lazy.ttsService ||= import("./ai/ttsService.js?v=2");
const aiSourceCatalogService = () => lazy.aiSourceCatalog ||= import("./data/aiSourceCatalog.js");

const createRegistration = async (...args) => (await registrationService()).createRegistration(...args);
const deleteStoredAsset = async (...args) => (await storageService()).deleteStoredAsset(...args);
const uploadEntityImage = async (...args) => (await storageService()).uploadEntityImage(...args);
const uploadEventMedia = async (...args) => (await storageService()).uploadEventMedia(...args);
const uploadGalleryImages = async (...args) => (await storageService()).uploadGalleryImages(...args);
const uploadMediaAsset = async (...args) => (await storageService()).uploadMediaAsset(...args);
const checkFirebaseConnection = async (...args) => (await setupService()).checkFirebaseConnection(...args);
const checkFirestoreStructure = async (...args) => (await setupService()).checkFirestoreStructure(...args);
const initializeDatabase = async (...args) => (await setupService()).initializeDatabase(...args);
const createDemoData = async (...args) => (await setupService()).createDemoData(...args);
const removeDemoData = async (...args) => (await setupService()).removeDemoData(...args);
const downloadRegistrationsCsv = async (...args) => (await csvService()).downloadRegistrationsCsv(...args);
const callChatGptAction = async (...args) => (await openaiService()).callChatGptAction(...args);
const generateCmsThumbCollage = async (...args) => (await openaiService()).generateCmsThumbCollage(...args);
const saveAiDraft = async (...args) => (await openaiService()).saveAiDraft(...args);
const runAiEditorialTask = async (...args) => (await openaiService()).runAiEditorialTask(...args);
const saveAiEditorialSettings = async (...args) => (await openaiService()).saveAiEditorialSettings(...args);
const generateAiEditorialThumbnail = async (...args) => (await openaiService()).generateAiEditorialThumbnail(...args);
const generateAiTopicSuggestions = async (...args) => (await openaiService()).generateAiTopicSuggestions(...args);
const importGermanPressReleases = async (...args) => (await openaiService()).importGermanPressReleases(...args);
const importNewsFromSources = async (...args) => (await openaiService()).importNewsFromSources(...args);
const generateArticleSpeechAsset = async (...args) => (await ttsService()).generateArticleSpeechAsset(...args);
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

async function viewForRoute(current) {
  if (current.path === "home") return homePage();
  if (current.path === "events") return eventsPage();
  if (current.path === "event") return eventDetailPage(current.id);
  if (current.path === "register") return registrationPage(current.id);
  if (current.path === "topics") return topicsPage();
  if (current.path === "topic") return topicDetailPage(current.id);
  if (current.path === "news" && current.id) return newsDetailPage(current.id);
  if (current.path === "news") return newsPage();
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
  if (current.path === "portal") return memberPortalPage();
  if (current.path === "imprint") return legalPage("imprint");
  if (current.path === "privacy") return legalPage("privacy");
  if (current.path === "cms" && mobileCmsDisabled()) return mobileCmsPlaceholder();
  if (current.path === "cms" && current.id === "media") {
    const { mediaPage } = await mediaPages();
    return mediaPage(current.section || "library", current.query);
  }
  if (current.path === "cms" && current.id === "ai-editorial") {
    const { aiEditorialPage } = await aiEditorialPages();
    return aiEditorialPage(current.section || "dashboard", current.query);
  }
  if (current.path === "cms") {
    const {
      dashboardPage, eventsAdminPage, eventFollowUpPage, eventEditPage, registrationsPage,
      moduleListPage, contentEditPage, setupPage, chatGptPage, aiSettingsPage, mailAdminPage, audioAdminPage
    } = await cmsPages();
    if (!current.id) return dashboardPage();
    if (current.id === "events") return eventsAdminPage();
    if (current.id === "event") return eventEditPage(current.section, current.query.get("tab") || "base", current.query);
    if (current.id === "registrations") return registrationsPage();
    if (current.id === "followup") return eventFollowUpPage();
    if (current.id === "topics") return moduleListPage("topics");
    if (current.id === "galleries") return moduleListPage("galleries");
    if (current.id === "speakers") return moduleListPage("speakers");
    if (current.id === "sponsors") return moduleListPage("sponsors");
    if (current.id === "members") return moduleListPage("members");
    if (current.id === "membership-applications") return moduleListPage("membershipApplications");
    if (current.id === "member-documents") return moduleListPage("memberDocuments");
    if (current.id === "member-directories") return moduleListPage("memberDirectories");
    if (current.id === "users") return moduleListPage("users");
    if (current.id === "board") return moduleListPage("boardMembers");
    if (current.id === "editorial") return moduleListPage("editorialContent", current.section || "press");
    if (current.id === "mail") return moduleListPage("mailQueue");
    if (current.id === "audio") return audioAdminPage();
    if (current.id === "mail-admin") return mailAdminPage();
    if (current.id === "chatgpt") return chatGptPage();
    if (current.id === "ai-settings") return aiSettingsPage();
    if (current.id === "edit") return contentEditPage(current.query.get("module"), current.query.get("id"), current.query);
    if (current.id === "setup") return setupPage();
  }
  return notFoundPage();
}

async function render() {
  try {
    applyTheme();
    closePublicTts();
    if (root && !root.innerHTML) {
      root.innerHTML = `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">CMS</p><h1>Lade Inhalte ...</h1></div></section>`;
    }
    root.innerHTML = await viewForRoute(route());
    normalizePublicGermanText();
    wireActions();
    updateMobileQrCode();
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error(error);
    root.innerHTML = `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Seite konnte nicht geladen werden</p><h1>Bitte neu laden</h1><p style="margin:14px 0 24px">${escapeHtml(error.message || String(error))}</p><a class="button button--primary" href="#/login">Zum Login</a></div></section>`;
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
  const mobileUrl = mobileUrlForCurrentRoute();
  link.href = mobileUrl;
  link.title = mobileUrl;
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=1&data=${encodeURIComponent(mobileUrl)}`;
}

function clickedAnchor(event) {
  return event.target?.closest?.("a[href]") || null;
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

function closePublicTts() {
  if (!activePublicTts) return;
  activePublicTts.audio?.pause();
  activePublicTts.timer && clearInterval(activePublicTts.timer);
  activePublicTts.node?.remove();
  activePublicTts = null;
}

function ttsWords(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function ttsWordWeights(words = []) {
  return words.map((word) => {
    const cleanLength = Math.max(1, String(word).replace(/[^\p{L}\p{N}]/gu, "").length);
    const punctuationPause = /[.!?;:]$/.test(word) ? 3.2 : /[,)]$/.test(word) ? 1.8 : 0;
    return Math.max(1.2, cleanLength * 0.42) + punctuationPause;
  });
}

function ttsWordIndexForTime(state) {
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
  const current = state.audio.currentTime || 0;
  const index = state.wordWeights.findIndex((slot) => current >= slot.start && current < slot.end);
  return index >= 0 ? index : Math.max(0, Math.min(state.words.length - 1, state.words.length - 1));
}

function ttsSourceText(reader) {
  const template = reader?.querySelector("[data-tts-source]");
  return template?.content?.textContent || template?.textContent || "";
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
}

async function startPublicTts(button) {
  const reader = button.closest("[data-tts-reader]");
  const mode = button.dataset.ttsMode || "natural";
  let audioUrl = button.dataset.audioUrl || "";
  if (mode === "natural" && !audioUrl) {
    audioUrl = reader?.querySelector('[data-tts-mode="accessible"]')?.dataset.audioUrl || "";
  }
  if (!reader || !audioUrl) throw new Error("Keine Audiodatei fuer diesen Inhalt vorhanden.");
  closePublicTts();
  const audio = new Audio(audioUrl);
  audio.preload = "metadata";
  const isAccessible = mode === "accessible";
  const words = isAccessible ? ttsWords(ttsSourceText(reader)) : [];
  const readingText = words.map((word, index) => `<span class="tts-reading-layer__token" data-tts-word-index="${index}">${escapeHtml(word)}</span>`).join(" ");
  const node = document.createElement("div");
  node.className = isAccessible ? "tts-reading-layer" : "tts-natural-player";
  node.setAttribute("role", isAccessible ? "dialog" : "status");
  node.innerHTML = isAccessible
    ? `<div class="tts-reading-layer__box" aria-modal="false">
        <div class="tts-reading-layer__head"><div><p class="eyebrow">Barrierefrei vorlesen</p><strong>Lesedisplay</strong></div><button type="button" class="button button--secondary button--small" data-tts-close>Schliessen</button></div>
        <div class="tts-reading-layer__word" data-tts-current-word>${escapeHtml(words[0] || "Bereit")}</div>
        <div class="tts-reading-layer__text" data-tts-text>${readingText}</div>
        <div class="tts-reading-layer__controls">
          <button type="button" class="button button--secondary button--small" data-tts-pause>Pause</button>
          <button type="button" class="button button--secondary button--small" data-tts-close>Stop</button>
        </div>
      </div>`
    : `<div class="tts-natural-player__box">
        <strong>Natural Voice</strong>
        <button type="button" class="button button--secondary button--small" data-tts-pause>Pause</button>
        <button type="button" class="button button--secondary button--small" data-tts-close>Stop</button>
      </div>`;
  reader.after(node);
  activePublicTts = {
    audio,
    node,
    words,
    wordNode: node.querySelector("[data-tts-current-word]"),
    wordNodes: Array.from(node.querySelectorAll("[data-tts-word-index]")),
    timer: null
  };
  const pauseButton = node.querySelector("[data-tts-pause]");
  node.querySelector("[data-tts-close]")?.addEventListener("click", closePublicTts);
  pauseButton?.addEventListener("click", async () => {
    if (audio.paused) {
      await audio.play();
      pauseButton.textContent = "Pause";
      return;
    }
    audio.pause();
    pauseButton.textContent = "Fortsetzen";
  });
  audio.addEventListener("ended", closePublicTts, { once: true });
  audio.addEventListener("error", () => {
    node.innerHTML = `<div class="alert alert--warning">Audio ist fuer diesen Text noch nicht verfuegbar. Bitte im CMS neu erzeugen.</div>`;
  }, { once: true });
  if (isAccessible) {
    activePublicTts.timer = setInterval(() => updateAccessibleTtsWord(activePublicTts), 140);
    audio.addEventListener("timeupdate", () => updateAccessibleTtsWord(activePublicTts));
  }
  await audio.play();
}

document.addEventListener("click", (event) => {
  const link = clickedAnchor(event);
  if (!link || !isExternalPortalLink(link)) return;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  event.stopPropagation();
  window.open(link.href, link.target || "_blank", "noopener,noreferrer");
}, true);

document.addEventListener("click", (event) => {
  const link = clickedAnchor(event);
  if (!link || !link.matches('a[href^="#/"]')) return;
  window.setTimeout(render, 0);
});

function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach((item) => {
    data[item.name] = item.checked;
  });
  return data;
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

function speechSourceText(collection, item = {}) {
  return collection === "topics"
    ? [item.subtitle, item.longDescription, item.bodyText, item.shortDescription].filter(Boolean).join("\n\n")
    : [item.subtitle, item.bodyText, item.introText, item.shortText, item.teaserText].filter(Boolean).join("\n\n");
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
  if (Object.prototype.hasOwnProperty.call(normalized, "contactPhone") || Object.prototype.hasOwnProperty.call(normalized, "phone")) {
    const phone = normalized.contactPhone || normalized.phone || "";
    normalized.contactPhone = phone;
    normalized.phone = phone;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "contactEmail") || Object.prototype.hasOwnProperty.call(normalized, "email")) {
    const email = normalized.contactEmail || normalized.email || "";
    normalized.contactEmail = email;
    normalized.email = email;
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
    || ["intro", "hero", "legal", "internal", "footer"].includes(record.section);
}

function normalizeInternalEditorialValues(values = {}) {
  if (!["ueber_uns", "mitglied_werden"].includes(values.bereich)) return values;
  const slug = String(values.slug || values.id || "").trim();
  const page = values.bereich === "ueber_uns" ? "about" : "join";
  const publicVisibility = values.sichtbarkeit === "oeffentlich" ? "public" : values.sichtbarkeit === "mitglieder" ? "members" : "internal";
  return {
    ...values,
    slug,
    id: values.id,
    page,
    section: "internal",
    key: `${values.bereich}.${slug || values.key || ""}`,
    title: values.titel || values.title || "",
    introText: values.kurztext || values.introText || "",
    bodyText: values.langtext || values.bodyText || "",
    sortOrder: Number(values.sortierung || values.sortOrder || 0),
    buttonText: values.button_text || values.buttonText || "",
    buttonUrl: values.button_ziel || values.buttonUrl || "",
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
    ["dubletten", "Dublettenpruefung fehlt"],
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
      "Der Text soll 250 bis 350 Woerter haben, sachlich sein und nur belegte Aussagen verwenden.",
      "Die KI muss Quellen, Belegstellen und Dublettenstatus beachten.",
      "Bitte Headline, Subline und klare Branchen-Einordnung vorbereiten."
    ].join("\n"),
    source_check: [
      "Redaktion: Erstelle einen Prompt fuer die Quellenpruefung.",
      "Der Prompt soll Domain, Herausgeber, Trust-Score, Quellentyp und belegte Aussage pruefen.",
      "Gesperrte oder ungepruefte Quellen duerfen keine automatische Veroeffentlichung erlauben."
    ].join("\n"),
    duplicate_check: [
      "Redaktion: Wir brauchen einen Prompt fuer die Dublettenpruefung.",
      "Vergleiche Headline, Subline, Kategorie, Tags, Kernthema, zentrale Aussagen, Quellen und Slug.",
      "Nur ein neuer belegbarer Blickwinkel darf als neuer Beitrag weiterlaufen."
    ].join("\n"),
    final_check: [
      "Redaktion: Erstelle einen Prompt fuer die Endpruefung.",
      "Der Prompt muss Halluzinationen, Quellenpflicht, Dubletten, Belegstellen, Rechtsrisiken und Pflichtfelder pruefen.",
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
  if (clean.includes("dublette") || clean.includes("doppelt")) return "Dublettenpruefung";
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
    "Keine Veroeffentlichung bei Dubletten, ungeprueften Quellen, gesperrten Quellen oder unklarer Faktenlage.",
    "Schreibe sachlich, klar, journalistisch und leicht verstaendlich."
  ].join("\n");
  const promptText = [
    `Aufgabe: ${source || "Fuehre den angeforderten redaktionellen Pruef- oder Erzeugungsschritt aus."}`,
    "",
    "Nutze ausschliesslich diese CMS-Daten:",
    "- Thema: {{THEMA}}",
    "- Kategorie: {{KATEGORIE}}",
    "- Quellen: {{QUELLEN}}",
    "- Bestehende Beitraege / Dublettenliste: {{DUBLETTENLISTE}}",
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
    ? `Grundlage fuer die weitere redaktionelle Bearbeitung sind unter anderem Veroeffentlichungen von ${sourceLabels.join(", ")}.`
    : "Die konkrete Quellenbasis muss im Editor ergaenzt und belegt werden.";
  return [
    subline || `${headline} rueckt ein aktuelles Thema der digitalen Medienbranche in den Fokus.`,
    `Fuer ProDigitalTV ist das Thema vor allem im Bereich ${category} relevant. Im Mittelpunkt steht ${mainKeyword}: Medienanbieter, Produzenten, Plattformbetreiber und Vermarkter muessen einordnen, welche Folgen sich fuer Angebote, Technik, Rechte, Nutzung oder Refinanzierung ergeben.`,
    `${sourceSentence} Entscheidend ist, dass aus dem Fund ein klarer Branchenbezug entsteht: Was hat sich konkret veraendert, welche Akteure sind betroffen und welche Konsequenz ergibt sich fuer TV, Streaming, Produktion oder digitale Distribution?`,
    "Der Beitrag sollte diese Entwicklung knapp, sachlich und leicht verstaendlich erklaeren. Fachbegriffe werden nur verwendet, wenn sie notwendig sind, und dann kurz eingeordnet."
  ].join("\n\n");
}

function cleanEditorialSentence(value = "") {
  return String(value || "")
    .replace(/\b(redaktioneller Themenkandidat|Themenkandidat|Vorschlag|Quellenfund|redaktionell pruefen|redaktionell prüfen)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function draftArticleTextFromTopic(topic = {}) {
  const title = String(topic.headline || topic.title || "Medienthema").replace(/^Themenvorschlag:\s*/i, "");
  const keywordList = Array.isArray(topic.keywords) ? topic.keywords : [];
  const mainKeyword = keywordList[0] || topic.category || "das Thema";
  const category = topic.category || "Medienbranche";
  const teaser = cleanEditorialSentence(topic.teaser || topic.summary || topic.reason || topic.subline || "");
  const subline = cleanEditorialSentence(topic.subline || "");
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
    ? `Als Quellenbasis dienen aktuelle Fundstellen von ${uniqueSourceNames.join(", ")}.`
    : "Die belastbare Quellenbasis wird im Quellenbereich des Editors ergaenzt.";
  return [
    teaser || subline || `${title} beschreibt eine aktuelle Entwicklung mit Relevanz fuer die Medienbranche.`,
    `Fuer Sender, Produzenten, Plattformbetreiber und digitale Medienangebote ist das Thema im Bereich ${category} relevant. Im Mittelpunkt steht ${mainKeyword}. Entscheidend ist, wie sich die Entwicklung auf Reichweite, Technik, Rechte, Vermarktung, Produktion oder Nutzerfuehrung auswirkt.`,
    `${sourceSentence} Der redaktionelle Beitrag sollte daraus eine klare Einordnung ableiten: Was ist passiert, warum ist es aktuell und welche Bedeutung hat es fuer TV, Streaming, Plattformen, regionale Medien oder die digitale Distribution?`,
    "Die fertige Fassung bleibt sachlich, kurz und gut verstaendlich. Sie verzichtet auf Spekulationen und beschreibt nur Aussagen, die durch die hinterlegten Quellen belegbar sind."
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
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
  const closing = "Der Rückblick dokumentiert die wichtigsten Impulse, Eindrücke und Anknüpfungspunkte für die digitale Medienwirtschaft.";
  return [summary, facts, closing].filter(Boolean).join("\n\n");
}

function eventRetrospectiveIntro(event = {}) {
  return event.postEventSummary || event.postEventummary || event.description || event.subtitle || "Redaktioneller Rückblick auf ein PROdigitalTV-Event.";
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
  return [
    userPrompt,
    `Erzeuge Variante ${variantNumber} als eigenstaendiges, kreatives redaktionelles Thumbnail fuer den Beitrag "${title}".`,
    subtitle,
    category,
    bodyHint,
    "Bildidee: ueberraschende, aber serioese visuelle Metapher aus digitaler Medienwirtschaft, Streaming, TV, Plattformen, Redaktion, Technologie oder Netzwerk.",
    "Komposition: starkes zentrales Motiv, klare Tiefe, hochwertige Lichtfuehrung, moderne Business-/Editorial-Aesthetik, PROdigitalTV-Farbakzent in Rot und Dunkelblau.",
    "Kreativitaet: nicht generisch, keine austauschbare tockfoto-Optik, gern abstrakte Datenraeume, Medieninterfaces, Lichtlinien, Glas, creens, tudio-Atmosphaere oder symbolische Branchenszenen.",
    "Einschraenkungen: keine echten Logos, keine identifizierbaren realen Personen, keine Textfehler im Bild, keine Comic-Optik, keine irrefuehrenden Fakten.",
    "Format: 16:9, geeignet als Website-Thumbnail und Artikelkopf."
  ].filter(Boolean).join("\n");
}

function generatedThumbTitle(context = {}, variantNumber = 1) {
  return `${context.title || "PROdigitalTV Thumb"} - KI-Variante ${variantNumber}`;
}

function mediaPresetSummary(type = "upload") {
  const preset = mediaUsagePreset(type);
  return `${preset.aspect} · ${preset.width} x ${preset.height}px · ${preset.portal} · ${preset.mobile}`;
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
    ["1x1", 1],
    ["4x5", 4 / 5],
    ["9x16", 9 / 16],
    ["4x3", 4 / 3],
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
  if (clean === "logo") return "2.55 / 1";
  if (clean === "4x3") return "4 / 3";
  return "16 / 9";
}

function mediaVariantCanvasSize(format = "16x9") {
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
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Bildvariante konnte nicht erzeugt werden."));
        return;
      }
      resolve(new File([blob], filename, { type }));
    }, type, quality);
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
  document.querySelectorAll("[data-media-edit-link]").forEach((card) => {
    if (card.dataset.mediaEditLinkWired === "1") return;
    card.dataset.mediaEditLinkWired = "1";
    const open = () => {
      if (card.dataset.mediaEditLink) {
        try {
          const id = new URLSearchParams(card.dataset.mediaEditLink.split("?")[1] || "").get("id");
          if (id) localStorage.setItem("pdt-last-media-asset-id", id);
        } catch {}
        window.location.hash = card.dataset.mediaEditLink;
      }
    };
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input, select, textarea, label, summary, details")) return;
      open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
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

async function saveGeneratedThumbMediaAsset(form, file, { dataUrl = "", prompt = "", result = null, variantNumber = 1, contextOverride = null, targetContextOverride = null } = {}) {
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
  const uploadedOriginal = await uploadMediaAsset(optimizedUploads.original.file, optimizedUploads.original.path);
  const [uploadedWeb, uploadedThumb] = await Promise.all([
    optimizedUploads.web.path === optimizedUploads.original.path ? Promise.resolve(uploadedOriginal) : uploadMediaAsset(optimizedUploads.web.file, optimizedUploads.web.path),
    optimizedUploads.thumb.path === optimizedUploads.original.path ? Promise.resolve(uploadedOriginal) : uploadMediaAsset(optimizedUploads.thumb.file, optimizedUploads.thumb.path)
  ]);
  const now = new Date().toISOString();
  const description = [
    `KI-Thumbnail-Variante ${variantNumber} fuer ${context.title || targetContext.targetId}.`,
    context.subtitle || "",
    context.category ? `Rubrik: ${context.category}` : ""
  ].filter(Boolean).join(" ");
  const asset = await upsert("media_assets", {
    id: `media-asset-${crypto.randomUUID()}`,
    media_code: mediaCode,
    title,
    slug: normalizeMedialug(title),
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
    file_size_label: mediaizeLabel(optimizedUploads.web.file.size),
    image_width: optimizedUploads.web.width || 1600,
    image_height: optimizedUploads.web.height || 900,
    image_format: mediaFormatLabel(optimizedUploads.web.file),
    original_filename: file.name,
    source_type: "ai",
    source_note: `KI-Thumbnail-Variante ${variantNumber}`,
    generated_prompt: prompt,
    prompt,
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
  await attachMediaAssetToTarget(asset, targetContext);
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
    ...(`${title} ${subline}`).match(/[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]{3,}/g) || []
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
  String(body).match(/[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]{4,}(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]{3,})?/g)?.slice(0, 18).forEach((keyword) => {
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

function researchSourceLabel(source = {}) {
  return source.name || source.title || source.publisher || source.domain || "Quelle";
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
    ${recentScans.length ? `<div class="ai-research-source-strip">${recentScans.map((scan) => `<span>${escapeHtml(scan.source_name || scan.source_domain || "Portal")} · ${Number(scan.count || 0)}</span>`).join("")}</div>` : ""}
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
    <p class="muted">KI-Ausgaben werden nicht automatisch veroeffentlicht. Bitte pruefen, bearbeiten und erst danach speichern.</p>
  </div>`;
  document.body.append(wrapper);
  wrapper.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => wrapper.remove()));
  wrapper.querySelector("[data-ai-accept]").addEventListener("click", () => {
    const value = normalizeAiSuggestion(wrapper.querySelector("[data-ai-suggestion]").value, button, sourceField);
    if (sourceField && "value" in sourceField) sourceField.value = value;
    if (button.dataset.aiAction === "rewritePressRetrospective") {
      markPressRetrospectiveForm(button);
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
        status.innerHTML = `<span>KI-Thumb Variante ${variantNumber} wurde gespeichert, dem Beitrag zugeordnet und ist in der Mediathek auswählbar.</span>`;
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
      status.textContent = "Bild zum Löschen markiert. Bitte speichern.";
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
    if (label && count) label.textContent = `${count} Bild${count === 1 ? "" : "er"} ausgewaehlt. Upload startet automatisch.`;
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
      <div class="gallery-player__top"><strong>${escapeHtml(gallery.title || "Bildergalerie")}</strong><button class="gallery-player__close" type="button" data-gallery-close aria-label="Schliessen">×</button></div>
      <figure class="gallery-player__stage"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText || image.caption || "Galeriebild")}">${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}</figure>
      <div class="gallery-player__controls">
        <button type="button" data-gallery-prev aria-label="Vorheriges Bild">‹</button>
        <span>${index + 1} / ${images.length}</span>
        <button type="button" data-gallery-next aria-label="Naechstes Bild">›</button>
        <button type="button" data-gallery-toggle>${timer ? "Pause" : "Play"}</button>
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

async function saveGeneratedImageFallback(form, dataUrl, fileName) {
  const module = form.dataset.module || (form.id === "topic-editor-form" ? "topics" : "editorialContent");
  const id = form.dataset.id || form.dataset.topicId;
  const existing = (await getOne(module, id)) || { id, createdAt: new Date().toISOString() };
  const values = { ...existing, imageUrl: dataUrl, assetStoragePath: "", updatedAt: new Date().toISOString() };
  if (module === "editorialContent") {
    values.assetUrl = dataUrl;
    values.assetFileName = fileName || `${id}-ki-thumb.jpg`;
    values.assetType = "image";
    values.documentUrl = "";
  }
  await upsert(module, values);
  updateDropzoneSavedImage(form, dataUrl);
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
  if (imageStatus) imageStatus.textContent = imageUpdate.photoUrl ? "Bild wurde gespeichert." : imageUpdate.photoUrl === "" ? "Bild wurde gelöscht." : imageStatus.textContent;
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
  toggle.addEventListener("click", () => setOpen(!topbar.classList.contains("is-public-menu-open")));
  closeTargets.forEach((target) => target.addEventListener("click", () => setOpen(false)));
}

function wireAboutJumps() {
  document.querySelectorAll("[data-about-jump]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const slug = link.getAttribute("data-about-jump");
      const target = slug ? document.getElementById(`about-text-${slug}`) : null;
      if (!target) return;
      event.preventDefault();
      const headerOffset = (document.querySelector(".topbar")?.getBoundingClientRect().height || 0) + 18;
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
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
  let activeource = sourceButtons.find((button) => button.classList.contains("is-active"))?.dataset.mediaourcewitch || "";
  const apply = () => {
    const term = String(search?.value || "").trim().toLowerCase();
    const activeFilters = filters.map((filter) => [filter.dataset.mediaFilter, filter.value]).filter(([, value]) => value);
    cards.forEach((card) => {
      const matchesTerm = !term || String(card.dataset.search || "").includes(term);
      const matchesource = !activeource || card.dataset.source === activeource;
      const matchesFilters = activeFilters.every(([key, value]) => card.dataset[key] === value);
      card.hidden = !(matchesTerm && matchesource && matchesFilters);
    });
  };
  search?.addEventListener("input", apply);
  filters.forEach((filter) => filter.addEventListener("change", apply));
  sourceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeource = button.dataset.mediaourcewitch || "";
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

function mediaContextFromNode(node) {
  return {
    targetCollection: node?.dataset.mediaTargetCollection || "",
    targetId: node?.dataset.mediaTargetId || "",
    targetField: node?.dataset.mediaTargetField || "imageUrl",
    targetAltField: node?.dataset.mediaTargetAltField || "",
    returnTo: node?.dataset.mediaReturnTo || ""
  };
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

function mediaAssetUrl(asset = {}) {
  return asset.file_path_thumb_url || asset.file_path_web_url || asset.file_path_original_url || asset.imageUrl || asset.assetUrl || "";
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
    if (result) result.innerHTML = `<div class="alert">${progressMarkup(`Thumb ${index + 1} von ${candidates.length} wird in die Mediathek übernommen ...`, 25 + Math.round(((index + 1) / Math.max(1, candidates.length)) * 65))}</div>`;
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
      slug: normalizeMedialug(`${candidate.title || candidate.id}-${mediaCode}`),
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
    result.innerHTML = `<div class="alert alert--success">${created} Thumb${created === 1 ? "" : "s"} in die Mediathek übernommen, ${linked} Verknüpfung${linked === 1 ? "" : "en"} aktualisiert.</div>`;
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
  if (context.targetCollection === "members" && (context.targetField || "logoUrl") === "logoUrl") {
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
      window.setTimeout(() => { window.location.hash = mediaEditHash(asset.id, form); }, 700);
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Upload fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function wireMediaAiDraft() {
  document.querySelector("[data-media-ai-form]")?.addEventListener("submit", async (event) => {
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
    try {
      const target = mediaContext.targetCollection && mediaContext.targetId ? await getOne(mediaContext.targetCollection, mediaContext.targetId) : null;
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
      const prompt = creativeThumbPrompt({
        ...targetContext,
        title: values.title || targetContext.title,
        bodyText: [targetContext.bodyText, values.source_text].filter(Boolean).join("\n\n")
      }, values.generated_prompt || "", variantNumber);
      if (result) result.innerHTML = `<div class="alert">${progressMarkup("KI erzeugt ein redaktionelles Thumbnail mit Beitragsbezug ...", 35)}</div>`;
      const generated = await generateCmsThumbCollage({
        entityType: mediaContext.targetCollection || "media_assets",
        entityId: mediaContext.targetId || "",
        prompt,
        context: {
          ...targetContext,
          sourceText: values.source_text || "",
          style: values.style || "",
          colorWorld: values.color_world || "",
          variantNumber
        },
        size: "1536x1024",
        quality: "medium"
      });
      const normalized = await generatedThumbToJpeg(generated.imageDataUrl, generated.fileName || `${mediaContext.targetId || values.title || "ki-thumb"}-v${variantNumber}.png`, mediaVariantCanvasize(values.aspect_ratio || "16x9"));
      if (result) result.innerHTML = `<div class="alert">${progressMarkup("KI-Bild wurde erzeugt und wird gespeichert ...", 72)}</div>`;
      const asset = await saveGeneratedThumbMediaAsset(form, normalized.file, {
        dataUrl: normalized.dataUrl,
        prompt: generated.prompt || prompt,
        result,
        variantNumber,
        contextOverride: { ...targetContext, title: values.title || targetContext.title },
        targetContextOverride: mediaContext.targetCollection && mediaContext.targetId ? mediaContext : null
      });
      await upsert("ai_image_generations", {
        id: `ai-image-generation-${crypto.randomUUID()}`,
        media_asset_id: asset.id,
        prompt_id: "",
        source_text: values.source_text || "",
        generated_prompt: generated.prompt || prompt,
        negative_prompt: "",
        model_name: "OpenAI Image",
        generation_status: "generated",
        review_status: mediaContext.targetId ? "attached" : "draft",
        created_by: currentUser()?.email || currentUser()?.uid || "cms",
        created_at: new Date().toISOString()
      });
      if (result) result.innerHTML = `<div class="alert alert--success">KI-Thumb wurde erzeugt, in der Mediathek gespeichert${mediaContext.targetId ? " und dem Beitrag zugeordnet" : ""}.</div>`;
      if (mediaContext.returnTo) {
        window.setTimeout(() => { window.location.hash = mediaContext.returnTo.replace(/^#\/?/, "#/"); }, 900);
      } else {
        window.setTimeout(() => { window.location.hash = mediaEditHash(asset.id, form); }, 900);
      }
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">KI-Thumb konnte nicht erstellt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
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
    const saveEditedMemberLogo = mediaContext.targetCollection === "members"
      && mediaContext.targetField === "logoUrl"
      && form.dataset.mediaCropDirty === "1"
      && form.querySelector("[data-media-crop-apply]");
    if (saveEditedMemberLogo) {
      if (result) result.innerHTML = `<div class="alert">Bearbeitetes Logo wird gespeichert und dem Mitglied zugeordnet ...</div>`;
      form.querySelector("[data-media-crop-apply]")?.click();
      setaveButtonFeedback(submitButton, "success", "Logo wird gespeichert");
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
      if (values.createVariant === "1") {
        const nextVersion = `v${Date.now().toString().slice(-6)}`;
        const filename = buildMediaFileName({ title: update.title, mediaType: update.media_type || "upload", format: update.aspect_ratio || "16x9", version: "v1", extension: String(update.filename_web || "webp").split(".").pop() });
        await upsert("media_variants", {
          id: `media-variant-${crypto.randomUUID()}`,
          media_asset_id: asset.id,
          variant_type: "edited",
          format: asset.aspect_ratio || "16x9",
          file_path: asset.file_path_web || asset.file_path_original || "",
          file_url: asset.file_path_web_url || asset.file_path_original_url || "",
          filename,
          crop_data: { x: update.crop_x, y: update.crop_y, scale: update.crop_scale, brightness: update.brightness, contrast: update.contrast, saturation: update.saturation, sharpness: update.sharpness },
          focal_point_x: update.focal_point_x,
          focal_point_y: update.focal_point_y,
          version: nextVersion,
          created_at: now,
          created_by: currentUser()?.email || currentUser()?.uid || "cms"
        });
      }
      const presetVariants = mediaPresetVariants(update, values);
      await Promise.all(presetVariants.map((variant) => upsert("media_variants", variant)));
      if (mediaContext.targetCollection && mediaContext.targetId) {
        await attachMediaAssetToTarget(update, mediaContext);
        const assignmentLabel = mediaContext.targetCollection === "members" && mediaContext.targetField === "logoUrl" ? "Mitgliederlogo" : "Thumb";
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
    values.variant_landscape ? { type: "landscape", label: "Landscape", format: "16x9", usage_type: "landscape" } : null,
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

function wireMediaCropMask() {
  const stage = document.querySelector("[data-media-crop-stage]");
  const image = document.querySelector("[data-media-crop-image]");
  const scaleInput = document.querySelector("[data-media-crop-scale]");
  const scaleValue = document.querySelector("[data-media-crop-scale-value]");
  const xInput = document.querySelector("[data-media-crop-x]");
  const yInput = document.querySelector("[data-media-crop-y]");
  const reset = document.querySelector("[data-media-crop-reset]");
  const apply = document.querySelector("[data-media-crop-apply]");
  const form = document.querySelector("[data-media-edit-form]");
  if (!stage || !image || !scaleInput || !scaleValue || !xInput || !yInput || stage.dataset.mediaCropWired === "1") return;
  stage.dataset.mediaCropWired = "1";
  const variantButtons = Array.from(document.querySelectorAll("[data-media-variant-button]"));
  const result = form?.querySelector("#media-edit-result");
  const neutralValues = { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, black_white: false };
  const state = {
    x: 0,
    y: 0,
    scale: 1,
    format: form?.dataset.activeVariantFormat || form?.dataset.mediaAspect || "16x9",
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  };
  const render = () => {
    state.scale = Math.max(1, Number(state.scale || 1));
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
  const activeFormat = () => {
    return form?.dataset.activeVariantFormat || state.format || "16x9";
  };
  const setAspect = (control) => {
    if (!control) return;
    state.format = control.dataset.mediaVariantFormat || "16x9";
    form.dataset.activeVariantFormat = state.format;
    stage.style.setProperty("--media-crop-aspect", control.dataset.mediaVariantAspect || "16 / 9");
    state.x = 0;
    state.y = 0;
    state.scale = Math.max(1, Number(scaleInput.value || 1));
    variantButtons.forEach((button) => {
      const active = button === control;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    markDirty();
    render();
  };
  const loadVariantPreview = (control) => {
    if (!control?.dataset.mediaVariantSrc) return;
    image.src = control.dataset.mediaVariantSrc;
    const fullscreen = document.querySelector("[data-media-fullscreen-open]");
    if (fullscreen) fullscreen.dataset.mediaFullscreenSrc = control.dataset.mediaVariantSrc;
    const format = control.dataset.mediaVariantFormat || state.format || "16x9";
    state.format = format;
    form.dataset.activeVariantFormat = format;
    stage.style.setProperty("--media-crop-aspect", mediaAspectCss(format));
    state.x = 0;
    state.y = 0;
    state.scale = 1;
    document.querySelectorAll("[data-media-load-variant]").forEach((button) => {
      const active = button === control;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    render();
    markDirty();
  };
  const saveEditedAsset = async () => {
    applyCrop();
    const asset = await getOne("media_assets", form.dataset.mediaId);
    if (!asset) return;
    const values = formObject(form);
    const format = activeFormat();
    const size = mediaVariantCanvasSize(format);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    const stageRect = stage.getBoundingClientRect();
    const baseScale = Math.min(stageRect.width / Math.max(1, image.naturalWidth), stageRect.height / Math.max(1, image.naturalHeight));
    const outputScale = canvas.width / Math.max(1, stageRect.width);
    const drawWidth = image.naturalWidth * baseScale * state.scale * outputScale;
    const drawHeight = image.naturalHeight * baseScale * state.scale * outputScale;
    const drawX = (canvas.width - drawWidth) / 2 + state.x * outputScale;
    const drawY = (canvas.height - drawHeight) / 2 + state.y * outputScale;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const brightness = 1 + (Number(values.brightness || 0) / 100);
    const contrast = 1 + (Number(values.contrast || 0) / 100);
    const saturation = 1 + (Number(values.saturation || 0) / 100);
    context.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})${values.black_white ? " grayscale(1)" : ""}`;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    context.filter = "none";
    const mediaCode = mediaShortCode();
    const version = `v${Date.now().toString().slice(-6)}`;
    const mediaType = format === "portrait" ? "portrait" : format === "landscape" ? "landscape" : asset.media_type || "upload";
    const filename = buildMediaFileName({ title: values.title || asset.title || "bild", mediaType, format: size.aspect, version: "v1", extension: "webp", code: mediaCode });
    const file = await canvasToFile(canvas, filename, "image/webp", .9);
    const path = mediaStoragePath(filename, mediaType, mediaCode);
    if (result) result.innerHTML = `<div class="alert">${progressMarkup("Variante wird als neues Bild gespeichert ...", 60)}</div>`;
    const uploaded = await uploadMediaAsset(file, path);
    const now = new Date().toISOString();
    const newAsset = await upsert("media_assets", {
      ...asset,
      id: `media-asset-${crypto.randomUUID()}`,
      media_code: mediaCode,
      parent_media_asset_id: asset.id,
      title: `${values.title || asset.title || "Bild"} ${format === "portrait" ? "Hochkant" : format === "landscape" ? "Landscape" : "Variante"}`,
      slug: normalizeMediaSlug(`${values.title || asset.title || "bild"}-${format}-${mediaCode}`),
      media_type: mediaType,
      filename_original: filename,
      filename_web: filename,
      filename_thumb: filename,
      file_path_original: path,
      file_path_web: path,
      file_path_thumb: path,
      file_path_original_url: uploaded?.url || "",
      file_path_web_url: uploaded?.url || "",
      file_path_thumb_url: uploaded?.url || "",
      storage_path_original: uploaded?.storagePath || path,
      mime_type: file.type,
      aspect_ratio: size.aspect,
      file_size: file.size,
      file_size_label: mediaSizeLabel(file.size),
      image_width: canvas.width,
      image_height: canvas.height,
      image_format: "WEBP",
      original_filename: asset.original_filename || asset.filename_original || filename,
      source_type: "edited",
      source_note: `Bearbeitete Variante aus ${asset.media_code ? `ID ${asset.media_code}` : asset.id}`,
      alt_text: values.alt_text || asset.alt_text || values.title || asset.title || "Bildvariante",
      description: values.description || asset.description || "",
      crop_x: 0,
      crop_y: 0,
      crop_scale: 1,
      brightness: Number(values.brightness || 0),
      contrast: Number(values.contrast || 0),
      saturation: Number(values.saturation || 0),
      sharpness: Number(values.sharpness || 0),
      black_white: Boolean(values.black_white),
      file_metadata: {
        format: "WEBP",
        mime_type: file.type,
        size_bytes: file.size,
        size_label: mediaSizeLabel(file.size),
        width: canvas.width,
        height: canvas.height,
        original_filename: asset.original_filename || asset.filename_original || filename,
        edited_from: asset.id
      },
      created_by: currentUser()?.email || currentUser()?.uid || "cms",
      created_at: now,
      updated_at: now,
      status: "active"
    });
    await upsert("media_variants", {
      id: `media-variant-${crypto.randomUUID()}`,
      media_asset_id: asset.id,
      derived_media_asset_id: newAsset.id,
      variant_type: format,
      format: size.aspect,
      file_path: path,
      file_url: uploaded?.url || "",
      filename,
      crop_data: { x: Number(xInput.value || 0), y: Number(yInput.value || 0), scale: Number(scaleValue.value || 1), brightness: Number(values.brightness || 0), contrast: Number(values.contrast || 0), saturation: Number(values.saturation || 0), sharpness: Number(values.sharpness || 0), black_white: Boolean(values.black_white) },
      version,
      created_at: now,
      created_by: currentUser()?.email || currentUser()?.uid || "cms"
    });
    const mediaContext = mediaContextFromNode(form);
    if (mediaContext.targetCollection && mediaContext.targetId) {
      await attachMediaAssetToTarget(newAsset, mediaContext);
      const assignmentLabel = mediaContext.targetCollection === "members" && mediaContext.targetField === "logoUrl" ? "Mitgliederlogo" : "Thumb";
      if (result) result.innerHTML = `<div class="alert alert--success">Variante als neues ${assignmentLabel} gespeichert und zugeordnet.</div>`;
      if (mediaContext.returnTo) window.setTimeout(() => { window.location.hash = mediaContext.returnTo.replace(/^#\/?/, "#/"); }, 700);
    } else if (result) {
      result.innerHTML = `<div class="alert alert--success">Variante als neues Bild gespeichert. <a href="#/cms/media/edit?id=${newAsset.id}">Neues Bild bearbeiten</a></div>`;
    }
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
    render();
  });
  const stop = () => { state.dragging = false; };
  stage.addEventListener("pointerup", stop);
  stage.addEventListener("pointerleave", stop);
  scaleInput.addEventListener("input", () => {
    state.scale = Math.max(1, Number(scaleInput.value || 1));
    markDirty();
    render();
  });
  stage.addEventListener("pointermove", () => {
    markDirty();
  });
  variantButtons.forEach((button) => button.addEventListener("click", () => setAspect(button)));
  document.querySelectorAll("[data-media-load-variant]").forEach((button) => {
    button.addEventListener("click", () => loadVariantPreview(button));
  });
  apply?.addEventListener("click", async () => {
    setaveButtonFeedback(apply, "saving", "peichere ...");
    try {
      await saveEditedAsset();
      if (form) delete form.dataset.mediaCropDirty;
      setaveButtonFeedback(apply, "success", "Gespeichert");
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Variante konnte nicht gespeichert werden: ${escapeHtml(error.message || String(error))}</div>`;
      setaveButtonFeedback(apply, "error", "Fehler");
    } finally {
      if (!apply.classList.contains("is-save-success") && !apply.classList.contains("is-save-error")) apply.disabled = false;
    }
  });
  reset?.addEventListener("click", () => {
    state.x = 0;
    state.y = 0;
    state.scale = 1;
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
    state.format = form?.dataset.mediaAspect || state.format || "16x9";
    form.dataset.activeVariantFormat = state.format;
    stage.style.setProperty("--media-crop-aspect", mediaAspectCss(state.format));
  }
  render();
  applyCrop();
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
      if (!window.confirm(`Bild "${title}" wirklich loeschen?`)) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Loesche ...";
      try {
        const asset = await getOne("media_assets", assetId);
        if (asset) await deleteStoredAsset(asset);
        const variants = (await list("media_variants")).filter((variant) => variant.media_asset_id === assetId);
        await Promise.all(variants.map((variant) => remove("media_variants", variant.id)));
        await remove("media_assets", assetId);
        const card = button.closest("[data-media-card]");
        if (card) card.remove();
      } catch (error) {
        window.alert(`Loeschen fehlgeschlagen: ${error.message || String(error)}`);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
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

function openEditorialPreviewLayer(form) {
  const values = formObject(form);
  const title = values.title || values.titel || "Redaktioneller Beitrag";
  const subtitle = values.subtitle || values.subline || "";
  const intro = values.introText || values.shortDescription || values.kurztext || "";
  const body = values.bodyText || values.longDescription || values.langtext || "";
  const category = values.category || values.page || "Redaktion";
  const date = values.publishDate || values.validFrom || "";
  const imageUrl = form.querySelector("[data-image-preview] img")?.getAttribute("src") || "";
  document.querySelector(".editorial-preview-backdrop")?.remove();
  const wrapper = document.createElement("div");
  wrapper.className = "editorial-preview-backdrop";
  wrapper.innerHTML = `<div class="editorial-preview-layer" role="dialog" aria-modal="true" aria-label="Redaktionelle Vorschau">
    <div class="editorial-preview-top">
      <div><p class="eyebrow">Vorschau</p><h2>${escapeHtml(title)}</h2></div>
      <button type="button" class="link-button" data-editorial-preview-close>Schliessen</button>
    </div>
    <article class="editorial-preview-article">
      ${imageUrl ? `<figure class="editorial-preview-hero"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}"><figcaption><p class="eyebrow">${escapeHtml(category)}${date ? ` · ${escapeHtml(date)}` : ""}</p><h1>${escapeHtml(title)}</h1></figcaption></figure>` : `<p class="eyebrow">${escapeHtml(category)}${date ? ` · ${escapeHtml(date)}` : ""}</p><h1>${escapeHtml(title)}</h1>`}
      ${subtitle ? `<p class="editorial-preview-subline">${escapeHtml(subtitle)}</p>` : ""}
      ${intro ? `<p class="editorial-preview-intro">${escapeHtml(intro)}</p>` : ""}
      <div class="editorial-preview-body">${editorialPreviewParagraphs(body)}</div>
    </article>
  </div>`;
  document.body.append(wrapper);
  const close = () => wrapper.remove();
  wrapper.querySelectorAll("[data-editorial-preview-close]").forEach((button) => button.addEventListener("click", close));
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper) close();
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
}

function wireActions() {
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "night" ? "day" : "night";
    localStorage.setItem("pdtv-theme", next);
    localStorage.setItem("pdtTheme", next);
    applyTheme(next);
  });
  applyTheme();
  wirePublicMenu();
  wireAboutJumps();
  wireInternalScrollTop();
  wireJoinScroll();
  wireStickyRotators();
  wireMediaLibraryFilters();
  wireExistingThumbImport();
  wireMediaCardLinks();
  wireCentralMediaUpload();
  wireMediaAiDraft();
  wireMediaEdit();
  wireMediaDelete();
  wireMediaTypeUpdates();
  wireMediaourceUpdates();
  wireMediaFullscreenViewer();
  wireEditorialPreviewLayer();
  wireCmsMenu();
  wireImageDropzones();
  wireGalleryEditor();
  wireGalleryPlayers();
  wireEditorGallerySelects();
  wireGalleryLinkSaves();
  wireLinkedMediaClears();
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
    const result = button.closest(".audio-list-cell, .audio-generation-panel")?.querySelector("[data-speech-result]");
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
      if (activeAudio) activeAudio.remove();
      if (activeButton) activeButton.classList.remove("is-playing");
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
    if (result) result.innerHTML = `<div class="alert">${progressMarkup(form ? "Aktuelle Texte werden zuerst gespeichert ..." : "Gemini erzeugt und speichert die Audiodatei ...", 30)}</div>`;
    let generationItem = null;
    try {
      if (form?.matches("#topic-editor-form, #content-edit-form, #ai-article-edit-form")) {
        await submitFormAndWait(form);
        if (result) result.innerHTML = `<div class="alert">${progressMarkup("Gemini erzeugt und speichert die Audiodatei ...", 72)}</div>`;
      }
      generationItem = await getOne(button.dataset.collection, button.dataset.recordId);
      if (generationItem) await upsert(button.dataset.collection, { id: generationItem.id, ...audioStatusUpdate(button.dataset.collection, generationItem, "in_erstellung") });
      const speech = await generateArticleSpeechAsset({ collection: button.dataset.collection, id: button.dataset.recordId, variant: button.dataset.ttsVariant || "all" });
      const generatedItem = await getOne(button.dataset.collection, button.dataset.recordId);
      if (generatedItem) await upsert(button.dataset.collection, { id: generatedItem.id, ...audioStatusUpdate(button.dataset.collection, generatedItem, "aktuell"), audioGeneratedAt: new Date().toISOString() });
      const truncated = speech.truncated || Object.values(speech.variants || {}).some((item) => item.truncated);
      if (result) result.innerHTML = `<div class="alert alert--success">Audio-Varianten gespeichert.${truncated ? " Der Text wurde fuer die Sprachausgabe gekuerzt." : ""}</div>`;
      await render();
    } catch (error) {
      if (generationItem) await upsert(button.dataset.collection, { id: generationItem.id, ...audioStatusUpdate(button.dataset.collection, generationItem, "fehler"), audioErrorMessage: error.message || String(error), audioErrorAt: new Date().toISOString() });
      if (result) result.innerHTML = `<div class="alert alert--error">Audio konnte nicht erzeugt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
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
      if (output) output.innerHTML = `<div class="alert alert--error">KI-Redaktion konnte nicht ausgefuehrt werden: ${escapeHtml(error.message || String(error))}</div>`;
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
    const sourcePool = await topicResearchSourcePool(category, keywords, sourceId);
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
    renderResearchStatus();
    progressTimer = window.setInterval(renderResearchStatus, 2500);
    try {
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
    if (output) output.innerHTML = `<div class="alert">${progressMarkup("Quellen werden analysiert und als News vorbereitet ...", 45)}</div>`;
    try {
      const values = formObject(form);
      const { textSources, imageFiles, imageSources, unsupportedTextFiles } = await collectAiNewsImportSources(form);
      if (!String(values.sourceText || "").trim() && !textSources.length && !imageFiles.length) {
        throw new Error("Bitte Text einfuegen oder mindestens eine Text- oder Bilddatei hochladen.");
      }
      const result = await importNewsFromSources({
        sourceText: values.sourceText || "",
        textSources,
        imageSources,
        rules: {
          visible: false,
          noStatusLogic: true,
          noAudioVideo: true
        }
      });
      const draft = result.article || result.news || result;
      if (!draft) throw new Error("Die KI hat keinen News-Beitrag zurueckgegeben.");
      const now = new Date().toISOString();
      const cleanHeadline = String(draft.headline || draft.title || "Importierte News").trim();
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
          description: "Aus dem News-Import uebernommene Bildquellen. Bildunterschriften und Alt-Texte redaktionell pruefen.",
          status: "published",
          visibility: "public",
          images: galleryImages.map((image, index) => ({
            ...image,
            caption: draft.gallery_suggestions?.[index]?.caption || image.caption || image.fileName || "",
            altText: draft.gallery_suggestions?.[index]?.alt_text || draft.gallery_suggestions?.[index]?.altText || image.altText || image.fileName || ""
          })),
          createdAt: now,
          updatedAt: now
        });
      }
      const tags = Array.isArray(draft.tags) ? draft.tags : String(draft.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      const sourceSnapshot = Array.isArray(draft.sources) ? draft.sources : [];
      await upsert("editorialContent", {
        id: articleId,
        title: cleanHeadline,
        headline: cleanHeadline,
        subtitle: draft.subline || draft.subtitle || "",
        subline: draft.subline || draft.subtitle || "",
        introText: draft.subline || draft.subtitle || "",
        shortText: draft.subline || draft.subtitle || "",
        teaserText: draft.subline || draft.subtitle || "",
        bodyText: draft.body || draft.bodyText || "",
        page: "news",
        section: "news",
        key: `news.${articleId}`,
        slug: slugify(cleanHeadline),
        category: draft.category || "News",
        tags,
        primary_keyword: tags[0] || "",
        keyword_json: tags.map((tag, index) => ({ keyword: tag, relevance_score: index === 0 ? 90 : 70 })),
        source_snapshot_json: sourceSnapshot,
        thumbnail_idea: draft.thumbnail_idea || draft.thumbnailIdea || "",
        thumbnail_prompt: draft.thumbnail_prompt || draft.thumbnailPrompt || "",
        thumbnail_alt: draft.thumbnail_alt || draft.thumbnailAlt || cleanHeadline,
        imageUrl,
        thumbnail_url: imageUrl,
        assetUrl: imageUrl,
        assetFileName: imageFiles[0]?.name || "",
        assetType: imageUrl ? "image" : "",
        assetStoragePath,
        galleryId,
        gallery_suggestions: draft.gallery_suggestions || draft.gallerySuggestions || [],
        editorial_note: [
          draft.editorial_note || draft.editorialNote || "",
          unsupportedTextFiles.length ? `PDF/DOCX-Text bitte pruefen oder separat einfuegen: ${unsupportedTextFiles.join(", ")}` : ""
        ].filter(Boolean).join("\n\n"),
        relevance_score: Number(draft.relevance_score || draft.relevanceScore || 0),
        relevance_reason: draft.relevance_reason || draft.relevanceReason || "",
        visible: false,
        status: "published",
        visibility: "public",
        author_type: "ai",
        author_name: "KI-Redaktion",
        generation_origin: "manual_news_import",
        ai_log_json: {
          import_flow: "manual_news_import",
          no_status_logic: true,
          visible: false,
          textSourceCount: textSources.length,
          imageSourceCount: imageFiles.length,
          localOnly: Boolean(result.localOnly)
        },
        publishDate: now.slice(0, 10),
        validFrom: now.slice(0, 10),
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
        relevance_note: "Aus dem manuellen News-Import uebernommen. Redaktionell pruefen.",
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
        explanation: "Aus dem manuellen News-Import abgeleitet.",
        ai_generated: true,
        manually_confirmed: false,
        created_at: now,
        updated_at: now
      })));
      if (output) output.innerHTML = `<div class="alert alert--success">News wurde importiert und bleibt unsichtbar. Der Editor wird geoeffnet.</div>`;
      window.location.hash = `#/cms/edit?module=editorialContent&id=${encodeURIComponent(articleId)}&section=news`;
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">News-Import fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

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
          source_status: "Recherche erforderlich",
          duplicate_status: suggestion.duplicate_status || "neu",
          ai_check_status: "Warnung",
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
            source_note: "Quellen muessen im Editor mit echten URLs erfasst werden. Keine automatische Freigabe ohne mindestens zwei gepruefte Quellen.",
            note: "Aus redaktionell ausgewaehltem Themenvorschlag angelegt. Text, Quellen, Thumbnail, Audio, Keywords und Rubrik im Editor ausarbeiten."
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
      if (output) output.innerHTML = `<div class="alert alert--success">${createdArticleIds.length} Beitrag/Beitraege wurden als Entwurf angelegt. Die Beitragsliste wird geoeffnet.</div>`;
      window.setTimeout(() => { window.location.hash = "#/cms/ai-editorial/articles"; }, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Queue konnte nicht aktualisiert werden: ${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelectorAll("[data-ai-import-local-drafts]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#ai-editorial-run-result") || button.closest("section")?.querySelector(".alert");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Importiere ...";
    try {
      const raw = localStorage.getItem("prodigitaltv-demo-db-official-assets-v3");
      const db = raw ? JSON.parse(raw) : {};
      const localArticles = (db.editorialContent || []).filter((item) => item.author_type === "ai"
        || item.authorType === "ai"
        || item.aiGenerated === true
        || item.source_snapshot_json
        || item.ai_log_json
        || item.publication_status);
      if (!localArticles.length) {
        if (output) output.innerHTML = `<div class="alert alert--warning">Keine lokalen KI-Entwuerfe im Browser-Speicher gefunden.</div>`;
        return;
      }
      const articleIds = new Set(localArticles.map((item) => item.id));
      await Promise.all(localArticles.map((article) => upsert("editorialContent", {
        ...article,
        migration_origin: article.migration_origin || "local_browser_storage",
        visibility: article.visibility || "internal",
        updatedAt: new Date().toISOString()
      })));
      const relatedCollections = ["article_sources", "article_keywords", "ai_editorial_logs"];
      for (const collection of relatedCollections) {
        const records = (db[collection] || []).filter((record) => articleIds.has(record.article_id || record.articleId));
        await Promise.all(records.map((record) => upsert(collection, record)));
      }
      if (output) output.innerHTML = `<div class="alert alert--success">${localArticles.length} lokale KI-Entwuerfe wurden importiert.</div>`;
      window.setTimeout(render, 700);
    } catch (error) {
      if (output) output.innerHTML = `<div class="alert alert--error">Import fehlgeschlagen: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

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
      minimumSources: Number(values.minimumSources || 2),
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
      form.querySelector("[data-prompt-meta-system]").textContent = `${prompt.model || "gpt-4.1-mini"} · Temp. ${prompt.temperature ?? 0.2} · ${prompt.max_tokens ?? 1200} Tokens`;
      if (form.elements.is_active) form.elements.is_active.checked = Boolean(prompt.is_active);
      form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      if (output) output.innerHTML = `<div class="alert">Prompt geladen. Aendern und mit „Prompt speichern“ als neue Version sichern.</div>`;
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
      "Wenn Quellen, Belege oder Dublettenstatus unklar sind, soll sie Warnungen ausgeben und keine Freigabe empfehlen."
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
    form.querySelector("[data-prompt-meta-system]").textContent = `${values.model || "gpt-4.1-mini"} · Temp. ${values.temperature ?? 0.2} · ${values.max_tokens ?? 1200} Tokens`;
    form.querySelector(".ai-advanced-prompt-fields")?.setAttribute("open", "");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    if (output) output.innerHTML = `<div class="alert">System-Prompt „${escapeHtml(name)}“ vorbereitet. Bitte testen und speichern.</div>`;
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
    button.textContent = "Pruefe ...";
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
        window.location.hash = `#/news/${articleId}`;
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
            <section class="ai-release-card"><h3>Quellen</h3>${sources.length ? sources.map((source) => `<p><strong>${escapeHtml(source.publisher || source.title || "Quelle")}</strong><br><small>${escapeHtml(source.domain || source.url || "")} · Trust ${Number(source.trust_score || 0)} · ${escapeHtml(source.check_status || "ungeprueft")}</small></p>`).join("") : `<p class="muted">Keine Quellen gespeichert.</p>`}</section>
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
        update.source_status = hasEnoughSources ? "geprueft" : "unzureichend";
        message = hasEnoughSources ? "Quellenpruefung bestanden." : "Quellenlage unzureichend - mindestens zwei gepruefte Quellen mit Trust-Score ab 70 erforderlich.";
        status = hasEnoughSources ? "success" : "blocked";
      }

      if (action === "mapClaims") {
        if (!sources.length) {
          update.source_status = "unzureichend";
          message = "Keine Quellen vorhanden, Belege koennen nicht zugeordnet werden.";
          status = "blocked";
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
          update.source_status = hasEnoughSources ? "geprueft" : "teilweise geprueft";
          update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
          message = "Belegstellen wurden den Quellen zugeordnet. Bitte danach KI-Pruefung starten.";
          status = hasEnoughSources ? "success" : "warning";
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
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "Thumbnail wurde lokal erzeugt und am Artikel gespeichert.";
        status = "success";
      }

      if (action === "seo") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const generatedKeywords = keywords.length ? keywords : localEditorialKeywords({ ...article, ...formValues }, article.tags || []);
        Object.assign(update, localSeoPayload({ ...article, ...formValues }, generatedKeywords));
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "SEO-Titel, Meta-Beschreibung, Slug und SEO-Keywords wurden automatisch erzeugt.";
        status = "success";
      }

      if (action === "draftText") {
        update.bodyText = safeLocalArticleDraft(article, sources, keywords);
        update.ai_check_status = "Warnung";
        update.publication_status = "pruefpflichtig";
        update.final_check_json = {
          status: "Warnung",
          blockers: ["claim_level_source_mapping_required", "manual_review_required"],
          note: "Lokaler Arbeitsentwurf erzeugt. Keine Veroeffentlichung ohne Aussage-zu-Quelle-Pruefung."
        };
        message = "Redaktioneller Arbeitsentwurf wurde vorbereitet. Veroeffentlichung bleibt bis zur Belegstellenpruefung blockiert.";
        status = "warning";
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
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "Headline wurde vorbereitet.";
        status = "success";
      }

      if (action === "optimizeText") {
        const optimized = optimizeLocalEditorialText(article.bodyText || article.body || "");
        if (!optimized) {
          message = "Textoptimierung nicht moeglich: Beitragstext fehlt.";
          status = "blocked";
        } else {
          update.bodyText = optimized;
          update.ai_check_status = "Warnung";
          update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
          message = "Text wurde redaktionell geglaettet. Bitte Pruefung erneut starten.";
          status = "success";
        }
      }

      if (action === "summary") {
        const summary = summarizeLocalEditorialText(article);
        update.subline = summary;
        update.subtitle = summary;
        update.seoDescription = localSeoDescription({ ...article, subline: summary });
        update.seo_description = update.seoDescription;
        update.ai_check_status = "Warnung";
        update.publication_status = article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig";
        message = "Zusammenfassung wurde als Subline und Meta-Beschreibung vorbereitet.";
        status = "success";
      }

      if (action === "confirmClaims") {
        if (!hasEnoughSources) {
          update.source_status = "unzureichend";
          update.publication_status = "gesperrt wegen Quellenlage";
          update.ai_check_status = "nicht bestanden";
          message = "Belegpruefung blockiert: Es fehlen mindestens zwei gepruefte Quellen.";
          status = "blocked";
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
          message = "Belegpruefung wurde manuell bestaetigt. Starte danach KI-Pruefung und Freigabe.";
          status = "success";
        }
      }

      if (action === "check") {
        const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(String(article.bodyText || ""));
        const blockers = [
          hasEnoughSources ? "" : "Quellenlage unzureichend",
          duplicateBlocked ? "Dublette erkannt" : "",
          article.bodyText ? "" : "Beitragstext fehlt",
          unresolvedDraft ? "Aussage-zu-Quelle-Pruefung fehlt" : "",
          article.headline || article.title ? "" : "Headline fehlt",
          article.subline || article.subtitle ? "" : "Subline fehlt",
          article.primary_keyword || keywords.length ? "" : "Keywords fehlen"
        ].filter(Boolean);
        update.source_status = hasEnoughSources ? "geprueft" : "unzureichend";
        update.ai_check_status = blockers.length ? "Warnung" : "bestanden";
        update.publication_status = blockers.length ? "pruefpflichtig" : "freigegeben";
        message = blockers.length ? `KI-Pruefung mit Warnungen: ${blockers.join(", ")}.` : "KI-Pruefung bestanden. Beitrag kann freigegeben werden.";
        status = blockers.length ? "warning" : "success";
      }

      if (action === "approve") {
        const unresolvedDraft = /sicherer Themenvorschlag|lokale KI-Redaktion|Noch keine finale zentrale Aussage|Arbeitsentwurf|Belegstellen fehlen/i.test(String(article.bodyText || ""));
        if (!hasEnoughSources || duplicateBlocked || unresolvedDraft) {
          update.publication_status = !hasEnoughSources ? "gesperrt wegen Quellenlage" : duplicateBlocked ? "gesperrt wegen Dublette" : "pruefpflichtig";
          update.ai_check_status = "nicht bestanden";
          message = !hasEnoughSources ? "Freigabe blockiert: Quellenlage unzureichend." : duplicateBlocked ? "Freigabe blockiert: Dublette erkannt." : "Freigabe blockiert: Aussage-zu-Quelle-Pruefung fehlt.";
          status = "blocked";
        } else {
          update.source_status = "geprueft";
          update.ai_check_status = "bestanden";
          update.publication_status = "freigegeben";
          message = "Beitrag wurde freigegeben.";
          status = "success";
        }
      }

      if (action === "publish") {
        const editForm = document.querySelector("#ai-article-edit-form");
        const formValues = editForm?.dataset.articleId === articleId ? formObject(editForm) : {};
        const publicationTarget = formValues.publication_target || article.publication_target || article.publicationTarget || "news";
        const candidate = { ...article, ...update };
        if (!articleCanPublish(candidate)) {
          update.publication_status = "pruefpflichtig";
          message = "Veroeffentlichung blockiert: Es fehlen noch bestandene Pruefungen oder Pflichtfelder.";
          status = "blocked";
        } else if (publicationTarget === "topic" || publicationTarget === "monthly_topic") {
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
        update.publication_status = "gesperrt wegen redaktioneller Pruefung";
        update.ai_check_status = "nicht bestanden";
        message = "Beitrag wurde gesperrt.";
        status = "blocked";
      }

      await upsert("editorialContent", { ...article, ...update });
      await writeAiArticleLog(articleId, status, message, {
        usedSources: sources,
        sourceCheck: { source_status: update.source_status || article.source_status || "", checkedSources: sources.length },
        duplicateCheck: { duplicate_status: article.duplicate_status || "" },
        keywordResult: keywords,
        aiCheck: { status: update.ai_check_status || article.ai_check_status || "" }
      });
      if (output) output.innerHTML = `<div class="alert ${status === "success" ? "alert--success" : status === "blocked" ? "alert--error" : "alert--warning"}">${escapeHtml(message)}</div>`;
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
        publication_status: article.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig",
        ai_check_status: article.publication_status === "veroeffentlicht" ? article.ai_check_status : "Warnung",
        updatedAt: new Date().toISOString()
      };
      await upsert("editorialContent", updated);
      await writeAiArticleLog(articleId, "warning", "Artikel wurde manuell bearbeitet und wieder auf pruefpflichtig gesetzt.", {
        aiCheck: { status: updated.ai_check_status },
        sourceCheck: { source_status: updated.source_status || "" }
      });
      if (output) output.innerHTML = `<div class="alert alert--success">Aenderungen gespeichert. Bitte Pruefung erneut starten.</div>`;
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
      const sourceStatus = checkedSources.length >= 2 ? "geprueft" : articleSources.length ? "teilweise geprueft" : "Recherche erforderlich";

      await upsert("editorialContent", {
        ...(article || { id: articleId }),
        source_status: sourceStatus,
        publication_status: article?.publication_status === "veroeffentlicht" ? article.publication_status : "pruefpflichtig",
        ai_check_status: article?.ai_check_status === "bestanden" && checkedSources.length >= 2 ? article.ai_check_status : "Warnung",
        updatedAt: now
      });
      await writeAiArticleLog(articleId, "warning", "Quelle wurde manuell erfasst. Quellenstatus aktualisiert.", {
        usedSources: articleSources,
        sourceCheck: { source_status: sourceStatus, checkedSources: checkedSources.length }
      });
      if (output) {
        output.innerHTML = `<div class="alert alert--success">Quelle gespeichert. ${checkedSources.length >= 2 ? "Quellenstatus ist geprueft." : "Fuer die Freigabe sind mindestens zwei gepruefte Quellen mit Trust-Score ab 70 noetig."}</div>`;
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
      go(["admin", "editor"].includes(user.role) ? "cms" : "portal");
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
      go(["admin", "editor"].includes(user.role) ? "cms" : "portal");
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

  document.querySelectorAll("[data-event-tab]").forEach((button) => button.addEventListener("click", () => {
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

  document.querySelectorAll("[data-create-event-retrospective]").forEach((button) => button.addEventListener("click", async () => {
    const eventId = button.dataset.createEventRetrospective;
    const result = document.querySelector("#event-retrospective-result");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Erstelle ...";
    if (result) result.innerHTML = `<div class="alert">Redaktioneller Rückblick wird vorbereitet ...</div>`;
    try {
      const sourceEvent = await getOne("events", eventId);
      if (!sourceEvent) throw new Error("Event wurde nicht gefunden.");
      const articleId = document.querySelector("[data-retrospective-article-id]")?.value || eventRetrospectiveArticleId(eventId);
      const existingArticle = await getOne("editorialContent", articleId).catch(() => null);
      const title = existingArticle?.title || `Rückblick: ${sourceEvent.title || "PROdigitalTV Event"}`;
      const bodyText = existingArticle?.longDescription || existingArticle?.articleText || existingArticle?.bodyText || eventRetrospectiveBody(sourceEvent);
      const now = new Date().toISOString();
      const article = {
        ...(existingArticle || { id: articleId, createdAt: now }),
        id: articleId,
        page: "press",
        section: "pressRelease",
        key: existingArticle?.key || `press.${articleId}`,
        category: "Rückblicke",
        title,
        headline: title,
        subtitle: existingArticle?.subtitle || sourceEvent.subtitle || "",
        introText: existingArticle?.introText || eventRetrospectiveIntro(sourceEvent),
        bodyText,
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
        imageUrl: existingArticle?.imageUrl || sourceEvent.imageUrl || "",
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
      if (result) result.innerHTML = `<div class="alert alert--success">Rückblick-Beitrag wurde gespeichert. <a class="link" href="#/cms/edit?module=editorialContent&id=${encodeURIComponent(articleId)}&section=press">Beitrag öffnen</a></div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div class="alert alert--error">Rückblick konnte nicht erstellt werden: ${escapeHtml(error.message || String(error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("#event-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = (await getOne("events", form.dataset.eventId)) || { id: form.dataset.eventId, topicIds: [], speakerIds: [], sponsorIds: [], status: "draft" };
    const values = formObject(form);
    const image = form.querySelector('input[name="eventImage"]')?.files?.[0];
    const newEventType = values.newEventType?.trim();
    if (image) {
      const asset = await uploadEntityImage("events", form.dataset.eventId, image);
      values.imageUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
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
    delete values.newEventType;
    if (Object.prototype.hasOwnProperty.call(values, "longDescription")) {
      values.bodyText = values.longDescription;
      values.articleText = values.longDescription;
      values.archiveText = values.longDescription;
    }
    await upsert("events", { ...existing, ...values });
    form.querySelector("#event-save-result").innerHTML = `<div class="alert alert--success">Event wurde gespeichert.</div>`;
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
    if (imageStatus) imageStatus.textContent = imageUpdate.imageUrl ? "Bild wurde gespeichert." : imageUpdate.imageUrl === "" ? "Bild wurde gelöscht." : imageStatus.textContent;
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
    const sponsorIds = Array.from(form.querySelectorAll('input[name="sponsorIds"]:checked')).map((input) => input.value);
    let hostId = form.elements.hostId?.value || "";
    const sponsors = await list("sponsors");
    for (const sponsor of sponsors) {
      if (!form.elements[`edit-sponsor-${sponsor.id}-name`]) continue;
      await upsert("sponsors", {
        ...sponsor,
        name: form.elements[`edit-sponsor-${sponsor.id}-name`].value,
        role: form.elements[`edit-sponsor-${sponsor.id}-role`].value,
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
        role: form.elements.newSponsorRole.value,
        website: form.elements.newSponsorWebsite.value,
        description: form.elements.newSponsorDescription.value,
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
      sponsorIds.push(id);
      if (form.elements.newSponsorIsHost.checked) hostId = id;
    }
    await upsert("events", { ...existing, sponsorIds, hostId, updatedAt: new Date().toISOString() });
    form.querySelector("#event-partners-result").innerHTML = `<div class="alert alert--success">Sponsoren und Gastgeber wurden gespeichert.</div>`;
    await render();
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
      delete values.removeAssetFile;
      delete values.source_snapshot_json_text;
      if (form.dataset.module === "members") values = normalizeMemberContactValues(values);
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
    const result = form?.querySelector("#content-save-result") || button.closest("td") || button.closest(".editorial-meta-panel");
    const originalLabel = button.textContent;
    const originalTitle = button.getAttribute("title") || "";
    button.disabled = true;
    if (originalLabel.trim()) button.textContent = nextVisible ? "chalte frei ..." : "Blende aus ...";
    else button.setAttribute("title", nextVisible ? "chalte frei ..." : "Blende aus ...");
    try {
      const existing = await getOne("editorialContent", articleId);
      if (!existing) throw new Error("News-Beitrag nicht gefunden.");
      await upsert("editorialContent", {
        ...existing,
        visible: nextVisible,
        updatedAt: new Date().toISOString()
      });
      if (result) result.insertAdjacentHTML("beforeend", `<div class="alert alert--success">${nextVisible ? "News ist freigeschaltet." : "News ist unsichtbar geschaltet."}</div>`);
      window.setTimeout(render, 500);
    } catch (error) {
      if (result) result.insertAdjacentHTML("beforeend", `<div class="alert alert--error">Sichtbarkeit konnte nicht geaendert werden: ${escapeHtml(error.message || String(error))}</div>`);
    } finally {
      button.disabled = false;
      if (originalLabel.trim()) button.textContent = originalLabel;
      else button.setAttribute("title", originalTitle);
    }
  }));

  document.querySelector("#member-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#member-profile-result");
    const submitButton = form.querySelector('button[type="submit"]');
    const user = currentUser();
    const memberId = form.dataset.memberId || user?.memberId || "";
    if (submitButton) submitButton.disabled = true;
    if (result) result.innerHTML = `<div class="alert">Profil wird gespeichert...</div>`;
    try {
      if (!user?.memberId) throw new Error("Ihr Login ist keinem Mitgliedsprofil zugeordnet.");
      if (user.memberId !== memberId) throw new Error("Sie koennen nur Ihr eigenes Mitgliedsprofil bearbeiten.");
      const existing = await getOne("members", memberId);
      if (!existing) throw new Error("Das verknuepfte Mitgliedsprofil wurde nicht gefunden.");
      const values = normalizeMemberContactValues(formObject(form));
      const allowedFields = ["name", "description", "website", "category", "city", "country", "contactEmail", "email", "phone", "contactPhone", "profileContactName", "contactName"];
      const update = {
        id: memberId,
        profileUpdatedAt: new Date().toISOString(),
        profileUpdatedBy: user.uid || user.email || ""
      };
      allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(values, field)) update[field] = values[field] || "";
      });
      await upsert("members", update);
      if (result) result.innerHTML = `<div class="alert alert--success">Ihr Mitgliedsprofil wurde gespeichert.</div>`;
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

  document.querySelector("[data-delete-event]")?.addEventListener("click", async (event) => {
    if (!window.confirm("Dieses Event wirklich loeschen? Zugeordnete Daten muessen separat geprueft werden.")) return;
    await remove("events", event.currentTarget.dataset.deleteEvent);
    go("cms/events");
  });

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
    await uploadEventMedia(form.dataset.eventId, files, {}, (progress) => {
      result.querySelector("span").style.width = `${progress}%`;
    });
    result.innerHTML += `<div class="alert alert--success" style="margin-top:12px">Upload abgeschlossen. Medien warten auf Freigabe.</div>`;
  });

  document.querySelectorAll("[data-media-approve]").forEach((button) => button.addEventListener("click", async () => {
    const medium = await getOne("eventMedia", button.dataset.mediaApprove);
    await upsert("eventMedia", { ...medium, status: "approved", visibility: "public" });
    await render();
  }));

  document.querySelectorAll("[data-record-status]").forEach((button) => button.addEventListener("click", async () => {
    const record = await getOne(button.dataset.recordStatus, button.dataset.recordId);
    if (isProtectedInternalEditorialRecord(button.dataset.recordStatus, record)) {
      window.alert("CMS-Interna duerfen nicht unsichtbar geschaltet werden.");
      return;
    }
    const updates = { ...record, status: button.dataset.status };
    if (button.dataset.recordStatus === "eventMedia") {
      updates.visibility = button.dataset.status === "approved" ? "public" : "internal";
    }
    if (button.dataset.recordStatus === "members") {
      updates.isLive = button.dataset.status === "active";
      if (updates.isLive) updates.visibility = "public";
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

  document.querySelectorAll("[data-event-status]").forEach((button) => button.addEventListener("click", async () => {
    const existing = await getOne("events", button.dataset.eventStatus);
    await upsert("events", { ...existing, status: button.dataset.status });
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
    await render();
  }));

  document.querySelectorAll("[data-export-event]").forEach((button) => button.addEventListener("click", async () => {
    const event = await getOne("events", button.dataset.exportEvent);
    const registrations = (await list("registrations")).filter((item) => item.eventId === event.id);
    await downloadRegistrationsCsv(event, registrations);
  }));

  document.querySelectorAll("[data-setup-action]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#setup-result");
    const actions = { connection: checkFirebaseConnection, structure: checkFirestoreStructure, initialize: initializeDatabase, demo: createDemoData, "remove-demo": removeDemoData };
    try {
      if (button.dataset.setupAction === "remove-demo" && !window.confirm("Demodaten wirklich entfernen beziehungsweise die lokale Vorschau zuruecksetzen?")) return;
      const result = await actions[button.dataset.setupAction]();
      const message = Array.isArray(result) ? `${result.filter((item) => item.available).length} von ${result.length} Collections enthalten Daten.` : result.message || "Aktion erfolgreich abgeschlossen.";
      output.innerHTML = `<div class="alert alert--success">${escapeHtml(message)}</div>`;
      if (["initialize", "demo"].includes(button.dataset.setupAction)) setTimeout(render, 500);
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  }));
}

if ("serviceWorker" in navigator && ["localhost", "127.0.0.1"].includes(location.hostname)) {
  navigator.serviceWorker.getRegistrations?.().then((registrations) => registrations.forEach((registration) => registration.unregister())).catch(() => {});
} else if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
onRouteChange(render);
render();
waitForAuthReady().finally(render);
