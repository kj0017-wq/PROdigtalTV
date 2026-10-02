import { currentUser, isMember, isAdmin } from "../firebase/authService.js?v=477";
import { eventLoginEmail } from "../utils/eventEmailLogin.js";
import { participantContactAction } from "../utils/eventArea.js?v=8";
import { eventAvatarMarkup } from "../utils/eventLiveAvatar.js?v=1";
import { publicShell } from "../components/layout.js?v=17";
import { escapeHtml, initials, formatDate } from "../utils/format.js?v=3";
import { getEventLiveData, listEventLiveEvents } from "../firebase/eventLiveService.js?v=8";
import { eventLiveRequestMeta, eventLiveConnection } from "../utils/eventLiveRequests.js?v=5";

function eventLiveAccountSwitch() {
  return `<details class="event-live-profile-editor"><summary>Anderen Zugang verwenden</summary><p>Für den Ausnahmefall, dass Sie auf diesem Gerät ein anderes Konto nutzen möchten. Ihr aktueller Zugang wird dabei abgemeldet.</p><button class="button button--secondary button--small" type="button" data-live-switch-account>Abmelden und Zugang wechseln</button></details>`;
}

function eventLiveAuthMarkup(eventId, user = null, errorText = "") {
  const email = escapeHtml(user?.email || eventLoginEmail());
  const emailLink = new URLSearchParams(location.search).get("mode") === "signIn" && new URLSearchParams(location.search).has("oobCode");
  const verification = user && /bestätigen|bestätigte/i.test(errorText)
    ? `<div class="alert alert--warning">Für Event Chat muss Ihre E-Mail-Adresse bestätigt sein. Öffnen Sie den Bestätigungslink und melden Sie sich danach erneut an.<button class="button button--secondary button--small" type="button" data-live-resend-verification>Bestätigung erneut senden</button></div>`
    : user
      ? `<div class="alert">${escapeHtml(errorText || "Event Chat ist derzeit nicht verfügbar.")}</div>${eventLiveAccountSwitch()}`
    : `<form class="event-live-access-form" data-live-login data-event-id="${escapeHtml(eventId)}" data-login-step="${emailLink ? "link" : "email"}"><h2>Zum Veranstaltungsbereich anmelden</h2><p>E-Mail-Adresse eingeben: Wir prüfen Ihren Zugang. Gäste ohne Passwort erhalten ein Startpasswort per E-Mail.</p><label>E-Mail<input name="email" type="email" value="${email}" autocomplete="email" required></label>${emailLink ? "" : `<div data-live-password-field hidden><label>Passwort<input name="password" type="password" autocomplete="current-password" disabled required></label><button class="button button--secondary button--small" type="button" data-live-password-reset>Passwort vergessen?</button></div>`}<button class="button button--primary" type="submit">${emailLink ? "Anmeldelink öffnen" : "Weiter"}</button><div data-live-login-result role="status" aria-live="polite"></div></form>`;
  return publicShell("events", `<main class="event-live-page"><section class="event-live-hero"><p class="eyebrow">PROdigitalTV · Veranstaltung</p><h1>Event Chat</h1><p>Teilnehmende kennenlernen und den Austausch vor Ort fortsetzen.</p></section><section class="event-live-auth">${verification}</section></main>`);
}

function attendeeCard(person = {}, index = 0, data = {}) {
  const name = person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ") || "Teilnehmende Person";
  const image = eventAvatarMarkup(name, person.photoUrl);
  const conversation = (data.conversations || []).find(item => item.peerId === person.contactId);
  const unread = Boolean(conversation?.unread);
  const unreadCount = Math.max(0, Number(conversation?.unreadCount) || 0);
  const unreadBadge = unreadCount ? `<span class="event-live-unread-badge" aria-label="${unreadCount} ungelesene Nachrichten">${unreadCount > 99 ? "99+" : unreadCount}</span>` : "";
  const presence = person.testOnline ? "Online (Test)" : person.online === true ? "Online" : person.online === false ? "Offline" : "Status unbekannt";
  const contactLabels = (data.requests || []).filter(item => (item.senderContactId === data.profile?.contactId && item.receiverContactId === person.contactId) || (item.receiverContactId === data.profile?.contactId && item.senderContactId === person.contactId)).map(item => {
    const incoming = item.receiverContactId === data.profile?.contactId;
    if (item.status === "pending") return incoming ? "Kontaktdaten · Freigabe angefragt" : "Kontaktdaten · Anfrage gesendet";
    if (item.status === "accepted") return incoming ? "Kontaktdaten · Von dir freigegeben" : "Kontaktdaten · Für dich freigegeben";
    return incoming ? "Kontaktdaten · Von dir abgelehnt" : "Kontaktdaten · Anfrage abgelehnt";
  });
  return `<button type="button" class="event-live-person" data-live-request-state="${unread ? "message" : "none"}" data-live-person="${escapeHtml(person.contactId)}" data-live-person-index="${index}" aria-label="Profil von ${escapeHtml(name)} öffnen"><span class="event-live-person__avatar">${image}</span><span class="event-live-person__copy"><strong>${escapeHtml(name)}</strong>${person.boardRole ? `<small>PROdigitalTV · ${escapeHtml(person.boardRole)}</small>` : ""}<small class="event-live-presence" data-online="${person.online === true ? "true" : person.online === false ? "false" : "unknown"}">${presence}</small><small>${escapeHtml([person.position, person.company].filter(Boolean).join(" · ") || "Eventgast")}</small>${conversation ? `<small class="event-live-person__preview">${conversation.lastMessageSelf ? "Du: " : ""}${escapeHtml(conversation.lastText || "")}</small><small class="event-live-person__message-status">${conversation.lastMessageSelf ? `<span class="event-live-delivery" data-delivery="${conversation.lastMessageRead ? "read" : "delivered"}" role="img" aria-label="${conversation.lastMessageRead ? "Gelesen" : "Im Chat zugestellt"}" title="${conversation.lastMessageRead ? "Gelesen" : "Im Chat zugestellt"}">${conversation.lastMessageRead ? "✓✓" : "✓"}</span>` : unread ? "Neue Nachricht" : "Nachricht gelesen"}</small>` : ""}${contactLabels.map(label => `<small class="event-live-person__contact-status">${escapeHtml(label)}</small>`).join("")}</span>${person.companyLogo ? `<span class="event-live-person__logo-slot"><img class="event-live-person__logo" src="${escapeHtml(person.companyLogo)}" alt="Logo ${escapeHtml(person.company || "Unternehmen")}" loading="lazy"></span>` : ""}${unreadBadge}<span class="event-live-person__arrow" aria-hidden="true">›</span></button>`;
}

export function requestsMarkup(data = {}) {
  const profile = data.profile || {};
  const requests = (data.requests || []).filter((item) => item.receiverContactId === profile.contactId || item.senderContactId === profile.contactId);
  if (!requests.length) return `<p class="event-live-muted">Noch keine Kontaktanfragen.</p>`;
  return requests.map((item) => {
    const incoming = item.receiverContactId === profile.contactId;
    const otherId = incoming ? item.senderContactId : item.receiverContactId;
    const otherPerson = (data.participants || []).find((person) => person.contactId === otherId);
    const otherName = (incoming ? item.senderName : item.receiverName) || otherPerson?.displayName || "Teilnehmende Person";
    const label = `${incoming ? "Von" : "An"} ${otherName}`;
    const status = item.status === "pending" ? incoming ? "möchte Ihre Kontaktdaten erhalten" : "Kontaktdaten angefragt" : item.status === "accepted" ? "Kontaktdaten freigegeben" : "Kontaktdatenanfrage abgelehnt";
    const state = item.status === "pending" ? incoming ? "incoming" : "outgoing" : item.status === "accepted" ? "accepted" : "rejected";
    return `<article class="event-live-request" data-live-request-state="${state}"><div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(status)}</span>${eventLiveRequestMeta(item)}</div><div class="event-live-request__actions">${otherPerson ? `<button type="button" data-live-person="${escapeHtml(otherId)}">Profil / Chat öffnen</button>` : ""}${incoming && item.status === "pending" ? `<button type="button" data-live-request-answer="accepted" data-request-id="${escapeHtml(item.id)}">Freigeben</button><button type="button" data-live-request-answer="rejected" data-request-id="${escapeHtml(item.id)}">Ablehnen</button>` : ""}</div></article>`;
  }).join("");
}

export function participantList(data, mode = "classic") {
  const latestMessage = new Map((data.conversations || []).map(chat => [chat.peerId, Date.parse(chat.lastMessageAt) || 0]));
  const participants = [...(data.participants || [])].sort((a, b) =>
    Number(b.contactId === data.profile?.contactId) - Number(a.contactId === data.profile?.contactId)
    || (latestMessage.get(b.contactId) || 0) - (latestMessage.get(a.contactId) || 0));
  if (data.profile?.contactId && !participants.some((person) => person.contactId === data.profile.contactId)) participants.unshift({ ...data.profile, self: true });
  return `<div class="event-live-participants" data-event-live-mode="${mode}">${participants.length
    ? participants.map((person) => `<div data-live-person-row="${escapeHtml(person.contactId)}">${attendeeCard(person, data.participants.indexOf(person), data)}${participantContactAction(data, person)}</div>`).join("")
    : `<div class="event-live-empty"><strong>Die Teilnehmendenliste erscheint nach dem Check-in.</strong><p>Es werden nur Personen angezeigt, die bei dieser Veranstaltung eingecheckt haben.</p></div>`}</div>`;
}

function attendeeDetail(person = {}, data = {}) {
  const profile = data.profile || {};
  const outgoing = (data.requests || []).find((item) => item.senderContactId === profile.contactId && item.receiverContactId === person.contactId);
  const incoming = (data.requests || []).find((item) => item.senderContactId === person.contactId && item.receiverContactId === profile.contactId);
  const name = person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ") || "Teilnehmende Person";
  const image = eventAvatarMarkup(name, person.photoUrl);
  const requestAction = person.self ? "" : outgoing?.status === "pending"
    ? `<p class="event-live-connection-status">Anfrage gesendet</p>`
    : outgoing?.status === "accepted"
      ? `<p class="event-live-connection-status">Kontakt freigegeben${person.email ? `<br><a href="mailto:${escapeHtml(person.email)}">${escapeHtml(person.email)}</a>` : ""}${person.phone ? `<br><a href="tel:${escapeHtml(person.phone)}">${escapeHtml(person.phone)}</a>` : ""}</p>`
      : incoming?.status === "pending"
        ? `<p class="event-live-connection-status">Diese Person möchte Kontakt aufnehmen. Die Anfrage finden Sie unter „Kontakte“.</p>`
        : incoming?.status === "rejected"
          ? `<p class="event-live-connection-status">Anfrage abgelehnt</p>`
          : `<button class="button button--primary" type="button" data-live-contact-request="${escapeHtml(person.contactId)}">Kontaktdaten anfragen</button>`;
  return `<section class="event-live-detail" data-live-detail-panel><button class="event-live-back" type="button" data-live-detail-close aria-label="Zur Teilnehmerliste">← <span>Teilnehmende</span></button><div class="event-live-detail__avatar">${image}</div><p class="eyebrow">${person.isMember ? "PROdigitalTV Mitglied" : "Eventgast"}</p><h2>${escapeHtml(name)}</h2><p class="event-live-detail__position">${escapeHtml([person.position, person.company].filter(Boolean).join(" · "))}</p>${person.companyLogo ? `<img class="event-live-company-logo" src="${escapeHtml(person.companyLogo)}" alt="Logo ${escapeHtml(person.company || "Mitglied")}">` : ""}${person.isMember && person.biography ? `<section><h3>Vita</h3><p>${escapeHtml(person.biography)}</p></section>` : ""}${person.isMember && person.companyProfile ? `<section><h3>Unternehmen</h3><p>${escapeHtml(person.companyProfile)}</p>${person.website ? `<a href="${escapeHtml(person.website)}" target="_blank" rel="noopener">Website öffnen</a>` : ""}</section>` : ""}<div class="event-live-detail__contact">${requestAction}</div></section>`;
}

function eventCard(event) {
  return `<a class="event-live-event" href="#/event-live/${encodeURIComponent(event.id)}"><span class="event-live-event__date">${escapeHtml(event.date ? formatDate(event.date) : "Event")}</span><strong>${escapeHtml(event.title || "Event Chat")}</strong><span>${escapeHtml([event.startTime, event.endTime].filter(Boolean).join("–"))}</span></a>`;
}

export async function eventLivePage(eventId = "") {
  const user = currentUser();
  if (user?.passwordSetupPending && !new URLSearchParams(location.search).has("oobCode")) {
    return publicShell("events", `<main class="event-live-page"><section class="event-live-hero"><p class="eyebrow">PROdigitalTV · Event Chat</p><h1>Eigenes Passwort festlegen</h1><p>Sie sind mit Ihrem Startpasswort angemeldet. Legen Sie jetzt ein dauerhaftes Passwort fest.</p></section><section class="event-live-auth">${user.passwordSetupExpired ? `<div class="alert alert--warning">Das Startpasswort ist abgelaufen. Fordern Sie mit Ihrer E-Mail-Adresse ein neues an.</div><button class="button button--primary" type="button" data-live-restart-password>Neues Startpasswort anfordern</button>` : `<form class="event-live-access-form" data-live-password-setup><label>Neues Passwort<input name="newPassword" type="password" autocomplete="new-password" minlength="12" required></label><label>Neues Passwort wiederholen<input name="repeatPassword" type="password" autocomplete="new-password" minlength="12" required></label><button class="button button--primary" type="submit">Passwort speichern und Event-Chat öffnen</button><div data-live-password-setup-result role="status" aria-live="polite"></div></form>`}</section></main>`);
  }
  if (!eventId) {
    if (!user) return publicShell("events", `<main class="event-live-page"><section class="event-live-hero"><p class="eyebrow">PROdigitalTV</p><h1>Event Chat</h1><p>Melden Sie sich an, um freigeschaltete Veranstaltungsbereiche zu öffnen.</p><a class="button button--primary" href="#/login">Zum Login</a></section></main>`);
    try {
      const { events = [] } = await listEventLiveEvents();
      if (!isMember(user)) {
        const current = events.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
        if (current) return eventLivePage(current.id);
        return eventLiveAuthMarkup("", user, "Aktuell ist keine Veranstaltung für Sie freigeschaltet.");
      }
      return publicShell("events", `<main class="event-live-page"><section class="event-live-hero"><p class="eyebrow">PROdigitalTV · Mitgliederbereich</p><h1>Event Chat</h1><p>Ihre freigeschalteten Veranstaltungen.</p></section><section class="event-live-event-list">${events.length ? events.map(eventCard).join("") : `<div class="event-live-empty">Aktuell sind keine Event-Chat-Bereiche freigeschaltet.</div>`}</section><section class="event-live-requests"><h2>Kontakte</h2><p>Kontaktanfragen beantworten Sie direkt im jeweiligen Event-Chat-Bereich.</p></section>${eventLiveAccountSwitch()}</main>`);
    } catch (error) {
      return eventLiveAuthMarkup("", user, error.message || "Bitte melden Sie sich mit einem bestätigten Zugang an.");
    }
  }
  if (!user || new URLSearchParams(location.search).get("mode") === "signIn") return eventLiveAuthMarkup(eventId);
  try {
    const data = await getEventLiveData(eventId);
    const mode = "classic";
    const requests = requestsMarkup(data);
    const profile = data.profile || {};
    const guestPreview = isAdmin(user) && new URLSearchParams(location.hash.split("?")[1] || "").get("preview") === "guest";
    const guestView = data.role === "guest" || guestPreview;
  return publicShell("events", `<main class="event-live-page" data-event-live-root data-event-id="${escapeHtml(eventId)}"><section class="event-live-hero">${guestPreview ? '<div class="alert">Vorschau Gästebereich · Ihre Anmeldung bleibt bestehen.</div>' : ""}${guestView ? "" : '<a class="event-live-back" href="#/event-live">← <span>Event Chat</span></a>'}<p class="eyebrow">${escapeHtml(data.event.date ? formatDate(data.event.date) : "Veranstaltung")}</p><h1>${escapeHtml(data.event.title || "Event Chat")}</h1><p>${data.participants.length} eingecheckte ${data.participants.length === 1 ? "Person" : "Personen"}</p>${data.canEditProfiles === true ? '<button class="button button--secondary button--small" type="button" data-event-content-admin>Chats und Fotos verwalten</button>' : ""}</section><details class="event-live-profile-editor"><summary>Mein Profil bearbeiten</summary><details class="event-live-profile-editor"><summary>Passwort ändern</summary><form data-live-change-password><label>Aktuelles Passwort<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>Neues Passwort<input name="newPassword" type="password" autocomplete="new-password" minlength="12" required></label><label>Neues Passwort wiederholen<input name="repeatPassword" type="password" autocomplete="new-password" minlength="12" required></label><button class="button button--secondary" type="submit">Passwort ändern</button><div data-live-change-password-result role="status" aria-live="polite"></div></form></details><form data-live-profile-form><div class="event-live-profile-preview">${profile.photoUrl ? `<img src="${escapeHtml(profile.photoUrl)}" alt="Profilbild">` : `<span>${escapeHtml(initials(profile.displayName || profile.email || "P"))}</span>`}${profile.companyLogo ? `<img class="event-live-profile-logo" src="${escapeHtml(profile.companyLogo)}" alt="Firmenlogo">` : ""}<button class="button button--secondary button--small" type="button" data-live-photo-picker="library">Mediathek</button><input data-live-photo data-photo-source="library" type="file" accept="image/*" hidden></div><label>E-Mail-Adresse<input type="email" value="${escapeHtml(profile.email || "")}" autocomplete="email" readonly><small>Für Anmeldung und Event-Einladungen verwendet; nur für Sie sichtbar.</small></label><label>Vorname<input name="firstName" value="${escapeHtml(profile.firstName || "")}" autocomplete="given-name" required></label><label>Nachname<input name="lastName" value="${escapeHtml(profile.lastName || "")}" autocomplete="family-name" required></label><label>Unternehmen<input name="company" value="${escapeHtml(profile.company || "")}" autocomplete="organization"></label><label>Position / Funktion<input name="position" value="${escapeHtml(profile.position || "")}" autocomplete="organization-title"></label><label>Telefonnummer <small>(nur nach Kontaktfreigabe sichtbar)</small><input name="phone" type="tel" value="${escapeHtml(profile.phone || "")}" autocomplete="tel"></label>${["member", "admin"].includes(data.role) ? `<section class="event-live-profile-text"><h3>Vita</h3><label>Kurzvita<textarea name="biography" rows="6" maxlength="2400">${escapeHtml(profile.biography || "")}</textarea></label></section><section class="event-live-profile-text"><h3>Unternehmen</h3><label>Unternehmensbeschreibung<textarea name="companyProfile" rows="6" maxlength="2400">${escapeHtml(profile.companyProfile || "")}</textarea></label><label>Website<input name="website" type="url" value="${escapeHtml(profile.website || "")}"></label></section>` : ""}<label class="event-live-auto-share"><input type="checkbox" name="autoShareContactDetails" ${profile.autoShareContactDetails ? "checked" : ""}><span>Kontaktdatenanfragen automatisch freigeben</span><small>E-Mail, Telefonnummer und LinkedIn werden auf Anfrage im Chat mit QR-Code geteilt.</small></label><button class="button button--primary" type="submit">Profil speichern</button><div data-live-profile-result role="status"></div></form>${eventLiveAccountSwitch()}</details><section class="event-live-roster" aria-label="Anwesende Teilnehmende">${participantList(data, mode)}</section><section data-live-requests hidden></section><aside class="event-live-detail-layer" data-live-detail-layer hidden aria-modal="true" role="dialog" aria-label="Teilnehmerprofil"><div data-live-detail-content></div></aside><div data-event-live-data="${escapeHtml(JSON.stringify(data))}" hidden></div></main>`);
  } catch (error) {
    return eventLiveAuthMarkup(eventId, user, error.message || "Event Chat ist derzeit nicht verfügbar.");
  }
}
