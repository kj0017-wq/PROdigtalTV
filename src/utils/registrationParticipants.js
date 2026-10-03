export function registrationParticipants(registrations = []) {
  return registrations.flatMap((registration) => {
    const participantRole = registration.registrationRole === "additional_person" ? "Zusätzliche Person" : "Hauptperson";
    const primary = { ...registration, participantRole, bookingId: registration.id, bookingEmail: registration.registeredByEmail || registration.email || "" };
    const companion = registration.companion || {};
    if (!companion.firstName && !companion.lastName && !companion.email) return [primary];
    return [primary, {
      id: `${registration.id}:companion`,
      bookingId: registration.id,
      bookingEmail: registration.email || "",
      participantRole: "Begleitperson",
      eventId: registration.eventId,
      eventTitle: registration.eventTitle,
      eventDate: registration.eventDate,
      firstName: companion.firstName || "",
      lastName: companion.lastName || "",
      email: companion.email || "",
      phone: companion.phone || "",
      company: companion.company || "",
      position: companion.position || "",
      linkedIn: companion.linkedIn || "",
      status: registration.status,
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt
    }];
  });
}
