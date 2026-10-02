function createAdminProfileUpdater({ db, requireAdmin, contactId, FieldValue, HttpsError }) {
  return async request => {
    await requireAdmin(request);
    const { eventId, targetContactId, profile } = request.data || {};
    if (typeof eventId !== "string" || !eventId || eventId.includes("/")
      || typeof targetContactId !== "string" || !targetContactId || targetContactId.includes("/")
      || !profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new HttpsError("invalid-argument", "Bitte Event und Teilnehmerprofil angeben.");
    }
    const limits = { title: 180, firstName: 180, lastName: 180, company: 180, position: 180, biography: 2400, companyProfile: 2400, website: 300, photoStoragePath: 1500, companyLogoStoragePath: 1500 };
    const update = {};
    for (const [field, value] of Object.entries(profile)) {
      if (!Object.hasOwn(limits, field) || typeof value !== "string" || value.trim().length > limits[field]) {
        throw new HttpsError("invalid-argument", "Dieses Profilfeld kann nicht gespeichert werden.");
      }
      update[field] = value.trim();
    }
    if (!Object.keys(update).length) throw new HttpsError("invalid-argument", "Keine Profilfelder angegeben.");
    if (update.photoStoragePath !== undefined
      && (!update.photoStoragePath.startsWith("event-live-profiles/" + request.auth.uid + "/profile-")
        || !/^event-live-profiles\/[^/]+\/profile-\d+\.jpg$/.test(update.photoStoragePath))) {
      throw new HttpsError("invalid-argument", "Bitte das Profilfoto über den Foto-Editor hochladen.");
    }
    if (update.website) {
      // Website validation is independent of uploaded media.
      let url;
      try { url = new URL(update.website); } catch {}
      if (!url || !["https:", "http:"].includes(url.protocol)) throw new HttpsError("invalid-argument", "Bitte eine Website mit https:// oder http:// eingeben.");
    }
    if (update.companyLogoStoragePath !== undefined &&
      (!update.companyLogoStoragePath.startsWith("event-live-profiles/" + request.auth.uid + "/profile-") ||
      !/^event-live-profiles\/[^/]+\/profile-\d+\.jpg$/.test(update.companyLogoStoragePath))) {
      throw new HttpsError("invalid-argument", "Bitte das Logo über den Bild-Editor hochladen.");
    }
    const registrations = await db.collection("registrations").where("eventId", "==", eventId).get();
    const registration = registrations.docs.map(doc => doc.data()).find(item =>
      item.status === "checked_in" && item.checkedInEventId === eventId && item.email && contactId(item.email) === targetContactId);
    if (!registration) throw new HttpsError("not-found", "Diese Person ist nicht bei diesem Event eingecheckt.");
    const ref = db.collection("contacts").doc(targetContactId);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() || {};
      if (update.firstName !== undefined || update.lastName !== undefined) {
        update.name = [update.firstName ?? current.firstName ?? registration.firstName,
          update.lastName ?? current.lastName ?? registration.lastName].filter(Boolean).join(" ");
      }
      transaction.set(ref, {
        ...(!snapshot.exists ? { id: targetContactId, email: registration.email, createdAt: FieldValue.serverTimestamp() } : {}),
        ...update,
        updatedAt: FieldValue.serverTimestamp(),
        eventLiveProfileUpdatedAt: FieldValue.serverTimestamp(),
        eventLiveProfileUpdatedBy: request.auth.uid
      }, { merge: true });
    });
    return { saved: true };
  };
}
module.exports = { createAdminProfileUpdater };
