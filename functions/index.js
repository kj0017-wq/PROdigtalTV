const { createHash, randomBytes } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();
const region = "europe-west3";
const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const MAIL_FROM = defineSecret("MAIL_FROM");
const MAIL_TO = defineSecret("MAIL_TO");
const smtpSecrets = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO];

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

function stripTags(value = "") {
  return clean(value).replace(/[<>]/g, "");
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
  const [registration, membershipApplication, eventRecord] = await Promise.all([
    mail.registrationId ? db.collection("registrations").doc(mail.registrationId).get() : null,
    mail.membershipApplicationId ? db.collection("membershipApplications").doc(mail.membershipApplicationId).get() : null,
    mail.eventId ? db.collection("events").doc(mail.eventId).get() : null
  ]);
  return {
    registration: registration?.exists ? { id: registration.id, ...registration.data() } : null,
    membershipApplication: membershipApplication?.exists ? { id: membershipApplication.id, ...membershipApplication.data() } : null,
    eventRecord: eventRecord?.exists ? { id: eventRecord.id, ...eventRecord.data() } : null
  };
}

function renderMail(mail, context = {}) {
  const registration = context.registration || {};
  const application = context.membershipApplication || {};
  const eventRecord = context.eventRecord || {};

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
    return {
      subject: mail.subject || `Bitte bestaetigen Sie Ihre Anmeldung: ${eventRecord.title || registration.eventTitle || ""}`,
      text: [
        `Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},`,
        "",
        `bitte bestaetigen Sie Ihre Anmeldung${eventRecord.title ? ` fuer "${eventRecord.title}"` : ""}.`,
        "",
        mail.confirmationUrl ? `Bestaetigungslink: ${mail.confirmationUrl}` : "",
        "",
        "Der Link ist 48 Stunden gueltig."
      ].filter(Boolean).join("\n")
    };
  }

  if (mail.template === "registration_confirmed") {
    return {
      subject: mail.subject || `Anmeldung bestaetigt: ${registration.eventTitle || eventRecord.title || ""}`,
      text: [
        `Guten Tag ${clean(registration.firstName)} ${clean(registration.lastName)},`,
        "",
        `Ihre Anmeldung${registration.eventTitle ? ` fuer "${registration.eventTitle}"` : ""} wurde bestaetigt.`,
        "",
        "Viele Gruesse",
        "PROdigitalTV"
      ].join("\n")
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
    text: rendered.text
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

exports.onRegistrationCreated = onDocumentCreated({ document: "registrations/{registrationId}", region }, async (event) => {
  const registration = event.data.data();
  if (registration.status !== "pending_email_confirmation") return;
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
    confirmationUrl: `https://www.prodigitaltv.de/confirm.html?token=${token}`,
    tokenExpiresAt: expiresAt
  });
  await queueMail({
    type: "admin_notification",
    to: "events@prodigitaltv.de",
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

exports.confirmRegistrationByToken = onCall({ region }, async (request) => {
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
  await document.ref.update({
    status: "confirmed", emailConfirmed: true, confirmedAt: FieldValue.serverTimestamp(),
    confirmationTokenHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp()
  });
  await queueMail({
    type: "registration_confirmed", to: registration.email,
    subject: `Anmeldung bestaetigt: ${registration.eventTitle}`, template: "registration_confirmed",
    eventId: registration.eventId, registrationId: document.id
  });
  return { confirmed: true, message: "Ihre Anmeldung wurde erfolgreich bestaetigt." };
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
    confirmationUrl: `https://www.prodigitaltv.de/confirm.html?token=${token}`, tokenExpiresAt: expiresAt
  });
  return { queued: true };
});

exports.notifyAdminAboutRegistration = onCall({ region }, async (request) => {
  await requireEditor(request);
  const registration = (await db.collection("registrations").doc(request.data.registrationId).get()).data();
  await queueMail({ type: "admin_notification", to: "events@prodigitaltv.de", subject: `Anmeldung: ${registration.eventTitle}`, template: "admin_notification", registrationId: request.data.registrationId, eventId: registration.eventId });
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
    first_seen: topic.created_at || topic.createdAt || new Date().toISOString(),
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
    first_seen: release.published_at || release.imported_at || new Date().toISOString(),
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
  const candidates = [
    ...existingTopics
      .filter((topic) => !["abgelehnt", "archiviert", "uebernommen"].includes(normalizeStatus(topic.status || topic.queue_status)))
      .map((topic, index) => topicToBriefingItem(topic, sourcePool, [...existingArticles, ...existingTopics], index)),
    ...pressReleases
      .filter((release) => !normalizeStatus(release.editorial_status || release.status).includes("dublette"))
      .map((release, index) => pressReleaseToBriefingItem(release, sourcePool, [...existingArticles, ...existingTopics], index))
  ].filter((item) => item.headline && item.summary)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 10);

  if (!candidates.length) {
    await writeAiEditorialLog({
      task_name: "Morgenbriefing",
      status: "blocked",
      message: "Keine belegbaren Meldungen fuer ein Morgenbriefing vorhanden.",
      used_sources_json: sourcePool.slice(0, 20),
      ai_check_json: { status: "nicht bestanden", blockers: ["briefing_items_missing"] }
    });
    return { ok: false, status: "blocked", message: "Keine belegbaren Meldungen fuer ein Morgenbriefing vorhanden." };
  }

  const batch = db.batch();
  candidates.forEach((item) => batch.set(db.collection("ai_topic_suggestions").doc(item.id), item, { merge: true }));
  const today = new Date().toISOString().slice(0, 10);
  const briefingId = `morgenbriefing-${today}`;
  const shortText = `${candidates.length} Meldungen aus freigegebenen Quellen als kurze redaktionelle Uebersicht.`;
  const bodyText = [
    `Morgenbriefing ${today}`,
    shortText,
    "",
    ...candidates.map((item, index) => briefingItemSummary(item, index))
  ].join("\n\n").trim();
  batch.set(db.collection("editorialContent").doc(briefingId), {
    id: briefingId,
    title: `Morgenbriefing ${today}`,
    headline: `Morgenbriefing ${today}`,
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
    category: "Morgenbriefing",
    tags: ["Morgenbriefing", "KI-Redaktion", "Medienwirtschaft"],
    source_snapshot_json: candidates.map((item) => ({ title: item.source, url: item.original_url, check_status: item.status, source_type: item.source_type })),
    source_status: "Quelle vorhanden",
    duplicate_status: "nicht geprueft",
    ai_check_status: "vorbereitet",
    legal_check_status: "offen",
    publication_status: "Zusammenfassung",
    status: "draft",
    visibility: "internal",
    author_type: "ai",
    author_name: "KI-Redaktion",
    generation_origin: "morning_briefing",
    content_type: "morning_briefing_summary",
    editorialType: "morning_briefing",
    ai_log_json: { workflow: "morning_briefing", actor, itemIds: candidates.map((item) => item.id) },
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
    message: `${candidates.length} Meldungen fuer Morgenbriefing vorbereitet.`,
    found_topics_json: logItems,
    used_sources_json: sourcePool.slice(0, 20),
    duplicate_check_json: { disabled: true },
    ai_check_json: { status: "vorbereitet", publication_status: "Entwurf" }
  });
  return { ok: true, status: "success", briefingId, items: candidates.length, message: `${candidates.length} Meldungen fuer Morgenbriefing vorbereitet.` };
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

exports.Morgenbriefing_Taeglich = onSchedule({ schedule: "every day 06:15", region, timeZone: "Europe/Berlin", timeoutSeconds: 300 }, async () => {
  await runMorningBriefingPipeline({ manual: false, actor: "scheduler" });
});

/*
 * Mail delivery adapter:
 * A production installation should trigger on mailQueue documents with status
 * "queued", deliver through Postmark/Brevo/SendGrid and then write "sent" or
 * "failed". Credentials belong in Firebase Secret Manager, never in source.
 */
