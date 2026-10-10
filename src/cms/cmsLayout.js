import { currentUser, isAdmin } from "../firebase/authService.js?v=477";
import { logo } from "../components/layout.js";

const adminOnlyRoutes = new Set(["cms/member-strategy-responses", "cms/setup", "cms/mail-bounces", "cms/accounting"]);

const sections = [
  ["cms", "Dashboard"],
  ["cms/accounting", "Buchhaltung"],
  {
    route: "cms/events",
    title: "Event Verwaltung",
    children: [
      ["cms/events", "Events"],
      ["cms/live", "Veranstaltungs-Cockpit"],
      ["cms/registrations", "Anmeldungen"],
      ["cms/speakers", "Referenten"],
      ["cms/event-feedback", "Gästebefragung"],
      ["cms/sponsors", "Sponsoren / Gastgeber"]
    ]
  },
  {
    route: "cms/members",
    title: "Mitglieder",
    children: [
      ["cms/members", "Mitglieder"],
      ["cms/member-area", "Mitgliederbereich"],
      ["cms/member-strategy-responses", "Strategie-Auswertung"],
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
      ["cms/editorial/retrospectives", "Rückblicke"],
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
      ["cms/event-notifications", "Event Versand"],
      ["cms/people", "Mailingadressen"],
      ["cms/mail", "Mailing Queue"],
      ["cms/mail-bounces", "Rückläufer"],
      ["cms/mail-admin", "Mailingverwaltung"]
    ]
  },
  {
    route: "cms/ai-access",
    title: "System",
    children: [
      ["cms/help", "Funktionsbeschreibung"],
      ["cms/quality", "Qualitätsprüfung"],
      ["cms/privacy-consents", "Datenschutz-Consents"],
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
    const childLink = ([route, title]) => {
      if (String(route).startsWith("/")) {
        return `<a href="${route}" target="_blank" rel="noopener">${title}</a>`;
      }
      return `<a href="#/${route}" class="${active === route ? "active" : ""}">${title}</a>`;
    };
    if (Array.isArray(item)) {
      const [route, title] = item;
      if (adminOnlyRoutes.has(route) && !isAdmin(user)) return "";
      if (String(route).startsWith("/")) {
        return `<a href="${route}" target="_blank" rel="noopener">${title}</a>`;
      }
      return `<a href="#/${route}" class="${active === route ? "active" : ""}">${title}</a>`;
    }
    const visibleChildren = item.children.filter(([route]) => !adminOnlyRoutes.has(route) || isAdmin(user));
    const childActive = visibleChildren.some(([route]) => active === route);
    return `<details class="cms-side-group" ${active === item.route || childActive ? "open" : ""}>
      <summary class="${active === item.route || childActive ? "active" : ""}"><span>${item.title}</span></summary>
      <div class="cms-side-sub">${visibleChildren.map(childLink).join("")}</div>
    </details>`;
  };
  return `<div class="cms-shell"><header class="cms-header"><button type="button" class="cms-menu-toggle" data-cms-menu-toggle aria-label="CMS-Menue oeffnen" aria-controls="cms-side-nav" aria-expanded="false"><span></span><span></span><span></span></button>${logo()}<div class="actions"><details class="cms-account-menu" style="position:relative"><summary class="tag" style="cursor:pointer;user-select:none" aria-label="Benutzermenü">${user?.role || "Gast"} ▾</summary><div style="position:absolute;right:0;top:calc(100% + 8px);z-index:1000;min-width:150px;padding:8px;background:var(--pdt-white);border:1px solid var(--pdt-line);border-radius:8px;box-shadow:0 8px 24px #0002"><button type="button" class="button button--secondary button--small" data-logout-button style="width:100%">Abmelden</button></div></details><a href="#/home" class="button button--secondary button--small">Website</a><a class="mobile-qr mobile-qr--cms" href="#/home" data-mobile-qr-link target="_blank" rel="noreferrer" aria-label="Passende Mobilseite oeffnen"><img data-mobile-qr-code alt="QR-Code für die passende Mobilseite"></a></div></header>
  <div class="cms-menu-backdrop" data-cms-menu-close></div>
  <div class="cms-layout"><nav class="cms-side" id="cms-side-nav" aria-label="CMS Navigation">${sections.map(navItem).join("")}</nav>
  <main class="cms-main">${content}</main></div></div>`;
}

export function cmsTitle(eyebrow, title, actions = "") {
  return `<div class="cms-title"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="actions">${actions}</div></div>`;
}
