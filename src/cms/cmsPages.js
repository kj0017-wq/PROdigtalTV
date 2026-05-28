import { cmsShell, cmsTitle } from "./cmsLayout.js";
import { list, getOne } from "../firebase/dataService.js";
import { currentUser, canUseCms, isAdmin } from "../firebase/authService.js";
import { accessLabels, lifecycleLabels } from "../data/demoData.js";
import { escapeHtml, formatDate, formatDateTime, formatShortDate } from "../utils/format.js";

function protect(content, adminOnly = false) {
  const user = currentUser();
  if (!canUseCms(user) || (adminOnly && !isAdmin(user))) {
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Zugriff geschuetzt</p><h1>CMS-Login erforderlich</h1><p style="margin:14px 0 24px">Dieser Bereich steht Administratoren und Redakteuren zur Verfuegung.</p><a class="button button--primary" href="#/login">Anmelden</a></div></section>`;
  }
  return content;
}

function hasCmsAccess(adminOnly = false) {
  const user = currentUser();
  return canUseCms(user) && (!adminOnly || isAdmin(user));
}

function denied(adminOnly = false) {
  return protect("", adminOnly);
}

function status(value) {
  const style = ["failed", "expired", "inactive", "archived"].includes(value) ? "status--error" : ["draft", "pending_email_confirmation", "queued", "in_review", "uploaded"].includes(value) ? "status--draft" : "";
  const label = { active: "Aktiv", inactive: "Inaktiv", published: "Veroeffentlicht", draft: "Entwurf", archived: "Archiviert", approved: "Freigegeben", new: "Neu", in_review: "In Pruefung" }[value] || value;
  return `<span class="status ${style}">${escapeHtml(label)}</span>`;
}

function iconImage(name) {
  const icons = {
    edit: "/assets/cms-icons/edit.png",
    eye: "/assets/cms-icons/eye-on.png",
    eyeOff: "/assets/cms-icons/eye-off.png",
    trash: "/assets/cms-icons/trash.png"
  };
  return icons[name] ? `<img src="${icons[name]}" alt="" loading="lazy">` : "";
}

function editorialActionButtons(item, section, module, activeStatus, inactiveStatus) {
  const isActive = ["published", "active", "approved"].includes(item.status);
  const toggleStatus = isActive ? inactiveStatus : activeStatus;
  const toggleClass = isActive ? "icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ? "Aktiv: auf inaktiv setzen" : "Inaktiv: auf aktiv setzen";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-record-status="${module}" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ? "eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="${module}" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function editorialListStatus(item) {
  return status(["published", "active", "approved"].includes(item.status) ? "active" : "inactive");
}

function listDate(item) {
  const value = item.publishDate || item.validFrom || item.date || item.submittedAt || item.updatedAt || item.createdAt || "";
  return value ? formatShortDate(value) : "-";
}

function aiButton(action, target, label = "Mit ChatGPT bearbeiten", extra = {}) {
  return `<button type="button" class="button button--secondary button--small ai-action" data-ai-action="${action}" data-ai-target="${target}" data-ai-entity-type="${extra.entityType || "event"}" data-ai-entity-id="${extra.entityId || ""}" data-ai-field="${extra.fieldName || target}">${label}</button>`;
}

function aiFieldActions(actions) {
  return `<div class="ai-field-actions">${actions.map((item) => aiButton(item.action, item.target, item.label, item)).join("")}</div>`;
}

function audioGenerationPanel(collection, item) {
  return `<div class="audio-generation-panel">
    <div><label>Audio / Vorlesen</label><p class="muted">${item.audioUrl ? "Audio ist gespeichert und wird im Frontend abgespielt." : "Noch kein Audio gespeichert. Bitte Text speichern, dann Audio erzeugen."}</p></div>
    ${item.audioUrl ? `<audio controls preload="none" src="${escapeHtml(item.audioUrl)}"></audio>` : ""}
    <button type="button" class="button button--secondary button--small" data-generate-article-speech data-collection="${collection}" data-record-id="${item.id}">${item.audioUrl ? "Audio neu erzeugen" : "Audio erzeugen und speichern"}</button>
    <div class="audio-generation-panel__result" data-speech-result></div>
  </div>`;
}

function audioListCell(collection, item) {
  return `<div class="audio-list-cell">
    <button type="button" class="audio-play-button ${item.audioUrl ? "audio-play-button--ready" : "audio-play-button--missing"}" data-generate-article-speech data-collection="${collection}" data-record-id="${item.id}" data-audio-url="${escapeHtml(item.audioUrl || "")}" title="${item.audioUrl ? "Audio abspielen" : "Audio erzeugen"}" aria-label="${item.audioUrl ? "Audio abspielen" : "Audio erzeugen"}"><span></span></button>
    <div class="audio-list-cell__result" data-speech-result></div>
  </div>`;
}

function chatGptHints(events, media, downloads = []) {
  const shortDescriptions = events.filter((event) => (event.description || "").length < 140).length;
  const memberEventsWithoutTeaser = events.filter((event) => event.accessType === "members_only" && !event.publicTeaser).length;
  const postWithoutReport = events.filter((event) => event.hasPostReport && !event.postEventSummary).length;
  const missingAlt = media.filter((item) => item.status === "approved" && !item.altText).length;
  const downloadsWithoutDescription = downloads.filter((item) => !item.description).length;
  const hints = [
    shortDescriptions ? `${shortDescriptions} Events haben sehr kurze Beschreibungen.` : "",
    memberEventsWithoutTeaser ? `${memberEventsWithoutTeaser} Mitglieder-Events haben keinen oeffentlichen Teaser.` : "",
    postWithoutReport ? `${postWithoutReport} Events im Nachlauf haben noch keinen Rueckblicktext.` : "",
    missingAlt ? `${missingAlt} Bilder haben keine Alt-Texte.` : "",
    downloadsWithoutDescription ? `${downloadsWithoutDescription} Downloads haben keine Beschreibung.` : ""
  ].filter(Boolean);
  return `<section class="panel ai-panel"><div class="actions" style="justify-content:space-between"><h2>ChatGPT-Hinweise</h2><a class="button button--secondary button--small" href="#/cms/chatgpt">KI-Pruefung oeffnen</a></div>${hints.length ? `<div class="setup-steps">${hints.map((hint) => `<div class="setup-step"><span>${escapeHtml(hint)}</span><strong>Hinweis</strong></div>`).join("")}</div>` : `<p>Keine akuten ChatGPT-Hinweise aus den aktuellen CMS-Daten.</p>`}<p class="muted" style="margin-top:14px">KI-Hinweise sind redaktionelle Empfehlungen und blockieren keine Pipeline-Statuswechsel.</p></section>`;
}

export async function dashboardPage() {
  if (!hasCmsAccess()) return denied();
  const [events, registrations, media, mails, downloads] = await Promise.all([list("events"), list("registrations"), list("eventMedia"), list("mailQueue"), list("downloads")]);
  const upcoming = events.filter((event) => event.status !== "inactive" && !isPastCmsEvent(event));
  const pending = registrations.filter((item) => item.status === "pending_email_confirmation").length;
  const postEvents = events.filter((event) => event.status !== "inactive" && isPastCmsEvent(event));
  const openPost = postEvents.length + media.filter((item) => item.status === "in_review").length;
  return protect(cmsShell("cms", `${cmsTitle("CMS Dashboard", "Uebersicht", `<a href="#/cms/events/new" class="button button--primary button--small">Neues Event</a>`)}
    <div class="stat-grid">
      <div class="stat"><span>Kommende Events</span><strong>${upcoming.length}</strong></div>
      <div class="stat"><span>Anmeldungen</span><strong>${registrations.length}</strong></div>
      <div class="stat"><span>Unbestaetigt</span><strong>${pending}</strong></div>
      <div class="stat"><span>Event-Nachlauf / Archiv</span><strong>${openPost}</strong></div>
      <div class="stat"><span>Mailfehler</span><strong>${mails.filter((mail) => mail.status === "failed").length}</strong></div>
    </div>
    ${chatGptHints(events, media, downloads)}
    <div class="cms-columns">
      <section class="panel"><h2>Naechste Events</h2><div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th>Termin</th><th>Phase</th></tr></thead><tbody>${upcoming.map((event) => `<tr><td><a class="link" href="#/cms/event/${event.id}">${escapeHtml(event.title)}</a></td><td>${formatDate(event.date)}</td><td>${status(lifecycleLabels[event.lifecyclePhase])}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel"><h2>Aufmerksamkeit erforderlich</h2>
        <div class="setup-steps"><div class="setup-step"><span>Unbestaetigte Anmeldungen</span><strong>${pending}</strong></div><div class="setup-step"><span>Medien in Pruefung</span><strong>${media.filter((item) => item.status === "in_review").length}</strong></div><div class="setup-step"><span>Event-Nachlauf offen</span><strong>${openPost}</strong></div></div>
        <div class="actions" style="margin-top:20px"><a class="button button--secondary button--small" href="#/cms/editorial">Redaktion bearbeiten</a><a class="button button--secondary button--small" href="#/cms/members">Mitglied anlegen</a></div>
      </section>
    </div>`));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isPastCmsEvent(event) {
  if (["post_processing", "archive_published"].includes(event.lifecyclePhase)) return true;
  if (event.expiresAt && new Date(event.expiresAt).getTime() <= Date.now()) return true;
  return Boolean(event.date && event.date < todayString());
}

function eventTable(events) {
  return `<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th>Datum</th><th>Ablauf</th><th>Zugang</th><th>Lifecycle</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${events.map((event) => `<tr><td><a class="link" href="#/cms/event/${event.id}">${escapeHtml(event.title)}</a></td><td>${formatDate(event.date)}</td><td>${event.expiresAt ? formatDateTime(event.expiresAt) : "-"}</td><td>${accessLabels[event.accessType]}</td><td>${lifecycleLabels[event.lifecyclePhase]}</td><td>${status(event.status)}</td><td><div class="table-actions"><a class="button button--secondary button--small" href="#/cms/event/${event.id}">Bearbeiten</a><button class="link-button" data-event-status="${event.id}" data-status="published">Aktiv</button><button class="link-button" data-event-status="${event.id}" data-status="inactive">Inaktiv</button></div></td></tr>`).join("")}</tbody></table></div></section>`;
}

function settingValue(settings, id, fallback = []) {
  const setting = settings.find((item) => item.id === id || item.key === id);
  return Array.isArray(setting?.value) ? setting.value : fallback;
}

export async function eventsAdminPage() {
  if (!hasCmsAccess()) return denied();
  const events = (await list("events"))
    .filter((event) => !isPastCmsEvent(event))
    .sort((a, b) => (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31"));
  return protect(cmsShell("cms/events", `${cmsTitle("Event-Management", "Events", `<a class="button button--primary button--small" href="#/cms/event/new">Neues Event erstellen</a>`)}
  ${eventTable(events)}`));
}

export async function eventFollowUpPage() {
  if (!hasCmsAccess()) return denied();
  const events = (await list("events"))
    .filter((event) => isPastCmsEvent(event))
    .sort((a, b) => (b.date || "0000-00-00").localeCompare(a.date || "0000-00-00"));
  return protect(cmsShell("cms/followup", `${cmsTitle("Event-Management", "Event-Nachlauf")}
  ${eventTable(events)}`));
}

function eventTabs(id, active) {
  return `<nav class="tabs">${[["base", "Stammdaten"], ["pre", "Vorlauf"], ["topics", "Vortraege / Referenten"], ["partners", "Sponsoren / Gastgeber"], ["registration", "Anmeldung"], ["post", "Nachlauf"], ["media", "Fotogalerie / Downloads"], ["ai", "KI-Pruefung"]].map(([key, label]) => `<button data-event-tab="${key}" data-event-id="${id}" class="${active === key ? "active" : ""}">${label}</button>`).join("")}</nav>`;
}

function shortText(value = "", length = 112) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
}

function personInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function speakerAvatar(speaker, className = "speaker-avatar") {
  return `<span class="${className}">${speaker.photoUrl ? `<img src="${escapeHtml(speaker.photoUrl)}" alt="">` : personInitials(speaker.name)}</span>`;
}

function topicThumb(topic) {
  return topic.imageUrl
    ? `<img src="${escapeHtml(topic.imageUrl)}" alt="">`
    : `<span>Bild</span>`;
}

function imageDropzone({ inputName, removeName, imageUrl = "", label = "Bild", defaultSize = "240x180" }) {
  return `<div class="image-dropzone" data-image-dropzone>
    <input type="hidden" name="${removeName}" value="">
    <input type="hidden" name="${inputName}DataUrl" value="">
    <input type="hidden" name="${inputName}FileName" value="">
    <input class="image-dropzone__input" type="file" name="${inputName}" accept="image/*">
    <div class="image-dropzone__preview ${imageUrl ? "has-image" : ""}" data-image-preview>
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="">` : `<span>${escapeHtml(label)} per Drag-and-drop oder Klick hochladen</span>`}
    </div>
    <button type="button" class="image-dropzone__remove" data-image-remove aria-label="Bild entfernen">x</button>
    <div class="image-dropzone__tools" data-image-tools hidden>
      <label>Zoom <input type="range" min="0.5" max="3" step="0.01" value="1" data-image-zoom></label>
      <label>Aufloesung <select data-image-size>
        ${[["240x180", "Thumb 240 x 180"], ["480x360", "Thumb 480 x 360"], ["1200x675", "Artikel 1200 x 675"], ["1600x900", "Hero 1600 x 900"]].map(([value, text]) => `<option value="${value}" ${value === defaultSize ? "selected" : ""}>${text}</option>`).join("")}
      </select></label>
      <button type="button" class="button button--secondary button--small" data-image-crop>Crop anwenden</button>
    </div>
    <p class="muted" data-image-resolution>Ausgabeformat: ${escapeHtml(defaultSize.replace("x", " x "))} px.</p>
    <p class="image-dropzone__status" data-image-status>${imageUrl ? "Bild ist gespeichert." : "Kein Bild gespeichert."}</p>
  </div>`;
}

function topicSpeakersForEvent(topic, event, speakers) {
  const eventSpeakerIds = new Set(event.speakerIds || []);
  return speakers.filter((speaker) => {
    const belongsToEvent = eventSpeakerIds.has(speaker.id) || (speaker.eventIds || []).includes(event.id);
    const belongsToTopic = speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
    return belongsToEvent && belongsToTopic;
  });
}

function eventTopicSpeakerActions(event, topic, topicSpeakers) {
  if (!topicSpeakers.length) return "";
  return `<div class="topic-speaker-stack"><h3>Referenten dieses Vortrags</h3>${topicSpeakers.map((speaker) => `<div class="speaker-action-card">
    ${speakerAvatar(speaker)}
    <div><strong>${escapeHtml(speaker.name || "")}</strong><small>${escapeHtml([speaker.company, speaker.position].filter(Boolean).join(" - "))}</small></div>
    <div class="speaker-action-card__actions">
      <button type="button" class="button button--secondary button--small" data-remove-event-topic-speaker="${speaker.id}" data-event-id="${event.id}" data-topic-id="${topic.id}">Loeschen</button>
    </div>
  </div>`).join("")}</div>`;
}

function topicEditorPanel(event, topics, speakers, mode, selectedTopicId, selectedSpeakerId) {
  if (!mode) return "";
  const selectedTopic = mode === "new" ? { id: "", title: "", shortDescription: "", imageUrl: "" } : topics.find((topic) => topic.id === selectedTopicId);
  if (mode === "assign") return "";
  if (mode === "remove") {
    const assignedTopics = topics.filter((topic) => (event.topicIds || []).includes(topic.id));
    return `<aside class="topic-detail-panel"><div class="topic-panel-head"><h2>Zuordnung loeschen</h2><a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics">Schliessen</a></div>
      <div class="topic-remove-list">${assignedTopics.length ? assignedTopics.map((topic) => `<div class="topic-remove-row"><div><strong>${escapeHtml(topic.title || "")}</strong><p>${escapeHtml(shortText(topic.shortDescription || topic.longDescription || ""))}</p></div><button class="button button--secondary button--small" data-unassign-event-topic="${topic.id}" data-event-id="${event.id}">Zuordnung entfernen</button></div>`).join("") : `<div class="alert">Dieses Event hat noch keine Vortragszuordnung.</div>`}</div>
    </aside>`;
  }
  if (mode === "referent" && selectedTopic) {
    const topicSpeakers = topicSpeakersForEvent(selectedTopic, event, speakers);
    const selectedSpeaker = speakers.find((speaker) => speaker.id === selectedSpeakerId) || { id: "", name: "", company: "", position: "", photoUrl: "" };
    return `<aside class="topic-detail-panel"><div class="topic-panel-head"><div><p class="eyebrow">Referent</p><h2>${selectedSpeaker.id ? "Referent bearbeiten" : "Referent anlegen"}</h2></div><a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics&mode=edit&topic=${selectedTopic.id}">Vortrag bearbeiten</a></div>
      <form id="event-topic-speaker-form" data-event-id="${event.id}" data-topic-id="${selectedTopic.id}" data-speaker-id="${selectedSpeaker.id || ""}" class="form-grid is-save-aware">
        <div class="field"><label>Name</label><input name="name" value="${escapeHtml(selectedSpeaker.name || "")}" required></div>
        <div class="field"><label>Firma</label><input name="company" value="${escapeHtml(selectedSpeaker.company || "")}"></div>
        <div class="field"><label>Position</label><input name="position" value="${escapeHtml(selectedSpeaker.position || "")}"></div>
        <div class="field"><label>Thumb optional</label>${imageDropzone({ inputName: "speakerImage", removeName: "removeSpeakerImage", imageUrl: selectedSpeaker.photoUrl || "", label: "Referentenfoto" })}</div>
        <div class="actions"><button class="button button--secondary" type="button" onclick="location.hash='#/cms/event/${event.id}?tab=topics&mode=edit&topic=${selectedTopic.id}'">Abbrechen</button><button class="button button--primary">Speichern</button></div>
        <div id="event-topic-speaker-result"></div>
      </form>
      ${eventTopicSpeakerActions(event, selectedTopic, topicSpeakers)}
    </aside>`;
  }
  if (!selectedTopic && mode !== "new") return "";
  const topicSpeakers = selectedTopic?.id ? topicSpeakersForEvent(selectedTopic, event, speakers) : [];
  const firstTopicSpeaker = topicSpeakers[0];
  const topicHeadActions = selectedTopic.id
    ? `<div class="topic-panel-actions">${firstTopicSpeaker ? `<a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics&mode=referent&topic=${selectedTopic.id}&speaker=${firstTopicSpeaker.id}">Referent bearbeiten</a>` : `<a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics&mode=referent&topic=${selectedTopic.id}">Referent hinzufuegen</a>`}<button class="button button--secondary button--small" type="button" data-copy-talk-to-topic="${selectedTopic.id}" data-event-id="${event.id}">Vortrag als Thema kopieren</button><a class="link-button" href="#/cms/event/${event.id}?tab=topics">Schliessen</a></div>`
    : `<a class="link-button" href="#/cms/event/${event.id}?tab=topics">Schliessen</a>`;
  const topicEntityId = selectedTopic.id || "";
  return `<aside class="topic-detail-panel"><div class="topic-panel-head"><div><p class="eyebrow">${mode === "new" ? "Neu" : "Vortrag bearbeiten"}</p><h2>${mode === "new" ? "Neuer Vortrag" : escapeHtml(selectedTopic.title || "")}</h2></div>${topicHeadActions}</div>
    <form id="event-topic-editor-form" data-event-id="${event.id}" data-topic-id="${selectedTopic.id || ""}" class="form-grid">
      <div class="field"><label>Ueberschrift</label><input name="title" value="${escapeHtml(selectedTopic.title || "")}" required>${aiFieldActions([{ action: "improveText", target: "title", label: "Ueberschrift mit ChatGPT", entityType: "topics", entityId: topicEntityId, fieldName: "title" }])}</div>
      <div class="field"><label>Text</label><textarea name="text" required>${escapeHtml(selectedTopic.longDescription || selectedTopic.shortDescription || "")}</textarea>${aiFieldActions([{ action: "generateTopicDescription", target: "text", label: "Text mit ChatGPT", entityType: "topics", entityId: topicEntityId, fieldName: "longDescription" }])}</div>
      <div class="field"><label>Thumb optional</label>${imageDropzone({ inputName: "topicImage", removeName: "removeTopicImage", imageUrl: selectedTopic.imageUrl || "", label: "Vortragsbild" })}</div>
      ${selectedTopic.id ? "" : `<p class="muted">Referenten koennen nach dem Speichern des neuen Vortrags hinzugefuegt werden.</p>`}
      ${eventTopicSpeakerActions(event, selectedTopic, topicSpeakers)}
      <div class="actions"><a class="button button--secondary" href="#/cms/event/${event.id}?tab=topics">Abbrechen</a><button class="button button--primary">Speichern</button></div>
      <div id="event-topic-editor-result"></div>
    </form>
  </aside>`;
}

function topicAssignPanel(event, topics, mode) {
  if (mode !== "assign") return "";
  const assigned = new Set(event.topicIds || []);
  const candidates = topics.filter((topic) => !assigned.has(topic.id));
  return `<div class="topic-inline-panel"><div class="topic-panel-head"><h2>Vortrag zuordnen</h2><a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics">Schliessen</a></div>
    <form id="event-topic-assign-form" data-event-id="${event.id}" class="form-grid">
      <div class="selection-grid">${candidates.length ? candidates.map((topic) => `<label class="selection-item"><input type="radio" name="topicId" value="${topic.id}" required><span><strong>${escapeHtml(topic.title || "")}</strong><small>${escapeHtml(shortText(topic.shortDescription || topic.longDescription || ""))}</small></span></label>`).join("") : `<div class="alert">Alle vorhandenen Vortraege sind bereits zugeordnet.</div>`}</div>
      <div class="actions"><button class="button button--primary" ${candidates.length ? "" : "disabled"}>Zuordnen</button></div>
      <div id="event-topic-assign-result"></div>
    </form>
  </div>`;
}

function eventTopicsEditor(event, topics, speakers, allEvents, query = new URLSearchParams()) {
  const assignedTopicIds = new Set(event.topicIds || []);
  const assignedTopics = (event.topicIds || []).map((topicId) => topics.find((topic) => topic.id === topicId)).filter(Boolean);
  const mode = query.get("mode") || "";
  const selectedTopicId = query.get("topic") || "";
  const selectedSpeakerId = query.get("speaker") || "";
  const detailPanel = mode && mode !== "assign" ? topicEditorPanel(event, topics, speakers, mode, selectedTopicId, selectedSpeakerId) : "";
  const assignPanel = topicAssignPanel(event, topics, mode);
  const newHref = mode === "new" ? `#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=new`;
  const newClass = mode === "new" ? "button button--primary button--small" : "button button--secondary button--small";
  const assignHref = mode === "assign" ? `#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=assign`;
  const assignClass = mode === "assign" ? "button button--primary button--small" : "button button--secondary button--small";
  const removeHref = mode === "remove" ? `#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=remove`;
  const removeClass = mode === "remove" ? "button button--primary button--small" : "button button--secondary button--small";
  return `<div class="topic-workspace">
    <section class="topic-list-panel">
      <div class="topic-actionbar">
        <a class="${newClass}" href="${newHref}">+ Neu</a>
        <a class="${assignClass}" href="${assignHref}">+ Zuordnen</a>
        <a class="${removeClass}" href="${removeHref}">Loeschen</a>
      </div>
      ${assignPanel}
      ${detailPanel}
      <h2>Bereits zugeordnet</h2>
      <div class="assigned-topic-list">${assignedTopics.length ? assignedTopics.map((topic) => {
        const topicSpeakers = topicSpeakersForEvent(topic, event, speakers);
        const excerpt = shortText(topic.longDescription || topic.shortDescription || "");
        return `<div class="assigned-topic-card ${selectedTopicId === topic.id ? "active" : ""}" draggable="true" data-topic-drag-id="${topic.id}" data-event-id="${event.id}">
          <button type="button" class="drag-handle" aria-label="Vortrag verschieben">::</button>
          <a class="assigned-topic-card__link" href="#/cms/event/${event.id}?tab=topics&mode=edit&topic=${topic.id}">
          <div class="topic-thumb">${topicThumb(topic)}</div>
          <div class="assigned-topic-card__body"><h3>${escapeHtml(topic.title || "")}</h3><p>${escapeHtml(excerpt)}</p></div>
          <div class="topic-speaker-badges">${topicSpeakers.length ? topicSpeakers.map((speaker) => `<span class="speaker-badge">${speakerAvatar(speaker, "speaker-badge__avatar")}<span>${escapeHtml(speaker.name || "")}</span></span>`).join("") : `<small>Keine Referenten</small>`}</div>
          <b>&gt;</b>
          </a>
        </div>`;
      }).join("") : `<div class="empty">Noch keine Vortraege zugeordnet. Starte mit Neu oder Zuordnen.</div>`}</div>
      <p class="muted">${assignedTopics.length} Vortraege</p>
    </section>
  </div>`;
}

function eventPartnersEditor(event, sponsors) {
  const sponsorIds = new Set(event.sponsorIds || []);
  const assignedPartners = sponsors.filter((item) => sponsorIds.has(item.id) || event.hostId === item.id);
  return `<form id="event-partners-form" data-event-id="${event.id}" class="form-grid">
    <div class="actions" style="justify-content:space-between"><div><h2>Sponsoren und Gastgeber bearbeiten</h2><p class="muted">Partner koennen hier angelegt, bearbeitet und direkt dem Event zugeordnet werden.</p></div><button class="button button--primary button--small">Alles speichern</button></div>
    <section><h3>Partner auswaehlen</h3><div class="selection-grid">${sponsors.length ? sponsors.map((partner) => `<label class="selection-item"><input type="checkbox" name="sponsorIds" value="${partner.id}" ${sponsorIds.has(partner.id) || event.hostId === partner.id ? "checked" : ""}><span><strong>${escapeHtml(partner.name || "")}</strong><small>${escapeHtml(partner.role || "")}</small></span></label>`).join("") : `<div class="alert">Noch keine Sponsoren oder Gastgeber vorhanden.</div>`}</div></section>
    <section><h3>Gastgeber festlegen</h3><div class="selection-grid"><label class="selection-item"><input type="radio" name="hostId" value="" ${!event.hostId ? "checked" : ""}><span><strong>Kein Gastgeber</strong><small>Nur Sponsoren/Partner anzeigen</small></span></label>${sponsors.map((partner) => `<label class="selection-item"><input type="radio" name="hostId" value="${partner.id}" ${event.hostId === partner.id ? "checked" : ""}><span><strong>${escapeHtml(partner.name || "")}</strong><small>${escapeHtml(partner.role || "")}</small></span></label>`).join("")}</div></section>
    <section class="panel" style="background:var(--pdt-bg)"><h3>Zugeordnete Partner bearbeiten</h3>${assignedPartners.length ? assignedPartners.map((partner) => `<div class="form-grid--two" style="margin-top:14px"><div class="field"><label>Name</label><input name="edit-sponsor-${partner.id}-name" value="${escapeHtml(partner.name || "")}"></div><div class="field"><label>Rolle</label><select name="edit-sponsor-${partner.id}-role">${["Sponsor", "Gastgeber", "Partner", "Unterstuetzer"].map((role) => `<option value="${role}" ${partner.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></div><div class="field"><label>Website</label><input name="edit-sponsor-${partner.id}-website" value="${escapeHtml(partner.website || "")}"></div><div class="field"><label>Beschreibung</label><textarea name="edit-sponsor-${partner.id}-description">${escapeHtml(partner.description || "")}</textarea>${aiFieldActions([{ action: "generateSponsorText", target: `edit-sponsor-${partner.id}-description`, label: "Sponsor-/Gastgebertext", entityType: "sponsor", entityId: partner.id, fieldName: "description" }])}</div></div>`).join("") : `<p>Noch kein Partner ausgewaehlt.</p>`}</section>
    <section class="panel"><h3>Neuen Sponsor/Gastgeber anlegen und zuordnen</h3><div class="form-grid--two"><div class="field"><label>Name</label><input name="newSponsorName"></div><div class="field"><label>Rolle</label><select name="newSponsorRole"><option>Sponsor</option><option>Gastgeber</option><option>Partner</option><option>Unterstuetzer</option></select></div><div class="field"><label>Website</label><input name="newSponsorWebsite"></div><div class="field"><label>Beschreibung</label><textarea name="newSponsorDescription"></textarea></div></div><label class="checkbox"><input type="checkbox" name="newSponsorIsHost"> neuen Partner als Gastgeber setzen</label></section>
    <div class="actions"><button class="button button--primary">Sponsoren / Gastgeber speichern</button></div><div id="event-partners-result"></div>
  </form>`;
}

export async function eventEditPage(id, tab = "base", query = new URLSearchParams()) {
  if (!hasCmsAccess()) return denied();
  let event = id === "new" ? {
    id: `event-${crypto.randomUUID()}`, title: "", subtitle: "", date: "2026-08-01", startTime: "10:00", endTime: "13:00", locationName: "", city: "", description: "", eventType: "Panel", accessType: "public", status: "draft", lifecyclePhase: "planning", registrationEnabled: false, maxParticipants: 50, expiresAt: "", address: "", phone: "", topicIds: [], speakerIds: [], sponsorIds: []
  } : await getOne("events", id);
  if (!event) return eventsAdminPage();
  const [topics, speakers, sponsors, registrations, media, settings, allEvents] = await Promise.all([list("topics"), list("speakers"), list("sponsors"), list("registrations"), list("eventMedia"), list("settings"), list("events")]);
  const eventTypes = settingValue(settings, "eventTypes", ["Medienfruehstueck", "Summit", "Roundtable", "Panel", "Webinar", "Konferenz", "Workshop"]);
  if (!["base", "pre", "topics", "partners", "registration", "post", "media", "ai"].includes(tab)) tab = "base";
  let content;
  if (tab === "base") {
    content = `<form id="event-edit-form" data-event-id="${event.id}" class="form-grid"><div class="form-grid--two"><div class="field"><label>Titel</label><input name="title" value="${escapeHtml(event.title)}" required>${aiFieldActions([{ action: "generateEventDescription", target: "title", label: "Ueberschrift vorschlagen", entityId: event.id, fieldName: "title" }])}</div><div class="field"><label>Untertitel</label><input name="subtitle" value="${escapeHtml(event.subtitle)}"></div></div><div class="field"><label>Beschreibung</label><textarea name="description">${escapeHtml(event.description)}</textarea>${aiFieldActions([{ action: "improveText", target: "description", label: "Mit ChatGPT bearbeiten", entityId: event.id, fieldName: "description" }, { action: "shortenText", target: "description", label: "Fuer Mobile kuerzen", entityId: event.id, fieldName: "description" }, { action: "generateSeoMeta", target: "description", label: "SEO erzeugen", entityId: event.id, fieldName: "description" }])}</div><div class="form-grid--two"><div class="field"><label>Datum</label><input type="date" name="date" value="${event.date}"></div><div class="field"><label>Eventtyp</label><select name="eventType">${eventTypes.map((value) => `<option ${value === event.eventType ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div><div class="field"><label>Neuen Eventtyp hinzufuegen</label><input name="newEventType" placeholder="z. B. Fachgespraech"></div><div class="field"><label>Eventbild auswaehlen</label><input type="file" name="eventImage" accept="image/*">${event.imageUrl ? `<p class="muted">Aktuelles Eventbild ist zugeordnet. Neue Auswahl ersetzt es beim Speichern.</p>` : ""}</div><div class="field"><label>Aktiv / Inaktiv</label><select name="status"><option value="published" ${event.status === "published" ? "selected" : ""}>Aktiv</option><option value="inactive" ${event.status === "inactive" ? "selected" : ""}>Inaktiv</option><option value="draft" ${event.status === "draft" ? "selected" : ""}>Entwurf</option><option value="archived" ${event.status === "archived" ? "selected" : ""}>Archiviert</option></select></div><div class="field"><label>Beginn</label><input type="time" name="startTime" value="${event.startTime}"></div><div class="field"><label>Ende</label><input type="time" name="endTime" value="${event.endTime}"></div><div class="field"><label>Location</label><input name="locationName" value="${escapeHtml(event.locationName || "")}"></div><div class="field"><label>Adresse</label><input name="address" value="${escapeHtml(event.address || "")}"></div><div class="field"><label>Stadt</label><input name="city" value="${escapeHtml(event.city || "")}"></div><div class="field"><label>Telefon Location</label><input name="phone" value="${escapeHtml(event.phone || "")}"></div><div class="field"><label>Ablaufdatum / automatisch ausblenden</label><input type="datetime-local" name="expiresAt" value="${event.expiresAt ? event.expiresAt.slice(0, 16) : ""}"></div><div class="field"><label>Zugangsart</label><select name="accessType">${Object.entries(accessLabels).map(([key, value]) => `<option value="${key}" ${key === event.accessType ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label>Lifecycle</label><select name="lifecyclePhase">${Object.entries(lifecycleLabels).map(([key, value]) => `<option value="${key}" ${key === event.lifecyclePhase ? "selected" : ""}>${value}</option>`).join("")}</select></div></div><div class="actions"><button class="button button--primary">Event speichern</button>${id !== "new" ? `<button type="button" class="button button--secondary" data-delete-event="${event.id}">Event loeschen</button>` : ""}</div><div id="event-save-result"></div></form>`;
  } else if (tab === "topics") {
    content = eventTopicsEditor(event, topics, speakers, allEvents, query);
  } else if (tab === "__old_topics") {
    content = `<h2>Zugeordnete Themen</h2><div class="filters">${topics.map((topic) => `<span class="filter ${event.topicIds.includes(topic.id) ? "active" : ""}">${escapeHtml(topic.title)}</span>`).join("")}</div><p>Themenspezifische Beschreibung und Sortierung koennen hier redaktionell erweitert werden.</p><div class="table-wrap" style="margin-top:22px"><table class="table"><thead><tr><th>Thema</th><th>Referenten</th></tr></thead><tbody>${topics.filter((topic) => event.topicIds.includes(topic.id)).map((topic) => { const topicSpeakers = speakers.filter((speaker) => speaker.topicId === topic.id || (event.speakerIds || []).includes(speaker.id)); return `<tr><td>${escapeHtml(topic.title)}</td><td>${topicSpeakers.length ? topicSpeakers.map((speaker) => `<div class="person"><div>${speaker.photoUrl ? `<img src="${escapeHtml(speaker.photoUrl)}" alt="">` : ""}</div><div><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml([speaker.company, speaker.position].filter(Boolean).join(" · "))}</small>${speaker.shortBio ? `<p>${escapeHtml(speaker.shortBio)}</p>` : ""}</div></div>`).join("") : "Noch kein Referent zugeordnet."}</td></tr>`; }).join("")}</tbody></table></div>`;
  } else if (tab === "speakers") {
    const assignedSpeakers = speakers.filter((item) => (event.speakerIds || []).includes(item.id));
    content = `<h2>Referenten im Eventkontext</h2><form id="event-speakers-form" data-event-id="${event.id}" class="form-grid"><div class="selection-grid">${speakers.length ? speakers.map((speaker) => `<label class="selection-item"><input type="checkbox" name="speakerIds" value="${speaker.id}" ${(event.speakerIds || []).includes(speaker.id) ? "checked" : ""}><span><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml(speaker.position || speaker.company || "")}</small></span>${status(speaker.status || "draft")}</label>`).join("") : `<div class="alert">Noch keine Referenten angelegt. Bitte zuerst im Bereich Referenten ein Profil mit Foto und Vita erstellen.</div>`}</div><div class="actions"><button class="button button--primary">Zuordnung speichern</button><a class="button button--secondary" href="#/cms/speakers">Referentenprofile verwalten</a></div><div id="speaker-assignment-result"></div></form>${assignedSpeakers.length ? `<div class="table-wrap" style="margin-top:24px"><table class="table"><thead><tr><th>Zugeordnet</th><th>Unternehmen</th><th>Profil</th></tr></thead><tbody>${assignedSpeakers.map((speaker) => `<tr><td>${escapeHtml(speaker.name)}</td><td>${escapeHtml(speaker.company || "-")}</td><td>${speaker.photoUrl ? "Foto vorhanden" : "Foto fehlt"} · ${speaker.shortBio || speaker.longBio ? "Vita vorhanden" : "Vita fehlt"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
  } else if (tab === "partners") {
    content = eventPartnersEditor(event, sponsors);
  } else if (tab === "registration") {
    const assigned = registrations.filter((item) => item.eventId === event.id);
    content = `<div class="actions" style="justify-content:space-between;margin-bottom:18px"><h2>Anmeldungen (${assigned.length})</h2><button class="button button--secondary button--small" data-export-event="${event.id}">Anmeldungen als CSV herunterladen</button></div><section class="panel" style="background:var(--pdt-bg)"><h2>Mailtexte mit Platzhaltern</h2><p>KI erzeugt Mailtexte mit Platzhaltern und ohne echte Teilnehmerdaten.</p>${aiFieldActions([{ action: "generateRegistrationMailText", target: "ai-mail-context", label: "Bestaetigungsmail erzeugen", entityId: event.id, fieldName: "mailText" }, { action: "generateRegistrationMailText", target: "ai-mail-context", label: "Wartelistenmail erzeugen", entityId: event.id, fieldName: "waitlistMail" }])}</section><div class="table-wrap"><table class="table"><thead><tr><th>Teilnehmer</th><th>Unternehmen</th><th>E-Mail</th><th>Status</th></tr></thead><tbody>${assigned.map((registration) => `<tr><td>${registration.firstName} ${registration.lastName}</td><td>${registration.company}</td><td>${registration.email}</td><td>${status(registration.status)}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (tab === "pre") {
    content = `<h2>Vorlauf und Freigabe</h2><div class="form-grid"><div class="field"><label>Einladungstext</label><textarea name="invitationText">Wir laden Sie herzlich zum ${escapeHtml(event.title)} ein.</textarea>${aiFieldActions([{ action: "generateEventInvitation", target: "invitationText", label: "Einladungstext erzeugen", entityId: event.id, fieldName: "invitationText" }, { action: "generateEventAgenda", target: "internalNotes", label: "Agenda strukturieren", entityId: event.id, fieldName: "agenda" }, { action: "generateEventFaq", target: "internalNotes", label: "FAQ erzeugen", entityId: event.id, fieldName: "faq" }])}</div><label class="checkbox"><input type="checkbox" checked> Eventbeschreibung final geprueft</label><label class="checkbox"><input type="checkbox"> Referentenfreigaben erhalten</label><div class="field"><label>Interne Notizen / Stichpunkte</label><textarea name="internalNotes"></textarea>${aiFieldActions([{ action: "generateEventDescription", target: "internalNotes", label: "Website-Teaser erzeugen", entityId: event.id, fieldName: "websiteTeaser" }, { action: "shortenText", target: "internalNotes", label: "Kurztext fuer Mobile", entityId: event.id, fieldName: "mobileText" }])}</div></div>`;
  } else if (tab === "ai") {
    const eventMedia = media.filter((item) => item.eventId === event.id);
    content = `<h2>KI-Pruefung</h2><p class="muted" style="margin-bottom:18px">Diese Pruefung erzeugt redaktionelle Empfehlungen. Blocker kommen weiterhin aus der regelbasierten Pipeline-Validierung.</p><div class="ai-quality-card"><button type="button" class="button button--primary ai-action" data-ai-action="analyzeEventPipelineQuality" data-ai-target="ai-quality-context" data-ai-entity-type="event" data-ai-entity-id="${event.id}" data-ai-field="pipelineQuality">Pipeline mit ChatGPT pruefen</button><div id="ai-quality-context" hidden>${escapeHtml(JSON.stringify({ event, media: eventMedia }))}</div></div><div class="setup-steps" style="margin-top:20px"><div class="setup-step"><span>Pflichtfelder fehlen?</span><strong>${event.title && event.date && event.locationName ? "ok" : "pruefen"}</strong></div><div class="setup-step"><span>SEO-Daten vorhanden?</span><strong>${event.seoTitle && event.seoDescription ? "ok" : "Empfehlung"}</strong></div><div class="setup-step"><span>Alt-Texte bei Bildern?</span><strong>${eventMedia.some((item) => !item.altText) ? "Empfehlung" : "ok"}</strong></div></div>`;
  } else {
    const assigned = media.filter((item) => item.eventId === event.id);
    content = `<h2>${tab === "post" ? "Event-Nacharbeit" : "Medien zum Event"}</h2>${tab === "post" ? `<section class="panel" style="background:var(--pdt-bg)"><h2>Event-Nachlauf mit KI</h2>${aiFieldActions([{ action: "generateEventSummary", target: "postEventSummary", label: "Nachbericht erzeugen", entityId: event.id, fieldName: "postEventSummary" }, { action: "generateArchiveText", target: "postEventSummary", label: "Archivtext erzeugen", entityId: event.id, fieldName: "archiveText" }])}</section>` : `<section class="panel" style="background:var(--pdt-bg)"><h2>Fotogalerie und Downloads mit KI</h2><p>Galerie und Downloads bleiben optional. Wenn keine Bilder oder Downloads vorhanden sind, entsteht kein Pflichtfehler.</p>${aiFieldActions([{ action: "generateGalleryIntro", target: "ai-media-context", label: "Galerie-Einleitung", entityId: event.id, fieldName: "galleryIntro" }, { action: "generateImageAltText", target: "ai-media-context", label: "Alt-Texte vorbereiten", entityId: event.id, fieldName: "altTexts" }, { action: "generateDownloadDescription", target: "ai-media-context", label: "Downloadbeschreibung", entityId: event.id, fieldName: "downloadDescription" }])}<div id="ai-media-context" hidden>${escapeHtml(JSON.stringify({ event, media: assigned }))}</div></section>`}<form id="media-upload-form" data-event-id="${event.id}" class="upload"><p><strong>Fotos, PDFs oder Praesentationen hochladen</strong></p><p>Drag-and-drop oder Dateiauswahl; Inhalte bleiben bis zur Freigabe intern.</p><input type="file" name="files" multiple style="margin-top:17px"><button class="button button--primary button--small" type="submit" style="margin:15px auto 0">Upload starten</button><div id="upload-result"></div></form><div class="table-wrap"><table class="table"><thead><tr><th>Datei</th><th>Typ</th><th>Sichtbarkeit</th><th>Freigabe</th><th>Aktionen</th></tr></thead><tbody>${assigned.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.mediaType}</td><td>${item.visibility}</td><td>${status(item.status)}</td><td><div class="table-actions"><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="approved">Aktiv</button><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="archived">Inaktiv</button><button class="link-button link-button--danger" data-delete-record="eventMedia" data-record-id="${item.id}">Loeschen</button></div></td></tr>`).join("")}</tbody></table></div>${tab === "post" ? `<div class="field" style="margin-top:22px"><label>Nachbericht</label><textarea name="postEventSummary">${escapeHtml(event.postEventSummary || "")}</textarea></div>` : ""}`;
  }
  const activeSection = isPastCmsEvent(event) ? "cms/followup" : "cms/events";
  return protect(cmsShell(activeSection, `${cmsTitle("Event bearbeiten", escapeHtml(event.title || "Neues Event"), `<a class="button button--secondary button--small" href="#/event/${event.id}">Vorschau</a>`)}<section class="panel">${eventTabs(event.id, tab)}${content}</section>`));
}

export async function registrationsPage() {
  if (!hasCmsAccess()) return denied();
  const [registrations, events] = await Promise.all([list("registrations"), list("events")]);
  return protect(cmsShell("cms/registrations", `${cmsTitle("Teilnehmermanagement", "Anmeldungen")}<section class="panel"><div class="field" style="max-width:390px;margin-bottom:18px"><label>Event auswaehlen</label><select>${events.map((event) => `<option>${escapeHtml(event.title)}</option>`).join("")}</select></div><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Event</th><th>Bestaetigung</th><th>Mailstatus</th></tr></thead><tbody>${registrations.map((record) => `<tr><td>${record.firstName} ${record.lastName}</td><td>${record.eventTitle}</td><td>${status(record.status)}</td><td>${status(record.mailStatus)}</td></tr>`).join("")}</tbody></table></div></section>`));
}

const editorialSections = {
  all: {
    active: "cms/editorial/press",
    title: "Presse",
    itemLabel: "Pressemeldung",
    route: "cms/editorial/press",
    createParams: "&page=press&section=pressRelease",
    filter: (item) => item.page === "press" || item.section === "pressRelease"
  },
  press: {
    active: "cms/editorial/press",
    title: "Presse",
    itemLabel: "Pressemeldung",
    route: "cms/editorial/press",
    createParams: "&page=press&section=pressRelease",
    filter: (item) => item.page === "press" || item.section === "pressRelease"
  },
  news: {
    active: "cms/editorial/news",
    title: "News",
    itemLabel: "News",
    route: "cms/editorial/news",
    createParams: "&page=news&section=news",
    filter: (item) => item.page === "news" || item.section === "news"
  },
  interna: {
    active: "cms/editorial/interna",
    title: "Interna",
    itemLabel: "Seitentext",
    route: "cms/editorial/interna",
    createParams: "&page=about&section=internal",
    filter: (item) => isInternalEditorialItem(item)
  }
};

function isInternalEditorialItem(item = {}) {
  if (item.section === "download" || String(item.migratedTo || "").startsWith("downloads/")) return false;
  return !["press", "news"].includes(item.page)
    && !["pressRelease", "news"].includes(item.section)
    && (["home", "about", "join", "imprint", "privacy", "legal", "contact", "login", "members", "board"].includes(item.page)
      || ["intro", "hero", "legal", "internal", "footer"].includes(item.section));
}

export async function moduleListPage(module, section = "all") {
  if (!hasCmsAccess()) return denied();
  const config = {
    topics: ["Redaktionelle Themen", "Thema", "title", "shortDescription"],
    speakers: ["Referenten", "Referent", "name", "company"],
    sponsors: ["Sponsoren / Gastgeber", "Partner", "name", "role"],
    members: ["Mitglieder", "Mitglied", "name", "description"],
    membershipApplications: ["Mitgliedsantraege", "Antrag", "company", "email"],
    boardMembers: ["Vorstandsgalerie", "Vorstandsmitglied", "name", "role"],
    editorialContent: ["Redaktion / Seiteninhalte", "Inhalt", "title", "page"],
    mailQueue: ["Mail-Queue", "Mail", "to", "subject"],
    eventMedia: ["Event-Nachlauf / Medien", "Medium", "title", "visibility"]
  }[module];
  const editorialConfig = module === "editorialContent" ? editorialSections[section] || editorialSections.all : null;
  const records = (await list(module))
    .filter((item) => !editorialConfig || editorialConfig.filter(item))
    .sort((a, b) => {
      const dateA = a.publishDate || a.date || a.validFrom || a.updatedAt || a.createdAt || "";
      const dateB = b.publishDate || b.date || b.validFrom || b.updatedAt || b.createdAt || "";
      if (dateA || dateB) return String(dateB).localeCompare(String(dateA));
      return Number(b.sortOrder || 0) - Number(a.sortOrder || 0);
    });
  const active = editorialConfig?.active || { topics: "cms/topics", speakers: "cms/speakers", sponsors: "cms/sponsors", members: "cms/members", membershipApplications: "cms/membership-applications", boardMembers: "cms/board", editorialContent: "cms/editorial", mailQueue: "cms/mail", eventMedia: "cms/followup" }[module];
  const editable = !["mailQueue", "eventMedia"].includes(module);
  const manageable = module !== "mailQueue";
  const inactiveStatus = module === "editorialContent" || module === "eventMedia" || module === "speakers" || module === "sponsors" ? "archived" : "inactive";
  const activeStatus = ["editorialContent", "speakers", "sponsors"].includes(module) ? "published" : module === "eventMedia" ? "approved" : "active";
  const title = editorialConfig?.title || config[0];
  const itemLabel = editorialConfig?.itemLabel || config[1];
  const createParams = editorialConfig?.createParams || "";
  const emptyText = editorialConfig ? `Noch keine Inhalte in ${escapeHtml(title)}.` : "Noch keine Eintraege vorhanden.";
  if (module === "topics") {
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial table--topics"><thead><tr><th>Bild</th><th>Titel</th><th>Datum</th><th>Rubrik</th><th>Audio</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${records.length ? records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table">${topicThumb(item)}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a></td><td>${escapeHtml(listDate(item))}</td><td>Thema</td><td>${audioListCell("topics", item)}</td><td>${editorialListStatus(item)}</td><td>${editorialActionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="7">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "editorialContent") {
    const showAudio = section === "news";
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial"><thead><tr><th>Titel</th><th>Datum</th><th>Rubrik</th>${showAudio ? "<th>Audio</th>" : ""}<th>Status</th><th>Aktionen</th></tr></thead><tbody>${records.length ? records.map((item) => `<tr><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a></td><td>${escapeHtml(listDate(item))}</td><td>${escapeHtml(item.category || item.page || "-")}</td>${showAudio ? `<td>${audioListCell("editorialContent", item)}</td>` : ""}<td>${editorialListStatus(item)}</td><td>${editorialActionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="${showAudio ? 6 : 5}">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, editable ? `<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>` : "")}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>${itemLabel}</th><th>Datum / Gueltigkeit</th><th>Beschreibung / Zuordnung</th><th>Status</th>${editable || manageable ? "<th>Aktionen</th>" : ""}</tr></thead><tbody>${records.length ? records.map((item) => `<tr><td>${escapeHtml(item[config[2]] || "-")}</td><td>${escapeHtml(item.publishDate || item.date || "-")}<br><small>${escapeHtml(item.validFrom || "-")} bis ${escapeHtml(item.validTo || "unendlich")}</small></td><td>${escapeHtml(item[config[3]] || "-")}</td><td>${status(item.status || item.visibility || "active")}</td>${editable || manageable ? `<td><div class="table-actions">${editable ? `<a class="link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}">Bearbeiten</a>` : ""}${manageable ? `<button class="link-button" data-record-status="${module}" data-record-id="${item.id}" data-status="${activeStatus}">Aktiv</button><button class="link-button" data-record-status="${module}" data-record-id="${item.id}" data-status="${inactiveStatus}">Inaktiv</button><button class="link-button link-button--danger" data-delete-record="${module}" data-record-id="${item.id}">Loeschen</button>` : ""}</div></td>` : ""}</tr>`).join("") : `<tr><td colspan="${editable || manageable ? 5 : 4}">${emptyText}</td></tr>`}</tbody></table></div></section>`));
}

function topicSpeakerEditor(topic, speaker) {
  return `<div class="form-grid--two"><input type="hidden" name="speakerIds" value="${speaker.id}"><div class="field"><label>Referentname</label><input name="speaker-${speaker.id}-name" value="${escapeHtml(speaker.name || "")}"></div><div class="field"><label>Firma</label><input name="speaker-${speaker.id}-company" value="${escapeHtml(speaker.company || "")}"></div><div class="field"><label>Position</label><input name="speaker-${speaker.id}-position" value="${escapeHtml(speaker.position || "")}"></div><div class="field"><label>Kurzvita</label><textarea name="speaker-${speaker.id}-shortBio">${escapeHtml(speaker.shortBio || "")}</textarea></div></div>`;
}

function topicSpeakerManager(topic, speakers) {
  const assigned = speakers.filter((speaker) => speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id));
  return `<div class="form-grid" style="margin-top:18px"><h2>Referenten</h2><div class="selection-grid">${speakers.length ? speakers.map((speaker) => `<label class="selection-item"><input type="checkbox" name="assignedSpeakerIds" value="${speaker.id}" ${speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id) ? "checked" : ""}><span><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml(speaker.company || "")}</small></span></label>`).join("") : `<div class="alert">Noch keine Referenten vorhanden.</div>`}</div>${assigned.length ? assigned.map((speaker) => `<section class="panel"><h3>${escapeHtml(speaker.name || "Referent")}</h3>${topicSpeakerEditor(topic, speaker)}</section>`).join("") : ""}<section class="panel"><h3>Neuen Referenten anlegen</h3><div class="form-grid--two"><div class="field"><label>Referentname</label><input name="newSpeakerName"></div><div class="field"><label>Firma</label><input name="newSpeakerCompany"></div><div class="field"><label>Position</label><input name="newSpeakerPosition"></div><div class="field"><label>Kurzvita</label><textarea name="newSpeakerShortBio"></textarea></div></div></section></div>`;
}

export async function contentEditPage(module, id, query = new URLSearchParams()) {
  if (!hasCmsAccess()) return denied();
  const definitions = {
    topics: { title: "Redaktionelles Thema", fields: [["title", "Thema"], ["shortDescription", "Kurze Beschreibung"]] },
    speakers: { title: "Referent", fields: [["name", "Referent Name"], ["company", "Firma"]] },
    sponsors: { title: "Sponsor / Gastgeber", fields: [["name", "Name"], ["role", "Sponsor / Gastgeber"], ["address", "Adresse"], ["website", "Webseite"]] },
    members: { title: "Mitglied", fields: [["name", "Firmenname"], ["description", "Beschreibung"], ["website", "Website"], ["category", "Kategorie"], ["city", "Ort"], ["contactEmail", "Kontakt E-Mail"]] },
    membershipApplications: { title: "Mitgliedsantrag", fields: [["company", "Unternehmen / Name"], ["legalForm", "Rechtsform"], ["street", "Strasse"], ["city", "PLZ / Ort"], ["country", "Land"], ["website", "Website"], ["firstName", "Vorname"], ["lastName", "Nachname"], ["position", "Position"], ["email", "E-Mail"], ["phone", "Telefon"], ["membershipType", "Mitgliedschaft: company oder individual"], ["companyDescription", "Kurzbeschreibung"], ["message", "Nachricht"], ["status", "Status"], ["submittedAt", "Eingegangen"]] },
    boardMembers: { title: "Vorstandsmitglied", fields: [["name", "Name"], ["role", "Funktion / Rolle"], ["company", "Unternehmen"], ["shortBio", "Kurzbeschreibung"], ["linkedIn", "LinkedIn"], ["website", "Website"]] },
    editorialContent: { title: "Redaktioneller Inhalt", fields: [["title", "Seitentitel"], ["page", "Bereich"], ["section", "Sektion"], ["key", "Inhaltsschluessel"], ["publishDate", "Datum"], ["validFrom", "Gueltig von"], ["validTo", "Gueltig bis (leer = unendlich)"], ["subtitle", "Untertitel"], ["introText", "Introtext"], ["bodyText", "Haupttext"], ["buttonText", "Button-Text"], ["buttonUrl", "Button-Link"], ["seoTitle", "SEO-Titel"], ["seoDescription", "SEO-Beschreibung"]] }
  };
  const definition = definitions[module];
  if (!definition) return dashboardPage();
  const item = id === "new" ? { id: `${module}-${crypto.randomUUID()}`, page: query.get("page") || "", section: query.get("section") || "", key: query.get("page") && query.get("section") ? `${query.get("page")}.${query.get("section")}` : "", category: module === "topics" ? "Thema" : "", status: module === "topics" ? "active" : "draft", visibility: "public" } : await getOne(module, id);
  const topicSpeakers = module === "topics" ? await list("speakers") : [];
  if (module === "editorialContent" && ["press", "news"].includes(item.page || query.get("page"))) {
    const sectionKey = item.page === "news" || query.get("page") === "news" ? "news" : "press";
    const allEditorial = await list("editorialContent");
    const categories = Array.from(new Set(allEditorial
      .filter((entry) => entry.page === sectionKey)
      .map((entry) => entry.category || (sectionKey === "press" ? "Presse" : "News"))
      .filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const categoryValue = item.category || (sectionKey === "press" ? "Presse" : "News");
    const categoryOptions = Array.from(new Set([categoryValue, ...categories])).filter(Boolean);
    const backPath = sectionKey === "press" ? "editorial/press" : "editorial/news";
    return protect(cmsShell(`cms/${backPath}`, `${cmsTitle("Redaktion", sectionKey === "press" ? "Pressemeldung bearbeiten" : "News bearbeiten", `<a class="button button--secondary button--small" href="#/cms/${backPath}">Zurueck</a>`)}
      <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid">
        <input type="hidden" name="page" value="${escapeHtml(sectionKey)}">
        <input type="hidden" name="section" value="${escapeHtml(sectionKey === "press" ? "pressRelease" : "news")}">
        <input type="hidden" name="key" value="${escapeHtml(item.key || `${sectionKey}.${item.id}`)}">
        <input type="hidden" name="validFrom" value="${escapeHtml(item.validFrom || item.publishDate || "")}">
        <div class="form-grid--two">
          <div class="field"><label>Datum der Veroeffentlichung</label><input type="date" name="publishDate" value="${escapeHtml(item.publishDate || "")}"></div>
          <div class="field"><label>Enddatum der Gueltigkeit</label><input type="date" name="validTo" value="${escapeHtml(item.validTo || "")}"><p class="muted">Leer lassen = unendlich.</p></div>
          <div class="field"><label>Kategorie</label><select name="category">${categoryOptions.map((category) => `<option value="${escapeHtml(category)}" ${category === categoryValue ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></div>
          <div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="published" ${item.status === "published" ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div>
        </div>
        <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(item.title || "")}" required>${aiFieldActions([{ action: "improveText", target: "title", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "title" }])}</div>
        <div class="field"><label>Subtitel</label><input name="subtitle" value="${escapeHtml(item.subtitle || "")}">${aiFieldActions([{ action: "improveText", target: "subtitle", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "subtitle" }])}</div>
        <div class="field"><label>Haupttext</label><textarea name="bodyText" required>${escapeHtml(item.bodyText || "")}</textarea>${aiFieldActions([{ action: "improveText", target: "bodyText", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "bodyText" }])}</div>
        <div class="field"><label>Optionaler Short Text</label><textarea name="introText">${escapeHtml(item.introText || "")}</textarea>${aiFieldActions([{ action: "shortenText", target: "introText", label: "Mit ChatGPT kuerzen", entityType: module, entityId: item.id, fieldName: "introText" }])}</div>
        <div class="field"><label>Bild / Thumb optional</label>${imageDropzone({ inputName: "assetFile", removeName: "removeAssetFile", imageUrl: item.imageUrl || "", label: "Bild", defaultSize: "1200x675" })}</div>
        ${sectionKey === "news" ? audioGenerationPanel("editorialContent", item) : ""}
        <input type="hidden" name="visibility" value="${escapeHtml(item.visibility || "public")}">
        <button class="button button--primary">Speichern</button><div id="content-save-result"></div>
      </form></section>`));
  }
  if (module === "topics") {
    return protect(cmsShell("cms/topics", `${cmsTitle("Redaktion", "Thema bearbeiten", `<a class="button button--secondary button--small" href="#/cms/topics">Zurueck</a>`)}
      <section class="panel"><form id="topic-editor-form" data-topic-id="${item.id}" class="form-grid is-save-aware">
        <div class="form-grid--two">
          <div class="field"><label>Datum der Veroeffentlichung</label><input type="date" name="publishDate" value="${escapeHtml(item.publishDate || "")}"></div>
          <div class="field"><label>Enddatum der Gueltigkeit</label><input type="date" name="validTo" value="${escapeHtml(item.validTo || "")}"><p class="muted">Leer lassen = unendlich.</p></div>
          <div class="field"><label>Kategorie</label><input name="category" value="${escapeHtml(item.category || "Thema")}"></div>
          <div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="active" ${item.status === "active" ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="inactive" ${item.status === "inactive" ? "selected" : ""}>Inaktiv</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div>
        </div>
        <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(item.title || "")}">${aiFieldActions([{ action: "improveText", target: "title", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "title" }])}</div>
        <div class="field"><label>Subtitel</label><input name="subtitle" value="${escapeHtml(item.subtitle || "")}">${aiFieldActions([{ action: "improveText", target: "subtitle", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "subtitle" }])}</div>
        <div class="field"><label>Haupttext</label><textarea name="longDescription">${escapeHtml(item.longDescription || item.bodyText || "")}</textarea>${aiFieldActions([{ action: "generateTopicDescription", target: "longDescription", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "longDescription" }])}</div>
        <div class="field"><label>Optionaler Short Text</label><textarea name="shortDescription">${escapeHtml(item.shortDescription || item.introText || "")}</textarea>${aiFieldActions([{ action: "shortenText", target: "shortDescription", label: "Mit ChatGPT kuerzen", entityType: module, entityId: item.id, fieldName: "shortDescription" }])}</div>
        <div class="field"><label>Bild / Thumb optional</label>${imageDropzone({ inputName: "topicImage", removeName: "removeTopicImage", imageUrl: item.imageUrl || "", label: "Themenbild", defaultSize: "1200x675" })}</div>
        ${audioGenerationPanel("topics", item)}
        <div class="actions"><button class="button button--primary">Speichern</button></div><div id="topic-editor-result"></div>
      </form></section>`));
  }
  if (module === "editorialContent" && (item.key === "home.hero" || item.id === "home-hero")) {
    return protect(cmsShell("cms/editorial/interna", `${cmsTitle("Startseite", "Hero bearbeiten", `<a class="button button--secondary button--small" href="#/cms/editorial/interna">Zurueck</a>`)}
      <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid">
        <div class="field"><label>Claim / Eyebrow</label><input name="teaserText" value="${escapeHtml(item.teaserText || "PROdigitalTV")}"></div>
        <div class="field"><label>Hero-Headline</label><textarea name="title" required>${escapeHtml(item.title || "")}</textarea>${aiFieldActions([{ action: "improveText", target: "title", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "title" }])}</div>
        <div class="field"><label>Hero-Subheadline</label><textarea name="subtitle">${escapeHtml(item.subtitle || "")}</textarea>${aiFieldActions([{ action: "improveText", target: "subtitle", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "subtitle" }])}</div>
        <div class="form-grid--two">
          <div class="field"><label>CTA 1 Text</label><input name="buttonText" value="${escapeHtml(item.buttonText || "Naechstes Event")}"></div>
          <div class="field"><label>CTA 1 Link</label><input name="buttonUrl" value="${escapeHtml(item.buttonUrl || "#/events")}"></div>
          <div class="field"><label>CTA 2 Text</label><input name="secondaryButtonText" value="${escapeHtml(item.secondaryButtonText || "Mitglied werden")}"></div>
          <div class="field"><label>CTA 2 Link</label><input name="secondaryButtonUrl" value="${escapeHtml(item.secondaryButtonUrl || "#/join")}"></div>
        </div>
        <div class="field"><label>Hero-Bild optional</label><input type="file" name="assetFile" accept="image/*"><p class="muted">${item.imageUrl ? "Aktuelles Bild ist zugeordnet. Neue Auswahl ersetzt es beim Speichern." : "Bild ueber Dateiauswahl zuordnen."}</p></div>
        <div class="form-grid--two"><div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="published" ${item.status === "published" ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div><div class="field"><label>Sichtbarkeit</label><select name="visibility"><option value="public" ${item.visibility === "public" ? "selected" : ""}>Oeffentlich</option><option value="members" ${item.visibility === "members" ? "selected" : ""}>Mitglieder</option><option value="internal" ${item.visibility === "internal" ? "selected" : ""}>Intern</option></select></div></div>
        <button class="button button--primary">Speichern</button><div id="content-save-result"></div>
      </form></section>`));
  }
  if (module === "editorialContent" && isInternalEditorialItem(item)) {
    return protect(cmsShell("cms/editorial/interna", `${cmsTitle("Interna", "Textbaustein bearbeiten", `<a class="button button--secondary button--small" href="#/cms/editorial/interna">Zurueck</a>`)}
      <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid form-grid--compact">
        <input type="hidden" name="page" value="${escapeHtml(item.page || "")}">
        <input type="hidden" name="section" value="${escapeHtml(item.section || "")}">
        <input type="hidden" name="key" value="${escapeHtml(item.key || "")}">
        <input type="hidden" name="status" value="published">
        <input type="hidden" name="visibility" value="public">
        <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(item.title || "")}">${aiFieldActions([{ action: "improveText", target: "title", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "title" }])}</div>
        <div class="field"><label>Text</label><textarea name="bodyText">${escapeHtml(item.bodyText || "")}</textarea>${aiFieldActions([{ action: "improveText", target: "bodyText", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "bodyText" }])}</div>
        <div class="field"><label>Bild oder PDF</label>${item.imageUrl ? `<div class="asset-preview"><img src="${escapeHtml(item.imageUrl)}" alt=""></div>` : item.documentUrl || item.assetUrl ? `<p><a class="link" href="${escapeHtml(item.documentUrl || item.assetUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.assetFileName || "Datei oeffnen")}</a></p>` : `<p class="muted">Noch keine Datei gespeichert.</p>`}<input type="file" name="assetFile" accept="image/*,.pdf,application/pdf"><label class="checkbox-line"><input type="checkbox" name="removeAssetFile" value="1"> Datei loeschen</label><p class="muted">Bilder und PDFs koennen hier als Baustein-Asset hinterlegt werden.</p></div>
        <p class="muted">Baustein: ${escapeHtml(item.key || [item.page, item.section].filter(Boolean).join(" / ") || item.id)}</p>
        <button class="button button--primary">Speichern</button><div id="content-save-result"></div>
      </form></section>`));
  }
  const fieldHtml = definition.fields.map(([field, label]) => {
    const long = ["description", "shortDescription", "longDescription", "articleText", "topicText", "shortBio", "longBio", "introText", "bodyText", "seoDescription"].includes(field);
    const action = module === "topics" ? "generateTopicDescription" : module === "speakers" ? "generateSpeakerTalkText" : module === "sponsors" ? "generateSponsorText" : "improveText";
    const ai = long || field.toLowerCase().includes("seo") ? aiFieldActions([{ action: field.toLowerCase().includes("seo") ? "generateSeoMeta" : action, target: field, label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: field }]) : "";
    return `<div class="field"><label>${label}</label>${long ? `<textarea name="${field}">${escapeHtml(item?.[field] || "")}</textarea>` : `<input name="${field}" value="${escapeHtml(item?.[field] || "")}">`}${ai}</div>`;
  }).join("");
  const imageUpload = module === "topics"
    ? `<div class="field"><label>Themenbild hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das neue Bild ersetzt beim Speichern das zugeordnete Bild.</p></div>`
    : module === "members"
      ? `<div class="field"><label>Logo-Datei auswaehlen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das neue Logo ersetzt beim Speichern das zugeordnete Bild.</p></div>`
      : module === "boardMembers"
      ? `<div class="field"><label>Vorstandsfoto hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das Foto wird beim Speichern dem Vorstandsprofil zugeordnet.</p></div>`
      : module === "speakers"
        ? `<div class="field"><label>Referentenfoto hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das Foto wird beim Speichern dem Referentenprofil zugeordnet und im Eventkontext angezeigt.</p></div>`
      : module === "sponsors"
        ? `<div class="field"><label>Logo auswaehlen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das Logo ersetzt beim Speichern das zugeordnete Bild.</p></div>`
      : "";
  const speakerManager = module === "topics" ? topicSpeakerManager(item, topicSpeakers) : "";
  const activeStatus = ["topics", "members", "boardMembers"].includes(module) ? "active" : "published";
  const editorialBack = query.get("section") && editorialSections[query.get("section")] ? `editorial/${query.get("section")}` : item.page === "press" ? "editorial/press" : item.page === "news" ? "editorial/news" : module === "editorialContent" ? "editorial/interna" : "editorial";
  const backSection = { boardMembers: "board", editorialContent: editorialBack, speakers: "speakers", sponsors: "sponsors" }[module] || module;
  const activeSection = { topics: "cms/topics", speakers: "cms/speakers", sponsors: "cms/sponsors", members: "cms/members", boardMembers: "cms/board", editorialContent: `cms/${editorialBack}` }[module] || "cms/editorial";
  return protect(cmsShell(activeSection, `${cmsTitle("Bearbeiten", `${definition.title} pflegen`, `<a class="button button--secondary button--small" href="#/cms/${backSection}">Zurueck</a>`)}<section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid">${fieldHtml}${imageUpload}<div class="form-grid--two"><div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="${activeStatus}" ${item.status === activeStatus ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div><div class="field"><label>Sichtbarkeit</label><select name="visibility"><option value="public" ${item.visibility === "public" ? "selected" : ""}>Oeffentlich</option><option value="members" ${item.visibility === "members" ? "selected" : ""}>Mitglieder</option><option value="internal" ${item.visibility === "internal" ? "selected" : ""}>Intern</option></select></div></div><button class="button button--primary">Speichern</button><div id="content-save-result"></div></form></section>${speakerManager}`));
}

export async function setupPage() {
  if (!hasCmsAccess(true)) return denied(true);
  const setup = await getOne("system", "setup");
  return protect(cmsShell("cms/setup", `${cmsTitle("System / Einrichtung", "Firebase Setup-Assistent")}<div class="cms-columns"><section class="panel"><h2>Installationsstatus</h2><div class="setup-steps"><div class="setup-step"><span>Installation</span>${status(setup?.installed ? "installed" : "not_installed")}</div><div class="setup-step"><span>Version</span><strong>${setup?.version || "-"}</strong></div><div class="setup-step"><span>Demo-Daten</span>${status(setup?.demoDataInstalled ? "installed" : "optional")}</div></div><div class="actions" style="margin-top:22px;flex-wrap:wrap"><button class="button button--dark button--small" data-setup-action="connection">Verbindung testen</button><button class="button button--dark button--small" data-setup-action="structure">Struktur pruefen</button><button class="button button--primary button--small" data-setup-action="initialize">Basisdaten anlegen</button><button class="button button--secondary button--small" data-setup-action="demo">Demo-Daten anlegen</button><button class="button button--secondary button--small" data-setup-action="remove-demo">Demo-Daten entfernen</button></div><div id="setup-result" style="margin-top:18px"></div></section><section class="panel"><h2>Setup-Protokoll</h2>${(setup?.setupLog || []).length ? setup.setupLog.map((log) => `<div class="fact"><strong>${escapeHtml(log.message)}</strong><span class="muted">${formatDateTime(log.timestamp)}</span></div>`).join("") : `<p>Noch keine protokollierten Setup-Aktionen.</p>`}<div class="alert alert--warning" style="margin-top:19px">Demodaten entfernen und andere destruktive Aktionen benoetigen vor Ausfuehrung eine ausdrueckliche Bestaetigung.</div></section></div>`), true);
}

export async function chatGptPage() {
  if (!hasCmsAccess()) return denied();
  const [events, media, aiLogs, aiDrafts] = await Promise.all([list("events"), list("eventMedia"), list("aiLogs"), list("aiDrafts")]);
  const sampleEvent = events[0] || {};
  return protect(cmsShell("cms/chatgpt", `${cmsTitle("ChatGPT", "KI-Unterstuetzung", `<a class="button button--secondary button--small" href="#/cms/ai-settings">Einstellungen</a>`)}
    <div class="cms-columns">
      <section class="panel">
        <h2>Event-Admin-Pipeline</h2>
        <p>ChatGPT erzeugt nur Vorschlaege. Redakteure muessen Inhalte pruefen, bearbeiten und bewusst speichern.</p>
        <div class="setup-steps" style="margin-top:18px">
          <div class="setup-step"><span>Event-Vorlauf</span><strong>Beschreibung, Einladung, Agenda, FAQ</strong></div>
          <div class="setup-step"><span>Themen & Referenten</span><strong>keine erfundenen Personen</strong></div>
          <div class="setup-step"><span>Nachlauf</span><strong>Rueckblick, Archiv, Newsletter</strong></div>
          <div class="setup-step"><span>Fotogalerie / Downloads</span><strong>optional, keine Pflichtfehler</strong></div>
        </div>
        <div style="margin-top:20px">${aiButton("analyzeEventPipelineQuality", "chatgpt-dashboard-context", "Pipeline-Beispiel pruefen", { entityId: sampleEvent.id || "", fieldName: "dashboardQuality" })}</div>
        <div id="chatgpt-dashboard-context" hidden>${escapeHtml(JSON.stringify({ event: sampleEvent, media }))}</div>
      </section>
      <section class="panel">
        <h2>Protokoll und Entwuerfe</h2>
        <div class="setup-steps">
          <div class="setup-step"><span>aiLogs</span><strong>${aiLogs.length}</strong></div>
          <div class="setup-step"><span>aiDrafts</span><strong>${aiDrafts.length}</strong></div>
        </div>
        <p class="muted" style="margin-top:16px">Alle produktiven KI-Aktionen werden serverseitig protokolliert, sofern Logging aktiv ist.</p>
      </section>
    </div>
    <section class="panel"><h2>Letzte KI-Logs</h2><div class="table-wrap"><table class="table"><thead><tr><th>Aktion</th><th>Modul</th><th>Status</th><th>Vorschau</th></tr></thead><tbody>${aiLogs.slice(-20).reverse().map((log) => `<tr><td>${escapeHtml(log.action || "-")}</td><td>${escapeHtml(log.module || "-")}</td><td>${status(log.status || "suggested")}</td><td>${escapeHtml(log.resultPreview || "")}</td></tr>`).join("") || `<tr><td colspan="4">Noch keine KI-Logs.</td></tr>`}</tbody></table></div></section>`));
}

export async function aiSettingsPage() {
  if (!hasCmsAccess(true)) return denied(true);
  const settings = await getOne("settings", "ai") || {
    enabled: false,
    provider: "openai",
    model: "gpt-4.1-mini",
    temperature: 0.3,
    maxTokens: 900,
    defaultTone: "serioes, professionell, B2B-orientiert",
    allowedRoles: ["admin", "editor"],
    loggingEnabled: true
  };
  return protect(cmsShell("cms/ai-settings", `${cmsTitle("System", "ChatGPT-Einstellungen")}
    <section class="panel">
      <form id="ai-settings-form" class="form-grid">
        <label class="checkbox"><input type="checkbox" name="enabled" ${settings.enabled ? "checked" : ""}> ChatGPT aktivieren</label>
        <div class="form-grid--two">
          <div class="field"><label>Provider</label><input name="provider" value="openai" disabled></div>
          <div class="field"><label>Modell</label><input name="model" value="${escapeHtml(settings.model || "gpt-4.1-mini")}"></div>
          <div class="field"><label>Temperatur</label><input name="temperature" type="number" step="0.1" min="0" max="1" value="${settings.temperature ?? 0.3}"></div>
          <div class="field"><label>Maximale Antwortlaenge</label><input name="maxTokens" type="number" min="100" max="4000" value="${settings.maxTokens || 900}"></div>
        </div>
        <div class="field"><label>Standard-Tonalitaet</label><textarea name="defaultTone">${escapeHtml(settings.defaultTone || "")}</textarea></div>
        <label class="checkbox"><input type="checkbox" name="allowAdmin" ${settings.allowedRoles?.includes("admin") ? "checked" : ""}> Admins duerfen ChatGPT nutzen</label>
        <label class="checkbox"><input type="checkbox" name="allowEditor" ${settings.allowedRoles?.includes("editor") ? "checked" : ""}> Editoren duerfen ChatGPT nutzen</label>
        <label class="checkbox"><input type="checkbox" name="loggingEnabled" ${settings.loggingEnabled !== false ? "checked" : ""}> KI-Aktionen in aiLogs protokollieren</label>
        <div class="alert">Der OpenAI API-Key wird nicht im Frontend gespeichert. Hinterlege ihn serverseitig als Firebase Secret <code>OPENAI_API_KEY</code>.</div>
        <div class="actions"><button class="button button--primary">Einstellungen speichern</button><button type="button" class="button button--secondary" id="ai-test-connection">Verbindung testen</button></div>
        <div id="ai-settings-result"></div>
      </form>
    </section>`), true);
}
