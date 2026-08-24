const { createHash, randomBytes } = require("node:crypto");
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

async function eventNotificationTargets(eventId = "", options = {}) {
  const hasEvent = Boolean(clean(eventId));
  const recipientGroup = clean(options.recipientGroup || "");
  const includeRegistered = ["event_registered", "event_registered_speakers"].includes(recipientGroup) || options.includeRegistered === true;
  const includeSpeakers = ["event_speakers", "event_registered_speakers"].includes(recipientGroup) || options.includeSpeakers === true;
  const includeMembers = ["members", "members_contacts", "test_group"].includes(recipientGroup) || options.includeMembers === true;
  const includeContacts = ["contacts", "members_contacts"].includes(recipientGroup) || options.includeContacts === true;
  const [membersSnapshot, usersSnapshot, contactsSnapshot, registrationsSnapshot, speakersSnapshot, topicsSnapshot] = await Promise.all([
    includeMembers ? db.collection("members").get() : Promise.resolve({ docs: [] }),
    includeMembers ? db.collection("users").get() : Promise.resolve({ docs: [] }),
    includeContacts ? db.collection("contacts").get() : Promise.resolve({ docs: [] }),
    hasEvent ? db.collection("registrations").where("eventId", "==", eventId).get() : Promise.resolve({ docs: [] }),
    includeSpeakers ? db.collection("speakers").get() : Promise.resolve({ docs: [] }),
    includeSpeakers ? db.collection("topics").get().catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] })
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
  usersSnapshot.docs.forEach((document) => {
    const user = { id: document.id, ...document.data() };
    const status = clean(user.status || "active").toLowerCase();
    const role = clean(user.role || "member").toLowerCase();
    const email = clean(user.email).toLowerCase();
    if (!email || ["inactive", "archived", "deleted", "disabled"].includes(status)) return;
    if (role !== "member" && !clean(user.memberId)) return;
    officialMemberEmails.add(email);
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
    if (member.notificationOptOut === true || member.mailingDisabled === true || member.reminderConsent === false) return;
    if (recipientGroup === "test_group" && !memberIsNotificationTestGroup(member)) return;
    normalizedMemberEmails(member).forEach((email) => addPerson(email, {
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      company: member.name || member.company || member.title || "",
      memberId: member.id
    }, "member"));
  });
  usersSnapshot.docs.forEach((document) => {
    const user = { id: document.id, ...document.data() };
    const status = clean(user.status || "active").toLowerCase();
    const role = clean(user.role || "member").toLowerCase();
    const email = clean(user.email).toLowerCase();
    if (!email || ["inactive", "archived", "deleted", "disabled"].includes(status)) return;
    if (role !== "member" && !clean(user.memberId)) return;
    if (user.notificationOptOut === true || user.mailingDisabled === true || user.reminderConsent === false) return;
    addPerson(email, {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      name: user.displayName || "",
      company: user.company || "",
      memberId: user.memberId || "",
      userId: user.id
    }, "member");
  });
  contactsSnapshot.docs.forEach((document) => {
    const contact = { id: document.id, ...document.data() };
    if (["archived", "deleted", "inactive"].includes(clean(contact.status).toLowerCase())) return;
    if (contact.notificationOptOut === true || contact.mailingDisabled === true || contact.reminderConsent === false) return;
    const email = clean(contact.email).toLowerCase();
    if (officialMemberEmails.has(email)) return;
    addPerson(email, contact, "contact");
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
      }, "registration");
    });
  }
  if (includeSpeakers && hasEvent) {
    const eventSnapshot = await db.collection("events").doc(eventId).get();
    const eventRecord = eventSnapshot.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : { id: eventId };
    const eventSpeakerIds = new Set([...(eventRecord.speakerIds || []), eventRecord.speakerId].filter(Boolean));
    const eventTopicIds = new Set([...(eventRecord.topicIds || []), eventRecord.topicId].filter(Boolean));
    topicsSnapshot.docs.forEach((document) => {
      const topic = { id: document.id, ...document.data() };
      const linkedToEvent = eventTopicIds.has(topic.id)
        || (topic.eventIds || []).includes(eventId)
        || topic.eventId === eventId;
      if (!linkedToEvent) return;
      [topic.speakerId, ...(topic.speakerIds || [])].filter(Boolean).forEach((id) => eventSpeakerIds.add(id));
    });
    speakersSnapshot.docs.forEach((document) => {
      const speaker = { id: document.id, ...document.data() };
      const status = clean(speaker.status || "published").toLowerCase();
      if (["archived", "deleted", "inactive"].includes(status)) return;
      const linkedToEvent = eventSpeakerIds.has(speaker.id)
        || (speaker.eventIds || []).includes(eventId)
        || speaker.eventId === eventId
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
      }, "speaker");
    });
  }
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
        lastName: target.lastName || "",
        company: target.company || "",
        email: target.email || "",
        eventTitle: eventRecord.title || ""
      },
      eventRecord,
      variables: { eventLink: link, link }
    });
    const renderedTitle = renderTemplateText(notification.title, {
      registration: {
        firstName: target.firstName || "",
        lastName: target.lastName || "",
        company: target.company || "",
        email: target.email || "",
        eventTitle: eventRecord.title || ""
      },
      eventRecord,
      variables: { eventLink: link, link }
    });
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
          notification: { title: renderedTitle || notification.title, body },
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
      surveyId: notification.surveyId || "",
      surveyInviteId,
      title: renderedTitle || notification.title,
      shortText: body,
      link,
      linkEnabled: notification.linkEnabled !== false,
      audienceType: target.audienceType,
      personName: clean(`${target.firstName || ""} ${target.lastName || ""}`) || target.company || "",
      firstName: target.firstName || "",
      lastName: target.lastName || "",
      company: target.company || ""
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

function liveSurveyOptions(value = "") {
  const source = Array.isArray(value) ? value : clean(value).split(/\r?\n/);
  return source
    .map((item) => stripTags(typeof item === "string" ? item : item?.label || ""))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 6)
    .map((label, index) => ({ id: `option-${index + 1}`, label }));
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
  return payload;
}

async function upsertMailingContact(person = {}, { source = "manual", eventId = "", eventIds = [], registrationId = "", speakerId = "", topicIds = [], reminderConsent = false } = {}, now = FieldValue.serverTimestamp()) {
  const payload = contactWritePayload(person, source, now);
  if (!payload?.email) return { created: false, email: "", contactId: "" };
  const ref = db.collection("contacts").doc(contactId(payload.email));
  const existing = await ref.get();
  const created = !existing.exists;
  const update = {
    id: ref.id,
    ...payload,
    source: existing.exists ? existing.data()?.source || source : source,
    reminderConsent: Boolean(reminderConsent || existing.data()?.reminderConsent),
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
  return upsertMailingContact(registration, {
    source: registration.source === "cms_admin" ? "cms_admin_registration" : "event_registration",
    eventId: eventRecord.id || registration.eventId || "",
    registrationId: registration.id || "",
    reminderConsent: Boolean(registration.notifyForThisEvent || registration.notifyFutureEvents)
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

function registrationTicketUrl(token, eventId = "") {
  if (eventId) {
    return publicSpaRouteUrl(`event/${encodeURIComponent(eventId)}?ticket=${encodeURIComponent(token)}`);
  }
  return publicSpaRouteUrl(`ticket/link/${encodeURIComponent(token)}`);
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

function eventCheckinUrl(eventId) {
  return publicHashUrl(`event-checkin/${encodeURIComponent(eventId || "")}`);
}

function registrationLockId(eventId = "", email = "") {
  return `${clean(eventId)}-${hashToken(clean(email).toLowerCase()).slice(0, 40)}`;
}

function registrationBlocksNewBooking(registration = {}) {
  const status = clean(registration.status).toLowerCase();
  if (registration.deleted === true || registration.archived === true || registration.inactive === true) return false;
  return !["cancelled", "canceled", "expired", "deleted", "archived", "inactive", "removed", "storniert", "geloescht", "gelöscht"].includes(status);
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
      "Falls Sie doch nicht teilnehmen koennen, sagen Sie bitte rechtzeitig ab, damit wir den Platz weitergeben und besser planen koennen.",
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
    return {
      subject: mail.subject || `Anmeldung bestaetigt: ${registration.eventTitle || eventRecord.title || ""}`,
      text: [
        `Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},`,
        "",
        `Ihre Anmeldung${title ? ` fuer "${title}"` : ""} wurde bestaetigt.`,
        "",
        ticketEnabled ? "Wenn Sie die Anmeldung auf dem Handy bestaetigt haben, ist dieses Geraet bereits als Ticket vorbereitet." : "Fuer diese Veranstaltung ist kein Handy-Ticket erforderlich.",
        ticketEnabled ? "Beim Einlass scannen Sie bitte den QR-Code des Events. Das System erkennt dann das gespeicherte Ticket auf Ihrem Handy." : "Ihre bestaetigte Anmeldung ist ausreichend; weitere Informationen erhalten Sie ueber die Veranstaltungskommunikation.",
        eventLink ? `Zum Event: ${eventLink}` : "",
        mail.cancelUrl ? `Anmeldung stornieren: ${mail.cancelUrl}` : "",
        "",
        "Viele Gruesse",
        "PROdigitalTV"
      ].filter(Boolean).join("\n"),
      html: mailHtmlShell("Anmeldung bestaetigt", [
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},</p>`,
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Ihre Anmeldung${title ? ` fuer <strong>${title}</strong>` : ""} wurde bestaetigt.</p>`,
        ticketEnabled
          ? `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Wenn Sie die Anmeldung auf dem Handy bestaetigt haben, ist dieses Geraet bereits als Ticket vorbereitet.</p><p style="font-size:17px;line-height:1.55;margin:0 0 14px">Beim Einlass scannen Sie bitte den QR-Code des Events. Das System erkennt dann das gespeicherte Ticket auf Ihrem Handy.</p>`
          : `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">Fuer diese Veranstaltung ist kein Handy-Ticket erforderlich.</p><p style="font-size:17px;line-height:1.55;margin:0 0 14px">Ihre bestaetigte Anmeldung ist ausreichend; weitere Informationen erhalten Sie ueber die Veranstaltungskommunikation.</p>`,
        mailButton("Zum Event", eventLink),
        mail.cancelUrl ? `<p style="font-size:14px;line-height:1.5;margin:18px 0 0"><a href="${mail.cancelUrl}" style="color:#0b3a66">Anmeldung stornieren</a></p>` : "",
        ticketEnabled ? `<p style="font-size:14px;color:#5f6b7c;margin:18px 0 0">Der separate Handy-Ticket-Link wird nicht mehr benoetigt, wenn die Bestaetigung bereits auf dem Smartphone erfolgt ist.</p>` : ""
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
    const link = mail.linkEnabled === false ? "" : clean(mail.link || eventUrl(mail.eventId || eventRecord.id || ""));
    const isSurveyMail = Boolean(clean(mail.surveyId));
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
        `<p style="font-size:17px;line-height:1.55;margin:0 0 14px">${textToHtml(body)}</p>`,
        mailButton(linkLabel, link),
        optOutUrl ? `<p style="font-size:12px;line-height:1.5;color:#7a8493;margin:24px 0 0;border-top:1px solid #dbe4f1;padding-top:14px">Sie erhalten diese Nachricht, weil Sie PROdigitalTV-Veranstaltungs- und Umfragehinweise aktiviert haben. <a href="${optOutUrl}" style="color:#5f6b7c">Umfrage- und Veranstaltungshinweise abbestellen</a>.</p>` : ""
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
    html: appendMailTrackingPixel(rendered.html, mail.id)
  });
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
  if (profile?.role !== "admin") throw new HttpsError("permission-denied", "Nur Admins duerfen Mitglieder-Logins anlegen.");
  return profile;
}

function memberInvitationLink(invitationId = "", token = "") {
  return `${PUBLIC_APP_BASE_URL}/user-invite/${encodeURIComponent(invitationId)}/${encodeURIComponent(token)}`;
}

function memberInvitationExpiresAtDate() {
  return new Date(Date.now() + 12 * 60 * 60 * 1000);
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

exports.createMemberLogin = onCall({ region }, async (request) => {
  const adminProfile = await requireAdmin(request);
  const input = request.data?.input || {};
  const memberId = clean(input.memberId);
  const email = clean(input.email).toLowerCase();
  const requestedRole = clean(input.role || "member").toLowerCase();
  const role = ["admin", "editor", "member"].includes(requestedRole) ? requestedRole : "";
  const invitationDelivery = clean(input.invitationDelivery || "manual").toLowerCase() === "auto" ? "auto" : "manual";
  if (!memberId) throw new HttpsError("invalid-argument", "Bitte ein Mitglied auswaehlen.");
  if (!email || !email.includes("@")) throw new HttpsError("invalid-argument", "Bitte eine gueltige Mailadresse eintragen.");
  if (!role) throw new HttpsError("invalid-argument", "Bitte eine gueltige Rolle auswaehlen.");
  const memberSnapshot = await db.collection("members").doc(memberId).get();
  if (!memberSnapshot.exists) throw new HttpsError("not-found", "Mitglied wurde nicht gefunden.");
  const member = { id: memberSnapshot.id, ...memberSnapshot.data() };
  const displayName = clean(input.displayName || member.profileContactName || member.contactName || member.name || email);
  const memberName = clean(member.name || member.company || member.profileContactName || member.id || memberId);
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
    details: { memberId, email, role, invitationId, invitationDelivery }
  });
  return { ok: true, created, uid: authUser.uid, email, memberId, displayName, role, invitationId, invitationDelivery, invitationMailStatus: invitation.invitationMailStatus || invitation.mailStatus, invitationLink: invitation.invitationLink };
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
  const contactSync = await upsertContactFromRegistration(registration, eventRecord, now);
  if (contactSync.created) await countNewMailingContactForEvent(eventRecord.id, "event_registration", contactSync, now);
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

exports.getMyEventRegistrations = onCall({ region }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Bitte melden Sie sich an.");
  const email = clean(request.auth.token.email || "").toLowerCase();
  if (!email) return { registrations: [] };
  const eventIds = Array.isArray(request.data?.eventIds)
    ? request.data.eventIds.map((id) => clean(id)).filter(Boolean).slice(0, 80)
    : [];
  let query = db.collection("registrations").where("email", "==", email).limit(100);
  const snapshot = await query.get();
  const allowedEventIds = new Set(eventIds);
  const registrations = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((registration) => !eventIds.length || allowedEventIds.has(registration.eventId))
    .filter((registration) => !["cancelled", "expired"].includes(String(registration.status || "").toLowerCase()))
    .map((registration) => ({
      id: registration.id,
      eventId: registration.eventId || "",
      eventTitle: registration.eventTitle || "",
      firstName: registration.firstName || "",
      lastName: registration.lastName || "",
      status: registration.status || "",
      emailConfirmed: Boolean(registration.emailConfirmed)
    }));
  return { registrations };
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
  const recipientGroup = ["members", "contacts", "members_contacts", "event_registered", "event_speakers", "event_registered_speakers", "test_group", "test_person"].includes(clean(input.recipientGroup))
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
  const liveActionMode = clean(input.liveActionMode) === "survey" ? "survey" : "message";
  let liveSurvey = null;
  let notificationLink = linkEnabled ? submittedLink || defaultLink : "";
  if (liveActionMode === "survey") {
    if (notificationKind !== "event") throw new HttpsError("invalid-argument", "Umfragen sind aktuell an eine Veranstaltung gebunden.");
    const surveyQuestion = stripTags(input.surveyQuestion || shortText);
    const surveyOptions = liveSurveyOptions(input.surveyOptions);
    const surveyAllowMultiple = input.surveyAllowMultiple === true || clean(input.surveyAllowMultiple) === "true";
    if (!surveyQuestion) throw new HttpsError("invalid-argument", "Bitte eine Umfragefrage eintragen.");
    if (surveyOptions.length < 1) throw new HttpsError("invalid-argument", "Bitte mindestens eine Antwortmoeglichkeit eintragen.");
    const surveyRef = db.collection("liveSurveys").doc(`live-survey-${randomBytes(16).toString("hex")}`);
    const surveyCreatedAtIso = new Date().toISOString();
    liveSurvey = {
      id: surveyRef.id,
      eventId,
      notificationId: notificationRef.id,
      title,
      question: surveyQuestion,
      options: surveyOptions,
      allowMultiple: surveyAllowMultiple,
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
    linkEnabled,
    link: notificationLink,
    liveActionMode,
    surveyId: liveSurvey?.id || "",
    surveyQuestion: liveSurvey?.question || "",
    surveyOptions: liveSurvey?.options || [],
    surveyAllowMultiple: liveSurvey?.allowMultiple || false,
    testOnly,
    testRecipients: testOnly ? testRecipients : [],
    recipientGroup,
    includeMembers: ["members", "members_contacts", "test_group"].includes(recipientGroup),
    includeContacts: ["contacts", "members_contacts"].includes(recipientGroup),
    includeRegistered: ["event_registered", "event_registered_speakers"].includes(recipientGroup),
    includeSpeakers: ["event_speakers", "event_registered_speakers"].includes(recipientGroup),
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
    return { id: notificationRef.id, surveyId: liveSurvey?.id || "", ...result };
  }
  return { id: notificationRef.id, surveyId: liveSurvey?.id || "", scheduled: true };
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
  const recipientGroup = ["members", "contacts", "members_contacts", "event_registered", "event_speakers", "event_registered_speakers", "test_group", "test_person"].includes(clean(input.recipientGroup))
    ? clean(input.recipientGroup)
    : "members_contacts";
  const registrationStatus = ["all", "registered", "unregistered"].includes(clean(input.registrationStatus)) ? clean(input.registrationStatus) : "all";
  const targets = testOnly
    ? testRecipients.map((email) => ({ email, audienceType: "test" }))
    : await eventNotificationTargets(notificationKind === "event" ? eventId : "", {
      recipientGroup,
      includeMembers: ["members", "members_contacts", "test_group"].includes(recipientGroup),
      includeContacts: ["contacts", "members_contacts"].includes(recipientGroup),
      includeRegistered: ["event_registered", "event_registered_speakers"].includes(recipientGroup),
      includeSpeakers: ["event_speakers", "event_registered_speakers"].includes(recipientGroup),
      registrationStatus
    });
  return {
    targetCount: targets.length,
    mailCount: targets.length,
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
  return {
    id: survey.id,
    eventId: survey.eventId || "",
    title: survey.title || "PROdigitalTV Umfrage",
    question: survey.question || "",
    allowMultiple: survey.allowMultiple === true,
    options: Array.isArray(survey.options) ? survey.options.map((option) => ({
      id: clean(option.id),
      label: clean(option.label)
    })).filter((option) => option.id && option.label) : []
  };
});

exports.submitLiveSurveyResponse = onCall({ region, invoker: "public" }, async (request) => {
  const input = request.data?.input || {};
  const surveyId = clean(input.surveyId);
  const rawOptionIds = Array.isArray(input.optionIds) ? input.optionIds : [input.optionId];
  const optionIds = rawOptionIds.map((item) => clean(item)).filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).slice(0, 6);
  const responseToken = clean(input.token);
  if (!surveyId || !optionIds.length) throw new HttpsError("invalid-argument", "Bitte eine Antwort auswaehlen.");
  const surveySnapshot = await db.collection("liveSurveys").doc(surveyId).get();
  if (!surveySnapshot.exists) throw new HttpsError("not-found", "Umfrage wurde nicht gefunden.");
  const survey = { id: surveySnapshot.id, ...surveySnapshot.data() };
  if (["archived", "deleted", "inactive"].includes(clean(survey.status).toLowerCase())) {
    throw new HttpsError("failed-precondition", "Diese Umfrage ist nicht aktiv.");
  }
  const options = Array.isArray(survey.options) ? survey.options : [];
  const allowMultiple = survey.allowMultiple === true;
  if (!allowMultiple && optionIds.length > 1) throw new HttpsError("invalid-argument", "Bitte nur eine Antwort auswaehlen.");
  const selectedOptions = optionIds.map((optionId) => options.find((option) => clean(option.id) === optionId)).filter(Boolean);
  if (selectedOptions.length !== optionIds.length) throw new HttpsError("invalid-argument", "Antwort wurde nicht gefunden.");
  const selectedLabels = selectedOptions.map((option) => clean(option.label)).filter(Boolean);
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
    optionIds.forEach((optionId) => {
      surveyUpdate[`optionCounts.${optionId}`] = FieldValue.increment(1);
    });
    transaction.set(db.collection("liveSurveys").doc(surveyId), surveyUpdate, { merge: true });
  });
  return { ok: true, optionLabel: selectedLabels.join(", ") };
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
  const now = FieldValue.serverTimestamp();
  const contactSync = await upsertContactFromRegistration({ id: event.params.registrationId, ...registration }, { id: registration.eventId, ...eventRecord }, now);
  if (contactSync.created) await countNewMailingContactForEvent(registration.eventId, "event_registration_trigger", contactSync, now);
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

exports.sendQueuedMail = onDocumentCreated({ document: "mailQueue/{mailId}", region, secrets: smtpSecrets }, async (event) => {
  const mail = event.data.data();
  if (mail.status !== "queued") return;
  try {
    const result = await sendQueuedMail({ id: event.params.mailId, ...mail });
    const accepted = Array.isArray(result.accepted) ? result.accepted.map(clean).filter(Boolean) : [];
    const rejected = Array.isArray(result.rejected) ? result.rejected.map(clean).filter(Boolean) : [];
    await event.data.ref.update({
      status: rejected.length && !accepted.length ? "failed" : "sent",
      sentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      providerMessageId: result.messageId || "",
      providerAccepted: accepted,
      providerRejected: rejected,
      providerResponse: clean(result.response || "").slice(0, 500),
      deliveryStatus: rejected.length ? "partly_rejected" : "accepted"
    });
    const updateTarget = mail.registrationId
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
  }
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
  const cancelToken = randomBytes(32).toString("hex");
  const ticketLink = ticketEnabled ? registrationTicketUrl(ticketToken, registration.eventId) : "";
  const cancelUrl = registrationCancelUrl(cancelToken);
  const update = {
    status: "confirmed", emailConfirmed: true, confirmedAt: FieldValue.serverTimestamp(),
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
    ticketEnabled,
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
  const alreadyCheckedIn = registration.status === "checked_in" && registration.checkedInEventId === eventId;
  await document.ref.update({
    status: "checked_in",
    checkedInEventId: eventId,
    checkedInAt: alreadyCheckedIn ? registration.checkedInAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
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
    alreadyCheckedIn,
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
