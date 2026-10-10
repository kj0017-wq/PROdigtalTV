export const DEFAULT_EVENT_TIME_ZONE = "Europe/Berlin";
export const CALENDAR_DECISION_REMINDER_DAYS = 7;

const pad = (value, length = 2) => String(value).padStart(length, "0");

function cleanText(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function eventDateValue(event = {}) {
  return String(event.date || event.startDate || event.eventDate || event.datum || "").slice(0, 10);
}

function eventStartTime(event = {}) {
  const value = String(event.startTime || event.start_time || event.time || "").trim();
  return /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5) : "";
}

function eventEndTime(event = {}) {
  const value = String(event.endTime || event.end_time || "").trim();
  return /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5) : "";
}

function eventIsAllDay(event = {}) {
  return Boolean(event.allDay || event.isAllDay || event.fullDay || event.ganztag);
}

function addMinutes(local, minutes) {
  const next = new Date(local.getTime());
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function addDaysDate(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function localDate(date, time = "00:00") {
  const [year, month, day] = String(date || "").split("-").map(Number);
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
}

function timeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function zonedTimeToUtc(date, time, timeZone = DEFAULT_EVENT_TIME_ZONE) {
  const [year, month, day] = String(date || "").split("-").map(Number);
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  if (!year || !month || !day) return null;
  const wanted = { year, month, day, hour: hour || 0, minute: minute || 0, second: 0 };
  let guess = new Date(Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute, 0));
  for (let i = 0; i < 3; i += 1) {
    const parts = timeZoneParts(guess, timeZone);
    const delta = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute, wanted.second)
      - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    if (!delta) break;
    guess = new Date(guess.getTime() + delta);
  }
  return guess;
}

function formatUtc(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function formatIcsLocal(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function formatIcsDate(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function icsEscape(value = "") {
  return cleanText(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function foldIcsLine(line = "") {
  const chunks = [];
  let rest = String(line || "");
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function eventLocation(event = {}) {
  if (event.isVirtualEvent) return [event.onlineMeetingLabel || "Online", event.city].filter(Boolean).join(", ") || "Online";
  return [event.locationName, event.address, [event.postalCode || event.zipCode, event.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

function eventDescription(event = {}, eventUrl = "", registrationUrl = "") {
  const description = cleanText(event.description || event.publicTeaser || event.teaserText || event.shortDescription || event.introText || event.subtitle || event.longDescription || event.bodyText || "");
  const signUpUrl = registrationUrl || event.registrationUrl || event.registration_url || eventUrl;
  return [
    description,
    eventUrl ? `Eventseite: ${eventUrl}` : "",
    signUpUrl ? `Anmeldung: ${signUpUrl}` : "",
    event.zoomLink ? `Online-Link: ${event.zoomLink}` : ""
  ].filter(Boolean).join("\n\n");
}

export function eventCalendarOptions(event = {}, { origin = "" } = {}) {
  const date = eventDateValue(event);
  const startTime = eventStartTime(event);
  const endTime = eventEndTime(event);
  const timeZone = event.timeZone || event.timezone || event.tz || DEFAULT_EVENT_TIME_ZONE;
  const allDay = eventIsAllDay(event) || !startTime;
  const startLocal = localDate(date, startTime || "00:00");
  const endLocal = allDay
    ? (startLocal ? addDaysDate(startLocal, 1) : null)
    : endTime
      ? localDate(date, endTime)
      : startLocal ? addMinutes(startLocal, Number(event.defaultDurationMinutes || event.durationMinutes || 90)) : null;
  const startUtc = allDay ? null : zonedTimeToUtc(date, startTime || "00:00", timeZone);
  const endUtc = allDay ? null : endTime
    ? zonedTimeToUtc(date, endTime, timeZone)
    : startUtc ? new Date(startUtc.getTime() + Number(event.defaultDurationMinutes || event.durationMinutes || 90) * 60000) : null;
  const eventUrl = event.publicUrl || event.eventUrl || (event.id && origin ? new URL(`#/event/${event.id}`, origin).href : "");
  const registrationUrl = event.registrationUrl || event.registration_url || (event.id && origin ? new URL(`#/register/${event.id}`, origin).href : "");
  const reminderDays = Math.max(1, Math.round(Number(event.calendarReminderDays ?? event.decisionReminderDays ?? CALENDAR_DECISION_REMINDER_DAYS) || CALENDAR_DECISION_REMINDER_DAYS));
  return {
    id: event.id || "prodigitaltv-event",
    title: cleanText(event.title || event.titel || "PROdigitalTV Event"),
    date,
    startTime,
    endTime,
    allDay,
    timeZone,
    startLocal,
    endLocal,
    startUtc,
    endUtc,
    location: eventLocation(event),
    description: eventDescription(event, eventUrl, registrationUrl),
    registrationUrl,
    eventUrl,
    reminderEnabled: event.calendarReminderEnabled !== false && event.decisionReminderEnabled !== false,
    reminderDays,
    alarmMinutesBefore: event.calendarReminderEnabled !== false && event.decisionReminderEnabled !== false ? reminderDays * 1440 : 0
  };
}


function decisionReminderOptions(data = {}) {
  if (!data?.startLocal) return null;
  const startLocal = addDaysDate(data.startLocal, -data.reminderDays);
  const endLocal = addMinutes(startLocal, 30);
  const reminderDate = `${startLocal.getFullYear()}-${pad(startLocal.getMonth() + 1)}-${pad(startLocal.getDate())}`;
  const reminderTime = `${pad(startLocal.getHours())}:${pad(startLocal.getMinutes())}`;
  const startUtc = zonedTimeToUtc(reminderDate, reminderTime, data.timeZone || DEFAULT_EVENT_TIME_ZONE);
  const endUtc = startUtc ? addMinutes(startUtc, 30) : null;
  const eventDate = data.startLocal ? `${pad(data.startLocal.getDate())}.${pad(data.startLocal.getMonth() + 1)}.${data.startLocal.getFullYear()}` : data.date;
  const description = [
    `Diese Veranstaltung hast du vorgemerkt. Moechtest du teilnehmen? Jetzt Veranstaltung ansehen und ggf. anmelden.`,
    `Veranstaltung: ${data.title}`,
    eventDate ? `Datum der Veranstaltung: ${eventDate}` : "",
    data.location ? `Ort: ${data.location}` : "",
    data.eventUrl ? `Eventseite: ${data.eventUrl}` : "",
    data.registrationUrl ? `Anmeldung: ${data.registrationUrl}` : ""
  ].filter(Boolean).join("\n\n");
  return {
    id: `${data.id || "prodigitaltv-event"}-decision`,
    title: `Teilnahme entscheiden: ${data.title}`,
    startLocal,
    endLocal,
    startUtc,
    endUtc,
    allDay: false,
    timeZone: data.timeZone,
    location: data.location,
    description,
    eventUrl: data.eventUrl
  };
}

function googleUrlFromCalendarData(data = {}) {
  const params = new URLSearchParams({ action: "TEMPLATE", text: data.title, details: data.description || "", location: data.location || "" });
  if (data.allDay && data.startLocal && data.endLocal) params.set("dates", `${formatIcsDate(data.startLocal)}/${formatIcsDate(data.endLocal)}`);
  else if (data.startUtc && data.endUtc) params.set("dates", `${formatUtc(data.startUtc)}/${formatUtc(data.endUtc)}`);
  params.set("ctz", data.timeZone || DEFAULT_EVENT_TIME_ZONE);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookUrlFromCalendarData(data = {}) {
  const params = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: data.title, body: data.description || "", location: data.location || "" });
  if (data.allDay && data.startLocal && data.endLocal) {
    params.set("allday", "true");
    params.set("startdt", `${data.startLocal.getFullYear()}-${pad(data.startLocal.getMonth() + 1)}-${pad(data.startLocal.getDate())}`);
    params.set("enddt", `${data.endLocal.getFullYear()}-${pad(data.endLocal.getMonth() + 1)}-${pad(data.endLocal.getDate())}`);
  } else if (data.startUtc && data.endUtc) {
    params.set("startdt", data.startUtc.toISOString());
    params.set("enddt", data.endUtc.toISOString());
  }
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
export function generateGoogleCalendarUrl(event = {}, options = {}) {
  return googleUrlFromCalendarData(eventCalendarOptions(event, options));
}

export function generateGoogleDecisionReminderUrl(event = {}, options = {}) {
  const reminder = decisionReminderOptions(eventCalendarOptions(event, options));
  return reminder ? googleUrlFromCalendarData(reminder) : "";
}

export function generateOutlookCalendarUrl(event = {}, options = {}) {
  return outlookUrlFromCalendarData(eventCalendarOptions(event, options));
}

export function generateOutlookDecisionReminderUrl(event = {}, options = {}) {
  const reminder = decisionReminderOptions(eventCalendarOptions(event, options));
  return reminder ? outlookUrlFromCalendarData(reminder) : "";
}

function appendIcsEvent(lines, data = {}, uid = "") {
  lines.push("BEGIN:VEVENT", `UID:${icsEscape(uid || `${data.id}@prodigitaltv.de`)}`, `DTSTAMP:${formatUtc(new Date())}`, `SUMMARY:${icsEscape(data.title)}`, "STATUS:TENTATIVE");
  if (data.allDay && data.startLocal && data.endLocal) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(data.startLocal)}`, `DTEND;VALUE=DATE:${formatIcsDate(data.endLocal)}`);
  } else if (data.startLocal && data.endLocal) {
    lines.push(`DTSTART;TZID=${data.timeZone}:${formatIcsLocal(data.startLocal)}`, `DTEND;TZID=${data.timeZone}:${formatIcsLocal(data.endLocal)}`);
  }
  if (data.location) lines.push(`LOCATION:${icsEscape(data.location)}`);
  if (data.eventUrl) lines.push(`URL:${icsEscape(data.eventUrl)}`);
  if (data.description) lines.push(`DESCRIPTION:${icsEscape(data.description)}`);
  if (data.alarmMinutesBefore > 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(`Erinnerung: ${data.title}`)}`, `TRIGGER:-PT${data.alarmMinutesBefore}M`, "END:VALARM");
  lines.push("END:VEVENT");
}

export function generateICS(event = {}, options = {}) {
  const data = eventCalendarOptions(event, options);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PROdigitalTV//Event Calendar//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  appendIcsEvent(lines, data, `${data.id}@prodigitaltv.de`);
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function generateICSDataUrl(event = {}, options = {}) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(generateICS(event, options))}`;
}

export function calendarFileName(event = {}) {
  const safe = cleanText(event.title || event.id || "prodigitaltv-event").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "prodigitaltv-event";
  return `${safe}.ics`;
}
