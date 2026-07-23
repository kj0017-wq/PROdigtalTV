import { settings } from "../data/platformConstants.js";
import { getFirebaseServices } from "./firebaseClient.js";
import { getOne, list, upsert } from "./dataService.js";

const requiredCollections = [
  "events", "topics", "speakers", "sponsors", "members", "boardMembers", "memberDocuments", "memberDirectories", "registrations", "membershipApplications", "downloads",
  "users", "media", "eventMedia", "editorialContent", "mailQueue", "contacts", "eventNotifications", "notificationTokens", "settings", "system", "auditLog"
];

export async function checkFirebaseConnection() {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  await firebase.firestore.getDoc(firebase.firestore.doc(firebase.db, "system", "setup"));
  return {
    connected: true,
    firestore: "available",
    authentication: firebase.auth ? "available" : "unavailable",
    storage: firebase.storage ? "available" : "unavailable",
    mode: "firebase",
    message: "Firestore, Authentication und Storage wurden initialisiert."
  };
}

export async function checkFirestoreStructure() {
  const checks = await Promise.all(requiredCollections.map(async (collectionName) => ({
    collection: collectionName,
    available: (await list(collectionName)).length > 0
  })));
  return checks;
}

export async function initializeSettings() {
  for (const setting of settings) {
    if (!(await getOne("settings", setting.id))) await upsert("settings", setting);
  }
  return true;
}

export async function initializeRoles() {
  return upsert("settings", {
    id: "roles",
    key: "roles",
    group: "authorization",
    value: ["admin", "editor", "member", "guest"],
    description: "Rollenmodell der Plattform"
  });
}

export async function initializeDefaultStatuses() {
  const defaults = [
    { id: "eventStatus", key: "eventStatus", group: "events", value: ["draft", "published", "archived"] },
    { id: "lifecyclePhases", key: "lifecyclePhases", group: "events", value: ["planning", "invitation", "registration_open", "registration_closed", "event_day", "post_processing", "archive_published", "archived"] },
    { id: "accessTypes", key: "accessTypes", group: "events", value: ["public", "members_only", "invitation_only"] },
    { id: "registrationStatuses", key: "registrationStatuses", group: "registrations", value: ["pending_email_confirmation", "confirmed", "waitlist", "cancelled", "attended", "no_show", "expired"] }
  ];
  for (const setting of defaults) await upsert("settings", setting);
}

export async function writeSetupLog(message, level = "info") {
  const setup = (await getOne("system", "setup")) || { id: "setup", installed: false, setupLog: [] };
  setup.setupLog = [...(setup.setupLog || []), { message, level, timestamp: new Date().toISOString() }];
  return upsert("system", setup);
}

export async function writeAuditLog(action, module, entityType, entityId, details = {}) {
  return upsert("auditLog", {
    id: `audit-${crypto.randomUUID()}`, action, module, entityType, entityId,
    userId: "current-admin", userEmail: "admin@prodigitaltv.de", timestamp: new Date().toISOString(), details
  });
}

export async function initializeDatabase() {
  await initializeSettings();
  await initializeRoles();
  await initializeDefaultStatuses();
  const setup = await upsert("system", {
    id: "setup", installed: true, installedAt: new Date().toISOString(), version: "1.0.0",
    lastCheckAt: new Date().toISOString()
  });
  await writeSetupLog("Basisstruktur und Standardwerte wurden geprueft und vervollstaendigt.");
  await writeAuditLog("initialize", "system", "setup", "setup");
  return setup;
}

