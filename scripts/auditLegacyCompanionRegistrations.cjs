// Read-only audit of registrations that still embed a companion person.
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
  const registrations = rows(await run({ from: [{ collectionId: "registrations" }], limit: 5000 }));
  const events = rows(await run({ from: [{ collectionId: "events" }], limit: 1000 }));
  const eventById = new Map(events.map(event => [event.id, event]));
  const legacy = registrations.filter(registration => {
    const companion = registration.companion || {};
    return !registration.migratedCompanionRegistrationId && Boolean(companion.firstName || companion.lastName || companion.email);
  }).map(registration => {
    const event = eventById.get(registration.eventId) || {};
    const companion = registration.companion || {};
    const eventDate = String(event.date || registration.eventDate || "");
    return {
      registrationId: registration.id,
      eventId: registration.eventId || "",
      eventTitle: event.title || registration.eventTitle || "",
      eventDate,
      futureOrToday: Boolean(eventDate && eventDate >= new Date().toISOString().slice(0, 10)),
      primary: [registration.firstName, registration.lastName].filter(Boolean).join(" ") || registration.email || "",
      primaryEmail: registration.email || "",
      companion: [companion.firstName, companion.lastName].filter(Boolean).join(" ") || companion.email || "",
      companionEmail: companion.email || "",
      status: registration.status || ""
    };
  }).sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.companion.localeCompare(b.companion, "de"));
  console.log(JSON.stringify({ count: legacy.length, futureOrToday: legacy.filter(item => item.futureOrToday).length, records: legacy }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
