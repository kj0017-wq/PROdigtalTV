import { mountEventContentModeration } from "./eventContentModeration.js?v=2";
import { escapeHtml } from "./format.js?v=3";
import { listPortalParticipantPhotos, uploadPortalGalleryPhotos } from "../firebase/portalGalleryPhotoService.js?v=5";
import { mountParticipantPhotos, mountParticipantPhotoBadges } from "./participantPhotos.js?v=8";
import { eventPhotoUploadProgressModel } from "./eventPhotoUploadProgress.js?v=1";

const uploadStepLabels = {
  validation: "Auswahl prüfen",
  preparing: "Upload vorbereiten",
  uploading: "Fotos übertragen",
  processing: "Fotos verarbeiten",
  refreshing: "Galerie aktualisieren"
};

function updateEventPhotoUploadProgress(form, detail = {}) {
  const progressRoot = form.querySelector("[data-event-photo-progress]");
  if (!progressRoot) return;
  const model = eventPhotoUploadProgressModel(detail);
  progressRoot.hidden = false;
  progressRoot.dataset.stage = model.stage;
  delete progressRoot.dataset.failed;
  const label = progressRoot.querySelector("[data-event-photo-progress-label]");
  const percent = progressRoot.querySelector("[data-event-photo-progress-percent]");
  const progress = progressRoot.querySelector("progress");
  if (label) label.textContent = model.label;
  if (percent) percent.textContent = `${model.overallProgress} %`;
  if (progress) {
    progress.value = model.overallProgress;
    progress.setAttribute("aria-valuetext", model.label);
  }
  model.steps.forEach(({ key, state }) => {
    const step = progressRoot.querySelector(`[data-event-photo-step="${key}"]`);
    if (!step) return;
    step.dataset.state = state;
    step.setAttribute("aria-current", state === "active" ? "step" : "false");
  });
}

export function mountEventPhotos(root) {
  mountEventContentModeration(root);
  const button = root.querySelector("[data-event-photo-open]");
  if (!button || button.dataset.bound) return;
  button.dataset.bound = "1";
  mountParticipantPhotoBadges(root);
  button.addEventListener("click", async () => {
    const eventId = root.dataset.eventId;
    const dialog = document.createElement("dialog");
    dialog.className = "event-photo-dialog";
    dialog.setAttribute("aria-labelledby", "event-photo-title");
    dialog.innerHTML = `<header class="event-photo-dialog__header"><h2 id="event-photo-title">Event Fotos</h2><button class="button button--secondary button--small" type="button" data-event-photo-close aria-label="Event Fotos schließen">Schließen</button></header><div data-event-photo-content><p>Fotos werden geladen …</p></div>`;
    document.body.append(dialog);
    dialog.querySelector("[data-event-photo-close]").onclick = () => dialog.close();
    dialog.addEventListener("close", () => { dialog.remove(); button.focus(); }, { once: true });
    dialog.showModal();
    const content = dialog.querySelector("[data-event-photo-content]");
    const refresh = async () => {
      try {
        const { photos = [] } = await listPortalParticipantPhotos(eventId);
        if (!dialog.isConnected) return;
        const photoGrid = `<div class="participant-photo-grid participant-photo-grid--thumbs" data-participant-photos data-event-id="${escapeHtml(eventId)}">${photos.length ? photos.map((photo) => `<figure class="participant-photo-card participant-photo-card--thumb" data-participant-photo="${escapeHtml(photo.id)}" data-photo-unread="${photo.unread ? "1" : "0"}"><button type="button" data-participant-photo-link aria-label="Foto vergrößern"><img data-participant-photo-image alt="${escapeHtml(photo.caption || photo.fileName || "Eventfoto")}" hidden><span data-participant-photo-status>Foto wird geladen …</span></button><figcaption>${photo.caption ? `<p>${escapeHtml(photo.caption)}</p>` : ""}<small>${escapeHtml(photo.uploadedByName || "Eventteilnehmer")}</small></figcaption></figure>`).join("") : '<p>Noch keine Fotos für diese Veranstaltung.</p>'}</div>`;
        const uploadForm = `<section class="event-photo-dialog__upload event-photo-dialog__upload--compact"><div class="event-photo-dialog__upload-heading"><div><h3>Fotos hochladen</h3><p>Aus der Fotomediathek auswählen und mit den Eventteilnehmern teilen.</p></div></div><form data-event-photo-upload class="event-photo-upload-form"><label class="field event-photo-upload-form__files"><span>Fotos auswählen</span><input name="files" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple required></label><label class="field event-photo-upload-form__note"><span>Bildbeschreibung</span><textarea name="note" rows="1" maxlength="500" placeholder="Optional"></textarea></label><label class="checkbox-line event-photo-upload-form__rights"><input type="checkbox" name="rightsConfirmed" required> Ich darf diese Fotos mit den Eventteilnehmern teilen.</label><button class="button button--primary event-photo-upload-form__submit" type="submit">Fotos hochladen</button><section class="event-photo-upload-progress" data-event-photo-progress hidden aria-live="polite"><div class="event-photo-upload-progress__headline"><strong data-event-photo-progress-label>Auswahl wird geprüft</strong><span data-event-photo-progress-percent></span></div><progress max="100" value="0" aria-label="Fortschritt des Foto-Uploads"></progress><ol>${Object.entries(uploadStepLabels).map(([key, label]) => `<li data-event-photo-step="${key}" data-state="pending"><span aria-hidden="true"></span>${label}</li>`).join("")}</ol></section><div data-event-photo-result role="status" aria-live="polite"></div></form></section>`;
        content.innerHTML = `${uploadForm}${photoGrid}`;
        mountParticipantPhotos(content.querySelector("[data-participant-photos]"));
        content.querySelector("[data-event-photo-upload]").onsubmit = async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const result = form.querySelector("[data-event-photo-result]");
          const submit = form.querySelector('button[type="submit"]');
          const files = Array.from(form.elements.files.files || []);
          if (!files.length || !form.elements.rightsConfirmed.checked) return;
          submit.disabled = true;
          try {
            updateEventPhotoUploadProgress(form, { stage: "validation", totalFiles: files.length, overallProgress: 0 });
            result.textContent = "";
            await uploadPortalGalleryPhotos(files, form.elements.note.value.trim(), (progress) => {
              updateEventPhotoUploadProgress(form, progress);
            }, eventId);
            updateEventPhotoUploadProgress(form, { stage: "refreshing", totalFiles: files.length, overallProgress: 100 });
            await refresh();
            const notice = document.createElement("p");
            notice.className = "alert alert--success";
            notice.textContent = "Ihre Fotos sind jetzt für die Eventteilnehmer sichtbar.";
            if (dialog.isConnected) content.prepend(notice);
            document.dispatchEvent(new CustomEvent("participant-photos-seen"));
          } catch (error) {
            result.textContent = error.message || "Foto-Upload fehlgeschlagen.";
            const progressRoot = form.querySelector("[data-event-photo-progress]");
            const activeStep = progressRoot?.querySelector('[data-state="active"]');
            if (progressRoot) progressRoot.dataset.failed = "true";
            if (activeStep) activeStep.dataset.state = "error";
            const progressLabel = progressRoot?.querySelector("[data-event-photo-progress-label]");
            if (progressLabel) progressLabel.textContent = "Upload fehlgeschlagen";
            submit.disabled = false;
          }
        };
      } catch (error) {
        if (dialog.isConnected) content.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || "Fotos konnten nicht geladen werden.")}</div>`;
      }
    };
    await refresh();
  });
}
