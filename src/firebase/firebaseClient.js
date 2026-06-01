import { firebaseConfig, useFirebase } from "./firebaseConfig.js";

let servicesPromise;

function timeout(ms) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("Firebase konnte nicht rechtzeitig initialisiert werden.")), ms);
  });
}

export async function getFirebaseServices() {
  if (localPreviewMode()) return null;
  if (!useFirebase) return null;
  if (!servicesPromise) {
    servicesPromise = Promise.race([Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js")
    ]).then(([appLib, firestore, auth, storage, functions]) => {
      const app = appLib.initializeApp(firebaseConfig);
      return {
        app,
        db: firestore.getFirestore(app),
        auth: auth.getAuth(app),
        storage: storage.getStorage(app),
        functions: functions.getFunctions(app, "europe-west3"),
        firestore, authLib: auth, storageLib: storage, functionsLib: functions
      };
    }), timeout(8000)]).catch((error) => {
      console.warn(error);
      servicesPromise = null;
      return null;
    });
  }
  return servicesPromise;
}

export function firebaseEnabled() {
  return useFirebase && !localPreviewMode();
}

export function realDataMode() {
  const hashQuery = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "");
  const pageQuery = new URLSearchParams(window.location.search || "");
  const requested = pageQuery.get("real") || hashQuery.get("real");
  if (requested === "1") localStorage.setItem("prodigitaltv-real-data", "1");
  if (requested === "0") localStorage.removeItem("prodigitaltv-real-data");
  return localStorage.getItem("prodigitaltv-real-data") === "1";
}

export function localPreviewMode() {
  const hashQuery = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "");
  const pageQuery = new URLSearchParams(window.location.search || "");
  if (realDataMode()) return false;
  const demoFlag = pageQuery.get("demo") === "1"
    || hashQuery.get("demo") === "1"
    || localStorage.getItem("prodigitaltv-local-demo") === "1";
  return window.location.protocol === "file:" || demoFlag;
}
