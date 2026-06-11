const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { randomUUID } = require("node:crypto");
const lamejs = require("lamejs");

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

function textSignature(value = "") {
  const text = cleanText(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
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

function mp3BufferFromPcmBuffer(pcm) {
  const samples = new Int16Array(pcm.length / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = pcm.readInt16LE(index * 2);
  }
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, 96);
  const buffers = [];
  const blockSize = 1152;
  for (let index = 0; index < samples.length; index += blockSize) {
    const chunk = samples.subarray(index, index + blockSize);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length) buffers.push(Buffer.from(encoded));
  }
  const flush = encoder.flush();
  if (flush.length) buffers.push(Buffer.from(flush));
  return Buffer.concat(buffers);
}

async function requireEditor(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login erforderlich.");
  const profile = (await db.collection("users").doc(request.auth.uid).get()).data();
  if (!["admin", "editor"].includes(profile?.role)) throw new HttpsError("permission-denied", "Keine CMS-Berechtigung.");
  return profile;
}

function ttsVariantConfig(variant = "accessible") {
  if (variant === "natural") {
    return {
      key: "natural",
      voiceName: "Puck",
      promptLines: [
        "Read this German editorial article with a natural, fluent voice.",
        "Use a calm, professional tone for a media industry audience.",
        "Keep the rhythm conversational, but do not add commentary or interpretation."
      ]
    };
  }
  return {
    key: "accessible",
    voiceName: "Kore",
    promptLines: [
      "Read this German editorial article clearly, calmly and accessibly.",
      "Use a precise B2B newsreader voice with slightly slower pacing.",
      "Speak German naturally and leave small pauses between sentences."
    ]
  };
}

function variantFields(variant = "accessible") {
  if (variant === "natural") {
    return {
      url: "audioNaturalUrl",
      path: "audioNaturalStoragePath",
      mimeType: "audioNaturalMimeType",
      generatedAt: "audioNaturalGeneratedAt",
      textLength: "audioNaturalTextLength",
      truncated: "audioNaturalTextTruncated"
    };
  }
  return {
    url: "audioAccessibleUrl",
    path: "audioAccessibleStoragePath",
    mimeType: "audioAccessibleMimeType",
    generatedAt: "audioAccessibleGeneratedAt",
    textLength: "audioAccessibleTextLength",
    truncated: "audioAccessibleTextTruncated"
  };
}

async function createSpeechBuffer({ title, text, variant = "accessible" }) {
  const key = geminiApiKey.value() || process.env.GEMINI_API_KEY;
  if (!key) throw new HttpsError("failed-precondition", "GEMINI_API_KEY ist nicht als Firebase Secret/Environment gesetzt.");

  const cleanTitle = cleanText(title || "");
  const cleanBody = cleanText(text || "");
  if (!cleanBody) throw new HttpsError("invalid-argument", "Kein Text zum Vorlesen uebergeben.");
  const config = ttsVariantConfig(variant);
  const chunks = splitIntoChunks(cleanBody);
  const pcmBuffers = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const prompt = [
      ...config.promptLines,
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
              prebuiltVoiceConfig: { voiceName: config.voiceName }
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
  const pcmBuffer = Buffer.concat(pcmBuffers);
  return { buffer: wavBufferFromPcmBuffer(pcmBuffer), pcmBuffer, truncated: String(text || "").length > maxCharacters, textLength: cleanBody.length };
}

exports.generateArticleSpeech = onCall({ region, secrets: [geminiApiKey], timeoutSeconds: 240, memory: "512MiB" }, async (request) => {
  const speech = await createSpeechBuffer({ title: request.data?.title || "", text: request.data?.text || "", variant: request.data?.variant || "accessible" });
  return {
    audioBase64: speech.buffer.toString("base64"),
    mimeType: "audio/wav",
    sampleRate,
    truncated: speech.truncated
  };
});

exports.generateArticleSpeechAsset = onCall({ region, secrets: [geminiApiKey], timeoutSeconds: 360, memory: "1GiB" }, async (request) => {
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
      ? [item.subtitle, item.longDescription, item.bodyText, item.shortDescription].filter(Boolean).join("\n\n")
      : [item.subtitle, item.bodyText, item.introText, item.shortText, item.teaserText].filter(Boolean).join("\n\n");
    const signature = textSignature(text);
    const bucket = getStorage().bucket(storageBucket);
    const requestedVariant = request.data?.variant || "accessible";
    const variants = requestedVariant === "all" ? ["accessible", "natural"] : [requestedVariant === "natural" ? "natural" : "accessible"];
    const update = {
      audioGeneratedBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp()
    };
    const resultVariants = {};
    for (const variant of variants) {
      const speech = await createSpeechBuffer({ title: item.title || "", text, variant });
      const isNatural = variant === "natural";
      const audioBuffer = isNatural ? mp3BufferFromPcmBuffer(speech.pcmBuffer) : speech.buffer;
      const mimeType = isNatural ? "audio/mpeg" : "audio/wav";
      const extension = isNatural ? "mp3" : "wav";
      const token = randomUUID();
      const storagePath = `article-audio/${collection}/${id}/${variant}-${Date.now()}-${id}.${extension}`;
      const file = bucket.file(storagePath);
      await file.save(audioBuffer, {
        resumable: false,
        contentType: mimeType,
        metadata: {
          cacheControl: "public,max-age=31536000",
          metadata: { firebaseStorageDownloadTokens: token }
        }
      });
      const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
      const fields = variantFields(variant);
      update[fields.url] = audioUrl;
      update[fields.path] = storagePath;
      update[fields.mimeType] = mimeType;
      update[fields.generatedAt] = FieldValue.serverTimestamp();
      update[fields.textLength] = speech.textLength;
      update[fields.truncated] = speech.truncated;
      update[`${fields.url.replace(/Url$/, "")}TextSignature`] = signature;
      if (variant === "accessible") {
        update.audioUrl = audioUrl;
        update.audioStoragePath = storagePath;
        update.audioMimeType = mimeType;
        update.audioGeneratedAt = FieldValue.serverTimestamp();
        update.audioTextLength = speech.textLength;
        update.audioTextTruncated = speech.truncated;
        update.audioTextSignature = signature;
      }
      resultVariants[variant] = { audioUrl, audioStoragePath: storagePath, mimeType, truncated: speech.truncated };
    }
    await ref.set(update, { merge: true });
    const primary = resultVariants.accessible || resultVariants.natural;
    return { ...primary, variants: resultVariants };
  } catch (error) {
    console.error("generateArticleSpeechAsset failed", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error?.message || "Audio konnte intern nicht erzeugt werden.");
  }
});
