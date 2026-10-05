import { cachedParticipantPhoto } from "../utils/participantPhotoCache.js?v=1";
import { getFirebaseServices } from "./firebaseClient.js?v=2";

async function call(name, data) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  return (await firebase.functionsLib.httpsCallable(firebase.functions, name)(data)).data;
}

export async function uploadPortalGalleryPhotos(files, note = "", onProgress = () => {}, eventId = "") {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase Storage ist nicht erreichbar.");
  const results = [];
  const totalFiles = files.length;
  const report = (stage, index, file, fileProgress = 0, completedShare = 0) => onProgress({
    stage,
    fileIndex: index,
    totalFiles,
    fileName: file?.name || "",
    fileProgress: Math.round(fileProgress),
    overallProgress: Math.round(((index + completedShare) / Math.max(1, totalFiles)) * 100)
  });
  for (const [index, file] of files.entries()) {
    report("preparing", index, file, 0, 0);
    const intent = await call("beginPortalGalleryPhotoUpload", {
      eventId, fileName: file.name, fileType: file.type, fileSize: file.size
    });
    const reference = firebase.storageLib.ref(firebase.storage, intent.storagePath);
    report("uploading", index, file, 0, .08);
    if (typeof firebase.storageLib.uploadBytesResumable === "function") {
      await new Promise((resolve, reject) => {
        const task = firebase.storageLib.uploadBytesResumable(reference, file, { contentType: file.type });
        task.on("state_changed", (snapshot) => {
          const percent = snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes * 100 : 0;
          report("uploading", index, file, percent, .08 + (.72 * percent / 100));
        }, reject, resolve);
      });
    } else {
      await firebase.storageLib.uploadBytes(reference, file, { contentType: file.type });
      report("uploading", index, file, 100, .8);
    }
    report("processing", index, file, 100, .88);
    results.push(await call("finishPortalGalleryPhotoUpload", {
      mediaId: intent.mediaId, note
    }));
    report("processing", index, file, 100, 1);
  }
  return results;
}


export const listPortalParticipantPhotos = (eventId = "") => call("listPortalParticipantPhotos", { eventId });
export const markPortalParticipantPhotosSeen = (eventId, photoIds) => call("markPortalParticipantPhotosSeen", { eventId, photoIds });

export async function loadPortalParticipantPhoto(mediaId) {
  const firebase = await getFirebaseServices();
  const user = firebase?.auth?.currentUser;
  if (!user) throw new Error("Bitte anmelden.");
  const blob = await cachedParticipantPhoto(user.uid, mediaId, async () => {
  const token = await user.getIdToken();
  const projectId = firebase.app.options.projectId;
  const endpoint = "https://europe-west3-" + projectId + ".cloudfunctions.net/getPortalParticipantPhoto";
  const response = await fetch(endpoint + "?mediaId=" + encodeURIComponent(mediaId), {
    headers: { Authorization: "Bearer " + token }, cache: "no-store"
  });
  if (!response.ok) throw new Error(await response.text() || "Foto konnte nicht geladen werden.");
  return response.blob();
  });
  if (firebase.auth.currentUser?.uid !== user.uid) throw new Error("Benutzerkonto wurde gewechselt.");
  return URL.createObjectURL(blob);
}
