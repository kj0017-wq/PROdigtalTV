import { currentUser, isAdmin } from "../firebase/authService.js?v=470";
import { logo } from "../components/layout.js";

const sections = [
  ["cms", "Dashboard"],
  {
    route: "cms/events",
    title: "Events",
    children: [
      ["cms/events", "Events"],
      ["cms/registrations", "Anmeldungen"],
      ["cms/followup", "Event Rückblick"],
      ["cms/sponsors", "Sponsoren / Gastgeber"]
    ]
  },
  {
    route: "cms/members",
    title: "Mitglieder",
    children: [
      ["cms/members", "Mitglieder"],
      ["cms/member-area", "Mitgliederbereich"],
      ["cms/editorial/member-area", "Mitgliederbeitraege"],
      ["cms/membership-applications", "Mitgliedsantraege"],
      ["cms/board", "Vorstand"]
    ]
  },
  {
    route: "cms/editorial/press",
    title: "Redaktion",
    children: [
      ["cms/editorial/press", "Presse"],
      ["cms/topics", "Themen"],
      ["cms/editorial/news", "News"],
      ["cms/editorial/interna", "Interna"]
    ]
  },
  {
    route: "cms/media/library",
    title: "Medien",
    children: [
      ["cms/media/library", "Bilder"],
      ["cms/media/ai", "KI-Bilder"],
      ["cms/media/videos", "Videos"],
      ["cms/member-documents", "Dokumente"],
      ["cms/galleries", "Bildergalerien"],
      ["cms/audio", "Audio & Barrierefreiheit"]
    ]
  },
  ["cms/media/library?trash=1", "Papierkorb"],
  {
    route: "cms/ai-editorial/dashboard",
    title: "KI-Redaktion",
    children: [
      ["cms/ai-editorial/dashboard", "Themenliste"],
      ["cms/ai-editorial/news-import", "News importieren"],
      ["cms/ai-editorial/morning-briefing", "Morgenbriefing"],
      ["cms/ai-editorial/articles", "Beitraege"],
      ["cms/ai-editorial/sources", "Quellen"],
      ["cms/ai-editorial/prompts", "Prompts"],
      ["cms/ai-editorial/automation", "Automatisierung"],
      ["cms/ai-editorial/logs", "Logs"]
    ]
  },
  {
    route: "cms/mail",
    title: "Kommunikation",
    children: [
      ["cms/mail", "Mail-Queue"],
      ["cms/mail-admin", "Mail-Verwaltung"]
    ]
  },
  {
    route: "cms/ai-access",
    title: "System",
    children: [
      ["cms/users", "User"],
      ["cms/quality", "Qualitätsprüfung"],
      ["cms/ai-access", "KI-Zugaenge"],
      ["cms/chatgpt", "ChatGPT"],
      ["cms/ai-settings", "ChatGPT-Einstellungen"],
      ["cms/setup", "System / Einrichtung"]
    ]
  }
];

export function cmsShell(active, content) {
  const user = currentUser();
  const navItem = (item) => {
    if (Array.isArray(item)) {
      const [route, title] = item;
      if (route === "cms/setup" && !isAdmin(user)) return "";
      return `<a href="#/${route}" class="${active === route ? "active" : ""}">${title}</a>`;
    }
    const visibleChildren = item.children.filter(([route]) => route !== "cms/setup" || isAdmin(user));
    const childActive = visibleChildren.some(([route]) => active === route);
    return `<details class="cms-side-group" ${active === item.route || childActive ? "open" : ""}>
      <summary class="${active === item.route || childActive ? "active" : ""}"><span>${item.title}</span></summary>
      <div class="cms-side-sub">${visibleChildren.map(([route, title]) => `<a href="#/${route}" class="${active === route ? "active" : ""}">${title}</a>`).join("")}</div>
    </details>`;
  };
  return `<div class="cms-shell"><header class="cms-header"><button type="button" class="cms-menu-toggle" data-cms-menu-toggle aria-label="CMS-Menue oeffnen" aria-controls="cms-side-nav" aria-expanded="false"><span></span><span></span><span></span></button>${logo()}<div class="actions"><span class="tag">${user?.role || "Gast"}</span><a href="#/home" class="button button--secondary button--small">Website</a><a class="mobile-qr mobile-qr--cms" href="#/home" data-mobile-qr-link target="_blank" rel="noreferrer" aria-label="Passende Mobilseite oeffnen"><img data-mobile-qr-code alt="QR-Code für die passende Mobilseite"></a></div></header>
  <div class="cms-menu-backdrop" data-cms-menu-close></div>
  <div class="cms-layout"><nav class="cms-side" id="cms-side-nav" aria-label="CMS Navigation">${sections.map(navItem).join("")}</nav>
  <main class="cms-main">${content}</main></div></div>`;
}

export function cmsTitle(eyebrow, title, actions = "") {
  return `<div class="cms-title"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="actions">${actions}</div></div>`;
}
