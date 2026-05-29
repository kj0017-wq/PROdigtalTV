import { getFirebaseServices } from "./firebaseClient.js";
import { upsert } from "./dataService.js";

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export async function uploadEventMedia(eventId, files, metadata = {}, onProgress = () => {}) {
  const firebase = await getFirebaseServices();
  const results = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const id = `event-media-${crypto.randomUUID()}`;
    let fileUrl = "";
    let storagePath = `events/${eventId}/${id}/${file.name}`;
    if (firebase) {
      const reference = firebase.storageLib.ref(firebase.storage, storagePath);
      await firebase.storageLib.uploadBytes(reference, file, { contentType: file.type });
      fileUrl = await firebase.storageLib.getDownloadURL(reference);
    } else {
      fileUrl = URL.createObjectURL(file);
    }
    const record = await upsert("eventMedia", {
      id, eventId, fileName: file.name, fileUrl, storagePath,
      mediaType: file.type.startsWith("image/") ? "image" : "document",
      title: metadata.title || file.name,
      description: metadata.description || "",
      altText: metadata.altText || file.name,
      visibility: "internal",
      status: "in_review",
      sortOrder: index + 1,
      isCoverImage: false,
      uploadedAt: new Date().toISOString()
    });
    results.push(record);
    onProgress(Math.round(((index + 1) / files.length) * 100));
  }
  return results;
}

export async function uploadEntityImage(collection, entityId, file) {
  const supported = { events: "events", topics: "topics", members: "members", boardMembers: "board", speakers: "speakers", sponsors: "sponsors", editorialContent: "editorial" };
  if (!supported[collection] || !file) return null;
  const firebase = await getFirebaseServices();
  if (!firebase) return { url: await fileAsDataUrl(file), storagePath: "" };
  const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const storagePath = collection === "events" ? `events/${entityId}/cover/${uniqueName}` : `${supported[collection]}/${entityId}/${uniqueName}`;
  const reference = firebase.storageLib.ref(firebase.storage, storagePath);
  await firebase.storageLib.uploadBytes(reference, file, { contentType: file.type });
  return { url: await firebase.storageLib.getDownloadURL(reference), storagePath };
}

export async function uploadGalleryImages(galleryId, files, onProgress = () => {}) {
  const firebase = await getFirebaseServices();
  const results = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const storagePath = `galleries/${galleryId}/${uniqueName}`;
    let url = "";
    if (firebase) {
      const reference = firebase.storageLib.ref(firebase.storage, storagePath);
      await firebase.storageLib.uploadBytes(reference, file, { contentType: file.type });
      url = await firebase.storageLib.getDownloadURL(reference);
    } else {
      url = await fileAsDataUrl(file);
    }
    results.push({
      id: `gallery-image-${crypto.randomUUID()}`,
      fileName: file.name,
      url,
      storagePath: firebase ? storagePath : "",
      contentType: file.type,
      altText: file.name,
      caption: "",
      sortOrder: index + 1,
      uploadedAt: new Date().toISOString()
    });
    onProgress(Math.round(((index + 1) / files.length) * 100));
  }
  return results;
}

export async function deleteStoredAsset(entity) {
  if (!entity?.storagePath && !entity?.assetStoragePath) return;
  const firebase = await getFirebaseServices();
  if (!firebase) return;
  const path = entity.storagePath || entity.assetStoragePath;
  try {
    await firebase.storageLib.deleteObject(firebase.storageLib.ref(firebase.storage, path));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") throw error;
    console.warn("Stored asset could not be deleted:", path, error);
  }
}
