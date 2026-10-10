const PREFIX = "pdtv-event-photos-v1-";
const LIMIT = 64 * 1024 * 1024;
const AGE = 24 * 60 * 60 * 1000;
let writes = Promise.resolve();
let generation = 0;
const pending = new Map();
export async function clearParticipantPhotoCache() {
  generation++;
  pending.clear();
  await writes.catch(() => {});
  if (!globalThis.caches) return;
  await Promise.all((await caches.keys()).filter(name => name.startsWith(PREFIX)).map(name => caches.delete(name)));
}
export async function cachedParticipantPhoto(uid, mediaId, download) {
  const requestKey = uid + ":" + mediaId;
  if (pending.has(requestKey)) return pending.get(requestKey);
  const runGeneration = generation;
  const request = (async () => {
    const key = new URL("/__event-photo-cache/" + encodeURIComponent(mediaId), location.origin).href;
    let cache;
    try {
      if (globalThis.caches) cache = await caches.open(PREFIX + uid);
      const hit = await cache?.match(key);
      if (hit && Date.now() - Number(hit.headers.get("X-Cached-At")) < AGE) return hit.blob();
      if (hit) await cache.delete(key);
    } catch { cache = null; }
    const blob = await download();
    if (cache && blob.size <= LIMIT && generation === runGeneration) {
      const save = async () => {
        if (generation !== runGeneration) return;
        const entries = await cache.keys();
        const valid = [];
        let size = 0;
        for (const entry of entries) {
          const response = await cache.match(entry);
          if (!response) continue;
          const bytes = Number(response.headers.get("X-Photo-Bytes") || 0);
          if (Date.now() - Number(response.headers.get("X-Cached-At")) >= AGE) await cache.delete(entry);
          else { size += bytes; valid.push({ entry, bytes }); }
        }
        for (const { entry, bytes } of valid) {
          if (size + blob.size <= LIMIT) break;
          await cache.delete(entry); size -= bytes;
        }
        await cache.put(key, new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg", "X-Cached-At": String(Date.now()), "X-Photo-Bytes": String(blob.size) } }));
      };
      writes = writes.then(save).catch(() => {});
      await writes;
    }
    return blob;
  })();
  pending.set(requestKey, request);
  try { return await request; } finally { if (pending.get(requestKey) === request) pending.delete(requestKey); }
}
