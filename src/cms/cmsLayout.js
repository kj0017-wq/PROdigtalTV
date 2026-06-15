import { currentUser, isAdmin } from "../firebase/authService.js?v=466";
import { logo } from "../components/layout.js";

const sections = [
  ["cms", "Dashboard"], ["cms/events", "Events"], ["cms/registrations", "Anmeldungen"], ["cms/followup", "Event Rückblick"],
  ["cms/sponsors", "Sponsoren / Gastgeber"], ["cms/members", "Mitglieder"], ["cms/membership-applications", "Mitgliedsantraege"], ["cms/board", "Vorstand"],
  ["cms/users", "User"],
  ["cms/member-documents", "Mitglieder-Dokumente"], ["cms/member-directories", "Mitgliederverzeichnisse"],
  {
    route: "cms/editorial/press",
    title: "Redaktionelle Artikel",
    children: [
      ["cms/editorial/press", "Presse"],
      ["cms/topics", "Themen"],
      ["cms/editorial/news", "News"],
      ["cms/editorial/interna", "Interna"]
    ]
  },
  ["cms/audio", "Audio & Barrierefreiheit"],
  {
    route: "cms/media/library",
    title: "Medien & Thumbnails",
    children: [
      ["cms/media/library", "Mediathek"],
      ["cms/media/edit", "Bild bearbeiten"],
      ["cms/media/ai", "KI-Grafik erstellen"],
      ["cms/media/variants", "Varianten"]
    ]
  },
  {
    route: "cms/ai-editorial/dashboard",
    title: "KI-Redaktion",
    children: [
      ["cms/ai-editorial/dashboard", "Themenliste"],
      ["cms/ai-editorial/news-import", "News importieren"],
      ["cms/ai-editorial/articles", "Beitraege"],
      ["cms/ai-editorial/sources", "Quellen"],
      ["cms/ai-editorial/prompts", "Prompts"],
      ["cms/ai-editorial/automation", "Automatisierung"],
      ["cms/ai-editorial/logs", "Logs"]
    ]
  },
  ["cms/galleries", "Bildergalerien"],
  ["cms/mail", "Mail-Queue"], ["cms/mail-admin", "Mail-Verwaltung"], ["cms/chatgpt", "ChatGPT"], ["cms/ai-access", "KI-Zugaenge"], ["cms/ai-settings", "ChatGPT-Einstellungen"], ["cms/setup", "System / Einrichtung"]
];

export function cmsShell(active, content) {
  const user = currentUser();
  const navItem = (item) => {
    if (Array.isArray(item)) {
      const [route, title] = item;
      if (route === "cms/setup" && !isAdmin(user)) return "";
      return `<a href="#/${route}" class="${active === route ? "active" : ""}">${title}</a>`;
    }
    const childActive = item.children.some(([route]) => active === route);
    return `<div class="cms-side-group ${active === item.route || childActive ? "is-open" : ""}">
      <a href="#/${item.route}" class="${active === item.route ? "active" : ""}">${item.title}</a>
      <div class="cms-side-sub">${item.children.map(([route, title]) => `<a href="#/${route}" class="${active === route ? "active" : ""}">${title}</a>`).join("")}</div>
    </div>`;
  };
  return `<div class="cms-shell"><header class="cms-header"><button type="button" class="cms-menu-toggle" data-cms-menu-toggle aria-label="CMS-Menue oeffnen" aria-controls="cms-side-nav" aria-expanded="false"><span></span><span></span><span></span></button>${logo()}<div class="actions"><span class="tag">${user?.role || "Gast"}</span><a href="#/home" class="button button--secondary button--small">Website</a><a class="mobile-qr mobile-qr--cms" href="#/home" data-mobile-qr-link target="_blank" rel="noreferrer" aria-label="Passende Mobilseite oeffnen"><img data-mobile-qr-code alt="QR-Code fuer die passende Mobilseite"></a></div></header>
  <div class="cms-menu-backdrop" data-cms-menu-close></div>
  <div class="cms-layout"><nav class="cms-side" id="cms-side-nav" aria-label="CMS Navigation">${sections.map(navItem).join("")}</nav>
  <main class="cms-main">${content}</main></div></div>`;
}

export function cmsTitle(eyebrow, title, actions = "") {
  return `<div class="cms-title"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="actions">${actions}</div></div>`;
}
