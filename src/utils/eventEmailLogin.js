import { getFirebaseServices } from "../firebase/firebaseClient.js?v=2";
import { refreshAuthToken } from "../firebase/authService.js?v=477";

export function eventLoginEmail() {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  try { return params.get("email") || localStorage.getItem("pdtv-event-login-email") || ""; } catch { return params.get("email") || ""; }
}

export async function completeEventEmailLogin(email) {
  const firebase = await getFirebaseServices();
  if (!firebase?.authLib.isSignInWithEmailLink(firebase.auth, location.href)) return false;
  await firebase.authLib.setPersistence(firebase.auth, firebase.authLib.browserLocalPersistence);
  await firebase.authLib.signInWithEmailLink(firebase.auth, email, location.href);
  await refreshAuthToken(true);
  try { localStorage.setItem("pdtv-event-login-email", email); } catch {}
  const [path, query = ""] = location.hash.split("?");
  const params = new URLSearchParams(query);
  params.delete("email");
  history.replaceState(null, "", `${location.pathname}${path}${params.size ? `?${params}` : ""}`);
  return true;
}
