export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = {}) {
  const date = asDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long", year: "numeric", ...options }).format(date);
}

export function formatShortDate(value) {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "-";
}

export function formatDateTime(value) {
  const date = asDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

export function eventDateBox(date) {
  const value = asDate(date) || new Date();
  return {
    day: new Intl.DateTimeFormat("de-DE", { day: "2-digit" }).format(value),
    month: new Intl.DateTimeFormat("de-DE", { month: "short" }).format(value)
  };
}

export function initials(name) {
  return name.split(" ").map((part) => part.charAt(0)).slice(0, 2).join("").toUpperCase();
}

export function slugify(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
