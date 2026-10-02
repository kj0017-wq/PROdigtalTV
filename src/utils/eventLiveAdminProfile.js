const logoEditors = new WeakMap();

export function mountProfileLogoPicker(preview) {
  if (!preview || logoEditors.has(preview)) return;
  const state = { file: null, busy: false };
  logoEditors.set(preview, state);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-live-logo-button";
  button.title = "Firmenlogo ändern";
  button.setAttribute("aria-label", "Firmenlogo auswählen und zuschneiden");
  const existing = preview.querySelector(".event-live-profile-logo");
  if (existing) button.append(existing);
  else button.textContent = "Firmenlogo hinzufügen";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;
  const status = document.createElement("div");
  status.hidden = true;
  status.setAttribute("role", "status");
  button.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const selected = input.files?.[0];
    input.value = "";
    if (!selected) return;
    state.busy = button.disabled = true;
    status.textContent = "";
    status.hidden = true;
    try {
      const { cropProfilePhoto } = await import("./profilePhotoCrop.js?v=2");
      const file = await cropProfilePhoto(selected, { logo: true });
      if (!file || !preview.isConnected) return;
      state.file = file;
      const image = document.createElement("img");
      image.className = "event-live-profile-logo";
      image.alt = "Firmenlogo";
      image.src = URL.createObjectURL(file);
      image.onload = image.onerror = () => URL.revokeObjectURL(image.src);
      button.replaceChildren(image);
    } catch (error) { status.hidden = false; status.textContent = error.message || "Logo konnte nicht geöffnet werden."; }
    finally { state.busy = button.disabled = false; }
  });
  preview.append(button, input, status);
}

export async function uploadProfileLogo(form, upload) {
  const state = logoEditors.get(form.querySelector(".event-live-profile-preview"));
  if (state?.busy) throw new Error("Bitte zuerst die Logo-Bearbeitung abschließen.");
  return state?.file ? (await upload(state.file)).storagePath : null;
}

export function mountProfilePhotoPicker(preview) {
  if (!preview || preview.querySelector(".event-live-photo-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-live-photo-button";
  button.dataset.livePhotoPicker = "library";
  button.setAttribute("aria-label", "Profilfoto aus Mediathek auswählen und zuschneiden");
  button.title = "Profilfoto ändern";
  const image = preview.querySelector("img:not(.event-live-profile-logo), span");
  preview.querySelector("[data-live-photo-picker]")?.remove();
  preview.prepend(button);
  if (image) button.append(image);
}

export function mountAdminProfileEditor(panel, person, { save, onSaved, upload, crop }) {
  const editor = document.createElement("details");
  editor.className = "event-live-profile-editor";
  editor.dataset.liveAdminEditor = "";
  const summary = document.createElement("summary");
  summary.textContent = "Profil bearbeiten";
  const form = document.createElement("form");
  const preview = document.createElement("div");
  preview.className = "event-live-profile-preview";
  const avatar = document.createElement(person.photoUrl ? "img" : "span");
  if (person.photoUrl) { avatar.src = person.photoUrl; avatar.alt = "Profilfoto"; }
  else avatar.textContent = [person.firstName, person.lastName].filter(Boolean).map(value => value[0]).join("") || "P";
  preview.append(avatar);
  mountProfilePhotoPicker(preview);
  if (person.companyLogo) {
    const logo = document.createElement("img");
    logo.className = "event-live-profile-logo";
    logo.src = person.companyLogo;
    logo.alt = "Firmenlogo";
    preview.append(logo);
  }
  mountProfileLogoPicker(preview);
  const picker = preview.querySelector("button");
  delete picker.dataset.livePhotoPicker;
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.hidden = true;
  let pendingPhoto = null;
  let previewUrl = "";
  picker.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    file.value = "";
    if (!selected) return;
    picker.disabled = button.disabled = true;
    try {
      const photo = await crop(selected);
      if (!photo || !editor.isConnected) return;
      pendingPhoto = photo;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(photo);
      const image = document.createElement("img");
      image.alt = "Profilbildvorschau";
      image.src = previewUrl;
      image.onload = () => URL.revokeObjectURL(image.src);
      picker.replaceChildren(image);
    } catch (error) { result.textContent = error.message || "Bild konnte nicht geöffnet werden."; }
    finally { picker.disabled = button.disabled = false; }
  });
  preview.append(file);
  form.append(preview);
  const fields = [
    ["title", "Titel"], ["firstName", "Vorname"], ["lastName", "Nachname"],
    ["position", "Position / Funktion"], ["company", "Unternehmen"],
    ["website", "Website"], ["biography", "Kurzvita"], ["companyProfile", "Unternehmensbeschreibung"]
  ];
  for (const [key, caption] of fields) {
    const label = document.createElement("label");
    label.textContent = caption;
    const long = ["biography", "companyProfile"].includes(key);
    const input = document.createElement(long ? "textarea" : "input");
    input.name = key;
    input.value = person[key] || "";
    input.maxLength = long ? 2400 : key === "website" ? 300 : 180;
    if (long) { input.rows = 5; input.style.fontWeight = "400"; }
    else input.type = key === "website" ? "url" : "text";
    label.append(input);
    form.append(label);
  }
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "button button--primary";
  button.textContent = "Profil speichern";
  const result = document.createElement("p");
  result.setAttribute("role", "status");
  form.append(button, result);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    picker.disabled = true;
    result.textContent = "Profil wird gespeichert ...";
    try {
      const profile = Object.fromEntries(new FormData(form));
      if (pendingPhoto) profile.photoStoragePath = (await upload(pendingPhoto)).storagePath;
      const logoPath = await uploadProfileLogo(form, upload);
      if (logoPath) profile.companyLogoStoragePath = logoPath;
      const response = await save(profile);
      if (response?.saved !== true) throw new Error("Speichern wurde nicht bestätigt.");
      result.textContent = "Profil gespeichert.";
      await onSaved();
    } catch (error) {
      result.textContent = error.message || "Profil konnte nicht gespeichert werden.";
    } finally { button.disabled = false; picker.disabled = false; }
  });
  editor.append(summary, form);
  panel.prepend(editor);
}
