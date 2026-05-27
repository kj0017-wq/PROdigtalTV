import { route, onRouteChange, go } from "./utils/router.js";
import {
  homePage, eventsPage, eventDetailPage, registrationPage, topicsPage, topicDetailPage,
  aboutPage, membersPage, boardPage, archivePage, joinPage, loginPage, portalPage, legalPage, notFoundPage
} from "./pages/publicPages.js";
import {
  dashboardPage, eventsAdminPage, eventFollowUpPage, eventEditPage, registrationsPage, moduleListPage, contentEditPage, setupPage, chatGptPage, aiSettingsPage
} from "./cms/cmsPages.js";
import { createRegistration } from "./firebase/registrationService.js";
import { login, loginWithGoogle, logout, refreshAuthToken, waitForAuthReady } from "./firebase/authService.js";
import { getOne, list, upsert, remove } from "./firebase/dataService.js";
import { deleteStoredAsset, uploadEntityImage, uploadEventMedia } from "./firebase/storageService.js";
import { checkFirebaseConnection, checkFirestoreStructure, initializeDatabase, createDemoData, removeDemoData } from "./firebase/setupService.js";
import { downloadRegistrationsCsv } from "./utils/csv.js";
import { escapeHtml } from "./utils/format.js";
import { callChatGptAction, saveAiDraft } from "./ai/openaiService.js";

const root = document.querySelector("#app");

async function viewForRoute(current) {
  if (current.path === "home") return homePage();
  if (current.path === "events") return eventsPage();
  if (current.path === "event") return eventDetailPage(current.id);
  if (current.path === "register") return registrationPage(current.id);
  if (current.path === "topics") return topicsPage();
  if (current.path === "topic") return topicDetailPage(current.id);
  if (current.path === "about") return aboutPage();
  if (current.path === "board") return boardPage();
  if (current.path === "members") return membersPage();
  if (current.path === "join") return joinPage();
  if (current.path === "archive") return archivePage();
  if (current.path === "login") return loginPage();
  if (current.path === "portal") return portalPage();
  if (current.path === "imprint") return legalPage("imprint");
  if (current.path === "privacy") return legalPage("privacy");
  if (current.path === "cms" && !current.id) return dashboardPage();
  if (current.path === "cms" && current.id === "events") return eventsAdminPage();
  if (current.path === "cms" && current.id === "event") return eventEditPage(current.section, current.query.get("tab") || "base", current.query);
  if (current.path === "cms" && current.id === "registrations") return registrationsPage();
  if (current.path === "cms" && ["followup", "media"].includes(current.id)) return eventFollowUpPage();
  if (current.path === "cms" && current.id === "topics") return moduleListPage("topics");
  if (current.path === "cms" && current.id === "speakers") return moduleListPage("speakers");
  if (current.path === "cms" && current.id === "sponsors") return moduleListPage("sponsors");
  if (current.path === "cms" && current.id === "members") return moduleListPage("members");
  if (current.path === "cms" && current.id === "board") return moduleListPage("boardMembers");
  if (current.path === "cms" && current.id === "editorial") return moduleListPage("editorialContent");
  if (current.path === "cms" && current.id === "mail") return moduleListPage("mailQueue");
  if (current.path === "cms" && current.id === "chatgpt") return chatGptPage();
  if (current.path === "cms" && current.id === "ai-settings") return aiSettingsPage();
  if (current.path === "cms" && current.id === "edit") return contentEditPage(current.query.get("module"), current.query.get("id"));
  if (current.path === "cms" && current.id === "setup") return setupPage();
  return notFoundPage();
}

async function render() {
  try {
    root.innerHTML = await viewForRoute(route());
    wireActions();
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error(error);
    root.innerHTML = `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Seite konnte nicht geladen werden</p><h1>Bitte neu laden</h1><p style="margin:14px 0 24px">${escapeHtml(error.message || String(error))}</p><a class="button button--primary" href="#/login">Zum Login</a></div></section>`;
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#/"]');
  if (!link) return;
  window.setTimeout(render, 0);
});

function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach((item) => {
    data[item.name] = item.checked;
  });
  return data;
}

function dataUrlToFile(dataUrl, fileName) {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: mime });
}

function imageFileFromDropzone(form, inputName, entityId) {
  const input = form.querySelector(`input[name="${inputName}"]`);
  const file = input?.files?.[0];
  if (file) return file;
  const dataUrl = form.elements[`${inputName}DataUrl`]?.value;
  return dataUrlToFile(dataUrl, `${entityId || "image"}-240x180.jpg`);
}

function findAiSource(button) {
  const form = button.closest("form") || document;
  const target = button.dataset.aiTarget;
  const field = form.querySelector(`[name="${target}"]`) || document.getElementById(target);
  if (!field) return { text: "", field: null };
  return { text: field.value ?? field.textContent ?? "", field };
}

function eventContext(button) {
  const form = button.closest("form");
  const formValues = form ? formObject(form) : {};
  const hiddenContext = document.getElementById(button.dataset.aiTarget)?.textContent;
  let parsedContext = {};
  if (hiddenContext) {
    try { parsedContext = JSON.parse(hiddenContext); } catch { parsedContext = { notes: hiddenContext }; }
  }
  return {
    ...parsedContext,
    ...formValues,
    placeholders: ["{{firstName}}", "{{lastName}}", "{{eventTitle}}", "{{eventDate}}", "{{eventLocation}}", "{{confirmationLink}}"]
  };
}

function structuredToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function showAiDialog({ button, originalText, result, sourceField }) {
  document.querySelector(".ai-dialog-backdrop")?.remove();
  const suggestedText = result.suggestedText || structuredToText(result.structured);
  const wrapper = document.createElement("div");
  wrapper.className = "ai-dialog-backdrop";
  wrapper.innerHTML = `<div class="ai-dialog" role="dialog" aria-modal="true">
    <div class="actions" style="justify-content:space-between"><div><p class="eyebrow">ChatGPT-Vorschlag</p><h2>${escapeHtml(button.textContent.trim())}</h2></div><button type="button" class="link-button" data-ai-close>Schliessen</button></div>
    <div class="ai-dialog-grid">
      <div class="field"><label>Originaltext</label><textarea readonly>${escapeHtml(originalText)}</textarea></div>
      <div class="field"><label>KI-Vorschlag</label><textarea data-ai-suggestion>${escapeHtml(suggestedText)}</textarea></div>
    </div>
    ${result.structured ? `<pre class="ai-structured">${escapeHtml(JSON.stringify(result.structured, null, 2))}</pre>` : ""}
    <div class="actions"><button type="button" class="button button--primary" data-ai-accept>Uebernehmen</button><button type="button" class="button button--secondary" data-ai-save-draft>Als Entwurf speichern</button><button type="button" class="button button--secondary" data-ai-regenerate>Neu generieren</button><button type="button" class="button button--secondary" data-ai-close>Verwerfen</button></div>
    <p class="muted">KI-Ausgaben werden nicht automatisch veroeffentlicht. Bitte pruefen, bearbeiten und erst danach speichern.</p>
  </div>`;
  document.body.append(wrapper);
  wrapper.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => wrapper.remove()));
  wrapper.querySelector("[data-ai-accept]").addEventListener("click", () => {
    const value = wrapper.querySelector("[data-ai-suggestion]").value;
    if (sourceField && "value" in sourceField) sourceField.value = value;
    wrapper.remove();
  });
  wrapper.querySelector("[data-ai-save-draft]").addEventListener("click", async () => {
    const value = wrapper.querySelector("[data-ai-suggestion]").value;
    await saveAiDraft({
      entityType: button.dataset.aiEntityType,
      entityId: button.dataset.aiEntityId,
      fieldName: button.dataset.aiField,
      originalText,
      suggestedText: value,
      action: button.dataset.aiAction
    });
    wrapper.querySelector(".muted").textContent = "KI-Entwurf wurde in aiDrafts gespeichert.";
  });
  wrapper.querySelector("[data-ai-regenerate]").addEventListener("click", () => {
    wrapper.remove();
    button.click();
  });
}

function wireImageDropzones() {
  document.querySelectorAll("[data-image-dropzone]").forEach((zone) => {
    const form = zone.closest("form");
    const input = zone.querySelector('input[type="file"]');
    const removeInput = zone.querySelector('input[type="hidden"]');
    const dataInput = zone.querySelector(`input[name="${input?.name}DataUrl"]`);
    const preview = zone.querySelector("[data-image-preview]");
    const removeButton = zone.querySelector("[data-image-remove]");
    const tools = zone.querySelector("[data-image-tools]");
    const zoom = zone.querySelector("[data-image-zoom]");
    const cropButton = zone.querySelector("[data-image-crop]");
    const status = zone.querySelector("[data-image-status]");
    const emptyText = preview?.querySelector("span")?.textContent || "Bild per Drag-and-drop oder Klick hochladen";
    const crop = { file: null, src: "", img: null, x: 0, y: 0, scale: 1, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 };
    const renderCrop = () => {
      if (!crop.img) return;
      crop.img.style.width = "auto";
      crop.img.style.height = "auto";
      crop.img.style.maxWidth = "none";
      crop.img.style.maxHeight = "none";
      crop.img.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`;
      crop.img.style.transformOrigin = "center";
    };
    const showFile = (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      form?.classList.remove("is-saved");
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        crop.file = file;
        crop.src = reader.result;
        crop.x = 0;
        crop.y = 0;
        crop.scale = 1;
        preview.innerHTML = `<img src="${reader.result}" alt="">`;
        crop.img = preview.querySelector("img");
        preview.classList.add("has-image");
        tools.hidden = false;
        zoom.value = "1";
        removeInput.value = "";
        if (dataInput) dataInput.value = "";
        status.textContent = "Neues Bild ausgewählt. Bitte Crop anwenden und speichern.";
        renderCrop();
      });
      reader.readAsDataURL(file);
    };
    preview?.addEventListener("click", () => {
      if (preview.classList.contains("has-image")) return;
      input.click();
    });
    input?.addEventListener("change", () => showFile(input.files?.[0]));
    preview?.addEventListener("pointerdown", (event) => {
      if (!crop.img) return;
      crop.dragging = true;
      crop.startX = event.clientX;
      crop.startY = event.clientY;
      crop.originX = crop.x;
      crop.originY = crop.y;
      preview.setPointerCapture(event.pointerId);
    });
    preview?.addEventListener("pointermove", (event) => {
      if (!crop.dragging) return;
      crop.x = crop.originX + event.clientX - crop.startX;
      crop.y = crop.originY + event.clientY - crop.startY;
      renderCrop();
    });
    preview?.addEventListener("pointerup", () => { crop.dragging = false; });
    zoom?.addEventListener("input", () => {
      crop.scale = Number(zoom.value || 1);
      renderCrop();
    });
    cropButton?.addEventListener("click", async () => {
      if (!crop.img || !crop.file) return;
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 180;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const baseScale = Math.max(canvas.width / crop.img.naturalWidth, canvas.height / crop.img.naturalHeight);
      const width = crop.img.naturalWidth * baseScale * crop.scale;
      const height = crop.img.naturalHeight * baseScale * crop.scale;
      ctx.drawImage(crop.img, (canvas.width - width) / 2 + crop.x, (canvas.height - height) / 2 + crop.y, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
      const croppedFile = new File([blob], crop.file.name.replace(/\.[^.]+$/, "") + "-240x180.jpg", { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(croppedFile);
      input.files = transfer.files;
      crop.file = croppedFile;
      crop.src = canvas.toDataURL("image/jpeg", .9);
      if (dataInput) dataInput.value = crop.src;
      preview.innerHTML = `<img src="${crop.src}" alt="">`;
      crop.img = preview.querySelector("img");
      crop.x = 0;
      crop.y = 0;
      crop.scale = 1;
      zoom.value = "1";
      tools.hidden = true;
      status.textContent = "Bild zugeschnitten. Bitte speichern.";
      renderCrop();
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("is-dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      showFile(file);
    });
    removeButton?.addEventListener("click", () => {
      form?.classList.remove("is-saved");
      input.value = "";
      removeInput.value = "1";
      if (dataInput) dataInput.value = "";
      crop.file = null;
      crop.src = "";
      crop.img = null;
      tools.hidden = true;
      preview.innerHTML = `<span>${emptyText}</span>`;
      preview.classList.remove("has-image");
      status.textContent = "Bild zum Löschen markiert. Bitte speichern.";
    });
  });
}

function updateTopicThumbInList(topicId, imageUrl) {
  const safeId = window.CSS?.escape ? CSS.escape(topicId) : topicId.replace(/"/g, '\\"');
  const thumb = document.querySelector(`[data-topic-drag-id="${safeId}"] .topic-thumb`);
  if (!thumb) return;
  thumb.innerHTML = imageUrl ? `<img src="${imageUrl}" alt="">` : "<span>Bild</span>";
}

function updateDropzoneSavedImage(form, imageUrl) {
  const preview = form.querySelector("[data-image-preview]");
  const tools = form.querySelector("[data-image-tools]");
  const input = form.querySelector("[data-image-dropzone] input[type='file']");
  const dataInput = form.querySelector(`[name="${input?.name}DataUrl"]`);
  if (!preview) return;
  if (imageUrl) {
    preview.innerHTML = `<img src="${imageUrl}" alt="">`;
    preview.classList.add("has-image");
  } else {
    preview.innerHTML = "<span>Bild per Drag-and-drop oder Klick hochladen</span>";
    preview.classList.remove("has-image");
  }
  if (input) input.value = "";
  if (dataInput) dataInput.value = "";
  if (tools) tools.hidden = true;
}

async function saveEventTopicSpeakerForm(form) {
  const existingEvent = await getOne("events", form.dataset.eventId);
  const speakerId = form.dataset.speakerId || `speakers-${crypto.randomUUID()}`;
  const existingSpeaker = form.dataset.speakerId ? await getOne("speakers", speakerId) : { id: speakerId, status: "published", visibility: "public", createdAt: new Date().toISOString() };
  const topicIdsForSpeaker = new Set(existingSpeaker.topicIds || []);
  topicIdsForSpeaker.add(form.dataset.topicId);
  const eventIdsForSpeaker = new Set(existingSpeaker.eventIds || []);
  eventIdsForSpeaker.add(form.dataset.eventId);
  const eventSpeakerIds = Array.from(new Set([...(existingEvent.speakerIds || []), speakerId]));
  const image = imageFileFromDropzone(form, "speakerImage", speakerId);
  const imageUpdate = {};
  if (form.elements.removeSpeakerImage?.value === "1") {
    await deleteStoredAsset(existingSpeaker);
    imageUpdate.photoUrl = "";
    imageUpdate.assetStoragePath = "";
  }
  if (image) {
    await deleteStoredAsset(existingSpeaker);
    const asset = await uploadEntityImage("speakers", speakerId, image);
    imageUpdate.photoUrl = asset.url;
    imageUpdate.assetStoragePath = asset.storagePath;
  }
  await upsert("speakers", {
    ...existingSpeaker,
    id: speakerId,
    name: form.elements.name.value,
    company: form.elements.company.value,
    position: form.elements.position.value,
    ...imageUpdate,
    topicId: existingSpeaker.topicId || form.dataset.topicId,
    topicIds: Array.from(topicIdsForSpeaker),
    eventIds: Array.from(eventIdsForSpeaker),
    updatedAt: new Date().toISOString()
  });
  await upsert("events", { ...existingEvent, speakerIds: eventSpeakerIds, updatedAt: new Date().toISOString() });
  form.dataset.speakerId = speakerId;
  form.querySelector("#event-topic-speaker-result").innerHTML = `<div class="alert alert--success">Referent wurde gespeichert.</div>`;
  const imageStatus = form.querySelector("[data-image-status]");
  if (imageStatus) imageStatus.textContent = imageUpdate.photoUrl ? "Bild wurde gespeichert." : imageUpdate.photoUrl === "" ? "Bild wurde gelöscht." : imageStatus.textContent;
  form.classList.add("is-saved");
  if (!new URLSearchParams(location.hash.split("?")[1] || "").get("speaker")) {
    history.replaceState(null, "", `#/cms/event/${form.dataset.eventId}?tab=topics&mode=referent&topic=${form.dataset.topicId}&speaker=${speakerId}`);
  }
}

function wireActions() {
  wireImageDropzones();
  document.querySelectorAll("form.is-save-aware input, form.is-save-aware textarea, form.is-save-aware select").forEach((field) => {
    field.addEventListener("input", () => field.form?.classList.remove("is-saved"));
    field.addEventListener("change", () => field.form?.classList.remove("is-saved"));
  });
  document.querySelectorAll(".ai-action").forEach((button) => button.addEventListener("click", async () => {
    const originalLabel = button.textContent;
    const { text, field } = findAiSource(button);
    button.disabled = true;
    button.textContent = "ChatGPT arbeitet ...";
    try {
      const result = await callChatGptAction(button.dataset.aiAction, {
        module: "event-admin",
        entityType: button.dataset.aiEntityType,
        entityId: button.dataset.aiEntityId,
        fieldName: button.dataset.aiField,
        originalText: text,
        context: eventContext(button)
      });
      showAiDialog({ button, originalText: text, result, sourceField: field });
    } catch (error) {
      alert(error.message || String(error));
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  document.querySelector("#ai-settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
    const payload = formObject(form);
    payload.allowedRoles = [payload.allowAdmin ? "admin" : "", payload.allowEditor ? "editor" : ""].filter(Boolean);
    payload.enabled = Boolean(payload.enabled);
    payload.loggingEnabled = Boolean(payload.loggingEnabled);
    delete payload.allowAdmin;
    delete payload.allowEditor;
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "saveAiSettings");
    await callable(payload);
    form.querySelector("#ai-settings-result").innerHTML = `<div class="alert alert--success">ChatGPT-Einstellungen wurden gespeichert.</div>`;
  });

  document.querySelector("#ai-test-connection")?.addEventListener("click", async () => {
    const output = document.querySelector("#ai-settings-result");
    try {
      const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "testOpenAiConnection");
      const result = await callable({});
      output.innerHTML = `<div class="alert alert--success">Verbindung erfolgreich: ${escapeHtml(result.data.preview || "ok")}</div>`;
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  const registrationForm = document.querySelector("#registration-form");
  registrationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = registrationForm.querySelector("#form-result");
    try {
      await createRegistration(registrationForm.dataset.eventId, formObject(registrationForm));
      result.innerHTML = `<div class="alert alert--success">Vielen Dank. Bitte pruefen Sie Ihre E-Mail und bestaetigen Sie die Anmeldung ueber den zugesandten Link.</div>`;
      registrationForm.querySelector("button[type=submit]").disabled = true;
    } catch (error) {
      result.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const values = formObject(form);
      const user = await login(values.email, values.password, values.role);
      go(["admin", "editor"].includes(user.role) ? "cms" : "portal");
    } catch (error) {
      form.querySelector("#login-result").innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#google-login-button")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const form = document.querySelector("#login-form");
    try {
      const values = formObject(form);
      const user = await loginWithGoogle(values.role);
      go(["admin", "editor"].includes(user.role) ? "cms" : "portal");
    } catch (error) {
      form.querySelector("#login-result").innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  });

  document.querySelector("#bootstrap-admin-button")?.addEventListener("click", async () => {
    const output = document.querySelector("#bootstrap-admin-result");
    output.innerHTML = `<div class="alert">Admin-Freischaltung wird geprueft ...</div>`;
    try {
      const firebase = await import("./firebase/firebaseClient.js").then((module) => module.getFirebaseServices());
      const callable = firebase.functionsLib.httpsCallable(firebase.functions, "bootstrapFirstAdmin");
      await callable({});
      await refreshAuthToken(true);
      output.innerHTML = `<div class="alert alert--success">Erster Admin wurde freigeschaltet. CMS wird geoeffnet ...</div>`;
      go("cms");
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div>`;
    }
  });

  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await logout();
    go("home");
  });

  document.querySelectorAll("[data-event-tab]").forEach((button) => button.addEventListener("click", () => {
    go(`cms/event/${button.dataset.eventId}?tab=${button.dataset.eventTab}`);
  }));

  let draggedTopicCard = null;
  document.querySelectorAll("[data-topic-drag-id]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      draggedTopicCard = card;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.topicDragId);
    });
    card.addEventListener("dragend", async () => {
      card.classList.remove("is-dragging");
      document.querySelectorAll("[data-topic-drag-id]").forEach((item) => item.classList.remove("is-drop-target"));
      const cards = Array.from(document.querySelectorAll("[data-topic-drag-id]"));
      const topicIds = cards.map((item) => item.dataset.topicDragId);
      const eventId = card.dataset.eventId;
      const existingEvent = await getOne("events", eventId);
      await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
      draggedTopicCard = null;
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!draggedTopicCard || draggedTopicCard === card) return;
      card.classList.add("is-drop-target");
      const list = card.parentElement;
      const rect = card.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      list.insertBefore(draggedTopicCard, after ? card.nextSibling : card);
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
  });

  document.querySelector("#event-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = (await getOne("events", form.dataset.eventId)) || { id: form.dataset.eventId, topicIds: [], speakerIds: [], sponsorIds: [], status: "draft" };
    const values = formObject(form);
    const image = form.querySelector('input[name="eventImage"]')?.files?.[0];
    const newEventType = values.newEventType?.trim();
    if (image) {
      const asset = await uploadEntityImage("events", form.dataset.eventId, image);
      values.imageUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    if (newEventType) {
      const eventTypesSetting = (await getOne("settings", "eventTypes")) || {
        id: "eventTypes",
        key: "eventTypes",
        group: "events",
        value: []
      };
      const eventTypes = Array.isArray(eventTypesSetting.value) ? eventTypesSetting.value : [];
      const nextEventTypes = Array.from(new Set([...eventTypes, newEventType])).sort((a, b) => a.localeCompare(b, "de"));
      await upsert("settings", {
        ...eventTypesSetting,
        value: nextEventTypes,
        description: "Eventtypen fuer CMS-Auswahl"
      });
      values.eventType = newEventType;
    }
    delete values.eventImage;
    delete values.newEventType;
    await upsert("events", { ...existing, ...values });
    form.querySelector("#event-save-result").innerHTML = `<div class="alert alert--success">Event wurde gespeichert.</div>`;
  });

  document.querySelector("#event-speakers-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const speakerIds = Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value);
    await upsert("events", { ...existing, speakerIds });
    form.querySelector("#speaker-assignment-result").innerHTML = `<div class="alert alert--success">Referentenzuordnung wurde gespeichert.</div>`;
  });

  document.querySelector("#event-topic-assignment-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const topicIds = Array.from(form.querySelectorAll('input[name="topicIds"]:checked')).map((input) => input.value);
    const speakerIds = Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value);
    const topics = await list("topics");
    const speakers = await list("speakers");
    for (const topic of topics) {
      if (!form.elements[`edit-topic-${topic.id}-title`]) continue;
      await upsert("topics", {
        ...topic,
        title: form.elements[`edit-topic-${topic.id}-title`].value,
        shortDescription: form.elements[`edit-topic-${topic.id}-shortDescription`].value,
        updatedAt: new Date().toISOString()
      });
    }
    for (const speaker of speakers) {
      if (!form.elements[`edit-speaker-${speaker.id}-name`]) continue;
      await upsert("speakers", {
        ...speaker,
        name: form.elements[`edit-speaker-${speaker.id}-name`].value,
        company: form.elements[`edit-speaker-${speaker.id}-company`].value,
        position: form.elements[`edit-speaker-${speaker.id}-position`].value,
        shortBio: form.elements[`edit-speaker-${speaker.id}-shortBio`].value,
        updatedAt: new Date().toISOString()
      });
    }
    const newTopicTitle = form.elements.newTopicTitle?.value?.trim();
    if (newTopicTitle) {
      const id = `topics-${crypto.randomUUID()}`;
      await upsert("topics", {
        id,
        title: newTopicTitle,
        shortDescription: form.elements.newTopicShortDescription.value,
        status: "active",
        visibility: "public",
        sortOrder: topics.length + 1,
        createdAt: new Date().toISOString()
      });
      topicIds.push(id);
    }
    const newSpeakerName = form.elements.newSpeakerName?.value?.trim();
    if (newSpeakerName) {
      const id = `speakers-${crypto.randomUUID()}`;
      await upsert("speakers", {
        id,
        name: newSpeakerName,
        company: form.elements.newSpeakerCompany.value,
        position: form.elements.newSpeakerPosition.value,
        shortBio: form.elements.newSpeakerShortBio.value,
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
      speakerIds.push(id);
    }
    await upsert("events", { ...existing, topicIds, speakerIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-assignment-result").innerHTML = `<div class="alert alert--success">Zuordnung wurde gespeichert.</div>`;
    await render();
  });

  document.querySelector("#event-topic-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existingEvent = await getOne("events", form.dataset.eventId);
    const topicId = form.dataset.topicId || `topics-${crypto.randomUUID()}`;
    const existingTopic = form.dataset.topicId ? await getOne("topics", topicId) : { id: topicId, status: "active", visibility: "public", createdAt: new Date().toISOString() };
    const topicIds = Array.from(new Set([...(existingEvent.topicIds || []), topicId]));
    const image = imageFileFromDropzone(form, "topicImage", topicId);
    const imageUpdate = {};
    if (form.elements.removeTopicImage?.value === "1") {
      await deleteStoredAsset(existingTopic);
      imageUpdate.imageUrl = "";
      imageUpdate.assetStoragePath = "";
    }
    if (image) {
      await deleteStoredAsset(existingTopic);
      const asset = await uploadEntityImage("topics", topicId, image);
      imageUpdate.imageUrl = asset.url;
      imageUpdate.assetStoragePath = asset.storagePath;
    }
    await upsert("topics", {
      ...existingTopic,
      id: topicId,
      title: form.elements.title.value,
      shortDescription: form.elements.text.value,
      longDescription: form.elements.text.value,
      ...imageUpdate,
      updatedAt: new Date().toISOString()
    });
    await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-editor-result").innerHTML = `<div class="alert alert--success">Thema wurde gespeichert.</div>`;
    const imageStatus = form.querySelector("[data-image-status]");
    if (imageStatus) imageStatus.textContent = imageUpdate.imageUrl ? "Bild wurde gespeichert." : imageUpdate.imageUrl === "" ? "Bild wurde gelöscht." : imageStatus.textContent;
    if (Object.prototype.hasOwnProperty.call(imageUpdate, "imageUrl")) {
      updateDropzoneSavedImage(form, imageUpdate.imageUrl);
      updateTopicThumbInList(topicId, imageUpdate.imageUrl);
    }
    if (!form.dataset.topicId) go(`cms/event/${form.dataset.eventId}?tab=topics&mode=edit&topic=${topicId}`);
  });

  document.querySelector("#event-topic-assign-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existingEvent = await getOne("events", form.dataset.eventId);
    const topicIds = Array.from(new Set([...(existingEvent.topicIds || []), form.elements.topicId.value]));
    await upsert("events", { ...existingEvent, topicIds, updatedAt: new Date().toISOString() });
    form.querySelector("#event-topic-assign-result").innerHTML = `<div class="alert alert--success">Thema wurde zugeordnet.</div>`;
    go(`cms/event/${form.dataset.eventId}?tab=topics&mode=edit&topic=${form.elements.topicId.value}`);
  });

  document.querySelectorAll("[data-unassign-event-topic]").forEach((button) => button.addEventListener("click", async () => {
    const existingEvent = await getOne("events", button.dataset.eventId);
    const topicIds = (existingEvent.topicIds || []).filter((topicId) => topicId !== button.dataset.unassignEventTopic);
    const speakerIds = [];
    for (const speakerId of existingEvent.speakerIds || []) {
      const speaker = await getOne("speakers", speakerId);
      if (speaker?.topicId !== button.dataset.unassignEventTopic && !(speaker?.topicIds || []).includes(button.dataset.unassignEventTopic)) speakerIds.push(speakerId);
    }
    await upsert("events", { ...existingEvent, topicIds, speakerIds, updatedAt: new Date().toISOString() });
    await render();
  }));

  document.querySelector("#event-topic-speaker-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEventTopicSpeakerForm(event.currentTarget);
  });
  document.querySelector("#event-topic-speaker-form button[type='submit']")?.addEventListener("click", async (event) => {
    const form = event.currentTarget.form;
    if (!form || form.classList.contains("is-saving")) return;
    if (form.reportValidity && !form.reportValidity()) return;
    event.preventDefault();
    form.classList.add("is-saving");
    try {
      await saveEventTopicSpeakerForm(form);
    } finally {
      form.classList.remove("is-saving");
    }
  });

  document.querySelectorAll("[data-remove-event-topic-speaker]").forEach((button) => button.addEventListener("click", async () => {
    const speaker = await getOne("speakers", button.dataset.removeEventTopicSpeaker);
    const existingEvent = await getOne("events", button.dataset.eventId);
    if (!speaker || !existingEvent) return;
    if (!window.confirm(`${speaker.name || "Referent"} aus diesem Thema entfernen?`)) return;
    const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
    topicIds.delete(button.dataset.topicId);
    const remainingEventTopicIds = Array.from(topicIds).filter((topicId) => (existingEvent.topicIds || []).includes(topicId));
    const stillInEvent = remainingEventTopicIds.length > 0 || (speaker.topicId && speaker.topicId !== button.dataset.topicId && (existingEvent.topicIds || []).includes(speaker.topicId));
    const eventIds = new Set(Array.isArray(speaker.eventIds) ? speaker.eventIds : []);
    if (!stillInEvent) eventIds.delete(button.dataset.eventId);
    const speakerIds = stillInEvent
      ? Array.from(new Set(existingEvent.speakerIds || []))
      : (existingEvent.speakerIds || []).filter((speakerId) => speakerId !== speaker.id);
    await upsert("speakers", {
      ...speaker,
      topicId: speaker.topicId === button.dataset.topicId ? "" : speaker.topicId,
      topicIds: Array.from(topicIds),
      eventIds: Array.from(eventIds),
      updatedAt: new Date().toISOString()
    });
    await upsert("events", { ...existingEvent, speakerIds, updatedAt: new Date().toISOString() });
    go(`cms/event/${button.dataset.eventId}?tab=topics&mode=edit&topic=${button.dataset.topicId}`);
  }));

  document.querySelector("#event-partners-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = await getOne("events", form.dataset.eventId);
    const sponsorIds = Array.from(form.querySelectorAll('input[name="sponsorIds"]:checked')).map((input) => input.value);
    let hostId = form.elements.hostId?.value || "";
    const sponsors = await list("sponsors");
    for (const sponsor of sponsors) {
      if (!form.elements[`edit-sponsor-${sponsor.id}-name`]) continue;
      await upsert("sponsors", {
        ...sponsor,
        name: form.elements[`edit-sponsor-${sponsor.id}-name`].value,
        role: form.elements[`edit-sponsor-${sponsor.id}-role`].value,
        website: form.elements[`edit-sponsor-${sponsor.id}-website`].value,
        description: form.elements[`edit-sponsor-${sponsor.id}-description`].value,
        status: sponsor.status || "published",
        updatedAt: new Date().toISOString()
      });
    }
    const newSponsorName = form.elements.newSponsorName?.value?.trim();
    if (newSponsorName) {
      const id = `sponsors-${crypto.randomUUID()}`;
      await upsert("sponsors", {
        id,
        name: newSponsorName,
        role: form.elements.newSponsorRole.value,
        website: form.elements.newSponsorWebsite.value,
        description: form.elements.newSponsorDescription.value,
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
      sponsorIds.push(id);
      if (form.elements.newSponsorIsHost.checked) hostId = id;
    }
    await upsert("events", { ...existing, sponsorIds, hostId, updatedAt: new Date().toISOString() });
    form.querySelector("#event-partners-result").innerHTML = `<div class="alert alert--success">Sponsoren und Gastgeber wurden gespeichert.</div>`;
    await render();
  });

  document.querySelector("#content-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const existing = (await getOne(form.dataset.module, form.dataset.id)) || { id: form.dataset.id, createdAt: new Date().toISOString() };
    const values = formObject(form);
    const image = form.querySelector('input[name="assetFile"]')?.files?.[0];
    if (image) {
      const asset = await uploadEntityImage(form.dataset.module, form.dataset.id, image);
      if (form.dataset.module === "topics") values.imageUrl = asset.url;
      if (form.dataset.module === "members") values.logoUrl = asset.url;
      if (form.dataset.module === "boardMembers") values.photoUrl = asset.url;
      if (form.dataset.module === "speakers") values.photoUrl = asset.url;
      if (form.dataset.module === "sponsors") values.logoUrl = asset.url;
      if (form.dataset.module === "editorialContent") values.imageUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    delete values.assetFile;
    await upsert(form.dataset.module, { ...existing, ...values });
    form.querySelector("#content-save-result").innerHTML = `<div class="alert alert--success">Inhalt wurde gespeichert und steht den freigegebenen Ausgaben zur Verfuegung.</div>`;
  });

  document.querySelector("#topic-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const topicId = form.dataset.topicId;
    const topic = (await getOne("topics", topicId)) || { id: topicId, status: "active", visibility: "public" };
    await upsert("topics", {
      ...topic,
      title: form.elements.title.value,
      shortDescription: form.elements.shortDescription.value,
      updatedAt: new Date().toISOString()
    });

    const selected = new Set(Array.from(form.querySelectorAll('input[name="assignedSpeakerIds"]:checked')).map((input) => input.value));
    const speakers = await list("speakers");
    await Promise.all(speakers.map((speaker) => {
      const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
      if (selected.has(speaker.id)) topicIds.add(topicId);
      if (!selected.has(speaker.id)) topicIds.delete(topicId);
      const values = {
        ...speaker,
        topicId: selected.has(speaker.id) ? speaker.topicId || topicId : speaker.topicId === topicId ? "" : speaker.topicId,
        topicIds: Array.from(topicIds),
        updatedAt: new Date().toISOString()
      };
      if (form.elements[`speaker-${speaker.id}-name`]) values.name = form.elements[`speaker-${speaker.id}-name`].value;
      if (form.elements[`speaker-${speaker.id}-company`]) values.company = form.elements[`speaker-${speaker.id}-company`].value;
      if (form.elements[`speaker-${speaker.id}-position`]) values.position = form.elements[`speaker-${speaker.id}-position`].value;
      if (form.elements[`speaker-${speaker.id}-shortBio`]) values.shortBio = form.elements[`speaker-${speaker.id}-shortBio`].value;
      return upsert("speakers", values);
    }));

    const newSpeakerName = form.elements.newSpeakerName?.value?.trim();
    if (newSpeakerName) {
      const id = `speakers-${crypto.randomUUID()}`;
      await upsert("speakers", {
        id,
        name: newSpeakerName,
        company: form.elements.newSpeakerCompany.value,
        position: form.elements.newSpeakerPosition.value,
        shortBio: form.elements.newSpeakerShortBio.value,
        topicId,
        topicIds: [topicId],
        status: "published",
        visibility: "public",
        createdAt: new Date().toISOString()
      });
    }
    form.querySelector("#topic-editor-result").innerHTML = `<div class="alert alert--success">Thema und Referenten wurden gespeichert.</div>`;
    await render();
  });

  document.querySelector("#topic-speakers-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const topicId = form.dataset.topicId;
    const selected = new Set(Array.from(form.querySelectorAll('input[name="speakerIds"]:checked')).map((input) => input.value));
    const speakers = await list("speakers");
    await Promise.all(speakers.map((speaker) => {
      const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
      if (selected.has(speaker.id)) topicIds.add(topicId);
      if (!selected.has(speaker.id)) topicIds.delete(topicId);
      const next = { ...speaker, topicIds: Array.from(topicIds) };
      if (selected.has(speaker.id)) next.topicId = speaker.topicId || topicId;
      if (!selected.has(speaker.id) && speaker.topicId === topicId) next.topicId = "";
      return upsert("speakers", next);
    }));
    form.querySelector("#topic-speakers-result").innerHTML = `<div class="alert alert--success">Referentenauswahl wurde gespeichert.</div>`;
    await render();
  });

  document.querySelector("#topic-speaker-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formObject(form);
    const id = `speakers-${crypto.randomUUID()}`;
    const image = form.querySelector('input[name="assetFile"]')?.files?.[0];
    if (image) {
      const asset = await uploadEntityImage("speakers", id, image);
      values.photoUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    delete values.assetFile;
    await upsert("speakers", {
      id,
      ...values,
      topicId: form.dataset.topicId,
      topicIds: [form.dataset.topicId],
      status: "published",
      visibility: "public",
      createdAt: new Date().toISOString()
    });
    form.querySelector("#topic-speaker-create-result").innerHTML = `<div class="alert alert--success">Referent wurde angelegt.</div>`;
    await render();
  });

  document.querySelectorAll(".topic-speaker-edit-form").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const existing = await getOne("speakers", form.dataset.speakerId);
    const values = formObject(form);
    const topicIds = new Set(Array.isArray(existing.topicIds) ? existing.topicIds : []);
    topicIds.add(form.dataset.topicId);
    const image = form.querySelector('input[name="assetFile"]')?.files?.[0];
    if (image) {
      const asset = await uploadEntityImage("speakers", form.dataset.speakerId, image);
      values.photoUrl = asset.url;
      values.assetStoragePath = asset.storagePath;
    }
    delete values.assetFile;
    await upsert("speakers", {
      ...existing,
      ...values,
      topicId: existing.topicId || form.dataset.topicId,
      topicIds: Array.from(topicIds),
      updatedAt: new Date().toISOString()
    });
    form.querySelector(".topic-speaker-edit-result").innerHTML = `<div class="alert alert--success">Referent wurde gespeichert.</div>`;
  }));

  document.querySelectorAll("[data-unassign-topic-speaker]").forEach((button) => button.addEventListener("click", async () => {
    const speaker = await getOne("speakers", button.dataset.unassignTopicSpeaker);
    const topicIds = new Set(Array.isArray(speaker.topicIds) ? speaker.topicIds : []);
    topicIds.delete(button.dataset.topicId);
    await upsert("speakers", {
      ...speaker,
      topicId: speaker.topicId === button.dataset.topicId ? "" : speaker.topicId,
      topicIds: Array.from(topicIds),
      updatedAt: new Date().toISOString()
    });
    await render();
  }));

  document.querySelector("[data-delete-event]")?.addEventListener("click", async (event) => {
    if (!window.confirm("Dieses Event wirklich loeschen? Zugeordnete Daten muessen separat geprueft werden.")) return;
    await remove("events", event.currentTarget.dataset.deleteEvent);
    go("cms/events");
  });

  document.querySelector("#media-upload-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = form.querySelector("#upload-result");
    const files = Array.from(form.querySelector('input[type="file"]').files || []);
    if (!files.length) {
      result.innerHTML = `<div class="alert alert--warning" style="margin-top:14px">Bitte mindestens eine Datei auswaehlen.</div>`;
      return;
    }
    result.innerHTML = `<div class="progress"><span style="width:0"></span></div>`;
    await uploadEventMedia(form.dataset.eventId, files, {}, (progress) => {
      result.querySelector("span").style.width = `${progress}%`;
    });
    result.innerHTML += `<div class="alert alert--success" style="margin-top:12px">Upload abgeschlossen. Medien warten auf Freigabe.</div>`;
  });

  document.querySelectorAll("[data-media-approve]").forEach((button) => button.addEventListener("click", async () => {
    const medium = await getOne("eventMedia", button.dataset.mediaApprove);
    await upsert("eventMedia", { ...medium, status: "approved", visibility: "public" });
    await render();
  }));

  document.querySelectorAll("[data-record-status]").forEach((button) => button.addEventListener("click", async () => {
    const record = await getOne(button.dataset.recordStatus, button.dataset.recordId);
    const updates = { ...record, status: button.dataset.status };
    if (button.dataset.recordStatus === "eventMedia") {
      updates.visibility = button.dataset.status === "approved" ? "public" : "internal";
    }
    await upsert(button.dataset.recordStatus, updates);
    await render();
  }));

  document.querySelectorAll("[data-event-status]").forEach((button) => button.addEventListener("click", async () => {
    const existing = await getOne("events", button.dataset.eventStatus);
    await upsert("events", { ...existing, status: button.dataset.status });
    await render();
  }));

  document.querySelectorAll("[data-delete-record]").forEach((button) => button.addEventListener("click", async () => {
    const collection = button.dataset.deleteRecord;
    const record = await getOne(collection, button.dataset.recordId);
    if (!window.confirm(`${record?.name || record?.title || "Eintrag"} wirklich loeschen?`)) return;
    await deleteStoredAsset(record);
    await remove(collection, button.dataset.recordId);
    await render();
  }));

  document.querySelectorAll("[data-export-event]").forEach((button) => button.addEventListener("click", async () => {
    const event = await getOne("events", button.dataset.exportEvent);
    const registrations = (await list("registrations")).filter((item) => item.eventId === event.id);
    downloadRegistrationsCsv(event, registrations);
  }));

  document.querySelectorAll("[data-setup-action]").forEach((button) => button.addEventListener("click", async () => {
    const output = document.querySelector("#setup-result");
    const actions = { connection: checkFirebaseConnection, structure: checkFirestoreStructure, initialize: initializeDatabase, demo: createDemoData, "remove-demo": removeDemoData };
    try {
      if (button.dataset.setupAction === "remove-demo" && !window.confirm("Demodaten wirklich entfernen beziehungsweise die lokale Vorschau zuruecksetzen?")) return;
      const result = await actions[button.dataset.setupAction]();
      const message = Array.isArray(result) ? `${result.filter((item) => item.available).length} von ${result.length} Collections enthalten Daten.` : result.message || "Aktion erfolgreich abgeschlossen.";
      output.innerHTML = `<div class="alert alert--success">${escapeHtml(message)}</div>`;
      if (["initialize", "demo"].includes(button.dataset.setupAction)) setTimeout(render, 500);
    } catch (error) {
      output.innerHTML = `<div class="alert alert--warning">${escapeHtml(error.message)}</div>`;
    }
  }));
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
onRouteChange(render);
waitForAuthReady().finally(render);
