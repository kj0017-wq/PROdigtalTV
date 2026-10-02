function createEventLiveTestUser({ eventLiveUser, requireAdmin, db, contactId, HttpsError }) {
  return async (request, eventId) => {
    const viewer = await eventLiveUser(request, eventId);
    const target = request.data?.adminTestContactId;
    if (!target) return viewer;
    await requireAdmin(request);
    if (typeof target !== "string" || target.includes("/")) throw new HttpsError("invalid-argument", "Ungültige Testperson.");
    const snapshot = await db.collection("registrations").where("eventId", "==", eventId).where("status", "==", "checked_in").get();
    const registration = snapshot.docs.map(doc => doc.data()).find(item =>
      item.checkedInEventId === eventId && item.email && contactId(item.email) === target);
    if (!registration) throw new HttpsError("permission-denied", "Nur eingecheckte Teilnehmer können getestet werden.");
    return { ...viewer, email: registration.email.trim().toLowerCase(), contactId: target, member: null,
      isMember: false, adminTest: true, adminActorUid: request.auth.uid };
  };
}
module.exports = { createEventLiveTestUser };
