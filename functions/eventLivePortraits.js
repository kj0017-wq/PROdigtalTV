const normalized = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const name = (person) => normalized(person.name || person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" "));
const photo = (person) => person.photoUrl || person.imageUrl || person.thumbnailUrl || person.portraitUrl || person.profileImageUrl || person.assetUrl || "";

function eventLivePortrait(contact, registration, sources) {
  const records = sources.filter((item) => !["archived", "deleted", "inactive"].includes(normalized(item.status)));
  const linked = records.find((item) => item.id && (item.id === registration.sourcePersonId || item.id === contact.boardMemberId || item.id === contact.speakerId));
  if (linked && photo(linked)) return photo(linked);
  const email = normalized(contact.email || registration.email);
  const byEmail = records.filter((item) => email && normalized(item.email) === email);
  if (byEmail.length === 1 && photo(byEmail[0])) return photo(byEmail[0]);
  // Name fallback supplies only an existing public portrait, never identity or access rights.
  const fullName = name(contact) || name(registration);
  const byName = records.filter((item) => fullName && name(item) === fullName);
  return byName.length === 1 ? photo(byName[0]) : "";
}
function publicPersonSource(contact, registration, sources) {
  // Only reuse public profiles; ambiguous names must not assign somebody else's vita.
  const records = sources.filter(item =>
    ["active", "published", "approved"].includes(normalized(item.status))
    && !["internal", "private", "members"].includes(normalized(item.visibility)));
  const linked = records.filter(item => item.id &&
    (item.id === registration.sourcePersonId || item.id === contact.boardMemberId || item.id === contact.speakerId));
  const email = normalized(contact.email || registration.email);
  const byEmail = records.filter(item => email && normalized(item.email) === email);
  const fullName = name(contact) || name(registration);
  const byName = records.filter(item => fullName && name(item) === fullName);
  const matches = linked.length ? linked : byEmail.length ? byEmail : byName;
  return matches.length === 1 ? matches[0] : null;
}
function eventLiveBiography(contact, registration, sources) {
  const source = publicPersonSource(contact, registration, sources);
  if (!source) return "";
  return String(source.longBio || source.vita || source.biography || source.bodyText
    || source.longDescription || source.profileText || source.shortBio || source.bio
    || source.introText || source.description || "").trim();
}
function eventLiveBoardRole(contact, registration, boardMembers) {
  const source = publicPersonSource(contact, registration, boardMembers);
  return source ? String(source.role || "Vorstand").trim() : "";
}
function eventLiveCompanyLogo(contact, registration, sources, topics = [], eventId = "") {
  const source = publicPersonSource(contact, registration, sources);
  if (!source) return "";
  const logo = item => String(item.companyLogoUrl || item.companyLogo || item.logoUrl || item.company_logo_url || item.company_logo || "").trim();
  if (logo(source)) return logo(source);
  // A talk's logo belongs to its main speaker, not automatically to every co-speaker.
  const matches = topics.filter(topic => eventId && source.id
    && [topic.eventId, ...(Array.isArray(topic.eventIds) ? topic.eventIds : [])].includes(eventId)
    && ["active", "published", "approved"].includes(normalized(topic.status))
    && !["internal", "private", "members", "hidden"].includes(normalized(topic.visibility))
    && (topic.speakerId === source.id || (!topic.speakerId && Array.isArray(topic.speakerIds)
      && topic.speakerIds.length === 1 && topic.speakerIds[0] === source.id)));
  const logos = [...new Set(matches.map(logo).filter(Boolean))];
  return logos.length === 1 ? logos[0] : "";
}
module.exports = { eventLivePortrait, eventLiveBiography, eventLiveBoardRole, eventLiveCompanyLogo };
