import { demoDatabase } from "../data/demoData.js";
import { getFirebaseServices, firebaseEnabled, realDataMode } from "./firebaseClient.js";

const STORE_KEY = "prodigitaltv-demo-db-official-assets-v4";

function canFallbackToLocal(error) {
  if (realDataMode()) return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    && ["permission-denied", "unauthenticated", "failed-precondition", "login erforderlich"].some((code) => String(error?.code || error?.message || "").toLowerCase().includes(code));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeMissingDemoRecords(db, collectionName) {
  const collection = db[collectionName] || (db[collectionName] = []);
  const missing = (demoDatabase[collectionName] || []).filter((record) => !collection.some((item) => item.id === record.id));
  collection.push(...missing.map(clone));
  return missing.length;
}

function syncManagedInternalEditorial(db, bereich) {
  const seedRecords = (demoDatabase.editorialContent || [])
    .filter((record) => record.editorialManaged && record.bereich === bereich);
  if (!seedRecords.length) return;
  const seedIds = new Set(seedRecords.map((record) => record.id));
  const existing = db.editorialContent || (db.editorialContent = []);
  db.editorialContent = existing.filter((record) => !(record.editorialManaged && record.bereich === bereich && !seedIds.has(record.id)));
  seedRecords.forEach((seedRecord) => {
    const index = db.editorialContent.findIndex((record) => record.id === seedRecord.id);
    if (index >= 0) db.editorialContent[index] = { ...db.editorialContent[index], ...clone(seedRecord) };
    else db.editorialContent.push(clone(seedRecord));
  });
}

function localDb() {
  const stored = localStorage.getItem(STORE_KEY);
  if (stored) {
    const db = JSON.parse(stored);
    mergeMissingDemoRecords(db, "members");
    mergeMissingDemoRecords(db, "events");
    mergeMissingDemoRecords(db, "eventMedia");
    mergeMissingDemoRecords(db, "galleries");
    mergeMissingDemoRecords(db, "media_assets");
    mergeMissingDemoRecords(db, "media_variants");
    mergeMissingDemoRecords(db, "downloads");
    mergeMissingDemoRecords(db, "memberDocuments");
    mergeMissingDemoRecords(db, "memberDirectories");
    mergeMissingDemoRecords(db, "editorialContent");
    mergeMissingDemoRecords(db, "verified_sources");
    mergeMissingDemoRecords(db, "ai_prompts");
    mergeMissingDemoRecords(db, "ai_prompt_versions");
    mergeMissingDemoRecords(db, "ai_editorial_logs");
    syncManagedInternalEditorial(db, "mitglied_werden");
    ["event-salzburg-red-bull-hangar7-2026", "event-berlinale-2026", "event-leica-welt-2026", "event-salzburg-2025"].forEach((eventId) => {
      const demoEvent = demoDatabase.events.find((event) => event.id === eventId);
      const localEvent = (db.events || []).find((event) => event.id === eventId);
      if (demoEvent && localEvent) {
        localEvent.title = demoEvent.title;
        localEvent.subtitle = demoEvent.subtitle;
        localEvent.description = demoEvent.description;
        localEvent.date = demoEvent.date;
        localEvent.startTime = demoEvent.startTime;
        localEvent.endTime = demoEvent.endTime;
        localEvent.locationName = demoEvent.locationName;
        localEvent.address = demoEvent.address;
        localEvent.city = demoEvent.city;
        localEvent.phone = demoEvent.phone;
        localEvent.lunchNote = demoEvent.lunchNote;
        if (!localEvent.imageUrl) localEvent.imageUrl = demoEvent.imageUrl;
        localEvent.expiresAt = demoEvent.expiresAt;
        localEvent.status = demoEvent.status;
        localEvent.lifecyclePhase = demoEvent.lifecyclePhase;
        localEvent.postEventSummary = demoEvent.postEventSummary;
        delete localEvent.sourceUrl;
      }
    });
    (db.events || []).forEach((event) => {
      delete event.sourceUrl;
    });
    (db.editorialContent || []).forEach((item) => {
      if (["press", "news"].includes(item.page) && item.status === "published" && item.visibility === "public" && !Object.prototype.hasOwnProperty.call(item, "visible")) {
        item.visible = true;
      }
      if (typeof item.title === "string") item.title = item.title.replace(/^Themenvorschlag:\s*/i, "");
      if (typeof item.headline === "string") item.headline = item.headline.replace(/^Themenvorschlag:\s*/i, "");
      if (typeof item.bodyText === "string") {
        item.bodyText = item.bodyText
          .replace(/^Dies ist ein sicherer Themenvorschlag der lokalen KI-Redaktion\.\s*/i, "")
          .replace(/Der Themenvorschlag betrifft/i, "Der Beitrag betrifft");
      }
    });
    (demoDatabase.topics || []).forEach((demoTopic) => {
      const localTopic = (db.topics || []).find((topic) => topic.id === demoTopic.id);
      if (localTopic) {
        if (!Object.prototype.hasOwnProperty.call(localTopic, "imageUrl")) localTopic.imageUrl = demoTopic.imageUrl;
        if (!Object.prototype.hasOwnProperty.call(localTopic, "longDescription")) localTopic.longDescription = demoTopic.longDescription;
        if (!Object.prototype.hasOwnProperty.call(localTopic, "shortDescription")) localTopic.shortDescription = demoTopic.shortDescription;
      }
    });
    ["about-intro"].forEach((contentId) => {
      const demoContent = demoDatabase.editorialContent.find((content) => content.id === contentId);
      const localContent = (db.editorialContent || []).find((content) => content.id === contentId);
      if (demoContent && localContent) {
        localContent.title = demoContent.title;
        localContent.introText = demoContent.introText;
        localContent.bodyText = demoContent.bodyText;
      }
    });
    saveLocal(db);
    return db;
  }
  const db = clone(demoDatabase);
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
  return db;
}

function saveLocal(db) {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

function scrubOversizedInlineImages(record = {}) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (typeof value === "string" && value.startsWith("data:image/") && value.length > 900000) {
      return [key, ""];
    }
    return [key, value];
  }));
}

export async function list(collectionName) {
  const firebase = await getFirebaseServices();
  if (!firebase) {
    if (realDataMode()) throw new Error("Firebase ist im Real-Modus nicht erreichbar.");
    return localDb()[collectionName] || [];
  }
  try {
    const result = await firebase.firestore.getDocs(firebase.firestore.collection(firebase.db, collectionName));
    return result.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    if (canFallbackToLocal(error)) return localDb()[collectionName] || [];
    throw error;
  }
}

async function constrainedList(collectionName, predicates) {
  const firebase = await getFirebaseServices();
  if (!firebase) {
    if (realDataMode()) throw new Error("Firebase ist im Real-Modus nicht erreichbar.");
    return (localDb()[collectionName] || []).filter((record) => predicates.every(([field, operator, value]) => {
      if (operator === "==") return record[field] === value;
      return true;
    }));
  }
  try {
    const constraints = predicates.map(([field, operator, value]) => firebase.firestore.where(field, operator, value));
    const request = firebase.firestore.query(firebase.firestore.collection(firebase.db, collectionName), ...constraints);
    const result = await firebase.firestore.getDocs(request);
    return result.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    if (canFallbackToLocal(error)) {
      return (localDb()[collectionName] || []).filter((record) => predicates.every(([field, operator, value]) => {
        if (operator === "==") return record[field] === value;
        return true;
      }));
    }
    throw error;
  }
}

export async function listPublicEvents(includeMemberEvents = false) {
  const publicEvents = await constrainedList("events", [["status", "==", "published"], ["visibility", "==", "public"]]);
  const activePublicEvents = publicEvents.filter(isEventVisible);
  if (!includeMemberEvents) return activePublicEvents;
  const memberEvents = await constrainedList("events", [["accessType", "==", "members_only"]]);
  const activeMemberEvents = memberEvents.filter(isEventVisible);
  return [...activePublicEvents, ...activeMemberEvents.filter((event) => !activePublicEvents.some((publicEvent) => publicEvent.id === event.id))];
}

function isEventVisible(event) {
  if (event.status === "inactive" || event.visibility === "internal") return false;
  return true;
}

function isPublicLiveMember(member) {
  return member.status === "active"
    && (member.visibility || "public") === "public"
    && member.isLive !== false;
}

export async function listPublicContent(collectionName) {
  const filters = {
    topics: [["status", "==", "active"]],
    speakers: [["status", "==", "published"]],
    sponsors: [["status", "==", "published"]],
    members: [["status", "==", "active"], ["visibility", "==", "public"]],
    boardMembers: [["status", "==", "active"], ["visibility", "==", "public"]],
    editorialContent: [["status", "==", "published"], ["visibility", "==", "public"]],
    galleries: [["status", "==", "published"], ["visibility", "==", "public"]],
    eventMedia: [["status", "==", "approved"], ["visibility", "==", "public"]]
  };
  const records = await constrainedList(collectionName, filters[collectionName] || []);
  if (collectionName === "members") return records.filter(isPublicLiveMember);
  return records;
}

export async function getOne(collectionName, id) {
  const firebase = await getFirebaseServices();
  if (!firebase) {
    if (realDataMode()) throw new Error("Firebase ist im Real-Modus nicht erreichbar.");
    return (localDb()[collectionName] || []).find((item) => item.id === id) || null;
  }
  try {
    const snapshot = await firebase.firestore.getDoc(firebase.firestore.doc(firebase.db, collectionName, id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    if (canFallbackToLocal(error)) return (localDb()[collectionName] || []).find((item) => item.id === id) || null;
    throw error;
  }
}

export async function upsert(collectionName, entity) {
  const record = scrubOversizedInlineImages({ ...entity, updatedAt: new Date().toISOString() });
  const firebase = await getFirebaseServices();
  if (firebase) {
    const id = record.id || crypto.randomUUID();
    try {
      await firebase.firestore.setDoc(firebase.firestore.doc(firebase.db, collectionName, id), record, { merge: true });
      return { id, ...record };
    } catch (error) {
      if (!canFallbackToLocal(error)) throw error;
    }
  }
  const db = localDb();
  const collection = db[collectionName] || (db[collectionName] = []);
  const id = record.id || `${collectionName}-${crypto.randomUUID()}`;
  const index = collection.findIndex((item) => item.id === id);
  const result = { id, ...record };
  if (index >= 0) collection[index] = { ...collection[index], ...result };
  else collection.push(result);
  saveLocal(db);
  return result;
}

export async function remove(collectionName, id) {
  const firebase = await getFirebaseServices();
  if (firebase) {
    try {
      return await firebase.firestore.deleteDoc(firebase.firestore.doc(firebase.db, collectionName, id));
    } catch (error) {
      if (!canFallbackToLocal(error)) throw error;
    }
  }
  const db = localDb();
  db[collectionName] = (db[collectionName] || []).filter((item) => item.id !== id);
  saveLocal(db);
}

export function isDemoMode() {
  return !firebaseEnabled();
}

export function resetDemoDatabase() {
  localStorage.setItem(STORE_KEY, JSON.stringify(clone(demoDatabase)));
}

export function resetLocalCollection(collectionName) {
  const db = localDb();
  db[collectionName] = [];
  saveLocal(db);
}

export function replaceLocalCollection(collectionName, records = []) {
  const db = localDb();
  db[collectionName] = records.map((record) => ({ ...record }));
  saveLocal(db);
}
