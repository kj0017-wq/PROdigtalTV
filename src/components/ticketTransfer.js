import { escapeHtml } from "../utils/format.js";

export function isMobileTicketDevice(device = navigator) {
  return /Android|iPhone|iPad|iPod/i.test(device.userAgent || "")
    || (device.platform === "MacIntel" && device.maxTouchPoints > 1);
}

export function ticketTransfer(link) {
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=4&data=${encodeURIComponent(link)}`;
  return `<section class="ticket-confirmation-box" style="margin-top:24px">
    <h2>Handy-Ticket auf Ihr Smartphone laden</h2>
    <p>Scannen Sie diesen QR-Code mit der Kamera Ihres Handys und oeffnen Sie den Link. Ihr persoenliches Ticket wird dann auf dem Handy gespeichert.</p>
    <img src="${escapeHtml(qr)}" alt="Persoenlichen Ticket-Link mit dem Handy scannen" style="display:block;width:240px;max-width:100%;height:auto;margin:16px auto">
    <p>Das Speichern auf diesem Computer ersetzt nicht das Ticket auf Ihrem Handy. Teilen Sie diesen persoenlichen QR-Code nicht mit anderen.</p>
  </section>`;
}
