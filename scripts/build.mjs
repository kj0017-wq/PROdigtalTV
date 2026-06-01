import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

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
console.log("PROdigitalTV build ready in dist/");
