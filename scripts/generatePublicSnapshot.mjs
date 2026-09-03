import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "prodigitaltv-da47b";
const snapshotVersion = "v2";

function cacheKey(collectionName, predicates = []) {
  return `${collectionName}:${JSON.stringify(predicates || [])}`;
}

function publicSessionCacheKey(key = "") {
  return `pdtv-public-list-v5:${key}`;
}

function normalizeFirestoreValue(value) {
  if (!value) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeFirestoreValue(entry)]));
  }
  return value;
}

async function loadCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => normalizeFirestoreValue({ id: doc.id, ...doc.data() }));
}

function valueFor(record = {}, field = "") {
  return field.split(".").reduce((current, part) => current?.[part], record);
}

function matches(record = {}, predicates = []) {
  return predicates.every(([field, operator, expected]) => {
    const actual = valueFor(record, field);
    if (operator === "==") return actual === expected;
    return false;
  });
}

const fieldAllowList = {
  events: new Set([
    "id", "title", "titel", "name", "headline", "eventTitle", "date", "displayDate", "startTime", "endTime",
    "city", "locationName", "eventType", "accessType", "access_type", "status", "state", "visibility",
    "sichtbarkeit", "visible", "lifecyclePhase", "lifecycle_phase", "phase", "registrationEnabled",
    "registrationStatus", "registration_state", "registrationState", "allowPublicRegistration",
    "allowMemberRegistration", "showPublicTeaser", "publicTeaser", "description", "shortDescription",
    "teaserText", "subtitle", "introText", "longDescription", "bodyText", "articleText", "archiveText",
    "postEventSummary", "postEventummary", "hostId", "sponsorIds", "topicIds", "speakerIds", "imageUrl",
    "thumbnail_url", "thumbnailUrl", "assetUrl", "mediaAssetId", "media_asset_id", "thumbnailMediaAssetId",
    "thumbnail_media_asset_id", "updatedAt", "updated_at", "validFrom"
  ]),
  topics: new Set([
    "id", "title", "headline", "shortDescription", "teaserText", "subtitle", "description",
    "longDescription", "bodyText", "articleText", "status", "visibility", "sichtbarkeit", "eventId", "eventIds", "speakerId", "speakerIds",
    "sortOrder", "date", "publishDate", "validFrom", "updatedAt", "updated_at", "imageUrl",
    "thumbnail_url", "thumbnailUrl", "cardImageUrl", "assetUrl", "companyLogoUrl", "logoUrl",
    "company_logo_url", "mediaAssetId", "media_asset_id", "thumbnailMediaAssetId",
    "thumbnail_media_asset_id", "articleMediaAssetId", "article_media_asset_id", "icon"
  ]),
  speakers: new Set([
    "id", "name", "firstName", "lastName", "company", "position", "role", "status", "visibility",
    "photoUrl", "imageUrl", "thumbnailUrl", "thumbnail_url", "assetUrl", "portraitUrl", "profileImageUrl",
    "companyLogoUrl", "logoUrl", "company_logo_url", "mediaAssetId", "media_asset_id", "thumbnailMediaAssetId",
    "thumbnail_media_asset_id", "topicId", "topicIds", "eventId", "eventIds", "shortBio", "bio",
    "introText", "description", "shortDescription", "teaserText", "longBio", "vita", "biography",
    "bodyText", "longDescription", "profileText", "website", "linkedIn", "updatedAt", "updated_at"
  ]),
  editorialContent: new Set([
    "id", "title", "headline", "subtitle", "introText", "shortDescription", "description",
    "teaserText", "longDescription", "bodyText", "articleText", "category", "section", "page", "status", "visibility", "sichtbarkeit",
    "publishDate", "validFrom", "date", "updatedAt", "updated_at", "imageUrl", "thumbnail_url",
    "thumbnailUrl", "assetUrl", "mediaAssetId", "media_asset_id", "thumbnailMediaAssetId",
    "thumbnail_media_asset_id", "linkedEventId", "galleryEventId", "galleryId", "sponsorId"
  ]),
  sponsors: new Set([
    "id", "name", "title", "status", "visibility", "logoUrl", "imageUrl", "assetUrl",
    "description", "shortDescription", "website", "updatedAt", "updated_at"
  ]),
  members: new Set([
    "id", "name", "title", "company", "status", "visibility", "sichtbarkeit", "visible", "isLive",
    "membershipType", "membershipLabel", "membershipAccessStatus", "membershipAccessEffectiveAt",
    "description", "shortDescription", "city", "country", "website", "logoUrl", "logoDisplayUrl",
    "imageUrl", "assetUrl", "thumbnailUrl", "sortOrder", "featured", "updatedAt", "updated_at"
  ]),
  downloads: new Set([
    "id", "title", "fileName", "description", "status", "visibility", "sichtbarkeit", "fileUrl",
    "file_url", "assetUrl", "asset_url", "downloadUrl", "downloadURL", "url", "documentUrl",
    "sortOrder", "category", "updatedAt", "updated_at"
  ]),
  galleries: new Set([
    "id", "title", "eventId", "status", "visibility", "images", "updatedAt", "updated_at"
  ]),
  eventMedia: new Set([
    "id", "title", "eventId", "status", "visibility", "fileUrl", "file_url", "assetUrl",
    "asset_url", "downloadUrl", "downloadURL", "url", "imageUrl", "thumbnailUrl", "updatedAt", "updated_at"
  ]),
  media_assets: new Set([
    "id", "title", "slug", "status", "visibility", "media_type", "usage_preset", "variant_key",
    "target_collection", "targetCollection", "target_id", "targetId", "target_field", "targetField",
    "linked_collection", "linkedCollection", "linked_record_id", "linkedRecordId", "linked_id",
    "linkedId", "linked_field", "linkedField", "file_path_web_url", "filePathWebUrl", "webUrl",
    "file_path_thumb_url", "filePathThumbUrl", "thumbUrl", "thumb_url", "file_path_original_url",
    "filePathOriginalUrl", "originalUrl", "downloadUrl", "downloadURL", "url", "thumbnail_url",
    "thumbnailUrl", "imageUrl", "assetUrl", "file_path_web_width", "web_width", "webWidth",
    "width", "file_path_web_height", "web_height", "webHeight", "height", "file_path_original_width",
    "original_width", "originalWidth", "image_width", "imageWidth", "file_path_original_height",
    "original_height", "originalHeight", "image_height", "imageHeight", "file_path_thumb_width",
    "thumb_width", "thumbWidth", "file_path_thumb_height", "thumb_height", "thumbHeight",
    "source_type", "updatedAt", "updated_at", "createdAt", "created_at"
  ])
};

function trimLongString(value, maxLength = 420) {
  if (typeof value !== "string") return value;
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

const longTextFields = new Set([
  "description",
  "introText",
  "shortBio",
  "bio",
  "shortDescription",
  "teaserText",
  "longBio",
  "vita",
  "biography",
  "longDescription",
  "bodyText",
  "articleText",
  "archiveText",
  "postEventSummary",
  "postEventummary",
  "profileText"
]);

function compactValue(key = "", value) {
  if (key === "images" && Array.isArray(value)) {
    return value.slice(0, 12).map((image = {}) => ({
      url: image.url || image.imageUrl || image.assetUrl || image.thumbnailUrl || "",
      imageUrl: image.imageUrl || "",
      thumbnailUrl: image.thumbnailUrl || "",
      sortOrder: image.sortOrder || 0
    }));
  }
  return trimLongString(value, longTextFields.has(key) ? 6000 : 420);
}

function cleanRecord(record = {}, collectionName = "") {
  const allowed = fieldAllowList[collectionName] || null;
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => {
    if (allowed && !allowed.has(key)) return false;
    if (typeof value === "string" && value.startsWith("data:image/")) return false;
    if (/token|password|secret|hash/i.test(key)) return false;
    return value !== undefined;
  }).map(([key, value]) => [key, compactValue(key, value)]));
}

function publicEvent(record = {}) {
  const status = String(record.status || record.state || "draft").toLowerCase();
  const visibility = String(record.visibility || record.sichtbarkeit || "public").toLowerCase();
  if (["inactive", "cancelled", "deleted", "hidden", "private", "draft"].includes(status) && record.visible !== true) return false;
  if (["internal", "private", "hidden"].includes(visibility)) return false;
  return Boolean(record.title || record.titel || record.name || record.headline || record.eventTitle);
}

function snapshotEvent(record = {}) {
  if (!publicEvent(record)) return false;
  const date = String(record.date || record.validFrom || "").slice(0, 10);
  const isCurrentWindow = date >= "2025-01-01";
  const registrationState = String(record.registrationStatus || record.registration_state || record.registrationState || "").toLowerCase();
  const registrationOpen = record.registrationEnabled === true
    || record.allowPublicRegistration === true
    || record.allowMemberRegistration === true
    || ["open", "offen", "active", "aktiv", "registration_open"].includes(registrationState);
  return isCurrentWindow || registrationOpen;
}

function publicTopic(record = {}) {
  const status = String(record.status || "active").toLowerCase();
  const visibility = String(record.visibility || record.sichtbarkeit || "public").toLowerCase();
  return !["inactive", "archived", "deleted", "hidden"].includes(status)
    && !["internal", "private", "hidden"].includes(visibility)
    && Boolean(record.title);
}

function publicEditorial(record = {}) {
  const status = String(record.status || "").toLowerCase();
  const visibility = String(record.visibility || record.sichtbarkeit || "public").toLowerCase();
  return ["published", "aktiv"].includes(status) && ["public", "oeffentlich", ""].includes(visibility);
}

function publicSpeaker(record = {}) {
  return String(record.status || "").toLowerCase() === "published";
}

function publicGeneric(record = {}) {
  const status = String(record.status || "published").toLowerCase();
  const visibility = String(record.visibility || record.sichtbarkeit || "public").toLowerCase();
  return !["inactive", "archived", "deleted", "hidden", "draft"].includes(status)
    && !["internal", "private", "hidden", "members"].includes(visibility);
}

function publicMember(record = {}) {
  const status = String(record.status || "active").toLowerCase();
  const visibility = String(record.visibility || record.sichtbarkeit || "public").toLowerCase();
  const accessStatus = String(record.membershipAccessStatus || "active").toLowerCase();
  const accessBlocked = ["inactive", "cancelled"].includes(accessStatus);
  return !["inactive", "cancelled", "archived", "deleted", "hidden", "draft"].includes(status)
    && !["internal", "private", "hidden"].includes(visibility)
    && record.visible !== false
    && record.isLive !== false
    && !accessBlocked
    && Boolean(record.name || record.title || record.company);
}

function publicDownload(record = {}) {
  return publicGeneric(record) && Boolean(record.title || record.fileName || record.fileUrl || record.downloadUrl || record.url || record.documentUrl);
}

function addQuery(snapshot, collectionName, records, predicates, filter = publicGeneric) {
  const selected = records.filter((record) => matches(record, predicates)).filter(filter).map((record) => cleanRecord(record, collectionName));
  snapshot[publicSessionCacheKey(cacheKey(collectionName, predicates))] = {
    createdAt: Date.now(),
    records: selected
  };
}

function addRecords(snapshot, collectionName, records, predicates) {
  snapshot[publicSessionCacheKey(cacheKey(collectionName, predicates))] = {
    createdAt: Date.now(),
    records: records.map((record) => cleanRecord(record, collectionName))
  };
}

function mediaAssetTargetCollection(asset = {}) {
  return String(asset.target_collection || asset.targetCollection || asset.linked_collection || asset.linkedCollection || "").trim();
}

function mediaAssetTargetId(asset = {}) {
  return String(asset.target_id || asset.targetId || asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId || "").trim();
}

function linkedEventMediaAsset(asset = {}, eventId = "") {
  if (!eventId || !publicGeneric(asset)) return false;
  return mediaAssetTargetCollection(asset) === "events" && mediaAssetTargetId(asset) === eventId;
}

function topicLinkedToEvent(topic = {}, event = {}) {
  return topic.eventId === event.id
    || topic.linkedEventId === event.id
    || (Array.isArray(topic.eventIds) && topic.eventIds.includes(event.id))
    || (Array.isArray(event.topicIds) && event.topicIds.includes(topic.id));
}

function speakerLinkedToEventTopic(speaker = {}, event = {}, eventTopics = []) {
  const eventTopicIds = new Set(eventTopics.map((topic) => topic.id).filter(Boolean));
  const eventSpeakerIds = new Set(event.speakerIds || []);
  if (eventSpeakerIds.has(speaker.id) || speaker.eventId === event.id || (Array.isArray(speaker.eventIds) && speaker.eventIds.includes(event.id))) return true;
  if (speaker.topicId && eventTopicIds.has(speaker.topicId)) return true;
  return Array.isArray(speaker.topicIds) && speaker.topicIds.some((topicId) => eventTopicIds.has(topicId));
}

function sponsorLinkedToEvent(sponsor = {}, event = {}) {
  return sponsor.id === event.hostId
    || sponsor.id === event.primaryHostId
    || (Array.isArray(event.sponsorIds) && event.sponsorIds.includes(sponsor.id));
}

function galleryLinkedToEvent(gallery = {}, event = {}) {
  return gallery.id === event.galleryId || gallery.eventId === event.id;
}

function buildEventDetailSnapshots({ events = [], topics = [], speakers = [], sponsors = [], galleries = [], mediaAssets = [] } = {}) {
  const visibleEvents = events.filter(snapshotEvent);
  return Object.fromEntries(visibleEvents.map((event) => {
    const eventTopics = topics.filter((topic) => publicTopic(topic) && topicLinkedToEvent(topic, event));
    const eventSpeakers = speakers.filter((speaker) => publicSpeaker(speaker) && speakerLinkedToEventTopic(speaker, event, eventTopics));
    const eventSponsors = sponsors.filter((sponsor) => publicGeneric(sponsor) && sponsorLinkedToEvent(sponsor, event));
    const eventGalleries = galleries.filter((gallery) => publicGeneric(gallery) && galleryLinkedToEvent(gallery, event));
    const eventMediaAssets = mediaAssets.filter((asset) => linkedEventMediaAsset(asset, event.id));
    return [event.id, {
      event: cleanRecord(event, "events"),
      topics: eventTopics.map((record) => cleanRecord(record, "topics")),
      speakers: eventSpeakers.map((record) => cleanRecord(record, "speakers")),
      sponsors: eventSponsors.map((record) => cleanRecord(record, "sponsors")),
      galleries: eventGalleries.map((record) => cleanRecord(record, "galleries")),
      mediaAssets: eventMediaAssets.map((record) => cleanRecord(record, "media_assets"))
    }];
  }));
}
function relevantPublicMediaAsset(asset = {}, publicIdsByCollection = {}) {
  if (!publicGeneric(asset)) return false;
  const preset = String(asset.usage_preset || asset.variant_key || "").toLowerCase();
  const allowedPreset = !preset || [
    "thumbnail", "thumb", "topic", "speaker", "person", "portrait", "profile", "logo", "event", "news", "news_mobile"
  ].includes(preset);
  if (!allowedPreset) return false;
  const collection = mediaAssetTargetCollection(asset);
  const targetId = mediaAssetTargetId(asset);
  if (!collection || !targetId) return false;
  return publicIdsByCollection[collection]?.has(targetId);
}

export async function buildPublicSnapshot() {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  const [events, topics, speakers, editorial, sponsors, members, downloads, mediaAssets, galleries] = await Promise.all([
    loadCollection(db, "events"),
    loadCollection(db, "topics"),
    loadCollection(db, "speakers"),
    loadCollection(db, "editorialContent"),
    loadCollection(db, "sponsors"),
    loadCollection(db, "members"),
    loadCollection(db, "downloads"),
    loadCollection(db, "media_assets"),
    loadCollection(db, "galleries")
  ]);
  const snapshot = {};
  [
    [["status", "==", "published"], ["visibility", "==", "public"]],
    [["status", "==", "active"], ["visibility", "==", "public"]],
    [["visible", "==", true]],
    [["registrationStatus", "==", "open"]],
    [["registration_state", "==", "open"]],
    [["registrationStatus", "==", "offen"]],
    [["registrationEnabled", "==", true]],
    [["accessType", "==", "members_only"], ["status", "==", "active"]],
    [["accessType", "==", "members_only"], ["status", "==", "published"]],
    [["accessType", "==", "members_only"], ["status", "==", "aktiv"]]
  ].forEach((predicates) => addQuery(snapshot, "events", events, predicates, snapshotEvent));
  [
    [["status", "==", "active"]],
    [["status", "==", "published"], ["visibility", "==", "public"]],
    [["status", "==", "aktiv"], ["sichtbarkeit", "==", "oeffentlich"]]
  ].forEach((predicates) => addQuery(snapshot, "topics", topics, predicates, publicTopic));
  addQuery(snapshot, "speakers", speakers, [["status", "==", "published"]], publicSpeaker);
  [
    [["status", "==", "published"], ["visibility", "==", "public"]],
    [["status", "==", "aktiv"], ["sichtbarkeit", "==", "oeffentlich"]]
  ].forEach((predicates) => addQuery(snapshot, "editorialContent", editorial, predicates, publicEditorial));
  addQuery(snapshot, "sponsors", sponsors, [["status", "==", "published"]], publicGeneric);
  addQuery(snapshot, "members", members, [["visible", "==", true]], publicMember);
  addRecords(snapshot, "downloads", downloads.filter(publicDownload), []);
  const publicIdsByCollection = {
    events: new Set(events.filter(snapshotEvent).map((record) => record.id).filter(Boolean)),
    topics: new Set(topics.filter(publicTopic).map((record) => record.id).filter(Boolean)),
    speakers: new Set(speakers.filter(publicSpeaker).map((record) => record.id).filter(Boolean)),
    editorialContent: new Set(editorial.filter(publicEditorial).map((record) => record.id).filter(Boolean)),
    sponsors: new Set(sponsors.filter(publicGeneric).map((record) => record.id).filter(Boolean)),
    members: new Set(members.filter(publicMember).map((record) => record.id).filter(Boolean)),
    downloads: new Set(downloads.filter(publicDownload).map((record) => record.id).filter(Boolean))
  };
  const relevantMediaAssets = mediaAssets.filter((asset) => relevantPublicMediaAsset(asset, publicIdsByCollection));
  addRecords(snapshot, "media_assets", relevantMediaAssets, [["status", "==", "active"], ["visibility", "==", "public"]]);
  const eventDetails = buildEventDetailSnapshots({ events, topics, speakers, sponsors, galleries, mediaAssets: relevantMediaAssets });
  return { version: snapshotVersion, generatedAt: new Date().toISOString(), caches: snapshot, eventDetails };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  buildPublicSnapshot()
    .then((snapshot) => {
      process.stdout.write(JSON.stringify(snapshot, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}



