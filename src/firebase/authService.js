import { getFirebaseServices, localPreviewMode, realDataMode } from "./firebaseClient.js";

const USER_KEY = "prodigitaltv-user";
let authReadyPromise;
let lastFirebaseAuthUser = null;

function storeUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStoredUser() {
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_KEY);
}

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
    memberId: role === "member" ? "3q" : "",
    status: "active",
    providerId,
    idToken: "demo-token",
    tokenExpiresAt: "Lokale Vorschau"
  };
  storeUser(user);
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
    const storedUser = JSON.parse(sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY) || "null");
    if (storedUser && !sessionStorage.getItem(USER_KEY)) sessionStorage.setItem(USER_KEY, JSON.stringify(storedUser));
    if (storedUser) return storedUser;
    return null;
  } catch {
    clearStoredUser();
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
    memberId: profileData.memberId || "",
    committeeRole: profileData.committeeRole || "",
    permissions: Array.isArray(profileData.permissions) ? profileData.permissions : [],
    status: profileData.status || "active",
    providerId: firebaseUser.providerData?.[0]?.providerId || "password",
    idToken: tokenResult.token,
    tokenExpiresAt: tokenResult.expirationTime,
    tokenIssuedAt: tokenResult.issuedAtTime
  };
  storeUser(user);
  return user;
}

export async function login(email, password, demoRole = "member") {
  if (!realDataMode() && (localPreviewMode() || isLocalHost()) && password === "demo") {
    return localDemoUser(email, demoRole || "admin");
  }
  const firebase = await getFirebaseServices();
  if (!firebase) {
    const user = { uid: `demo-${demoRole}`, email, displayName: email.split("@")[0], role: demoRole, idToken: "demo-token", tokenExpiresAt: "" };
    storeUser(user);
    return user;
  }
  try {
    const credential = await firebase.authLib.signInWithEmailAndPassword(firebase.auth, email, password);
    return userFromCredential(firebase, credential.user, demoRole);
  } catch (error) {
    if (!realDataMode() && isLocalHost() && error?.code === "auth/invalid-credential") {
      return localDemoUser(email, demoRole || "admin");
    }
    if (error?.code === "auth/invalid-credential") {
      throw new Error("Firebase kennt diese E-Mail/Passwort-Kombination nicht. Wenn das Konto ueber Google angelegt wurde, bitte 'Mit Google anmelden' nutzen.");
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
    storeUser(user);
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
          clearStoredUser();
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
  clearStoredUser();
}

export function canUseCms(user = currentUser()) {
  return ["admin", "editor"].includes(normalizeRole(user?.role));
}

export function isAdmin(user = currentUser()) {
  return normalizeRole(user?.role) === "admin";
}

export function isMember(user = currentUser()) {
  return ["admin", "editor", "member"].includes(normalizeRole(user?.role));
}
