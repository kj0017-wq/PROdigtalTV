import { currentUser } from "../firebase/authService.js";

const nav = [
  ["home", "Start"], ["events", "Events"], ["topics", "Themen"], ["about", "Ueber uns"],
  ["board", "Vorstand"], ["members", "Mitglieder"], ["archive", "Rueckblicke"]
];

export function logo() {
  return `<a class="logo" href="#/home" aria-label="PROdigitalTV Startseite"><span class="logo__asset"><img src="/assets/official/brand/prodigitaltv-logo-claim.png" alt="PROdigitalTV - Interessengemeinschaft Digitale Medien e.V."></span></a>`;
}

export function header(active) {
  const user = currentUser();
  return `<header class="topbar"><div class="container topbar__inner">
    ${logo()}
    <nav class="desktop-nav" aria-label="Hauptnavigation">${nav.map(([route, label]) => `<a class="${active === route ? "active" : ""}" href="#/${route}">${label}</a>`).join("")}</nav>
    <div class="actions">
      <a class="button button--secondary button--small" href="/cms.html#/cms">CMS</a>
      <a class="button button--dark button--small" href="#/${user ? "portal" : "login"}">${user ? "Profil" : "Login"}</a>
    </div>
  </div></header>`;
}

export function bottomNav(active) {
  return `<nav class="bottom-nav" aria-label="Mobile Navigation">
    ${[["home", "⌂", "Start"], ["events", "◫", "Events"], ["topics", "◇", "Themen"], ["members", "▣", "Mitglieder"], ["login", "○", "Login"]].map(([route, icon, label]) =>
      `<a href="#/${route}" class="${active === route ? "active" : ""}"><b>${icon}</b>${label}</a>`).join("")}
  </nav>`;
}

export function footer() {
  return `<footer class="footer"><div class="container footer__grid">
    <div>${logo()}<p style="margin-top:17px;max-width:360px">Das Branchennetzwerk der digitalen Medienwirtschaft. Austausch, Orientierung und relevante Verbindungen.</p></div>
    <div><h3>Plattform</h3><div class="footer__links"><a href="#/events">Events</a><a href="#/topics">Themen</a><a href="#/board">Vorstand</a><a href="#/join">Mitglied werden</a><a href="#/login">Mitgliederbereich</a></div></div>
    <div><h3>Kontakt</h3><div class="footer__links"><a href="mailto:post@prodigitaltv.de">post@prodigitaltv.de</a><a href="tel:+494044506617">+49 40 44506617</a><a href="#/imprint">Impressum</a><a href="#/privacy">Datenschutz</a></div></div>
  </div></footer>`;
}

export function publicShell(active, content) {
  return `${header(active)}<main class="page">${content}</main>${footer()}${bottomNav(active)}`;
}
