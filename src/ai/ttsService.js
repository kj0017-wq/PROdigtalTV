export async function generateArticleSpeech({ title, text, variant = "accessible" }) {
  const firebase = await import("../firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
  if (!firebase) throw new Error("Firebase ist nicht aktiv. Bitte Firebase-Verbindung und Login pruefen.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateArticleSpeech");
  const result = await callable({ title, text, variant });
  return result.data;
}

export async function generateArticleSpeechAsset({ collection, id, variant = "accessible" }) {
  const firebase = await import("../firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
  if (!firebase) throw new Error("Firebase ist nicht aktiv. Bitte Firebase-Verbindung und Login pruefen.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateArticleSpeechAsset");
  const result = await callable({ collection, id, variant });
  return result.data;
}
