import { getOne, upsert } from "./dataService.js";
import { getFirebaseServices } from "./firebaseClient.js";
import { normalizeLifecyclePhase } from "../data/platformConstants.js";

const ticketStoragePrefix = "pdtv-event-ticket:";
const ticketCookiePrefix = "pdtv_event_ticket_";

function eventRegistrationIsOpen(event = {}) {
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

export function clearStoredTicket(eventId) {
  try {
    localStorage.removeItem(ticketStorageKey(eventId));
  } catch {
  }
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ticketCookieKey(eventId)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${secure}`;
  } catch {
  }
}

export function storeTicket(result = {}) {
  if (!result.eventId || !result.ticketToken) return null;
  const ticket = {
    eventId: result.eventId,
    registrationId: result.registrationId || "",
    ticketToken: result.ticketToken,
    eventTitle: result.eventTitle || "",
    firstName: result.firstName || "",
    lastName: result.lastName || "",
    storedAt: new Date().toISOString()
  };
  localStorage.setItem(ticketStorageKey(result.eventId), JSON.stringify(ticket));
  writeTicketCookie(result.eventId, ticket);
  return ticket;
}

export function readStoredTicket(eventId) {
  try {
    const raw = localStorage.getItem(ticketStorageKey(eventId));
    const ticket = raw ? JSON.parse(raw) : null;
    if (ticket?.ticketToken) {
      writeTicketCookie(eventId, ticket);
      return ticket;
    }
  } catch {
  }
  return readTicketCookie(eventId);
}

export async function createRegistration(eventId, input) {
  const firebase = await getFirebaseServices();
  if (firebase) {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "createEventRegistration");
    return (await callable({ eventId, input })).data;
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
    notificationConsentText: "Benachrichtigungen zu dieser Veranstaltung und optional zu zukuenftigen PROdigitalTV-Veranstaltungen.",
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

export async function createAdminRegistration(eventId, input) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Admin-Anmeldung kann nicht gespeichert werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "adminCreateEventRegistration");
  return (await callable({ eventId, input })).data;
}

export async function deleteAdminRegistration(registrationId) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Buchung kann nicht geloescht werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "adminDeleteEventRegistration");
  return (await callable({ registrationId })).data;
}

export async function confirmRegistration(token) {
  const firebase = await getFirebaseServices();
  if (firebase) {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "confirmRegistrationByToken");
    const result = (await callable({ token })).data;
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

export async function checkInWithStoredTicket(eventId) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Check-in nicht moeglich.");
  const ticket = readStoredTicket(eventId);
  if (!ticket?.ticketToken) throw new Error("Auf diesem Geraet ist kein Ticket fuer dieses Event gespeichert.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "checkInRegistrationByDevice");
  return (await callable({ eventId, ticketToken: ticket.ticketToken })).data;
}

export async function validateStoredTicket(eventId) {
  const ticket = readStoredTicket(eventId);
  if (!ticket?.ticketToken) return null;
  const firebase = await getFirebaseServices();
  if (!firebase) return ticket;
  try {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "validateRegistrationTicket");
    const result = (await callable({ eventId, ticketToken: ticket.ticketToken })).data;
    if (!result?.valid) {
      clearStoredTicket(eventId);
      return null;
    }
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
  if (result?.eventId) clearStoredTicket(result.eventId);
  return result;
}
