const value = (input) => String(input ?? "").trim();

function eventInvitationDetails(event = {}) {
  const missing = [];
  const title = value(event.title);
  const date = value(event.date);
  const start = value(event.startTime);
  const end = value(event.endTime);
  if (!title) missing.push("Veranstaltungsname");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) missing.push("Datum");
  const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time);
  if (!validTime(start)) missing.push("Beginn");
  if (!validTime(end)) missing.push("Ende");
  const location = value(event.locationName);
  const address = value(event.address);
  const postalCode = value(event.postalCode || event.zipCode);
  const city = value(event.city);
  if (!event.isVirtualEvent) {
    if (!location) missing.push("Name der Location");
    if (!address) missing.push("Straße und Hausnummer der Location");
    if (!postalCode) missing.push("Postleitzahl der Location");
    if (!city) missing.push("Ort der Location");
  }
  if (missing.length) throw new Error(`Die Veranstaltungsangaben für die E-Mail sind unvollständig: ${missing.join(", ")}. Bitte zuerst im Event ergänzen.`);
  const formattedDate = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return [
    `Veranstaltung: ${title}`,
    `Datum: ${formattedDate}`,
    `Beginn: ${start.slice(0, 5)} Uhr · Ende: ${end.slice(0, 5)} Uhr`,
    event.isVirtualEvent ? `Location: ${value(event.onlineMeetingLabel) || location || "Online-Veranstaltung"}` : `Location: ${location}\nAdresse: ${address}, ${postalCode} ${city}`
  ].join("\n");
}

module.exports = { eventInvitationDetails };
