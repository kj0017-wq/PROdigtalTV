export function confirmChatReset(eventTitle) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "chat-reset-dialog";
    dialog.setAttribute("aria-labelledby", "chat-reset-title");
    dialog.innerHTML = `<form method="dialog"><h2 id="chat-reset-title">Chats und Kontaktanfragen zurücksetzen?</h2><p data-reset-event></p><p>Alle Chatnachrichten, geteilten Kontaktkarten, Kontaktdatenanfragen und Kontaktfreigaben aller Teilnehmer dieses Events werden unwiderruflich gelöscht. Profile und bereits auf Geräten gespeicherte Kontakte bleiben erhalten.</p><div class="actions"><button class="button button--secondary" value="cancel" autofocus>Abbrechen</button><button class="button button--danger" value="confirm">Chats und Kontaktanfragen löschen</button></div></form>`;
    dialog.querySelector("[data-reset-event]").textContent = eventTitle;
    dialog.addEventListener("close", () => {
      const confirmed = dialog.returnValue === "confirm";
      dialog.remove();
      previousFocus?.focus();
      resolve(confirmed);
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  });
}
