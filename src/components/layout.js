import { currentUser, canUseCms } from "../firebase/authService.js?v=467";

const nav = [
  ["home", "Start"], ["events", "Events"], ["topics", "Themen"], ["news", "News"], ["about", "Ueber uns"],
  ["archive", "Rueckblick"], ["webapp-qr", "WebApp QR"]
];

const aboutSubnav = [["board", "Vorstand"], ["members", "Mitglieder"], ["join", "Mitglied werden"]];

function navIcon(name = "home") {
  const icons = {
    home: `<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"/>`,
    events: `<path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Z"/><path d="M8 13h3M8 17h6"/>`,
    topics: `<path d="m12 3 8 8-8 8-8-8 8-8Z"/><path d="M12 7.5 15.5 11 12 14.5 8.5 11 12 7.5Z"/>`,
    news: `<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>`,
    login: `<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"/>`
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || icons.home}</svg>`;
}

export function logo() {
  return `<a class="logo" href="#/home" aria-label="PROdigitalTV Startseite"><span class="logo__asset"><img src="/assets/official/brand/prodigitaltv-logo-claim.png" alt="PROdigitalTV - Interessengemeinschaft Digitale Medien e.V."></span></a>`;
}

export function header(active) {
  const user = currentUser();
  const cmsLink = canUseCms(user) ? `<a class="button button--secondary button--small header-auth header-auth--cms" href="/cms.html#/cms">CMS</a>` : "";
  const navLink = ([route, label]) => route === "about"
    ? `<div class="desktop-nav__item desktop-nav__item--has-submenu"><a class="${active === route || aboutSubnav.some(([subRoute]) => active === subRoute) ? "active" : ""}" href="#/${route}" aria-haspopup="true">${label}</a><div class="desktop-subnav">${aboutSubnav.map(([subRoute, subLabel]) => `<a class="${active === subRoute ? "active" : ""}" href="#/${subRoute}">${subLabel}</a>`).join("")}</div></div>`
    : `<a class="${active === route ? "active" : ""}" href="#/${route}">${label}</a>`;
  const menuLink = ([route, label]) => `<a class="${active === route ? "active" : ""}" href="#/${route}" data-public-menu-close>${label}</a>`;
  return `<header class="topbar pdtv-mobile-header"><div class="container topbar__inner">
    ${logo()}
    <nav class="desktop-nav" aria-label="Hauptnavigation">${nav.map(navLink).join("")}</nav>
    <div class="actions">
      <button class="button button--secondary button--small theme-toggle pdtv-mobile-theme-toggle" type="button" data-theme-toggle aria-label="Tag- und Nachtansicht umschalten"><span data-theme-label>Night</span><span aria-hidden="true" data-theme-icon>☾</span></button>
      ${cmsLink}
      <a class="button button--dark button--small header-auth header-auth--member" href="#/${user ? "portal" : "login"}">${user ? "Profil" : "Login"}</a>
    </div>
    <button class="burger-button" type="button" data-public-menu-toggle aria-expanded="false" aria-label="Menue oeffnen"><span></span><span></span><span></span></button>
    <a class="mobile-qr" href="#/home" data-mobile-qr-link target="_blank" rel="noreferrer" aria-label="Diese Seite auf dem Smartphone oeffnen">
      <img data-mobile-qr-code alt="QR-Code fuer die mobile Seite">
    </a>
  </div><nav class="public-mobile-menu" data-public-menu aria-label="Mobile Navigation">
    ${nav.map(menuLink).join("")}
    <div class="public-mobile-submenu" aria-label="Ueber uns Untermenue">${aboutSubnav.map(([route, label]) => `<a class="${active === route ? "active" : ""}" href="#/${route}" data-public-menu-close>${label}</a>`).join("")}</div>
    ${canUseCms(user) ? `<a href="/cms.html#/cms" data-public-menu-close>CMS</a>` : ""}
    <a href="#/${user ? "portal" : "login"}" data-public-menu-close>${user ? "Profil" : "Login"}</a>
  </nav></header>`;
}

export function bottomNav(active) {
  const user = currentUser();
  const memberRoute = user ? "portal" : "login";
  const memberLabel = user ? "Profil" : "Login";
  const items = [["home", "home", "Start"], ["events", "events", "Events"], ["topics", "topics", "Themen"], ["news", "news", "News"], [memberRoute, "login", memberLabel]];
  return `<nav class="bottom-nav pdtv-mobile-bottom-nav" aria-label="Mobile Navigation">
    ${items.map(([route, icon, label]) =>
      `<a href="#/${route}" class="${active === route || (active === "login" && route === "portal") ? "active" : ""}" ${active === route ? `aria-current="page"` : ""}><b>${navIcon(icon)}</b><span>${label}</span></a>`).join("")}
  </nav>`;
}

export function footer() {
  return `<footer class="footer"><div class="container footer__grid">
    <div>${logo()}<p style="margin-top:17px;max-width:360px">Das Branchennetzwerk der digitalen Medienwirtschaft. Austausch, Orientierung und relevante Verbindungen.</p></div>
    <div><h3>Verein</h3><div class="footer__links"><a href="#/join">Mitglied werden</a><a href="#/downloads">Downloads</a><a href="#/login">Log-In</a></div></div>
    <div><h3>Kontakt</h3><div class="footer__links"><a href="mailto:post@prodigitaltv.de">post@prodigitaltv.de</a><a href="tel:+494044506617">+49 40 44506617</a></div></div>
    <div><h3>Rechtliches</h3><div class="footer__links"><a href="#/imprint">Impressum</a><a href="#/privacy">Datenschutz</a><a href="#/privacy">Cookie Einstellungen</a></div></div>
  </div><div class="container footer__meta">ProDigitalTV e.V. 2026</div></footer>`;
}

export function publicShell(active, content) {
  return `<div class="pdtv-mobile-shell pdtv-route-${active || "default"}">${header(active)}<main class="page pdtv-mobile-main">${content}</main>${footer()}${bottomNav(active)}</div>`;
}
