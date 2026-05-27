export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}

export function formatDate(value, options = {}) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long", year: "numeric", ...options }).format(new Date(value));
}

export function formatShortDate(value) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

export function eventDateBox(date) {
  const value = new Date(date);
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
