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

function imageAsOptimizedDataUrl(file, maxSize = 960, quality = 0.72) {
  if (!file?.type?.startsWith("image/") || file.type === "image/svg+xml") return fileAsDataUrl(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.addEventListener("load", () => {
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || maxSize, image.naturalHeight || maxSize));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((image.naturalWidth || maxSize) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || maxSize) * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      let dataUrl = canvas.toDataURL("image/webp", quality);
      if (dataUrl.length > 850000 && maxSize > 640) {
        imageAsOptimizedDataUrl(file, 640, 0.65).then(resolve).catch(reject);
        return;
      }
      resolve(dataUrl);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      fileAsDataUrl(file).then(resolve).catch(reject);
    });
    image.src = objectUrl;
  });
}

function slugifyStoragePart(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "event";
}

function safeFileName(value = "") {
  const fallback = `datei-${Date.now()}`;
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function mediaTypeFromFile(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.includes("pdf") || type.includes("presentation") || type.includes("document")) return "document";
  return "file";
}

export async function uploadEventMedia(eventId = "", files, metadata = {}, onProgress = () => {}) {
  const firebase = await getFirebaseServices();
  const results = [];
  const targetId = metadata.galleryId || eventId || "member-upload-gallery";
  const targetSlug = slugifyStoragePart(metadata.gallerySlug || metadata.galleryTitle || metadata.eventSlug || metadata.eventTitle || targetId);
  const rootFolder = metadata.galleryId && !eventId ? "images/galleries" : "images/events";
  const folder = slugifyStoragePart(metadata.folder || "uploads");
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const id = `event-media-${crypto.randomUUID()}`;
    const fileType = file.type || "application/octet-stream";
    const mediaType = mediaTypeFromFile(file);
    let fileUrl = "";
    let storagePath = `${rootFolder}/${targetSlug}/${folder}/${Date.now()}-${id}-${safeFileName(file.name)}`;
    if (firebase) {
      const reference = firebase.storageLib.ref(firebase.storage, storagePath);
      await firebase.storageLib.uploadBytes(reference, file, { contentType: fileType });
      fileUrl = await firebase.storageLib.getDownloadURL(reference);
    } else {
      fileUrl = URL.createObjectURL(file);
    }
    const record = await upsert("eventMedia", {
      id,
      uploadId: id,
      eventId: eventId || metadata.eventId || "",
      requestedEventId: metadata.requestedEventId || metadata.targetEventId || "",
      galleryId: metadata.galleryId || "",
      galleryTitle: metadata.galleryTitle || "",
      fileName: file.name,
      fileUrl,
      thumbUrl: mediaType === "image" ? fileUrl : (metadata.thumbUrl || ""),
      storagePath,
      fileType,
      mediaType,
      title: metadata.title || metadata.caption || file.name,
      caption: metadata.caption || metadata.description || "",
      note: metadata.note || "",
      description: metadata.description || metadata.caption || "",
      altText: metadata.altText || file.name,
      visibility: "internal",
      status: metadata.status || "new",
      sortOrder: index + 1,
      isCoverImage: false,
      rightsConfirmed: Boolean(metadata.rightsConfirmed),
      source: metadata.source || "event-upload",
      uploadedBy: metadata.uploadedBy || "",
      uploadedByName: metadata.uploadedByName || "",
      uploadedByEmail: metadata.uploadedByEmail || "",
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    results.push(record);
    onProgress(Math.round(((index + 1) / files.length) * 100));
  }
  return results;
}

export async function uploadEntityImage(collection, entityId, file) {
  const supported = { events: "events", topics: "topics", members: "members", boardMembers: "board", speakers: "speakers", sponsors: "sponsors", editorialContent: "editorial", memberDocuments: "member-documents", memberDirectories: "member-directories" };
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

export async function uploadMediaAsset(file, storagePath) {
  if (!file || !storagePath) return null;
  const firebase = await getFirebaseServices();
  if (!firebase) return { url: await imageAsOptimizedDataUrl(file), storagePath: "", fallback: true };
  const safePath = String(storagePath || "").replace(/^\/+/, "");
  if (!safePath.startsWith("images/")) throw new Error("Medien muessen unter images gespeichert werden.");
  try {
    const reference = firebase.storageLib.ref(firebase.storage, safePath);
    await firebase.storageLib.uploadBytes(reference, file, { contentType: file.type });
    return { url: await firebase.storageLib.getDownloadURL(reference), storagePath: safePath };
  } catch (error) {
    return {
      url: await imageAsOptimizedDataUrl(file),
      storagePath: "",
      fallback: true,
      error: error?.message || String(error)
    };
  }
}

export async function deleteStoredAsset(entity) {
  const paths = [
    entity?.storagePath,
    entity?.assetStoragePath,
    entity?.storage_path_original,
    entity?.storage_path_web,
    entity?.storage_path_thumb,
    entity?.file_path_original,
    entity?.file_path_web,
    entity?.file_path_thumb
  ].filter(Boolean);
  if (!paths.length) return;
  const firebase = await getFirebaseServices();
  if (!firebase) return;
  for (const path of [...new Set(paths)]) {
    try {
      await firebase.storageLib.deleteObject(firebase.storageLib.ref(firebase.storage, path));
    } catch (error) {
      const code = String(error?.code || error?.message || "");
      if (!["storage/object-not-found", "storage/unauthorized", "permission-denied", "unauthorized"].some((item) => code.includes(item))) throw error;
      console.warn("Stored asset could not be deleted:", path, error);
    }
  }
}
