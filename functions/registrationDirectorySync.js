function personPatch(person, clearEmpty = false) {
  const patch = {};
  for (const key of ["firstName", "lastName", "company", "position", "linkedIn"]) {
    const value = String(person[key] || "").trim();
    if (value || clearEmpty) patch[key] = value;
  }
  const phone = String(person.phone || person.mobile || "").trim();
  if (phone || clearEmpty) { patch.phone = phone; patch.mobile = phone; }
  const name = [person.firstName, person.lastName].map(value => String(value || "").trim()).filter(Boolean).join(" ");
  if (name) patch.name = name;
  return patch;
}
const normalizedEmail = value => String(value || "").trim().toLowerCase();
function memberPatch(member, originalEmail, person, clearEmpty = false) {
  const patch = {};
  const fields = personPatch(person, clearEmpty);
  for (const key of ["eventContacts", "contacts"]) {
    if (!Array.isArray(member[key])) continue;
    if (member[key].some(contact => normalizedEmail(contact.email || contact.contactEmail) === originalEmail)) {
      patch[key] = member[key].map(contact => normalizedEmail(contact.email || contact.contactEmail) === originalEmail ? { ...contact, ...fields } : contact);
    }
  }
  if ([member.email, member.contactEmail, member.primaryEmail].some(email => normalizedEmail(email) === originalEmail)) {
    if (fields.phone !== undefined) { patch.phone = fields.phone; patch.mobile = fields.phone; patch.contactPhone = fields.phone; }
    if (fields.name) { patch.contactName = fields.name; patch.profileContactName = fields.name; }
    if (fields.position !== undefined) patch.contactPosition = fields.position;
    if (fields.linkedIn !== undefined) patch.contactLinkedIn = fields.linkedIn;
  }
  return patch;
}
async function directorySyncPlan(db, person, originalEmail, contactId, now, clearEmpty = false) {
  const email = normalizedEmail(originalEmail || person.email);
  if (!email) return [];
  const [contacts, users, members] = await Promise.all([
    db.collection("contacts").where("email", "==", email).get(),
    db.collection("users").where("email", "==", email).get(),
    db.collection("members").get()
  ]);
  const fields = personPatch(person, clearEmpty);
  const linkedMemberIds = new Set(users.docs.map(doc => doc.data().memberId).filter(Boolean));
  const matchingMembers = members.docs.filter(doc => linkedMemberIds.has(doc.id) || Object.keys(memberPatch(doc.data(), email, person, clearEmpty)).length);
  const plans = contacts.docs.map(doc => ({ ref: doc.ref, patch: () => ({ ...fields, updatedAt: now }) }));
  if (!contacts.docs.length && (users.docs.length || matchingMembers.length || clearEmpty)) plans.push({ ref: db.collection("contacts").doc(contactId(email)), patch: existing => ({ ...fields, email, ...(existing ? {} : { status: "active", source: "cms_admin_registration", createdAt: now }), updatedAt: now }) });
  for (const doc of users.docs) plans.push({ ref: doc.ref, patch: () => ({ ...fields, ...(fields.name ? { displayName: fields.name } : {}), updatedAt: now }) });
  for (const doc of matchingMembers) {
    plans.push({ ref: doc.ref, patch: latest => {
      const patch = memberPatch(latest || {}, email, person, clearEmpty);
      if (!Object.keys(patch).length && linkedMemberIds.has(doc.id)) patch.eventContacts = [...(latest?.eventContacts || []), { ...fields, email }];
      return { ...patch, updatedAt: now };
    } });
  }
  return plans;
}
module.exports = { personPatch, memberPatch, directorySyncPlan };
