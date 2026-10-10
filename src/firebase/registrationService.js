import { getOne, upsert } from "./dataService.js";
import { getFirebaseServices } from "./firebaseClient.js";
import { normalizeLifecyclePhase } from "../data/platformConstants.js";

const ticketStoragePrefix = "pdtv-event-ticket:";
const ticketCookiePrefix = "pdtv_event_ticket_";

function eventRegistrationIsOpen(event = {}) {
  if (event.preStatus === "save_the_date" || ["inactive", "draft", "archived", "deleted", "hidden"].includes(String(event.status || "").toLowerCase())) return false;
  const registrationState = String(event.registrationStatus || event.registration_state || event.registrationState || "").toLowerCase();
  return Boolean(event.registrationEnabled)
    || (event.accessType === "public" && event.allowPublicRegistration === true)
    || (event.accessType === "members_only" && event.allowMemberRegistration === true)
    || ["open", "offen", "active", "aktiv", "registration_open"].includes(registrationState)
    || event.preStatus === "invitation_published"
    || normalizeLifecyclePhase(event.lifecyclePhase) === "registration_open";
}

function ticketStorageKey(eventId) {
  return `${ticketStoragePrefix}${eventId || "unknown"}`;
}

function ticketCookieKey(eventId) {
  return `${ticketCookiePrefix}${String(eventId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function writeTicketCookie(eventId, ticket) {
  try {
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toUTCString();
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ticketCookieKey(eventId)}=${encodeURIComponent(JSON.stringify(ticket))}; expires=${expires}; path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookie storage is a best-effort bridge between Safari and installed WebApp contexts.
  }
}

function readTicketCookie(eventId) {
  try {
    const key = `${ticketCookieKey(eventId)}=`;
    const match = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(key));
    return match ? JSON.parse(decodeURIComponent(match.slice(key.length))) : null;
  } catch {
    return null;
  }
}

function ticketIdentity(ticket) {
  return ticket?.registrationId || ticket?.ticketToken || "";
}

function normalizeTicketStore(value) {
  if (value?.ticketToken) return { tickets: [value], activeId: ticketIdentity(value) };
  if (!Array.isArray(value?.tickets)) return { tickets: [], activeId: "" };
  return { tickets: value.tickets.filter((ticket) => ticket?.ticketToken), activeId: value.activeId || "" };
}

function readTicketStore(eventId) {
  let local = { tickets: [], activeId: "" };
  try {
    const raw = localStorage.getItem(ticketStorageKey(eventId));
    if (raw) local = normalizeTicketStore(JSON.parse(raw));
  } catch {}
  const cookie = normalizeTicketStore(readTicketCookie(eventId));
  const tickets = [...local.tickets];
  for (const ticket of cookie.tickets) {
    if (!tickets.some((item) => ticketIdentity(item) === ticketIdentity(ticket))) tickets.push(ticket);
  }
  return { tickets, activeId: local.activeId || cookie.activeId || ticketIdentity(tickets[0]) };
}

function writeTicketStore(eventId, store) {
  try {
    if (store.tickets.length) localStorage.setItem(ticketStorageKey(eventId), JSON.stringify(store));
    else localStorage.removeItem(ticketStorageKey(eventId));
  } catch {
    // A private or full browser store must not prevent the ticket from being shown.
  }
  if (store.tickets.length) writeTicketCookie(eventId, store);
  else {
    try {
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${ticketCookieKey(eventId)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${secure}`;
    } catch {}
  }
}

export function listStoredTickets(eventId) {
  return readTicketStore(eventId).tickets;
}

export function selectStoredTicket(eventId, registrationId) {
  const store = readTicketStore(eventId);
  const ticket = store.tickets.find((item) => ticketIdentity(item) === registrationId);
  if (!ticket) return null;
  store.activeId = ticketIdentity(ticket);
  writeTicketStore(eventId, store);
  return ticket;
}

export function clearStoredTicket(eventId, registrationId = "") {
  const store = readTicketStore(eventId);
  const identity = registrationId || store.activeId;
  store.tickets = store.tickets.filter((ticket) => ticketIdentity(ticket) !== identity);
  if (store.activeId === identity) store.activeId = ticketIdentity(store.tickets[0]);
  writeTicketStore(eventId, store);
}

export function storeTicket(result = {}) {
  if (!result.eventId || !result.ticketToken) return null;
  const store = readTicketStore(result.eventId);
  const identity = result.registrationId || result.ticketToken;
  const old = store.tickets.find((item) => ticketIdentity(item) === identity) || {};
  const ticket = {
    eventId: result.eventId,
    registrationId: result.registrationId || old.registrationId || "",
    status: result.status || (result.checkedIn === true ? "checked_in" : old.status || ""),
    ticketToken: result.ticketToken,
    eventTitle: result.eventTitle || old.eventTitle || "",
    firstName: result.firstName || old.firstName || "",
    lastName: result.lastName || old.lastName || "",
    companion: result.companion || old.companion || null,
    participantCount: result.participantCount || old.participantCount || (result.companion ? 2 : 1),
    storedAt: new Date().toISOString()
  };
  store.tickets = store.tickets.filter((item) => ticketIdentity(item) !== identity);
  store.tickets.push(ticket);
  store.activeId = ticketIdentity(ticket);
  writeTicketStore(result.eventId, store);
  return ticket;
}

export function readStoredTicket(eventId) {
  const store = readTicketStore(eventId);
  return store.tickets.find((item) => ticketIdentity(item) === store.activeId) || store.tickets[0] || null;
}

export async function createRegistration(eventId, input, options = {}) {
  const firebase = await getFirebaseServices();
  if (firebase) {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "createEventRegistration");
    const result = (await callable({ eventId, input, checkinMode: options.checkinMode === true, checkinToken: options.checkinToken || "" })).data;
    if (result?.ticketToken) storeTicket(result);
    return result;
  }
  const event = await getOne("events", eventId);
  if (!event || !eventRegistrationIsOpen(event)) throw new Error("Fuer dieses Event ist keine Anmeldung moeglich.");
  const registration = {
    id: `registration-${crypto.randomUUID()}`,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date,
    eventAccessType: event.accessType,
    ...input,
    privacyAccepted: Boolean(input.privacyAccepted),
    notifyForThisEvent: Boolean(input.notifyForThisEvent),
    notifyFutureEvents: Boolean(input.notifyFutureEvents),
    notificationConsentAccepted: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    notificationConsentSource: "event_registration_checkbox",
    notificationConsentText: "Freiwillige Event-Erinnerungen und Veranstaltungshinweise von PROdigitalTV per E-Mail, Browser-Push und SMS, soweit die jeweiligen Kontaktdaten bzw. die Browser-Freigabe vorhanden sind. Abmeldung ist jederzeit moeglich.",
    notificationChannels: (input.notifyForThisEvent || input.notifyFutureEvents) ? ["mail", "push", "sms"] : [],
    mailConsent: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    pushConsent: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    smsConsent: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    emailConfirmed: false,
    status: "pending_email_confirmation",
    mailStatus: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!registration.privacyAccepted) throw new Error("Bitte stimmen Sie den Datenschutzbestimmungen zu.");
  await upsert("registrations", registration);
  if (firebase) {
    try {
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "sendRegistrationConfirmationMail");
      await callable({ registrationId: registration.id });
    } catch (error) {
      console.warn("Registration mail confirmation endpoint skipped; Firestore trigger queues the mail.", error);
    }
  } else {
    await upsert("mailQueue", {
      id: `mail-${crypto.randomUUID()}`,
      type: "registration_confirmation",
      to: registration.email,
      subject: `Bitte bestaetigen: ${event.title}`,
      eventId,
      registrationId: registration.id,
      status: "queued",
      queuedAt: new Date().toISOString()
    });
  }
  return registration;
}

export async function getEventRegistrationPrefill(eventId, token) {
  if (!eventId || !/^[a-f0-9]{48}$/.test(String(token || ""))) return null;
  const firebase = await getFirebaseServices();
  if (!firebase) return null;
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getEventRegistrationPrefill", { timeout: 15000 });
  return (await callable({ eventId, token })).data;
}

export async function getEventCheckinAccess(eventId) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Einlass-Link kann nicht erstellt werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getEventCheckinAccess");
  return (await callable({ eventId })).data;
}

export async function getPublicEventCheckinQr(eventId, accessToken) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Einlass-QR kann nicht geladen werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getPublicEventCheckinQr");
  return (await callable({ eventId, accessToken })).data;
}

export async function createAdminRegistration(eventId, input) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Admin-Anmeldung kann nicht gespeichert werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "adminCreateEventRegistration");
  return (await callable({ eventId, input })).data;
}

export async function checkInEventGroup(eventId, groupType, personIds = [], { sendWelcomeMail = true } = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Gruppen-Check-in nicht moeglich.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "adminCheckInEventGroup", { timeout: 60000 });
  return (await callable({ eventId, groupType, personIds, sendWelcomeMail })).data;
}

export async function checkInAdminRegistrations(eventId, registrationIds) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Check-in nicht moeglich.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "adminCheckInRegistrations", { timeout: 60000 });
  return (await callable({ eventId, registrationIds, confirmed: true })).data;
}

export async function prepareEventGuestAccounts(eventId) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "prepareEventGuestAccounts", { timeout: 60000 });
  return (await callable({ eventId })).data;
}

export async function deleteAdminRegistration(registrationId) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Buchung kann nicht geloescht werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "adminDeleteEventRegistration");
  return (await callable({ registrationId })).data;
}

export async function listMyEventRegistrations(eventIds = []) {
  const firebase = await getFirebaseServices();
  if (!firebase) return [];
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getMyEventRegistrations");
  const result = (await callable({ eventIds })).data;
  return Array.isArray(result?.registrations) ? result.registrations : [];
}

export async function confirmRegistration(token) {
  const firebase = await getFirebaseServices();
  if (firebase) {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "confirmRegistrationByToken");
    const result = (await callable({ token })).data;
    if (result.pushEnrollmentToken && result.eventId) {
      try { localStorage.setItem(`pdtv-push-proof:${result.eventId}`, JSON.stringify({ token: result.pushEnrollmentToken, expiresAt: Date.now() + 30 * 86400000 })); } catch {}
    }
    storeTicket(result);
    return result;
  }
  if (!token) throw new Error("Der Bestaetigungslink ist unvollstaendig.");
  throw new Error("Firebase ist nicht erreichbar. Die Anmeldung wurde nicht bestaetigt.");
}

export async function linkTicketDevice(token) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Das Ticket wurde nicht verknuepft.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "linkTicketDeviceByToken");
  const result = (await callable({ token })).data;
  storeTicket(result);
  return result;
}

export async function requestTicketRecoveryCode(eventId, email) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Bitte spaeter erneut versuchen.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "requestEventTicketRecoveryCode");
  return (await callable({ eventId, email })).data;
}

export async function restoreTicketByCode(eventId, email, code) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Bitte spaeter erneut versuchen.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "restoreEventTicketByCode");
  const result = (await callable({ eventId, email, code })).data;
  storeTicket(result);
  return result;
}

export async function linkTicketAtEntrance(eventId, email, accessToken) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Bitte erneut versuchen.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "linkTicketAtEntrance");
  const result = (await callable({ eventId, email, accessToken })).data;
  storeTicket(result);
  return result;
}

export async function checkInWithStoredTicket(eventId) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Check-in nicht moeglich.");
  const ticket = readStoredTicket(eventId);
  if (!ticket?.ticketToken) throw new Error("Auf diesem Geraet ist kein Ticket fuer dieses Event gespeichert.");
  if (ticket.eventId && ticket.eventId !== eventId) throw new Error("Das gespeicherte Ticket gehoert zu einer anderen Veranstaltung.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "checkInRegistrationByDevice");
  const result = (await callable({ eventId, ticketToken: ticket.ticketToken })).data;
  if (result?.checkedIn === true) storeTicket({ ...ticket, ...result, eventId, ticketToken: ticket.ticketToken, status: "checked_in" });
  return result;
}

export async function validateStoredTicket(eventId) {
  const ticket = readStoredTicket(eventId);
  if (!ticket?.ticketToken) return null;
  if (ticket.eventId && ticket.eventId !== eventId) {
    clearStoredTicket(eventId);
    return null;
  }
  const firebase = await getFirebaseServices();
  if (!firebase) return ticket;
  try {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "validateRegistrationTicket");
    const result = (await callable({ eventId, ticketToken: ticket.ticketToken })).data;
    if (!result?.valid) {
      clearStoredTicket(eventId);
      return null;
    }
    storeTicket({ ...ticket, ...result, eventId, ticketToken: ticket.ticketToken });
    return { ...ticket, ...result, ticketToken: ticket.ticketToken };
  } catch (error) {
    return ticket;
  }
}

export async function getEventCheckinScreenStatus(eventId, after = "") {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Check-in-Screen nicht moeglich.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getEventCheckinScreenStatus");
  return (await callable({ eventId, after })).data;
}

export async function cancelRegistration(token) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Storno nicht moeglich.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "cancelRegistrationByToken");
  const result = (await callable({ token })).data;
  if (result?.eventId) clearStoredTicket(result.eventId, result.registrationId || "");
  return result;
}

export async function getRegistrationConfirmationStatus(registrationId, statusToken) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Anmeldestatus ist gerade nicht erreichbar.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getRegistrationConfirmationStatus");
  return (await callable({ registrationId, statusToken })).data;
}
