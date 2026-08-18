const { createHash, randomBytes } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();
const region = "europe-west3";
const storageBucket = "prodigitaltv-da47b.firebasestorage.app";
const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const MAIL_FROM = defineSecret("MAIL_FROM");
const MAIL_TO = defineSecret("MAIL_TO");
const smtpSecrets = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO];
const PUBLIC_APP_BASE_URL = "https://prodigitaltv-da47b.web.app";
const PUBLIC_CONFIRMATION_BASE_URL = `${PUBLIC_APP_BASE_URL}/confirm.html`;

const openaiFunctions = require("./openaiFunctions");
Object.assign(exports, openaiFunctions);
const geminiTtsFunctions = require("./geminiTtsFunctions");
Object.assign(exports, geminiTtsFunctions);
const audioServiceFunctions = require("./audioServiceFunctions");
Object.assign(exports, audioServiceFunctions);

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function queueMail(payload) {
  return db.collection("mailQueue").add({
    ...payload,
    status: "queued",
    queuedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

function clean(value = "") {
  return String(value || "").trim();
}

function clientIp(request) {
  const headers = request.rawRequest?.headers || {};
  const forwarded = String(headers["x-forwarded-for"] || "").split(",").map((item) => item.trim()).filter(Boolean);
  return forwarded[0]
    || String(headers["fastly-client-ip"] || headers["x-real-ip"] || request.rawRequest?.ip || "").trim();
}

function eventRegistrationIsOpen(event = {}) {
  return Boolean(event.registrationEnabled)
    || (event.accessType === "public" && event.allowPublicRegistration === true)
    || (event.accessType === "members_only" && event.allowMemberRegistration === true)
    || event.preStatus === "invitation_published"
    || event.lifecyclePhase === "registration_open";
}

function registrationInput(data = {}) {
  const input = data.input || data.registration || {};
  return {
    firstName: stripTags(input.firstName),
    lastName: stripTags(input.lastName),
    company: stripTags(input.company),
    position: stripTags(input.position),
    email: clean(input.email).toLowerCase(),
    phone: stripTags(input.phone),
    isMember: false,
    invitationCode: stripTags(input.invitationCode),
    message: stripTags(input.message),
    privacyAccepted: Boolean(input.privacyAccepted),
    photoVideoConsent: Boolean(input.photoVideoConsent),
    newsletterConsent: Boolean(input.newsletterConsent),
    notifyForThisEvent: Boolean(input.notifyForThisEvent),
    notifyFutureEvents: Boolean(input.notifyFutureEvents)
  };
}

function normalizedMemberEmails(member = {}) {
  const values = [
    member.email,
    member.contactEmail,
    member.contact_email,
    member.profileEmail,
    member.billingEmail,
    member.invoiceEmail
  ];
  ["emails", "additionalEmails", "alternateEmails", "contactEmails", "notificationEmails"].forEach((key) => {
    if (Array.isArray(member[key])) member[key].forEach((value) => values.push(value));
  });
  if (Array.isArray(member.eventContacts)) {
    member.eventContacts.forEach((contact) => values.push(contact?.email));
  }
  if (Array.isArray(member.contacts)) {
    member.contacts.forEach((contact) => values.push(contact?.email));
  }
  return values.map((value) => clean(value).toLowerCase()).filter(Boolean);
}

function memberCanMatchRegistration(member = {}) {
  const status = clean(member.status || "active").toLowerCase();
  return !["archived", "cancelled", "deleted", "inactive"].includes(status);
}

function memberIsNotificationTestGroup(member = {}) {
  return Boolean(member.notificationTestGroup || member.isNotificationTestGroup || member.testGroup || member.notificationTester);
}

async function emailBelongsToMember(email = "") {
  const normalizedEmail = clean(email).toLowerCase();
  if (!normalizedEmail) return false;
  const membersSnapshot = await db.collection("members").get();
  return membersSnapshot.docs.some((document) => {
    const member = document.data() || {};
    return memberCanMatchRegistration(member) && normalizedMemberEmails(member).includes(normalizedEmail);
  });
}

async function eventNotificationTargets(eventId = "", options = {}) {
  const hasEvent = Boolean(clean(eventId));
  const recipientGroup = clean(options.recipientGroup || "");
  const includeMembers = ["members", "members_contacts", "test_group"].includes(recipientGroup) || options.includeMembers === true;
  const includeContacts = ["contacts", "members_contacts"].includes(recipientGroup) || options.includeContacts === true;
  const [membersSnapshot, contactsSnapshot, registrationsSnapshot] = await Promise.all([
    includeMembers ? db.collection("members").get() : Promise.resolve({ docs: [] }),
    includeContacts ? db.collection("contacts").get() : Promise.resolve({ docs: [] }),
    hasEvent ? db.collection("registrations").where("eventId", "==", eventId).get() : Promise.resolve({ docs: [] })
  ]);
  const activeRegistrations = registrationsSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter(registrationIsActive);
  const registeredEmails = new Set(activeRegistrations.map((registration) => clean(registration.email).toLowerCase()).filter(Boolean));
  const officialMemberEmails = new Set();
  membersSnapshot.docs.forEach((document) => {
    const member = { id: document.id, ...document.data() };
    if (!memberCanMatchRegistration(member)) return;
    normalizedMemberEmails(member).forEach((email) => officialMemberEmails.add(email));
  });
  const people = new Map();
  const addPerson = (email, person = {}, source = "contact") => {
    const normalizedEmail = clean(email).toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) return;
    if (hasEvent && options.registrationStatus === "registered" && !registeredEmails.has(normalizedEmail)) return;
    if (hasEvent && options.registrationStatus === "unregistered" && registeredEmails.has(normalizedEmail)) return;
    const existing = people.get(normalizedEmail) || {};
    people.set(normalizedEmail, {
      ...existing,
      ...person,
      email: normalizedEmail,
      source: existing.source === "member" ? "member" : source,
      audienceType: registeredEmails.has(normalizedEmail) ? "registered" : "unregistered"
    });
  };
  membersSnapshot.docs.forEach((document) => {
    const member = { id: document.id, ...document.data() };
    if (!memberCanMatchRegistration(member)) return;
    if (member.notificationOptOut === true || member.reminderConsent === false) return;
    if (recipientGroup === "test_group" && !memberIsNotificationTestGroup(member)) return;
    normalizedMemberEmails(member).forEach((email) => addPerson(email, {
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      company: member.name || member.company || member.title || "",
      memberId: member.id
    }, "member"));
  });
  contactsSnapshot.docs.forEach((document) => {
    const contact = { id: document.id, ...document.data() };
    if (["archived", "deleted", "inactive"].includes(clean(contact.status).toLowerCase())) return;
    if (contact.notificationOptOut === true || contact.reminderConsent === false) return;
    const email = clean(contact.email).toLowerCase();
    if (officialMemberEmails.has(email)) return;
    addPerson(email, contact, "contact");
  });
  return [...people.values()];
}

async function queueEventNotificationDelivery(notification = {}, eventRecord = {}) {
  const explicitRecipients = Array.isArray(notification.testRecipients) ? notification.testRecipients : [];
  const targets = explicitRecipients.length
    ? explicitRecipients.map((email) => ({ email, audienceType: "test", firstName: "", lastName: "", company: "" }))
    : await eventNotificationTargets(eventRecord.id, notification);
  let queued = 0;
  let pushed = 0;
  for (const target of targets) {
    const link = notification.linkEnabled === false ? "" : clean(notification.link || eventUrl(eventRecord.id));
    const body = target.audienceType === "registered"
      ? notification.registeredText || notification.shortText
      : notification.invitationText || notification.shortText;
    let pushDelivered = false;
    try {
      const tokens = await db.collection("notificationTokens")
        .where("email", "==", target.email)
        .where("status", "==", "active")
        .limit(5)
        .get();
      for (const tokenDocument of tokens.docs) {
        const token = clean(tokenDocument.data()?.token);
        if (!token) continue;
        const pushMessage = {
          token,
          notification: { title: notification.title, body },
          data: { eventId: eventRecord.id, notificationId: notification.id, link }
        };
        if (link) pushMessage.webpush = { fcmOptions: { link } };
        await getMessaging().send(pushMessage);
        pushDelivered = true;
        pushed += 1;
      }
    } catch {
      pushDelivered = false;
    }
    await queueMail({
      type: "event_notification",
      template: "event_notification",
      to: target.email,
      eventId: eventRecord.id,
      notificationId: notification.id,
      title: notification.title,
      shortText: body,
      link,
      linkEnabled: notification.linkEnabled !== false,
      audienceType: target.audienceType,
      personName: clean(`${target.firstName || ""} ${target.lastName || ""}`) || target.company || ""
    });
    queued += 1;
  }
  await db.collection("eventNotifications").doc(notification.id).set({
    status: "queued",
    testOnly: explicitRecipients.length > 0,
    targetCount: targets.length,
    queuedMailCount: queued,
    pushedCount: pushed,
    processedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { targetCount: targets.length, queuedMailCount: queued, pushedCount: pushed };
}

function notificationConsentId(email = "") {
  return `notification-consent-${createHash("sha256").update(clean(email).toLowerCase()).digest("hex").slice(0, 32)}`;
}

function notificationOptOutHash(email = "") {
  return createHash("sha256").update(clean(email).toLowerCase()).digest("hex").slice(0, 40);
}

function notificationOptOutUrl(email = "") {
  const hash = notificationOptOutHash(email);
  return hash ? publicHashUrl(`notifications/unsubscribe/${encodeURIComponent(hash)}`) : "";
}

function contactId(email = "") {
  return `contact-${createHash("sha256").update(clean(email).toLowerCase()).digest("hex").slice(0, 32)}`;
}

async function upsertContactFromRegistration(registration = {}, eventRecord = {}, now = FieldValue.serverTimestamp()) {
  const email = clean(registration.email).toLowerCase();
  if (!email) return;
  const ref = db.collection("contacts").doc(contactId(email));
  const existing = await ref.get();
  await ref.set({
    id: ref.id,
    email,
    firstName: clean(registration.firstName),
    lastName: clean(registration.lastName),
    company: clean(registration.company),
    position: clean(registration.position),
    phone: clean(registration.phone),
    source: existing.exists ? existing.data()?.source || "event_registration" : "event_registration",
    status: "active",
    reminderConsent: Boolean(registration.notifyForThisEvent || registration.notifyFutureEvents || existing.data()?.reminderConsent),
    notificationOptOutHash: notificationOptOutHash(email),
    lastEventId: eventRecord.id || registration.eventId || "",
    lastRegistrationId: registration.id || "",
    createdAt: existing.exists ? existing.data()?.createdAt || now : now,
    updatedAt: now
  }, { merge: true });
}

function eventDateTimeMillis(eventRecord = {}) {
  const date = clean(eventRecord.date);
  if (!date) return 0;
  const time = clean(eventRecord.startTime) || "09:00";
  const value = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return Number.isFinite(value) ? value : Date.parse(date) || 0;
}

function registrationIsActive(registration = {}) {
  return Boolean(registration.email) && !["cancelled", "expired"].includes(clean(registration.status).toLowerCase());
}

function eventUrl(eventId = "") {
  return publicHashUrl(`event/${encodeURIComponent(eventId)}`);
}

function publicSpaRouteUrl(path) {
  return `${PUBLIC_APP_BASE_URL}/?v=${Date.now()}#/${String(path || "").replace(/^\/+/, "")}`;
}

function adminRegistrationMailTo() {
  return mailAddress(MAIL_TO.value());
}

function registrationConfirmationUrl(token) {
  return `${PUBLIC_CONFIRMATION_BASE_URL}?v=${Date.now()}&token=${encodeURIComponent(token)}`;
}

function publicHashUrl(path) {
  return `${PUBLIC_APP_BASE_URL}/${String(path || "").replace(/^\/+/, "")}?v=${Date.now()}`;
}

function registrationTicketUrl(token, eventId = "") {
  if (eventId) {
    return publicSpaRouteUrl(`event/${encodeURIComponent(eventId)}?ticket=${encodeURIComponent(token)}`);
  }
  return publicSpaRouteUrl(`ticket/link/${encodeURIComponent(token)}`);
}

function registrationCancelUrl(token) {
  return publicHashUrl(`registration/cancel/${encodeURIComponent(token)}`);
}

function eventCheckinUrl(eventId) {
  return publicHashUrl(`event-checkin/${encodeURIComponent(eventId || "")}`);
}

function registrationLockId(eventId = "", email = "") {
  return `${clean(eventId)}-${hashToken(clean(email).toLowerCase()).slice(0, 40)}`;
}

function stripTags(value = "") {
  return clean(value).replace(/[<>]/g, "");
}

function plainDate(value = "") {
  if (!value) return "dem Veranstaltungstermin";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function defaultGlobalEventRegistrationMailText(variant = "confirmation") {
  if (variant === "waitlist") {
    return [
      "Guten Tag {{firstName}} {{lastName}},",
      "",
      "vielen Dank fuer Ihr Interesse an \"{{eventTitle}}\".",
      "",
      "Aktuell fuehren wir Ihre Anmeldung auf der Warteliste. Sobald ein Platz frei wird, melden wir uns bei Ihnen.",
      "",
      "Termin: {{eventDate}}",
      "Ort: {{eventLocation}}",
      "",
      "Viele Gruesse",
      "PROdigitalTV"
    ].join("\n");
  }
  return [
    "Guten Tag {{firstName}} {{lastName}},",
    "",
    "vielen Dank fuer Ihre Anmeldung zu \"{{eventTitle}}\".",
    "",
    "Bitte bestaetigen Sie Ihre Anmeldung ueber den Button in dieser E-Mail. Erst danach ist Ihre Anmeldung verbindlich vorgemerkt.",
    "",
    "Termin: {{eventDate}}",
    "Ort: {{eventLocation}}",
    "",
    "Viele Gruesse",
    "PROdigitalTV"
  ].join("\n");
}

function mailTemplateSettings(record = {}) {
  const value = record?.value && typeof record.value === "object" ? record.value : {};
  return {
    registrationConfirmation: record?.registrationConfirmation || value.registrationConfirmation || defaultGlobalEventRegistrationMailText("confirmation"),
    registrationWaitlist: record?.registrationWaitlist || value.registrationWaitlist || defaultGlobalEventRegistrationMailText("waitlist")
  };
}

function renderTemplateText(template = "", { registration = {}, eventRecord = {} } = {}) {
  const replacements = {
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    company: registration.company || "",
    email: registration.email || "",
    eventTitle: eventRecord.title || registration.eventTitle || "PROdigitalTV Event",
    eventDate: plainDate(eventRecord.date || registration.eventDate),
    eventLocation: [eventRecord.locationName, eventRecord.city].filter(Boolean).join(", ") || "dem Veranstaltungsort"
  };
  return String(template || "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => clean(replacements[key] ?? ""));
}

function textToHtml(text = "") {
  return clean(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${paragraph.split(/\n/).map((line) => clean(line)).join("<br>")}</p>`)
    .join("");
}

function mailHtmlShell(title = "", body = "") {
  return `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#071b34"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;border:1px solid #dbe4f1;overflow:hidden"><tr><td style="padding:28px 30px"><div style="font-size:30px;font-weight:800;color:#e30613;margin-bottom:6px">PRO<span style="color:#e30613;font-weight:400">digital</span>TV</div><p style="margin:0 0 22px;color:#5f6b7c">Interessengemeinschaft Digitale Medien e.V.</p><h1 style="font-size:26px;line-height:1.25;margin:0 0 18px;color:#071b34">${title}</h1>${body}</td></tr></table></td></tr></table></body></html>`;
}

function mailButton(label = "", url = "") {
  if (!url) return "";
  return `<p style="margin:26px 0"><a href="${url}" style="display:inline-block;background:#e30613;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:15px 24px">${label}</a></p>`;
}

function storagePathFromMediaUrl(value = "") {
  const text = clean(value);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (!["firebasestorage.googleapis.com", "storage.googleapis.com"].includes(parsed.hostname)) return "";
    const match = parsed.pathname.match(/\/o\/([^/]+)$/i);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

function mailAddress(value = "") {
  return clean(value).replace(/[\r\n]/g, "");
}

function formatLines(lines) {
  return lines
    .filter(([, value]) => clean(value))
    .map(([label, value]) => `${label}: ${clean(value)}`)
    .join("\n");
}

function createTransporter() {
  const port = Number(SMTP_PORT.value() || 587);
  const host = SMTP_HOST.value();
  const user = SMTP_USER.value();
  const pass = SMTP_PASS.value();
  if (!host || !user || !pass) throw new Error("SMTP secrets fehlen.");
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function mailContext(mail) {
  const [registration, membershipApplication, eventRecord, mailTemplates] = await Promise.all([
    mail.registrationId ? db.collection("registrations").doc(mail.registrationId).get() : null,
    mail.membershipApplicationId ? db.collection("membershipApplications").doc(mail.membershipApplicationId).get() : null,
    mail.eventId ? db.collection("events").doc(mail.eventId).get() : null,
    db.collection("settings").doc("mailTemplates").get().catch(() => null)
  ]);
  return {
    registration: registration?.exists ? { id: registration.id, ...registration.data() } : null,
    membershipApplication: membershipApplication?.exists ? { id: membershipApplication.id, ...membershipApplication.data() } : null,
    eventRecord: eventRecord?.exists ? { id: eventRecord.id, ...eventRecord.data() } : null,
    mailTemplates: mailTemplates?.exists ? { id: mailTemplates.id, ...mailTemplates.data() } : null
  };
}

function renderMail(mail, context = {}) {
  const registration = context.registration || {};
  const application = context.membershipApplication || {};
  const eventRecord = context.eventRecord || {};
  const mailTemplates = mailTemplateSettings(context.mailTemplates || {});

  if (mail.template === "membership_application_admin") {
    const body = [
      "Neuer Mitgliedsantrag ueber die Website.",
      "",
      formatLines([
        ["Unternehmen / Organisation", application.company],
        ["Rechtsform", application.legalForm],
        ["Strasse", application.street],
        ["PLZ / Ort", application.city],
        ["Land", application.country],
        ["Website", application.website],
        ["Ansprechpartner", `${clean(application.firstName)} ${clean(application.lastName)}`],
        ["Position", application.position],
        ["E-Mail", application.email],
        ["Telefon", application.phone],
        ["Mitgliedschaft", application.membershipType],
        ["Newsletter-Einwilligung", application.newsletterConsent ? "ja" : "nein"]
      ]),
      "",
      application.companyDescription ? `Kurzbeschreibung:\n${clean(application.companyDescription)}` : "",
      application.message ? `Nachricht:\n${clean(application.message)}` : "",
      "",
      `Firestore-ID: ${application.id || mail.membershipApplicationId || ""}`
    ].filter(Boolean).join("\n");
    return { subject: mail.subject || "Neuer Mitgliedsantrag", text: body };
  }

  if (mail.template === "membership_application_received") {
    const name = clean(`${application.firstName || ""} ${application.lastName || ""}`) || "Guten Tag";
    return {
      subject: mail.subject || "Ihr Mitgliedsantrag bei PROdigitalTV",
      text: [
        `${name},`,
        "",
        "vielen Dank fuer Ihren Mitgliedsantrag bei PROdigitalTV.",
        "Wir haben Ihre Angaben erhalten und melden uns zeitnah zur weiteren Bearbeitung.",
        "",
        "Viele Gruesse",
        "PROdigitalTV"
      ].join("\n")
    };
  }

  if (mail.template === "registration_confirmation") {
    const baseTemplate = eventRecord.mailText || mailTemplates.registrationConfirmation || defaultGlobalEventRegistrationMailText("confirmation");
    const bodyText = renderTemplateText(baseTemplate, { registration, eventRecord });
    const text = [
      bodyText,
      "",
      mail.confirmationUrl ? `Bestaetigungslink: ${mail.confirmationUrl}` : "",
      "",
      "Der Link ist 48 Stunden gueltig."
    ].filter(Boolean).join("\n");
    return {
      subject: mail.subject || `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title || registration.eventTitle || ""}`,
      text,
      html: mailHtmlShell("Anmeldung bestaetigen", [
        textToHtml(bodyText),
        mailButton("Anmeldung bestaetigen", mail.confirmationUrl),
        `<p style="font-size:14px;line-height:1.5;color:#5f6b7c;margin:18px 0 0">Falls der Button nicht funktioniert, kopieren Sie diesen Link in den Browser:<br><a href="${mail.confirmationUrl}" style="color:#0b3a66">${mail.confirmationUrl}</a></p>`,
        `<p style="font-size:14px;color:#5f6b7c;margin:18px 0 0">Der Link ist 48 Stunden gueltig.</p>`
      ].filter(Boolean).join(""))
    };
  }

  if (mail.template === "registration_confirmed") {
    const title = registration.eventTitle || eventRecord.title || "";
    return {
      subject: mail.subject || `Anmeldung bestaetigt: ${registration.eventTitle || eventRecord.title || ""}`,
      text: [
        `Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},`,
        "",
        `Ihre Anmeldung${title ? ` fuer "${title}"` : ""} wurde bestaetigt.`,
        "",
        mail.ticketLink ? `Eintrittskarte auf dem Handy aktivieren: ${mail.ticketLink}` : "",
        mail.cancelUrl ? `Anmeldung stornieren: ${mail.cancelUrl}` : "",
        "",
        "Wenn Sie die Anmeldung am Computer bestaetigt haben, oeffnen Sie den Ticket-Link bitte einmal auf dem Handy. Danach erkennt die Eventseite dieses Geraet.",
        "",
        "Viele Gruesse",
        "PROdigitalTV"
      ].filter(Boolean).join("\n"),
      html: mailHtmlShell("Anmeldung bestaetigt", [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Ihre Anmeldung${title ? ` fuer <strong>${title}</strong>` : ""} wurde bestaetigt.</p>`,
        mailButton("Handy-Ticket aktivieren", mail.ticketLink),
        mail.cancelUrl ? `<p style="font-size:14px;line-height:1.5;margin:18px 0 0"><a href="${mail.cancelUrl}" style="color:#0b3a66">Anmeldung stornieren</a></p>` : "",
        `<p style="font-size:14px;color:#5f6b7c;margin:18px 0 0">Wenn Sie die Anmeldung am Computer bestaetigt haben, oeffnen Sie den Ticket-Link bitte einmal auf dem Handy.</p>`
      ].filter(Boolean).join(""))
    };
  }

  if (mail.template === "admin_notification") {
    return {
      subject: mail.subject || "Neue Anmeldung",
      text: [
        "Neue Event-Anmeldung.",
        "",
        formatLines([
          ["Event", registration.eventTitle || eventRecord.title],
          ["Teilnehmer", `${clean(registration.firstName)} ${clean(registration.lastName)}`],
          ["Unternehmen", registration.company],
          ["E-Mail", registration.email],
          ["Status", registration.status]
        ])
      ].join("\n")
    };
  }

  if (mail.template === "event_notification") {
    const title = clean(mail.title || eventRecord.title || "PROdigitalTV Veranstaltung");
    const body = clean(mail.shortText || mail.text || "Neue Informationen zu einer PROdigitalTV-Veranstaltung.");
    const link = mail.linkEnabled === false ? "" : clean(mail.link || eventUrl(mail.eventId || eventRecord.id || ""));
    const optOutUrl = notificationOptOutUrl(mail.to);
    const salutation = clean(mail.personName) ? `Guten Tag ${clean(mail.personName)},` : "Guten Tag,";
    const intro = mail.audienceType === "registered"
      ? "hier finden Sie Ihre Erinnerung mit den Veranstaltungsinformationen."
      : "wir moechten Sie auf diese Veranstaltung hinweisen.";
    const text = [
      salutation,
      "",
      intro,
      "",
      title,
      body,
      "",
      link ? `Zur Veranstaltung: ${link}` : "",
      optOutUrl ? `Keine Erinnerungen mehr erhalten: ${optOutUrl}` : "",
      "",
      "Viele Gruesse",
      "PROdigitalTV"
    ].filter(Boolean).join("\n");
    return {
      subject: mail.subject || title,
      text,
      html: mailHtmlShell(title, [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${salutation}</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${intro}</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${textToHtml(body)}</p>`,
        mailButton("Zur Veranstaltung", link),
        optOutUrl ? `<p style="font-size:12px;line-height:1.5;color:#7a8493;margin:24px 0 0;border-top:1px solid #dbe4f1;padding-top:14px">Sie erhalten diese Nachricht, weil Sie PROdigitalTV-Veranstaltungshinweise aktiviert haben. <a href="${optOutUrl}" style="color:#5f6b7c">Keine Erinnerungen mehr erhalten</a>.</p>` : ""
      ].filter(Boolean).join(""))
    };
  }

  return {
    subject: mail.subject || "Nachricht von PROdigitalTV",
    text: clean(mail.text || mail.body || "Neue Nachricht aus der Website.")
  };
}

async function sendQueuedMail(mail) {
  const context = await mailContext(mail);
  const rendered = renderMail(mail, context);
  const transporter = createTransporter();
  const from = mailAddress(MAIL_FROM.value());
  const to = mailAddress(mail.to || MAIL_TO.value());
  if (!from || !to) throw new Error("Absender oder Empfaenger fehlt.");
  const replyTo = mail.replyTo || context.membershipApplication?.email || context.registration?.email;
  return transporter.sendMail({
    from,
    to,
    replyTo: replyTo ? mailAddress(replyTo) : undefined,
    subject: stripTags(rendered.subject),
    text: rendered.text,
    html: rendered.html
  });
}

async function requireEditor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!["admin", "editor"].includes(profile?.role)) throw new HttpsError("permission-denied", "Keine CMS-Berechtigung.");
  return profile;
}

exports.bootstrapFirstAdmin = onCall({ region }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const existingAdmin = await db.collection("users")
    .where("role", "==", "admin")
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (!existingAdmin.empty) {
    throw new HttpsError("permission-denied", "Ein aktiver Admin existiert bereits. Rollen koennen nur im CMS oder direkt in Firestore geaendert werden.");
  }
  const user = {
    email: request.auth.token.email || "",
    displayName: request.auth.token.name || request.auth.token.email || "Administrator",
    firstName: "",
    lastName: "",
    role: "admin",
    status: "active",
    emailVerified: Boolean(request.auth.token.email_verified),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: "bootstrapFirstAdmin",
    internalNote: "Erster Admin wurde ueber die Setup-Bootstrap-Funktion angelegt."
  };
  await db.collection("users").doc(request.auth.uid).set(user, { merge: true });
  await db.collection("auditLog").add({
    action: "bootstrap_first_admin",
    module: "system",
    entityType: "user",
    entityId: request.auth.uid,
    userId: request.auth.uid,
    userEmail: user.email,
    timestamp: FieldValue.serverTimestamp(),
    details: { role: "admin" }
  });
  return { ok: true, role: "admin", message: "Erster Admin wurde freigeschaltet." };
});

exports.createEventRegistration = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId);
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
  const eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
  if (!eventRegistrationIsOpen(eventRecord)) throw new HttpsError("failed-precondition", "Fuer dieses Event ist keine Anmeldung moeglich.");
  const input = registrationInput(request.data || {});
  if (!input.privacyAccepted) throw new HttpsError("failed-precondition", "Bitte stimmen Sie den Datenschutzbestimmungen zu.");
  if (!input.email || !input.email.includes("@")) throw new HttpsError("invalid-argument", "Bitte geben Sie eine gueltige E-Mail-Adresse an.");
  const existingRegistration = await db.collection("registrations")
    .where("eventId", "==", eventRecord.id)
    .where("email", "==", input.email)
    .limit(10)
    .get();
  const duplicate = existingRegistration.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .find((registration) => !["cancelled", "expired"].includes(String(registration.status || "")));
  if (duplicate) {
    throw new HttpsError("already-exists", "Diese E-Mail-Adresse ist fuer dieses Event bereits angemeldet.");
  }
  const now = FieldValue.serverTimestamp();
  const registrationRef = db.collection("registrations").doc(`registration-${randomBytes(16).toString("hex")}`);
  const lockRef = db.collection("registrationLocks").doc(registrationLockId(eventRecord.id, input.email));
  const headers = request.rawRequest?.headers || {};
  const isMemberByEmail = await emailBelongsToMember(input.email);
  const confirmationToken = randomBytes(32).toString("hex");
  const confirmationExpiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  const registration = {
    id: registrationRef.id,
    eventId: eventRecord.id,
    eventTitle: eventRecord.title || "",
    eventDate: eventRecord.date || "",
    eventAccessType: eventRecord.accessType || "",
    ...input,
    isMember: isMemberByEmail,
    notificationConsentAccepted: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    notificationConsentSource: "event_registration_checkbox",
    notificationConsentText: "Benachrichtigungen zu dieser Veranstaltung und optional zu zukuenftigen PROdigitalTV-Veranstaltungen.",
    emailConfirmed: false,
    status: "pending_email_confirmation",
    mailStatus: "queued",
    confirmationTokenHash: hashToken(confirmationToken),
    confirmationExpiresAt,
    confirmationMailQueuedAt: now,
    createdIp: clientIp(request),
    createdUserAgent: stripTags(headers["user-agent"] || ""),
    createdAt: now,
    updatedAt: now
  };
  await db.runTransaction(async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    const lock = lockSnapshot.exists ? lockSnapshot.data() : null;
    if (lock?.registrationId) {
      const lockedRegistration = await transaction.get(db.collection("registrations").doc(lock.registrationId));
      const lockedStatus = lockedRegistration.exists ? String(lockedRegistration.data()?.status || "") : "";
      if (lockedRegistration.exists && !["cancelled", "expired"].includes(lockedStatus)) {
        throw new HttpsError("already-exists", "Diese E-Mail-Adresse ist fuer dieses Event bereits angemeldet.");
      }
    }
    transaction.set(registrationRef, registration);
    transaction.set(lockRef, {
      id: lockRef.id,
      eventId: eventRecord.id,
      email: input.email,
      registrationId: registrationRef.id,
      status: registration.status,
      updatedAt: now,
      createdAt: lock?.createdAt || now
    }, { merge: true });
  });
  if (input.notifyFutureEvents) {
    await db.collection("notificationConsents").doc(notificationConsentId(input.email)).set({
      id: notificationConsentId(input.email),
      email: input.email,
      status: "active",
      source: "event_registration_checkbox",
      scope: "future_events",
      notifyFutureEvents: true,
      lastEventId: eventRecord.id,
      lastRegistrationId: registrationRef.id,
      createdIp: registration.createdIp,
      createdUserAgent: registration.createdUserAgent,
      createdAt: now,
      updatedAt: now
    }, { merge: true });
  }
  await upsertContactFromRegistration(registration, eventRecord, now);
  await queueMail({
    type: "registration_confirmation",
    to: registration.email,
    subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title}`,
    template: "registration_confirmation",
    eventId: registration.eventId,
    registrationId: registrationRef.id,
    confirmationUrl: registrationConfirmationUrl(confirmationToken),
    tokenExpiresAt: confirmationExpiresAt
  });
  await queueMail({
    type: "admin_notification",
    to: adminRegistrationMailTo(),
    subject: `Neue Anmeldung: ${eventRecord.title}`,
    template: "admin_notification",
    eventId: registration.eventId,
    registrationId: registrationRef.id
  });
  return {
    ...registration,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
});

exports.adminCreateEventRegistration = onCall({ region }, async (request) => {
  const profile = await requireEditor(request);
  const eventId = clean(request.data?.eventId);
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
  const eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
  const input = registrationInput({ input: request.data?.input || {} });
  if (!input.email || !input.email.includes("@")) throw new HttpsError("invalid-argument", "Bitte geben Sie eine gueltige E-Mail-Adresse an.");
  const existingRegistration = await db.collection("registrations")
    .where("eventId", "==", eventRecord.id)
    .where("email", "==", input.email)
    .limit(10)
    .get();
  const duplicate = existingRegistration.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .find((registration) => !["cancelled", "expired"].includes(String(registration.status || "")));
  if (duplicate) {
    throw new HttpsError("already-exists", "Diese E-Mail-Adresse ist fuer dieses Event bereits angemeldet.");
  }
  const now = FieldValue.serverTimestamp();
  const registrationRef = db.collection("registrations").doc(`registration-${randomBytes(16).toString("hex")}`);
  const lockRef = db.collection("registrationLocks").doc(registrationLockId(eventRecord.id, input.email));
  const headers = request.rawRequest?.headers || {};
  const isMemberByEmail = await emailBelongsToMember(input.email);
  const confirmationToken = randomBytes(32).toString("hex");
  const confirmationExpiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  const registration = {
    id: registrationRef.id,
    eventId: eventRecord.id,
    eventTitle: eventRecord.title || "",
    eventDate: eventRecord.date || "",
    eventAccessType: eventRecord.accessType || "",
    ...input,
    isMember: isMemberByEmail,
    privacyAccepted: Boolean(input.privacyAccepted),
    emailConfirmed: false,
    status: "pending_email_confirmation",
    mailStatus: "queued",
    confirmationTokenHash: hashToken(confirmationToken),
    confirmationExpiresAt,
    confirmationMailQueuedAt: now,
    source: "cms_admin",
    createdIp: clientIp(request),
    createdUserAgent: stripTags(headers["user-agent"] || ""),
    createdBy: profile.email || request.auth.uid,
    createdAt: now,
    updatedAt: now
  };
  await db.runTransaction(async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    const lock = lockSnapshot.exists ? lockSnapshot.data() : null;
    if (lock?.registrationId) {
      const lockedRegistration = await transaction.get(db.collection("registrations").doc(lock.registrationId));
      const lockedStatus = lockedRegistration.exists ? String(lockedRegistration.data()?.status || "") : "";
      if (lockedRegistration.exists && !["cancelled", "expired"].includes(lockedStatus)) {
        throw new HttpsError("already-exists", "Diese E-Mail-Adresse ist fuer dieses Event bereits angemeldet.");
      }
    }
    transaction.set(registrationRef, registration);
    transaction.set(lockRef, {
      id: lockRef.id,
      eventId: eventRecord.id,
      email: input.email,
      registrationId: registrationRef.id,
      status: registration.status,
      updatedAt: now,
      createdAt: lock?.createdAt || now
    }, { merge: true });
  });
  await upsertContactFromRegistration(registration, eventRecord, now);
  await queueMail({
    type: "registration_confirmation",
    to: registration.email,
    subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title}`,
    template: "registration_confirmation",
    eventId: registration.eventId,
    registrationId: registrationRef.id,
    confirmationUrl: registrationConfirmationUrl(confirmationToken),
    tokenExpiresAt: confirmationExpiresAt
  });
  return {
    ...registration,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
});

exports.adminDeleteEventRegistration = onCall({ region }, async (request) => {
  await requireEditor(request);
  const registrationId = clean(request.data?.registrationId);
  if (!registrationId) throw new HttpsError("invalid-argument", "registrationId fehlt.");
  const registrationRef = db.collection("registrations").doc(registrationId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(registrationRef);
    if (snapshot.exists) {
      const registration = snapshot.data() || {};
      if (registration.eventId && registration.email) {
        transaction.delete(db.collection("registrationLocks").doc(registrationLockId(registration.eventId, registration.email)));
      }
      transaction.delete(registrationRef);
      return;
    }
    const locks = await transaction.get(db.collection("registrationLocks").where("registrationId", "==", registrationId).limit(20));
    locks.docs.forEach((document) => transaction.delete(document.ref));
  });
  return { deleted: true, registrationId };
});

exports.createEventNotification = onCall({ region }, async (request) => {
  const profile = await requireEditor(request);
  const input = request.data?.input || {};
  const notificationKind = clean(input.notificationKind) === "member_message" ? "member_message" : "event";
  const eventId = clean(input.eventId);
  let eventRecord = {};
  if (notificationKind === "event") {
    if (!eventId) throw new HttpsError("invalid-argument", "Bitte Veranstaltung auswaehlen.");
    const eventSnapshot = await db.collection("events").doc(eventId).get();
    if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
    eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
    const statusValue = clean(eventRecord.status).toLowerCase();
    if (["archived", "deleted", "inactive", "draft"].includes(statusValue)) throw new HttpsError("failed-precondition", "Nur aktive Veranstaltungen koennen benachrichtigt werden.");
    const startMs = eventDateTimeMillis(eventRecord);
    if (startMs && startMs < Date.now()) throw new HttpsError("failed-precondition", "Nur bevorstehende Veranstaltungen koennen benachrichtigt werden.");
  }
  const sendMode = ["now", "scheduled", "auto_before_event"].includes(clean(input.sendMode)) ? clean(input.sendMode) : "now";
  const notificationRef = db.collection("eventNotifications").doc(`event-notification-${randomBytes(16).toString("hex")}`);
  const title = stripTags(input.title) || eventRecord.title || "PROdigitalTV Veranstaltung";
  const shortText = stripTags(input.shortText) || `Informationen zu ${eventRecord.title || "dieser Veranstaltung"}.`;
  const testRecipients = clean(input.testRecipients)
    .split(/[\s,;]+/)
    .map((email) => mailAddress(email))
    .filter(Boolean)
    .filter((email, index, all) => all.indexOf(email) === index);
  const testOnly = Boolean(input.testOnly);
  if (testOnly && !testRecipients.length) throw new HttpsError("invalid-argument", "Bitte mindestens eine Testperson eintragen.");
  const recipientGroup = ["members", "contacts", "members_contacts", "test_group", "test_person"].includes(clean(input.recipientGroup))
    ? clean(input.recipientGroup)
    : "members_contacts";
  const offsetMinutes = Number(input.offsetMinutes || 0);
  let scheduledAt = null;
  if (sendMode === "scheduled" && clean(input.scheduledAt)) {
    const parsed = Date.parse(clean(input.scheduledAt));
    if (Number.isFinite(parsed)) scheduledAt = Timestamp.fromMillis(parsed);
  }
  if (sendMode === "auto_before_event" && notificationKind !== "event") throw new HttpsError("invalid-argument", "Automatische Erinnerung ist nur fuer Veranstaltungen moeglich.");
  if (sendMode === "auto_before_event" && offsetMinutes > 0) {
    const startMs = eventDateTimeMillis(eventRecord);
    if (startMs) scheduledAt = Timestamp.fromMillis(Math.max(Date.now(), startMs - offsetMinutes * 60 * 1000));
  }
  const linkEnabled = input.linkEnabled !== false && clean(input.linkEnabled) !== "false";
  const submittedLink = clean(input.link);
  const defaultLink = notificationKind === "event" ? eventUrl(eventId) : publicHashUrl("members");
  const notification = {
    id: notificationRef.id,
    eventId: notificationKind === "event" ? eventId : "",
    notificationKind,
    title,
    shortText,
    linkEnabled,
    link: linkEnabled ? submittedLink || defaultLink : "",
    testOnly,
    testRecipients: testOnly ? testRecipients : [],
    recipientGroup,
    includeMembers: ["members", "members_contacts", "test_group"].includes(recipientGroup),
    includeContacts: ["contacts", "members_contacts"].includes(recipientGroup),
    registrationStatus: ["all", "registered", "unregistered"].includes(clean(input.registrationStatus)) ? clean(input.registrationStatus) : "all",
    sendMode,
    offsetMinutes: Number.isFinite(offsetMinutes) ? offsetMinutes : 0,
    scheduledAt,
    status: sendMode === "now" ? "processing" : "scheduled",
    createdBy: profile.email || request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await notificationRef.set(notification);
  if (sendMode === "now") {
    const result = await queueEventNotificationDelivery({ ...notification, id: notificationRef.id }, eventRecord);
    return { id: notificationRef.id, ...result };
  }
  return { id: notificationRef.id, scheduled: true };
});

exports.previewEventNotification = onCall({ region }, async (request) => {
  await requireEditor(request);
  const input = request.data?.input || {};
  const notificationKind = clean(input.notificationKind) === "member_message" ? "member_message" : "event";
  const eventId = clean(input.eventId);
  if (notificationKind === "event" && !eventId) throw new HttpsError("invalid-argument", "Bitte Veranstaltung auswaehlen.");
  const testRecipients = clean(input.testRecipients)
    .split(/[\s,;]+/)
    .map((email) => mailAddress(email))
    .filter(Boolean)
    .filter((email, index, all) => all.indexOf(email) === index);
  const testOnly = Boolean(input.testOnly);
  if (testOnly && !testRecipients.length) throw new HttpsError("invalid-argument", "Bitte mindestens eine Testperson eintragen.");
  const recipientGroup = ["members", "contacts", "members_contacts", "test_group", "test_person"].includes(clean(input.recipientGroup))
    ? clean(input.recipientGroup)
    : "members_contacts";
  const registrationStatus = ["all", "registered", "unregistered"].includes(clean(input.registrationStatus)) ? clean(input.registrationStatus) : "all";
  const targets = testOnly
    ? testRecipients.map((email) => ({ email, audienceType: "test" }))
    : await eventNotificationTargets(notificationKind === "event" ? eventId : "", {
      recipientGroup,
      includeMembers: ["members", "members_contacts", "test_group"].includes(recipientGroup),
      includeContacts: ["contacts", "members_contacts"].includes(recipientGroup),
      registrationStatus
    });
  return {
    targetCount: targets.length,
    mailCount: targets.length,
    testOnly,
    recipientGroup
  };
});

exports.registerNotificationToken = onCall({ region }, async (request) => {
  const data = request.data || {};
  const token = clean(data.token);
  const email = mailAddress(data.email);
  if (!token) throw new HttpsError("invalid-argument", "Push-Token fehlt.");
  if (!email) throw new HttpsError("invalid-argument", "E-Mail-Adresse fehlt.");
  const tokenId = `notification-token-${createHash("sha256").update(token).digest("hex").slice(0, 40)}`;
  await db.collection("notificationTokens").doc(tokenId).set({
    id: tokenId,
    token,
    email,
    eventId: clean(data.eventId),
    status: "active",
    permission: clean(data.permission || "granted"),
    source: clean(data.source || "browser"),
    userAgent: stripTags(data.userAgent),
    platform: stripTags(data.platform),
    lastSeenAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { status: "active", id: tokenId };
});

exports.getNotificationPushStatus = onCall({ region }, async (request) => {
  await requireEditor(request);
  const requestedEmails = Array.isArray(request.data?.emails) ? request.data.emails : [];
  const emailSet = new Set(requestedEmails.map((email) => mailAddress(email)).filter(Boolean));
  if (!emailSet.size) return { activeEmails: [] };
  const tokens = await db.collection("notificationTokens")
    .where("status", "==", "active")
    .get();
  const activeEmails = new Set();
  tokens.docs.forEach((document) => {
    const token = document.data() || {};
    const email = mailAddress(token.email);
    if (!email || !token.token || !emailSet.has(email)) return;
    activeEmails.add(email);
  });
  return { activeEmails: [...activeEmails] };
});

exports.unsubscribeEventNotifications = onCall({ region, invoker: "public" }, async (request) => {
  const hash = clean(request.data?.hash);
  if (!hash || !/^[a-f0-9]{24,64}$/i.test(hash)) throw new HttpsError("invalid-argument", "Abmeldelink ist ungueltig.");
  const now = FieldValue.serverTimestamp();
  let updated = 0;

  const contacts = await db.collection("contacts").where("notificationOptOutHash", "==", hash).get();
  if (!contacts.empty) {
    const contactBatch = db.batch();
    contacts.docs.forEach((document) => {
      contactBatch.set(document.ref, {
        reminderConsent: false,
        notificationOptOut: true,
        notificationOptOutAt: now,
        updatedAt: now
      }, { merge: true });
      updated += 1;
    });
    await contactBatch.commit();
  }

  const scannedContacts = await db.collection("contacts").get();
  const scannedContactBatch = db.batch();
  let scannedContactUpdates = 0;
  scannedContacts.docs.forEach((document) => {
    if (contacts.docs.some((contact) => contact.id === document.id)) return;
    const contact = document.data() || {};
    if (notificationOptOutHash(contact.email) !== hash) return;
    scannedContactBatch.set(document.ref, {
      reminderConsent: false,
      notificationOptOut: true,
      notificationOptOutHash: hash,
      notificationOptOutAt: now,
      updatedAt: now
    }, { merge: true });
    scannedContactUpdates += 1;
    updated += 1;
  });
  if (scannedContactUpdates) await scannedContactBatch.commit();

  const members = await db.collection("members").get();
  const memberBatch = db.batch();
  let memberUpdates = 0;
  members.docs.forEach((document) => {
    const member = document.data() || {};
    const match = normalizedMemberEmails(member).some((email) => notificationOptOutHash(email) === hash);
    if (!match) return;
    memberBatch.set(document.ref, {
      reminderConsent: false,
      notificationOptOut: true,
      notificationOptOutAt: now,
      updatedAt: now
    }, { merge: true });
    memberUpdates += 1;
    updated += 1;
  });
  if (memberUpdates) await memberBatch.commit();
  if (!updated) throw new HttpsError("not-found", "Abmeldeeintrag wurde nicht gefunden.");
  return { unsubscribed: true, updated };
});

exports.processEventNotifications = onSchedule({ region, schedule: "every 15 minutes" }, async () => {
  const now = Timestamp.now();
  const due = await db.collection("eventNotifications")
    .where("status", "==", "scheduled")
    .where("scheduledAt", "<=", now)
    .limit(20)
    .get();
  for (const document of due.docs) {
    const notification = { id: document.id, ...document.data() };
    const eventSnapshot = await db.collection("events").doc(notification.eventId).get();
    if (!eventSnapshot.exists) {
      await document.ref.set({ status: "failed", error: "Event wurde nicht gefunden.", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }
    await document.ref.set({ status: "processing", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await queueEventNotificationDelivery(notification, { id: eventSnapshot.id, ...eventSnapshot.data() });
  }
  const eventSnapshot = await db.collection("events").get();
  const reminders = [
    ["reminder7d", 10080, "7 Tage"],
    ["reminder1d", 1440, "1 Tag"],
    ["reminder2h", 120, "2 Stunden"]
  ];
  for (const eventDocument of eventSnapshot.docs) {
    const eventRecord = { id: eventDocument.id, ...eventDocument.data() };
    if (["archived", "deleted"].includes(clean(eventRecord.status).toLowerCase())) continue;
    const startMs = eventDateTimeMillis(eventRecord);
    if (!startMs || startMs < Date.now()) continue;
    for (const [field, minutes, label] of reminders) {
      if (!eventRecord[field]) continue;
      const dueMs = startMs - minutes * 60 * 1000;
      if (dueMs > Date.now() || dueMs < Date.now() - 45 * 60 * 1000) continue;
      const notificationId = `event-reminder-${eventRecord.id}-${field}`;
      const ref = db.collection("eventNotifications").doc(notificationId);
      if ((await ref.get()).exists) continue;
      const notification = {
        id: notificationId,
        eventId: eventRecord.id,
        title: `${label} vorher: ${eventRecord.title || "PROdigitalTV Veranstaltung"}`,
        shortText: `Erinnerung an ${eventRecord.title || "die PROdigitalTV Veranstaltung"} am ${eventRecord.date || ""}.`,
        includeMembers: false,
        includeContacts: true,
        registrationStatus: "registered",
        sendMode: "auto_before_event",
        offsetMinutes: minutes,
        status: "processing",
        createdBy: "system",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await ref.set(notification);
      await queueEventNotificationDelivery(notification, eventRecord);
    }
  }
});

exports.onRegistrationCreated = onDocumentCreated({ document: "registrations/{registrationId}", region }, async (event) => {
  const registration = event.data.data();
  if (registration.status !== "pending_email_confirmation") return;
  if (registration.confirmationMailQueuedAt && registration.confirmationTokenHash) return;
  const eventRecord = (await db.collection("events").doc(registration.eventId).get()).data();
  if (!eventRecord) {
    await event.data.ref.update({ status: "cancelled", internalNote: "Referenziertes Event nicht gefunden.", updatedAt: FieldValue.serverTimestamp() });
    return;
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  await event.data.ref.update({ eventTitle: eventRecord.title, eventDate: eventRecord.date, eventAccessType: eventRecord.accessType, confirmationTokenHash: tokenHash, confirmationExpiresAt: expiresAt, updatedAt: FieldValue.serverTimestamp() });
  await queueMail({
    type: "registration_confirmation",
    to: registration.email,
    subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title}`,
    template: "registration_confirmation",
    eventId: registration.eventId,
    registrationId: event.params.registrationId,
    confirmationUrl: registrationConfirmationUrl(token),
    tokenExpiresAt: expiresAt
  });
  await queueMail({
    type: "admin_notification",
    to: adminRegistrationMailTo(),
    subject: `Neue Anmeldung: ${eventRecord.title}`,
    template: "admin_notification",
    eventId: registration.eventId,
    registrationId: event.params.registrationId
  });
});

exports.onMembershipApplicationCreated = onDocumentCreated({ document: "membershipApplications/{applicationId}", region }, async (event) => {
  const application = event.data.data();
  if (application.status !== "new" || application.source !== "website") return;
  const applicationId = event.params.applicationId;
  await event.data.ref.update({
    mailStatus: "queued",
    updatedAt: FieldValue.serverTimestamp()
  });
  await queueMail({
    type: "membership_application_admin",
    to: "",
    replyTo: application.email,
    subject: `Neuer Mitgliedsantrag: ${application.company || application.email || applicationId}`,
    template: "membership_application_admin",
    membershipApplicationId: applicationId
  });
  await queueMail({
    type: "membership_application_received",
    to: application.email,
    subject: "Ihr Mitgliedsantrag bei PROdigitalTV",
    template: "membership_application_received",
    membershipApplicationId: applicationId
  });
});

exports.sendQueuedMail = onDocumentCreated({ document: "mailQueue/{mailId}", region, secrets: smtpSecrets }, async (event) => {
  const mail = event.data.data();
  if (mail.status !== "queued") return;
  try {
    const result = await sendQueuedMail({ id: event.params.mailId, ...mail });
    await event.data.ref.update({
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      providerMessageId: result.messageId || ""
    });
    const updateTarget = mail.registrationId
      ? db.collection("registrations").doc(mail.registrationId)
      : mail.membershipApplicationId
        ? db.collection("membershipApplications").doc(mail.membershipApplicationId)
        : null;
    if (updateTarget) {
      await updateTarget.set({
        mailStatus: "sent",
        lastMailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    await event.data.ref.update({
      status: "failed",
      error: error.message || "Mailversand fehlgeschlagen.",
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    const updateTarget = mail.registrationId
      ? db.collection("registrations").doc(mail.registrationId)
      : mail.membershipApplicationId
        ? db.collection("membershipApplications").doc(mail.membershipApplicationId)
        : null;
    if (updateTarget) {
      await updateTarget.set({
        mailStatus: "failed",
        mailError: error.message || "Mailversand fehlgeschlagen.",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
});

exports.sendRegistrationConfirmationMail = onCall({ region }, async (request) => {
  const { registrationId } = request.data || {};
  if (!registrationId) throw new HttpsError("invalid-argument", "registrationId fehlt.");
  const snapshot = await db.collection("registrations").doc(registrationId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Anmeldung nicht gefunden.");
  // The creation trigger queues the initial email; this endpoint is reserved for explicit app workflows.
  return { queued: true, registrationId };
});

exports.confirmRegistrationByToken = onCall({ region, invoker: "public" }, async (request) => {
  const token = request.data?.token;
  if (!token) throw new HttpsError("invalid-argument", "Token fehlt.");
  const result = await db.collection("registrations").where("confirmationTokenHash", "==", hashToken(token)).limit(1).get();
  if (result.empty) throw new HttpsError("not-found", "Bestaetigungslink ist ungueltig.");
  const document = result.docs[0];
  const registration = document.data();
  if (registration.confirmationExpiresAt.toMillis() < Date.now()) {
    await document.ref.update({ status: "expired", updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError("deadline-exceeded", "Bestaetigungslink ist abgelaufen.");
  }
  const ticketToken = randomBytes(32).toString("hex");
  const cancelToken = randomBytes(32).toString("hex");
  const ticketLink = registrationTicketUrl(ticketToken, registration.eventId);
  const cancelUrl = registrationCancelUrl(cancelToken);
  await document.ref.update({
    status: "confirmed", emailConfirmed: true, confirmedAt: FieldValue.serverTimestamp(),
    confirmationTokenHash: FieldValue.delete(),
    ticketTokenHash: hashToken(ticketToken),
    cancelTokenHash: hashToken(cancelToken),
    ticketIssuedAt: FieldValue.serverTimestamp(),
    cancelTokenIssuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await queueMail({
    type: "registration_confirmed", to: registration.email,
    subject: `Anmeldung bestaetigt: ${registration.eventTitle}`, template: "registration_confirmed",
    eventId: registration.eventId, registrationId: document.id,
    ticketLink, cancelUrl, eventCheckinUrl: eventCheckinUrl(registration.eventId)
  });
  return {
    confirmed: true,
    message: "Ihre Anmeldung wurde erfolgreich bestaetigt.",
    registrationId: document.id,
    eventId: registration.eventId || "",
    eventTitle: registration.eventTitle || "",
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    ticketToken,
    ticketLink,
    cancelUrl
  };
});

exports.linkTicketDeviceByToken = onCall({ region, invoker: "public" }, async (request) => {
  const token = request.data?.token;
  if (!token) throw new HttpsError("invalid-argument", "Ticket-Token fehlt.");
  const result = await db.collection("registrations").where("ticketTokenHash", "==", hashToken(token)).limit(1).get();
  if (result.empty) throw new HttpsError("not-found", "Ticket wurde nicht gefunden.");
  const document = result.docs[0];
  const registration = document.data();
  if (!["confirmed", "checked_in"].includes(String(registration.status || ""))) {
    throw new HttpsError("failed-precondition", "Diese Anmeldung ist noch nicht bestaetigt.");
  }
  await document.ref.update({
    ticketDeviceLinked: true,
    deviceLinkedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return {
    linked: true,
    registrationId: document.id,
    eventId: registration.eventId || "",
    eventTitle: registration.eventTitle || "",
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    ticketToken: token
  };
});

exports.checkInRegistrationByDevice = onCall({ region, invoker: "public" }, async (request) => {
  const { eventId, ticketToken } = request.data || {};
  if (!eventId || !ticketToken) throw new HttpsError("invalid-argument", "Event oder Ticket fehlt.");
  const result = await db.collection("registrations").where("ticketTokenHash", "==", hashToken(ticketToken)).limit(1).get();
  if (result.empty) throw new HttpsError("not-found", "Ticket wurde nicht gefunden.");
  const document = result.docs[0];
  const registration = document.data();
  if (registration.eventId !== eventId) throw new HttpsError("permission-denied", "Dieses Ticket gehoert nicht zu diesem Event.");
  if (!["confirmed", "checked_in"].includes(String(registration.status || ""))) {
    throw new HttpsError("failed-precondition", "Diese Anmeldung ist nicht bestaetigt.");
  }
  if (registration.status !== "checked_in") {
    await document.ref.update({
      status: "checked_in",
      checkedInAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  await db.collection("checkinScreenEvents").doc(eventId).set({
    eventId,
    registrationId: document.id,
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    company: registration.company || "",
    checkedInAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return {
    checkedIn: true,
    alreadyCheckedIn: registration.status === "checked_in",
    registrationId: document.id,
    eventId,
    eventTitle: registration.eventTitle || "",
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    company: registration.company || ""
  };
});

exports.validateRegistrationTicket = onCall({ region, invoker: "public" }, async (request) => {
  const { eventId, ticketToken } = request.data || {};
  if (!eventId || !ticketToken) throw new HttpsError("invalid-argument", "Event oder Ticket fehlt.");
  const result = await db.collection("registrations").where("ticketTokenHash", "==", hashToken(ticketToken)).limit(1).get();
  if (result.empty) return { valid: false, reason: "not_found", eventId };
  const document = result.docs[0];
  const registration = document.data();
  if (registration.eventId !== eventId) return { valid: false, reason: "wrong_event", eventId };
  const status = String(registration.status || "");
  const valid = ["confirmed", "checked_in"].includes(status);
  return {
    valid,
    reason: valid ? "" : status || "invalid_status",
    registrationId: document.id,
    eventId,
    eventTitle: registration.eventTitle || "",
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    company: registration.company || "",
    status
  };
});

exports.getEventCheckinScreenStatus = onCall({ region }, async (request) => {
  await requireEditor(request);
  const { eventId, after = "" } = request.data || {};
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  const snapshot = await db.collection("checkinScreenEvents").doc(eventId).get();
  if (!snapshot.exists) return { eventId, recent: false };
  const data = snapshot.data() || {};
  const checkedInAt = data.checkedInAt || data.updatedAt || null;
  const millis = checkedInAt?.toMillis?.() || 0;
  const checkedInAtIso = millis ? new Date(millis).toISOString() : "";
  const recent = Boolean(millis && Date.now() - millis < 60000 && checkedInAtIso !== after);
  return {
    eventId,
    recent,
    checkedInAt: checkedInAtIso,
    registrationId: recent ? data.registrationId || "" : "",
    firstName: recent ? data.firstName || "" : "",
    lastName: recent ? data.lastName || "" : "",
    company: recent ? data.company || "" : ""
  };
});

exports.cancelRegistrationByToken = onCall({ region, invoker: "public" }, async (request) => {
  const token = request.data?.token;
  if (!token) throw new HttpsError("invalid-argument", "Storno-Token fehlt.");
  const result = await db.collection("registrations").where("cancelTokenHash", "==", hashToken(token)).limit(1).get();
  if (result.empty) throw new HttpsError("not-found", "Storno-Link wurde nicht gefunden.");
  const document = result.docs[0];
  const registration = document.data();
  if (registration.status === "cancelled") {
    return { cancelled: true, alreadyCancelled: true, eventId: registration.eventId || "", eventTitle: registration.eventTitle || "" };
  }
  await document.ref.update({
    status: "cancelled",
    cancelledAt: FieldValue.serverTimestamp(),
    cancelTokenHash: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  });
  if (registration.eventId && registration.email) {
    await db.collection("registrationLocks").doc(registrationLockId(registration.eventId, registration.email)).set({
      status: "cancelled",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  try {
    const adminMail = adminRegistrationMailTo();
    if (adminMail) {
      await queueMail({
        type: "registration_cancelled",
        to: adminMail,
        subject: `Anmeldung storniert: ${registration.eventTitle || ""}`,
        text: `Eine Anmeldung wurde storniert.\n\nEvent: ${registration.eventTitle || ""}\nTeilnehmer: ${clean(registration.firstName)} ${clean(registration.lastName)}\nE-Mail: ${registration.email || ""}`,
        registrationId: document.id,
        eventId: registration.eventId || ""
      });
    }
  } catch (error) {
    console.warn("Admin cancellation mail could not be queued", error);
  }
  return { cancelled: true, eventId: registration.eventId || "", eventTitle: registration.eventTitle || "" };
});

exports.resendConfirmationMail = onCall({ region }, async (request) => {
  await requireEditor(request);
  const ref = db.collection("registrations").doc(request.data.registrationId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().emailConfirmed) throw new HttpsError("failed-precondition", "Keine offene Bestaetigung.");
  const token = randomBytes(32).toString("hex");
  const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  await ref.update({ confirmationTokenHash: hashToken(token), confirmationExpiresAt: expiresAt, updatedAt: FieldValue.serverTimestamp() });
  await queueMail({
    type: "registration_confirmation", to: snapshot.data().email,
    subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${snapshot.data().eventTitle}`,
    template: "registration_confirmation", registrationId: snapshot.id, eventId: snapshot.data().eventId,
    confirmationUrl: registrationConfirmationUrl(token), tokenExpiresAt: expiresAt
  });
  return { queued: true };
});

exports.notifyAdminAboutRegistration = onCall({ region }, async (request) => {
  await requireEditor(request);
  const registration = (await db.collection("registrations").doc(request.data.registrationId).get()).data();
  await queueMail({ type: "admin_notification", to: adminRegistrationMailTo(), subject: `Anmeldung: ${registration.eventTitle}`, template: "admin_notification", registrationId: request.data.registrationId, eventId: registration.eventId });
  return { queued: true };
});

exports.cleanupExpiredConfirmations = onSchedule({ schedule: "every day 03:00", region, timeZone: "Europe/Berlin" }, async () => {
  const expired = await db.collection("registrations")
    .where("status", "==", "pending_email_confirmation")
    .where("confirmationExpiresAt", "<", Timestamp.now()).get();
  const batch = db.batch();
  expired.forEach((document) => batch.update(document.ref, { status: "expired", updatedAt: FieldValue.serverTimestamp() }));
  await batch.commit();
});

const AI_EDITORIAL_TASK = "KI_Redaktion_Taeglicher_Beitrag";
const REQUIRED_PROMPT_TYPES = ["Endpruefung", "Keywords"];

async function aiEditorialSettings() {
  const snapshot = await db.collection("settings").doc("aiEditorial").get();
  return {
    automationEnabled: false,
    publicationMode: "draft_only",
    minimumSources: 1,
    minimumTrustScore: 70,
    scheduleLabel: "Taeglich 06:00 Uhr",
    allowAutoPublish: false,
    ...(snapshot.exists ? snapshot.data() : {})
  };
}

async function writeAiEditorialLog(payload) {
  const ref = await db.collection("ai_editorial_logs").add({
    article_id: payload.article_id || "",
    task_name: payload.task_name || AI_EDITORIAL_TASK,
    status: payload.status || "info",
    message: payload.message || "",
    found_topics_json: payload.found_topics_json || [],
    rejected_topics_json: payload.rejected_topics_json || [],
    used_sources_json: payload.used_sources_json || [],
    source_check_json: payload.source_check_json || {},
    duplicate_check_json: payload.duplicate_check_json || {},
    keyword_result_json: payload.keyword_result_json || {},
    ai_check_json: payload.ai_check_json || {},
    error_json: payload.error_json || {},
    created_at: FieldValue.serverTimestamp()
  });
  return ref.id;
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

async function activeEditorialPrompts() {
  const snapshot = await db.collection("ai_prompts").where("is_active", "==", true).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

async function trustedSources(minimumTrustScore) {
  const snapshot = await db.collection("verified_sources").get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((source) => {
      const status = normalizeStatus(source.source_status);
      return ["bevorzugt", "erlaubt"].includes(status) && Number(source.trust_score || 0) >= Number(minimumTrustScore || 70);
    });
}

async function recentAiArticleTitles() {
  const snapshot = await db.collection("editorialContent").where("page", "==", "news").limit(80).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

function chooseTopic(existingArticles = []) {
  const topics = [
    { title: "Barrierefreiheit in Streaming-Angeboten", category: "Barrierefreiheit", keywords: ["Barrierefreiheit", "Streaming", "Untertitel"] },
    { title: "HbbTV und Smart-TV-Strategien", category: "HbbTV", keywords: ["HbbTV", "Smart-TV", "Distribution"] },
    { title: "KI in Redaktion und Produktion", category: "KI / Produktion", keywords: ["KI", "Redaktion", "Produktion"] },
    { title: "FAST-Channels und digitale Distribution", category: "Distribution", keywords: ["FAST-Channels", "OTT", "Vermarktung"] },
    { title: "Musikrechte in digitalen Medienangeboten", category: "Musikrechte", keywords: ["GEMA", "Musikrechte", "Verwertungsrecht"] }
  ];
  const normalizedTitles = existingArticles.map((article) => normalizeStatus(article.title || article.headline));
  return topics.find((topic) => !normalizedTitles.some((title) => title.includes(normalizeStatus(topic.title).slice(0, 16)))) || topics[0];
}

exports.mediaAssetProxy = onRequest({ region, timeoutSeconds: 120, memory: "256MiB" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  const requestedPath = clean(req.query.path) || storagePathFromMediaUrl(req.query.url);
  const storagePath = String(requestedPath || "").replace(/^\/+/, "");
  if (!storagePath || !storagePath.startsWith("images/")) {
    res.status(400).send("Invalid media path");
    return;
  }
  try {
    const bucket = getStorage().bucket(storageBucket);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).send("Not Found");
      return;
    }
    const [metadata] = await file.getMetadata();
    if (metadata.contentType) res.set("Content-Type", metadata.contentType);
    res.set("Cache-Control", metadata.cacheControl || "public, max-age=3600");
    file.createReadStream()
      .on("error", (error) => {
        console.error("mediaAssetProxy stream failed", storagePath, error);
        if (!res.headersSent) res.status(502).send("Proxy stream failed");
        else res.end();
      })
      .pipe(res);
  } catch (error) {
    console.error("mediaAssetProxy failed", storagePath, error);
    res.status(500).send("Proxy failed");
  }
});

function topicMessageText(topic = {}, sources = []) {
  const primarySource = sources[0] || {};
  const sourceLabel = primarySource.name || primarySource.title || primarySource.domain || "Quelle";
  const sourceUrl = primarySource.url || "";
  const title = String(topic.title || "Themenmeldung").replace(/^Themenvorschlag:\s*/i, "").trim();
  const keywords = Array.isArray(topic.keywords) ? topic.keywords.filter(Boolean).join(", ") : "";
  return [
    `${title}`,
    keywords ? `Stichworte: ${keywords}.` : "",
    sourceUrl ? `Quelle: ${sourceLabel} (${sourceUrl})` : "Quelle bitte redaktionell pruefen."
  ].filter(Boolean).join("\n\n");
}

async function runAiEditorialPipeline({ manual = false, actor = "scheduler" } = {}) {
  const settings = await aiEditorialSettings();
  if (!manual && !settings.automationEnabled) {
    await writeAiEditorialLog({
      status: "skipped",
      message: "Automatisierung ist pausiert.",
      ai_check_json: { status: "nicht gestartet" }
    });
    return { ok: false, status: "skipped", message: "Automatisierung ist pausiert." };
  }

  const [prompts, sources, existingArticles] = await Promise.all([
    activeEditorialPrompts(),
    trustedSources(settings.minimumTrustScore),
    recentAiArticleTitles()
  ]);
  const missingPrompts = REQUIRED_PROMPT_TYPES.filter((type) => !prompts.some((prompt) => prompt.prompt_type === type));
  if (missingPrompts.length) {
    await writeAiEditorialLog({
      status: "warning",
      message: `Hinweis: aktive Prompts fehlen (${missingPrompts.join(", ")}). System-Fallback wird genutzt.`,
      ai_check_json: { status: "Hinweis", missingPrompts }
    });
  }

  const topic = chooseTopic(existingArticles);
  const duplicate = existingArticles.find((article) => normalizeStatus(article.title || article.headline).includes(normalizeStatus(topic.title).slice(0, 18)));

  const articleRef = db.collection("editorialContent").doc();
  const sourceSnapshot = sources.slice(0, 3).map((source) => ({
    title: source.name,
    publisher: source.name,
    domain: source.domain,
    url: source.url,
    source_type: source.source_type,
    trust_score: source.trust_score,
    check_status: "geprueft"
  }));
  const article = {
    title: topic.title,
    headline: topic.title,
    subtitle: sources.length ? `Quelle: ${sources[0].name || sources[0].domain || "Quelle"}` : "Quelle bitte redaktionell pruefen.",
    subline: sources.length ? `Quelle: ${sources[0].name || sources[0].domain || "Quelle"}` : "Quelle bitte redaktionell pruefen.",
    bodyText: topicMessageText(topic, sourceSnapshot),
    ai_original_suggested_text: topicMessageText(topic, sourceSnapshot),
    source_suggested_text: topicMessageText(topic, sourceSnapshot),
    page: "news",
    section: "news",
    category: topic.category,
    tags: topic.keywords,
    primary_keyword: topic.keywords[0],
    thumbnail_idea: "Serioeses redaktionelles Vorschaubild zur digitalen Medienwirtschaft.",
    thumbnail_prompt: "Professionelles redaktionelles Vorschaubild fuer ein Medienbranchen-Portal, klare moderne Komposition, TV-, Streaming- und Regulierungskontext, 16:9, keine Logos, keine realen Personen.",
    source_status: sources.length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen",
    duplicate_status: "nicht geprueft",
    ai_check_status: "vorbereitet",
    legal_check_status: "offen",
    publication_status: "Entwurf",
    status: "draft",
    visibility: "internal",
    relevance_score: 70,
    author_type: "ai",
    author_name: "KI-Redaktion",
    source_snapshot_json: sourceSnapshot,
    ai_log_json: { actor, rule: "editor_decides" },
    duplicate_check_json: { disabled: true },
    final_check_json: { status: "vorbereitet", blockers: [] },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await articleRef.set(article);
  const batch = db.batch();
  sourceSnapshot.forEach((source) => {
    const sourceRef = db.collection("article_sources").doc();
    batch.set(sourceRef, {
      article_id: articleRef.id,
      title: source.title,
      publisher: source.publisher,
      domain: source.domain,
      url: source.url,
      source_type: source.source_type,
      published_at: "",
      accessed_at: FieldValue.serverTimestamp(),
      relevance_note: "Quelle fuer redaktionelle Pruefung vorgeschlagen.",
      claim_reference: "Noch keine zentrale Aussage erzeugt.",
      trust_score: source.trust_score,
      check_status: "geprueft",
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });
  });
  topic.keywords.forEach((keyword, index) => {
    const keywordRef = db.collection("article_keywords").doc();
    batch.set(keywordRef, {
      article_id: articleRef.id,
      keyword,
      keyword_type: index === 0 ? "Hauptkeyword" : "Branchenkeyword",
      relevance_score: index === 0 ? 90 : 70,
      is_primary: index === 0,
      explanation: "Aus Themenauswahl abgeleitet; vor Veroeffentlichung redaktionell pruefen.",
      ai_generated: true,
      manually_confirmed: false,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  await writeAiEditorialLog({
    article_id: articleRef.id,
    status: "success",
    message: "KI-News als Entwurf erstellt.",
    found_topics_json: [topic],
    used_sources_json: sourceSnapshot,
    source_check_json: { source_status: sources.length ? "Quelle vorhanden" : "Quelle bitte redaktionell pruefen" },
    duplicate_check_json: { disabled: true },
    keyword_result_json: topic.keywords,
    ai_check_json: { status: "vorbereitet", publication_status: "Entwurf" }
  });
  return { ok: true, status: "success", articleId: articleRef.id, message: "KI-News als Entwurf erstellt." };
}

exports.runAiEditorialTask = onCall({ region, timeoutSeconds: 180 }, async (request) => {
  const profile = await requireEditor(request);
  return runAiEditorialPipeline({ manual: true, actor: profile.email || request.auth.uid });
});

function safeSlug(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function sourceNameFromUrl(value = "") {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceApprovedForBriefing(source = {}) {
  const status = normalizeStatus(source.source_status || source.review_status || source.check_status || "");
  return ["bevorzugt", "erlaubt"].includes(status);
}

function briefingSourceApproved(item = {}, sources = []) {
  const haystack = normalizeStatus([item.source, item.source_name, item.sourceName, item.source_domain, item.url, item.original_url].join(" "));
  return sources.find((source) => {
    if (!sourceApprovedForBriefing(source)) return false;
    return [source.id, source.name, source.title, source.domain, source.url].some((value) => {
      const key = normalizeStatus(value || "");
      return key && haystack.includes(key);
    });
  }) || null;
}

function briefingDuplicate(item = {}, existing = []) {
  const url = String(item.original_url || item.url || item.source_url || "").trim();
  const title = normalizeStatus(item.headline || item.title || "");
  return existing.find((candidate) => {
    const candidateUrl = String(candidate.original_url || candidate.url || candidate.source_url || "").trim();
    if (url && candidateUrl && url === candidateUrl) return true;
    const candidateTitle = normalizeStatus(candidate.headline || candidate.title || "");
    return title && candidateTitle && (candidateTitle.includes(title.slice(0, 38)) || title.includes(candidateTitle.slice(0, 38)));
  }) || null;
}

function briefingDateValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value.seconds) return new Date(Number(value.seconds) * 1000).toISOString();
  return "";
}

function briefingPublicationDate(item = {}) {
  return [
    item.source_publication_date,
    item.sourcePublicationDate,
    item.publication_date,
    item.publicationDate,
    item.published_at,
    item.publishedAt,
    item.published,
    item.date,
    item.first_seen,
    item.firstSeen,
    item.created_at,
    item.createdAt
  ].map(briefingDateValue).find(Boolean) || "";
}

function briefingDateAgeDays(dateValue = "", now = Date.now()) {
  const millis = Date.parse(String(dateValue || ""));
  if (!Number.isFinite(millis)) return null;
  return Math.max(0, Math.floor((now - millis) / 86400000));
}

function briefingThemeScore(item = {}) {
  const text = normalizeStatus([
    item.headline,
    item.title,
    item.summary,
    item.teaser,
    item.category,
    item.relevance,
    item.source,
    item.source_name,
    Array.isArray(item.keywords) ? item.keywords.join(" ") : ""
  ].join(" "));
  const groups = [
    { label: "KI, Arbeitsmarkt & Transformation", weight: 38, terms: ["ki", "ai", "kuenstliche intelligenz", "generative", "automation", "arbeitsplatz", "arbeitsplaetze", "jobabbau", "stellenabbau", "personalabbau", "skills", "weiterbildung"] },
    { label: "Streaming, OTT & Plattformen", weight: 34, terms: ["streaming", "ott", "video-on-demand", "vod", "plattform", "netflix", "youtube", "creator", "fast", "connected tv", "smart-tv"] },
    { label: "Medienregulierung & Medienpolitik", weight: 32, terms: ["regulierung", "medienpolitik", "gesetz", "verordnung", "urheberrecht", "lizenz", "medienrecht", "datenschutz", "eu", "bundestag", "aufsicht", "bundesnetzagentur", "medienanstalt", "kommission"] },
    { label: "Werbung, Vermarktung & Geschaeftsmodelle", weight: 28, terms: ["werbung", "vermarktung", "adtech", "umsatz", "abo", "subscription", "geschaeftsmodell", "revenue", "addressable", "marketing"] },
    { label: "Content, Produktion & Sportrechte", weight: 26, terms: ["content", "produktion", "format", "sportrechte", "rechte", "liga", "produktionstechnik", "studio", "creator economy"] },
    { label: "Distribution, CDN & TV-Technologie", weight: 24, terms: ["distribution", "cdn", "dvb-i", "hbbtv", "broadcast", "mediathek", "sender", "fernsehen", "technologie", "innovation"] },
    { label: "Kooperation, Uebernahme & Konsolidierung", weight: 22, terms: ["kooperation", "uebernahme", "fusion", "konsolidierung", "beteiligung", "partnerschaft", "joint venture", "allianz"] },
    { label: "Rechte, Musik & Kreativwirtschaft", weight: 18, terms: ["gema", "musik", "verwertung", "kreativwirtschaft", "kuenstler", "urheber"] }
  ];
  const match = groups
    .map((group) => ({ ...group, hits: group.terms.filter((term) => text.includes(term)).length }))
    .filter((group) => group.hits)
    .sort((a, b) => (b.weight + b.hits * 4) - (a.weight + a.hits * 4))[0];
  return match ? { label: match.label, score: match.weight + match.hits * 4 } : { label: "Medienwirtschaft", score: 8 };
}

function briefingSourcePriority(item = {}) {
  const text = normalizeStatus([item.source, item.source_name, item.original_url, item.url].join(" "));
  const preferred = [
    "dwdl",
    "meedia",
    "horizont",
    "kress",
    "turi2",
    "broadband tv news",
    "broadbandtvnews",
    "digitalfernsehen",
    "vaunet",
    "medienanstalt",
    "bundesnetzagentur",
    "eu-kommission",
    "ec.europa",
    "reuters"
  ];
  if (preferred.some((term) => text.includes(term))) return 18;
  if (/\.de|europa\.eu|europe|germany|deutschland|dach|vaunet|ard|zdf|rtl|prosieben|sat1/.test(text)) return 10;
  return 0;
}

function briefingBusinessImpactScore(item = {}) {
  const text = normalizeStatus([item.headline, item.summary, item.category, item.relevance, Array.isArray(item.keywords) ? item.keywords.join(" ") : ""].join(" "));
  const terms = ["umsatz", "werbung", "markt", "abo", "preis", "kosten", "investition", "strategie", "plattform", "rechte", "distribution", "arbeitsplatz", "jobabbau", "regulierung", "uebernahme", "kooperation"];
  return Math.min(30, terms.filter((term) => text.includes(term)).length * 5);
}

function briefingLooksLikeLandingPage(item = {}) {
  const title = normalizeStatus(item.headline || item.title || "");
  const url = normalizeStatus(item.original_url || item.url || item.source_url || "");
  const genericTitle = /^(presse|news|aktuelles|publikationen|newsletter|kontakt|termine|events|impressum|suche)$/.test(title);
  const genericUrl = /(newsletter|abonnieren|subscribe|kontakt|impressum|publikationen|press-?room|presseinformationen-abonnieren)/i.test(url);
  return genericTitle || genericUrl;
}

function enrichBriefingCandidate(item = {}) {
  const sourcePublicationDate = briefingPublicationDate(item);
  const sourceAgeDays = briefingDateAgeDays(sourcePublicationDate);
  const theme = briefingThemeScore(item);
  const freshnessScore = sourceAgeDays === null ? -20 : Math.max(0, 35 - sourceAgeDays * 5);
  const landingPenalty = briefingLooksLikeLandingPage(item) ? -80 : 0;
  const baseScore = Number(item.score || item.relevance_score || item.quality_score || item.industry_score || 0);
  const businessImpactScore = briefingBusinessImpactScore(item);
  const sourcePriorityScore = briefingSourcePriority(item);
  return {
    ...item,
    category: item.category && item.category !== "Morgenbriefing" ? item.category : theme.label,
    briefing_theme: theme.label,
    source_publication_date: sourcePublicationDate,
    source_age_days: sourceAgeDays,
    source_date_status: sourcePublicationDate ? "Quelle datiert" : "Datum fehlt",
    is_landing_page_candidate: briefingLooksLikeLandingPage(item),
    actuality_score: freshnessScore,
    business_impact_score: businessImpactScore,
    source_priority_score: sourcePriorityScore,
    score: Math.round(baseScore + theme.score + freshnessScore + businessImpactScore + sourcePriorityScore + landingPenalty)
  };
}

function briefingCandidateUsable(item = {}) {
  if (item.is_landing_page_candidate) return false;
  if (!item.source_publication_date) return false;
  if (Number.isFinite(item.source_age_days) && item.source_age_days > 7) return false;
  return true;
}

function germanWeekLabel(date = new Date()) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  const start = new Date(date);
  start.setDate(start.getDate() - 6);
  const format = (value) => value.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `KW ${String(week).padStart(2, "0")} / ${format(start)} bis ${format(date)}`;
}

function briefingArticleText(item = {}) {
  const summary = String(item.summary || item.teaser || "").replace(/\s+/g, " ").trim();
  const category = String(item.briefing_theme || item.category || "Medienwirtschaft").trim();
  const source = String(item.source || item.source_name || "Quelle").trim();
  const relevance = String(item.relevance || category).trim();
  const why = [
    `${summary}`,
    `Fuer die Medienwirtschaft ist die Entwicklung relevant, weil sie ${relevance.toLowerCase()} beruehrt und damit Entscheidungen von TV-, Streaming- und Medienunternehmen beeinflussen kann.`,
    `Besonders ins Gewicht fallen Aktualitaet, wirtschaftliche Wirkung und die strategische Bedeutung fuer Plattformen, Distribution, Inhalte oder Regulierung.`,
    `Die Meldung sollte redaktionell anhand der Originalquelle geprueft und bei Bedarf um weitere Stimmen oder Zahlen ergaenzt werden.`
  ].filter(Boolean).join(" ");
  return why.replace(/\s+/g, " ").trim().slice(0, 1400)
    || `Die Meldung von ${source} gehoert zu den relevanten Entwicklungen der deutschen oder europaeischen Medienwirtschaft.`;
}

function weeklyBriefingItemSummary(item = {}, index = 0) {
  const headline = String(item.headline || item.title || `Thema ${index + 1}`).trim();
  const summary = String(item.summary || item.teaser || "").replace(/\s+/g, " ").trim();
  const source = String(item.source || item.source_name || "Quelle offen").trim();
  const url = String(item.original_url || item.url || "").trim();
  const sourceLine = `${source}${url ? ` - ${url}` : ""}`;
  return [
    `**${index + 1}. ${headline}**`,
    "",
    "**Kurz-Teaser:**",
    summary,
    "",
    "**Branchen-News:**",
    briefingArticleText(item),
    "",
    `**Einordnung:** ${String(item.briefing_theme || item.category || "Medienwirtschaft")} - relevant fuer TV-, Streaming- und Medienunternehmen.`,
    "",
    `**Quelle:** ${sourceLine}`
  ].join("\n").trim();
}

function topicToBriefingItem(topic = {}, sources = [], existing = [], index = 0) {
  const sourceCandidate = Array.isArray(topic.source_candidates) ? topic.source_candidates[0] || {} : {};
  const sourceUrl = sourceCandidate.url || topic.source_url || topic.url || "";
  const sourceName = sourceCandidate.name || topic.source_names?.[0] || topic.source_name || sourceNameFromUrl(sourceUrl);
  const approvedSource = briefingSourceApproved({ ...topic, source: sourceName, original_url: sourceUrl }, sources);
  const duplicate = briefingDuplicate({ ...topic, original_url: sourceUrl }, existing);
  const headline = String(topic.headline || topic.title || "").trim();
  const id = `morning-item-${safeSlug([topic.id, headline].filter(Boolean).join("-")) || createHash("sha1").update(headline || String(index)).digest("hex").slice(0, 16)}`;
  return {
    id,
    workflow: "morning_briefing",
    content_type: "morning_news_item",
    headline,
    title: headline,
    summary: String(topic.subline || topic.teaser || topic.reason || "").trim(),
    relevance: String(topic.category || "").trim(),
    source: sourceName || approvedSource?.name || "",
    source_name: sourceName || approvedSource?.name || "",
    original_url: sourceUrl,
    first_seen: briefingDateValue(topic.first_seen || topic.firstSeen || topic.created_at || topic.createdAt) || new Date().toISOString(),
    source_publication_date: briefingPublicationDate({ ...topic, original_url: sourceUrl }),
    category: topic.category || "Morgenbriefing",
    score: Number(topic.relevance_score || topic.quality_score || topic.industry_score || 0),
    status: "Briefing",
    morning_status: "Briefing",
    source_type: approvedSource?.source_type || "verifizierte Quelle",
    is_regulator: /behoerde|bundestag|bundesnetzagentur|eu|parlament|zak|dlm|medienanstalt/i.test([approvedSource?.source_type, sourceName, topic.category].join(" ")),
    duplicate_of: "",
    keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
    topic_suggestion_id: topic.id || "",
    origin: "scheduled_morning_briefing",
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  };
}

function pressReleaseToBriefingItem(release = {}, sources = [], existing = [], index = 0) {
  const headline = String(release.title || "").trim();
  const sourceName = release.source_name || release.sourceName || release.source_domain || release.sourceDomain || sourceNameFromUrl(release.url || "");
  const approvedSource = briefingSourceApproved({ source: sourceName, original_url: release.url }, sources);
  const id = `morning-item-${safeSlug([release.id, headline].filter(Boolean).join("-")) || createHash("sha1").update(headline || String(index)).digest("hex").slice(0, 16)}`;
  return {
    id,
    workflow: "morning_briefing",
    content_type: "morning_news_item",
    headline,
    title: headline,
    summary: String(release.summary || release.full_text || "").replace(/\s+/g, " ").trim().slice(0, 360),
    relevance: release.category || "Presse / Branche",
    source: sourceName,
    source_name: sourceName,
    original_url: release.url || "",
    first_seen: briefingDateValue(release.first_seen || release.firstSeen || release.published_at || release.publishedAt || release.imported_at || release.importedAt) || new Date().toISOString(),
    source_publication_date: briefingPublicationDate(release),
    category: release.category || "Presse / Branche",
    score: approvedSource ? 72 : 45,
    status: "Briefing",
    morning_status: "Briefing",
    source_type: approvedSource?.source_type || "Pressebereich",
    is_regulator: false,
    duplicate_of: "",
    keywords: [],
    press_release_id: release.id || "",
    origin: "scheduled_morning_briefing",
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  };
}

function briefingItemSummary(item = {}, index = 0) {
  const headline = String(item.headline || item.title || `Meldung ${index + 1}`).trim();
  const summary = String(item.summary || item.teaser || "").replace(/\s+/g, " ").trim();
  const source = String(item.source || item.source_name || "Quelle offen").trim();
  const category = String(item.category || item.relevance || "Morgenbriefing").trim();
  const url = String(item.original_url || item.url || "").trim();
  return [
    `${index + 1}. ${headline}`,
    summary ? `Kurz: ${summary}` : "",
    `Quelle: ${source}${category ? ` | Rubrik: ${category}` : ""}${url ? ` | ${url}` : ""}`
  ].filter(Boolean).join("\n");
}

async function runMorningBriefingPipeline({ manual = false, actor = "scheduler" } = {}) {
  const settings = await aiEditorialSettings();
  if (!manual && !settings.automationEnabled) {
    await writeAiEditorialLog({
      task_name: "Morgenbriefing",
      status: "skipped",
      message: "Morgenbriefing pausiert, weil die KI-Redaktionsautomatik inaktiv ist.",
      ai_check_json: { status: "nicht gestartet" }
    });
    return { ok: false, status: "skipped", message: "Automatisierung ist pausiert." };
  }

  const [sources, articlesSnapshot, topicsSnapshot, pressSnapshot] = await Promise.all([
    trustedSources(settings.minimumTrustScore),
    db.collection("editorialContent").orderBy("updatedAt", "desc").limit(120).get().catch(() => db.collection("editorialContent").limit(120).get()),
    db.collection("ai_topic_suggestions").limit(160).get(),
    db.collection("ai_press_releases").limit(120).get().catch(() => ({ docs: [] }))
  ]);
  const existingArticles = articlesSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const existingTopics = topicsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const pressReleases = pressSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const sourcePool = sources.filter(sourceApprovedForBriefing);
  const rawCandidates = [
    ...existingTopics
      .filter((topic) => !["abgelehnt", "archiviert", "uebernommen"].includes(normalizeStatus(topic.status || topic.queue_status)))
      .map((topic, index) => topicToBriefingItem(topic, sourcePool, [...existingArticles, ...existingTopics], index)),
    ...pressReleases
      .filter((release) => !normalizeStatus(release.editorial_status || release.status).includes("dublette"))
      .map((release, index) => pressReleaseToBriefingItem(release, sourcePool, [...existingArticles, ...existingTopics], index))
  ].filter((item) => item.headline && item.summary)
    .map(enrichBriefingCandidate);
  const rejectedCandidates = rawCandidates.filter((item) => !briefingCandidateUsable(item));
  const candidates = rawCandidates
    .filter(briefingCandidateUsable)
    .sort((a, b) => {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff) return scoreDiff;
      return Date.parse(b.source_publication_date || b.first_seen || "") - Date.parse(a.source_publication_date || a.first_seen || "");
    })
    .slice(0, 10);

  if (!candidates.length) {
    await writeAiEditorialLog({
      task_name: "Morgenbriefing",
      status: "blocked",
      message: "Keine belegbaren Meldungen aus den letzten 7 Tagen fuer ein Branchen-News-Wochenbriefing vorhanden.",
      used_sources_json: sourcePool.slice(0, 20),
      ai_check_json: { status: "nicht bestanden", blockers: ["briefing_items_missing", "fresh_7_day_sources_missing"] }
    });
    return { ok: false, status: "blocked", message: "Keine belegbaren Meldungen aus den letzten 7 Tagen vorhanden." };
  }

  const batch = db.batch();
  candidates.forEach((item) => batch.set(db.collection("ai_topic_suggestions").doc(item.id), item, { merge: true }));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekLabel = germanWeekLabel(now);
  const briefingId = `branchen-news-woche-${safeSlug(weekLabel) || today}`;
  const shortText = `${candidates.length} aktuelle Themen der deutschen und europaeischen Medienwirtschaft aus freigegebenen Quellen der letzten 7 Tage.`;
  const topThree = candidates.slice(0, 3);
  const bodyText = [
    `### Branchen-News - Woche ${weekLabel}`,
    shortText,
    "",
    ...candidates.map((item, index) => weeklyBriefingItemSummary(item, index)),
    "",
    "**Die drei wichtigsten Themen der Woche**",
    "",
    ...topThree.map((item, index) => `${index + 1}. ${String(item.headline || item.title || "Thema").trim()} - ${String(item.briefing_theme || item.category || "Medienwirtschaft")} mit hoher Aktualitaet und Branchenrelevanz.`)
  ].join("\n\n").trim();
  batch.set(db.collection("editorialContent").doc(briefingId), {
    id: briefingId,
    title: `Branchen-News - Woche ${weekLabel}`,
    headline: `Branchen-News - Woche ${weekLabel}`,
    subtitle: shortText,
    subline: shortText,
    introText: shortText,
    shortText,
    teaserText: shortText,
    bodyText,
    page: "news",
    section: "news",
    key: `news.${briefingId}`,
    slug: briefingId,
    category: "Branchen-News",
    tags: ["Branchen-News", "Medienwirtschaft", "Streaming", "KI", "Regulierung", "TV"],
    source_snapshot_json: candidates.map((item) => ({
      title: item.source,
      headline: item.headline,
      url: item.original_url,
      check_status: item.status,
      source_type: item.source_type,
      source_publication_date: item.source_publication_date,
      briefing_theme: item.briefing_theme,
      score: item.score
    })),
    source_status: "Quelle vorhanden",
    duplicate_status: "nicht geprueft",
    ai_check_status: "vorbereitet",
    legal_check_status: "offen",
    publication_status: "Zusammenfassung",
    status: "draft",
    visibility: "internal",
    author_type: "ai",
    author_name: "KI-Redaktion",
    generation_origin: "weekly_industry_briefing",
    content_type: "weekly_industry_briefing",
    editorialType: "weekly_industry_briefing",
    ai_log_json: {
      workflow: "weekly_industry_briefing",
      actor,
      itemIds: candidates.map((item) => item.id),
      prompt_rules: {
        window_days: 7,
        topic_count: 10,
        market_focus: "deutsche und europaeische Medienwirtschaft",
        output: "Branchen-News mit Kurz-Teaser, Beitrag, Einordnung und Quelle"
      }
    },
    publishDate: today,
    validFrom: today,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();
  const logItems = candidates.map((item) => ({
    ...item,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  await writeAiEditorialLog({
    article_id: briefingId,
    task_name: "Morgenbriefing",
    status: "success",
    message: `${candidates.length} Branchen-News der Woche aus den letzten 7 Tagen vorbereitet.`,
    found_topics_json: logItems,
    rejected_topics_json: rejectedCandidates.slice(0, 30).map((item) => ({
      headline: item.headline,
      source: item.source,
      original_url: item.original_url,
      source_publication_date: item.source_publication_date,
      source_age_days: item.source_age_days,
      is_landing_page_candidate: item.is_landing_page_candidate,
      reason: item.is_landing_page_candidate ? "Landingpage/Serviceseite" : "Aelter als 7 Tage oder ohne belegbares Quelldatum"
    })),
    used_sources_json: sourcePool.slice(0, 20),
    duplicate_check_json: { disabled: true },
    ai_check_json: {
      status: "vorbereitet",
      publication_status: "Entwurf",
      editorial_brief: "10 wichtigste Themen der deutschen Medienwirtschaft, Quellen maximal 7 Tage alt",
      top_three: topThree.map((item) => item.headline || item.title || "")
    }
  });
  return { ok: true, status: "success", briefingId, items: candidates.length, message: `${candidates.length} Branchen-News der Woche vorbereitet.` };
}

exports.runMorningBriefingTask = onCall({ region, timeoutSeconds: 300 }, async (request) => {
  const profile = await requireEditor(request);
  return runMorningBriefingPipeline({ manual: true, actor: profile.email || request.auth.uid });
});

exports.saveAiEditorialSettings = onCall({ region }, async (request) => {
  const profile = await requireEditor(request);
  const data = request.data || {};
  const settings = {
    automationEnabled: Boolean(data.automationEnabled),
    publicationMode: ["draft_only", "review_release", "auto_publish"].includes(data.publicationMode) ? data.publicationMode : "draft_only",
    minimumSources: Math.max(1, Number(data.minimumSources || 1)),
    minimumTrustScore: Math.min(100, Math.max(0, Number(data.minimumTrustScore || 70))),
    scheduleLabel: data.scheduleLabel || "Taeglich 06:00 Uhr",
    allowAutoPublish: Boolean(data.allowAutoPublish),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: profile.email || request.auth.uid
  };
  await db.collection("settings").doc("aiEditorial").set(settings, { merge: true });
  return { saved: true, settings };
});

exports.KI_Redaktion_Taeglicher_Beitrag = onSchedule({ schedule: "every day 06:00", region, timeZone: "Europe/Berlin", timeoutSeconds: 180 }, async () => {
  await runAiEditorialPipeline({ manual: false, actor: "scheduler" });
});

exports.Morgenbriefing_Taeglich = onSchedule({ schedule: "every monday 06:15", region, timeZone: "Europe/Berlin", timeoutSeconds: 300 }, async () => {
  await runMorningBriefingPipeline({ manual: false, actor: "scheduler" });
});

/*
 * Mail delivery adapter:
 * A production installation should trigger on mailQueue documents with status
 * "queued", deliver through Postmark/Brevo/SendGrid and then write "sent" or
 * "failed". Credentials belong in Firebase Secret Manager, never in source.
 */
