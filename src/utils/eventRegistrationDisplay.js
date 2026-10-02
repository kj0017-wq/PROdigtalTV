export function eventRegistrationCtaState({ registrationAllowed = false, storedTicket = null } = {}) {
  if (storedTicket) return storedTicket.status === "checked_in" ? "checked_in" : "confirmed";
  return registrationAllowed ? "open" : "closed";
}
