const A5_WIDTH_MM = 148;
const A5_HEIGHT_MM = 210;

export function normalizeModerationCardOrientation(value = "portrait") {
  return String(value || "").toLowerCase() === "landscape" ? "landscape" : "portrait";
}

export function moderationCardDimensions(value = "portrait") {
  const orientation = normalizeModerationCardOrientation(value);
  return orientation === "landscape"
    ? { orientation, widthMm: A5_HEIGHT_MM, heightMm: A5_WIDTH_MM }
    : { orientation, widthMm: A5_WIDTH_MM, heightMm: A5_HEIGHT_MM };
}

export function formatModerationCardNumber(number = 1, total = 1) {
  const safeTotal = Math.max(1, Number.parseInt(total, 10) || 1);
  const safeNumber = Math.min(safeTotal, Math.max(1, Number.parseInt(number, 10) || 1));
  return `Karte ${safeNumber} / ${safeTotal}`;
}

function clean(value = "") {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function ids(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function personName(person = {}) {
  return clean(person.name || person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" "));
}

function normalized(value = "") {
  return clean(value).toLocaleLowerCase("de")
    .replace(/\b(?:prof(?:essor)?|dr|ra)\.?\s+/g, "")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim();
}

function splitPeople(value = "") {
  return clean(value).split(/\s*(?:,|\/|&|\bund\b)\s*/i).map(clean).filter(Boolean);
}

function oneEditApart(first = "", second = "") {
  if (first === second) return true;
  if (Math.abs(first.length - second.length) > 1) return false;
  let left = 0;
  let right = 0;
  let differences = 0;
  while (left < first.length && right < second.length) {
    if (first[left] === second[right]) {
      left += 1;
      right += 1;
      continue;
    }
    differences += 1;
    if (differences > 1) return false;
    if (first.length > second.length) left += 1;
    else if (second.length > first.length) right += 1;
    else {
      left += 1;
      right += 1;
    }
  }
  return differences + (left < first.length || right < second.length ? 1 : 0) <= 1;
}

function personMatchesLabel(person = {}, label = "") {
  const full = normalized(personName(person));
  const wanted = normalized(label);
  if (!full || !wanted) return false;
  if (full === wanted) return true;
  const fullWords = full.split(" ");
  const wantedWords = wanted.split(" ");
  const sameSurname = oneEditApart(fullWords.at(-1), wantedWords.at(-1));
  if (!sameSurname) return false;
  if (wantedWords.length === 1) return true;
  return fullWords[0]?.startsWith(wantedWords[0]?.charAt(0) || "") || wantedWords[0]?.startsWith(fullWords[0]?.charAt(0) || "");
}

function agendaRows(event = {}) {
  if (Array.isArray(event.scheduleItems) && event.scheduleItems.length) return event.scheduleItems;
  return String(event.scheduleText || event.agendaText || event.programText || "")
    .split(/\n+/)
    .map((line) => {
      const parts = line.trim().split("|").map(clean);
      if (parts.length >= 3) return { time: parts[0], person: parts[1], title: parts.slice(2).join(" | ") };
      if (parts.length === 2) return { time: parts[0], title: parts[1] };
      const match = line.trim().match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      return { time: match?.[1] || "", title: match?.[2] || clean(line) };
    })
    .filter((item) => item.time || item.title);
}

function findTopic(item = {}, topics = [], profile = null) {
  if (item.topicId) {
    const exact = topics.find(topic => topic.id === item.topicId);
    if (exact) return exact;
  }
  const itemTitle = normalized(item.title || item.topicTitle);
  if (itemTitle) {
    const exactTitle = topics.find(topic => normalized(topic.title) === itemTitle);
    if (exactTitle) return exactTitle;
  }
  if (profile?.id) {
    const bySpeaker = topics.filter(topic => topic.speakerId === profile.id || ids(topic.speakerIds).includes(profile.id) || ids(profile.topicIds).includes(topic.id));
    if (bySpeaker.length === 1) return bySpeaker[0];
  }
  return null;
}

function profileForId(profiles, id) {
  return profiles.find(profile => profile.id === id) || null;
}

function itemProfiles(item = {}, profiles = [], topics = []) {
  const topic = findTopic(item, topics);
  const linkedIds = [...new Set([
    item.speakerId,
    ...ids(item.speakerIds),
    item.moderatorId,
    ...ids(item.moderatorIds),
    topic?.speakerId,
    ...ids(topic?.speakerIds),
    topic?.moderatorId,
    ...ids(topic?.moderatorIds)
  ].filter(Boolean))];
  const linked = linkedIds.map(id => profileForId(profiles, id)).filter(Boolean);
  if (linked.length) return linked;
  const labels = splitPeople(item.person || item.speaker || item.speakerName || item.presenter);
  return labels.map(label => profiles.find(profile => personMatchesLabel(profile, label))).filter(Boolean)
    .filter((profile, index, all) => all.findIndex(candidate => candidate.id === profile.id) === index);
}

function contributionRole(topic = {}, profileId = "") {
  if ((topic.moderatorIds || []).includes(profileId) || topic.moderatorId === profileId) return "Moderation";
  const type = String(topic.contributionType || "lecture").toLowerCase();
  return type === "discussion" || type === "interview" ? "Teilnehmer/in" : "Referent/in";
}

function notesText(item = {}, topic = {}) {
  const value = item.moderationQuestions || item.moderatorQuestions || item.moderationNotes || item.notes
    || topic.moderationQuestions || topic.moderatorQuestions || topic.moderationNotes || topic.notes || "";
  return Array.isArray(value) ? value.map(clean).filter(Boolean).join("\n• ") : clean(value);
}

function genericPersonLabel(item = {}) {
  const value = clean(item.person || item.speaker || item.speakerName || item.presenter);
  if (!value || /^(einlass|pause|networking|ende(?: der veranstaltung)?|programmpunkt)$/i.test(value)) return "";
  return value;
}

function completeText(value = "") {
  return clean(value);
}

function essentialText(value = "", maxSentences = 2) {
  const text = completeText(value);
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(clean).filter(Boolean) || [];
  return sentences.length > maxSentences ? sentences.slice(0, maxSentences).join(" ") : text;
}

function moderationKind(item = {}, topic = null) {
  const value = normalized([item.type, item.title, item.label, topic?.title].filter(Boolean).join(" "));
  if (/begruss|begruess|begrüß|willkomm|eroffnung|eroeffnung|eröffnung/.test(value)) return "welcome";
  if (/verabschied|abschluss|fazit|danksag|schlusswort/.test(value)) return "farewell";
  if (topic || /vortrag|talk|panel|gesprach|gespräch|diskussion|prasentation|praesentation|präsentation/.test(value)) return "talk";
  return "";
}

function agendaOverview(rows = [], topics = [], currentIndex = -1) {
  return rows.map((item, index) => {
    if (index <= currentIndex) return "";
    const topic = findTopic(item, topics);
    if (moderationKind(item, topic) !== "talk") return "";
    const title = clean(item.title || item.topicTitle || item.label || topic?.title || "");
    if (!title || /^(programmpunkt|vortrag)$/i.test(title)) return "";
    const time = clean(item.time || item.startTime || item.startsAt);
    return time ? `${time} Uhr – ${title}` : title;
  }).filter(Boolean);
}

function welcomeModerationDescription(event = {}, rows = [], topics = [], rowIndex = -1, time = "") {
  const hour = Number.parseInt(clean(time).split(":")[0], 10);
  const salutation = Number.isFinite(hour) && hour < 12 ? "Guten Morgen" : Number.isFinite(hour) && hour >= 18 ? "Guten Abend" : "Guten Tag";
  const eventTitle = clean(event.title || event.name || "");
  const welcome = eventTitle
    ? `${salutation} und herzlich willkommen zu „${eventTitle}“. Schön, dass Sie heute bei uns sind.`
    : `${salutation} und herzlich willkommen bei PROdigitalTV. Schön, dass Sie heute bei uns sind.`;
  const [firstProgramPoint] = agendaOverview(rows, topics, rowIndex);
  const schedule = firstProgramPoint
    ? `Wir beginnen mit ${firstProgramPoint}.`
    : "Ich gebe Ihnen zunächst einen kurzen Überblick über den Ablauf.";
  return `${welcome} ${schedule} Ich wünsche uns interessante Einblicke und einen guten Austausch und übergebe nun an den ersten Programmpunkt.`;
}

function farewellModerationDescription(event = {}) {
  const eventTitle = clean(event.title || event.name || "");
  return `Damit sind wir am Ende${eventTitle ? ` von „${eventTitle}“` : " unserer Veranstaltung"}. Vielen Dank an alle Referierenden für ihre Beiträge und an Sie, liebe Gäste, für Ihr Interesse und den Austausch. Kommen Sie gut nach Hause.`;
}

function defaultModerationDescription(kind = "", title = "") {
  if (kind === "welcome") return "Begrüßen Sie die Gäste und führen Sie kurz durch den Ablauf.";
  if (kind === "farewell") return "Danken Sie den Mitwirkenden und Gästen und verabschieden Sie die Veranstaltung.";
  return title ? `Der Beitrag ordnet das Thema „${clean(title)}“ sachlich ein.` : "";
}

function defaultModerationNotes(kind = "", hasPerson = false) {
  if (kind === "welcome") return "Blickkontakt zu den Gästen\nPROdigitalTV als Gastgeber nennen\nAblauf ankündigen\nZum ersten Programmpunkt überleiten";
  if (kind === "farewell") return "Referierenden und Gästen danken\nAuf den Ausklang hinweisen\nGäste verabschieden";
  return hasPerson ? "Referent und Funktion kurz vorstellen · Zum Thema überleiten" : "";
}

export function buildModerationCards({ event = {}, topics = [], speakers = [], boardMembers = [] } = {}) {
  const profiles = [...speakers, ...boardMembers].filter((profile, index, all) => {
    const name = normalized(personName(profile));
    return profile.id && all.findIndex(candidate => candidate.id === profile.id || (name && normalized(personName(candidate)) === name)) === index;
  });
  const rows = agendaRows(event);
  const cards = [];
  rows.forEach((item, rowIndex) => {
    const matchedProfiles = itemProfiles(item, profiles, topics);
    const rowTopic = findTopic(item, topics, matchedProfiles[0] || null);
    const kind = moderationKind(item, rowTopic);
    if (!kind) return;
    const profilesForRow = matchedProfiles.length ? matchedProfiles : [null];
    profilesForRow.forEach((profile, profileIndex) => {
      const topic = findTopic(item, topics, profile) || rowTopic;
      const speakerName = profile ? personName(profile) : genericPersonLabel(item);
      const isHostCard = kind === "welcome" || kind === "farewell";
      const position = isHostCard ? "" : clean(profile?.position || profile?.role || "");
      const company = isHostCard ? "" : clean(profile?.company || profile?.organization || "");
      const title = clean(item.title || item.topicTitle || item.label || topic?.title || item.type || "Programmpunkt");
      if (!title && !speakerName) return;
      const profileBio = isHostCard ? "" : profile?.shortBio || profile?.bio || profile?.longBio || profile?.vita || profile?.biography || "";
      const fallbackBio = !isHostCard && speakerName && (position || company) ? `${speakerName} ist ${[position, company ? `bei ${company}` : ""].filter(Boolean).join(" ")}.` : "";
      const description = kind === "welcome"
        ? welcomeModerationDescription(event, rows, topics, rowIndex, item.time || item.startTime || item.startsAt)
        : kind === "farewell"
          ? farewellModerationDescription(event)
          : topic?.shortDescription || topic?.description || topic?.longDescription || item.description || item.abstract || defaultModerationDescription(kind, title);
      cards.push({
        id: `moderation-${rowIndex}-${profile?.id || profileIndex}`,
        time: clean(item.time || item.startTime || item.startsAt),
        speakerName,
        position,
        company,
        contributionRole: profile ? contributionRole(topic || {}, profile.id) : "",
        title: title || clean(item.type) || "Programmpunkt",
        bio: essentialText(profileBio || fallbackBio, 2),
        description: isHostCard ? completeText(description) : essentialText(description, 2),
        notes: essentialText(isHostCard ? defaultModerationNotes(kind, Boolean(speakerName)) : notesText(item, topic || {}) || defaultModerationNotes(kind, Boolean(speakerName)), 3),
        selected: true
      });
    });
  });
  if (!cards.length) {
    topics.forEach((topic, index) => {
      const linked = itemProfiles({ topicId: topic.id, speakerId: topic.speakerId, speakerIds: topic.speakerIds }, profiles, topics);
      (linked.length ? linked : [null]).forEach((profile, profileIndex) => cards.push({
        id: `moderation-topic-${index}-${profile?.id || profileIndex}`,
        time: clean(topic.time || topic.startTime),
        speakerName: profile ? personName(profile) : "",
        position: clean(profile?.position || profile?.role || ""),
        company: clean(profile?.company || profile?.organization || ""),
        contributionRole: profile ? contributionRole(topic, profile.id) : "",
        title: clean(topic.title || "Vortrag"),
        bio: essentialText(profile?.shortBio || profile?.bio || profile?.longBio || "", 2),
        description: essentialText(topic.shortDescription || topic.description || topic.longDescription || "", 2),
        notes: essentialText(notesText({}, topic), 3),
        selected: true
      }));
    });
  }
  return cards;
}

export function mergeSavedModerationCards(generatedCards = [], savedCards = [], removedIds = []) {
  const removed = new Set(Array.isArray(removedIds) ? removedIds : []);
  generatedCards = generatedCards.filter(card => !removed.has(card.id));
  const saved = Array.isArray(savedCards) ? savedCards.filter(card => card && typeof card === "object" && !removed.has(card.id)) : [];
  if (!saved.length) return generatedCards;
  const generatedById = new Map(generatedCards.map(card => [card.id, card]));
  return [
    ...saved.map((card, index) => ({
      ...(generatedById.get(clean(card.id)) || {}),
      id: clean(card.id) || `moderation-saved-${index}`,
      time: completeText(card.time),
      speakerName: completeText(card.speakerName),
      position: completeText(card.position),
      company: completeText(card.company),
      contributionRole: completeText(card.contributionRole),
      title: completeText(card.title),
      bio: completeText(card.bio),
      description: completeText(card.description),
      notes: completeText(card.notes),
      selected: true
    })),
    ...generatedCards.filter(card => !saved.some(savedCard => clean(savedCard.id) === card.id))
  ];
}

function cardMarkup(card = {}, { preview = false, number = 1, total = 1, orientation = "portrait" } = {}) {
  const hasPerson = Boolean(clean(card.speakerName));
  const role = [clean(card.contributionRole), clean(card.position), clean(card.company)].filter(Boolean).join(" · ");
  const cardOrientation = normalizeModerationCardOrientation(orientation);
  return `<article class="moderation-card moderation-card--${cardOrientation}${preview ? " moderation-card--preview" : ""}${hasPerson ? "" : " moderation-card--program"}">
    <header class="moderation-card__meta"><span class="moderation-card__number">${formatModerationCardNumber(number, total)}</span><time class="moderation-card__time">${escapeHtml(card.time ? `${card.time} Uhr` : "Uhrzeit offen")}</time></header>
    <h2 class="moderation-card__name">${escapeHtml(hasPerson ? card.speakerName : card.title)}</h2>
    ${role ? `<p class="moderation-card__role">${escapeHtml(role)}</p>` : ""}
    ${hasPerson ? `<section><h3>Thema</h3><p class="moderation-card__topic">${escapeHtml(card.title || "Thema offen")}</p></section>` : ""}
    ${card.bio ? `<section><h3>Kurzvita</h3><p class="moderation-card__clamp">${escapeHtml(card.bio)}</p></section>` : ""}
    ${card.description ? `<section><h3>${hasPerson ? "Vortrag / Thema" : "Programmpunkt"}</h3><p class="moderation-card__clamp">${escapeHtml(card.description)}</p></section>` : ""}
    ${card.notes ? `<section class="moderation-card__notes"><h3>Fragen / Hinweise</h3><p>${escapeHtml(card.notes)}</p></section>` : ""}
  </article>`;
}

function fitModerationCard(element) {
  if (!element) return;
  let scale = 1;
  element.style.setProperty("--moderation-scale", "1");
  for (let attempt = 0; attempt < 28 && element.scrollHeight > element.clientHeight + 1; attempt += 1) {
    scale *= 0.92;
    element.style.setProperty("--moderation-scale", String(Math.max(scale, 0.2)));
  }
}

function safeFilename(value = "Event") {
  return clean(value).replace(/[^a-z0-9äöüß_-]+/gi, "-").replace(/^-+|-+$/g, "") || "Event";
}

function wrapCanvas(context, value, maxWidth) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  const appendLongWord = (word) => {
    let part = "";
    [...word].forEach((character) => {
      const candidate = `${part}${character}`;
      if (part && context.measureText(candidate).width > maxWidth) {
        lines.push(part);
        part = character;
      } else part = candidate;
    });
    return part;
  };
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = context.measureText(word).width > maxWidth ? appendLongWord(word) : word;
    } else if (!line && context.measureText(word).width > maxWidth) {
      line = appendLongWord(word);
    } else line = candidate;
  });
  if (line) lines.push(line);
  return lines;
}

function drawLines(context, lines, x, y, lineHeight, paint = true) {
  if (paint) lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawCardCanvas(context, card, width, height, pxPerMm, number = 1, total = 1) {
  const left = 14 * pxPerMm;
  const maxWidth = width - 28 * pxPerMm;
  const pt = value => value * pxPerMm * 25.4 / 72;
  const hasPerson = Boolean(clean(card.speakerName));
  const role = [clean(card.contributionRole), clean(card.position), clean(card.company)].filter(Boolean).join(" · ");

  const layout = (scale, paint = false) => {
    const font = (weight, size) => { context.font = `${weight} ${pt(size * scale)}px Arial, sans-serif`; };
    let y = 15 * pxPerMm * scale;
    font(700, 11);
    if (paint) context.fillText(formatModerationCardNumber(number, total).toLocaleUpperCase("de"), left, y);
    font(700, 20);
    const timeLabel = card.time ? `${card.time} Uhr` : "Uhrzeit offen";
    const timeWidth = context.measureText(timeLabel).width;
    if (paint) context.fillText(timeLabel, left + maxWidth - timeWidth, y);
    y += pt(24 * scale) + 5 * pxPerMm * scale;
    font(700, hasPerson ? 28 : 26);
    y = drawLines(context, wrapCanvas(context, hasPerson ? card.speakerName : card.title, maxWidth), left, y, pt((hasPerson ? 32 : 30) * scale), paint);
    if (role) {
      y += 1.5 * pxPerMm * scale;
      font(400, 13);
      y = drawLines(context, wrapCanvas(context, role, maxWidth), left, y, pt(16 * scale), paint);
    }
    const section = (label, value, { size = 13, bold = false } = {}) => {
      if (!clean(value)) return;
      y += 5 * pxPerMm * scale;
      font(700, 9);
      if (paint) context.fillText(label.toLocaleUpperCase("de"), left, y);
      y += pt(13 * scale);
      font(bold ? 700 : 400, size);
      y = drawLines(context, wrapCanvas(context, value, maxWidth), left, y, pt(size * 1.28 * scale), paint);
    };
    if (hasPerson) section("Thema", card.title, { size: 18, bold: true });
    section("Kurzvita", card.bio);
    section(hasPerson ? "Vortrag / Thema" : "Programmpunkt", card.description);
    section("Fragen / Hinweise", card.notes, { size: 12 });
    return y;
  };

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111";
  context.textAlign = "left";
  context.textBaseline = "top";
  const bottom = height - 9 * pxPerMm;
  let scale = 1;
  for (let attempt = 0; attempt < 24 && layout(scale, false) > bottom; attempt += 1) scale *= 0.91;
  layout(Math.max(scale, 0.2), true);
}
async function renderCardJpeg(card, orientation = "portrait", number = 1, total = 1) {
  const dpi = 150;
  const pxPerMm = dpi / 25.4;
  const dimensions = moderationCardDimensions(orientation);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(dimensions.widthMm * pxPerMm);
  canvas.height = Math.round(dimensions.heightMm * pxPerMm);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("PDF kann in diesem Browser nicht erzeugt werden.");
  drawCardCanvas(context, card, canvas.width, canvas.height, pxPerMm, number, total);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const binary = atob(dataUrl.split(",")[1]);
  return { width: canvas.width, height: canvas.height, bytes: Uint8Array.from(binary, character => character.charCodeAt(0)) };
}

function ascii(value) {
  return new TextEncoder().encode(value);
}

function pdfFromImages(images, orientation = "portrait") {
  const chunks = [];
  const offsets = [0];
  let length = 0;
  const push = value => { const bytes = typeof value === "string" ? ascii(value) : value; chunks.push(bytes); length += bytes.length; };
  const objectCount = 2 + images.length * 3;
  const objects = new Map();
  const pageIds = images.map((_, index) => 3 + index * 3);
  const dimensions = moderationCardDimensions(orientation);
  const pageWidth = (dimensions.widthMm * 72 / 25.4).toFixed(3);
  const pageHeight = (dimensions.heightMm * 72 / 25.4).toFixed(3);
  objects.set(1, [`<< /Type /Catalog /Pages 2 0 R >>`]);
  objects.set(2, [`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`]);
  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const commands = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ\n`;
    objects.set(pageId, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
    objects.set(contentId, [`<< /Length ${ascii(commands).length} >>\nstream\n${commands}endstream`]);
    objects.set(imageId, [`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`, image.bytes, `\nendstream`]);
  });
  push("%PDF-1.4\n");
  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    objects.get(id).forEach(push);
    push("\nendobj\n");
  }
  const xref = length;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach(chunk => { output.set(chunk, offset); offset += chunk.length; });
  return new Blob([output], { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function createManualModerationCard() {
  return {
    id: `moderation-manual-${crypto.randomUUID()}`,
    time: "",
    speakerName: "",
    position: "",
    company: "",
    title: "Neue Karte",
    bio: "",
    description: "",
    notes: "",
    selected: true
  };
}

export function openModerationCardDialog({ event = {}, topics = [], speakers = [], boardMembers = [], generateAiTexts = null, saveCards = null } = {}) {
  if (document.querySelector("[data-moderation-card-dialog]")) return;
  const generatedCards = buildModerationCards({ event, topics, speakers, boardMembers });
  const removedIds = new Set(Array.isArray(event.moderationCardRemovedIds) ? event.moderationCardRemovedIds : []);
  const cards = mergeSavedModerationCards(generatedCards, event.moderationCards, [...removedIds]);
  if (!cards.length && !removedIds.size) cards.push(createManualModerationCard());
  let activeId = cards[0]?.id || "";
  let orientation = normalizeModerationCardOrientation(event.moderationCardOrientation);
  let dirty = false;
  const dialog = document.createElement("dialog");
  dialog.className = "moderation-card-dialog";
  dialog.dataset.moderationCardDialog = "";
  dialog.innerHTML = `<form method="dialog" class="moderation-card-dialog__header"><div><p class="eyebrow">DIN A5 · eine Seite pro Karte</p><h2>Moderationskarten</h2><p>${escapeHtml(event.title || "Event")}</p></div><button class="button button--secondary" value="cancel">Abbrechen</button></form>
    <div class="moderation-card-dialog__body">
      <aside class="moderation-card-controls">
        <fieldset class="moderation-card-orientation"><legend>Darstellung und Druck</legend><label><input type="radio" name="moderationOrientation" value="portrait" ${orientation === "portrait" ? "checked" : ""}> Hochkant</label><label><input type="radio" name="moderationOrientation" value="landscape" ${orientation === "landscape" ? "checked" : ""}> Querformat</label></fieldset>
        <label class="checkbox"><input type="checkbox" data-moderation-all checked> Alle Karten auswählen</label>
        <button class="button button--secondary button--small" type="button" data-moderation-add>Karte hinzufügen</button>
        <button class="icon-button icon-button--danger" type="button" data-moderation-remove title="Karte löschen" aria-label="Karte löschen"><img src="/assets/cms-icons/trash.png" width="24" height="24" alt="" aria-hidden="true"></button>
        <div class="moderation-card-list" data-moderation-list></div>
        <div class="actions"><button class="button button--secondary button--small" type="button" data-moderation-up>Nach oben</button><button class="button button--secondary button--small" type="button" data-moderation-down>Nach unten</button></div>
      </aside>
      <main class="moderation-card-workspace">
        <form class="moderation-card-editor" data-moderation-editor>
          <div class="form-grid--two">
            <label>Uhrzeit<input name="time" placeholder="19:15"></label>
            <label>Name des Referenten<input name="speakerName"></label>
            <label>Position<input name="position"></label>
            <label>Unternehmen<input name="company"></label>
          </div>
          <label>Thema / Programmpunkt<textarea name="title" rows="2"></textarea></label>
          <label>Kurzvita<textarea name="bio" rows="3" placeholder="Maximal 2–3 kurze Zeilen"></textarea></label>
          <label>Vortrag / Thema<textarea name="description" rows="3" placeholder="Maximal 2–3 kurze Zeilen"></textarea></label>
          <label>Fragen / Hinweise<textarea name="notes" rows="3" placeholder="Optionale Stichpunkte"></textarea></label>
        </form>
        <div class="moderation-card-preview" data-moderation-preview></div>
      </main>
    </div>
    <footer class="moderation-card-dialog__footer"><span data-moderation-status role="status" aria-live="polite"></span>${typeof generateAiTexts === "function" ? `<button class="button button--secondary" type="button" data-moderation-ai>KI-Text kurz und sachlich erstellen</button>` : ""}${typeof saveCards === "function" ? `<button class="button button--secondary" type="button" data-moderation-save>Speichern</button>` : ""}<button class="button button--primary" type="button" data-moderation-print>Drucken</button><button class="button button--secondary" type="button" data-moderation-pdf>PDF erzeugen</button><button class="button button--secondary" type="button" data-moderation-cancel>Abbrechen</button></footer>`;
  document.body.append(dialog);
  const list = dialog.querySelector("[data-moderation-list]");
  const editor = dialog.querySelector("[data-moderation-editor]");
  const preview = dialog.querySelector("[data-moderation-preview]");
  const all = dialog.querySelector("[data-moderation-all]");
  const status = dialog.querySelector("[data-moderation-status]");
  const printButton = dialog.querySelector("[data-moderation-print]");
  const pdfButton = dialog.querySelector("[data-moderation-pdf]");
  const saveButton = dialog.querySelector("[data-moderation-save]");
  const active = () => cards.find(card => card.id === activeId) || cards[0];
  const cardPosition = card => Math.max(0, cards.indexOf(card)) + 1;
  const selected = () => cards.filter(card => card.selected);
  const updateStatus = () => {
    const count = selected().length;
    dialog.querySelector("[data-moderation-remove]").disabled = !cards.length;
    all.checked = count === cards.length;
    all.indeterminate = count > 0 && count < cards.length;
    printButton.disabled = pdfButton.disabled = count === 0;
    status.textContent = dirty ? "Änderungen noch nicht gespeichert." : count ? `${count} von ${cards.length} Karten ausgewählt.` : "Bitte mindestens eine Karte auswählen.";
  };
  const drawList = () => {
    list.innerHTML = cards.map((card, index) => `<div class="moderation-card-list__item${card.id === activeId ? " is-active" : ""}"><label><input type="checkbox" data-moderation-select="${escapeHtml(card.id)}" ${card.selected ? "checked" : ""}><button type="button" data-moderation-open="${escapeHtml(card.id)}"><strong>${escapeHtml(card.time || "--:--")} · ${escapeHtml(card.speakerName || card.title)}</strong><small>${escapeHtml(card.speakerName ? card.title : "Programmpunkt")}</small></button></label><span>${index + 1}</span></div>`).join("");
    list.querySelectorAll("[data-moderation-open]").forEach(button => button.addEventListener("click", () => {
      activeId = button.dataset.moderationOpen;
      drawList();
      loadEditor();
    }));
    list.querySelectorAll("[data-moderation-select]").forEach(check => check.addEventListener("change", () => {
      const card = cards.find(item => item.id === check.dataset.moderationSelect);
      if (card) card.selected = check.checked;
      updateStatus();
    }));
  };
  const loadEditor = () => {
    const card = active();
    [...editor.elements].forEach(field => { field.disabled = !card; });
    if (!card) {
      editor.reset();
      preview.innerHTML = "<p>Keine Karten vorhanden. Mit „Karte hinzufügen“ eine neue Karte erstellen.</p>";
      return;
    }
    ["time", "speakerName", "position", "company", "title", "bio", "description", "notes"].forEach(name => { editor.elements[name].value = card[name] || ""; });
    preview.innerHTML = cardMarkup(card, { preview: true, number: cardPosition(card), total: cards.length, orientation });
    fitModerationCard(preview.querySelector(".moderation-card"));
  };
  editor.addEventListener("input", (event) => {
    const card = active();
    if (!card || !event.target.name) return;
    card[event.target.name] = event.target.value;
    dirty = true;
    preview.innerHTML = cardMarkup(card, { preview: true, number: cardPosition(card), total: cards.length, orientation });
    fitModerationCard(preview.querySelector(".moderation-card"));
    drawList();
    updateStatus();
  });
  all.addEventListener("change", () => {
    cards.forEach(card => { card.selected = all.checked; });
    drawList();
    updateStatus();
  });
  dialog.querySelectorAll("[name='moderationOrientation']").forEach(input => input.addEventListener("change", () => {
    orientation = normalizeModerationCardOrientation(input.value);
    dirty = true;
    dialog.dataset.orientation = orientation;
    loadEditor();
    updateStatus();
  }));
  dialog.querySelector("[data-moderation-ai]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const chosen = selected();
    if (!chosen.length) return;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "KI erstellt Texte …";
    status.textContent = "Kurzvita, Themenabriss und Hinweise werden sachlich überarbeitet …";
    try {
      const generated = await generateAiTexts(chosen.map(card => ({ ...card })));
      (Array.isArray(generated) ? generated : []).forEach((item) => {
        const card = cards.find(candidate => candidate.id === item.id);
        if (!card) return;
        if (clean(item.bio)) card.bio = essentialText(item.bio, 2);
        if (clean(item.description)) card.description = essentialText(item.description, 3);
        if (clean(item.notes)) card.notes = essentialText(item.notes, 3);
      });
      dirty = true;
      drawList();
      loadEditor();
      status.textContent = "KI-Texte wurden übernommen. Bitte speichern.";
    } catch (error) {
      status.textContent = error.message || "KI-Texte konnten nicht erzeugt werden.";
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
  dialog.querySelector("[data-moderation-add]").addEventListener("click", () => {
    const card = createManualModerationCard();
    const index = cards.findIndex(item => item.id === activeId);
    cards.splice(index + 1, 0, card);
    activeId = card.id;
    dirty = true;
    drawList();
    loadEditor();
    updateStatus();
    editor.elements.title.focus();
    editor.elements.title.select();
  });
  dialog.querySelector("[data-moderation-remove]").addEventListener("click", () => {
    const index = cards.findIndex(card => card.id === activeId);
    if (index < 0) return;
    removedIds.add(cards[index].id);
    cards.splice(index, 1);
    activeId = cards[Math.min(index, cards.length - 1)]?.id || "";
    dirty = true;
    drawList();
    loadEditor();
    updateStatus();
  });
  const move = direction => {
    const index = cards.findIndex(card => card.id === activeId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= cards.length) return;
    [cards[index], cards[target]] = [cards[target], cards[index]];
    dirty = true;
    drawList();
    updateStatus();
  };
  dialog.querySelector("[data-moderation-up]").addEventListener("click", () => move(-1));
  dialog.querySelector("[data-moderation-down]").addEventListener("click", () => move(1));
  saveButton?.addEventListener("click", async () => {
    saveButton.disabled = true;
    status.textContent = "Moderationskarten werden gespeichert …";
    try {
      await saveCards(cards.map(card => ({ ...card })), [...removedIds], orientation);
      dirty = false;
      status.textContent = "Moderationskarten gespeichert.";
    } catch (error) {
      status.textContent = error.message || "Moderationskarten konnten nicht gespeichert werden.";
    } finally {
      saveButton.disabled = false;
    }
  });
  const close = () => dialog.close();
  dialog.querySelector("[data-moderation-cancel]").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  printButton.addEventListener("click", () => {
    const printRoot = document.createElement("div");
    printRoot.id = "moderation-card-print-root";
    printRoot.className = `moderation-card-print-root--${orientation}`;
    printRoot.innerHTML = selected().map(card => cardMarkup(card, { number: cardPosition(card), total: cards.length, orientation })).join("");
    document.body.append(printRoot);
    document.body.classList.add("moderation-card-printing", `moderation-card-printing--${orientation}`);
    printRoot.querySelectorAll(".moderation-card").forEach(fitModerationCard);
    const cleanup = () => { document.body.classList.remove("moderation-card-printing", "moderation-card-printing--portrait", "moderation-card-printing--landscape"); printRoot.remove(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.print();
    status.textContent = "Druckdialog geöffnet.";
    window.setTimeout(() => { if (printRoot.isConnected) cleanup(); }, 60000);
  });
  pdfButton.addEventListener("click", async () => {
    printButton.disabled = pdfButton.disabled = true;
    status.textContent = "PDF wird erzeugt …";
    try {
      const images = [];
      for (const card of selected()) images.push(await renderCardJpeg(card, orientation, cardPosition(card), cards.length));
      downloadBlob(pdfFromImages(images, orientation), `Moderationskarten-${orientation === "landscape" ? "Querformat" : "Hochkant"}-${safeFilename(event.title || "Event")}.pdf`);
      status.textContent = "PDF wurde erzeugt.";
    } catch (error) {
      status.textContent = error.message || "PDF konnte nicht erzeugt werden.";
    } finally {
      printButton.disabled = pdfButton.disabled = selected().length === 0;
    }
  });
  drawList();
  loadEditor();
  updateStatus();
  dialog.showModal();
}
