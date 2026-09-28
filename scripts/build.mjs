import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { buildPublicSnapshot } from "./generatePublicSnapshot.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
async function removeDistWithRetry() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await rm(dist, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(error?.code) || attempt === 6) {
        throw error;
      }
      await sleep(1500 * attempt);
    }
  }
}

await removeDistWithRetry();
await mkdir(dist, { recursive: true });
await cp(resolve(root, "public"), dist, { recursive: true });
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
try {
  const snapshot = await buildPublicSnapshot();

  const snapshotPath = resolve(dist, "public-snapshot.json");

  const bootCachePrefixes = [
    "pdtv-public-list-v7:events:",
    "pdtv-public-list-v7:editorialContent:",
    "pdtv-public-list-v8:topics:",
    "pdtv-public-list-v7:speakers:",
    "pdtv-public-list-v7:sponsors:"
  ];
  const cacheEntries = Object.entries(snapshot.caches || {}).filter(([key]) =>
    bootCachePrefixes.some((prefix) => key.startsWith(prefix))
  );
  const bootSnapshot = {
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    caches: Object.fromEntries(cacheEntries),
    eventDetails: snapshot.eventDetails || {},
    fullSnapshotUrl: "/public-snapshot.json"
  };
  const safeJson = JSON.stringify(bootSnapshot).replace(/</g, "\\u003c");
  await writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");
  for (const pageName of ["index.html", "checkin.html"]) {
    const pagePath = resolve(dist, pageName);
    const pageHtml = await readFile(pagePath, "utf8");
    await writeFile(pagePath, pageHtml.replace("</head>", `  <script>window.__PDT_PUBLIC_SNAPSHOT=${safeJson};</script>\n  </head>`), "utf8");
  }
  console.log(`Public snapshot embedded with ${cacheEntries.length} boot caches and ${Object.keys(snapshot.eventDetails || {}).length} event details.`);
} catch (error) {
  console.warn("Public snapshot skipped:", error?.message || error);
}
console.log("PROdigitalTV build ready in dist/");


