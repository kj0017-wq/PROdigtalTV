export const membershipInterestLabels = {
  personal_membership_interest: "Einzelmitgliedschaft",
  corporate_membership_interest: "Firmenmitgliedschaft",
  send_information_and_follow_up: "Informationsbedarf"
};

export function isAcquisitionFilter(value) {
  return value === "acquisition" || Object.hasOwn(membershipInterestLabels, value);
}

export function filterFeedback(records, { eventId = "", followUpStatus = "", manualStatus = "", contactConsent = "" } = {}) {
  return records.filter((item) =>
    (!eventId || item.eventId === eventId) &&
    (!followUpStatus || (followUpStatus === "acquisition"
      ? Object.hasOwn(membershipInterestLabels, item.followUpStatus)
      : item.followUpStatus === followUpStatus)) &&
    (!manualStatus || (item.manualStatus || "offen") === manualStatus) &&
    (!contactConsent || (item.contactConsent || "unknown") === contactConsent)
  );
}

export function feedbackFilterOptions(params) {
  return Object.fromEntries(["eventId", "followUpStatus", "manualStatus", "contactConsent"].map((key) => [key, params.get(key) || ""]));
}
