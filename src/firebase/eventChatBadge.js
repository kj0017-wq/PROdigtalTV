import { getFirebaseServices } from "./firebaseClient.js?v=1";

let busy = false;
let queued = false;
async function synchronizeBadge() {
  if (!("setAppBadge" in navigator)) return;
  if (busy) { queued = true; return; }
  busy = true;
  try {
    const firebase = await getFirebaseServices();
    await firebase?.auth?.authStateReady?.();
    const user = firebase?.auth?.currentUser;
    if (!user?.emailVerified) { await navigator.clearAppBadge?.(); return; }
    if (document.visibilityState !== "visible") return;
    const { data } = await firebase.functionsLib.httpsCallable(firebase.functions, "getEventChatBadge", { timeout: 20000 })({});
    if (firebase.auth.currentUser?.uid !== user.uid) return;
    if (!Number.isSafeInteger(data.count) || data.count < 0) return;
    if (data.count) await navigator.setAppBadge(data.count);
    else await navigator.clearAppBadge?.();
  } catch {
    // Keep the last known count when offline or permission is unavailable.
  } finally {
    busy = false;
    if (queued) { queued = false; void synchronizeBadge(); }
  }
}
if ("setAppBadge" in navigator) {
  getFirebaseServices().then(firebase => {
    if (firebase) firebase.authLib.onAuthStateChanged(firebase.auth, synchronizeBadge);
  }).catch(() => {});
  setInterval(synchronizeBadge, 30000);
  document.addEventListener("visibilitychange", synchronizeBadge);
  window.addEventListener("online", synchronizeBadge);
  window.addEventListener("pdtv-personal-chat-changed", synchronizeBadge);
}
