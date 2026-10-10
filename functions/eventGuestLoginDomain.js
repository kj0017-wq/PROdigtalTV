function clean(value) { return String(value || "").trim(); }
function emailOf(value) { return clean(value).toLowerCase(); }

function eligibleGuestCandidates(registrations, email) {
  const target = emailOf(email);
  return registrations.flatMap(({ id, ...registration }) => {
    if (!["confirmed", "checked_in"].includes(clean(registration.status))) return [];
    return [registration, registration.companion || {}]
      .filter((person) => emailOf(person.email) === target)
      .map((person) => ({ registrationId: id, registration, person }));
  });
}

function guestPasswordNeedsSetup(authUser, profile = {}) {
  return !authUser || profile.guestPasswordTemporary === true;
}

function guestIdentityConflict(person = {}, contact = {}) {
  const firstName = clean(person.firstName).toLocaleLowerCase("de");
  const contactName = clean(contact.firstName).toLocaleLowerCase("de");
  return Boolean(firstName && contactName && firstName !== contactName);
}

module.exports = { eligibleGuestCandidates, guestPasswordNeedsSetup, guestIdentityConflict };
