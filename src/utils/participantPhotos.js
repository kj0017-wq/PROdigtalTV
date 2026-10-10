import { escapeHtml } from "./format.js?v=3";
import { deletePortalParticipantPhoto, loadPortalParticipantPhoto, listPortalParticipantPhotos, markPortalParticipantPhotosSeen } from "../firebase/portalGalleryPhotoService.js?v=6";

export function openParticipantPhoto(card, trigger) {
  const source = card.querySelector("[data-participant-photo-image]");
  if (!source?.src || !source.naturalWidth) return null;
  const dialog = document.createElement("dialog");
  dialog.className = "participant-photo-viewer";
  dialog.setAttribute("aria-label", "Eventfoto");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "button button--secondary participant-photo-viewer__close";
  close.textContent = "Schließen";
  close.addEventListener("click", () => dialog.close());
  const image = document.createElement("img");
  image.src = source.src;
  image.alt = source.alt || "Eventfoto";
  const caption = document.createElement("p");
  caption.textContent = card.querySelector("figcaption")?.textContent || source.alt || "";
  dialog.append(close, image, caption);
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger.isConnected) trigger.focus();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function mountParticipantPhotos(root) {
  if (root.dataset.bound) return;
  root.dataset.bound = "1";
  const addDeleteButtons = () => root.querySelectorAll('[data-photo-can-delete="1"]').forEach((card) => {
    if (card.querySelector("[data-participant-photo-delete]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "participant-photo-delete";
    button.dataset.participantPhotoDelete = "1";
    button.title = "Eigenes Foto löschen";
    button.setAttribute("aria-label", "Eigenes Foto löschen");
    button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
    card.querySelector("figcaption")?.append(button);
  });
  addDeleteButtons();
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-participant-photo-delete]");
    if (!button || !root.contains(button) || button.disabled) return;
    const card = button.closest("[data-participant-photo]");
    if (!window.confirm("Ihr Foto endgültig für alle Eventteilnehmer löschen?")) return;
    button.disabled = true;
    try {
      await deletePortalParticipantPhoto(root.dataset.eventId, card.dataset.participantPhoto);
      const url = card.querySelector("img")?.src;
      viewers.forEach((viewer) => { if (viewer.querySelector("img")?.src === url) viewer.close(); });
      observer.unobserve(card);
      viewedObserver.unobserve(card);
      visible.delete(card);
      seenPending.delete(card.dataset.participantPhoto);
      if (url && urls.has(url)) { URL.revokeObjectURL(url); urls.delete(url); }
      card.remove();
      if (!root.querySelector("[data-participant-photo]")) root.innerHTML = "<p>Noch keine Fotos für diese Veranstaltung.</p>";
      document.dispatchEvent(new CustomEvent("participant-photos-seen"));
    } catch (error) {
      button.disabled = false;
      let notice = card.querySelector("[data-photo-delete-error]");
      if (!notice) { notice = document.createElement("p"); notice.dataset.photoDeleteError = "1"; notice.setAttribute("role", "alert"); card.querySelector("figcaption").append(notice); }
      notice.textContent = error.message || "Foto konnte nicht gelöscht werden.";
    }
  });
  const urls = new Set();
  const viewers = new Set();
  root.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-participant-photo-link]");
    if (!trigger || !root.contains(trigger)) return;
    event.preventDefault();
    const viewer = openParticipantPhoto(trigger.closest("[data-participant-photo]"), trigger);
    if (viewer) {
      viewers.add(viewer);
      viewer.addEventListener("close", () => { viewers.delete(viewer); visible.forEach(markViewed); }, { once: true });
    }
  });
  const pending = [];
  let running = 0;
  let disposed = false;
  const visible = new Set();
  const seenPending = new Set();
  let seenTimer;
  let savingSeen = false;
  const flushSeen = async () => {
    if (savingSeen || !seenPending.size) return;
    savingSeen = true;
    const ids = [...seenPending].slice(0, 100);
    try {
      const { marked } = await markPortalParticipantPhotosSeen(root.dataset.eventId, ids);
      marked.forEach((id) => {
        seenPending.delete(id);
        root.querySelectorAll("[data-participant-photo]").forEach((card) => {
          if (card.dataset.participantPhoto === id) card.dataset.photoUnread = "0";
        });
      });
      document.dispatchEvent(new CustomEvent("participant-photos-seen"));
    } catch {
      // Keep unseen photos in the counter when saving fails; retry while the gallery is open.
    } finally {
      savingSeen = false;
      if (!disposed && seenPending.size) seenTimer = window.setTimeout(flushSeen, 5000);
    }
  };
  const markViewed = (card) => {
    const image = card.querySelector("[data-participant-photo-image]");
    if (document.visibilityState === "hidden" || viewers.size || !visible.has(card) || !image?.naturalWidth
      || card.dataset.photoUnread !== "1") return;
    seenPending.add(card.dataset.participantPhoto);
    window.clearTimeout(seenTimer);
    seenTimer = window.setTimeout(flushSeen, 750);
  };
  const viewedObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.3) { visible.add(entry.target); markViewed(entry.target); }
      else visible.delete(entry.target);
    });
  }, { threshold: 0.3 });
  const onVisibility = () => { if (document.visibilityState !== "hidden") visible.forEach(markViewed); };
  document.addEventListener("visibilitychange", onVisibility);
  const load = async (card) => {
    running++;
    const status = card.querySelector("[data-participant-photo-status]");
    try {
      const url = await loadPortalParticipantPhoto(card.dataset.participantPhoto);
      if (disposed || !root.isConnected) { URL.revokeObjectURL(url); return; }
      urls.add(url);
      const image = card.querySelector("[data-participant-photo-image]");
      const link = card.querySelector("[data-participant-photo-link]");
      // These images arrive after an authenticated request and manage their own loading state.
      image.classList.remove("is-broken-image");
      link.classList.remove("image-load-failed");
      image.onload = () => {
        image.classList.remove("is-broken-image");
        link.classList.remove("image-load-failed");
        image.hidden = false;
        status.hidden = true;
        markViewed(card);
      };
      image.onerror = () => {
        image.hidden = true;
        status.hidden = false;
        status.textContent = "Dieses Bildformat kann im Browser nicht angezeigt werden.";
      };
      image.src = url;

    } catch (error) {
      if (status) status.textContent = error.message || "Foto konnte nicht geladen werden.";
    } finally {
      running--;
      drain();
    }
  };
  const drain = () => {
    while (!disposed && running < 3 && pending.length) load(pending.shift());
  };
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      observer.unobserve(entry.target);
      pending.push(entry.target);
    });
    drain();
  }, { rootMargin: "300px" });
  root.querySelectorAll("[data-participant-photo]").forEach((card) => {
    observer.observe(card);
    viewedObserver.observe(card);
  });
  let refreshing = false;
  const refreshPhotos = async () => {
    if (disposed || refreshing || document.visibilityState === "hidden" || !root.isConnected) return;
    refreshing = true;
    try {
      const { photos = [] } = await listPortalParticipantPhotos(root.dataset.eventId);
      if (disposed || !root.isConnected) return;
      const available = new Set(photos.filter(photo => photo.eventId === root.dataset.eventId).map(photo => photo.id));
      let removed = false;
      root.querySelectorAll("[data-participant-photo]").forEach(card => {
        if (available.has(card.dataset.participantPhoto)) return;
        observer.unobserve(card);
        viewedObserver.unobserve(card);
        visible.delete(card);
        seenPending.delete(card.dataset.participantPhoto);
        const url = card.querySelector("[data-participant-photo-image]")?.src;
        viewers.forEach(viewer => { if (viewer.querySelector("img")?.src === url) viewer.close(); });
        if (url && urls.has(url)) { URL.revokeObjectURL(url); urls.delete(url); }
        card.remove();
        removed = true;
      });
      const existing = new Set([...root.querySelectorAll("[data-participant-photo]")].map(card => card.dataset.participantPhoto));
      const additions = photos.filter(photo => photo.eventId === root.dataset.eventId && !existing.has(photo.id));
      additions.reverse().forEach(photo => {
        const card = document.createElement("figure");
        card.className = "participant-photo-card";
        card.dataset.participantPhoto = photo.id;
        card.dataset.photoUnread = photo.unread ? "1" : "0";
        card.dataset.photoCanDelete = photo.canDelete ? "1" : "0";
        card.innerHTML = `<button type="button" data-participant-photo-link aria-label="Foto vergrößern"><img data-participant-photo-image alt="${escapeHtml(photo.caption || photo.fileName || "Eventfoto")}" hidden><span data-participant-photo-status>Foto wird geladen …</span></button><figcaption>${photo.caption ? `<p>${escapeHtml(photo.caption)}</p>` : ""}<small>${escapeHtml(photo.uploadedByName || "Eventteilnehmer")}</small></figcaption>`;
        root.querySelector(":scope > p, :scope > .alert")?.remove();
        root.prepend(card);
        observer.observe(card);
        viewedObserver.observe(card);
      });
      addDeleteButtons();
      if (additions.length || removed) document.dispatchEvent(new CustomEvent("participant-photos-seen"));
    } catch (error) {
      if (/permission-denied|unauthenticated/.test(error.code || "")) {
        cleanup();
        root.textContent = "Der Fotozugang für diese Veranstaltung ist nicht mehr verfügbar.";
      }
    } finally { refreshing = false; }
  };
  const refreshInterval = window.setInterval(refreshPhotos, 15000);
  document.addEventListener("visibilitychange", refreshPhotos);
  window.addEventListener("focus", refreshPhotos);
  const cleanup = () => {
    disposed = true;
    window.clearInterval(refreshInterval);
    document.removeEventListener("visibilitychange", refreshPhotos);
    window.removeEventListener("focus", refreshPhotos);
    observer.disconnect();
    viewedObserver.disconnect();
    window.clearTimeout(seenTimer);
    flushSeen();
    document.removeEventListener("visibilitychange", onVisibility);
    changes.disconnect();
    viewers.forEach((viewer) => { viewer.close(); viewer.remove(); });
    viewers.clear();
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.clear();
    window.removeEventListener("pagehide", cleanup);
  };
  const changes = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
  changes.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("pagehide", cleanup, { once: true });
}

export function mountParticipantPhotoBadges(root) {
  if (!root || root.dataset.photoBadgesBound) return;
  root.dataset.photoBadgesBound = "1";
  let running = false;
  let refreshAgain = false;
  const refresh = async () => {
    if (!root.isConnected) { cleanup(); return; }
    if (document.visibilityState === "hidden") return;
    if (running) { refreshAgain = true; return; }
    running = true;
    try {
      const summary = await listPortalParticipantPhotos();
      if (!root.isConnected) return;
      root.querySelectorAll("[data-participant-photo-badge]").forEach((badge) => {
        const eventId = badge.dataset.participantPhotoBadge;
        const count = eventId ? summary.events.find((event) => event.eventId === eventId)?.unreadCount || 0 : summary.unreadCount;
        badge.textContent = String(count || 0);
        badge.hidden = !count;
        badge.setAttribute("aria-label", `${count || 0} ungesehene Fotos`);
      });
    } catch {
      // Preserve the last known count when the connection is temporarily unavailable.
    } finally {
      running = false;
      if (refreshAgain && root.isConnected) { refreshAgain = false; refresh(); }
    }
  };
  const interval = window.setInterval(refresh, 60000);
  const cleanup = () => {
    window.clearInterval(interval);
    document.removeEventListener("participant-photos-seen", refresh);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("pagehide", cleanup);
  };
  document.addEventListener("participant-photos-seen", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pagehide", cleanup, { once: true });
  refresh();
}
