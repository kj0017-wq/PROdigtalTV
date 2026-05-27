import { firebaseConfig, useFirebase } from "./firebaseConfig.js";

let servicesPromise;

export async function getFirebaseServices() {
  if (!useFirebase) return null;
  if (!servicesPromise) {
    servicesPromise = Promise.all([
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
    });
  }
  return servicesPromise;
}

export function firebaseEnabled() {
  return useFirebase;
}
