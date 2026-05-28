const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { randomUUID } = require("node:crypto");

const region = "europe-west3";
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const ttsModel = "gemini-2.5-flash-preview-tts";
const sampleRate = 24000;
const channels = 1;
const bitsPerSample = 16;
const maxCharacters = 6000;
const chunkCharacters = 1200;
const db = getFirestore();
const storageBucket = "prodigitaltv-da47b.firebasestorage.app";

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxCharacters);
}

function splitIntoChunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = "";
  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    if ((current + " " + sentence).trim().length > chunkCharacters && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = (current + " " + sentence).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wavBufferFromPcmBuffer(pcm) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

function wavBufferFromPcm(pcmBase64) {
  return wavBufferFromPcmBuffer(Buffer.from(pcmBase64, "base64"));
}

async function requireEditor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!["admin", "editor"].includes(profile?.role)) throw new HttpsError("permission-denied", "Keine CMS-Berechtigung.");
  return profile;
}

async function createSpeechBuffer({ title, text }) {
  const key = geminiApiKey.value() || process.env.GEMINI_API_KEY;
  if (!key) throw new HttpsError("failed-precondition", "GEMINI_API_KEY ist nicht als Firebase Secret/Environment gesetzt.");

  const cleanTitle = cleanText(title || "");
  const cleanBody = cleanText(text || "");
  if (!cleanBody) throw new HttpsError("invalid-argument", "Kein Text zum Vorlesen uebergeben.");
  const chunks = splitIntoChunks(cleanBody);
  const pcmBuffers = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const prompt = [
      "Read this German editorial article clearly, calmly and professionally.",
      "Use a warm, informative B2B newsreader voice. Speak German naturally.",
      cleanTitle && index === 0 ? `Title: ${cleanTitle}` : "",
      chunks.length > 1 ? `Part ${index + 1} of ${chunks.length}:` : "",
      chunks[index]
    ].filter(Boolean).join("\n\n");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" }
            }
          }
        },
        model: ttsModel
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini TTS API error", JSON.stringify(data.error || data));
      throw new HttpsError("internal", data.error?.message || "Gemini TTS Fehler.");
    }
    const pcmBase64 = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData?.data;
    if (!pcmBase64) throw new HttpsError("internal", "Gemini TTS hat keine Audiodaten geliefert.");
    pcmBuffers.push(Buffer.from(pcmBase64, "base64"));
  }
  return { buffer: wavBufferFromPcmBuffer(Buffer.concat(pcmBuffers)), truncated: String(text || "").length > maxCharacters };
}

exports.generateArticleSpeech = onCall({ region, secrets: [geminiApiKey], timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  const speech = await createSpeechBuffer({ title: request.data?.title || "", text: request.data?.text || "" });
  return {
    audioBase64: speech.buffer.toString("base64"),
    mimeType: "audio/wav",
    sampleRate,
    truncated: speech.truncated
  };
});

exports.generateArticleSpeechAsset = onCall({ region, secrets: [geminiApiKey], timeoutSeconds: 180, memory: "512MiB" }, async (request) => {
  try {
    await requireEditor(request);
    const collection = request.data?.collection;
    const id = request.data?.id;
    if (!["editorialContent", "topics"].includes(collection) || !id) throw new HttpsError("invalid-argument", "Ungueltiger Artikel.");
    const ref = db.collection(collection).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new HttpsError("not-found", "Artikel nicht gefunden.");
    const item = snapshot.data();
    const text = collection === "topics"
      ? [item.subtitle, item.articleText, item.longDescription, item.shortDescription].filter(Boolean).join("\n\n")
      : [item.subtitle, item.bodyText, item.introText, item.shortText, item.teaserText].filter(Boolean).join("\n\n");
    const speech = await createSpeechBuffer({ title: item.title || "", text });
    const bucket = getStorage().bucket(storageBucket);
    const token = randomUUID();
    const storagePath = `article-audio/${collection}/${id}/${Date.now()}-${id}.wav`;
    const file = bucket.file(storagePath);
    await file.save(speech.buffer, {
      resumable: false,
      contentType: "audio/wav",
      metadata: {
        cacheControl: "public,max-age=31536000",
        metadata: { firebaseStorageDownloadTokens: token }
      }
    });
    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
    await ref.set({
      audioUrl,
      audioStoragePath: storagePath,
      audioMimeType: "audio/wav",
      audioGeneratedAt: FieldValue.serverTimestamp(),
      audioGeneratedBy: request.auth.uid,
      audioTextTruncated: speech.truncated,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { audioUrl, audioStoragePath: storagePath, mimeType: "audio/wav", truncated: speech.truncated };
  } catch (error) {
    console.error("generateArticleSpeechAsset failed", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error?.message || "Audio konnte intern nicht erzeugt werden.");
  }
});
