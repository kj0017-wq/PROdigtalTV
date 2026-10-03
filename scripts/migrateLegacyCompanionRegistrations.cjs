// One-off, idempotent migration of legacy registrations with an embedded companion.
// Dry-run is the default. Pass --apply to write the migration to Firestore.
const crypto = require("node:crypto");
const base = "C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib";
const auth = require(base + "/auth");
const { requireAuth } = require(base + "/requireAuth");
const { Client } = require(base + "/apiv2");

const projectId = "prodigitaltv-da47b";
const databasePath = `/projects/${projectId}/databases/(default)`;
const databaseName = `projects/${projectId}/databases/(default)`;
const apply = process.argv.includes("--apply");

const decode = value => {
  if (!value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  return value.stringValue ?? null;
};

const encode = value => {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).map(([key, child]) => [key, encode(child)])) } };
  }
  return { stringValue: String(value) };
};

const fields = object => Object.fromEntries(Object.entries(object)
  .filter(([, value]) => value !== undefined)
  .map(([key, value]) => [key, encode(value)]));

const rows = response => (response.body || []).filter(item => item.document).map(item => ({
  id: item.document.name.split("/").pop(),
  ...Object.fromEntries(Object.entries(item.document.fields || {}).map(([key, value]) => [key, decode(value)]))
}));

const digest = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const registrationIdFor = registration => `registration-legacy-companion-${digest(`${registration.id}:${registration.companion.email}`).slice(0, 24)}`;
const bookingGroupIdFor = registration => registration.bookingGroupId || `booking-group-legacy-${digest(registration.id).slice(0, 24)}`;
const lockIdFor = (eventId, email) => `${eventId}-${digest(String(email).trim().toLowerCase()).slice(0, 40)}`;
const documentName = (collection, id) => `${databaseName}/documents/${collection}/${id}`;
const active = registration => !["cancelled", "canceled", "deleted", "archived", "expired"].includes(String(registration.status || "").toLowerCase());

(async () => {
  const options = { project: projectId, nonInteractive: true };
  auth.setActiveAccount(options, auth.selectAccount(null, process.cwd()));
  await requireAuth(options);
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1", auth: true });
  const run = structuredQuery => client.post(`${databasePath}/documents:runQuery`, { structuredQuery });
  const registrations = rows(await run({ from: [{ collectionId: "registrations" }], limit: 5000 }));
  const events = rows(await run({ from: [{ collectionId: "events" }], limit: 1000 }));
  const eventById = new Map(events.map(event => [event.id, event]));
  const today = new Date().toISOString().slice(0, 10);

  const legacy = registrations.filter(registration => {
    const companion = registration.companion || {};
    const event = eventById.get(registration.eventId) || {};
    return !registration.migratedCompanionRegistrationId
      && Boolean(companion.email)
      && String(event.date || registration.eventDate || "") >= today;
  });

  const plan = [];
  const writes = [];
  const now = new Date().toISOString();
  for (const registration of legacy) {
    const event = eventById.get(registration.eventId) || {};
    const companion = registration.companion || {};
    const email = String(companion.email || "").trim().toLowerCase();
    const existing = registrations.find(candidate => candidate.id !== registration.id
      && candidate.eventId === registration.eventId
      && String(candidate.email || "").trim().toLowerCase() === email
      && active(candidate));
    const additionalRegistrationId = existing?.id || registrationIdFor(registration);
    const bookingGroupId = bookingGroupIdFor(registration);

    if (!existing) {
      const additionalRegistration = {
        id: additionalRegistrationId,
        eventId: registration.eventId,
        eventTitle: event.title || registration.eventTitle || "",
        eventDate: event.date || registration.eventDate || "",
        eventAccessType: event.accessType || registration.eventAccessType || "",
        firstName: companion.firstName || "",
        lastName: companion.lastName || "",
        email,
        phone: companion.phone || "",
        linkedIn: companion.linkedIn || "",
        company: companion.company || "",
        position: companion.position || "",
        message: "",
        privacyAccepted: registration.privacyAccepted === true,
        photoVideoConsent: registration.photoVideoConsent === true,
        newsletterConsent: false,
        notifyForThisEvent: false,
        notifyFutureEvents: false,
        pushTrackingConsent: false,
        hasCompanion: false,
        companion: null,
        participantCount: 1,
        bookingGroupId,
        registrationRole: "additional_person",
        primaryRegistrationId: registration.id,
        registeredByRegistrationId: registration.id,
        registeredByEmail: String(registration.email || "").trim().toLowerCase(),
        additionalRegistrationId: "",
        registrationSource: "legacy_companion_migration",
        registrationAudienceType: "guest",
        isMember: false,
        existingPersonMatched: false,
        personMatchSource: "legacy_migration_pending_contact_match",
        matchedMemberId: "",
        matchedUserId: "",
        matchedContactId: "",
        matchedSpeakerId: "",
        memberGuestAllowed: (event.accessType || registration.eventAccessType) === "members_only",
        handyTicketEnabled: registration.handyTicketEnabled !== false,
        phoneFormatStatus: companion.phone ? "valid" : "missing",
        phoneVerificationStatus: "unverified",
        notificationConsentAccepted: false,
        notificationConsentSource: "legacy_companion_migration",
        notificationChannels: [],
        mailConsent: false,
        pushConsent: false,
        smsConsent: false,
        emailConfirmed: false,
        status: "pending_email_confirmation",
        mailStatus: "queued",
        confirmationSmsReminderEnabled: true,
        legacyPrimaryRegistrationId: registration.id,
        legacyCreatedAt: registration.createdAt || null,
        createdAt: now,
        updatedAt: now
      };
      writes.push({
        update: { name: documentName("registrations", additionalRegistrationId), fields: fields(additionalRegistration) },
        currentDocument: { exists: false }
      });
    }

    const parentPatch = {
      hasCompanion: false,
      companion: null,
      participantCount: 1,
      bookingGroupId,
      registrationRole: registration.registrationRole || "primary",
      additionalRegistrationId,
      migratedCompanionRegistrationId: additionalRegistrationId,
      legacyCompanion: companion,
      companionMigratedAt: now,
      updatedAt: now
    };
    writes.push({
      update: { name: documentName("registrations", registration.id), fields: fields(parentPatch) },
      updateMask: { fieldPaths: Object.keys(parentPatch) },
      currentDocument: { exists: true }
    });

    const lockId = lockIdFor(registration.eventId, email);
    writes.push({
      update: { name: documentName("registrationLocks", lockId), fields: fields({
        id: lockId,
        eventId: registration.eventId,
        email,
        registrationId: additionalRegistrationId,
        status: existing?.status || "pending_email_confirmation",
        createdAt: now,
        updatedAt: now
      }) }
    });

    plan.push({
      primaryRegistrationId: registration.id,
      additionalRegistrationId,
      eventId: registration.eventId,
      eventTitle: event.title || registration.eventTitle || "",
      primary: [registration.firstName, registration.lastName].filter(Boolean).join(" "),
      additionalPerson: [companion.firstName, companion.lastName].filter(Boolean).join(" "),
      email,
      action: existing ? "link_existing" : "create_and_send_confirmation"
    });
  }

  if (apply && writes.length) {
    await client.post(`${databasePath}/documents:commit`, { writes });
  }
  console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", count: plan.length, writes: writes.length, plan }, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
