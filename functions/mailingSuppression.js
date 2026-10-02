const DAY_MS = 24 * 60 * 60 * 1000;

function normalizedEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return new Date(value || 0).getTime() || 0;
}

function mailingSuppressionDue(mail = {}, now = Date.now()) {
  if (mail.mailingSuppressedAt || !normalizedEmail(mail.to).includes("@")) return false;
  if (mail.deliveryStatus === "bounced") return true;
  if (mail.deliveryStatus !== "delayed") return false;
  const sentAt = timestampMillis(mail.sentAt || mail.queuedAt || mail.createdAt);
  return sentAt > 0 && now - sentAt >= DAY_MS;
}

function memberHasEmail(member = {}, email = "") {
  const values = [member.email, member.contactEmail, member.contact_email, member.primaryEmail,
    member.profileEmail, member.billingEmail, member.invoiceEmail];
  for (const key of ["emails", "additionalEmails", "alternateEmails", "contactEmails", "notificationEmails"]) {
    if (Array.isArray(member[key])) values.push(...member[key]);
  }
  for (const key of ["eventContacts", "contacts"]) {
    if (Array.isArray(member[key])) member[key].forEach((contact) => values.push(contact?.email, contact?.contactEmail));
  }
  return values.some((value) => normalizedEmail(value) === email);
}

async function suppressMailingAddress({ db, FieldValue, mailRef, mail, directory }) {
  if (!mailingSuppressionDue(mail)) return false;
  const email = normalizedEmail(mail.to);
  const [contactList, userList, speakerList, memberList] = directory || await Promise.all([
    db.collection("contacts").get(), db.collection("users").get(),
    db.collection("speakers").get(), db.collection("members").get()
  ]);
  const registrations = await db.collection("registrations").where("email", "==", email).get();
  const now = FieldValue.serverTimestamp();
  const reason = mail.deliveryStatus === "bounced" ? "permanent_bounce" : "delivery_delayed_over_24h";
  const writes = [];
  const disabled = { mailingDisabled: true, mailingSuppressionReason: reason,
    mailingSuppressionMailId: mailRef.id, mailingSuppressedAt: now, updatedAt: now };
  contactList.docs.forEach((doc) => {
    if (normalizedEmail(doc.data().email) === email) writes.push([doc.ref, disabled]);
  });
  userList.docs.forEach((doc) => {
    if (normalizedEmail(doc.data().email) === email) writes.push([doc.ref, {
      mailingExcludedEmails: FieldValue.arrayUnion(email), updatedAt: now
    }]);
  });
  speakerList.docs.forEach((doc) => {
    const speaker = doc.data();
    if (normalizedEmail(speaker.email || speaker.mail || speaker.contactEmail) === email) writes.push([doc.ref, disabled]);
  });
  memberList.docs.forEach((doc) => {
    if (memberHasEmail(doc.data(), email)) writes.push([doc.ref, {
      mailingExcludedEmails: FieldValue.arrayUnion(email), updatedAt: now
    }]);
  });
  registrations.docs.forEach((doc) => writes.push([doc.ref, disabled]));
  writes.push([mailRef, { mailingSuppressedAt: now, mailingSuppressionReason: reason, updatedAt: now }]);
  for (let index = 0; index < writes.length; index += 400) {
    const batch = db.batch();
    writes.slice(index, index + 400).forEach(([ref, update]) => batch.set(ref, update, { merge: true }));
    await batch.commit();
  }
  return true;
}

async function suppressDueMailingBounces({ db, FieldValue }) {
  const snapshot = await db.collection("mailQueue").where("deliveryStatus", "in", ["bounced", "delayed"]).get();
  const due = snapshot.docs.filter((document) => mailingSuppressionDue(document.data()));
  if (!due.length) return { suppressed: 0, errors: 0 };
  const directory = await Promise.all([
    db.collection("contacts").get(), db.collection("users").get(),
    db.collection("speakers").get(), db.collection("members").get()
  ]);
  let suppressed = 0;
  let errors = 0;
  for (const document of due) {
    try {
      if (await suppressMailingAddress({ db, FieldValue, mailRef: document.ref, mail: document.data(), directory })) suppressed++;
    } catch (error) {
      errors++;
      console.error("Mailing-Sperre fehlgeschlagen", { mailId: document.id, error: error.message || String(error) });
    }
  }
  return { suppressed, errors };
}

module.exports = { mailingSuppressionDue, memberHasEmail, suppressMailingAddress, suppressDueMailingBounces };
