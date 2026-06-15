const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { createHash, randomUUID } = require("node:crypto");

const region = "europe-west3";
const db = getFirestore();
const storageBucket = "prodigitaltv-da47b.firebasestorage.app";
const elevenLabsApiKey = defineSecret("ELEVENLABS_API_KEY");
const serviceVersion = "audio-service-v1";
const defaultElevenLabsModel = "eleven_multilingual_v2";
const defaultElevenLabsVoiceId = "21m00Tcm4TlvDq8ikWAM";
const defaultElevenLabsVoiceName = "Rachel";
const maxCharacters = 6000;
const voiceCacheMs = 24 * 60 * 60 * 1000;

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxCharacters);
}

function textHash(value = "") {
  return createHash("sha256").update(cleanText(value), "utf8").digest("hex");
}

function audioSourceText(collection, item = {}) {
  return collection === "topics"
    ? [item.subtitle, item.longDescription, item.bodyText, item.shortDescription].filter(Boolean).join("\n\n")
    : [item.subtitle, item.longDescription, item.bodyText, item.articleText, item.archiveText, item.introText, item.shortText, item.teaserText, item.postEventSummary].filter(Boolean).join("\n\n");
}

async function requireEditor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!["admin", "editor"].includes(profile?.role)) throw new HttpsError("permission-denied", "Keine CMS-Berechtigung.");
  return { uid: request.auth.uid, ...profile };
}

async function requireAdmin(request) {
  const profile = await requireEditor(request);
  if (profile.role !== "admin") throw new HttpsError("permission-denied", "Nur Admins duerfen KI-Zugaenge verwalten.");
  return profile;
}

function elevenLabsKey() {
  const key = String(elevenLabsApiKey.value() || process.env.ELEVENLABS_API_KEY || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!key) throw new HttpsError("failed-precondition", "ELEVENLABS_API_KEY ist nicht als Firebase Secret/Environment gesetzt.");
  return key;
}

async function providerDoc() {
  const snapshot = await db.collection("settings").doc("audioProviders").get();
  return snapshot.exists ? snapshot.data() : {};
}

function safeElevenLabsConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    provider: "elevenlabs",
    serviceVersion,
    modelId: config.modelId || defaultElevenLabsModel,
    voiceId: config.voiceId || defaultElevenLabsVoiceId,
    voiceName: config.voiceName || defaultElevenLabsVoiceName,
    providerVersion: config.providerVersion || "v1",
    updatedAt: config.updatedAt || null,
    lastTestAt: config.lastTestAt || null,
    lastSuccessAt: config.lastSuccessAt || null,
    lastError: config.lastError || ""
  };
}

function publicProviderStatus(settings = {}) {
  const elevenlabs = safeElevenLabsConfig(settings.elevenlabs || {});
  return {
    serviceVersion,
    providers: {
      openai: {
        provider: "openai",
        enabled: true,
        status: "serverseitig konfiguriert",
        modelId: "gpt-4.1-mini",
        apiKey: "Firebase Secret OPENAI_API_KEY"
      },
      gemini: {
        provider: "gemini",
        enabled: true,
        status: "serverseitig konfiguriert",
        modelId: "gemini-2.5-flash-preview-tts",
        apiKey: "Firebase Secret GEMINI_API_KEY"
      },
      elevenlabs: {
        ...elevenlabs,
        status: elevenlabs.enabled ? "aktiv" : "inaktiv",
        apiKey: "Firebase Secret ELEVENLABS_API_KEY"
      }
    }
  };
}

async function saveProviderStatus(update = {}) {
  const expanded = {};
  Object.entries(update).forEach(([key, value]) => {
    const parts = key.split(".");
    let target = expanded;
    while (parts.length > 1) {
      const part = parts.shift();
      target[part] = target[part] || {};
      target = target[part];
    }
    target[parts[0]] = value;
  });
  await db.collection("settings").doc("audioProviders").set(expanded, { merge: true });
}

async function fetchElevenLabs(path, options = {}) {
  const response = await fetch(`https://api.elevenlabs.io/v1${path}`, {
    ...options,
    headers: {
      "xi-api-key": elevenLabsKey(),
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.arrayBuffer();
  if (!response.ok) {
    const message = data?.detail?.message || data?.message || data?.detail || "ElevenLabs API Fehler.";
    throw new HttpsError("internal", String(message));
  }
  return data;
}

async function createElevenLabsAudio({ text, title = "", config = {} }) {
  const cleanBody = cleanText(text);
  if (!cleanBody) throw new HttpsError("invalid-argument", "Kein Text zum Vorlesen gefunden.");
  const voiceId = config.voiceId || defaultElevenLabsVoiceId;
  const modelId = config.modelId || defaultElevenLabsModel;
  const payload = {
    text: [title ? cleanText(title) : "", cleanBody].filter(Boolean).join("\n\n"),
    model_id: modelId,
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true
    }
  };
  const data = await fetchElevenLabs(`/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const audioBase64 = data.audio_base64 || data.audioBase64;
  if (!audioBase64) throw new HttpsError("internal", "ElevenLabs hat keine Audiodaten geliefert.");
  return {
    audioBuffer: Buffer.from(audioBase64, "base64"),
    timing: data.alignment || data.normalized_alignment || null,
    mimeType: "audio/mpeg",
    textLength: cleanBody.length,
    truncated: String(text || "").length > maxCharacters,
    modelId,
    voiceId,
    voiceName: config.voiceName || defaultElevenLabsVoiceName
  };
}

async function saveAudioFiles({ collection, id, version, audioBuffer, timing }) {
  const bucket = getStorage().bucket(storageBucket);
  const token = randomUUID();
  const basePath = `article-audio/${collection}/${id}/elevenlabs-v${version}-${Date.now()}`;
  const audioPath = `${basePath}.mp3`;
  const audioFile = bucket.file(audioPath);
  await audioFile.save(audioBuffer, {
    resumable: false,
    contentType: "audio/mpeg",
    metadata: {
      cacheControl: "public,max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: token }
    }
  });
  const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(audioPath)}?alt=media&token=${token}`;
  let timingUrl = "";
  let timingPath = "";
  if (timing) {
    const timingToken = randomUUID();
    timingPath = `${basePath}-timing.json`;
    await bucket.file(timingPath).save(Buffer.from(JSON.stringify(timing)), {
      resumable: false,
      contentType: "application/json",
      metadata: {
        cacheControl: "public,max-age=31536000",
        metadata: { firebaseStorageDownloadTokens: timingToken }
      }
    });
    timingUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(timingPath)}?alt=media&token=${timingToken}`;
  }
  return { audioUrl, audioStoragePath: audioPath, timingUrl, timingStoragePath: timingPath };
}

async function generateAudioForRecord(request, force = false) {
  const profile = await requireEditor(request);
  const collection = request.data?.collection;
  const id = request.data?.id;
  if (!["editorialContent", "topics"].includes(collection) || !id) throw new HttpsError("invalid-argument", "Ungueltiger Inhalt.");
  const settings = await providerDoc();
  const config = safeElevenLabsConfig(settings.elevenlabs || {});
  if (!config.enabled) throw new HttpsError("failed-precondition", "ElevenLabs ist in den KI-Zugaengen nicht aktiviert.");
  const ref = db.collection(collection).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Inhalt nicht gefunden.");
  const item = snapshot.data();
  const sourceText = audioSourceText(collection, item);
  const hash = textHash(sourceText);
  const currentAudio = item.audio || {};
  if (!force && currentAudio.provider === "elevenlabs" && currentAudio.textHash === hash && currentAudio.status === "ready" && currentAudio.audioUrl) {
    return { cached: true, audio: currentAudio };
  }
  const nextVersion = Number(currentAudio.version || item.audioVersion || 0) + 1;
  const speech = await createElevenLabsAudio({ text: sourceText, title: item.title || item.titel || "", config });
  const files = await saveAudioFiles({ collection, id, version: nextVersion, audioBuffer: speech.audioBuffer, timing: speech.timing });
  const audio = {
    enabled: true,
    provider: "elevenlabs",
    serviceVersion,
    providerVersion: config.providerVersion || "v1",
    voiceId: speech.voiceId,
    voiceName: speech.voiceName,
    modelId: speech.modelId,
    audioUrl: files.audioUrl,
    audioStoragePath: files.audioStoragePath,
    timingUrl: files.timingUrl,
    timingStoragePath: files.timingStoragePath,
    textHash: hash,
    version: nextVersion,
    audioVersion: nextVersion,
    status: "ready",
    mimeType: speech.mimeType,
    textLength: speech.textLength,
    truncated: speech.truncated,
    generatedAt: FieldValue.serverTimestamp(),
    generatedBy: profile.uid
  };
  const update = {
    audio,
    karaoke: { ...(item.karaoke || {}), enabled: item.karaoke?.enabled === true, mode: item.karaoke?.mode || "word" },
    audioUrl: files.audioUrl,
    audioAccessibleUrl: files.audioUrl,
    audioAccessibleStoragePath: files.audioStoragePath,
    audioAccessibleMimeType: speech.mimeType,
    audioAccessibleTextSignature: hash,
    audioAccessibleTextLength: speech.textLength,
    audioAccessibleTextTruncated: speech.truncated,
    audioAccessibleVoice: speech.voiceName,
    audioStatus: "ready",
    audioAccessibleStatus: "ready",
    audioProvider: "elevenlabs",
    audioTextHash: hash,
    audioVersion: nextVersion,
    audioGeneratedAt: FieldValue.serverTimestamp(),
    audioGeneratedBy: profile.uid,
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.set(update, { merge: true });
  return { cached: false, audio: { ...audio, generatedAt: new Date().toISOString() } };
}

exports.getAudioProviderStatus = onCall({ region }, async (request) => {
  await requireEditor(request);
  return publicProviderStatus(await providerDoc());
});

exports.saveAudioProviderConfig = onCall({ region }, async (request) => {
  const profile = await requireAdmin(request);
  const data = request.data || {};
  const current = await providerDoc();
  const elevenlabs = safeElevenLabsConfig({
    ...(current.elevenlabs || {}),
    enabled: data.enabled,
    modelId: data.modelId,
    voiceId: data.voiceId,
    voiceName: data.voiceName,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: profile.uid
  });
  await saveProviderStatus({ elevenlabs });
  return {
    saved: true,
    provider: "elevenlabs",
    serviceVersion,
    apiKeyStorage: "Firebase Secret ELEVENLABS_API_KEY",
    ignoredApiKey: Boolean(data.apiKey)
  };
});

exports.testAudioProviderConnection = onCall({ region, secrets: [elevenLabsApiKey] }, async (request) => {
  await requireEditor(request);
  const provider = request.data?.provider || "elevenlabs";
  if (provider !== "elevenlabs") throw new HttpsError("invalid-argument", "Dieser Test unterstuetzt aktuell ElevenLabs.");
  try {
    await fetchElevenLabs("/user", { method: "GET" });
    const update = {
      "elevenlabs.lastTestAt": FieldValue.serverTimestamp(),
      "elevenlabs.lastSuccessAt": FieldValue.serverTimestamp(),
      "elevenlabs.lastError": ""
    };
    await saveProviderStatus(update);
    return { ok: true, provider, serviceVersion };
  } catch (error) {
    await saveProviderStatus({
      "elevenlabs.lastTestAt": FieldValue.serverTimestamp(),
      "elevenlabs.lastError": error.message || String(error)
    }).catch(() => {});
    throw error;
  }
});

exports.loadAudioProviderVoices = onCall({ region, secrets: [elevenLabsApiKey] }, async (request) => {
  await requireEditor(request);
  const provider = request.data?.provider || "elevenlabs";
  if (provider !== "elevenlabs") throw new HttpsError("invalid-argument", "Dieser Service unterstuetzt aktuell ElevenLabs.");
  const settings = await providerDoc();
  const cachedAt = settings.elevenlabs?.voicesCachedAt?.toDate?.() || (settings.elevenlabs?.voicesCachedAt ? new Date(settings.elevenlabs.voicesCachedAt) : null);
  const cachedVoices = settings.elevenlabs?.voices || [];
  if (cachedVoices.length && cachedAt && Date.now() - cachedAt.getTime() < voiceCacheMs && !request.data?.forceRefresh) {
    return { provider, cached: true, voices: cachedVoices };
  }
  const data = await fetchElevenLabs("/voices", { method: "GET" });
  const voices = (data.voices || []).map((voice) => ({
    voiceId: voice.voice_id,
    voiceName: voice.name,
    category: voice.category || "",
    previewUrl: voice.preview_url || ""
  })).filter((voice) => voice.voiceId && voice.voiceName);
  await saveProviderStatus({
    "elevenlabs.voices": voices,
    "elevenlabs.voicesCachedAt": FieldValue.serverTimestamp()
  });
  return { provider, cached: false, voices };
});

exports.previewAudioProviderVoice = onCall({ region, secrets: [elevenLabsApiKey], timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  await requireEditor(request);
  const provider = request.data?.provider || "elevenlabs";
  if (provider !== "elevenlabs") throw new HttpsError("invalid-argument", "Dieser Service unterstuetzt aktuell ElevenLabs.");
  const settings = await providerDoc();
  const config = safeElevenLabsConfig({
    ...(settings.elevenlabs || {}),
    modelId: request.data?.modelId || settings.elevenlabs?.modelId,
    voiceId: request.data?.voiceId || settings.elevenlabs?.voiceId,
    voiceName: request.data?.voiceName || settings.elevenlabs?.voiceName
  });
  const text = cleanText(request.data?.text || "Dies ist eine kurze Leseprobe fuer PROdigitalTV. So klingt diese Stimme in der Audio- und Barrierefreiheitsfunktion.");
  const speech = await createElevenLabsAudio({ title: "Leseprobe", text, config });
  return {
    provider,
    serviceVersion,
    voiceId: speech.voiceId,
    voiceName: speech.voiceName,
    modelId: speech.modelId,
    mimeType: speech.mimeType,
    audioBase64: speech.audioBuffer.toString("base64"),
    textLength: speech.textLength,
    truncated: speech.truncated
  };
});

exports.generateAudio = onCall({ region, secrets: [elevenLabsApiKey], timeoutSeconds: 360, memory: "1GiB" }, async (request) => {
  return generateAudioForRecord(request, false);
});

exports.regenerateAudio = onCall({ region, secrets: [elevenLabsApiKey], timeoutSeconds: 360, memory: "1GiB" }, async (request) => {
  return generateAudioForRecord(request, true);
});

exports.getAudioStatus = onCall({ region }, async (request) => {
  await requireEditor(request);
  const collection = request.data?.collection;
  const id = request.data?.id;
  if (!["editorialContent", "topics"].includes(collection) || !id) throw new HttpsError("invalid-argument", "Ungueltiger Inhalt.");
  const snapshot = await db.collection(collection).doc(id).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Inhalt nicht gefunden.");
  const item = snapshot.data();
  const hash = textHash(audioSourceText(collection, item));
  const audio = item.audio || {};
  const status = audio.audioUrl && audio.textHash === hash ? "ready" : audio.audioUrl ? "outdated" : "missing";
  return { status, textHash: hash, audio };
});
