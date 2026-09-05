import { firebaseConfig } from "./firebaseConfig.js";
import { getFirebaseServices } from "./firebaseClient.js";
import { getOne } from "./dataService.js?v=511";

export { enableBrowserNotifications } from "./pushClient.js?v=1";

export async function createEventNotification(input = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Benachrichtigung kann nicht erstellt werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "createEventNotification");
  return (await callable({ input })).data;
}

export async function previewEventNotification(input = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Versand kann nicht vorbereitet werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "previewEventNotification");
  return (await callable({ input })).data;
}

export async function saveNotificationTestGroup(emails = []) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Testgruppe wurde nicht gespeichert.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "saveNotificationTestGroup");
  return (await callable({ emails })).data;
}

export async function getLiveSurvey(surveyId = "") {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Umfrage kann nicht geladen werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getLiveSurvey");
  return (await callable({ surveyId })).data;
}

export async function submitLiveSurveyResponse(input = {}) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Antwort kann nicht gespeichert werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "submitLiveSurveyResponse");
  return (await callable({ input })).data;
}

export async function getNotificationPushStatus(emails = []) {
  const firebase = await getFirebaseServices();
  if (!firebase) return { activeEmails: [] };
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "getNotificationPushStatus");
  return (await callable({ emails })).data;
}

export async function unsubscribeEventNotifications(hash = "") {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar. Abmeldung kann nicht gespeichert werden.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "unsubscribeEventNotifications");
  return (await callable({ hash })).data;
}
