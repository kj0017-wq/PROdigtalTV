export async function generateArticleSpeech({ title, text, variant = "accessible" }) {
  const firebase = await import("../firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
  if (!firebase) throw new Error("Firebase ist nicht aktiv. Bitte Firebase-Verbindung und Login pruefen.");
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateArticleSpeech", { timeout: 240000 });
  const result = await callable({ title, text, variant });
  return result.data;
}

function isDeadlineError(error) {
  return error?.code === "functions/deadline-exceeded"
    || /deadline-exceeded|deadline exceeded|timeout/i.test(error?.message || String(error || ""));
}

export async function generateArticleSpeechAsset({ collection, id, variant = "accessible" }) {
  const firebase = await import("../firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
  if (!firebase) throw new Error("Firebase ist nicht aktiv. Bitte Firebase-Verbindung und Login pruefen.");
  try {
    const audioService = await import("./audioService.js");
    const status = await audioService.getAudioProviderStatus();
    if (status?.providers?.elevenlabs?.enabled) {
      const result = await audioService.regenerateAudio({ collection, id });
      const audio = result.audio || {};
      return {
        audioUrl: audio.audioUrl,
        audioStoragePath: audio.audioStoragePath,
        timingUrl: audio.timingUrl,
        mimeType: audio.mimeType || "audio/mpeg",
        truncated: audio.truncated,
        variants: {
          accessible: {
            audioUrl: audio.audioUrl,
            audioStoragePath: audio.audioStoragePath,
            mimeType: audio.mimeType || "audio/mpeg",
            truncated: audio.truncated
          },
          natural: {
            audioUrl: audio.audioUrl,
            audioStoragePath: audio.audioStoragePath,
            mimeType: audio.mimeType || "audio/mpeg",
            truncated: audio.truncated
          }
        },
        provider: "elevenlabs",
        serviceVersion: audio.serviceVersion || "audio-service-v1"
      };
    }
  } catch (error) {
    if (!/not found|missing function|internal|unavailable/i.test(error?.message || "")) throw error;
  }
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, "generateArticleSpeechAsset", { timeout: 360000 });
  try {
    const result = await callable({ collection, id, variant });
    return result.data;
  } catch (error) {
    if (variant !== "all" || !isDeadlineError(error)) throw error;
    const accessible = await callable({ collection, id, variant: "accessible" });
    const natural = await callable({ collection, id, variant: "natural" });
    return {
      ...(accessible.data || {}),
      variants: {
        accessible: accessible.data || {},
        natural: natural.data || {}
      },
      fallbackMode: "sequential"
    };
  }
}
