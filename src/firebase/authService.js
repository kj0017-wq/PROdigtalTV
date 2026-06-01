import { getFirebaseServices, localPreviewMode } from "./firebaseClient.js";

const USER_KEY = "prodigitaltv-user";
let authReadyPromise;

export function currentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

async function userFromCredential(firebase, firebaseUser, fallbackRole = "guest") {
  const tokenResult = await firebaseUser.getIdTokenResult(true);
  const profileRef = firebase.firestore.doc(firebase.db, "users", firebaseUser.uid);
  const profile = await firebase.firestore.getDoc(profileRef);
  const profileData = profile.exists() ? profile.data() : {};
  const role = profileData.role || tokenResult.claims.role || "guest";
  const user = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: profileData.displayName || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Benutzer",
    photoURL: firebaseUser.photoURL || "",
    role,
    status: profileData.status || "active",
    providerId: firebaseUser.providerData?.[0]?.providerId || "password",
    idToken: tokenResult.token,
    tokenExpiresAt: tokenResult.expirationTime,
    tokenIssuedAt: tokenResult.issuedAtTime
  };
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function login(email, password, demoRole = "member") {
  if (localPreviewMode() && password === "demo") {
    const role = demoRole || "admin";
    const user = { uid: `demo-${role}`, email, displayName: email.split("@")[0] || "Demo", role, status: "active", idToken: "demo-token", tokenExpiresAt: "Lokale Vorschau" };
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }
  const firebase = await getFirebaseServices();
  if (!firebase) {
    const user = { uid: `demo-${demoRole}`, email, displayName: email.split("@")[0], role: demoRole, idToken: "demo-token", tokenExpiresAt: "" };
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }
  const credential = await firebase.authLib.signInWithEmailAndPassword(firebase.auth, email, password);
  return userFromCredential(firebase, credential.user, demoRole);
}

export async function loginWithGoogle(demoRole = "member") {
  if (localPreviewMode()) {
    const role = demoRole || "admin";
    const user = { uid: `demo-google-${role}`, email: "google-demo@prodigitaltv.de", displayName: "Google Demo", role, status: "active", providerId: "google.com", idToken: "demo-token", tokenExpiresAt: "Lokale Vorschau" };
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }
  const firebase = await getFirebaseServices();
  if (!firebase) {
    const user = { uid: `demo-google-${demoRole}`, email: "google-demo@prodigitaltv.de", displayName: "Google Demo", role: demoRole, providerId: "google.com", idToken: "demo-token", tokenExpiresAt: "" };
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }
  const provider = new firebase.authLib.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await firebase.authLib.signInWithPopup(firebase.auth, provider);
  return userFromCredential(firebase, credential.user, demoRole);
}

export async function refreshAuthToken(force = false) {
  const firebase = await getFirebaseServices();
  if (!firebase || !firebase.auth.currentUser) return currentUser();
  return userFromCredential(firebase, firebase.auth.currentUser, currentUser()?.role || "guest");
}

export async function waitForAuthReady() {
  const firebase = await getFirebaseServices();
  if (!firebase) return currentUser();
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      firebase.authLib.onAuthStateChanged(firebase.auth, async (firebaseUser) => {
        if (!firebaseUser) {
          sessionStorage.removeItem(USER_KEY);
          resolve(null);
          return;
        }
        resolve(await userFromCredential(firebase, firebaseUser, currentUser()?.role || "guest"));
      });
    });
  }
  return authReadyPromise;
}

export async function logout() {
  const firebase = await getFirebaseServices();
  if (firebase) await firebase.authLib.signOut(firebase.auth);
  sessionStorage.removeItem(USER_KEY);
}

export function canUseCms(user = currentUser()) {
  return ["admin", "editor"].includes(user?.role);
}

export function isAdmin(user = currentUser()) {
  return user?.role === "admin";
}

export function isMember(user = currentUser()) {
  return ["admin", "editor", "member"].includes(user?.role);
}
