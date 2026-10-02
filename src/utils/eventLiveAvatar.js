import { escapeHtml } from "./format.js?v=3";

export function eventAvatarInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(part => part && !/^(dr\.?|prof\.?|prof\.dr\.?)$/i.test(part));
  return (parts.length > 1 ? [parts[0], parts.at(-1)] : parts).map(part => [...part][0]).join("").toLocaleUpperCase("de-DE") || "?";
}

export function eventAvatarMarkup(name, photoUrl = "") {
  return `<span class="event-live-avatar-initials" aria-hidden="true">${escapeHtml(eventAvatarInitials(name))}</span>${photoUrl ? `<img data-event-avatar-image src="${escapeHtml(photoUrl)}" alt="" loading="lazy" decoding="async">` : ""}`;
}

if (typeof document !== "undefined") {
  document.addEventListener("error", event => {
    if (event.target.matches?.("img[data-event-avatar-image]")) event.target.remove();
  }, true);
}
