import { cmsShell, cmsTitle } from "./cmsLayout.js?v=471";
import { list, getOne } from "../firebase/dataService.js?v=504";
import { currentUser, canUseCms, isAdmin } from "../firebase/authService.js?v=471";
import { accessLabels, lifecycleLabels, normalizeLifecyclePhase } from "../data/platformConstants.js";
import { escapeHtml, formatDate, formatDateTime, formatShortDate } from "../utils/format.js";

function localCmsAccessBypass() {
  return false;
}

function protect(content, adminOnly = false) {
  if (localCmsAccessBypass()) return content;
  const user = currentUser();
  if (!canUseCms(user) || (adminOnly && !isAdmin(user))) {
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Zugriff geschuetzt</p><h1>CMS-Login erforderlich</h1><p style="margin:14px 0 24px">Dieser Bereich steht Administratoren und Redakteuren zur Verfuegung.</p><div class="actions"><a class="button button--primary" href="#/login">Anmelden</a>${user ?`<button id="logout-button" class="button button--secondary" type="button">Abmelden</button>` : ""}</div></div></section>`;
  }
  return content;
}

function hasCmsAccess(adminOnly = false) {
  if (localCmsAccessBypass()) return true;
  const user = currentUser();
  return canUseCms(user) && (!adminOnly || isAdmin(user));
}

function denied(adminOnly = false) {
  return protect("", adminOnly);
}

function status(value) {
  const style = ["failed", "expired", "inactive", "cancelled", "archived"].includes(value) ?"status--error" : ["draft", "pending_email_confirmation", "queued", "in_review", "uploaded"].includes(value) ?"status--draft" : "";
  const label = { active: "Aktiv", inactive: "Inaktiv", offen: "Offen", geschlossen: "Geschlossen", cancelled: "Gekündigt", internal: "Intern", published: "Veröffentlicht", draft: "Entwurf", archived: "Archiviert", approved: "Freigegeben", new: "Neu", queued: "Wartet", sent: "Gesendet", failed: "Fehler", in_review: "In Prüfung" }[value] || value;
  return `<span class="status ${style}">${escapeHtml(label)}</span>`;
}

function galleryChoiceList(galleries = [], selectedId = "") {
  if (!galleries.length) {
    return `<div class="editor-gallery-choice-list editor-gallery-choice-list--empty" data-editor-gallery-choices><p class="muted">Keine Galerien gefunden.</p></div>`;
  }
  return `<div class="editor-gallery-choice-list" data-editor-gallery-choices>${galleries.map((gallery) => {
    const active = gallery.id === selectedId;
    return `<button class="editor-gallery-choice ${active ?"is-active" : ""}" type="button" data-gallery-choice="${escapeHtml(gallery.id)}">
      <strong>${escapeHtml(gallery.title || gallery.id)}</strong>
      <span>${(gallery.images || []).length} Bilder</span>
    </button>`;
  }).join("")}</div>`;
}

function iconImage(name) {
  const icons = {
    edit: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAA+ElEQVR4AeyUwRHCIBBFE0vQAqJFeLIzG7Axj/ZgkrPWgP9nlkwCm0CA3HSyLizwnoOEQ7Xz5y+omqZ5Igzio+121hYB+gb0huBzQt+wMY1kAWCEn6cwtlH/MttIEgCiwgV6lDykzYIAvDLGvAayfG0STOFd19WAPYRjU9v3/dV2mKMFLpyLAbszS7SQXqQ9piiBBicBdXtqVDjnBAWAjH8ofmHNRQzUg3DOWxUAkgVfFZSALwpKwVVBSbgnKA33BCgMd0vKacFa9QmdoqijqJKlqAqwVbzfs+F0qAIOSCy+oTIeTDMB994J724JEp0JM4EzVqS7u+AHAAD//wiOVHUAAAAGSURBVAMAkZiJMfsBJ98AAAAASUVORK5CYII=",
    eye: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAACjklEQVR4AeyTO28TQRDH92wZdwQngAzBDwkkJBKggA9AaJCoExEINTRQQcWr4FVBBQ3UBIKSGomG8AGgABIkJJD8IMEi73SOZV9+/83t6eLIujTpYu1PMzs7M/+bPV/C7PBvVyD2gmOvqFAojMAC+G3MF4vFS3EKHQVoNg4+Dd5AN7SvHt/3x5QD4+2Hbr9FIJ/PZyhQ48Eg6Wer1bpQLpe9cgTOzsM0aA2qJpfLHdYmyiYBRj7ned6iEni6atCwL5lMfqfBCrhrWkT0F+f94JE/AyaRSMyoh3xHKCB1mk4GB88rlUpePhOdIf4Pfy+4lVEzavoVQOQI9iUYciepycgXoYAKFIB3FNzG2sVEX+TU6/WDxO018fTHFKPmh6zg7CbNX8unxt6CfCvA6He1gTUSr2DtIn7ROsY8rdVqc4FvqtXqH/wnYCI5hqmvE2uA4g9lrQDOYzAod8k6eKLT8rGjslGYYkx7zmyOfNFoNPbJwn0wTuCeNiSvyDoQ/CYfOyIbhesZ1p4zmyNfpFKpZVl4BBsCXIsdl8AeRn6LtYv4B+sYcyebzR4IfMPLPYpvrzWSY3i5r4inwBB/IOsmMIzcqwBcRuQZ1i6mOisnnU7/J27/pjz9b8WoOSkrOHvBNNfkUxN+mKEAL26WhAElwC2epoLVi/tK/BD+Kri1RPNeaqYUoPlf7A3QexzgZS/JF6GANqVS6bNTp2mOQj3xdLPZPMXIXWD/pthupjjO+RToq7fTS1Q91MuxSUBBqdNAX+eE9nCCZh/VKArxT9AHWhOqYaJZbaJsEXCHFAyBhK4SCz8cfLcWmHJYOTDkgu22o4BLpHgUesBdj7P7uY73Lq+TjRXoVLjd+K5A7E2tAwAA//+mcuG+AAAABklEQVQDAIijNECIR6TkAAAAAElFTkSuQmCC",
    eyeOff: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAACtUlEQVR4AdyUu4tTQRTG5yZEJQSjrCnUPISgKRQbRdTCQrGxc0Es/A8EqxVUcFFUUFC30n9hi+21UmHXwsIVRGGLLUyyeYCFi6/AQl7+viEz3JvVWGy22XC+ex5zzvlmzp2bmNnk3xYiKBQKa/l8/u64J2ZHlM1mj9J4exAEd4ZJIJ4EP0B/CN/JvUTdSLEE9Xr9E1mngfkLyUPiO8GwpMmdG5C+Hl50viWQU61W3/X7/fOyKfQnIV6KxWIH0EEY5Jwi/73ywVkRMYmD2BHxBIpStE1awPYk5XK5yjgW1GSA1W63u8LvhEjJbwATj8eXc7ncGdkOngD2/QRfAMkDPcIkNFPhF8XBbk7VoNkRbANJFv0MGOLzmUwmJVvwBLDXFQAzFExz/MPYkXdCvAiCdrud1xrNPksLxK9R80h2Mpn8JS1YAo49LQeskTiFNux4CT0JIiTym81mDf0YGGovSAvU3ILkt2zit6UtAcY9YBKJxC5pB5JLzg6PSzH8WWlydMVlWqRSqQlrGHNf2hFcl8PRv0o70ETX17mRk1QqlY8sLEPwCu2l1WqVB85TaUvAWKxDIM3RnqOtEH9pjdADUn+7WC/VarVFt0ytRr1PPmt205ZAgU6ns0caXCXxCdoKOzxujdAjTOLCXOMb2HbU1BSxrXiCRqPxrdfr6SpqYYqCFRm8uA803Iv9E3gh5k+iIP5FaZpfpsZdZ+MJtMhx3/Ie7BWkIMdJ9P+zyEd1iCOngf2a3UbI8SSsnaR5keZz6uUQIVBQV5DkAPsNkBzjvs8PyETYx1/QghAmobnfudaEdQQKCpCcAyK6gh8ZD75klYf9ZsIkxCLyTwKXBcks8OPBtmNCT4AZxrLui3e10v8lUNIoMJalUSQbJhD5EMlNxRzGQqBmjoSx7ZDvMDYCNRSJdBh/AAAA///ZsAk1AAAABklEQVQDABUiTEDAfB/UAAAAAElFTkSuQmCC",
    trash: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAlElEQVR4AeyUXQqAIBCE2y7iWbp5R1lP0s/DQLQTjpFEZCCj267fOoLj0Pj7CSCltCQyFHeDRTUbKbkBoHRVkxMAOWfDBvtcGcd8zKEBgB9PqQSA14Ce14gzlQCsUI11QNGpbtFHLMJzgXbPa8SZvnvJeBJKyjpHjJ7AzCYkqGoXNRTg7jN8VtW3GtYMBbDEu7HmgBUAAP//nstLKAAAAAZJREFUAwAtM3oxRhnWAgAAAABJRU5ErkJggg=="
  };
  return icons[name] ?`<img src="${icons[name]}" alt="" loading="lazy">` : "";
}

function eyeSvgIcon(isVisible = false) {
  return `<svg class="member-eye-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.7"></circle>${isVisible ?"" : `<path class="member-eye-svg__slash" d="M4.5 4.5 19.5 19.5"></path>`}</svg>`;
}

function editorialActionButtons(item, section, module, activeStatus, inactiveStatus) {
  const isActive = ["published", "active", "approved"].includes(item.status);
  const toggleStatus = isActive ?inactiveStatus : activeStatus;
  const toggleClass = isActive ?"icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ?"Aktiv: auf inaktiv setzen" : "Inaktiv: auf aktiv setzen";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-record-status="${module}" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ?"eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="${module}" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function cmsListActionButtons(item, section, module, activeStatus, inactiveStatus, { editable = true, manageable = true } = {}) {
  const isActive = ["published", "active", "approved"].includes(item.status);
  const toggleStatus = isActive ?inactiveStatus : activeStatus;
  const toggleClass = isActive ?"icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ?"Aktiv: auf inaktiv setzen" : "Inaktiv: auf aktiv setzen";
  return `<div class="table-actions table-actions--icons">${editable ?`<a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a>` : ""}${manageable ?`<button class="icon-button ${toggleClass}" type="button" data-record-status="${module}" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ?"eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="${module}" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button>` : ""}</div>`;
}

function editorialVisibilityActionButtons(item, section) {
  const isVisible = item.visible === true;
  const toggleClass = isVisible ?"icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isVisible ?"Sichtbar: ausblenden" : "Unsichtbar: sichtbar machen";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=editorialContent&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-news-visible-toggle="${escapeHtml(item.id)}" data-visible="${isVisible ?"false" : "true"}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isVisible ?"eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="editorialContent" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function lockedEditorialActionButtons(item, section, module) {
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a></div>`;
}

function internalEditorialActionButtons(item, section, module) {
  const isActive = ["aktiv", "published", "active"].includes(String(item.status || "").toLowerCase());
  const toggleStatus = isActive ?"inaktiv" : "aktiv";
  const toggleClass = isActive ?"icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ?"Sichtbar: ausblenden" : "Unsichtbar: sichtbar machen";
  const usageKey = internalUsageKey(item);
  const visibilityButton = usageKey === "legacy"
    ?""
    : `<button class="icon-button ${toggleClass}" type="button" data-record-status="${module}" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ?"eye" : "eyeOff")}</button>`;
  const deleteButton = usageKey === "legacy"
    ?`<button class="icon-button icon-button--danger" type="button" data-delete-record="${module}" data-record-id="${item.id}" title="Altbestand loeschen" aria-label="Altbestand loeschen">${iconImage("trash")}</button>`
    : "";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a>${visibilityButton}${deleteButton}</div>`;
}

function mediaPicto(name) {
  if (name === "video") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="6.5" width="12" height="11" rx="2"></rect><path d="m15.5 10 5-3v10l-5-3z"></path></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="m7 16 3.4-4 2.8 3 1.8-2.1L19 17"></path><circle cx="8.5" cy="8.7" r="1.2"></circle></svg>`;
}

function editorialMediaFlags(item = {}) {
  const hasGallery = Boolean(item.galleryId || item.showGallery || item.galleryEventId);
  const videoCount = articleVideoAttachments(item).filter((video) => video.youtubeVideoId || video.youtubeUrl || video.title).length;
  if (!hasGallery && !videoCount) return `<span class="editorial-media-flags editorial-media-flags--empty" aria-label="Keine Galerie oder Videos">-</span>`;
  return `<div class="editorial-media-flags">
    ${hasGallery ?`<span class="editorial-media-flag editorial-media-flag--gallery" title="Galerie vorhanden" aria-label="Galerie vorhanden">${mediaPicto("gallery")}</span>` : ""}
    ${videoCount ?`<span class="editorial-media-flag editorial-media-flag--video" title="${videoCount} Video${videoCount === 1 ?"" : "s"} vorhanden" aria-label="${videoCount} Video${videoCount === 1 ?"" : "s"} vorhanden">${mediaPicto("video")}</span>` : ""}
  </div>`;
}

function editorialListStatus(item) {
  return status(["published", "active", "approved"].includes(item.status) ?"active" : "inactive");
}

function editorialVisibilityListStatus(item) {
  const isPublished = !["draft", "archived"].includes(item.status);
  return status(isPublished && item.visible === true ?"active" : "inactive");
}

function cmsBulkToolbar(records = [], { collection = "editorialContent", label = "Eintraege" } = {}) {
  return `<div class="cms-bulk-toolbar" data-cms-bulk-toolbar data-cms-bulk-collection="${escapeHtml(collection)}" data-cms-bulk-label="${escapeHtml(label)}">
    <div class="cms-bulk-toolbar__select">
      <label class="cms-bulk-checkbox"><input type="checkbox" data-cms-bulk-select-all ${records.length ?"" : "disabled"}> <span>Alle</span></label>
      <button class="button button--secondary button--small" type="button" data-cms-bulk-clear>Auswahl aufheben</button>
      <span class="muted" data-cms-bulk-count>0 ausgewaehlt</span>
    </div>
    <div class="actions">
      <button class="button button--secondary button--small news-bulk-action news-bulk-action--icon news-bulk-action--visible" type="button" data-cms-bulk-show disabled>${iconImage("eye")}<span>Sichtbar</span></button>
      <button class="button button--secondary button--small news-bulk-action news-bulk-action--icon news-bulk-action--hidden" type="button" data-cms-bulk-hide disabled>${iconImage("eyeOff")}<span>Unsichtbar</span></button>
      <button class="button button--danger button--small news-bulk-action news-bulk-action--icon" type="button" data-cms-bulk-delete disabled>${iconImage("trash")}<span>Loeschen</span></button>
    </div>
    <div data-cms-bulk-result></div>
  </div>`;
}

const newsBulkToolbar = (records = []) => cmsBulkToolbar(records, { collection: "editorialContent", label: "News" });

function memberIsLive(item) {
  const hasManagedType = ["company", "individual"].includes(item.membershipType || "");
  if (hasManagedType) return item.visible !== false && !memberAccessBlocked(item);
  return (item.status || "active") === "active" && (item.visibility || "public") === "public" && item.isLive !== false && !memberAccessBlocked(item);
}

function memberIsManagedActive(item = {}) {
  const hasManagedType = ["company", "individual"].includes(item.membershipType || "");
  return hasManagedType && !memberAccessBlocked(item) && !["inactive", "cancelled", "archived"].includes(item.status || "");
}

function memberMembershipTypeLabel(item = {}) {
  const type = item.membershipType || "";
  if (type === "company") return "UM";
  if (type === "individual") return "EM";
  return item.membershipLabel || item.category || "-";
}

function memberMembershipTypeTitle(item = {}) {
  const type = item.membershipType || "";
  if (type === "company") return "Unternehmensmitglied";
  if (type === "individual") return "Einzelmitglied";
  return item.membershipLabel || item.category || "Mitglied";
}

function timestampInputDate(value) {
  if (!value) return "";
  if (value.seconds) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ?String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function memberAccessBlocked(item = {}, now = new Date()) {
  if (!["inactive", "cancelled"].includes(item.membershipAccessStatus)) return false;
  const effective = item.membershipAccessEffectiveAt;
  if (!effective) return true;
  const effectiveDate = effective.seconds ?new Date(effective.seconds * 1000) : new Date(effective);
  return !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= now;
}

function memberAccessStatusCell(item = {}) {
  const accessStatus = item.membershipAccessStatus || "active";
  const effective = timestampInputDate(item.membershipAccessEffectiveAt);
  const blocked = memberAccessBlocked(item);
  if (accessStatus === "active") return status(memberIsLive(item) ?"active" : "inactive");
  const suffix = effective ?` ab ${escapeHtml(formatDate(effective))}` : " sofort";
  return `${status(blocked ?accessStatus : "pending_email_confirmation")}<small>${escapeHtml(accessStatus === "cancelled" ?"Gekuendigt" : "Inaktiv")}${suffix}</small>`;
}

function memberListStatus(item) {
  return memberAccessStatusCell(item);
}

function memberStatusDot(item = {}) {
  const blocked = memberAccessBlocked(item);
  const isLive = memberIsLive(item);
  const accessStatus = item.membershipAccessStatus || "active";
  const state = blocked || accessStatus !== "active" ?"blocked" : isLive ?"visible" : "hidden";
  const label = blocked
    ?accessStatus === "cancelled" ?"Gekuendigt" : "Inaktiv"
    : isLive
      ?"Aktiv sichtbar"
      : "Aktiv, nicht sichtbar";
  return `<span class="member-status-dot member-status-dot--${state}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
}

function memberVisibilityCell(item) {
  const isLive = memberIsLive(item);
  const toggleStatus = isLive ?"inactive" : "active";
  const toggleLabel = isLive ?"Sichtbar: ausblenden" : "Nicht sichtbar: sichtbar machen";
  const label = isLive ?"Sichtbar" : "Nicht sichtbar";
  const reason = isLive
    ?"Website"
    : memberAccessBlocked(item)
      ?"Zugang gesperrt"
      : item.isLive === false
        ?"Live aus"
        : (item.visibility || "public") !== "public"
          ?"Intern"
          : "Nicht aktiv";
  return `<div class="member-visibility-cell ${isLive ?"is-visible" : "is-hidden"}"><button class="icon-button member-eye-toggle ${isLive ?"icon-button--visible" : "icon-button--hidden"}" type="button" data-record-status="members" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${eyeSvgIcon(isLive)}</button><span>${escapeHtml(label)}</span><small>${escapeHtml(reason)}</small></div>`;
}

function memberVisibleToggleCell(item = {}) {
  return `<div class="member-combined-status member-visible-toggle-cell">${memberVisibilityCell(item)}</div>`;
}

function normalizedPhoneDigits(value = "") {
  let text = String(value || "").trim().replace(/[^\d+]/g, "");
  text = text.replace(/^\++/, "+");
  if (text.startsWith("00")) text = `+${text.slice(2)}`;
  if (text.startsWith("0") && !text.startsWith("00")) text = `+49${text.slice(1)}`;
  return text.replace(/[^\d+]/g, "");
}

function cleanPhoneDisplay(value = "") {
  return String(value || "").trim().replace(/^\++/, "+");
}

function phoneLooksMobile(value = "") {
  const phone = normalizedPhoneDigits(value);
  const digits = phone.replace(/\D/g, "");
  return phone.startsWith("+4915")
    || phone.startsWith("+4916")
    || phone.startsWith("+4917")
    || phone.startsWith("+436")
    || phone.startsWith("+447")
    || /^491[567]/.test(digits)
    || /^436/.test(digits)
    || /^447/.test(digits);
}

function splitPhoneAndMobile(phone = "", mobile = "") {
  const tel = cleanPhoneDisplay(phone);
  const mob = cleanPhoneDisplay(mobile);
  if (tel && !mob && phoneLooksMobile(tel)) return { phone: "", mobile: tel };
  if (!tel && mob && !phoneLooksMobile(mob)) return { phone: mob, mobile: "" };
  if (tel && mob && phoneLooksMobile(tel) && !phoneLooksMobile(mob)) return { phone: mob, mobile: tel };
  return { phone: tel, mobile: mob };
}

function memberContactCell(item = {}) {
  const email = item.contactEmail || item.email || "";
  const split = splitPhoneAndMobile(item.contactPhone || item.phone || "", item.contactMobile || item.mobile || "");
  const phone = split.phone;
  const mobile = split.mobile;
  const phoneLine = phone ?`Tel. ${escapeHtml(phone)}` : "Tel. fehlt";
  const mobileLine = mobile ?`Mobil ${escapeHtml(mobile)}` : "Mobil fehlt";
  return `<div class="member-contact-cell"><span>${email ?escapeHtml(email) : "Mail fehlt"}</span><small>${phoneLine}</small><small>${mobileLine}</small></div>`;
}

function memberProfileMissingCell(item = {}) {
  const missing = Array.isArray(item.needsProfileContentReview)
    ?item.needsProfileContentReview
    : [
        item.logoUrl ?"" : "Logo",
        (item.website || item.url) ?"" : "Website",
        memberDescriptionValue(item) ?"" : "Beschreibung"
      ].filter(Boolean);
  if (!missing.length) return `<small class="member-profile-complete">Profil komplett</small>`;
  return `<small class="member-profile-missing">Fehlt: ${missing.map(escapeHtml).join(", ")}</small>`;
}

function memberDescriptionValue(item = {}) {
  const current = String(item.description || "").trim();
  const generic = /^Internes Mitgliedsprofil aus der Mitgliederliste 2026\.?$/i.test(current);
  return generic ?"" : current;
}

function mediaAssetUrl(asset = {}) {
  return asset.file_path_web_url || asset.file_path_original_url || asset.file_path_thumb_url || asset.imageUrl || asset.assetUrl || "";
}

function blockedMemberLogoUrl(item = {}, url = "") {
  return item.id === "goldvisite-media" && /goldbach/i.test(String(url || ""));
}

function safeMemberLogoUrl(item = {}, url = "") {
  return blockedMemberLogoUrl(item, url) ?"" : url;
}

function memberLogoAsset(item = {}, mediaAssets = []) {
  return mediaAssets
    .filter((asset) => {
      const logoUrl = item.logoUrl || "";
      const urls = [asset.file_path_web_url, asset.file_path_thumb_url, asset.file_path_original_url, asset.imageUrl, asset.assetUrl].filter(Boolean);
      const directIds = [item.logo_media_asset_id, item.logoMediaAssetId, item.logoAssetId, item.thumbnail_media_asset_id, item.thumbnailMediaAssetId, item.mediaAssetId, item.media_asset_id].filter(Boolean);
      const linkedCollection = asset.linked_collection || asset.linkedCollection;
      const linkedId = asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId;
      const targetCollection = asset.target_collection || asset.targetCollection;
      const targetId = asset.target_id || asset.targetId;
      return directIds.includes(asset.id)
        || linkedCollection === "members" && linkedId === item.id
        || targetCollection === "members" && targetId === item.id
        || (logoUrl && urls.includes(logoUrl));
    })
    .filter((asset) => safeMemberLogoUrl(item, mediaAssetUrl(asset)))
    .sort((a, b) => {
      const score = (asset = {}) => [
        [item.logo_media_asset_id, item.logoMediaAssetId, item.logoAssetId, item.thumbnail_media_asset_id, item.thumbnailMediaAssetId, item.mediaAssetId, item.media_asset_id].filter(Boolean).includes(asset.id) ?"5" : "0",
        (asset.target_collection || asset.targetCollection) === "members" && (asset.target_id || asset.targetId) === item.id && (asset.target_field || asset.targetField || "logoUrl") === "logoUrl" ?"4" : "0",
        (asset.linked_collection || asset.linkedCollection) === "members" && (asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId) === item.id && (asset.linked_field || asset.linkedField || "logoUrl") === "logoUrl" ?"3" : "0",
        asset.source_type === "edited" ?"2" : "0",
        asset.status === "active" ?"2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function recordMediaAsset(item = {}, mediaAssets = [], collection = "", field = "imageUrl") {
  const recordUrl = String(item[field] || item.logo_url || item.image_url || editorialThumbUrl(item) || "").trim();
  const directIds = [item.thumbnail_media_asset_id, item.thumbnailMediaAssetId, item.mediaAssetId, item.media_asset_id, item.assetId, item.logo_media_asset_id, item.logoMediaAssetId, item.logoAssetId].filter(Boolean);
  const collectionAliases = collection === "sponsors"
    ?["sponsors", "sponsor", "partners", "partner", "hosts", "host", "co_hosts", "coHosts"]
    : [collection];
  const collectionMatches = (value = "") => collectionAliases.includes(String(value || ""));
  const fieldMatches = (value = "") => {
    const normalized = String(value || field || "").toLowerCase().replace(/[_-]/g, "");
    const expected = String(field || "").toLowerCase().replace(/[_-]/g, "");
    if (!expected || !normalized) return true;
    if (normalized === expected) return true;
    if (expected === "logourl") return ["logo", "image", "imageurl", "asseturl", "thumbnailurl"].includes(normalized);
    if (expected === "imageurl") return ["image", "asseturl", "thumbnailurl", "logourl"].includes(normalized);
    return false;
  };
  return mediaAssets
    .filter((asset) => {
      const urls = [asset.file_path_web_url, asset.file_path_thumb_url, asset.file_path_original_url, asset.imageUrl, asset.image_url, asset.assetUrl, asset.url].filter(Boolean);
      const targetCollection = asset.target_collection || asset.targetCollection;
      const targetId = asset.target_id || asset.targetId;
      const targetField = asset.target_field || asset.targetField;
      const linkedCollection = asset.linked_collection || asset.linkedCollection;
      const linkedId = asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId;
      const linkedField = asset.linked_field || asset.linkedField;
      return directIds.includes(asset.id)
        || collectionMatches(linkedCollection) && linkedId === item.id && fieldMatches(linkedField)
        || collectionMatches(targetCollection) && targetId === item.id && fieldMatches(targetField)
        || (recordUrl && urls.includes(recordUrl));
    })
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const targetScore = (asset = {}) => collectionMatches(asset.target_collection || asset.targetCollection) && (asset.target_id || asset.targetId) === item.id && fieldMatches(asset.target_field || asset.targetField);
      const linkedScore = (asset = {}) => collectionMatches(asset.linked_collection || asset.linkedCollection) && (asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId) === item.id && fieldMatches(asset.linked_field || asset.linkedField);
      const score = (asset = {}) => [
        directIds.includes(asset.id) ?"5" : "0",
        targetScore(asset) ?"4" : "0",
        linkedScore(asset) ?"3" : "0",
        asset.source_type === "edited" ?"2" : "0",
        asset.status === "active" ?"2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function memberLogoUrl(item = {}, mediaAssets = []) {
  const asset = memberLogoAsset(item, mediaAssets);
  return safeMemberLogoUrl(item, asset ?mediaAssetUrl(asset) || item.logoUrl || "" : item.logoUrl || "");
}

function memberLogoInitials(item = {}) {
  const name = String(item.name || item.title || "").replace(/\b(gmbh|ug|ag|kg|co|ltd|inc|stiftung|consulting|media|medien|television)\b/gi, " ");
  const words = name
    .split(/[^A-Za-z0-9ÄÖÜäöüß]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1);
  const initials = words.length >= 2
    ?`${words[0][0]}${words[1][0]}`
    : (words[0] || item.id || "PD").slice(0, 2);
  return initials.toUpperCase();
}

function memberLogoFallbackPalette(item = {}) {
  const palettes = [
    ["#fff1f2", "#e30613", "#071a33"],
    ["#eff6ff", "#2563eb", "#071a33"],
    ["#ecfdf5", "#059669", "#063a2b"],
    ["#fff7ed", "#ea580c", "#3b1d08"],
    ["#f5f3ff", "#7c3aed", "#211047"],
    ["#ecfeff", "#0891b2", "#083344"],
    ["#fefce8", "#ca8a04", "#3f2f05"],
    ["#fdf2f8", "#db2777", "#4a102b"]
  ];
  const key = String(item.id || item.name || item.title || "member");
  const hash = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [bg, border, color] = palettes[hash % palettes.length];
  return `--member-fallback-bg:${bg};--member-fallback-border:${border};--member-fallback-color:${color};`;
}

function memberLogoFallback(item = {}) {
  return `<span class="member-logo-fallback" style="${memberLogoFallbackPalette(item)}" aria-label="Logo Platzhalter ${escapeHtml(item.name || "Mitglied")}">${escapeHtml(memberLogoInitials(item))}</span>`;
}

function memberActionButtons(item, section) {
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=members&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button icon-button--danger" type="button" data-delete-record="members" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function galleryPlayerButton(gallery, label = "Galerie abspielen") {
  const images = Array.isArray(gallery.images)
    ?gallery.images.filter((image) => image.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : [];
  if (!images.length) return "";
  const payload = escapeHtml(JSON.stringify({
    title: gallery.title || "Bildergalerie",
    images: images.map((image) => ({
      url: image.url,
      caption: image.caption || image.title || "",
      altText: image.altText || image.caption || gallery.title || "Galeriebild"
    }))
  }));
  return `<button class="gallery-play-button" type="button" data-gallery-play data-gallery-payload="${payload}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><span aria-hidden="true"></span></button>`;
}

function galleryActionButtons(item, section) {
  const isVisible = item.status === "published" && (item.visibility || "public") === "public";
  const nextVisibility = isVisible ?"internal" : "public";
  const nextStatus = isVisible ?item.status : "published";
  const toggleClass = isVisible ?"icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isVisible ?"Sichtbar: ausblenden" : "Unsichtbar: sichtbar machen";
  return `<div class="table-actions table-actions--icons">${galleryPlayerButton(item)}<a class="icon-button icon-button--edit" href="#/cms/edit?module=galleries&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-record-visibility="galleries" data-record-id="${item.id}" data-visibility="${nextVisibility}" data-status="${nextStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isVisible ?"eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="galleries" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function galleryPayloadAttribute(gallery) {
  const images = Array.isArray(gallery.images)
    ?gallery.images.filter((image) => image.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : [];
  return escapeHtml(JSON.stringify({
    title: gallery.title || "Bildergalerie",
    images: images.map((image) => ({
      url: image.url,
      caption: image.caption || image.title || "",
      altText: image.altText || image.caption || gallery.title || "Galeriebild"
    }))
  }));
}

function galleryListStatus(item) {
  const isVisible = item.status === "published" && (item.visibility || "public") === "public";
  return status(isVisible ?"active" : "inactive");
}

function listDate(item) {
  const value = item.publishDate || item.validFrom || item.date || item.submittedAt || item.updatedAt || item.createdAt || "";
  return value ?formatShortDate(value) : "-";
}

function listDateSortValue(item = {}) {
  const value = item.publishDate || item.validFrom || item.date || item.submittedAt || item.updatedAt || item.createdAt || "";
  if (!value) return 0;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ?0 : date.getTime();
  }
  if (typeof value === "object" && typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ?0 : value.getTime();
  const raw = String(value || "").trim();
  const german = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?/);
  if (german) return new Date(Number(german[3]), Number(german[2]) - 1, Number(german[1]), Number(german[4] || 0), Number(german[5] || 0)).getTime();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ?0 : parsed.getTime();
}

function mailQueueDate(value) {
  return value ?formatDateTime(value) : "-";
}

function mailReference(item) {
  if (item.membershipApplicationId) return `Mitgliedsantrag: ${item.membershipApplicationId}`;
  if (item.registrationId) return `Anmeldung: ${item.registrationId}`;
  if (item.eventId) return `Event: ${item.eventId}`;
  return "-";
}

function aiButton(action, target, label = "Mit ChatGPT bearbeiten", extra = {}) {
  const promptField = extra.promptField ?` data-ai-prompt-field="${escapeHtml(extra.promptField)}"` : "";
  const contextTarget = extra.contextTarget ?` data-ai-context="${escapeHtml(extra.contextTarget)}"` : "";
  return `<button type="button" class="button button--secondary button--small ai-action" data-ai-action="${action}" data-ai-target="${target}" data-ai-entity-type="${extra.entityType || "event"}" data-ai-entity-id="${extra.entityId || ""}" data-ai-field="${extra.fieldName || target}"${promptField}${contextTarget}>${label}</button>`;
}

function aiFieldActions(actions) {
  return `<div class="ai-field-actions">${actions.map((item) => aiButton(item.action, item.target, item.label, item)).join("")}</div>`;
}

function cleanAudioTextPart(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/(?:^|\s)(keywords?|schlagworte|quelle|quellen)\s*:.*/is, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryAudioBody(item = {}, fields = []) {
  return fields.map((field) => cleanAudioTextPart(item[field])).find((value) => value.length > 20) || "";
}

function audioSourceText(collection, item = {}) {
  const subtitle = cleanAudioTextPart(item.subtitle);
  const body = collection === "topics"
    ?primaryAudioBody(item, ["longDescription", "bodyText", "shortDescription"])
    : primaryAudioBody(item, ["bodyText", "articleText", "longDescription", "archiveText", "introText", "shortText", "teaserText", "postEventSummary"]);
  return [subtitle, body].filter(Boolean).join("\n\n");
}

function audioTextSignature(collection, item = {}) {
  const text = audioSourceText(collection, item).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function audioVariantState(collection, item = {}, variant = "natural") {
  const currentSignature = audioTextSignature(collection, item);
  const prefix = variant === "natural" ?"audioNatural" : "audioAccessible";
  const url = item[`${prefix}Url`] || (variant === "accessible" ?item.audioUrl : "");
  const savedSignature = item[`${prefix}TextSignature`] || (variant === "accessible" ?item.audioTextSignature : "");
  if (item[`${prefix}Status`] === "in_erstellung") return "in Erstellung";
  if (item[`${prefix}Status`] === "fehler") return "Fehler";
  if (!url) return "fehlt";
  if (savedSignature && savedSignature !== currentSignature) return "veraltet";
  return "aktuell";
}

function audioStatusBadge(state) {
  const className = state === "aktuell" ?"" : state === "veraltet" || state === "fehlt" ?"status--draft" : "status--error";
  return `<span class="status ${className}">${escapeHtml(state)}</span>`;
}

function audioServiceStatusBadge(state = "missing") {
  const normalized = String(state || "missing").toLowerCase();
  const label = {
    ready: "Bereit",
    aktuell: "Bereit",
    missing: "Nicht erzeugt",
    fehlt: "Nicht erzeugt",
    outdated: "Veraltet",
    veraltet: "Veraltet",
    error: "Fehler",
    fehler: "Fehler",
    generating: "In Erstellung",
    in_erstellung: "In Erstellung"
  }[normalized] || state;
  const className = ["ready", "aktuell"].includes(normalized)
    ?""
    : ["missing", "fehlt", "outdated", "veraltet", "generating", "in_erstellung"].includes(normalized)
      ?"status--draft"
      : "status--error";
  return `<span class="status ${className}">${escapeHtml(label)}</span>`;
}

function timestampText(value) {
  if (!value) return "";
  if (value.seconds) return formatDateTime(new Date(value.seconds * 1000).toISOString());
  return formatDateTime(value);
}

const audioAreaOrder = ["News", "Rückblicke", "Presse", "Themen", "Interna"];

function audioAreaRank(area = "") {
  const index = audioAreaOrder.indexOf(area);
  return index === -1 ?999 : index;
}

function audioAreaLabel(item = {}) {
  if (item.audioArea && !["Presse / Rueckblick", "Presse / Rückblick", "Rückblicke / Presse"].includes(item.audioArea)) return item.audioArea;
  if (item.audioCollection === "topics") return "Themen";
  if (isNewsEditorialItem(item)) return "News";
  if (item.publication_target === "archive" || isEventRetrospectiveAudioItem(item)) return "Rückblicke";
  if (isPressEditorialItem(item)) return "Presse";
  if (isInternalEditorialItem(item) || item.bereich || item.page || item.section || item.key) return "Interna";
  return "Interna";
}

function audioSubareaLabel(item = {}) {
  if (item.audioCollection === "topics") return "Themen";
  if (item.bereich === "ueber_uns" || item.page === "about" || String(item.key || "").startsWith("ueber_uns.")) return "Über uns";
  if (item.bereich === "mitglied_werden" || item.page === "join" || String(item.key || "").startsWith("mitglied_werden.")) return "Mitglied werden";
  return "";
}

function hasLinkedAudio(item = {}) {
  return Boolean(item.audio?.audioUrl || item.audioUrl || item.audioNaturalUrl || item.audioAccessibleUrl);
}

function isPublicAudioCandidate(item = {}) {
  const statusValue = String(item.status || "").toLowerCase();
  const visibilityValue = String(item.visibility || item.sichtbarkeit || "").toLowerCase();
  const isPublished = ["published", "active", "aktiv", "approved"].includes(statusValue);
  const isPublic = ["public", "oeffentlich", "öffentlich", ""].includes(visibilityValue);
  return isPublished && isPublic;
}

function isRawPressImport(item = {}) {
  return String(item.id || "").startsWith("ai-press-article-")
    && (item.author_type === "ai" || item.authorType === "ai" || item.aiGenerated === true || Boolean(item.imported_press_release_id))
    && !hasLinkedAudio(item);
}

function isEventRetrospectiveAudioItem(item = {}) {
  const category = String(item.category || "").toLowerCase();
  return item.isRetrospective === true
    || Boolean(item.linkedEventId || item.galleryEventId)
    || String(item.id || "").startsWith("retrospective-")
    || String(item.key || "").includes("retrospective")
    || String(item.key || "").includes("rueckblick")
    || String(item.key || "").includes("rückblick")
    || category.includes("rueckblick")
    || category.includes("rückblick");
}

function normalizeRetrospectiveMatchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ue/g, "u")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim();
}

function retrospectiveMatchesEvent(item = {}, event = {}) {
  if (item.linkedEventId === event.id || item.galleryEventId === event.id) return true;
  if (!isEventRetrospectiveAudioItem(item)) return false;
  const itemText = normalizeRetrospectiveMatchText([item.title, item.subtitle, item.introText].filter(Boolean).join(" "));
  const eventTitle = normalizeRetrospectiveMatchText(event.title || "");
  const eventLocation = normalizeRetrospectiveMatchText(event.locationName || "");
  if (eventTitle && itemText.includes(eventTitle.slice(0, Math.min(28, eventTitle.length)))) return true;
  return Boolean(eventLocation && eventLocation.length > 7 && itemText.includes(eventLocation));
}

function audioNeedsAttention(item = {}) {
  const state = String(item.audio?.status || item.audioStatus || item.audioNaturalStatus || item.audioAccessibleStatus || "").toLowerCase();
  return ["error", "fehler", "outdated", "veraltet", "in_erstellung", "generating"].includes(state);
}

function isManagedLongformAudioItem(item = {}) {
  if (["ueber_uns", "mitglied_werden"].includes(item.bereich)) return true;
  if (["about", "join"].includes(item.page) && ["internal", "intro", "hero"].includes(item.section)) return true;
  return String(item.key || "").startsWith("ueber_uns.") || String(item.key || "").startsWith("mitglied_werden.");
}

function isAudioAdminEditorialItem(item = {}) {
  if (!audioSourceText("editorialContent", item)) return false;
  if (isRawPressImport(item) && !isPublicAudioCandidate(item) && !hasLinkedAudio(item) && !audioNeedsAttention(item)) return false;
  if (isEventRetrospectiveAudioItem(item)) return isPublicAudioCandidate(item) || hasLinkedAudio(item) || audioNeedsAttention(item);
  if (hasLinkedAudio(item) || audioNeedsAttention(item)) return true;
  if (isNewsEditorialItem(item) || isPressEditorialItem(item)) return isPublicAudioCandidate(item);
  return isManagedLongformAudioItem(item) && isPublicAudioCandidate(item);
}

function activeAudioInfo(collection, item = {}) {
  const serviceAudio = item.audio || {};
  const serviceUrl = serviceAudio.audioUrl || "";
  const accessibleUrl = item.audioAccessibleUrl || item.audioUrl || "";
  const naturalUrl = item.audioNaturalUrl || "";
  const activeUrl = serviceUrl || accessibleUrl || naturalUrl;
  const provider = serviceAudio.provider || item.audioProvider || (activeUrl ?"gemini" : "");
  const serviceStatus = serviceAudio.status || item.audioStatus || "";
  const legacyState = audioVariantState(collection, item, accessibleUrl ?"accessible" : "natural");
  const state = serviceUrl
    ?serviceStatus || "ready"
    : activeUrl
      ?legacyState
      : "missing";
  const version = serviceAudio.version || item.audioVersion || item.contentVersion || item.audioContentVersion || 1;
  const voiceName = serviceAudio.voiceName || item.audioAccessibleVoice || item.audioNaturalVoice || (provider && provider !== "elevenlabs" ?"Gemini TTS" : "");
  const modelId = serviceAudio.modelId || (provider === "elevenlabs" ?"eleven_multilingual_v2" : provider ?"gemini-2.5-flash-preview-tts" : "");
  const generatedAt = serviceAudio.generatedAt || item.audioGeneratedAt || item.audioAccessibleGeneratedAt || item.audioNaturalGeneratedAt || "";
  const timingUrl = serviceAudio.timingUrl || item.timingUrl || "";
  return {
    activeUrl,
    provider,
    state,
    version,
    voiceName,
    modelId,
    generatedAt,
    timingUrl,
    textHash: serviceAudio.textHash || item.audioTextHash || item.audioTextSignature || item.audioAccessibleTextSignature || audioTextSignature(collection, item),
    serviceVersion: serviceAudio.serviceVersion || (provider ?(provider === "elevenlabs" ?"audio-service-v1" : "legacy-gemini") : ""),
    karaokeEnabled: item.karaoke?.enabled === true || Boolean(timingUrl)
  };
}

function audioPlayButtonState(state = "", hasAudio = false) {
  const normalized = String(state || "").toLowerCase();
  if (["error", "fehler"].includes(normalized)) return { className: "audio-play-button--error", label: "Audio hat einen Fehler" };
  if (["outdated", "veraltet", "in_erstellung", "generating"].includes(normalized)) return { className: "audio-play-button--outdated", label: "Audio ist veraltet oder wird erzeugt" };
  if (hasAudio) return { className: "audio-play-button--ready", label: "Audio abspielen" };
  return { className: "audio-play-button--missing", label: "Audio erzeugen" };
}

function audioTooltipText(info = {}, buttonLabel = "Audio") {
  if (!info.activeUrl) return `${buttonLabel}\nNoch keine Audiodatei vorhanden. Klick erzeugt Audio mit der aktuellen Standard-Konfiguration.`;
  const lines = [
    buttonLabel,
    `Status: ${info.state || "bereit"}`,
    `Anbieter: ${info.provider || "nicht angegeben"}`,
    info.voiceName ?`Stimme: ${info.voiceName}` : "",
    info.modelId ?`Modell: ${info.modelId}` : "",
    info.version ?`Version: ${info.version}` : "",
    info.generatedAt ?`Erzeugt: ${timestampText(info.generatedAt)}` : "",
    info.karaokeEnabled ?"Timing/Karaoke: vorhanden" : "Timing/Karaoke: nicht vorhanden"
  ].filter(Boolean);
  return lines.join("\n");
}

function audioMetaLine(collection, item, variant) {
  const prefix = variant === "natural" ?"audioNatural" : "audioAccessible";
  const generatedAt = item[`${prefix}GeneratedAt`] || item.audioGeneratedAt || "";
  const voice = item[`${prefix}Voice`] || (variant === "natural" ?"Puck" : "Kore");
  const mime = item[`${prefix}MimeType`] || (variant === "natural" ?"audio/mpeg" : item.audioMimeType || "audio/wav");
  const textLength = item[`${prefix}TextLength`] || item.audioTextLength || 0;
  return `<small>Version ${Number(item.contentVersion || item.audioContentVersion || 1)} · ${escapeHtml(voice)} · ${escapeHtml(mime)}${textLength ?` · ${Number(textLength).toLocaleString("de-DE")} Zeichen` : ""}${generatedAt ?` · ${formatDateTime(generatedAt)}` : ""}</small>`;
}

function audioGenerationPanel(collection, item, options = {}) {
  const accessibleUrl = item.audioAccessibleUrl || item.audioUrl || "";
  const naturalUrl = item.audioNaturalUrl || "";
  const hasAudio = accessibleUrl || naturalUrl;
  const info = activeAudioInfo(collection, item);
  const providerConfig = options.providerConfig || {};
  const defaultProviderLabel = providerConfig.elevenlabs?.enabled ?"ElevenLabs" : "Gemini";
  const defaultModelLabel = providerConfig.elevenlabs?.enabled
    ?(providerConfig.elevenlabs.modelId || "eleven_multilingual_v2")
    : "gemini-2.5-flash-preview-tts";
  const defaultVoiceLabel = providerConfig.elevenlabs?.enabled
    ?(providerConfig.elevenlabs.voiceName || providerConfig.elevenlabs.voiceId || "Standardstimme")
    : "Gemini TTS";
  const requestedVariant = options.variant || "all";
  const buttonLabel = requestedVariant === "accessible"
    ?(accessibleUrl ?"Barrierefrei neu erzeugen" : "Barrierefrei erzeugen") + " mit " + defaultProviderLabel
    : (hasAudio ?"Audio neu erzeugen" : "Audio erzeugen") + " mit " + defaultProviderLabel;
  const generatedAt = timestampText(info.generatedAt);
  const previewUrl = naturalUrl || accessibleUrl || "";
  return '<div class="audio-generation-panel audio-generation-panel--compact">'
    + '<div class="audio-generation-panel__compact">'
    + '<div class="audio-generation-panel__compact-main">'
    + '<label>Vorlesen</label>'
    + '<div class="audio-generation-panel__statusline">' + audioListCell(collection, item, { meta: "state" }) + '<span>' + (hasAudio ?'Vorhanden' + (generatedAt ?' / ' + escapeHtml(generatedAt) : '') : 'Noch kein Audio') + '</span></div>'
    + '<small>' + escapeHtml(defaultProviderLabel) + ' / ' + escapeHtml(defaultVoiceLabel) + '</small>'
    + '</div>'
    + (previewUrl ?'<audio controls preload="none" src="' + escapeHtml(previewUrl) + '"></audio>' : '')
    + '</div>'
    + '<div class="tool-button-row">'
    + '<button type="button" class="button button--secondary button--small" data-generate-article-speech data-collection="' + collection + '" data-record-id="' + item.id + '" data-tts-variant="' + escapeHtml(requestedVariant) + '" title="' + escapeHtml('Aktuelle Default-Konfiguration: ' + defaultModelLabel + ' / ' + defaultVoiceLabel) + '">' + escapeHtml(buttonLabel) + '</button>'
    + (hasAudio ?'<button type="button" class="icon-button icon-button--danger" data-clear-linked-media="audio" title="Audio-Verknuepfung loesen" aria-label="Audio-Verknuepfung loesen">' + iconImage("trash") + '</button>' : '')
    + '</div>'
    + '<div class="audio-generation-panel__result" data-speech-result></div>'
    + '</div>';
}
function audioListCell(collection, item, options = {}) {
  const info = activeAudioInfo(collection, item);
  const hasAudio = Boolean(info.activeUrl);
  const buttonState = audioPlayButtonState(info.state, hasAudio);
  const stateLabel = buttonState.label.replace(/^Audio /, "");
  const meta = options.meta === "state"
    ?stateLabel
    : hasAudio
      ?(info.provider || "Audio")
      : "Audio fehlt";
  const showMeta = options.showMeta !== false;
  const tooltip = audioTooltipText(info, buttonState.label);
  return `<div class="audio-list-cell">
    <button type="button" class="audio-play-button ${buttonState.className}" data-generate-article-speech data-collection="${collection}" data-record-id="${item.id}" data-tts-variant="all" data-audio-url="${escapeHtml(info.activeUrl)}" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(buttonState.label)}"><span></span></button>
    ${showMeta ?`<small>${escapeHtml(meta)}</small>` : ""}
    <div class="audio-list-cell__result" data-speech-result></div>
  </div>`;
}

function maskedSecretLabel(name = "") {
  return name ?`************${String(name).slice(-4)}` : "Firebase Secret";
}

function aiProviderCard(provider = {}) {
  const lastTest = provider.lastTestAt?.seconds
    ?new Date(provider.lastTestAt.seconds * 1000).toISOString()
    : provider.lastTestAt || "";
  const lastSuccess = provider.lastSuccessAt?.seconds
    ?new Date(provider.lastSuccessAt.seconds * 1000).toISOString()
    : provider.lastSuccessAt || "";
  const state = provider.enabled === false ?"inactive" : "active";
  return `<article class="setup-step ai-provider-card">
    <span>${escapeHtml(provider.name || provider.provider || "KI-Anbieter")}</span>
    <strong>${status(state)}</strong>
    <small>Modell: ${escapeHtml(provider.modelId || "-")}<br>API-Key: ${escapeHtml(maskedSecretLabel(provider.secretName || provider.apiKey || ""))}${provider.voiceName ?`<br>Stimme: ${escapeHtml(provider.voiceName)} (${escapeHtml(provider.voiceId || "")})` : ""}${lastTest ?`<br>Letzter Test: ${escapeHtml(formatDateTime(lastTest))}` : ""}${lastSuccess ?`<br>Letzter Erfolg: ${escapeHtml(formatDateTime(lastSuccess))}` : ""}${provider.lastError ?`<br>Fehler: ${escapeHtml(provider.lastError)}` : ""}</small>
    ${provider.provider === "elevenlabs" ?`<button type="button" class="button button--secondary button--small" data-audio-provider-test="elevenlabs">Testen & aktivieren</button>` : ""}
  </article>`;
}

export async function aiAccessPage() {
  if (!hasCmsAccess(true)) return denied(true);
  const [aiSettings, audioProviders] = await Promise.all([
    getOne("settings", "ai").catch(() => null),
    getOne("settings", "audioProviders").catch(() => null)
  ]);
  const elevenlabs = audioProviders?.elevenlabs || {};
  const voices = Array.isArray(elevenlabs.voices) ?elevenlabs.voices : [];
  const providerCards = [
    {
      provider: "openai",
      name: "GPT / OpenAI",
      enabled: aiSettings?.enabled !== false,
      modelId: aiSettings?.model || "gpt-4.1-mini",
      secretName: "OPENAI_API_KEY",
      lastTestAt: aiSettings?.lastTestAt,
      lastSuccessAt: aiSettings?.lastSuccessAt
    },
    {
      provider: "gemini",
      name: "Google Gemini",
      enabled: true,
      modelId: "gemini-2.5-flash-preview-tts",
      secretName: "GEMINI_API_KEY"
    },
    {
      provider: "elevenlabs",
      name: "ElevenLabs",
      enabled: Boolean(elevenlabs.enabled),
      modelId: elevenlabs.modelId || "eleven_multilingual_v2",
      voiceId: elevenlabs.voiceId || "",
      voiceName: elevenlabs.voiceName || "",
      secretName: "ELEVENLABS_API_KEY",
      lastTestAt: elevenlabs.lastTestAt,
      lastSuccessAt: elevenlabs.lastSuccessAt,
      lastError: elevenlabs.lastError || ""
    }
  ];
  return protect(cmsShell("cms/ai-access", `${cmsTitle("System", "KI-Zugaenge")}
    <section class="panel">
      <h2>Anbieterstatus</h2>
      <p class="muted">API-Keys werden ausschliesslich serverseitig als Firebase Secrets verwendet und hier nicht gespeichert oder angezeigt.</p>
      <div class="setup-steps">${providerCards.map(aiProviderCard).join("")}</div>
      <div id="ai-access-test-result"></div>
    </section>
    <section class="panel">
      <h2>ElevenLabs Audio-Service v1</h2>
      <form id="audio-provider-config-form" class="form-grid">
        <label class="checkbox"><input type="checkbox" name="enabled" ${elevenlabs.enabled ?"checked" : ""}> ElevenLabs aktivieren</label>
        <div class="form-grid--two">
          <div class="field"><label>Standardmodell</label><input name="modelId" value="${escapeHtml(elevenlabs.modelId || "eleven_multilingual_v2")}"></div>
          <div class="field"><label>Voice ID</label><input name="voiceId" value="${escapeHtml(elevenlabs.voiceId || "")}" data-elevenlabs-voice-id></div>
          <div class="field"><label>Voice Name</label><input name="voiceName" value="${escapeHtml(elevenlabs.voiceName || "")}" data-elevenlabs-voice-name></div>
          <div class="field"><label>API-Key</label><input value="${escapeHtml(maskedSecretLabel("ELEVENLABS_API_KEY"))}" disabled></div>
        </div>
        <div class="field">
          <label>Geladene Stimmen</label>
          <select data-elevenlabs-voice-select>
            <option value="">Stimme aus Cache waehlen</option>
            ${voices.map((voice) => `<option value="${escapeHtml(voice.voiceId)}" data-voice-name="${escapeHtml(voice.voiceName)}" ${voice.voiceId === elevenlabs.voiceId ?"selected" : ""}>${escapeHtml(voice.voiceName)} (${escapeHtml(voice.voiceId)})</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Leseprobe</label>
          <textarea name="previewText" rows="3">Dies ist eine kurze Leseprobe für PROdigitalTV. So klingt diese Stimme in der Audio- und Barrierefreiheitsfunktion.</textarea>
        </div>
        <audio controls preload="none" hidden data-audio-provider-preview-player></audio>
        <div class="alert">Das Firebase Secret <code>ELEVENLABS_API_KEY</code> muss serverseitig gesetzt sein. Ein hier eingegebener API-Key wird bewusst nicht in Firestore gespeichert.</div>
        <div class="actions">
          <button class="button button--primary">Konfiguration speichern</button>
          <button type="button" class="button button--secondary" data-audio-provider-load-voices>Stimmen laden</button>
          <button type="button" class="button button--secondary" data-audio-provider-preview>Leseprobe testen</button>
          <button type="button" class="button button--secondary" data-audio-provider-test="elevenlabs">Testen & aktivieren</button>
        </div>
        <div id="ai-access-result"></div>
      </form>
    </section>`), true);
}

function chatGptHints(events, media, downloads = []) {
  const shortDescriptions = events.filter((event) => (event.description || "").length < 140).length;
  const memberEventsWithoutTeaser = events.filter((event) => event.accessType === "members_only" && !event.publicTeaser).length;
  const postWithoutReport = events.filter((event) => event.hasPostReport && !event.postEventSummary).length;
  const missingAlt = media.filter((item) => item.status === "approved" && !item.altText).length;
  const downloadsWithoutDescription = downloads.filter((item) => !item.description).length;
  const hints = [
    shortDescriptions ?`${shortDescriptions} Events haben sehr kurze Beschreibungen.` : "",
    memberEventsWithoutTeaser ?`${memberEventsWithoutTeaser} Mitglieder-Events haben keinen oeffentlichen Teaser.` : "",
    postWithoutReport ?`${postWithoutReport} Events im Rückblick haben noch keinen Rückblicktext.` : "",
    missingAlt ?`${missingAlt} Bilder haben keine Alt-Texte.` : "",
    downloadsWithoutDescription ?`${downloadsWithoutDescription} Downloads haben keine Beschreibung.` : ""
  ].filter(Boolean);
  return `<section class="panel ai-panel"><div class="actions" style="justify-content:space-between"><h2>ChatGPT-Hinweise</h2><a class="button button--secondary button--small" href="#/cms/chatgpt">KI-Prüfung oeffnen</a></div>${hints.length ?`<div class="setup-steps">${hints.map((hint) => `<div class="setup-step"><span>${escapeHtml(hint)}</span><strong>Hinweis</strong></div>`).join("")}</div>` : `<p>Keine akuten ChatGPT-Hinweise aus den aktuellen CMS-Daten.</p>`}<p class="muted" style="margin-top:14px">KI-Hinweise sind redaktionelle Empfehlungen und blockieren keine Pipeline-Statuswechsel.</p></section>`;
}

export async function dashboardPage() {
  if (!hasCmsAccess()) return denied();
  const [rawEvents, registrations, media, mails, downloads] = await Promise.all([list("events"), list("registrations"), list("eventMedia"), list("mailQueue"), list("downloads")]);
  const events = rawEvents.map(normalizeCmsEventRecord).filter(hasLiveCmsEventIdentity);
  const upcoming = events.filter((event) => event.status !== "inactive" && !isPastCmsEvent(event));
  const pending = registrations.filter((item) => item.status === "pending_email_confirmation").length;
  const postEvents = events.filter((event) => event.status !== "inactive" && isPastCmsEvent(event));
  const openPost = postEvents.length + media.filter((item) => item.status === "in_review").length;
  return protect(cmsShell("cms", `${cmsTitle("CMS Dashboard", "Uebersicht", `<a href="#/cms/events/new" class="button button--primary button--small">Neues Event</a>`)}
    <div class="stat-grid">
      <div class="stat"><span>Kommende Events</span><strong>${upcoming.length}</strong></div>
      <div class="stat"><span>Anmeldungen</span><strong>${registrations.length}</strong></div>
      <div class="stat"><span>Unbestaetigt</span><strong>${pending}</strong></div>
      <div class="stat"><span>Event Rückblick / Archiv</span><strong>${openPost}</strong></div>
      <div class="stat"><span>Mailfehler</span><strong>${mails.filter((mail) => mail.status === "failed").length}</strong></div>
    </div>
    ${chatGptHints(events, media, downloads)}
    <div class="cms-columns">
      <section class="panel"><h2>Naechste Events</h2><div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th>Termin</th><th>Phase</th></tr></thead><tbody>${upcoming.map((event) => `<tr><td><a class="link" href="#/cms/event/${event.id}">${escapeHtml(event.title)}</a></td><td>${formatDate(event.date)}</td><td>${status(lifecycleLabels[event.lifecyclePhase])}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel"><h2>Aufmerksamkeit erforderlich</h2>
        <div class="setup-steps"><div class="setup-step"><span>Unbestätigte Anmeldungen</span><strong>${pending}</strong></div><div class="setup-step"><span>Medien in Prüfung</span><strong>${media.filter((item) => item.status === "in_review").length}</strong></div><div class="setup-step"><span>Event Rückblick offen</span><strong>${openPost}</strong></div></div>
        <div class="actions" style="margin-top:20px"><a class="button button--secondary button--small" href="#/cms/editorial">Redaktion bearbeiten</a><a class="button button--secondary button--small" href="#/cms/members">Mitglied anlegen</a></div>
      </section>
    </div>`));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function eventTitleValue(event = {}) {
  return String(event.title || event.titel || event.name || event.headline || event.eventTitle || "").trim();
}

function eventDateValue(event = {}) {
  const value = event.date || event.eventDate || event.startDate || event.start_date || event.startAt || event.startDateTime || event.beginAt || "";
  return String(value || "").slice(0, 10);
}

function normalizeCmsEventRecord(event = {}) {
  const lifecyclePhase = normalizeLifecyclePhase(event.lifecyclePhase || event.lifecycle_phase || event.phase || "planning");
  return {
    ...event,
    title: eventTitleValue(event),
    date: eventDateValue(event),
    accessType: event.accessType || event.access_type || event.access || "public",
    lifecyclePhase,
    status: event.status || event.state || "draft"
  };
}

function isPastCmsEvent(event) {
  const date = eventDateValue(event);
  if (date && date >= todayString()) return false;
  if (normalizeLifecyclePhase(event.lifecyclePhase) === "archived") return true;
  if (event.expiresAt && new Date(event.expiresAt).getTime() <= Date.now()) return true;
  return Boolean(date && date < todayString());
}

function normalizedCmsState(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[ß]/g, "ss");
}

function isCmsDemoRecord(record = {}) {
  const source = normalizedCmsState(record.source || record.sourceType || record.origin || "");
  return record.demo === true
    || record.isDemo === true
    || record.seed === true
    || record.isSeed === true
    || source.includes("demo")
    || source.includes("seed");
}

function hasLiveCmsEventIdentity(event = {}) {
  const title = eventTitleValue(event);
  return Boolean(title) && !isCmsDemoRecord(event);
}

function eventTable(events, { showThumb = false, mediaAssets = [], registrations = [], returnTo = "#/cms/events" } = {}) {
  const registrationCount = (eventId) => registrations.filter((item) => item.eventId === eventId && item.status !== "cancelled").length;
  return `<section class="panel"><div class="table-wrap"><table class="table ${showThumb ?"table--event-followup" : ""}"><thead><tr>${showThumb ?"<th>Bild</th>" : ""}<th>Event</th><th>Datum</th><th>Ablauf</th><th>Zugang</th><th>Anmeldungen</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${events.map((event) => `<tr>${showThumb ?`<td><div class="topic-thumb topic-thumb--table editorial-thumb--table event-thumb--table">${eventThumb(event, mediaAssets, returnTo)}</div></td>` : ""}<td><a class="link" href="#/cms/event/${event.id}">${escapeHtml(event.title)}</a></td><td>${formatDate(event.date)}</td><td>${event.expiresAt ?formatDateTime(event.expiresAt) : "-"}</td><td>${accessLabels[event.accessType]}</td><td><strong>${registrationCount(event.id)}</strong></td><td>${status(cmsEventRegistrationIsOpen(event) ?"offen" : "geschlossen")}</td><td>${eventActionButtons(event)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function settingValue(settings, id, fallback = []) {
  const setting = settings.find((item) => item.id === id || item.key === id);
  return Array.isArray(setting?.value) ?setting.value : fallback;
}

export async function eventsAdminPage() {
  if (!hasCmsAccess()) return denied();
  const [allEvents, mediaAssets, allEditorial, registrations] = await Promise.all([list("events"), list("media_assets").catch(() => []), list("editorialContent").catch(() => []), list("registrations").catch(() => [])]);
  const events = allEvents
    .map(normalizeCmsEventRecord)
    .filter(hasLiveCmsEventIdentity)
    .filter((event) => event.status !== "inactive")
    .filter((event) => !isPastCmsEvent(event))
    .sort((a, b) => (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31"));
  return protect(cmsShell("cms/events", `${cmsTitle("Event-Management", "Events", `<a class="button button--primary button--small" href="#/cms/event/new">Neues Event erstellen</a>`)}
  ${eventTable(events, { showThumb: true, mediaAssets, registrations, returnTo: "#/cms/events" })}`));
}

export async function eventFollowUpPage() {
  if (!hasCmsAccess()) return denied();
  const [allEvents, mediaAssets, allEditorial] = await Promise.all([list("events"), list("media_assets").catch(() => []), list("editorialContent").catch(() => [])]);
  const events = allEvents
    .map(normalizeCmsEventRecord)
    .filter(hasLiveCmsEventIdentity)
    .filter((event) => event.status !== "inactive")
    .filter((event) => isPastCmsEvent(event))
    .sort((a, b) => (b.date || "0000-00-00").localeCompare(a.date || "0000-00-00"));
  return protect(cmsShell("cms/followup", `${cmsTitle("Event-Management", "Event Rückblick")}
  ${eventFollowUpTable(events, mediaAssets, allEditorial)}`));
}

function eventTabs(id, active) {
  return `<nav class="tabs">${[["base", "Stammdaten"], ["pre", "Einladung"], ["topics", "Vortraege / Referenten"], ["registration", "Anmeldung"], ["post", "Rückblick"], ["media", "Fotogalerie / Downloads"]].map(([key, label]) => `<button data-event-tab="${key}" data-event-id="${id}" class="${active === key ?"active" : ""}">${label}</button>`).join("")}</nav>`;
}

function shortText(value = "", length = 112) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ?`${text.slice(0, Math.max(0, length - 3))}...` : text;
}

function personInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function speakerAvatar(speaker, className = "speaker-avatar") {
  return `<span class="${className}">${speaker.photoUrl ?`<img src="${escapeHtml(speaker.photoUrl)}" alt="">` : personInitials(speaker.name)}</span>`;
}

function topicImageUrl(topic = {}, mediaAssets = []) {
  const asset = Array.isArray(mediaAssets) && mediaAssets.length
    ?recordMediaAsset(topic, mediaAssets, "topics", "imageUrl")
    : null;
  return mediaAssetUrl(asset || {})
    || topic.imageUrl
    || topic.assetUrl
    || topic.thumbnail_url
    || topic.thumbnailUrl
    || topic.file_path_web_url
    || topic.file_path_original_url
    || topic.file_path_thumb_url
    || topic.web_url
    || topic.original_url
    || topic.thumb_url
    || "";
}

function topicThumb(topic, mediaAssets = []) {
  const asset = Array.isArray(mediaAssets) && mediaAssets.length
    ?recordMediaAsset(topic, mediaAssets, "topics", "thumbnail_url")
    : null;
  const url = mediaAssetUrl(asset || {}) || topic.thumbnail_url || topic.thumbnailUrl || topicImageUrl(topic, mediaAssets);
  const content = url ?`<img src="${escapeHtml(url)}" alt="">` : `<span>Bild</span>`;
  const targetTopic = asset?.id ?{ ...topic, thumbnail_media_asset_id: asset.id } : topic;
  return `<a class="cms-thumb-action" href="${cmsThumbTarget("topics", targetTopic, "", "thumbnail_url", "thumbnail_alt")}" title="${url ?"Listen-Thumb bearbeiten / croppen" : "Thumb mit KI erstellen"}" aria-label="${url ?"Listen-Thumb bearbeiten / croppen" : "Thumb mit KI erstellen"}">${content}</a>`;
}

function editorialThumbUrl(item = {}) {
  return item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.logoUrl || item.photoUrl || item.assetUrl || "";
}

function cmsThumbTarget(collection = "", item = {}, section = "", field = "imageUrl", altField = "thumbnail_alt") {
  const returnTo = collection === "topics"
    ?`#/cms/topics`
    : collection === "editorialContent"
      ?`#/cms/editorial/${section || item.page || "news"}`
      : `#/cms/${collection}`;
  const params = new URLSearchParams({
    targetCollection: collection,
    targetId: item.id || "",
    targetField: field,
    targetAltField: altField,
    returnTo
  });
  const hasThumb = Boolean(editorialThumbUrl(item));
  const assetId = item.thumbnail_media_asset_id || item.mediaAssetId || item.media_asset_id || "";
  if (hasThumb && assetId) return `#/cms/media/edit?id=${encodeURIComponent(assetId)}&${params.toString()}`;
  return hasThumb ?`#/cms/media/library?${params.toString()}` : `#/cms/media/ai?${params.toString()}`;
}

function editorialThumb(item = {}, { collection = "editorialContent", section = "", field = "imageUrl", altField = "thumbnail_alt", mediaAssets = [] } = {}) {
  const asset = recordMediaAsset(item, mediaAssets, collection, field);
  const url = mediaAssetUrl(asset || {}) || editorialThumbUrl(item);
  const content = url
    ?`<img src="${escapeHtml(url)}" alt="">`
    : `<span>Bild</span>`;
  if (!collection || !item.id) return content;
  const targetItem = asset?.id ?{ ...item, thumbnail_media_asset_id: asset.id } : item;
  return `<a class="cms-thumb-action" href="${cmsThumbTarget(collection, targetItem, section, field, altField)}" title="${url ?"Bild bearbeiten" : "Thumb mit KI erstellen"}" aria-label="${url ?"Bild bearbeiten" : "Thumb mit KI erstellen"}">${content}</a>`;
}

function eventThumb(event = {}, mediaAssets = [], returnTo = "#/cms/events") {
  const asset = recordMediaAsset(event, mediaAssets, "events", "imageUrl");
  const url = eventImageUrl(event, mediaAssets);
  const content = url ?`<img src="${escapeHtml(url)}" alt="">` : `<span>Bild</span>`;
  const params = new URLSearchParams({
    targetCollection: "events",
    targetId: event.id || "",
    targetField: "imageUrl",
    targetAltField: "thumbnail_alt",
    returnTo
  });
  const href = asset?.id
    ?`#/cms/media/edit?id=${encodeURIComponent(asset.id)}&${params.toString()}`
    : `#/cms/media/library?${params.toString()}`;
  return `<a class="cms-thumb-action" href="${href}" title="${url ?"Eventbild bearbeiten" : "Eventbild aus Mediathek waehlen"}" aria-label="${url ?"Eventbild bearbeiten" : "Eventbild aus Mediathek waehlen"}">${content}</a>`;
}

function eventActionButtons(event = {}) {
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/event/${event.id}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a></div>`;
}

function cmsEventRegistrationIsOpen(event = {}) {
  return Boolean(event.registrationEnabled)
    || (event.accessType === "public" && event.allowPublicRegistration === true)
    || (event.accessType === "members_only" && event.allowMemberRegistration === true)
    || event.preStatus === "invitation_published"
    || normalizeLifecyclePhase(event.lifecyclePhase) === "registration_open";
}

function defaultGlobalEventRegistrationMailText(variant = "confirmation") {
  if (variant === "waitlist") {
    return [
      "Guten Tag {{firstName}} {{lastName}},",
      "",
      `vielen Dank fuer Ihr Interesse an "{{eventTitle}}".`,
      "",
      "Aktuell fuehren wir Ihre Anmeldung auf der Warteliste. Sobald ein Platz frei wird, melden wir uns bei Ihnen.",
      "",
      "Termin: {{eventDate}}",
      "Ort: {{eventLocation}}",
      "",
      "Viele Gruesse",
      "PROdigitalTV"
    ].join("\n");
  }
  return [
    "Guten Tag {{firstName}} {{lastName}},",
    "",
    `vielen Dank fuer Ihre Anmeldung zu "{{eventTitle}}".`,
    "",
    "Bitte bestaetigen Sie Ihre Anmeldung ueber den Button in dieser E-Mail. Erst danach ist Ihre Anmeldung verbindlich vorgemerkt.",
    "",
    "Termin: {{eventDate}}",
    "Ort: {{eventLocation}}",
    "",
    "Nach der Bestaetigung erhalten Sie Ihren Ticket-Link. Wenn Sie die Anmeldung am Computer bestaetigen, oeffnen Sie den Ticket-Link bitte einmal auf dem Handy.",
    "",
    "Viele Gruesse",
    "PROdigitalTV"
  ].join("\n");
}

function mailTemplateSettings(record = {}) {
  record = record || {};
  const value = record?.value && typeof record.value === "object" ?record.value : {};
  return {
    registrationConfirmation: record.registrationConfirmation || value.registrationConfirmation || defaultGlobalEventRegistrationMailText("confirmation"),
    registrationWaitlist: record.registrationWaitlist || value.registrationWaitlist || defaultGlobalEventRegistrationMailText("waitlist")
  };
}

function browserPushSettings(record = {}) {
  record = record || {};
  const value = record?.value && typeof record.value === "object" ?record.value : {};
  return {
    vapidPublicKey: record.vapidPublicKey || value.vapidPublicKey || ""
  };
}

function renderEventMailTemplate(template = "", event = {}) {
  const replacements = {
    eventTitle: event.title || "PROdigitalTV Event",
    eventDate: event.date ?formatDate(event.date) : "dem Veranstaltungstermin",
    eventLocation: [event.locationName, event.city].filter(Boolean).join(", ") || "dem Veranstaltungsort"
  };
  return String(template || "").replace(/\{\{(eventTitle|eventDate|eventLocation)\}\}/g, (_, key) => replacements[key] || "");
}

function defaultEventRegistrationMailText(event = {}, variant = "confirmation", templates = {}) {
  const template = variant === "waitlist" ?templates.registrationWaitlist : templates.registrationConfirmation;
  return renderEventMailTemplate(template || defaultGlobalEventRegistrationMailText(variant), event);
}

function eventRegistrationTogglePanel(event = {}) {
  const isOpen = cmsEventRegistrationIsOpen(event);
  return `<section class="panel" style="background:var(--pdt-bg);margin-bottom:18px">
    <div class="actions" style="justify-content:space-between;align-items:center;gap:18px">
      <div>
        <p class="eyebrow">Anmeldestatus</p>
        <h2>${isOpen ?"Anmeldung offen" : "Anmeldung geschlossen"}</h2>
        <p class="muted">Ein Klick auf Aktiv veroeffentlicht das Event und oeffnet die passende Anmeldung. Beim Ausschalten wird nur die Anmeldung geschlossen; das Event bleibt sichtbar.</p>
      </div>
      <label class="cms-switch ${isOpen ?"is-active" : ""}">
        <input type="checkbox" data-event-registration-toggle="${escapeHtml(event.id || "")}" ${isOpen ?"checked" : ""}>
        <span class="cms-switch__track" aria-hidden="true"></span>
        <span class="cms-switch__text">${isOpen ?"Aktiv" : "Inaktiv"}</span>
      </label>
    </div>
    <div id="event-registration-toggle-result"></div>
  </section>`;
}

function eventFollowUpActionButtons(event = {}) {
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/event/${event.id}?tab=post" title="Rückblick bearbeiten" aria-label="Rückblick bearbeiten">${iconImage("edit")}</a><button class="icon-button icon-button--danger" type="button" data-delete-event="${escapeHtml(event.id)}" data-delete-return="cms/followup" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function eventImageUrl(event = {}, mediaAssets = []) {
  const asset = recordMediaAsset(event, mediaAssets, "events", "imageUrl");
  return mediaAssetUrl(asset || {}) || event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "";
}

function eventFollowUpTable(events = [], mediaAssets = [], allEditorial = []) {
  return `<section class="panel"><div class="table-wrap"><table class="table table--editorial table--event-followup table--with-audio"><thead><tr><th>Bild</th><th>Titel</th><th>Datum</th><th>Status</th><th>Audio</th><th>Medien</th><th>Aktionen</th></tr></thead><tbody>${events.length ?events.map((event) => {
    const retrospectiveArticle = allEditorial.find((item) => {
      const category = String(item.category || "").toLowerCase();
      return retrospectiveMatchesEvent(item, event)
        && (item.isRetrospective || category.includes("rückblick") || category.includes("rueckblick") || category.includes("rückblick"))
        && (item.page === "press" || item.section === "pressRelease");
    });
    return `<tr>
    <td><div class="topic-thumb topic-thumb--table editorial-thumb--table event-thumb--table">${eventThumb(event, mediaAssets, "#/cms/followup")}</div></td>
    <td><a class="link editorial-title-link" href="#/cms/event/${event.id}?tab=post" title="${escapeHtml(event.title || "-")}">${escapeHtml(shortText(event.title || "-", 70))}</a>${event.subtitle ?`<small>${escapeHtml(shortText(event.subtitle, 95))}</small>` : ""}</td>
    <td>${escapeHtml(formatDate(event.date))}</td>
    <td>${status(normalizeLifecyclePhase(event.lifecyclePhase) === "archived" ?"published" : event.status || event.lifecyclePhase || "draft")}</td>
    <td>${retrospectiveArticle ?audioListCell("editorialContent", retrospectiveArticle) : `<small class="muted">Rückblick-Beitrag fehlt</small>`}</td>
    <td>${editorialMediaFlags(retrospectiveArticle || event)}</td>
    <td>${eventFollowUpActionButtons(event)}</td>
  </tr>`;
  }).join("") : `<tr><td colspan="7">Noch keine Rückblicke vorhanden.</td></tr>`}</tbody></table></div></section>`;
}

function editorialSummaryThumb(item = {}) {
  const url = editorialThumbUrl(item);
  return url ?`<span class="editorial-tool-summary-thumb"><img src="${escapeHtml(url)}" alt=""></span>` : "";
}

function galleryThumb(gallery) {
  const images = Array.isArray(gallery.images) ?gallery.images : [];
  const first = images
    .filter((image) => image.url)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))[0];
  return first?.url
    ?`<img src="${escapeHtml(first.url)}" alt="">`
    : `<span>Galerie</span>`;
}

function mediaLibraryHref({ collection = "", id = "", field = "imageUrl", altField = "thumbnail_alt", returnTo = "" } = {}) {
  if (!collection || !id) return "";
  const params = new URLSearchParams({
    targetCollection: collection,
    targetId: id,
    targetField: field,
    targetAltField: altField,
    returnTo
  });
  return `#/cms/media/library?${params.toString()}`;
}

function imageDropzone({ inputName, removeName, imageUrl = "", label = "Bild", defaultSize = "240x180", aiCollage = false, simple = false, mediaHref = "" }) {
  const [defaultWidth, defaultHeight] = String(defaultSize || "240x180").split("x").map((value) => Number(value) || 1);
  const simpleStyle = simple ?` style="--image-dropzone-aspect:${defaultWidth} / ${defaultHeight}"` : "";
  return `<div class="image-dropzone ${simple ?"image-dropzone--simple" : ""}" data-image-dropzone ${simple ?"data-simple-image-dropzone" : ""}${simpleStyle}>
    <input type="hidden" name="${removeName}" value="">
    <input type="hidden" name="${inputName}DataUrl" value="">
    <input type="hidden" name="${inputName}FileName" value="">
    <input class="image-dropzone__input" type="file" name="${inputName}" accept="image/*">
    ${aiCollage ?`<div class="image-mode-switch" role="group" aria-label="Bildquelle waehlen">
      <button class="is-active" type="button" data-image-mode="upload">Bild hochladen</button>
      <button type="button" data-image-mode="ai">Bild erzeugen</button>
    </div>` : ""}
    <div data-image-mode-panel="upload">
    <div class="image-dropzone__header">
      <div><strong>${escapeHtml(label)} hochladen</strong><p>Drag-and-drop, Klick auf die Vorschau oder Datei auswaehlen.</p></div>
    </div>
    <div class="image-dropzone__preview ${imageUrl ?"has-image" : ""}" data-image-preview>
      ${imageUrl ?`<img src="${escapeHtml(imageUrl)}" alt="">` : `<span>${escapeHtml(label)} per Drag-and-drop oder Klick hochladen</span>`}
    </div>
    </div>
    <button type="button" class="image-dropzone__remove" data-image-remove aria-label="Bild-Verknuepfung loesen" title="Bild-Verknuepfung loesen" ${imageUrl ?"" : "hidden"}>${iconImage("trash")}</button>
    ${simple ?`<div class="simple-image-actions" data-simple-image-actions hidden>
      <label class="button button--primary button--small" data-simple-image-upload-label>Upload<input type="file" data-simple-image-upload accept="image/*" hidden></label>
      ${mediaHref ?`<a class="button button--secondary button--small" href="${escapeHtml(mediaHref)}" data-simple-image-media>Aus Mediathek laden</a>` : ""}
      <button type="button" class="button button--primary button--small" data-simple-image-apply hidden>Uebernehmen</button>
      <button type="button" class="button button--secondary button--small" data-simple-image-delete ${imageUrl ?"" : "disabled"}>Loeschen</button>
      <button type="button" class="button button--secondary button--small" data-simple-image-cancel>Abbrechen</button>
    </div>` : ""}
    <div class="image-dropzone__tools" data-image-tools hidden>
      <label>Zoom <input type="range" min="0.5" max="3" step="0.01" value="1" data-image-zoom></label>
      <label>Aufloesung <select data-image-size>
        ${[["240x180", "Thumb 240 x 180"], ["480x360", "Thumb 480 x 360"], ["600x300", "Logo 600 x 300"], ["800x1000", "Referent 800 x 1000"], ["1200x675", "Vortragsbild 1200 x 675"]].map(([value, text]) => `<option value="${value}" ${value === defaultSize ?"selected" : ""}>${text}</option>`).join("")}
      </select></label>
      <button type="button" class="button button--secondary button--small" data-image-crop>Crop anwenden</button>
    </div>
    <p class="muted" data-image-resolution>Ausgabeformat: ${escapeHtml(defaultSize.replace("x", " x "))} px.</p>
    ${aiCollage ?`<div class="image-dropzone__ai" data-image-mode-panel="ai" hidden>
      <label>KI-Collage erzeugen</label>
      <textarea name="${inputName}AiPrompt" data-ai-image-prompt placeholder="Optional: Motiv, Stil oder Schwerpunkt für die Collage beschreiben. Leer lassen = aus Titel, Subtitel und Text ableiten."></textarea>
      <button class="button button--secondary button--small" type="button" data-ai-image-generate>KI-Collage als Thumb erzeugen</button>
    </div>` : ""}
    <p class="image-dropzone__status" data-image-status>${imageUrl ?"Bild ist gespeichert." : "Kein Bild gespeichert."}</p>
  </div>`;
}

function linkedMediaActions({ collection = "", id = "", field = "imageUrl", altField = "thumbnail_alt", returnTo = "", label = "Thumb", assetId = "" } = {}) {
  if (!collection || !id) return "";
  const params = new URLSearchParams({ targetCollection: collection, targetId: id, targetField: field, targetAltField: altField, returnTo });
  const editHref = assetId ?`#/cms/media/edit?id=${encodeURIComponent(assetId)}&${params.toString()}` : "";
  return `<div class="linked-media-actions">
    <a class="button button--secondary button--small" href="${editHref || `#/cms/media/library?${params.toString()}`}">${escapeHtml(label)} ${assetId ?"bearbeiten" : "aus Mediathek waehlen"}</a>
    <a class="button button--secondary button--small" href="#/cms/media/ai?${params.toString()}">KI-Bild erstellen</a>
  </div>`;
}

function eventImageEditor(event = {}, mediaAssets = [], returnTo = "") {
  const imageUrl = eventImageUrl(event, mediaAssets);
  return `<div class="field"><label>Eventbild / Thumb</label>
    ${imageDropzone({ inputName: "eventImage", removeName: "removeEventImage", imageUrl, label: "Eventbild", defaultSize: "1200x675", simple: true, mediaHref: mediaLibraryHref({ collection: "events", id: event.id, field: "imageUrl", altField: "thumbnail_alt", returnTo }) })}
  </div>`;
}

function memberLogoEditor(item = {}, mediaAssets = [], returnTo = "") {
  const params = new URLSearchParams({
    targetCollection: "members",
    targetId: item.id || "",
    targetField: "logoUrl",
    targetAltField: "altText",
    returnTo
  });
  const currentAsset = memberLogoAsset(item, mediaAssets);
  const logoUrl = memberLogoUrl(item, mediaAssets);
  const editHref = currentAsset?.id
    ?`#/cms/media/edit?id=${encodeURIComponent(currentAsset.id)}&${params.toString()}`
    : `#/cms/media/library?${params.toString()}`;
  const libraryHref = `#/cms/media/library?${params.toString()}`;
  return `<div class="member-logo-editor">
    <div class="member-logo-editor__preview">${logoUrl ?`<img src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(item.name || "")}">` : memberLogoFallback(item)}</div>
    <div class="member-logo-editor__actions">
      <a class="button button--primary button--small" href="${editHref}">Logo bearbeiten</a>
      <a class="button button--secondary button--small" href="${libraryHref}">Logo austauschen</a>
      ${logoUrl ?`<button class="button button--secondary button--small" type="button" data-clear-member-logo="${escapeHtml(item.id || "")}">Logo loeschen</button>` : ""}
      <p class="muted">Speichern im Mediathek-Editor ersetzt dieses Mitgliederlogo im bestehenden Mitgliedsprofil.</p>
    </div>
  </div>`;
}

function memberLogoThumb(item = {}, mediaAssets = [], section = "all") {
  const currentAsset = memberLogoAsset(item, mediaAssets);
  const logoUrl = memberLogoUrl(item, mediaAssets);
  const content = logoUrl
    ?`<img src="${escapeHtml(logoUrl)}" alt="">`
    : memberLogoFallback(item);
  if (!item.id) return content;
  const targetItem = { ...item, logoUrl, logo_media_asset_id: currentAsset?.id || item.logo_media_asset_id || "", thumbnail_media_asset_id: currentAsset?.id || item.thumbnail_media_asset_id || item.mediaAssetId || "" };
  return `<a class="cms-thumb-action" href="${cmsThumbTarget("members", targetItem, section, "logoUrl", "altText")}" title="${logoUrl ?"Logo bearbeiten" : "Logo mit KI erstellen"}" aria-label="${logoUrl ?"Logo bearbeiten" : "Logo mit KI erstellen"}">${content}</a>`;
}

function topicSpeakersForEvent(topic, event, speakers) {
  const eventSpeakerIds = new Set(event.speakerIds || []);
  const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
  return speakers.filter((speaker) => {
    const belongsToEvent = eventSpeakerIds.has(speaker.id) || (speaker.eventIds || []).includes(event.id);
    const belongsToTopic = topicSpeakerIds.size
      ? topicSpeakerIds.has(speaker.id)
      : speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
    return belongsToEvent && belongsToTopic;
  });
}

function normalizeCompanyKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "und")
    .replace(/\b(gmbh|ag|kg|ohg|ug|mbh|inc|ltd|llc|company|gruppe|group|rechtsanwaelte|rechtsanwalte)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function companyLogoForSpeakers(topic = {}, topicSpeakers = [], sponsors = [], members = [], mediaAssets = []) {
  const topicLogoUrl = topic.companyLogoUrl || topic.logoUrl || topic.company_logo_url || "";
  if (topicLogoUrl) return { company: topic.companyName || topic.company || topicSpeakers[0]?.company || "", logoUrl: topicLogoUrl };
  const speakerLogo = topicSpeakers.find((speaker) => speaker.companyLogoUrl || speaker.logoUrl || speaker.company_logo_url);
  if (speakerLogo) return { company: speakerLogo.company || "", logoUrl: speakerLogo.companyLogoUrl || speakerLogo.logoUrl || speakerLogo.company_logo_url || "" };
  const companies = Array.from(new Set(topicSpeakers.map((speaker) => speaker.company || speaker.organization || speaker.organisation || "").filter(Boolean)));
  const company = companies[0] || "";
  if (!company) return { company: "", logoUrl: "" };
  const companyKey = normalizeCompanyKey(company);
  const sponsor = sponsors.find((item) => normalizeCompanyKey(item.name || item.company || item.title) === companyKey)
    || sponsors.find((item) => companyKey && (normalizeCompanyKey(item.name || item.company || item.title).includes(companyKey) || companyKey.includes(normalizeCompanyKey(item.name || item.company || item.title))));
  if (sponsor) {
    const asset = recordMediaAsset(sponsor, mediaAssets, "sponsors", "logoUrl");
    const logoUrl = mediaAssetUrl(asset || {}) || sponsor.logoUrl || sponsor.logo_url || sponsor.imageUrl || sponsor.image_url || sponsor.assetUrl || "";
    if (logoUrl) return { company: sponsor.name || company, logoUrl };
  }
  const member = members.find((item) => normalizeCompanyKey(item.name || item.company || item.title) === companyKey)
    || members.find((item) => companyKey && (normalizeCompanyKey(item.name || item.company || item.title).includes(companyKey) || companyKey.includes(normalizeCompanyKey(item.name || item.company || item.title))));
  if (member) {
    const logoUrl = memberLogoUrl(member, mediaAssets);
    if (logoUrl) return { company: member.name || company, logoUrl };
  }
  return { company, logoUrl: "" };
}

function companyLogoMarkup(companyInfo = {}) {
  const company = companyInfo.company || "";
  if (!company) return `<div class="assigned-topic-card__company-logo assigned-topic-card__company-logo--empty" title="Kein Unternehmen hinterlegt"><span>--</span></div>`;
  const initialsText = company.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const fallback = `<span ${companyInfo.logoUrl ?"hidden" : ""}>${escapeHtml(initialsText || company.slice(0, 2).toUpperCase())}</span>`;
  return `<div class="assigned-topic-card__company-logo" title="${escapeHtml(company)}">${companyInfo.logoUrl ?`<img src="${escapeHtml(companyInfo.logoUrl)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ""}${fallback}</div>`;
}

function eventTopicSpeakerActions(event, topic, topicSpeakers) {
  if (!topicSpeakers.length) return "";
  return `<div class="topic-speaker-stack"><h3>Referenten dieses Vortrags</h3>${topicSpeakers.map((speaker) => `<div class="speaker-action-card">
    ${speakerAvatar(speaker)}
    <div><strong>${escapeHtml(speaker.name || "")}</strong><small>${escapeHtml([speaker.company, speaker.position].filter(Boolean).join(" - "))}</small></div>
    <div class="speaker-action-card__actions">
      <a class="button button--secondary button--small" href="#/cms/event/${event.id}?tab=topics&mode=referent&topic=${topic.id}&speaker=${speaker.id}">Bearbeiten</a>
      <button type="button" class="button button--secondary button--small" data-remove-event-topic-speaker="${speaker.id}" data-event-id="${event.id}" data-topic-id="${topic.id}">Loeschen</button>
    </div>
  </div>`).join("")}</div>`;
}

function speakerNameParts(speaker = {}) {
  const firstName = speaker.firstName || speaker.givenName || "";
  const lastName = speaker.lastName || speaker.familyName || "";
  if (firstName || lastName) return { firstName, lastName };
  const parts = String(speaker.name || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join(" ") };
}

function topicEditorPanel(event, topics, speakers, galleries = [], downloads = [], mediaAssets = [], mode, selectedTopicId, selectedSpeakerId) {
  if (!mode) return "";
  const selectedTopic = mode === "new" ?{ id: "", title: "", subtitle: "", subline: "", shortDescription: "", longDescription: "", imageUrl: "" } : topics.find((topic) => topic.id === selectedTopicId);
  if (mode === "assign") return "";
  if (mode === "remove") {
    const assignedTopics = topics.filter((topic) => (event.topicIds || []).includes(topic.id));
    return `<aside class="topic-detail-panel"><div class="topic-panel-head"><h2>Zuordnung loeschen</h2><a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics">Schliessen</a></div>
      <div class="topic-remove-list">${assignedTopics.length ?assignedTopics.map((topic) => `<div class="topic-remove-row"><div><strong>${escapeHtml(topic.title || "")}</strong><p>${escapeHtml(shortText(topic.shortDescription || topic.longDescription || ""))}</p></div><button class="button button--secondary button--small" data-unassign-event-topic="${topic.id}" data-event-id="${event.id}">Zuordnung entfernen</button></div>`).join("") : `<div class="alert">Dieses Event hat noch keine Vortragszuordnung.</div>`}</div>
    </aside>`;
  }
  if (mode === "referent" && selectedTopic) {
    const topicSpeakers = topicSpeakersForEvent(selectedTopic, event, speakers);
    const selectedSpeaker = speakers.find((speaker) => speaker.id === selectedSpeakerId) || { id: "", name: "", company: "", position: "", photoUrl: "" };
    const speakerParts = speakerNameParts(selectedSpeaker);
    return `<aside class="topic-detail-panel"><div class="topic-panel-head"><div><p class="eyebrow">Referent</p><h2>${selectedSpeaker.id ?"Referent bearbeiten" : "Referent anlegen"}</h2></div><a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics&mode=edit&topic=${selectedTopic.id}">Vortrag bearbeiten</a></div>
      <form id="event-topic-speaker-form" data-event-id="${event.id}" data-topic-id="${selectedTopic.id}" data-speaker-id="${selectedSpeaker.id || ""}" class="form-grid is-save-aware">
        <section class="panel" style="background:var(--pdt-bg)">
          <h3>Referent</h3>
          <div class="form-grid--two">
            <div class="field"><label>Vorname</label><input name="speakerFirstName" value="${escapeHtml(speakerParts.firstName || "")}" required></div>
            <div class="field"><label>Nachname</label><input name="speakerLastName" value="${escapeHtml(speakerParts.lastName || "")}" required></div>
            <div class="field"><label>Firma</label><input name="speakerCompany" value="${escapeHtml(selectedSpeaker.company || "")}"></div>
            <div class="field"><label>Position</label><input name="speakerPosition" value="${escapeHtml(selectedSpeaker.position || "")}"></div>
            <div class="field"><label>Webseite</label><input name="speakerWebsite" type="url" value="${escapeHtml(selectedSpeaker.website || selectedSpeaker.url || "")}"></div>
            <div class="field"><label>Mailadresse</label><input name="speakerEmail" type="email" value="${escapeHtml(selectedSpeaker.email || selectedSpeaker.mail || "")}"></div>
            <div class="field"><label>Telefonnummer</label><input name="speakerPhone" type="tel" value="${escapeHtml(selectedSpeaker.phone || selectedSpeaker.mobile || "")}"></div>
          </div>
        </section>
        <div class="field"><label>Kurzvita</label><textarea name="speakerShortBio" rows="4">${escapeHtml(selectedSpeaker.shortBio || selectedSpeaker.bio || "")}</textarea></div>
        <div class="field"><label>Ausfuehrliche Vita</label><textarea name="speakerLongBio" rows="8">${escapeHtml(selectedSpeaker.longBio || selectedSpeaker.vita || selectedSpeaker.biography || "")}</textarea></div>
        <div class="form-grid--two">
          <div class="field"><label>Unternehmenslogo</label>${imageDropzone({ inputName: "speakerCompanyLogo", removeName: "removeSpeakerCompanyLogo", imageUrl: selectedSpeaker.companyLogoUrl || selectedSpeaker.logoUrl || "", label: "Unternehmenslogo", defaultSize: "600x300", simple: true })}</div>
          <div class="field"><label>Referentenfoto</label>${imageDropzone({ inputName: "speakerImage", removeName: "removeSpeakerImage", imageUrl: selectedSpeaker.photoUrl || "", label: "Referentenfoto", defaultSize: "800x1000", simple: true, mediaHref: selectedSpeaker.id ?mediaLibraryHref({ collection: "speakers", id: selectedSpeaker.id, field: "photoUrl", altField: "altText", returnTo: `#/cms/event/${event.id}?tab=topics&mode=referent&topic=${selectedTopic.id}&speaker=${selectedSpeaker.id}` }) : "" })}</div>
        </div>
        <div class="actions"><button class="button button--secondary" type="button" onclick="location.hash='#/cms/event/${event.id}?tab=topics&mode=edit&topic=${selectedTopic.id}'">Abbrechen</button><button class="button button--primary">Speichern</button></div>
        <div id="event-topic-speaker-result"></div>
      </form>
      ${eventTopicSpeakerActions(event, selectedTopic, topicSpeakers)}
    </aside>`;
  }
  if (!selectedTopic && mode !== "new") return "";
  const topicSpeakers = selectedTopic?.id ?topicSpeakersForEvent(selectedTopic, event, speakers) : [];
  const firstTopicSpeaker = topicSpeakers[0];
  const speakerForForm = speakers.find((speaker) => speaker.id === selectedSpeakerId) || firstTopicSpeaker || {};
  const speakerParts = speakerNameParts(speakerForForm);
  const topicHeadActions = selectedTopic.id
    ?`<div class="topic-panel-actions">${firstTopicSpeaker ?`<a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics&mode=referent&topic=${selectedTopic.id}&speaker=${firstTopicSpeaker.id}">Referent bearbeiten</a>` : `<a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics&mode=referent&topic=${selectedTopic.id}">Referent hinzufuegen</a>`}<button class="button button--secondary button--small" type="button" data-copy-talk-to-topic="${selectedTopic.id}" data-event-id="${event.id}">Themenartikel erzeugen</button><a class="link-button" href="#/cms/event/${event.id}?tab=topics">Schliessen</a></div>`
    : `<a class="link-button" href="#/cms/event/${event.id}?tab=topics">Schliessen</a>`;
  const topicEntityId = selectedTopic.id || `topics-${crypto.randomUUID()}`;
  const topicAsset = recordMediaAsset(selectedTopic, mediaAssets, "topics", "imageUrl");
  const galleryOptions = [`<option value="">Keine Galerie zugeordnet</option>`, ...galleries
    .filter((gallery) => gallery.status !== "archived")
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "de"))
    .map((gallery) => `<option value="${escapeHtml(gallery.id)}" ${selectedTopic.galleryId === gallery.id ?"selected" : ""}>${escapeHtml(gallery.title || gallery.id)} (${(gallery.images || []).length} Bilder)</option>`)].join("");
  const documentOptions = [`<option value="">Keine PowerPoint / kein Dokument</option>`, ...downloads
    .filter((document) => !["archived", "deleted"].includes(String(document.status || "").toLowerCase()))
    .sort((a, b) => String(a.title || a.fileName || "").localeCompare(String(b.title || b.fileName || ""), "de"))
    .map((document) => `<option value="${escapeHtml(document.id)}" ${(selectedTopic.downloadId || selectedTopic.documentId || selectedTopic.presentationId) === document.id ?"selected" : ""}>${escapeHtml(document.title || document.fileName || document.id)}</option>`)].join("");
  return `<aside class="topic-detail-panel"><div class="topic-panel-head"><div><p class="eyebrow">${mode === "new" ?"Neu" : "Vortrag bearbeiten"}</p><h2>${mode === "new" ?"Neuer Vortrag" : escapeHtml(selectedTopic.title || "")}</h2></div>${topicHeadActions}</div>
    <form id="event-topic-editor-form" data-event-id="${event.id}" data-topic-id="${topicEntityId}" data-topic-mode="${mode}" data-speaker-id="${speakerForForm.id || ""}" class="form-grid">
      <section class="panel" style="background:var(--pdt-bg)">
        <h3>1. Referent</h3>
        <div class="form-grid--two">
          <div class="field"><label>Vorname</label><input name="speakerFirstName" value="${escapeHtml(speakerParts.firstName || "")}" required></div>
          <div class="field"><label>Nachname</label><input name="speakerLastName" value="${escapeHtml(speakerParts.lastName || "")}" required></div>
          <div class="field"><label>Firma</label><input name="speakerCompany" value="${escapeHtml(speakerForForm.company || "")}"></div>
          <div class="field"><label>Position</label><input name="speakerPosition" value="${escapeHtml(speakerForForm.position || "")}"></div>
          <div class="field"><label>Webseite</label><input name="speakerWebsite" type="url" value="${escapeHtml(speakerForForm.website || speakerForForm.url || "")}"></div>
          <div class="field"><label>Mailadresse</label><input name="speakerEmail" type="email" value="${escapeHtml(speakerForForm.email || speakerForForm.mail || "")}"></div>
          <div class="field"><label>Telefonnummer</label><input name="speakerPhone" type="tel" value="${escapeHtml(speakerForForm.phone || speakerForForm.mobile || "")}"></div>
        </div>
        <div class="field"><label>Kurzvita</label><textarea name="speakerShortBio" rows="4">${escapeHtml(speakerForForm.shortBio || speakerForForm.bio || "")}</textarea></div>
        <div class="field"><label>Ausfuehrliche Vita</label><textarea name="speakerLongBio" rows="7">${escapeHtml(speakerForForm.longBio || speakerForForm.vita || speakerForForm.biography || "")}</textarea></div>
      </section>
      <section class="panel">
        <h3>2. Vortrag</h3>
        <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(selectedTopic.title || "")}" required>${aiFieldActions([{ action: "improveText", target: "title", label: "Titel mit ChatGPT", entityType: "topics", entityId: topicEntityId, fieldName: "title" }])}</div>
        <div class="field"><label>Subline</label><input name="subline" value="${escapeHtml(selectedTopic.subline || selectedTopic.subtitle || "")}"></div>
        <div class="field"><label>Beschreibung</label><textarea name="text" required>${escapeHtml(selectedTopic.longDescription || selectedTopic.description || selectedTopic.shortDescription || "")}</textarea>${aiFieldActions([{ action: "generateTopicDescription", target: "text", label: "Beitragstext mit KI erzeugen", entityType: "topics", entityId: topicEntityId, fieldName: "longDescription" }])}</div>
        <div class="form-grid--two">
          <div class="field"><label>Unternehmenslogo</label>${imageDropzone({ inputName: "topicCompanyLogo", removeName: "removeTopicCompanyLogo", imageUrl: selectedTopic.companyLogoUrl || selectedTopic.logoUrl || "", label: "Unternehmenslogo", defaultSize: "600x300", simple: true })}</div>
          <div class="field"><label>Vortragsbild</label>${imageDropzone({ inputName: "topicImage", removeName: "removeTopicImage", imageUrl: topicImageUrl(selectedTopic, mediaAssets), label: "Vortragsbild", defaultSize: "1200x675", simple: true, mediaHref: selectedTopic.id ?mediaLibraryHref({ collection: "topics", id: topicEntityId, field: "imageUrl", altField: "thumbnail_alt", returnTo: `#/cms/event/${event.id}?tab=topics&mode=edit&topic=${topicEntityId}` }) : "" })}</div>
        </div>
        <div class="form-grid--two">
          <div class="field"><label>PowerPoint optional</label><select name="downloadId">${documentOptions}</select><p class="muted">PowerPoint/PDF aus der Dokumentenverwaltung zuordnen.</p></div>
          <div class="field"><label>Galerie optional</label><select name="galleryId">${galleryOptions}</select><p class="muted">Galerie aus der Galerieverwaltung zuordnen.</p></div>
        </div>
      </section>
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
  const folderLabel = (topic = {}) => topic.folder || topic.folderName || topic.ordner || topic.category || topic.rubrik || "Ohne Ordner";
  const folders = Array.from(candidates.reduce((map, topic) => {
    const label = folderLabel(topic);
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(topic);
    return map;
  }, new Map()).entries()).sort(([a], [b]) => String(a).localeCompare(String(b), "de"));
  return `<div class="topic-inline-panel"><div class="topic-panel-head"><h2>Aus Ordner zuordnen</h2><a class="button button--primary button--small" href="#/cms/event/${event.id}?tab=topics">Schliessen</a></div>
    <form id="event-topic-assign-form" data-event-id="${event.id}" class="form-grid">
      ${folders.length ?folders.map(([folder, folderTopics]) => `<section class="panel" style="background:var(--pdt-bg)"><h3>${escapeHtml(folder)}</h3><div class="selection-grid">${folderTopics
        .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "de"))
        .map((topic) => `<label class="selection-item"><input type="radio" name="topicId" value="${topic.id}" required><span><strong>${escapeHtml(topic.title || "")}</strong><small>${escapeHtml(shortText(topic.shortDescription || topic.longDescription || ""))}</small></span></label>`).join("")}</div></section>`).join("") : `<div class="alert">Alle vorhandenen Vortraege aus den Ordnern sind bereits zugeordnet.</div>`}
      <div class="actions"><button class="button button--primary" ${candidates.length ?"" : "disabled"}>Zuordnen</button></div>
      <div id="event-topic-assign-result"></div>
    </form>
  </div>`;
}

function eventTopicsEditor(event, topics, speakers, allEvents, galleries = [], downloads = [], mediaAssets = [], query = new URLSearchParams(), sponsors = [], members = []) {
  const assignedTopicIds = new Set(event.topicIds || []);
  const assignedTopics = (event.topicIds || []).map((topicId) => topics.find((topic) => topic.id === topicId)).filter(Boolean);
  const topicLimitReached = assignedTopics.length >= 6;
  const requestedMode = query.get("mode") || "";
  const mode = topicLimitReached && ["new", "assign"].includes(requestedMode) ?"" : requestedMode;
  const selectedTopicId = query.get("topic") || "";
  const selectedSpeakerId = query.get("speaker") || "";
  const detailPanel = mode && mode !== "assign" ?topicEditorPanel(event, topics, speakers, galleries, downloads, mediaAssets, mode, selectedTopicId, selectedSpeakerId) : "";
  const assignPanel = topicAssignPanel(event, topics, mode);
  const newHref = topicLimitReached && mode !== "new" ?`#/cms/event/${event.id}?tab=topics` : mode === "new" ?`#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=new`;
  const newClass = mode === "new" ?"button button--primary button--small" : `button button--secondary button--small${topicLimitReached ?" disabled" : ""}`;
  const assignHref = topicLimitReached && mode !== "assign" ?`#/cms/event/${event.id}?tab=topics` : mode === "assign" ?`#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=assign`;
  const assignClass = mode === "assign" ?"button button--primary button--small" : `button button--secondary button--small${topicLimitReached ?" disabled" : ""}`;
  const removeHref = mode === "remove" ?`#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=remove`;
  const removeClass = mode === "remove" ?"button button--primary button--small" : "button button--secondary button--small";
  return `<div class="topic-workspace">
    <section class="topic-list-panel">
      <div class="topic-actionbar">
        <a class="${newClass}" href="${newHref}">+ Neu</a>
        <a class="${assignClass}" href="${assignHref}">+ Aus Ordner</a>
        <a class="${removeClass}" href="${removeHref}">Loeschen</a>
      </div>
      <p class="muted">Pro Medienfruehstueck sind maximal 6 Vortraege vorgesehen. Jeder Vortrag besteht aus Thema, Beschreibung und Referent.</p>
      ${topicLimitReached ?`<div class="alert">Maximal 6 Vortraege sind erreicht. Bitte zuerst einen Vortrag entfernen, bevor ein neuer hinzugefuegt wird.</div>` : ""}
      ${assignPanel}
      ${detailPanel}
      <div class="assigned-topic-list-head">
        <div>
          <h2>Referenten und Vortraege</h2>
          <p class="muted">Reihenfolge per Griff verschieben. Titel oder Stift oeffnen die Bearbeitung.</p>
        </div>
        <strong>${assignedTopics.length} / 6</strong>
      </div>
      <div class="assigned-topic-list">${assignedTopics.length ?assignedTopics.map((topic, index) => {
        const topicSpeakers = topicSpeakersForEvent(topic, event, speakers);
        const summary = topic.subline || topic.subtitle || topic.shortDescription || topic.description || topic.longDescription || "";
        const companyInfo = companyLogoForSpeakers(topic, topicSpeakers, sponsors, members, mediaAssets);
        return `<div class="assigned-topic-card ${selectedTopicId === topic.id ?"active" : ""}" draggable="true" data-topic-drag-id="${topic.id}" data-event-id="${event.id}">
          <button type="button" class="drag-handle" aria-label="Vortrag verschieben">::</button>
          <div class="assigned-topic-card__index">${index + 1}</div>
          ${companyLogoMarkup(companyInfo)}
          <div class="topic-thumb assigned-topic-card__thumb-link">${topicThumb(topic, mediaAssets)}</div>
          <div class="assigned-topic-card__body">
            <a class="assigned-topic-card__title" href="#/cms/event/${event.id}?tab=topics&mode=edit&topic=${topic.id}" title="${escapeHtml(topic.title || "")}">${escapeHtml(topic.title || "")}</a>
            ${summary ?`<p>${escapeHtml(shortText(summary, 180))}</p>` : `<p class="muted">Noch keine Kurzbeschreibung hinterlegt.</p>`}
            <div class="topic-speaker-badges">${topicSpeakers.length ?topicSpeakers.map((speaker) => `<a class="speaker-badge" href="#/cms/event/${event.id}?tab=topics&mode=referent&topic=${topic.id}&speaker=${speaker.id}" title="${escapeHtml([speaker.name, speaker.company, speaker.position].filter(Boolean).join(" - "))}">${speakerAvatar(speaker, "speaker-badge__avatar")}<span><strong>${escapeHtml(speaker.name || "")}</strong><small>${escapeHtml([speaker.company, speaker.position].filter(Boolean).join(" - ") || "Referent")}</small></span></a>`).join("") : `<a class="speaker-badge speaker-badge--empty" href="#/cms/event/${event.id}?tab=topics&mode=referent&topic=${topic.id}">Referent hinzufuegen</a>`}</div>
          </div>
          <div class="assigned-topic-card__actions table-actions table-actions--icons">
            <a class="icon-button icon-button--visible" href="#/topic/${topic.id}" title="Anzeigen" aria-label="Anzeigen">${iconImage("eye")}</a>
            <a class="icon-button icon-button--edit" href="#/cms/event/${event.id}?tab=topics&mode=edit&topic=${topic.id}" title="Vortrag bearbeiten" aria-label="Vortrag bearbeiten">${iconImage("edit")}</a>
            <button class="icon-button icon-button--danger" type="button" data-unassign-event-topic="${topic.id}" data-event-id="${event.id}" title="Zuordnung entfernen" aria-label="Zuordnung entfernen">${iconImage("trash")}</button>
          </div>
        </div>`;
      }).join("") : `<div class="empty">Noch keine Vortraege zugeordnet. Starte mit Neu oder Zuordnen.</div>`}</div>
    </section>
  </div>`;
}

function eventPartnersEditor(event, sponsors, mediaAssets = []) {
  const selectedPartner = sponsors.find((item) => item.id === event.hostId) || null;
  const selectedAsset = selectedPartner ?recordMediaAsset(selectedPartner, mediaAssets, "sponsors", "logoUrl") : null;
  const selectedLogo = mediaAssetUrl(selectedAsset || {}) || selectedPartner?.logoUrl || selectedPartner?.logo_url || selectedPartner?.imageUrl || selectedPartner?.image_url || selectedPartner?.assetUrl || "";
  const sponsorLogo = (partner = {}) => {
    const asset = recordMediaAsset(partner, mediaAssets, "sponsors", "logoUrl");
    return mediaAssetUrl(asset || {}) || partner.logoUrl || partner.logo_url || partner.imageUrl || partner.image_url || partner.assetUrl || "";
  };
  const partnerOptions = [`<option value="__new__">Neuen Co-Gastgeber anlegen ...</option>`, `<option value="" ${!event.hostId ?"selected" : ""}>Kein Co-Gastgeber</option>`, ...sponsors.map((partner) => `<option value="${escapeHtml(partner.id)}" ${event.hostId === partner.id ?"selected" : ""}>${escapeHtml(partner.name || partner.id)}</option>`)].join("");
  return `<form id="event-partners-form" data-event-id="${event.id}" class="form-grid">
    <div class="actions" style="justify-content:space-between"><div><h2>Gastgeber / Co-Gastgeber</h2><p class="muted">PROdigitalTV ist immer Gastgeber. Pro Event kann genau ein Co-Gastgeber ausgewaehlt werden.</p></div><button class="button button--primary button--small">Alles speichern</button></div>
    <section class="panel" style="background:var(--pdt-bg)"><h3>Gastgeber</h3><div class="field"><label>Gastgeber</label><select name="primaryHost" disabled><option value="prodigitaltv" selected>PROdigitalTV</option></select></div></section>
    <section class="panel"><h3>Co-Gastgeber auswaehlen</h3><div class="form-grid--two"><div class="field"><label>Co-Gastgeber</label><select name="hostId">${partnerOptions}</select><p class="muted">Auswahl speichern, um den Co-Gastgeber mit dem Event zu verbinden.</p></div><div class="partner-select-preview">${selectedPartner ?`<div class="partner-select-preview__logo">${selectedLogo ?`<img src="${escapeHtml(selectedLogo)}" alt="Logo ${escapeHtml(selectedPartner.name || "")}">` : `<span>${escapeHtml((selectedPartner.name || "?").slice(0, 2).toUpperCase())}</span>`}</div><div><strong>${escapeHtml(selectedPartner.name || "")}</strong><small>${escapeHtml(selectedPartner.website || "")}</small><a class="button button--secondary button--small" href="#/cms/edit?module=sponsors&id=${selectedPartner.id}&section=sponsors">Bearbeiten</a></div>` : `<div class="partner-select-preview__logo partner-select-preview__logo--empty">PRO</div><div><strong>Kein Co-Gastgeber</strong><small>Nur PROdigitalTV anzeigen</small></div>`}</div></div></section>
    <section class="panel" style="background:var(--pdt-bg)"><h3>Ausgewaehlten Co-Gastgeber bearbeiten</h3>${selectedPartner ?`<div class="partner-editor-grid" style="margin-top:14px"><div class="partner-logo-editor"><div class="member-logo-editor__preview">${selectedLogo ?`<img src="${escapeHtml(selectedLogo)}" alt="Logo ${escapeHtml(selectedPartner.name || "")}">` : `<span>Noch kein Logo</span>`}</div>${linkedMediaActions({ collection: "sponsors", id: selectedPartner.id, field: "logoUrl", altField: "altText", returnTo: `#/cms/event/${event.id}?tab=partners`, label: "Logo", assetId: selectedAsset?.id || "" })}</div><div class="form-grid--two"><div class="field"><label>Name</label><input name="edit-sponsor-${selectedPartner.id}-name" value="${escapeHtml(selectedPartner.name || "")}"></div><div class="field"><label>Rolle</label><input name="edit-sponsor-${selectedPartner.id}-role" value="Co-Gastgeber" readonly></div><div class="field"><label>Website</label><input name="edit-sponsor-${selectedPartner.id}-website" value="${escapeHtml(selectedPartner.website || "")}"></div><div class="field"><label>Beschreibung</label><textarea name="edit-sponsor-${selectedPartner.id}-description">${escapeHtml(selectedPartner.description || "")}</textarea>${aiFieldActions([{ action: "generateSponsorText", target: `edit-sponsor-${selectedPartner.id}-description`, label: "Co-Gastgebertext", entityType: "sponsor", entityId: selectedPartner.id, fieldName: "description" }])}</div></div></div>` : `<p>Noch kein Co-Gastgeber ausgewaehlt.</p>`}</section>
    <section class="panel cms-inline-create-panel" data-new-sponsor-layer hidden><div class="field-label-row"><h3>Neuen Co-Gastgeber anlegen</h3><button type="button" class="button button--secondary button--small" data-close-new-sponsor>Abbrechen</button></div><div class="form-grid--two"><div class="field"><label>Name</label><input name="newSponsorName"></div><input type="hidden" name="newSponsorRole" value="Co-Gastgeber"><div class="field"><label>Website</label><input name="newSponsorWebsite"></div><div class="field"><label>Beschreibung</label><textarea name="newSponsorDescription"></textarea></div></div><p class="muted">Speichern legt den Co-Gastgeber an und ordnet ihn direkt diesem Event zu.</p><div class="actions"><button type="submit" class="button button--primary button--small">Anlegen und speichern</button></div></section>
    <div class="actions"><button class="button button--primary">Co-Gastgeber speichern</button></div><div id="event-partners-result"></div>
  </form>`;
}

export async function eventEditPage(id, tab = "base", query = new URLSearchParams()) {
  if (!hasCmsAccess()) return denied();
  let event = id === "new" ?{
    id: `event-${crypto.randomUUID()}`, title: "", subtitle: "", date: "2026-08-01", startTime: "10:00", endTime: "13:00", locationName: "", address: "", postalCode: "", city: "", description: "", eventType: "Panel", accessType: "public", status: "draft", lifecyclePhase: "planning", registrationEnabled: false, maxParticipants: 50, expiresAt: "", phone: "", topicIds: [], speakerIds: [], sponsorIds: []
  } : await getOne("events", id);
  if (!event) return eventsAdminPage();
  const [topics, speakers, sponsors, registrations, media, settings, allEvents, galleries, allEditorial, mediaAssets, audioProviders, videoLibrary, downloads, members] = await Promise.all([list("topics"), list("speakers"), list("sponsors"), list("registrations"), list("eventMedia"), list("settings"), list("events"), list("galleries"), list("editorialContent"), list("media_assets").catch(() => []), getOne("settings", "audioProviders").catch(() => null), list("media_videos").catch(() => []), list("downloads").catch(() => []), list("members").catch(() => [])]);
  const eventTypes = settingValue(settings, "eventTypes", ["Medienfruehstueck", "Summit", "Roundtable", "Panel", "Webinar", "Konferenz", "Workshop"]);
  const availableGalleries = galleries
    .filter((gallery) => gallery.status !== "archived")
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "de"));
  const galleryOptions = [`<option value="">Keine Galerie verknuepfen</option>`, ...availableGalleries
    .map((gallery) => `<option value="${escapeHtml(gallery.id)}" data-gallery-payload="${galleryPayloadAttribute(gallery)}" ${event.galleryId === gallery.id || (!event.galleryId && gallery.eventId === event.id) ?"selected" : ""}>${escapeHtml(gallery.title || gallery.id)} (${(gallery.images || []).length} Bilder)</option>`)].join("");
  const customSelect = ({ name, label, value = "", options = [], note = "", attrs = "" }) => {
    const current = options.find((option) => String(option.value) === String(value)) || options[0] || { value: "", label: "" };
    return `<div class="field cms-compact-select-field" data-compact-select><label>${escapeHtml(label)}</label><input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(current.value)}" ${attrs}><button type="button" class="cms-compact-select__trigger" data-compact-select-trigger aria-expanded="false">${escapeHtml(current.label)}</button><div class="cms-compact-select__menu" data-compact-select-menu hidden>${options.map((option) => `<button type="button" class="cms-compact-select__option ${String(option.value) === String(current.value) ?"is-active" : ""}" data-compact-select-value="${escapeHtml(option.value)}" data-compact-select-label="${escapeHtml(option.label)}">${escapeHtml(option.label)}</button>`).join("")}</div>${note ?`<p class="muted">${escapeHtml(note)}</p>` : ""}</div>`;
  };
  const eventTypeOptions = [...eventTypes.map((value) => ({ value, label: value })), { value: "__new__", label: "Neuen Eventtyp hinzufuegen ..." }];
  const accessTypeOptions = Object.entries(accessLabels).map(([key, value]) => ({ value: key, label: value }));
  const sponsorSelectOptions = sponsors
    .filter((sponsor) => !["archived", "deleted"].includes(String(sponsor.status || "").toLowerCase()))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"))
    .map((sponsor) => ({ value: sponsor.id, label: sponsor.name || sponsor.id }));
  const primaryHostOptions = [{ value: "__new_primary_host__", label: "Neuen Gastgeber anlegen ..." }, { value: "prodigitaltv", label: "PROdigitalTV" }, ...sponsorSelectOptions];
  const coHostOptions = [{ value: "__new_co_host__", label: "Neuen Co-Gastgeber anlegen ..." }, { value: "", label: "Kein Co-Gastgeber" }, ...sponsorSelectOptions];
  const selectedGallery = availableGalleries.find((gallery) => event.galleryId === gallery.id || (!event.galleryId && gallery.eventId === event.id));
  const selectedGalleryId = event.galleryId || (selectedGallery?.eventId === event.id ? selectedGallery.id : "");
  const galleryPickerOptions = [
    { value: "", label: "Keine Galerie verknuepfen" },
    ...availableGalleries.map((gallery) => ({ value: gallery.id, label: `${gallery.title || gallery.id} (${(gallery.images || []).length} Bilder)` }))
  ];
  const eventTypePicker = customSelect({ name: "eventType", label: "Eventtyp", value: event.eventType, options: eventTypeOptions, attrs: "data-event-type-select" });
  const accessTypePicker = customSelect({ name: "accessType", label: "Zugangsart", value: event.accessType, options: accessTypeOptions });
  const primaryHostPicker = customSelect({ name: "primaryHostId", label: "Gastgeber", value: event.primaryHostId || "prodigitaltv", options: primaryHostOptions });
  const coHostPicker = customSelect({ name: "hostId", label: "Co-Gastgeber", value: event.hostId || "", options: coHostOptions, note: "Der Co-Gastgeber wird im Event und in der Eventbox angezeigt." });
  const hostCreateLayer = `<div class="cms-host-create-layer" data-host-create-layer hidden>
    <div class="cms-host-create-layer__panel" role="dialog" aria-modal="true" aria-labelledby="host-create-title">
      <div class="field-label-row">
        <div><p class="eyebrow">Stammdaten</p><h3 id="host-create-title" data-host-create-title>Gastgeber anlegen</h3></div>
        <button type="button" class="button button--secondary button--small" data-host-create-cancel>Schliessen</button>
      </div>
      <input type="hidden" name="newHostTarget" data-host-create-target value="">
      <div class="form-grid--two">
        <div class="field"><label>Name</label><input name="newHostName" data-host-create-name placeholder="z. B. HEUKING"></div>
        <div class="field"><label>Website</label><input name="newHostWebsite" placeholder="https://"></div>
      </div>
      <div class="field"><label>Beschreibung</label><textarea name="newHostDescription" rows="5" placeholder="Kurzbeschreibung fuer Eventbox und Detailseite"></textarea></div>
      <p class="muted">Der neue Datensatz wird unter Sponsoren / Gastgeber gespeichert und direkt in diesem Event ausgewaehlt.</p>
      <div class="actions"><button type="button" class="button button--primary" data-host-create-save>Anlegen und auswaehlen</button></div>
      <div data-host-create-result></div>
    </div>
  </div>`;
  const galleryPicker = customSelect({ name: "galleryId", label: "Bildergalerie", value: selectedGalleryId, options: galleryPickerOptions, note: "Bilder werden im Bereich Bildergalerien freigegeben und dieser Galerie zugeordnet." });
  const eventGalleryCreateButton = `<button class="button button--secondary button--small" type="button" data-create-event-gallery>Event-Galerie anlegen</button>`;
  const galleryManageButton = `<a class="button button--secondary button--small" href="#/cms/galleries">Galerien verwalten</a>`;
  if (!["base", "pre", "topics", "partners", "registration", "post", "media", "ai"].includes(tab)) tab = "base";
  const retrospectiveArticle = allEditorial.find((item) => {
    const category = String(item.category || "").toLowerCase();
    return retrospectiveMatchesEvent(item, event)
      && (item.isRetrospective || category.includes("rückblick") || category.includes("rueckblick") || category.includes("rückblick"))
      && (item.page === "press" || item.section === "pressRelease");
  });
  const retrospectiveArticleId = retrospectiveArticle?.id || `retrospective-${event.id}`;
  const retrospectiveControl = `<section class="panel event-retrospective-control" style="background:var(--pdt-bg)">
    <div class="actions" style="justify-content:space-between;align-items:flex-start">
      <div><p class="eyebrow">Presse / Rückblicke</p><h2>Redaktionellen Rückblick steuern</h2><p class="muted">Erstellt oder aktualisiert einen Pressebeitrag in der Kategorie Rückblicke mit Fließtext, Event-Bezug und Galerie-Verknüpfung.</p></div>
      <div class="actions">
        <button type="button" class="button button--primary button--small" data-create-event-retrospective="${escapeHtml(event.id)}">${retrospectiveArticle ?"Rückblick aktualisieren" : "Rückblick erstellen"}</button>
        ${retrospectiveArticle ?`<a class="button button--secondary button--small" href="#/cms/edit?module=editorialContent&id=${escapeHtml(retrospectiveArticle.id)}&section=press">Beitrag öffnen</a>` : ""}
      </div>
    </div>
    <div id="event-retrospective-result" class="muted">${retrospectiveArticle ?`Verknüpfter Beitrag: ${escapeHtml(retrospectiveArticle.title || retrospectiveArticle.id)}` : "Noch kein redaktioneller Rückblick zu diesem Event vorhanden."}</div>
    <input type="hidden" data-retrospective-article-id value="${escapeHtml(retrospectiveArticleId)}">
  </section>`;
  if (tab === "post" && retrospectiveArticle) {
    event = {
      ...event,
      postEventSummary: event.postEventSummary || event.postEventummary || retrospectiveArticle.introText || retrospectiveArticle.subtitle || "",
      longDescription: event.longDescription || event.bodyText || event.articleText || event.archiveText || retrospectiveArticle.longDescription || retrospectiveArticle.bodyText || retrospectiveArticle.articleText || retrospectiveArticle.archiveText || ""
    };
  }
  let content;
  if (tab === "base") {
    content = `<form id="event-edit-form" data-event-id="${event.id}" class="form-grid is-save-aware event-base-form"><div class="field"><label>Titel</label><input name="title" value="${escapeHtml(event.title)}" required></div><div class="field"><label>Untertitel</label><input name="subtitle" value="${escapeHtml(event.subtitle)}"></div><div class="field"><div class="field-label-row"><label>Beschreibung</label>${aiButton("improveText", "description", "Mit ChatGPT bearbeiten", { entityId: event.id, fieldName: "description" })}</div><textarea name="description">${escapeHtml(event.description)}</textarea></div><div class="form-grid--four"><div class="field"><label>Location</label><input name="locationName" value="${escapeHtml(event.locationName || "")}"></div><div class="field"><label>Straße / Nr.</label><input name="address" value="${escapeHtml(event.address || "")}"></div><div class="field"><label>PLZ</label><input name="postalCode" value="${escapeHtml(event.postalCode || event.zipCode || "")}"></div><div class="field"><label>Stadt</label><input name="city" value="${escapeHtml(event.city || "")}"></div></div><div class="form-grid--four"><div class="field"><label>Datum</label><input type="date" name="date" value="${event.date}"></div><div class="field"><label>Beginn</label><input type="time" name="startTime" value="${event.startTime}"></div><div class="field"><label>Ende</label><input type="time" name="endTime" value="${event.endTime}"></div><div class="field"><label>Ablauf</label><input type="datetime-local" name="expiresAt" value="${event.expiresAt ?event.expiresAt.slice(0, 16) : ""}"></div></div><div class="form-grid--two"><div class="event-base-form__event-type-stack">${eventTypePicker}<div class="field field--nested" data-new-event-type-field hidden><label>Neuer Eventtyp</label><input name="newEventType" placeholder="z. B. Fachgespräch"></div></div>${accessTypePicker}${primaryHostPicker}${coHostPicker}${eventImageEditor(event, mediaAssets, `#/cms/event/${event.id}?tab=base`)}</div>${hostCreateLayer}<div class="actions"><button class="button button--primary">Event speichern</button>${id !== "new" ?`<button type="button" class="button button--secondary" data-delete-event="${event.id}">Event loeschen</button>` : ""}</div><div id="event-save-result"></div></form>`;
    if (isPastCmsEvent(event)) {
      content = content
        .replace(`<div class="field"><label>Telefon Location</label><input name="phone" value="${escapeHtml(event.phone || "")}"></div>`, "")
        .replace(`<div class="field"><label>Ablaufdatum / automatisch ausblenden</label><input type="datetime-local" name="expiresAt" value="${event.expiresAt ?event.expiresAt.slice(0, 16) : ""}"></div>`, "")
        .replace(`<div class="field"><label>Zugangsart</label><select name="accessType">${Object.entries(accessLabels).map(([key, value]) => `<option value="${key}" ${key === event.accessType ?"selected" : ""}>${value}</option>`).join("")}</select></div>`, "")
        .replace(`<div class="field"><label>Lifecycle</label><select name="lifecyclePhase">${Object.entries(lifecycleLabels).map(([key, value]) => `<option value="${key}" ${key === event.lifecyclePhase ?"selected" : ""}>${value}</option>`).join("")}</select></div>`, "");
    }
  } else if (tab === "topics") {
    content = eventTopicsEditor(event, topics, speakers, allEvents, galleries, downloads, mediaAssets, query, sponsors, members);
  } else if (tab === "__old_topics") {
    content = `<h2>Zugeordnete Themen</h2><div class="filters">${topics.map((topic) => `<span class="filter ${event.topicIds.includes(topic.id) ?"active" : ""}">${escapeHtml(topic.title)}</span>`).join("")}</div><p>Themenspezifische Beschreibung und Sortierung koennen hier redaktionell erweitert werden.</p><div class="table-wrap" style="margin-top:22px"><table class="table"><thead><tr><th>Thema</th><th>Referenten</th></tr></thead><tbody>${topics.filter((topic) => event.topicIds.includes(topic.id)).map((topic) => { const topicSpeakers = speakers.filter((speaker) => speaker.topicId === topic.id || (event.speakerIds || []).includes(speaker.id)); return `<tr><td>${escapeHtml(topic.title)}</td><td>${topicSpeakers.length ?topicSpeakers.map((speaker) => `<div class="person"><div>${speaker.photoUrl ?`<img src="${escapeHtml(speaker.photoUrl)}" alt="">` : ""}</div><div><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml([speaker.company, speaker.position].filter(Boolean).join(" · "))}</small>${speaker.shortBio ?`<p>${escapeHtml(speaker.shortBio)}</p>` : ""}</div></div>`).join("") : "Noch kein Referent zugeordnet."}</td></tr>`; }).join("")}</tbody></table></div>`;
  } else if (tab === "speakers") {
    const assignedSpeakers = speakers.filter((item) => (event.speakerIds || []).includes(item.id));
    content = `<h2>Referenten im Eventkontext</h2><form id="event-speakers-form" data-event-id="${event.id}" class="form-grid"><div class="selection-grid">${speakers.length ?speakers.map((speaker) => `<label class="selection-item"><input type="checkbox" name="speakerIds" value="${speaker.id}" ${(event.speakerIds || []).includes(speaker.id) ?"checked" : ""}><span><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml(speaker.position || speaker.company || "")}</small></span>${status(speaker.status || "draft")}</label>`).join("") : `<div class="alert">Noch keine Referenten angelegt. Bitte zuerst im Bereich Referenten ein Profil mit Foto und Vita erstellen.</div>`}</div><div class="actions"><button class="button button--primary">Zuordnung speichern</button><a class="button button--secondary" href="#/cms/speakers">Referentenprofile verwalten</a></div><div id="speaker-assignment-result"></div></form>${assignedSpeakers.length ?`<div class="table-wrap" style="margin-top:24px"><table class="table"><thead><tr><th>Zugeordnet</th><th>Unternehmen</th><th>Profil</th></tr></thead><tbody>${assignedSpeakers.map((speaker) => `<tr><td>${escapeHtml(speaker.name)}</td><td>${escapeHtml(speaker.company || "-")}</td><td>${speaker.photoUrl ?"Foto vorhanden" : "Foto fehlt"} · ${speaker.shortBio || speaker.longBio ?"Vita vorhanden" : "Vita fehlt"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
  } else if (tab === "partners") {
    content = eventPartnersEditor(event, sponsors, mediaAssets);
  } else if (tab === "registration") {
    const assigned = registrations.filter((item) => item.eventId === event.id);
    const checkinScreenUrl = `#/event-checkin-screen/${event.id}`;
    const mailAiContextId = `ai-mail-context-${event.id}`;
    const globalMailTemplates = mailTemplateSettings(settings.find((item) => item.id === "mailTemplates" || item.key === "mailTemplates"));
    const registrationMailText = event.mailText || defaultEventRegistrationMailText(event, "confirmation", globalMailTemplates);
    const waitlistMailText = event.waitlistMail || defaultEventRegistrationMailText(event, "waitlist", globalMailTemplates);
    const adminAddRegistrationPanel = `<details class="panel cms-disclosure-panel" style="background:var(--pdt-bg)" open><summary><strong>Person manuell hinzufuegen</strong><span>Admin-Anmeldung</span></summary><form id="admin-registration-form" data-event-id="${event.id}" class="form-grid form-grid--compact"><div class="form-grid--two"><div class="field"><label>Vorname *</label><input name="firstName" autocomplete="given-name" required></div><div class="field"><label>Nachname *</label><input name="lastName" autocomplete="family-name" required></div></div><div class="form-grid--two"><div class="field"><label>Unternehmen</label><input name="company" autocomplete="organization"></div><div class="field"><label>Position / Funktion</label><input name="position" autocomplete="organization-title"></div></div><div class="form-grid--two"><div class="field"><label>E-Mail *</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Telefon</label><input name="phone" autocomplete="tel"></div></div><label class="checkbox checkbox--required"><input type="checkbox" name="privacyAccepted" required> Einwilligung / Datenschutz liegt vor *</label><div class="actions"><button class="button button--primary button--small" type="submit">Person hinzufuegen</button><div id="admin-registration-result"></div></div></form></details>`;
    const registrationsToolbar = `<div class="actions" style="justify-content:space-between;margin-bottom:18px"><h2>Anmeldungen (${assigned.length})</h2><div class="actions"><button class="button button--secondary button--small" data-export-event="${event.id}">Anmeldungen als CSV herunterladen</button><button class="button button--danger button--small" data-delete-selected-registrations data-event-id="${event.id}" disabled>Ausgewaehlte loeschen</button></div></div>`;
    const registrationsTable = `<div id="registration-bulk-result"></div><div class="table-wrap"><table class="table"><thead><tr><th><input type="checkbox" data-registration-select-all aria-label="Alle Anmeldungen auswaehlen"></th><th>Teilnehmer</th><th>Unternehmen</th><th>E-Mail</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${assigned.map((registration) => `<tr data-registration-row="${registration.id}"><td><input type="checkbox" data-registration-select value="${registration.id}" aria-label="Anmeldung von ${escapeHtml([registration.firstName, registration.lastName].filter(Boolean).join(" ") || registration.email || "Teilnehmer")} auswaehlen"></td><td>${escapeHtml([registration.firstName, registration.lastName].filter(Boolean).join(" ") || "-")}</td><td>${escapeHtml(registration.company || "-")}</td><td>${escapeHtml(registration.email || "-")}</td><td>${status(registration.status)}</td><td><div class="table-actions table-actions--icons"><button class="icon-button icon-button--danger" type="button" data-delete-registration="${registration.id}" data-event-id="${event.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`;
    const checkinPanel = `<details class="panel cms-disclosure-panel" style="background:var(--pdt-bg)"><summary><strong>Einlass / Event-QR</strong><span>QR-Code anzeigen</span></summary><p>Diese Seite zeigt den QR-Code, den Teilnehmer vor Ort mit dem Handy scannen.</p><div class="actions"><a class="button button--primary button--small" href="${checkinScreenUrl}" target="_blank" rel="noreferrer">Event-QR oeffnen</a><a class="button button--secondary button--small" href="${checkinScreenUrl}">Event-QR im Browser oeffnen</a></div></details>`;
    const mailPanel = `<details class="panel cms-disclosure-panel" style="background:var(--pdt-bg)"><summary><strong>Mailtexte und Erinnerungen</strong><span>anzeigen / bearbeiten</span></summary><form id="event-edit-form" data-event-id="${event.id}" data-event-form-section="registration" class="form-grid is-save-aware"><p>KI erzeugt Mailtexte mit Platzhaltern und ohne echte Teilnehmerdaten. Der Diff-Layer zeigt den vorhandenen Text und den neuen Vorschlag; gespeichert wird erst nach Uebernehmen.</p><div id="${mailAiContextId}" hidden>${escapeHtml(JSON.stringify({ event, registrations: assigned.slice(0, 3) }))}</div><fieldset class="registration-section registration-section--compact"><legend>Automatische Erinnerungen</legend><div class="registration-consents registration-consents--inline"><label class="checkbox"><input type="checkbox" name="reminder7d" ${event.reminder7d ? "checked" : ""}> 7 Tage vorher</label><label class="checkbox"><input type="checkbox" name="reminder1d" ${event.reminder1d ? "checked" : ""}> 1 Tag vorher</label><label class="checkbox"><input type="checkbox" name="reminder2h" ${event.reminder2h ? "checked" : ""}> 2 Stunden vorher</label><label class="checkbox"><input type="checkbox" name="notifyOnEventChange" ${event.notifyOnEventChange ? "checked" : ""}> Sofort bei Termin- oder Ortsaenderung</label></div></fieldset><div class="field"><label>Bestaetigungsmail</label><textarea name="mailText" rows="10">${escapeHtml(registrationMailText)}</textarea>${aiFieldActions([{ action: "generateRegistrationMailText", target: "mailText", contextTarget: mailAiContextId, label: "Bestaetigungsmail erzeugen", entityId: event.id, fieldName: "mailText" }])}</div><div class="field"><label>Wartelistenmail</label><textarea name="waitlistMail" rows="10">${escapeHtml(waitlistMailText)}</textarea>${aiFieldActions([{ action: "generateRegistrationMailText", target: "waitlistMail", contextTarget: mailAiContextId, label: "Wartelistenmail erzeugen", entityId: event.id, fieldName: "waitlistMail" }])}</div><div class="actions"><button class="button button--primary button--small" type="submit">Mailtexte und Erinnerungen speichern</button></div><div id="event-save-result"></div></form></details>`;
    content = `${eventRegistrationTogglePanel(event)}${adminAddRegistrationPanel}${registrationsToolbar}${registrationsTable}${checkinPanel}${mailPanel}`;
  } else if (tab === "pre") {
    const mailingType = event.mailingType || "save_the_date";
    const saveTheDateText = event.saveTheDateText || `Save the date: ${event.title || "PROdigitalTV Event"} am ${event.date ?formatDate(event.date) : "geplanten Termin"}.`;
    const invitationText = event.invitationText || `Wir laden Sie herzlich zum ${event.title || "PROdigitalTV Event"} ein.`;
    const invitationUpdateText = event.invitationUpdateText || `Update zur Einladung: ${event.title || "PROdigitalTV Event"}.`;
    const mailingTextPanel = (key, label, field, text, aiLabel) => `<div class="field" data-mailing-text-panel="${key}" ${mailingType === key ?"" : "hidden"}><label>${label}</label><textarea name="${field}" rows="10">${escapeHtml(text)}</textarea>${aiFieldActions([{ action: "generateEventInvitation", target: field, label: aiLabel, entityId: event.id, fieldName: field }])}</div>`;
    content = `<h2>Einladung</h2><form id="event-edit-form" data-event-id="${event.id}" data-event-form-section="pre" class="form-grid is-save-aware"><div class="alert">Der Anmeldestatus wird zentral im Reiter Anmeldung geoeffnet oder geschlossen. Dieser Bereich speichert die Einladungstexte.</div><div class="field"><label>Mailing-Art</label><select name="mailingType" data-mailing-type-select><option value="save_the_date" ${mailingType === "save_the_date" ?"selected" : ""}>Save the date</option><option value="invitation" ${mailingType === "invitation" ?"selected" : ""}>Einladung</option><option value="invitation_update" ${mailingType === "invitation_update" ?"selected" : ""}>Einladungsupdate</option></select></div>${mailingTextPanel("save_the_date", "Save-the-date-Text", "saveTheDateText", saveTheDateText, "Save-the-date Vorschlag erzeugen")}${mailingTextPanel("invitation", "Einladungstext", "invitationText", invitationText, "Einladungsvorschlag erzeugen")}${mailingTextPanel("invitation_update", "Einladungsupdate", "invitationUpdateText", invitationUpdateText, "Update-Vorschlag erzeugen")}<div class="actions"><button class="button button--primary">Einladung speichern</button></div><div id="event-save-result"></div></form>`;
  } else if (tab === "ai") {
    const eventMedia = media.filter((item) => item.eventId === event.id);
    content = `<h2>KI-Prüfung</h2><p class="muted" style="margin-bottom:18px">Diese Prüfung erzeugt redaktionelle Empfehlungen. Blocker kommen weiterhin aus der regelbasierten Pipeline-Validierung.</p><div class="ai-quality-card"><button type="button" class="button button--primary ai-action" data-ai-action="analyzeEventPipelineQuality" data-ai-target="ai-quality-context" data-ai-entity-type="event" data-ai-entity-id="${event.id}" data-ai-field="pipelineQuality">Pipeline mit ChatGPT prüfen</button><div id="ai-quality-context" hidden>${escapeHtml(JSON.stringify({ event, media: eventMedia }))}</div></div><div class="setup-steps" style="margin-top:20px"><div class="setup-step"><span>Pflichtfelder fehlen?</span><strong>${event.title && event.date && event.locationName ?"ok" : "prüfen"}</strong></div><div class="setup-step"><span>SEO-Daten vorhanden?</span><strong>${event.seoTitle && event.seoDescription ?"ok" : "Empfehlung"}</strong></div><div class="setup-step"><span>Alt-Texte bei Bildern?</span><strong>${eventMedia.some((item) => !item.altText) ?"Empfehlung" : "ok"}</strong></div></div>`;
  } else {
    const assigned = media.filter((item) => item.eventId === event.id);
    content = `<h2>${tab === "post" ?"Event-Nacharbeit" : "Medien zum Event"}</h2>${tab === "post" ?`<section class="panel" style="background:var(--pdt-bg)"><h2>Event-Nachlauf mit KI</h2>${aiFieldActions([{ action: "generateArchiveText", target: "longDescription", label: "Nachbericht erzeugen", entityId: event.id, fieldName: "archiveText" }, { action: "generateEventSummary", target: "postEventSummary", label: "Kurztext erzeugen", entityId: event.id, fieldName: "postEventSummary" }])}</section>` : `<section class="panel" style="background:var(--pdt-bg)"><h2>Fotogalerie und Downloads mit KI</h2><p>Galerie und Downloads bleiben optional. Wenn keine Bilder oder Downloads vorhanden sind, entsteht kein Pflichtfehler.</p>${aiFieldActions([{ action: "generateGalleryIntro", target: "ai-media-context", label: "Galerie-Einleitung", entityId: event.id, fieldName: "galleryIntro" }, { action: "generateImageAltText", target: "ai-media-context", label: "Alt-Texte vorbereiten", entityId: event.id, fieldName: "altTexts" }, { action: "generateDownloadDescription", target: "ai-media-context", label: "Downloadbeschreibung", entityId: event.id, fieldName: "downloadDescription" }])}<div id="ai-media-context" hidden>${escapeHtml(JSON.stringify({ event, media: assigned }))}</div></section>`}${tab === "post" ?`${retrospectiveControl}<form id="event-edit-form" data-event-id="${event.id}" class="form-grid" style="margin-bottom:22px"><div class="field"><label>Nachbericht Kurztext</label><textarea name="postEventSummary">${escapeHtml(event.postEventSummary || event.postEventummary || "")}</textarea></div><div class="field"><label>Langtext / Rückblicktext</label><textarea name="longDescription">${escapeHtml(event.longDescription || event.bodyText || event.articleText || event.archiveText || "")}</textarea><p class="muted">Dieser Text wird als Langtext für den redaktionellen Rückblick verwendet.</p></div><div class="actions"><button class="button button--primary button--small">Rückblicktext speichern</button></div><div id="event-save-result"></div></form>` : ""}<form id="media-upload-form" data-event-id="${event.id}" class="upload"><p><strong>Fotos, PDFs oder Praesentationen hochladen</strong></p><p>Drag-and-drop oder Dateiauswahl; Inhalte bleiben bis zur Freigabe intern.</p><input type="file" name="files" multiple style="margin-top:17px"><button class="button button--primary button--small" type="submit" style="margin:15px auto 0">Upload starten</button><div id="upload-result"></div></form><div class="table-wrap"><table class="table"><thead><tr><th>Datei</th><th>Typ</th><th>Sichtbarkeit</th><th>Freigabe</th><th>Aktionen</th></tr></thead><tbody>${assigned.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.mediaType}</td><td>${item.visibility}</td><td>${status(item.status)}</td><td><div class="table-actions"><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="approved">Aktiv</button><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="archived">Inaktiv</button><button class="link-button link-button--danger" data-delete-record="eventMedia" data-record-id="${item.id}">Loeschen</button></div></td></tr>`).join("")}</tbody></table></div>`;
  }
  if (tab === "post") {
    const assigned = media.filter((item) => item.eventId === event.id);
    const selectedGallery = event.galleryId
      ?galleries.find((gallery) => gallery.id === event.galleryId)
      : galleries.find((gallery) => gallery.eventId === event.id && gallery.status !== "archived") || null;
    const selectedGalleryId = event.galleryId || selectedGallery?.id || "";
    const selectedGalleryPreview = selectedGallery
      ?`<div class="editor-gallery-preview" data-editor-gallery-preview>
          <div>
            <strong>${escapeHtml(selectedGallery.title || "Bildergalerie")}</strong>
            <span>${(selectedGallery.images || []).length} Bilder</span>
          </div>
          ${galleryPlayerButton(selectedGallery, "Galerie abspielen")}
        </div>`
      : `<div class="editor-gallery-preview editor-gallery-preview--empty" data-editor-gallery-preview><p class="muted">Keine Galerie verknuepft. Galerie auswaehlen und speichern, um sie mit dem Rueckblick zu verbinden.</p></div>`;
    const postTitleValue = event.retrospectiveTitle || retrospectiveArticle?.title || `Rückblick: ${event.title || "PROdigitalTV Event"}`;
    const postSummaryValue = event.postEventSummary || event.postEventummary || retrospectiveArticle?.introText || retrospectiveArticle?.subtitle || "";
    const postLongValue = event.longDescription || event.bodyText || event.articleText || event.archiveText || retrospectiveArticle?.longDescription || retrospectiveArticle?.bodyText || retrospectiveArticle?.articleText || retrospectiveArticle?.archiveText || "";
    const retrospectiveAudioTool = retrospectiveArticle
      ?audioGenerationPanel("editorialContent", retrospectiveArticle, { variant: "accessible", providerConfig: audioProviders })
      : `<p class="muted">Bitte zuerst den Rückblicktext speichern. Danach wird der redaktionelle Rückblick-Beitrag angelegt und die Vorlesfunktion ist hier verfügbar.</p>`;
    const retrospectiveVideoTool = retrospectiveArticle
      ?articleVideoAttachmentEditor(retrospectiveArticle, videoLibrary)
      : `<details class="editorial-tool-details" data-editor-tool-panel="videos"><summary><span>Medien</span><strong>Videoanhaenge</strong><em>optional</em></summary><div class="editor-tool-section editor-tool-section--videos"><p class="muted">Bitte zuerst den Rückblicktext speichern. Danach wird der redaktionelle Rückblick-Beitrag angelegt und Videos koennen am Beitrag angehaengt werden.</p></div></details>`;
    content = `<h2>Event-Nacharbeit</h2>
      <section class="panel event-post-ai-panel" style="background:var(--pdt-bg)">
        ${aiFieldActions([{ action: "generateArchiveText", target: "longDescription", label: "Nachbericht erzeugen", entityId: event.id, fieldName: "archiveText" }, { action: "generateEventSummary", target: "postEventSummary", label: "Kurztext erzeugen", entityId: event.id, fieldName: "postEventSummary" }])}
      </section>
      <form id="event-edit-form" data-event-id="${event.id}" data-event-form-section="post" class="form-grid is-save-aware event-post-workspace" style="margin-bottom:22px">
        <input type="hidden" data-retrospective-article-id value="${escapeHtml(retrospectiveArticleId)}">
        <div class="event-post-workspace__main">
          <div class="editorial-workflow-actions event-post-workflow-actions">
            <button class="button button--secondary button--small" type="button" data-editor-tool-open="image">Bild</button>
            <button class="button button--secondary button--small" type="button" data-editor-tool-open="audio">Audio</button>
            <button class="button button--secondary button--small" type="button" data-editor-tool-open="gallery">Galerie</button>
            <button class="button button--secondary button--small" type="button" data-editor-tool-open="videos">Video</button>
            <button class="button button--secondary button--small" type="button" data-editor-tool-open="upload">Upload</button>
          </div>
          <div class="field"><label>Headline Rückblick</label><input name="retrospectiveTitle" value="${escapeHtml(postTitleValue)}"></div>
          <div class="field"><label>Nachbericht Kurztext</label><textarea name="postEventSummary">${escapeHtml(postSummaryValue)}</textarea></div>
          <div class="field"><label>Langtext / Rückblicktext</label><textarea name="longDescription">${escapeHtml(postLongValue)}</textarea><p class="muted">Dieser Text wird als Langtext für den redaktionellen Rückblick verwendet.</p></div>
          <div class="actions"><button class="button button--primary button--small">Rückblicktext speichern</button></div><div id="event-save-result"></div>
        </div>
        <aside class="event-post-toolbox">
          <details class="editorial-tool-details" data-editor-tool-panel="image">
            <summary><span>Medien</span><strong>Bild / Thumb</strong></summary>
            <div class="editor-tool-section editor-tool-section--thumb">${eventImageEditor(event, mediaAssets, `#/cms/event/${event.id}?tab=post`)}</div>
          </details>
          <details class="editorial-tool-details" data-editor-tool-panel="audio">
            <summary><span>Audio</span><strong>Vorlesen</strong></summary>
            <div class="editor-tool-section editor-tool-section--audio">${retrospectiveAudioTool}</div>
          </details>
          <details class="editorial-tool-details" data-editor-tool-panel="gallery">
            <summary><span>Medien</span><strong>Galerie</strong>${selectedGallery ?`<small class="editorial-tool-state editorial-tool-state--ready">${escapeHtml(selectedGallery.title || "Galerie")}</small>` : `<small class="editorial-tool-state">Keine Galerie</small>`}</summary>
            <div class="editor-tool-section editor-tool-section--gallery">
              <div class="field"><label>Bildergalerie</label><select name="galleryId">${galleryOptions}</select><p class="muted">Die Galerie wird mit dem Event und dem spaeteren Rueckblick verbunden.</p></div>
              ${galleryChoiceList(availableGalleries, selectedGalleryId)}
              ${selectedGalleryPreview}
              <div class="tool-button-row">
                ${eventGalleryCreateButton}
                ${galleryManageButton}
              </div>
              <div class="tool-button-row">
                <button class="button button--secondary button--small" type="button" data-save-gallery-link>Galerie verknuepfen</button>
                <button class="icon-button icon-button--danger" type="button" data-clear-linked-media="gallery" title="Galerie-Verknuepfung loesen" aria-label="Galerie-Verknuepfung loesen">${iconImage("trash")}</button>
              </div>
              <div class="gallery-link-result" data-gallery-link-result></div>
            </div>
          </details>
          ${retrospectiveVideoTool}
          <details class="editorial-tool-details" data-editor-tool-panel="upload">
            <summary><span>Medien</span><strong>Dateien hochladen</strong><em>Fotos, PDFs, Praesentationen</em></summary>
            <div class="editor-tool-section editor-tool-section--upload">
              <p class="muted">Drag-and-drop oder Dateiauswahl; Inhalte bleiben bis zur Freigabe intern.</p>
              <input type="file" name="files" multiple form="media-upload-form">
              <button class="button button--primary button--small" type="submit" form="media-upload-form">Upload starten</button>
              <div id="upload-result"></div>
            </div>
          </details>
        </aside>
      </form>
      <form id="media-upload-form" data-event-id="${event.id}" class="event-post-hidden-upload-form"></form>
      <div class="table-wrap"><table class="table"><thead><tr><th>Datei</th><th>Typ</th><th>Sichtbarkeit</th><th>Freigabe</th><th>Aktionen</th></tr></thead><tbody>${assigned.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.mediaType}</td><td>${item.visibility}</td><td>${status(item.status)}</td><td><div class="table-actions"><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="approved">Aktiv</button><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="archived">Inaktiv</button><button class="link-button link-button--danger" data-delete-record="eventMedia" data-record-id="${item.id}">Loeschen</button></div></td></tr>`).join("")}</tbody></table></div>`;
  }
  const activeSection = isPastCmsEvent(event) ?"cms/followup" : "cms/events";
  return protect(cmsShell(activeSection, `${cmsTitle("Event bearbeiten", escapeHtml(event.title || "Neues Event"), `<a class="button button--secondary button--small" href="#/event/${event.id}?preview=1">Vorschau</a>`)}<section class="panel">${eventTabs(event.id, tab)}${content}</section>`));
}

export async function registrationsPage() {
  if (!hasCmsAccess()) return denied();
  const [registrations, events] = await Promise.all([list("registrations"), list("events")]);
  return protect(cmsShell("cms/registrations", `${cmsTitle("Teilnehmermanagement", "Anmeldungen")}<section class="panel"><div class="field" style="max-width:390px;margin-bottom:18px"><label>Event auswaehlen</label><select>${events.map((event) => `<option>${escapeHtml(event.title)}</option>`).join("")}</select></div><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Event</th><th>Bestaetigung</th><th>Mailstatus</th></tr></thead><tbody>${registrations.map((record) => `<tr><td>${record.firstName} ${record.lastName}</td><td>${record.eventTitle}</td><td>${status(record.status)}</td><td>${status(record.mailStatus)}</td></tr>`).join("")}</tbody></table></div></section>`));
}

export async function eventNotificationsPage() {
  if (!hasCmsAccess()) return denied();
  const [events, notifications, members] = await Promise.all([
    list("events"),
    list("eventNotifications").catch(() => []),
    list("members").catch(() => [])
  ]);
  const activeEvents = events
    .filter((event) => !["archived", "deleted", "inactive", "draft"].includes(String(event.status || "").toLowerCase()) && !isPastCmsEvent(event))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const firstEvent = activeEvents[0] || {};
  const publicBaseUrl = "https://prodigitaltv-da47b.web.app";
  const eventLink = firstEvent.id ? `${publicBaseUrl}/event/${firstEvent.id}?v=943` : "";
  const rows = notifications
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 20)
    .map((item) => {
      const event = events.find((candidate) => candidate.id === item.eventId) || {};
      return `<tr><td>${escapeHtml(item.title || "-")}</td><td>${escapeHtml(event.title || item.eventId || "-")}</td><td>${status(item.status || "draft")}</td><td>${escapeHtml(String(item.targetCount ?? "-"))}</td><td>${escapeHtml(String(item.queuedMailCount ?? "-"))}</td></tr>`;
    }).join("");
  const testMembers = members
    .slice()
    .sort((a, b) => String(a.name || a.company || a.title || "").localeCompare(String(b.name || b.company || b.title || "")))
    .map((member) => {
      const label = member.name || member.company || member.title || member.id;
      const email = member.email || member.contactEmail || member.primaryEmail || "";
      const checked = member.notificationTestGroup || member.isNotificationTestGroup || member.testGroup;
      return `<label class="checkbox notification-test-group-item"><input type="checkbox" name="memberIds" value="${escapeHtml(member.id)}" ${checked ?"checked" : ""}><span><strong>${escapeHtml(label)}</strong>${email ?`<small>${escapeHtml(email)}</small>` : ""}</span></label>`;
    }).join("");
  return protect(cmsShell("cms/event-notifications", `${cmsTitle("Kommunikation", "Event-Benachrichtigungen")}
    <section class="panel">
      <form id="event-notification-form" class="form-grid">
        <div class="form-grid--two">
          <div class="field"><label>Art</label><select name="notificationKind" data-notification-kind><option value="event">Event-Benachrichtigung</option><option value="member_message">Mitglieder-Nachricht</option></select></div>
          <div class="field"><label>Versand</label><select name="sendMode" data-notification-send-mode><option value="now">Sofort</option><option value="scheduled">Geplant</option><option value="auto_before_event">Automatisch vor Veranstaltung</option></select></div>
        </div>
        <div class="field" data-notification-event-field><label>Veranstaltung</label><select name="eventId" data-notification-event-select required>${activeEvents.map((event) => `<option value="${escapeHtml(event.id)}" data-event-title="${escapeHtml(event.title || "")}" data-event-link="${publicBaseUrl}/event/${escapeHtml(event.id)}?v=943">${escapeHtml(event.title || event.id)}</option>`).join("")}</select>${activeEvents.length ? "" : `<p class="muted">Keine aktive zukuenftige Veranstaltung vorhanden.</p>`}</div>
        <div class="form-grid--two">
          <div class="field"><label>Empfaenger</label><select name="recipientGroup" data-notification-recipient-group><option value="members_contacts">Mitglieder und Kontakte</option><option value="members">Nur Mitglieder</option><option value="contacts">Nur Kontakte</option><option value="test_group">Testgruppe</option><option value="test_person">Testpersonen</option></select></div>
          <div class="field"><label>Anmeldestatus</label><select name="registrationStatus"><option value="all">Alle</option><option value="unregistered">Noch nicht angemeldet</option><option value="registered">Bereits angemeldet</option></select></div>
        </div>
        <input type="hidden" name="includeMembers" value="true" data-notification-include-members>
        <input type="hidden" name="includeContacts" value="true" data-notification-include-contacts>
        <div class="form-grid--two">
          <div class="field" data-notification-scheduled-field hidden><label>Geplanter Zeitpunkt</label><input type="datetime-local" name="scheduledAt"></div>
          <div class="field" data-notification-offset-field hidden><label>Automatisch vor Veranstaltung</label><select name="offsetMinutes"><option value="10080">7 Tage vorher</option><option value="1440">1 Tag vorher</option><option value="120">2 Stunden vorher</option></select></div>
        </div>
        <div class="field"><label>Titel</label><input name="title" data-notification-title value="${escapeHtml(firstEvent.title ? `Einladung: ${firstEvent.title}` : "Einladung zur Veranstaltung")}" required></div>
        <div class="field"><label>Kurztext</label><textarea name="shortText" rows="4" data-notification-shorttext>${escapeHtml(firstEvent.title ? `Aktuelle Informationen zur Veranstaltung ${firstEvent.title}.` : "Aktuelle Informationen zur PROdigitalTV-Veranstaltung.")}</textarea></div>
        <section class="panel" style="background:var(--pdt-bg)">
          <label class="checkbox"><input type="checkbox" name="linkEnabled" data-notification-link-toggle checked> Link mitsenden</label>
          <div class="field"><label>Link optional</label><input name="link" data-notification-link value="${escapeHtml(eventLink)}" placeholder="https://... oder leer lassen"></div>
        </section>
        <div class="registration-section registration-section--compact" data-notification-test-field hidden>
          <div class="field"><label>Testpersonen</label><textarea name="testRecipients" rows="3" placeholder="E-Mail-Adressen, getrennt durch Komma oder neue Zeile"></textarea><p class="muted">Im Testmodus wird nur an diese Adressen gesendet. Zielgruppen und Anmeldestatus bleiben unberuehrt.</p></div>
        </div>
        <div class="event-notification-preview" data-notification-preview>
          <p class="eyebrow">Live-Vorschau</p>
          <h3>${escapeHtml(firstEvent.title ? `Einladung: ${firstEvent.title}` : "Einladung zur Veranstaltung")}</h3>
          <p>${escapeHtml(firstEvent.title ? `Aktuelle Informationen zur Veranstaltung ${firstEvent.title}.` : "Aktuelle Informationen zur PROdigitalTV-Veranstaltung.")}</p>
          <a href="${escapeHtml(eventLink)}">Zur Veranstaltung</a>
        </div>
        <div class="actions"><button class="button button--primary">Versand starten</button><div id="event-notification-result"></div></div>
      </form>
    </section>
    <section class="panel">
      <details class="cms-disclosure-panel">
        <summary><strong>Testgruppe bearbeiten</strong><span>${members.filter((member) => member.notificationTestGroup || member.isNotificationTestGroup || member.testGroup).length} ausgewaehlt</span></summary>
        <form id="notification-test-group-form" class="notification-test-group-form">
          <p class="muted">Diese Mitglieder werden verwendet, wenn bei einer Benachrichtigung als Empfaenger <strong>Testgruppe</strong> gewaehlt ist.</p>
          <div class="notification-test-group-list">${testMembers || `<p class="muted">Noch keine Mitglieder vorhanden.</p>`}</div>
          <div class="actions"><button class="button button--secondary button--small">Testgruppe speichern</button><div id="notification-test-group-result"></div></div>
        </form>
      </details>
    </section>
    <section class="panel">
      <h2>Letzte Benachrichtigungen</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Titel</th><th>Event</th><th>Status</th><th>Empfaenger</th><th>E-Mail</th></tr></thead><tbody>${rows || `<tr><td colspan="5">Noch keine Benachrichtigungen erstellt.</td></tr>`}</tbody></table></div>
    </section>`));
}

export async function memberAreaAdminPage() {
  return moduleListPage("editorialContent", "member-area");
}

export async function mailAdminPage() {
  if (!hasCmsAccess(true)) return denied(true);
  const templates = mailTemplateSettings(await getOne("settings", "mailTemplates").catch(() => null));
  const pushSettings = browserPushSettings(await getOne("settings", "browserPush").catch(() => null));
  return protect(cmsShell("cms/mail-admin", `${cmsTitle("Mail", "Mail-Verwaltung")}
    <section class="panel">
      <h2>Verbindung zum Mailservice</h2>
      <div class="form-grid form-grid--two">
        <div class="field"><label>API-Basis</label><input id="mail-admin-base-url" value="/mail-api" placeholder="/mail-api"></div>
        <div class="field"><label>Admin Token</label><input id="mail-admin-token" type="password" autocomplete="off" placeholder="ADMIN_API_TOKEN"></div>
      </div>
      <div class="actions" style="margin-top:16px"><button class="button button--secondary button--small" type="button" data-mail-admin-load>Accounts und Templates laden</button><span id="mail-admin-connection-result"></span></div>
      <p class="muted" style="margin-top:12px">Der Token wird nur in dieser Browser-Sitzung gespeichert. Produktiv kommt der PHP-Mailservice ueber Firebase Hosting unter <code>/mail-api</code>.</p>
    </section>
    <section class="panel">
      <h2>Browser-Push</h2>
      <p class="muted">Hier wird der oeffentliche Firebase Web-Push-Zertifikatsschluessel gespeichert. Danach kann die Webapp auf dem Geraet ein FCM-Token erzeugen.</p>
      <form id="browser-push-settings-form" class="form-grid">
        <div class="field"><label>VAPID Public Key</label><input name="vapidPublicKey" autocomplete="off" value="${escapeHtml(pushSettings.vapidPublicKey)}" placeholder="Firebase Console > Cloud Messaging > Web Push-Zertifikate"></div>
        <button class="button button--primary">Browser-Push speichern</button><div id="browser-push-settings-result"></div>
      </form>
    </section>
    <section class="panel">
      <h2>Standardtexte Event-Anmeldung</h2>
      <p class="muted">Diese Texte gelten fuer alle Events. Im Event-Reiter Anmeldung nur dann individuell ueberschreiben, wenn der Text fuer genau diese Veranstaltung abweichen soll.</p>
      <form id="mail-default-templates-form" class="form-grid">
        <div class="field"><label>Bestaetigungsmail Standard</label><textarea name="registrationConfirmation" rows="11">${escapeHtml(templates.registrationConfirmation)}</textarea></div>
        <div class="field"><label>Wartelistenmail Standard</label><textarea name="registrationWaitlist" rows="9">${escapeHtml(templates.registrationWaitlist)}</textarea></div>
        <p class="muted">Platzhalter: <code>{{firstName}}</code>, <code>{{lastName}}</code>, <code>{{eventTitle}}</code>, <code>{{eventDate}}</code>, <code>{{eventLocation}}</code>. Links und Buttons werden vom System ergaenzt.</p>
        <button class="button button--primary">Standardtexte speichern</button><div id="mail-default-templates-result"></div>
      </form>
    </section>
    <section class="panel">
      <h2>Mailaccount anlegen</h2>
      <form id="mail-account-form" class="form-grid">
        <div class="form-grid--two"><div class="field"><label>Kunden-ID *</label><input name="id" placeholder="kunde-a" required></div><div class="field"><label>Anzeigename *</label><input name="label" placeholder="Kunde A" required></div></div>
        <div class="form-grid--two"><div class="field"><label>SMTP Host *</label><input name="smtpHost" placeholder="smtp.example.com" required></div><div class="field"><label>SMTP Port *</label><input name="smtpPort" type="number" value="587" required></div></div>
        <div class="form-grid--two"><div class="field"><label>SMTP Benutzer *</label><input name="smtpUser" placeholder="mail@example.com" required></div><div class="field"><label>SMTP Passwort</label><input name="smtpPass" type="password" placeholder="neu setzen oder leer lassen"></div></div>
        <div class="form-grid--two"><div class="field"><label>Absender E-Mail *</label><input name="fromEmail" type="email" required></div><div class="field"><label>Absender Name</label><input name="fromName" placeholder="Kunde A"></div></div>
        <button class="button button--primary">Mailaccount speichern</button><div id="mail-account-result"></div>
      </form>
      <div id="mail-accounts-list" class="setup-steps" style="margin-top:18px"></div>
    </section>
    <section class="panel">
      <h2>Mailtemplate anlegen</h2>
      <form id="mail-template-form" class="form-grid">
        <div class="form-grid--two"><div class="field"><label>Template-ID *</label><input name="id" placeholder="kunde-a-kontakt" required></div><div class="field"><label>Mailaccount *</label><select name="accountId" required><option value="">Bitte zuerst Accounts laden</option></select></div></div>
        <div class="field"><label>Template-Name *</label><input name="label" placeholder="Kontaktformular" required></div>
        <div class="field"><label>Betreff *</label><input name="subject" placeholder="Neue Anfrage von {{name}}" required></div>
        <div class="field"><label>Text-Mail</label><textarea name="textBody" placeholder="Name: {{name}}\nFirma: {{company}}\n\n{{message}}"></textarea></div>
        <div class="field"><label>HTML-Mail</label><textarea name="htmlBody" placeholder="<p>Name: {{name}}</p><p>{{message}}</p>"></textarea></div>
        <button class="button button--primary">Template speichern</button><div id="mail-template-result"></div>
      </form>
      <div id="mail-templates-list" class="setup-steps" style="margin-top:18px"></div>
    </section>
    <section class="panel">
      <h2>Testversand</h2>
      <form id="mail-test-form" class="form-grid">
        <div class="form-grid--two"><div class="field"><label>Account</label><select name="accountId" required><option value="">Bitte zuerst Accounts laden</option></select></div><div class="field"><label>Template</label><select name="templateId" required><option value="">Bitte zuerst Templates laden</option></select></div></div>
        <div class="form-grid--two"><div class="field"><label>Empfaenger *</label><input name="to" type="email" required></div><div class="field"><label>Reply-To</label><input name="replyTo" type="email"></div></div>
        <div class="field"><label>Variablen als JSON</label><textarea name="variablesJson">{ "name": "Test", "company": "PROdigitalTV", "message": "Testnachricht" }</textarea></div>
        <button class="button button--secondary">Testmail senden</button><div id="mail-test-result"></div>
      </form>
    </section>`), true);
}

const editorialSections = {
  all: {
    active: "cms/editorial/press",
    title: "Presse",
    itemLabel: "Pressemeldung",
    route: "cms/editorial/press",
    createParams: "&page=press&section=pressRelease",
    filter: (item) => isPressEditorialItem(item)
  },
  press: {
    active: "cms/editorial/press",
    title: "Presse",
    itemLabel: "Pressemeldung",
    route: "cms/editorial/press",
    createParams: "&page=press&section=pressRelease",
    filter: (item) => isPressEditorialItem(item)
  },
  news: {
    active: "cms/editorial/news",
    title: "News",
    itemLabel: "News",
    route: "cms/editorial/news",
    createParams: "&page=news&section=news",
    filter: (item) => isNewsEditorialItem(item)
  },
  "member-area": {
    active: "cms/editorial/member-area",
    title: "Mitgliederbeiträge",
    itemLabel: "Mitgliederbeitrag",
    route: "cms/editorial/member-area",
    createParams: "&page=member-area&section=member-area&visibility=members",
    filter: (item) => isMemberAreaEditorialItem(item)
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

function isMemberAreaEditorialItem(item = {}) {
  return item.page === "member-area"
    || item.section === "member-area"
    || item.visibility === "members"
    || item.publication_target === "member-area"
    || item.publicationTarget === "member-area";
}

function isPressEditorialItem(item = {}) {
  if (isMemberAreaEditorialItem(item)) return false;
  if (isEventRetrospectiveAudioItem(item)) return false;
  const category = String(item.category || "").toLowerCase();
  return item.page === "press"
    || item.section === "press"
    || item.section === "pressRelease"
    || item.publication_target === "press"
    || item.publicationTarget === "press"
    || category.includes("presse");
}

function isNewsEditorialItem(item = {}) {
  if (isMemberAreaEditorialItem(item)) return false;
  const category = String(item.category || "").toLowerCase();
  const target = item.publication_target || item.publicationTarget || "";
  if (isPressEditorialItem(item)) return false;
  if (item.page === "news" || item.section === "news") return true;
  if (["news", "daily_news", "monthly_topic", "topic"].includes(target)) return true;
  if (category && !category.includes("presse") && !category.includes("rueckblick") && !category.includes("rückblick")) return true;
  return Boolean(item.author_type === "ai" || item.authorType === "ai" || item.aiGenerated || item.ai_log_json || item.aiLogJson || item.source_snapshot_json || item.sourceSnapshotJson);
}

function isAiGeneratedEditorialItem(item = {}) {
  if (item.generation_origin === "manual_news_import" || item.ai_log_json?.import_flow === "manual_news_import") return false;
  return item.author_type === "ai"
    || item.authorType === "ai"
    || item.aiGenerated === true
    || Boolean(item.source_snapshot_json)
    || Boolean(item.sourceSnapshotJson)
    || Boolean(item.ai_log_json)
    || Boolean(item.aiLogJson)
    || Boolean(item.duplicate_check_json)
    || Boolean(item.final_check_json)
    || Boolean(item.source_status)
    || Boolean(item.duplicate_status)
    || Boolean(item.ai_check_status)
    || Boolean(item.publication_status);
}

function isInternalEditorialItem(item = {}) {
  if (item.section === "download" || String(item.migratedTo || "").startsWith("downloads/")) return false;
  if (isMemberAreaEditorialItem(item)) return false;
  if (isAiGeneratedEditorialItem(item)) return false;
  if (["ueber_uns", "mitglied_werden"].includes(item.bereich)) return true;
  return !["press", "news"].includes(item.page)
    && !["pressRelease", "news"].includes(item.section)
    && (["home", "about", "join", "imprint", "privacy", "legal", "contact", "login", "members", "board"].includes(item.page)
      || ["intro", "hero", "legal", "internal", "footer"].includes(item.section));
}

function internalAreaKey(item = {}) {
  if (item.bereich === "ueber_uns" || item.page === "about" || item.page === "ueber-uns") return "ueber_uns";
  if (item.bereich === "mitglied_werden" || item.page === "join" || item.page === "mitglied-werden") return "mitglied_werden";
  return "sonstiges";
}

function internalAreaLabel(item = {}) {
  const key = internalAreaKey(item);
  if (key === "ueber_uns") return "Über uns";
  if (key === "mitglied_werden") return "Mitglied werden";
  return "Interna";
}

function internalAreaButton(item = {}) {
  const key = internalAreaKey(item);
  return `<button class="internal-area-pill internal-area-pill--${escapeHtml(key)} internal-preview-button" type="button" data-internal-preview="${escapeHtml(item.id || "")}">${escapeHtml(internalAreaLabel(item))}</button>`;
}

function internalTypeLabel(type = "") {
  const labels = {
    hero: "Hero",
    textblock: "Textblock",
    vorteil: "Vorteil",
    eventformat: "Eventformat",
    kachelgruppe: "Kachelgruppe",
    cta: "CTA",
    internal: "Altblock",
    intro: "Intro",
    footer: "Footer",
    legal: "Rechtliches"
  };
  return labels[type] || type || "-";
}

function internalPortalVisibility(item = {}) {
  const area = internalAreaKey(item);
  const managed = item.editorialManaged || ["ueber_uns", "mitglied_werden"].includes(item.bereich);
  const itemStatus = String(item.status || "").toLowerCase();
  const itemVisibility = String(item.sichtbarkeit || item.visibility || "").toLowerCase();
  return managed
    && ["ueber_uns", "mitglied_werden"].includes(area)
    && ["aktiv", "published"].includes(itemStatus)
    && ["oeffentlich", "öffentlich", "public"].includes(itemVisibility);
}

function internalUsageKey(item = {}) {
  if (internalPortalVisibility(item)) return "portal";
  if (item.downloadId || item.download_id || String(item.key || "").startsWith("join.downloadInfo.")) return "download";
  if (String(item.key || "").startsWith("footer.") || item.section === "footer") return "footer";
  if (["imprint", "privacy", "legal"].includes(item.page) || item.section === "legal") return "legal";
  if (["ueber_uns", "mitglied_werden"].includes(item.bereich) || item.editorialManaged) return "hidden";
  return "legacy";
}

function internalUsageLabel(item = {}) {
  const labels = {
    portal: "Portal",
    download: "Download-Info",
    footer: "Footer",
    legal: "Rechtliches",
    hidden: "nicht sichtbar",
    legacy: "Altbestand"
  };
  return labels[internalUsageKey(item)] || "Altbestand";
}

function internalStatusValue(item = {}) {
  const value = String(item.status || "").toLowerCase();
  return ["aktiv", "active", "published", "veroeffentlicht", "veröffentlicht"].includes(value) ?"active" : "inactive";
}

const qualityCollectionNames = [
  "events",
  "editorialContent",
  "topics",
  "members",
  "boardMembers",
  "speakers",
  "sponsors",
  "galleries",
  "eventMedia",
  "media_assets",
  "downloads",
  "memberDocuments",
  "videos"
];

function qualityText(value = "", fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function qualityUrl(value = "") {
  return String(value || "").trim();
}

function qualitySeverityLabel(severity = "warning") {
  return severity === "error" ?status("failed") : status("draft");
}

function qualityStatusLabel(value = "offen") {
  return `<span class="status">${escapeHtml(value)}</span>`;
}

function qualityEditLink(issue = {}) {
  return issue.editHref
    ?`<a class="button button--secondary button--small" href="${escapeHtml(issue.editHref)}">Bearbeiten</a>`
    : `<span class="muted">nicht eindeutig zuordenbar</span>`;
}

function qualityRecordTitle(item = {}) {
  return qualityText(item.title || item.name || item.company || item.fileName || item.id, "Ohne Titel");
}

function qualityIsVisiblePublic(item = {}) {
  const statusValue = String(item.status || "").toLowerCase();
  const visibility = String(item.visibility || item.sichtbarkeit || "").toLowerCase();
  return ["published", "active", "aktiv", "approved"].includes(statusValue)
    && ["public", "oeffentlich", "öffentlich", ""].includes(visibility);
}

function qualityImageUrl(item = {}) {
  return qualityUrl(item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || item.logoUrl || item.photoUrl || item.file_path_web_url || item.file_path_thumb_url || "");
}

function qualityHasAltText(item = {}) {
  return Boolean(
    item.thumbnail_alt
    || item.thumbnailAlt
    || item.imageAlt
    || item.altText
    || item.logoAlt
    || item.posterImageAlt
    || item.title
    || item.headline
    || item.name
    || item.caption
  );
}

function qualityLooksImageUrl(url = "") {
  return /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(url) || /^data:image\//i.test(url);
}

function qualityImageFormat(value = "") {
  const href = qualityNormalizeLink(value).split("?")[0].split("#")[0].toLowerCase();
  if (/^data:image\/([^;,]+)/i.test(value)) return value.match(/^data:image\/([^;,]+)/i)?.[1] || "data";
  const match = href.match(/\.([a-z0-9]+)$/i);
  return match ?match[1].replace("jpeg", "jpg") : "";
}

function qualityAllowedImageFormat(value = "") {
  const format = qualityImageFormat(value);
  if (!format) return false;
  return ["avif", "gif", "jpg", "jpeg", "png", "svg", "webp"].includes(format);
}

function qualityIsImagePath(value = "") {
  return qualityLooksImageUrl(value) || /^blob:/i.test(qualityNormalizeLink(value));
}

function qualityIsAllowedImageStorage(value = "") {
  const href = qualityNormalizeLink(value);
  if (!href) return false;
  if (/^data:image\//i.test(href)) return true;
  if (/^blob:/i.test(href)) return true;
  if (qualityIsInternalAbsoluteUrl(href)) {
    try {
      return qualityIsAllowedImageStorage(new URL(href).pathname);
    } catch {
      return false;
    }
  }
  if (qualityIsExternalUrl(href)) {
    try {
      const host = new URL(href).hostname.toLowerCase();
      return host.includes("firebasestorage.googleapis.com")
        || host.includes("storage.googleapis.com")
        || host.includes("googleusercontent.com")
        || host.includes("img.youtube.com");
    } catch {
      return false;
    }
  }
  return href.startsWith("/assets/") || href.startsWith("/images/") || href.startsWith("assets/") || href.startsWith("images/");
}

function qualityLooksPdfUrl(url = "") {
  return /\.pdf(\?|#|$)/i.test(url) || String(url || "").toLowerCase().includes("application/pdf");
}

function qualityLooksDocumentUrl(url = "") {
  return /\.(pdf|docx?|pptx?|xlsx?|csv|zip|txt)(\?|#|$)/i.test(String(url || ""));
}

function qualityInternalHref(value = "") {
  const href = String(value || "").trim();
  if (!href.startsWith("#/")) return "";
  return href;
}

function qualityNormalizeLink(value = "") {
  return String(value || "").trim();
}

function qualityUrlWithoutAnchor(value = "") {
  return String(value || "").split("#")[0];
}

function qualityIsAnchorLink(value = "") {
  const href = qualityNormalizeLink(value);
  return href.startsWith("#") && !href.startsWith("#/");
}

function qualityIsExternalUrl(value = "") {
  return /^https?:\/\//i.test(qualityNormalizeLink(value));
}

function qualityIsInternalAbsoluteUrl(value = "") {
  const href = qualityNormalizeLink(value);
  if (!qualityIsExternalUrl(href)) return false;
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const currentHost = window.location.hostname.replace(/^www\./i, "").toLowerCase();
    return host === currentHost || ["prodigitaltv.de", "prodigitaltv-da47b.web.app"].includes(host);
  } catch {
    return false;
  }
}

function qualityIsLegacyProdigitaltvSourceUrl(value = "") {
  const href = qualityNormalizeLink(value);
  if (!qualityIsExternalUrl(href)) return false;
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "prodigitaltv.de") return false;
    return /^\/(?:veranstaltungen|presse)\//i.test(url.pathname || "");
  } catch {
    return false;
  }
}

function qualityIsRelativePath(value = "") {
  const href = qualityNormalizeLink(value);
  return href.startsWith("/") && !href.startsWith("//");
}

function qualityIsFileLike(value = "") {
  const clean = qualityUrlWithoutAnchor(qualityNormalizeLink(value)).split("?")[0];
  return /\.(avif|gif|jpe?g|png|svg|webp|pdf|docx?|pptx?|xlsx?|csv|zip|txt|mp4|mov|m4v|webm|mp3|wav)$/i.test(clean);
}

function qualityIsVideoUrl(value = "") {
  const href = qualityNormalizeLink(value);
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(href)
    || /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))/i.test(href);
}

function qualityClassifyLink(value = "") {
  const href = qualityNormalizeLink(value);
  if (!href) return "leer";
  if (/^(mailto|tel):/i.test(href)) return "kontakt";
  if (qualityIsAnchorLink(href)) return "anker";
  if (href.startsWith("#/")) return qualityLooksDocumentUrl(href) ?"interner dokumentpfad" : "interne route";
  if (qualityIsInternalAbsoluteUrl(href)) return qualityIsFileLike(href) ?"absolute interne datei-url" : "absolute interne url";
  if (qualityIsExternalUrl(href)) return qualityIsVideoUrl(href) ?"externer videolink" : qualityLooksDocumentUrl(href) ?"externer dokumentlink" : "externer link";
  if (qualityIsRelativePath(href)) return qualityIsFileLike(href) ?"relativer dateipfad" : "relativer interner pfad";
  return qualityIsFileLike(href) ?"dateipfad" : "ungewoehnliches linkformat";
}

function qualityLinkIssue(issues, collection, item, overrides = {}) {
  qualityRecordIssue(issues, collection, item, {
    linkValue: overrides.linkValue || "",
    linkType: overrides.linkType || qualityClassifyLink(overrides.linkValue || ""),
    ...overrides
  });
}

function qualityImageIssue(issues, collection, item, overrides = {}) {
  const imageValue = overrides.imageValue || "";
  const shouldUseFallback = Object.prototype.hasOwnProperty.call(overrides, "fallbackUsed") ? overrides.fallbackUsed : qualityImageIssueUsesFallback(overrides, imageValue);
  qualityRecordIssue(issues, collection, item, {
    imageValue,
    imageType: overrides.imageType || "Bild",
    fallbackUsed: shouldUseFallback,
    fallbackValue: overrides.fallbackValue || "",
    repairHint: overrides.repairHint || "Bild neu auswaehlen oder erneut hochladen",
    expectedStorage: overrides.expectedStorage || "/images oder bestehender erlaubter Medien-/Asset-Bereich",
    ...overrides
  });
}

function qualityFallbackType(imageType = "", collection = "") {
  const text = `${collection} ${imageType}`.toLowerCase();
  if (text.includes("sponsor")) return "sponsor";
  if (text.includes("member") || text.includes("mitglied") || text.includes("logo")) return "member";
  if (text.includes("gallery") || text.includes("galerie")) return "gallery";
  if (text.includes("video") || text.includes("poster") || text.includes("startbild")) return "video";
  if (text.includes("event")) return "event";
  if (text.includes("topic") || text.includes("thema")) return "topic";
  if (text.includes("intern")) return "internal";
  if (text.includes("dokument") || text.includes("download") || text.includes("pdf")) return "document";
  if (text.includes("news") || text.includes("editorial")) return "news";
  return "default";
}

function qualityImageIssueUsesFallback(overrides = {}, imageValue = "") {
  if (overrides.severity !== "error") return false;
  const text = `${overrides.faultType || ""} ${overrides.description || ""}`.toLowerCase();
  if (!String(imageValue || "").trim()) return true;
  return /(fehlt|nicht erreichbar|existiert nicht|leer|beschaedigt|beschädigt|nicht lesbar)/i.test(text);
}

function qualityCollectionStatus(collectionName, error = null) {
  return {
    collectionName,
    ok: !error,
    error: error ?String(error.message || error.code || error) : ""
  };
}

function qualityEditHref(collection, item = {}) {
  const id = encodeURIComponent(item.id || "");
  if (!id) return "";
  if (collection === "events") return `#/cms/event/${id}`;
  if (collection === "eventMedia") return `#/cms/followup`;
  if (collection === "media_assets") return `#/cms/media/edit?id=${id}`;
  if (collection === "videos") return `#/cms/media/videos?mode=edit&id=${id}`;
  if (collection === "galleries") return `#/cms/edit?module=galleries&id=${id}&section=all`;
  if (collection === "members") return `#/cms/edit?module=members&id=${id}&section=all`;
  if (collection === "editorialContent") return `#/cms/edit?module=editorialContent&id=${id}&section=${encodeURIComponent(item.section || item.page || "all")}`;
  return `#/cms/edit?module=${encodeURIComponent(collection)}&id=${id}&section=all`;
}

function qualityPush(issues, issue) {
  const baseKey = [
    issue.area,
    issue.contentType,
    issue.title,
    issue.faultType,
    issue.description,
    issue.linkValue || "",
    issue.linkType || "",
    issue.imageValue || "",
    issue.imageType || "",
    issue.editHref || ""
  ].map((part) => String(part || "").trim().toLowerCase()).join("|");
  issues.push({
    desktop: issue.desktop ?? true,
    mobile: issue.mobile ?? true,
    status: "offen",
    checkedAt: new Date().toISOString(),
    category: qualityIssueCategory(issue),
    key: qualityIssueKey(baseKey),
    linkType: issue.linkType || (issue.linkValue ?qualityClassifyLink(issue.linkValue) : ""),
    ...issue
  });
}

function qualityRecordIssue(issues, collection, item, overrides = {}) {
  qualityPush(issues, {
    area: overrides.area || collection,
    contentType: overrides.contentType || collection,
    title: overrides.title || qualityRecordTitle(item),
    editHref: overrides.editHref ?? qualityEditHref(collection, item),
    ...overrides
  });
}

function qualityLinkedGallery(item = {}, galleriesById = new Map()) {
  const ids = [item.galleryId, item.gallery_id, item.linkedGalleryId, item.gallery].filter(Boolean);
  if (!ids.length) return null;
  return ids.map((id) => galleriesById.get(id)).find(Boolean) || null;
}

function qualityPdfAssets(item = {}) {
  const assets = [
    ...(Array.isArray(item.pdfAttachments) ?item.pdfAttachments : []),
    ...(Array.isArray(item.documents) ?item.documents : []),
    ...(Array.isArray(item.assets) ?item.assets : [])
  ];
  if (item.documentUrl || item.document_url || item.assetUrl || item.fileUrl) {
    assets.push({
      title: item.documentTitle || item.fileName || item.title || "PDF",
      url: item.documentUrl || item.document_url || item.assetUrl || item.fileUrl,
      type: item.fileType || item.mimeType || ""
    });
  }
  return assets.filter((asset) => {
    const url = qualityUrl(asset.url || asset.fileUrl || asset.assetUrl || asset.documentUrl || "");
    const type = String(asset.type || asset.fileType || asset.mimeType || "").toLowerCase();
    return type.includes("pdf") || qualityLooksPdfUrl(url) || qualityLooksPdfUrl(asset.title || asset.fileName || "");
  });
}

function qualityVideoAssets(item = {}) {
  return [
    ...(Array.isArray(item.videoAttachments) ?item.videoAttachments : []),
    ...(Array.isArray(item.videos) ?item.videos : [])
  ];
}

function qualityKnownRoute(href = "", context = {}) {
  let normalized = qualityNormalizeLink(href);
  if (qualityIsInternalAbsoluteUrl(normalized)) {
    try {
      const url = new URL(normalized);
      normalized = url.hash || url.pathname || "";
      if (normalized.startsWith("/")) normalized = `#${normalized}`;
    } catch {}
  }
  const route = normalized.replace(/^#\//, "").replace(/^\//, "").split("?")[0].split("#")[0];
  const [path, id] = route.split("/");
  if (["home", "events", "topics", "news", "about", "ueber-uns", "members", "board", "archive", "downloads", "join", "mitglied-werden", "login", "portal", "webapp-qr", "imprint", "privacy"].includes(path) && !id) return true;
  if (path === "event") return context.eventPublicIds.has(id) || context.eventMemberIds.has(id);
  if (path === "register") return context.eventPublicIds.has(id) || context.eventMemberIds.has(id);
  if (path === "topic") return context.topicVisibleIds.has(id);
  if (path === "news" || path === "retrospective") return context.editorialPublicIds.has(id) || context.editorialPublicSlugs.has(id);
  if (path === "about" || path === "ueber-uns" || path === "join" || path === "mitglied-werden") return context.internalPublicSlugs.has(id);
  if (path === "portal" && id === "article") return true;
  return false;
}

function qualityRouteVisibilityProblem(href = "", context = {}) {
  let normalized = qualityNormalizeLink(href);
  if (qualityIsInternalAbsoluteUrl(normalized)) {
    try {
      const url = new URL(normalized);
      normalized = url.hash || url.pathname || "";
      if (normalized.startsWith("/")) normalized = `#${normalized}`;
    } catch {}
  }
  const route = normalized.replace(/^#\//, "").replace(/^\//, "").split("?")[0].split("#")[0];
  const [path, id] = route.split("/");
  if (!id) return "";
  if ((path === "event" || path === "register") && context.eventMemberIds.has(id) && !context.eventPublicIds.has(id)) return "Ziel ist ein Mitglieder-Event oder nicht oeffentlich sichtbar.";
  if (path === "topic" && context.topicIds.has(id) && !context.topicVisibleIds.has(id)) return "Ziel-Thema existiert, ist aber nicht oeffentlich sichtbar.";
  if ((path === "news" || path === "retrospective") && (context.editorialIds.has(id) || context.editorialSlugs.has(id)) && !(context.editorialPublicIds.has(id) || context.editorialPublicSlugs.has(id))) return "Ziel-Beitrag existiert, ist aber nicht oeffentlich sichtbar.";
  return "";
}

function qualityAddLinkFinding(issues, collection, item, { field = "", href = "", area, contentType, faultType, description, severity = "warning", editHref } = {}) {
  qualityLinkIssue(issues, collection, item, {
    area,
    contentType,
    faultType,
    description: description || `${field}: ${href}`,
    severity,
    linkValue: href,
    linkType: qualityClassifyLink(href),
    editHref
  });
}

function qualityScanRecordLinks(issues, collection, item, context, options = {}) {
  const linkFields = options.fields || ["button_ziel", "buttonUrl", "url", "website", "sourceUrl", "source_url", "original_url", "originalUrl", "documentUrl", "document_url", "assetUrl", "fileUrl", "downloadUrl", "embedUrl", "youtubeUrl", "linkedIn"];
  linkFields.forEach((field) => {
    const href = qualityNormalizeLink(item[field]);
    if (!href) return;
    if (/^(mailto|tel):/i.test(href)) return;
    if (/^(data|blob):/i.test(href) || qualityLooksImageUrl(href)) return;
    if (qualityIsAnchorLink(href)) {
      qualityAddLinkFinding(issues, collection, item, {
        field,
        href,
        area: options.area,
        contentType: options.contentType,
        faultType: "Ankerziel nicht eindeutig pruefbar",
        description: `${field}: Anker ${href} kann ohne gerenderte Zielseite nicht sicher geprüft werden.`,
        severity: "warning"
      });
      return;
    }
    if (href.startsWith("#/") || qualityIsInternalAbsoluteUrl(href)) {
      if (/^(sourceUrl|source_url|original_url|originalUrl)$/i.test(field) && qualityIsLegacyProdigitaltvSourceUrl(href)) return;
      if (qualityKnownRoute(href, context)) {
        const visibilityProblem = qualityRouteVisibilityProblem(href, context);
        if (visibilityProblem) {
          qualityAddLinkFinding(issues, collection, item, {
            field,
            href,
            area: options.area,
            contentType: options.contentType,
            faultType: "Interner Link mit falscher Sichtbarkeit",
            description: `${field}: ${visibilityProblem}`,
            severity: "error"
          });
        }
        return;
      }
      qualityAddLinkFinding(issues, collection, item, {
        field,
        href,
        area: options.area,
        contentType: options.contentType,
        faultType: "Interner Link fuehrt ins Leere",
        description: `${field}: ${href}`,
        severity: "error"
      });
      return;
    }
    if (!qualityIsExternalUrl(href) && !qualityIsRelativePath(href) && qualityClassifyLink(href) === "ungewoehnliches linkformat") {
      qualityAddLinkFinding(issues, collection, item, {
        field,
        href,
        area: options.area,
        contentType: options.contentType,
        faultType: "Linkformat ungewoehnlich",
        description: `${field}: ${href}`,
        severity: "warning"
      });
    }
  });
}

function qualityIssueKey(value = "") {
  let hash = 0;
  String(value || "").split("").forEach((char) => {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  });
  return `q-${Math.abs(hash)}`;
}

function qualityIssueCategory(issue = {}) {
  const text = `${issue.faultType || ""} ${issue.contentType || ""}`.toLowerCase();
  if (/bild|thumbnail|alt-text|startbild|dateiname|asset/.test(text)) return "images";
  if (/link|url|menue|menu|footer/.test(text)) return "links";
  if (/pdf|download|dokument/.test(text)) return "documents";
  if (/video/.test(text)) return "videos";
  if (/galerie/.test(text)) return "galleries";
  if (/upload/.test(text)) return "uploads";
  if (/sichtbar|sichtbarkeit|mitgliederinhalt/.test(text)) return "visibility";
  return "other";
}

function qualityEditorialArea(item = {}) {
  if (isMemberAreaEditorialItem(item)) return "Mitgliederbereich";
  if (isInternalEditorialItem(item)) return "Interna";
  if (isPressEditorialItem(item)) return "Presse";
  if (isNewsEditorialItem(item)) return "News";
  if (item.page === "topics" || item.section === "topics") return "Themen";
  return "unbekannter Bereich";
}

function qualityMetrics(collections = {}, issues = []) {
  const allRecords = qualityCollectionNames.flatMap((name) => collections[name] || []);
  const checkedImages = qualityCollectImageCandidates(collections).length;
  const checkedLinks = qualityCollectLinkCandidates(collections).length;
  const checkedAttachments = (collections.editorialContent || []).reduce((count, item) => count + qualityPdfAssets(item).length + qualityVideoAssets(item).length + (qualityLinkedGallery(item, new Map((collections.galleries || []).map((gallery) => [gallery.id, gallery]))) ?1 : 0), 0)
    + (collections.downloads || []).length
    + (collections.memberDocuments || []).length
    + (collections.eventMedia || []).length;
  return {
    checkedContent: allRecords.length,
    checkedImages,
    checkedLinks,
    checkedAttachments,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity !== "error").length,
    desktop: issues.filter((issue) => issue.desktop).length,
    mobile: issues.filter((issue) => issue.mobile).length
  };
}

function qualityLinkCandidate(collection, item, field, value, overrides = {}) {
  const href = qualityNormalizeLink(value);
  if (!href || /^(mailto|tel):/i.test(href) || qualityIsAnchorLink(href)) return null;
  if (/^(data|blob):/i.test(href) || qualityLooksImageUrl(href)) return null;
  return {
    collection,
    item,
    field,
    href,
    linkType: qualityClassifyLink(href),
    area: overrides.area,
    contentType: overrides.contentType,
    title: overrides.title || qualityRecordTitle(item),
    editHref: overrides.editHref ?? qualityEditHref(collection, item)
  };
}

function qualityCollectRecordLinkCandidates(collection, item = {}, overrides = {}) {
  const fields = [
    "button_ziel", "buttonUrl", "url", "website", "sourceUrl", "source_url", "original_url", "originalUrl",
    "documentUrl", "document_url", "assetUrl", "fileUrl", "downloadUrl", "embedUrl", "youtubeUrl", "linkedIn"
  ];
  const candidates = fields.map((field) => qualityLinkCandidate(collection, item, field, item[field], overrides)).filter(Boolean);
  const nestedGroups = [
    ["pdfAttachments", "PDF-Anhang"],
    ["documents", "Dokument"],
    ["assets", "Asset"],
    ["videoAttachments", "Video"],
    ["videos", "Video"],
    ["sources", "Quelle"],
    ["source_candidates", "Quelle"]
  ];
  nestedGroups.forEach(([fieldName, label]) => {
    (Array.isArray(item[fieldName]) ?item[fieldName] : []).forEach((entry, index) => {
      ["url", "fileUrl", "assetUrl", "documentUrl", "downloadUrl", "embedUrl", "youtubeUrl"].forEach((field) => {
        const candidate = qualityLinkCandidate(collection, item, `${fieldName}.${index + 1}.${field}`, entry?.[field], {
          ...overrides,
          contentType: overrides.contentType || label
        });
        if (candidate) candidates.push(candidate);
      });
    });
  });
  return candidates;
}

function qualityStaticLinkCandidates() {
  const menu = ["home", "events", "topics", "news", "about", "archive", "webapp-qr", "board", "members", "join"];
  const footer = ["join", "downloads", "login", "imprint", "privacy"];
  return [
    ...menu.map((routeName) => qualityLinkCandidate("navigation", { id: `menu-${routeName}`, title: `Menue: ${routeName}` }, "href", `#/${routeName}`, { area: "Menue", contentType: "MenueLink", editHref: "" })),
    ...footer.map((routeName) => qualityLinkCandidate("footer", { id: `footer-${routeName}`, title: `Footer: ${routeName}` }, "href", `#/${routeName}`, { area: "Footer", contentType: "FooterLink", editHref: "" }))
  ].filter(Boolean);
}

function qualityCollectLinkCandidates(collections = {}) {
  const candidates = [];
  (collections.events || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("events", item, { area: "Events", contentType: "Event" })));
  (collections.editorialContent || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("editorialContent", item, { area: qualityEditorialArea(item), contentType: isMemberAreaEditorialItem(item) ?"Mitgliederbeitrag" : "Beitrag" })));
  (collections.topics || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("topics", item, { area: "Themen", contentType: "Thema" })));
  (collections.members || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("members", item, { area: "Mitglieder", contentType: "Mitglied" })));
  (collections.boardMembers || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("boardMembers", item, { area: "Ueber uns", contentType: "Vorstand" })));
  (collections.sponsors || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("sponsors", item, { area: "Events", contentType: "Sponsor" })));
  [...(collections.downloads || []), ...(collections.memberDocuments || [])].forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("downloads", item, { area: "Downloads", contentType: "Download" })));
  (collections.eventMedia || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("eventMedia", item, { area: "Uploads", contentType: "Upload" })));
  (collections.media_assets || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("media_assets", item, { area: "Medien", contentType: "Asset" })));
  (collections.videos || []).forEach((item) => candidates.push(...qualityCollectRecordLinkCandidates("videos", item, { area: "Medien", contentType: "Video" })));
  (collections.galleries || []).forEach((gallery) => {
    candidates.push(...qualityCollectRecordLinkCandidates("galleries", gallery, { area: "Galerien", contentType: "Galerie" }));
    (Array.isArray(gallery.images) ?gallery.images : []).forEach((image, index) => {
      ["url", "imageUrl", "assetUrl", "downloadUrl"].forEach((field) => {
        const candidate = qualityLinkCandidate("galleries", gallery, `images.${index + 1}.${field}`, image?.[field], { area: "Galerien", contentType: "Galeriebild" });
        if (candidate) candidates.push(candidate);
      });
    });
  });
  candidates.push(...qualityStaticLinkCandidates());
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = [candidate.collection, candidate.item?.id, candidate.field, candidate.href].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function qualityImageCandidate(collection, item, field, value, overrides = {}) {
  const src = qualityNormalizeLink(value);
  if (!src) return null;
  if (!qualityIsImagePath(src)) return null;
  return {
    collection,
    item,
    field,
    src,
    imageType: overrides.imageType || "Bild",
    area: overrides.area,
    contentType: overrides.contentType,
    title: overrides.title || qualityRecordTitle(item),
    required: Boolean(overrides.required),
    desktop: overrides.desktop ?? true,
    mobile: overrides.mobile ?? true,
    expected: overrides.expected || "content",
    editHref: overrides.editHref ?? qualityEditHref(collection, item)
  };
}

function qualityCollectRecordImageCandidates(collection, item = {}, overrides = {}) {
  const fields = [
    ["imageUrl", "Bild"],
    ["thumbnail_url", "Thumbnail"],
    ["thumbnailUrl", "Thumbnail"],
    ["assetUrl", "Bild"],
    ["logoUrl", "Logo"],
    ["logoDisplayUrl", "Logo"],
    ["photoUrl", "Profilbild"],
    ["file_path_web_url", "Web-Bild"],
    ["file_path_thumb_url", "Thumbnail"],
    ["file_path_original_url", "Originalbild"],
    ["desktopImageUrl", "Desktop-Bild"],
    ["mobileImageUrl", "Mobile-Bild"],
    ["posterImageUrl", "Videostartbild"],
    ["youtubeThumbnailUrl", "Videostartbild"],
    ["thumbUrl", "Thumbnail"],
    ["downloadUrl", "Bild"]
  ];
  const candidates = fields.map(([field, imageType]) => qualityImageCandidate(collection, item, field, item[field], {
    ...overrides,
    imageType,
    desktop: field === "mobileImageUrl" ?false : true,
    mobile: field === "desktopImageUrl" ?false : true
  })).filter(Boolean);
  const nestedGroups = [
    ["videoAttachments", "Videostartbild"],
    ["videos", "Videostartbild"],
    ["assets", "Bild"],
    ["documents", "Dokumentbild"]
  ];
  nestedGroups.forEach(([fieldName, imageType]) => {
    (Array.isArray(item[fieldName]) ?item[fieldName] : []).forEach((entry, index) => {
      ["posterImageUrl", "thumbnailUrl", "youtubeThumbnailUrl", "imageUrl", "assetUrl", "url", "downloadUrl"].forEach((field) => {
        const candidate = qualityImageCandidate(collection, item, `${fieldName}.${index + 1}.${field}`, entry?.[field], {
          ...overrides,
          imageType,
          contentType: overrides.contentType || imageType
        });
        if (candidate) candidates.push(candidate);
      });
    });
  });
  return candidates;
}

function qualityCollectImageCandidates(collections = {}) {
  const candidates = [];
  (collections.events || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("events", item, { area: "Events", contentType: "Event", imageType: "Eventbild", required: qualityIsVisiblePublic(item) })));
  (collections.editorialContent || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("editorialContent", item, { area: qualityEditorialArea(item), contentType: isMemberAreaEditorialItem(item) ?"Mitgliederbeitrag" : isNewsEditorialItem(item) ?"News" : "Beitrag", imageType: isNewsEditorialItem(item) ?"News-Bild" : "Beitragsbild", required: (qualityIsVisiblePublic(item) || item.visible === true || item.visibility === "members") && !isInternalEditorialItem(item) })));
  (collections.topics || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("topics", item, { area: "Themen", contentType: "Thema", imageType: "Themenbild", required: !["inactive", "archived", "deleted", "hidden"].includes(String(item.status || "").toLowerCase()) })));
  (collections.members || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("members", item, { area: "Mitglieder", contentType: "Mitglied", imageType: "Mitgliederlogo", required: memberIsLive(item) })));
  (collections.boardMembers || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("boardMembers", item, { area: "Ueber uns", contentType: "Vorstand", imageType: "Profilbild" })));
  (collections.sponsors || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("sponsors", item, { area: "Events", contentType: "Sponsor", imageType: "Sponsorenlogo", required: String(item.status || "").toLowerCase() === "published" })));
  (collections.speakers || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("speakers", item, { area: "Events", contentType: "Referent", imageType: "Profilbild" })));
  (collections.eventMedia || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("eventMedia", item, { area: "Uploads", contentType: "Upload", imageType: "Uploadbild", required: String(item.mediaType || "").toLowerCase() === "image" })));
  (collections.media_assets || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("media_assets", item, { area: "Medien", contentType: "Asset", imageType: "Mediathekbild", required: String(item.media_type || item.mediaType || item.type || "").toLowerCase().includes("image") })));
  (collections.videos || []).forEach((item) => candidates.push(...qualityCollectRecordImageCandidates("videos", item, { area: "Medien", contentType: "Video", imageType: "Videostartbild", required: Boolean(item.youtubeVideoId || item.youtubeUrl || item.url || item.videoId) })));
  (collections.galleries || []).forEach((gallery) => {
    candidates.push(...qualityCollectRecordImageCandidates("galleries", gallery, { area: "Galerien", contentType: "Galerie", imageType: "Galeriebild" }));
    (Array.isArray(gallery.images) ?gallery.images : []).forEach((image, index) => {
      ["url", "imageUrl", "assetUrl", "downloadUrl", "thumbnailUrl"].forEach((field) => {
        const candidate = qualityImageCandidate("galleries", gallery, `images.${index + 1}.${field}`, image?.[field], {
          area: "Galerien",
          contentType: "Galeriebild",
          imageType: field === "thumbnailUrl" ?"Galerie-Thumbnail" : "Galeriebild",
          required: true
        });
        if (candidate) candidates.push(candidate);
      });
    });
  });
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = [candidate.collection, candidate.item?.id, candidate.field, candidate.src].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function qualityFetchCheck(url, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = await fetch(url, { method: "HEAD", signal: controller.signal, cache: "no-store" });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    }
    return { ok: response.ok, status: response.status, error: "" };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name === "AbortError" ?"Timeout" : String(error?.message || error || "Fetch fehlgeschlagen") };
  } finally {
    window.clearTimeout(timer);
  }
}

function qualityIsExternalBrowserFetchBlocked(result = {}) {
  const error = String(result.error || "").toLowerCase();
  return !result.ok && !result.status && (error.includes("failed to fetch") || error.includes("networkerror"));
}

async function qualityMapLimit(items, limit, mapper) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

function qualityImageLoad(src = "", timeoutMs = 3500) {
  return new Promise((resolve) => {
    if (!src) {
      resolve({ ok: false, width: 0, height: 0, error: "Bildpfad leer" });
      return;
    }
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve({ ok: false, width: 0, height: 0, error: "Timeout" });
    }, timeoutMs);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve({ ok: true, width: image.naturalWidth || 0, height: image.naturalHeight || 0, error: "" });
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve({ ok: false, width: 0, height: 0, error: "Bild konnte nicht geoeffnet werden" });
    };
    image.src = src;
  });
}

function qualityImageFetchUrl(src = "") {
  const value = qualityNormalizeLink(src);
  if (qualityIsInternalAbsoluteUrl(value)) {
    try {
      return new URL(value).pathname;
    } catch {
      return value;
    }
  }
  return value;
}

async function qualityImageHead(src = "", timeoutMs = 2500) {
  if (/^(data|blob):/i.test(src)) return { ok: true, status: 0, size: src.length, type: src.match(/^data:([^;,]+)/i)?.[1] || "" };
  if (qualityIsExternalUrl(src) && !qualityIsInternalAbsoluteUrl(src)) return { ok: true, status: 0, size: 0, type: "", skipped: true };
  const result = await qualityFetchCheck(qualityImageFetchUrl(src), timeoutMs);
  return { ...result, size: 0, type: "" };
}

function qualityAddImageFinding(issues, candidate, { faultType, description, severity = "warning", desktop, mobile } = {}) {
  qualityImageIssue(issues, candidate.collection, candidate.item, {
    area: candidate.area,
    contentType: candidate.contentType,
    faultType,
    description,
    severity,
    imageValue: candidate.src,
    imageType: candidate.imageType,
    desktop: desktop ?? candidate.desktop,
    mobile: mobile ?? candidate.mobile,
    editHref: candidate.editHref
  });
}

async function qualityTechnicalImageIssues(collections = {}) {
  const issues = [];
  const candidates = qualityCollectImageCandidates(collections).slice(0, 220);
  await qualityMapLimit(candidates, 6, async (candidate) => {
    const src = candidate.src;
    const format = qualityImageFormat(src);
    if (!qualityIsAllowedImageStorage(src)) {
      qualityAddImageFinding(issues, candidate, {
        faultType: "Bild liegt ausserhalb erlaubter Speicherbereiche",
        description: `${candidate.field}: ${src}`,
        severity: qualityIsExternalUrl(src) && !qualityIsInternalAbsoluteUrl(src) ?"warning" : "error"
      });
    }
    if (format && !qualityAllowedImageFormat(src)) {
      qualityAddImageFinding(issues, candidate, {
        faultType: "Bildformat ungewoehnlich",
        description: `${candidate.field}: Format ${format} ist nicht als Standardformat hinterlegt.`,
        severity: "warning"
      });
    }
    if (!format && !/^blob:/i.test(src)) {
      qualityAddImageFinding(issues, candidate, {
        faultType: "Bildformat nicht eindeutig pruefbar",
        description: `${candidate.field}: Das Bildformat konnte aus dem Pfad nicht sicher ermittelt werden.`,
        severity: "warning"
      });
    }
    const head = await qualityImageHead(src, 2500);
    if (!head.ok) {
      qualityAddImageFinding(issues, candidate, {
        faultType: candidate.imageType === "Videostartbild" ?"Erforderliches Videostartbild fehlt" : candidate.imageType === "Galeriebild" ?"Galerie verweist auf nicht vorhandene Bilder" : "Bilddatei existiert nicht",
        description: `${candidate.field}: Bilddatei nicht erreichbar${head.status ?` (HTTP ${head.status})` : head.error ?` (${head.error})` : ""}.`,
        severity: "error"
      });
      return;
    }
    if (/^data:image\//i.test(src) && src.length < 120) {
      qualityAddImageFinding(issues, candidate, {
        faultType: "Bilddatei ist leer oder beschaedigt",
        description: `${candidate.field}: Data-URL ist auffaellig kurz.`,
        severity: "error"
      });
    }
    const loaded = await qualityImageLoad(src, 3500);
    if (!loaded.ok) {
      qualityAddImageFinding(issues, candidate, {
        faultType: "Bilddatei ist nicht lesbar",
        description: `${candidate.field}: ${loaded.error}.`,
        severity: qualityIsExternalUrl(src) && !qualityIsInternalAbsoluteUrl(src) ?"warning" : "error"
      });
      return;
    }
    if (!loaded.width || !loaded.height) {
      qualityAddImageFinding(issues, candidate, {
        faultType: "Bildgroesse nicht eindeutig pruefbar",
        description: `${candidate.field}: Bild wurde geladen, aber Breite/Hoehe konnten nicht sicher ermittelt werden.`,
        severity: "warning"
      });
      return;
    }
    if (/^data:image\//i.test(src) && src.length > 900000) {
      qualityAddImageFinding(issues, candidate, {
        faultType: "Bild ist sehr gross",
        description: `${candidate.field}: Data-URL ist groesser als 900 KB.`,
        severity: "warning"
      });
    }
  });
  if (qualityCollectImageCandidates(collections).length > candidates.length) {
    qualityPush(issues, {
      area: "System",
      contentType: "Prüfung",
      title: "Bildpruefung",
      faultType: "Prueflimit erreicht",
      description: "Aus Performancegruenden wurden maximal 220 Bildverweise in diesem Lauf technisch geprüft.",
      severity: "warning",
      desktop: false,
      mobile: false,
      editHref: "",
      imageValue: "",
      imageType: "Bild"
    });
  }
  return issues;
}

async function qualityTechnicalLinkIssues(collections = {}) {
  const issues = [];
  const candidates = qualityCollectLinkCandidates(collections);
  const internalFileCandidates = candidates.filter((candidate) => {
    const href = candidate.href;
    return (qualityIsRelativePath(href) || qualityIsInternalAbsoluteUrl(href)) && qualityIsFileLike(href);
  });
  internalFileCandidates.forEach((candidate) => {
    const href = candidate.href;
    const path = qualityIsInternalAbsoluteUrl(href) ?new URL(href).pathname : href;
    if (!path.startsWith("/assets/") && !path.startsWith("/images/") && !path.startsWith("/manifest.json") && !path.startsWith("/src/")) {
      qualityAddLinkFinding(issues, candidate.collection, candidate.item, {
        field: candidate.field,
        href,
        area: candidate.area,
        contentType: candidate.contentType,
        faultType: "Dateipfad zeigt auf nicht erlaubten Speicherort",
        description: `${candidate.field}: ${href}`,
        severity: "error",
        editHref: candidate.editHref
      });
    }
  });
  await qualityMapLimit(internalFileCandidates, 4, async (candidate) => {
    const href = qualityIsInternalAbsoluteUrl(candidate.href) ?new URL(candidate.href).pathname : candidate.href;
    const result = await qualityFetchCheck(href, 2500);
    if (result.ok) return;
    qualityAddLinkFinding(issues, candidate.collection, candidate.item, {
      field: candidate.field,
      href: candidate.href,
      area: candidate.area,
      contentType: qualityLooksDocumentUrl(candidate.href) ?"Dokument" : candidate.contentType,
      faultType: qualityLooksDocumentUrl(candidate.href) ?"Dokumentlink fehlt" : qualityIsVideoUrl(candidate.href) ?"Interne Videodatei fehlt" : "Upload-Datei fehlt",
      description: `${candidate.field}: Datei nicht erreichbar${result.status ?` (HTTP ${result.status})` : result.error ?` (${result.error})` : ""}.`,
      severity: "error",
      editHref: candidate.editHref
    });
  });

  const externalCandidates = candidates
    .filter((candidate) => qualityIsExternalUrl(candidate.href) && !qualityIsInternalAbsoluteUrl(candidate.href))
    .slice(0, 60);
  await qualityMapLimit(externalCandidates, 4, async (candidate) => {
    let parsed;
    try {
      parsed = new URL(candidate.href);
    } catch {
      qualityAddLinkFinding(issues, candidate.collection, candidate.item, {
        field: candidate.field,
        href: candidate.href,
        area: candidate.area,
        contentType: candidate.contentType,
        faultType: "Externe URL ungueltig formatiert",
        description: `${candidate.field}: ${candidate.href}`,
        severity: "warning",
        editHref: candidate.editHref
      });
      return;
    }
    const result = await qualityFetchCheck(parsed.href, 3500);
    if (result.ok) return;
    if (qualityIsExternalBrowserFetchBlocked(result)) return;
    qualityAddLinkFinding(issues, candidate.collection, candidate.item, {
      field: candidate.field,
      href: candidate.href,
      area: candidate.area,
      contentType: qualityIsVideoUrl(candidate.href) ?"Video" : candidate.contentType,
      faultType: qualityIsVideoUrl(candidate.href) ?"Externer Video-Link nicht sicher pruefbar" : "Externer Link nicht erreichbar",
      description: `${candidate.field}: ${candidate.href}${result.status ?` (HTTP ${result.status})` : result.error ?` (${result.error})` : ""}.`,
      severity: "warning",
      editHref: candidate.editHref
    });
  });
  if (candidates.filter((candidate) => qualityIsExternalUrl(candidate.href) && !qualityIsInternalAbsoluteUrl(candidate.href)).length > externalCandidates.length) {
    qualityPush(issues, {
      area: "System",
      contentType: "Prüfung",
      title: "Externe Linkpruefung",
      faultType: "Prueflimit erreicht",
      description: "Aus Performancegruenden wurden maximal 60 externe Links in diesem Lauf technisch abgefragt.",
      severity: "warning",
      desktop: false,
      mobile: false,
      editHref: "",
      linkValue: "",
      linkType: "externer link"
    });
  }
  return issues;
}

function qualityFilterButton(id, label) {
  return `<button class="filter" type="button" data-quality-filter="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

async function qualityLoadCollections() {
  const entries = await Promise.all(qualityCollectionNames.map(async (name) => {
    try {
      return [name, await list(name), qualityCollectionStatus(name)];
    } catch (error) {
      return [name, [], qualityCollectionStatus(name, error)];
    }
  }));
  return {
    collections: Object.fromEntries(entries.map(([name, records]) => [name, records])),
    statuses: entries.map(([, , statusEntry]) => statusEntry)
  };
}

function qualityAnalyze(collections, collectionStatuses) {
  const issues = [];
  const events = collections.events || [];
  const editorial = collections.editorialContent || [];
  const topics = collections.topics || [];
  const members = collections.members || [];
  const galleries = collections.galleries || [];
  const eventMedia = collections.eventMedia || [];
  const mediaAssets = collections.media_assets || [];
  const downloads = [...(collections.downloads || []), ...(collections.memberDocuments || [])];
  const videoLibrary = collections.videos || [];
  const galleriesById = new Map(galleries.map((gallery) => [gallery.id, gallery]));
  const mediaAssetIds = new Set(mediaAssets.map((asset) => asset.id).filter(Boolean));
  const mediaUrls = new Set(mediaAssets.flatMap((asset) => [asset.file_path_web_url, asset.file_path_thumb_url, asset.file_path_original_url, asset.imageUrl, asset.assetUrl, asset.downloadUrl, asset.url]).filter(Boolean));
  const publicEvents = events.filter((item) => qualityIsVisiblePublic(item) && item.accessType !== "members_only");
  const memberEvents = events.filter((item) => item.accessType === "members_only" || item.visibility === "members");
  const visibleTopics = topics.filter((item) => !["inactive", "archived", "deleted", "hidden"].includes(String(item.status || "").toLowerCase()));
  const publicEditorial = editorial.filter((item) => qualityIsVisiblePublic(item));
  const context = {
    eventIds: new Set(events.map((item) => item.id).filter(Boolean)),
    eventPublicIds: new Set(publicEvents.map((item) => item.id).filter(Boolean)),
    eventMemberIds: new Set(memberEvents.map((item) => item.id).filter(Boolean)),
    topicIds: new Set(topics.map((item) => item.id).filter(Boolean)),
    topicVisibleIds: new Set(visibleTopics.map((item) => item.id).filter(Boolean)),
    editorialIds: new Set(editorial.map((item) => item.id).filter(Boolean)),
    editorialSlugs: new Set(editorial.flatMap((item) => [item.slug, item.key]).filter(Boolean)),
    editorialPublicIds: new Set(publicEditorial.map((item) => item.id).filter(Boolean)),
    editorialPublicSlugs: new Set(publicEditorial.flatMap((item) => [item.slug, item.key]).filter(Boolean)),
    internalPublicSlugs: new Set(publicEditorial.filter(isInternalEditorialItem).flatMap((item) => [item.slug, item.key, item.id]).filter(Boolean))
  };

  collectionStatuses.filter((entry) => !entry.ok).forEach((entry) => {
    qualityPush(issues, {
      area: "System",
      contentType: "Collection",
      title: entry.collectionName,
      faultType: "Nicht eindeutig pruefbar",
      description: `Collection konnte nicht gelesen werden: ${entry.error}`,
      severity: "warning",
      desktop: false,
      mobile: false,
      editHref: ""
    });
  });

  qualityStaticLinkCandidates().forEach((candidate) => {
    if (qualityKnownRoute(candidate.href, context)) return;
    qualityAddLinkFinding(issues, candidate.collection, candidate.item, {
      field: candidate.field,
      href: candidate.href,
      area: candidate.area,
      contentType: candidate.contentType,
      faultType: candidate.collection === "footer" ?"Footerlink fuehrt ins Leere" : "Menue-Link fuehrt ins Leere",
      description: `${candidate.field}: ${candidate.href}`,
      severity: "error",
      editHref: ""
    });
  });

  events.forEach((event) => {
    if (qualityIsVisiblePublic(event) && !qualityImageUrl(event)) {
      qualityRecordIssue(issues, "events", event, {
        area: "Events",
        contentType: "Event",
        faultType: "Bild fehlt vollstaendig",
        description: "Das Eventbild wurde nicht gefunden.",
        severity: "error"
      });
    }
    const imageUrl = qualityImageUrl(event);
    if (imageUrl && !qualityHasAltText(event)) {
      qualityRecordIssue(issues, "events", event, {
        area: "Events",
        contentType: "Event",
        faultType: "Alt-Text fehlt",
        description: "Eventbild ist vorhanden, aber kein Alt-Text-Feld ist gefuellt.",
        severity: "warning"
      });
    }
    if (event.galleryId && !galleriesById.has(event.galleryId)) {
      qualityRecordIssue(issues, "events", event, {
        area: "Events",
        contentType: "Event",
        faultType: "Galerie-Link defekt",
        description: `Verknuepfte Galerie ${event.galleryId} wurde nicht gefunden.`,
        severity: "error"
      });
    }
    qualityScanRecordLinks(issues, "events", event, context);
  });

  topics.forEach((topic) => {
    if (context.topicVisibleIds.has(topic.id) && !qualityImageUrl(topic)) {
      qualityImageIssue(issues, "topics", topic, {
        area: "Themen",
        contentType: "Thema",
        faultType: "Erforderliches Themenbild fehlt",
        description: "Das Thema ist aktiv, aber es ist kein Themenbild hinterlegt.",
        severity: "error",
        imageValue: "",
        imageType: "Themenbild"
      });
    }
    if (topic.galleryId && !galleriesById.has(topic.galleryId)) {
      qualityRecordIssue(issues, "topics", topic, {
        area: "Themen",
        contentType: "Thema",
        faultType: "Galerie-Link defekt",
        description: `Verknuepfte Galerie ${topic.galleryId} wurde nicht gefunden.`,
        severity: "error",
        linkValue: topic.galleryId,
        linkType: "galerie-id"
      });
    }
    qualityScanRecordLinks(issues, "topics", topic, context, { area: "Themen", contentType: "Thema" });
  });

  editorial.forEach((item) => {
    const visible = qualityIsVisiblePublic(item) || item.visible === true || item.visibility === "members";
    const isMemberArea = isMemberAreaEditorialItem(item);
    const editorialArea = qualityEditorialArea(item);
    const editorialType = isMemberArea ?"Mitgliederbeitrag" : isInternalEditorialItem(item) ?"Interna" : isNewsEditorialItem(item) ?"News" : "Beitrag";
    const imageUrl = qualityImageUrl(item);
    if (visible && !imageUrl && !isInternalEditorialItem(item)) {
      qualityRecordIssue(issues, "editorialContent", item, {
        area: editorialArea,
        contentType: editorialType,
        faultType: "Bild fehlt vollstaendig",
        description: "Das Beitragsbild wurde nicht gefunden.",
        severity: "error"
      });
    }
    if (imageUrl && !qualityHasAltText(item)) {
      qualityRecordIssue(issues, "editorialContent", item, {
        area: editorialArea,
        contentType: editorialType,
        faultType: "Alt-Text fehlt",
        description: "Bild ist vorhanden, aber Alt-Text fehlt.",
        severity: "warning"
      });
    }
    if (imageUrl && !item.thumbnailUrl && !item.thumbnail_url) {
      qualityRecordIssue(issues, "editorialContent", item, {
        area: editorialArea,
        contentType: editorialType,
        faultType: "Thumbnail fehlt",
        description: "Originalbild ist vorhanden, aber kein eigenes Thumbnail-Feld.",
        severity: "warning"
      });
    }
    if (isMemberArea && item.visibility === "public") {
      qualityRecordIssue(issues, "editorialContent", item, {
        area: "Mitgliederbereich",
        contentType: "Mitgliederbeitrag",
        faultType: "Mitgliederinhalt falsch sichtbar",
        description: "Mitgliederinhalt steht auf public statt members.",
        severity: "error"
      });
    }
    const gallery = qualityLinkedGallery(item, galleriesById);
    if ((item.galleryId || item.gallery_id || item.linkedGalleryId) && !gallery) {
      qualityRecordIssue(issues, "editorialContent", item, {
        area: editorialArea,
        contentType: editorialType,
        faultType: "Galerie-Link defekt",
        description: "Verknuepfte Galerie wurde nicht gefunden.",
        severity: "error"
      });
    }
    qualityPdfAssets(item).forEach((pdf) => {
      const url = qualityUrl(pdf.url || pdf.fileUrl || pdf.assetUrl || pdf.documentUrl || "");
      if (!url) {
        qualityRecordIssue(issues, "editorialContent", item, {
          area: editorialArea,
          contentType: "PDF-Anhang",
          faultType: "PDF-Anhang fehlt",
          description: `Der PDF-Anhang "${qualityText(pdf.title || pdf.fileName, "ohne Titel")}" ist nicht erreichbar.`,
          severity: "error"
        });
      }
    });
    qualityVideoAssets(item).forEach((video) => {
      const videoId = video.youtubeVideoId || video.youtubeId || video.videoId || video.youtubeUrl || video.url || "";
      if (!videoId) {
        qualityRecordIssue(issues, "editorialContent", item, {
          area: editorialArea,
          contentType: "Video",
          faultType: "Video-ID fehlt",
          description: `Video "${qualityText(video.title || video.caption, "ohne Titel")}" hat keine YouTube-ID oder URL.`,
          severity: "error"
        });
      }
      if (videoId && !video.posterImageUrl && !video.thumbnailUrl && !video.youtubeThumbnailUrl) {
        qualityRecordIssue(issues, "editorialContent", item, {
          area: editorialArea,
          contentType: "Video",
          faultType: "Videostartbild fehlt",
          description: "Video ist verknuepft, aber kein Startbild gespeichert. YouTube-Fallback kann dennoch greifen.",
          severity: "warning"
        });
      }
    });
    const markedAsVideo = /video/i.test(String(item.category || item.contentType || item.type || item.section || ""));
    if (markedAsVideo && !qualityVideoAssets(item).length && !qualityUrl(item.youtubeVideoId || item.youtubeUrl || item.videoId || item.videoUrl)) {
      qualityRecordIssue(issues, "editorialContent", item, {
        area: editorialArea,
        contentType: "Video",
        faultType: "Video-ID fehlt",
        description: "Beitrag ist als Video-Beitrag markiert, aber es ist kein Video hinterlegt.",
        severity: "error"
      });
    }
    qualityScanRecordLinks(issues, "editorialContent", item, context);
  });

  galleries.forEach((gallery) => {
    const images = Array.isArray(gallery.images) ?gallery.images : [];
    if (qualityIsVisiblePublic(gallery) && !images.length) {
      qualityRecordIssue(issues, "galleries", gallery, {
        area: "Galerien",
        contentType: "Galerie",
        faultType: "Galerie ist leer",
        description: "Diese Galerie enthält keine Bilder.",
        severity: "error"
      });
    }
    if (gallery.eventId && !context.eventIds.has(gallery.eventId)) {
      qualityRecordIssue(issues, "galleries", gallery, {
        area: "Galerien",
        contentType: "Galerie",
        faultType: "Galerie nicht zuordenbar",
        description: `Zugeordnetes Event ${gallery.eventId} wurde nicht gefunden.`,
        severity: "error",
        linkValue: gallery.eventId,
        linkType: "event-id"
      });
    }
    images.forEach((image, index) => {
      const url = qualityUrl(image.url || image.imageUrl || image.assetUrl || image.downloadUrl || "");
      if (!url) {
        qualityRecordIssue(issues, "galleries", gallery, {
          area: "Galerien",
          contentType: "Galeriebild",
          faultType: "Galerie verweist auf nicht vorhandene Bilder",
          description: `Bild ${index + 1} hat keine URL.`,
          severity: "error"
        });
      } else if (!qualityHasAltText(image)) {
        qualityRecordIssue(issues, "galleries", gallery, {
          area: "Galerien",
          contentType: "Galeriebild",
          faultType: "Alt-Text fehlt",
          description: `Bild ${index + 1} hat keinen Alt-Text.`,
          severity: "warning"
        });
      }
    });
  });

  eventMedia.forEach((item) => {
    const fileUrl = qualityUrl(item.fileUrl || item.assetUrl || item.downloadUrl || item.url || "");
    if (["uploaded", "in_review", "pending"].includes(String(item.status || "").toLowerCase()) && !item.eventId && !item.galleryId && !item.linkedRecordId) {
      qualityRecordIssue(issues, "eventMedia", item, {
        area: "Uploads",
        contentType: "Upload",
        faultType: "Upload ist nicht zugeordnet",
        description: "Der Upload wurde noch keiner Veranstaltung oder Galerie zugeordnet.",
        severity: "error"
      });
    }
    if (!fileUrl) {
      qualityRecordIssue(issues, "eventMedia", item, {
        area: "Uploads",
        contentType: "Upload",
        faultType: "Dateipfad fehlt",
        description: "Upload-Datensatz hat keine Datei-URL.",
        severity: "error"
      });
    }
  });

  mediaAssets.forEach((asset) => {
    const url = qualityUrl(asset.file_path_web_url || asset.file_path_original_url || asset.imageUrl || asset.assetUrl || asset.downloadUrl || asset.url || "");
    if (!url) {
      qualityRecordIssue(issues, "media_assets", asset, {
        area: "Medien",
        contentType: "Asset",
        faultType: "Dateipfad fehlt",
        description: "Mediathek-Asset hat keine erreichbare URL im Datensatz.",
        severity: "error"
      });
    }
    if (url && qualityLooksImageUrl(url) && !asset.file_path_thumb_url && !asset.thumbnailUrl) {
      qualityRecordIssue(issues, "media_assets", asset, {
        area: "Medien",
        contentType: "Asset",
        faultType: "Thumbnail fehlt",
        description: "Bild-Asset hat kein eigenes Thumbnail-Feld.",
        severity: "warning"
      });
    }
    if (asset.target_media_asset_id && !mediaAssetIds.has(asset.target_media_asset_id)) {
      qualityRecordIssue(issues, "media_assets", asset, {
        area: "Medien",
        contentType: "Asset",
        faultType: "Asset-Verknuepfung defekt",
        description: `Verweis auf Asset ${asset.target_media_asset_id} wurde nicht gefunden.`,
        severity: "error"
      });
    }
    if (url && !mediaUrls.has(url) && !/^https?:\/\//i.test(url) && !url.startsWith("/") && !url.startsWith("data:")) {
      qualityRecordIssue(issues, "media_assets", asset, {
        area: "Medien",
        contentType: "Asset",
        faultType: "Dateiname uneinheitlich",
        description: "Dateipfad ist weder absoluter Webpfad noch externe URL.",
        severity: "warning"
      });
    }
  });

  downloads.forEach((item) => {
    const url = qualityUrl(item.documentUrl || item.assetUrl || item.fileUrl || item.downloadUrl || item.url || "");
    if (!url) {
      qualityRecordIssue(issues, item.documentUrl !== undefined ?"downloads" : "memberDocuments", item, {
        area: "Downloads",
        contentType: "Download",
        faultType: "Notwendiger Download fehlt",
        description: "Download-Datensatz hat keine Datei-URL.",
        severity: "error"
      });
    }
    qualityScanRecordLinks(issues, "downloads", item, context);
  });

  members.forEach((member) => {
    const memberHasManagedVisibility = ["company", "individual"].includes(member.membershipType || "");
    if (!memberHasManagedVisibility && memberIsLive(member) && member.visibility && member.visibility !== "public") {
      qualityRecordIssue(issues, "members", member, {
        area: "Mitglieder",
        contentType: "Mitglied",
        faultType: "Fehlerhafte Sichtbarkeit",
        description: `Sichtbares Mitglied hat visibility=${member.visibility}.`,
        severity: "error"
      });
    }
    qualityScanRecordLinks(issues, "members", member, context, { area: "Mitglieder", contentType: "Mitglied" });
  });

  [...(collections.boardMembers || []), ...(collections.sponsors || []), ...(collections.speakers || [])].forEach((item) => {
    const collection = (collections.boardMembers || []).includes(item) ?"boardMembers" : (collections.sponsors || []).includes(item) ?"sponsors" : "speakers";
    if (collection === "sponsors" && String(item.status || "").toLowerCase() === "published" && !qualityUrl(item.logoUrl || item.imageUrl || item.assetUrl)) {
      qualityImageIssue(issues, "sponsors", item, {
        area: "Events",
        contentType: "Sponsor",
        faultType: "Sponsorenlogo fehlt",
        description: "Sponsor ist veroeffentlicht, aber es ist kein Logo hinterlegt.",
        severity: "error",
        imageValue: "",
        imageType: "Sponsorenlogo"
      });
    }
    qualityScanRecordLinks(issues, collection, item, context, {
      area: collection === "boardMembers" ?"Ueber uns" : "Events",
      contentType: collection === "boardMembers" ?"Vorstand" : collection === "sponsors" ?"Sponsor" : "Referent"
    });
  });

  videoLibrary.forEach((video) => {
    if (!qualityUrl(video.youtubeVideoId || video.youtubeUrl || video.url || video.videoId)) {
      qualityRecordIssue(issues, "videos", video, {
        area: "Medien",
        contentType: "Video",
        faultType: "Video-Datei oder Video-ID fehlt",
        description: "Videoeintrag hat keine YouTube-ID oder URL.",
        severity: "error"
      });
    }
    if ((video.youtubeVideoId || video.youtubeUrl || video.url) && !video.posterImageUrl && !video.thumbnailUrl && !video.youtubeThumbnailUrl) {
      qualityRecordIssue(issues, "videos", video, {
        area: "Medien",
        contentType: "Video",
        faultType: "Videostartbild fehlt",
        description: "Videoeintrag hat kein gespeichertes Startbild.",
        severity: "warning"
      });
    }
  });

  return issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ?-1 : 1;
    return String(a.area).localeCompare(String(b.area), "de", { sensitivity: "base" })
      || String(a.title).localeCompare(String(b.title), "de", { sensitivity: "base" });
  });
}

export async function qualityPage() {
  if (!hasCmsAccess()) return denied();
  const mobileReadOnly = window.matchMedia?.("(max-width: 820px), (pointer: coarse)")?.matches;
  const { collections, statuses } = await qualityLoadCollections();
  const baseIssues = qualityAnalyze(collections, statuses);
  const issues = [
    ...baseIssues,
    ...(mobileReadOnly ?[] : await qualityTechnicalImageIssues(collections)),
    ...(mobileReadOnly ?[] : await qualityTechnicalLinkIssues(collections))
  ].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ?-1 : 1;
    return String(a.area).localeCompare(String(b.area), "de", { sensitivity: "base" })
      || String(a.title).localeCompare(String(b.title), "de", { sensitivity: "base" });
  });
  const metrics = qualityMetrics(collections, issues);
  const checkedAt = new Date().toISOString();
  const filters = [
    ["all", "Alle"],
    ["errors", "Nur Fehler"],
    ["warnings", "Nur Warnungen"],
    ["desktop", "Nur Desktop betroffen"],
    ["mobile", "Nur Mobile betroffen"],
    ["images", "Nur Bilder"],
    ["links", "Nur Links"],
    ["documents", "Nur PDFs / Dokumente"],
    ["videos", "Nur Videos"],
    ["galleries", "Nur Galerien"],
    ["uploads", "Nur Uploads"],
    ["visibility", "Nur Sichtbarkeit"]
  ];
  const rows = issues.map((issue) => `<tr data-quality-row
    data-quality-key="${escapeHtml(issue.key || "")}"
    data-quality-severity="${escapeHtml(issue.severity || "warning")}"
    data-quality-category="${escapeHtml(issue.category || "other")}"
    data-quality-desktop="${issue.desktop ?"1" : "0"}"
    data-quality-mobile="${issue.mobile ?"1" : "0"}"
    data-quality-area="${escapeHtml(issue.area || "")}"
    data-quality-type="${escapeHtml(issue.contentType || "")}"
    data-quality-title="${escapeHtml(issue.title || "")}"
    data-quality-checked="${escapeHtml(issue.checkedAt || checkedAt)}">
    <td>${escapeHtml(issue.area || "-")}</td>
    <td>${escapeHtml(issue.contentType || "-")}</td>
    <td>${escapeHtml(issue.title || "-")}</td>
    <td>${escapeHtml(issue.faultType || "-")}</td>
    <td>${escapeHtml(issue.description || "-")}</td>
    <td>${escapeHtml(issue.linkValue || issue.imageValue || "-")}</td>
    <td>${escapeHtml(issue.linkType || issue.imageType || "-")}</td>
    <td>${issue.imageType ?escapeHtml(issue.fallbackUsed ?`ja: ${issue.fallbackValue || "-"}` : "nein") : "-"}</td>
    <td>${issue.imageType ?escapeHtml([issue.expectedStorage ?`Erwartet: ${issue.expectedStorage}` : "", issue.repairHint || "Bild neu auswaehlen oder erneut hochladen"].filter(Boolean).join(" | ")) : "-"}</td>
    <td>${issue.desktop ?"ja" : "nein"}</td>
    <td>${issue.mobile ?"ja" : "nein"}</td>
    <td>${qualitySeverityLabel(issue.severity)}</td>
    <td data-quality-status-cell>${qualityStatusLabel(issue.status)}${mobileReadOnly ?"" : ` <button class="button button--secondary button--small" type="button" data-quality-toggle="${escapeHtml(issue.key || "")}">erledigt</button>`}</td>
    <td>${escapeHtml(formatDateTime(issue.checkedAt || checkedAt))}</td>
    <td>${mobileReadOnly ?`<span class="muted">nur Desktop</span>` : qualityEditLink(issue)}</td>
  </tr>`).join("");
  return protect(cmsShell("cms/quality", `${cmsTitle("Qualitätsprüfung", "Qualitätsprüfung")}
    <section class="panel">
      <div class="setup-steps">
        <div class="setup-step"><span>Geprüfte Inhalte</span><strong>${metrics.checkedContent}</strong></div>
        <div class="setup-step"><span>Geprüfte Bilder</span><strong>${metrics.checkedImages}</strong></div>
        <div class="setup-step"><span>Geprüfte Links</span><strong>${metrics.checkedLinks}</strong></div>
        <div class="setup-step"><span>Geprüfte Anhänge</span><strong>${metrics.checkedAttachments}</strong></div>
        <div class="setup-step"><span>Fehler</span><strong>${metrics.errors}</strong></div>
        <div class="setup-step"><span>Warnungen</span><strong>${metrics.warnings}</strong></div>
        <div class="setup-step"><span>Desktop-Probleme</span><strong>${metrics.desktop}</strong></div>
        <div class="setup-step"><span>Mobile-Probleme</span><strong>${metrics.mobile}</strong></div>
        <div class="setup-step"><span>Alt-Texte</span><strong><button class="link-button" type="button" data-quality-fill-alt-texts>fehlende ergaenzen</button></strong><small id="quality-alt-text-result"></small></div>
        <div class="setup-step"><span>Letzte Prüfung</span><strong>${escapeHtml(formatDateTime(checkedAt))}</strong></div>
      </div>
      <p class="muted" style="margin-top:14px">Diese Prüfung ist nur lesend. Es werden keine Inhalte geändert, keine Bildpfade korrigiert und keine Veröffentlichungen blockiert.${mobileReadOnly ?" Mobile Ansicht: schnelle Nur-Lese-Auswertung ohne externe Netzwerkprüfung." : ""}</p>
    </section>
    <section class="panel">
      <div class="filters" data-quality-filters>${filters.map(([id, label], index) => {
        const html = qualityFilterButton(id, label);
        return index === 0 ?html.replace('class="filter"', 'class="filter active"') : html;
      }).join("")}</div>
      <div class="field" style="max-width:320px;margin:0 0 16px"><label>Sortierung</label><select data-quality-sort>
        <option value="errors">Fehler zuerst</option>
        <option value="warnings">Warnungen zuerst</option>
        <option value="area">Bereich</option>
        <option value="type">Inhaltstyp</option>
        <option value="title">Titel</option>
        <option value="checked">Zeitpunkt der Prüfung</option>
      </select></div>
      <div class="table-wrap"><table class="table table--editorial">
        <thead><tr><th>Bereich</th><th>Inhaltstyp</th><th>Titel</th><th>Fehlertyp</th><th>Beschreibung</th><th>Betroffener Link / Bildpfad</th><th>Linktyp / Bildtyp</th><th>Fallback verwendet</th><th>Reparaturhinweis</th><th>Desktop</th><th>Mobile</th><th>Einstufung</th><th>Status</th><th>Zeitpunkt</th><th>Bearbeiten</th></tr></thead>
        <tbody data-quality-table>${rows || `<tr><td colspan="15">Keine Fehler oder Warnungen gefunden.</td></tr>`}</tbody>
      </table></div>
    </section>`));
}

export async function moduleListPage(module, section = "all") {
  if (!hasCmsAccess()) return denied();
  if (module === "users" && !hasCmsAccess(true)) return denied(true);
  const config = {
    topics: ["Redaktionelle Themen", "Thema", "title", "shortDescription"],
    speakers: ["Referenten", "Referent", "name", "company"],
    sponsors: ["Sponsoren / Gastgeber", "Partner", "name", "role"],
    members: ["Mitglieder", "Mitglied", "name", "description"],
    membershipApplications: ["Mitgliedsantraege", "Antrag", "company", "email"],
    memberDocuments: ["Mitglieder-Dokumente", "Dokument", "title", "category"],
    memberDirectories: ["Mitgliederverzeichnisse", "Verzeichnis", "title", "year"],
    users: ["User", "User", "email", "role"],
    boardMembers: ["Vorstandsgalerie", "Vorstandsmitglied", "name", "role"],
    editorialContent: ["Redaktion / Seiteninhalte", "Inhalt", "title", "page"],
    galleries: ["Bildergalerien", "Galerie", "title", "description"],
    mailQueue: ["Mail-Queue", "Mail", "to", "subject"],
    eventMedia: ["Event-Nachlauf / Medien", "Medium", "title", "visibility"]
  }[module];
  const editorialConfig = module === "editorialContent" ?editorialSections[section] || editorialSections.all : null;
  const records = (await list(module))
    .filter((item) => !editorialConfig || editorialConfig.filter(item))
    .filter((item) => module !== "editorialContent" || section !== "interna" || !isAiGeneratedEditorialItem(item))
    .filter((item) => module !== "members" || memberIsManagedActive(item))
    .sort((a, b) => {
      if (module === "members") {
        const sortA = Number.isFinite(Number(a.sortOrder)) ?Number(a.sortOrder) : 9999;
        const sortB = Number.isFinite(Number(b.sortOrder)) ?Number(b.sortOrder) : 9999;
        if (sortA !== sortB) return sortA - sortB;
        return String(a.name || "").localeCompare(String(b.name || ""), "de", { sensitivity: "base" });
      }
      if (module === "editorialContent" && section === "interna") {
        const areaOrder = { ueber_uns: 1, mitglied_werden: 2, sonstiges: 3 };
        const areaA = areaOrder[internalAreaKey(a)] || 9;
        const areaB = areaOrder[internalAreaKey(b)] || 9;
        if (areaA !== areaB) return areaA - areaB;
        const sortA = Number.isFinite(Number(a.sortOrder ?? a.sortierung)) ? Number(a.sortOrder ?? a.sortierung) : 9999;
        const sortB = Number.isFinite(Number(b.sortOrder ?? b.sortierung)) ? Number(b.sortOrder ?? b.sortierung) : 9999;
        if (sortA !== sortB) return sortA - sortB;
        return String(a.title || a.titel || "").localeCompare(String(b.title || b.titel || ""), "de", { sensitivity: "base" });
      }
      const dateA = listDateSortValue(a);
      const dateB = listDateSortValue(b);
      if (dateA || dateB) return dateB - dateA;
      return Number(b.sortOrder || 0) - Number(a.sortOrder || 0);
    });
  const memberMediaAssets = module === "members" ?await list("media_assets").catch(() => []) : [];
  const linkedMediaAssets = ["editorialContent", "topics", "boardMembers", "speakers", "sponsors"].includes(module) ?await list("media_assets").catch(() => []) : [];
  const active = editorialConfig?.active || { topics: "cms/topics", galleries: "cms/galleries", speakers: "cms/speakers", sponsors: "cms/sponsors", members: "cms/members", membershipApplications: "cms/membership-applications", memberDocuments: "cms/member-documents", memberDirectories: "cms/member-directories", users: "cms/users", boardMembers: "cms/board", editorialContent: "cms/editorial", mailQueue: "cms/mail", eventMedia: "cms/followup" }[module];
  const editable = !["mailQueue", "eventMedia"].includes(module);
  const manageable = module !== "mailQueue";
  const inactiveStatus = module === "editorialContent" || module === "eventMedia" || module === "speakers" || module === "sponsors" || module === "galleries" || module === "memberDocuments" ?"archived" : "inactive";
  const activeStatus = ["editorialContent", "speakers", "sponsors", "galleries", "memberDocuments"].includes(module) ?"published" : module === "eventMedia" ?"approved" : "active";
  const title = editorialConfig?.title || config[0];
  const itemLabel = editorialConfig?.itemLabel || config[1];
  const createParams = editorialConfig?.createParams || "";
  const emptyText = editorialConfig ?`Noch keine Inhalte in ${escapeHtml(title)}.` : "Noch keine Eintraege vorhanden.";
  if (module === "topics") {
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel">${cmsBulkToolbar(records, { collection: "topics", label: "Themen" })}<div class="table-wrap"><table class="table table--editorial table--topics table--with-audio"><thead><tr><th class="cms-bulk-select-col"><input type="checkbox" data-cms-bulk-select-all ${records.length ?"" : "disabled"} aria-label="Alle Themen auswaehlen"></th><th>Bild</th><th>Titel</th><th>Datum</th><th>Rubrik</th><th>Audio</th><th>Medien</th><th>Aktionen</th></tr></thead><tbody>${records.length ?records.map((item) => `<tr><td class="cms-bulk-select-col"><input type="checkbox" data-cms-bulk-item="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title || "Thema")} auswaehlen"></td><td><div class="topic-thumb topic-thumb--table">${topicThumb(item, linkedMediaAssets)}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a></td><td>${escapeHtml(listDate(item))}</td><td>Thema</td><td>${audioListCell("topics", item)}</td><td>${editorialMediaFlags(item)}</td><td>${editorialActionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="8">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "galleries") {
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial table--galleries"><thead><tr><th>Bild</th><th>Titel</th><th>Bilder</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${records.length ?records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table gallery-thumb--table">${galleryThumb(item)}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a><small>${escapeHtml(shortText(item.description || "-", 90))}</small></td><td>${(item.images || []).length}</td><td>${galleryListStatus(item)}</td><td>${galleryActionButtons(item, section)}</td></tr>`).join("") : `<tr><td colspan="5">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "editorialContent") {
    const actionButtons = section === "interna" ?internalEditorialActionButtons : editorialVisibilityActionButtons;
    const isBulkEditorialList = ["news", "press"].includes(section);
    if (section === "interna") {
      const legacyCount = records.filter((item) => internalUsageKey(item) === "legacy").length;
      const legacyAction = legacyCount ?`<button class="button button--danger button--small" type="button" data-delete-internal-legacy>Altbestand löschen (${legacyCount})</button>` : "";
      return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<div class="actions">${legacyAction}<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a></div>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial table--interna"><thead><tr><th>Bereich</th><th>Titel</th><th>Typ</th><th>Nutzung</th><th>Sortierung</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${records.length ?records.map((item) => { const usageKey = internalUsageKey(item); return `<tr class="internal-row internal-row--${escapeHtml(internalAreaKey(item))}" data-internal-usage="${escapeHtml(usageKey)}" data-record-id="${escapeHtml(item.id)}"><td>${internalAreaButton(item)}</td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item.title || item.titel || "-")}">${escapeHtml(shortText(item.title || item.titel || "-", 76))}</a><small>${escapeHtml(shortText(item.introText || item.kurztext || item.bodyText || item.langtext || "-", 110))}</small></td><td><button class="internal-type-pill internal-preview-button" type="button" data-internal-preview="${escapeHtml(item.id)}">${escapeHtml(internalTypeLabel(item.typ || item.type || item.section))}</button></td><td><button class="internal-type-pill internal-usage-pill internal-usage-pill--${usageKey === "portal" ?"portal" : usageKey === "legacy" ?"legacy" : "other"} internal-preview-button" type="button" data-internal-preview="${escapeHtml(item.id)}">${escapeHtml(internalUsageLabel(item))}</button></td><td>${escapeHtml(String(item.sortOrder ?? item.sortierung ?? "-"))}</td><td>${status(internalStatusValue(item))}</td><td>${actionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`; }).join("") : `<tr><td colspan="7">${emptyText}</td></tr>`}</tbody></table></div><div id="internal-legacy-delete-result"></div></section>`));
    }
    const bulkLabel = section === "press" ?"Presse" : "News";
    const selectHead = isBulkEditorialList ?`<th class="cms-bulk-select-col"><input type="checkbox" data-cms-bulk-select-all ${records.length ?"" : "disabled"} aria-label="Alle ${bulkLabel} auswaehlen"></th>` : "";
    const selectCell = (item) => isBulkEditorialList ?`<td class="cms-bulk-select-col"><input type="checkbox" data-cms-bulk-item="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title || bulkLabel)} auswaehlen"></td>` : "";
    const emptyColspan = isBulkEditorialList ?8 : 7;
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel">${isBulkEditorialList ?cmsBulkToolbar(records, { collection: "editorialContent", label: bulkLabel }) : ""}<div class="table-wrap"><table class="table table--editorial table--with-audio${section === "press" ?" table--press" : ""}${section === "news" ?" table--news" : ""}"><thead><tr>${selectHead}<th>Bild</th><th>Titel</th><th>Datum</th><th>Rubrik</th><th>Audio</th><th>Medien</th><th>Aktionen</th></tr></thead><tbody>${records.length ?records.map((item) => `<tr>${selectCell(item)}<td><div class="topic-thumb topic-thumb--table editorial-thumb--table">${editorialThumb(item, { collection: "editorialContent", section, field: "imageUrl", altField: "thumbnail_alt", mediaAssets: linkedMediaAssets })}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a></td><td>${escapeHtml(listDate(item))}</td><td>${escapeHtml(item.category || item.page || "-")}</td><td>${audioListCell("editorialContent", item, { showMeta: false })}</td><td>${editorialMediaFlags(item)}</td><td>${actionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="${emptyColspan}">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "members") {
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial table--members"><thead><tr><th>Logo</th><th>Mitglied</th><th>Ansprechperson</th><th>Kontakt</th><th>Art</th><th>Ort</th><th>Visible</th><th>Aktionen</th></tr></thead><tbody>${records.length ?records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table editorial-thumb--table member-logo-thumb--table">${memberLogoThumb(item, memberMediaAssets, section)}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=members&id=${item.id}&section=${section}" title="${escapeHtml(item.name || "-")}">${escapeHtml(shortText(item.name || "-", 60))}</a>${memberProfileMissingCell(item)}</td><td>${escapeHtml(shortText(item.contactName || [item.firstName, item.lastName].filter(Boolean).join(" ") || "-", 70))}</td><td>${memberContactCell(item)}</td><td class="member-type-short" title="${escapeHtml(memberMembershipTypeTitle(item))}">${escapeHtml(memberMembershipTypeLabel(item))}</td><td>${escapeHtml([item.postalCode, item.city].filter(Boolean).join(" ") || "-")}</td><td>${memberVisibleToggleCell(item)}</td><td>${memberActionButtons(item, section)}</td></tr>`).join("") : `<tr><td colspan="8">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (["boardMembers", "speakers", "sponsors"].includes(module)) {
    const imageField = module === "sponsors" ?"logoUrl" : "photoUrl";
    const titleField = config[2];
    const subField = config[3];
    const tableClass = module === "sponsors" ?"table table--editorial table--sponsors-hosts" : module === "boardMembers" ?"table table--editorial table--board-members" : "table table--editorial";
    const imageLabel = module === "sponsors" ?"Logo" : "Bild";
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="${tableClass}"><thead><tr><th>${imageLabel}</th><th>${itemLabel}</th><th>Datum / Gueltigkeit</th><th>Beschreibung / Zuordnung</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${records.length ?records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table editorial-thumb--table">${editorialThumb(item, { collection: module, section, field: imageField, altField: "altText", mediaAssets: linkedMediaAssets })}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item[titleField] || "-")}">${escapeHtml(shortText(item[titleField] || "-", 60))}</a></td><td>${escapeHtml(item.publishDate || item.date || "-")}<br><small>${escapeHtml(item.validFrom || "-")} bis ${escapeHtml(item.validTo || "unendlich")}</small></td><td>${escapeHtml(item[subField] || "-")}</td><td>${status(item.status || item.visibility || "active")}</td><td>${cmsListActionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="6">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "mailQueue") {
    const counters = {
      queued: records.filter((item) => item.status === "queued").length,
      sent: records.filter((item) => item.status === "sent").length,
      failed: records.filter((item) => item.status === "failed").length
    };
    return protect(cmsShell(active, `${cmsTitle("Mail", title)}
      <section class="panel">
        <div class="setup-steps" style="margin-bottom:20px">
          <div class="setup-step"><span>Wartet</span><strong>${counters.queued}</strong></div>
          <div class="setup-step"><span>Gesendet</span><strong>${counters.sent}</strong></div>
          <div class="setup-step"><span>Fehler</span><strong>${counters.failed}</strong></div>
        </div>
        <div class="table-wrap"><table class="table table--mail-queue">
          <thead><tr><th>Status</th><th>Typ</th><th>Empfaenger</th><th>Betreff</th><th>Bezug</th><th>Zeit</th><th>Fehler</th></tr></thead>
          <tbody>${records.length ?records.map((item) => `<tr>
            <td>${status(item.status || "queued")}</td>
            <td>${escapeHtml(item.type || item.template || "-")}</td>
            <td>${escapeHtml(item.to || item.replyTo || "-")}</td>
            <td>${escapeHtml(shortText(item.subject || "-", 70))}</td>
            <td>${escapeHtml(mailReference(item))}</td>
            <td><small>Queue: ${escapeHtml(mailQueueDate(item.queuedAt || item.createdAt))}</small><br><small>Gesendet: ${escapeHtml(mailQueueDate(item.sentAt))}</small><br><small>Fehler: ${escapeHtml(mailQueueDate(item.failedAt))}</small></td>
            <td>${item.error ?`<span class="alert alert--error" style="display:block;margin:0">${escapeHtml(shortText(item.error, 130))}</span>` : "-"}</td>
          </tr>`).join("") : `<tr><td colspan="7">${emptyText}</td></tr>`}</tbody>
        </table></div>
        <p class="muted" style="margin-top:14px">Neue Mitgliedsantraege und Event-Anmeldungen erzeugen automatisch Eintraege in dieser Queue. Der Firebase-Function-Trigger versendet queued Mails per SMTP und schreibt danach den Status.</p>
      </section>`));
  }
  return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, editable ?`<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>` : "")}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>${itemLabel}</th><th>Datum / Gueltigkeit</th><th>Beschreibung / Zuordnung</th><th>Status</th>${editable || manageable ?"<th>Aktionen</th>" : ""}</tr></thead><tbody>${records.length ?records.map((item) => `<tr><td>${escapeHtml(item[config[2]] || "-")}</td><td>${escapeHtml(item.publishDate || item.date || "-")}<br><small>${escapeHtml(item.validFrom || "-")} bis ${escapeHtml(item.validTo || "unendlich")}</small></td><td>${escapeHtml(item[config[3]] || "-")}</td><td>${status(item.status || item.visibility || "active")}</td>${editable || manageable ?`<td>${cmsListActionButtons(item, section, module, activeStatus, inactiveStatus, { editable, manageable })}</td>` : ""}</tr>`).join("") : `<tr><td colspan="${editable || manageable ?5 : 4}">${emptyText}</td></tr>`}</tbody></table></div></section>`));
}

function topicSpeakerEditor(topic, speaker) {
  return `<div class="form-grid--two"><input type="hidden" name="speakerIds" value="${speaker.id}"><div class="field"><label>Referentname</label><input name="speaker-${speaker.id}-name" value="${escapeHtml(speaker.name || "")}"></div><div class="field"><label>Firma</label><input name="speaker-${speaker.id}-company" value="${escapeHtml(speaker.company || "")}"></div><div class="field"><label>Position</label><input name="speaker-${speaker.id}-position" value="${escapeHtml(speaker.position || "")}"></div><div class="field"><label>Kurzvita</label><textarea name="speaker-${speaker.id}-shortBio">${escapeHtml(speaker.shortBio || "")}</textarea></div></div>`;
}

function topicSpeakerManager(topic, speakers) {
  const assigned = speakers.filter((speaker) => speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id));
  return `<div class="form-grid" style="margin-top:18px"><h2>Referenten</h2><div class="selection-grid">${speakers.length ?speakers.map((speaker) => `<label class="selection-item"><input type="checkbox" name="assignedSpeakerIds" value="${speaker.id}" ${speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id) ?"checked" : ""}><span><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml(speaker.company || "")}</small></span></label>`).join("") : `<div class="alert">Noch keine Referenten vorhanden.</div>`}</div>${assigned.length ?assigned.map((speaker) => `<section class="panel"><h3>${escapeHtml(speaker.name || "Referent")}</h3>${topicSpeakerEditor(topic, speaker)}</section>`).join("") : ""}<section class="panel"><h3>Neuen Referenten anlegen</h3><div class="form-grid--two"><div class="field"><label>Referentname</label><input name="newSpeakerName"></div><div class="field"><label>Firma</label><input name="newSpeakerCompany"></div><div class="field"><label>Position</label><input name="newSpeakerPosition"></div><div class="field"><label>Kurzvita</label><textarea name="newSpeakerShortBio"></textarea></div></div></section></div>`;
}

const memberContactFunctions = ["", "Buchhaltung", "Geschaeftsleitung", "Marketing", "Sales / Verkauf", "Redaktion", "Event", "Technik", "Presse", "Sonstiges"];

function memberContactFunctionOptions(value = "") {
  const current = String(value || "");
  const options = memberContactFunctions.includes(current) ?memberContactFunctions : [current, ...memberContactFunctions];
  return options.map((option) => `<option value="${escapeHtml(option)}" ${current === option ?"selected" : ""}>${escapeHtml(option || "Funktion waehlen")}</option>`).join("");
}

function youtubeVideoIdFromValue(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const direct = text.match(/^[A-Za-z0-9_-]{11}$/);
  if (direct) return text;
  const match = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/i)
    || text.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
  return match?.[1] || "";
}

function articleVideoAttachments(item = {}) {
  const raw = Array.isArray(item.videoAttachments)
    ?item.videoAttachments
    : Array.isArray(item.videos)
      ?item.videos
      : [];
  return raw
    .map((video, index) => ({
      id: video.id || `video-${index + 1}`,
      youtubeVideoId: youtubeVideoIdFromValue(video.youtubeVideoId || video.youtubeUrl || video.url || video.embedUrl || ""),
      youtubeUrl: video.youtubeUrl || video.url || "",
      title: video.title || "",
      caption: video.caption || "",
      description: video.description || "",
      posterImageUrl: video.posterImageUrl || video.thumbnailUrl || video.youtubeThumbnailUrl || "",
      posterImageAlt: video.posterImageAlt || video.altText || video.title || "",
      posterImageCaption: video.posterImageCaption || "",
      privacyStatus: video.privacyStatus || "unlisted",
      visibility: video.visibility || "public",
      status: video.status || "ready",
      sortOrder: Number(video.sortOrder ?? index + 1)
    }))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function articleVideoAttachmentRow(video = {}, index = 0) {
  const id = video.id || `video-${index + 1}`;
  const url = video.youtubeUrl || (video.youtubeVideoId ?`https://www.youtube.com/watch?v=${video.youtubeVideoId}` : "");
  return `<fieldset class="video-attachment-row" data-video-attachment-row>
    <legend>Video ${index + 1}</legend>
    <input type="hidden" name="videoId${index}" value="${escapeHtml(id)}">
    <div class="form-grid form-grid--video-attachment">
      <div class="field"><label>YouTube-URL oder ID</label><input name="videoYoutubeUrl${index}" value="${escapeHtml(url)}" placeholder="https://www.youtube.com/watch?v=..."></div>
      <div class="field"><label>Titel</label><input name="videoTitle${index}" value="${escapeHtml(video.title || "")}"></div>
      <div class="field"><label>Caption</label><input name="videoCaption${index}" value="${escapeHtml(video.caption || "")}"></div>
      <div class="field"><label>Startbild / Posterbild</label><input name="videoPosterImageUrl${index}" value="${escapeHtml(video.posterImageUrl || "")}" placeholder="Bild-URL oder YouTube-Thumbnail"></div>
      <div class="field"><label>Alt-Text Startbild</label><input name="videoPosterImageAlt${index}" value="${escapeHtml(video.posterImageAlt || "")}"></div>
      <div class="field"><label>Sortierung</label><input name="videoSortOrder${index}" type="number" min="1" value="${escapeHtml(video.sortOrder || index + 1)}"></div>
      <div class="field"><label>Privacy</label><select name="videoPrivacyStatus${index}">${["unlisted", "private", "public", "unknown"].map((value) => `<option value="${value}" ${String(video.privacyStatus || "unlisted") === value ?"selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div>
      <div class="field"><label>Status</label><select name="videoStatus${index}">${["ready", "draft", "published", "hidden", "error"].map((value) => `<option value="${value}" ${String(video.status || "ready") === value ?"selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div>
      <div class="field field--wide"><label>Beschreibung</label><textarea name="videoDescription${index}">${escapeHtml(video.description || "")}</textarea></div>
    </div>
    <button class="icon-button icon-button--danger" type="button" data-remove-video-attachment title="Video entfernen" aria-label="Video entfernen">${iconImage("trash")}</button>
  </fieldset>`;
}

function videoLibrarySnapshot(video = {}, index = 0) {
  const youtubeVideoId = youtubeVideoIdFromValue(video.youtubeVideoId || video.youtubeUrl || video.url || video.embedUrl || "");
  const youtubeUrl = video.youtubeUrl || video.url || (youtubeVideoId ?`https://www.youtube.com/watch?v=${youtubeVideoId}` : "");
  const posterImageUrl = video.posterImageUrl || video.thumbnailUrl || video.youtubeThumbnailUrl || (youtubeVideoId ?`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "");
  return {
    ...video,
    id: video.id || `video-${index + 1}`,
    youtubeVideoId,
    youtubeUrl,
    title: video.title || "",
    caption: video.caption || video.description || "",
    description: video.description || "",
    posterImageUrl,
    posterImageAlt: video.posterImageAlt || video.title || "Video starten",
    privacyStatus: video.privacyStatus || "unlisted",
    visibility: video.visibility || "public",
    status: video.status || "ready",
    sortOrder: Number(video.sortOrder ?? index + 1),
    createdAt: video.createdAt || video.created_at || "",
    updatedAt: video.updatedAt || video.updated_at || "",
    trash_status: video.trash_status || video.trashStatus || ""
  };
}

function videoLibraryOptionPayload(video = {}) {
  return escapeHtml(JSON.stringify(videoLibrarySnapshot(video)));
}

function usableCentralVideos(videoLibrary = []) {
  return (Array.isArray(videoLibrary) ?videoLibrary : [])
    .map((video, index) => videoLibrarySnapshot(video, index))
    .filter((video) => video.youtubeVideoId || video.youtubeUrl)
    .filter((video) => !["archived", "deleted", "hidden", "error"].includes(String(video.status || "ready").toLowerCase()))
    .filter((video) => String(video.trash_status || video.trashStatus || "").toLowerCase() !== "paperkorb")
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

function articleVideoAssignmentRow(video = {}, index = 0) {
  const item = videoLibrarySnapshot(video, index);
  return `<div class="video-assignment-row" data-video-attachment-row>
    <input type="hidden" name="videoId${index}" value="${escapeHtml(item.id)}">
    <input type="hidden" name="videoYoutubeUrl${index}" value="${escapeHtml(item.youtubeUrl || item.youtubeVideoId || "")}">
    <input type="hidden" name="videoTitle${index}" value="${escapeHtml(item.title || "")}">
    <input type="hidden" name="videoCaption${index}" value="${escapeHtml(item.caption || "")}">
    <input type="hidden" name="videoPosterImageUrl${index}" value="${escapeHtml(item.posterImageUrl || "")}">
    <input type="hidden" name="videoPosterImageAlt${index}" value="${escapeHtml(item.posterImageAlt || "")}">
    <input type="hidden" name="videoDescription${index}" value="${escapeHtml(item.description || "")}">
    <input type="hidden" name="videoSortOrder${index}" value="${escapeHtml(item.sortOrder || index + 1)}">
    <input type="hidden" name="videoPrivacyStatus${index}" value="${escapeHtml(item.privacyStatus || "unlisted")}">
    <input type="hidden" name="videoStatus${index}" value="${escapeHtml(item.status || "ready")}">
    ${item.posterImageUrl ?`<img src="${escapeHtml(item.posterImageUrl)}" alt="${escapeHtml(item.posterImageAlt || item.title || "Video")}">` : `<span class="video-assignment-row__icon">Video</span>`}
    <div><strong>${escapeHtml(item.title || item.youtubeVideoId || "Video")}</strong><small>${escapeHtml(item.youtubeUrl || "")}</small></div>
    <button class="icon-button icon-button--danger" type="button" data-remove-video-attachment title="Video entfernen" aria-label="Video entfernen">${iconImage("trash")}</button>
  </div>`;
}

function articleVideoAttachmentEditor(item = {}, videoLibrary = []) {
  const videos = articleVideoAttachments(item);
  const rows = videos.map((video, index) => articleVideoAssignmentRow(video, index)).join("");
  const returnTo = `#/cms/edit?module=editorialContent&id=${encodeURIComponent(item.id)}&section=${encodeURIComponent(item.section || item.page || "news")}`;
  const newHref = `#/cms/media/videos?mode=new&targetCollection=editorialContent&targetId=${encodeURIComponent(item.id)}&returnTo=${encodeURIComponent(returnTo)}`;
  const centralVideos = usableCentralVideos(videoLibrary);
  const options = [`<option value="">Video aus Videothek waehlen</option>`, ...centralVideos.map((snapshot) => {
    return `<option value="${escapeHtml(snapshot.id)}" data-video-payload="${videoLibraryOptionPayload(snapshot)}">${escapeHtml(snapshot.title || snapshot.youtubeVideoId || snapshot.id)}</option>`;
  })].join("");
  return `<details class="editorial-tool-details" data-editor-tool-panel="videos">
    <summary><span>Medien</span><strong>Video</strong><em>${videos.length ?`${videos.length} zugeordnet` : "optional"}</em></summary>
    <div class="editor-tool-section editor-tool-section--videos" data-video-attachments>
      <div class="video-attachment-list" data-video-attachment-list>${rows || `<p class="muted">Noch kein Video zugeordnet.</p>`}</div>
      <div class="field"><label>Video zuordnen</label><select data-video-library-select>${options}</select></div>
      <div class="tool-button-row">
        <button class="button button--primary button--small video-library-assign-button" type="button" data-add-video-from-library>Aus Liste zuordnen</button>
        <a class="button button--secondary button--small" href="${newHref}">Neues Video</a>
      </div>
      <p class="muted">YouTube-URLs werden zentral unter Medien > Videos gepflegt.</p>
    </div>
  </details>`;
}

function normalizeMemberLookup(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolveMemberEditorItem(id = "") {
  const exact = await getOne("members", id).catch(() => null);
  if (exact) return exact;
  const wanted = normalizeMemberLookup(id);
  if (!wanted) return null;
  const members = await list("members").catch(() => []);
  const scored = members
    .map((member) => {
      const haystacks = [
        member.id,
        member.name,
        member.title,
        member.company,
        member.logoUrl,
        member.imageUrl
      ].map(normalizeMemberLookup).filter(Boolean);
      const score = haystacks.reduce((best, value) => {
        if (value === wanted) return Math.max(best, 100);
        if (value.split(" ").includes(wanted)) return Math.max(best, 80);
        if (value.includes(wanted)) return Math.max(best, 60);
        if (wanted.includes(value) && value.length > 4) return Math.max(best, 40);
        return best;
      }, 0);
      return { member, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.member.name || "").localeCompare(String(b.member.name || ""), "de"));
  return scored[0]?.member || null;
}

export async function contentEditPage(module, id, query = new URLSearchParams()) {
  if (!hasCmsAccess()) return denied();
  if (module === "users" && !hasCmsAccess(true)) return denied(true);
  const definitions = {
    topics: { title: "Redaktionelles Thema", fields: [["title", "Thema"], ["shortDescription", "Kurze Beschreibung"]] },
    speakers: { title: "Referent", fields: [["name", "Referent Name"], ["company", "Firma"], ["position", "Position"], ["website", "Website"], ["email", "E-Mail"], ["phone", "Telefon"], ["shortBio", "Kurzvita"], ["longBio", "Ausfuehrliche Vita"]] },
    sponsors: { title: "Sponsor / Gastgeber", fields: [["name", "Name"], ["role", "Sponsor / Gastgeber"], ["address", "Adresse"], ["website", "Webseite"]] },
    members: { title: "Mitglied", fields: [["membershipType", "Mitgliedstyp"], ["name", "Firma / Name"], ["description", "Beschreibung"], ["website", "Website"], ["street", "Strasse"], ["houseNumber", "Hausnummer"], ["postalCode", "PLZ"], ["city", "Ort"], ["country", "Land"]] },
    membershipApplications: { title: "Mitgliedsantrag", fields: [["company", "Unternehmen / Name"], ["legalForm", "Rechtsform"], ["street", "Strasse"], ["city", "PLZ / Ort"], ["country", "Land"], ["website", "Website"], ["firstName", "Vorname"], ["lastName", "Nachname"], ["position", "Position"], ["email", "E-Mail"], ["phone", "Telefon"], ["membershipType", "Mitgliedschaft: company oder individual"], ["companyDescription", "Kurzbeschreibung"], ["message", "Nachricht"], ["status", "Status"], ["submittedAt", "Eingegangen"]] },
    memberDocuments: { title: "Mitgliederdokument", fields: [["title", "Titel"], ["category", "Kategorie"], ["year", "Jahr"], ["meetingDate", "Datum"], ["description", "Beschreibung"]] },
    memberDirectories: { title: "Mitgliederverzeichnis", fields: [["title", "Titel"], ["year", "Jahr"], ["description", "Beschreibung"], ["documentUrl", "Datei-Link optional"]] },
    users: { title: "User", fields: [["email", "E-Mail"], ["displayName", "Name"], ["role", "Rolle"], ["status", "Status"], ["memberId", "Mitglied-ID"], ["committeeRole", "Vereinsrolle"]] },
    boardMembers: { title: "Vorstandsmitglied", fields: [["name", "Name"], ["role", "Funktion / Rolle"], ["company", "Unternehmen"], ["shortBio", "Kurzbeschreibung"], ["linkedIn", "LinkedIn"], ["website", "Website"]] },
    galleries: { title: "Bildergalerie", fields: [["title", "Titel"], ["description", "Beschreibung"]] },
    editorialContent: { title: "Redaktioneller Inhalt", fields: [["title", "Seitentitel"], ["page", "Bereich"], ["section", "Sektion"], ["key", "Inhaltsschluessel"], ["publishDate", "Datum"], ["validFrom", "Gueltig von"], ["validTo", "Gueltig bis (leer = unendlich)"], ["subtitle", "Untertitel"], ["introText", "Introtext"], ["bodyText", "Haupttext"], ["buttonText", "Button-Text"], ["buttonUrl", "Button-Link"], ["seoTitle", "SEO-Titel"], ["seoDescription", "SEO-Beschreibung"]] }
  };
  const definition = definitions[module];
  if (!definition) return dashboardPage();
  const fallbackItem = { id, page: query.get("page") || "", section: query.get("section") || "", key: query.get("page") && query.get("section") ?`${query.get("page")}.${query.get("section")}` : "", category: module === "topics" ?"Thema" : "", title: id, status: module === "topics" ?"active" : module === "galleries" ?"published" : "draft", visibility: "public", images: [], createdAt: new Date().toISOString() };
  const item = id === "new"
    ?{ ...fallbackItem, id: `${module}-${crypto.randomUUID()}` }
    : module === "members"
      ?await resolveMemberEditorItem(id) || fallbackItem
      : (await getOne(module, id)) || fallbackItem;
  const topicSpeakers = module === "topics" ?await list("speakers") : [];
  const memberMediaAssets = module === "members" ?await list("media_assets").catch(() => []) : [];
  const editMediaAssets = ["editorialContent", "topics", "sponsors"].includes(module) ?await list("media_assets").catch(() => []) : [];
  const audioProviders = ["editorialContent", "topics"].includes(module) ?await getOne("settings", "audioProviders").catch(() => null) : null;
  const videoLibrary = module === "editorialContent" ?await list("media_videos").catch(() => []) : [];
  const documentLibrary = module === "editorialContent"
    ?[
      ...(await list("downloads").catch(() => [])).map((document) => ({ ...document, documentCollection: "downloads" })),
      ...(await list("memberDocuments").catch(() => [])).map((document) => ({ ...document, documentCollection: "memberDocuments" }))
    ].filter((document) => !["archived", "deleted"].includes(String(document.status || "").toLowerCase()))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.title || a.fileName || "").localeCompare(String(b.title || b.fileName || ""), "de"))
    : [];
  const memberOptions = module === "users"
    ?(await list("members"))
      .filter((member) => (member.status || "active") === "active")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    : [];
  if (module === "galleries") {
    const [events, media] = await Promise.all([list("events"), list("eventMedia")]);
    const images = Array.isArray(item.images) ?item.images.slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) : [];
    const linkedEventId = item.eventId || item.linkedEventId || "";
    const eventOptions = [`<option value="">Kein Event zugeordnet</option>`, ...events
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .map((event) => `<option value="${escapeHtml(event.id)}" ${linkedEventId === event.id ?"selected" : ""}>${escapeHtml([event.date, event.title].filter(Boolean).join(" · "))}</option>`)].join("");
    const imageKeys = new Set(images.flatMap((image) => [image.id, image.url, image.storagePath].filter(Boolean)));
    const candidateMedia = media
      .filter((entry) => entry.mediaType === "image" && entry.fileUrl)
      .filter((entry) => !imageKeys.has(entry.id) && !imageKeys.has(entry.fileUrl) && !imageKeys.has(entry.storagePath))
      .sort((a, b) => String(b.uploadedAt || b.createdAt || "").localeCompare(String(a.uploadedAt || a.createdAt || "")));
    const uploadCandidates = candidateMedia.length
      ?`<div class="gallery-editor__grid">${candidateMedia.map((medium, index) => `<article class="gallery-editor__item gallery-editor__item--candidate">
          <img src="${escapeHtml(medium.fileUrl)}" alt="">
          <input type="hidden" name="media-${index}-id" value="${escapeHtml(medium.id || "")}">
          <input type="hidden" name="media-${index}-url" value="${escapeHtml(medium.fileUrl || "")}">
          <input type="hidden" name="media-${index}-storagePath" value="${escapeHtml(medium.storagePath || "")}">
          <input type="hidden" name="media-${index}-fileName" value="${escapeHtml(medium.fileName || "")}">
          <div class="field"><label>Caption</label><input name="media-${index}-caption" value="${escapeHtml(medium.title || medium.caption || medium.fileName || "")}"></div>
          <div class="field"><label>Alt-Text</label><input name="media-${index}-altText" value="${escapeHtml(medium.altText || medium.title || medium.fileName || "")}"></div>
          <label class="checkbox-line"><input type="checkbox" name="media-${index}-attach"> In Galerie aufnehmen</label>
          <label class="checkbox-line"><input type="checkbox" name="media-${index}-approve" checked> Freigeben</label>
          <small>${escapeHtml([medium.eventId, medium.status, medium.visibility].filter(Boolean).join(" · "))}</small>
        </article>`).join("")}</div>`
      : `<div class="alert">Der Uploadfolder enthaelt aktuell keine weiteren Bilder.</div>`;
    return protect(cmsShell("cms/galleries", `${cmsTitle("Bildergalerien", "Galerie bearbeiten", `<a class="button button--secondary button--small" href="#/cms/galleries">Zurueck</a>`)}
      <section class="panel"><form id="gallery-edit-form" data-gallery-id="${escapeHtml(item.id)}" class="form-grid">
        <div class="form-grid--two">
          <div class="field"><label>Titel</label><input name="title" value="${escapeHtml(item.title || "")}" required></div>
          <div class="field"><label>Status</label><select name="status"><option value="published" ${item.status === "published" ?"selected" : ""}>Veroeffentlicht / Aktiv</option><option value="draft" ${item.status === "draft" ?"selected" : ""}>Entwurf</option><option value="archived" ${item.status === "archived" ?"selected" : ""}>Archiviert</option></select></div>
        </div>
        <div class="field"><label>Event-Zuordnung</label><select name="eventId">${eventOptions}</select><p class="muted">Diese Galerie erscheint beim verknuepften Event. Beitraege koennen die Galerie separat im Beitragseditor auswaehlen.</p></div>
        <div class="field"><label>Beschreibung</label><textarea name="description">${escapeHtml(item.description || "")}</textarea></div>
        <input type="hidden" name="visibility" value="${escapeHtml(item.visibility || "public")}">
        <section class="gallery-editor">
          <div class="gallery-editor__head"><div><p class="eyebrow">Bilder</p><h3>${images.length} Bilder in dieser Galerie</h3></div><label class="button button--secondary button--small">Bilder hochladen<input type="file" name="galleryImages" accept="image/*" multiple hidden></label></div>
          <label class="gallery-dropzone" data-gallery-dropzone>
            <strong>Bilder hier ablegen</strong>
            <span>Drag-and-drop oder Klick zum Auswaehlen. Mehrere Bilder sind moeglich.</span>
            <input type="file" name="galleryImagesDrop" accept="image/*" multiple hidden>
          </label>
          <p class="muted">Reihenfolge: Bildkarten ziehen und vor dem Speichern neu anordnen.</p>
          <div class="gallery-editor__grid" data-gallery-sortable>${images.length ?images.map((image, index) => `<article class="gallery-editor__item" draggable="true" data-gallery-image-item><button class="gallery-editor__drag" type="button" aria-label="Bild verschieben">?</button><img src="${escapeHtml(image.url)}" alt=""><input type="hidden" name="image-${index}-id" value="${escapeHtml(image.id || "")}"><input type="hidden" name="image-${index}-url" value="${escapeHtml(image.url || "")}"><input type="hidden" name="image-${index}-storagePath" value="${escapeHtml(image.storagePath || "")}"><input type="hidden" name="image-${index}-fileName" value="${escapeHtml(image.fileName || "")}"><input type="hidden" name="image-${index}-mediaAssetId" value="${escapeHtml(image.mediaAssetId || image.media_asset_id || "")}"><div class="gallery-editor__media-transfer">${image.mediaAssetId || image.media_asset_id ?`<a class="button button--secondary button--small" href="#/cms/media/edit?id=${escapeHtml(image.mediaAssetId || image.media_asset_id)}">In Mediathek</a>` : `<button class="button button--secondary button--small" type="button" data-gallery-image-to-media data-gallery-image-id="${escapeHtml(image.id || "")}">In Mediathek verschieben</button>`}</div><div class="field"><label>Bildtitel / Caption</label><input name="image-${index}-caption" value="${escapeHtml(image.caption || image.title || "")}"></div><div class="field"><label>Alt-Text</label><input name="image-${index}-altText" value="${escapeHtml(image.altText || image.fileName || "")}"></div><label class="checkbox-line"><input type="checkbox" name="image-${index}-remove"> Bild aus Galerie entfernen</label></article>`).join("") : `<div class="alert">Noch keine Bilder. Bitte Bilder hochladen und speichern.</div>`}</div>
        </section>
        <section class="gallery-editor">
          <div class="gallery-editor__head"><div><p class="eyebrow">Uploadfolder</p><h3>Bilder freigeben und zuordnen</h3></div></div>
          <p class="muted">Alle hochgeladenen Bilder laufen hier zusammen. Ausgewaehlte Bilder werden beim Speichern freigegeben und dieser Galerie hinzugefuegt.</p>
          ${uploadCandidates}
        </section>
        <button class="button button--primary">Galerie speichern</button><div id="gallery-save-result"></div>
      </form></section>`));
  }
  const editorialKind = item.page || item.section || query.get("page") || query.get("section");
  const isMemberAreaEditor = module === "editorialContent"
    && (editorialKind === "member-area" || query.get("section") === "member-area" || isMemberAreaEditorialItem(item));
  if (module === "editorialContent" && (isMemberAreaEditor || ["press", "news", "pressRelease"].includes(editorialKind) || isPressEditorialItem(item) || isNewsEditorialItem(item))) {
    const sectionKey = isMemberAreaEditor
      ?"member-area"
      : item.page === "news" || item.section === "news" || query.get("page") === "news" || query.get("section") === "news" ?"news" : "press";
    const [allEditorial, events, sponsors, galleries] = await Promise.all([list("editorialContent"), list("events"), list("sponsors"), list("galleries")]);
    const categories = Array.from(new Set(allEditorial
      .filter((entry) => entry.page === sectionKey)
      .map((entry) => entry.category || (sectionKey === "press" ?"Presse" : sectionKey === "member-area" ?"Member Infos" : "News"))
      .filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const categoryValue = item.category || (sectionKey === "press" ?"Presse" : sectionKey === "member-area" ?"Member Infos" : "News");
    const categoryOptions = Array.from(new Set([categoryValue, sectionKey === "press" ?"Rückblicke" : "", ...categories])).filter(Boolean);
    const backPath = sectionKey === "press" ?"editorial/press" : sectionKey === "member-area" ?"editorial/member-area" : "editorial/news";
    const defaultRetrospectivePrompt = `Erstelle aus der folgenden Pressemitteilung einen redaktionellen Rückblicksbeitrag für PROdigitalTV.

Ziel:
Der Text soll nicht wie eine Pressemitteilung wirken, sondern wie ein nachträglicher redaktioneller Rückblick auf eine bereits stattgefundene Veranstaltung.

Schreibe vollständig in der Vergangenheitsform.

Aufgaben:
- Formuliere den Text journalistisch, seriös und flüssig.
- Ordne die Inhalte thematisch neu, nicht zwingend in der Reihenfolge der Pressemitteilung.
- Beginne mit einem starken Einstieg, der Veranstaltung, Anlass und Bedeutung zusammenfasst.
- Beschreibe danach die wichtigsten Themen, Aussagen, Gäste, Diskussionen und Erkenntnisse.
- Stelle heraus, welchen Mehrwert die Veranstaltung für Mitglieder, Gäste und die Branche hatte.
- Verwende klare Absätze mit Zwischenüberschriften.
- Vermeide werbliche prache.
- Keine reine Aufzählung der Pressemitteilung übernehmen.
- Keine Zukunftsankündigungen so formulieren, als ständen sie noch bevor.
- Falls in der Pressemitteilung Ankündigungen enthalten sind, wandle sie in Rückblicksform um.
- Zitate nur verwenden, wenn sie im Ausgangstext vorhanden sind.
- Keine Fakten erfinden.
- Namen, Orte, Datum, Unternehmen und Veranstaltungsformate korrekt übernehmen.

Gewünschte Struktur:
1. Titel
2. Kurzer Teaser mit 2 bis 3 Sätzen
3. Redaktioneller Fließtext mit Zwischenüberschriften
4. Optionaler Abschlussabsatz mit Einordnung für PROdigitalTV

Ton:
Professionell, redaktionell, sachlich, hochwertig, verständlich.

Ausgangstext:
{{pressemitteilung}}`;
    const retrospectivePrompt = defaultRetrospectivePrompt;
    const eventOptions = [`<option value="">Kein Event verknuepfen</option>`, ...events
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .map((event) => `<option value="${escapeHtml(event.id)}" ${item.linkedEventId === event.id ?"selected" : ""}>${escapeHtml([event.date, event.title].filter(Boolean).join(" · "))}</option>`)].join("");
    const sponsorOptions = [`<option value="">Kein Sponsorlogo</option>`, ...sponsors
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map((sponsor) => `<option value="${escapeHtml(sponsor.id)}" ${item.sponsorId === sponsor.id ?"selected" : ""}>${escapeHtml([sponsor.name, sponsor.role].filter(Boolean).join(" · "))}</option>`)].join("");
    const galleryOptions = [`<option value="">Keine Galerie</option>`, ...galleries
      .filter((gallery) => gallery.status !== "archived")
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
      .map((gallery) => `<option value="${escapeHtml(gallery.id)}" data-gallery-payload="${galleryPayloadAttribute(gallery)}" ${item.galleryId === gallery.id ?"selected" : ""}>${escapeHtml(gallery.title || gallery.id)} (${(gallery.images || []).length})</option>`)].join("");
    const selectedGallery = item.galleryId ?galleries.find((gallery) => gallery.id === item.galleryId) : null;
    const selectedGalleryPreview = selectedGallery
      ?`<div class="editor-gallery-preview" data-editor-gallery-preview>
          <div>
            <strong>${escapeHtml(selectedGallery.title || "Bildergalerie")}</strong>
            <span>${(selectedGallery.images || []).length} Bilder</span>
          </div>
          ${galleryPlayerButton(selectedGallery, "Galerie abspielen")}
        </div>`
      : `<div class="editor-gallery-preview editor-gallery-preview--empty" data-editor-gallery-preview><p class="muted">Keine Galerie ausgewaehlt. Nach dem Speichern erscheint hier der Playbutton für die verknuepfte Galerie.</p></div>`;
    const isRetrospectiveEditor = sectionKey === "press" && (item.isRetrospective || ["Rückblicke", "Rückblicke"].includes(item.category) || item.linkedEventId);
    const thumbState = `${editorialSummaryThumb(item)}${item.imageUrl ?`<small class="editorial-tool-state editorial-tool-state--ready">Thumb vorhanden</small>` : `<small class="editorial-tool-state">Kein Thumb</small>`}`;
    const audioState = item.audioUrl ?`<small class="editorial-tool-state editorial-tool-state--ready">Audio vorhanden</small>` : `<small class="editorial-tool-state">Kein Audio</small>`;
    const galleryState = selectedGallery ?`<small class="editorial-tool-state editorial-tool-state--ready">${escapeHtml(selectedGallery.title || "Galerie")} · ${(selectedGallery.images || []).length} Bilder</small>` : `<small class="editorial-tool-state">Keine Galerie</small>`;
    const selectedDocumentId = item.downloadId || item.download_id || item.documentId || item.document_id || "";
    const selectedDocument = selectedDocumentId ?documentLibrary.find((document) => document.id === selectedDocumentId) : null;
    const selectedDocumentUrl = selectedDocument?.documentUrl || selectedDocument?.assetUrl || selectedDocument?.fileUrl || selectedDocument?.downloadUrl || selectedDocument?.url || item.documentUrl || "";
    const selectedDocumentTitle = selectedDocument?.title || selectedDocument?.fileName || item.documentTitle || item.documentFileName || item.assetFileName || "PDF-Anhang";
    const documentOptions = documentLibrary.map((document) => `<option value="${escapeHtml(document.id)}" ${document.id === selectedDocumentId ?"selected" : ""}>${escapeHtml(document.title || document.fileName || document.id)}${document.documentCollection === "memberDocuments" ?" / Mitglieder" : ""}</option>`).join("");
    const documentState = selectedDocumentUrl ?`<small class="editorial-tool-state editorial-tool-state--ready">PDF vorhanden</small>` : `<small class="editorial-tool-state">Kein PDF</small>`;
    const documentTitle = selectedDocumentTitle;
    const publicArticlePath = sectionKey === "member-area" ?`portal/article/${item.id}` : isRetrospectiveEditor ?`retrospective/${item.id}` : sectionKey === "news" ?`news/${item.id}` : `retrospective/${item.id}`;
    const publicArticleHref = `/?real=1#/${escapeHtml(publicArticlePath)}`;
    const sourceJsonValue = JSON.stringify(item.source_snapshot_json || item.sources || [], null, 2);
    const tagsValue = Array.isArray(item.tags) ?item.tags.join(", ") : item.tags || "";
    const editorTitle = sectionKey === "press" ?"Pressemeldung bearbeiten" : sectionKey === "member-area" ?"Mitgliederbeitrag bearbeiten" : "News bearbeiten";
    return protect(cmsShell(`cms/${backPath}`, `${cmsTitle("Redaktion", editorTitle, `<a class="button button--secondary button--small" href="#/cms/${backPath}">Zurueck</a>`)}
      <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid">
        <input type="hidden" name="page" value="${escapeHtml(sectionKey)}">
        <input type="hidden" name="section" value="${escapeHtml(sectionKey === "press" ?"pressRelease" : sectionKey)}">
        ${sectionKey === "member-area" ?`<input type="hidden" name="visibility" value="members">` : ""}
        <input type="hidden" name="key" value="${escapeHtml(item.key || `${sectionKey}.${item.id}`)}">
        <input type="hidden" name="validFrom" value="${escapeHtml(item.validFrom || item.publishDate || "")}">
        <div class="editorial-workspace editorial-workspace--text-editor">
          <div class="editorial-workspace__main">
            <div class="editorial-workflow-actions">
              <button class="button button--secondary button--small" type="button" data-editorial-preview-layer>Vorschau</button>
              <button class="button button--secondary button--small" type="button" data-editor-tool-open="audio">Audio</button>
              <button class="button button--secondary button--small" type="button" data-editor-tool-open="gallery">Galerie</button>
              <button class="button button--secondary button--small" type="button" data-editor-tool-open="pdf">PDF</button>
              <button class="button button--secondary button--small" type="button" data-editor-tool-open="videos">Video</button>
            </div>
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Titel / Headline</label>${aiFieldActions([{ action: "improveText", target: "title", label: "Headline erzeugen", entityType: module, entityId: item.id, fieldName: "title" }])}</div><textarea name="title" rows="2" required>${escapeHtml(item.title || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Subline</label>${aiFieldActions([{ action: "improveText", target: "subtitle", label: "Subline erzeugen", entityType: module, entityId: item.id, fieldName: "subtitle" }])}</div><textarea name="subtitle" rows="2">${escapeHtml(item.subtitle || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Haupttext</label>${aiFieldActions(sectionKey === "press" ?[{ action: "improveText", target: "bodyText", label: "Text bearbeiten", entityType: module, entityId: item.id, fieldName: "bodyText" }, { action: "rewritePressRetrospective", target: "bodyText", label: "Rückblick aus Pressemitteilung", entityType: module, entityId: item.id, fieldName: "bodyText", promptField: "retrospectivePrompt" }] : [{ action: "improveText", target: "bodyText", label: "Text bearbeiten", entityType: module, entityId: item.id, fieldName: "bodyText" }])}</div><textarea name="bodyText" required>${escapeHtml(item.bodyText || "")}</textarea></div>
            <div class="field editorial-text-field"><div class="editorial-field-head"><label>Shorttext / Intro</label>${aiFieldActions([{ action: "shortenText", target: "introText", label: "Kurztext erzeugen", entityType: module, entityId: item.id, fieldName: "introText" }])}</div><textarea name="introText">${escapeHtml(item.introText || "")}</textarea></div>
            <div class="actions editorial-save-inline">
              <button class="button button--primary">Speichern</button>
            </div><div id="content-save-result"></div>
          </div>
          <aside class="editorial-tools">
            <section class="editorial-meta-panel">
              <div class="editorial-tools__head"><p class="eyebrow">Meta</p><h3>Veroeffentlichung</h3></div>
              <div class="field"><label>Kategorie</label><select name="category">${categoryOptions.map((category) => `<option value="${escapeHtml(category)}" ${category === categoryValue ?"selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></div>
              ${sectionKey === "news" ?`<div class="field"><label>Tags</label><input name="tags" value="${escapeHtml(tagsValue)}" placeholder="Streaming, KI, Vermarktung"></div>` : ""}
              <div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ?"selected" : ""}>Entwurf</option><option value="published" ${item.status === "published" ?"selected" : ""}>Veroeffentlicht / Aktiv</option><option value="archived" ${item.status === "archived" ?"selected" : ""}>Archiviert</option></select></div>
              <div class="meta-date-row"><div class="field"><label>Veroeffentlichungsdatum</label><input type="date" name="publishDate" value="${escapeHtml(item.publishDate || "")}"></div><div class="field"><label>Enddatum</label><input type="date" name="validTo" value="${escapeHtml(item.validTo || "")}"></div></div>
            </section>
            <details class="editorial-tool-details">
              <summary><span>Medien</span><strong>Bild / Thumb</strong>${thumbState}</summary>
              <div class="editor-tool-section editor-tool-section--thumb"><div class="field"><label>Bild / Thumb</label>${imageDropzone({ inputName: "assetFile", removeName: "removeAssetFile", imageUrl: item.imageUrl || "", label: "Bild", defaultize: "1200x675", aiCollage: false })}${linkedMediaActions({ collection: module, id: item.id, field: "imageUrl", altField: "thumbnail_alt", returnTo: `#/cms/edit?module=${module}&id=${item.id}&section=${sectionKey}`, assetId: item.thumbnail_media_asset_id || item.mediaAssetId || recordMediaAsset(item, editMediaAssets, module, "imageUrl")?.id || "" })}</div>${sectionKey === "news" ?`<div class="field"><label>Thumbnail-Prompt</label><textarea name="thumbnail_prompt">${escapeHtml(item.thumbnail_prompt || item.thumbnailPrompt || "")}</textarea></div><div class="field"><label>Thumbnail-Alt-Text</label><input name="thumbnail_alt" value="${escapeHtml(item.thumbnail_alt || item.thumbnailAlt || "")}"></div>` : ""}</div>
            </details>
            <details class="editorial-tool-details" data-editor-tool-panel="audio">
              <summary><span>Audio</span><strong>Vorlesen</strong>${audioState}</summary>
              <div class="editor-tool-section editor-tool-section--audio">${audioGenerationPanel("editorialContent", item, { providerConfig: audioProviders })}</div>
            </details>
            <details class="editorial-tool-details" data-editor-tool-panel="gallery">
              <summary><span>Medien</span><strong>Galerie</strong>${galleryState}</summary>
              <div class="editor-tool-section editor-tool-section--gallery">
                <div class="field"><label>Bildergalerie</label><select name="galleryId">${galleryOptions}</select><p class="muted">Eine ausgewaehlte Galerie wird im Artikel als Playbutton mit Slideshow-Layer eingebunden.</p></div>
                ${selectedGalleryPreview}
                <div class="tool-button-row">
                  <button class="button button--secondary button--small" type="button" data-save-gallery-link>Galerie verknuepfen</button>
                  <button class="icon-button icon-button--danger" type="button" data-clear-linked-media="gallery" title="Galerie-Verknuepfung loesen" aria-label="Galerie-Verknuepfung loesen">${iconImage("trash")}</button>
                </div>
                <div class="gallery-link-result" data-gallery-link-result></div>
              </div>
            </details>
            <details class="editorial-tool-details" data-editor-tool-panel="pdf">
              <summary><span>Medien</span><strong>PDF</strong>${documentState}</summary>
              <div class="editor-tool-section editor-tool-section--pdf">
                ${selectedDocumentUrl ?`<div class="member-pdf-asset"><strong>${escapeHtml(documentTitle)}</strong><a class="button button--secondary button--small" href="${escapeHtml(selectedDocumentUrl)}" target="_blank" rel="noreferrer">PDF oeffnen</a></div>` : `<p class="muted">Noch kein PDF-Anhang vorhanden.</p>`}
                <div class="field"><label>Dokument zuordnen</label><select name="downloadId"><option value="">Kein PDF zugeordnet</option>${documentOptions}</select><p class="muted">PDFs werden zentral in der Dokumentenverwaltung gepflegt und hier nur verknuepft.</p></div>
              </div>
            </details>
            ${articleVideoAttachmentEditor(item, videoLibrary)}
            ${sectionKey === "member-area" ?"" : `<details class="editorial-tool-details">
              <summary><span>Werkzeuge</span><strong>Rückblick & Verknüpfungen</strong></summary>
            <section class="retrospective-tool">
              ${sectionKey === "news" ?`<div class="field"><label>Quellen</label><textarea name="source_snapshot_json_text" placeholder='[{ "title": "", "url": "", "source_type": "" }]'>${escapeHtml(sourceJsonValue)}</textarea></div><div class="field"><label>Interne Hinweise</label><textarea name="editorial_note">${escapeHtml(item.editorial_note || item.editorialNote || "")}</textarea></div>` : ""}
              <div class="field"><label>Rückblick-Prompt</label><textarea name="retrospectivePrompt">${escapeHtml(retrospectivePrompt)}</textarea></div>
              <div class="field"><label>Event-Bezug</label><select name="linkedEventId">${eventOptions}</select></div>
              <div class="field"><label>Sponsorlogo</label><select name="sponsorId">${sponsorOptions}</select></div>
              <label class="checkbox-line"><input type="checkbox" name="isRetrospective" ${item.isRetrospective ?"checked" : ""}> Unter Rückblicke / Event-Nachlauf anzeigen</label>
              <label class="checkbox-line"><input type="checkbox" name="showGallery" ${item.showGallery ?"checked" : ""}> Bildergalerie aus Event-Medien anzeigen</label>
              <input type="hidden" name="galleryEventId" value="${escapeHtml(item.galleryEventId || item.linkedEventId || "")}">
              <p class="muted">Im Rückblick-Modus formuliert ChatGPT Headline, Subline und Haupttext als nachträgliche Berichterstattung über das vergangene Event.</p>
              ${aiFieldActions([{ action: "rewritePressRetrospective", target: "bodyText", label: "Rückblick-Fliesstext erzeugen", entityType: module, entityId: item.id, fieldName: "bodyText", promptField: "retrospectivePrompt" }])}
            </section>
            </details>`}
          </aside>
        </div>
        <input type="hidden" name="visibility" value="${escapeHtml(item.visibility || "public")}">
      </form></section>`));
  }
  if (module === "topics") {
    const galleries = await list("galleries");
    const galleryOptions = [`<option value="">Keine Galerie</option>`, ...galleries
      .filter((gallery) => gallery.status !== "archived")
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
      .map((gallery) => `<option value="${escapeHtml(gallery.id)}" data-gallery-payload="${galleryPayloadAttribute(gallery)}" ${item.galleryId === gallery.id ?"selected" : ""}>${escapeHtml(gallery.title || gallery.id)} (${(gallery.images || []).length})</option>`)].join("");
    const selectedGallery = item.galleryId ?galleries.find((gallery) => gallery.id === item.galleryId) : null;
    const selectedGalleryPreview = selectedGallery
      ?`<div class="editor-gallery-preview" data-editor-gallery-preview>
          <div>
            <strong>${escapeHtml(selectedGallery.title || "Bildergalerie")}</strong>
            <span>${(selectedGallery.images || []).length} Bilder</span>
          </div>
          ${galleryPlayerButton(selectedGallery, "Galerie abspielen")}
        </div>`
      : `<div class="editor-gallery-preview editor-gallery-preview--empty" data-editor-gallery-preview><p class="muted">Keine Galerie verknuepft. Galerie auswaehlen, speichern, danach kann sie hier abgespielt werden.</p></div>`;
    const thumbState = `${editorialSummaryThumb(item)}${item.imageUrl ?`<small class="editorial-tool-state editorial-tool-state--ready">Thumb vorhanden</small>` : `<small class="editorial-tool-state">Kein Thumb</small>`}`;
    const audioState = item.audioUrl ?`<small class="editorial-tool-state editorial-tool-state--ready">Audio vorhanden</small>` : `<small class="editorial-tool-state">Kein Audio</small>`;
    const galleryState = selectedGallery ?`<small class="editorial-tool-state editorial-tool-state--ready">${escapeHtml(selectedGallery.title || "Galerie")} · ${(selectedGallery.images || []).length} Bilder</small>` : `<small class="editorial-tool-state">Keine Galerie</small>`;
    return protect(cmsShell("cms/topics", `${cmsTitle("Redaktion", "Thema bearbeiten", `<a class="button button--secondary button--small" href="#/cms/topics">Zurueck</a>`)}
      <section class="panel"><form id="topic-editor-form" data-topic-id="${item.id}" class="form-grid is-save-aware">
        <div class="editorial-workspace editorial-workspace--text-editor">
          <div class="editorial-workspace__main">
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Titel / Headline</label>${aiFieldActions([{ action: "improveText", target: "title", label: "Headline erzeugen", entityType: module, entityId: item.id, fieldName: "title" }])}</div><textarea name="title" rows="2" required>${escapeHtml(item.title || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Subline</label>${aiFieldActions([{ action: "improveText", target: "subtitle", label: "Subline erzeugen", entityType: module, entityId: item.id, fieldName: "subtitle" }])}</div><textarea name="subtitle" rows="2">${escapeHtml(item.subtitle || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Haupttext</label>${aiFieldActions([{ action: "generateTopicDescription", target: "longDescription", label: "Text erzeugen", entityType: module, entityId: item.id, fieldName: "longDescription" }])}</div><textarea name="longDescription">${escapeHtml(item.longDescription || item.bodyText || "")}</textarea></div>
            <div class="field editorial-text-field"><div class="editorial-field-head"><label>Shorttext / Intro</label>${aiFieldActions([{ action: "shortenText", target: "shortDescription", label: "Kurztext erzeugen", entityType: module, entityId: item.id, fieldName: "shortDescription" }])}</div><textarea name="shortDescription">${escapeHtml(item.shortDescription || item.introText || "")}</textarea></div>
          </div>
          <aside class="editorial-tools">
            <section class="editorial-meta-panel">
              <div class="editorial-tools__head"><p class="eyebrow">Meta</p><h3>Veroeffentlichung</h3></div>
              <div class="field"><label>Kategorie</label><input name="category" value="${escapeHtml(item.category || "Thema")}"></div>
              <div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ?"selected" : ""}>Entwurf</option><option value="active" ${item.status === "active" ?"selected" : ""}>Veroeffentlicht / Aktiv</option><option value="inactive" ${item.status === "inactive" ?"selected" : ""}>Inaktiv</option><option value="archived" ${item.status === "archived" ?"selected" : ""}>Archiviert</option></select></div>
              <div class="meta-date-row"><div class="field"><label>Veroeffentlichungsdatum</label><input type="date" name="publishDate" value="${escapeHtml(item.publishDate || "")}"></div><div class="field"><label>Enddatum</label><input type="date" name="validTo" value="${escapeHtml(item.validTo || "")}"></div></div>
            </section>
            <details class="editorial-tool-details">
              <summary><span>Medien</span><strong>Bild / Thumb</strong>${thumbState}</summary>
              <div class="editor-tool-section editor-tool-section--thumb"><div class="field"><label>Bild / Thumb</label>${imageDropzone({ inputName: "topicImage", removeName: "removeTopicImage", imageUrl: topicImageUrl(item, editMediaAssets), label: "Themenbild", defaultize: "1200x675", aiCollage: false })}${linkedMediaActions({ collection: "topics", id: item.id, field: "imageUrl", altField: "thumbnail_alt", returnTo: `#/cms/edit?module=topics&id=${item.id}`, assetId: item.thumbnail_media_asset_id || item.mediaAssetId || recordMediaAsset(item, editMediaAssets, "topics", "imageUrl")?.id || "" })}</div></div>
            </details>
            <details class="editorial-tool-details">
              <summary><span>Medien</span><strong>Galerie</strong>${galleryState}</summary>
              <div class="editor-tool-section editor-tool-section--gallery">
                <div class="field"><label>Bildergalerie</label><select name="galleryId">${galleryOptions}</select><p class="muted">Die Galerie wird mit dem Thema verknuepft und im Frontend als Slideshow-Playbutton angezeigt.</p></div>
                ${selectedGalleryPreview}
                <div class="tool-button-row">
                  <button class="button button--secondary button--small" type="button" data-save-gallery-link>Galerie verknuepfen</button>
                  <button class="icon-button icon-button--danger" type="button" data-clear-linked-media="gallery" title="Galerie-Verknuepfung loesen" aria-label="Galerie-Verknuepfung loesen">${iconImage("trash")}</button>
                </div>
                <div class="gallery-link-result" data-gallery-link-result></div>
              </div>
            </details>
            <details class="editorial-tool-details">
              <summary><span>Audio</span><strong>Vorlesen</strong>${audioState}</summary>
              <div class="editor-tool-section editor-tool-section--audio">${audioGenerationPanel("topics", item, { providerConfig: audioProviders })}</div>
            </details>
          </aside>
        </div>
        <div class="actions"><button class="button button--primary">Speichern</button></div><div id="topic-editor-result"></div>
      </form></section>`));
  }
  if (module === "editorialContent" && (item.key === "home.hero" || item.id === "home-hero")) {
    return protect(cmsShell("cms/editorial/interna", `${cmsTitle("Startseite", "Hero bearbeiten", `<div class="actions"><button class="button button--secondary button--small" type="button" data-internal-preview="${escapeHtml(item.id)}">Vorschau</button><a class="button button--secondary button--small" href="#/cms/editorial/interna">Zurueck</a></div>`)}
      <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid is-save-aware">
        <input type="hidden" name="status" value="${escapeHtml(item.status || "published")}">
        <input type="hidden" name="visibility" value="${escapeHtml(item.visibility || "public")}">
        <div class="editorial-workspace editorial-workspace--text-editor editorial-workspace--interna">
          <div class="editorial-workspace__main">
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Claim / Eyebrow</label>${aiFieldActions([{ action: "improveText", target: "teaserText", label: "Claim neu formulieren", entityType: module, entityId: item.id, fieldName: "teaserText" }])}</div><textarea name="teaserText" rows="2">${escapeHtml(item.teaserText || "PROdigitalTV")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Hero-Headline</label>${aiFieldActions([{ action: "improveText", target: "title", label: "Titel neu formulieren", entityType: module, entityId: item.id, fieldName: "title" }])}</div><textarea name="title" rows="2" required>${escapeHtml(item.title || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Hero-Subheadline</label>${aiFieldActions([{ action: "improveText", target: "subtitle", label: "Text neu formulieren", entityType: module, entityId: item.id, fieldName: "subtitle" }])}</div><textarea name="subtitle">${escapeHtml(item.subtitle || "")}</textarea></div>
            <div class="actions editorial-save-inline"><button class="button button--primary" type="submit">Speichern</button><div id="content-save-result"></div></div>
          </div>
          <aside class="editorial-tools">
            <details class="editorial-tool-details">
              <summary><span>Meta</span><strong>Startseiten-Hero</strong></summary>
              <div class="editor-tool-section"><p class="muted">Sichtbarkeit und Status werden in der Liste ueber das Auge gesteuert.</p></div>
            </details>
            <details class="editorial-tool-details">
              <summary><span>Aktion</span><strong>Buttons / Links</strong></summary>
              <div class="editor-tool-section">
                <div class="field"><label>CTA 1 Text</label><input name="buttonText" value="${escapeHtml(item.buttonText || "Naechstes Event")}"></div>
                <div class="field"><label>CTA 1 Link</label><input name="buttonUrl" value="${escapeHtml(item.buttonUrl || "#/events")}"></div>
                <div class="field"><label>CTA 2 Text</label><input name="secondaryButtonText" value="${escapeHtml(item.secondaryButtonText || "Mitglied werden")}"></div>
                <div class="field"><label>CTA 2 Link</label><input name="secondaryButtonUrl" value="${escapeHtml(item.secondaryButtonUrl || "#/join")}"></div>
              </div>
            </details>
            <details class="editorial-tool-details">
              <summary><span>Medien</span><strong>Hero-Bild</strong></summary>
              <div class="editor-tool-section"><div class="field"><label>Hero-Bild</label><div class="asset-preview">${item.imageUrl ?`<img src="${escapeHtml(item.imageUrl)}" alt="">` : `<p class="muted">Noch kein Bild zugeordnet.</p>`}</div>${linkedMediaActions({ collection: "editorialContent", id: item.id, field: "imageUrl", altField: "thumbnail_alt", returnTo: `#/cms/edit?module=editorialContent&id=${item.id}&section=interna`, label: "Bild", assetId: item.thumbnail_media_asset_id || item.mediaAssetId || recordMediaAsset(item, editMediaAssets, "editorialContent", "imageUrl")?.id || "" })}<p class="muted">Bild aus der Mediathek zuordnen oder dort neu erstellen.</p></div></div>
            </details>
          </aside>
        </div>
      </form></section>`));
  }
  if (module === "editorialContent" && isInternalEditorialItem(item)) {
    const managed = ["ueber_uns", "mitglied_werden"].includes(item.bereich) || item.editorialManaged;
    const internalDownloads = [
      ...(await list("downloads").catch(() => [])),
      ...(await list("memberDocuments").catch(() => []))
    ].filter((download) => !["archived", "deleted"].includes(String(download.status || "").toLowerCase()))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.title || "").localeCompare(String(b.title || ""), "de"));
    const internalDownloadOptions = internalDownloads
      .map((download) => `<option value="${escapeHtml(download.id)}" ${(item.downloadId || item.download_id) === download.id ?"selected" : ""}>${escapeHtml(download.title || download.fileName || download.id)}</option>`)
      .join("");
    const internalDocumentField = `<div class="field field--internal-download"><label>Dokument aus Dokumentenverwaltung</label><select name="downloadId"><option value="">Kein Dokument zugeordnet</option>${internalDownloadOptions}</select><p class="muted">Dokumente werden zentral gepflegt und hier nur verknuepft.</p></div>`;
    const internalImageField = `<div class="field"><label>Bild</label><div class="asset-preview">${item.imageUrl ?`<img src="${escapeHtml(item.imageUrl)}" alt="">` : `<p class="muted">Noch kein Bild zugeordnet.</p>`}</div>${linkedMediaActions({ collection: "editorialContent", id: item.id, field: "imageUrl", altField: "thumbnail_alt", returnTo: `#/cms/edit?module=editorialContent&id=${item.id}&section=interna`, label: "Bild", assetId: item.thumbnail_media_asset_id || item.mediaAssetId || recordMediaAsset(item, editMediaAssets, "editorialContent", "imageUrl")?.id || "" })}<p class="muted">Bild aus der Mediathek zuordnen oder dort neu erstellen.</p></div>`;
    if (managed) {
      const joinDownloadField = item.bereich === "mitglied_werden" ?internalDocumentField : "";
      const statusValue = item.status || "aktiv";
      const visibilityValue = item.sichtbarkeit || item.visibility || "oeffentlich";
      return protect(cmsShell("cms/editorial/interna", `${cmsTitle("Interna", "Textbaustein bearbeiten", `<div class="actions"><button class="button button--secondary button--small" type="button" data-internal-preview="${escapeHtml(item.id)}">Vorschau</button><a class="button button--secondary button--small" href="#/cms/editorial/interna">Zurueck</a></div>`)}
        <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid is-save-aware">
          <input type="hidden" name="status" value="${escapeHtml(statusValue)}">
          <input type="hidden" name="sichtbarkeit" value="${escapeHtml(visibilityValue)}">
          <div class="editorial-workspace editorial-workspace--text-editor editorial-workspace--interna">
            <div class="editorial-workspace__main">
              <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Titel</label>${aiFieldActions([{ action: "improveText", target: "titel", label: "Titel neu formulieren", entityType: module, entityId: item.id, fieldName: "titel" }])}</div><textarea name="titel" rows="2" required>${escapeHtml(item.titel || item.title || "")}</textarea></div>
              <div class="field editorial-text-field"><div class="editorial-field-head"><label>Kurztext</label>${aiFieldActions([{ action: "shortenText", target: "kurztext", label: "Kurztext neu formulieren", entityType: module, entityId: item.id, fieldName: "kurztext" }])}</div><textarea name="kurztext">${escapeHtml(item.kurztext || item.introText || "")}</textarea></div>
              <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Langtext</label>${aiFieldActions([{ action: "improveText", target: "langtext", label: "Text neu formulieren", entityType: module, entityId: item.id, fieldName: "langtext" }])}</div><textarea name="langtext">${escapeHtml(item.langtext || item.bodyText || "")}</textarea></div>
              <div class="actions editorial-save-inline"><button class="button button--primary" type="submit">Speichern</button><div id="content-save-result"></div></div>
            </div>
            <aside class="editorial-tools">
              <details class="editorial-tool-details">
                <summary><span>Meta</span><strong>Interna-Block</strong></summary>
                <div class="editor-tool-section">
                <div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug || item.id || "")}" required><p class="muted">Nach Anlage möglichst nicht mehr ändern.</p></div>
                <div class="field field--internal-area"><label>Bereich</label><select name="bereich"><option value="ueber_uns" ${item.bereich === "ueber_uns" ?"selected" : ""}>Über uns</option><option value="mitglied_werden" ${item.bereich === "mitglied_werden" ?"selected" : ""}>Mitglied werden</option></select></div>
                <div class="field field--internal-type"><label>Typ</label><select name="typ">${["hero", "textblock", "vorteil", "eventformat", "kachelgruppe", "cta"].map((type) => `<option value="${type}" ${item.typ === type ?"selected" : ""}>${type}</option>`).join("")}</select></div>
                <div class="field"><label>Sortierung</label><input name="sortierung" type="number" value="${escapeHtml(item.sortierung ?? item.sortOrder ?? 10)}"></div>
                <div class="field"><label>Icon</label><input name="icon" value="${escapeHtml(item.icon || "")}" placeholder="network, compass, law ..."></div>
                <p class="muted">Sichtbarkeit und Status werden in der Liste über das Auge gesteuert.</p>
                </div>
              </details>
              <details class="editorial-tool-details">
                <summary><span>Aktion</span><strong>Button / Link</strong></summary>
                <div class="editor-tool-section"><div class="field"><label>Button-Text optional</label><input name="button_text" value="${escapeHtml(item.button_text || item.buttonText || "")}"></div><div class="field"><label>Button-Ziel optional</label><input name="button_ziel" value="${escapeHtml(item.button_ziel || item.buttonUrl || "")}"></div></div>
              </details>
              <details class="editorial-tool-details">
                <summary><span>Medien</span><strong>Bild</strong></summary>
                <div class="editor-tool-section">${internalImageField}</div>
              </details>
              ${joinDownloadField ?`<details class="editorial-tool-details"><summary><span>Dokument</span><strong>Download</strong></summary><div class="editor-tool-section">${joinDownloadField}</div></details>` : ""}
              <details class="editorial-tool-details">
                <summary><span>Audio</span><strong>Audio & Barrierefreiheit</strong>${audioStatusBadge(audioVariantState("editorialContent", item, "accessible"))}</summary>
                <div class="editor-tool-section editor-tool-section--audio">${audioGenerationPanel("editorialContent", item, { providerConfig: audioProviders })}</div>
              </details>
            </aside>
          </div>
        </form></section>`));
    }
    return protect(cmsShell("cms/editorial/interna", `${cmsTitle("Interna", "Textbaustein bearbeiten", `<div class="actions"><button class="button button--secondary button--small" type="button" data-internal-preview="${escapeHtml(item.id)}">Vorschau</button><a class="button button--secondary button--small" href="#/cms/editorial/interna">Zurueck</a></div>`)}
      <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid is-save-aware">
        <input type="hidden" name="page" value="${escapeHtml(item.page || "")}">
        <input type="hidden" name="section" value="${escapeHtml(item.section || "")}">
        <input type="hidden" name="key" value="${escapeHtml(item.key || "")}">
        <input type="hidden" name="status" value="published">
        <input type="hidden" name="visibility" value="public">
        <div class="editorial-workspace editorial-workspace--text-editor editorial-workspace--interna">
          <div class="editorial-workspace__main">
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Titel</label>${aiFieldActions([{ action: "improveText", target: "title", label: "Titel neu formulieren", entityType: module, entityId: item.id, fieldName: "title" }])}</div><textarea name="title" rows="2">${escapeHtml(item.title || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Text</label>${aiFieldActions([{ action: "improveText", target: "bodyText", label: "Text neu formulieren", entityType: module, entityId: item.id, fieldName: "bodyText" }])}</div><textarea name="bodyText">${escapeHtml(item.bodyText || "")}</textarea></div>
            <div class="actions editorial-save-inline"><button class="button button--primary" type="submit">Speichern</button><div id="content-save-result"></div></div>
          </div>
          <aside class="editorial-tools">
            <details class="editorial-tool-details">
              <summary><span>Meta</span><strong>Interna-Block</strong></summary>
              <div class="editor-tool-section">
              <div class="field"><label>Baustein</label><input value="${escapeHtml(item.key || [item.page, item.section].filter(Boolean).join(" / ") || item.id)}" readonly></div>
              <div class="field"><label>Seite</label><input value="${escapeHtml(item.page || "-")}" readonly></div>
              <div class="field"><label>Abschnitt</label><input value="${escapeHtml(item.section || "-")}" readonly></div>
              <p class="muted">Sichtbarkeit und Status werden in der Liste ueber das Auge gesteuert.</p>
              </div>
            </details>
            <details class="editorial-tool-details">
              <summary><span>Medien</span><strong>Bild / Dokument</strong></summary>
              <div class="editor-tool-section">
                ${internalImageField}
                ${internalDocumentField}
              </div>
            </details>
            <details class="editorial-tool-details">
              <summary><span>Audio</span><strong>Audio & Barrierefreiheit</strong>${audioStatusBadge(audioVariantState("editorialContent", item, "accessible"))}</summary>
              <div class="editor-tool-section editor-tool-section--audio">${audioGenerationPanel("editorialContent", item, { providerConfig: audioProviders })}</div>
            </details>
          </aside>
        </div>
      </form></section>`));
  }
  const fieldHtml = definition.fields.map(([field, label]) => {
    const long = ["description", "shortDescription", "longDescription", "articleText", "topicText", "shortBio", "longBio", "introText", "bodyText", "seoDescription"].includes(field);
    const action = module === "topics" ?"generateTopicDescription" : module === "speakers" ?"generateSpeakerTalkText" : module === "sponsors" ?"generateSponsorText" : "improveText";
    const ai = long || field.toLowerCase().includes("seo") ?aiFieldActions([{ action: field.toLowerCase().includes("seo") ?"generateSeoMeta" : action, target: field, label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: field }]) : "";
    if (module === "users" && field === "memberId") {
      const currentMemberId = item?.memberId || "";
      const options = [
        `<option value="" ${currentMemberId ?"" : "selected"}>Keine Verknuepfung</option>`,
        ...memberOptions.map((member) => `<option value="${escapeHtml(member.id)}" ${currentMemberId === member.id ?"selected" : ""}>${escapeHtml([member.name || member.id, member.city].filter(Boolean).join(" / "))}</option>`)
      ].join("");
      return `<div class="field"><label>${label}</label><select name="memberId">${options}</select><p class="muted">Verknuepft diesen User mit dem Mitgliedsprofil, das er im Mitgliederbereich bearbeiten darf.</p></div>`;
    }
    if (module === "members" && field === "membershipType") {
      const currentType = item?.membershipType || "";
      return `<div class="field"><label>${label}</label><select name="membershipType"><option value="" ${currentType ?"" : "selected"}>Nicht festgelegt</option><option value="company" ${currentType === "company" ?"selected" : ""}>Firmenmitglied</option><option value="individual" ${currentType === "individual" ?"selected" : ""}>Einzelmitglied</option></select></div>`;
    }
    return `<div class="field"><label>${label}</label>${long ?`<textarea name="${field}">${escapeHtml(item?.[field] || "")}</textarea>` : `<input name="${field}" value="${escapeHtml(item?.[field] || "")}">`}${ai}</div>`;
  }).join("");
  const memberField = (field, label) => {
    const long = field === "description" || field === "shortDescription";
    const value = field === "contactName"
      ?item?.contactName || item?.profileContactName || ""
      : field === "contactEmail"
        ?item?.contactEmail || item?.email || ""
        : field === "contactPhone"
          ?item?.contactPhone || item?.phone || ""
          : field === "contactMobile"
            ?item?.contactMobile || item?.mobile || ""
            : field === "description"
              ?memberDescriptionValue(item)
              : item?.[field] || "";
    if (field === "membershipType") {
      const currentType = item?.membershipType || "";
      return `<div class="field"><label>${label}</label><select name="membershipType"><option value="" ${currentType ?"" : "selected"}>Nicht festgelegt</option><option value="company" ${currentType === "company" ?"selected" : ""}>Firmenmitglied</option><option value="individual" ${currentType === "individual" ?"selected" : ""}>Einzelmitglied</option></select></div>`;
    }
    return `<div class="field"><label>${label}</label>${long ?`<textarea name="${field}">${escapeHtml(value)}</textarea>` : `<input name="${field}" value="${escapeHtml(value)}">`}</div>`;
  };
  const memberEventContactLimit = item?.membershipType === "company" ?5 : 1;
  const normalizeMemberEventContact = (contact = {}) => {
    const fullName = String(contact.name || "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    return {
      firstName: contact.firstName || contact.vorname || (parts.length > 1 ?parts.slice(0, -1).join(" ") : fullName),
      lastName: contact.lastName || contact.nachname || (parts.length > 1 ?parts.slice(-1).join(" ") : ""),
      name: fullName,
      role: contact.role || contact.function || contact.department || "",
      email: contact.email || "",
      phone: contact.phone || ""
    };
  };
  const memberEventContacts = Array.isArray(item?.eventContacts) && item.eventContacts.length
    ?item.eventContacts.map(normalizeMemberEventContact)
    : ([{
        firstName: item?.firstName || "",
        lastName: item?.lastName || "",
        name: item?.profileContactName || item?.contactName || [item?.firstName, item?.lastName].filter(Boolean).join(" "),
        role: item?.contactRole || item?.department || "",
        email: item?.contactEmail || item?.email || "",
        phone: item?.phone || item?.contactPhone || item?.mobile || item?.contactMobile || ""
      }].map(normalizeMemberEventContact).filter((contact) => contact.firstName || contact.lastName || contact.name || contact.email || contact.phone));
  const memberEventContactsHtml = module === "members"
    ?`<div class="member-edit-form__event-contacts">
        <p class="eyebrow">Kontaktdaten</p>
        <p class="muted">${memberEventContactLimit === 1 ?"Einzelmitglieder: 1 Kontakt." : "Firmenmitglieder: bis zu 5 Kontakte."}</p>
        ${Array.from({ length: memberEventContactLimit }, (_, index) => {
          const contact = memberEventContacts[index] || {};
          return `<fieldset class="member-event-contact-row">
            <legend>Kontakt ${index + 1}</legend>
            <div class="form-grid form-grid--member-contact">
            <div class="field"><label>Vorname</label><input name="eventContactFirstName${index}" value="${escapeHtml(contact.firstName || "")}"></div>
            <div class="field"><label>Nachname</label><input name="eventContactLastName${index}" value="${escapeHtml(contact.lastName || "")}"></div>
            <div class="field"><label>Funktion</label><select name="eventContactRole${index}">${memberContactFunctionOptions(contact.role || contact.function || contact.department || "")}</select></div>
            <div class="field"><label>Mail</label><input name="eventContactEmail${index}" type="email" value="${escapeHtml(contact.email || "")}"></div>
            <div class="field"><label>Tel. mit Landesvorwahl</label><input name="eventContactPhone${index}" type="tel" placeholder="+49 ..." value="${escapeHtml(contact.phone || "")}"></div>
            </div>
          </fieldset>`;
        }).join("")}
      </div>`
    : "";
  const memberAccessStatus = item?.membershipAccessStatus || "active";
  const memberAccessControls = module === "members"
    ?`<div class="member-edit-form__access">
        <p class="eyebrow">Zugang steuern</p>
        <p class="muted">Ab diesem Datum hat das Mitglied keinen Portalzugang mehr und erscheint nicht mehr im Mitgliederverzeichnis.</p>
        <div class="form-grid form-grid--two">
          <div class="field"><label>Mitgliedschaftsstatus</label><select name="membershipAccessStatus">
            <option value="active" ${memberAccessStatus === "active" ?"selected" : ""}>Aktiv</option>
            <option value="inactive" ${memberAccessStatus === "inactive" ?"selected" : ""}>Inaktiv</option>
            <option value="cancelled" ${memberAccessStatus === "cancelled" ?"selected" : ""}>Gekündigt</option>
          </select></div>
          <div class="field"><label>Gekündigt / inaktiv ab</label><input name="membershipAccessEffectiveAt" type="date" value="${escapeHtml(timestampInputDate(item?.membershipAccessEffectiveAt))}"><p class="muted">Leer = sofort.</p></div>
        </div>
        <label class="checkbox"><input type="checkbox" name="notificationTestGroup" ${item?.notificationTestGroup || item?.isNotificationTestGroup || item?.testGroup ?"checked" : ""}> Teil der Benachrichtigungs-Testgruppe</label>
      </div>`
    : "";
  const imageUpload = module === "topics"
    ?`<div class="field"><label>Themenbild hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das neue Bild ersetzt beim Speichern das zugeordnete Bild.</p></div>`
    : module === "members"
      ?`<div class="field field--member-logo"><label>Logo</label>${memberLogoEditor(item, memberMediaAssets, `#/cms/edit?module=members&id=${item.id}&section=${query.get("section") || "all"}`)}</div>`
      : module === "boardMembers"
      ?`<div class="field"><label>Vorstandsfoto hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das Foto wird beim Speichern dem Vorstandsprofil zugeordnet.</p></div>`
      : module === "speakers"
        ?`<div class="field"><label>Referentenfoto hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das Foto wird beim Speichern dem Referentenprofil zugeordnet und im Eventkontext angezeigt.</p></div>`
      : module === "sponsors"
        ?(() => { const asset = recordMediaAsset(item, editMediaAssets, "sponsors", "logoUrl"); const logoUrl = mediaAssetUrl(asset || {}) || item.logoUrl || ""; return `<div class="field"><label>Logo</label><div class="member-logo-editor"><div class="member-logo-editor__preview">${logoUrl ?`<img src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(item.name || "")}">` : `<span>Noch kein Logo</span>`}</div><div class="member-logo-editor__actions">${linkedMediaActions({ collection: "sponsors", id: item.id, field: "logoUrl", altField: "altText", returnTo: `#/cms/edit?module=sponsors&id=${item.id}`, label: "Logo", assetId: asset?.id || "" })}<input type="file" name="assetFile" accept="image/*"><p class="muted">Logo aus der Mediathek waehlen oder direkt eine neue Datei hochladen.</p></div></div></div>`; })()
      : module === "memberDocuments"
        ?`<div class="field"><label>Dokument hochladen</label><input type="file" name="assetFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*,application/pdf"><p class="muted">PDF oder Datei für den Mitgliederbereich.</p></div>`
      : module === "memberDirectories"
        ?`<div class="field"><label>Verzeichnis-Datei hochladen</label><input type="file" name="assetFile" accept=".pdf,.csv,.xlsx,.xls,application/pdf"><p class="muted">Optionales Mitgliederverzeichnis als Datei.</p></div>`
      : "";
  const speakerManager = module === "topics" ?topicSpeakerManager(item, topicSpeakers) : "";
  const activeStatus = ["topics", "members", "boardMembers", "memberDirectories", "users"].includes(module) ?"active" : "published";
  const editorialBack = query.get("section") && editorialSections[query.get("section")] ?`editorial/${query.get("section")}` : item.page === "press" ?"editorial/press" : item.page === "news" ?"editorial/news" : module === "editorialContent" ?"editorial/interna" : "editorial";
  const backSection = { boardMembers: "board", editorialContent: editorialBack, speakers: "speakers", sponsors: "sponsors", memberDocuments: "member-documents", memberDirectories: "member-directories" }[module] || module;
  const activeSection = { topics: "cms/topics", speakers: "cms/speakers", sponsors: "cms/sponsors", members: "cms/members", memberDocuments: "cms/member-documents", memberDirectories: "cms/member-directories", users: "cms/users", boardMembers: "cms/board", editorialContent: `cms/${editorialBack}` }[module] || "cms/editorial";
  const statusVisibilityControls = module === "members"
    ?""
    : `<div class="form-grid--two"><div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ?"selected" : ""}>Entwurf</option><option value="${activeStatus}" ${item.status === activeStatus ?"selected" : ""}>Veroeffentlicht / Aktiv</option><option value="archived" ${item.status === "archived" ?"selected" : ""}>Archiviert</option></select></div><div class="field"><label>Sichtbarkeit</label><select name="visibility"><option value="public" ${item.visibility === "public" ?"selected" : ""}>Oeffentlich</option><option value="members" ${item.visibility === "members" ?"selected" : ""}>Mitglieder</option><option value="internal" ${item.visibility === "internal" ?"selected" : ""}>Intern</option></select></div></div>`;
  const formClass = module === "members" ?"form-grid form-grid--two member-edit-form" : "form-grid";
  const editorialVideoHtml = module === "editorialContent" ?articleVideoAttachmentEditor(item, videoLibrary) : "";
  const memberWebsiteValue = String(item?.website || item?.url || "").trim();
  const memberWebsiteHref = memberWebsiteValue && /^https?:\/\//i.test(memberWebsiteValue) ?memberWebsiteValue : memberWebsiteValue ?`https://${memberWebsiteValue}` : "";
  const memberWebsiteLink = memberWebsiteHref ?`<p class="muted"><a class="link" href="${escapeHtml(memberWebsiteHref)}" target="_blank" rel="noopener">Website oeffnen</a></p>` : "";
  const memberEditHtml = module === "members"
    ?`<div class="member-edit-form__column member-edit-form__column--identity">
        <section class="member-edit-card">
          <p class="eyebrow">Stammdaten</p>
        <div class="form-grid form-grid--member-base">
          ${memberField("membershipType", "Mitgliedstyp")}
          ${memberField("name", "Firma / Name")}
          ${memberField("street", "Strasse")}
          ${memberField("houseNumber", "Hausnummer")}
          ${memberField("postalCode", "PLZ")}
          ${memberField("city", "Ort")}
          ${memberField("country", "Land")}
        </div>
        </section>
        ${memberEventContactsHtml}
        <section class="member-edit-card member-edit-card--profile-text">
          <p class="eyebrow">Beschreibung und Website</p>
          ${memberField("description", "Beschreibung")}
          ${memberField("website", "Website")}
          ${memberWebsiteLink}
        </section>
        ${memberAccessControls}
      </div>
      <div class="member-edit-form__column member-edit-form__column--content">
        <section class="member-edit-card member-edit-card--profile">
          <p class="eyebrow">Logo</p>
        ${imageUpload}
        </section>
      </div>`
    : `${fieldHtml}${imageUpload}${editorialVideoHtml}`;
  const saveControls = module === "members"
    ?`<div class="member-edit-savebar"><button class="button button--primary">Speichern</button><div id="content-save-result"></div></div>`
    : `<button class="button button--primary">Speichern</button><div id="content-save-result"></div>`;
  return protect(cmsShell(activeSection, `${cmsTitle("Bearbeiten", `${definition.title} pflegen`, `<a class="button button--secondary button--small" href="#/cms/${backSection}">Zurueck</a>`)}<section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="${formClass}">${memberEditHtml}${statusVisibilityControls}${saveControls}</form></section>${speakerManager}`));
}

export async function audioAdminPage() {
  if (!hasCmsAccess()) return denied();
  const [editorial, topics, audioProviders] = await Promise.all([
    list("editorialContent"),
    list("topics"),
    getOne("settings", "audioProviders").catch(() => null)
  ]);
  const editorialRows = editorial
    .filter((item) => isAudioAdminEditorialItem(item))
    .map((item) => ({
      ...item,
      audioCollection: "editorialContent",
      audioArea: audioAreaLabel(item),
      audioSubarea: audioSubareaLabel(item),
      editHref: `#/cms/edit?module=editorialContent&id=${item.id}${item.section ?`&section=${item.section}` : ""}`
    }));
  const topicRows = topics
    .filter((item) => audioSourceText("topics", item))
    .map((item) => ({ ...item, audioCollection: "topics", audioArea: "Themen", audioSubarea: "Themen", editHref: `#/cms/edit?module=topics&id=${item.id}` }));
  const rows = [...editorialRows, ...topicRows].sort((a, b) => {
    const aInfo = activeAudioInfo(a.audioCollection, a);
    const bInfo = activeAudioInfo(b.audioCollection, b);
    const stateOrder = { error: 0, fehler: 0, outdated: 1, veraltet: 1, missing: 2, fehlt: 2, ready: 3, aktuell: 3 };
    return audioAreaRank(a.audioArea) - audioAreaRank(b.audioArea)
      || (stateOrder[String(aInfo.state).toLowerCase()] ?? 4) - (stateOrder[String(bInfo.state).toLowerCase()] ?? 4)
      || String(a.audioArea).localeCompare(String(b.audioArea), "de")
      || String(a.title || a.titel || "").localeCompare(String(b.title || b.titel || ""), "de");
  });
  const elevenlabs = audioProviders?.elevenlabs || {};
  const summary = rows.reduce((acc, item) => {
    const info = activeAudioInfo(item.audioCollection, item);
    const state = String(info.state || "missing").toLowerCase();
    acc.total += 1;
    if (info.provider === "elevenlabs") acc.elevenlabs += 1;
    if (info.activeUrl) acc.ready += 1;
    if (["outdated", "veraltet"].includes(state)) acc.outdated += 1;
    if (["error", "fehler"].includes(state)) acc.error += 1;
    if (!info.activeUrl) acc.missing += 1;
    return acc;
  }, { total: 0, ready: 0, missing: 0, outdated: 0, error: 0, elevenlabs: 0 });
  const defaultProviderLabel = elevenlabs.enabled ?"ElevenLabs" : "Gemini";
  const defaultModelLabel = elevenlabs.enabled
    ?(elevenlabs.modelId || "eleven_multilingual_v2")
    : "gemini-2.5-flash-preview-tts";
  const defaultVoiceLabel = elevenlabs.enabled
    ?(elevenlabs.voiceName || elevenlabs.voiceId || "Standardstimme")
    : "Gemini TTS";
  const areaOptions = Array.from(new Set(rows.map((item) => item.audioArea).filter(Boolean)))
    .sort((a, b) => {
      const rankA = audioAreaRank(a);
      const rankB = audioAreaRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return String(a).localeCompare(String(b), "de");
    });
  const subareaOptions = Array.from(new Set(rows.map((item) => item.audioSubarea).filter((value) => ["Über uns", "Mitglied werden"].includes(value))))
    .sort((a, b) => ["Über uns", "Mitglied werden"].indexOf(a) - ["Über uns", "Mitglied werden"].indexOf(b));
  const rowHtml = rows.map((item) => {
    const collection = item.audioCollection;
    const title = item.title || item.titel || item.slug || item.id;
    const info = activeAudioInfo(collection, item);
    const generatedAt = timestampText(info.generatedAt);
    const actionLabel = `${info.activeUrl ?"Neu erzeugen" : "Erzeugen"} mit ${defaultProviderLabel}`;
    return `<tr data-audio-area="${escapeHtml(item.audioArea)}" data-audio-subarea="${escapeHtml(item.audioSubarea || "")}">
      <td><a class="link editorial-title-link" href="${escapeHtml(item.editHref)}">${escapeHtml(title)}</a><br><small>${escapeHtml(`${collection}/${item.id}`)}</small></td>
      <td>${escapeHtml(item.audioArea)}</td>
      <td>${audioListCell(collection, item, { meta: "state" })}</td>
      <td>${escapeHtml(info.provider || defaultProviderLabel)}<br><small>${escapeHtml(info.modelId || defaultModelLabel)}</small></td>
      <td>${escapeHtml(info.voiceName || defaultVoiceLabel)}${generatedAt ?`<br><small>${escapeHtml(generatedAt)}</small>` : ""}${info.karaokeEnabled ?"<br><small>Karaoke bereit</small>" : ""}</td>
      <td><button type="button" class="button button--secondary button--small" data-generate-article-speech data-collection="${collection}" data-record-id="${item.id}" data-tts-variant="all" title="${escapeHtml(`Aktuelle Default-Konfiguration: ${defaultModelLabel} / ${defaultVoiceLabel}`)}">${escapeHtml(actionLabel)}</button></td>
    </tr>`;
  }).join("");
  return protect(cmsShell("cms/audio", `${cmsTitle("Audio & Barrierefreiheit", "Audio-Service Verwaltung", `<a class="button button--secondary button--small" href="#/cms/ai-access">KI-Zugaenge</a>`)}
    <section class="panel audio-admin-intro">
      <h2>Zentrale Audio-Pipeline</h2>
      <p>Diese Uebersicht zeigt die aktive Audiofassung pro Inhalt. Alte Gemini-Audios bleiben erhalten; neue Generierungen laufen ueber den zentralen Audio-Service und nutzen ElevenLabs, wenn der Anbieter in den KI-Zugaengen aktiviert ist.</p>
      <div class="setup-steps">
        <div class="setup-step"><span>Audiofaehige Inhalte</span><strong>${summary.total}</strong></div>
        <div class="setup-step"><span>Audio vorhanden</span><strong>${summary.ready}</strong></div>
        <div class="setup-step"><span>Nicht erzeugt</span><strong>${summary.missing}</strong></div>
        <div class="setup-step"><span>Fehler / veraltet</span><strong>${summary.error + summary.outdated}</strong></div>
        <div class="setup-step"><span>ElevenLabs</span><strong>${elevenlabs.enabled ?"Aktiv" : "Inaktiv"}</strong><small>${escapeHtml(elevenlabs.voiceName || "Keine Standardstimme gespeichert")}</small></div>
      </div>
    </section>
    <section class="panel">
      <div class="audio-admin-toolbar">
        <label>Bereich filtern
          <select data-audio-area-filter>
            <option value="">Alle Bereiche</option>
            ${areaOptions.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join("")}
          </select>
        </label>
        <label>Interna filtern
          <select data-audio-subarea-filter>
            <option value="">Alle Interna</option>
            ${subareaOptions.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join("")}
          </select>
        </label>
        <small data-audio-area-count>${rows.length} Inhalte</small>
      </div>
      <div class="table-wrap"><table class="table table--editorial table--audio-service"><thead><tr><th>Inhalt</th><th>Bereich</th><th>Audio</th><th>Modell</th><th>Stimme</th><th>Aktion</th></tr></thead><tbody>${rowHtml || `<tr><td colspan="6">Noch keine audiofähigen Inhalte vorhanden.</td></tr>`}</tbody></table></div>
    </section>`));
}

export async function setupPage() {
  if (!hasCmsAccess(true)) return denied(true);
  const setup = await getOne("system", "setup");
  return protect(cmsShell("cms/setup", `${cmsTitle("System / Einrichtung", "Firebase Setup-Assistent")}<div class="cms-columns"><section class="panel"><h2>Installationsstatus</h2><div class="setup-steps"><div class="setup-step"><span>Installation</span>${status(setup?.installed ?"installed" : "not_installed")}</div><div class="setup-step"><span>Version</span><strong>${setup?.version || "-"}</strong></div></div><div class="actions" style="margin-top:22px;flex-wrap:wrap"><button class="button button--dark button--small" data-setup-action="connection">Verbindung testen</button><button class="button button--dark button--small" data-setup-action="structure">Struktur prüfen</button><button class="button button--primary button--small" data-setup-action="initialize">Basisdaten anlegen</button></div><div id="setup-result" style="margin-top:18px"></div></section><section class="panel"><h2>Setup-Protokoll</h2>${(setup?.setupLog || []).length ?setup.setupLog.map((log) => `<div class="fact"><strong>${escapeHtml(log.message)}</strong><span class="muted">${formatDateTime(log.timestamp)}</span></div>`).join("") : `<p>Noch keine protokollierten Setup-Aktionen.</p>`}</section></div>`), true);
}

export async function chatGptPage() {
  if (!hasCmsAccess()) return denied();
  const [events, media, aiLogs, aiDrafts] = await Promise.all([list("events"), list("eventMedia"), list("aiLogs"), list("aiDrafts")]);
  const sampleEvent = events[0] || {};
  return protect(cmsShell("cms/chatgpt", `${cmsTitle("ChatGPT", "KI-Unterstuetzung", `<a class="button button--secondary button--small" href="#/cms/ai-settings">Einstellungen</a>`)}
    <div class="cms-columns">
      <section class="panel">
        <h2>Event-Admin-Pipeline</h2>
        <p>ChatGPT erzeugt nur Vorschlaege. Redakteure muessen Inhalte prüfen, bearbeiten und bewusst speichern.</p>
        <div class="setup-steps" style="margin-top:18px">
          <div class="setup-step"><span>Event-Vorlauf</span><strong>Beschreibung, Einladung, Agenda, FAQ</strong></div>
          <div class="setup-step"><span>Themen & Referenten</span><strong>keine erfundenen Personen</strong></div>
          <div class="setup-step"><span>Nachlauf</span><strong>Rückblick, Archiv, Newsletter</strong></div>
          <div class="setup-step"><span>Fotogalerie / Downloads</span><strong>optional, keine Pflichtfehler</strong></div>
        </div>
        <div style="margin-top:20px">${aiButton("analyzeEventPipelineQuality", "chatgpt-dashboard-context", "Pipeline-Beispiel prüfen", { entityId: sampleEvent.id || "", fieldName: "dashboardQuality" })}</div>
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
        <label class="checkbox"><input type="checkbox" name="enabled" ${settings.enabled ?"checked" : ""}> ChatGPT aktivieren</label>
        <div class="form-grid--two">
          <div class="field"><label>Provider</label><input name="provider" value="openai" disabled></div>
          <div class="field"><label>Modell</label><input name="model" value="${escapeHtml(settings.model || "gpt-4.1-mini")}"></div>
          <div class="field"><label>Temperatur</label><input name="temperature" type="number" step="0.1" min="0" max="1" value="${settings.temperature ?? 0.3}"></div>
          <div class="field"><label>Maximale Antwortlaenge</label><input name="maxTokens" type="number" min="100" max="4000" value="${settings.maxTokens || 900}"></div>
        </div>
        <div class="field"><label>Standard-Tonalitaet</label><textarea name="defaultTone">${escapeHtml(settings.defaultTone || "")}</textarea></div>
        <label class="checkbox"><input type="checkbox" name="allowAdmin" ${settings.allowedRoles?.includes("admin") ?"checked" : ""}> Admins duerfen ChatGPT nutzen</label>
        <label class="checkbox"><input type="checkbox" name="allowEditor" ${settings.allowedRoles?.includes("editor") ?"checked" : ""}> Editoren duerfen ChatGPT nutzen</label>
        <label class="checkbox"><input type="checkbox" name="loggingEnabled" ${settings.loggingEnabled !== false ?"checked" : ""}> KI-Aktionen in aiLogs protokollieren</label>
        <div class="alert">Der OpenAI API-Key wird nicht im Frontend gespeichert. Hinterlege ihn serverseitig als Firebase Secret <code>OPENAI_API_KEY</code>.</div>
        <div class="actions"><button class="button button--primary">Einstellungen speichern</button><button type="button" class="button button--secondary" id="ai-test-connection">Verbindung testen</button></div>
        <div id="ai-settings-result"></div>
      </form>
    </section>`), true);
}
