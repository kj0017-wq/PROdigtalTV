import { getFirebaseServices } from "./firebaseClient.js?v=3";
export async function callEventModerator(name, data = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  return (await firebase.functionsLib.httpsCallable(firebase.functions, name)(data)).data;
}
