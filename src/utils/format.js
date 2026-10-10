export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}


export function linkedText(value = "") {
  const source = String(value || "");
  const pattern = /((?:https?:\/\/|www\.)[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  let html = "";
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(source))) {
    html += escapeHtml(source.slice(lastIndex, match.index));
    const rawToken = match[0];
    const trailingMatch = rawToken.match(/[.,;:!?)]*$/);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const token = trailing ? rawToken.slice(0, -trailing.length) : rawToken;
    if (token) {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token) && !/^https?:\/\//i.test(token);
      const href = isEmail ? `mailto:${token}` : /^https?:\/\//i.test(token) ? token : `https://${token}`;
      html += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(token)}</a>${escapeHtml(trailing)}`;
    } else {
      html += escapeHtml(rawToken);
    }
    lastIndex = match.index + rawToken.length;
  }
  return html + escapeHtml(source.slice(lastIndex));
}

export function richTextPlainText(value = "") {
  return String(value || "")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/gi, "$1")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .trim();
}

export function richTextHtml(value = "", emptyHtml = "") {
  const lines = String(value || "").replace(/\r/g, "").split("\n");
  const inline = (valueToFormat = "") => {
    const links = [];
    const source = String(valueToFormat).replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_match, label, url) => {
      const marker = `@@PDTLINK${links.length}@@`;
      links.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
      return marker;
    });
    let html = linkedText(source)
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/__([^_\n]+)__/g, "<u>$1</u>");
    links.forEach((link, index) => {
      html = html.replace(`@@PDTLINK${index}@@`, link);
    });
    return html;
  };
  const output = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      output.push(`<${heading[1].length === 2 ? "h2" : "h3"}>${inline(heading[2])}</${heading[1].length === 2 ? "h2" : "h3"}>`);
      index += 1;
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${inline(match[1])}</li>`);
        index += 1;
      }
      output.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${inline(match[1])}</li>`);
        index += 1;
      }
      output.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    const paragraph = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || /^(?:#{2,3}\s+|[-*]\s+|\d+\.\s+)/.test(current)) break;
      paragraph.push(inline(current));
      index += 1;
    }
    output.push(`<p>${paragraph.join("<br>")}</p>`);
  }
  return output.join("") || emptyHtml;
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
