import { firebaseConfig } from "./firebaseConfig.js";
import { getFirebaseServices } from "./firebaseClient.js";
import { getOne } from "./dataService.js?v=511";

const firebaseVersion = "10.12.5";
const defaultVapidPublicKey = "BJFCvqA9DrMYNrLRPtfWgQSFIvimbw5Q7ASlQGa0W8Typ-XhB2OERRaBNGm4DTp9RNj5vMkb59lueLDgSrDFNRA";
let cachedPushSettings = null;

async function browserPushSettings() {
  if (cachedPushSettings) return cachedPushSettings;
  const record = await getOne("settings", "browserPush").catch(() => null);
  const value = record?.value && typeof record.value === "object" ? record.value : {};
  cachedPushSettings = {
    vapidPublicKey: String(record?.vapidPublicKey || value.vapidPublicKey || defaultVapidPublicKey).trim()
  };
  return cachedPushSettings;
}

export async function createEventNotification(input = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Benachrichtigung kann nicht erstellt werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "createEventNotification");
  return (await callable({ input })).data;
}

export async function previewEventNotification(input = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Versand kann nicht vorbereitet werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "previewEventNotification");
  return (await callable({ input })).data;
}

export async function getNotificationPushStatus(emails = []) {
  const firebase = await getFirebaseServices();
  if (!firebase) return { activeEmails: [] };
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getNotificationPushStatus");
  return (await callable({ emails })).data;
}

export async function unsubscribeEventNotifications(hash = "") {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Abmeldung kann nicht gespeichert werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "unsubscribeEventNotifications");
  return (await callable({ hash })).data;
}

export async function enableBrowserNotifications({ email = "", eventId = "", source = "event_registration" } = {}) {
  if (!("Notification" in window)) return { status: "unsupported" };
  if (!("serviceWorker" in navigator)) return { status: "unsupported" };
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") return { status: permission || "denied" };
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Push-Token kann nicht gespeichert werden.");
  const messagingLib = await import(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-messaging.js`);
  const registration = await navigator.serviceWorker.getRegistration("/") || await navigator.serviceWorker.register("/sw.js");
  const messaging = messagingLib.getMessaging(firebase.app);
  const settings = await browserPushSettings();
  if (!settings.vapidPublicKey) return { status: "missing-vapid-key" };
  const tokenOptions = { serviceWorkerRegistration: registration, vapidKey: settings.vapidPublicKey };
  const token = await messagingLib.getToken(messaging, tokenOptions);
  if (!token) return { status: "no-token" };
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "registerNotificationToken");
  return (await callable({
    token,
    email,
    eventId,
    source,
    permission,
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || ""
  })).data;
}
