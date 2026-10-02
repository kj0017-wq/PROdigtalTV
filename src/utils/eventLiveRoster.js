function imageResource(value) {
  try {
    const url = new URL(value, document.baseURI);
    if (url.hostname === "storage.googleapis.com" || url.hostname.endsWith(".storage.googleapis.com")) {
      for (const key of [...url.searchParams.keys()]) {
        if (["GoogleAccessId", "Expires", "Signature"].includes(key) || key.toLowerCase().startsWith("x-goog-")) url.searchParams.delete(key);
      }
    }
    return url.href;
  } catch { return value; }
}

function updateNode(current, next) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
    current.replaceWith(next);
    return;
  }
  if (current.nodeType === Node.TEXT_NODE) {
    if (current.textContent !== next.textContent) current.textContent = next.textContent;
    return;
  }
  if (current.nodeType !== Node.ELEMENT_NODE) return;
  for (const attribute of [...current.attributes]) {
    if (attribute.name !== "data-live-person-bound" && !next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of next.attributes) {
    if (current.getAttribute(attribute.name) === attribute.value) continue;
    // A renewed signed URL is still the same loaded portrait, not a new image.
    if (current.tagName === "IMG" && attribute.name === "src"
      && (!current.complete || current.naturalWidth > 0)
      && imageResource(current.getAttribute("src")) === imageResource(attribute.value)) continue;
    current.setAttribute(attribute.name, attribute.value);
  }
  const children = [...current.childNodes];
  const used = new Set();
  let position = current.firstChild;
  for (const child of [...next.childNodes]) {
    const match = children.find(candidate => !used.has(candidate) && candidate.nodeName === child.nodeName
      && (candidate.nodeType !== Node.ELEMENT_NODE || candidate.className === child.className));
    const node = match || child;
    if (match) { used.add(match); updateNode(match, child); }
    if (node !== position) current.insertBefore(node, position);
    position = node.nextSibling;
  }
  children.filter(child => !used.has(child)).forEach(child => child.remove());
}

export function updateEventLiveRoster(roster, markup) {
  const template = document.createElement("template");
  template.innerHTML = markup;
  const next = template.content.querySelector(".event-live-participants");
  const current = roster.querySelector(".event-live-participants");
  if (!current || !next) { roster.replaceChildren(template.content); return; }
  current.dataset.eventLiveMode = next.dataset.eventLiveMode;
  const key = card => card.dataset.livePersonRow || card.dataset.livePerson;
  const existing = new Map([...current.querySelectorAll(":scope > [data-live-person], :scope > [data-live-person-row]")].map(card => [key(card), card]));
  const wanted = [...next.querySelectorAll(":scope > [data-live-person], :scope > [data-live-person-row]")];
  if (!wanted.length) { updateNode(current, next); return; }
  current.querySelectorAll(":scope > :not([data-live-person]):not([data-live-person-row])").forEach(node => node.remove());
  let position = current.firstChild;
  for (const card of wanted) {
    const saved = existing.get(key(card));
    const node = saved || card;
    if (saved) { updateNode(saved, card); existing.delete(key(card)); }
    if (node !== position) current.insertBefore(node, position);
    position = node.nextSibling;
  }
  existing.forEach(card => card.remove());
}
