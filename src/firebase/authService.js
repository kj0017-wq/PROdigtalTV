import { getFirebaseServices, localPreviewMode, realDataMode } from "./firebaseClient.js";

const USER_KEY = "prodigitaltv-user";
let authReadyPromise;
let lastFirebaseAuthUser = null;

function isLocalHost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function localDemoUser(email = "admin@prodigitaltv.de", demoRole = "admin", providerId = "password") {
  const role = normalizeRole(demoRole || "admin");
  const user = {
    uid: `demo-${providerId.replace(/[^a-z0-9-]/gi, "-")}-${role}`,
    email,
    displayName: email.split("@")[0] || "Demo",
    role,
    status: "active",
    providerId,
    idToken: "demo-token",
    tokenExpiresAt: "Lokale Vorschau"
  };
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

function normalizeRole(role = "") {
  const normalized = String(role || "").trim().toLowerCase();
  const aliases = {
    administrator: "admin",
    admin: "admin",
    owner: "admin",
    redakteur: "editor",
    redaktion: "editor",
    editor: "editor",
    member: "member",
    mitglied: "member",
    guest: "guest"
  };
  return aliases[normalized] || normalized;
}

export function currentUser() {
  try {
    const storedUser = JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    if (storedUser) return storedUser;
    if (!realDataMode() && isLocalHost() && String(window.location.hash || "").startsWith("#/cms")) {
      return localDemoUser("admin@prodigitaltv.de", "admin");
    }
    return null;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function authDebugState() {
  const storedRaw = sessionStorage.getItem(USER_KEY);
  let storedUser = null;
  try {
    storedUser = JSON.parse(storedRaw || "null");
  } catch {
    storedUser = { parseError: true };
  }
  return {
    stored: Boolean(storedRaw),
    storedUser,
    firebaseAuthUser: lastFirebaseAuthUser,
    realDataMode: realDataMode(),
    localPreviewMode: localPreviewMode(),
    hostname: window.location.hostname,
    hash: window.location.hash
  };
}

async function userFromCredential(firebase, firebaseUser, fallbackRole = "guest") {
  const tokenResult = await firebaseUser.getIdTokenResult(true);
  const profileRef = firebase.firestore.doc(firebase.db, "users", firebaseUser.uid);
  const profile = await firebase.firestore.getDoc(profileRef);
  const profileData = profile.exists() ? profile.data() : {};
  const role = normalizeRole(profileData.role || tokenResult.claims.role || "guest");
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
  if (!realDataMode() && (localPreviewMode() || isLocalHost()) && password === "demo") {
    return localDemoUser(email, demoRole || "admin");
  }
  const firebase = await getFirebaseServices();
  if (!firebase) {
    const user = { uid: `demo-${demoRole}`, email, displayName: email.split("@")[0], role: demoRole, idToken: "demo-token", tokenExpiresAt: "" };
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }
  try {
    const credential = await firebase.authLib.signInWithEmailAndPassword(firebase.auth, email, password);
    return userFromCredential(firebase, credential.user, demoRole);
  } catch (error) {
    if (!realDataMode() && isLocalHost() && error?.code === "auth/invalid-credential") {
      return localDemoUser(email, demoRole || "admin");
    }
    throw error;
  }
}

export async function loginWithGoogle(demoRole = "member") {
  if (!realDataMode() && (localPreviewMode() || isLocalHost())) {
    return localDemoUser("google-demo@prodigitaltv.de", demoRole || "admin", "google.com");
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
        lastFirebaseAuthUser = firebaseUser ? {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          providerId: firebaseUser.providerData?.[0]?.providerId || ""
        } : null;
        if (!firebaseUser) {
          const existingUser = currentUser();
          if (existingUser && !realDataMode() && isLocalHost()) {
            resolve(existingUser);
            return;
          }
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
  if (isLocalHost() && String(window.location.hash || "").startsWith("#/cms")) return true;
  return ["admin", "editor"].includes(normalizeRole(user?.role));
}

export function isAdmin(user = currentUser()) {
  if (isLocalHost() && String(window.location.hash || "").startsWith("#/cms")) return true;
  return normalizeRole(user?.role) === "admin";
}

export function isMember(user = currentUser()) {
  return ["admin", "editor", "member"].includes(normalizeRole(user?.role));
}
