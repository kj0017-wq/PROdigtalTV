import { getFirebaseServices } from "./firebaseClient.js";
import { readStoredTicket } from "./registrationService.js?v=17";

const deviceKey = "pdtv-push-device-v1";
const fallbackVapidKey = "BJFCvqA9DrMYNrLRPtfWgQSFIvimbw5Q7ASlQGa0W8Typ-XhB2OERRaBNGm4DTp9RNj5vMkb59lueLDgSrDFNRA";
let runtimePromise;
let unsubscribeMessage;
let busy = false;
let lastRefresh = 0;

async function withTimeout(promise, message, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]);
  } finally { clearTimeout(timer); }
}
async function activeWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  const worker = registration.installing || registration.waiting;
  if (worker && worker.state !== "activated") {
    await withTimeout(new Promise((resolve, reject) => {
      const check = () => {
        if (worker.state === "activated" || worker.state === "redundant") {
          worker.removeEventListener("statechange", check);
          worker.state === "activated" ? resolve() : reject(new Error("Push-Dienst konnte nicht starten."));
        }
      };
      worker.addEventListener("statechange", check);
      check();
    }), "Push-Dienst startet noch. Bitte erneut versuchen.");
  }
  return withTimeout(navigator.serviceWorker.ready, "Push-Dienst ist noch nicht bereit.");
}

function storedDevice() {
  try { return JSON.parse(localStorage.getItem(deviceKey) || "null"); } catch { return null; }
}
function saveDevice(value) {
  localStorage.setItem(deviceKey, JSON.stringify(value));
}
function supportState() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !(navigator.standalone || matchMedia("(display-mode: standalone)").matches)) return "install";
  if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission === "denied" ? "blocked" : "available";
}
function proofFor(eventId) {
  let proof;
  try { proof = JSON.parse(localStorage.getItem(`pdtv-push-proof:${eventId}`) || "null"); } catch {}
  if (proof?.token && proof.expiresAt > Date.now()) return { registrationProof: proof.token, eventId };
  const ticket = eventId ? readStoredTicket(eventId) : null;
  return ticket?.ticketToken ? { ticketToken: ticket.ticketToken, eventId } : { eventId };
}
async function runtime() {
  if (!runtimePromise) runtimePromise = (async () => {
    const firebase = await getFirebaseServices();
    if (!firebase) throw new Error("Firebase ist nicht erreichbar. Bitte erneut versuchen.");
    await firebase.auth?.authStateReady?.();
    const lib = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");
    if (!(await lib.isSupported())) throw new Error("Browser-Push wird hier nicht unterstuetzt.");
    const registration = await activeWorker();
    const messaging = lib.getMessaging(firebase.app);
    await import("/assets/js/push-display.js?v=2");
    if (!unsubscribeMessage) unsubscribeMessage = lib.onMessage(messaging, (payload) => {
      if (Notification.permission === "granted" && storedDevice()?.status === "active") {
        window.PROdigitalTVPush.show(registration, payload).catch(() => updateControls("Benachrichtigung konnte nicht angezeigt werden."));
      }
    });
    return { firebase, lib, registration, messaging };
  })().catch((error) => { runtimePromise = null; throw error; });
  return runtimePromise;
}
async function call(name, data) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  return (await firebase.functionsLib.httpsCallable(firebase.functions, name, { timeout: 15000 })(data)).data;
}
function deviceSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function enableBrowserNotifications({ eventId = "", requestPermission = true } = {}) {
  const support = supportState();
  if (support !== "available") throw new Error(support === "install" ? "Auf dem iPhone die Website zum Home-Bildschirm hinzufuegen und von dort oeffnen." : support === "blocked" ? "Push ist in den Browser-/Systemeinstellungen blockiert. Bitte dort erlauben." : "Browser-Push ist auf diesem Geraet nicht verfuegbar.");
  // No network or dynamic import may precede this user-gesture permission request.
  const permission = Notification.permission === "granted" ? "granted" : requestPermission ? await Notification.requestPermission() : "default";
  if (permission !== "granted") throw new Error("Push wurde nicht erlaubt. Die E-Mail-Benachrichtigungen bleiben unveraendert.");
  const { firebase, lib, registration, messaging } = await runtime();
  if (firebase.auth?.currentUser) {
    await firebase.auth.currentUser.reload();
    await firebase.auth.currentUser.getIdToken(true);
  }
  const settings = await firebase.firestore.getDoc(firebase.firestore.doc(firebase.db, "settings", "browserPush"));
  const config = settings.data() || {};
  const vapidKey = config.vapidPublicKey || config.value?.vapidPublicKey || fallbackVapidKey;
  const old = storedDevice();
  if (old?.status === "inactive") await lib.deleteToken(messaging);
  const token = await withTimeout(lib.getToken(messaging, { serviceWorkerRegistration: registration, vapidKey }), "Push-Aktivierung dauert zu lange. Bitte erneut versuchen.", 20000);
  if (!token) throw new Error("Kein Geraete-Token erhalten. Bitte erneut versuchen.");
  const identity = proofFor(eventId || old?.eventId || "");
  const secret = old?.deviceSecret || deviceSecret();
  const device = { token, deviceSecret: secret, eventId: identity.eventId, status: "pending" };
  saveDevice(device);
  try {
    const result = await call("registerNotificationToken", { token, deviceSecret: secret, ...identity, permission,
      userAgent: navigator.userAgent, platform: navigator.platform, origin: location.origin });
    saveDevice({ ...device, status: "active", email: result.email, uid: firebase.auth?.currentUser?.uid || "", updatedAt: Date.now() });
    if (old?.token && old.token !== token) await call("disableBrowserPush", old).catch(() => {});
    return result;
  } catch (error) {
    if (old) saveDevice(old);
    else saveDevice(device);
    throw error;
  }
}

export async function disableBrowserNotifications() {
  const device = storedDevice();
  let serverError;
  if (device?.token) {
    try { await call("disableBrowserPush", device); } catch (error) { serverError = error; }
  }
  if (supportState() === "available") {
    const { lib, messaging } = await runtime();
    await lib.deleteToken(messaging);
  } else if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) await subscription.unsubscribe();
  }
  if (device) saveDevice({ ...device, status: "inactive", pendingDisable: Boolean(serverError) });
  if (serverError) throw new Error("Push wurde auf diesem Geraet abgeschaltet. Die Server-Abmeldung wird bei der naechsten Verbindung nachgeholt.");
}

function errorMessage(error) {
  if (/unauthenticated|permission-denied/.test(error?.code || "")) return "Bitte den Bestaetigungslink aus der Event-Mail auf diesem Geraet oeffnen und dort Push aktivieren.";
  return error?.message || "Push konnte nicht aktiviert werden. Bitte erneut versuchen.";
}
function updateControls(message = "") {
  const support = supportState();
  const device = storedDevice();
  const permissionGranted = "Notification" in window && Notification.permission === "granted";
  const active = device?.status === "active" && support === "available" && permissionGranted;
  const pending = device?.status === "pending" && support === "available" && permissionGranted;
  const permittedButUnlinked = !device?.token && support === "available" && permissionGranted;
  const defaultText = support === "install"
    ? "Auf dem iPhone: Zum Home-Bildschirm hinzufuegen und die WebApp dort oeffnen."
    : support === "blocked"
      ? "Push ist blockiert. Freigabe in den Browser-/Systemeinstellungen aendern."
      : support === "unsupported"
        ? "Browser-Push wird auf diesem Geraet nicht unterstuetzt."
        : active
          ? "Push ist auf diesem Geraet aktiviert."
          : pending || permittedButUnlinked
            ? "Push ist im Browser erlaubt, aber noch nicht mit einer Event-Anmeldung verknuepft. Bitte den Bestaetigungslink auf diesem Geraet oeffnen."
            : "Push ist auf diesem Geraet nicht aktiviert.";
  const text = message || defaultText;
  document.querySelectorAll("[data-push-controls]").forEach((box) => {
    box.querySelector("[data-push-status]").textContent = text;
    const enable = box.querySelector("[data-push-enable]");
    const disable = box.querySelector("[data-push-disable]");
    enable.hidden = active;
    enable.disabled = busy || support !== "available";
    enable.textContent = pending || permittedButUnlinked ? "Push verknuepfen" : "Push aktivieren";
    disable.hidden = !active;
    disable.disabled = busy;
  });
}

async function activateBrowserPushForBox(box, { requestPermission = true, auto = false } = {}) {
  if (busy) return;
  if (auto && (!box.dataset.pushAuto || !("Notification" in window) || Notification.permission !== "granted")) return;
  busy = true;
  updateControls(auto ? "Push wird automatisch verknuepft ..." : "Push wird aktiviert ...");
  try {
    await enableBrowserNotifications({ eventId: box.dataset.eventId || "", requestPermission });
    busy = false;
    updateControls();
  } catch (error) {
    busy = false;
    updateControls(errorMessage(error));
  }
}

export function wirePushControls() {
  document.querySelectorAll("[data-push-controls]").forEach((box) => {
    if (box.dataset.wired) return;
    box.dataset.wired = "1";
    box.querySelector("[data-push-enable]")?.addEventListener("click", () => {
      activateBrowserPushForBox(box);
    });
    box.querySelector("[data-push-disable]")?.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      updateControls("Push wird deaktiviert ...");
      try { await disableBrowserNotifications(); busy = false; updateControls(); }
      catch (error) { busy = false; updateControls(errorMessage(error)); }
    });
    activateBrowserPushForBox(box, { requestPermission: false, auto: true });
  });
  updateControls();
}

export async function refreshBrowserPush() {
  if (busy || Date.now() - lastRefresh < 60000) return;
  lastRefresh = Date.now();
  const device = storedDevice();
  if (!device?.token) return;
  busy = true;
  let message = "";
  try {
    if (device.pendingDisable) { await disableBrowserNotifications(); return; }
    if (device.status !== "active") return;
    if (supportState() !== "available" || Notification.permission !== "granted") { await disableBrowserNotifications(); return; }
    const { firebase } = await runtime();
    if (device.uid && device.uid !== firebase.auth?.currentUser?.uid) { await disableBrowserNotifications(); return; }
    const state = await call("getBrowserPushDeviceStatus", device);
    if (state.status !== "active") { saveDevice({ ...device, status: "inactive" }); return; }
    await enableBrowserNotifications({ eventId: device.eventId, requestPermission: false });
  } catch (error) {
    message = `Push-Status konnte nicht bestaetigt werden. ${errorMessage(error)}`;
  } finally { busy = false; updateControls(message); }
}

window.addEventListener("online", () => { lastRefresh = 0; refreshBrowserPush(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshBrowserPush(); });



