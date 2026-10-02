export function mailTime(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function mailQueueRecipient(mail = {}) {
  const stored = String(mail.to || "").trim();
  if (stored) return stored;
  const accepted = Array.isArray(mail.providerAccepted) ? mail.providerAccepted : [];
  const rejected = Array.isArray(mail.providerRejected) ? mail.providerRejected : [];
  const recipients = [...accepted, ...rejected]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(recipients)].join(", ");
}

export function mailPeriod(query = new URLSearchParams(), now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fallbackFrom = new Date(today);
  fallbackFrom.setDate(today.getDate() - 29);
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
  const from = valid(query.get("from")) ? query.get("from") : [fallbackFrom.getFullYear(), String(fallbackFrom.getMonth() + 1).padStart(2, "0"), String(fallbackFrom.getDate()).padStart(2, "0")].join("-");
  const to = valid(query.get("to")) ? query.get("to") : [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  return { from, to, start: new Date(`${from}T00:00:00`).getTime(), end: new Date(`${to}T23:59:59.999`).getTime(), valid: from <= to };
}

export function mailPersonMatches(mail = {}, query = "", additionalNames = []) {
  const normalize = (value) => String(value || "").trim().toLocaleLowerCase("de").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = normalize([
    mail.to, mail.replyTo,
    ...(Array.isArray(mail.providerAccepted) ? mail.providerAccepted : []),
    ...(Array.isArray(mail.providerRejected) ? mail.providerRejected : []),
    mail.personName, mail.firstName, mail.lastName,
    mail.name, mail.company, ...additionalNames
  ].filter(Boolean).join(" "));
  return terms.every((term) => text.includes(term));
}

export function eventMailFunnel(mails = [], registrations = [], notifications = [], eventId = "", end = Infinity) {
  const tests = new Set(notifications.filter((item) => item.testOnly === true).map((item) => item.id));
  const activeRegistration = (registration) => !registration.deleted && !registration.archived && !registration.inactive
    && ["confirmed", "checked_in"].includes(String(registration.status || "").toLowerCase());
  const byEmail = new Map();
  registrations.filter((item) => item.eventId === eventId && activeRegistration(item)).forEach((item) => {
    const email = String(item.email || "").trim().toLowerCase();
    if (!email) return;
    const time = mailTime(item.confirmedAt || item.createdAt || item.submittedAt);
    if (!byEmail.has(email) || time < mailTime(byEmail.get(email).confirmedAt || byEmail.get(email).createdAt || byEmail.get(email).submittedAt)) byEmail.set(email, item);
  });
  const recipients = new Map();
  for (const mail of mails) {
    if (mail.eventId !== eventId || mail.type !== "event_notification" || mail.status !== "sent"
      || mail.audienceType === "registered" || mail.surveyId || tests.has(mail.notificationId)) continue;
    const email = String(mail.to || "").trim().toLowerCase();
    const sent = mailTime(mail.sentAt || mail.queuedAt || mail.createdAt);
    if (!email || !sent) continue;
    const booking = byEmail.get(email);
    const bookingTime = booking ? mailTime(booking.confirmedAt || booking.createdAt || booking.submittedAt) : 0;
    if (bookingTime && bookingTime <= sent) continue;
    const current = recipients.get(email) || { firstSent: sent, opened: false, clicked: false, firstClick: 0 };
    current.firstSent = Math.min(current.firstSent, sent);
    current.opened ||= mail.opened === true || Number(mail.openCount || 0) > 0;
    current.clicked ||= mail.eventLinkClicked === true || Number(mail.eventLinkClickCount || 0) > 0;
    const clickTime = mailTime(mail.firstEventLinkClickedAt || mail.lastEventLinkClickedAt);
    if (clickTime) current.firstClick = current.firstClick ? Math.min(current.firstClick, clickTime) : clickTime;
    recipients.set(email, current);
  }
  const result = { sent: recipients.size, opened: 0, clicked: 0, booked: 0, bookedAfterClick: 0 };
  for (const [email, recipient] of recipients) {
    if (recipient.opened) result.opened += 1;
    if (recipient.clicked) result.clicked += 1;
    const bookingTime = mailTime(byEmail.get(email)?.confirmedAt || byEmail.get(email)?.createdAt || byEmail.get(email)?.submittedAt);
    if (bookingTime > recipient.firstSent && bookingTime <= end) {
      result.booked += 1;
      if (recipient.firstClick && bookingTime > recipient.firstClick) result.bookedAfterClick += 1;
    }
  }
  return result;
}
