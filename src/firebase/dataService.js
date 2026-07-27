import { getFirebaseServices, getFirestoreServices, firebaseEnabled, realDataMode } from "./firebaseClient.js?v=3";

import { normalizeLifecyclePhase } from "../data/platformConstants.js";

const PUBLIC_LIST_CACHE_MS = 45000;
const PUBLIC_SESSION_CACHE_MS = 180000;
const PUBLIC_READ_TIMEOUT_MS = 9000;
const publicListCache = new Map();

function cmsDataMode() {
  return String(window.location.pathname || "").endsWith("/cms.html")
    || String(window.location.hash || "").startsWith("#/cms");
}

function memberPortalDataMode() {
  return String(window.location.hash || "").startsWith("#/portal");
}

async function waitForFirebaseAuth(firebase) {
  if (!firebase?.auth || firebase.auth.currentUser || !realDataMode()) return;
  await new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 2000);
    const unsubscribe = firebase.authLib.onAuthStateChanged(firebase.auth, () => {
      window.clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

async function getDataFirebase({ write = false } = {}) {
  const firebase = write || cmsDataMode() || memberPortalDataMode()
    ? await getFirebaseServices()
    : await getFirestoreServices();
  if (firebase && (write || cmsDataMode() || memberPortalDataMode())) await waitForFirebaseAuth(firebase);
  return firebase;
}

function canFallbackToLocal() {
  return false;
}

function timeoutError(label = "Firestore") {
  const error = new Error(`${label} Timeout`);
  error.code = "pdtv-timeout";
  return error;
}

function withReadTimeout(promise, timeoutMs = PUBLIC_READ_TIMEOUT_MS, label = "Firestore") {
  if (cmsDataMode() || memberPortalDataMode()) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = (typeof window !== "undefined" ? window : globalThis).setTimeout(() => reject(timeoutError(label)), timeoutMs);
      promise.finally(() => (typeof window !== "undefined" ? window : globalThis).clearTimeout(timer)).catch(() => {});
    })
  ]);
}

function canUsePublicFallback() {
  return false;
}

function getDocsLive(firebase, reference) {
  const reader = firebase.firestore.getDocsFromServer || firebase.firestore.getDocs;
  return reader(reference);
}

function getDocLive(firebase, reference) {
  const reader = firebase.firestore.getDocFromServer || firebase.firestore.getDoc;
  return reader(reference);
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
  const firebase = await getDataFirebase();
  if (!firebase) {
    throw new Error("Firebase ist nicht erreichbar. Es werden keine lokalen Ersatzdaten verwendet.");
  }
  try {
    const result = await withReadTimeout(getDocsLive(firebase, firebase.firestore.collection(firebase.db, collectionName)), PUBLIC_READ_TIMEOUT_MS, `list:${collectionName}`);
    return result.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    throw error;
  }
}

async function constrainedList(collectionName, predicates) {
  const firebase = await getDataFirebase();
  if (!firebase) {
    throw new Error("Firebase ist nicht erreichbar. Es werden keine lokalen Ersatzdaten verwendet.");
  }
  try {
    const constraints = predicates.map(([field, operator, value]) => firebase.firestore.where(field, operator, value));
    const request = firebase.firestore.query(firebase.firestore.collection(firebase.db, collectionName), ...constraints);
    const result = await withReadTimeout(getDocsLive(firebase, request), PUBLIC_READ_TIMEOUT_MS, `query:${collectionName}`);
    return result.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    throw error;
  }
}

function publicCacheKey(collectionName, predicates) {
  return `${collectionName}:${JSON.stringify(predicates || [])}`;
}

function publicSessionCacheKey(key = "") {
  return `pdtv-public-list-v3:${key}`;
}

function publicSessionCacheAllowed(collectionName, predicates = []) {
  if (!firebaseEnabled() || !realDataMode()) return false;
  if (["events", "media_assets"].includes(collectionName)) return false;
  if (["users", "registrations", "mailQueue"].includes(collectionName)) return false;
  return predicates.every(([field, operator]) => operator === "==" && !["accessType", "email", "uid"].includes(field));
}

function readPublicSessionCache(key = "") {
  try {
    const cached = JSON.parse(sessionStorage.getItem(publicSessionCacheKey(key)) || "null");
    if (!cached || !Array.isArray(cached.records) || Date.now() - Number(cached.createdAt || 0) > PUBLIC_SESSION_CACHE_MS) return null;
    return cached.records;
  } catch {
    return null;
  }
}

function writePublicSessionCache(key = "", records = []) {
  try {
    sessionStorage.setItem(publicSessionCacheKey(key), JSON.stringify({
      createdAt: Date.now(),
      records: records.map(scrubOversizedInlineImages)
    }));
  } catch {}
}

async function cachedConstrainedList(collectionName, predicates) {
  const key = publicCacheKey(collectionName, predicates);
  const cached = publicListCache.get(key);
  if (cached && Date.now() - cached.createdAt < PUBLIC_LIST_CACHE_MS) return cached.promise;
  const sessionCached = publicSessionCacheAllowed(collectionName, predicates) ? readPublicSessionCache(key) : null;
  if (sessionCached) return sessionCached;
  const promise = constrainedList(collectionName, predicates);
  publicListCache.set(key, { createdAt: Date.now(), promise });
  try {
    const records = await promise;
    if (publicSessionCacheAllowed(collectionName, predicates)) writePublicSessionCache(key, records);
    return records;
  } catch (error) {
    publicListCache.delete(key);
    throw error;
  }
}

function mediaAssetEventIds(asset = {}) {
  return [
    (asset.target_collection || asset.targetCollection) === "events" ? asset.target_id || asset.targetId : "",
    (asset.linked_collection || asset.linkedCollection) === "events" ? asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId : ""
  ].filter(Boolean);
}

function publicActiveMediaAsset(asset = {}) {
  const status = String(asset.status || "active").toLowerCase();
  const visibility = String(asset.visibility || "public").toLowerCase();
  return visibility === "public" && !["archived", "deleted", "hidden", "inactive"].includes(status);
}

function normalizePublicState(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[ß]/g, "ss");
}

function liveStatus(record = {}, defaultValue = "active") {
  return normalizePublicState(record.status || record.lifecycleStatus || record.publicationStatus || defaultValue);
}

function liveVisibility(record = {}, defaultValue = "public") {
  if (record.visible === false || record.isLive === false) return "hidden";
  if (record.visible === true && !record.visibility && !record.sichtbarkeit) return "public";
  return normalizePublicState(record.visibility || record.sichtbarkeit || record.publicationVisibility || defaultValue);
}

function isDemoRecord(record = {}) {
  const source = normalizePublicState(record.source || record.sourceType || record.origin || "");
  return record.demo === true
    || record.isDemo === true
    || record.seed === true
    || record.isSeed === true
    || source.includes("demo")
    || source.includes("seed");
}

function eventTitleValue(event = {}) {
  return String(event.title || event.titel || event.name || event.headline || event.eventTitle || "").trim();
}

function eventDateValue(event = {}) {
  const value = event.date || event.eventDate || event.startDate || event.start_date || event.startAt || event.startDateTime || event.beginAt || "";
  return String(value || "").slice(0, 10);
}

function normalizePublicEvent(event = {}) {
  const lifecyclePhase = normalizeLifecyclePhase(event.lifecyclePhase || event.lifecycle_phase || event.phase || "planning");
  return {
    ...event,
    title: eventTitleValue(event),
    date: eventDateValue(event),
    accessType: event.accessType || event.access_type || event.access || "public",
    lifecyclePhase,
    status: event.status || event.state || "draft"
  };
}

function hasLiveEventIdentity(event = {}) {
  return Boolean(eventTitleValue(event)) && !isDemoRecord(event);
}

function liveRecordHasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function liveImagePriority(value = "") {
  const url = String(value || "");
  if (url.startsWith("data:image/")) return 4;
  if (url.includes("firebasestorage.googleapis.com")) return 3;
  if (url.startsWith("http")) return 2;
  if (url) return 1;
  return 0;
}

function mergeLiveRecord(current = {}, incoming = {}) {
  const imageFields = new Set(["imageUrl", "thumbnail_url", "thumbnailUrl", "assetUrl"]);
  const merged = { ...current };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (!liveRecordHasValue(value)) return;
    if (imageFields.has(key)) {
      if (liveImagePriority(value) >= liveImagePriority(merged[key])) merged[key] = value;
      return;
    }
    merged[key] = value;
  });
  return merged;
}

function directMediaAssetIds(record = {}) {
  return [
    record.thumbnail_media_asset_id,
    record.thumbnailMediaAssetId,
    record.mediaAssetId,
    record.media_asset_id,
    record.assetId
  ].filter(Boolean);
}

export async function listPublicEventMediaAssets(eventsOrIds = []) {
  const events = eventsOrIds.map((item) => typeof item === "string" ? { id: item } : item).filter((item) => item?.id);
  const eventIds = [...new Set(events.map((event) => event.id))];
  if (!eventIds.length) return [];

  const directIds = [...new Set(events.flatMap(directMediaAssetIds))];
  const firebase = await getDataFirebase();
  if (!firebase) {
    return [];
  }

  const requests = [];
  if (eventIds.length <= 4) {
    requests.push(...eventIds.flatMap((eventId) => [
      cachedConstrainedList("media_assets", [["status", "==", "active"], ["visibility", "==", "public"], ["target_collection", "==", "events"], ["target_id", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["status", "==", "active"], ["visibility", "==", "public"], ["linked_collection", "==", "events"], ["linked_record_id", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["status", "==", "active"], ["target_collection", "==", "events"], ["target_id", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["status", "==", "active"], ["linked_collection", "==", "events"], ["linked_record_id", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["status", "==", "active"], ["targetCollection", "==", "events"], ["targetId", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["status", "==", "active"], ["linkedCollection", "==", "events"], ["linkedRecordId", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["target_collection", "==", "events"], ["target_id", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["linked_collection", "==", "events"], ["linked_record_id", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["targetCollection", "==", "events"], ["targetId", "==", eventId]]).catch(() => []),
      cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["linkedCollection", "==", "events"], ["linkedRecordId", "==", eventId]]).catch(() => [])
    ]));
  }
  directIds.forEach((assetId) => {
    requests.push(getOne("media_assets", assetId).then((asset) => publicActiveMediaAsset(asset || {}) ? [asset] : []).catch(() => []));
  });
  requests.push(
    cachedConstrainedList("media_assets", [["status", "==", "active"]])
      .then((assets) => assets.filter((asset) => publicActiveMediaAsset(asset) && mediaAssetEventIds(asset).some((eventId) => eventIds.includes(eventId))))
      .catch(() => []),
    cachedConstrainedList("media_assets", [["visibility", "==", "public"]])
      .then((assets) => assets.filter((asset) => publicActiveMediaAsset(asset) && mediaAssetEventIds(asset).some((eventId) => eventIds.includes(eventId))))
      .catch(() => [])
  );

  const records = (await Promise.all(requests)).flat().filter(publicActiveMediaAsset);
  return Array.from(new Map(records.filter(Boolean).map((record) => [record.id, record])).values());
}

export async function listPublicMediaAssets() {
  const firebase = await getDataFirebase();
  if (!firebase) {
    return [];
  }
  return cachedConstrainedList("media_assets", [["status", "==", "active"], ["visibility", "==", "public"]])
    .then((assets) => assets.filter(publicActiveMediaAsset))
    .catch(() => []);
}

export async function listPublicEvents(includeMemberEvents = false) {
  const [
    publishedEvents,
    activeEvents,
    visibleEvents,
    registrationOpenEvents,
    registrationStatusOpenEvents,
    germanRegistrationOpenEvents,
    registrationEnabledEvents,
    allEvents
  ] = await Promise.all([
    cachedConstrainedList("events", [["status", "==", "published"], ["visibility", "==", "public"]]).catch(() => []),
    cachedConstrainedList("events", [["status", "==", "active"], ["visibility", "==", "public"]]).catch(() => []),
    cachedConstrainedList("events", [["visible", "==", true]]).catch(() => []),
    cachedConstrainedList("events", [["registrationStatus", "==", "open"]]).catch(() => []),
    cachedConstrainedList("events", [["registration_state", "==", "open"]]).catch(() => []),
    cachedConstrainedList("events", [["registrationStatus", "==", "offen"]]).catch(() => []),
    cachedConstrainedList("events", [["registrationEnabled", "==", true]]).catch(() => []),
    list("events").catch(() => [])
  ]);
  const mergedEvents = new Map();
  [
    ...publishedEvents,
    ...activeEvents,
    ...visibleEvents,
    ...registrationOpenEvents,
    ...registrationStatusOpenEvents,
    ...germanRegistrationOpenEvents,
    ...registrationEnabledEvents,
    ...allEvents
  ].forEach((event) => {
    if (!event?.id) return;
    mergedEvents.set(event.id, mergeLiveRecord(mergedEvents.get(event.id), normalizePublicEvent(event)));
  });
  const publicEvents = Array.from(mergedEvents.values());
  const activePublicEvents = publicEvents.filter(isEventVisible);
  if (!includeMemberEvents) return activePublicEvents;
  const memberEvents = await cachedConstrainedList("events", [["accessType", "==", "members_only"]]).catch(() => []);
  const activeMemberEvents = memberEvents.map(normalizePublicEvent).filter(isEventVisible);
  return [...activePublicEvents, ...activeMemberEvents.filter((event) => !activePublicEvents.some((publicEvent) => publicEvent.id === event.id))];
}

function isEventVisible(event) {
  if (!hasLiveEventIdentity(event)) return false;
  const status = liveStatus(event, "active");
  const visibility = liveVisibility(event, "public");
  const lifecycle = normalizeLifecyclePhase(event.lifecyclePhase || event.lifecycle || "");
  const registrationStatus = normalizePublicState(event.registrationStatus || event.registration_state || event.registrationState || event.registration || "");
  const registrationOpen = event.registrationEnabled === true
    || event.allowPublicRegistration === true
    || ["open", "offen", "active", "aktiv", "geoeffnet", "registration_open"].includes(registrationStatus);
  if (["inactive", "cancelled", "deleted", "hidden", "private"].includes(status)) return false;
  if (["internal", "private", "hidden"].includes(visibility)) return false;
  if (status === "draft" && event.visible !== true) return false;
  if (lifecycle === "archived") return true;
  if (registrationOpen) return true;
  return ["", "active", "published", "approved", "aktiv", "veroeffentlicht", "veröffentlicht", "online", "open", "offen", "geoeffnet", "geöffnet", "registration_open"].includes(status) || event.visible === true;
}

function isPublicLiveMember(member) {
  const status = liveStatus(member, "active");
  const visibility = liveVisibility(member, "public");
  return !["inactive", "cancelled", "archived", "deleted"].includes(status)
    && !["internal", "private", "hidden"].includes(visibility)
    && member.visible !== false
    && member.isLive !== false
    && !memberAccessBlocked(member);
}

function memberAccessBlocked(member = {}, now = new Date()) {
  if (!["inactive", "cancelled"].includes(member.membershipAccessStatus)) return false;
  const effective = member.membershipAccessEffectiveAt;
  if (!effective) return true;
  const effectiveDate = effective.seconds ? new Date(effective.seconds * 1000) : new Date(effective);
  return !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= now;
}

export async function listPublicContent(collectionName) {
  if (collectionName === "editorialContent") {
    const [published, activeManaged] = await Promise.all([
      cachedConstrainedList(collectionName, [["status", "==", "published"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["status", "==", "aktiv"], ["sichtbarkeit", "==", "oeffentlich"]]).catch(() => [])
    ]);
    const merged = new Map();
    [...published, ...activeManaged].forEach((record) => merged.set(record.id, record));
    return Array.from(merged.values());
  }
  if (collectionName === "topics") {
    const batches = await Promise.all([
      cachedConstrainedList(collectionName, [["status", "==", "active"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["status", "==", "published"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["status", "==", "aktiv"], ["sichtbarkeit", "==", "oeffentlich"]]).catch(() => [])
    ]);
    const merged = new Map();
    batches.flat().forEach((record) => {
      const status = String(record.status || "active").toLowerCase();
      const visibility = String(record.visibility || record.sichtbarkeit || "public").toLowerCase();
      if (["inactive", "archived", "deleted", "hidden"].includes(status)) return;
      if (["internal", "private", "hidden"].includes(visibility)) return;
      merged.set(record.id, record);
    });
    if (merged.size) return Array.from(merged.values());
    const allTopics = await list("topics").catch(() => []);
    return allTopics.filter((topic) => {
      const status = String(topic.status || "active").toLowerCase();
      const visibility = String(topic.visibility || topic.sichtbarkeit || "public").toLowerCase();
      return !["inactive", "archived", "deleted", "hidden"].includes(status)
        && !["internal", "private", "hidden"].includes(visibility);
    });
  }
  const filters = {
    topics: [["status", "==", "active"]],
    speakers: [["status", "==", "published"]],
    sponsors: [["status", "==", "published"]],
    members: [["visible", "==", true]],
    boardMembers: [["status", "==", "active"], ["visibility", "==", "public"]],
    editorialContent: [["status", "==", "published"], ["visibility", "==", "public"]],
    galleries: [["status", "==", "published"], ["visibility", "==", "public"]],
    eventMedia: [["status", "==", "approved"], ["visibility", "==", "public"]]
  };
  if (collectionName === "members") {
    const batches = await Promise.all([
      cachedConstrainedList(collectionName, [["visible", "==", true], ["isLive", "==", true], ["status", "==", "active"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["visible", "==", true], ["isLive", "==", true], ["status", "==", "active"], ["visibility", "==", "portal"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["visible", "==", true], ["isLive", "==", true], ["status", "==", "published"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["visible", "==", true], ["status", "==", "active"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["visible", "==", true], ["status", "==", "active"], ["visibility", "==", "portal"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["visible", "==", true], ["status", "==", "published"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["isLive", "==", true]]).catch(() => []),
      cachedConstrainedList(collectionName, [["status", "==", "active"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["status", "==", "published"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["status", "==", "aktiv"], ["sichtbarkeit", "==", "oeffentlich"]]).catch(() => []),
      list("members").catch(() => [])
    ]);
    return Array.from(new Map(batches.flat().map((member) => [member.id, member])).values()).filter(isPublicLiveMember);
  }
  const records = await cachedConstrainedList(collectionName, filters[collectionName] || []);
  return records;
}

export async function listMemberContent(collectionName) {
  if (collectionName !== "editorialContent") return cachedConstrainedList(collectionName, [["visibility", "==", "members"]]);
  const queries = [
    [["visibility", "==", "members"]],
    [["section", "==", "member-area"]],
    [["page", "==", "member-area"]]
  ];
  const batches = await Promise.all(queries.map((predicates) => cachedConstrainedList(collectionName, predicates).catch(() => [])));
  const merged = new Map();
  batches.flat().forEach((item) => {
    if (item?.id) merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
  });
  return Array.from(merged.values());
}

export async function getOne(collectionName, id) {
  const firebase = await getDataFirebase();
  if (!firebase) {
    throw new Error("Firebase ist nicht erreichbar. Es werden keine lokalen Ersatzdaten verwendet.");
  }
  try {
    const snapshot = await withReadTimeout(getDocLive(firebase, firebase.firestore.doc(firebase.db, collectionName, id)), PUBLIC_READ_TIMEOUT_MS, `get:${collectionName}/${id}`);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    throw error;
  }
}

export async function upsert(collectionName, entity) {
  const record = scrubOversizedInlineImages({ ...entity, updatedAt: new Date().toISOString() });
  const firebase = await getDataFirebase({ write: true });
  if (firebase) {
    const id = record.id || crypto.randomUUID();
    try {
      await firebase.firestore.setDoc(firebase.firestore.doc(firebase.db, collectionName, id), record, { merge: true });
      return { id, ...record };
    } catch (error) {
      if (!canFallbackToLocal(error)) throw error;
    }
  }
  throw new Error("Firebase ist nicht erreichbar. Es wurde nicht lokal gespeichert.");
}

export async function remove(collectionName, id) {
  const firebase = await getDataFirebase({ write: true });
  if (firebase) {
    try {
      return await firebase.firestore.deleteDoc(firebase.firestore.doc(firebase.db, collectionName, id));
    } catch (error) {
      if (!canFallbackToLocal(error)) throw error;
    }
  }
  throw new Error("Firebase ist nicht erreichbar. Es wurde nichts lokal geloescht.");
}
