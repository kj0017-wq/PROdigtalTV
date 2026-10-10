import test from "node:test";
import assert from "node:assert/strict";
import { eventPhotoUploadProgressModel } from "../src/utils/eventPhotoUploadProgress.js";

test("zeigt Datei- und Upload-Fortschritt für mehrere Eventfotos", () => {
  const model = eventPhotoUploadProgressModel({
    stage: "uploading", fileIndex: 1, totalFiles: 3, fileProgress: 47, overallProgress: 49
  });
  assert.equal(model.label, "Foto wird übertragen · Foto 2 von 3 · 47 %");
  assert.equal(model.overallProgress, 49);
  assert.deepEqual(model.steps.map((step) => step.state), ["complete", "complete", "active", "pending", "pending"]);
});

test("markiert die Galerie-Aktualisierung als letzten Schritt", () => {
  const model = eventPhotoUploadProgressModel({ stage: "refreshing", totalFiles: 2, overallProgress: 100 });
  assert.equal(model.label, "Galerie wird aktualisiert");
  assert.equal(model.overallProgress, 100);
  assert.deepEqual(model.steps.map((step) => step.state), ["complete", "complete", "complete", "complete", "active"]);
});
