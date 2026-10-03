// Read-only verification for the legacy companion migration.
const base = "C:/Users/Klaus-HP/AppData/Roaming/npm/node_modules/firebase-tools/lib";
const auth = require(base + "/auth");
const { requireAuth } = require(base + "/requireAuth");
const { Client } = require(base + "/apiv2");

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

const rows = response => (response.body || []).filter(item => item.document).map(item => ({
  id: item.document.name.split("/").pop(),
  ...Object.fromEntries(Object.entries(item.document.fields || {}).map(([key, value]) => [key, decode(value)]))
}));

(async () => {
  const options = { project: "prodigitaltv-da47b", nonInteractive: true };
  auth.setActiveAccount(options, auth.selectAccount(null, process.cwd()));
  await requireAuth(options);
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1", auth: true });
  const run = structuredQuery => client.post("/projects/prodigitaltv-da47b/databases/(default)/documents:runQuery", { structuredQuery });
  const [registrations, contacts, mailQueue] = await Promise.all([
    run({ from: [{ collectionId: "registrations" }], limit: 5000 }).then(rows),
    run({ from: [{ collectionId: "contacts" }], limit: 5000 }).then(rows),
    run({ from: [{ collectionId: "mailQueue" }], limit: 5000 }).then(rows)
  ]);
  const migrated = registrations.filter(item => item.registrationSource === "legacy_companion_migration");
  const result = migrated.map(registration => {
    const parent = registrations.find(item => item.id === registration.primaryRegistrationId);
    const contact = contacts.find(item => String(item.email || "").toLowerCase() === String(registration.email || "").toLowerCase());
    const confirmationMails = mailQueue.filter(item => item.registrationId === registration.id && item.type === "registration_confirmation");
    return {
      registrationId: registration.id,
      name: [registration.firstName, registration.lastName].filter(Boolean).join(" "),
      email: registration.email,
      eventTitle: registration.eventTitle,
      status: registration.status,
      confirmationTokenCreated: Boolean(registration.confirmationTokenHash),
      parentUnlinked: Boolean(parent && parent.companion === null && parent.migratedCompanionRegistrationId === registration.id),
      contactMatched: Boolean(contact),
      contactId: contact?.id || "",
      confirmationMails: confirmationMails.map(mail => ({ id: mail.id, status: mail.status || "", sentAt: mail.sentAt || null }))
    };
  });
  console.log(JSON.stringify({ count: result.length, allVerified: result.length === 3 && result.every(item => item.confirmationTokenCreated && item.parentUnlinked && item.contactMatched && item.confirmationMails.length > 0), result }, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
