import { currentUser } from "../firebase/authService.js?v=250";

const nav = [
  ["home", "Start"], ["events", "Events"], ["topics", "Themen"], ["news", "News"], ["about", "Ueber uns"],
  ["board", "Vorstand"], ["members", "Mitglieder"], ["join", "Mitglied werden"], ["archive", "Rueckblicke"]
];

export function logo() {
  return `<a class="logo" href="#/home" aria-label="PROdigitalTV Startseite"><span class="logo__asset"><img src="/assets/official/brand/prodigitaltv-logo-claim.png" alt="PROdigitalTV - Interessengemeinschaft Digitale Medien e.V."></span></a>`;
}

export function header(active) {
  const user = currentUser();
  const navLink = ([route, label]) => `<a class="${active === route ? "active" : ""}" href="#/${route}">${label}</a>`;
  return `<header class="topbar"><div class="container topbar__inner">
    ${logo()}
    <nav class="desktop-nav" aria-label="Hauptnavigation">${nav.map(navLink).join("")}</nav>
    <div class="actions">
      <a class="button button--secondary button--small" href="/cms.html#/cms">CMS</a>
      <a class="button button--dark button--small" href="#/${user ? "portal" : "login"}">${user ? "Profil" : "Login"}</a>
    </div>
    <a class="mobile-qr" href="#/home" data-mobile-qr-link target="_blank" rel="noreferrer" aria-label="Diese Seite auf dem Smartphone oeffnen">
      <img data-mobile-qr-code alt="QR-Code fuer die mobile Seite">
    </a>
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
    <div><h3>Verein</h3><div class="footer__links"><a href="#/join">Mitglied werden</a><a href="#/downloads">Downloads</a><a href="#/login">Log-In</a></div></div>
    <div><h3>Kontakt</h3><div class="footer__links"><a href="mailto:post@prodigitaltv.de">post@prodigitaltv.de</a><a href="tel:+494044506617">+49 40 44506617</a></div></div>
    <div><h3>Rechtliches</h3><div class="footer__links"><a href="#/privacy">Datenschutz</a><a href="#/imprint">Impressum</a><a href="#/privacy">Cookie Einstellungen</a></div></div>
  </div><div class="container footer__meta">ProDigitalTV e.V. 2026</div></footer>`;
}

export function publicShell(active, content) {
  return `${header(active)}<main class="page">${content}</main>${footer()}${bottomNav(active)}`;
}
