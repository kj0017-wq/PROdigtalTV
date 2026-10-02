import { getFirebaseServices, localPreviewMode } from "../../firebase/firebaseClient.js";
import { refreshAuthToken, waitForAuthReady } from "../../firebase/authService.js?v=477";

export async function publishLinkedInPost(input = {}) {
  if (localPreviewMode()) {
    throw new Error("LinkedIn-Veroeffentlichung laeuft nur ueber Firebase Functions.");
  }
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist fuer die LinkedIn-Anbindung nicht erreichbar.");
  await waitForAuthReady();
  const user = await refreshAuthToken(true);
  if (!user?.uid) throw new Error("Bitte im CMS einloggen, bevor der LinkedIn-Post veroeffentlicht wird.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "publishLinkedInPost", { timeout: 120000 });
  const result = await callable(input);
  return result.data;
}
