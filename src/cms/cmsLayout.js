import { currentUser, isAdmin } from "../firebase/authService.js";
import { logo } from "../components/layout.js";

const sections = [
  ["cms", "Dashboard"], ["cms/events", "Events"], ["cms/registrations", "Anmeldungen"], ["cms/followup", "Event-Nachlauf"],
  ["cms/sponsors", "Sponsoren / Gastgeber"], ["cms/members", "Mitglieder"], ["cms/membership-applications", "Mitgliedsantraege"], ["cms/board", "Vorstand"],
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
  ["cms/galleries", "Bildergalerien"],
  ["cms/mail", "Mail-Queue"], ["cms/chatgpt", "ChatGPT"], ["cms/ai-settings", "ChatGPT-Einstellungen"], ["cms/setup", "System / Einrichtung"]
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
  return `<div class="cms-shell"><header class="cms-header">${logo()}<div class="actions"><span class="tag">${user?.role || "Gast"}</span><a href="#/home" class="button button--secondary button--small">Website</a><a class="mobile-qr mobile-qr--cms" href="#/home" data-mobile-qr-link target="_blank" rel="noreferrer" aria-label="Passende Mobilseite oeffnen"><img data-mobile-qr-code alt="QR-Code fuer die passende Mobilseite"></a></div></header>
  <div class="cms-layout"><nav class="cms-side">${sections.map(navItem).join("")}</nav>
  <main class="cms-main">${content}</main></div></div>`;
}

export function cmsTitle(eyebrow, title, actions = "") {
  return `<div class="cms-title"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="actions">${actions}</div></div>`;
}
