import { readFile } from "node:fs/promises";
import { initializeApp, applicationDefault, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const app = initializeApp({ credential: applicationDefault(), projectId: "prodigitaltv-da47b" });
const db = getFirestore(app);
const timeout = setTimeout(() => { console.error("Push audit timed out; no notifications sent."); process.exit(1); }, 45000);
const date = (value) => value?.toDate?.().toISOString() || (typeof value === "string" ? value : null);
try {
  const [tokensSnapshot, settingsSnapshot, historySnapshot] = await Promise.all([
    db.collection("notificationTokens").limit(1000).get(),
    db.collection("settings").doc("browserPush").get(),
    db.collection("eventNotifications").orderBy("createdAt", "desc").limit(30).get()
  ]);
  const tokens = tokensSnapshot.docs.map((doc) => doc.data());
  const active = tokens.filter((record) => record.status === "active" && record.token);
  const settings = settingsSnapshot.data() || {};
  const key = settings.vapidPublicKey || settings.value?.vapidPublicKey || "";
  const service = await readFile(new URL("../src/firebase/pushClient.js", import.meta.url), "utf8");
  const fallback = service.match(/const fallbackVapidKey = "([^"]+)"/)?.[1] || "";
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const siteChecks = await Promise.all(["https://prodigitaltv.web.app", "https://prodigitaltv-da47b.web.app"].map(async (origin) => {
    try {
      const response = await fetch(`${origin}/sw.js`, { signal: AbortSignal.timeout(8000) });
      const text = await response.text();
      return { origin, status: response.status, contentType: response.headers.get("content-type"), workerMatchesLocal: text.trim() === worker.trim(), firebaseMessagingIncluded: text.includes("firebase-messaging-compat") };
    } catch (error) { return { origin, error: error.code || error.name }; }
  }));
  const validation = [];
  if (process.argv.includes("--validate-tokens")) {
    for (const record of active.slice(0, 10)) {
      try {
        // true means validate-only: FCM must not deliver this message.
        await getMessaging(app).send({ token: record.token, notification: { title: "PROdigitalTV validation", body: "Validation only" } }, true);
        validation.push({ status: "validated" });
      } catch (error) { validation.push({ status: "rejected", code: error.code || "unknown" }); }
    }
  }
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), siteChecks,
    configuration: { settingsPresent: settingsSnapshot.exists, storedPublicKeyPresent: Boolean(key), storedKeyMatchesFallback: key ? key === fallback : null, effectivePublicKeyLength: (key || fallback).length },
    devices: { records: tokens.length, limitedTo: 1000, active: active.length, distinctEmails: new Set(active.map((record) => record.email)).size, missingEmail: active.filter((record) => !record.email).length,
      ios: active.filter((record) => /iPhone|iPad|iPod/i.test(record.userAgent || "")).length,
      android: active.filter((record) => /Android/i.test(record.userAgent || "")).length,
      permissionStates: active.reduce((counts, record) => { const state = record.permission || "missing"; counts[state] = (counts[state] || 0) + 1; return counts; }, {}),
      lastSeen: active.map((record) => date(record.lastSeenAt)).filter(Boolean).sort(),
      olderThan30Days: active.filter((record) => Date.now() - Date.parse(date(record.lastSeenAt)) > 30 * 86400000).length
    },
    recentNotifications: historySnapshot.docs.map((doc) => { const record = doc.data(); return { createdAt: date(record.createdAt), status: record.status, recipientGroup: record.recipientGroup, targetCount: record.targetCount, pushedCount: record.pushedCount, queuedMailCount: record.queuedMailCount }; }),
    validation
  }, null, 2));
} finally {
  clearTimeout(timeout);
  await db.terminate();
  await deleteApp(app);
}
