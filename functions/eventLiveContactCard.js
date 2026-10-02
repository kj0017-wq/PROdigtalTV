const { contactCardForMessage } = require("./eventLiveContactSharing");
function createContactCardReader({ db, eventLiveUser, eventLiveContactRequestId, HttpsError }) {
  return async request => {
    const { eventId, peerId } = request.data || {};
    if (![eventId, peerId].every(value => typeof value === "string" && value && !value.includes("/"))) throw new HttpsError("invalid-argument", "Veranstaltung und Kontakt fehlen.");
    const viewer = await eventLiveUser(request, eventId);
    const share = (await db.collection("eventLiveContactRequests").doc(eventLiveContactRequestId(eventId, viewer.contactId, peerId)).get()).data();
    if (!share || share.eventId !== eventId || share.senderContactId !== viewer.contactId || share.receiverContactId !== peerId || share.status !== "accepted") throw new HttpsError("permission-denied", "Diese Kontaktdaten sind noch nicht für Sie freigegeben.");
    const contact = (await db.collection("contacts").doc(peerId).get()).data();
    if (!contact) throw new HttpsError("not-found", "Kontakt nicht gefunden.");
    const card = { firstName: contact.firstName || "", lastName: contact.lastName || "", name: contact.name || contact.displayName || [contact.firstName, contact.lastName].filter(Boolean).join(" "), company: contact.company || "", position: contact.position || "", email: contact.email || "", phone: contact.phone || contact.mobile || "", linkedIn: contact.linkedIn || contact.linkedin || "" };
    return { card: await contactCardForMessage({ contactCard: card }) };
  };
}
module.exports = { createContactCardReader };
