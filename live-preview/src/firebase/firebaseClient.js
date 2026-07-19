import { firebaseConfig, useFirebase } from "./firebaseConfig.js";

let appPromise;
let firestorePromise;
let servicesPromise;

function timeout(ms) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("Firebase konnte nicht rechtzeitig initialisiert werden.")), ms);
  });
}

async function getFirebaseApp() {
  if (!appPromise) {
    appPromise = import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js").then((appLib) => {
      const existingApp = appLib.getApps()[0];
      return existingApp || appLib.initializeApp(firebaseConfig);
    });
  }
  return appPromise;
}

export async function getFirestoreServices() {
  if (localPreviewMode()) return null;
  if (!useFirebase) return null;
  if (!firestorePromise) {
    firestorePromise = Promise.race([
      Promise.all([
        getFirebaseApp(),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
      ]).then(([app, firestore]) => ({
        app,
        db: firestore.getFirestore(app),
        firestore
      })),
      timeout(8000)
    ]).catch((error) => {
      console.warn(error);
      firestorePromise = null;
      return null;
    });
  }
  return firestorePromise;
}

export async function getFirebaseServices() {
  if (localPreviewMode()) return null;
  if (!useFirebase) return null;
  if (!servicesPromise) {
    servicesPromise = Promise.race([
      Promise.all([
        getFirestoreServices(),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js")
      ]).then(([base, auth, storage, functions]) => {
        if (!base) return null;
        return {
          ...base,
          auth: auth.getAuth(base.app),
          storage: storage.getStorage(base.app),
          functions: functions.getFunctions(base.app, "europe-west3"),
          authLib: auth,
          storageLib: storage,
          functionsLib: functions
        };
      }),
      timeout(8000)
    ]).catch((error) => {
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
  return useFirebase;
}

export function localPreviewMode() {
  return false;
}
