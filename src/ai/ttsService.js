export async function generateArticleSpeech({ title, text }) {
  const firebase = await import("../firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
  if (!firebase) throw new Error("Firebase ist nicht aktiv.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateArticleSpeech");
  const result = await callable({ title, text });
  return result.data;
}

export async function generateArticleSpeechAsset({ collection, id }) {
  const firebase = await import("../firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
  if (!firebase) throw new Error("Firebase ist nicht aktiv.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateArticleSpeechAsset");
  const result = await callable({ collection, id });
  return result.data;
}
