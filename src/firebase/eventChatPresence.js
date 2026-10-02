import { getFirebaseServices } from "./firebaseClient.js";

// One heartbeat per tab; a missed disconnect expires on the server.
const sessionId = crypto.randomUUID();
let busy = false;
async function heartbeat(event) {
  if (location.pathname.endsWith("/cms.html")) return;
  if (busy) return;
  busy = true;
  try {
    const firebase = await getFirebaseServices();
    await firebase?.auth?.authStateReady?.();
    const user = firebase?.auth?.currentUser;
    if (!user?.emailVerified) return;
    await firebase.functionsLib.httpsCallable(firebase.functions, "updateEventChatPresence", { timeout: 10000 })({
      sessionId, visible: event?.type !== "pagehide" && document.visibilityState === "visible"
    });
  } catch {
    // A network failure must never keep someone permanently online.
  } finally { busy = false; }
}
setInterval(heartbeat, 30000);
document.addEventListener("visibilitychange", heartbeat);
window.addEventListener("online", heartbeat);
window.addEventListener("pagehide", heartbeat);
heartbeat();
