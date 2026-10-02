const PHOTO_UPLOAD_STEPS = ["validation", "preparing", "uploading", "processing", "refreshing"];

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function eventPhotoUploadProgressModel(detail = {}) {
  const stage = PHOTO_UPLOAD_STEPS.includes(detail.stage) ? detail.stage : "validation";
  const activeIndex = PHOTO_UPLOAD_STEPS.indexOf(stage);
  const fileIndex = Math.max(0, Number(detail.fileIndex) || 0);
  const totalFiles = Math.max(1, Number(detail.totalFiles) || 1);
  const fileProgress = clampPercent(detail.fileProgress);
  const overallProgress = clampPercent(detail.overallProgress);
  const fileLabel = totalFiles > 1 ? ` · Foto ${Math.min(fileIndex + 1, totalFiles)} von ${totalFiles}` : "";
  const labels = {
    validation: "Auswahl wird geprüft",
    preparing: `Upload wird vorbereitet${fileLabel}`,
    uploading: `Foto wird übertragen${fileLabel} · ${fileProgress} %`,
    processing: `Foto wird verarbeitet${fileLabel}`,
    refreshing: "Galerie wird aktualisiert"
  };
  return {
    stage,
    label: labels[stage],
    overallProgress,
    steps: PHOTO_UPLOAD_STEPS.map((key, index) => ({
      key,
      state: index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"
    }))
  };
}
