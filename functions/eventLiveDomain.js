const HOUR_MS = 60 * 60 * 1000;

function localDateTimeMillis(date, time, timeZone = "Europe/Berlin") {
  const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = String(time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match || !clock) return 0;
  const [year, month, day] = match.slice(1).map(Number);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (hour > 23 || minute > 59) return 0;
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let value = wanted;
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(format.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const difference = wanted - represented;
    value += difference;
    if (!difference) break;
  }
  return value;
}

function eventLiveBounds(event = {}) {
  const date = String(event.date || event.eventDate || event.startDate || "").slice(0, 10);
  const start = localDateTimeMillis(date, event.startTime || event.start_time || event.time || "09:00", event.timeZone || event.timezone || "Europe/Berlin");
  if (!start) return { start: 0, end: 0 };
  let end = localDateTimeMillis(date, event.endTime || event.end_time || "", event.timeZone || event.timezone || "Europe/Berlin");
  if (!end || end <= start) end = start + Number(event.durationMinutes || event.defaultDurationMinutes || 90) * 60 * 1000;
  return { start, end };
}

function guestEventLiveIsOpen(event = {}, now = Date.now()) {
  const { start, end } = eventLiveBounds(event);
  return Boolean(start && end && now >= start - 2 * HOUR_MS && now <= end + 2 * HOUR_MS);
}

module.exports = { localDateTimeMillis, eventLiveBounds, guestEventLiveIsOpen };
