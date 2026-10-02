import { getFirebaseServices } from "../firebase/firebaseClient.js?v=2";
import { escapeHtml } from "./format.js?v=3";
import { loadPortalParticipantPhoto } from "../firebase/portalGalleryPhotoService.js?v=3";
import { openParticipantPhoto } from "./participantPhotos.js?v=6";

async function call(name, data) {
  const firebase = await getFirebaseServices();
  if (!firebase) throw new Error("Firebase ist nicht erreichbar.");
  return (await firebase.functionsLib.httpsCallable(firebase.functions, name, { timeout: 540000 })(data)).data;
}
export function mountEventContentModeration(root) {
  const opener = root.querySelector("[data-event-content-admin]");
  if (!opener || opener.dataset.bound) return;
  opener.dataset.bound = "1";
  opener.addEventListener("click", async () => {
    const eventId = root.dataset.eventId;
    const dialog = document.createElement("dialog");
    dialog.className = "event-photo-dialog event-content-admin";
    dialog.setAttribute("aria-label", "Chats und Fotos verwalten");
    dialog.innerHTML = `<header class="event-photo-dialog__header"><h2>Chats und Fotos verwalten</h2><button class="button button--secondary button--small" data-admin-close>Schließen</button></header><p data-admin-status role="status" aria-live="polite">Inhalte werden geladen …</p><div data-admin-content></div>`;
    document.body.append(dialog);
    dialog.showModal();
    const status = dialog.querySelector("[data-admin-status]");
    const content = dialog.querySelector("[data-admin-content]");
    const urls = new Set();
    const viewers = new Set();
    const people = new Map(JSON.parse(root.querySelector("[data-event-live-data]")?.dataset.eventLiveData || "{}").participants?.map(person => [person.contactId, person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ")]) || []);
    let summary;
    let messageOffset = 0;
    let photoOffset = 0;
    let busy = false;
    let observer;
    const revoke = () => { observer?.disconnect(); urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
    dialog.querySelector("[data-admin-close]").onclick = () => dialog.close();
    dialog.addEventListener("close", () => { viewers.forEach(viewer => viewer.close()); revoke(); dialog.remove(); if (opener.isConnected) opener.focus(); }, { once: true });
    const refresh = async () => {
      summary = await call("adminListEventContent", { eventId, messageOffset, photoOffset });
      if (!dialog.isConnected) return;
      revoke();
      messageOffset = summary.messageOffset;
      photoOffset = summary.photoOffset;
      const pagination = (kind, offset, count) => `<div class="event-content-admin__actions"><button class="button button--secondary button--small" data-admin-page="${kind}" data-offset="${offset - 500}" ${offset === 0 ? "disabled" : ""}>Zurück</button><span>${count ? offset + 1 : 0}–${Math.min(offset + 500, count)} von ${count}</span><button class="button button--secondary button--small" data-admin-page="${kind}" data-offset="${offset + 500}" ${offset + 500 >= count ? "disabled" : ""}>Weitere anzeigen</button></div>`;
      content.innerHTML = `<p><strong>${escapeHtml(summary.eventTitle)}</strong></p><div class="event-content-admin__actions"><button class="button button--secondary" data-admin-delete-all="messages" ${!summary.messageCount ? "disabled" : ""}>Alle Chatnachrichten löschen (${summary.messageCount})</button><button class="button button--secondary" data-admin-delete-all="photos" ${!summary.photoCount ? "disabled" : ""}>Alle Teilnehmerfotos löschen (${summary.photoCount})</button><button class="button button--primary" data-admin-delete-all="all" ${!summary.messageCount && !summary.photoCount ? "disabled" : ""}>Chats und Fotos komplett löschen</button></div><h3>Chatnachrichten (${summary.messageCount})</h3><p>Gruppenchat und Direktchats dieses Events.</p>${summary.messageCount > 500 ? "<p>Bis zu 500 Nachrichten pro Seite.</p>" : ""}${pagination("messages", messageOffset, summary.messageCount)}<div>${summary.messages.map((item, index) => `<article class="event-content-admin__message"><small>${item.channelType === "groups" ? "Gruppenchat" : "Direktchat"} · ${escapeHtml(people.get(item.senderContactId) || "Teilnehmende Person")} · ${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString("de-DE") : "")}</small><p>${escapeHtml(item.text || "Kontaktnachricht")}</p><button class="button button--secondary button--small" data-admin-delete-message="${index}">Nachricht löschen</button></article>`).join("") || "<p>Keine Chatnachrichten.</p>"}</div><h3>Teilnehmerfotos (${summary.photoCount})</h3>${summary.photoCount > 500 ? "<p>Bis zu 500 Fotos pro Seite.</p>" : ""}${pagination("photos", photoOffset, summary.photoCount)}<div class="participant-photo-grid">${summary.photos.map((photo, index) => `<figure class="participant-photo-card" data-admin-photo="${index}"><button type="button" data-admin-photo-preview aria-label="Foto vergrößern"><img data-participant-photo-image alt="${escapeHtml(photo.caption || photo.fileName)}" hidden><span>${escapeHtml(photo.fileName || "Eventfoto")}</span></button><figcaption><p>${escapeHtml(photo.caption)}</p><small>${escapeHtml(photo.uploadedByName)}</small></figcaption><button class="button button--secondary button--small" data-admin-delete-photo="${index}">Foto löschen</button></figure>`).join("") || "<p>Keine Teilnehmerfotos.</p>"}</div>`;
      observer = new IntersectionObserver(entries => {
        entries.filter(entry => entry.isIntersecting).forEach(async entry => {
          observer.unobserve(entry.target);
          const photo = summary.photos[Number(entry.target.dataset.adminPhoto)];
          if (photo.status === "uploading") return;
          try {
            const url = await loadPortalParticipantPhoto(photo.id);
            if (!entry.target.isConnected) { URL.revokeObjectURL(url); return; }
            urls.add(url);
            const image = entry.target.querySelector("img");
            image.onload = () => { image.hidden = false; };
            image.src = url;
          } catch {}
        });
      }, { root: dialog, rootMargin: "150px" });
      content.querySelectorAll("[data-admin-photo]").forEach(card => observer.observe(card));
    };
    content.addEventListener("click", async event => {
      const page = event.target.closest("[data-admin-page]");
      if (page) {
        if (busy || page.disabled) return;
        busy = true;
        if (page.dataset.adminPage === "messages") messageOffset = Number(page.dataset.offset);
        else photoOffset = Number(page.dataset.offset);
        status.textContent = "Inhalte werden geladen …";
        try { await refresh(); status.textContent = ""; }
        catch (error) { status.textContent = error.message || "Laden fehlgeschlagen."; }
        finally { busy = false; }
        return;
      }
      const preview = event.target.closest("[data-admin-photo-preview]");
      if (preview) {
        const viewer = openParticipantPhoto(preview.closest("figure"), preview);
        if (viewer) { viewers.add(viewer); viewer.addEventListener("close", () => viewers.delete(viewer), { once: true }); }
        return;
      }
      const button = event.target.closest("[data-admin-delete-all], [data-admin-delete-message], [data-admin-delete-photo]");
      if (!button || busy || button.disabled) return;
      let data = { eventId, confirmed: true };
      let scope;
      if (button.hasAttribute("data-admin-delete-all")) {
        data = { ...data, kind: button.dataset.adminDeleteAll, all: true };
        scope = data.kind === "messages" ? `alle ${summary.messageCount} Chatnachrichten (Gruppenchat und Direktchats)` : data.kind === "photos" ? `alle ${summary.photoCount} Teilnehmerfotos` : `alle ${summary.messageCount} Chatnachrichten und ${summary.photoCount} Teilnehmerfotos`;
      } else if (button.hasAttribute("data-admin-delete-message")) {
        const item = summary.messages[Number(button.dataset.adminDeleteMessage)];
        data = { ...data, kind: "messages", channelType: item.channelType, channelId: item.channelId, messageId: item.id };
        scope = `diese Nachricht: „${item.text.slice(0, 120) || "Kontaktnachricht"}“`;
      } else {
        const photo = summary.photos[Number(button.dataset.adminDeletePhoto)];
        data = { ...data, kind: "photos", photoId: photo.id };
        scope = `dieses Foto: „${photo.fileName}“`;
      }
      if (!window.confirm(`Für „${summary.eventTitle}“ ${scope} endgültig löschen?\nDies kann nicht rückgängig gemacht werden.`)) return;
      busy = true;
      content.querySelectorAll("button").forEach(control => { control.disabled = true; });
      status.textContent = "Inhalte werden gelöscht …";
      try {
        const result = await call("adminDeleteEventContent", data);
        await refresh();
        status.textContent = `${result.deletedMessages} Chatnachrichten und ${result.deletedPhotos} Fotos gelöscht.`;
        document.dispatchEvent(new CustomEvent("participant-photos-seen"));
      } catch (error) {
        status.textContent = error.message || "Löschen fehlgeschlagen. Bitte den aktuellen Stand prüfen und erneut versuchen.";
        try { await refresh(); } catch {}
      } finally { busy = false; }
    });
    try { await refresh(); status.textContent = ""; }
    catch (error) { status.textContent = error.message || "Inhalte konnten nicht geladen werden."; }
  });
}
