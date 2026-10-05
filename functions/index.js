const { createHash, randomBytes, randomInt } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const { parsePhoneNumberFromString } = require("libphonenumber-js/mobile");
const { createPushService } = require("./pushService");
const { pollBounceMailbox } = require("./bounceService");
const { suppressDueMailingBounces } = require("./mailingSuppression");
const { confirmationReminderIsDue, confirmationReminderCanSend, confirmationSmsReminderIsDue } = require("./registrationConfirmationReminder");
const { guestEventLiveIsOpen } = require("./eventLiveDomain");
const { eventAgendaItem, eventAgendaItems } = require("./eventAgenda");
const { eligibleGuestCandidates, guestPasswordNeedsSetup, guestIdentityConflict } = require("./eventGuestLoginDomain");
const { createEventLiveMessages } = require("./eventLiveMessages");
const { eventLivePortrait, eventLiveCompanyLogo, eventLiveBoardRole, eventLiveBiography } = require("./eventLivePortraits");
const { createWelcomeSchedule } = require("./checkinWelcomeSchedule");
const { createAdminProfileUpdater } = require("./eventLiveAdminProfile");
const { createContactCardReader } = require("./eventLiveContactCard");
const { createEventChatNotifications, online: eventChatOnline } = require("./eventChatNotifications");

initializeApp();
const db = getFirestore();
const welcomeSchedule = createWelcomeSchedule({ db, FieldValue, Timestamp });
const pushService = createPushService({ db, messaging: getMessaging(), FieldValue, HttpsError });
const eventChatNotifications = createEventChatNotifications({ db, pushService, FieldValue, Timestamp, contactId, HttpsError });
const region = "europe-west3";
const storageBucket = "prodigitaltv-da47b.firebasestorage.app";
const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const MAIL_FROM = defineSecret("MAIL_FROM");
const MAIL_TO = defineSecret("MAIL_TO");
const smtpSecrets = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO];
const BOUNCE_IMAP_PASSWORD = defineSecret("BOUNCE_IMAP_PASSWORD");
const LINKEDIN_ACCESS_TOKEN = defineSecret("LINKEDIN_ACCESS_TOKEN");
const LINKEDIN_AUTHOR_URN = defineSecret("LINKEDIN_AUTHOR_URN");
const LINKEDIN_VERSION = defineSecret("LINKEDIN_VERSION");
const linkedinSecrets = [LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN, LINKEDIN_VERSION];
const SMS_API_URL = defineSecret("SMS_API_URL");
const SMS_API_TOKEN = defineSecret("SMS_API_TOKEN");
const SMS_SENDER = defineSecret("SMS_SENDER");
const smsSecrets = [SMS_API_URL, SMS_API_TOKEN, SMS_SENDER];
const PUBLIC_APP_BASE_URL = "https://prodigitaltv-da47b.web.app";
const PUBLIC_CHECKIN_HTML_URL = "https://prodigitaltv.de/checkin.html";
const PUBLIC_CONFIRMATION_BASE_URL = "https://prodigitaltv.de/confirm.html";
const transparentPixel = Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");

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
  if (payload.template === "checkin_agenda") return welcomeSchedule.schedule(payload);
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

function cleanSmsBody(value = "") {
  return clean(value)
    .replace(/(^|[\s([{"'“„])test(?=$|[\s.,;:!?)}\]"'”])/gi, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function normalizedMobileNumber(value = "", requireCountryPrefix = false) {
  const raw = clean(value);
  const candidate = requireCountryPrefix ? raw : raw.startsWith("00") ? `+${raw.slice(2)}` : /^49\d/.test(raw) ? `+${raw}` : raw;
  if (!/^\+[\d\s().-]+$/.test(candidate)) return "";
  const parsed = parsePhoneNumberFromString(candidate, { extract: false });
  return parsed?.isPossible() && parsed.isValid() && ["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(parsed.getType()) ? parsed.number : "";
}

function phoneNumber(value = "") {
  return normalizedMobileNumber(value);
}

function requiredRegistrationMobileNumber(value = "", label = "Mobilnummer") {
  if (!clean(value)) throw new HttpsError("invalid-argument", `Bitte ${label} angeben.`);
  const normalized = normalizedMobileNumber(value, true);
  if (!normalized) throw new HttpsError("invalid-argument", `${label}: Bitte Landesvorwahl und Ziffern prüfen (z. B. +49 170 1234567).`);
  return normalized;
}

function normalizedMemberPhones(member = {}) {
  const values = [member.phone, member.mobile, member.mobilePhone, member.contactPhone, member.primaryPhone];
  for (const key of ["phones", "additionalPhones", "contactPhones", "notificationPhones"]) {
    if (Array.isArray(member[key])) values.push(...member[key]);
  }
  for (const collection of [member.eventContacts, member.contacts]) {
    if (Array.isArray(collection)) collection.forEach((contact) => values.push(contact?.phone, contact?.mobile, contact?.mobilePhone));
  }
  return values.map(phoneNumber).filter(Boolean);
}

function cleanUsageValue(value = "", maxLength = 120) {
  return clean(value).replace(/[<>]/g, "").slice(0, maxLength);
}

exports.logUsageEvent = onCall({ region, invoker: "public" }, async (request) => {
  const input = request.data?.input || {};
  const type = cleanUsageValue(input.type || "page_view", 40);
  if (type !== "page_view") return { logged: false };
  const path = cleanUsageValue(input.path || "home", 80);
  if (!path || path === "cms") return { logged: false };
  const now = new Date();
  const sessionHash = input.sessionId ? hashToken(clean(input.sessionId)).slice(0, 24) : "";
  const eventId = `usage-${now.getTime()}-${randomBytes(6).toString("hex")}`;
  await db.collection("usageEvents").doc(eventId).set({
    id: eventId,
    type,
    path,
    routeId: cleanUsageValue(input.routeId || "", 160),
    section: cleanUsageValue(input.section || "", 80),
    route: cleanUsageValue(input.route || path, 220),
    hash: cleanUsageValue(input.hash || "", 220),
    pathname: cleanUsageValue(input.pathname || "", 160),
    viewport: ["mobile", "desktop"].includes(input.viewport) ? input.viewport : "unknown",
    sessionHash,
    day: now.toISOString().slice(0, 10),
    createdAtIso: now.toISOString(),
    createdAt: FieldValue.serverTimestamp()
  });
  return { logged: true };
});

function clientIp(request) {
  const headers = request.rawRequest?.headers || {};
  const forwarded = String(headers["x-forwarded-for"] || "").split(",").map((item) => item.trim()).filter(Boolean);
  return forwarded[0]
    || String(headers["fastly-client-ip"] || headers["x-real-ip"] || request.rawRequest?.ip || "").trim();
}

function requestIp(req) {
  const headers = req.headers || {};
  const forwarded = String(headers["x-forwarded-for"] || "").split(",").map((item) => item.trim()).filter(Boolean);
  return forwarded[0]
    || String(headers["fastly-client-ip"] || headers["x-real-ip"] || req.ip || "").trim();
}

exports.logPwaPrivacyConsent = onRequest({ region, invoker: "public" }, async (req, res) => {
  const origin = String(req.get("origin") || "");
  const allowedOrigin = origin === PUBLIC_APP_BASE_URL || /^http:\/\/localhost:\d+$/i.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/i.test(origin)
    ? origin
    : PUBLIC_APP_BASE_URL;
  res.set("Access-Control-Allow-Origin", allowedOrigin);
  res.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }
  try {
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const accepted = input.accepted === true;
    if (!accepted) {
      res.status(400).json({ ok: false, error: "consent_not_accepted" });
      return;
    }
    const now = new Date();
    const ipAddress = requestIp(req);
    const userAgent = cleanUsageValue(req.get("user-agent") || input.userAgent || "", 500);
    const consentId = `pwa-consent-${now.getTime()}-${randomBytes(6).toString("hex")}`;
    await db.collection("privacyConsents").doc(consentId).set({
      id: consentId,
      type: "pwa_homescreen_install",
      accepted: true,
      consentVersion: cleanUsageValue(input.consentVersion || "pwa-homescreen-v1", 80),
      legalTextKey: cleanUsageValue(input.legalTextKey || "pwa-local-storage-cache-ticket-token", 120),
      source: cleanUsageValue(input.source || "webapp_start_prompt", 80),
      path: cleanUsageValue(input.path || "", 220),
      pathname: cleanUsageValue(input.pathname || "", 160),
      userAgent,
      ipAddress,
      ipHash: ipAddress ? hashToken(ipAddress).slice(0, 32) : "",
      day: now.toISOString().slice(0, 10),
      acceptedAtIso: now.toISOString(),
      acceptedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    });
    res.status(200).json({ ok: true, consentId, acceptedAtIso: now.toISOString() });
  } catch (error) {
    console.error("logPwaPrivacyConsent failed", error);
    res.status(500).json({ ok: false, error: "consent_log_failed" });
  }
});

function eventRegistrationIsOpen(event = {}) {
  if (event.preStatus === "save_the_date" || ["inactive", "draft", "archived", "deleted", "hidden"].includes(clean(event.status).toLowerCase())) return false;
  return Boolean(event.registrationEnabled)
    || (event.accessType === "public" && event.allowPublicRegistration === true)
    || (event.accessType === "members_only" && event.allowMemberRegistration === true)
    || event.preStatus === "invitation_published"
    || event.lifecyclePhase === "registration_open";
}

function optionalLinkedInProfile(value) {
  const address = clean(value).slice(0, 300);
  if (!address) return "";
  let url;
  try { url = new URL(address); } catch {
    throw new HttpsError("invalid-argument", "Bitte eine gültige LinkedIn-Adresse eingeben.");
  }
  if (url.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(url.hostname.toLowerCase()) || url.pathname === "/") {
    throw new HttpsError("invalid-argument", "Bitte eine HTTPS-Adresse von linkedin.com eingeben.");
  }
  return url.href;
}

function registrationInput(data = {}) {
  const input = data.input || data.registration || {};
  const hasCompanion = Boolean(input.hasCompanion);
  const companionInput = input.companion || {};
  const companion = hasCompanion ? {
    firstName: stripTags(companionInput.firstName || input.companionFirstName),
    lastName: stripTags(companionInput.lastName || input.companionLastName),
    email: clean(companionInput.email || input.companionEmail).toLowerCase(),
    phone: stripTags(companionInput.phone || input.companionPhone),
    linkedIn: optionalLinkedInProfile(companionInput.linkedIn || input.companionLinkedIn)
  } : null;
  return {
    firstName: stripTags(input.firstName),
    lastName: stripTags(input.lastName),
    company: stripTags(input.company),
    position: stripTags(input.position),
    email: clean(input.email).toLowerCase(),
    phone: stripTags(input.phone),
    linkedIn: optionalLinkedInProfile(input.linkedIn),
    isMember: false,
    invitationCode: stripTags(input.invitationCode),
    message: stripTags(input.message),
    privacyAccepted: Boolean(input.privacyAccepted),
    photoVideoConsent: Boolean(input.photoVideoConsent),
    newsletterConsent: Boolean(input.newsletterConsent),
    notifyForThisEvent: Boolean(input.notifyForThisEvent),
    notifyFutureEvents: Boolean(input.notifyFutureEvents),
    pushTrackingConsent: Boolean(input.pushTrackingConsent),
    hasCompanion,
    companion,
    participantCount: hasCompanion ? 2 : 1
  };
}

function mailingExcludedEmails(record = {}) {
  return new Set((Array.isArray(record.mailingExcludedEmails) ? record.mailingExcludedEmails : [])
    .map((value) => clean(value).toLowerCase())
    .filter(Boolean));
}

function mailingEmailIsExcluded(record = {}, email = "") {
  return mailingExcludedEmails(record).has(clean(email).toLowerCase());
}

function normalizedMemberEmails(member = {}) {
  const values = [
    member.email,
    member.contactEmail,
    member.contact_email,
    member.primaryEmail,
    member.profileEmail,
    member.billingEmail,
    member.invoiceEmail
  ];
  ["emails", "additionalEmails", "alternateEmails", "contactEmails", "notificationEmails"].forEach((key) => {
    if (Array.isArray(member[key])) member[key].forEach((value) => values.push(value));
  });
  if (Array.isArray(member.eventContacts)) {
    member.eventContacts.forEach((contact) => values.push(contact?.email || contact?.contactEmail));
  }
  if (Array.isArray(member.contacts)) {
    member.contacts.forEach((contact) => values.push(contact?.email || contact?.contactEmail));
  }
  const excluded = mailingExcludedEmails(member);
  return [...new Set(values.map((value) => clean(value).toLowerCase()).filter((email) => email && !excluded.has(email)))];
}

function memberCanMatchRegistration(member = {}) {
  const status = clean(member.status || "active").toLowerCase();
  return !["archived", "cancelled", "deleted", "inactive"].includes(status);
}

function memberIsNotificationTestGroup(member = {}) {
  if (typeof member.notificationTestGroup === "boolean") return member.notificationTestGroup;
  return Boolean(member.notificationTestGroup || member.isNotificationTestGroup || member.testGroup || member.notificationTester);
}

function memberIsMailingEligible(member = {}) {
  return memberCanMatchRegistration(member)
    && !["inactive", "cancelled", "archived", "deleted"].includes(clean(member.membershipAccessStatus).toLowerCase());
}

function notificationPersonNames(person = {}, source = "contact") {
  const firstName = clean(person.firstName);
  const lastName = clean(person.lastName);
  if (firstName || lastName) return { firstName, lastName, displayName: clean(`${firstName} ${lastName}`) };
  const fullName = clean(person.displayName || person.contactName || person.profileContactName || (source === "member" ? "" : person.name))
    .replace(/^(?:Herr|Frau)\s+/i, "");
  if (!fullName || fullName.includes("@")) return { firstName: "", lastName: "", displayName: "" };
  const parts = fullName.split(/\s+/);
  return { firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : "", lastName: parts.at(-1), displayName: fullName };
}

function assertNotificationRecipientNames(notification = {}, targets = []) {
  const missing = targets.filter((target) => {
    const text = target.audienceType === "registered"
      ? notification.registeredText || notification.shortText
      : notification.invitationText || notification.shortText;
    const fields = [...String([text, notification.title, notification.smsText].filter(Boolean).join("\n")).matchAll(/\{\{(firstName|lastName|displayName)\}\}/g)].map((match) => match[1]);
    const names = notificationPersonNames(target);
    return fields.some((field) => !names[field]);
  });
  if (missing.length) throw new HttpsError("failed-precondition", `Versand gestoppt: Bei ${missing.length} Empfänger(n) fehlen Namensdaten für die persönliche Anrede: ${missing.slice(0, 10).map((target) => target.email || target.phone).join(", ")}. Bitte Vor- und Nachnamen im Adressbestand ergänzen und die Vorschau erneut prüfen.`);
}

async function notificationTestGroupTargets() {
  const saved = await db.collection("settings").doc("notificationTestGroup").get();
  let emails;
  if (saved.exists) {
    emails = saved.data().emails;
    if (!Array.isArray(emails)) throw new HttpsError("failed-precondition", "Testgruppe ist ungueltig. Bitte neu speichern.");
  } else {
    const members = await db.collection("members").get();
    emails = members.docs.map((doc) => doc.data())
      .filter((member) => memberIsMailingEligible(member) && memberIsNotificationTestGroup(member))
      .filter((member) => !member.notificationOptOut && !member.mailingDisabled && member.reminderConsent !== false)
      .flatMap(normalizedMemberEmails);
  }
  const unique = [...new Set(emails.map((email) => clean(email).toLowerCase()))];
  if (!unique.length || unique.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new HttpsError("failed-precondition", "Bitte mindestens eine gueltige Adresse in der Testgruppe speichern.");
  }
  const [contactsSnapshot, membersSnapshot] = await Promise.all([
    db.collection("contacts").get().catch(() => ({ docs: [] })),
    db.collection("members").get().catch(() => ({ docs: [] }))
  ]);
  const profiles = new Map();
  contactsSnapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const email = clean(data.email || data.contactEmail || data.primaryEmail).toLowerCase();
    if (email) profiles.set(email, data);
  });
  membersSnapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    normalizedMemberEmails(data).forEach((email) => {
      const existing = profiles.get(email);
      if (!existing) profiles.set(email, data);
      else if (!notificationPersonNames(existing).displayName) profiles.set(email, { ...data, ...existing, ...notificationPersonNames(data, "member") });
    });
  });
  return unique.map((email) => {
    const profile = profiles.get(email) || {};
    const mobile = phoneNumber(profile.mobile || profile.phone || profile.mobilePhone || profile.contactPhone);
    return { email, phone: mobile, mobile, source: "test_group", audienceType: "test", ...notificationPersonNames(profile, "member"), company: profile.company || profile.name || "" };
  });
}

async function notificationTestPersonTargets(emails = [], mobiles = []) {
  const [contactsSnapshot, membersSnapshot] = await Promise.all([
    db.collection("contacts").get().catch(() => ({ docs: [] })),
    db.collection("members").get().catch(() => ({ docs: [] }))
  ]);
  const profiles = new Map();
  contactsSnapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const email = clean(data.email || data.contactEmail || data.primaryEmail).toLowerCase();
    if (email) profiles.set(email, data);
  });
  membersSnapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    normalizedMemberEmails(data).forEach((email) => {
      const existing = profiles.get(email);
      if (!existing) profiles.set(email, data);
      else if (!notificationPersonNames(existing).displayName) profiles.set(email, { ...data, ...existing, ...notificationPersonNames(data, "member") });
    });
  });
  return emails.map((email, index) => {
    const profile = profiles.get(email) || {};
    const mobile = phoneNumber(mobiles[index] || profile.mobile || profile.phone || profile.mobilePhone || profile.contactPhone || profile.contactMobile);
    return { email, phone: mobile, mobile, audienceType: "test", ...notificationPersonNames(profile, "member"), company: profile.company || profile.name || "" };
  });
}

async function emailBelongsToMember(email = "") {
  const match = await findPersonByEmail(email);
  return Boolean(match.isMember);
}

async function findPersonByEmail(email = "") {
  const normalizedEmail = clean(email).toLowerCase();
  if (!normalizedEmail) return { matched: false, isMember: false };
  const [membersSnapshot, usersSnapshot, contactsSnapshot, speakersSnapshot] = await Promise.all([
    db.collection("members").get(),
    db.collection("users").where("email", "==", normalizedEmail).limit(5).get().catch(() => ({ docs: [] })),
    db.collection("contacts").where("email", "==", normalizedEmail).limit(5).get().catch(() => ({ docs: [] })),
    db.collection("speakers").where("email", "==", normalizedEmail).limit(5).get().catch(() => ({ docs: [] }))
  ]);
  const memberDocument = membersSnapshot.docs.find((document) => {
    const member = document.data() || {};
    return memberCanMatchRegistration(member) && normalizedMemberEmails(member).includes(normalizedEmail);
  });
  if (memberDocument) {
    const member = memberDocument.data() || {};
    return {
      matched: true,
      isMember: true,
      source: "member",
      memberId: memberDocument.id,
      displayName: compactNameParts(member) || member.name || normalizedEmail,
      company: member.name || member.company || member.title || ""
    };
  }
  const userDocument = usersSnapshot.docs.find((document) => {
    const user = document.data() || {};
    const status = clean(user.status || "active").toLowerCase();
    return !["inactive", "archived", "deleted", "disabled"].includes(status);
  });
  if (userDocument) {
    const user = userDocument.data() || {};
    const role = clean(user.role || "member").toLowerCase();
    return {
      matched: true,
      isMember: role === "member" || Boolean(clean(user.memberId)),
      source: "user",
      userId: userDocument.id,
      memberId: user.memberId || "",
      displayName: user.displayName || compactNameParts(user) || normalizedEmail,
      company: user.company || ""
    };
  }
  const contactDocument = contactsSnapshot.docs[0];
  if (contactDocument) {
    const contact = contactDocument.data() || {};
    return {
      matched: true,
      isMember: false,
      source: "contact",
      contactId: contactDocument.id,
      displayName: compactNameParts(contact) || normalizedEmail,
      company: contact.company || ""
    };
  }
  const speakerDocument = speakersSnapshot.docs[0];
  if (speakerDocument) {
    const speaker = speakerDocument.data() || {};
    return {
      matched: true,
      isMember: false,
      source: "speaker",
      speakerId: speakerDocument.id,
      displayName: compactNameParts(speaker) || normalizedEmail,
      company: speaker.company || ""
    };
  }
  return { matched: false, isMember: false };
}

function notificationExtraSpeakerEventIds(input = {}, eventId = "") {
  const primaryEventId = clean(eventId);
  const values = [
    ...(Array.isArray(input.extraSpeakerEventIds) ? input.extraSpeakerEventIds : []),
    input.extraSpeakerEventId
  ];
  return [...new Set(values.map(clean).filter(Boolean).filter((id) => id !== primaryEventId))].slice(0, 10);
}

async function validateOtherEventSpeakerSource(recipientGroup, eventId, sourceEventIds, notificationKind) {
  if (recipientGroup !== "other_event_speakers") return;
  if (notificationKind !== "event" || sourceEventIds.length !== 1) {
    throw new HttpsError("invalid-argument", "Bitte genau ein anderes Quell-Event fuer die Referenten auswaehlen.");
  }
  const source = await db.collection("events").doc(sourceEventIds[0]).get();
  if (!source.exists || ["deleted", "draft"].includes(clean(source.data().status).toLowerCase())) {
    throw new HttpsError("not-found", "Das Quell-Event der Referenten ist nicht verfuegbar.");
  }
}

function notificationRegisteredEmails(registrations = [], members = [], users = []) {
  const emails = new Set(registrations.map((item) => clean(item.email).toLowerCase()).filter(Boolean));
  const membersById = new Map(members.map((item) => [item.id, item]));
  const samePerson = (a, b) => {
    const first = clean(a.firstName).toLocaleLowerCase("de");
    const last = clean(a.lastName).toLocaleLowerCase("de");
    return first && last && first === clean(b.firstName).toLocaleLowerCase("de") && last === clean(b.lastName).toLocaleLowerCase("de");
  };
  for (const registration of registrations) {
    const linkedUsers = users.filter((user) => clean(user.email).toLowerCase() === clean(registration.email).toLowerCase()
      || (registration.userId && registration.userId === user.id));
    for (const user of linkedUsers) {
      const member = membersById.get(clean(user.memberId || user.memberProfileId));
      if (!member) continue;
      // A company can have several people: only expand addresses for this person.
      if (samePerson(registration, member)) {
        [member.email, member.contactEmail, member.contact_email, member.primaryEmail, member.profileEmail]
          .map((value) => clean(value).toLowerCase()).filter(Boolean).forEach((email) => emails.add(email));
      }
      for (const contact of [...(member.eventContacts || []), ...(member.contacts || [])]) {
        if (samePerson(registration, contact)) {
          const email = clean(contact.email || contact.contactEmail).toLowerCase();
          if (email) emails.add(email);
        }
      }
    }
  }
  return emails;
}

async function eventNotificationTargets(eventId = "", options = {}) {
  const hasEvent = Boolean(clean(eventId));
  const recipientGroup = clean(options.recipientGroup || "");
  // Test recipients never pass through the member/contact recipient expansion.
  if (recipientGroup === "test_group") return notificationTestGroupTargets();
  const includeRegistered = ["event_registered", "event_registered_speakers"].includes(recipientGroup) || options.includeRegistered === true;
  const includeSpeakers = ["event_speakers", "event_registered_speakers", "other_event_speakers"].includes(recipientGroup) || options.includeSpeakers === true;
  const includeMembers = ["members", "members_contacts", "test_group"].includes(recipientGroup) || options.includeMembers === true;
  const includeContacts = ["contacts", "members_contacts"].includes(recipientGroup) || options.includeContacts === true;
  const [membersSnapshot, usersSnapshot, contactsSnapshot, registrationsSnapshot, speakersSnapshot, topicsSnapshot] = await Promise.all([
    (includeMembers || hasEvent) ? db.collection("members").get() : Promise.resolve({ docs: [] }),
    (includeMembers || hasEvent) ? db.collection("users").get() : Promise.resolve({ docs: [] }),
    includeContacts ? db.collection("contacts").get() : Promise.resolve({ docs: [] }),
    hasEvent ? db.collection("registrations").where("eventId", "==", eventId).get() : Promise.resolve({ docs: [] }),
    includeSpeakers ? db.collection("speakers").get() : Promise.resolve({ docs: [] }),
    includeSpeakers ? db.collection("topics").get().catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] })
  ]);
  const activeRegistrations = registrationsSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter(registrationIsActive);
  const registeredEmails = notificationRegisteredEmails(activeRegistrations,
    membersSnapshot.docs.map((document) => ({ ...document.data(), id: document.id })),
    usersSnapshot.docs.map((document) => ({ ...document.data(), id: document.id })));
  const recipientMembers = includeMembers ? membersSnapshot.docs : [];
  const recipientUsers = includeMembers ? usersSnapshot.docs : [];
  const officialMemberEmails = new Set();
  const eligibleMemberIds = new Set();
  const eligibleMembersById = new Map();
  recipientMembers.forEach((document) => {
    const member = { id: document.id, ...document.data() };
    if (!memberIsMailingEligible(member)) return;
    eligibleMemberIds.add(member.id);
    eligibleMembersById.set(member.id, member);
    normalizedMemberEmails(member).forEach((email) => officialMemberEmails.add(email));
  });
  recipientUsers.forEach((document) => {
    const user = { id: document.id, ...document.data() };
    const status = clean(user.status || "active").toLowerCase();
    const role = clean(user.role || "member").toLowerCase();
    const email = clean(user.email).toLowerCase();
    if (!email || ["inactive", "archived", "deleted", "disabled"].includes(status)) return;
    if (!eligibleMemberIds.has(clean(user.memberId)) && !officialMemberEmails.has(email)) return;
    const linkedMember = eligibleMembersById.get(clean(user.memberId));
    if (mailingEmailIsExcluded(user, email) || mailingEmailIsExcluded(linkedMember, email)) return;
    officialMemberEmails.add(email);
  });
  const people = new Map();
  const addPerson = (email, person = {}, source = "contact", phones = []) => {
    const normalizedEmail = clean(email).toLowerCase();
    const normalizedPhones = [...new Set(phones.map(phoneNumber).filter(Boolean))];
    if ((!normalizedEmail || !normalizedEmail.includes("@")) && !normalizedPhones.length) return;
    const personKey = normalizedEmail || `phone:${normalizedPhones[0]}`;
    if (hasEvent && normalizedEmail && options.registrationStatus === "registered" && !registeredEmails.has(normalizedEmail)) return;
    if (hasEvent && normalizedEmail && options.registrationStatus === "unregistered" && registeredEmails.has(normalizedEmail)) return;
    const existing = people.get(personKey) || {};
    // Empty login fields must never erase an existing contact's name.
    const populatedPerson = Object.fromEntries(Object.entries(person).filter(([, value]) => value !== "" && value != null));
    const mergedPerson = { ...existing, ...populatedPerson };
    people.set(personKey, {
      ...mergedPerson,
      ...notificationPersonNames(mergedPerson, source),
      email: normalizedEmail || existing.email || "",
      phone: normalizedPhones[0] || existing.phone || "",
      phones: [...new Set([...(existing.phones || []), ...normalizedPhones])],
      source: existing.source === "member" ? "member" : source,
      audienceType: registeredEmails.has(normalizedEmail) ? "registered" : "unregistered"
    });
  };
  recipientMembers.forEach((document) => {
    const member = { id: document.id, ...document.data() };
    if (!memberIsMailingEligible(member)) return;
    if (member.notificationOptOut === true || member.mailingDisabled === true || member.reminderConsent === false) return;
    if (recipientGroup === "test_group" && !memberIsNotificationTestGroup(member)) return;
    normalizedMemberEmails(member).forEach((email) => addPerson(email, {
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      company: member.name || member.company || member.title || "",
      memberId: member.id
    }, "member", normalizedMemberPhones(member)));
  });
  recipientUsers.forEach((document) => {
    const user = { id: document.id, ...document.data() };
    const status = clean(user.status || "active").toLowerCase();
    const role = clean(user.role || "member").toLowerCase();
    const email = clean(user.email).toLowerCase();
    if (!email || ["inactive", "archived", "deleted", "disabled"].includes(status)) return;
    if (!eligibleMemberIds.has(clean(user.memberId)) && !officialMemberEmails.has(email)) return;
    const linkedMember = eligibleMembersById.get(clean(user.memberId));
    if (mailingEmailIsExcluded(user, email) || mailingEmailIsExcluded(linkedMember, email)) return;
    if (user.notificationOptOut === true || user.mailingDisabled === true || user.reminderConsent === false) return;
    addPerson(email, {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      displayName: user.displayName || "",
      company: user.company || "",
      memberId: user.memberId || "",
      userId: user.id
    }, "member", [user.phone, user.mobile, user.mobilePhone]);
  });
  contactsSnapshot.docs.forEach((document) => {
    const contact = { id: document.id, ...document.data() };
    if (["archived", "deleted", "inactive"].includes(clean(contact.status).toLowerCase())) return;
    if (contact.notificationOptOut === true || contact.mailingDisabled === true || contact.reminderConsent === false) return;
    const email = clean(contact.email).toLowerCase();
    if (officialMemberEmails.has(email)) return;
    addPerson(email, contact, "contact", [contact.phone, contact.mobile, contact.mobilePhone, contact.contactPhone]);
  });
  if (includeRegistered) {
    activeRegistrations.forEach((registration) => {
      if (registration.notificationOptOut === true || registration.mailingDisabled === true || registration.reminderConsent === false) return;
      addPerson(registration.email, {
        firstName: registration.firstName || "",
        lastName: registration.lastName || "",
        name: compactNameParts(registration),
        company: registration.company || "",
        registrationId: registration.id
      }, "registration", [registration.phone, registration.mobile, registration.mobilePhone]);
    });
  }
  if (includeSpeakers && hasEvent) {
    const sourceOnly = recipientGroup === "other_event_speakers";
    const speakerEventIds = sourceOnly
      ? notificationExtraSpeakerEventIds(options, eventId)
      : [...new Set([eventId, ...notificationExtraSpeakerEventIds(options, eventId)].map(clean).filter(Boolean))];
    const eventSpeakerIds = new Set();
    const eventTopicIds = new Set();
    const eventSnapshots = await Promise.all(speakerEventIds.map((id) => db.collection("events").doc(id).get().catch(() => null)));
    const primarySpeakerEventYear = clean(eventSnapshots[0]?.data?.().date || "").slice(0, 4);
    const allowedSpeakerEventIds = new Set();
    eventSnapshots.forEach((eventSnapshot, index) => {
      const record = eventSnapshot?.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : { id: speakerEventIds[index] };
      const recordYear = clean(record.date || "").slice(0, 4);
      if (!sourceOnly && record.id !== eventId && primarySpeakerEventYear && recordYear !== primarySpeakerEventYear) return;
      allowedSpeakerEventIds.add(record.id);
      [record.speakerId, ...(record.speakerIds || [])].filter(Boolean).forEach((id) => eventSpeakerIds.add(id));
      [record.topicId, ...(record.topicIds || [])].filter(Boolean).forEach((id) => eventTopicIds.add(id));
    });
    topicsSnapshot.docs.forEach((document) => {
      const topic = { id: document.id, ...document.data() };
      const linkedToEvent = eventTopicIds.has(topic.id)
        || (topic.eventIds || []).some((id) => allowedSpeakerEventIds.has(id))
        || allowedSpeakerEventIds.has(topic.eventId);
      if (!linkedToEvent) return;
      eventTopicIds.add(topic.id);
      [topic.speakerId, ...(topic.speakerIds || [])].filter(Boolean).forEach((id) => eventSpeakerIds.add(id));
    });
    speakersSnapshot.docs.forEach((document) => {
      const speaker = { id: document.id, ...document.data() };
      const status = clean(speaker.status || "published").toLowerCase();
      if (["archived", "deleted", "inactive"].includes(status)) return;
      const linkedToEvent = eventSpeakerIds.has(speaker.id)
        || (speaker.eventIds || []).some((id) => allowedSpeakerEventIds.has(id))
        || allowedSpeakerEventIds.has(speaker.eventId)
        || (speaker.topicIds || []).some((topicId) => eventTopicIds.has(topicId))
        || eventTopicIds.has(speaker.topicId);
      if (!linkedToEvent) return;
      const email = mailAddress(speaker.email || speaker.mail || speaker.contactEmail);
      if (!email || speaker.notificationOptOut === true || speaker.mailingDisabled === true || speaker.reminderConsent === false) return;
      addPerson(email, {
        firstName: speaker.firstName || "",
        lastName: speaker.lastName || "",
        name: compactNameParts(speaker),
        company: speaker.company || "",
        speakerId: speaker.id
      }, "speaker", [speaker.phone, speaker.mobile, speaker.mobilePhone, speaker.contactPhone]);
    });
  }
  return [...people.values()];
}

function eventNotificationSmsBody(notification = {}, eventRecord = {}, target = {}) {
  const defaultLink = notification.linkEnabled === false ? "" : clean(notification.link || eventUrl(eventRecord.id));
  const smsLink = eventRecord.id ? compactEventUrl(eventRecord.id) : defaultLink.replace(/[?&]v=\d+/, "");
  const rawBody = target.audienceType === "registered"
    ? notification.registeredText || notification.shortText
    : notification.invitationText || notification.shortText;
  let smsBody = renderTemplateText(notification.smsText || rawBody, {
    registration: {
      firstName: target.firstName || "",
      displayName: target.displayName || clean(`${target.firstName || ""} ${target.lastName || ""}`),
      lastName: target.lastName || "",
      company: target.company || "",
      email: target.email || "",
      eventTitle: eventRecord.title || ""
    },
    eventRecord,
    variables: { eventLink: smsLink, link: smsLink }
  });
  if (notification.smsLinkEnabled !== false && !String(notification.smsText || "").includes("{{link}}") && smsLink) smsBody += `\n${smsLink}`;
  return cleanSmsBody(smsBody).slice(0, 612);
}

function smsEstimateFingerprint(input = {}) {
  const values = {
    notificationKind: clean(input.notificationKind) === "member_message" ? "member_message" : "event",
    eventId: clean(input.eventId),
    recipientGroup: clean(input.recipientGroup),
    registrationStatus: clean(input.registrationStatus),
    channels: Array.isArray(input.channels) ? input.channels.map(clean).sort() : [],
    smsText: stripTags(input.smsText).slice(0, 612),
    smsLinkEnabled: input.smsLinkEnabled !== false && clean(input.smsLinkEnabled) !== "false",
    linkEnabled: input.linkEnabled !== false && clean(input.linkEnabled) !== "false",
    link: clean(input.link),
    testRecipients: clean(input.testRecipients),
    testRecipientMobiles: clean(input.testRecipientMobiles),
    extraSpeakerEventIds: notificationExtraSpeakerEventIds(input, clean(input.eventId)).sort()
  };
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}


async function assertNoHiddenTalkMentions(eventRecord = {}, message = {}) {
  const ids = [...new Set(eventRecord.topicIds || [])];
  if (!ids.length) return;
  const snapshots = await db.getAll(...ids.map((id) => db.collection("topics").doc(id)));
  const normalize = (value) => clean(value).replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").toLocaleLowerCase("de");
  const content = normalize([
    message.shortText, message.invitationText, message.registeredText, message.smsText
  ].filter(Boolean).join(" "));
  const hidden = snapshots.map((snapshot) => snapshot.exists ? snapshot.data() : null)
    .filter((topic) => topic && ["inactive", "archived", "draft", "deleted", "hidden", "invisible"].includes(clean(topic.status).toLowerCase()))
    .map((topic) => clean(topic.title || topic.headline))
    .filter((title) => title && content.includes(normalize(title)));
  if (hidden.length) throw new HttpsError("failed-precondition", `Ausgeblendeter Vortrag im Einladungstext: ${hidden.join(", ")}. Bitte Text anpassen.`);
}

async function queueEventNotificationDelivery(notification = {}, eventRecord = {}) {
  if (notification.notificationKind !== "member_message") await assertNoHiddenTalkMentions(eventRecord, notification);
  const explicitRecipients = Array.isArray(notification.testRecipients) ? notification.testRecipients : [];
  const targets = notification.recipientGroup === "test_group"
    ? await notificationTestGroupTargets()
    : explicitRecipients.length
    ? await notificationTestPersonTargets(explicitRecipients, notification.testRecipientMobiles || [])
    : await eventNotificationTargets(eventRecord.id, notification);
  assertNotificationRecipientNames(notification, targets);
  if (notification.notificationKind !== "member_message" && eventRecord.id && notification.testOnly !== true) {
    const inviteHashes = [...new Set(targets.map((target) => clean(target.email).toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).map((email) => hashToken(email)))];
    if (inviteHashes.length) {
      await db.collection("eventLiveAccess").doc(eventRecord.id).set({
        eventId: eventRecord.id,
        inviteEmailHashes: FieldValue.arrayUnion(...inviteHashes),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
  let queued = 0;
  let pushed = 0;
  let pushAttempted = 0;
  let pushFailed = 0;
  const pushErrors = [];
  const mailQueueIds = [];
  const smsQueueIds = [];
  const channels = Array.isArray(notification.channels) && notification.channels.length
    ? notification.channels
    : ["mail", "push"];
  let smsQueued = 0;
  for (const target of targets) {
    let cancelUrl = "";
    if (notification.allowRegistrationCancellation === true && target.audienceType === "registered" && target.registrationId) {
      const cancelToken = randomBytes(32).toString("hex");
      const cancelTokenHash = hashToken(cancelToken);
      await db.collection("registrations").doc(target.registrationId).set({
        cancelTokenHashes: FieldValue.arrayUnion(cancelTokenHash),
        cancelTokenIssuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      cancelUrl = registrationCancelUrl(cancelToken);
    }
    let link = notification.linkEnabled === false ? "" : clean(notification.link || eventUrl(eventRecord.id));
    let surveyInviteId = "";
    if (notification.linkEnabled !== false && notification.surveyId) {
      const surveyToken = randomBytes(18).toString("hex");
      const surveyTokenHash = hashToken(surveyToken);
      surveyInviteId = `live-survey-invite-${surveyTokenHash.slice(0, 40)}`;
      await db.collection("liveSurveyInvites").doc(surveyInviteId).set({
        id: surveyInviteId,
        surveyId: notification.surveyId,
        notificationId: notification.id || "",
        eventId: eventRecord.id || "",
        email: target.email || "",
        emailHash: target.email ? hashToken(clean(target.email).toLowerCase()).slice(0, 32) : "",
        personName: clean(`${target.firstName || ""} ${target.lastName || ""}`) || target.name || target.company || target.email || "",
        firstName: target.firstName || "",
        displayName: target.displayName || clean(`${target.firstName || ""} ${target.lastName || ""}`),
        lastName: target.lastName || "",
        company: target.company || "",
        audienceType: target.audienceType || "",
        status: "open",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      link = publicHashUrl(`survey/${encodeURIComponent(notification.surveyId)}?t=${encodeURIComponent(surveyToken)}`);
    }
    const rawBody = target.audienceType === "registered"
      ? notification.registeredText || notification.shortText
      : notification.invitationText || notification.shortText;
    const body = renderTemplateText(rawBody, {
      registration: {
        firstName: target.firstName || "",
        displayName: target.displayName || clean(`${target.firstName || ""} ${target.lastName || ""}`),
        lastName: target.lastName || "",
        company: target.company || "",
        email: target.email || "",
        eventTitle: eventRecord.title || ""
      },
      eventRecord,
      variables: { eventLink: link, link, cancelLink: cancelUrl, cancelUrl }
    });
    const renderedTitle = renderTemplateText(notification.title, {
      registration: {
        firstName: target.firstName || "",
        displayName: target.displayName || clean(`${target.firstName || ""} ${target.lastName || ""}`),
        lastName: target.lastName || "",
        company: target.company || "",
        email: target.email || "",
        eventTitle: eventRecord.title || ""
      },
      eventRecord,
      variables: { eventLink: link, link }
    });
    const smsBody = eventNotificationSmsBody(notification, eventRecord, target);
    if (channels.includes("push") && target.email) {
      const pushResult = await pushService.deliver(target.email, { title: renderedTitle || notification.title, body, eventId: eventRecord.id, id: notification.id, link });
      pushed += pushResult.sent;
      pushAttempted += pushResult.attempted;
      pushFailed += pushResult.failed;
      pushErrors.push(...pushResult.errors);
    }
    if (channels.includes("mail") && target.email) {
      const mailRef = await queueMail({
      type: "event_notification",
      template: "event_notification",
      to: target.email,
      eventId: eventRecord.id,
      notificationId: notification.id,
      surveyId: notification.surveyId || "",
      surveyInviteId,
      title: renderedTitle || notification.title,
      shortText: body,
      link,
      linkEnabled: notification.linkEnabled !== false,
      audienceType: target.audienceType,
      personName: clean(`${target.firstName || ""} ${target.lastName || ""}`) || target.company || "",
      firstName: target.firstName || "",
      displayName: target.displayName || clean(`${target.firstName || ""} ${target.lastName || ""}`),
      lastName: target.lastName || "",
      company: target.company || "",
      registrationId: target.registrationId || "",
      cancelUrl
      });
      mailQueueIds.push(mailRef.id);
      queued += 1;
    }
    if (channels.includes("sms") && target.phone) {
      const smsRef = await db.collection("smsQueue").add({
        type: "event_notification",
        to: target.phone,
        message: smsBody,
        eventId: eventRecord.id || "",
        notificationId: notification.id || "",
        smsCostEstimateId: notification.smsCostEstimateId || "",
        personName: clean(`${target.firstName || ""} ${target.lastName || ""}`) || target.company || "",
        status: "queued",
        queuedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      smsQueueIds.push(smsRef.id);
      smsQueued += 1;
    }
  }
  await db.collection("eventNotifications").doc(notification.id).set({
    status: "queued",
    testOnly: explicitRecipients.length > 0,
    targetCount: targets.length,
    queuedMailCount: queued,
    mailQueueIds: mailQueueIds.slice(0, 100),
    queuedSmsCount: smsQueued,
    smsQueueIds: smsQueueIds.slice(0, 100),
    pushedCount: pushed,
    pushAttemptedCount: pushAttempted,
    pushFailedCount: pushFailed,
    pushErrors: pushErrors.slice(0, 50),
    processedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { targetCount: targets.length, queuedMailCount: queued, mailQueueIds: mailQueueIds.slice(0, 100), queuedSmsCount: smsQueued, smsQueueIds: smsQueueIds.slice(0, 100), pushedCount: pushed, pushFailedCount: pushFailed };
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

function liveSurveyOptions(value = "") {
  const source = Array.isArray(value) ? value : clean(value).split(/\r?\n/);
  return source
    .map((item) => stripTags(typeof item === "string" ? item : item?.label || ""))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 12)
    .map((label, index) => ({ id: `option-${index + 1}`, label }));
}

function liveSurveyQuestions(value = []) {
  let source = value;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = []; }
  }
  if (!Array.isArray(source)) return [];
  return source.slice(0, 12).map((item, index) => {
    const type = ["single", "multiple", "text"].includes(clean(item?.type)) ? clean(item.type) : "single";
    const fallbackId = `question-${index + 1}`;
    const id = (clean(item?.id) || fallbackId).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || fallbackId;
    return {
      id,
      type,
      question: stripTags(item?.question || item?.label || "").slice(0, 500),
      required: item?.required !== false && clean(item?.required) !== "false",
      options: type === "text" ? [] : liveSurveyOptions(item?.options || [])
    };
  }).filter((item) => item.question);
}

function contactId(email = "") {
  return `contact-${createHash("sha256").update(clean(email).toLowerCase()).digest("hex").slice(0, 32)}`;
}

function compactNameParts(record = {}) {
  const explicit = clean(record.name || record.displayName || record.fullName);
  if (explicit) return explicit;
  return [record.firstName, record.lastName].map(clean).filter(Boolean).join(" ");
}

function contactWritePayload(person = {}, source = "manual", now = FieldValue.serverTimestamp()) {
  const email = clean(person.email || person.mail || person.contactEmail).toLowerCase();
  if (!email) return null;
  const firstName = clean(person.firstName);
  const lastName = clean(person.lastName);
  const name = compactNameParts({ ...person, firstName, lastName });
  const payload = {
    email,
    source,
    status: "active",
    notificationOptOutHash: notificationOptOutHash(email),
    updatedAt: now
  };
  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;
  if (name) payload.name = name;
  if (clean(person.company)) payload.company = clean(person.company);
  if (clean(person.position || person.role)) payload.position = clean(person.position || person.role);
  if (clean(person.phone || person.mobile)) payload.phone = clean(person.phone || person.mobile);
  if (clean(person.website || person.url)) payload.website = clean(person.website || person.url);
  if (clean(person.linkedIn)) payload.linkedIn = clean(person.linkedIn);
  return payload;
}

async function upsertMailingContact(person = {}, { source = "manual", eventId = "", eventIds = [], registrationId = "", speakerId = "", topicIds = [], reminderConsent = false, mailingDisabled = false } = {}, now = FieldValue.serverTimestamp()) {
  const payload = contactWritePayload(person, source, now);
  if (!payload?.email) return { created: false, email: "", contactId: "" };
  const ref = db.collection("contacts").doc(contactId(payload.email));
  const existing = await ref.get();
  const created = !existing.exists;
  const update = {
    id: ref.id,
    ...payload,
    source: existing.exists ? existing.data()?.source || source : source,
    reminderConsent: Boolean(reminderConsent || existing.data()?.reminderConsent || (created && source === "speaker")),
    ...(created && mailingDisabled ? { mailingDisabled: true } : {}),
    lastEventId: eventId || existing.data()?.lastEventId || "",
    lastRegistrationId: registrationId || existing.data()?.lastRegistrationId || "",
    lastSpeakerId: speakerId || existing.data()?.lastSpeakerId || "",
    createdAt: existing.exists ? existing.data()?.createdAt || now : now,
    updatedAt: now
  };
  const cleanEventIds = [...new Set([eventId, ...eventIds].map(clean).filter(Boolean))];
  if (cleanEventIds.length) update.eventIds = FieldValue.arrayUnion(...cleanEventIds);
  if (registrationId) update.registrationIds = FieldValue.arrayUnion(registrationId);
  if (speakerId) update.speakerIds = FieldValue.arrayUnion(speakerId);
  const cleanTopicIds = topicIds.map(clean).filter(Boolean);
  if (cleanTopicIds.length) update.topicIds = FieldValue.arrayUnion(...cleanTopicIds);
  await ref.set(update, { merge: true });
  return { created, email: payload.email, contactId: ref.id };
}

async function countNewMailingContactForEvent(eventId = "", source = "", contact = {}, now = FieldValue.serverTimestamp()) {
  const id = clean(eventId);
  if (!id) return;
  await db.collection("events").doc(id).set({
    newMailingContactsCount: FieldValue.increment(1),
    mailingContactsSyncedCount: FieldValue.increment(1),
    lastNewMailingContactAt: now,
    lastNewMailingContactEmail: clean(contact.email),
    lastNewMailingContactSource: clean(source)
  }, { merge: true });
}

async function upsertContactFromRegistration(registration = {}, eventRecord = {}, now = FieldValue.serverTimestamp()) {
  const email = clean(registration.email).toLowerCase();
  const existingPerson = await findPersonByEmail(email);
  if (existingPerson.matched) {
    if (registration.linkedIn) {
      await db.collection("contacts").doc(contactId(email)).set({
        email, linkedIn: registration.linkedIn, updatedAt: now
      }, { merge: true });
    }
    return {
      created: false,
      ignored: true,
      email,
      contactId: existingPerson.contactId || "",
      source: existingPerson.source || "existing_person"
    };
  }
  return upsertMailingContact(registration, {
    source: registration.source === "cms_admin" ? "cms_admin_registration" : "event_registration",
    eventId: eventRecord.id || registration.eventId || "",
    registrationId: registration.id || "",
    reminderConsent: Boolean(registration.notifyForThisEvent || registration.notifyFutureEvents)
  }, now);
}

async function upsertCompanionContact(registration = {}, eventRecord = {}, now = FieldValue.serverTimestamp()) {
  const companion = registration.companion || {};
  const email = clean(companion.email).toLowerCase();
  if (!email || email === clean(registration.email).toLowerCase()) return { created: false };
  const existingPerson = await findPersonByEmail(email);
  if (existingPerson.matched) {
    if (companion.linkedIn) {
      await db.collection("contacts").doc(contactId(email)).set({
        email, linkedIn: companion.linkedIn, updatedAt: now
      }, { merge: true });
    }
    return { created: false, email, source: existingPerson.source || "existing_person" };
  }
  return upsertMailingContact({ ...companion, email }, {
    source: "event_companion",
    eventId: eventRecord.id || registration.eventId || "",
    registrationId: registration.id || "",
    reminderConsent: false,
    mailingDisabled: true
  }, now);
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

function compactEventUrl(eventId = "") {
  return `${PUBLIC_APP_BASE_URL}/#/event/${encodeURIComponent(eventId)}`;
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
  return publicSpaRouteUrl(path);
}

function publicCheckinUrl(path) {
  return `${PUBLIC_CHECKIN_HTML_URL}?v=${Date.now()}#/${String(path || "").replace(/^\/+/, "")}`;
}

function registrationTicketUrl(token, eventId = "") {
  if (eventId) {
    return publicCheckinUrl(`event/${encodeURIComponent(eventId)}?ticket=${encodeURIComponent(token)}`);
  }
  return publicCheckinUrl(`ticket/link/${encodeURIComponent(token)}`);
}

function eventUsesHandyTicket(eventRecord = {}, registration = {}) {
  const values = [
    eventRecord.handyTicketEnabled,
    eventRecord.mobileTicketEnabled,
    eventRecord.ticketEnabled,
    eventRecord.enableHandyTicket,
    registration.handyTicketEnabled,
    registration.mobileTicketEnabled,
    registration.ticketEnabled
  ];
  return !values.some((value) => value === false || clean(value).toLowerCase() === "false" || clean(value).toLowerCase() === "off");
}

function registrationCancelUrl(token) {
  return publicHashUrl(`registration/cancel/${encodeURIComponent(token)}`);
}

function eventFeedbackUrl(token) {
  return `${PUBLIC_APP_BASE_URL}/feedback.html?v=${Date.now()}&token=${encodeURIComponent(token)}`;
}
function eventCheckinUrl(eventId) {
  return publicCheckinUrl(`event-checkin/${encodeURIComponent(eventId || "")}`);
}

function registrationLockId(eventId = "", email = "") {
  return `${clean(eventId)}-${hashToken(clean(email).toLowerCase()).slice(0, 40)}`;
}

function registrationBlocksNewBooking(registration = {}) {
  const status = clean(registration.status).toLowerCase();
  if (registration.deleted === true || registration.archived === true || registration.inactive === true) return false;
  return !["cancelled", "canceled", "expired", "deleted", "archived", "inactive", "removed", "storniert", "geloescht", "gelöscht"].includes(status);
}

async function blockingEventRegistrationByEmail(eventId = "", email = "") {
  const normalized = clean(email).toLowerCase();
  if (!eventId || !normalized) return null;
  const [direct, legacyCompanion] = await Promise.all([
    db.collection("registrations").where("eventId", "==", eventId).where("email", "==", normalized).limit(10).get(),
    db.collection("registrations").where("eventId", "==", eventId).where("companion.email", "==", normalized).limit(10).get().catch(() => ({ docs: [] }))
  ]);
  return [...direct.docs, ...legacyCompanion.docs]
    .map((document) => ({ id: document.id, ...document.data() }))
    .find(registrationBlocksNewBooking) || null;
}

function stripTags(value = "") {
  return clean(value).replace(/[<>]/g, "");
}

function escapeAttribute(value = "") {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mailOpenTrackingUrl(mailId = "") {
  const id = clean(mailId);
  return id ? `https://${region}-prodigitaltv-da47b.cloudfunctions.net/trackMailOpen?m=${encodeURIComponent(id)}` : "";
}

function eventMailClickTrackingUrl(mailId = "") {
  const id = clean(mailId);
  return id ? `https://${region}-prodigitaltv-da47b.cloudfunctions.net/trackEventMailClick?m=${encodeURIComponent(id)}` : "";
}
function appendMailTrackingPixel(html = "", mailId = "") {
  const url = mailOpenTrackingUrl(mailId);
  if (!url || !html) return html;
  const pixel = `<img src="${escapeAttribute(url)}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;opacity:0;border:0;margin:0;padding:0" aria-hidden="true">`;
  return html.includes("</body>") ? html.replace("</body>", `${pixel}</body>`) : `${html}${pixel}`;
}

function plainDate(value = "") {
  if (!value) return "dem Veranstaltungstermin";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function defaultGlobalEventRegistrationMailText(variant = "confirmation") {
  if (variant === "reminder") {
    return [
      "Guten Tag {{firstName}} {{lastName}},",
      "",
      "dies ist eine kurze Erinnerung an \"{{eventTitle}}\".",
      "",
      "Termin: {{eventDate}}",
      "Ort: {{eventLocation}}",
      "",
      "Falls Sie doch nicht teilnehmen koennen, nutzen Sie bitte den Button Teilnahme absagen, damit wir den Platz weitergeben und besser planen koennen.",
      "",
      "Viele Gruesse",
      "PROdigitalTV"
    ].join("\n");
  }
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

function defaultMemberLoginInvitationText() {
  return [
    "Guten Tag {{displayName}},",
    "",
    "fuer Sie wurde ein Zugang zum PROdigitalTV-System vorbereitet.",
    "",
    "Rolle: {{role}}",
    "Memberprofil: {{memberName}}",
    "",
    "Bitte legitimieren Sie sich ueber den folgenden Link und vergeben Sie Ihr persoenliches Passwort:",
    "{{invitationLink}}",
    "",
    "Der Link ist 12 Stunden gueltig. Falls er abgelaufen ist, kann jederzeit ein neuer Link angefordert werden.",
    "",
    "Viele Gruesse",
    "PROdigitalTV"
  ].join("\n");
}

function mailTemplateSettings(record = {}) {
  const value = record?.value && typeof record.value === "object" ? record.value : {};
  return {
    registrationConfirmation: record?.registrationConfirmation || value.registrationConfirmation || defaultGlobalEventRegistrationMailText("confirmation"),
    registrationWaitlist: record?.registrationWaitlist || value.registrationWaitlist || defaultGlobalEventRegistrationMailText("waitlist"),
    registrationReminder: record?.registrationReminder || value.registrationReminder || defaultGlobalEventRegistrationMailText("reminder"),
    memberLoginInvitation: record?.memberLoginInvitation || value.memberLoginInvitation || defaultMemberLoginInvitationText()
  };
}

function eventOnlineLabel(eventRecord = {}) {
  return eventRecord.onlineMeetingLabel || (eventRecord.isVirtualEvent ? "Zoom Meeting" : "");
}

function eventLocationMailText(eventRecord = {}) {
  if (eventRecord.isVirtualEvent) return [eventOnlineLabel(eventRecord), eventRecord.city].filter(Boolean).join(", ") || "online";
  return [eventRecord.locationName, eventRecord.city].filter(Boolean).join(", ") || "dem Veranstaltungsort";
}

function renderTemplateText(template = "", { registration = {}, eventRecord = {}, variables = {} } = {}) {
  const replacements = {
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    company: registration.company || "",
    email: registration.email || "",
    eventTitle: eventRecord.title || registration.eventTitle || "PROdigitalTV Event",
    eventDate: plainDate(eventRecord.date || registration.eventDate),
    eventLocation: eventLocationMailText(eventRecord),
    onlineMeetingLabel: eventOnlineLabel(eventRecord),
    zoomLink: variables.zoomLink || eventRecord.zoomLink || "",
    eventLink: variables.eventLink || variables.link || "",
    link: variables.link || variables.eventLink || "",
    confirmationLink: variables.confirmationLink || variables.confirmationUrl || "",
    confirmationUrl: variables.confirmationUrl || variables.confirmationLink || "",
    invitationLink: variables.invitationLink || variables.link || "",
    displayName: variables.displayName || registration.displayName || "",
    role: variables.role || registration.role || "",
    memberName: variables.memberName || registration.memberName || "",
    ticketLink: variables.ticketLink || "",
    cancelLink: variables.cancelLink || variables.cancelUrl || "",
    cancelUrl: variables.cancelUrl || variables.cancelLink || ""
  };
  return String(template || "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => clean(replacements[key] ?? ""));
}

function textToHtml(text = "") {
  return clean(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${paragraph.split(/\n/).map((line) => clean(line)).join("<br>")}</p>`)
    .join("");
}

function agendaLineText(item = {}) {
  const time = clean(item.time || item.startTime || item.startsAt || "");
  const person = clean(item.person || item.speaker || item.speakerName || item.presenter || "");
  const title = clean(item.title || item.topicTitle || item.label || item.type || "");
  const parts = [];
  if (time) parts.push(time);
  if (person && title && person !== title) parts.push(`${person}: ${title}`);
  else if (title) parts.push(title);
  else if (person) parts.push(person);
  return parts.join(" - ");
}

function eventAgendaMailText(eventRecord = {}) {
  const items = Array.isArray(eventRecord.scheduleItems) ? eventRecord.scheduleItems : [];
  const itemLines = items.map(agendaLineText).filter(Boolean);
  if (itemLines.length) return itemLines.join("\n");
  return clean(eventRecord.agendaText || eventRecord.scheduleText || eventRecord.agenda || eventRecord.programText || "");
}
function mailHtmlShell(title = "", body = "") {
  return `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#071b34"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;border:1px solid #dbe4f1;overflow:hidden"><tr><td style="padding:28px 30px"><div style="font-size:30px;font-weight:800;color:#e30613;margin-bottom:6px">PRO<span style="color:#e30613;font-weight:400">digital</span>TV</div><p style="margin:0 0 22px;color:#5f6b7c">Interessengemeinschaft Digitale Medien e.V.</p><h1 style="font-size:26px;line-height:1.25;margin:0 0 18px;color:#071b34">${title}</h1>${body}</td></tr></table></td></tr></table></body></html>`;
}

function mailButton(label = "", url = "") {
  if (!url) return "";
  return `<p style="margin:26px 0"><a href="${escapeAttribute(url)}" target="_blank" rel="noopener" style="display:inline-block;background:#e30613;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:15px 24px">${escapeAttribute(label)}</a></p>`;
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

  if (mail.template === "registration_confirmation_reminder") {
    const name = clean([registration.firstName, registration.lastName].filter(Boolean).join(" "));
    const title = clean(registration.eventTitle || eventRecord.title || "der PROdigitalTV-Veranstaltung");
    const greeting = name ? `Guten Tag ${name},` : "Guten Tag,";
    const text = [
      greeting,
      "",
      `vielen Dank für Ihre Anmeldung zu „${title}“. Wir freuen uns, dass Sie dabei sein möchten.`,
      "",
      "Für die verbindliche Teilnahme fehlt nur noch Ihre E-Mail-Bestätigung. Mit einem Klick ist alles erledigt:",
      mail.confirmationUrl || "",
      "",
      "Wir haben Ihren Bestätigungslink erneuert. Bitte verwenden Sie diesen neuen Link; er ist 48 Stunden gültig.",
      "Falls Sie Ihre Anmeldung inzwischen bestätigt haben, können Sie diese Nachricht einfach ignorieren.",
      "",
      "Wir freuen uns auf Sie!",
      "Ihr PROdigitalTV-Team"
    ].filter((line) => line !== null && line !== undefined).join("\n");
    return {
      subject: mail.subject || `Ihre Anmeldung zu ${title} – bitte kurz bestätigen`,
      text,
      html: mailHtmlShell("Ihre Anmeldung bestätigen", [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${escapeAttribute(greeting)}</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Vielen Dank für Ihre Anmeldung zu <strong>${escapeAttribute(title)}</strong>. Wir freuen uns, dass Sie dabei sein möchten.</p>`,
        '<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Für die verbindliche Teilnahme fehlt nur noch Ihre E-Mail-Bestätigung. Mit einem Klick ist alles erledigt:</p>',
        mailButton("Anmeldung bestätigen", mail.confirmationUrl),
        `<p style="font-size:14px;line-height:1.5;color:#5f6b7c">Wir haben Ihren Bestätigungslink erneuert. Bitte verwenden Sie diesen neuen Link; er ist 48 Stunden gültig.</p>`,
        `<p style="font-size:14px;line-height:1.5;color:#5f6b7c">Falls der Button nicht funktioniert: <a href="${escapeAttribute(mail.confirmationUrl || "")}" style="color:#0b3a66">Bestätigungslink öffnen</a></p>`,
        '<p style="font-size:14px;line-height:1.5;color:#5f6b7c">Falls Sie Ihre Anmeldung inzwischen bestätigt haben, können Sie diese Nachricht einfach ignorieren.</p>'
      ].join(""))
    };
  }

  if (mail.template === "registration_confirmation") {
    const baseTemplate = eventRecord.mailText || mailTemplates.registrationConfirmation || defaultGlobalEventRegistrationMailText("confirmation");
    const bodyText = renderTemplateText(baseTemplate, {
      registration,
      eventRecord,
      variables: { confirmationLink: mail.confirmationUrl, confirmationUrl: mail.confirmationUrl }
    });
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
    const eventLink = eventUrl(registration.eventId || eventRecord.id || mail.eventId || "");
    const ticketEnabled = mail.ticketEnabled !== false && eventUsesHandyTicket(eventRecord, registration);
    const ticketLink = clean(mail.ticketLink || "");
    const primaryLink = ticketEnabled && ticketLink ? ticketLink : eventLink;
    const primaryLabel = ticketEnabled && ticketLink ? "Handy-Ticket anzeigen" : "Zum Event";
    return {
      subject: mail.subject || `Anmeldung bestaetigt: ${registration.eventTitle || eventRecord.title || ""}`,
      text: [
        `Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},`,
        "",
        `Ihre Anmeldung${title ? ` fuer "${title}"` : ""} wurde bestaetigt.`,
        "",
        ticketEnabled ? "Oeffnen Sie den folgenden Link bitte einmal auf dem Smartphone. Dort wird Ihr persoenliches Handy-Ticket fuer den Einlass angezeigt und gespeichert." : "Fuer diese Veranstaltung ist kein Handy-Ticket erforderlich.",
        ticketEnabled ? "Wenn Sie die Bestaetigung bereits auf dem Handy geoeffnet haben, ist dieses Geraet schon vorbereitet." : "Ihre bestaetigte Anmeldung ist ausreichend; weitere Informationen erhalten Sie ueber die Veranstaltungskommunikation.",
        primaryLink ? `${primaryLabel}: ${primaryLink}` : "",
        mail.cancelUrl ? `Anmeldung stornieren: ${mail.cancelUrl}` : "",
        "",
        "Viele Gruesse",
        "PROdigitalTV"
      ].filter(Boolean).join("\n"),
      html: mailHtmlShell("Anmeldung bestaetigt", [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Ihre Anmeldung${title ? ` fuer <strong>${title}</strong>` : ""} wurde bestaetigt.</p>`,
        ticketEnabled
          ? `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Oeffnen Sie den folgenden Link bitte einmal auf dem Smartphone. Dort wird Ihr persoenliches Handy-Ticket fuer den Einlass angezeigt und gespeichert.</p><p style="font-size:17px;line-height:1.55;margin:0 0 14px">Wenn Sie die Bestaetigung bereits auf dem Handy geoeffnet haben, ist dieses Geraet schon vorbereitet.</p>`
          : `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Fuer diese Veranstaltung ist kein Handy-Ticket erforderlich.</p><p style="font-size:17px;line-height:1.55;margin:0 0 14px">Ihre bestaetigte Anmeldung ist ausreichend; weitere Informationen erhalten Sie ueber die Veranstaltungskommunikation.</p>`,
        mailButton(primaryLabel, primaryLink),
        mail.cancelUrl ? `<p style="font-size:14px;line-height:1.5;margin:18px 0 0"><a href="${mail.cancelUrl}" style="color:#0b3a66">Anmeldung stornieren</a></p>` : "",
        ticketEnabled && eventLink ? `<p style="font-size:14px;color:#5f6b7c;margin:18px 0 0">Eventdetails: <a href="${escapeAttribute(eventLink)}" style="color:#0b3a66">${escapeAttribute(eventLink)}</a></p>` : ""
      ].filter(Boolean).join(""))
    };
  }

  if (mail.template === "event_guest_password") {
    const name = clean(mail.displayName || "Gast");
    const password = clean(mail.temporaryPassword);
    const title = clean(registration.eventTitle || eventRecord.title || "PROdigitalTV Event");
    const loginUrl = `https://prodigitaltv.de/#/event-live/${encodeURIComponent(mail.eventId || registration.eventId || "")}`;
    const text = [
      `Guten Tag ${name},`, "",
      `für „${title}“ wurde Ihr persönlicher PROdigitalTV-Zugang vorbereitet.`,
      `Ihr einmaliges Startpasswort: ${password}`, "",
      `Öffnen Sie ${loginUrl} und melden Sie sich mit Ihrer E-Mail-Adresse und diesem Passwort an.`,
      "Danach legen Sie direkt ein eigenes Passwort fest. Ihr Konto bleibt für spätere Veranstaltungen bestehen.",
      "Dieses Startpasswort ist zwei Stunden gültig. Falls Sie es nicht angefordert haben, ignorieren Sie diese Nachricht."
    ].join("\n");
    return {
      subject: mail.subject || "Ihr einmaliges PROdigitalTV-Startpasswort",
      text,
      html: mailHtmlShell("Ihr persönlicher Zugang", [
        `<p>Guten Tag ${escapeAttribute(name)},</p>`,
        `<p>Für <strong>${escapeAttribute(title)}</strong> ist Ihr persönlicher Zugang vorbereitet.</p>`,
        `<p>Ihr einmaliges Startpasswort: <strong style="font-size:22px;letter-spacing:1px">${escapeAttribute(password)}</strong></p>`,
        "<p>Melden Sie sich damit an und legen Sie anschließend ein eigenes Passwort fest. Das Startpasswort ist zwei Stunden gültig.</p>",
        mailButton("Zum Event-Chat", loginUrl)
      ].join(""))
    };
  }

  if (mail.template === "checkin_agenda") {
    const title = registration.eventTitle || eventRecord.title || "PROdigitalTV Event";
    const eventLink = mail.eventAccessLink || "https://prodigitaltv.de/#/event-live/" + encodeURIComponent(registration.eventId || eventRecord.id || mail.eventId || "") + "?email=" + encodeURIComponent(mail.to || registration.email || "");
    const agendaText = eventAgendaMailText(eventRecord);
    const salutationName = clean(`${registration.firstName || ""} ${registration.lastName || ""}`);
    const salutation = salutationName ? `Guten Tag ${salutationName},` : "Guten Tag,";
    const text = [
      salutation,
      "",
      `willkommen bei ${title}. Schoen, dass Sie da sind.`,
      "",
      agendaText ? "Hier ist die Agenda fuer die Veranstaltung:" : "Die Agenda zur Veranstaltung wird vor Ort kommuniziert.",
      agendaText,
      "",
      eventLink ? `Zur Veranstaltung: ${eventLink}` : "",
      "",
      "Viele Gruesse",
      "PROdigitalTV"
    ].filter(Boolean).join("\n");
    return {
      subject: mail.subject || `Willkommen: ${title}`,
      text,
      html: mailHtmlShell("Willkommen zur Veranstaltung", [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${salutation}</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">willkommen bei <strong>${clean(title)}</strong>. Schoen, dass Sie da sind.</p>`,
        agendaText ? `<h2 style="font-size:20px;line-height:1.3;margin:24px 0 12px;color:#071b34">Agenda</h2>${textToHtml(agendaText)}` : `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Die Agenda zur Veranstaltung wird vor Ort kommuniziert.</p>`,
        mailButton("Zum Veranstaltungsbereich", eventLink)
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
    const destinationLink = mail.linkEnabled === false ? "" : clean(mail.link || eventUrl(mail.eventId || eventRecord.id || ""));
    const link = destinationLink && mail.id && !mail.surveyId ? eventMailClickTrackingUrl(mail.id) : destinationLink;
    const isSurveyMail = Boolean(clean(mail.surveyId));
    const cancelUrl = !isSurveyMail && mail.audienceType === "registered" ? clean(mail.cancelUrl) : "";
    const mailPerson = {
      firstName: mail.firstName || registration.firstName || "",
      lastName: mail.lastName || registration.lastName || "",
      company: mail.company || registration.company || "",
      email: mail.to || registration.email || "",
      eventTitle: eventRecord.title || registration.eventTitle || ""
    };
    const title = clean(renderTemplateText(mail.title || eventRecord.title || "PROdigitalTV Veranstaltung", {
      registration: mailPerson,
      eventRecord,
      variables: { eventLink: link, link }
    }));
    const body = clean(renderTemplateText(mail.shortText || mail.text || (isSurveyMail ? "Bitte nehmen Sie kurz an unserer Umfrage teil." : "Neue Informationen zu einer PROdigitalTV-Veranstaltung."), {
      registration: mailPerson,
      eventRecord,
      variables: { eventLink: link, link }
    }));
    const optOutUrl = notificationOptOutUrl(mail.to);
    const salutation = clean(mail.personName) ? `Guten Tag ${clean(mail.personName)},` : "Guten Tag,";
    const intro = isSurveyMail
      ? "Ihre Meinung ist uns wichtig."
      : mail.audienceType === "registered"
      ? "hier finden Sie Ihre Erinnerung mit den Veranstaltungsinformationen."
      : "wir moechten Sie auf diese Veranstaltung hinweisen.";
    const linkLabel = isSurveyMail ? "Zur Umfrage" : "Zur Veranstaltung";
    const text = [
      salutation,
      "",
      intro,
      "",
      title,
      body,
      "",
      link ? `${linkLabel}: ${link}` : "",
      cancelUrl ? `Falls Sie doch nicht teilnehmen koennen: ${cancelUrl}` : "",
      optOutUrl ? `Umfrage- und Veranstaltungshinweise abbestellen: ${optOutUrl}` : "",
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
        `${textToHtml(body)}`,
        mailButton(linkLabel, link),
        cancelUrl ? `<p style="font-size:15px;line-height:1.5;color:#5f6b7c;margin:24px 0 8px">Falls Sie doch nicht teilnehmen koennen, geben Sie den Platz bitte fuer andere Interessierte frei.</p><p style="margin:0 0 24px"><a href="${escapeAttribute(cancelUrl)}" target="_blank" rel="noopener" style="display:inline-block;background:#ffffff;color:#b00020;text-decoration:none;font-weight:800;border:2px solid #b00020;border-radius:999px;padding:13px 22px">Teilnahme absagen</a></p>` : "",
        optOutUrl ? `<p style="font-size:12px;line-height:1.5;color:#7a8493;margin:24px 0 0;border-top:1px solid #dbe4f1;padding-top:14px">Sie erhalten diese Nachricht, weil Sie PROdigitalTV-Veranstaltungs- und Umfragehinweise aktiviert haben. <a href="${optOutUrl}" style="color:#5f6b7c">Umfrage- und Veranstaltungshinweise abbestellen</a>.</p>` : ""
      ].filter(Boolean).join(""))
    };
  }


  if (mail.template === "event_feedback_invitation") {
    const title = clean(eventRecord.title || registration.eventTitle || mail.eventTitle || "PROdigitalTV Veranstaltung");
    const personName = clean(`${registration.firstName || mail.firstName || ""} ${registration.lastName || mail.lastName || ""}`) || clean(mail.personName || "");
    const salutation = personName ? `Guten Tag ${personName},` : "Guten Tag,";
    const link = clean(mail.feedbackUrl || mail.link || "");
    const intro = clean(mail.introText || "vielen Dank, dass Sie bei unserer Veranstaltung dabei waren. Ihre Rueckmeldung hilft uns, Themen, Formate und den konkreten Nutzen fuer Gaeste und Mitglieder weiterzuentwickeln.");
    const text = [
      salutation,
      "",
      intro,
      "",
      title ? `Veranstaltung: ${title}` : "",
      link ? `Feedback geben: ${link}` : "",
      "",
      "Die Rueckmeldung dauert nur wenige Minuten.",
      "",
      "Vielen Dank und viele Gruesse",
      "PROdigitalTV"
    ].filter(Boolean).join("\n");
    return {
      subject: mail.subject || `Ihre Rueckmeldung zu ${title}`,
      text,
      html: mailHtmlShell("Ihre Rueckmeldung ist wertvoll", [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${salutation}</p>`,
        textToHtml(intro),
        title ? `<p style="font-size:16px;line-height:1.55;margin:18px 0 8px"><strong>Veranstaltung:</strong> ${escapeAttribute(title)}</p>` : "",
        mailButton("Feedback geben", link),
        link ? `<p style="font-size:14px;line-height:1.5;color:#5f6b7c;margin:18px 0 0">Falls der Button nicht funktioniert, oeffnen Sie diesen Link:<br><a href="${escapeAttribute(link)}" target="_blank" rel="noopener" style="color:#0b3a66;text-decoration:underline;word-break:break-all">${escapeAttribute(link)}</a></p>` : ""
      ].filter(Boolean).join(""))
    };
  }
  if (mail.template === "speaker_approval") {
    const title = clean(mail.title || mail.subject || "Profil und Vortragsbeschreibung pruefen");
    const link = clean(mail.link || "");
    const speakerName = clean(mail.speakerName || mail.personName || "");
    const eventTitle = clean(mail.eventTitle || "PROdigitalTV Veranstaltung");
    const topicTitle = clean(mail.topicTitle || "Vortrag");
    const salutation = speakerName ? `Guten Tag ${speakerName},` : "Guten Tag,";
    const intro = clean(mail.introText || `bitte pruefen Sie Ihr Referentenprofil und die Vortragsbeschreibung fuer ${eventTitle}.`);
    const text = [
      salutation,
      "",
      intro,
      "",
      `Veranstaltung: ${eventTitle}`,
      `Vortrag: ${topicTitle}`,
      "",
      link ? `Prueflink: ${link}` : "",
      "",
      "Vielen Dank und viele Gruesse",
      "PROdigitalTV"
    ].filter(Boolean).join("\n");
    return {
      subject: mail.subject || title,
      text,
      html: mailHtmlShell(title, [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${salutation}</p>`,
        textToHtml(intro),
        `<p style="font-size:16px;line-height:1.55;margin:18px 0 8px"><strong>Veranstaltung:</strong> ${escapeAttribute(eventTitle)}<br><strong>Vortrag:</strong> ${escapeAttribute(topicTitle)}</p>`,
        mailButton("Profil und Vortragsbeschreibung pruefen", link),
        link ? `<p style="font-size:14px;line-height:1.5;color:#5f6b7c;margin:18px 0 0">Falls der Button nicht funktioniert, oeffnen Sie diesen Link:<br><a href="${escapeAttribute(link)}" target="_blank" rel="noopener" style="color:#0b3a66;text-decoration:underline;word-break:break-all">${escapeAttribute(link)}</a></p>` : ""
      ].filter(Boolean).join(""))
    };
  }
  if (mail.template === "speaker_approval_completed") {
    const speakerName = clean(mail.speakerName || mail.personName || "");
    const eventTitle = clean(mail.eventTitle || "PROdigitalTV Veranstaltung");
    const topicTitle = clean(mail.topicTitle || "Vortrag");
    const salutation = speakerName ? `Guten Tag ${speakerName},` : "Guten Tag,";
    const intro = "vielen Dank für Ihre Rückmeldung. Wir haben Ihre Änderungen am Referentenprofil und an der Vortragsbeschreibung übernommen und veröffentlichen die Angaben jetzt.";
    const closing = "Damit ist der Freigabevorgang abgeschlossen.";
    const text = [
      salutation,
      "",
      intro,
      "",
      `Veranstaltung: ${eventTitle}`,
      `Vortrag: ${topicTitle}`,
      "",
      closing,
      "",
      "Vielen Dank und viele Grüße",
      "PROdigitalTV"
    ].join("\n");
    return {
      subject: mail.subject || "Ihre Änderungen wurden übernommen",
      text,
      html: mailHtmlShell("Ihre Änderungen wurden übernommen", [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${salutation}</p>`,
        textToHtml(intro),
        `<p style="font-size:16px;line-height:1.55;margin:18px 0 8px"><strong>Veranstaltung:</strong> ${escapeAttribute(eventTitle)}<br><strong>Vortrag:</strong> ${escapeAttribute(topicTitle)}</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:20px 0 0"><strong>${closing}</strong></p>`
      ].join(""))
    };
  }
  if (mail.template === "member_communication") {
    const title = clean(mail.title || mail.subject || "Neue Mitglieder-Info von PROdigitalTV");
    const link = clean(mail.link || publicHashUrl(`portal/article/${encodeURIComponent(mail.articleId || mail.editorialContentId || "")}`));
    const personName = clean(mail.personName || `${mail.firstName || ""} ${mail.lastName || ""}`);
    const salutation = personName ? `Guten Tag ${personName},` : "Guten Tag,";
    const intro = clean(mail.introText || mail.shortText || mail.subtitle || "im Mitgliederbereich von PROdigitalTV gibt es eine neue Information fuer Sie.");
    const optOutUrl = notificationOptOutUrl(mail.to);
    const textBody = [
      salutation,
      "",
      intro,
      "",
      title,
      clean(mail.subtitle || ""),
      "",
      link ? `${clean(mail.linkLabel || "Beitrag im Mitgliederbereich oeffnen")}: ${link}` : "",
      optOutUrl ? `Veranstaltungs- und Mitgliederhinweise abbestellen: ${optOutUrl}` : "",
      "",
      "Viele Gruesse",
      "PROdigitalTV"
    ].filter(Boolean).join("\n");
    const imageUrl = clean(mail.imageUrl || mail.thumbnailUrl || mail.thumbnail_url || "");
    return {
      subject: mail.subject || title,
      text: textBody,
      html: mailHtmlShell(title, [
        imageUrl ? `<img src="${escapeAttribute(imageUrl)}" alt="" style="display:block;width:100%;max-width:580px;height:auto;border-radius:14px;margin:0 0 22px">` : "",
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${salutation}</p>`,
        textToHtml(intro),
        mail.subtitle ? `<p style="font-size:17px;line-height:1.55;margin:0 0 14px;color:#334155"><strong>${clean(mail.subtitle)}</strong></p>` : "",
        mailButton(clean(mail.linkLabel || "Beitrag im Mitgliederbereich oeffnen"), link),
        optOutUrl ? `<p style="font-size:12px;line-height:1.5;color:#7a8493;margin:24px 0 0;border-top:1px solid #dbe4f1;padding-top:14px">Sie erhalten diese Nachricht, weil Sie PROdigitalTV-Mitgliederhinweise aktiviert haben. <a href="${optOutUrl}" style="color:#5f6b7c">Hinweise abbestellen</a>.</p>` : ""
      ].filter(Boolean).join(""))
    };
  }

  if (mail.template === "member_login_invitation") {
    const baseTemplate = mail.mailText || mailTemplates.memberLoginInvitation || defaultMemberLoginInvitationText();
    const displayName = clean(mail.displayName || mail.personName || mail.to || "Guten Tag");
    const invitationLink = clean(mail.invitationLink || mail.link || "");
    const bodyText = renderTemplateText(baseTemplate, {
      registration: {
        displayName,
        role: mail.role || "member",
        memberName: mail.memberName || "",
        email: mail.to || ""
      },
      variables: {
        displayName,
        role: mail.role || "member",
        memberName: mail.memberName || "",
        invitationLink,
        link: invitationLink
      }
    });
    const htmlBodyText = invitationLink
      ? bodyText.replace(invitationLink, "").replace(/\n{3,}/g, "\n\n").trim()
      : bodyText;
    const safeInvitationLink = escapeAttribute(invitationLink);
    return {
      subject: mail.subject || "Ihr PROdigitalTV-Zugang",
      text: [
        bodyText,
        "",
        invitationLink ? `Zugangslink: ${invitationLink}` : ""
      ].filter(Boolean).join("\n"),
      html: mailHtmlShell("PROdigitalTV-Zugang aktivieren", [
        textToHtml(htmlBodyText),
        mailButton("Zugang aktivieren", invitationLink),
        invitationLink ? `<p style="font-size:14px;line-height:1.5;color:#5f6b7c;margin:18px 0 0">Falls der Button nicht funktioniert, oeffnen Sie diesen Link:<br><a href="${safeInvitationLink}" target="_blank" rel="noopener" style="color:#0b3a66;text-decoration:underline;word-break:break-all">${safeInvitationLink}</a></p>` : ""
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
  if (mail.template === "checkin_agenda") {
    const email = mailAddress(mail.to || context.registration?.email);
    const eventId = mail.eventId || context.registration?.eventId;
    const url = "https://prodigitaltv.de/#/event-live/" + encodeURIComponent(eventId) + "?email=" + encodeURIComponent(email);
    mail = { ...mail, eventAccessLink: url };
    try {
      mail.eventAccessLink = await getAuth().generateSignInWithEmailLink(email, { url, handleCodeInApp: true });
    } catch (error) {
      console.warn("Welcome email uses regular login; email-link sign-in unavailable", error.code);
    }
  }
  const rendered = renderMail(mail, context);
  const transporter = createTransporter();
  const from = mailAddress(MAIL_FROM.value());
  const to = mailAddress(mail.to || MAIL_TO.value());
  if (!from || !to) throw new Error("Absender oder Empfaenger fehlt.");
  const replyTo = mail.replyTo || context.membershipApplication?.email || context.registration?.email;
  return transporter.sendMail({
    from,
    to,
    envelope: { from: "bounce@prodigitaltv.de", to },
    messageId: `<pdtv-mail-${mail.id}@prodigitaltv.de>`,
    headers: { "X-PDTV-Mail-ID": mail.id },
    replyTo: replyTo ? mailAddress(replyTo) : undefined,
    subject: stripTags(rendered.subject),
    text: rendered.text,
    html: appendMailTrackingPixel(rendered.html, mail.id)
  });
}

function smsProviderCost(payload = {}, raw = "") {
  const entries = Array.isArray(payload.list) ? payload.list : Array.isArray(payload.messages) ? payload.messages : [];
  const entryPoints = entries.map((entry) => Number(entry?.points)).filter(Number.isFinite);
  const textParts = /^OK:/i.test(raw) ? raw.replace(/^OK:/i, "").split(":") : [];
  const textPoints = textParts.length > 1 ? Number(textParts[1]) : NaN;
  const points = entryPoints.length ? entryPoints.reduce((sum, value) => sum + value, 0) : textPoints;
  const partValues = entries.map((entry) => Number(entry?.parts || entry?.message_parts || entry?.messages || 1)).filter(Number.isFinite);
  const parts = partValues.length ? partValues.reduce((sum, value) => sum + value, 0) : 1;
  return {
    points: Number.isFinite(points) ? Number(points.toFixed(6)) : null,
    netEur: Number.isFinite(points) ? Number(points.toFixed(6)) : null,
    parts: Math.max(1, Math.round(parts)),
    currency: "EUR"
  };
}

function smsMessagePartCount(message = "") {
  const text = String(message || "");
  if (!text) return 0;
  const gsmBasic = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  const gsmExtended = "^{}\\[~]|\u20ac";
  let gsmUnits = 0;
  let unicodeUnits = 0;
  let isGsm = true;
  for (const character of Array.from(text)) {
    unicodeUnits += character.length;
    if (gsmBasic.includes(character)) gsmUnits += 1;
    else if (gsmExtended.includes(character)) gsmUnits += 2;
    else isGsm = false;
  }
  const units = isGsm ? gsmUnits : unicodeUnits;
  const singleLimit = isGsm ? 160 : 70;
  const joinedLimit = isGsm ? 153 : 67;
  return units <= singleLimit ? 1 : Math.ceil(units / joinedLimit);
}

async function currentSmsPrices() {
  const apiUrl = clean(SMS_API_URL.value()) || "https://api.smsapi.com/sms.do";
  const token = clean(SMS_API_TOKEN.value());
  if (!token) throw new Error("SMS-Dienst ist noch nicht konfiguriert.");
  const pricesUrl = new URL("/profile/prices?limit=ALL", apiUrl).toString();
  const response = await fetch(pricesUrl, { headers: { authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(`SMSAPI ${response.status}: ${clean(payload.message || payload.error || "Preisliste nicht verfuegbar.").slice(0, 300)}`);
  const prices = (Array.isArray(payload.collection) ? payload.collection : [])
    .filter((entry) => clean(entry.type).toLowerCase() === "sms" && clean(entry.price?.currency).toUpperCase() === "EUR")
    .map((entry) => ({ mcc: Number(entry.country?.mcc), amount: Number(entry.price?.amount) }))
    .filter((entry) => Number.isFinite(entry.amount) && entry.amount >= 0);
  if (!prices.length) throw new Error("SMSAPI hat keine EUR-SMS-Preise geliefert.");
  return prices;
}

function smsCountryMcc(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  const prefixes = [
    ["49", 262], ["43", 232], ["41", 228], ["44", 234], ["31", 204], ["32", 206],
    ["33", 208], ["39", 222], ["34", 214], ["45", 238], ["46", 240], ["47", 242],
    ["48", 260], ["420", 230], ["421", 231], ["352", 270], ["1", 310]
  ];
  return prefixes.find(([prefix]) => digits.startsWith(prefix))?.[1] || null;
}

function smsRateForPhone(phone = "", prices = []) {
  const mcc = smsCountryMcc(phone);
  const countryRates = mcc ? prices.filter((entry) => entry.mcc === mcc).map((entry) => entry.amount) : [];
  const candidates = countryRates.length ? countryRates : prices.map((entry) => entry.amount);
  return Math.max(...candidates);
}

async function sendQueuedSms(sms, options = {}) {
  const apiUrl = clean(SMS_API_URL.value()) || "https://api.smsapi.com/sms.do";
  const token = clean(SMS_API_TOKEN.value());
  const sender = clean(SMS_SENDER.value());
  if (!apiUrl || !token || !sender) throw new Error("SMS-Dienst ist noch nicht konfiguriert.");
  const params = new URLSearchParams({
    from: sender,
    to: sms.to,
    message: sms.message,
    format: "json",
    details: "1"
  });
  if (options.test === true) params.set("test", "1");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Bearer ${token}` },
    body: params.toString()
  });
  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}
  const errorText = clean(payload.error || payload.message || raw);
  if (!response.ok || /^ERROR:/i.test(raw) || payload.error) throw new Error(`SMSAPI ${response.status}: ${errorText.slice(0, 400)}`);
  const textMessageId = /^OK:/i.test(raw) ? raw.replace(/^OK:/i, "").split(":")[0] : "";
  const messageId = clean(payload.messageId || payload.id || payload.sid || payload.requestId || payload.request_id || payload.list?.[0]?.id || payload.messages?.[0]?.id || "")
    || textMessageId;
  const providerCost = smsProviderCost(payload, raw);
  return {
    messageId,
    response: raw.slice(0, 500),
    ...providerCost,
    parts: Math.max(providerCost.parts, smsMessagePartCount(sms.message))
  };
}

async function requireEditor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!["admin", "editor"].includes(profile?.role)) throw new HttpsError("permission-denied", "Keine CMS-Berechtigung.");
  return profile;
}

async function requireAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (profile?.role !== "admin") throw new HttpsError("permission-denied", "Nur Admins duerfen diese Funktion ausfuehren.");
  return profile;
}

function eventLiveContactRequestId(eventId, senderContactId, receiverContactId) {
  return createHash("sha256").update([eventId, senderContactId, receiverContactId].join("|")).digest("hex");
}

async function eventLiveInvitationEmails(eventId) {
  const [registrations, contacts, queue] = await Promise.all([
    db.collection("registrations").where("eventId", "==", eventId).get(),
    db.collection("contacts").get(),
    db.collection("mailQueue").where("eventId", "==", eventId).limit(1500).get().catch(() => ({ docs: [] }))
  ]);
  const emails = new Set();
  registrations.docs.forEach((doc) => {
    const record = doc.data() || {};
    if (clean(record.email)) emails.add(clean(record.email).toLowerCase());
  });
  contacts.docs.forEach((doc) => {
    const record = doc.data() || {};
    const linked = record.lastEventId === eventId
      || (Array.isArray(record.eventIds) && record.eventIds.includes(eventId));
    if (linked && clean(record.email)) emails.add(clean(record.email).toLowerCase());
  });
  queue.docs.forEach((doc) => {
    const record = doc.data() || {};
    if (record.status !== "sent" || !clean(record.to)) return;
    clean(record.to).split(/[;,]/).map((email) => clean(email).toLowerCase()).filter((email) => email.includes("@")).forEach((email) => emails.add(email));
  });
  return [...emails].filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

async function eventLiveInvited(eventId, email) {
  const normalizedEmail = clean(email).toLowerCase();
  if (!eventId || !normalizedEmail) return false;
  const [accessSnapshot, registration, companionRegistration, contact] = await Promise.all([
    db.collection("eventLiveAccess").doc(eventId).get(),
    db.collection("registrations").where("eventId", "==", eventId).where("email", "==", normalizedEmail).limit(1).get().catch(() => ({ empty: true })),
    db.collection("registrations").where("eventId", "==", eventId).where("companion.email", "==", normalizedEmail).limit(1).get().catch(() => ({ empty: true })),
    db.collection("contacts").doc(contactId(normalizedEmail)).get().catch(() => null)
  ]);
  if (!accessSnapshot.exists || accessSnapshot.data()?.enabled !== true) return false;
  const hashAllowed = (accessSnapshot.data()?.inviteEmailHashes || []).includes(hashToken(normalizedEmail));
  const registrationAllowed = [registration, companionRegistration].some((result) => !result.empty && !["cancelled", "deleted", "expired"].includes(clean(result.docs[0]?.data()?.status).toLowerCase()));
  const contactData = contact?.exists ? contact.data() || {} : {};
  const contactAllowed = contactData.lastEventId === eventId || (Array.isArray(contactData.eventIds) && contactData.eventIds.includes(eventId));
  return hashAllowed || registrationAllowed || contactAllowed;
}

async function eventLiveUser(request, eventId, { requireAttendance = false } = {}) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Bitte zuerst anmelden.");
  const uid = request.auth.uid;
  const email = clean(request.auth.token.email).toLowerCase();
  if (!email || request.auth.token.email_verified !== true) throw new HttpsError("permission-denied", "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.");
  let [eventSnapshot, profileSnapshot] = await Promise.all([
    db.collection("events").doc(eventId).get(),
    db.collection("users").doc(uid).get()
  ]);
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Veranstaltung wurde nicht gefunden.");
  const event = { id: eventId, ...eventSnapshot.data() };
  const accessSnapshot = await db.collection("eventLiveAccess").doc(eventId).get();
  if (!event.eventLiveEnabled || !accessSnapshot.exists || accessSnapshot.data()?.enabled !== true) {
    throw new HttpsError("failed-precondition", "Event Live ist derzeit nicht verfügbar.");
  }
  const memberMatchCheckedAt = profileSnapshot.data()?.memberMatchCheckedAt?.toMillis?.() || 0;
  if (!clean(profileSnapshot.data()?.memberId) && Date.now() - memberMatchCheckedAt > 24 * 60 * 60 * 1000) {
    const memberMatch = await findPersonByEmail(email);
    if (memberMatch.isMember && memberMatch.memberId) {
      await linkConfirmedMemberAccount({
        email, firstName: clean(profileSnapshot.data()?.firstName),
        lastName: clean(profileSnapshot.data()?.lastName),
        isMember: true, matchedMemberId: memberMatch.memberId
      });
    } else {
      await db.collection("users").doc(uid).set({ memberMatchCheckedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    profileSnapshot = await db.collection("users").doc(uid).get();
  }
  const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
  if (profile.guestPasswordTemporary === true) {
    throw new HttpsError("failed-precondition", "Bitte legen Sie zuerst ein eigenes Passwort fest.");
  }
  const role = clean(profile.role || request.auth.token.role).toLowerCase();
  const isAdmin = ["admin", "administrator", "owner", "editor", "redakteur", "redaktion"].includes(role);
  let member = null;
  if ((isAdmin || ["member", "mitglied"].includes(role)) && clean(profile.memberId)) {
    const memberSnapshot = await db.collection("members").doc(clean(profile.memberId)).get();
    const value = memberSnapshot.exists ? memberSnapshot.data() || {} : {};
    const endedMembership = ["inactive", "cancelled"].includes(clean(value.membershipAccessStatus).toLowerCase());
    const effectiveAt = value.membershipAccessEffectiveAt?.toMillis?.() ?? (value.membershipAccessEffectiveAt ? new Date(value.membershipAccessEffectiveAt).getTime() : 0);
    const accessBlocked = endedMembership && (!effectiveAt || effectiveAt <= Date.now());
    const inactive = ["inactive", "deleted", "archived"].includes(clean(value.status).toLowerCase()) || accessBlocked;
    if (!inactive) member = { id: memberSnapshot.id, ...value };
  }
  const isMember = Boolean(member);
  if (!isAdmin && !isMember) {
    if (!await eventLiveInvited(eventId, email)) throw new HttpsError("permission-denied", "Diese E-Mail-Adresse ist für Event Live nicht freigeschaltet.");
    if (!guestEventLiveIsOpen(event)) throw new HttpsError("failed-precondition", "Event Live ist derzeit nicht verfügbar.");
  }
  if (requireAttendance && !isAdmin && !isMember) {
    const checked = await db.collection("registrations").where("eventId", "==", eventId).where("email", "==", email).limit(5).get();
    const companionChecked = await db.collection("registrations").where("eventId", "==", eventId).where("companion.email", "==", email).limit(5).get();
    if (![...checked.docs, ...companionChecked.docs].some((doc) => doc.data()?.status === "checked_in" && doc.data()?.checkedInEventId === eventId)) {
      throw new HttpsError("permission-denied", "Für Kontaktanfragen müssen Sie bei diesem Event eingecheckt sein.");
    }
  }
  const currentContactId = contactId(email);
  if (!profileSnapshot.exists) {
    await db.collection("users").doc(uid).set({
      email, role: "guest", status: "active", contactId: currentContactId,
      displayName: request.auth.token.name || email.split("@")[0],
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  return { uid, email, role: isAdmin ? "admin" : isMember ? "member" : "guest", isAdmin, isMember, member, contactId: currentContactId, event };
}

function eventLivePublicPerson(contact = {}, registration = {}, member = null, self = false) {
  const firstName = clean(contact.firstName || registration.firstName);
  const lastName = clean(contact.lastName || registration.lastName);
  const result = {
    contactId: clean(contact.id),
    firstName,
    lastName,
    displayName: clean(contact.name || registration.displayName) || [firstName, lastName].filter(Boolean).join(" "),
    company: clean(contact.company || registration.company || member?.name),
    position: clean(contact.position || registration.position),
    photoUrl: clean(contact.photoUrl || contact.profileImageUrl || contact.imageUrl),
    photoStoragePath: self ? clean(contact.photoStoragePath) : "",
    companyLogo: clean(contact.companyLogo || contact.companyLogoUrl || registration.companyLogo || registration.companyLogoUrl),
    title: clean(contact.title || registration.title),
    biography: clean(contact.biography || contact.shortBio).slice(0, 2400),
    companyProfile: clean(contact.companyProfile).slice(0, 2400),
    website: clean(contact.website),
    isMember: Boolean(member),
    self
  };
  if (member) {
    result.biography = clean(contact.biography || contact.shortBio || member.biography || member.shortBio || member.description).slice(0, 1800);
    result.companyProfile = clean(contact.companyProfile || member.companyProfile || member.description).slice(0, 2200);
    result.companyLogo = result.companyLogo || clean(member.logoUrl || member.logo || member.imageUrl);
    result.website = clean(contact.website || member.website);
  }
  if (self) {
    result.companyLogo = result.companyLogo || clean(member?.logoUrl || member?.logo || member?.imageUrl);
    result.email = clean(contact.email || registration.email);
    result.phone = clean(contact.phone || contact.mobile || registration.phone || registration.mobile);
    result.linkedIn = clean(contact.linkedIn || contact.linkedin || registration.linkedIn || member?.linkedIn);
    result.biography = clean(contact.biography || contact.shortBio || member?.biography || member?.shortBio || member?.description).slice(0, 1800);
    result.companyProfile = clean(contact.companyProfile || member?.companyProfile || member?.description).slice(0, 2200);
    result.website = clean(contact.website || member?.website);
  }
  return result;
}

async function eventLiveProfileImageUrl(storagePath) {
  if (!storagePath || !storagePath.startsWith("event-live-profiles/")) return "";
  const [url] = await getStorage().bucket(storageBucket).file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 30 * 60 * 1000
  });
  return url;
}

exports.validateEventLiveInvitation = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId);
  const email = clean(request.data?.email).toLowerCase();
  if (!eventId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError("invalid-argument", "Bitte Event und gültige E-Mail-Adresse angeben.");
  const event = await db.collection("events").doc(eventId).get();
  if (!event.exists || event.data()?.eventLiveEnabled !== true) return { eligible: false };
  return { eligible: await eventLiveInvited(eventId, email) };
});

exports.setEventLiveSettings = onCall({ region }, async (request) => {
  await requireEditor(request);
  const eventId = clean(request.data?.eventId);
  const enabled = request.data?.enabled === true;
  if (!eventId) throw new HttpsError("invalid-argument", "Veranstaltung fehlt.");
  const eventRef = db.collection("events").doc(eventId);
  const event = await eventRef.get();
  if (!event.exists) throw new HttpsError("not-found", "Veranstaltung wurde nicht gefunden.");
  const invitedEmails = enabled ? await eventLiveInvitationEmails(eventId) : [];
  const inviteEmailHashes = invitedEmails.map((email) => hashToken(email));
  const batch = db.batch();
  batch.set(eventRef, { eventLiveEnabled: enabled, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(db.collection("eventLiveAccess").doc(eventId), {
    eventId, enabled, inviteEmailHashes,
    updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid
  }, { merge: true });
  await batch.commit();
  return { enabled, invitedCount: invitedEmails.length };
});

exports.listEventLiveEvents = onCall({ region }, async (request) => {
  if (!request.auth || request.auth.token.email_verified !== true) throw new HttpsError("unauthenticated", "Bitte mit bestätigter E-Mail anmelden.");
  const snapshot = await db.collection("eventLiveAccess").where("enabled", "==", true).limit(150).get();
  const items = await Promise.all(snapshot.docs.map(async (document) => {
    const event = await db.collection("events").doc(document.id).get();
    if (!event.exists) return null;
    try {
      await eventLiveUser(request, event.id);
      return { id: event.id, title: clean(event.data()?.title), date: clean(event.data()?.date), startTime: clean(event.data()?.startTime), endTime: clean(event.data()?.endTime) };
    } catch { return null; }
  }));
  return { events: items.filter(Boolean) };
});

exports.updateEventChatPresence = onCall({ region }, eventChatNotifications.presence);
exports.getEventLiveContactCard = onCall({ region }, createContactCardReader({ db, eventLiveUser, eventLiveContactRequestId, HttpsError }));

exports.getEventLiveData = onCall({ region }, async (request) => {
  const eventId = clean(request.data?.eventId);
  if (!eventId) throw new HttpsError("invalid-argument", "Veranstaltung fehlt.");
  const viewer = await eventLiveUser(request, eventId);
  const ownContactRef = db.collection("contacts").doc(viewer.contactId);
  const [ownContactSnapshot, registrationsSnapshot, membersSnapshot, outgoing, incoming, inbox, board, speakers, topics, singleEventTopics] = await Promise.all([
    ownContactRef.get(),
    db.collection("registrations").where("eventId", "==", eventId).limit(1000).get(),
    db.collection("members").get(),
    db.collection("eventLiveContactRequests").where("eventId", "==", eventId).where("senderContactId", "==", viewer.contactId).limit(100).get(),
    db.collection("eventLiveContactRequests").where("eventId", "==", eventId).where("receiverContactId", "==", viewer.contactId).limit(100).get(),
    db.collection("eventLiveConversations").doc(eventId).collection("threads").where("participantIds", "array-contains", viewer.contactId).limit(100).get(),
    db.collection("boardMembers").get(),
    db.collection("speakers").get(),
    db.collection("topics").where("eventIds", "array-contains", eventId).get(),
    db.collection("topics").where("eventId", "==", eventId).get()
  ]);
  const uniqueRegistrations = new Map();
  registrationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((registration) => registration.status === "checked_in" && registration.checkedInEventId === eventId && clean(registration.email))
    .forEach((registration) => {
      const key = clean(registration.email).toLowerCase();
      if (!uniqueRegistrations.has(key)) uniqueRegistrations.set(key, registration);
    });
  const registrations = [...uniqueRegistrations.values()];
  const portraitSources = [...board.docs, ...speakers.docs].map((doc) => ({ ...doc.data(), id: doc.id }));
  const boardSources = board.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  const logoTopics = [...new Map([...topics.docs, ...singleEventTopics.docs].map(doc => [doc.id, { ...doc.data(), id: doc.id }])).values()];
  const linkedAgendaTopicIds = [...new Set([
    ...(Array.isArray(viewer.event.topicIds) ? viewer.event.topicIds : []),
    ...(Array.isArray(viewer.event.scheduleItems) ? viewer.event.scheduleItems : []).map(item => item.topicId)
  ].filter(id => typeof id === "string" && id && !id.includes("/") && !logoTopics.some(topic => topic.id === id)))];
  const linkedAgendaTopics = await Promise.all(linkedAgendaTopicIds.map(id => db.collection("topics").doc(id).get()));
  logoTopics.push(...linkedAgendaTopics.filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id })));

  const memberForEmail = (email) => {
    const normalized = clean(email).toLowerCase();
    if (viewer.email === normalized && viewer.member) return viewer.member;
    return membersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      .find((member) => member.status === "active" && normalizedMemberEmails(member).includes(normalized)) || null;
  };
  const records = await Promise.all(registrations.map(async (registration) => {
    const id = contactId(registration.email);
    const contactSnapshot = await db.collection("contacts").doc(id).get().catch(() => null);
    const contact = contactSnapshot?.exists ? { id, ...contactSnapshot.data() } : { id, email: registration.email };
    return { registration, contact, member: memberForEmail(registration.email) };
  }));
  const accepted = new Set([...outgoing.docs, ...incoming.docs].filter((doc) => doc.data()?.status === "accepted").map((doc) => doc.data()?.senderContactId === viewer.contactId ? doc.data()?.receiverContactId : doc.data()?.senderContactId));
  const ownContact = ownContactSnapshot.exists ? { id: viewer.contactId, ...ownContactSnapshot.data() } : { id: viewer.contactId, email: viewer.email };
  const participants = await Promise.all(records.map(async ({ registration, contact, member }) => {
    const person = eventLivePublicPerson(contact, registration, member, contact.id === viewer.contactId);
    person.online = await eventChatNotifications.sessionsFor(contact.id).then(sessions => eventChatOnline(sessions)).catch(() => null);
    person.boardRole = eventLiveBoardRole(contact, registration, boardSources);
    if (!person.biography) person.biography = eventLiveBiography(contact, registration, portraitSources);
    if (contact.photoStoragePath) person.photoUrl = await eventLiveProfileImageUrl(contact.photoStoragePath).catch(() => person.photoUrl);
    if (!person.photoUrl) person.photoUrl = eventLivePortrait(contact, registration, portraitSources);
    if (contact.companyLogoStoragePath) person.companyLogo = await eventLiveProfileImageUrl(contact.companyLogoStoragePath).catch(() => person.companyLogo);
    if (!person.companyLogo) person.companyLogo = eventLiveCompanyLogo(contact, registration, portraitSources, logoTopics, eventId);
    if (!person.self && accepted.has(contact.id)) {
      person.email = clean(contact.email || registration.email);
      person.phone = clean(contact.phone || contact.mobile || registration.phone || registration.mobile);
      person.linkedIn = clean(contact.linkedIn || contact.linkedin || registration.linkedIn || member?.linkedIn);
    }
    return person;
  }));
  const ownProfile = eventLivePublicPerson(ownContact, {}, viewer.member, true);
  const ownParticipant = participants.find(person => person.contactId === viewer.contactId);
  ownProfile.online = ownParticipant ? ownParticipant.online : await eventChatNotifications.sessionsFor(viewer.contactId).then(sessions => eventChatOnline(sessions)).catch(() => null);
  const ownRegistration = registrations.find(item => contactId(item.email) === viewer.contactId) || {};
  ownProfile.boardRole = eventLiveBoardRole(ownContact, ownRegistration, boardSources);
  if (!ownProfile.biography) ownProfile.biography = eventLiveBiography(ownContact, ownRegistration, portraitSources);
  if (ownContact.companyLogoStoragePath) ownProfile.companyLogo = await eventLiveProfileImageUrl(ownContact.companyLogoStoragePath).catch(() => ownProfile.companyLogo);
  if (!ownProfile.companyLogo) ownProfile.companyLogo = eventLiveCompanyLogo(ownContact, registrations.find(item => contactId(item.email) === viewer.contactId) || {}, portraitSources, logoTopics, eventId);
  if (ownContact.photoStoragePath) ownProfile.photoUrl = await eventLiveProfileImageUrl(ownContact.photoStoragePath).catch(() => ownProfile.photoUrl);
  if (!ownProfile.photoUrl) ownProfile.photoUrl = eventLivePortrait(ownContact, registrations.find((item) => contactId(item.email) === viewer.contactId) || {}, portraitSources);
  return {
    event: { id: viewer.event.id, title: clean(viewer.event.title), date: clean(viewer.event.date), startTime: clean(viewer.event.startTime), endTime: clean(viewer.event.endTime),
      agendaText: eventAgendaMailText(viewer.event),
      scheduleItems: eventAgendaItems(viewer.event, logoTopics.filter(topic => !["inactive", "archived", "draft", "deleted", "hidden", "invisible"].includes(String(topic.status || "").toLowerCase())), speakers.docs.map(doc => ({ ...doc.data(), id: doc.id }))) },
    role: viewer.role,
    canEditProfiles: await requireAdmin(request).then(() => true).catch(() => false),
    profile: ownProfile,
    canChat: registrations.some(item => contactId(item.email) === viewer.contactId),
    participants,
    conversations: inbox.docs.map((doc) => {
      const item = doc.data();
      const peerId = item.participantIds.find((id) => id !== viewer.contactId);
      const lastMessageSelf = item.lastSenderContactId === viewer.contactId;
      const lastMillis = item.lastMessageAt?.toMillis() || 0;
      return { peerId, lastMessageSelf, lastMessageRead: lastMessageSelf && lastMillis > 0 && (item.lastReadAt?.[peerId]?.toMillis() || 0) >= lastMillis, lastText: item.lastText || "", lastMessageAt: item.lastMessageAt?.toDate().toISOString() || "", unread: !lastMessageSelf && lastMillis > (item.lastReadAt?.[viewer.contactId]?.toMillis() || 0) };
    }).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
    requests: [...outgoing.docs, ...incoming.docs].map((doc) => ({ id: doc.id, ...doc.data() }))
  };
});

exports.adminUpdateEventLiveProfile = onCall({ region }, createAdminProfileUpdater({ db, requireAdmin, contactId, FieldValue, HttpsError }));

exports.updateEventLiveProfile = onCall({ region }, async (request) => {
  const eventId = clean(request.data?.eventId);
  const viewer = await eventLiveUser(request, eventId);
  const input = request.data?.profile || {};
  const fields = ["firstName", "lastName", "company", "position", "photoStoragePath", "biography", "companyProfile", "website", "phone", "linkedIn"];
  const update = {
    email: viewer.email,
    id: viewer.contactId,
    eventIds: FieldValue.arrayUnion(eventId),
    lastEventId: eventId,
    updatedAt: FieldValue.serverTimestamp(),
    eventLiveProfileUpdatedAt: FieldValue.serverTimestamp(),
    source: "event_live_profile"
  };
  for (const field of fields) {
    if (input[field] === undefined) continue;
    const value = clean(input[field]).slice(0, field === "biography" || field === "companyProfile" ? 2400 : field === "photoStoragePath" ? 1500 : field === "linkedIn" ? 300 : 180);
    update[field] = value;
  }
  if (input.firstName !== undefined || input.lastName !== undefined) {
    update.name = [clean(update.firstName), clean(update.lastName)].filter(Boolean).join(" ");
  }
  const website = clean(input.website).slice(0, 300);
  if (input.website !== undefined && website && !/^https?:\/\//i.test(website)) {
    throw new HttpsError("invalid-argument", "Die Website muss mit https:// oder http:// beginnen.");
  }
  const linkedIn = clean(input.linkedIn).slice(0, 300);
  if (input.linkedIn !== undefined && linkedIn && !/^https:\/\/(?:www\.)?linkedin\.com\//i.test(linkedIn)) {
    throw new HttpsError("invalid-argument", "Bitte eine gültige HTTPS-Adresse von linkedin.com eingeben.");
  }
  if (input.photoUrl === "") update.photoUrl = FieldValue.delete();
  if (update.photoStoragePath && !update.photoStoragePath.startsWith(`event-live-profiles/${viewer.uid}/`)) {
    throw new HttpsError("invalid-argument", "Das Profilfoto muss über den Event-Live-Foto-Upload gespeichert sein.");
  }
  const contactRef = db.collection("contacts").doc(viewer.contactId);
  const currentContact = await contactRef.get();
  if (!currentContact.exists) update.createdAt = FieldValue.serverTimestamp();
  await contactRef.set(update, { merge: true });
  if (viewer.member && (input.biography !== undefined || input.companyProfile !== undefined || input.website !== undefined)) {
    const memberUpdate = { profileUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    if (input.biography !== undefined) memberUpdate.biography = clean(input.biography).slice(0, 2400);
    if (input.companyProfile !== undefined) memberUpdate.companyProfile = clean(input.companyProfile).slice(0, 2400);
    if (input.website !== undefined) memberUpdate.website = website;
    await db.collection("members").doc(viewer.member.id).set(memberUpdate, { merge: true });
  }
  return { saved: true };
});

exports.requestEventLiveContact = onCall({ region }, async (request) => {
  const eventId = clean(request.data?.eventId);
  const receiverContactId = clean(request.data?.receiverContactId);
  const viewer = await eventLiveUser(request, eventId, { requireAttendance: true });
  if (!receiverContactId || receiverContactId === viewer.contactId) throw new HttpsError("invalid-argument", "Bitte eine andere teilnehmende Person auswählen.");
  const [registration, contact, senderContact] = await Promise.all([
    db.collection("registrations").where("eventId", "==", eventId).where("status", "==", "checked_in").limit(1000).get(),
    db.collection("contacts").doc(receiverContactId).get(),
    db.collection("contacts").doc(viewer.contactId).get()
  ]);
  const belongs = registration.docs.some((doc) => doc.data()?.checkedInEventId === eventId && contactId(doc.data()?.email) === receiverContactId);
  if (!belongs) throw new HttpsError("not-found", "Die Teilnehmerliste hat sich geändert. Bitte aktualisieren Sie Event Live.");
  const ref = db.collection("eventLiveContactRequests").doc(eventLiveContactRequestId(eventId, viewer.contactId, receiverContactId));
  const current = await ref.get();
  if (current.exists && ["pending", "accepted"].includes(clean(current.data()?.status))) return { status: current.data().status };
  await ref.set({
    id: ref.id, eventId, senderContactId: viewer.contactId, receiverContactId,
    senderName: clean(senderContact.data()?.name || [senderContact.data()?.firstName, senderContact.data()?.lastName].filter(Boolean).join(" ")).slice(0, 120),
    receiverName: clean(contact.data()?.name || [contact.data()?.firstName, contact.data()?.lastName].filter(Boolean).join(" ")).slice(0, 120),
    status: "pending", deliveryChannel: "event_live", deliveredAt: FieldValue.serverTimestamp(),
    requestedAt: FieldValue.serverTimestamp(), answeredAt: null,
    createdAt: current.exists ? current.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { status: "pending" };
});

exports.respondEventLiveContact = onCall({ region }, async (request) => {
  const eventId = clean(request.data?.eventId);
  const requestId = clean(request.data?.requestId);
  const decision = clean(request.data?.decision);
  const viewer = await eventLiveUser(request, eventId);
  if (!requestId || !["accepted", "rejected"].includes(decision)) throw new HttpsError("invalid-argument", "Antwort fehlt.");
  const ref = db.collection("eventLiveContactRequests").doc(requestId);
  const snapshot = await ref.get();
  const item = snapshot.data() || {};
  if (!snapshot.exists || item.eventId !== eventId || item.receiverContactId !== viewer.contactId || item.status !== "pending") {
    throw new HttpsError("permission-denied", "Diese Kontaktanfrage kann nicht beantwortet werden.");
  }
  await ref.update({ status: decision, answeredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return { status: decision };
});

async function deleteEventLiveContactRequests(eventId) {
  const snapshot = await db.collection("eventLiveContactRequests").where("eventId", "==", eventId).get();
  let count = 0;
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(offset, offset + 400);
    chunk.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    count += chunk.length;
  }
  return count;
}

exports.resetEventLiveContactRequests = onCall({ region }, async (request) => {
  await requireAdmin(request);
  const eventId = clean(request.data?.eventId);
  if (!eventId || eventId.includes("/") || request.data?.confirmed !== true) {
    throw new HttpsError("invalid-argument", "Bitte das Zurücksetzen für dieses Event bestätigen.");
  }
  return { resetCount: await deleteEventLiveContactRequests(eventId) };
});

const { createEventChatAttachments, removeChatAttachment } = require("./eventChatAttachments");
const chatAttachmentBucket = getStorage().bucket(storageBucket);
const eventLiveMessages = createEventLiveMessages({ db, eventLiveUser, contactId, eventLiveContactRequestId, FieldValue, HttpsError,
  removeAttachment: message => removeChatAttachment({ db, bucket: chatAttachmentBucket }, message) });
const eventChatAttachments = createEventChatAttachments({ db, bucket: chatAttachmentBucket, messages: eventLiveMessages, eventLiveUser, FieldValue, HttpsError });
exports.beginEventChatAttachment = onCall({ region }, eventChatAttachments.begin);
exports.finishEventChatAttachment = onCall({ region }, eventChatAttachments.finish);
exports.getEventChatAttachment = onRequest({ region, invoker: "public", cors: true, memory: "512MiB" }, async (req, res) => {
  try {
    if (req.method !== "GET") { res.status(405).send("GET required"); return; }
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) { res.status(401).send("Bitte anmelden."); return; }
    let verified;
    try { verified = await getAuth().verifyIdToken(token); } catch { res.status(401).send("Bitte erneut anmelden."); return; }
    const { file, fileType } = await eventChatAttachments.read({ uid: verified.uid, token: verified }, String(req.query.attachmentId || ""));
    res.set("Content-Type", fileType);
    res.set("Cache-Control", "private, max-age=300");
    res.set("Vary", "Authorization");
    res.set("X-Content-Type-Options", "nosniff");
    await new Promise((resolve, reject) => {
      const stream = file.createReadStream();
      stream.on("error", (streamError) => {
        if (!res.headersSent) reject(streamError);
        else { res.destroy(streamError); resolve(); }
      });
      res.on("finish", resolve);
      res.on("close", resolve);
      stream.pipe(res);
    });
  } catch (error) {
    res.status(error.code === "not-found" ? 404 : error.code === "unauthenticated" ? 401 : error.code === "permission-denied" ? 403 : 500)
      .send(error.code === "permission-denied" ? "Kein Zugang zu diesem Chat." : "Anhang ist nicht verfügbar.");
  }
});

const { createEventContentModeration } = require("./eventContentModeration");
const eventContentModeration = createEventContentModeration({ db, requireAdmin, bucket: getStorage().bucket(storageBucket), HttpsError, FieldValue });
exports.adminListEventContent = onCall({ region, timeoutSeconds: 120 }, eventContentModeration.list);
exports.adminDeleteEventContent = onCall({ region, timeoutSeconds: 540 }, eventContentModeration.remove);
exports.clearEventLiveMessages = onCall({ region, timeoutSeconds: 540 }, async (request) => {
  await requireAdmin(request);
  const eventId = clean(request.data?.eventId);
  if (!eventId || eventId.includes("/") || request.data?.confirmed !== true) {
    throw new HttpsError("invalid-argument", "Bitte das Löschen aller Chats für dieses Event bestätigen.");
  }
  await db.recursiveDelete(db.collection("eventLiveConversations").doc(eventId));
  const resetCount = await deleteEventLiveContactRequests(eventId);
  await db.collection("eventLiveConversations").doc(eventId).set({ resetAt: FieldValue.serverTimestamp() }, { merge: true });
  return { cleared: true, resetCount };
});
exports.getEventLiveMessages = onCall({ region }, eventLiveMessages.getMessages);
exports.sendEventLiveMessage = onCall({ region }, eventLiveMessages.sendMessage);
exports.markEventLiveMessagesRead = onCall({ region }, eventLiveMessages.markRead);
exports.deleteEventLiveMessage = onCall({ region }, eventLiveMessages.deleteMessage);
exports.getEventLiveGroupMessages = onCall({ region }, eventLiveMessages.getGroupMessages);
exports.sendEventLiveGroupMessage = onCall({ region }, eventLiveMessages.sendGroupMessage);
exports.getEventLiveGroupStatus = onCall({ region }, eventLiveMessages.getGroupStatus);
exports.markEventLiveGroupRead = onCall({ region }, eventLiveMessages.markGroupRead);

exports.deleteUnlinkedSpeaker = onCall({ region }, async (request) => {
  await requireAdmin(request);
  const speakerId = clean(request.data?.speakerId);
  if (!speakerId) throw new HttpsError("invalid-argument", "Referent fehlt.");
  const speakerRef = db.collection("speakers").doc(speakerId);
  const [speakerSnapshot, topicsSnapshot, eventsSnapshot] = await Promise.all([
    speakerRef.get(), db.collection("topics").get(), db.collection("events").get()
  ]);
  if (!speakerSnapshot.exists) throw new HttpsError("not-found", "Referent wurde nicht gefunden.");
  const speaker = speakerSnapshot.data() || {};
  const linkedToTopic = topicsSnapshot.docs.some((document) => {
    const topic = document.data() || {};
    const assignedIds = [topic.speakerId, topic.moderatorId, topic.coModeratorId,
      ...(Array.isArray(topic.speakerIds) ? topic.speakerIds : []),
      ...(Array.isArray(topic.speakers) ? topic.speakers : []),
      ...(Array.isArray(topic.moderatorIds) ? topic.moderatorIds : []),
      ...(Array.isArray(topic.coModeratorIds) ? topic.coModeratorIds : [])];
    return assignedIds.includes(speakerId) || topic.speakerRoles?.[speakerId]
      || speaker.topicId === document.id || (Array.isArray(speaker.topicIds) && speaker.topicIds.includes(document.id));
  });
  const linkedToEvent = eventsSnapshot.docs.some((document) => {
    const event = document.data() || {};
    return event.speakerId === speakerId || (Array.isArray(event.speakerIds) && event.speakerIds.includes(speakerId))
      || (Array.isArray(speaker.eventIds) && speaker.eventIds.includes(document.id));
  });
  if (linkedToTopic || linkedToEvent) {
    throw new HttpsError("failed-precondition", "Referent ist noch mit einem Vortrag oder Event verknuepft und kann nicht geloescht werden.");
  }
  await speakerRef.delete();
  return { deleted: true };
});

function memberInvitationLink(invitationId = "", token = "") {
  return `${PUBLIC_APP_BASE_URL}/user-invite/${encodeURIComponent(invitationId)}/${encodeURIComponent(token)}`;
}

function memberInvitationExpiresAtDate() {
  return new Date(Date.now() + 12 * 60 * 60 * 1000);
}

function speakerApprovalExpiresAtDate() {
  return new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
}

function speakerApprovalLink(approvalId = "", token = "") {
  return publicHashUrl(`speaker-approval/${encodeURIComponent(approvalId)}?token=${encodeURIComponent(token)}`);
}

function speakerEmailAddress(speaker = {}) {
  return mailAddress(speaker.email || speaker.mail || speaker.contactEmail || speaker.contact_email || speaker.primaryEmail || "").toLowerCase();
}

function topicDescriptionText(topic = {}) {
  return clean(topic.longDescription || topic.description || topic.shortDescription || topic.text || topic.bodyText || "");
}

function speakerApprovalPublicPayload(approval = {}, speaker = {}, topic = {}, eventRecord = {}) {
  return {
    approvalId: approval.id || "",
    status: approval.status || "open",
    event: {
      id: eventRecord.id || approval.eventId || "",
      title: eventRecord.title || approval.eventTitle || "",
      date: eventRecord.date || "",
      locationName: eventRecord.locationName || eventRecord.location || "",
      city: eventRecord.city || ""
    },
    speaker: {
      id: speaker.id || approval.speakerId || "",
      name: compactNameParts(speaker) || approval.speakerName || "",
      company: speaker.company || "",
      position: speaker.position || speaker.role || "",
      email: speakerEmailAddress(speaker) || approval.speakerEmail || "",
      phone: speaker.phone || speaker.mobile || speaker.telephone || "",
      shortBio: speaker.shortBio || "",
      longBio: speaker.longBio || speaker.vita || speaker.biography || "",
      photoUrl: speaker.photoUrl || speaker.imageUrl || speaker.thumbnailUrl || "",
      website: speaker.website || "",
      linkedIn: speaker.linkedIn || speaker.linkedin || ""
    },
    topic: {
      id: topic.id || approval.topicId || "",
      title: topic.title || approval.topicTitle || "",
      subline: topic.subline || topic.subtitle || "",
      description: topicDescriptionText(topic),
      imageUrl: topic.imageUrl || topic.thumbnailUrl || topic.thumbnail_url || ""
    },
    submitted: approval.submitted || null,
    submittedAt: approval.submittedAt || "",
    speakerDecision: approval.speakerDecision || "",
    speakerApprovedAt: approval.speakerApprovedAt || ""
  };
}
function memberLoginInvitationMailPayload(invitation = {}, mailText = "") {
  return {
    type: "member_login_invitation",
    template: "member_login_invitation",
    userInvitationId: invitation.id,
    userId: invitation.uid,
    memberId: invitation.memberId,
    to: invitation.email,
    subject: "Ihr PROdigitalTV-Zugang",
    displayName: invitation.displayName,
    role: invitation.role,
    memberName: invitation.memberName,
    invitationLink: invitation.invitationLink,
    link: invitation.invitationLink,
    mailText
  };
}

async function queueMemberLoginInvitationMail(invitation = {}, mailText = "") {
  const ref = await queueMail(memberLoginInvitationMailPayload(invitation, mailText));
  await db.collection("userInvitations").doc(invitation.id).set({
    mailStatus: "queued",
    mailQueueId: ref.id,
    mailQueuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await db.collection("users").doc(invitation.uid).set({
    invitationMailStatus: "queued",
    invitationMailQueueId: ref.id,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return ref;
}


const CALENDAR_DECISION_REMINDER_DAYS = 7;

function calendarPad(value) {
  return String(value).padStart(2, "0");
}

function calendarText(value = "") {
  return clean(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function calendarDateValue(event = {}) {
  return clean(event.date || event.startDate || event.eventDate || event.datum).slice(0, 10);
}

function calendarTimeValue(value = "") {
  const text = clean(value);
  return /^\d{1,2}:\d{2}/.test(text) ? text.slice(0, 5) : "";
}

function calendarLocalDate(date = "", time = "00:00") {
  const [year, month, day] = clean(date).split("-").map(Number);
  const [hour, minute] = clean(time || "00:00").split(":").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
}

function calendarAddMinutes(date, minutes) {
  const next = new Date(date.getTime());
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function calendarAddDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function calendarUtcStamp(date = new Date()) {
  return `${date.getUTCFullYear()}${calendarPad(date.getUTCMonth() + 1)}${calendarPad(date.getUTCDate())}T${calendarPad(date.getUTCHours())}${calendarPad(date.getUTCMinutes())}${calendarPad(date.getUTCSeconds())}Z`;
}

function calendarIcsLocal(date) {
  return `${date.getFullYear()}${calendarPad(date.getMonth() + 1)}${calendarPad(date.getDate())}T${calendarPad(date.getHours())}${calendarPad(date.getMinutes())}00`;
}

function calendarIcsDate(date) {
  return `${date.getFullYear()}${calendarPad(date.getMonth() + 1)}${calendarPad(date.getDate())}`;
}

function calendarIcsEscape(value = "") {
  return calendarText(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function calendarIcsFold(line = "") {
  const chunks = [];
  let rest = String(line || "");
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function calendarPublicEventAllowed(event = {}) {
  return ["published", "active", "aktiv"].includes(clean(event.status).toLowerCase())
    && ["public", "oeffentlich", "öffentlich", ""].includes(clean(event.visibility || "public").toLowerCase())
    && event.calendarSaveEnabled !== false
    && event.calendar_vormerkung !== false;
}

function calendarLocation(event = {}) {
  if (event.isVirtualEvent) return event.onlineMeetingLabel || "Online";
  return [event.locationName, event.address, [event.postalCode || event.zipCode, event.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function calendarDescription(event = {}, url = "", registrationUrl = "") {
  const description = calendarText(event.description || event.publicTeaser || event.teaserText || event.shortDescription || event.introText || event.subtitle || "");
  return [description, url ? `Eventseite: ${url}` : "", registrationUrl ? `Anmeldung: ${registrationUrl}` : ""].filter(Boolean).join("\n\n");
}

function calendarEventData(event = {}) {
  const date = calendarDateValue(event);
  const startTime = calendarTimeValue(event.startTime || event.start_time || event.time);
  const endTime = calendarTimeValue(event.endTime || event.end_time);
  const allDay = Boolean(event.allDay || event.isAllDay || event.fullDay || event.ganztag || !startTime);
  const startLocal = calendarLocalDate(date, startTime || "00:00");
  const endLocal = allDay ? startLocal ? calendarAddDays(startLocal, 1) : null : endTime ? calendarLocalDate(date, endTime) : startLocal ? calendarAddMinutes(startLocal, Number(event.defaultDurationMinutes || event.durationMinutes || 90)) : null;
  const title = calendarText(event.title || event.titel || "PROdigitalTV Event");
  const url = eventUrl(event.id || "");
  const registrationUrl = event.registrationUrl || event.registration_url || publicHashUrl(`register/${encodeURIComponent(event.id || "")}`);
  const timeZone = clean(event.timeZone || event.timezone || event.tz) || "Europe/Berlin";
  const reminderDays = Math.max(1, Math.round(Number(event.calendarReminderDays ?? event.decisionReminderDays ?? CALENDAR_DECISION_REMINDER_DAYS) || CALENDAR_DECISION_REMINDER_DAYS));
  return {
    id: event.id || randomBytes(8).toString("hex"),
    title,
    date,
    startLocal,
    endLocal,
    allDay,
    timeZone,
    location: calendarLocation(event),
    url,
    registrationUrl,
    description: calendarDescription(event, url, registrationUrl),
    reminderDays,
    reminderEnabled: event.calendarReminderEnabled !== false && event.decisionReminderEnabled !== false,
    alarmMinutesBefore: event.calendarReminderEnabled !== false && event.decisionReminderEnabled !== false ? reminderDays * 1440 : 0
  };
}

function calendarDecisionReminderData(data = {}) {
  if (!data.startLocal) return null;
  const startLocal = calendarAddDays(data.startLocal, -data.reminderDays);
  const endLocal = calendarAddMinutes(startLocal, 30);
  const eventDate = data.startLocal ? `${calendarPad(data.startLocal.getDate())}.${calendarPad(data.startLocal.getMonth() + 1)}.${data.startLocal.getFullYear()}` : data.date;
  const description = [
    "Diese Veranstaltung hast du vorgemerkt. Moechtest du teilnehmen? Jetzt Veranstaltung ansehen und ggf. anmelden.",
    `Veranstaltung: ${data.title}`,
    eventDate ? `Datum der Veranstaltung: ${eventDate}` : "",
    data.location ? `Ort: ${data.location}` : "",
    data.url ? `Eventseite: ${data.url}` : "",
    data.registrationUrl ? `Anmeldung: ${data.registrationUrl}` : ""
  ].filter(Boolean).join("\n\n");
  return {
    id: `${data.id}-decision-${data.reminderDays}d`,
    title: `Teilnahme entscheiden: ${data.title}`,
    startLocal,
    endLocal,
    allDay: false,
    timeZone: data.timeZone,
    location: data.location,
    url: data.url,
    description
  };
}

function appendCalendarIcsEvent(lines, data = {}, uid = "") {
  lines.push("BEGIN:VEVENT", `UID:${calendarIcsEscape(`${uid || data.id}@prodigitaltv.de`)}`, `DTSTAMP:${calendarUtcStamp()}`, `SUMMARY:${calendarIcsEscape(data.title)}`, "STATUS:TENTATIVE");
  if (data.allDay && data.startLocal && data.endLocal) lines.push(`DTSTART;VALUE=DATE:${calendarIcsDate(data.startLocal)}`, `DTEND;VALUE=DATE:${calendarIcsDate(data.endLocal)}`);
  else if (data.startLocal && data.endLocal) lines.push(`DTSTART;TZID=${data.timeZone}:${calendarIcsLocal(data.startLocal)}`, `DTEND;TZID=${data.timeZone}:${calendarIcsLocal(data.endLocal)}`);
  if (data.location) lines.push(`LOCATION:${calendarIcsEscape(data.location)}`);
  if (data.url) lines.push(`URL:${calendarIcsEscape(data.url)}`);
  if (data.description) lines.push(`DESCRIPTION:${calendarIcsEscape(data.description)}`);
  if (data.alarmMinutesBefore > 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${calendarIcsEscape(`Erinnerung: ${data.title}`)}`, `TRIGGER:-PT${data.alarmMinutesBefore}M`, "END:VALARM");
  lines.push("END:VEVENT");
}

function eventCalendarIcs(event = {}, options = {}) {
  const data = calendarEventData(event);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PROdigitalTV//Event Calendar//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  appendCalendarIcsEvent(lines, data, data.id);
  lines.push("END:VCALENDAR");
  return `${lines.map(calendarIcsFold).join("\r\n")}\r\n`;
}

function calendarFileNameForEvent(event = {}) {
  const safe = calendarText(event.title || event.id || "prodigitaltv-event").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "prodigitaltv-event";
  return `${safe}.ics`;
}

exports.eventCalendarIcs = onRequest({ region, invoker: "public" }, async (req, res) => {
  try {
    const eventId = clean(req.query.eventId || req.query.id || "");
    if (!eventId) {
      res.status(400).send("eventId fehlt");
      return;
    }
    const snapshot = await db.collection("events").doc(eventId).get();
    if (!snapshot.exists) {
      res.status(404).send("Event wurde nicht gefunden.");
      return;
    }
    const event = { id: snapshot.id, ...snapshot.data() };
    if (!calendarPublicEventAllowed(event)) {
      res.status(404).send("Kalender-Vormerkung ist fuer dieses Event nicht oeffentlich aktiv.");
      return;
    }
    const includeDecisionReminder = !["0", "false", "no", "nein", "off", "aus"].includes(clean(req.query.decisionReminder || req.query.reminder || "1").toLowerCase());
    const ics = eventCalendarIcs(event, { includeDecisionReminder });
    const fileName = calendarFileNameForEvent(event).replace(/"/g, "");
    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="${fileName}"`);
    res.set("Cache-Control", "public, max-age=300");
    res.status(200).send(ics);
  } catch (error) {
    console.error("eventCalendarIcs failed", error);
    res.status(500).send("Kalendereintrag konnte nicht erzeugt werden.");
  }
});
function linkedinTextParts(linkedin = {}) {
  const text = stripTags(linkedin.text || "").slice(0, 2700);
  const hashtags = Array.isArray(linkedin.hashtags) ? linkedin.hashtags.map((tag) => clean(tag).replace(/^#+/, "")).filter(Boolean) : [];
  const normalizedTags = [...new Set(hashtags)].slice(0, 8).map((tag) => `#${tag.replace(/\s+/g, "-")}`);
  return [text, normalizedTags.join(" ")].filter(Boolean).join("\n\n").slice(0, 3000).trim();
}

function linkedinArticleUrl(item = {}, linkedin = {}) {
  const raw = clean(linkedin.articleUrl || item.publicUrl || item.url || "");
  if (raw) {
    try { return new URL(raw, PUBLIC_APP_BASE_URL).href; } catch {}
  }
  if (item.id) return publicHashUrl(item.collectionName === "topics" ? `topic/${encodeURIComponent(item.id)}` : `article/${encodeURIComponent(item.id)}`);
  return PUBLIC_APP_BASE_URL;
}

function linkedinDescription(item = {}) {
  return stripTags(item.introText || item.subtitle || item.shortDescription || item.seoDescription || item.description || item.bodyText || item.longDescription || "").slice(0, 240);
}

async function createLinkedInPost({ authorUrn, accessToken, version, commentary, article }) {
  const body = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false
  };
  if (article?.source) {
    body.content = {
      article: {
        source: article.source,
        title: article.title || "PROdigitalTV",
        description: article.description || ""
      }
    };
  }
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
      "linkedin-version": version || "202605"
    },
    body: JSON.stringify(body)
  });
  const raw = await response.text();
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) {
    const detail = clean(parsed?.message || parsed?.error_description || raw).slice(0, 500);
    throw new HttpsError("internal", `LinkedIn konnte den Beitrag nicht veroeffentlichen (${response.status}). ${detail}`);
  }
  return {
    postId: response.headers.get("x-restli-id") || parsed?.id || "",
    response: parsed || raw.slice(0, 500)
  };
}

exports.publishLinkedInPost = onCall({ region, secrets: linkedinSecrets, timeoutSeconds: 120 }, async (request) => {
  const profile = await requireEditor(request);
  const entityType = clean(request.data?.entityType) === "topics" ? "topics" : "editorialContent";
  const entityId = clean(request.data?.entityId || request.data?.id || "");
  if (!entityId) throw new HttpsError("invalid-argument", "Beitrag fehlt.");
  const ref = db.collection(entityType).doc(entityId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Beitrag wurde nicht gefunden.");
  const item = { id: snapshot.id, collectionName: entityType, ...snapshot.data() };
  const linkedin = item.linkedin && typeof item.linkedin === "object" ? item.linkedin : {};
  if (linkedin.status === "published" && linkedin.linkedinPostId) {
    throw new HttpsError("already-exists", "Dieser Beitrag wurde bereits auf LinkedIn veroeffentlicht.");
  }
  if (linkedin.status !== "approved") throw new HttpsError("failed-precondition", "Bitte LinkedIn-Teaser vor dem Veroeffentlichen freigeben.");
  const commentary = linkedinTextParts(linkedin);
  if (!commentary) throw new HttpsError("failed-precondition", "LinkedIn-Text fehlt.");
  const accessToken = clean(LINKEDIN_ACCESS_TOKEN.value());
  const authorUrn = clean(LINKEDIN_AUTHOR_URN.value());
  const version = clean(LINKEDIN_VERSION.value()) || "202605";
  if (!accessToken || !authorUrn) throw new HttpsError("failed-precondition", "LinkedIn ist noch nicht konfiguriert. Bitte LINKEDIN_ACCESS_TOKEN und LINKEDIN_AUTHOR_URN als Firebase Secrets setzen.");
  if (!/^urn:li:(organization|person):/.test(authorUrn)) throw new HttpsError("failed-precondition", "LINKEDIN_AUTHOR_URN muss z. B. urn:li:organization:123456 sein.");
  const articleUrl = linkedinArticleUrl(item, linkedin);
  const payload = await createLinkedInPost({
    authorUrn,
    accessToken,
    version,
    commentary,
    article: {
      source: articleUrl,
      title: stripTags(item.title || item.name || "PROdigitalTV").slice(0, 200),
      description: linkedinDescription(item)
    }
  });
  const publishedAt = new Date().toISOString();
  await ref.set({
    linkedin: {
      ...linkedin,
      articleUrl,
      status: "published",
      publishedAt,
      linkedinPostId: payload.postId,
      publishedBy: profile.email || request.auth.uid,
      publishedByUid: request.auth.uid,
      lastPublishResponse: payload.response,
      updatedAt: publishedAt
    },
    updatedAt: publishedAt
  }, { merge: true });
  await db.collection("linkedinPosts").doc(payload.postId || `linkedin-${Date.now()}`).set({
    id: payload.postId || "",
    entityType,
    entityId,
    articleUrl,
    authorUrn,
    commentary,
    status: "published",
    response: payload.response,
    createdBy: profile.email || request.auth.uid,
    createdByUid: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    publishedAt
  }, { merge: true });
  return { ok: true, postId: payload.postId, publishedAt, articleUrl };
});
exports.sendSpeakerApprovalInvitation = onCall({ region }, async (request) => {
  const actorProfile = await requireEditor(request);
  const eventId = clean(request.data?.eventId || "");
  const topicId = clean(request.data?.topicId || "");
  const speakerId = clean(request.data?.speakerId || "");
  const introText = clean(request.data?.introText || "bitte pruefen Sie Ihr Referentenprofil und die Vortragsbeschreibung. Ueber den Link koennen Sie Korrekturen direkt an PROdigitalTV uebermitteln.").slice(0, 2000);
  if (!eventId || !topicId || !speakerId) throw new HttpsError("invalid-argument", "Event, Vortrag und Referent muessen angegeben sein.");
  const [eventSnapshot, topicSnapshot, speakerSnapshot] = await Promise.all([
    db.collection("events").doc(eventId).get(),
    db.collection("topics").doc(topicId).get(),
    db.collection("speakers").doc(speakerId).get()
  ]);
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
  if (!topicSnapshot.exists) throw new HttpsError("not-found", "Vortrag wurde nicht gefunden.");
  if (!speakerSnapshot.exists) throw new HttpsError("not-found", "Referent wurde nicht gefunden.");
  const eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
  const topic = { id: topicSnapshot.id, ...topicSnapshot.data() };
  const speaker = { id: speakerSnapshot.id, ...speakerSnapshot.data() };
  const eventTopicIds = new Set([...(eventRecord.topicIds || []), eventRecord.topicId].filter(Boolean));
  const topicSpeakerIds = new Set([topic.speakerId, ...(topic.speakerIds || [])].filter(Boolean));
  const speakerTopicIds = new Set([speaker.topicId, ...(speaker.topicIds || [])].filter(Boolean));
  const topicLinked = eventTopicIds.has(topic.id) || topic.eventId === eventId || (topic.eventIds || []).includes(eventId);
  const speakerLinked = topicSpeakerIds.has(speaker.id) || speakerTopicIds.has(topic.id) || (eventRecord.speakerIds || []).includes(speaker.id) || (speaker.eventIds || []).includes(eventId);
  if (!topicLinked || !speakerLinked) throw new HttpsError("failed-precondition", "Referent und Vortragsbeschreibung sind diesem Event nicht eindeutig zugeordnet.");
  const email = speakerEmailAddress(speaker);
  if (!email) throw new HttpsError("failed-precondition", "Beim Referenten ist keine E-Mail-Adresse hinterlegt.");
  const token = randomBytes(32).toString("base64url");
  const approvalId = `speaker-approval-${hashToken(`${eventId}:${topicId}:${speakerId}`).slice(0, 24)}`;
  const approvalRef = db.collection("speakerApprovals").doc(approvalId);
  const existingApprovalSnapshot = await approvalRef.get();
  const existingApproval = existingApprovalSnapshot.exists ? existingApprovalSnapshot.data() || {} : {};
  const acceptedTokenHashes = Array.from(new Set([
    ...(Array.isArray(existingApproval.tokenHashes) ? existingApproval.tokenHashes : []),
    existingApproval.tokenHash,
    hashToken(token)
  ].filter(Boolean))).slice(-10);
  const expiresAt = speakerApprovalExpiresAtDate();
  const link = speakerApprovalLink(approvalId, token);
  const now = FieldValue.serverTimestamp();
  await approvalRef.set({
    id: approvalId,
    eventId,
    topicId,
    speakerId,
    speakerEmail: email,
    speakerName: compactNameParts(speaker),
    eventTitle: eventRecord.title || "",
    topicTitle: topic.title || "",
    tokenHash: hashToken(token),
    tokenHashes: acceptedTokenHashes,
    status: "queued",
    link,
    expiresAt: Timestamp.fromDate(expiresAt),
    snapshot: speakerApprovalPublicPayload({ id: approvalId, eventId, topicId, speakerId }, speaker, topic, eventRecord),
    sentBy: request.auth.uid,
    sentByEmail: actorProfile.email || request.auth.token.email || "",
    sentAt: now,
    updatedAt: now,
    createdAt: now
  }, { merge: true });
  const mailRef = await queueMail({
    type: "speaker_approval",
    template: "speaker_approval",
    speakerApprovalId: approvalId,
    eventId,
    topicId,
    speakerId,
    to: email,
    subject: `Bitte pruefen: ${topic.title || "Vortragsbeschreibung"}`,
    title: "Profil und Vortragsbeschreibung pruefen",
    introText,
    link,
    speakerName: compactNameParts(speaker),
    eventTitle: eventRecord.title || "PROdigitalTV Veranstaltung",
    topicTitle: topic.title || "Vortrag"
  });
  await approvalRef.set({ mailQueueId: mailRef.id, updatedAt: now }, { merge: true });
  await db.collection("auditLog").add({
    action: "send_speaker_approval_invitation",
    entityType: "speakerApproval",
    entityId: approvalId,
    userId: request.auth.uid,
    userEmail: actorProfile.email || request.auth.token.email || "",
    details: { eventId, topicId, speakerId, to: email },
    createdAt: now
  });
  return { ok: true, approvalId, link, queuedMailId: mailRef.id, to: email };
});

exports.getSpeakerApproval = onCall({ region, invoker: "public" }, async (request) => {
  const approvalId = clean(request.data?.approvalId || request.data?.id || "");
  const token = clean(request.data?.token || "");
  if (!approvalId || !token) throw new HttpsError("invalid-argument", "Freigabelink ist unvollstaendig.");
  const approvalSnapshot = await db.collection("speakerApprovals").doc(approvalId).get();
  if (!approvalSnapshot.exists) throw new HttpsError("not-found", "Freigabelink wurde nicht gefunden.");
  const approval = { id: approvalSnapshot.id, ...approvalSnapshot.data() };
  const acceptedTokenHashes = [approval.tokenHash, ...(Array.isArray(approval.tokenHashes) ? approval.tokenHashes : [])].filter(Boolean);
  if (!acceptedTokenHashes.includes(hashToken(token))) throw new HttpsError("permission-denied", "Freigabelink ist ungueltig.");
  if (approval.expiresAt?.toMillis?.() && approval.expiresAt.toMillis() < Date.now()) throw new HttpsError("deadline-exceeded", "Freigabelink ist abgelaufen.");
  const [eventSnapshot, topicSnapshot, speakerSnapshot] = await Promise.all([
    db.collection("events").doc(approval.eventId).get(),
    db.collection("topics").doc(approval.topicId).get(),
    db.collection("speakers").doc(approval.speakerId).get()
  ]);
  const eventRecord = eventSnapshot.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : {};
  const topic = topicSnapshot.exists ? { id: topicSnapshot.id, ...topicSnapshot.data() } : {};
  const speaker = speakerSnapshot.exists ? { id: speakerSnapshot.id, ...speakerSnapshot.data() } : {};
  const retainedStatus = ["submitted", "applied", "approved"].includes(approval.status) ? approval.status : "opened";
  await db.collection("speakerApprovals").doc(approvalId).set({ status: retainedStatus, openedAt: approval.openedAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, approval: speakerApprovalPublicPayload(approval, speaker, topic, eventRecord) };
});

exports.submitSpeakerApproval = onCall({ region, invoker: "public" }, async (request) => {
  const approvalId = clean(request.data?.approvalId || request.data?.id || "");
  const token = clean(request.data?.token || "");
  const input = request.data?.input || {};
  if (!approvalId || !token) throw new HttpsError("invalid-argument", "Freigabelink ist unvollstaendig.");
  const approvalSnapshot = await db.collection("speakerApprovals").doc(approvalId).get();
  if (!approvalSnapshot.exists) throw new HttpsError("not-found", "Freigabelink wurde nicht gefunden.");
  const approval = { id: approvalSnapshot.id, ...approvalSnapshot.data() };
  const acceptedTokenHashes = [approval.tokenHash, ...(Array.isArray(approval.tokenHashes) ? approval.tokenHashes : [])].filter(Boolean);
  if (!acceptedTokenHashes.includes(hashToken(token))) throw new HttpsError("permission-denied", "Freigabelink ist ungueltig.");
  if (approval.expiresAt?.toMillis?.() && approval.expiresAt.toMillis() < Date.now()) throw new HttpsError("deadline-exceeded", "Freigabelink ist abgelaufen.");
  const submitted = {
    speakerName: stripTags(input.speakerName || "").slice(0, 180),
    company: stripTags(input.company || "").slice(0, 180),
    position: stripTags(input.position || "").slice(0, 180),
    email: mailAddress(input.email || "").toLowerCase().slice(0, 320),
    phone: stripTags(input.phone || "").slice(0, 80),
    linkedIn: stripTags(input.linkedIn || "").slice(0, 1000),
    shortBio: stripTags(input.shortBio || "").slice(0, 1200),
    longBio: stripTags(input.longBio || "").slice(0, 5000),
    topicTitle: stripTags(input.topicTitle || "").slice(0, 240),
    topicDescription: stripTags(input.topicDescription || "").slice(0, 8000),
    note: stripTags(input.note || "").slice(0, 2000)
  };
  const decision = clean(input.decision || "").toLowerCase() === "approved" ? "approved" : "corrections";
  const ipAddress = clientIp(request);
  const userAgent = stripTags(request.rawRequest?.headers?.["user-agent"] || "").slice(0, 500);
  const now = FieldValue.serverTimestamp();
  await db.collection("speakerApprovals").doc(approvalId).set({
    status: "submitted",
    submitted,
    speakerDecision: decision,
    speakerApprovedAt: decision === "approved" ? now : null,
    speakerApprovedIpAddress: decision === "approved" ? ipAddress : null,
    speakerApprovedIpHash: decision === "approved" && ipAddress ? hashToken(ipAddress).slice(0, 32) : null,
    submissionIpAddress: ipAddress,
    submissionIpHash: ipAddress ? hashToken(ipAddress).slice(0, 32) : "",
    submissionUserAgent: userAgent,
    submittedAt: now,
    updatedAt: now
  }, { merge: true });
  await db.collection("speakerApprovalSubmissions").add({ approvalId, eventId: approval.eventId, topicId: approval.topicId, speakerId: approval.speakerId, speakerEmail: approval.speakerEmail || "", submitted, decision, ipAddress, ipHash: ipAddress ? hashToken(ipAddress).slice(0, 32) : "", userAgent, createdAt: now });
  return { ok: true, status: "submitted", decision };
});

exports.reviewSpeakerApproval = onCall({ region }, async (request) => {
  const approvalId = clean(request.data?.approvalId || request.data?.id || "");
  const action = clean(request.data?.action || "").toLowerCase();
  if (!approvalId || !["apply", "approve", "reset"].includes(action)) {
    throw new HttpsError("invalid-argument", "Freigabeaktion ist unvollstaendig.");
  }
  const actorProfile = action === "reset" ? await requireAdmin(request) : await requireEditor(request);
  const approvalRef = db.collection("speakerApprovals").doc(approvalId);
  const approvalSnapshot = await approvalRef.get();
  if (!approvalSnapshot.exists) throw new HttpsError("not-found", "Referentenfreigabe wurde nicht gefunden.");
  const approval = { id: approvalSnapshot.id, ...approvalSnapshot.data() };
  if (!approval.speakerId || !approval.topicId || !approval.eventId) {
    throw new HttpsError("failed-precondition", "Referent, Vortrag oder Veranstaltung fehlt.");
  }
  const now = FieldValue.serverTimestamp();
  const actorEmail = actorProfile.email || request.auth.token.email || "";
  const auditRef = db.collection("auditLog").doc();
  const batch = db.batch();
  if (action === "reset") {
    const submissions = await db.collection("speakerApprovalSubmissions").where("approvalId", "==", approvalId).limit(100).get();
    submissions.docs.forEach((snapshot) => batch.delete(snapshot.ref));
    batch.delete(approvalRef);
    batch.set(auditRef, {
      action: "reset_speaker_approval",
      module: "events",
      entityType: "speakerApproval",
      entityId: approvalId,
      eventId: approval.eventId,
      topicId: approval.topicId,
      speakerId: approval.speakerId,
      userId: request.auth.uid,
      userEmail: actorProfile.email || request.auth.token.email || "",
      timestamp: now,
      details: { deletedSubmissions: submissions.size }
    });
    await batch.commit();
    return { ok: true, status: "reset" };
  }
  const completionMailRef = db.collection("mailQueue").doc();
  await db.runTransaction(async (transaction) => {
    const latestSnapshot = await transaction.get(approvalRef);
    if (!latestSnapshot.exists) throw new HttpsError("not-found", "Referentenfreigabe wurde nicht gefunden.");
    const latestApproval = { id: latestSnapshot.id, ...latestSnapshot.data() };
    const submitted = latestApproval.submitted || {};
    const recipientEmail = mailAddress(submitted.email || latestApproval.speakerEmail || "").toLowerCase();
    if (!recipientEmail) throw new HttpsError("failed-precondition", "Die E-Mail-Adresse des Referenten fehlt.");
    if (action === "apply" && (latestApproval.status !== "submitted" || !latestApproval.submitted)) {
      throw new HttpsError("already-exists", "Diese Änderungen wurden bereits freigegeben und veröffentlicht.");
    }
    if (action === "approve" && latestApproval.status !== "applied") {
      throw new HttpsError("already-exists", "Dieser Freigabevorgang wurde bereits abgeschlossen.");
    }
    if (action === "apply") {
      const name = stripTags(submitted.speakerName || "").slice(0, 180);
      const nameParts = name.split(/\s+/).filter(Boolean);
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
      const lastName = nameParts.length ? nameParts[nameParts.length - 1] : "";
      transaction.set(db.collection("speakers").doc(latestApproval.speakerId), {
        name,
        firstName,
        lastName,
        company: stripTags(submitted.company || "").slice(0, 180),
        position: stripTags(submitted.position || "").slice(0, 180),
        email: mailAddress(submitted.email || "").toLowerCase().slice(0, 320),
        phone: stripTags(submitted.phone || "").slice(0, 80),
        linkedIn: stripTags(submitted.linkedIn || "").slice(0, 1000),
        shortBio: stripTags(submitted.shortBio || "").slice(0, 1200),
        longBio: stripTags(submitted.longBio || "").slice(0, 5000),
        updatedAt: now,
        updatedBy: request.auth.uid
      }, { merge: true });
      const topicDescription = stripTags(submitted.topicDescription || "").slice(0, 8000);
      transaction.set(db.collection("topics").doc(latestApproval.topicId), {
        title: stripTags(submitted.topicTitle || "").slice(0, 240),
        description: topicDescription,
        longDescription: topicDescription,
        updatedAt: now,
        updatedBy: request.auth.uid
      }, { merge: true });
    }
    transaction.set(approvalRef, {
      status: "approved",
      ...(action === "apply" ? { appliedAt: now, appliedBy: request.auth.uid, appliedByEmail: actorEmail } : {}),
      approvedAt: now,
      approvedBy: request.auth.uid,
      approvedByEmail: actorEmail,
      completionMailQueueId: completionMailRef.id,
      completionMailStatus: "queued",
      completedAt: now,
      updatedAt: now
    }, { merge: true });
    transaction.set(completionMailRef, {
      type: "speaker_approval_completed",
      template: "speaker_approval_completed",
      speakerApprovalId: approvalId,
      eventId: latestApproval.eventId,
      topicId: latestApproval.topicId,
      speakerId: latestApproval.speakerId,
      to: recipientEmail,
      subject: "Ihre Änderungen wurden übernommen",
      speakerName: stripTags(submitted.speakerName || latestApproval.speakerName || "").slice(0, 180),
      eventTitle: latestApproval.eventTitle || "PROdigitalTV Veranstaltung",
      topicTitle: stripTags(submitted.topicTitle || latestApproval.topicTitle || "Vortrag").slice(0, 240),
      status: "queued",
      queuedAt: now,
      createdAt: now,
      updatedAt: now
    });
    transaction.set(auditRef, {
      action: action === "apply" ? "apply_and_approve_speaker_approval" : "approve_speaker_approval",
      module: "events",
      entityType: "speakerApproval",
      entityId: approvalId,
      eventId: latestApproval.eventId,
      topicId: latestApproval.topicId,
      speakerId: latestApproval.speakerId,
      userId: request.auth.uid,
      userEmail: actorEmail,
      timestamp: now,
      details: { completionMailQueueId: completionMailRef.id, completionMailTo: recipientEmail }
    });
  });
  return { ok: true, status: "approved", completionMailQueueId: completionMailRef.id };
});
const eventFeedbackQuestions = [
  { id: "relevance", type: "single", title: "Wie relevant war die Veranstaltung für Sie persönlich oder beruflich?", options: ["Sehr relevant", "Eher relevant", "Teilweise relevant", "Weniger relevant", "Nicht relevant"], commentPrompt: "Was war für Sie besonders relevant – oder was hat gefehlt?" },
  { id: "benefit", type: "multiple", title: "Was war für Sie der größte Nutzen der Veranstaltung?", options: ["Neue Kontakte", "Fachlicher Input", "Austausch mit anderen Gästen", "Einblick in aktuelle Branchenthemen", "Inspiration für eigene Projekte", "Sichtbarkeit / eigene Positionierung", "Sonstiges"], commentPrompt: "Welcher konkrete Moment, Kontakt oder Inhalt war für Sie besonders wertvoll?" },
  { id: "industry_fit", type: "single", title: "Wie gut passten Thema, Gäste und Format zur aktuellen Entwicklung der Medienbranche?", options: ["Sehr gut", "Gut", "Teilweise", "Eher weniger", "Gar nicht"], commentPrompt: "Welche Themen sollten wir künftig stärker aufgreifen?" },
  { id: "attend_again", type: "single", title: "Würden Sie an einer weiteren PROdigitalTV-Veranstaltung teilnehmen?", options: ["Ja, auf jeden Fall", "Wahrscheinlich ja", "Vielleicht", "Eher nicht", "Nein"], commentPrompt: "Was müsste eine nächste Veranstaltung bieten, damit sie für Sie besonders interessant ist?" },
  { id: "membership_interest", type: "single", title: "Könnten Sie sich vorstellen, Teil des PROdigitalTV-Netzwerks zu werden?", options: ["Ja, als persönliches Mitglied", "Ja, für mein Unternehmen interessant", "Vielleicht, ich möchte mehr Informationen", "Derzeit eher nicht", "Nein"], commentPrompt: "Was müsste PROdigitalTV Ihnen oder Ihrem Unternehmen konkret bieten, damit eine Mitgliedschaft interessant wird?" }
];

function normalizedEventFeedbackQuestions(eventRecord = {}, registration = {}) {
  const custom = Array.isArray(eventRecord.feedbackQuestions) ? eventRecord.feedbackQuestions : [];
  const byId = new Map(custom.map((question) => [clean(question.id), question]));
  const questions = eventFeedbackQuestions.map((base) => {
    const customQuestion = byId.get(base.id) || {};
    const options = Array.isArray(customQuestion.options)
      ? customQuestion.options.map(clean).filter(Boolean).slice(0, 12)
      : base.options;
    return {
      ...base,
      title: clean(customQuestion.title) || base.title,
      commentPrompt: clean(customQuestion.commentPrompt) || base.commentPrompt,
      options: options.length ? options : base.options
    };
  });
  if (registration.isMember === true || registration.registrationAudienceType === "member" || registration.matchedMemberId) {
    return questions.filter((question) => question.id !== "membership_interest");
  }
  return questions;
}

function eventFeedbackFollowUpStatus(answer = "") {
  const value = clean(answer);
  return {
    "Ja, als persönliches Mitglied": "personal_membership_interest",
    "Ja, für mein Unternehmen interessant": "corporate_membership_interest",
    "Vielleicht, ich möchte mehr Informationen": "send_information_and_follow_up",
    "Derzeit eher nicht": "keep_as_event_contact",
    "Nein": "no_membership_follow_up"
  }[value] || "open";
}

async function registrationByFeedbackToken(token = "") {
  const cleanedToken = clean(token);
  if (!cleanedToken) throw new HttpsError("invalid-argument", "Feedback-Link ist unvollstaendig.");
  const tokenHash = hashToken(cleanedToken);
  let snapshot = await db.collection("registrations").where("feedbackTokenHash", "==", tokenHash).limit(1).get();
  let tokenReference = "feedbackTokenHash";
  if (snapshot.empty) {
    snapshot = await db.collection("registrations").where("feedbackTokenHashes", "array-contains", tokenHash).limit(1).get();
    tokenReference = "feedbackTokenHashes";
  }
  if (snapshot.empty) throw new HttpsError("not-found", "Feedback-Link wurde nicht gefunden.");
  const document = snapshot.docs[0];
  const registration = { id: document.id, ...document.data() };
  if (["cancelled", "expired", "deleted"].includes(clean(registration.status).toLowerCase())) throw new HttpsError("failed-precondition", "Diese Anmeldung ist nicht mehr aktiv.");
  return { document, registration, tokenHash, tokenReference };
}

function feedbackGuestPayload(registration = {}) {
  const name = compactNameParts(registration) || clean(registration.name || registration.personName || registration.email || "");
  return {
    guestId: registration.id || registration.registrationId || "",
    registrationId: registration.id || registration.registrationId || "",
    guestName: name,
    guestEmail: clean(registration.email || ""),
    guestCompany: clean(registration.company || "")
  };
}

exports.getEventFeedbackByToken = onCall({ region, invoker: "public" }, async (request) => {
  const token = clean(request.data?.token || "");
  const { registration, tokenReference } = await registrationByFeedbackToken(token);
  const eventSnapshot = registration.eventId ? await db.collection("events").doc(registration.eventId).get().catch(() => null) : null;
  const eventRecord = eventSnapshot?.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : { id: registration.eventId || "", title: registration.eventTitle || "" };
  const feedbackSnapshot = await db.collection("event_feedback").doc(`event-feedback-${registration.id}`).get().catch(() => null);
  return {
    ok: true,
    feedback: feedbackSnapshot?.exists ? { id: feedbackSnapshot.id, ...feedbackSnapshot.data() } : null,
    event: {
      id: eventRecord.id || registration.eventId || "",
      title: eventRecord.title || registration.eventTitle || "PROdigitalTV Veranstaltung",
      date: eventRecord.date || registration.eventDate || "",
      locationName: eventRecord.locationName || "",
      city: eventRecord.city || ""
    },
    guest: feedbackGuestPayload(registration),
    tokenReference,
    questions: normalizedEventFeedbackQuestions(eventRecord, registration)
  };
});

exports.submitEventFeedback = onCall({ region, invoker: "public" }, async (request) => {
  const token = clean(request.data?.token || "");
  const rawAnswers = request.data?.answers && typeof request.data.answers === "object" ? request.data.answers : {};
  const rawComments = request.data?.comments && typeof request.data.comments === "object" ? request.data.comments : {};
  const contactConsent = clean(request.data?.contactConsent || "");
  const { registration, tokenHash, tokenReference } = await registrationByFeedbackToken(token);
  const eventSnapshot = registration.eventId ? await db.collection("events").doc(registration.eventId).get().catch(() => null) : null;
  const eventRecord = eventSnapshot?.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : {};
  const feedbackQuestions = normalizedEventFeedbackQuestions(eventRecord, registration);
  const answers = {};
  const comments = {};
  for (const question of feedbackQuestions) {
    const raw = rawAnswers[question.id];
    if (question.type === "multiple") {
      answers[question.id] = (Array.isArray(raw) ? raw : [raw]).map(clean).filter((value) => question.options.includes(value)).slice(0, question.options.length);
      if (!answers[question.id].length) throw new HttpsError("invalid-argument", "Bitte alle Feedbackfragen beantworten.");
    } else {
      const answer = clean(raw);
      if (!question.options.includes(answer)) throw new HttpsError("invalid-argument", "Bitte alle Feedbackfragen beantworten.");
      answers[question.id] = answer;
    }
    comments[question.id] = stripTags(rawComments[question.id] || "").slice(0, 3000);
  }
  if (contactConsent && !["Ja", "Nein"].includes(contactConsent)) throw new HttpsError("invalid-argument", "Kontaktfreigabe ist ungueltig.");
  const followUpStatus = answers.membership_interest ? eventFeedbackFollowUpStatus(answers.membership_interest) : "keep_as_event_contact";
  const now = FieldValue.serverTimestamp();
  const guest = feedbackGuestPayload(registration);
  const feedbackRef = db.collection("event_feedback").doc(`event-feedback-${registration.id}`);
  const existing = await feedbackRef.get().catch(() => null);
  await feedbackRef.set({
    id: feedbackRef.id,
    eventId: registration.eventId || "",
    guestId: registration.id,
    registrationId: registration.id,
    tokenId: tokenReference,
    tokenReference,
    tokenHashPrefix: tokenHash.slice(0, 12),
    ...guest,
    answers,
    comments,
    contactConsent,
    followUpStatus,
    manualStatus: existing?.exists ? clean(existing.data()?.manualStatus || "offen") : "offen",
    submittedAt: now,
    createdAt: existing?.exists ? existing.data()?.createdAt || now : now,
    updatedAt: now
  }, { merge: true });
  await db.collection("registrations").doc(registration.id).set({ feedbackSubmittedAt: now, feedbackFollowUpStatus: followUpStatus, updatedAt: now }, { merge: true });
  return { ok: true, followUpStatus };
});

async function queueEventFeedbackInvitationsForEvent({ eventId, eventRecord, rawRegistrationIds = [], createdBy = "system", createdByEmail = "" }) {
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  let registrations = [];
  if (rawRegistrationIds.length) {
    const ids = [...new Set(rawRegistrationIds.map(clean).filter(Boolean))].slice(0, 200);
    const snapshots = await Promise.all(ids.map((id) => db.collection("registrations").doc(id).get().catch(() => null)));
    registrations = snapshots.filter((snapshot) => snapshot?.exists).map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })).filter((item) => item.eventId === eventId);
  } else {
    const snapshot = await db.collection("registrations").where("eventId", "==", eventId).limit(500).get();
    registrations = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  }
  registrations = registrations.filter((registration) => {
    const status = clean(registration.status).toLowerCase();
    const eligibleStatus = ["confirmed", "checked_in", "attended"].includes(status) || registration.emailConfirmed === true;
    return clean(registration.email).includes("@") && eligibleStatus && !["cancelled", "expired", "deleted"].includes(status);
  });
  let queued = 0;
  const skipped = [];
  const results = [];
  for (const registration of registrations) {
    try {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const feedbackUrl = eventFeedbackUrl(token);
      await db.collection("registrations").doc(registration.id).set({
        feedbackTokenHash: tokenHash,
        feedbackTokenHashes: FieldValue.arrayUnion(tokenHash),
        feedbackTokenIssuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      const mailRef = await queueMail({
        type: "event_feedback_invitation",
        template: "event_feedback_invitation",
        to: registration.email,
        subject: `Ihre Rueckmeldung zu ${eventRecord.title || registration.eventTitle || "PROdigitalTV Veranstaltung"}`,
        eventId,
        registrationId: registration.id,
        feedbackUrl,
        link: feedbackUrl,
        eventTitle: eventRecord.title || registration.eventTitle || "",
        firstName: registration.firstName || "",
        lastName: registration.lastName || "",
        personName: compactNameParts(registration),
        createdBy,
        createdByEmail
      });
      queued += 1;
      results.push({ registrationId: registration.id, email: registration.email, mailQueueId: mailRef.id, status: "queued" });
    } catch (error) {
      skipped.push({ registrationId: registration.id, email: registration.email || "", reason: error?.message || String(error) });
    }
  }
  await db.collection("auditLog").add({
    action: "send_event_feedback_invitations",
    entityType: "event",
    entityId: eventId,
    userId: createdBy,
    userEmail: createdByEmail,
    details: { queued, skipped: skipped.length, requested: registrations.length },
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, eventId, queued, skipped: skipped.length, results, skippedItems: skipped };
}

exports.sendEventFeedbackInvitations = onCall({ region }, async (request) => {
  const actorProfile = await requireEditor(request);
  const eventId = clean(request.data?.eventId || "");
  const rawRegistrationIds = Array.isArray(request.data?.registrationIds) ? request.data.registrationIds : [];
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
  return queueEventFeedbackInvitationsForEvent({
    eventId,
    eventRecord: { id: eventSnapshot.id, ...eventSnapshot.data() },
    rawRegistrationIds,
    createdBy: request.auth.uid,
    createdByEmail: actorProfile.email || request.auth.token.email || ""
  });
});
exports.sendMemberStrategyInvitation = onCall({ region }, async (request) => {
  const actorProfile = await requireAdmin(request);
  const input = request.data || {};
  const testOnly = input.testOnly === true;
  const previewOnly = input.previewOnly === true;
  const subject = clean(input.subject || "Ihre Meinung zur Zukunft von PROdigitalTV").slice(0, 180);
  const introText = clean(input.introText || "PROdigitalTV entwickelt die Zukunftsstrategie 2027–2030 gemeinsam mit seinen Mitgliedern. Bitte nehmen Sie sich einige Minuten für die Fragen und Ihre Vorschläge.").slice(0, 4000);
  const link = publicHashUrl("portal?tab=strategy");
  const targets = testOnly
    ? await notificationTestGroupTargets()
    : await eventNotificationTargets("", { recipientGroup: "members", includeMembers: true });
  if (!targets.length) throw new HttpsError("failed-precondition", testOnly ? "Bitte mindestens eine gueltige Adresse in der Testgruppe speichern." : "Keine mailingfaehigen Mitglieder gefunden.");
  if (previewOnly) {
    return {
      ok: true,
      previewOnly: true,
      testOnly,
      targetCount: targets.length,
      mailCount: targets.length,
      recipientEmails: testOnly ? targets.map((target) => target.email) : [],
      link
    };
  }
  let queued = 0;
  for (const target of targets) {
    await queueMail({
      type: "member_strategy_invitation",
      template: "member_communication",
      to: target.email,
      subject,
      title: subject,
      introText,
      link,
      linkLabel: "Zukunftsstrategie öffnen",
      personName: clean(`${target.firstName || ""} ${target.lastName || ""}`) || target.name || target.company || "",
      firstName: target.firstName || "",
      displayName: target.displayName || clean(`${target.firstName || ""} ${target.lastName || ""}`),
      lastName: target.lastName || "",
      company: target.company || "",
      memberId: target.memberId || "",
      audienceType: testOnly ? "test" : target.audienceType || "member",
      testOnly
    });
    queued += 1;
  }
  const mailingId = `member-strategy-${testOnly ? "test" : "live"}-${Date.now()}`;
  await db.collection("auditLog").add({
    action: "send_member_strategy_invitation",
    entityType: "memberStrategy",
    entityId: "zukunftsstrategie-2027-2030",
    userId: request.auth.uid,
    userEmail: actorProfile.email || request.auth.token.email || "",
    details: { targetCount: targets.length, queuedMailCount: queued, mailingId, testOnly, subject, link },
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, targetCount: targets.length, queuedMailCount: queued, mailingId, testOnly, link };
});
exports.sendMemberCommunication = onCall({ region }, async (request) => {
  const articleId = clean(request.data?.articleId || request.data?.id || "");
  const testOnly = request.data?.testOnly === true;
  const previewOnly = request.data?.previewOnly === true;
  const actorProfile = testOnly || previewOnly ? await requireEditor(request) : await requireAdmin(request);
  if (!articleId) throw new HttpsError("invalid-argument", "Beitrag fehlt.");
  const snapshot = await db.collection("editorialContent").doc(articleId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Mitglieder-News wurde nicht gefunden.");
  const article = { id: snapshot.id, ...snapshot.data() };
  const status = clean(article.status || "").toLowerCase();
  const visibility = clean(article.visibility || "").toLowerCase();
  const isMemberCommunication = article.section === "member-communication"
    || article.publication_target === "member-communication"
    || article.publicationTarget === "member-communication"
    || article.communicationType === "member-news"
    || article.contentType === "member-news";
  if (!isMemberCommunication) throw new HttpsError("failed-precondition", "Dieser Beitrag ist keine Mitglieder-News.");
  if (status !== "published") throw new HttpsError("failed-precondition", "Bitte den Beitrag vor dem Versand veroeffentlichen.");
  if (visibility !== "members") throw new HttpsError("failed-precondition", "Mitglieder-News muessen Sichtbarkeit 'members' haben.");
  if (!testOnly && !previewOnly && (article.memberCommunicationSentAt || article.memberCommunicationMailingId)) {
    throw new HttpsError("already-exists", "Diese Mitglieder-News wurde bereits versendet.");
  }
  const targets = testOnly
    ? await notificationTestGroupTargets()
    : await eventNotificationTargets("", { recipientGroup: "members", includeMembers: true });
  if (!targets.length) throw new HttpsError("failed-precondition", testOnly ? "Bitte mindestens eine gueltige Adresse in der Testgruppe speichern." : "Keine mailingfaehigen Mitglieder gefunden.");
  if (previewOnly) {
    return {
      ok: true,
      previewOnly: true,
      testOnly,
      articleId: article.id,
      targetCount: targets.length,
      mailCount: targets.length,
      recipientEmails: testOnly ? targets.map((target) => target.email) : []
    };
  }
  const title = clean(article.title || "Mitglieder-News von PROdigitalTV");
  const link = publicHashUrl(`portal/article/${encodeURIComponent(article.id)}`);
  let queued = 0;
  for (const target of targets) {
    await queueMail({
      type: "member_communication",
      template: "member_communication",
      to: target.email,
      subject: title,
      articleId: article.id,
      editorialContentId: article.id,
      title,
      subtitle: article.subtitle || "",
      introText: article.introText || article.shortText || article.bodyText || "",
      imageUrl: article.imageUrl || article.thumbnailUrl || article.thumbnail_url || "",
      link,
      personName: clean(`${target.firstName || ""} ${target.lastName || ""}`) || target.name || target.company || "",
      firstName: target.firstName || "",
      displayName: target.displayName || clean(`${target.firstName || ""} ${target.lastName || ""}`),
      lastName: target.lastName || "",
      company: target.company || "",
      memberId: target.memberId || "",
      audienceType: testOnly ? "test" : target.audienceType || "member",
      testOnly
    });
    queued += 1;
  }
  const mailingId = `member-communication-${testOnly ? "test" : "live"}-${article.id}-${Date.now()}`;
  if (!testOnly) {
    await db.collection("editorialContent").doc(article.id).set({
      memberCommunicationMailingId: mailingId,
      memberCommunicationSentAt: FieldValue.serverTimestamp(),
      memberCommunicationQueuedMailCount: queued,
      memberCommunicationTargetCount: targets.length,
      memberCommunicationSentBy: request.auth.uid,
      memberCommunicationSentByEmail: actorProfile.email || request.auth.token.email || "",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await db.collection("auditLog").add({
    action: "send_member_communication",
    entityType: "editorialContent",
    entityId: article.id,
    userId: request.auth.uid,
    userEmail: actorProfile.email || request.auth.token.email || "",
    details: { targetCount: targets.length, queuedMailCount: queued, mailingId, testOnly },
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, articleId: article.id, targetCount: targets.length, queuedMailCount: queued, mailingId, testOnly };
});
exports.createMemberLogin = onCall({ region }, async (request) => {
  const adminProfile = await requireAdmin(request);
  const input = request.data?.input || {};
  const accountType = clean(input.accountType || (clean(input.memberId) ? "member" : "external")).toLowerCase() === "external" ? "external" : "member";
  const memberId = accountType === "external" ? "" : clean(input.memberId);
  const email = clean(input.email).toLowerCase();
  const requestedRole = clean(input.role || (accountType === "external" ? "editor" : "member")).toLowerCase();
  const role = ["admin", "editor", "member"].includes(requestedRole) ? requestedRole : "";
  const invitationDelivery = clean(input.invitationDelivery || "manual").toLowerCase() === "auto" ? "auto" : "manual";
  if (accountType === "member" && !memberId) throw new HttpsError("invalid-argument", "Bitte ein Mitglied auswaehlen.");
  if (!email || !email.includes("@")) throw new HttpsError("invalid-argument", "Bitte eine gueltige Mailadresse eintragen.");
  if (!role) throw new HttpsError("invalid-argument", "Bitte eine gueltige Rolle auswaehlen.");
  if (accountType === "external" && !["admin", "editor"].includes(role)) throw new HttpsError("invalid-argument", "Externe Zugaenge ohne Mitglied duerfen nur Editor oder Admin sein.");
  let member = null;
  if (memberId) {
    const memberSnapshot = await db.collection("members").doc(memberId).get();
    if (!memberSnapshot.exists) throw new HttpsError("not-found", "Mitglied wurde nicht gefunden.");
    member = { id: memberSnapshot.id, ...memberSnapshot.data() };
  }
  const displayName = clean(input.displayName || member?.profileContactName || member?.contactName || member?.name || email);
  const memberName = clean(member?.name || member?.company || member?.profileContactName || input.organization || (accountType === "external" ? "CMS-Zugang ohne Mitglied" : memberId));
  const auth = getAuth();
  let authUser;
  let created = false;
  try {
    authUser = await auth.getUserByEmail(email);
    await auth.updateUser(authUser.uid, { email, displayName, disabled: false });
    authUser = await auth.getUser(authUser.uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    const temporaryPassword = randomBytes(24).toString("hex");
    authUser = await auth.createUser({ email, password: temporaryPassword, displayName, emailVerified: false, disabled: false });
    created = true;
  }
  const invitationToken = randomBytes(32).toString("hex");
  const invitationId = `user-invite-${Date.now()}-${randomBytes(5).toString("hex")}`;
  const expiresAtDate = memberInvitationExpiresAtDate();
  const invitation = {
    id: invitationId,
    uid: authUser.uid,
    email,
    displayName,
    role,
    memberId,
    memberName,
    accountType,
    invitationLink: memberInvitationLink(invitationId, invitationToken),
    tokenHash: hashToken(invitationToken),
    status: "pending",
    deliveryMode: invitationDelivery,
    mailStatus: invitationDelivery === "auto" ? "queued" : "manual",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAtDate),
    createdBy: request.auth.uid,
    createdByEmail: adminProfile.email || request.auth.token.email || ""
  };
  await db.collection("userInvitations").doc(invitationId).set(invitation);
  const userRecord = {
    email,
    displayName,
    role,
    status: "active",
    memberId,
    accountType,
    providerId: "password",
    emailVerified: Boolean(authUser.emailVerified),
    invitationId,
    invitationStatus: "pending",
    invitationDelivery,
    invitationMailStatus: invitationDelivery === "auto" ? "queued" : "manual",
    invitationExpiresAt: Timestamp.fromDate(expiresAtDate),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
    updatedByEmail: adminProfile.email || request.auth.token.email || "",
    createdVia: created ? "cms_member_login_create" : "cms_member_login_update"
  };
  if (created) userRecord.createdAt = FieldValue.serverTimestamp();
  await db.collection("users").doc(authUser.uid).set(userRecord, { merge: true });
  if (memberId && member) {
    const memberUserLink = {
      uid: authUser.uid,
      email,
      displayName,
      role
    };
    const memberUpdate = {
      linkedUserIds: FieldValue.arrayUnion(authUser.uid),
      linkedUserEmails: FieldValue.arrayUnion(email),
      linkedUsers: FieldValue.arrayUnion(memberUserLink),
      updatedAt: FieldValue.serverTimestamp()
    };
    if (!member.linkedUserId) {
      memberUpdate.linkedUserId = authUser.uid;
      memberUpdate.linkedUserEmail = email;
    }
    await db.collection("members").doc(memberId).set(memberUpdate, { merge: true });
  }
  if (invitationDelivery === "auto") {
    const mailTemplatesSnapshot = await db.collection("settings").doc("mailTemplates").get().catch(() => null);
    const templates = mailTemplateSettings(mailTemplatesSnapshot?.exists ? mailTemplatesSnapshot.data() : {});
    await queueMemberLoginInvitationMail(invitation, templates.memberLoginInvitation);
  }
  await db.collection("auditLog").add({
    action: created ? "create_member_login" : "update_member_login",
    module: "users",
    entityType: "user",
    entityId: authUser.uid,
    userId: request.auth.uid,
    userEmail: adminProfile.email || request.auth.token.email || "",
    timestamp: FieldValue.serverTimestamp(),
    details: { memberId, email, role, accountType, invitationId, invitationDelivery }
  });
  return { ok: true, created, uid: authUser.uid, email, memberId, displayName, role, accountType, invitationId, invitationDelivery, invitationMailStatus: invitation.invitationMailStatus || invitation.mailStatus, invitationLink: invitation.invitationLink };
});

exports.sendMemberLoginInvitation = onCall({ region }, async (request) => {
  const adminProfile = await requireAdmin(request);
  const invitationId = clean(request.data?.invitationId || request.data?.input?.invitationId || "");
  if (!invitationId) throw new HttpsError("invalid-argument", "Einladungs-ID fehlt.");
  const snapshot = await db.collection("userInvitations").doc(invitationId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Einladung wurde nicht gefunden.");
  let invitation = { id: snapshot.id, ...snapshot.data() };
  if (invitation.status === "accepted") throw new HttpsError("failed-precondition", "Diese Einladung wurde bereits angenommen.");
  if (!invitation.invitationLink || !invitation.email) throw new HttpsError("failed-precondition", "Einladung ist unvollstaendig.");
  const expiresAt = invitation.expiresAt?.toDate ? invitation.expiresAt.toDate() : new Date(invitation.expiresAt || 0);
  if (expiresAt && expiresAt.getTime && expiresAt.getTime() < Date.now()) {
    const invitationToken = randomBytes(32).toString("hex");
    const expiresAtDate = memberInvitationExpiresAtDate();
    invitation = {
      ...invitation,
      invitationLink: memberInvitationLink(invitationId, invitationToken),
      tokenHash: hashToken(invitationToken),
      status: "pending",
      expiresAt: Timestamp.fromDate(expiresAtDate)
    };
    await db.collection("userInvitations").doc(invitationId).set({
      invitationLink: invitation.invitationLink,
      tokenHash: invitation.tokenHash,
      status: "pending",
      expiresAt: invitation.expiresAt,
      renewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection("users").doc(invitation.uid).set({
      invitationStatus: "pending",
      invitationExpiresAt: invitation.expiresAt,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  const mailTemplatesSnapshot = await db.collection("settings").doc("mailTemplates").get().catch(() => null);
  const templates = mailTemplateSettings(mailTemplatesSnapshot?.exists ? mailTemplatesSnapshot.data() : {});
  const ref = await queueMemberLoginInvitationMail(invitation, templates.memberLoginInvitation);
  await db.collection("auditLog").add({
    action: "send_member_login_invitation",
    module: "users",
    entityType: "userInvitation",
    entityId: invitationId,
    userId: request.auth.uid,
    userEmail: adminProfile.email || request.auth.token.email || "",
    timestamp: FieldValue.serverTimestamp(),
    details: { invitationId, mailQueueId: ref.id, email: invitation.email, role: invitation.role }
  });
  return { ok: true, invitationId, mailQueueId: ref.id, email: invitation.email };
});

async function prepareMemberLoginInvitationForUser(userId = "", adminProfile = {}, adminUid = "") {
  const userSnapshot = await db.collection("users").doc(userId).get();
  if (!userSnapshot.exists) return { status: "skipped", reason: "user_not_found", userId };
  const user = { id: userSnapshot.id, ...userSnapshot.data() };
  const email = clean(user.email).toLowerCase();
  if (!email || !email.includes("@")) return { status: "skipped", reason: "email_missing", userId };
  if (user.invitationStatus === "accepted") return { status: "skipped", reason: "already_accepted", userId, email };

  const memberId = clean(user.memberId || user.memberProfileId || "");
  const memberSnapshot = memberId ? await db.collection("members").doc(memberId).get().catch(() => null) : null;
  const member = memberSnapshot?.exists ? { id: memberSnapshot.id, ...memberSnapshot.data() } : {};
  const displayName = clean(user.displayName || member.profileContactName || member.contactName || member.name || email);
  const memberName = clean(member.name || member.company || member.title || member.id || memberId);
  const role = ["admin", "editor", "member"].includes(clean(user.role).toLowerCase()) ? clean(user.role).toLowerCase() : "member";

  let invitation = null;
  if (user.invitationId) {
    const invitationSnapshot = await db.collection("userInvitations").doc(user.invitationId).get().catch(() => null);
    if (invitationSnapshot?.exists) invitation = { id: invitationSnapshot.id, ...invitationSnapshot.data() };
  }
  if (invitation?.status === "accepted") return { status: "skipped", reason: "already_accepted", userId, email };

  const expiresAt = invitation?.expiresAt?.toDate ? invitation.expiresAt.toDate() : new Date(invitation?.expiresAt || 0);
  const needsNewToken = !invitation || !invitation.invitationLink || !invitation.tokenHash || (expiresAt?.getTime && expiresAt.getTime() < Date.now());
  if (needsNewToken) {
    const invitationId = invitation?.id || `user-invite-${Date.now()}-${randomBytes(5).toString("hex")}`;
    const invitationToken = randomBytes(32).toString("hex");
    const expiresAtDate = memberInvitationExpiresAtDate();
    invitation = {
      ...(invitation || {}),
      id: invitationId,
      uid: user.id,
      email,
      displayName,
      role,
      memberId,
      memberName,
      accountType,
      invitationLink: memberInvitationLink(invitationId, invitationToken),
      tokenHash: hashToken(invitationToken),
      status: "pending",
      deliveryMode: "manual",
      mailStatus: "queued",
      expiresAt: Timestamp.fromDate(expiresAtDate)
    };
    await db.collection("userInvitations").doc(invitationId).set({
      ...invitation,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: invitation.createdAt || FieldValue.serverTimestamp(),
      createdBy: invitation.createdBy || adminUid,
      createdByEmail: invitation.createdByEmail || adminProfile.email || ""
    }, { merge: true });
    await db.collection("users").doc(user.id).set({
      invitationId,
      invitationStatus: "pending",
      invitationDelivery: "manual",
      invitationMailStatus: "queued",
      invitationExpiresAt: invitation.expiresAt,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  return { status: "ready", invitation };
}

exports.sendMemberLoginInvitationsForUsers = onCall({ region }, async (request) => {
  const adminProfile = await requireAdmin(request);
  const rawUserIds = request.data?.userIds || request.data?.input?.userIds || [];
  const userIds = [...new Set((Array.isArray(rawUserIds) ? rawUserIds : []).map(clean).filter(Boolean))].slice(0, 200);
  if (!userIds.length) throw new HttpsError("invalid-argument", "Bitte mindestens einen User auswaehlen.");
  const mailTemplatesSnapshot = await db.collection("settings").doc("mailTemplates").get().catch(() => null);
  const templates = mailTemplateSettings(mailTemplatesSnapshot?.exists ? mailTemplatesSnapshot.data() : {});
  const results = [];
  for (const userId of userIds) {
    try {
      const prepared = await prepareMemberLoginInvitationForUser(userId, adminProfile, request.auth.uid);
      if (prepared.status !== "ready") {
        results.push(prepared);
        continue;
      }
      const ref = await queueMemberLoginInvitationMail(prepared.invitation, templates.memberLoginInvitation);
      results.push({
        status: "queued",
        userId,
        email: prepared.invitation.email,
        invitationId: prepared.invitation.id,
        mailQueueId: ref.id
      });
    } catch (error) {
      results.push({ status: "error", userId, reason: error?.message || String(error) });
    }
  }
  await db.collection("auditLog").add({
    action: "send_member_login_invitations_bulk",
    module: "users",
    entityType: "user",
    entityId: "bulk",
    userId: request.auth.uid,
    userEmail: adminProfile.email || request.auth.token.email || "",
    timestamp: FieldValue.serverTimestamp(),
    details: {
      requested: userIds.length,
      queued: results.filter((item) => item.status === "queued").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      errors: results.filter((item) => item.status === "error").length
    }
  });
  return {
    ok: true,
    requested: userIds.length,
    queued: results.filter((item) => item.status === "queued").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    errors: results.filter((item) => item.status === "error").length,
    results
  };
});

exports.completeMemberLoginInvitation = onCall({ region, invoker: "public" }, async (request) => {
  const invitationId = clean(request.data?.invitationId || request.data?.input?.invitationId || "");
  const token = clean(request.data?.token || request.data?.input?.token || "");
  const password = String(request.data?.password || request.data?.input?.password || "");
  if (!invitationId || !token) throw new HttpsError("invalid-argument", "Einladungslink ist unvollstaendig.");
  if (password.length < 8) throw new HttpsError("invalid-argument", "Das Passwort muss mindestens 8 Zeichen lang sein.");
  const ref = db.collection("userInvitations").doc(invitationId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Einladung wurde nicht gefunden.");
  const invitation = { id: snapshot.id, ...snapshot.data() };
  if (invitation.status === "accepted") throw new HttpsError("failed-precondition", "Diese Einladung wurde bereits angenommen.");
  if (hashToken(token) !== invitation.tokenHash) throw new HttpsError("permission-denied", "Einladungstoken ist ungueltig.");
  const expiresAt = invitation.expiresAt?.toDate ? invitation.expiresAt.toDate() : new Date(invitation.expiresAt || 0);
  if (expiresAt && expiresAt.getTime && expiresAt.getTime() < Date.now()) throw new HttpsError("deadline-exceeded", "Diese Einladung ist abgelaufen.");
  const auth = getAuth();
  await auth.updateUser(invitation.uid, { password, emailVerified: true, disabled: false });
  await db.collection("users").doc(invitation.uid).set({
    status: "active",
    role: invitation.role || "member",
    memberId: invitation.memberId || "",
    emailVerified: true,
    invitationStatus: "accepted",
    invitationAcceptedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await ref.set({
    status: "accepted",
    acceptedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true, email: invitation.email, role: invitation.role || "member", memberId: invitation.memberId || "", displayName: invitation.displayName || invitation.email || "" };
});

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

exports.getEventCheckinAccess = onCall({ region }, async (request) => {
  await requireEditor(request);
  const eventId = clean(request.data?.eventId);
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
  const eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
  if (!eventUsesHandyTicket(eventRecord)) throw new HttpsError("failed-precondition", "Der Einlass-QR ist fuer dieses Event nicht aktiviert.");
  const ref = db.collection("eventCheckinAccess").doc(eventId);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? snapshot.data() || {} : {};
  const existingExpiry = existing.expiresAt?.toMillis?.() || 0;
  const stillValid = Boolean(existing.accessToken && existing.tokenHash && existingExpiry > Date.now());
  const accessToken = stillValid ? existing.accessToken : randomBytes(32).toString("hex");
  const eventDate = new Date(`${clean(eventRecord.date || new Date().toISOString().slice(0, 10))}T23:59:59+02:00`);
  const fallbackExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const expiresAtMillis = Math.max(Number.isNaN(eventDate.getTime()) ? 0 : eventDate.getTime() + 2 * 24 * 60 * 60 * 1000, fallbackExpiry);
  if (!stillValid) {
    await ref.set({
      eventId,
      accessToken,
      tokenHash: hashToken(accessToken),
      status: "active",
      expiresAt: Timestamp.fromMillis(expiresAtMillis),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid
    }, { merge: true });
  }
  const checkinPath = `event-checkin/${encodeURIComponent(eventId)}?access=${encodeURIComponent(accessToken)}`;
  const checkinUrl = publicCheckinUrl(checkinPath);
  const [qrDataUrl, qrSvg] = await Promise.all([
    QRCode.toDataURL(checkinUrl, { width: 900, margin: 2, errorCorrectionLevel: "M" }),
    QRCode.toString(checkinUrl, { type: "svg", width: 900, margin: 2, errorCorrectionLevel: "M" })
  ]);
  return {
    eventId,
    accessToken,
    checkinUrl,
    qrDataUrl,
    qrSvg,
    checkinScreenUrl: publicCheckinUrl(`event-checkin-screen/${encodeURIComponent(eventId)}?access=${encodeURIComponent(accessToken)}`),
    expiresAt: new Date(stillValid ? existingExpiry : expiresAtMillis).toISOString()
  };
});

exports.getPublicEventCheckinQr = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId);
  const accessToken = clean(request.data?.accessToken);
  if (!eventId || !accessToken) throw new HttpsError("invalid-argument", "Einlasszugang ist unvollstaendig.");
  const accessSnapshot = await db.collection("eventCheckinAccess").doc(eventId).get();
  const access = accessSnapshot.exists ? accessSnapshot.data() || {} : {};
  const expiresAt = access.expiresAt?.toMillis?.() || 0;
  if (access.status !== "active" || !access.tokenHash || hashToken(accessToken) !== access.tokenHash) {
    throw new HttpsError("permission-denied", "Der Einlass-Link ist ungueltig.");
  }
  if (expiresAt < Date.now()) throw new HttpsError("deadline-exceeded", "Der Einlass-Link ist abgelaufen.");
  const checkinUrl = publicCheckinUrl(`event-checkin/${encodeURIComponent(eventId)}?access=${encodeURIComponent(accessToken)}`);
  const [qrDataUrl, qrSvg] = await Promise.all([
    QRCode.toDataURL(checkinUrl, { width: 900, margin: 2, errorCorrectionLevel: "M" }),
    QRCode.toString(checkinUrl, { type: "svg", width: 900, margin: 2, errorCorrectionLevel: "M" })
  ]);
  return { eventId, checkinUrl, qrDataUrl, qrSvg, expiresAt: new Date(expiresAt).toISOString() };
});

exports.createEventRegistration = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId);
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
  const eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
  if (!eventRegistrationIsOpen(eventRecord)) throw new HttpsError("failed-precondition", "Fuer dieses Event ist keine Anmeldung moeglich.");
  const input = registrationInput(request.data || {});
  const checkinMode = request.data?.checkinMode === true;
  const checkinToken = clean(request.data?.checkinToken);
  let checkinAccessExpired = false;
  if (checkinMode) {
    if (!checkinToken) throw new HttpsError("permission-denied", "Der Einlass-Link ist unvollstaendig.");
    const accessSnapshot = await db.collection("eventCheckinAccess").doc(eventRecord.id).get();
    const access = accessSnapshot.exists ? accessSnapshot.data() || {} : {};
    if (access.status !== "active" || !access.tokenHash || hashToken(checkinToken) !== access.tokenHash) {
      throw new HttpsError("permission-denied", "Der Einlass-Link ist ungueltig.");
    }
    const expiresAt = access.expiresAt?.toMillis?.() || 0;
    checkinAccessExpired = expiresAt < Date.now();
  }
  if (!input.privacyAccepted) throw new HttpsError("failed-precondition", "Bitte stimmen Sie den Datenschutzbestimmungen zu.");
  if (!input.email || !input.email.includes("@")) throw new HttpsError("invalid-argument", "Bitte geben Sie eine gueltige E-Mail-Adresse an.");
  input.phone = requiredRegistrationMobileNumber(input.phone);
  if (input.hasCompanion) {
    if (!input.companion?.firstName || !input.companion?.lastName) throw new HttpsError("invalid-argument", "Bitte geben Sie Vor- und Nachname der Begleitperson an.");
    if (!input.companion?.email || !input.companion.email.includes("@")) throw new HttpsError("invalid-argument", "Bitte geben Sie eine gueltige E-Mail-Adresse der Begleitperson an.");
    input.companion.phone = requiredRegistrationMobileNumber(input.companion.phone, "Mobilnummer der Begleitperson");
    if (input.companion.email === input.email) throw new HttpsError("invalid-argument", "Bitte verwenden Sie fuer die Begleitperson eine eigene E-Mail-Adresse.");
  }
  const bookingEmails = [input.email, input.hasCompanion ? input.companion.email : ""].filter(Boolean);
  for (const email of bookingEmails) {
    if (await blockingEventRegistrationByEmail(eventRecord.id, email)) {
      throw new HttpsError("already-exists", `${email} ist fuer dieses Event bereits angemeldet.`);
    }
  }
  if (checkinAccessExpired) throw new HttpsError("deadline-exceeded", "Der Einlass-Link ist abgelaufen.");
  const now = FieldValue.serverTimestamp();
  const bookingGroupId = input.hasCompanion ? `booking-group-${randomBytes(16).toString("hex")}` : "";
  const registrationRef = db.collection("registrations").doc(`registration-${randomBytes(16).toString("hex")}`);
  const companionRegistrationRef = input.hasCompanion ? db.collection("registrations").doc(`registration-${randomBytes(16).toString("hex")}`) : null;
  const lockRef = db.collection("registrationLocks").doc(registrationLockId(eventRecord.id, input.email));
  const companionLockRef = input.hasCompanion ? db.collection("registrationLocks").doc(registrationLockId(eventRecord.id, input.companion.email)) : null;
  const headers = request.rawRequest?.headers || {};
  const [personMatch, companionPersonMatch] = await Promise.all([
    findPersonByEmail(input.email),
    input.hasCompanion ? findPersonByEmail(input.companion.email) : Promise.resolve(null)
  ]);
  const isMemberByEmail = Boolean(personMatch.isMember);
  const companionIsMemberByEmail = Boolean(companionPersonMatch?.isMember);
  const confirmationToken = randomBytes(32).toString("hex");
  const companionConfirmationToken = input.hasCompanion ? randomBytes(32).toString("hex") : "";
  const statusToken = randomBytes(32).toString("hex");
  const companionStatusToken = input.hasCompanion ? randomBytes(32).toString("hex") : "";
  const checkinTicketToken = checkinMode ? randomBytes(32).toString("hex") : "";
  const companionCheckinTicketToken = checkinMode && input.hasCompanion ? randomBytes(32).toString("hex") : "";
  const confirmationExpiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  const primaryInput = { ...input, hasCompanion: false, companion: null, participantCount: 1 };
  const registration = {
    id: registrationRef.id,
    eventId: eventRecord.id,
    eventTitle: eventRecord.title || "",
    eventDate: eventRecord.date || "",
    eventAccessType: eventRecord.accessType || "",
    ...primaryInput,
    bookingGroupId,
    registrationRole: "primary",
    additionalRegistrationId: companionRegistrationRef?.id || "",
    phoneFormatStatus: "valid",
    phoneFormatCheckedAt: now,
    phoneVerificationStatus: "unverified",
    pushTrackingConsentAt: input.pushTrackingConsent ? now : null,
    pushTrackingConsentText: input.pushTrackingConsent ? "Freiwillige Erfassung von Push-Antippen und Aufruf der verlinkten Seite; keine Bestaetigung der Mobilnummer." : "",
    isMember: isMemberByEmail,
    existingPersonMatched: Boolean(personMatch.matched),
    personMatchSource: personMatch.source || "new",
    matchedMemberId: personMatch.memberId || "",
    matchedUserId: personMatch.userId || "",
    matchedContactId: personMatch.contactId || "",
    matchedSpeakerId: personMatch.speakerId || "",
    memberGuestAllowed: eventRecord.accessType === "members_only",
    registrationAudienceType: isMemberByEmail ? "member" : (eventRecord.accessType === "members_only" ? "member_guest" : "guest"),
    handyTicketEnabled: eventUsesHandyTicket(eventRecord),
    notificationConsentAccepted: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    notificationConsentSource: "event_registration_checkbox",
    notificationConsentText: "Freiwillige Event-Erinnerungen und Veranstaltungshinweise von PROdigitalTV per E-Mail, Browser-Push und SMS, soweit die jeweiligen Kontaktdaten bzw. die Browser-Freigabe vorhanden sind. Abmeldung ist jederzeit moeglich.",
    notificationChannels: (input.notifyForThisEvent || input.notifyFutureEvents) ? ["mail", "push", "sms"] : [],
    mailConsent: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    pushConsent: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    smsConsent: Boolean(input.notifyForThisEvent || input.notifyFutureEvents),
    emailConfirmed: false,
    status: checkinMode ? "checked_in" : "pending_email_confirmation",
    mailStatus: checkinMode ? "not_required" : "queued",
    registrationSource: checkinMode ? "event_checkin" : "online_registration",
    ...(checkinMode ? {
      checkedInEventId: eventRecord.id,
      checkedInAt: now,
      ticketTokenHash: hashToken(checkinTicketToken),
      ticketIssuedAt: now,
      ticketDeviceLinked: true,
      deviceLinkedAt: now
    } : {}),
    confirmationTokenHash: hashToken(confirmationToken),
    registrationStatusTokenHash: hashToken(statusToken),
    registrationStatusExpiresAt: confirmationExpiresAt,
    confirmationExpiresAt,
    confirmationMailQueuedAt: now,
    confirmationSmsReminderEnabled: !checkinMode,
    createdIp: clientIp(request),
    createdUserAgent: stripTags(headers["user-agent"] || ""),
    createdAt: now,
    updatedAt: now
  };
  const companionRegistration = input.hasCompanion ? {
    ...registration,
    id: companionRegistrationRef.id,
    firstName: input.companion.firstName,
    lastName: input.companion.lastName,
    email: input.companion.email,
    phone: input.companion.phone,
    linkedIn: input.companion.linkedIn || "",
    company: "",
    position: "",
    message: "",
    notifyForThisEvent: false,
    notifyFutureEvents: false,
    notificationConsentAccepted: false,
    notificationChannels: [],
    mailConsent: false,
    pushConsent: false,
    smsConsent: false,
    pushTrackingConsent: false,
    pushTrackingConsentAt: null,
    pushTrackingConsentText: "",
    isMember: companionIsMemberByEmail,
    existingPersonMatched: Boolean(companionPersonMatch?.matched),
    personMatchSource: companionPersonMatch?.source || "new",
    matchedMemberId: companionPersonMatch?.memberId || "",
    matchedUserId: companionPersonMatch?.userId || "",
    matchedContactId: companionPersonMatch?.contactId || "",
    matchedSpeakerId: companionPersonMatch?.speakerId || "",
    registrationAudienceType: companionIsMemberByEmail ? "member" : (eventRecord.accessType === "members_only" ? "member_guest" : "guest"),
    registrationRole: "additional_person",
    primaryRegistrationId: registrationRef.id,
    registeredByRegistrationId: registrationRef.id,
    registeredByEmail: input.email,
    additionalRegistrationId: "",
    registrationSource: checkinMode ? "event_checkin_additional_person" : "online_additional_person",
    confirmationTokenHash: hashToken(companionConfirmationToken),
    registrationStatusTokenHash: hashToken(companionStatusToken),
    ...(checkinMode ? {
      ticketTokenHash: hashToken(companionCheckinTicketToken),
      ticketIssuedAt: now,
      ticketDeviceLinked: false,
      deviceLinkedAt: null
    } : {})
  } : null;
  await db.runTransaction(async (transaction) => {
    const lockRefs = [lockRef, companionLockRef].filter(Boolean);
    const lockSnapshots = await Promise.all(lockRefs.map((ref) => transaction.get(ref)));
    const lockedIds = lockSnapshots.map((snapshot) => snapshot.exists ? snapshot.data()?.registrationId : "").filter(Boolean);
    const lockedRegistrations = await Promise.all(lockedIds.map((id) => transaction.get(db.collection("registrations").doc(id))));
    if (lockedRegistrations.some((snapshot) => snapshot.exists && registrationBlocksNewBooking(snapshot.data() || {}))) {
        throw new HttpsError("already-exists", "Diese E-Mail-Adresse ist fuer dieses Event bereits angemeldet.");
    }
    transaction.set(registrationRef, registration);
    if (companionRegistration) transaction.set(companionRegistrationRef, companionRegistration);
    [
      { ref: lockRef, email: input.email, registrationId: registrationRef.id, snapshot: lockSnapshots[0] },
      ...(companionLockRef ? [{ ref: companionLockRef, email: input.companion.email, registrationId: companionRegistrationRef.id, snapshot: lockSnapshots[1] }] : [])
    ].forEach(({ ref, email, registrationId, snapshot }) => transaction.set(ref, {
      id: ref.id, eventId: eventRecord.id, email, registrationId, status: registration.status,
      updatedAt: now, createdAt: snapshot?.data()?.createdAt || now
    }, { merge: true }));
  });
  if (checkinMode) {
    const companionName = input.hasCompanion ? [input.companion?.firstName, input.companion?.lastName].filter(Boolean).join(" ") : "";
    const primaryName = [input.firstName, input.lastName].filter(Boolean).join(" ");
    await db.collection("checkinScreenEvents").doc(eventRecord.id).set({
      eventId: eventRecord.id,
      registrationId: registrationRef.id,
      registrationIds: [registrationRef.id, companionRegistrationRef?.id].filter(Boolean),
      firstName: input.firstName || "",
      lastName: input.lastName || "",
      company: input.company || "",
      companion: null,
      participantCount: input.hasCompanion ? 2 : 1,
      displayName: [primaryName, companionName].filter(Boolean).join(" und "),
      checkedInAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  if (input.notifyFutureEvents) {
    await db.collection("notificationConsents").doc(notificationConsentId(input.email)).set({
      id: notificationConsentId(input.email),
      email: input.email,
      status: "active",
      source: "event_registration_checkbox",
      scope: "future_events",
      notifyFutureEvents: true,
      notificationConsentText: registration.notificationConsentText,
      notificationChannels: registration.notificationChannels,
      mailConsent: true,
      pushConsent: true,
      smsConsent: true,
      lastEventId: eventRecord.id,
      lastRegistrationId: registrationRef.id,
      createdIp: registration.createdIp,
      createdUserAgent: registration.createdUserAgent,
      createdAt: now,
      updatedAt: now
    }, { merge: true });
  }
  const contactSync = await upsertContactFromRegistration(registration, eventRecord, now);
  if (contactSync.created) await countNewMailingContactForEvent(eventRecord.id, "event_registration", contactSync, now);
  if (companionRegistration) {
    const companionContact = await upsertContactFromRegistration(companionRegistration, eventRecord, now);
    if (companionContact.created) await countNewMailingContactForEvent(eventRecord.id, "event_additional_registration", companionContact, now);
  }
  if (!checkinMode) {
    await Promise.all([
      queueMail({
        type: "registration_confirmation", to: registration.email,
        subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title}`, template: "registration_confirmation",
        eventId: registration.eventId, registrationId: registrationRef.id,
        confirmationUrl: registrationConfirmationUrl(confirmationToken), tokenExpiresAt: confirmationExpiresAt
      }),
      ...(companionRegistration ? [queueMail({
        type: "registration_confirmation", to: companionRegistration.email,
        subject: `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title}`, template: "registration_confirmation",
        eventId: companionRegistration.eventId, registrationId: companionRegistrationRef.id,
        confirmationUrl: registrationConfirmationUrl(companionConfirmationToken), tokenExpiresAt: confirmationExpiresAt
      })] : [])
    ]);
  }
  await Promise.all([registration, companionRegistration].filter(Boolean).map((record) => queueMail({
    type: "admin_notification", to: adminRegistrationMailTo(),
    subject: `Neue Anmeldung: ${eventRecord.title}`, template: "admin_notification",
    eventId: record.eventId, registrationId: record.id
  })));
  return {
    checkedIn: checkinMode,
    ticketToken: checkinTicketToken,
    statusToken,
    ...registration,
    additionalRegistration: companionRegistration ? {
      registrationId: companionRegistration.id,
      email: companionRegistration.email,
      firstName: companionRegistration.firstName,
      lastName: companionRegistration.lastName,
      confirmationRequired: !checkinMode
    } : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
});

exports.getRegistrationConfirmationStatus = onCall({ region, invoker: "public" }, async (request) => {
  const registrationId = clean(request.data?.registrationId);
  const statusToken = clean(request.data?.statusToken);
  if (!registrationId || registrationId.includes("/") || !/^[a-f0-9]{64}$/.test(statusToken)) {
    throw new HttpsError("invalid-argument", "Anmeldestatus nicht verfügbar.");
  }
  const snapshot = await db.collection("registrations").doc(registrationId).get();
  const registration = snapshot.data() || {};
  if (!snapshot.exists || registration.registrationStatusTokenHash !== hashToken(statusToken)
    || (registration.registrationStatusExpiresAt?.toMillis?.() || 0) <= Date.now()) {
    throw new HttpsError("permission-denied", "Anmeldestatus nicht verfügbar.");
  }
  const status = clean(registration.status);
  return {
    status,
    confirmed: ["confirmed", "checked_in"].includes(status),
    confirmedAt: registration.confirmedAt?.toDate?.().toISOString() || ""
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
  input.phone = requiredRegistrationMobileNumber(input.phone);
  const existingRegistration = await db.collection("registrations")
    .where("eventId", "==", eventRecord.id)
    .where("email", "==", input.email)
    .limit(10)
    .get();
  const duplicate = existingRegistration.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .find(registrationBlocksNewBooking);
  if (duplicate) {
    throw new HttpsError("already-exists", "Diese E-Mail-Adresse ist fuer dieses Event bereits angemeldet.");
  }
  const now = FieldValue.serverTimestamp();
  const registrationRef = db.collection("registrations").doc(`registration-${randomBytes(16).toString("hex")}`);
  const lockRef = db.collection("registrationLocks").doc(registrationLockId(eventRecord.id, input.email));
  const headers = request.rawRequest?.headers || {};
  const personMatch = await findPersonByEmail(input.email);
  const isMemberByEmail = Boolean(personMatch.isMember);
  const confirmationToken = randomBytes(32).toString("hex");
  const confirmationExpiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  const registration = {
    id: registrationRef.id,
    eventId: eventRecord.id,
    eventTitle: eventRecord.title || "",
    eventDate: eventRecord.date || "",
    eventAccessType: eventRecord.accessType || "",
    ...input,
    phoneFormatStatus: "valid",
    phoneFormatCheckedAt: now,
    phoneVerificationStatus: "unverified",
    pushTrackingConsentAt: input.pushTrackingConsent ? now : null,
    pushTrackingConsentText: input.pushTrackingConsent ? "Freiwillige Erfassung von Push-Antippen und Aufruf der verlinkten Seite; keine Bestaetigung der Mobilnummer." : "",
    isMember: isMemberByEmail,
    existingPersonMatched: Boolean(personMatch.matched),
    personMatchSource: personMatch.source || "new",
    matchedMemberId: personMatch.memberId || "",
    matchedUserId: personMatch.userId || "",
    matchedContactId: personMatch.contactId || "",
    matchedSpeakerId: personMatch.speakerId || "",
    memberGuestAllowed: eventRecord.accessType === "members_only",
    registrationAudienceType: isMemberByEmail ? "member" : (eventRecord.accessType === "members_only" ? "member_guest" : "guest"),
    handyTicketEnabled: eventUsesHandyTicket(eventRecord),
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
      if (lockedRegistration.exists && registrationBlocksNewBooking(lockedRegistration.data() || {})) {
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
  const contactSync = await upsertContactFromRegistration(registration, eventRecord, now);
  if (contactSync.created) await countNewMailingContactForEvent(eventRecord.id, "cms_admin_registration", contactSync, now);
  const companionContact = await upsertCompanionContact(registration, eventRecord, now);
  if (companionContact.created) await countNewMailingContactForEvent(eventRecord.id, "event_companion", companionContact, now);
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

exports.prepareEventGuestAccounts = onCall({ region }, async (request) => {
  await requireEditor(request);
  const eventId = clean(request.data?.eventId);
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  const event = await db.collection("events").doc(eventId).get();
  if (!event.exists) throw new HttpsError("not-found", "Veranstaltung wurde nicht gefunden.");
  const registrations = await db.collection("registrations").where("eventId", "==", eventId).get();
  const people = new Map();
  for (const document of registrations.docs) {
    const record = document.data() || {};
    if (!["confirmed", "checked_in"].includes(clean(record.status))) continue;
    for (const person of [record, record.companion || {}]) {
      const email = mailAddress(person.email).toLowerCase();
      if (!email) continue;
      const firstName = clean(person.firstName);
      const lastName = clean(person.lastName);
      const previous = people.get(email);
      if (previous && (previous.firstName + " " + previous.lastName).toLocaleLowerCase("de") !== (firstName + " " + lastName).toLocaleLowerCase("de")) {
        previous.conflict = true;
      } else if (!previous) {
        people.set(email, { email, firstName, lastName, conflict: false });
      }
    }
  }
  let created = 0;
  let existing = 0;
  let skippedMembers = 0;
  let conflicts = 0;
  const errors = [];
  const auth = getAuth();
  for (const person of people.values()) {
    if (person.conflict) { conflicts++; continue; }
    try {
      const match = await findPersonByEmail(person.email);
      if (match.isMember) { skippedMembers++; continue; }
      const contacts = await db.collection("contacts").where("email", "==", person.email).limit(5).get();
      if (contacts.docs.some((document) => {
        const firstName = clean(document.data()?.firstName).toLocaleLowerCase("de");
        return firstName && person.firstName && firstName !== person.firstName.toLocaleLowerCase("de");
      })) { conflicts++; continue; }
      let authUser;
      let wasCreated = false;
      try {
        authUser = await auth.getUserByEmail(person.email);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
        authUser = await auth.createUser({
          email: person.email, password: randomBytes(32).toString("hex"),
          emailVerified: false, disabled: false
        });
        wasCreated = true;
      }
      const userRef = db.collection("users").doc(authUser.uid);
      const profile = await userRef.get();
      if (!profile.exists) {
        await userRef.set({
          guestPasswordTemporary: wasCreated,
          email: person.email,
          displayName: clean([person.firstName, person.lastName].filter(Boolean).join(" ")) || person.email,
          firstName: person.firstName, lastName: person.lastName,
          role: "guest", status: "active", accountType: "guest",
          createdVia: "event_guest_preparation", createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
      if (wasCreated) created++;
      else existing++;
    } catch (error) {
      errors.push({ email: person.email, message: clean(error.message).slice(0, 160) });
    }
  }
  return { eventId, eligible: people.size, created, existing, skippedMembers, conflicts, errors };
});

exports.checkEventGuestLoginEmail = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId);
  const email = mailAddress(request.data?.email).toLowerCase();
  if (!eventId || eventId.includes("/") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Bitte eine gültige E-Mail-Adresse eingeben.");
  }
  const [eventSnapshot, accessSnapshot, registrations] = await Promise.all([
    db.collection("events").doc(eventId).get(),
    db.collection("eventLiveAccess").doc(eventId).get(),
    db.collection("registrations").where("eventId", "==", eventId).get()
  ]);
  if (!eventSnapshot.exists || eventSnapshot.data()?.eventLiveEnabled !== true
    || !accessSnapshot.exists || accessSnapshot.data()?.enabled !== true) {
    throw new HttpsError("failed-precondition", "Event-Chat ist derzeit nicht verfügbar.");
  }
  const candidates = eligibleGuestCandidates(registrations.docs.map((document) => ({ ...document.data(), id: document.id })), email);
  if (candidates.length !== 1) {
    if (candidates.length === 0) {
      try {
        await getAuth().getUserByEmail(email);
        return { method: "password" };
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }
    }
    return { method: "unavailable" };
  }
  const { registration, person } = candidates[0];
  const contacts = await db.collection("contacts").where("email", "==", email).limit(5).get();
  if (contacts.docs.some((document) => guestIdentityConflict(person, document.data()))) return { method: "unavailable" };
  const auth = getAuth();
  let authUser = null;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  const userRef = authUser ? db.collection("users").doc(authUser.uid) : null;
  const profileSnapshot = userRef ? await userRef.get() : null;
  const profile = profileSnapshot?.data() || {};
  const needsSetup = guestPasswordNeedsSetup(authUser, profile);
  if (!needsSetup) return { method: "password" };
  const requestRef = db.collection("guestPasswordRequests").doc(hashToken(email));
  const now = Date.now();
  const retryAfterSeconds = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    const last = snapshot.data()?.requestedAt?.toMillis?.() || 0;
    if (now - last < 3 * 60 * 1000) return Math.ceil((3 * 60 * 1000 - (now - last)) / 1000);
    transaction.set(requestRef, {
      eventId, emailHash: hashToken(email), requestedAt: Timestamp.fromMillis(now),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return 0;
  });
  if (retryAfterSeconds) return { method: "temporary_password", queued: false, retryAfterSeconds };
  if (!authUser) {
    authUser = await auth.createUser({
      email, password: randomBytes(32).toString("hex"),
      emailVerified: false, disabled: false
    });
  }
  const accountRef = db.collection("users").doc(authUser.uid);
  const temporaryPassword = randomBytes(12).toString("base64url");
  await auth.updateUser(authUser.uid, { password: temporaryPassword, emailVerified: true, disabled: false });
  await accountRef.set({
    email,
    ...(profileSnapshot?.exists ? {} : {
      displayName: clean([person.firstName, person.lastName].filter(Boolean).join(" ")) || email,
      firstName: clean(person.firstName), lastName: clean(person.lastName),
      role: "guest", accountType: "guest", status: "active",
      createdVia: "event_guest_email_check", createdAt: FieldValue.serverTimestamp()
    }),
    guestPasswordTemporary: true,
    guestPasswordHash: hashToken(temporaryPassword),
    guestPasswordExpiresAt: Timestamp.fromMillis(now + 2 * 60 * 60 * 1000),
    guestPasswordIssuedAt: FieldValue.serverTimestamp(),
    guestPasswordMailQueuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await queueMail({
    type: "event_guest_password", template: "event_guest_password",
    to: email, eventId, registrationId: candidates[0].registrationId,
    displayName: clean(person.firstName) || "Gast",
    temporaryPassword,
    subject: "Ihr einmaliges PROdigitalTV-Startpasswort"
  });
  return { method: "temporary_password", queued: true };
});

exports.setEventGuestPassword = onCall({ region }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Bitte zuerst mit dem Startpasswort anmelden.");
  const newPassword = String(request.data?.newPassword || "");
  if (newPassword.length < 12 || newPassword.length > 128 || !newPassword.trim()) {
    throw new HttpsError("invalid-argument", "Das neue Passwort muss 12 bis 128 Zeichen lang sein.");
  }
  const authTime = Number(request.auth.token.auth_time || 0) * 1000;
  if (!authTime || Date.now() - authTime > 10 * 60 * 1000) {
    throw new HttpsError("failed-precondition", "Bitte erneut mit dem Startpasswort anmelden und dann das Passwort ändern.");
  }
  const ref = db.collection("users").doc(request.auth.uid);
  const snapshot = await ref.get();
  const profile = snapshot.data() || {};
  if (!snapshot.exists || profile.guestPasswordTemporary !== true
    || clean(profile.email).toLowerCase() !== clean(request.auth.token.email).toLowerCase()) {
    throw new HttpsError("failed-precondition", "Für dieses Konto ist kein Startpasswort aktiv.");
  }
  if ((profile.guestPasswordExpiresAt?.toMillis?.() || 0) <= Date.now()) {
    throw new HttpsError("deadline-exceeded", "Das Startpasswort ist abgelaufen. Bitte fordern Sie ein neues an.");
  }
  if (hashToken(newPassword) === profile.guestPasswordHash) {
    throw new HttpsError("invalid-argument", "Bitte ein anderes Passwort als das Startpasswort wählen.");
  }
  await getAuth().updateUser(request.auth.uid, { password: newPassword, emailVerified: true });
  await ref.update({
    guestPasswordTemporary: false,
    guestPasswordHash: FieldValue.delete(),
    guestPasswordExpiresAt: FieldValue.delete(),
    guestPasswordSetAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { changed: true };
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

exports.beginPortalGalleryPhotoUpload = onCall({ region }, async (request) => {
  const eventId = clean(request.data?.eventId);
  await requireParticipantPhotoAccess(request.auth, eventId, true);
  const fileName = clean(request.data?.fileName).replace(/[\\/]/g, "-").slice(0, 120);
  const fileType = clean(request.data?.fileType).toLowerCase();
  const fileSize = Number(request.data?.fileSize) || 0;
  if (!fileName || !/^image\/(jpeg|png|webp|heic|heif)$/.test(fileType)
    || fileSize < 1 || fileSize > 15 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "Bitte ein Bild bis 15 MB auswählen.");
  }
  const profile = await db.collection("users").doc(request.auth.uid).get();
  const ref = db.collection("eventMedia").doc();
  const storagePath = `portal-gallery-photos/${request.auth.uid}/${ref.id}/${fileName}`;
  await ref.create({
    eventId, uploadId: ref.id, storagePath, fileName, fileType, mediaType: "image",
    title: fileName, galleryId: "", galleryTitle: "Teilnehmerfotos",
    visibility: "internal", status: "uploading", source: "portal-gallery-upload",
    rightsConfirmed: true, uploadedBy: request.auth.uid,
    uploadedByName: clean(profile.data()?.displayName),
    uploadedByEmail: clean(request.auth.token.email).toLowerCase(),
    uploadedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  });
  return { mediaId: ref.id, storagePath };
});

exports.finishPortalGalleryPhotoUpload = onCall({ region }, async (request) => {
  if (!request.auth?.uid || request.auth.token.email_verified !== true) {
    throw new HttpsError("unauthenticated", "Bitte anmelden.");
  }
  const mediaId = clean(request.data?.mediaId);
  const note = clean(request.data?.note).slice(0, 500);
  if (!mediaId || mediaId.includes("/")) throw new HttpsError("invalid-argument", "Upload fehlt.");
  const ref = db.collection("eventMedia").doc(mediaId);
  const snapshot = await ref.get();
  const medium = snapshot.data() || {};
  if (!snapshot.exists || medium.uploadedBy !== request.auth.uid || medium.status !== "uploading"
    || medium.source !== "portal-gallery-upload") {
    throw new HttpsError("permission-denied", "Upload nicht gefunden.");
  }
  await requireParticipantPhotoAccess(request.auth, medium.eventId, true);
  const file = getStorage().bucket(storageBucket).file(medium.storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("failed-precondition", "Bild wurde noch nicht hochgeladen.");
  const [metadata] = await file.getMetadata();
  if (!/^image\//.test(clean(metadata.contentType)) || Number(metadata.size) > 15 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "Ungültige Bilddatei.");
  }
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } });
  await ref.update({
    fileUrl: FieldValue.delete(), thumbUrl: FieldValue.delete(),
    caption: note, note, description: note,
    visibility: "participants", status: "uploaded",
    participantPhotoPublishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await db.collection("users").doc(request.auth.uid).collection("participantPhotoViews").doc(mediaId)
    .set({ eventId: medium.eventId, seenAt: FieldValue.serverTimestamp() });
  return { mediaId, eventId: medium.eventId, status: "uploaded" };
});

async function requireParticipantPhotoAccess(auth, eventId = "", requireEvent = false) {
  if (!auth?.uid || auth.token.email_verified !== true) {
    throw new HttpsError("unauthenticated", "Bitte mit bestätigter E-Mail anmelden.");
  }
  const snapshot = await db.collection("users").doc(auth.uid).get();
  const profile = snapshot.data() || {};
  if (!snapshot.exists || ["inactive", "deleted", "archived"].includes(clean(profile.status))
    || profile.guestPasswordTemporary === true) {
    throw new HttpsError("permission-denied", "Bitte zuerst Ihren persönlichen Zugang aktivieren.");
  }
  const email = clean(auth.token.email).toLowerCase();
  const registrations = email ? await Promise.all([
    db.collection("registrations").where("email", "==", email).get(),
    db.collection("registrations").where("companion.email", "==", email).get()
  ]) : [];
  const events = new Map(registrations.flatMap((result) => result.docs.map((doc) => doc.data()))
    .filter((item) => ["confirmed", "checked_in"].includes(clean(item.status)) && clean(item.eventId))
    .map((item) => [clean(item.eventId), item]));
  await Promise.all([...events.keys()].map(async (id) => {
    const [event, access] = await Promise.all([
      db.collection("events").doc(id).get(),
      db.collection("eventLiveAccess").doc(id).get()
    ]);
    const record = event.data() || {};
    if (!event.exists || record.eventLiveEnabled !== true
      || !access.exists || access.data()?.enabled !== true
      || ["inactive", "inaktiv", "draft", "deleted", "cancelled", "canceled"].includes(clean(record.status).toLowerCase())
      || record.visible === false || record.isLive === false
      || (!["admin", "administrator", "owner", "editor", "redakteur", "redaktion", "member", "mitglied"].includes(clean(profile.role).toLowerCase()) && !guestEventLiveIsOpen(record))) {
      events.delete(id);
    }
  }));
  if ((requireEvent && !clean(eventId)) || (clean(eventId) && !events.has(clean(eventId)))) {
    throw new HttpsError("permission-denied", "Für diese Veranstaltung sind Sie nicht als Teilnehmer freigeschaltet.");
  }
  return events;
}

function participantPhotoRecord(medium = {}) {
  return ["portal-gallery-upload", "member-material-upload"].includes(clean(medium.source))
    && medium.status !== "uploading" && Boolean(clean(medium.storagePath))
    && Boolean(clean(medium.eventId)) && clean(medium.mediaType) === "image";
}

function participantPhotoUnread(medium, mediaId, uid, seenIds) {
  return medium.uploadedBy !== uid && !seenIds.has(mediaId);
}

exports.listPortalParticipantPhotos = onCall({ region }, async (request) => {
  const selectedEventId = clean(request.data?.eventId);
  const access = await requireParticipantPhotoAccess(request.auth, selectedEventId);
  const eventIds = selectedEventId ? [selectedEventId] : [...access.keys()];
  const views = await db.collection("users").doc(request.auth.uid).collection("participantPhotoViews").get();
  const seenIds = new Set(views.docs.map((doc) => doc.id));
  const records = await Promise.all(eventIds.map((eventId) =>
    db.collection("eventMedia").where("eventId", "==", eventId).get()));
  const photos = records.flatMap((result) => result.docs)
    .filter((doc) => participantPhotoRecord(doc.data())).map((doc) => {
      const medium = doc.data();
      return {
        id: doc.id, eventId: clean(medium.eventId),
        fileName: clean(medium.fileName), caption: clean(medium.caption || medium.note),
        uploadedByName: clean(medium.uploadedByName),
        unread: participantPhotoUnread(medium, doc.id, request.auth.uid, seenIds),
        uploadedAt: medium.uploadedAt?.toDate?.().toISOString() || clean(medium.uploadedAt)
      };
    }).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const events = await Promise.all(eventIds.map(async (eventId) => {
    const event = await db.collection("events").doc(eventId).get();
    const record = event.data() || {};
    const registration = access.get(eventId);
    return {
      eventId, eventTitle: clean(record.title || registration.eventTitle || registration.eventName),
      eventDate: clean(record.startDate || record.date || registration.eventDate),
      photoCount: photos.filter((photo) => photo.eventId === eventId).length,
      unreadCount: photos.filter((photo) => photo.eventId === eventId && photo.unread).length
    };
  }));
  events.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return { photos, events, unreadCount: photos.filter((photo) => photo.unread).length };
});

exports.markPortalParticipantPhotosSeen = onCall({ region }, async (request) => {
  const eventId = clean(request.data?.eventId);
  await requireParticipantPhotoAccess(request.auth, eventId, true);
  const ids = [...new Set((Array.isArray(request.data?.photoIds) ? request.data.photoIds : [])
    .map(clean).filter((id) => id && !id.includes("/")))].slice(0, 100);
  const snapshots = await Promise.all(ids.map((id) => db.collection("eventMedia").doc(id).get()));
  const batch = db.batch();
  const marked = [];
  for (const snapshot of snapshots) {
    if (!snapshot.exists || !participantPhotoRecord(snapshot.data()) || snapshot.data().eventId !== eventId) continue;
    batch.set(db.collection("users").doc(request.auth.uid).collection("participantPhotoViews").doc(snapshot.id),
      { eventId, seenAt: FieldValue.serverTimestamp() });
    marked.push(snapshot.id);
  }
  if (marked.length) await batch.commit();
  return { marked };
});

exports.getPortalParticipantPhoto = onRequest({ region, invoker: "public", cors: true, memory: "512MiB" }, async (req, res) => {
  try {
    if (req.method !== "GET") { res.status(405).send("GET required"); return; }
    const token = clean(req.headers.authorization).replace(/^Bearer\s+/i, "");
    if (!token) { res.status(401).send("Bitte anmelden."); return; }
    let verified;
    try { verified = await getAuth().verifyIdToken(token, true); }
    catch { res.status(401).send("Bitte erneut anmelden."); return; }
    const auth = { uid: verified.uid, token: verified };
    const mediaId = clean(req.query.mediaId);
    if (!mediaId || mediaId.includes("/")) { res.status(400).send("Foto fehlt."); return; }
    const snapshot = await db.collection("eventMedia").doc(mediaId).get();
    if (!snapshot.exists || !participantPhotoRecord(snapshot.data())) { res.status(404).send("Foto nicht gefunden."); return; }
    if (!(await requireAdmin({ auth }).then(() => true).catch(() => false))) await requireParticipantPhotoAccess(auth, snapshot.data().eventId, true);
    const file = getStorage().bucket(storageBucket).file(snapshot.data().storagePath);
    const [metadata] = await file.getMetadata();
    if (!clean(metadata.contentType).startsWith("image/") || Number(metadata.size) > 30 * 1024 * 1024) {
      res.status(415).send("Ungültige Bilddatei."); return;
    }
    const [buffer] = await file.download();
    res.set("Cache-Control", "private, no-store");
    res.set("Content-Type", metadata.contentType);
    res.set("X-Content-Type-Options", "nosniff");
    res.status(200).send(buffer);
  } catch (error) {
    const status = error.code === "unauthenticated" ? 401 : error.code === "permission-denied" ? 403 : 500;
    res.status(status).send(status === 500 ? "Foto konnte nicht geladen werden." : error.message);
  }
});

exports.getMyEventRegistrations = onCall({ region }, async (request) => {
  if (!request.auth?.uid || request.auth.token.email_verified !== true) {
    throw new HttpsError("unauthenticated", "Bitte mit bestätigter E-Mail anmelden.");
  }
  const email = clean(request.auth.token.email || "").toLowerCase();
  if (!email) return { registrations: [] };
  const eventIds = Array.isArray(request.data?.eventIds)
    ? request.data.eventIds.map((id) => clean(id)).filter(Boolean).slice(0, 80)
    : [];
  const [primary, companions] = await Promise.all([
    db.collection("registrations").where("email", "==", email).limit(100).get(),
    db.collection("registrations").where("companion.email", "==", email).limit(100).get()
  ]);
  const allowedEventIds = new Set(eventIds);
  const registrations = [...new Map([...primary.docs, ...companions.docs]
    .map((document) => [document.id, { id: document.id, ...document.data() }])).values()]
    .filter((registration) => !eventIds.length || allowedEventIds.has(registration.eventId))
    .filter((registration) => !["cancelled", "expired", "deleted"].includes(clean(registration.status).toLowerCase()));
  const events = await Promise.all([...new Set(registrations.map((registration) => registration.eventId).filter(Boolean))]
    .map(async (eventId) => {
      const event = await db.collection("events").doc(eventId).get();
      return [eventId, event.exists ? event.data() || {} : {}];
    }));
  const eventById = new Map(events);
  return { registrations: registrations.map((registration) => {
    const person = clean(registration.email).toLowerCase() === email ? registration : registration.companion || {};
    const event = eventById.get(registration.eventId) || {};
    return {
      id: registration.id,
      eventId: registration.eventId || "",
      eventTitle: registration.eventTitle || event.title || "",
      eventDate: clean(event.date),
      firstName: person.firstName || "",
      lastName: person.lastName || "",
      status: registration.status || "",
      emailConfirmed: ["confirmed", "checked_in"].includes(clean(registration.status))
    };
  }) };
});

exports.saveNotificationTestGroup = onCall({ region }, async (request) => {
  const profile = await requireEditor(request);
  const values = request.data?.emails;
  if (!Array.isArray(values) || values.some((email) => typeof email !== "string")) throw new HttpsError("invalid-argument", "Testadressen fehlen.");
  const emails = [...new Set(values.map((email) => clean(email).toLowerCase()))];
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new HttpsError("invalid-argument", "Bitte gueltige E-Mail-Adressen eintragen.");
  await db.collection("settings").doc("notificationTestGroup").set({
    emails, updatedAt: FieldValue.serverTimestamp(), updatedBy: profile.email || request.auth.uid
  }, { merge: true });
  return { emails, count: emails.length };
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
  const smsText = stripTags(input.smsText || (notificationKind === "event" ? `Sie sind herzlich eingeladen: ${eventRecord.title || "PROdigitalTV"}. Details und Anmeldung finden Sie im Link.` : "Neue Informationen von PROdigitalTV.")).slice(0, 612);
  if (notificationKind === "event") await assertNoHiddenTalkMentions(eventRecord, { shortText, smsText });
  const testRecipients = clean(input.testRecipients)
    .split(/[\s,;]+/)
    .map((email) => mailAddress(email))
    .filter(Boolean)
    .filter((email, index, all) => all.indexOf(email) === index);
  const testOnly = clean(input.recipientGroup) !== "test_group" && (clean(input.recipientGroup) === "test_person" || input.testOnly === true || input.testOnly === "true");
  if (testOnly && !testRecipients.length) throw new HttpsError("invalid-argument", "Bitte mindestens eine Testperson eintragen.");
  const recipientGroup = ["members", "contacts", "members_contacts", "event_registered", "event_speakers", "event_registered_speakers", "other_event_speakers", "test_group", "test_person"].includes(clean(input.recipientGroup))
    ? clean(input.recipientGroup)
    : "members_contacts";
  const includeEventSpeakers = notificationKind === "event" && !["test_group", "test_person"].includes(recipientGroup);
  const extraSpeakerEventIds = includeEventSpeakers ? notificationExtraSpeakerEventIds(input, eventId) : [];
  await validateOtherEventSpeakerSource(recipientGroup, eventId, extraSpeakerEventIds, notificationKind);
  if (recipientGroup === "other_event_speakers") {
    const targets = await eventNotificationTargets(eventId, { recipientGroup, extraSpeakerEventIds });
    const recipientEmails = targets.map((target) => target.email).filter(Boolean).sort();
    if (!recipientEmails.length) throw new HttpsError("failed-precondition", "Im Quell-Event gibt es keine erreichbaren Referenten.");
    const expected = Array.isArray(input.expectedTestRecipients) ? [...new Set(input.expectedTestRecipients.map((email) => mailAddress(email)).filter(Boolean))].sort() : [];
    if (JSON.stringify(expected) !== JSON.stringify(recipientEmails)) throw new HttpsError("failed-precondition", "Die Referentenliste hat sich geaendert. Bitte Empfaenger erneut vorbereiten.");
  }
  const offsetMinutes = Number(input.offsetMinutes || 0);
  if (recipientGroup === "test_group") {
    const targets = await notificationTestGroupTargets();
    if (Array.isArray(input.expectedTestRecipients)) {
      const expected = [...new Set(input.expectedTestRecipients.map((email) => clean(email).toLowerCase()))].sort();
      if (JSON.stringify(expected) !== JSON.stringify(targets.map((target) => target.email).sort())) throw new HttpsError("failed-precondition", "Die Testgruppe wurde geaendert. Bitte Empfaenger erneut vorbereiten.");
    }
  }
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
  const channels = Array.isArray(input.channels)
    ? [...new Set(input.channels.map(clean).filter((channel) => ["mail", "push", "sms"].includes(channel)))]
    : ["mail", "push"];
  if (!channels.length) throw new HttpsError("invalid-argument", "Bitte mindestens einen Versandkanal auswaehlen.");
  let smsCostEstimate = null;
  let smsCostEstimateRef = null;
  if (channels.includes("sms")) {
    const smsCostEstimateId = clean(input.smsCostEstimateId);
    if (!smsCostEstimateId) throw new HttpsError("failed-precondition", "Bitte SMS-Kosten vor dem Versand erneut berechnen.");
    smsCostEstimateRef = db.collection("smsCostEstimates").doc(smsCostEstimateId);
    const estimateSnapshot = await smsCostEstimateRef.get();
    const estimate = estimateSnapshot.exists ? estimateSnapshot.data() : null;
    if (!estimate || estimate.createdByUid !== request.auth.uid || estimate.status !== "previewed" || estimate.fingerprint !== smsEstimateFingerprint(input)) {
      throw new HttpsError("failed-precondition", "Die SMS-Kostenschaetzung ist nicht mehr aktuell. Bitte Versand erneut vorbereiten.");
    }
    smsCostEstimate = {
      id: estimateSnapshot.id,
      provider: clean(estimate.provider),
      pricingMode: clean(estimate.pricingMode),
      currency: clean(estimate.currency) || "EUR",
      estimatedNetEur: Number(estimate.estimatedNetEur || 0),
      recipientCount: Number(estimate.recipientCount || 0),
      messagePartCount: Number(estimate.messagePartCount || 0),
      estimatedAtIso: clean(estimate.estimatedAtIso)
    };
  }
  const submittedLink = clean(input.link);
  const defaultLink = notificationKind === "event" ? eventUrl(eventId) : publicHashUrl("members");
  const liveActionMode = clean(input.liveActionMode) === "survey" ? "survey" : "message";
  let liveSurvey = null;
  let notificationLink = linkEnabled ? submittedLink || defaultLink : "";
  if (liveActionMode === "survey") {
    if (notificationKind !== "event") throw new HttpsError("invalid-argument", "Umfragen sind aktuell an eine Veranstaltung gebunden.");
    const surveyQuestion = stripTags(input.surveyQuestion || shortText);
    const surveyOptions = liveSurveyOptions(input.surveyOptions);
    const surveyAllowMultiple = input.surveyAllowMultiple === true || clean(input.surveyAllowMultiple) === "true";
    const submittedQuestions = liveSurveyQuestions(input.surveyQuestions);
    const surveyQuestions = submittedQuestions.length ? submittedQuestions : [{
      id: "question-1",
      type: surveyAllowMultiple ? "multiple" : "single",
      question: surveyQuestion,
      required: true,
      options: surveyOptions
    }];
    if (!surveyQuestions.length || surveyQuestions.some((question) => !question.question)) throw new HttpsError("invalid-argument", "Bitte mindestens eine Umfragefrage eintragen.");
    if (surveyQuestions.some((question) => question.type !== "text" && question.options.length < 1)) throw new HttpsError("invalid-argument", "Bitte fuer jede Auswahlfrage mindestens eine Antwortmoeglichkeit eintragen.");
    const primaryQuestion = surveyQuestions[0];
    const surveyRef = db.collection("liveSurveys").doc(`live-survey-${randomBytes(16).toString("hex")}`);
    const surveyCreatedAtIso = new Date().toISOString();
    liveSurvey = {
      id: surveyRef.id,
      eventId,
      notificationId: notificationRef.id,
      title: stripTags(input.surveyTitle || title) || title,
      question: primaryQuestion.question,
      options: primaryQuestion.options,
      allowMultiple: primaryQuestion.type === "multiple",
      questions: surveyQuestions,
      schemaVersion: 2,
      status: "active",
      requiresToken: true,
      createdAtIso: surveyCreatedAtIso,
      createdBy: profile.email || request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    await surveyRef.set(liveSurvey);
    notificationLink = publicHashUrl(`survey/${encodeURIComponent(surveyRef.id)}`);
  }
  const notification = {
    id: notificationRef.id,
    eventId: notificationKind === "event" ? eventId : "",
    notificationKind,
    title,
    shortText,
    smsText,
    smsLinkEnabled: input.smsLinkEnabled !== false && clean(input.smsLinkEnabled) !== "false",
    smsCostEstimateId: smsCostEstimate?.id || "",
    smsCostEstimate,
    linkEnabled,
    channels,
    link: notificationLink,
    liveActionMode,
    surveyId: liveSurvey?.id || "",
    surveyQuestion: liveSurvey?.question || "",
    surveyOptions: liveSurvey?.options || [],
    surveyAllowMultiple: liveSurvey?.allowMultiple || false,
    surveyQuestions: liveSurvey?.questions || [],
    testOnly,
    testRecipients: testOnly ? testRecipients : [],
    testRecipientMobiles: testOnly ? clean(input.testRecipientMobiles).split(/[\s,;]+/).map(phoneNumber).filter(Boolean) : [],
    recipientGroup,
    includeMembers: ["members", "members_contacts", "test_group"].includes(recipientGroup),
    includeContacts: ["contacts", "members_contacts"].includes(recipientGroup),
    includeRegistered: ["event_registered", "event_registered_speakers"].includes(recipientGroup),
    includeSpeakers: includeEventSpeakers || ["event_speakers", "event_registered_speakers"].includes(recipientGroup),
    extraSpeakerEventIds,
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
  if (smsCostEstimateRef) {
    await smsCostEstimateRef.set({
      status: "accepted",
      notificationId: notificationRef.id,
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  if (sendMode === "now") {
    const result = await queueEventNotificationDelivery({ ...notification, id: notificationRef.id }, eventRecord);
    return { id: notificationRef.id, surveyId: liveSurvey?.id || "", ...result };
  }
  return { id: notificationRef.id, surveyId: liveSurvey?.id || "", scheduled: true };
});

exports.countAnonymousPageView = onRequest({ region, invoker: "public" }, async (req, res) => {
  const origin = clean(req.get("origin"));
  let host = "";
  try { host = new URL(origin).hostname.toLowerCase(); } catch {}
  if (!["prodigitaltv.de", "www.prodigitaltv.de", "prodigitaltv-da47b.web.app"].includes(host)) {
    res.status(403).end();
    return;
  }
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Vary", "Origin");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }
  const path = clean(req.rawBody?.toString("utf8") || req.body).toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,30}$/.test(path) || ["cms", "login"].includes(path)) {
    res.status(400).end();
    return;
  }
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  try {
    await db.collection("usageDaily").doc(`${day}_${host}_${path}`).set({
      day, host, path,
      count: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    res.status(204).end();
  } catch (error) {
    console.error("countAnonymousPageView failed", error);
    res.status(500).end();
  }
});

async function openInvitationCampaignsForContact(contactId) {
  const contactSnapshot = await db.collection("contacts").doc(contactId).get();
  if (!contactSnapshot.exists) throw new HttpsError("not-found", "Mailing-Adresse wurde nicht gefunden.");
  const contact = { id: contactSnapshot.id, ...contactSnapshot.data() };
  const email = mailAddress(contact.email).toLowerCase();
  if (!email || contact.mailingDisabled === true || contact.notificationOptOut === true || contact.reminderConsent === false || ["archived", "deleted", "inactive"].includes(clean(contact.status).toLowerCase())) {
    return { contact, campaigns: [] };
  }
  const [notificationsSnapshot, eventsSnapshot, mailSnapshot] = await Promise.all([
    db.collection("eventNotifications").where("recipientGroup", "in", ["contacts", "members_contacts"]).get(),
    db.collection("events").get(),
    db.collection("mailQueue").where("to", "==", email).get()
  ]);
  const events = new Map(eventsSnapshot.docs.map((snapshot) => [snapshot.id, { id: snapshot.id, ...snapshot.data() }]));
  const previouslyQueued = new Set(mailSnapshot.docs.map((snapshot) => clean(snapshot.data().notificationId)).filter(Boolean));
  const previouslyInvitedEvents = new Set(mailSnapshot.docs
    .filter((snapshot) => snapshot.data().template === "event_notification" && /^einladung\b/i.test(clean(snapshot.data().title)))
    .map((snapshot) => clean(snapshot.data().eventId)).filter(Boolean));
  const candidates = notificationsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((notification) => notification.notificationKind === "event"
      && notification.testOnly !== true
      && notification.status === "queued"
      && Number(notification.queuedMailCount || 0) > 0
      && (!Array.isArray(notification.channels) || notification.channels.includes("mail"))
      && notification.liveActionMode !== "survey" && !notification.surveyId
      && (clean(notification.invitationText) || /^einladung\b/i.test(clean(notification.title)))
      && notification.linkEnabled !== false
      && !previouslyQueued.has(notification.id) && !previouslyInvitedEvents.has(notification.eventId))
    .map((notification) => ({ notification, event: events.get(notification.eventId) }))
    .filter(({ event }) => event && eventRegistrationIsOpen(event) && eventDateTimeMillis(event) > Date.now())
    .sort((a, b) => eventDateTimeMillis(a.event) - eventDateTimeMillis(b.event));
  const latestByEvent = new Map();
  candidates.forEach(({ notification, event }) => {
    const current = latestByEvent.get(event.id);
    if (!current || (notification.processedAt?.toMillis?.() || 0) > (current.notification.processedAt?.toMillis?.() || 0)) {
      latestByEvent.set(event.id, { notification, event });
    }
  });
  const campaigns = [];
  for (const candidate of latestByEvent.values()) {
    const registrations = await db.collection("registrations").where("eventId", "==", candidate.event.id).get();
    if (registrations.docs.some((snapshot) => registrationIsActive(snapshot.data()) && mailAddress(snapshot.data().email).toLowerCase() === email)) continue;
    campaigns.push(candidate);
  }
  return { contact, campaigns };
}

exports.getOpenInvitationsForContact = onCall({ region }, async (request) => {
  await requireEditor(request);
  const contactId = clean(request.data?.contactId);
  if (!contactId) throw new HttpsError("invalid-argument", "Mailing-Adresse fehlt.");
  const { campaigns } = await openInvitationCampaignsForContact(contactId);
  return { invitations: campaigns.map(({ notification, event }) => ({
    notificationId: notification.id,
    eventTitle: clean(event.title),
    eventDate: clean(event.date),
    subject: clean(notification.title)
  })) };
});

exports.sendOpenInvitationToContact = onCall({ region }, async (request) => {
  const profile = await requireEditor(request);
  const contactId = clean(request.data?.contactId);
  const notificationId = clean(request.data?.notificationId);
  if (!contactId || !notificationId) throw new HttpsError("invalid-argument", "Mailing-Adresse oder Einladung fehlt.");
  const { contact, campaigns } = await openInvitationCampaignsForContact(contactId);
  const selected = campaigns.find(({ notification }) => notification.id === notificationId);
  if (!selected) throw new HttpsError("failed-precondition", "Diese Einladung ist nicht mehr offen oder wurde bereits vorgemerkt.");
  const { notification, event } = selected;
  await assertNoHiddenTalkMentions(event, notification);
  const link = notification.linkEnabled === false ? "" : clean(notification.link || eventUrl(event.id));
  const registration = { firstName: contact.firstName || "", lastName: contact.lastName || "", company: contact.company || "", email: contact.email, eventTitle: event.title || "" };
  const variables = { eventLink: link, link };
  const mailRef = db.collection("mailQueue").doc(`contact-invitation-${hashToken(`${notificationId}:${mailAddress(contact.email).toLowerCase()}`).slice(0, 40)}`);
  try {
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(mailRef);
      if (existing.exists) throw new HttpsError("already-exists", "Die Einladung wurde bereits fuer diese Mailadresse vorgemerkt.");
      transaction.create(mailRef, {
        type: "event_notification",
        template: "event_notification",
        to: mailAddress(contact.email).toLowerCase(),
        eventId: event.id,
        notificationId,
        title: renderTemplateText(notification.title, { registration, eventRecord: event, variables }) || notification.title,
        shortText: renderTemplateText(notification.invitationText || notification.shortText, { registration, eventRecord: event, variables }),
        link,
        linkEnabled: notification.linkEnabled !== false,
        audienceType: "unregistered",
        personName: clean(`${contact.firstName || ""} ${contact.lastName || ""}`) || contact.company || "",
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        company: contact.company || "",
        contactId,
        addedToCampaignBy: profile.email || request.auth.uid,
        status: "queued",
        queuedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Einladung konnte nicht vorgemerkt werden.");
  }
  return { queued: true, eventTitle: clean(event.title) };
});

exports.previewEventNotification = onCall({ region, secrets: smsSecrets, timeoutSeconds: 120 }, async (request) => {
  const profile = await requireEditor(request);
  const input = request.data?.input || {};
  const notificationKind = clean(input.notificationKind) === "member_message" ? "member_message" : "event";
  const eventId = clean(input.eventId);
  if (notificationKind === "event" && !eventId) throw new HttpsError("invalid-argument", "Bitte Veranstaltung auswaehlen.");
  let eventRecord = {};
  if (notificationKind === "event") {
    const eventSnapshot = await db.collection("events").doc(eventId).get();
    if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
    eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
    await assertNoHiddenTalkMentions(eventRecord, input);
  }
  const testRecipients = clean(input.testRecipients)
    .split(/[\s,;]+/)
    .map((email) => mailAddress(email))
    .filter(Boolean)
    .filter((email, index, all) => all.indexOf(email) === index);
  const testOnly = clean(input.recipientGroup) !== "test_group" && (clean(input.recipientGroup) === "test_person" || input.testOnly === true || input.testOnly === "true");
  if (testOnly && !testRecipients.length) throw new HttpsError("invalid-argument", "Bitte mindestens eine Testperson eintragen.");
  const recipientGroup = ["members", "contacts", "members_contacts", "event_registered", "event_speakers", "event_registered_speakers", "other_event_speakers", "test_group", "test_person"].includes(clean(input.recipientGroup))
    ? clean(input.recipientGroup)
    : "members_contacts";
  const registrationStatus = ["all", "registered", "unregistered"].includes(clean(input.registrationStatus)) ? clean(input.registrationStatus) : "all";
  const includeEventSpeakers = notificationKind === "event" && !["test_group", "test_person"].includes(recipientGroup);
  const extraSpeakerEventIds = includeEventSpeakers ? notificationExtraSpeakerEventIds(input, eventId) : [];
  await validateOtherEventSpeakerSource(recipientGroup, eventId, extraSpeakerEventIds, notificationKind);
  const testRecipientMobiles = clean(input.testRecipientMobiles).split(/[\s,;]+/).map(phoneNumber).filter(Boolean);
  const targets = recipientGroup === "test_group"
    ? await notificationTestGroupTargets()
    : testOnly
      ? await notificationTestPersonTargets(testRecipients, testRecipientMobiles)
      : await eventNotificationTargets(notificationKind === "event" ? eventId : "", {
        recipientGroup,
        includeMembers: ["members", "members_contacts"].includes(recipientGroup),
        includeContacts: ["contacts", "members_contacts"].includes(recipientGroup),
        includeRegistered: ["event_registered", "event_registered_speakers"].includes(recipientGroup),
        includeSpeakers: includeEventSpeakers || ["event_speakers", "event_registered_speakers"].includes(recipientGroup),
        extraSpeakerEventIds,
        registrationStatus
      });
  assertNotificationRecipientNames(input, targets);
  const channels = Array.isArray(input.channels)
    ? [...new Set(input.channels.map(clean).filter((channel) => ["mail", "push", "sms"].includes(channel)))]
    : ["mail", "push"];
  if (!channels.length) throw new HttpsError("invalid-argument", "Bitte mindestens einen Versandkanal auswaehlen.");
  if (recipientGroup === "other_event_speakers" && !targets.some((target) => target.email)) throw new HttpsError("failed-precondition", "Im Quell-Event gibt es keine erreichbaren Referenten.");
  const smsTargets = channels.includes("sms") ? targets.filter((target) => target.phone) : [];
  let smsCostEstimate = null;
  let smsCostEstimateId = "";
  if (channels.includes("sms")) {
    const linkEnabled = input.linkEnabled !== false && clean(input.linkEnabled) !== "false";
    const defaultLink = notificationKind === "event" ? eventUrl(eventId) : publicHashUrl("members");
    const previewNotification = {
      eventId: notificationKind === "event" ? eventId : "",
      notificationKind,
      shortText: stripTags(input.shortText) || `Informationen zu ${eventRecord.title || "dieser Veranstaltung"}.`,
      smsText: stripTags(input.smsText || (notificationKind === "event" ? `Sie sind herzlich eingeladen: ${eventRecord.title || "PROdigitalTV"}. Details und Anmeldung finden Sie im Link.` : "Neue Informationen von PROdigitalTV.")).slice(0, 612),
      smsLinkEnabled: input.smsLinkEnabled !== false && clean(input.smsLinkEnabled) !== "false",
      linkEnabled,
      link: linkEnabled ? clean(input.link) || defaultLink : ""
    };
    let prices = [];
    if (smsTargets.length) {
      try {
        prices = await currentSmsPrices();
      } catch (error) {
        console.error("SMS price list failed", error);
        throw new HttpsError("failed-precondition", `SMS-Kostenschaetzung nicht verfuegbar: ${clean(error.message).slice(0, 240)}`);
      }
    }
    const estimates = smsTargets.map((target) => {
      const message = eventNotificationSmsBody(previewNotification, eventRecord, target);
      const parts = smsMessagePartCount(message);
      const rate = smsRateForPhone(target.phone, prices);
      return { parts, rate, netEur: parts * rate };
    });
    const estimatedNetEur = Number(estimates.reduce((sum, estimate) => sum + estimate.netEur, 0).toFixed(2));
    const smsPartCount = estimates.reduce((sum, estimate) => sum + estimate.parts, 0);
    const estimateRef = db.collection("smsCostEstimates").doc(`sms-cost-${randomBytes(16).toString("hex")}`);
    smsCostEstimateId = estimateRef.id;
    smsCostEstimate = {
      provider: "smsapi",
      pricingMode: "current_rate_max_by_country",
      currency: "EUR",
      estimatedNetEur,
      recipientCount: smsTargets.length,
      messagePartCount: smsPartCount,
      estimatedAtIso: new Date().toISOString()
    };
    await estimateRef.set({
      id: estimateRef.id,
      eventId: notificationKind === "event" ? eventId : "",
      notificationKind,
      recipientGroup,
      targetCount: targets.length,
      ...smsCostEstimate,
      fingerprint: smsEstimateFingerprint(input),
      status: "previewed",
      createdBy: profile.email || request.auth.uid,
      createdByUid: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  return {
    targetCount: targets.length,
    mailCount: channels.includes("mail") ? targets.filter((target) => target.email).length : 0,
    smsCount: smsTargets.length,
    pushCount: channels.includes("push") ? targets.filter((target) => target.email).length : 0,
    smsCostEstimate,
    smsCostEstimateId,
    recipientEmails: recipientGroup === "test_group" || recipientGroup === "other_event_speakers" || testOnly ? targets.map((target) => target.email).filter(Boolean) : [],
    testOnly,
    recipientGroup
  };
});

exports.getLiveSurvey = onCall({ region, invoker: "public" }, async (request) => {
  const surveyId = clean(request.data?.surveyId);
  if (!surveyId) throw new HttpsError("invalid-argument", "Umfrage fehlt.");
  const snapshot = await db.collection("liveSurveys").doc(surveyId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Umfrage wurde nicht gefunden.");
  const survey = { id: snapshot.id, ...snapshot.data() };
  if (["archived", "deleted", "inactive"].includes(clean(survey.status).toLowerCase())) {
    throw new HttpsError("failed-precondition", "Diese Umfrage ist nicht aktiv.");
  }
  const questions = liveSurveyQuestions(survey.questions);
  const legacyQuestions = questions.length ? questions : [{
    id: "question-1",
    type: survey.allowMultiple === true ? "multiple" : "single",
    question: survey.question || "",
    required: true,
    options: Array.isArray(survey.options) ? survey.options : []
  }];
  return {
    id: survey.id,
    eventId: survey.eventId || "",
    title: survey.title || "PROdigitalTV Umfrage",
    question: survey.question || "",
    allowMultiple: survey.allowMultiple === true,
    questions: legacyQuestions,
    options: Array.isArray(survey.options) ? survey.options.map((option) => ({
      id: clean(option.id),
      label: clean(option.label)
    })).filter((option) => option.id && option.label) : []
  };
});

exports.submitLiveSurveyResponse = onCall({ region, invoker: "public" }, async (request) => {
  const input = request.data?.input || {};
  const surveyId = clean(input.surveyId);
  const responseToken = clean(input.token);
  if (!surveyId) throw new HttpsError("invalid-argument", "Umfrage fehlt.");
  const surveySnapshot = await db.collection("liveSurveys").doc(surveyId).get();
  if (!surveySnapshot.exists) throw new HttpsError("not-found", "Umfrage wurde nicht gefunden.");
  const survey = { id: surveySnapshot.id, ...surveySnapshot.data() };
  if (["archived", "deleted", "inactive"].includes(clean(survey.status).toLowerCase())) {
    throw new HttpsError("failed-precondition", "Diese Umfrage ist nicht aktiv.");
  }
  const normalizedQuestions = liveSurveyQuestions(survey.questions);
  const questions = normalizedQuestions.length ? normalizedQuestions : [{
    id: "question-1",
    type: survey.allowMultiple === true ? "multiple" : "single",
    question: survey.question || "",
    required: true,
    options: Array.isArray(survey.options) ? survey.options : []
  }];
  let submittedAnswers = Array.isArray(input.answers) ? input.answers : [];
  if (!submittedAnswers.length && (input.optionId || input.optionIds)) {
    submittedAnswers = [{ questionId: questions[0].id, optionIds: Array.isArray(input.optionIds) ? input.optionIds : [input.optionId] }];
  }
  const answerByQuestion = new Map(submittedAnswers.map((answer) => [clean(answer?.questionId), answer || {}]));
  const answers = [];
  questions.forEach((question) => {
    const submitted = answerByQuestion.get(question.id) || {};
    if (question.type === "text") {
      const text = stripTags(submitted.text || "").slice(0, 2000);
      if (question.required && !text) throw new HttpsError("invalid-argument", `Bitte beantworten Sie: ${question.question}`);
      if (text) answers.push({ questionId: question.id, question: question.question, type: "text", text });
      return;
    }
    const rawIds = Array.isArray(submitted.optionIds) ? submitted.optionIds : [submitted.optionId];
    const optionIds = rawIds.map((item) => clean(item)).filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).slice(0, 12);
    if (question.required && !optionIds.length) throw new HttpsError("invalid-argument", `Bitte beantworten Sie: ${question.question}`);
    if (question.type === "single" && optionIds.length > 1) throw new HttpsError("invalid-argument", `Bitte waehlen Sie bei „${question.question}“ nur eine Antwort.`);
    const selectedOptions = optionIds.map((optionId) => question.options.find((option) => clean(option.id) === optionId)).filter(Boolean);
    if (selectedOptions.length !== optionIds.length) throw new HttpsError("invalid-argument", "Eine ausgewaehlte Antwort wurde nicht gefunden.");
    if (optionIds.length) answers.push({
      questionId: question.id,
      question: question.question,
      type: question.type,
      optionId: optionIds[0] || "",
      optionIds,
      optionLabel: selectedOptions.map((option) => clean(option.label)).filter(Boolean).join(", "),
      optionLabels: selectedOptions.map((option) => clean(option.label)).filter(Boolean)
    });
  });
  if (!answers.length) throw new HttpsError("invalid-argument", "Bitte mindestens eine Frage beantworten.");
  const primaryChoiceAnswer = answers.find((answer) => answer.type !== "text") || {};
  const optionIds = primaryChoiceAnswer.optionIds || [];
  const selectedLabels = primaryChoiceAnswer.optionLabels || [];
  const allowMultiple = questions[0]?.type === "multiple";
  if (survey.requiresToken !== false && !responseToken) {
    throw new HttpsError("failed-precondition", "Dieser Umfragelink ist persoenlich. Bitte den Link aus der Einladung oeffnen.");
  }
  const now = new Date();
  const ipAddress = clientIp(request);
  const responsePayload = {
    surveyId,
    eventId: survey.eventId || "",
    notificationId: survey.notificationId || "",
    question: survey.question || "",
    optionId: optionIds[0] || "",
    optionIds,
    optionLabel: selectedLabels.join(", "),
    optionLabels: selectedLabels,
    answers,
    schemaVersion: 2,
    allowMultiple,
    userAgent: stripTags(request.rawRequest?.headers?.["user-agent"] || ""),
    ipHash: ipAddress ? hashToken(ipAddress).slice(0, 32) : "",
    createdAtIso: now.toISOString()
  };
  await db.runTransaction(async (transaction) => {
    let responseRef = db.collection("liveSurveyResponses").doc(`live-survey-response-${randomBytes(16).toString("hex")}`);
    let inviteRef = null;
    let invite = {};
    if (responseToken) {
      const responseTokenHash = hashToken(responseToken);
      inviteRef = db.collection("liveSurveyInvites").doc(`live-survey-invite-${responseTokenHash.slice(0, 40)}`);
      const inviteSnapshot = await transaction.get(inviteRef);
      if (!inviteSnapshot.exists) throw new HttpsError("permission-denied", "Dieser Umfragelink ist ungueltig.");
      invite = inviteSnapshot.data() || {};
      if (invite.surveyId !== surveyId) throw new HttpsError("permission-denied", "Dieser Umfragelink gehoert nicht zu dieser Umfrage.");
      if (invite.usedAt || clean(invite.status) === "used") throw new HttpsError("already-exists", "Fuer diesen Link wurde bereits abgestimmt.");
      responseRef = db.collection("liveSurveyResponses").doc(`live-survey-response-${responseTokenHash.slice(0, 40)}`);
      transaction.set(inviteRef, {
        status: "used",
        usedAtIso: now.toISOString(),
        usedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    transaction.set(responseRef, {
      id: responseRef.id,
      ...responsePayload,
      surveyInviteId: inviteRef?.id || "",
      email: invite.email || "",
      personName: invite.personName || "",
      firstName: invite.firstName || "",
      lastName: invite.lastName || "",
      company: invite.company || "",
      audienceType: invite.audienceType || "",
      createdAt: FieldValue.serverTimestamp()
    });
    const surveyUpdate = {
      responseCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    };
    answers.filter((answer) => answer.type !== "text").forEach((answer) => {
      answer.optionIds.forEach((optionId) => {
        surveyUpdate[`questionCounts.${answer.questionId}.${optionId}`] = FieldValue.increment(1);
        if (answer.questionId === questions[0]?.id) surveyUpdate[`optionCounts.${optionId}`] = FieldValue.increment(1);
      });
    });
    transaction.set(db.collection("liveSurveys").doc(surveyId), surveyUpdate, { merge: true });
  });
  return { ok: true, optionLabel: selectedLabels.join(", "), answerCount: answers.length };
});

exports.adminCheckInEventGroup = onCall({ region }, async (request) => {
  const profile = await requireEditor(request);
  const eventId = clean(request.data?.eventId);
  const groupType = clean(request.data?.groupType).toLowerCase();
  const sendWelcomeMail = request.data?.sendWelcomeMail !== false;
  const personIds = [...new Set((Array.isArray(request.data?.personIds) ? request.data.personIds : []).map(clean).filter(Boolean))].slice(0, 100);
  if (!eventId) throw new HttpsError("invalid-argument", "Event fehlt.");
  if (!["speakers", "board"].includes(groupType)) throw new HttpsError("invalid-argument", "Gruppe ist ungueltig.");
  if (!personIds.length) throw new HttpsError("invalid-argument", "Bitte mindestens eine Person auswaehlen.");
  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) throw new HttpsError("not-found", "Event wurde nicht gefunden.");
  const eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
  const collectionName = groupType === "speakers" ? "speakers" : "boardMembers";
  const topicIds = new Set(Array.isArray(eventRecord.topicIds) ? eventRecord.topicIds : []);
  const eventSpeakerIds = new Set(Array.isArray(eventRecord.speakerIds) ? eventRecord.speakerIds : []);
  const selectedDocs = await Promise.all(personIds.map((personId) => db.collection(collectionName).doc(personId).get()));
  const people = selectedDocs.filter((snapshot) => snapshot.exists).map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  const eligiblePeople = people.filter((person) => {
    if (groupType === "board") return true;
    return eventSpeakerIds.has(person.id)
      || (Array.isArray(person.eventIds) && person.eventIds.includes(eventId))
      || (Array.isArray(person.topicIds) && person.topicIds.some((topicId) => topicIds.has(topicId)))
      || topicIds.has(person.topicId);
  });
  if (!eligiblePeople.length) throw new HttpsError("failed-precondition", "Keine ausgewaehlte Person ist dieser Veranstaltung zugeordnet.");
  const now = FieldValue.serverTimestamp();
  const checkedIn = [];
  const skipped = [];
  for (const person of eligiblePeople) {
    const email = clean(person.email || person.mail || person.contactEmail).toLowerCase();
    const displayName = clean(person.name || [person.firstName, person.lastName].filter(Boolean).join(" "));
    if (!email || !email.includes("@")) {
      skipped.push({ id: person.id, name: displayName || person.id, reason: "E-Mail fehlt" });
      continue;
    }
    const nameParts = displayName.split(/\s+/).filter(Boolean);
    const firstName = clean(person.firstName || nameParts.slice(0, -1).join(" ") || nameParts[0]);
    const lastName = clean(person.lastName || (nameParts.length > 1 ? nameParts.at(-1) : ""));
    const existingSnapshot = await db.collection("registrations")
      .where("eventId", "==", eventId)
      .where("email", "==", email)
      .limit(10)
      .get();
    const existingDocument = existingSnapshot.docs.find((document) => !["cancelled", "canceled", "deleted", "archived"].includes(clean(document.data()?.status).toLowerCase()));
    const registrationRef = existingDocument?.ref || db.collection("registrations").doc(`registration-${randomBytes(16).toString("hex")}`);
    const existing = existingDocument?.data() || {};
    const shouldQueueWelcomeMail = sendWelcomeMail && !existing.checkinAgendaMailQueuedAt;
    const registration = {
      id: registrationRef.id,
      eventId,
      eventTitle: eventRecord.title || "",
      eventDate: eventRecord.date || "",
      eventAccessType: eventRecord.accessType || "",
      firstName,
      lastName,
      email,
      phone: clean(person.phone || person.mobile),
      company: clean(person.company || person.organization),
      position: clean(person.position || person.role),
      participantCount: 1,
      emailConfirmed: true,
      status: "checked_in",
      checkedInEventId: eventId,
      checkedInAt: existing.checkedInAt || now,
      registrationSource: `${groupType}_group_checkin`,
      registrationAudienceType: groupType === "speakers" ? "speaker" : "board",
      sourcePersonId: person.id,
      sourceGroup: groupType,
      privacyAccepted: existing.privacyAccepted === true,
      mailStatus: "not_required",
      ...(shouldQueueWelcomeMail ? { checkinAgendaMailQueuedAt: now } : {}),
      createdBy: existing.createdBy || profile.email || request.auth.uid,
      createdAt: existing.createdAt || now,
      updatedAt: now
    };
    await registrationRef.set({ ...existing, ...registration }, { merge: true });
    await db.collection("registrationLocks").doc(registrationLockId(eventId, email)).set({
      id: registrationLockId(eventId, email),
      eventId,
      email,
      registrationId: registrationRef.id,
      status: "checked_in",
      updatedAt: now,
      createdAt: existing.createdAt || now
    }, { merge: true });
    if (shouldQueueWelcomeMail) {
      await queueMail({
        type: "checkin_agenda",
        template: "checkin_agenda",
        to: email,
        subject: `Willkommen: ${eventRecord.title || "PROdigitalTV Event"}`,
        registrationId: registrationRef.id,
        eventId,
        dedupeKey: `checkin_agenda:${registrationRef.id}:${eventId}`,
        source: `${groupType}_group_checkin`
      });
    }
    await db.collection("checkinScreenEvents").doc(eventId).set({
      eventId,
      registrationId: registrationRef.id,
      firstName,
      lastName,
      company: registration.company,
      participantCount: 1,
      displayName: displayName || [firstName, lastName].filter(Boolean).join(" "),
      checkedInAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    checkedIn.push({ id: person.id, registrationId: registrationRef.id, name: displayName || [firstName, lastName].filter(Boolean).join(" "), email, welcomeMailQueued: shouldQueueWelcomeMail });
  }
  return { ok: true, eventId, groupType, sendWelcomeMail, checkedIn, skipped, checkedInCount: checkedIn.length, skippedCount: skipped.length, welcomeMailQueuedCount: checkedIn.filter((person) => person.welcomeMailQueued).length };
});

exports.registerNotificationToken = onCall({ region }, async (request) => {
  return pushService.register(request);
});

exports.getBrowserPushDeviceStatus = onCall({ region }, (request) => pushService.deviceStatus(request));
exports.disableBrowserPush = onCall({ region }, (request) => pushService.deviceStatus(request, true));

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
    if (!email || !token.token || token.verified !== true || !emailSet.has(email)) return;
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
  const users = await db.collection("users").get();
  const userBatch = db.batch();
  let userUpdates = 0;
  users.docs.forEach((document) => {
    const user = document.data() || {};
    const email = clean(user.email || user.contactEmail || user.primaryEmail);
    if (!email || notificationOptOutHash(email) !== hash) return;
    userBatch.set(document.ref, {
      reminderConsent: false,
      mailingDisabled: true,
      notificationOptOut: true,
      notificationOptOutAt: now,
      updatedAt: now
    }, { merge: true });
    userUpdates += 1;
    updated += 1;
  });
  if (userUpdates) await userBatch.commit();
  if (!updated) throw new HttpsError("not-found", "Abmeldeeintrag wurde nicht gefunden.");
  return { unsubscribed: true, updated };
});

function eventEndTimeMillis(eventRecord = {}) {
  const date = clean(eventRecord.date || eventRecord.eventDate).slice(0, 10);
  if (!date) return 0;
  const time = clean(eventRecord.endTime) || "23:59:59";
  const value = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return Number.isFinite(value) ? value : 0;
}

function automaticRetrospectiveBody(eventRecord = {}) {
  const summary = clean(
    eventRecord.longDescription
    || eventRecord.bodyText
    || eventRecord.articleText
    || eventRecord.archiveText
    || eventRecord.postEventSummary
    || eventRecord.postEventummary
    || eventRecord.description
  );
  const facts = [
    eventRecord.date ? `Die Veranstaltung fand am ${eventRecord.date} statt.` : "",
    [eventRecord.locationName, eventRecord.city].filter(Boolean).length
      ? `Veranstaltungsort war ${[eventRecord.locationName, eventRecord.city].filter(Boolean).join(", ")}.`
      : "",
    eventRecord.subtitle ? `Im Mittelpunkt stand: ${eventRecord.subtitle}` : ""
  ].filter(Boolean).join(" ");
  return [summary, facts, "Der Rückblick dokumentiert die wichtigsten Impulse und Inhalte der Veranstaltung."]
    .filter(Boolean)
    .join("\n\n");
}

exports.publishEndedEventRetrospectives = onSchedule({ region, schedule: "every 15 minutes", timeZone: "Europe/Berlin" }, async () => {
  const [eventSnapshot, articleSnapshot] = await Promise.all([
    db.collection("events").get(),
    db.collection("editorialContent").get()
  ]);
  const articles = articleSnapshot.docs.map((document) => ({ id: document.id, ref: document.ref, ...document.data() }));
  const now = new Date();
  const nowIso = now.toISOString();
  const batch = db.batch();
  let writes = 0;

  for (const eventDocument of eventSnapshot.docs) {
    const eventRecord = { id: eventDocument.id, ...eventDocument.data() };
    const state = clean(eventRecord.status).toLowerCase();
    if (eventRecord.retrospectiveAutoDisabled === true || ["deleted", "cancelled", "canceled"].includes(state)) continue;
    const endMs = eventEndTimeMillis(eventRecord);
    if (!endMs || endMs > now.getTime()) continue;

    const expectedId = clean(eventRecord.retrospectiveArticleId) || `retrospective-${eventRecord.id}`;
    const existing = articles.find((article) =>
      article.id === expectedId
      || article.id === eventRecord.retrospectiveArticleId
      || article.linkedEventId === eventRecord.id
      || article.galleryEventId === eventRecord.id
    );

    if (existing) {
      const status = clean(existing.status).toLowerCase();
      if (existing.automaticEventAssignment === true && ["", "draft"].includes(status)) {
        batch.set(existing.ref, {
          category: "Rückblicke",
          isRetrospective: true,
          status: "published",
          visible: true,
          visibility: "public",
          publishDate: existing.publishDate || eventRecord.date || nowIso.slice(0, 10),
          validFrom: existing.validFrom || eventRecord.date || nowIso.slice(0, 10),
          publishedAt: existing.publishedAt || nowIso,
          autoPublishedAfterEvent: true,
          updatedAt: nowIso
        }, { merge: true });
        writes += 1;
      }
      if (eventRecord.retrospectiveArticleId !== existing.id) {
        batch.set(eventDocument.ref, { retrospectiveArticleId: existing.id, updatedAt: nowIso }, { merge: true });
        writes += 1;
      }
      continue;
    }

    const articleId = expectedId;
    const title = clean(eventRecord.retrospectiveTitle) || `Rückblick: ${clean(eventRecord.title) || "PROdigitalTV Event"}`;
    const introText = clean(eventRecord.postEventSummary || eventRecord.postEventummary || eventRecord.description || eventRecord.subtitle)
      || "Redaktioneller Rückblick auf ein PROdigitalTV-Event.";
    const bodyText = automaticRetrospectiveBody(eventRecord);
    const imageUrl = clean(eventRecord.imageUrl || eventRecord.thumbnail_url || eventRecord.thumbnailUrl || eventRecord.assetUrl);
    const mediaAssetId = clean(eventRecord.thumbnail_media_asset_id || eventRecord.mediaAssetId);
    batch.set(db.collection("editorialContent").doc(articleId), {
      id: articleId,
      page: "press",
      section: "pressRelease",
      key: `press.${articleId}`,
      category: "Rückblicke",
      title,
      headline: title,
      subtitle: clean(eventRecord.subtitle),
      introText,
      longDescription: bodyText,
      bodyText,
      articleText: bodyText,
      archiveText: bodyText,
      body: bodyText,
      status: "published",
      visible: true,
      visibility: "public",
      publishDate: eventRecord.date || nowIso.slice(0, 10),
      validFrom: eventRecord.date || nowIso.slice(0, 10),
      linkedEventId: eventRecord.id,
      galleryEventId: eventRecord.id,
      galleryId: clean(eventRecord.galleryId),
      sponsorId: clean(eventRecord.hostId),
      imageUrl,
      thumbnail_url: imageUrl,
      thumbnailUrl: imageUrl,
      assetUrl: imageUrl,
      thumbnail_media_asset_id: mediaAssetId,
      mediaAssetId,
      thumbnail_alt: clean(eventRecord.thumbnail_alt || eventRecord.thumbnailAlt) || `Eventbild ${clean(eventRecord.title)}`,
      videoAttachments: [],
      isRetrospective: true,
      showGallery: true,
      automaticEventAssignment: true,
      autoPublishedAfterEvent: true,
      publishedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    }, { merge: true });
    batch.set(eventDocument.ref, {
      retrospectiveArticleId: articleId,
      retrospectiveTitle: title,
      updatedAt: nowIso
    }, { merge: true });
    writes += 2;
  }

  if (writes) await batch.commit();
  console.log(`Automatische Rückblicke: ${writes} Schreibvorgänge.`);
});

async function processAutomaticEventFeedback(eventDocument, eventRecord) {
  if (eventRecord.feedbackAutoSendEnabled !== true || eventRecord.feedbackAutoSentAt) return;
  const dueAt = new Date(clean(eventRecord.feedbackAutoSendAt)).getTime();
  if (!Number.isFinite(dueAt) || dueAt > Date.now()) return;
  const jobRef = db.collection("eventNotifications").doc(`event-feedback-auto-${eventRecord.id}`);
  const existingJob = await jobRef.get().catch(() => null);
  const existingStatus = clean(existingJob?.data()?.status).toLowerCase();
  if (["processing", "sent"].includes(existingStatus)) return;
  await jobRef.set({
    id: jobRef.id,
    eventId: eventRecord.id,
    notificationKind: "event_feedback",
    title: `Gästebefragung: ${eventRecord.title || "PROdigitalTV Veranstaltung"}`,
    status: "processing",
    scheduledAt: eventRecord.feedbackAutoSendAt,
    createdBy: "system",
    createdAt: existingJob?.exists ? existingJob.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  try {
    const result = await queueEventFeedbackInvitationsForEvent({
      eventId: eventRecord.id,
      eventRecord,
      createdBy: "system",
      createdByEmail: "automatik@prodigitaltv.de"
    });
    await Promise.all([
      eventDocument.ref.set({
        feedbackAutoSendEnabled: false,
        feedbackAutoSentAt: FieldValue.serverTimestamp(),
        feedbackAutoSendResult: { queued: result.queued, skipped: result.skipped },
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true }),
      jobRef.set({
        status: "sent",
        targetCount: result.queued + result.skipped,
        queuedMailCount: result.queued,
        skippedCount: result.skipped,
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true })
    ]);
  } catch (error) {
    await jobRef.set({ status: "failed", error: clean(error?.message || "Versand fehlgeschlagen"), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.error(`Automatische Gästebefragung ${eventRecord.id} fehlgeschlagen:`, error);
  }
}

exports.processEventNotifications = onSchedule({ region, schedule: "every 15 minutes", timeZone: "Europe/Berlin" }, async () => {
  const now = Timestamp.now();
  const due = await db.collection("eventNotifications")
    .where("status", "==", "scheduled")
    .where("scheduledAt", "<=", now)
    .limit(20)
    .get();
  for (const document of due.docs) {
    const notification = { id: document.id, ...document.data() };
    try {
      let eventRecord = {};
      if (notification.notificationKind !== "member_message") {
        const eventSnapshot = await db.collection("events").doc(notification.eventId).get();
        if (!eventSnapshot.exists) throw new Error("Event wurde nicht gefunden.");
        eventRecord = { id: eventSnapshot.id, ...eventSnapshot.data() };
      }
      await document.ref.set({ status: "processing", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await queueEventNotificationDelivery(notification, eventRecord);
    } catch (error) {
      await document.ref.set({ status: "failed", error: String(error.message || "Versand fehlgeschlagen"), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  const eventSnapshot = await db.collection("events").get();
  const mailTemplatesSnapshot = await db.collection("settings").doc("mailTemplates").get().catch(() => null);
  const mailTemplates = mailTemplateSettings(mailTemplatesSnapshot?.exists ? mailTemplatesSnapshot.data() : {});
  const reminders = [
    ["reminder7d", 10080, "7 Tage"],
    ["reminder1d", 1440, "1 Tag"],
    ["reminder2h", 120, "2 Stunden"]
  ];
  for (const eventDocument of eventSnapshot.docs) {
    const eventRecord = { id: eventDocument.id, ...eventDocument.data() };
    if (["archived", "deleted"].includes(clean(eventRecord.status).toLowerCase())) continue;
    await processAutomaticEventFeedback(eventDocument, eventRecord);
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
        shortText: eventRecord.reminderMail || mailTemplates.registrationReminder || defaultGlobalEventRegistrationMailText("reminder"),
        registeredText: eventRecord.reminderMail || mailTemplates.registrationReminder || defaultGlobalEventRegistrationMailText("reminder"),
        includeMembers: false,
        includeContacts: true,
        includeRegistered: true,
        includeSpeakers: true,
        registrationStatus: "registered",
        allowRegistrationCancellation: true,
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
  const now = FieldValue.serverTimestamp();
  const contactSync = await upsertContactFromRegistration({ id: event.params.registrationId, ...registration }, { id: registration.eventId, ...eventRecord }, now);
  if (contactSync.created) await countNewMailingContactForEvent(registration.eventId, "event_registration_trigger", contactSync, now);
  const companionContact = await upsertCompanionContact({ id: event.params.registrationId, ...registration }, { id: registration.eventId, ...eventRecord }, now);
  if (companionContact.created) await countNewMailingContactForEvent(registration.eventId, "event_companion", companionContact, now);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
  await event.data.ref.update({ eventTitle: eventRecord.title, eventDate: eventRecord.date, eventAccessType: eventRecord.accessType, handyTicketEnabled: eventUsesHandyTicket(eventRecord, registration), confirmationTokenHash: tokenHash, confirmationExpiresAt: expiresAt, updatedAt: FieldValue.serverTimestamp() });
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

async function eventIdsForSpeaker(speaker = {}) {
  const ids = new Set([
    ...(Array.isArray(speaker.eventIds) ? speaker.eventIds : []),
    speaker.eventId
  ].map(clean).filter(Boolean));
  const topicIds = [
    ...(Array.isArray(speaker.topicIds) ? speaker.topicIds : []),
    speaker.topicId
  ].map(clean).filter(Boolean);
  for (const topicId of topicIds.slice(0, 20)) {
    const snapshot = await db.collection("events").where("topicIds", "array-contains", topicId).limit(20).get().catch(() => null);
    snapshot?.docs?.forEach((document) => ids.add(document.id));
  }
  return [...ids];
}

exports.onSpeakerWritten = onDocumentWritten({ document: "speakers/{speakerId}", region }, async (event) => {
  if (!event.data?.after?.exists) return;
  const speaker = { id: event.params.speakerId, ...event.data.after.data() };
  const email = clean(speaker.email || speaker.mail || speaker.contactEmail).toLowerCase();
  if (!email) return;
  const now = FieldValue.serverTimestamp();
  const eventIds = await eventIdsForSpeaker(speaker);
  const contactSync = await upsertMailingContact({
    ...speaker,
    email,
    name: compactNameParts(speaker)
  }, {
    source: "speaker",
    eventId: eventIds[0] || "",
    eventIds,
    speakerId: speaker.id,
    topicIds: [
      ...(Array.isArray(speaker.topicIds) ? speaker.topicIds : []),
      speaker.topicId
    ].map(clean).filter(Boolean)
  }, now);
  if (contactSync.created) {
    await Promise.all(eventIds.map((eventId) => countNewMailingContactForEvent(eventId, "speaker", contactSync, now)));
  }
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

exports.pollBounceMailbox = onSchedule({ region, schedule: "every 15 minutes", timeoutSeconds: 120, maxInstances: 1, secrets: [BOUNCE_IMAP_PASSWORD] }, async () => {
  try {
    const counts = await pollBounceMailbox({ db, FieldValue, password: BOUNCE_IMAP_PASSWORD.value() });
    console.log("Bounce-Abruf:", counts);
  } finally {
    console.log("Mailing-Sperren:", await suppressDueMailingBounces({ db, FieldValue }));
  }
});

exports.releaseCheckinWelcomeMails = onSchedule({ region, schedule: "every 1 minutes", timeZone: "Europe/Berlin", timeoutSeconds: 120, maxInstances: 1 }, () => welcomeSchedule.process());

exports.sendQueuedMail = onDocumentCreated({ document: "mailQueue/{mailId}", region, secrets: smtpSecrets }, async (event) => {
  const mail = event.data.data();
  if (mail.status !== "queued") return;
  let resolvedTo = "";
  try {
    if (mail.template === "registration_confirmation_reminder") {
      const registrationSnapshot = await db.collection("registrations").doc(mail.registrationId).get();
      const registration = registrationSnapshot.data() || {};
      let token = "";
      try { token = new URL(mail.confirmationUrl).searchParams.get("token") || ""; } catch { token = ""; }
      if (!registrationSnapshot.exists || !confirmationReminderCanSend(registration, token ? hashToken(token) : "")) {
        await event.data.ref.update({ status: "skipped", skipReason: "Anmeldung bereits bestätigt oder Link erneuert", updatedAt: FieldValue.serverTimestamp() });
        return;
      }
    }
    resolvedTo = mailAddress(mail.to || MAIL_TO.value());
    const result = await sendQueuedMail({ id: event.params.mailId, ...mail });
    const accepted = Array.isArray(result.accepted) ? result.accepted.map(clean).filter(Boolean) : [];
    const rejected = Array.isArray(result.rejected) ? result.rejected.map(clean).filter(Boolean) : [];
    const actualTo = Array.isArray(result.envelope?.to) ? result.envelope.to.map(mailAddress).filter(Boolean).join(", ") : resolvedTo;
    await event.data.ref.update({
      to: mail.to || actualTo,
      ...(mail.template === "ticket_recovery" ? { text: FieldValue.delete() } : {}),
      ...(mail.template === "event_guest_password" ? { temporaryPassword: FieldValue.delete() } : {}),
      status: rejected.length && !accepted.length ? "failed" : "sent",
      sentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      providerMessageId: result.messageId || "",
      providerAccepted: accepted,
      providerRejected: rejected,
      providerResponse: clean(result.response || "").slice(0, 500),
      deliveryStatus: rejected.length ? "partly_rejected" : "accepted"
    });
    const updateTarget = ["ticket_recovery", "event_guest_password"].includes(mail.template) ? null : mail.registrationId
      ? db.collection("registrations").doc(mail.registrationId)
      : mail.membershipApplicationId
        ? db.collection("membershipApplications").doc(mail.membershipApplicationId)
        : mail.userInvitationId
          ? db.collection("userInvitations").doc(mail.userInvitationId)
          : null;
    if (updateTarget) {
      await updateTarget.set({
        mailStatus: rejected.length && !accepted.length ? "failed" : "sent",
        mailDeliveryStatus: rejected.length ? "partly_rejected" : "accepted",
        lastMailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    if (mail.template === "speaker_approval_completed" && mail.speakerApprovalId) {
      await db.collection("speakerApprovals").doc(mail.speakerApprovalId).set({
        completionMailStatus: rejected.length && !accepted.length ? "failed" : "sent",
        completionMailSentAt: FieldValue.serverTimestamp(),
        completionMailDeliveryStatus: rejected.length ? "partly_rejected" : "accepted",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    await event.data.ref.update({
      to: mail.to || resolvedTo,
      ...(mail.template === "event_guest_password" ? { temporaryPassword: FieldValue.delete() } : {}),
      status: "failed",
      error: error.message || "Mailversand fehlgeschlagen.",
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    const updateTarget = ["ticket_recovery", "event_guest_password"].includes(mail.template) ? null : mail.registrationId
      ? db.collection("registrations").doc(mail.registrationId)
      : mail.membershipApplicationId
        ? db.collection("membershipApplications").doc(mail.membershipApplicationId)
        : mail.userInvitationId
          ? db.collection("userInvitations").doc(mail.userInvitationId)
          : null;
    if (updateTarget) {
      await updateTarget.set({
        mailStatus: "failed",
        mailError: error.message || "Mailversand fehlgeschlagen.",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    if (mail.template === "speaker_approval_completed" && mail.speakerApprovalId) {
      await db.collection("speakerApprovals").doc(mail.speakerApprovalId).set({
        completionMailStatus: "failed",
        completionMailError: error.message || "Mailversand fehlgeschlagen.",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
});

exports.sendQueuedSms = onDocumentCreated({ document: "smsQueue/{smsId}", region, secrets: smsSecrets }, async (event) => {
  const sms = event.data.data();
  if (sms.status !== "queued") return;
  try {
    if (sms.type === "registration_confirmation_sms") {
      const registrationSnapshot = await db.collection("registrations").doc(sms.registrationId || "").get();
      const registration = registrationSnapshot.data() || {};
      let token = "";
      try { token = new URL(sms.confirmationUrl).searchParams.get("token") || ""; } catch {}
      if (!registrationSnapshot.exists || !confirmationReminderCanSend(registration, token ? hashToken(token) : "")
        || (registration.confirmationExpiresAt?.toMillis?.() || 0) <= Date.now()) {
        await event.data.ref.update({
          status: "skipped", skipReason: "Anmeldung bereits bestätigt oder Link erneuert",
          updatedAt: FieldValue.serverTimestamp()
        });
        return;
      }
    }
    const result = await sendQueuedSms(sms);
    const costFields = Number.isFinite(result.netEur) ? {
      actualCostNetEur: result.netEur,
      actualCostPoints: result.points,
      actualMessageParts: result.parts,
      costCurrency: result.currency
    } : {};
    await event.data.ref.update({
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      providerMessageId: result.messageId || "",
      providerResponse: result.response || "",
      ...costFields,
      updatedAt: FieldValue.serverTimestamp()
    });
    if (sms.notificationId && Number.isFinite(result.netEur)) {
      await db.collection("eventNotifications").doc(sms.notificationId).set({
        actualSmsCostNetEur: FieldValue.increment(result.netEur),
        actualSmsCostPoints: FieldValue.increment(result.points),
        actualSmsMessageParts: FieldValue.increment(result.parts),
        actualSmsSentCount: FieldValue.increment(1),
        costCurrency: result.currency,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    await event.data.ref.update({
      status: "failed",
      error: error.message || "SMS-Versand fehlgeschlagen.",
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    if (sms.notificationId) {
      await db.collection("eventNotifications").doc(sms.notificationId).set({
        actualSmsFailedCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
});

async function markPushRegistration(interaction, field) {
  if (!interaction?.registrationId || !interaction.eventId) return;
  const ref = db.collection("registrations").doc(interaction.registrationId);
  const snapshot = await ref.get();
  const registration = snapshot.data();
  if (!registration || registration.eventId !== interaction.eventId || registration.pushTrackingConsent !== true
    || !["confirmed", "checked_in"].includes(registration.status)) return;
  await ref.set({ [field]: FieldValue.serverTimestamp(), lastPushNotificationId: interaction.notificationId || "" }, { merge: true });
}

exports.trackPushClick = onRequest({ region, invoker: "public" }, async (req, res) => {
  const id = clean(req.query.i);
  let destination = PUBLIC_APP_BASE_URL;
  if (/^push-[a-f0-9]{32}$/.test(id)) {
    const ref = db.collection("pushInteractions").doc(id);
    const snapshot = await ref.get().catch(() => null);
    const interaction = snapshot?.exists ? snapshot.data() : null;
    if (interaction && ["sending", "sent"].includes(interaction.status)) {
      if (!interaction.clickedAt) await ref.set({ clickedAt: FieldValue.serverTimestamp() }, { merge: true }).catch((error) => console.error("Push click log failed", id, error));
      await markPushRegistration(interaction, "pushClickedAt").catch((error) => console.error("Push click registration update failed", id, error));
      try {
        const url = new URL(interaction.link || PUBLIC_APP_BASE_URL, PUBLIC_APP_BASE_URL);
        if (url.protocol === "https:") {
          if (interaction.link && ["prodigitaltv-da47b.web.app", "prodigitaltv.web.app", "prodigtaltv.web.app"].includes(url.hostname)) url.searchParams.set("pdtPushId", id);
          destination = url.href;
        }
      } catch {}
    }
  }
  res.set("Cache-Control", "no-store");
  res.redirect(302, destination);
});

exports.trackPushLanding = onRequest({ region, invoker: "public" }, async (req, res) => {
  const id = clean(req.query.i);
  if (/^push-[a-f0-9]{32}$/.test(id)) {
    const ref = db.collection("pushInteractions").doc(id);
    const snapshot = await ref.get().catch(() => null);
    const interaction = snapshot?.exists ? snapshot.data() : null;
    if (interaction?.clickedAt && !interaction.landedAt) {
      await ref.set({ landedAt: FieldValue.serverTimestamp() }, { merge: true });
      await markPushRegistration(interaction, "pushLinkVisitedAt").catch((error) => console.error("Push landing registration update failed", id, error));
    }
  }
  res.set("Cache-Control", "no-store");
  res.status(204).end();
});
exports.trackEventMailClick = onRequest({ region, invoker: "public" }, async (req, res) => {
  const mailId = clean(req.query.m || req.query.mailId || "");
  let destination = PUBLIC_APP_BASE_URL;
  if (mailId && /^[A-Za-z0-9_-]{8,80}$/.test(mailId)) {
    const ref = db.collection("mailQueue").doc(mailId);
    const snapshot = await ref.get().catch(() => null);
    const mail = snapshot?.exists ? snapshot.data() : {};
    const storedLink = clean(mail?.link || "");
    if (/^https:\/\//i.test(storedLink)) destination = storedLink;
    else if (mail?.eventId) destination = eventUrl(mail.eventId);
    if (snapshot?.exists) {
      const clickUpdate = { eventLinkClicked: true, eventLinkClickCount: FieldValue.increment(1), lastEventLinkClickedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      if (!mail.eventLinkClicked) clickUpdate.firstEventLinkClickedAt = FieldValue.serverTimestamp();
      await ref.set(clickUpdate, { merge: true }).catch((error) => console.error("trackEventMailClick failed", mailId, error));
    }
  }
  res.set("Cache-Control", "no-store");
  res.redirect(302, destination);
});
exports.trackMailOpen = onRequest({ region, invoker: "public" }, async (req, res) => {
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  const mailId = clean(req.query.m || req.query.mailId || "");
  if (mailId && /^[A-Za-z0-9_-]{8,80}$/.test(mailId)) {
    const now = new Date();
    const userAgent = cleanUsageValue(req.get("user-agent") || "", 500);
    const ipAddress = requestIp(req);
    const ref = db.collection("mailQueue").doc(mailId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const update = {
        opened: true,
        openCount: FieldValue.increment(1),
        lastOpenedAt: FieldValue.serverTimestamp(),
        lastOpenDay: now.toISOString().slice(0, 10),
        lastOpenUserAgent: userAgent,
        lastOpenIpHash: ipAddress ? hashToken(ipAddress).slice(0, 32) : "",
        updatedAt: FieldValue.serverTimestamp()
      };
      if (!snapshot.exists || !snapshot.data()?.opened) update.firstOpenedAt = FieldValue.serverTimestamp();
      transaction.set(ref, update, { merge: true });
    }).catch((error) => {
      console.error("trackMailOpen failed", mailId, error);
    });
  }
  res.status(200).send(transparentPixel);
});

exports.sendRegistrationConfirmationMail = onCall({ region }, async (request) => {
  const { registrationId } = request.data || {};
  if (!registrationId) throw new HttpsError("invalid-argument", "registrationId fehlt.");
  const snapshot = await db.collection("registrations").doc(registrationId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Anmeldung nicht gefunden.");
  // The creation trigger queues the initial email; this endpoint is reserved for explicit app workflows.
  return { queued: true, registrationId };
});

async function linkConfirmedMemberAccount(registration = {}) {
  const email = mailAddress(registration.email).toLowerCase();
  const memberId = clean(registration.matchedMemberId);
  if (!registration.isMember || !memberId || !email) return { linked: false };
  const memberRef = db.collection("members").doc(memberId);
  const memberSnapshot = await memberRef.get();
  const member = memberSnapshot.data() || {};
  if (!memberSnapshot.exists || !memberCanMatchRegistration(member) || !normalizedMemberEmails(member).includes(email)) {
    return { linked: false, reason: "member_match_changed" };
  }
  const auth = getAuth();
  let authUser;
  let created = false;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    authUser = await auth.createUser({
      email,
      password: randomBytes(32).toString("hex"),
      emailVerified: true,
      disabled: false
    });
    created = true;
  }
  const userRef = db.collection("users").doc(authUser.uid);
  const userSnapshot = await userRef.get();
  const existing = userSnapshot.data() || {};
  if (existing.memberId && existing.memberId !== memberId) {
    throw new Error("Die E-Mail-Adresse ist bereits einem anderen Mitgliedskonto zugeordnet.");
  }
  if (!authUser.emailVerified) await auth.updateUser(authUser.uid, { emailVerified: true });
  const role = ["admin", "editor", "owner"].includes(clean(existing.role).toLowerCase()) ? existing.role : "member";
  const displayName = clean(existing.displayName || [registration.firstName, registration.lastName].filter(Boolean).join(" ")) || email;
  await userRef.set({
    email, displayName, role, memberId, accountType: "member", status: "active",
    emailVerified: true, updatedAt: FieldValue.serverTimestamp(),
    ...(created ? { createdAt: FieldValue.serverTimestamp(), createdVia: "confirmed_event_registration" } : {})
  }, { merge: true });
  await memberRef.set({
    linkedUserIds: FieldValue.arrayUnion(authUser.uid),
    linkedUserEmails: FieldValue.arrayUnion(email),
    linkedUsers: FieldValue.arrayUnion({ uid: authUser.uid, email, displayName, role }),
    ...(!member.linkedUserId ? { linkedUserId: authUser.uid, linkedUserEmail: email } : {}),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  if (created) {
    const link = await auth.generatePasswordResetLink(email, { url: "https://prodigitaltv.de/#/login" });
    await queueMail({
      type: "member_account_setup", to: email,
      subject: "Ihr PROdigitalTV-Mitgliedskonto aktivieren",
      text: `Guten Tag ${displayName},

Ihre E-Mail-Adresse wurde Ihrem PROdigitalTV-Mitgliedskonto zugeordnet. Legen Sie über diesen einmaligen Link ein Passwort fest:
${link}

Danach können Sie dasselbe Konto auch für zukünftige Veranstaltungen nutzen.

Ihr PROdigitalTV-Team`
    });
  }
  return { linked: true, created, uid: authUser.uid };
}

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
  const eventSnapshot = registration.eventId ? await db.collection("events").doc(registration.eventId).get().catch(() => null) : null;
  const eventRecord = eventSnapshot?.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : {};
  const ticketEnabled = eventUsesHandyTicket(eventRecord, registration);
  const ticketToken = ticketEnabled ? randomBytes(32).toString("hex") : "";
  const pushEnrollmentToken = randomBytes(32).toString("hex");
  const cancelToken = randomBytes(32).toString("hex");
  const ticketLink = ticketEnabled ? registrationTicketUrl(ticketToken, registration.eventId) : "";
  const cancelUrl = registrationCancelUrl(cancelToken);
  const update = {
    status: "confirmed", emailConfirmed: true, confirmedAt: FieldValue.serverTimestamp(),
    pushEnrollmentTokenHash: hashToken(pushEnrollmentToken),
    pushEnrollmentExpiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000),
    confirmationTokenHash: FieldValue.delete(),
    handyTicketEnabled: ticketEnabled,
    cancelTokenHash: hashToken(cancelToken),
    cancelTokenIssuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (ticketEnabled) {
    update.ticketTokenHash = hashToken(ticketToken);
    update.ticketIssuedAt = FieldValue.serverTimestamp();
  } else {
    update.ticketTokenHash = FieldValue.delete();
    update.ticketIssuedAt = FieldValue.delete();
    update.ticketDeviceLinked = FieldValue.delete();
  }
  await document.ref.update(update);
  if (registration.isMember && registration.matchedMemberId) {
    await linkConfirmedMemberAccount(registration).catch((error) => {
      console.error("Member account link after confirmed registration failed", document.id, error);
    });
  }
  await queueMail({
    type: "registration_confirmed", to: registration.email,
    subject: `Anmeldung bestaetigt: ${registration.eventTitle}`, template: "registration_confirmed",
    eventId: registration.eventId, registrationId: document.id,
    ticketEnabled, ticketLink, cancelUrl, eventCheckinUrl: ticketEnabled ? eventCheckinUrl(registration.eventId) : ""
  });
  return {
    confirmed: true,
    message: "Ihre Anmeldung wurde erfolgreich bestaetigt.",
    registrationId: document.id,
    eventId: registration.eventId || "",
    eventTitle: registration.eventTitle || "",
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    companion: registration.companion || null,
    participantCount: registration.participantCount || (registration.hasCompanion ? 2 : 1),
    ticketEnabled,
    ticketToken,
    pushEnrollmentToken,
    ticketLink,
    cancelUrl
  };
});

exports.linkTicketAtEntrance = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId);
  const accessToken = clean(request.data?.accessToken);
  const email = mailAddress(request.data?.email).toLowerCase();
  if (!eventId || eventId.includes("/") || !accessToken || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Bitte die E-Mail-Adresse Ihrer Anmeldung eingeben und den Einlasscode scannen.");
  }
  const accessRef = db.collection("eventCheckinAccess").doc(eventId);
  const validateAccess = snapshot => {
    const access = snapshot.data() || {};
    if (!snapshot.exists || access.status !== "active" || !access.tokenHash || hashToken(accessToken) !== access.tokenHash) throw new HttpsError("permission-denied", "Der Einlasscode ist ungueltig. Bitte am Empfang erneut scannen.");
    if ((access.expiresAt?.toMillis?.() || 0) <= Date.now()) throw new HttpsError("deadline-exceeded", "Der Einlasscode ist abgelaufen. Bitte wenden Sie sich an den Empfang.");
  };
  validateAccess(await accessRef.get());
  const matches = await db.collection("registrations").where("eventId", "==", eventId).where("email", "==", email).limit(10).get();
  const eligible = matches.docs.filter(doc => ["confirmed", "checked_in"].includes(clean(doc.data().status)));
  if (eligible.length !== 1) throw new HttpsError("failed-precondition", "Keine eindeutige bestaetigte Anmeldung gefunden. Bitte wenden Sie sich an den Empfang.");
  const ref = eligible[0].ref;
  const ticketToken = randomBytes(32).toString("hex");
  const registration = await db.runTransaction(async transaction => {
    const access = await transaction.get(accessRef);
    const fresh = await transaction.get(ref);
    validateAccess(access);
    const record = fresh.data() || {};
    if (!fresh.exists || record.eventId !== eventId || record.email !== email || !["confirmed", "checked_in"].includes(clean(record.status))) throw new HttpsError("failed-precondition", "Die Anmeldung hat sich geaendert. Bitte wenden Sie sich an den Empfang.");
    transaction.update(ref, { ticketTokenHash: hashToken(ticketToken), ticketIssuedAt: FieldValue.serverTimestamp(), ticketDeviceLinked: true, deviceLinkedAt: FieldValue.serverTimestamp(), ticketDeviceLinkSource: "entrance_email_match", updatedAt: FieldValue.serverTimestamp() });
    return record;
  });
  return { linked: true, registrationId: ref.id, eventId, eventTitle: registration.eventTitle || "", firstName: registration.firstName || "", lastName: registration.lastName || "", companion: registration.companion || null, participantCount: registration.participantCount || (registration.hasCompanion ? 2 : 1), ticketToken };
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
    companion: registration.companion || null,
    participantCount: registration.participantCount || (registration.hasCompanion ? 2 : 1),
    ticketToken: token
  };
});

exports.requestEventTicketRecoveryCode = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId).slice(0, 160);
  const email = mailAddress(request.data?.email).toLowerCase();
  if (!eventId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Bitte Event und gueltige E-Mail-Adresse angeben.");
  }
  const matches = await db.collection("registrations").where("email", "==", email).limit(100).get();
  const document = matches.docs.find((entry) => {
    const registration = entry.data();
    return registration.eventId === eventId
      && ["confirmed", "checked_in"].includes(clean(registration.status))
      && Boolean(registration.ticketTokenHash)
      && eventUsesHandyTicket({}, registration);
  });
  // The response does not reveal whether this address has a ticket.
  if (!document) return { requested: true };
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const mailRef = db.collection("mailQueue").doc();
  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(document.ref);
    const registration = fresh.data() || {};
    const lastRequestedAt = registration.ticketRecoveryRequestedAt?.toMillis?.() || 0;
    if (Date.now() - lastRequestedAt < 10 * 60 * 1000) return;
    if (registration.eventId !== eventId || registration.email !== email
      || !["confirmed", "checked_in"].includes(clean(registration.status))
      || !registration.ticketTokenHash) return;
    transaction.update(document.ref, {
      ticketRecoveryCodeHash: hashToken(`${salt}:${code}`),
      ticketRecoverySalt: salt,
      ticketRecoveryExpiresAt: Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
      ticketRecoveryRequestedAt: FieldValue.serverTimestamp(),
      ticketRecoveryAttempts: 0,
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.set(mailRef, {
      type: "ticket_recovery", to: email,
      subject: `Ihr Handy-Ticket: ${clean(registration.eventTitle) || "PROdigitalTV Event"}`,
      text: `Guten Tag,\n\nIhr Code fuer das Handy-Ticket zu ${clean(registration.eventTitle) || "Ihrem PROdigitalTV Event"} lautet: ${code}\n\nGeben Sie ihn in der WebApp ein. Er ist 15 Minuten gueltig. Falls Sie keinen Code angefordert haben, koennen Sie diese Nachricht ignorieren.\n\nViele Gruesse\nPROdigitalTV`,
      template: "ticket_recovery", eventId, registrationId: document.id,
      status: "queued", queuedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
  });
  return { requested: true };
});

exports.restoreEventTicketByCode = onCall({ region, invoker: "public" }, async (request) => {
  const eventId = clean(request.data?.eventId).slice(0, 160);
  const email = mailAddress(request.data?.email).toLowerCase();
  const code = clean(request.data?.code);
  if (!eventId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Bitte E-Mail-Adresse und sechsstelligen Code eingeben.");
  }
  const matches = await db.collection("registrations").where("email", "==", email).limit(100).get();
  const document = matches.docs.find((entry) => {
    const registration = entry.data();
    return registration.eventId === eventId
      && ["confirmed", "checked_in"].includes(clean(registration.status))
      && Boolean(registration.ticketTokenHash);
  });
  if (!document) throw new HttpsError("permission-denied", "Code ungueltig oder abgelaufen.");
  const ticketToken = randomBytes(32).toString("hex");
  const registration = await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(document.ref);
    const data = fresh.data() || {};
    const attempts = Number(data.ticketRecoveryAttempts || 0);
    const expiresAt = data.ticketRecoveryExpiresAt?.toMillis?.() || 0;
    if (data.eventId !== eventId || data.email !== email
      || !["confirmed", "checked_in"].includes(clean(data.status))
      || !data.ticketTokenHash || !data.ticketRecoveryCodeHash || !data.ticketRecoverySalt
      || expiresAt < Date.now() || attempts >= 5) {
      throw new HttpsError("permission-denied", "Code ungueltig oder abgelaufen.");
    }
    if (hashToken(`${data.ticketRecoverySalt}:${code}`) !== data.ticketRecoveryCodeHash) {
      transaction.update(document.ref, { ticketRecoveryAttempts: attempts + 1, updatedAt: FieldValue.serverTimestamp() });
      return null;
    }
    transaction.update(document.ref, {
      ticketTokenHash: hashToken(ticketToken),
      ticketIssuedAt: FieldValue.serverTimestamp(),
      ticketDeviceLinked: true,
      deviceLinkedAt: FieldValue.serverTimestamp(),
      ticketRecoveryCodeHash: FieldValue.delete(),
      ticketRecoverySalt: FieldValue.delete(),
      ticketRecoveryExpiresAt: FieldValue.delete(),
      ticketRecoveryRequestedAt: FieldValue.delete(),
      ticketRecoveryAttempts: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return data;
  });
  if (!registration) throw new HttpsError("permission-denied", "Code ungueltig oder abgelaufen.");
  return {
    restored: true, registrationId: document.id, eventId,
    eventTitle: registration.eventTitle || "", firstName: registration.firstName || "",
    lastName: registration.lastName || "", companion: registration.companion || null,
    participantCount: registration.participantCount || (registration.hasCompanion ? 2 : 1),
    ticketToken
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
  const eventSnapshot = await db.collection("events").doc(eventId).get().catch(() => null);
  const eventRecord = eventSnapshot?.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : {};
  const checkinWelcomeMailEnabled = eventRecord.checkinWelcomeMailEnabled === true || (eventRecord.checkinWelcomeMailEnabled == null && eventRecord.checkinAgendaMailEnabled === true);
  const checkinResult = await db.runTransaction(async (transaction) => {
    const freshSnapshot = await transaction.get(document.ref);
    const fresh = freshSnapshot.data() || {};
    const alreadyCheckedIn = fresh.status === "checked_in" && fresh.checkedInEventId === eventId;
    const companion = fresh.companion || null;
    const primaryName = [fresh.firstName, fresh.lastName].filter(Boolean).join(" ");
    const companionName = companion ? [companion.firstName, companion.lastName].filter(Boolean).join(" ") : "";
    const shouldQueueWelcomeMail = !alreadyCheckedIn && checkinWelcomeMailEnabled && Boolean(fresh.email) && !fresh.checkinAgendaMailQueuedAt;
    transaction.set(document.ref, {
      status: "checked_in",
      checkedInEventId: eventId,
      checkedInAt: alreadyCheckedIn ? fresh.checkedInAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      participantCount: companion ? 2 : 1,
      ...(companion ? { companionCheckedInAt: alreadyCheckedIn ? fresh.companionCheckedInAt || fresh.checkedInAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp() } : {}),
      ...(shouldQueueWelcomeMail ? { checkinAgendaMailQueuedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(db.collection("checkinScreenEvents").doc(eventId), {
      eventId,
      registrationId: document.id,
      firstName: fresh.firstName || "",
      lastName: fresh.lastName || "",
      company: fresh.company || "",
      companion,
      participantCount: companion ? 2 : 1,
      displayName: [primaryName, companionName].filter(Boolean).join(" und "),
      checkedInAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return {
      alreadyCheckedIn,
      shouldQueueWelcomeMail,
      email: fresh.email || "",
      firstName: fresh.firstName || "",
      lastName: fresh.lastName || "",
      company: fresh.company || "",
      companion,
      participantCount: companion ? 2 : 1,
      displayName: [primaryName, companionName].filter(Boolean).join(" und "),
      eventTitle: fresh.eventTitle || ""
    };
  });
  if (checkinResult.shouldQueueWelcomeMail) {
    await queueMail({
      type: "checkin_agenda",
      template: "checkin_agenda",
      to: checkinResult.email,
      subject: `Willkommen: ${eventRecord.title || checkinResult.eventTitle || "PROdigitalTV Event"}`,
      registrationId: document.id,
      eventId,
      dedupeKey: `checkin_agenda:${document.id}:${eventId}`,
      source: "checkin"
    }).catch((error) => {
      console.warn("Check-in agenda mail could not be queued", document.id, error);
    });
  }
  return {
    checkedIn: true,
    alreadyCheckedIn: checkinResult.alreadyCheckedIn,
    registrationId: document.id,
    eventId,
    eventTitle: checkinResult.eventTitle || registration.eventTitle || "",
    firstName: checkinResult.firstName || registration.firstName || "",
    lastName: checkinResult.lastName || registration.lastName || "",
    company: checkinResult.company || registration.company || "",
    companion: checkinResult.companion || registration.companion || null,
    participantCount: checkinResult.participantCount || registration.participantCount || 1,
    displayName: checkinResult.displayName || ""
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
    companion: registration.companion || null,
    participantCount: registration.participantCount || (registration.hasCompanion ? 2 : 1),
    status,
    checkedInEventId: registration.checkedInEventId || ""
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
    company: recent ? data.company || "" : "",
    companion: recent ? data.companion || null : null,
    participantCount: recent ? data.participantCount || 1 : 0,
    displayName: recent ? data.displayName || "" : ""
  };
});

exports.cancelRegistrationByToken = onCall({ region, invoker: "public" }, async (request) => {
  const token = request.data?.token;
  if (!token) throw new HttpsError("invalid-argument", "Storno-Token fehlt.");
  const tokenHash = hashToken(token);
  let result = await db.collection("registrations").where("cancelTokenHash", "==", tokenHash).limit(1).get();
  if (result.empty) result = await db.collection("registrations").where("cancelTokenHashes", "array-contains", tokenHash).limit(1).get();
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
    cancelTokenHashes: FieldValue.delete(),
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

exports.remindUnconfirmedRegistrationsBySms = onSchedule({ region, schedule: "every 5 minutes", timeZone: "Europe/Berlin", timeoutSeconds: 120, maxInstances: 1 }, async () => {
  const now = Date.now();
  const pending = await db.collection("registrations").where("status", "==", "pending_email_confirmation").get();
  let queued = 0;
  for (const document of pending.docs) {
    if (queued >= 100) break;
    const registration = document.data() || {};
    if (!confirmationSmsReminderIsDue(registration, now)) continue;
    const mailSnapshot = await db.collection("mailQueue").where("registrationId", "==", document.id).get();
    const matchingMail = mailSnapshot.docs.map((mailDocument) => mailDocument.data() || {}).find((mail) => {
      if (mail.template !== "registration_confirmation" && mail.template !== "registration_confirmation_reminder") return false;
      try {
        const link = new URL(mail.confirmationUrl);
        const token = link.searchParams.get("token") || "";
        return link.origin + link.pathname === PUBLIC_CONFIRMATION_BASE_URL
          && token && hashToken(token) === registration.confirmationTokenHash;
      } catch { return false; }
    });
    if (!matchingMail) continue;
    const confirmationUrl = matchingMail.confirmationUrl;
    const token = new URL(confirmationUrl).searchParams.get("token");
    const smsRef = db.collection("smsQueue").doc("registration-confirmation-sms-" + document.id);
    const didQueue = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(document.ref);
      const existingSms = await transaction.get(smsRef);
      const current = currentSnapshot.data() || {};
      if (!currentSnapshot.exists || existingSms.exists || !confirmationSmsReminderIsDue(current, Date.now())
        || hashToken(token) !== current.confirmationTokenHash) return false;
      const timestamp = FieldValue.serverTimestamp();
      transaction.update(document.ref, { confirmationSmsReminderQueuedAt: timestamp, updatedAt: timestamp });
      transaction.create(smsRef, {
        type: "registration_confirmation_sms",
        to: current.phone,
        message: "PROdigitalTV: Bitte bestätigen Sie Ihre Anmeldung über diesen Link: " + confirmationUrl
          + " Keine E-Mail gefunden? Prüfen Sie bitte Ihren Spamordner.",
        registrationId: document.id, eventId: current.eventId,
        confirmationUrl,
        status: "queued", queuedAt: timestamp, createdAt: timestamp, updatedAt: timestamp
      });
      return true;
    });
    if (didQueue) queued += 1;
  }
  console.log("SMS zur Anmeldebestätigung vorbereitet:", queued);
});

exports.remindUnconfirmedRegistrations = onSchedule({ region, schedule: "every 15 minutes", timeZone: "Europe/Berlin", timeoutSeconds: 120, maxInstances: 1 }, async () => {
  const now = Date.now();
  const pending = await db.collection("registrations").where("status", "==", "pending_email_confirmation").get();
  const eventCache = new Map();
  let queued = 0;
  for (const document of pending.docs) {
    if (queued >= 100) break;
    const registration = document.data() || {};
    if (!confirmationReminderIsDue(registration, now) || !registration.eventId) continue;
    if (!eventCache.has(registration.eventId)) {
      const eventSnapshot = await db.collection("events").doc(registration.eventId).get();
      eventCache.set(registration.eventId, eventSnapshot.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : null);
    }
    const eventRecord = eventCache.get(registration.eventId);
    if (!eventRecord || ["inactive", "draft", "hidden", "archived", "deleted", "cancelled"].includes(clean(eventRecord.status).toLowerCase()) || eventDateTimeMillis(eventRecord) <= now) continue;
    const token = randomBytes(32).toString("hex");
    const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
    const mailRef = db.collection("mailQueue").doc(`registration-confirmation-reminder-${document.id}`);
    const didQueue = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(document.ref);
      const existingMail = await transaction.get(mailRef);
      const current = currentSnapshot.data() || {};
      if (!currentSnapshot.exists || existingMail.exists || !confirmationReminderIsDue(current, Date.now())) return false;
      const timestamp = FieldValue.serverTimestamp();
      transaction.update(document.ref, {
        confirmationTokenHash: hashToken(token), confirmationExpiresAt: expiresAt,
        confirmationReminderQueuedAt: timestamp, updatedAt: timestamp
      });
      transaction.create(mailRef, {
        type: "registration_confirmation_reminder", template: "registration_confirmation_reminder",
        to: current.email, subject: `Ihre Anmeldung zu ${current.eventTitle || eventRecord.title || "PROdigitalTV"} – bitte kurz bestätigen`,
        registrationId: document.id, eventId: current.eventId,
        confirmationUrl: registrationConfirmationUrl(token), tokenExpiresAt: expiresAt,
        status: "queued", queuedAt: timestamp, createdAt: timestamp, updatedAt: timestamp
      });
      return true;
    });
    if (didQueue) queued += 1;
  }
  console.log("Bestaetigungserinnerungen vorbereitet:", queued);
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

// Event-specific moderator access; no general CMS privileges are granted.
const { canModerate, cardsPatch } = require("./eventModerator");
async function moderatorProfile(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Bitte anmelden.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!profile || profile.status === "inactive") throw new HttpsError("permission-denied", "Zugang nicht aktiv.");
  return profile;
}
async function moderatorEvent(request) {
  const profile = await moderatorProfile(request);
  const eventId = clean(request.data?.eventId);
  if (!eventId || eventId.includes("/")) throw new HttpsError("invalid-argument", "Veranstaltung fehlt.");
  const ref = db.collection("events").doc(eventId);
  const snapshot = await ref.get();
  const event = snapshot.data() || {};
  if (!snapshot.exists || !canModerate(event, request.auth.uid, profile)) throw new HttpsError("permission-denied", "Keine Moderatorberechtigung für diese Veranstaltung.");
  return { ref, event: { ...event, id: snapshot.id } };
}
exports.assignEventModerators = onCall({ region }, async request => {
  const editorProfile = await requireEditor(request);
  if (editorProfile.status === "inactive") throw new HttpsError("permission-denied", "Zugang nicht aktiv.");
  const eventId = clean(request.data?.eventId);
  if (!eventId || eventId.includes("/")) throw new HttpsError("invalid-argument", "Veranstaltung fehlt.");
  const emails = [...new Set((Array.isArray(request.data?.emails) ? request.data.emails : []).map(email => clean(email).toLowerCase()).filter(Boolean))];
  if (emails.length > 10) throw new HttpsError("invalid-argument", "Maximal zehn Moderatoren.");
  const users = [];
  for (const email of emails) {
    let user;
    try { user = await getAuth().getUserByEmail(email); } catch { throw new HttpsError("not-found", `Kein Benutzerkonto für ${email}. Bitte zuerst ein Konto anlegen.`); }
    const profile = (await db.collection("users").doc(user.uid).get()).data();
    if (user.disabled || !profile || profile.status === "inactive") throw new HttpsError("failed-precondition", `Benutzerkonto für ${email} ist nicht aktiv.`);
    users.push(user.uid);
  }
  await db.collection("events").doc(eventId).update({ moderatorUserIds: users, moderatorLoginEmails: emails, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
exports.listMyModeratorEvents = onCall({ region }, async request => {
  await moderatorProfile(request);
  const snapshot = await db.collection("events").where("moderatorUserIds", "array-contains", request.auth.uid).get();
  return { events: snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title || "Veranstaltung", date: doc.data().date || "" })) };
});
exports.getModeratorCards = onCall({ region }, async request => {
  const { event } = await moderatorEvent(request);
  const [topics, speakers, board] = await Promise.all([db.collection("topics").get(), db.collection("speakers").get(), db.collection("boardMembers").get()]);
  const pick = (data, fields) => Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
  const topicFields = ["id", "title", "type", "shortDescription", "description", "longDescription", "speakerId", "speakerIds", "moderatorId", "moderatorIds", "speakerRoles", "speakerRoleById", "notes"];
  const eventTopics = topics.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(topic => (event.topicIds || []).includes(topic.id) || topic.eventId === event.id || (topic.eventIds || []).includes(event.id));
  const profileFields = ["id", "name", "firstName", "lastName", "displayName", "title", "position", "role", "company", "organization", "shortBio", "bio", "longBio", "vita", "biography"];
  return {
    event: pick(event, ["id", "title", "date", "startTime", "endTime", "scheduleItems", "scheduleText", "agendaText", "moderatorName", "moderationCards", "moderationCardRemovedIds", "moderationCardOrientation"]),
    topics: eventTopics.map(topic => pick(topic, topicFields)),
    speakers: speakers.docs.map(doc => pick({ ...doc.data(), id: doc.id }, profileFields)),
    boardMembers: board.docs.map(doc => pick({ ...doc.data(), id: doc.id }, profileFields))
  };
});
exports.saveModeratorCards = onCall({ region }, async request => {
  const { ref } = await moderatorEvent(request);
  let patch;
  try { patch = cardsPatch(request.data || {}); } catch (error) { throw new HttpsError("invalid-argument", error.message); }
  // Recheck assignment inside the write transaction so revocation takes effect immediately.
  await db.runTransaction(async transaction => {
    const [eventSnapshot, profileSnapshot] = await Promise.all([transaction.get(ref), transaction.get(db.collection("users").doc(request.auth.uid))]);
    if (!canModerate(eventSnapshot.data() || {}, request.auth.uid, profileSnapshot.data())) throw new HttpsError("permission-denied", "Moderatorberechtigung wurde entzogen.");
    transaction.update(ref, { ...patch, moderationCardsUpdatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});
