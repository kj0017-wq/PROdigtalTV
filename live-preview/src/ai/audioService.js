async function callable(name, options = {}) {
  const firebase = await import("../firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
  if (!firebase) throw new Error("Firebase ist nicht aktiv. Bitte Firebase-Verbindung und Login pruefen.");
  return firebase.functionsLib.httpsCallable(firebase.functions, name, options);
}

export async function getAudioProviderStatus() {
  const fn = await callable("getAudioProviderStatus");
  const result = await fn({});
  return result.data;
}

export async function saveProviderConfig(payload = {}) {
  const fn = await callable("saveAudioProviderConfig");
  const result = await fn(payload);
  return result.data;
}

export async function testConnection(provider = "elevenlabs") {
  const fn = await callable("testAudioProviderConnection", { timeout: 60000 });
  const result = await fn({ provider });
  return result.data;
}

export async function loadVoices(provider = "elevenlabs", forceRefresh = false) {
  const fn = await callable("loadAudioProviderVoices", { timeout: 60000 });
  const result = await fn({ provider, forceRefresh });
  return result.data;
}

export async function previewVoice(payload = {}) {
  const fn = await callable("previewAudioProviderVoice", { timeout: 120000 });
  const result = await fn({ provider: "elevenlabs", ...payload });
  return result.data;
}

export async function generateAudio(payload = {}) {
  const fn = await callable("generateAudio", { timeout: 360000 });
  const result = await fn(payload);
  return result.data;
}

export async function regenerateAudio(payload = {}) {
  const fn = await callable("regenerateAudio", { timeout: 360000 });
  const result = await fn(payload);
  return result.data;
}

export async function getAudioStatus(payload = {}) {
  const fn = await callable("getAudioStatus");
  const result = await fn(payload);
  return result.data;
}
