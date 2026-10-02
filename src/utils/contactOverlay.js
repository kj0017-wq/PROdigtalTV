import { escapeHtml } from "./format.js";
import { getFirebaseServices } from "../firebase/firebaseClient.js?v=2";

export async function openContactOverlay(eventId, peerId) {
  document.querySelector("[data-contact-overlay]")?.remove();
  const dialog = document.createElement("dialog");
  dialog.dataset.contactOverlay = "";
  dialog.className = "event-contact-overlay";
  dialog.innerHTML = '<form method="dialog"><button type="submit" aria-label="Schließen">✕</button></form><div data-contact-content role="status">Kontaktdaten werden geladen …</div>';
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.showModal();
  const content = dialog.querySelector("[data-contact-content]");
  try {
    const firebase = await getFirebaseServices();
    const { data } = await firebase.functionsLib.httpsCallable(firebase.functions, "getEventLiveContactCard")({ eventId, peerId });
    if (!dialog.isConnected) return;
    const card = data.card;
    content.innerHTML = `<h2>${escapeHtml(card.name)}</h2><p>${escapeHtml([card.position, card.company].filter(Boolean).join(" · "))}</p><dl>${[["E-Mail", card.email], ["Telefon", card.phone], ["LinkedIn", card.linkedIn]].map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value || "Nicht angegeben")}</dd>`).join("")}</dl><img src="${escapeHtml(card.qrCode)}" alt="QR-Code zum Kontaktimport" width="240" height="240"><a class="button button--primary" download="kontakt.vcf" href="data:text/vcard;charset=utf-8,${encodeURIComponent(card.vcard)}">Kontakt speichern</a>`;
  } catch (error) { if (dialog.isConnected) content.textContent = error.message || "Kontaktdaten konnten nicht geladen werden."; }
}
