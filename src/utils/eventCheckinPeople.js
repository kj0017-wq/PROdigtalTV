function personName(person = {}) {
  return String(person.name || person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ") || "").trim();
}

function normalizedPersonName(person = {}) {
  return personName(person)
    .toLocaleLowerCase("de")
    .replace(/\b(?:prof(?:essor)?|dr|ra)\.?\s+/g, "")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim();
}

function normalizedEmail(person = {}) {
  return String(person.email || person.mail || person.contactEmail || "").trim().toLocaleLowerCase("de");
}

export function sameCheckinPerson(first = {}, second = {}) {
  const firstEmail = normalizedEmail(first);
  const secondEmail = normalizedEmail(second);
  if (firstEmail && secondEmail && firstEmail === secondEmail) return true;
  const firstName = normalizedPersonName(first);
  const secondName = normalizedPersonName(second);
  return Boolean(firstName && secondName && firstName === secondName);
}

export function splitEventCheckinPeople(eventSpeakers = [], boardMembers = []) {
  const board = Array.isArray(boardMembers) ? boardMembers : [];
  const speakers = (Array.isArray(eventSpeakers) ? eventSpeakers : [])
    .filter((speaker) => !board.some((member) => sameCheckinPerson(speaker, member)));
  return { boardMembers: board, speakers };
}
