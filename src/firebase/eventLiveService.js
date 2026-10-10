import { getFirebaseServices } from "./firebaseClient.js?v=1";
let testContext = { eventId: "", contactId: "", allOnline: false };
export function setEventLiveTestContext(eventId, contactId = "", allOnline = false) {
  const previous = testContext;
  testContext = { eventId, contactId, allOnline };
  return previous;
}

async function call(name, data = {}) {
  if (name === "getEventLiveData" && testContext.eventId && data.eventId !== testContext.eventId) setEventLiveTestContext("");
  const context = testContext;
  const testing = data.eventId === context.eventId && context.contactId;
  const testCalls = ["getEventLiveData", "getEventLiveMessages", "sendEventLiveMessage", "markEventLiveMessagesRead", "deleteEventLiveMessage"];
  if (testing && !testCalls.includes(name)) throw new Error("Bitte für diese Aktion den Personen-Testmodus beenden.");
  if (testing) data = { ...data, adminTestContactId: context.contactId };
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, name, { timeout: 45000 });
  const result = (await callable(data)).data;
  if (!testing && ["markEventLiveMessagesRead", "deleteEventLiveMessage", "clearEventLiveMessages"].includes(name)) {
    window.dispatchEvent(new Event("pdtv-personal-chat-changed"));
  }
  if (context !== testContext) throw new Error("Testperson wurde gewechselt. Ansicht wird aktualisiert.");
  if (name === "getEventLiveData" && data.eventId === context.eventId && context.allOnline && result.canResetContactRequests) {
    result.adminTestAllOnline = true;
    result.participants = result.participants.map(person => ({ ...person, online: true, testOnline: true }));
    result.profile = { ...result.profile, online: true, testOnline: true };
  }
  return result;
}

export const checkEventGuestLoginEmail = (eventId, email) => call("checkEventGuestLoginEmail", { eventId, email });
export const validateEventLiveInvitation = (eventId, email) => call("validateEventLiveInvitation", { eventId, email });
export const setEventLiveSettings = (eventId, enabled) => call("setEventLiveSettings", { eventId, enabled });
export const listEventLiveEvents = () => call("listEventLiveEvents");
export const getEventLiveData = (eventId) => call("getEventLiveData", { eventId });
export const updateEventLiveProfile = (eventId, profile) => call("updateEventLiveProfile", { eventId, profile });
export const adminUpdateEventLiveProfile = (eventId, targetContactId, profile) => call("adminUpdateEventLiveProfile", { eventId, targetContactId, profile });
export const requestEventLiveContact = (eventId, receiverContactId) => call("requestEventLiveContact", { eventId, receiverContactId });
export const respondEventLiveContact = (eventId, requestId, decision) => call("respondEventLiveContact", { eventId, requestId, decision });
export const resetEventLiveContactRequests = (eventId) => call("resetEventLiveContactRequests", { eventId, confirmed: true });
export const clearEventLiveMessages = (eventId) => call("clearEventLiveMessages", { eventId, confirmed: true });
export const getEventLiveMessages = (eventId, peerId, beforeId = "") => call("getEventLiveMessages", { eventId, peerId, beforeId });
export const sendEventLiveMessage = (eventId, peerId, text, messageId) => call("sendEventLiveMessage", { eventId, peerId, text, messageId });
export const markEventLiveMessagesRead = (eventId, peerId, messageId) => call("markEventLiveMessagesRead", { eventId, peerId, messageId });
export const deleteEventLiveMessage = (eventId, peerId, messageId) => call("deleteEventLiveMessage", { eventId, peerId, messageId });

async function compressedProfileImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const edge = 640;
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Bild konnte nicht komprimiert werden.")), "image/jpeg", 0.82));
  if (blob.size > 3 * 1024 * 1024) throw new Error("Das Profilbild ist auch nach der Komprimierung zu groß.");
  return blob;
}

export async function uploadEventLiveProfileImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Bitte eine Bilddatei auswählen.");
  const firebase = await getFirebaseServices();
  const user = firebase?.auth?.currentUser;
  if (!user) throw new Error("Bitte zuerst anmelden.");
  const image = await compressedProfileImage(file);
  const storagePath = `event-live-profiles/${user.uid}/profile-${Date.now()}.jpg`;
  const reference = firebase.storageLib.ref(firebase.storage, storagePath);
  await firebase.storageLib.uploadBytes(reference, image, { contentType: "image/jpeg" });
  return { storagePath };
}

export async function deleteEventLiveProfileImage(storagePath) {
  if (!storagePath) return;
  const firebase = await getFirebaseServices();
  if (!firebase) return;
  await firebase.storageLib.deleteObject(firebase.storageLib.ref(firebase.storage, storagePath));
}
