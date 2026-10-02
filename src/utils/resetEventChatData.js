export async function resetEventChatData(service, eventId) {
  const response = await service.clearEventLiveMessages(eventId);
  if (response?.cleared !== true) throw new Error("Der Server hat die Löschung nicht bestätigt. Bitte erneut prüfen.");
  if (Number.isFinite(response?.resetCount)) return { cleared: true, resetCount: response.resetCount };
  try {
    const contacts = await service.resetEventLiveContactRequests(eventId);
    if (!Number.isFinite(contacts?.resetCount)) throw new Error("Zurücksetzen der Kontaktanfragen wurde nicht bestätigt.");
    return { cleared: true, resetCount: contacts.resetCount };
  } catch (error) {
    throw new Error(`Chatnachrichten wurden gelöscht, aber Kontaktanfragen und Freigaben konnten nicht vollständig zurückgesetzt werden: ${error.message || "Bitte erneut versuchen."}`);
  }
}
