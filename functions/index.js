const { createHash, randomBytes } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();
const db = getFirestore();
const region = "europe-west3";

const openaiFunctions = require("./openaiFunctions");
Object.assign(exports, openaiFunctions);
const geminiTtsFunctions = require("./geminiTtsFunctions");
Object.assign(exports, geminiTtsFunctions);

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
    minimumSources: 2,
    minimumTrustScore: 70,
    scheduleLabel: "Taeglich 06:00 Uhr",
    allowAutoPublish: false,
    ...(snapshot.exists ? snapshot.data() : {})
  };
}

async function writeAiEditorialLog(payload) {
  const ref = await db.collection("ai_editorial_logs").add({
    article_id: payload.article_id || "",
    task_name: AI_EDITORIAL_TASK,
    status: payload.status || "blocked",
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
      status: "blocked",
      message: `Abbruch: aktive Prompts fehlen (${missingPrompts.join(", ")}).`,
      ai_check_json: { status: "nicht bestanden", blockers: ["active_prompt_missing"], missingPrompts }
    });
    return { ok: false, status: "blocked", message: "Aktive Pflicht-Prompts fehlen. Kein Beitrag wurde erzeugt." };
  }

  const topic = chooseTopic(existingArticles);
  const duplicate = existingArticles.find((article) => normalizeStatus(article.title || article.headline).includes(normalizeStatus(topic.title).slice(0, 18)));
  if (duplicate) {
    await writeAiEditorialLog({
      status: "blocked",
      message: "Thema bereits vorhanden - kein neuer Beitrag erzeugt.",
      found_topics_json: [topic],
      duplicate_check_json: { duplicate_status: "Dublette", duplicateArticleId: duplicate.id }
    });
    return { ok: false, status: "blocked", message: "Thema bereits vorhanden - kein neuer Beitrag erzeugt." };
  }

  if (sources.length < Number(settings.minimumSources || 2)) {
    await writeAiEditorialLog({
      status: "blocked",
      message: "Quellenlage unzureichend - redaktionelle Pruefung erforderlich.",
      found_topics_json: [topic],
      used_sources_json: sources,
      source_check_json: { source_status: "unzureichend", trustedSources: sources.length, required: Number(settings.minimumSources || 2) },
      ai_check_json: { status: "nicht bestanden", blockers: ["insufficient_sources"] }
    });
    return { ok: false, status: "blocked", message: "Quellenlage unzureichend - kein Beitrag wurde erzeugt." };
  }

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
    title: `Themenvorschlag: ${topic.title}`,
    headline: `Themenvorschlag: ${topic.title}`,
    subtitle: "Quellen sind vorhanden, Text muss redaktionell erstellt und geprueft werden.",
    subline: "Quellen sind vorhanden, Text muss redaktionell geprueft werden.",
    bodyText: "Dieser Datensatz ist ein gesperrter Themenvorschlag der KI-Redaktion. Es wurde bewusst kein fertiger Beitragstext erzeugt, weil vor der Texterstellung eine aktuelle Quellenrecherche mit Belegstellen erforderlich ist.",
    page: "news",
    section: "news",
    category: topic.category,
    tags: topic.keywords,
    primary_keyword: topic.keywords[0],
    thumbnail_idea: "Serioeses redaktionelles Vorschaubild zur digitalen Medienwirtschaft.",
    thumbnail_prompt: "Professionelles redaktionelles Vorschaubild fuer ein Medienbranchen-Portal, klare moderne Komposition, TV-, Streaming- und Regulierungskontext, 16:9, keine Logos, keine realen Personen.",
    source_status: "teilweise geprueft",
    duplicate_status: "neu",
    ai_check_status: "Warnung",
    legal_check_status: "offen",
    publication_status: "pruefpflichtig",
    status: "draft",
    visibility: "internal",
    relevance_score: 70,
    author_type: "ai",
    author_name: "KI-Redaktion",
    source_snapshot_json: sourceSnapshot,
    ai_log_json: { actor, rule: "safe_topic_proposal_only" },
    duplicate_check_json: { duplicate_status: "neu" },
    final_check_json: { status: "Warnung", blockers: ["manual_article_text_required", "claim_level_source_mapping_required"] },
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
    status: "warning",
    message: "Sicherer Themenvorschlag erstellt. Keine automatische Veroeffentlichung.",
    found_topics_json: [topic],
    used_sources_json: sourceSnapshot,
    source_check_json: { source_status: "teilweise geprueft" },
    duplicate_check_json: { duplicate_status: "neu" },
    keyword_result_json: topic.keywords,
    ai_check_json: { status: "Warnung", publication_status: "pruefpflichtig" }
  });
  return { ok: true, status: "warning", articleId: articleRef.id, message: "Sicherer Themenvorschlag erstellt. Keine automatische Veroeffentlichung." };
}

exports.runAiEditorialTask = onCall({ region, timeoutSeconds: 180 }, async (request) => {
  const profile = await requireEditor(request);
  return runAiEditorialPipeline({ manual: true, actor: profile.email || request.auth.uid });
});

exports.saveAiEditorialSettings = onCall({ region }, async (request) => {
  const profile = await requireEditor(request);
  const data = request.data || {};
  const settings = {
    automationEnabled: Boolean(data.automationEnabled),
    publicationMode: ["draft_only", "review_release", "auto_publish"].includes(data.publicationMode) ? data.publicationMode : "draft_only",
    minimumSources: Math.max(2, Number(data.minimumSources || 2)),
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

/*
 * Mail delivery adapter:
 * A production installation should trigger on mailQueue documents with status
 * "queued", deliver through Postmark/Brevo/SendGrid and then write "sent" or
 * "failed". Credentials belong in Firebase Secret Manager, never in source.
 */
