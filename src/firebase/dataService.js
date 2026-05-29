import { demoDatabase } from "../data/demoData.js";
import { getFirebaseServices, firebaseEnabled } from "./firebaseClient.js";

const STORE_KEY = "prodigitaltv-demo-db-official-assets-v3";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeMissingDemoRecords(db, collectionName) {
  const collection = db[collectionName] || (db[collectionName] = []);
  const missing = (demoDatabase[collectionName] || []).filter((record) => !collection.some((item) => item.id === record.id));
  collection.push(...missing.map(clone));
  return missing.length;
}

function localDb() {
  const stored = localStorage.getItem(STORE_KEY);
  if (stored) {
    const db = JSON.parse(stored);
    mergeMissingDemoRecords(db, "members");
    mergeMissingDemoRecords(db, "events");
    mergeMissingDemoRecords(db, "eventMedia");
    mergeMissingDemoRecords(db, "downloads");
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
        localEvent.imageUrl = demoEvent.imageUrl;
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

export async function list(collectionName) {
  const firebase = await getFirebaseServices();
  if (!firebase) return localDb()[collectionName] || [];
  const result = await firebase.firestore.getDocs(firebase.firestore.collection(firebase.db, collectionName));
  return result.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function constrainedList(collectionName, predicates) {
  const firebase = await getFirebaseServices();
  if (!firebase) {
    return (localDb()[collectionName] || []).filter((record) => predicates.every(([field, operator, value]) => {
      if (operator === "==") return record[field] === value;
      return true;
    }));
  }
  const constraints = predicates.map(([field, operator, value]) => firebase.firestore.where(field, operator, value));
  const request = firebase.firestore.query(firebase.firestore.collection(firebase.db, collectionName), ...constraints);
  const result = await firebase.firestore.getDocs(request);
  return result.docs.map((item) => ({ id: item.id, ...item.data() }));
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
  return constrainedList(collectionName, filters[collectionName] || []);
}

export async function getOne(collectionName, id) {
  const firebase = await getFirebaseServices();
  if (!firebase) return (localDb()[collectionName] || []).find((item) => item.id === id) || null;
  const snapshot = await firebase.firestore.getDoc(firebase.firestore.doc(firebase.db, collectionName, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function upsert(collectionName, entity) {
  const record = { ...entity, updatedAt: new Date().toISOString() };
  const firebase = await getFirebaseServices();
  if (firebase) {
    const id = record.id || crypto.randomUUID();
    await firebase.firestore.setDoc(firebase.firestore.doc(firebase.db, collectionName, id), record, { merge: true });
    return { id, ...record };
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
  if (firebase) return firebase.firestore.deleteDoc(firebase.firestore.doc(firebase.db, collectionName, id));
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
