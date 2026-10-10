import { escapeHtml } from "./format.js?v=3";

export function confirmNotificationPreview({ preview, summary, costs, recipients, sendLabel }) {
  if (!preview || (!preview.mail && preview.sms == null)) return Promise.reject(new Error("Nachrichtenvorschau ist nicht verfügbar. Bitte erneut vorbereiten."));
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.style.cssText = "width:min(920px,94vw);max-height:92dvh;padding:0;border:1px solid #dbe4f1;border-radius:20px;color:#071b34;";
    dialog.setAttribute("aria-labelledby", "notification-preview-heading");
    dialog.innerHTML = `<form method="dialog" style="display:flex;flex-direction:column;max-height:90dvh"><header style="padding:20px 24px;border-bottom:1px solid #dbe4f1"><h2 id="notification-preview-heading">Versandvorschau</h2><p>${escapeHtml(summary)}</p><p class="muted">Personalisiert für ${escapeHtml(preview.personName || preview.email || "dein Benutzerkonto")}${preview.email ? ` · ${escapeHtml(preview.email)}` : ""}</p>${recipients ? `<p>${escapeHtml(recipients)}</p>` : ""}${costs ? `<p><strong>${escapeHtml(costs)}</strong></p>` : ""}</header><div style="overflow:auto;padding:20px 24px;min-height:0">${preview.mail ? `<section><h3>E-Mail</h3><p><strong>Betreff:</strong> ${escapeHtml(preview.mail.subject)}</p><iframe title="Personalisierte E-Mail-Vorschau" sandbox="" referrerpolicy="no-referrer" style="display:block;width:100%;height:440px;border:1px solid #dbe4f1;border-radius:12px;background:white"></iframe></section>` : ""}${preview.sms != null ? `<section style="margin-top:20px"><h3>SMS</h3><div style="white-space:pre-wrap;overflow-wrap:anywhere;padding:20px;background:#eef3fa;border-radius:12px">${escapeHtml(preview.sms)}</div></section>` : ""}</div><footer class="actions" style="padding:16px 24px;border-top:1px solid #dbe4f1;flex-wrap:wrap"><button type="submit" class="button button--primary" value="send">${escapeHtml(sendLabel || "Senden")}</button><button type="submit" class="button button--secondary" value="cancel">Zurück zur Bearbeitung</button></footer></form>`;
    const iframe = dialog.querySelector("iframe");
    if (iframe) iframe.srcdoc = preview.mail.html;
    dialog.addEventListener("close", () => { const confirmed = dialog.returnValue === "send"; dialog.remove(); resolve(confirmed); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  });
}
