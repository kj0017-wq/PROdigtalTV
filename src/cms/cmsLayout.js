import { currentUser, isAdmin } from "../firebase/authService.js";
import { logo } from "../components/layout.js";

const sections = [
  ["cms", "Dashboard"], ["cms/events", "Events"], ["cms/registrations", "Anmeldungen"], ["cms/followup", "Event-Nachlauf"],
  ["cms/topics", "Themen"], ["cms/sponsors", "Sponsoren / Gastgeber"], ["cms/members", "Mitglieder"], ["cms/board", "Vorstand"], ["cms/editorial", "Redaktion"],
  ["cms/mail", "Mail-Queue"], ["cms/chatgpt", "ChatGPT"], ["cms/ai-settings", "ChatGPT-Einstellungen"], ["cms/setup", "System / Einrichtung"]
];

export function cmsShell(active, content) {
  const user = currentUser();
  return `<div class="cms-shell"><header class="cms-header">${logo()}<div class="actions"><span class="tag">${user?.role || "Gast"}</span><a href="#/home" class="button button--secondary button--small">Website</a></div></header>
  <div class="cms-layout"><nav class="cms-side">${sections.filter(([route]) => route !== "cms/setup" || isAdmin(user)).map(([route, title]) => `<a href="#/${route}" class="${active === route ? "active" : ""}">${title}</a>`).join("")}</nav>
  <main class="cms-main">${content}</main></div></div>`;
}

export function cmsTitle(eyebrow, title, actions = "") {
  return `<div class="cms-title"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="actions">${actions}</div></div>`;
}
