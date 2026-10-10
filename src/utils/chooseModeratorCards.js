import { escapeHtml } from "./format.js?v=3";
export function chooseModeratorCards(data) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "moderation-owner-dialog";
    dialog.innerHTML = `<form method="dialog" class="form-grid"><h2>Moderationskarten</h2><p>${escapeHtml(data.event.title || "Event")}</p><p class="muted">Kartensatz auswählen. Jeder Moderator bearbeitet seine eigenen Karten.</p><div class="selection-grid"><label class="selection-item"><input type="radio" name="owner" value="" checked><span><strong>Allgemeine Karten</strong><small>Bisheriger Kartensatz des Events</small></span></label>${(data.cardOwners || []).map(owner => `<label class="selection-item"><input type="radio" name="owner" value="${escapeHtml(owner.uid)}"><span><strong>${escapeHtml(owner.name)}</strong><small>${owner.count} gespeicherte Karten${owner.count ? "" : " · Aus dem Ablauf erstellen"}</small></span></label>`).join("")}</div><div class="actions"><button class="button button--primary" value="open">Karten öffnen</button><button class="button button--secondary" value="cancel">Abbrechen</button></div></form>`;
    dialog.addEventListener("close", () => {
      const owner = dialog.querySelector('input[name="owner"]:checked')?.value || "";
      resolve(dialog.returnValue === "open" ? owner : null);
      dialog.remove();
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  });
}
