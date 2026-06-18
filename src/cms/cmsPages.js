import { cmsShell, cmsTitle } from "./cmsLayout.js?v=467";
import { list, getOne } from "../firebase/dataService.js?v=487";
import { currentUser, canUseCms, isAdmin } from "../firebase/authService.js?v=470";
import { accessLabels, lifecycleLabels } from "../data/demoData.js";
import { escapeHtml, formatDate, formatDateTime, formatShortDate } from "../utils/format.js";

function localCmsAccessBypass() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function protect(content, adminOnly = false) {
  if (localCmsAccessBypass()) return content;
  const user = currentUser();
  if (!canUseCms(user) || (adminOnly && !isAdmin(user))) {
    return `<section class="login-wrap"><div class="form-card login-card"><p class="eyebrow">Zugriff geschuetzt</p><h1>CMS-Login erforderlich</h1><p style="margin:14px 0 24px">Dieser Bereich steht Administratoren und Redakteuren zur Verfuegung.</p><div class="actions"><a class="button button--primary" href="#/login">Anmelden</a>${user ? `<button id="logout-button" class="button button--secondary" type="button">Abmelden</button>` : ""}</div></div></section>`;
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
  const style = ["failed", "expired", "inactive", "cancelled", "archived"].includes(value) ? "status--error" : ["draft", "pending_email_confirmation", "queued", "in_review", "uploaded"].includes(value) ? "status--draft" : "";
  const label = { active: "Aktiv", inactive: "Inaktiv", cancelled: "Gekuendigt", internal: "Intern", published: "Veroeffentlicht", draft: "Entwurf", archived: "Archiviert", approved: "Freigegeben", new: "Neu", queued: "Wartet", sent: "Gesendet", failed: "Fehler", in_review: "In Pruefung" }[value] || value;
  return `<span class="status ${style}">${escapeHtml(label)}</span>`;
}

function iconImage(name) {
  const icons = {
    edit: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAA+ElEQVR4AeyUwRHCIBBFE0vQAqJFeLIzG7Axj/ZgkrPWgP9nlkwCm0CA3HSyLizwnoOEQ7Xz5y+omqZ5Igzio+121hYB+gb0huBzQt+wMY1kAWCEn6cwtlH/MttIEgCiwgV6lDykzYIAvDLGvAayfG0STOFd19WAPYRjU9v3/dV2mKMFLpyLAbszS7SQXqQ9piiBBicBdXtqVDjnBAWAjH8ofmHNRQzUg3DOWxUAkgVfFZSALwpKwVVBSbgnKA33BCgMd0vKacFa9QmdoqijqJKlqAqwVbzfs+F0qAIOSCy+oTIeTDMB994J724JEp0JM4EzVqS7u+AHAAD//wiOVHUAAAAGSURBVAMAkZiJMfsBJ98AAAAASUVORK5CYII=",
    eye: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAACjklEQVR4AeyTO28TQRDH92wZdwQngAzBDwkkJBKggA9AaJCoExEINTRQQcWr4FVBBQ3UBIKSGomG8AGgABIkJJD8IMEi73SOZV9+/83t6eLIujTpYu1PMzs7M/+bPV/C7PBvVyD2gmOvqFAojMAC+G3MF4vFS3EKHQVoNg4+Dd5AN7SvHt/3x5QD4+2Hbr9FIJ/PZyhQ48Eg6Wer1bpQLpe9cgTOzsM0aA2qJpfLHdYmyiYBRj7ned6iEni6atCwL5lMfqfBCrhrWkT0F+f94JE/AyaRSMyoh3xHKCB1mk4GB88rlUpePhOdIf4Pfy+4lVEzavoVQOQI9iUYciepycgXoYAKFIB3FNzG2sVEX+TU6/WDxO018fTHFKPmh6zg7CbNX8unxt6CfCvA6He1gTUSr2DtIn7ROsY8rdVqc4FvqtXqH/wnYCI5hqmvE2uA4g9lrQDOYzAod8k6eKLT8rGjslGYYkx7zmyOfNFoNPbJwn0wTuCeNiSvyDoQ/CYfOyIbhesZ1p4zmyNfpFKpZVl4BBsCXIsdl8AeRn6LtYv4B+sYcyebzR4IfMPLPYpvrzWSY3i5r4inwBB/IOsmMIzcqwBcRuQZ1i6mOisnnU7/J27/pjz9b8WoOSkrOHvBNNfkUxN+mKEAL26WhAElwC2epoLVi/tK/BD+Kri1RPNeaqYUoPlf7A3QexzgZS/JF6GANqVS6bNTp2mOQj3xdLPZPMXIXWD/pthupjjO+RToq7fTS1Q91MuxSUBBqdNAX+eE9nCCZh/VKArxT9AHWhOqYaJZbaJsEXCHFAyBhK4SCz8cfLcWmHJYOTDkgu22o4BLpHgUesBdj7P7uY73Lq+TjRXoVLjd+K5A7E2tAwAA//+mcuG+AAAABklEQVQDAIijNECIR6TkAAAAAElFTkSuQmCC",
    eyeOff: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAACtUlEQVR4AdyUu4tTQRTG5yZEJQSjrCnUPISgKRQbRdTCQrGxc0Es/A8EqxVUcFFUUFC30n9hi+21UmHXwsIVRGGLLUyyeYCFi6/AQl7+viEz3JvVWGy22XC+ex5zzvlmzp2bmNnk3xYiKBQKa/l8/u64J2ZHlM1mj9J4exAEd4ZJIJ4EP0B/CN/JvUTdSLEE9Xr9E1mngfkLyUPiO8GwpMmdG5C+Hl50viWQU61W3/X7/fOyKfQnIV6KxWIH0EEY5Jwi/73ywVkRMYmD2BHxBIpStE1awPYk5XK5yjgW1GSA1W63u8LvhEjJbwATj8eXc7ncGdkOngD2/QRfAMkDPcIkNFPhF8XBbk7VoNkRbANJFv0MGOLzmUwmJVvwBLDXFQAzFExz/MPYkXdCvAiCdrud1xrNPksLxK9R80h2Mpn8JS1YAo49LQeskTiFNux4CT0JIiTym81mDf0YGGovSAvU3ILkt2zit6UtAcY9YBKJxC5pB5JLzg6PSzH8WWlydMVlWqRSqQlrGHNf2hFcl8PRv0o70ETX17mRk1QqlY8sLEPwCu2l1WqVB85TaUvAWKxDIM3RnqOtEH9pjdADUn+7WC/VarVFt0ytRr1PPmt205ZAgU6ns0caXCXxCdoKOzxujdAjTOLCXOMb2HbU1BSxrXiCRqPxrdfr6SpqYYqCFRm8uA803Iv9E3gh5k+iIP5FaZpfpsZdZ+MJtMhx3/Ie7BWkIMdJ9P+zyEd1iCOngf2a3UbI8SSsnaR5keZz6uUQIVBQV5DkAPsNkBzjvs8PyETYx1/QghAmobnfudaEdQQKCpCcAyK6gh8ZD75klYf9ZsIkxCLyTwKXBcks8OPBtmNCT4AZxrLui3e10v8lUNIoMJalUSQbJhD5EMlNxRzGQqBmjoSx7ZDvMDYCNRSJdBh/AAAA///ZsAk1AAAABklEQVQDABUiTEDAfB/UAAAAAElFTkSuQmCC",
    trash: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAlElEQVR4AeyUXQqAIBCE2y7iWbp5R1lP0s/DQLQTjpFEZCCj267fOoLj0Pj7CSCltCQyFHeDRTUbKbkBoHRVkxMAOWfDBvtcGcd8zKEBgB9PqQSA14Ce14gzlQCsUI11QNGpbtFHLMJzgXbPa8SZvnvJeBJKyjpHjJ7AzCYkqGoXNRTg7jN8VtW3GtYMBbDEu7HmgBUAAP//nstLKAAAAAZJREFUAwAtM3oxRhnWAgAAAABJRU5ErkJggg=="
  };
  return icons[name] ? `<img src="${icons[name]}" alt="" loading="lazy">` : "";
}

function eyeSvgIcon(isVisible = false) {
  return `<svg class="member-eye-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.7"></circle>${isVisible ? "" : `<path class="member-eye-svg__slash" d="M4.5 4.5 19.5 19.5"></path>`}</svg>`;
}

function editorialActionButtons(item, section, module, activeStatus, inactiveStatus) {
  const isActive = ["published", "active", "approved"].includes(item.status);
  const toggleStatus = isActive ? inactiveStatus : activeStatus;
  const toggleClass = isActive ? "icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ? "Aktiv: auf inaktiv setzen" : "Inaktiv: auf aktiv setzen";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-record-status="${module}" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ? "eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="${module}" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function cmsListActionButtons(item, section, module, activeStatus, inactiveStatus, { editable = true, manageable = true } = {}) {
  const isActive = ["published", "active", "approved"].includes(item.status);
  const toggleStatus = isActive ? inactiveStatus : activeStatus;
  const toggleClass = isActive ? "icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ? "Aktiv: auf inaktiv setzen" : "Inaktiv: auf aktiv setzen";
  return `<div class="table-actions table-actions--icons">${editable ? `<a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a>` : ""}${manageable ? `<button class="icon-button ${toggleClass}" type="button" data-record-status="${module}" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ? "eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="${module}" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button>` : ""}</div>`;
}

function editorialVisibilityActionButtons(item, section) {
  const isVisible = item.visible === true;
  const toggleClass = isVisible ? "icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isVisible ? "Sichtbar: ausblenden" : "Unsichtbar: sichtbar machen";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=editorialContent&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-news-visible-toggle="${escapeHtml(item.id)}" data-visible="${isVisible ? "false" : "true"}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isVisible ? "eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="editorialContent" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function lockedEditorialActionButtons(item, section, module) {
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a></div>`;
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
    ${hasGallery ? `<span class="editorial-media-flag editorial-media-flag--gallery" title="Galerie vorhanden" aria-label="Galerie vorhanden">${mediaPicto("gallery")}</span>` : ""}
    ${videoCount ? `<span class="editorial-media-flag editorial-media-flag--video" title="${videoCount} Video${videoCount === 1 ? "" : "s"} vorhanden" aria-label="${videoCount} Video${videoCount === 1 ? "" : "s"} vorhanden">${mediaPicto("video")}</span>` : ""}
  </div>`;
}

function editorialListStatus(item) {
  return status(["published", "active", "approved"].includes(item.status) ? "active" : "inactive");
}

function editorialVisibilityListStatus(item) {
  const isPublished = !["draft", "archived"].includes(item.status);
  return status(isPublished && item.visible === true ? "active" : "inactive");
}

function newsBulkToolbar(records = []) {
  return `<div class="cms-bulk-toolbar" data-news-bulk-toolbar>
    <div class="cms-bulk-toolbar__select">
      <label class="cms-bulk-checkbox"><input type="checkbox" data-news-bulk-select-all ${records.length ? "" : "disabled"}> <span>Alle</span></label>
      <button class="button button--secondary button--small" type="button" data-news-bulk-clear>Auswahl aufheben</button>
      <span class="muted" data-news-bulk-count>0 ausgewaehlt</span>
    </div>
    <div class="actions">
      <button class="button button--secondary button--small news-bulk-action news-bulk-action--icon" type="button" data-news-bulk-hide disabled>${iconImage("eyeOff")}<span>Unsichtbar</span></button>
      <button class="button button--danger button--small news-bulk-action news-bulk-action--icon" type="button" data-news-bulk-delete disabled>${iconImage("trash")}<span>Loeschen</span></button>
    </div>
    <div id="news-bulk-result"></div>
  </div>`;
}

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
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function memberAccessBlocked(item = {}, now = new Date()) {
  if (!["inactive", "cancelled"].includes(item.membershipAccessStatus)) return false;
  const effective = item.membershipAccessEffectiveAt;
  if (!effective) return true;
  const effectiveDate = effective.seconds ? new Date(effective.seconds * 1000) : new Date(effective);
  return !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= now;
}

function memberAccessStatusCell(item = {}) {
  const accessStatus = item.membershipAccessStatus || "active";
  const effective = timestampInputDate(item.membershipAccessEffectiveAt);
  const blocked = memberAccessBlocked(item);
  if (accessStatus === "active") return status(memberIsLive(item) ? "active" : "inactive");
  const suffix = effective ? ` ab ${escapeHtml(formatDate(effective))}` : " sofort";
  return `${status(blocked ? accessStatus : "pending_email_confirmation")}<small>${escapeHtml(accessStatus === "cancelled" ? "Gekuendigt" : "Inaktiv")}${suffix}</small>`;
}

function memberListStatus(item) {
  return memberAccessStatusCell(item);
}

function memberStatusDot(item = {}) {
  const blocked = memberAccessBlocked(item);
  const isLive = memberIsLive(item);
  const accessStatus = item.membershipAccessStatus || "active";
  const state = blocked || accessStatus !== "active" ? "blocked" : isLive ? "visible" : "hidden";
  const label = blocked
    ? accessStatus === "cancelled" ? "Gekuendigt" : "Inaktiv"
    : isLive
      ? "Aktiv sichtbar"
      : "Aktiv, nicht sichtbar";
  return `<span class="member-status-dot member-status-dot--${state}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
}

function memberVisibilityCell(item) {
  const isLive = memberIsLive(item);
  const toggleStatus = isLive ? "inactive" : "active";
  const toggleLabel = isLive ? "Sichtbar: ausblenden" : "Nicht sichtbar: sichtbar machen";
  const label = isLive ? "Sichtbar" : "Nicht sichtbar";
  const reason = isLive
    ? "Website"
    : memberAccessBlocked(item)
      ? "Zugang gesperrt"
      : item.isLive === false
        ? "Live aus"
        : (item.visibility || "public") !== "public"
          ? "Intern"
          : "Nicht aktiv";
  return `<div class="member-visibility-cell ${isLive ? "is-visible" : "is-hidden"}"><button class="icon-button member-eye-toggle ${isLive ? "icon-button--visible" : "icon-button--hidden"}" type="button" data-record-status="members" data-record-id="${item.id}" data-status="${toggleStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${eyeSvgIcon(isLive)}</button><span>${escapeHtml(label)}</span><small>${escapeHtml(reason)}</small></div>`;
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
  const phoneLine = phone ? `Tel. ${escapeHtml(phone)}` : "Tel. fehlt";
  const mobileLine = mobile ? `Mobil ${escapeHtml(mobile)}` : "Mobil fehlt";
  return `<div class="member-contact-cell"><span>${email ? escapeHtml(email) : "Mail fehlt"}</span><small>${phoneLine}</small><small>${mobileLine}</small></div>`;
}

function memberProfileMissingCell(item = {}) {
  const missing = Array.isArray(item.needsProfileContentReview)
    ? item.needsProfileContentReview
    : [
        item.logoUrl ? "" : "Logo",
        (item.website || item.url) ? "" : "Website",
        memberDescriptionValue(item) ? "" : "Beschreibung"
      ].filter(Boolean);
  if (!missing.length) return `<small class="member-profile-complete">Profil komplett</small>`;
  return `<small class="member-profile-missing">Fehlt: ${missing.map(escapeHtml).join(", ")}</small>`;
}

function memberDescriptionValue(item = {}) {
  const current = String(item.description || "").trim();
  const generic = /^Internes Mitgliedsprofil aus der Mitgliederliste 2026\.?$/i.test(current);
  return generic ? "" : current;
}

function mediaAssetUrl(asset = {}) {
  return asset.file_path_thumb_url || asset.file_path_web_url || asset.file_path_original_url || asset.imageUrl || asset.assetUrl || "";
}

function blockedMemberLogoUrl(item = {}, url = "") {
  return item.id === "goldvisite-media" && /goldbach/i.test(String(url || ""));
}

function safeMemberLogoUrl(item = {}, url = "") {
  return blockedMemberLogoUrl(item, url) ? "" : url;
}

function memberLogoAsset(item = {}, mediaAssets = []) {
  return mediaAssets
    .filter((asset) => {
      const logoUrl = item.logoUrl || "";
      const urls = [asset.file_path_web_url, asset.file_path_thumb_url, asset.file_path_original_url, asset.imageUrl, asset.assetUrl].filter(Boolean);
      const directIds = [item.logo_media_asset_id, item.logoMediaAssetId, item.thumbnail_media_asset_id, item.mediaAssetId, item.media_asset_id].filter(Boolean);
      return directIds.includes(asset.id)
        || asset.linked_collection === "members" && asset.linked_record_id === item.id
        || asset.target_collection === "members" && asset.target_id === item.id
        || (logoUrl && urls.includes(logoUrl));
    })
    .filter((asset) => safeMemberLogoUrl(item, mediaAssetUrl(asset)))
    .sort((a, b) => {
      const score = (asset = {}) => [
        [item.logo_media_asset_id, item.logoMediaAssetId, item.thumbnail_media_asset_id, item.mediaAssetId, item.media_asset_id].filter(Boolean).includes(asset.id) ? "5" : "0",
        asset.target_collection === "members" && asset.target_id === item.id && (asset.target_field || "logoUrl") === "logoUrl" ? "4" : "0",
        asset.linked_collection === "members" && asset.linked_record_id === item.id && (asset.linked_field || "logoUrl") === "logoUrl" ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.status === "active" ? "2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function recordMediaAsset(item = {}, mediaAssets = [], collection = "", field = "imageUrl") {
  const recordUrl = String(item[field] || editorialThumbUrl(item) || "").trim();
  const directIds = [item.thumbnail_media_asset_id, item.mediaAssetId, item.media_asset_id, item.logo_media_asset_id, item.logoMediaAssetId].filter(Boolean);
  return mediaAssets
    .filter((asset) => {
      const urls = [asset.file_path_web_url, asset.file_path_thumb_url, asset.file_path_original_url, asset.imageUrl, asset.assetUrl].filter(Boolean);
      return directIds.includes(asset.id)
        || asset.linked_collection === collection && asset.linked_record_id === item.id && (!field || !asset.linked_field || asset.linked_field === field)
        || asset.target_collection === collection && asset.target_id === item.id && (!field || !asset.target_field || asset.target_field === field)
        || (recordUrl && urls.includes(recordUrl));
    })
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const score = (asset = {}) => [
        directIds.includes(asset.id) ? "5" : "0",
        asset.target_collection === collection && asset.target_id === item.id && (!field || !asset.target_field || asset.target_field === field) ? "4" : "0",
        asset.linked_collection === collection && asset.linked_record_id === item.id && (!field || !asset.linked_field || asset.linked_field === field) ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.status === "active" ? "2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function memberLogoUrl(item = {}, mediaAssets = []) {
  const asset = memberLogoAsset(item, mediaAssets);
  return safeMemberLogoUrl(item, asset ? mediaAssetUrl(asset) || item.logoUrl || "" : item.logoUrl || "");
}

function memberLogoInitials(item = {}) {
  const name = String(item.name || item.title || "").replace(/\b(gmbh|ug|ag|kg|co|ltd|inc|stiftung|consulting|media|medien|television)\b/gi, " ");
  const words = name
    .split(/[^A-Za-z0-9ÄÖÜäöüß]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1);
  const initials = words.length >= 2
    ? `${words[0][0]}${words[1][0]}`
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
    ? gallery.images.filter((image) => image.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
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
  const nextVisibility = isVisible ? "internal" : "public";
  const nextStatus = isVisible ? item.status : "published";
  const toggleClass = isVisible ? "icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isVisible ? "Sichtbar: ausblenden" : "Unsichtbar: sichtbar machen";
  return `<div class="table-actions table-actions--icons">${galleryPlayerButton(item)}<a class="icon-button icon-button--edit" href="#/cms/edit?module=galleries&id=${item.id}&section=${section}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-record-visibility="galleries" data-record-id="${item.id}" data-visibility="${nextVisibility}" data-status="${nextStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isVisible ? "eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-record="galleries" data-record-id="${item.id}" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function galleryPayloadAttribute(gallery) {
  const images = Array.isArray(gallery.images)
    ? gallery.images.filter((image) => image.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
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
  return status(isVisible ? "active" : "inactive");
}

function listDate(item) {
  const value = item.publishDate || item.validFrom || item.date || item.submittedAt || item.updatedAt || item.createdAt || "";
  return value ? formatShortDate(value) : "-";
}

function listDateSortValue(item = {}) {
  const value = item.publishDate || item.validFrom || item.date || item.submittedAt || item.updatedAt || item.createdAt || "";
  if (!value) return 0;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (typeof value === "object" && typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  const raw = String(value || "").trim();
  const german = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?/);
  if (german) return new Date(Number(german[3]), Number(german[2]) - 1, Number(german[1]), Number(german[4] || 0), Number(german[5] || 0)).getTime();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function mailQueueDate(value) {
  return value ? formatDateTime(value) : "-";
}

function mailReference(item) {
  if (item.membershipApplicationId) return `Mitgliedsantrag: ${item.membershipApplicationId}`;
  if (item.registrationId) return `Anmeldung: ${item.registrationId}`;
  if (item.eventId) return `Event: ${item.eventId}`;
  return "-";
}

function aiButton(action, target, label = "Mit ChatGPT bearbeiten", extra = {}) {
  const promptField = extra.promptField ? ` data-ai-prompt-field="${escapeHtml(extra.promptField)}"` : "";
  return `<button type="button" class="button button--secondary button--small ai-action" data-ai-action="${action}" data-ai-target="${target}" data-ai-entity-type="${extra.entityType || "event"}" data-ai-entity-id="${extra.entityId || ""}" data-ai-field="${extra.fieldName || target}"${promptField}>${label}</button>`;
}

function aiFieldActions(actions) {
  return `<div class="ai-field-actions">${actions.map((item) => aiButton(item.action, item.target, item.label, item)).join("")}</div>`;
}

function audioSourceText(collection, item = {}) {
  return collection === "topics"
    ? [item.subtitle, item.longDescription, item.bodyText, item.shortDescription].filter(Boolean).join("\n\n")
    : [item.subtitle, item.longDescription, item.bodyText, item.articleText, item.archiveText, item.introText, item.shortText, item.teaserText, item.postEventSummary].filter(Boolean).join("\n\n");
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
  const prefix = variant === "natural" ? "audioNatural" : "audioAccessible";
  const url = item[`${prefix}Url`] || (variant === "accessible" ? item.audioUrl : "");
  const savedSignature = item[`${prefix}TextSignature`] || (variant === "accessible" ? item.audioTextSignature : "");
  if (item[`${prefix}Status`] === "in_erstellung") return "in Erstellung";
  if (item[`${prefix}Status`] === "fehler") return "Fehler";
  if (!url) return "fehlt";
  if (savedSignature && savedSignature !== currentSignature) return "veraltet";
  return "aktuell";
}

function audioStatusBadge(state) {
  const className = state === "aktuell" ? "" : state === "veraltet" || state === "fehlt" ? "status--draft" : "status--error";
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
    ? ""
    : ["missing", "fehlt", "outdated", "veraltet", "generating", "in_erstellung"].includes(normalized)
      ? "status--draft"
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
  return index === -1 ? 999 : index;
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
  const provider = serviceAudio.provider || item.audioProvider || (activeUrl ? "gemini" : "");
  const serviceStatus = serviceAudio.status || item.audioStatus || "";
  const legacyState = audioVariantState(collection, item, accessibleUrl ? "accessible" : "natural");
  const state = serviceUrl
    ? serviceStatus || "ready"
    : activeUrl
      ? legacyState
      : "missing";
  const version = serviceAudio.version || item.audioVersion || item.contentVersion || item.audioContentVersion || 1;
  const voiceName = serviceAudio.voiceName || item.audioAccessibleVoice || item.audioNaturalVoice || (provider && provider !== "elevenlabs" ? "Gemini TTS" : "");
  const modelId = serviceAudio.modelId || (provider === "elevenlabs" ? "eleven_multilingual_v2" : provider ? "gemini-2.5-flash-preview-tts" : "");
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
    serviceVersion: serviceAudio.serviceVersion || (provider ? (provider === "elevenlabs" ? "audio-service-v1" : "legacy-gemini") : ""),
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

function audioMetaLine(collection, item, variant) {
  const prefix = variant === "natural" ? "audioNatural" : "audioAccessible";
  const generatedAt = item[`${prefix}GeneratedAt`] || item.audioGeneratedAt || "";
  const voice = item[`${prefix}Voice`] || (variant === "natural" ? "Puck" : "Kore");
  const mime = item[`${prefix}MimeType`] || (variant === "natural" ? "audio/mpeg" : item.audioMimeType || "audio/wav");
  const textLength = item[`${prefix}TextLength`] || item.audioTextLength || 0;
  return `<small>Version ${Number(item.contentVersion || item.audioContentVersion || 1)} · ${escapeHtml(voice)} · ${escapeHtml(mime)}${textLength ? ` · ${Number(textLength).toLocaleString("de-DE")} Zeichen` : ""}${generatedAt ? ` · ${formatDateTime(generatedAt)}` : ""}</small>`;
}

function audioGenerationPanel(collection, item, options = {}) {
  const accessibleUrl = item.audioAccessibleUrl || item.audioUrl || "";
  const naturalUrl = item.audioNaturalUrl || "";
  const hasAudio = accessibleUrl || naturalUrl;
  const info = activeAudioInfo(collection, item);
  const providerConfig = options.providerConfig || {};
  const defaultProviderLabel = providerConfig.elevenlabs?.enabled ? "ElevenLabs" : "Gemini";
  const defaultModelLabel = providerConfig.elevenlabs?.enabled
    ? (providerConfig.elevenlabs.modelId || "eleven_multilingual_v2")
    : "gemini-2.5-flash-preview-tts";
  const defaultVoiceLabel = providerConfig.elevenlabs?.enabled
    ? (providerConfig.elevenlabs.voiceName || providerConfig.elevenlabs.voiceId || "Standardstimme")
    : "Gemini TTS";
  const requestedVariant = options.variant || "all";
  const buttonLabel = requestedVariant === "accessible"
    ? (accessibleUrl ? "Barrierefrei neu erzeugen" : "Barrierefrei erzeugen") + " mit " + defaultProviderLabel
    : (hasAudio ? "Audio neu erzeugen" : "Audio erzeugen") + " mit " + defaultProviderLabel;
  const generatedAt = timestampText(info.generatedAt);
  const previewUrl = naturalUrl || accessibleUrl || "";
  return '<div class="audio-generation-panel audio-generation-panel--compact">'
    + '<div class="audio-generation-panel__compact">'
    + '<div class="audio-generation-panel__compact-main">'
    + '<label>Vorlesen</label>'
    + '<div class="audio-generation-panel__statusline">' + audioListCell(collection, item, { meta: "state" }) + '<span>' + (hasAudio ? 'Vorhanden' + (generatedAt ? ' / ' + escapeHtml(generatedAt) : '') : 'Noch kein Audio') + '</span></div>'
    + '<small>' + escapeHtml(defaultProviderLabel) + ' / ' + escapeHtml(defaultVoiceLabel) + '</small>'
    + '</div>'
    + (previewUrl ? '<audio controls preload="none" src="' + escapeHtml(previewUrl) + '"></audio>' : '')
    + '</div>'
    + '<div class="tool-button-row">'
    + '<button type="button" class="button button--secondary button--small" data-generate-article-speech data-collection="' + collection + '" data-record-id="' + item.id + '" data-tts-variant="' + escapeHtml(requestedVariant) + '" title="' + escapeHtml('Aktuelle Default-Konfiguration: ' + defaultModelLabel + ' / ' + defaultVoiceLabel) + '">' + escapeHtml(buttonLabel) + '</button>'
    + (hasAudio ? '<button type="button" class="icon-button icon-button--danger" data-clear-linked-media="audio" title="Audio-Verknuepfung loesen" aria-label="Audio-Verknuepfung loesen">' + iconImage("trash") + '</button>' : '')
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
    ? stateLabel
    : hasAudio
      ? (info.provider || "Audio")
      : "Audio fehlt";
  return `<div class="audio-list-cell">
    <button type="button" class="audio-play-button ${buttonState.className}" data-generate-article-speech data-collection="${collection}" data-record-id="${item.id}" data-tts-variant="all" data-audio-url="${escapeHtml(info.activeUrl)}" title="${escapeHtml(buttonState.label)}" aria-label="${escapeHtml(buttonState.label)}"><span></span></button>
    <small>${escapeHtml(meta)}</small>
    <div class="audio-list-cell__result" data-speech-result></div>
  </div>`;
}

function maskedSecretLabel(name = "") {
  return name ? `************${String(name).slice(-4)}` : "Firebase Secret";
}

function aiProviderCard(provider = {}) {
  const lastTest = provider.lastTestAt?.seconds
    ? new Date(provider.lastTestAt.seconds * 1000).toISOString()
    : provider.lastTestAt || "";
  const lastSuccess = provider.lastSuccessAt?.seconds
    ? new Date(provider.lastSuccessAt.seconds * 1000).toISOString()
    : provider.lastSuccessAt || "";
  const state = provider.enabled === false ? "inactive" : "active";
  return `<article class="setup-step ai-provider-card">
    <span>${escapeHtml(provider.name || provider.provider || "KI-Anbieter")}</span>
    <strong>${status(state)}</strong>
    <small>Modell: ${escapeHtml(provider.modelId || "-")}<br>API-Key: ${escapeHtml(maskedSecretLabel(provider.secretName || provider.apiKey || ""))}${provider.voiceName ? `<br>Stimme: ${escapeHtml(provider.voiceName)} (${escapeHtml(provider.voiceId || "")})` : ""}${lastTest ? `<br>Letzter Test: ${escapeHtml(formatDateTime(lastTest))}` : ""}${lastSuccess ? `<br>Letzter Erfolg: ${escapeHtml(formatDateTime(lastSuccess))}` : ""}${provider.lastError ? `<br>Fehler: ${escapeHtml(provider.lastError)}` : ""}</small>
    ${provider.provider === "elevenlabs" ? `<button type="button" class="button button--secondary button--small" data-audio-provider-test="elevenlabs">Testen & aktivieren</button>` : ""}
  </article>`;
}

export async function aiAccessPage() {
  if (!hasCmsAccess(true)) return denied(true);
  const [aiSettings, audioProviders] = await Promise.all([
    getOne("settings", "ai").catch(() => null),
    getOne("settings", "audioProviders").catch(() => null)
  ]);
  const elevenlabs = audioProviders?.elevenlabs || {};
  const voices = Array.isArray(elevenlabs.voices) ? elevenlabs.voices : [];
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
        <label class="checkbox"><input type="checkbox" name="enabled" ${elevenlabs.enabled ? "checked" : ""}> ElevenLabs aktivieren</label>
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
            ${voices.map((voice) => `<option value="${escapeHtml(voice.voiceId)}" data-voice-name="${escapeHtml(voice.voiceName)}" ${voice.voiceId === elevenlabs.voiceId ? "selected" : ""}>${escapeHtml(voice.voiceName)} (${escapeHtml(voice.voiceId)})</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Leseprobe</label>
          <textarea name="previewText" rows="3">Dies ist eine kurze Leseprobe fuer PROdigitalTV. So klingt diese Stimme in der Audio- und Barrierefreiheitsfunktion.</textarea>
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
    shortDescriptions ? `${shortDescriptions} Events haben sehr kurze Beschreibungen.` : "",
    memberEventsWithoutTeaser ? `${memberEventsWithoutTeaser} Mitglieder-Events haben keinen oeffentlichen Teaser.` : "",
    postWithoutReport ? `${postWithoutReport} Events im Rückblick haben noch keinen Rückblicktext.` : "",
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
      <div class="stat"><span>Event Rückblick / Archiv</span><strong>${openPost}</strong></div>
      <div class="stat"><span>Mailfehler</span><strong>${mails.filter((mail) => mail.status === "failed").length}</strong></div>
    </div>
    ${chatGptHints(events, media, downloads)}
    <div class="cms-columns">
      <section class="panel"><h2>Naechste Events</h2><div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th>Termin</th><th>Phase</th></tr></thead><tbody>${upcoming.map((event) => `<tr><td><a class="link" href="#/cms/event/${event.id}">${escapeHtml(event.title)}</a></td><td>${formatDate(event.date)}</td><td>${status(lifecycleLabels[event.lifecyclePhase])}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel"><h2>Aufmerksamkeit erforderlich</h2>
        <div class="setup-steps"><div class="setup-step"><span>Unbestaetigte Anmeldungen</span><strong>${pending}</strong></div><div class="setup-step"><span>Medien in Pruefung</span><strong>${media.filter((item) => item.status === "in_review").length}</strong></div><div class="setup-step"><span>Event Rückblick offen</span><strong>${openPost}</strong></div></div>
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

function eventTable(events, { showThumb = false, mediaAssets = [], returnTo = "#/cms/events" } = {}) {
  return `<section class="panel"><div class="table-wrap"><table class="table ${showThumb ? "table--event-followup" : ""}"><thead><tr>${showThumb ? "<th>Bild</th>" : ""}<th>Event</th><th>Datum</th><th>Ablauf</th><th>Zugang</th><th>Lifecycle</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${events.map((event) => `<tr>${showThumb ? `<td><div class="topic-thumb topic-thumb--table editorial-thumb--table event-thumb--table">${eventThumb(event, mediaAssets, returnTo)}</div></td>` : ""}<td><a class="link" href="#/cms/event/${event.id}">${escapeHtml(event.title)}</a></td><td>${formatDate(event.date)}</td><td>${event.expiresAt ? formatDateTime(event.expiresAt) : "-"}</td><td>${accessLabels[event.accessType]}</td><td>${lifecycleLabels[event.lifecyclePhase]}</td><td>${status(event.status)}</td><td>${eventActionButtons(event)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function settingValue(settings, id, fallback = []) {
  const setting = settings.find((item) => item.id === id || item.key === id);
  return Array.isArray(setting?.value) ? setting.value : fallback;
}

export async function eventsAdminPage() {
  if (!hasCmsAccess()) return denied();
  const [allEvents, mediaAssets, allEditorial] = await Promise.all([list("events"), list("media_assets").catch(() => []), list("editorialContent").catch(() => [])]);
  const events = allEvents
    .filter((event) => !isPastCmsEvent(event))
    .sort((a, b) => (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31"));
  return protect(cmsShell("cms/events", `${cmsTitle("Event-Management", "Events", `<a class="button button--primary button--small" href="#/cms/event/new">Neues Event erstellen</a>`)}
  ${eventTable(events, { showThumb: true, mediaAssets, returnTo: "#/cms/events" })}`));
}

export async function eventFollowUpPage() {
  if (!hasCmsAccess()) return denied();
  const [allEvents, mediaAssets, allEditorial] = await Promise.all([list("events"), list("media_assets").catch(() => []), list("editorialContent").catch(() => [])]);
  const events = allEvents
    .filter((event) => isPastCmsEvent(event))
    .sort((a, b) => (b.date || "0000-00-00").localeCompare(a.date || "0000-00-00"));
  return protect(cmsShell("cms/followup", `${cmsTitle("Event-Management", "Event Rückblick")}
  ${eventFollowUpTable(events, mediaAssets, allEditorial)}`));
}

function eventTabs(id, active) {
  return `<nav class="tabs">${[["base", "Stammdaten"], ["pre", "Vorlauf"], ["topics", "Vortraege / Referenten"], ["partners", "Co-Gastgeber"], ["registration", "Anmeldung"], ["post", "Rückblick"], ["media", "Fotogalerie / Downloads"]].map(([key, label]) => `<button data-event-tab="${key}" data-event-id="${id}" class="${active === key ? "active" : ""}">${label}</button>`).join("")}</nav>`;
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
  const url = topic.imageUrl || "";
  const content = url ? `<img src="${escapeHtml(url)}" alt="">` : `<span>Bild</span>`;
  return `<a class="cms-thumb-action" href="${cmsThumbTarget("topics", topic, "", "imageUrl", "thumbnail_alt")}" title="${url ? "Thumb aus Mediathek waehlen" : "Thumb mit KI erstellen"}" aria-label="${url ? "Thumb aus Mediathek waehlen" : "Thumb mit KI erstellen"}">${content}</a>`;
}

function editorialThumbUrl(item = {}) {
  return item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.logoUrl || item.photoUrl || item.assetUrl || "";
}

function cmsThumbTarget(collection = "", item = {}, section = "", field = "imageUrl", altField = "thumbnail_alt") {
  const returnTo = collection === "topics"
    ? `#/cms/topics`
    : collection === "editorialContent"
      ? `#/cms/editorial/${section || item.page || "news"}`
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
  return hasThumb ? `#/cms/media/library?${params.toString()}` : `#/cms/media/ai?${params.toString()}`;
}

function editorialThumb(item = {}, { collection = "editorialContent", section = "", field = "imageUrl", altField = "thumbnail_alt", mediaAssets = [] } = {}) {
  const url = editorialThumbUrl(item);
  const content = url
    ? `<img src="${escapeHtml(url)}" alt="">`
    : `<span>Bild</span>`;
  if (!collection || !item.id) return content;
  const asset = recordMediaAsset(item, mediaAssets, collection, field);
  const targetItem = asset?.id ? { ...item, thumbnail_media_asset_id: asset.id } : item;
  return `<a class="cms-thumb-action" href="${cmsThumbTarget(collection, targetItem, section, field, altField)}" title="${url ? "Bild bearbeiten" : "Thumb mit KI erstellen"}" aria-label="${url ? "Bild bearbeiten" : "Thumb mit KI erstellen"}">${content}</a>`;
}

function eventThumb(event = {}, mediaAssets = [], returnTo = "#/cms/events") {
  const asset = recordMediaAsset(event, mediaAssets, "events", "imageUrl");
  const url = eventImageUrl(event, mediaAssets);
  const content = url ? `<img src="${escapeHtml(url)}" alt="">` : `<span>Bild</span>`;
  const params = new URLSearchParams({
    targetCollection: "events",
    targetId: event.id || "",
    targetField: "imageUrl",
    targetAltField: "thumbnail_alt",
    returnTo
  });
  const href = asset?.id
    ? `#/cms/media/edit?id=${encodeURIComponent(asset.id)}&${params.toString()}`
    : `#/cms/media/library?${params.toString()}`;
  return `<a class="cms-thumb-action" href="${href}" title="${url ? "Eventbild bearbeiten" : "Eventbild aus Mediathek waehlen"}" aria-label="${url ? "Eventbild bearbeiten" : "Eventbild aus Mediathek waehlen"}">${content}</a>`;
}

function eventActionButtons(event = {}) {
  const isActive = ["published", "active"].includes(event.status);
  const nextStatus = isActive ? "inactive" : "published";
  const toggleClass = isActive ? "icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ? "Aktiv: auf inaktiv setzen" : "Inaktiv: auf aktiv setzen";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/event/${event.id}" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-event-status="${escapeHtml(event.id)}" data-status="${nextStatus}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ? "eye" : "eyeOff")}</button></div>`;
}

function eventFollowUpActionButtons(event = {}) {
  const isActive = ["published", "active"].includes(event.status);
  const nextStatus = isActive ? "inactive" : "published";
  const toggleClass = isActive ? "icon-button--visible" : "icon-button--hidden";
  const toggleLabel = isActive ? "Aktiv: auf inaktiv setzen" : "Inaktiv: auf aktiv setzen";
  return `<div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/event/${event.id}?tab=post" title="Rückblick bearbeiten" aria-label="Rückblick bearbeiten">${iconImage("edit")}</a><button class="icon-button ${toggleClass}" type="button" data-event-status="${escapeHtml(event.id)}" data-status="${nextStatus}" data-lifecycle-phase="${isActive ? "archived" : "archive_published"}" title="${toggleLabel}" aria-label="${toggleLabel}">${iconImage(isActive ? "eye" : "eyeOff")}</button><button class="icon-button icon-button--danger" type="button" data-delete-event="${escapeHtml(event.id)}" data-delete-return="cms/followup" title="Loeschen" aria-label="Loeschen">${iconImage("trash")}</button></div>`;
}

function eventImageUrl(event = {}, mediaAssets = []) {
  const asset = recordMediaAsset(event, mediaAssets, "events", "imageUrl");
  return mediaAssetUrl(asset || {}) || event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "";
}

function eventFollowUpTable(events = [], mediaAssets = [], allEditorial = []) {
  return `<section class="panel"><div class="table-wrap"><table class="table table--editorial table--event-followup table--with-audio"><thead><tr><th>Bild</th><th>Titel</th><th>Datum</th><th>Status</th><th>Audio</th><th>Medien</th><th>Aktionen</th></tr></thead><tbody>${events.length ? events.map((event) => {
    const retrospectiveArticle = allEditorial.find((item) => {
      const category = String(item.category || "").toLowerCase();
      return retrospectiveMatchesEvent(item, event)
        && (item.isRetrospective || category.includes("rückblick") || category.includes("rueckblick") || category.includes("rÃ¼ckblick"))
        && (item.page === "press" || item.section === "pressRelease");
    });
    return `<tr>
    <td><div class="topic-thumb topic-thumb--table editorial-thumb--table event-thumb--table">${eventThumb(event, mediaAssets, "#/cms/followup")}</div></td>
    <td><a class="link editorial-title-link" href="#/cms/event/${event.id}?tab=post" title="${escapeHtml(event.title || "-")}">${escapeHtml(shortText(event.title || "-", 70))}</a>${event.subtitle ? `<small>${escapeHtml(shortText(event.subtitle, 95))}</small>` : ""}</td>
    <td>${escapeHtml(formatDate(event.date))}</td>
    <td>${status(event.lifecyclePhase === "archive_published" ? "published" : event.status || event.lifecyclePhase || "draft")}</td>
    <td>${retrospectiveArticle ? audioListCell("editorialContent", retrospectiveArticle) : `<small class="muted">Rückblick-Beitrag fehlt</small>`}</td>
    <td>${editorialMediaFlags(retrospectiveArticle || event)}</td>
    <td>${eventFollowUpActionButtons(event)}</td>
  </tr>`;
  }).join("") : `<tr><td colspan="7">Noch keine Rueckblicke vorhanden.</td></tr>`}</tbody></table></div></section>`;
}

function editorialSummaryThumb(item = {}) {
  const url = editorialThumbUrl(item);
  return url ? `<span class="editorial-tool-summary-thumb"><img src="${escapeHtml(url)}" alt=""></span>` : "";
}

function galleryThumb(gallery) {
  const images = Array.isArray(gallery.images) ? gallery.images : [];
  const first = images
    .filter((image) => image.url)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))[0];
  return first?.url
    ? `<img src="${escapeHtml(first.url)}" alt="">`
    : `<span>Galerie</span>`;
}

function imageDropzone({ inputName, removeName, imageUrl = "", label = "Bild", defaultSize = "240x180", aiCollage = false }) {
  return `<div class="image-dropzone" data-image-dropzone>
    <input type="hidden" name="${removeName}" value="">
    <input type="hidden" name="${inputName}DataUrl" value="">
    <input type="hidden" name="${inputName}FileName" value="">
    <input class="image-dropzone__input" type="file" name="${inputName}" accept="image/*">
    ${aiCollage ? `<div class="image-mode-switch" role="group" aria-label="Bildquelle waehlen">
      <button class="is-active" type="button" data-image-mode="upload">Bild hochladen</button>
      <button type="button" data-image-mode="ai">Bild erzeugen</button>
    </div>` : ""}
    <div data-image-mode-panel="upload">
    <div class="image-dropzone__header">
      <div><strong>${escapeHtml(label)} hochladen</strong><p>Drag-and-drop, Klick auf die Vorschau oder Datei auswaehlen.</p></div>
    </div>
    <div class="image-dropzone__preview ${imageUrl ? "has-image" : ""}" data-image-preview>
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="">` : `<span>${escapeHtml(label)} per Drag-and-drop oder Klick hochladen</span>`}
    </div>
    </div>
    <button type="button" class="image-dropzone__remove" data-image-remove aria-label="Bild-Verknuepfung loesen" title="Bild-Verknuepfung loesen" ${imageUrl ? "" : "hidden"}>${iconImage("trash")}</button>
    <div class="image-dropzone__tools" data-image-tools hidden>
      <label>Zoom <input type="range" min="0.5" max="3" step="0.01" value="1" data-image-zoom></label>
      <label>Aufloesung <select data-image-size>
        ${[["240x180", "Thumb 240 x 180"], ["480x240", "Logo 480 x 240"], ["480x360", "Thumb 480 x 360"], ["1200x675", "Artikel 1200 x 675"], ["1600x900", "Hero 1600 x 900"]].map(([value, text]) => `<option value="${value}" ${value === defaultSize ? "selected" : ""}>${text}</option>`).join("")}
      </select></label>
      <button type="button" class="button button--secondary button--small" data-image-crop>Crop anwenden</button>
    </div>
    <p class="muted" data-image-resolution>Ausgabeformat: ${escapeHtml(defaultSize.replace("x", " x "))} px.</p>
    ${aiCollage ? `<div class="image-dropzone__ai" data-image-mode-panel="ai" hidden>
      <label>KI-Collage erzeugen</label>
      <textarea name="${inputName}AiPrompt" data-ai-image-prompt placeholder="Optional: Motiv, Stil oder Schwerpunkt fuer die Collage beschreiben. Leer lassen = aus Titel, Subtitel und Text ableiten."></textarea>
      <button class="button button--secondary button--small" type="button" data-ai-image-generate>KI-Collage als Thumb erzeugen</button>
    </div>` : ""}
    <p class="image-dropzone__status" data-image-status>${imageUrl ? "Bild ist gespeichert." : "Kein Bild gespeichert."}</p>
  </div>`;
}

function linkedMediaActions({ collection = "", id = "", field = "imageUrl", altField = "thumbnail_alt", returnTo = "", label = "Thumb", assetId = "" } = {}) {
  if (!collection || !id) return "";
  const params = new URLSearchParams({
    targetCollection: collection,
    targetId: id,
    targetField: field,
    targetAltField: altField,
    returnTo
  });
  const editHref = assetId ? `#/cms/media/edit?id=${encodeURIComponent(assetId)}&${params.toString()}` : "";
  return `<div class="linked-media-actions">
    <a class="button button--secondary button--small" href="${editHref || `#/cms/media/library?${params.toString()}`}">${escapeHtml(label)} ${assetId ? "bearbeiten" : "aus Mediathek waehlen"}</a>
    <a class="button button--secondary button--small" href="#/cms/media/ai?${params.toString()}">${escapeHtml(label)} erstellen</a>
  </div>`;
}

function eventImageEditor(event = {}, mediaAssets = [], returnTo = "") {
  const asset = recordMediaAsset(event, mediaAssets, "events", "imageUrl");
  const imageUrl = eventImageUrl(event, mediaAssets);
  return `<div class="field"><label>Eventbild / Thumb</label>
    ${imageDropzone({ inputName: "eventImage", removeName: "removeEventImage", imageUrl, label: "Eventbild", defaultSize: "1200x675" })}
    ${linkedMediaActions({ collection: "events", id: event.id, field: "imageUrl", altField: "thumbnail_alt", returnTo, label: "Bild", assetId: asset?.id || "" })}
    <p class="muted">Bild aus der Mediathek waehlen, Thumb erstellen oder optional direkt eine neue Datei hochladen.</p>
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
    ? `#/cms/media/edit?id=${encodeURIComponent(currentAsset.id)}&${params.toString()}`
    : `#/cms/media/library?${params.toString()}`;
  return `<div class="member-logo-editor">
    <div class="member-logo-editor__preview">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(item.name || "")}">` : memberLogoFallback(item)}</div>
    <div class="member-logo-editor__actions">
      <a class="button button--primary button--small" href="${editHref}">Logo bearbeiten</a>
      ${logoUrl ? `<button class="button button--secondary button--small" type="button" data-clear-member-logo="${escapeHtml(item.id || "")}">Logo loeschen</button>` : ""}
      <p class="muted">Speichern im Mediathek-Editor ersetzt dieses Mitgliederlogo im bestehenden Mitgliedsprofil.</p>
    </div>
  </div>`;
}

function memberLogoThumb(item = {}, mediaAssets = [], section = "all") {
  const currentAsset = memberLogoAsset(item, mediaAssets);
  const logoUrl = memberLogoUrl(item, mediaAssets);
  const content = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="">`
    : memberLogoFallback(item);
  if (!item.id) return content;
  const targetItem = { ...item, logoUrl, logo_media_asset_id: currentAsset?.id || item.logo_media_asset_id || "", thumbnail_media_asset_id: currentAsset?.id || item.thumbnail_media_asset_id || item.mediaAssetId || "" };
  return `<a class="cms-thumb-action" href="${cmsThumbTarget("members", targetItem, section, "logoUrl", "altText")}" title="${logoUrl ? "Logo bearbeiten" : "Logo mit KI erstellen"}" aria-label="${logoUrl ? "Logo bearbeiten" : "Logo mit KI erstellen"}">${content}</a>`;
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
  const topicLimitReached = assignedTopics.length >= 6;
  const requestedMode = query.get("mode") || "";
  const mode = topicLimitReached && ["new", "assign"].includes(requestedMode) ? "" : requestedMode;
  const selectedTopicId = query.get("topic") || "";
  const selectedSpeakerId = query.get("speaker") || "";
  const detailPanel = mode && mode !== "assign" ? topicEditorPanel(event, topics, speakers, mode, selectedTopicId, selectedSpeakerId) : "";
  const assignPanel = topicAssignPanel(event, topics, mode);
  const newHref = topicLimitReached && mode !== "new" ? `#/cms/event/${event.id}?tab=topics` : mode === "new" ? `#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=new`;
  const newClass = mode === "new" ? "button button--primary button--small" : `button button--secondary button--small${topicLimitReached ? " disabled" : ""}`;
  const assignHref = topicLimitReached && mode !== "assign" ? `#/cms/event/${event.id}?tab=topics` : mode === "assign" ? `#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=assign`;
  const assignClass = mode === "assign" ? "button button--primary button--small" : `button button--secondary button--small${topicLimitReached ? " disabled" : ""}`;
  const removeHref = mode === "remove" ? `#/cms/event/${event.id}?tab=topics` : `#/cms/event/${event.id}?tab=topics&mode=remove`;
  const removeClass = mode === "remove" ? "button button--primary button--small" : "button button--secondary button--small";
  return `<div class="topic-workspace">
    <section class="topic-list-panel">
      <div class="topic-actionbar">
        <a class="${newClass}" href="${newHref}">+ Neu</a>
        <a class="${assignClass}" href="${assignHref}">+ Zuordnen</a>
        <a class="${removeClass}" href="${removeHref}">Loeschen</a>
      </div>
      <p class="muted">Pro Medienfruehstueck sind maximal 6 Vortraege vorgesehen. Jeder Vortrag besteht aus Thema, Beschreibung und Referent.</p>
      ${topicLimitReached ? `<div class="alert">Maximal 6 Vortraege sind erreicht. Bitte zuerst einen Vortrag entfernen, bevor ein neuer hinzugefuegt wird.</div>` : ""}
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
      <p class="muted">${assignedTopics.length} von 6 Vortraegen</p>
    </section>
  </div>`;
}

function eventPartnersEditor(event, sponsors, mediaAssets = []) {
  const selectedPartner = sponsors.find((item) => item.id === event.hostId) || null;
  const selectedAsset = selectedPartner ? recordMediaAsset(selectedPartner, mediaAssets, "sponsors", "logoUrl") : null;
  const selectedLogo = mediaAssetUrl(selectedAsset || {}) || selectedPartner?.logoUrl || "";
  const sponsorLogo = (partner = {}) => {
    const asset = recordMediaAsset(partner, mediaAssets, "sponsors", "logoUrl");
    return mediaAssetUrl(asset || {}) || partner.logoUrl || "";
  };
  return `<form id="event-partners-form" data-event-id="${event.id}" class="form-grid">
    <div class="actions" style="justify-content:space-between"><div><h2>Gastgeber / Co-Gastgeber</h2><p class="muted">PROdigitalTV ist immer Gastgeber. Pro Event kann genau ein Co-Gastgeber ausgewaehlt werden.</p></div><button class="button button--primary button--small">Alles speichern</button></div>
    <section class="panel" style="background:var(--pdt-bg)"><h3>Gastgeber</h3><div class="event-host-static"><strong>PROdigitalTV</strong><small>Gastgeber</small></div></section>
    <section class="panel"><h3>Co-Gastgeber auswaehlen</h3><div class="table-wrap"><table class="table table--editorial table--event-partners"><thead><tr><th>Logo</th><th>Gastgeber</th><th>Rolle</th><th>Status</th><th>Aktionen</th></tr></thead><tbody><tr><td><span class="topic-thumb topic-thumb--table partner-logo-thumb partner-logo-thumb--empty">PRO</span></td><td><label class="event-partner-choice"><input type="radio" name="hostId" value="" ${!event.hostId ? "checked" : ""}><span><strong>Kein Co-Gastgeber</strong><small>Nur PROdigitalTV anzeigen</small></span></label></td><td>Gastgeber</td><td>${status(!event.hostId ? "active" : "inactive")}</td><td><div class="table-actions table-actions--icons"></div></td></tr>${sponsors.length ? sponsors.map((partner) => { const logo = sponsorLogo(partner); const isSelected = event.hostId === partner.id; return `<tr><td><span class="topic-thumb topic-thumb--table partner-logo-thumb">${logo ? `<img src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(partner.name || "")}">` : `<span>${escapeHtml((partner.name || "?").slice(0, 2).toUpperCase())}</span>`}</span></td><td><label class="event-partner-choice"><input type="radio" name="hostId" value="${partner.id}" ${isSelected ? "checked" : ""}><span><strong>${escapeHtml(partner.name || "")}</strong><small>${escapeHtml(partner.website || "")}</small></span></label></td><td>${escapeHtml(partner.role || "Co-Gastgeber")}</td><td>${status(isSelected ? "active" : "inactive")}</td><td><div class="table-actions table-actions--icons"><a class="icon-button icon-button--edit" href="#/cms/edit?module=sponsors&id=${partner.id}&section=sponsors" title="Bearbeiten" aria-label="Bearbeiten">${iconImage("edit")}</a></div></td></tr>`; }).join("") : `<tr><td colspan="5">Noch keine Co-Gastgeber vorhanden.</td></tr>`}</tbody></table></div></section>
    <section class="panel" style="background:var(--pdt-bg)"><h3>Ausgewaehlten Co-Gastgeber bearbeiten</h3>${selectedPartner ? `<div class="partner-editor-grid" style="margin-top:14px"><div class="partner-logo-editor"><div class="member-logo-editor__preview">${selectedLogo ? `<img src="${escapeHtml(selectedLogo)}" alt="Logo ${escapeHtml(selectedPartner.name || "")}">` : `<span>Noch kein Logo</span>`}</div>${linkedMediaActions({ collection: "sponsors", id: selectedPartner.id, field: "logoUrl", altField: "altText", returnTo: `#/cms/event/${event.id}?tab=partners`, label: "Logo", assetId: selectedAsset?.id || "" })}</div><div class="form-grid--two"><div class="field"><label>Name</label><input name="edit-sponsor-${selectedPartner.id}-name" value="${escapeHtml(selectedPartner.name || "")}"></div><div class="field"><label>Rolle</label><input name="edit-sponsor-${selectedPartner.id}-role" value="Co-Gastgeber" readonly></div><div class="field"><label>Website</label><input name="edit-sponsor-${selectedPartner.id}-website" value="${escapeHtml(selectedPartner.website || "")}"></div><div class="field"><label>Beschreibung</label><textarea name="edit-sponsor-${selectedPartner.id}-description">${escapeHtml(selectedPartner.description || "")}</textarea>${aiFieldActions([{ action: "generateSponsorText", target: `edit-sponsor-${selectedPartner.id}-description`, label: "Co-Gastgebertext", entityType: "sponsor", entityId: selectedPartner.id, fieldName: "description" }])}</div></div></div>` : `<p>Noch kein Co-Gastgeber ausgewaehlt.</p>`}</section>
    <section class="panel"><h3>Neuen Co-Gastgeber anlegen und zuordnen</h3><div class="form-grid--two"><div class="field"><label>Name</label><input name="newSponsorName"></div><input type="hidden" name="newSponsorRole" value="Co-Gastgeber"><div class="field"><label>Website</label><input name="newSponsorWebsite"></div><div class="field"><label>Beschreibung</label><textarea name="newSponsorDescription"></textarea></div></div><p class="muted">Ein neu angelegter Co-Gastgeber wird direkt als einziger Co-Gastgeber dieses Events gesetzt.</p></section>
    <div class="actions"><button class="button button--primary">Co-Gastgeber speichern</button></div><div id="event-partners-result"></div>
  </form>`;
}

export async function eventEditPage(id, tab = "base", query = new URLSearchParams()) {
  if (!hasCmsAccess()) return denied();
  let event = id === "new" ? {
    id: `event-${crypto.randomUUID()}`, title: "", subtitle: "", date: "2026-08-01", startTime: "10:00", endTime: "13:00", locationName: "", city: "", description: "", eventType: "Panel", accessType: "public", status: "draft", lifecyclePhase: "planning", registrationEnabled: false, maxParticipants: 50, expiresAt: "", address: "", phone: "", topicIds: [], speakerIds: [], sponsorIds: []
  } : await getOne("events", id);
  if (!event) return eventsAdminPage();
  const [topics, speakers, sponsors, registrations, media, settings, allEvents, galleries, allEditorial, mediaAssets, audioProviders, videoLibrary] = await Promise.all([list("topics"), list("speakers"), list("sponsors"), list("registrations"), list("eventMedia"), list("settings"), list("events"), list("galleries"), list("editorialContent"), list("media_assets").catch(() => []), getOne("settings", "audioProviders").catch(() => null), list("media_videos").catch(() => [])]);
  const eventTypes = settingValue(settings, "eventTypes", ["Medienfruehstueck", "Summit", "Roundtable", "Panel", "Webinar", "Konferenz", "Workshop"]);
  const galleryOptions = [`<option value="">Keine Galerie verknuepfen</option>`, ...galleries
    .filter((gallery) => gallery.status !== "archived")
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "de"))
    .map((gallery) => `<option value="${escapeHtml(gallery.id)}" ${event.galleryId === gallery.id || (!event.galleryId && gallery.eventId === event.id) ? "selected" : ""}>${escapeHtml(gallery.title || gallery.id)} (${(gallery.images || []).length} Bilder)</option>`)].join("");
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
        <button type="button" class="button button--primary button--small" data-create-event-retrospective="${escapeHtml(event.id)}">${retrospectiveArticle ? "Rückblick aktualisieren" : "Rückblick erstellen"}</button>
        ${retrospectiveArticle ? `<a class="button button--secondary button--small" href="#/cms/edit?module=editorialContent&id=${escapeHtml(retrospectiveArticle.id)}&section=press">Beitrag öffnen</a>` : ""}
      </div>
    </div>
    <div id="event-retrospective-result" class="muted">${retrospectiveArticle ? `Verknüpfter Beitrag: ${escapeHtml(retrospectiveArticle.title || retrospectiveArticle.id)}` : "Noch kein redaktioneller Rückblick zu diesem Event vorhanden."}</div>
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
    content = `<form id="event-edit-form" data-event-id="${event.id}" class="form-grid is-save-aware"><div class="form-grid--two"><div class="field"><label>Titel</label><input name="title" value="${escapeHtml(event.title)}" required>${aiFieldActions([{ action: "generateEventDescription", target: "title", label: "Ueberschrift vorschlagen", entityId: event.id, fieldName: "title" }])}</div><div class="field"><label>Untertitel</label><input name="subtitle" value="${escapeHtml(event.subtitle)}"></div></div><div class="field"><label>Beschreibung</label><textarea name="description">${escapeHtml(event.description)}</textarea>${aiFieldActions([{ action: "improveText", target: "description", label: "Mit ChatGPT bearbeiten", entityId: event.id, fieldName: "description" }, { action: "shortenText", target: "description", label: "Fuer Mobile kuerzen", entityId: event.id, fieldName: "description" }, { action: "generateSeoMeta", target: "description", label: "SEO erzeugen", entityId: event.id, fieldName: "description" }])}</div><div class="form-grid--two"><div class="field"><label>Datum</label><input type="date" name="date" value="${event.date}"></div><div class="field"><label>Eventtyp</label><select name="eventType">${eventTypes.map((value) => `<option ${value === event.eventType ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div><div class="field"><label>Neuen Eventtyp hinzufuegen</label><input name="newEventType" placeholder="z. B. Fachgespraech"></div><div class="field"><label>Bildergalerie</label><select name="galleryId">${galleryOptions}</select><p class="muted">Bilder werden im Bereich Bildergalerien freigegeben und dieser Galerie zugeordnet.</p></div>${eventImageEditor(event, mediaAssets, `#/cms/event/${event.id}?tab=base`)}<div class="field"><label>Aktiv / Inaktiv</label><select name="status"><option value="published" ${event.status === "published" ? "selected" : ""}>Aktiv</option><option value="inactive" ${event.status === "inactive" ? "selected" : ""}>Inaktiv</option><option value="draft" ${event.status === "draft" ? "selected" : ""}>Entwurf</option><option value="archived" ${event.status === "archived" ? "selected" : ""}>Archiviert</option></select></div><div class="field"><label>Beginn</label><input type="time" name="startTime" value="${event.startTime}"></div><div class="field"><label>Ende</label><input type="time" name="endTime" value="${event.endTime}"></div><div class="field"><label>Location</label><input name="locationName" value="${escapeHtml(event.locationName || "")}"></div><div class="field"><label>Adresse</label><input name="address" value="${escapeHtml(event.address || "")}"></div><div class="field"><label>Stadt</label><input name="city" value="${escapeHtml(event.city || "")}"></div><div class="field"><label>Telefon Location</label><input name="phone" value="${escapeHtml(event.phone || "")}"></div><div class="field"><label>Ablaufdatum / automatisch ausblenden</label><input type="datetime-local" name="expiresAt" value="${event.expiresAt ? event.expiresAt.slice(0, 16) : ""}"></div><div class="field"><label>Zugangsart</label><select name="accessType">${Object.entries(accessLabels).map(([key, value]) => `<option value="${key}" ${key === event.accessType ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label>Lifecycle</label><select name="lifecyclePhase">${Object.entries(lifecycleLabels).map(([key, value]) => `<option value="${key}" ${key === event.lifecyclePhase ? "selected" : ""}>${value}</option>`).join("")}</select></div></div><div class="actions"><button class="button button--primary">Event speichern</button>${id !== "new" ? `<button type="button" class="button button--secondary" data-delete-event="${event.id}">Event loeschen</button>` : ""}</div><div id="event-save-result"></div></form>`;
    if (isPastCmsEvent(event)) {
      content = content
        .replace(`<div class="field"><label>Telefon Location</label><input name="phone" value="${escapeHtml(event.phone || "")}"></div>`, "")
        .replace(`<div class="field"><label>Ablaufdatum / automatisch ausblenden</label><input type="datetime-local" name="expiresAt" value="${event.expiresAt ? event.expiresAt.slice(0, 16) : ""}"></div>`, "")
        .replace(`<div class="field"><label>Zugangsart</label><select name="accessType">${Object.entries(accessLabels).map(([key, value]) => `<option value="${key}" ${key === event.accessType ? "selected" : ""}>${value}</option>`).join("")}</select></div>`, "")
        .replace(`<div class="field"><label>Lifecycle</label><select name="lifecyclePhase">${Object.entries(lifecycleLabels).map(([key, value]) => `<option value="${key}" ${key === event.lifecyclePhase ? "selected" : ""}>${value}</option>`).join("")}</select></div>`, "");
    }
  } else if (tab === "topics") {
    content = eventTopicsEditor(event, topics, speakers, allEvents, query);
  } else if (tab === "__old_topics") {
    content = `<h2>Zugeordnete Themen</h2><div class="filters">${topics.map((topic) => `<span class="filter ${event.topicIds.includes(topic.id) ? "active" : ""}">${escapeHtml(topic.title)}</span>`).join("")}</div><p>Themenspezifische Beschreibung und Sortierung koennen hier redaktionell erweitert werden.</p><div class="table-wrap" style="margin-top:22px"><table class="table"><thead><tr><th>Thema</th><th>Referenten</th></tr></thead><tbody>${topics.filter((topic) => event.topicIds.includes(topic.id)).map((topic) => { const topicSpeakers = speakers.filter((speaker) => speaker.topicId === topic.id || (event.speakerIds || []).includes(speaker.id)); return `<tr><td>${escapeHtml(topic.title)}</td><td>${topicSpeakers.length ? topicSpeakers.map((speaker) => `<div class="person"><div>${speaker.photoUrl ? `<img src="${escapeHtml(speaker.photoUrl)}" alt="">` : ""}</div><div><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml([speaker.company, speaker.position].filter(Boolean).join(" · "))}</small>${speaker.shortBio ? `<p>${escapeHtml(speaker.shortBio)}</p>` : ""}</div></div>`).join("") : "Noch kein Referent zugeordnet."}</td></tr>`; }).join("")}</tbody></table></div>`;
  } else if (tab === "speakers") {
    const assignedSpeakers = speakers.filter((item) => (event.speakerIds || []).includes(item.id));
    content = `<h2>Referenten im Eventkontext</h2><form id="event-speakers-form" data-event-id="${event.id}" class="form-grid"><div class="selection-grid">${speakers.length ? speakers.map((speaker) => `<label class="selection-item"><input type="checkbox" name="speakerIds" value="${speaker.id}" ${(event.speakerIds || []).includes(speaker.id) ? "checked" : ""}><span><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml(speaker.position || speaker.company || "")}</small></span>${status(speaker.status || "draft")}</label>`).join("") : `<div class="alert">Noch keine Referenten angelegt. Bitte zuerst im Bereich Referenten ein Profil mit Foto und Vita erstellen.</div>`}</div><div class="actions"><button class="button button--primary">Zuordnung speichern</button><a class="button button--secondary" href="#/cms/speakers">Referentenprofile verwalten</a></div><div id="speaker-assignment-result"></div></form>${assignedSpeakers.length ? `<div class="table-wrap" style="margin-top:24px"><table class="table"><thead><tr><th>Zugeordnet</th><th>Unternehmen</th><th>Profil</th></tr></thead><tbody>${assignedSpeakers.map((speaker) => `<tr><td>${escapeHtml(speaker.name)}</td><td>${escapeHtml(speaker.company || "-")}</td><td>${speaker.photoUrl ? "Foto vorhanden" : "Foto fehlt"} · ${speaker.shortBio || speaker.longBio ? "Vita vorhanden" : "Vita fehlt"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
  } else if (tab === "partners") {
    content = eventPartnersEditor(event, sponsors, mediaAssets);
  } else if (tab === "registration") {
    const assigned = registrations.filter((item) => item.eventId === event.id);
    content = `<div class="actions" style="justify-content:space-between;margin-bottom:18px"><h2>Anmeldungen (${assigned.length})</h2><button class="button button--secondary button--small" data-export-event="${event.id}">Anmeldungen als CSV herunterladen</button></div><section class="panel" style="background:var(--pdt-bg)"><h2>Mailtexte mit Platzhaltern</h2><p>KI erzeugt Mailtexte mit Platzhaltern und ohne echte Teilnehmerdaten.</p>${aiFieldActions([{ action: "generateRegistrationMailText", target: "ai-mail-context", label: "Bestaetigungsmail erzeugen", entityId: event.id, fieldName: "mailText" }, { action: "generateRegistrationMailText", target: "ai-mail-context", label: "Wartelistenmail erzeugen", entityId: event.id, fieldName: "waitlistMail" }])}</section><div class="table-wrap"><table class="table"><thead><tr><th>Teilnehmer</th><th>Unternehmen</th><th>E-Mail</th><th>Status</th></tr></thead><tbody>${assigned.map((registration) => `<tr><td>${registration.firstName} ${registration.lastName}</td><td>${registration.company}</td><td>${registration.email}</td><td>${status(registration.status)}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (tab === "pre") {
    const saveTheDateText = event.saveTheDateText || `Save the date: ${event.title || "PROdigitalTV Event"} am ${event.date ? formatDate(event.date) : "geplanten Termin"}.`;
    const invitationText = event.invitationText || `Wir laden Sie herzlich zum ${event.title || "PROdigitalTV Event"} ein.`;
    const preStatus = event.preStatus || "save_the_date";
    content = `<h2>Vorlauf</h2><form id="event-edit-form" data-event-id="${event.id}" data-event-form-section="pre" class="form-grid is-save-aware"><div class="field"><label>Vorlauf-Status</label><select name="preStatus"><option value="save_the_date" ${preStatus === "save_the_date" ? "selected" : ""}>Save the date - Anmeldung geschlossen</option><option value="invitation_published" ${preStatus === "invitation_published" ? "selected" : ""}>Einladung aktiv - Anmeldung offen</option></select></div><div class="field"><label>Save-the-date-Text</label><textarea name="saveTheDateText">${escapeHtml(saveTheDateText)}</textarea></div><div class="field"><label>Einladungstext</label><textarea name="invitationText">${escapeHtml(invitationText)}</textarea>${aiFieldActions([{ action: "generateEventInvitation", target: "invitationText", label: "Einladungstext erzeugen", entityId: event.id, fieldName: "invitationText" }])}</div><div class="actions"><button class="button button--primary">Vorlauf speichern</button></div><div id="event-save-result"></div></form>`;
  } else if (tab === "ai") {
    const eventMedia = media.filter((item) => item.eventId === event.id);
    content = `<h2>KI-Pruefung</h2><p class="muted" style="margin-bottom:18px">Diese Pruefung erzeugt redaktionelle Empfehlungen. Blocker kommen weiterhin aus der regelbasierten Pipeline-Validierung.</p><div class="ai-quality-card"><button type="button" class="button button--primary ai-action" data-ai-action="analyzeEventPipelineQuality" data-ai-target="ai-quality-context" data-ai-entity-type="event" data-ai-entity-id="${event.id}" data-ai-field="pipelineQuality">Pipeline mit ChatGPT pruefen</button><div id="ai-quality-context" hidden>${escapeHtml(JSON.stringify({ event, media: eventMedia }))}</div></div><div class="setup-steps" style="margin-top:20px"><div class="setup-step"><span>Pflichtfelder fehlen?</span><strong>${event.title && event.date && event.locationName ? "ok" : "pruefen"}</strong></div><div class="setup-step"><span>SEO-Daten vorhanden?</span><strong>${event.seoTitle && event.seoDescription ? "ok" : "Empfehlung"}</strong></div><div class="setup-step"><span>Alt-Texte bei Bildern?</span><strong>${eventMedia.some((item) => !item.altText) ? "Empfehlung" : "ok"}</strong></div></div>`;
  } else {
    const assigned = media.filter((item) => item.eventId === event.id);
    content = `<h2>${tab === "post" ? "Event-Nacharbeit" : "Medien zum Event"}</h2>${tab === "post" ? `<section class="panel" style="background:var(--pdt-bg)"><h2>Event-Nachlauf mit KI</h2>${aiFieldActions([{ action: "generateArchiveText", target: "longDescription", label: "Nachbericht erzeugen", entityId: event.id, fieldName: "archiveText" }, { action: "generateEventSummary", target: "postEventSummary", label: "Kurztext erzeugen", entityId: event.id, fieldName: "postEventSummary" }])}</section>` : `<section class="panel" style="background:var(--pdt-bg)"><h2>Fotogalerie und Downloads mit KI</h2><p>Galerie und Downloads bleiben optional. Wenn keine Bilder oder Downloads vorhanden sind, entsteht kein Pflichtfehler.</p>${aiFieldActions([{ action: "generateGalleryIntro", target: "ai-media-context", label: "Galerie-Einleitung", entityId: event.id, fieldName: "galleryIntro" }, { action: "generateImageAltText", target: "ai-media-context", label: "Alt-Texte vorbereiten", entityId: event.id, fieldName: "altTexts" }, { action: "generateDownloadDescription", target: "ai-media-context", label: "Downloadbeschreibung", entityId: event.id, fieldName: "downloadDescription" }])}<div id="ai-media-context" hidden>${escapeHtml(JSON.stringify({ event, media: assigned }))}</div></section>`}${tab === "post" ? `${retrospectiveControl}<form id="event-edit-form" data-event-id="${event.id}" class="form-grid" style="margin-bottom:22px"><div class="field"><label>Nachbericht Kurztext</label><textarea name="postEventSummary">${escapeHtml(event.postEventSummary || event.postEventummary || "")}</textarea></div><div class="field"><label>Langtext / Rückblicktext</label><textarea name="longDescription">${escapeHtml(event.longDescription || event.bodyText || event.articleText || event.archiveText || "")}</textarea><p class="muted">Dieser Text wird als Langtext fuer den redaktionellen Rückblick verwendet.</p></div><div class="actions"><button class="button button--primary button--small">Rückblicktext speichern</button></div><div id="event-save-result"></div></form>` : ""}<form id="media-upload-form" data-event-id="${event.id}" class="upload"><p><strong>Fotos, PDFs oder Praesentationen hochladen</strong></p><p>Drag-and-drop oder Dateiauswahl; Inhalte bleiben bis zur Freigabe intern.</p><input type="file" name="files" multiple style="margin-top:17px"><button class="button button--primary button--small" type="submit" style="margin:15px auto 0">Upload starten</button><div id="upload-result"></div></form><div class="table-wrap"><table class="table"><thead><tr><th>Datei</th><th>Typ</th><th>Sichtbarkeit</th><th>Freigabe</th><th>Aktionen</th></tr></thead><tbody>${assigned.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.mediaType}</td><td>${item.visibility}</td><td>${status(item.status)}</td><td><div class="table-actions"><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="approved">Aktiv</button><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="archived">Inaktiv</button><button class="link-button link-button--danger" data-delete-record="eventMedia" data-record-id="${item.id}">Loeschen</button></div></td></tr>`).join("")}</tbody></table></div>`;
  }
  if (tab === "post") {
    const assigned = media.filter((item) => item.eventId === event.id);
    const selectedGallery = event.galleryId ? galleries.find((gallery) => gallery.id === event.galleryId) : null;
    const postTitleValue = event.retrospectiveTitle || retrospectiveArticle?.title || `Rückblick: ${event.title || "PROdigitalTV Event"}`;
    const postSummaryValue = event.postEventSummary || event.postEventummary || retrospectiveArticle?.introText || retrospectiveArticle?.subtitle || "";
    const postLongValue = event.longDescription || event.bodyText || event.articleText || event.archiveText || retrospectiveArticle?.longDescription || retrospectiveArticle?.bodyText || retrospectiveArticle?.articleText || retrospectiveArticle?.archiveText || "";
    const retrospectiveAudioTool = retrospectiveArticle
      ? audioGenerationPanel("editorialContent", retrospectiveArticle, { variant: "accessible", providerConfig: audioProviders })
      : `<p class="muted">Bitte zuerst den Rückblicktext speichern. Danach wird der redaktionelle Rückblick-Beitrag angelegt und die Vorlesfunktion ist hier verfügbar.</p>`;
    const retrospectiveVideoTool = retrospectiveArticle
      ? articleVideoAttachmentEditor(retrospectiveArticle, videoLibrary)
      : `<details class="editorial-tool-details" data-editor-tool-panel="videos"><summary><span>Medien</span><strong>Videoanhaenge</strong><em>optional</em></summary><div class="editor-tool-section editor-tool-section--videos"><p class="muted">Bitte zuerst den Rückblicktext speichern. Danach wird der redaktionelle Rückblick-Beitrag angelegt und Videos koennen am Beitrag angehaengt werden.</p></div></details>`;
    content = `<h2>Event-Nacharbeit</h2>
      <section class="panel event-post-ai-panel" style="background:var(--pdt-bg)">
        ${aiFieldActions([{ action: "generateArchiveText", target: "longDescription", label: "Nachbericht erzeugen", entityId: event.id, fieldName: "archiveText" }, { action: "generateEventSummary", target: "postEventSummary", label: "Kurztext erzeugen", entityId: event.id, fieldName: "postEventSummary" }])}
      </section>
      <form id="event-edit-form" data-event-id="${event.id}" data-event-form-section="post" class="form-grid is-save-aware event-post-workspace" style="margin-bottom:22px">
        <div class="event-post-workspace__main">
          <div class="field"><label>Headline Rückblick</label><input name="retrospectiveTitle" value="${escapeHtml(postTitleValue)}"></div>
          <div class="field"><label>Nachbericht Kurztext</label><textarea name="postEventSummary">${escapeHtml(postSummaryValue)}</textarea></div>
          <div class="field"><label>Langtext / Rückblicktext</label><textarea name="longDescription">${escapeHtml(postLongValue)}</textarea><p class="muted">Dieser Text wird als Langtext fuer den redaktionellen Rückblick verwendet.</p></div>
          <div class="actions"><button class="button button--primary button--small">Rückblicktext speichern</button></div><div id="event-save-result"></div>
        </div>
        <aside class="event-post-toolbox">
          <details class="editorial-tool-details">
            <summary><span>Medien</span><strong>Bild / Thumb</strong></summary>
            <div class="editor-tool-section editor-tool-section--thumb">${eventImageEditor(event, mediaAssets, `#/cms/event/${event.id}?tab=post`)}</div>
          </details>
          <details class="editorial-tool-details">
            <summary><span>Audio</span><strong>Vorlesen</strong></summary>
            <div class="editor-tool-section editor-tool-section--audio">${retrospectiveAudioTool}</div>
          </details>
          <details class="editorial-tool-details">
            <summary><span>Medien</span><strong>Galerie</strong>${selectedGallery ? `<small class="editorial-tool-state editorial-tool-state--ready">${escapeHtml(selectedGallery.title || "Galerie")}</small>` : `<small class="editorial-tool-state">Keine Galerie</small>`}</summary>
            <div class="editor-tool-section editor-tool-section--gallery"><div class="field"><label>Bildergalerie</label><select name="galleryId">${galleryOptions}</select><p class="muted">Die Galerie wird mit dem Event und dem späteren Rückblick verbunden.</p></div></div>
          </details>
          ${retrospectiveVideoTool}
        </aside>
      </form>
      <form id="media-upload-form" data-event-id="${event.id}" class="upload"><p><strong>Fotos, PDFs oder Praesentationen hochladen</strong></p><p>Drag-and-drop oder Dateiauswahl; Inhalte bleiben bis zur Freigabe intern.</p><input type="file" name="files" multiple style="margin-top:17px"><button class="button button--primary button--small" type="submit" style="margin:15px auto 0">Upload starten</button><div id="upload-result"></div></form>
      <div class="table-wrap"><table class="table"><thead><tr><th>Datei</th><th>Typ</th><th>Sichtbarkeit</th><th>Freigabe</th><th>Aktionen</th></tr></thead><tbody>${assigned.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.mediaType}</td><td>${item.visibility}</td><td>${status(item.status)}</td><td><div class="table-actions"><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="approved">Aktiv</button><button class="link-button" data-record-status="eventMedia" data-record-id="${item.id}" data-status="archived">Inaktiv</button><button class="link-button link-button--danger" data-delete-record="eventMedia" data-record-id="${item.id}">Loeschen</button></div></td></tr>`).join("")}</tbody></table></div>`;
  }
  const activeSection = isPastCmsEvent(event) ? "cms/followup" : "cms/events";
  return protect(cmsShell(activeSection, `${cmsTitle("Event bearbeiten", escapeHtml(event.title || "Neues Event"), `<a class="button button--secondary button--small" href="#/event/${event.id}">Vorschau</a>`)}<section class="panel">${eventTabs(event.id, tab)}${content}</section>`));
}

export async function registrationsPage() {
  if (!hasCmsAccess()) return denied();
  const [registrations, events] = await Promise.all([list("registrations"), list("events")]);
  return protect(cmsShell("cms/registrations", `${cmsTitle("Teilnehmermanagement", "Anmeldungen")}<section class="panel"><div class="field" style="max-width:390px;margin-bottom:18px"><label>Event auswaehlen</label><select>${events.map((event) => `<option>${escapeHtml(event.title)}</option>`).join("")}</select></div><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Event</th><th>Bestaetigung</th><th>Mailstatus</th></tr></thead><tbody>${registrations.map((record) => `<tr><td>${record.firstName} ${record.lastName}</td><td>${record.eventTitle}</td><td>${status(record.status)}</td><td>${status(record.mailStatus)}</td></tr>`).join("")}</tbody></table></div></section>`));
}

export async function mailAdminPage() {
  if (!hasCmsAccess(true)) return denied(true);
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
  interna: {
    active: "cms/editorial/interna",
    title: "Interna",
    itemLabel: "Seitentext",
    route: "cms/editorial/interna",
    createParams: "&page=about&section=internal",
    filter: (item) => isInternalEditorialItem(item)
  }
};

function isPressEditorialItem(item = {}) {
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
  if (isAiGeneratedEditorialItem(item)) return false;
  if (["ueber_uns", "mitglied_werden"].includes(item.bereich)) return true;
  return !["press", "news"].includes(item.page)
    && !["pressRelease", "news"].includes(item.section)
    && (["home", "about", "join", "imprint", "privacy", "legal", "contact", "login", "members", "board"].includes(item.page)
      || ["intro", "hero", "legal", "internal", "footer"].includes(item.section));
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
  const editorialConfig = module === "editorialContent" ? editorialSections[section] || editorialSections.all : null;
  const records = (await list(module))
    .filter((item) => !editorialConfig || editorialConfig.filter(item))
    .filter((item) => module !== "editorialContent" || section !== "interna" || !isAiGeneratedEditorialItem(item))
    .filter((item) => module !== "members" || memberIsManagedActive(item))
    .sort((a, b) => {
      if (module === "members") {
        const sortA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999;
        const sortB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999;
        if (sortA !== sortB) return sortA - sortB;
        return String(a.name || "").localeCompare(String(b.name || ""), "de", { sensitivity: "base" });
      }
      const dateA = listDateSortValue(a);
      const dateB = listDateSortValue(b);
      if (dateA || dateB) return dateB - dateA;
      return Number(b.sortOrder || 0) - Number(a.sortOrder || 0);
    });
  const memberMediaAssets = module === "members" ? await list("media_assets").catch(() => []) : [];
  const linkedMediaAssets = ["editorialContent", "boardMembers", "speakers", "sponsors"].includes(module) ? await list("media_assets").catch(() => []) : [];
  const active = editorialConfig?.active || { topics: "cms/topics", galleries: "cms/galleries", speakers: "cms/speakers", sponsors: "cms/sponsors", members: "cms/members", membershipApplications: "cms/membership-applications", memberDocuments: "cms/member-documents", memberDirectories: "cms/member-directories", users: "cms/users", boardMembers: "cms/board", editorialContent: "cms/editorial", mailQueue: "cms/mail", eventMedia: "cms/followup" }[module];
  const editable = !["mailQueue", "eventMedia"].includes(module);
  const manageable = module !== "mailQueue";
  const inactiveStatus = module === "editorialContent" || module === "eventMedia" || module === "speakers" || module === "sponsors" || module === "galleries" || module === "memberDocuments" ? "archived" : "inactive";
  const activeStatus = ["editorialContent", "speakers", "sponsors", "galleries", "memberDocuments"].includes(module) ? "published" : module === "eventMedia" ? "approved" : "active";
  const title = editorialConfig?.title || config[0];
  const itemLabel = editorialConfig?.itemLabel || config[1];
  const createParams = editorialConfig?.createParams || "";
  const emptyText = editorialConfig ? `Noch keine Inhalte in ${escapeHtml(title)}.` : "Noch keine Eintraege vorhanden.";
  if (module === "topics") {
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial table--topics table--with-audio"><thead><tr><th>Bild</th><th>Titel</th><th>Datum</th><th>Rubrik</th><th>Audio</th><th>Medien</th><th>Aktionen</th></tr></thead><tbody>${records.length ? records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table">${topicThumb(item)}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a></td><td>${escapeHtml(listDate(item))}</td><td>Thema</td><td>${audioListCell("topics", item)}</td><td>${editorialMediaFlags(item)}</td><td>${editorialActionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="7">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "galleries") {
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial table--galleries"><thead><tr><th>Bild</th><th>Titel</th><th>Bilder</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${records.length ? records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table gallery-thumb--table">${galleryThumb(item)}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a><small>${escapeHtml(shortText(item.description || "-", 90))}</small></td><td>${(item.images || []).length}</td><td>${galleryListStatus(item)}</td><td>${galleryActionButtons(item, section)}</td></tr>`).join("") : `<tr><td colspan="5">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "editorialContent") {
    const actionButtons = section === "interna" ? lockedEditorialActionButtons : editorialVisibilityActionButtons;
    const isNewsList = section === "news";
    const selectHead = isNewsList ? `<th class="cms-bulk-select-col"><input type="checkbox" data-news-bulk-select-all ${records.length ? "" : "disabled"} aria-label="Alle News auswaehlen"></th>` : "";
    const selectCell = (item) => isNewsList ? `<td class="cms-bulk-select-col"><input type="checkbox" data-news-bulk-item="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title || "News")} auswaehlen"></td>` : "";
    const emptyColspan = isNewsList ? 8 : 7;
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel">${isNewsList ? newsBulkToolbar(records) : ""}<div class="table-wrap"><table class="table table--editorial table--with-audio${section === "press" ? " table--press" : ""}${section === "news" ? " table--news" : ""}"><thead><tr>${selectHead}<th>Bild</th><th>Titel</th><th>Datum</th><th>Rubrik</th><th>Audio</th><th>Medien</th><th>Aktionen</th></tr></thead><tbody>${records.length ? records.map((item) => `<tr>${selectCell(item)}<td><div class="topic-thumb topic-thumb--table editorial-thumb--table">${editorialThumb(item, { collection: "editorialContent", section, field: "imageUrl", altField: "thumbnail_alt", mediaAssets: linkedMediaAssets })}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item.title || "-")}">${escapeHtml(shortText(item.title || "-", 60))}</a></td><td>${escapeHtml(listDate(item))}</td><td>${escapeHtml(item.category || item.page || "-")}</td><td>${audioListCell("editorialContent", item)}</td><td>${editorialMediaFlags(item)}</td><td>${actionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="${emptyColspan}">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (module === "members") {
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="table table--editorial table--members"><thead><tr><th>Logo</th><th>Mitglied</th><th>Ansprechperson</th><th>Kontakt</th><th>Art</th><th>Ort</th><th>Visible</th><th>Aktionen</th></tr></thead><tbody>${records.length ? records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table editorial-thumb--table member-logo-thumb--table">${memberLogoThumb(item, memberMediaAssets, section)}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=members&id=${item.id}&section=${section}" title="${escapeHtml(item.name || "-")}">${escapeHtml(shortText(item.name || "-", 60))}</a>${memberProfileMissingCell(item)}</td><td>${escapeHtml(shortText(item.contactName || [item.firstName, item.lastName].filter(Boolean).join(" ") || "-", 70))}</td><td>${memberContactCell(item)}</td><td class="member-type-short" title="${escapeHtml(memberMembershipTypeTitle(item))}">${escapeHtml(memberMembershipTypeLabel(item))}</td><td>${escapeHtml([item.postalCode, item.city].filter(Boolean).join(" ") || "-")}</td><td>${memberVisibleToggleCell(item)}</td><td>${memberActionButtons(item, section)}</td></tr>`).join("") : `<tr><td colspan="8">${emptyText}</td></tr>`}</tbody></table></div></section>`));
  }
  if (["boardMembers", "speakers", "sponsors"].includes(module)) {
    const imageField = module === "sponsors" ? "logoUrl" : "photoUrl";
    const titleField = config[2];
    const subField = config[3];
    const tableClass = module === "sponsors" ? "table table--editorial table--sponsors-hosts" : module === "boardMembers" ? "table table--editorial table--board-members" : "table table--editorial";
    const imageLabel = module === "sponsors" ? "Logo" : "Bild";
    return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, `<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>`)}<section class="panel"><div class="table-wrap"><table class="${tableClass}"><thead><tr><th>${imageLabel}</th><th>${itemLabel}</th><th>Datum / Gueltigkeit</th><th>Beschreibung / Zuordnung</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>${records.length ? records.map((item) => `<tr><td><div class="topic-thumb topic-thumb--table editorial-thumb--table">${editorialThumb(item, { collection: module, section, field: imageField, altField: "altText", mediaAssets: linkedMediaAssets })}</div></td><td><a class="link editorial-title-link" href="#/cms/edit?module=${module}&id=${item.id}&section=${section}" title="${escapeHtml(item[titleField] || "-")}">${escapeHtml(shortText(item[titleField] || "-", 60))}</a></td><td>${escapeHtml(item.publishDate || item.date || "-")}<br><small>${escapeHtml(item.validFrom || "-")} bis ${escapeHtml(item.validTo || "unendlich")}</small></td><td>${escapeHtml(item[subField] || "-")}</td><td>${status(item.status || item.visibility || "active")}</td><td>${cmsListActionButtons(item, section, module, activeStatus, inactiveStatus)}</td></tr>`).join("") : `<tr><td colspan="6">${emptyText}</td></tr>`}</tbody></table></div></section>`));
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
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Status</th><th>Typ</th><th>Empfaenger</th><th>Betreff</th><th>Bezug</th><th>Zeit</th><th>Fehler</th></tr></thead>
          <tbody>${records.length ? records.map((item) => `<tr>
            <td>${status(item.status || "queued")}</td>
            <td>${escapeHtml(item.type || item.template || "-")}</td>
            <td>${escapeHtml(item.to || item.replyTo || "-")}</td>
            <td>${escapeHtml(shortText(item.subject || "-", 70))}</td>
            <td>${escapeHtml(mailReference(item))}</td>
            <td><small>Queue: ${escapeHtml(mailQueueDate(item.queuedAt || item.createdAt))}</small><br><small>Gesendet: ${escapeHtml(mailQueueDate(item.sentAt))}</small><br><small>Fehler: ${escapeHtml(mailQueueDate(item.failedAt))}</small></td>
            <td>${item.error ? `<span class="alert alert--error" style="display:block;margin:0">${escapeHtml(shortText(item.error, 130))}</span>` : "-"}</td>
          </tr>`).join("") : `<tr><td colspan="7">${emptyText}</td></tr>`}</tbody>
        </table></div>
        <p class="muted" style="margin-top:14px">Neue Mitgliedsantraege und Event-Anmeldungen erzeugen automatisch Eintraege in dieser Queue. Der Firebase-Function-Trigger versendet queued Mails per SMTP und schreibt danach den Status.</p>
      </section>`));
  }
  return protect(cmsShell(active, `${cmsTitle("Contentmanagement", title, editable ? `<a href="#/cms/edit?module=${module}&id=new${createParams}" class="button button--primary button--small">${itemLabel} anlegen</a>` : "")}<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>${itemLabel}</th><th>Datum / Gueltigkeit</th><th>Beschreibung / Zuordnung</th><th>Status</th>${editable || manageable ? "<th>Aktionen</th>" : ""}</tr></thead><tbody>${records.length ? records.map((item) => `<tr><td>${escapeHtml(item[config[2]] || "-")}</td><td>${escapeHtml(item.publishDate || item.date || "-")}<br><small>${escapeHtml(item.validFrom || "-")} bis ${escapeHtml(item.validTo || "unendlich")}</small></td><td>${escapeHtml(item[config[3]] || "-")}</td><td>${status(item.status || item.visibility || "active")}</td>${editable || manageable ? `<td>${cmsListActionButtons(item, section, module, activeStatus, inactiveStatus, { editable, manageable })}</td>` : ""}</tr>`).join("") : `<tr><td colspan="${editable || manageable ? 5 : 4}">${emptyText}</td></tr>`}</tbody></table></div></section>`));
}

function topicSpeakerEditor(topic, speaker) {
  return `<div class="form-grid--two"><input type="hidden" name="speakerIds" value="${speaker.id}"><div class="field"><label>Referentname</label><input name="speaker-${speaker.id}-name" value="${escapeHtml(speaker.name || "")}"></div><div class="field"><label>Firma</label><input name="speaker-${speaker.id}-company" value="${escapeHtml(speaker.company || "")}"></div><div class="field"><label>Position</label><input name="speaker-${speaker.id}-position" value="${escapeHtml(speaker.position || "")}"></div><div class="field"><label>Kurzvita</label><textarea name="speaker-${speaker.id}-shortBio">${escapeHtml(speaker.shortBio || "")}</textarea></div></div>`;
}

function topicSpeakerManager(topic, speakers) {
  const assigned = speakers.filter((speaker) => speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id));
  return `<div class="form-grid" style="margin-top:18px"><h2>Referenten</h2><div class="selection-grid">${speakers.length ? speakers.map((speaker) => `<label class="selection-item"><input type="checkbox" name="assignedSpeakerIds" value="${speaker.id}" ${speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id) ? "checked" : ""}><span><strong>${escapeHtml(speaker.name)}</strong><small>${escapeHtml(speaker.company || "")}</small></span></label>`).join("") : `<div class="alert">Noch keine Referenten vorhanden.</div>`}</div>${assigned.length ? assigned.map((speaker) => `<section class="panel"><h3>${escapeHtml(speaker.name || "Referent")}</h3>${topicSpeakerEditor(topic, speaker)}</section>`).join("") : ""}<section class="panel"><h3>Neuen Referenten anlegen</h3><div class="form-grid--two"><div class="field"><label>Referentname</label><input name="newSpeakerName"></div><div class="field"><label>Firma</label><input name="newSpeakerCompany"></div><div class="field"><label>Position</label><input name="newSpeakerPosition"></div><div class="field"><label>Kurzvita</label><textarea name="newSpeakerShortBio"></textarea></div></div></section></div>`;
}

const memberContactFunctions = ["", "Buchhaltung", "Geschaeftsleitung", "Marketing", "Sales / Verkauf", "Redaktion", "Event", "Technik", "Presse", "Sonstiges"];

function memberContactFunctionOptions(value = "") {
  const current = String(value || "");
  const options = memberContactFunctions.includes(current) ? memberContactFunctions : [current, ...memberContactFunctions];
  return options.map((option) => `<option value="${escapeHtml(option)}" ${current === option ? "selected" : ""}>${escapeHtml(option || "Funktion waehlen")}</option>`).join("");
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
    ? item.videoAttachments
    : Array.isArray(item.videos)
      ? item.videos
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
  const url = video.youtubeUrl || (video.youtubeVideoId ? `https://www.youtube.com/watch?v=${video.youtubeVideoId}` : "");
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
      <div class="field"><label>Privacy</label><select name="videoPrivacyStatus${index}">${["unlisted", "private", "public", "unknown"].map((value) => `<option value="${value}" ${String(video.privacyStatus || "unlisted") === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div>
      <div class="field"><label>Status</label><select name="videoStatus${index}">${["ready", "draft", "published", "hidden", "error"].map((value) => `<option value="${value}" ${String(video.status || "ready") === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></div>
      <div class="field field--wide"><label>Beschreibung</label><textarea name="videoDescription${index}">${escapeHtml(video.description || "")}</textarea></div>
    </div>
    <button class="icon-button icon-button--danger" type="button" data-remove-video-attachment title="Video entfernen" aria-label="Video entfernen">${iconImage("trash")}</button>
  </fieldset>`;
}

function videoLibrarySnapshot(video = {}, index = 0) {
  const youtubeVideoId = youtubeVideoIdFromValue(video.youtubeVideoId || video.youtubeUrl || video.url || video.embedUrl || "");
  const youtubeUrl = video.youtubeUrl || video.url || (youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : "");
  const posterImageUrl = video.posterImageUrl || video.thumbnailUrl || video.youtubeThumbnailUrl || (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : "");
  return {
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
    sortOrder: Number(video.sortOrder ?? index + 1)
  };
}

function videoLibraryOptionPayload(video = {}) {
  return escapeHtml(JSON.stringify(videoLibrarySnapshot(video)));
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
    ${item.posterImageUrl ? `<img src="${escapeHtml(item.posterImageUrl)}" alt="${escapeHtml(item.posterImageAlt || item.title || "Video")}">` : `<span class="video-assignment-row__icon">Video</span>`}
    <div><strong>${escapeHtml(item.title || item.youtubeVideoId || "Video")}</strong><small>${escapeHtml(item.youtubeUrl || "")}</small></div>
    <button class="icon-button icon-button--danger" type="button" data-remove-video-attachment title="Video entfernen" aria-label="Video entfernen">${iconImage("trash")}</button>
  </div>`;
}

function articleVideoAttachmentEditor(item = {}, videoLibrary = []) {
  const videos = articleVideoAttachments(item);
  const rows = videos.map((video, index) => articleVideoAssignmentRow(video, index)).join("");
  const returnTo = `#/cms/edit?module=editorialContent&id=${encodeURIComponent(item.id)}&section=${encodeURIComponent(item.section || item.page || "news")}`;
  const newHref = `#/cms/media/videos?mode=new&targetCollection=editorialContent&targetId=${encodeURIComponent(item.id)}&returnTo=${encodeURIComponent(returnTo)}`;
  const options = [`<option value="">Video aus Videothek wählen</option>`, ...videoLibrary.map((video) => {
    const snapshot = videoLibrarySnapshot(video);
    return `<option value="${escapeHtml(snapshot.id)}" data-video-payload="${videoLibraryOptionPayload(video)}">${escapeHtml(snapshot.title || snapshot.youtubeVideoId || snapshot.id)}</option>`;
  })].join("");
  return `<details class="editorial-tool-details" data-editor-tool-panel="videos">
    <summary><span>Medien</span><strong>Video</strong><em>${videos.length ? `${videos.length} zugeordnet` : "optional"}</em></summary>
    <div class="editor-tool-section editor-tool-section--videos" data-video-attachments>
      <div class="video-attachment-list" data-video-attachment-list>${rows || `<p class="muted">Noch kein Video zugeordnet.</p>`}</div>
      <div class="field"><label>Video zuordnen</label><select data-video-library-select>${options}</select></div>
      <div class="tool-button-row">
        <button class="button button--secondary button--small" type="button" data-add-video-from-library>Aus Liste zuordnen</button>
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
    speakers: { title: "Referent", fields: [["name", "Referent Name"], ["company", "Firma"]] },
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
  const fallbackItem = { id, page: query.get("page") || "", section: query.get("section") || "", key: query.get("page") && query.get("section") ? `${query.get("page")}.${query.get("section")}` : "", category: module === "topics" ? "Thema" : "", title: id, status: module === "topics" ? "active" : module === "galleries" ? "published" : "draft", visibility: "public", images: [], createdAt: new Date().toISOString() };
  const item = id === "new"
    ? { ...fallbackItem, id: `${module}-${crypto.randomUUID()}` }
    : module === "members"
      ? await resolveMemberEditorItem(id) || fallbackItem
      : (await getOne(module, id)) || fallbackItem;
  const topicSpeakers = module === "topics" ? await list("speakers") : [];
  const memberMediaAssets = module === "members" ? await list("media_assets").catch(() => []) : [];
  const editMediaAssets = ["editorialContent", "topics", "sponsors"].includes(module) ? await list("media_assets").catch(() => []) : [];
  const audioProviders = ["editorialContent", "topics"].includes(module) ? await getOne("settings", "audioProviders").catch(() => null) : null;
  const videoLibrary = module === "editorialContent" ? await list("media_videos").catch(() => []) : [];
  const memberOptions = module === "users"
    ? (await list("members"))
      .filter((member) => (member.status || "active") === "active")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    : [];
  if (module === "galleries") {
    const [events, media] = await Promise.all([list("events"), list("eventMedia")]);
    const images = Array.isArray(item.images) ? item.images.slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) : [];
    const linkedEventId = item.eventId || item.linkedEventId || "";
    const eventOptions = [`<option value="">Kein Event zugeordnet</option>`, ...events
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .map((event) => `<option value="${escapeHtml(event.id)}" ${linkedEventId === event.id ? "selected" : ""}>${escapeHtml([event.date, event.title].filter(Boolean).join(" · "))}</option>`)].join("");
    const imageKeys = new Set(images.flatMap((image) => [image.id, image.url, image.storagePath].filter(Boolean)));
    const candidateMedia = media
      .filter((entry) => entry.mediaType === "image" && entry.fileUrl)
      .filter((entry) => !imageKeys.has(entry.id) && !imageKeys.has(entry.fileUrl) && !imageKeys.has(entry.storagePath))
      .sort((a, b) => String(b.uploadedAt || b.createdAt || "").localeCompare(String(a.uploadedAt || a.createdAt || "")));
    const uploadCandidates = candidateMedia.length
      ? `<div class="gallery-editor__grid">${candidateMedia.map((medium, index) => `<article class="gallery-editor__item gallery-editor__item--candidate">
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
          <div class="field"><label>Status</label><select name="status"><option value="published" ${item.status === "published" ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div>
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
          <div class="gallery-editor__grid" data-gallery-sortable>${images.length ? images.map((image, index) => `<article class="gallery-editor__item" draggable="true" data-gallery-image-item><button class="gallery-editor__drag" type="button" aria-label="Bild verschieben">?</button><img src="${escapeHtml(image.url)}" alt=""><input type="hidden" name="image-${index}-id" value="${escapeHtml(image.id || "")}"><input type="hidden" name="image-${index}-url" value="${escapeHtml(image.url || "")}"><input type="hidden" name="image-${index}-storagePath" value="${escapeHtml(image.storagePath || "")}"><input type="hidden" name="image-${index}-fileName" value="${escapeHtml(image.fileName || "")}"><div class="field"><label>Bildtitel / Caption</label><input name="image-${index}-caption" value="${escapeHtml(image.caption || image.title || "")}"></div><div class="field"><label>Alt-Text</label><input name="image-${index}-altText" value="${escapeHtml(image.altText || image.fileName || "")}"></div><label class="checkbox-line"><input type="checkbox" name="image-${index}-remove"> Bild aus Galerie entfernen</label></article>`).join("") : `<div class="alert">Noch keine Bilder. Bitte Bilder hochladen und speichern.</div>`}</div>
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
  if (module === "editorialContent" && (["press", "news", "pressRelease"].includes(editorialKind) || isPressEditorialItem(item) || isNewsEditorialItem(item))) {
    const sectionKey = item.page === "news" || item.section === "news" || query.get("page") === "news" || query.get("section") === "news" ? "news" : "press";
    const [allEditorial, events, sponsors, galleries] = await Promise.all([list("editorialContent"), list("events"), list("sponsors"), list("galleries")]);
    const categories = Array.from(new Set(allEditorial
      .filter((entry) => entry.page === sectionKey)
      .map((entry) => entry.category || (sectionKey === "press" ? "Presse" : "News"))
      .filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const categoryValue = item.category || (sectionKey === "press" ? "Presse" : "News");
    const categoryOptions = Array.from(new Set([categoryValue, sectionKey === "press" ? "Rückblicke" : "", ...categories])).filter(Boolean);
    const backPath = sectionKey === "press" ? "editorial/press" : "editorial/news";
    const defaultRetrospectivePrompt = `Erstelle aus der folgenden Pressemitteilung einen redaktionellen Rückblicksbeitrag für PROdigitalTV.

Ziel:
Der Text soll nicht wie eine Pressemitteilung wirken, sondern wie ein nachträglicher redaktioneller Rückblick auf eine bereits stattgefundene Veranstaltung.

chreibe vollständig in der Vergangenheitsform.

Aufgaben:
- Formuliere den Text journalistisch, seriös und flüssig.
- Ordne die Inhalte thematisch neu, nicht zwingend in der Reihenfolge der Pressemitteilung.
- Beginne mit einem starken Einstieg, der Veranstaltung, Anlass und Bedeutung zusammenfasst.
- Beschreibe danach die wichtigsten Themen, Aussagen, Gäste, Diskussionen und Erkenntnisse.
- telle heraus, welchen Mehrwert die Veranstaltung für Mitglieder, Gäste und die Branche hatte.
- Verwende klare Absätze mit Zwischenüberschriften.
- Vermeide werbliche prache.
- Keine reine Aufzählung der Pressemitteilung übernehmen.
- Keine Zukunftsankündigungen so formulieren, als stünden sie noch bevor.
- Falls in der Pressemitteilung Ankündigungen enthalten sind, wandle sie in Rückblicksform um.
- Zitate nur verwenden, wenn sie im Ausgangstext vorhanden sind.
- Keine Fakten erfinden.
- Namen, Orte, Datum, Unternehmen und Veranstaltungsformate korrekt übernehmen.

Gewünschte truktur:
1. Titel
2. Kurzer Teaser mit 2 bis 3 ätzen
3. Redaktioneller Fließtext mit Zwischenüberschriften
4. Optionaler Abschlussabsatz mit Einordnung für PROdigitalTV

Ton:
Professionell, redaktionell, sachlich, hochwertig, verständlich.

Ausgangstext:
{{pressemitteilung}}`;
    const retrospectivePrompt = defaultRetrospectivePrompt;
    const eventOptions = [`<option value="">Kein Event verknuepfen</option>`, ...events
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .map((event) => `<option value="${escapeHtml(event.id)}" ${item.linkedEventId === event.id ? "selected" : ""}>${escapeHtml([event.date, event.title].filter(Boolean).join(" · "))}</option>`)].join("");
    const sponsorOptions = [`<option value="">Kein Sponsorlogo</option>`, ...sponsors
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map((sponsor) => `<option value="${escapeHtml(sponsor.id)}" ${item.sponsorId === sponsor.id ? "selected" : ""}>${escapeHtml([sponsor.name, sponsor.role].filter(Boolean).join(" · "))}</option>`)].join("");
    const galleryOptions = [`<option value="">Keine Galerie</option>`, ...galleries
      .filter((gallery) => gallery.status !== "archived")
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
      .map((gallery) => `<option value="${escapeHtml(gallery.id)}" data-gallery-payload="${galleryPayloadAttribute(gallery)}" ${item.galleryId === gallery.id ? "selected" : ""}>${escapeHtml(gallery.title || gallery.id)} (${(gallery.images || []).length})</option>`)].join("");
    const selectedGallery = item.galleryId ? galleries.find((gallery) => gallery.id === item.galleryId) : null;
    const selectedGalleryPreview = selectedGallery
      ? `<div class="editor-gallery-preview" data-editor-gallery-preview>
          <div>
            <strong>${escapeHtml(selectedGallery.title || "Bildergalerie")}</strong>
            <span>${(selectedGallery.images || []).length} Bilder</span>
          </div>
          ${galleryPlayerButton(selectedGallery, "Galerie abspielen")}
        </div>`
      : `<div class="editor-gallery-preview editor-gallery-preview--empty" data-editor-gallery-preview><p class="muted">Keine Galerie ausgewaehlt. Nach dem Speichern erscheint hier der Playbutton fuer die verknuepfte Galerie.</p></div>`;
    const isRetrospectiveEditor = sectionKey === "press" && (item.isRetrospective || ["Rückblicke", "Rueckblicke"].includes(item.category) || item.linkedEventId);
    const thumbState = `${editorialSummaryThumb(item)}${item.imageUrl ? `<small class="editorial-tool-state editorial-tool-state--ready">Thumb vorhanden</small>` : `<small class="editorial-tool-state">Kein Thumb</small>`}`;
    const audioState = item.audioUrl ? `<small class="editorial-tool-state editorial-tool-state--ready">Audio vorhanden</small>` : `<small class="editorial-tool-state">Kein Audio</small>`;
    const galleryState = selectedGallery ? `<small class="editorial-tool-state editorial-tool-state--ready">${escapeHtml(selectedGallery.title || "Galerie")} · ${(selectedGallery.images || []).length} Bilder</small>` : `<small class="editorial-tool-state">Keine Galerie</small>`;
    const publicArticlePath = isRetrospectiveEditor ? `retrospective/${item.id}` : sectionKey === "news" ? `news/${item.id}` : `retrospective/${item.id}`;
    const publicArticleHref = `/?real=1#/${escapeHtml(publicArticlePath)}`;
    const sourceJsonValue = JSON.stringify(item.source_snapshot_json || item.sources || [], null, 2);
    const tagsValue = Array.isArray(item.tags) ? item.tags.join(", ") : item.tags || "";
    return protect(cmsShell(`cms/${backPath}`, `${cmsTitle("Redaktion", sectionKey === "press" ? "Pressemeldung bearbeiten" : "News bearbeiten", `<a class="button button--secondary button--small" href="#/cms/${backPath}">Zurueck</a>`)}
      <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid">
        <input type="hidden" name="page" value="${escapeHtml(sectionKey)}">
        <input type="hidden" name="section" value="${escapeHtml(sectionKey === "press" ? "pressRelease" : "news")}">
        <input type="hidden" name="key" value="${escapeHtml(item.key || `${sectionKey}.${item.id}`)}">
        <input type="hidden" name="validFrom" value="${escapeHtml(item.validFrom || item.publishDate || "")}">
        <div class="editorial-workspace editorial-workspace--text-editor">
          <div class="editorial-workspace__main">
            <div class="editorial-workflow-actions">
              <button class="button button--secondary button--small" type="button" data-editorial-preview-layer>Vorschau</button>
              <button class="button button--secondary button--small" type="button" data-editor-tool-open="audio">Audio</button>
              <button class="button button--secondary button--small" type="button" data-editor-tool-open="gallery">Galerie</button>
              <button class="button button--secondary button--small" type="button" data-editor-tool-open="videos">Video</button>
            </div>
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Titel / Headline</label>${aiFieldActions([{ action: "improveText", target: "title", label: "Headline erzeugen", entityType: module, entityId: item.id, fieldName: "title" }])}</div><textarea name="title" rows="2" required>${escapeHtml(item.title || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--compact"><div class="editorial-field-head"><label>Subline</label>${aiFieldActions([{ action: "improveText", target: "subtitle", label: "Subline erzeugen", entityType: module, entityId: item.id, fieldName: "subtitle" }])}</div><textarea name="subtitle" rows="2">${escapeHtml(item.subtitle || "")}</textarea></div>
            <div class="field editorial-text-field editorial-text-field--body"><div class="editorial-field-head"><label>Haupttext</label>${aiFieldActions(sectionKey === "press" ? [{ action: "improveText", target: "bodyText", label: "Text bearbeiten", entityType: module, entityId: item.id, fieldName: "bodyText" }, { action: "rewritePressRetrospective", target: "bodyText", label: "Rückblick aus Pressemitteilung", entityType: module, entityId: item.id, fieldName: "bodyText", promptField: "retrospectivePrompt" }] : [{ action: "improveText", target: "bodyText", label: "Text bearbeiten", entityType: module, entityId: item.id, fieldName: "bodyText" }])}</div><textarea name="bodyText" required>${escapeHtml(item.bodyText || "")}</textarea></div>
            <div class="field editorial-text-field"><div class="editorial-field-head"><label>Shorttext / Intro</label>${aiFieldActions([{ action: "shortenText", target: "introText", label: "Kurztext erzeugen", entityType: module, entityId: item.id, fieldName: "introText" }])}</div><textarea name="introText">${escapeHtml(item.introText || "")}</textarea></div>
            <div class="actions editorial-save-inline">
              <button class="button button--primary">Speichern</button>
              ${sectionKey === "news" ? `<button class="button button--secondary" type="button" data-news-publish-now="${escapeHtml(item.id)}">Veroeffentlichen</button>` : ""}
            </div><div id="content-save-result"></div>
          </div>
          <aside class="editorial-tools">
            <section class="editorial-meta-panel">
              <div class="editorial-tools__head"><p class="eyebrow">Meta</p><h3>Veroeffentlichung</h3></div>
              <div class="field"><label>Kategorie</label><select name="category">${categoryOptions.map((category) => `<option value="${escapeHtml(category)}" ${category === categoryValue ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></div>
              ${sectionKey === "news" ? `<div class="field"><label>Tags</label><input name="tags" value="${escapeHtml(tagsValue)}" placeholder="Streaming, KI, Vermarktung"></div>` : ""}
              <div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="published" ${item.status === "published" ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div>
              <div class="meta-date-row"><div class="field"><label>Veroeffentlichungsdatum</label><input type="date" name="publishDate" value="${escapeHtml(item.publishDate || "")}"></div><div class="field"><label>Enddatum</label><input type="date" name="validTo" value="${escapeHtml(item.validTo || "")}"></div></div>
            </section>
            <details class="editorial-tool-details">
              <summary><span>Medien</span><strong>Bild / Thumb</strong>${thumbState}</summary>
              <div class="editor-tool-section editor-tool-section--thumb"><div class="field"><label>Bild / Thumb</label>${imageDropzone({ inputName: "assetFile", removeName: "removeAssetFile", imageUrl: item.imageUrl || "", label: "Bild", defaultize: "1200x675", aiCollage: false })}${linkedMediaActions({ collection: module, id: item.id, field: "imageUrl", altField: "thumbnail_alt", returnTo: `#/cms/edit?module=${module}&id=${item.id}&section=${sectionKey}`, assetId: item.thumbnail_media_asset_id || item.mediaAssetId || recordMediaAsset(item, editMediaAssets, module, "imageUrl")?.id || "" })}</div>${sectionKey === "news" ? `<div class="field"><label>Thumbnail-Prompt</label><textarea name="thumbnail_prompt">${escapeHtml(item.thumbnail_prompt || item.thumbnailPrompt || "")}</textarea></div><div class="field"><label>Thumbnail-Alt-Text</label><input name="thumbnail_alt" value="${escapeHtml(item.thumbnail_alt || item.thumbnailAlt || "")}"></div>` : ""}</div>
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
            ${articleVideoAttachmentEditor(item, videoLibrary)}
            <details class="editorial-tool-details">
              <summary><span>Werkzeuge</span><strong>Rueckblick & Verknuepfungen</strong></summary>
            <section class="retrospective-tool">
              ${sectionKey === "news" ? `<div class="field"><label>Quellen</label><textarea name="source_snapshot_json_text" placeholder='[{ "title": "", "url": "", "source_type": "" }]'>${escapeHtml(sourceJsonValue)}</textarea></div><div class="field"><label>Interne Hinweise</label><textarea name="editorial_note">${escapeHtml(item.editorial_note || item.editorialNote || "")}</textarea></div>` : ""}
              <div class="field"><label>Rückblick-Prompt</label><textarea name="retrospectivePrompt">${escapeHtml(retrospectivePrompt)}</textarea></div>
              <div class="field"><label>Event-Bezug</label><select name="linkedEventId">${eventOptions}</select></div>
              <div class="field"><label>Sponsorlogo</label><select name="sponsorId">${sponsorOptions}</select></div>
              <label class="checkbox-line"><input type="checkbox" name="isRetrospective" ${item.isRetrospective ? "checked" : ""}> Unter Rückblicke / Event-Nachlauf anzeigen</label>
              <label class="checkbox-line"><input type="checkbox" name="showGallery" ${item.showGallery ? "checked" : ""}> Bildergalerie aus Event-Medien anzeigen</label>
              <input type="hidden" name="galleryEventId" value="${escapeHtml(item.galleryEventId || item.linkedEventId || "")}">
              <p class="muted">Im Rückblick-Modus formuliert ChatGPT Headline, Subline und Haupttext als nachträgliche Berichterstattung über das vergangene Event.</p>
              ${aiFieldActions([{ action: "rewritePressRetrospective", target: "bodyText", label: "Rückblick-Fliesstext erzeugen", entityType: module, entityId: item.id, fieldName: "bodyText", promptField: "retrospectivePrompt" }])}
            </section>
            </details>
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
      .map((gallery) => `<option value="${escapeHtml(gallery.id)}" data-gallery-payload="${galleryPayloadAttribute(gallery)}" ${item.galleryId === gallery.id ? "selected" : ""}>${escapeHtml(gallery.title || gallery.id)} (${(gallery.images || []).length})</option>`)].join("");
    const selectedGallery = item.galleryId ? galleries.find((gallery) => gallery.id === item.galleryId) : null;
    const selectedGalleryPreview = selectedGallery
      ? `<div class="editor-gallery-preview" data-editor-gallery-preview>
          <div>
            <strong>${escapeHtml(selectedGallery.title || "Bildergalerie")}</strong>
            <span>${(selectedGallery.images || []).length} Bilder</span>
          </div>
          ${galleryPlayerButton(selectedGallery, "Galerie abspielen")}
        </div>`
      : `<div class="editor-gallery-preview editor-gallery-preview--empty" data-editor-gallery-preview><p class="muted">Keine Galerie verknuepft. Galerie auswaehlen, speichern, danach kann sie hier abgespielt werden.</p></div>`;
    const thumbState = `${editorialSummaryThumb(item)}${item.imageUrl ? `<small class="editorial-tool-state editorial-tool-state--ready">Thumb vorhanden</small>` : `<small class="editorial-tool-state">Kein Thumb</small>`}`;
    const audioState = item.audioUrl ? `<small class="editorial-tool-state editorial-tool-state--ready">Audio vorhanden</small>` : `<small class="editorial-tool-state">Kein Audio</small>`;
    const galleryState = selectedGallery ? `<small class="editorial-tool-state editorial-tool-state--ready">${escapeHtml(selectedGallery.title || "Galerie")} · ${(selectedGallery.images || []).length} Bilder</small>` : `<small class="editorial-tool-state">Keine Galerie</small>`;
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
              <div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="active" ${item.status === "active" ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="inactive" ${item.status === "inactive" ? "selected" : ""}>Inaktiv</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div>
              <div class="meta-date-row"><div class="field"><label>Veroeffentlichungsdatum</label><input type="date" name="publishDate" value="${escapeHtml(item.publishDate || "")}"></div><div class="field"><label>Enddatum</label><input type="date" name="validTo" value="${escapeHtml(item.validTo || "")}"></div></div>
            </section>
            <details class="editorial-tool-details">
              <summary><span>Medien</span><strong>Bild / Thumb</strong>${thumbState}</summary>
              <div class="editor-tool-section editor-tool-section--thumb"><div class="field"><label>Bild / Thumb</label>${imageDropzone({ inputName: "topicImage", removeName: "removeTopicImage", imageUrl: item.imageUrl || "", label: "Themenbild", defaultize: "1200x675", aiCollage: false })}${linkedMediaActions({ collection: "topics", id: item.id, field: "imageUrl", altField: "thumbnail_alt", returnTo: `#/cms/edit?module=topics&id=${item.id}`, assetId: item.thumbnail_media_asset_id || item.mediaAssetId || recordMediaAsset(item, editMediaAssets, "topics", "imageUrl")?.id || "" })}</div></div>
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
    const managed = ["ueber_uns", "mitglied_werden"].includes(item.bereich) || item.editorialManaged;
    if (managed) {
      const statusValue = item.status || "aktiv";
      const visibilityValue = item.sichtbarkeit || item.visibility || "oeffentlich";
      return protect(cmsShell("cms/editorial/interna", `${cmsTitle("Interna", "Textbaustein bearbeiten", `<a class="button button--secondary button--small" href="#/cms/editorial/interna">Zurueck</a>`)}
        <section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="form-grid form-grid--compact">
          <div class="form-grid--two">
            <div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug || item.id || "")}" required><p class="muted">Nach Anlage moeglichst nicht mehr aendern.</p></div>
            <div class="field"><label>Icon</label><input name="icon" value="${escapeHtml(item.icon || "")}" placeholder="network, compass, law ..."></div>
            <div class="field"><label>Bereich</label><select name="bereich"><option value="ueber_uns" ${item.bereich === "ueber_uns" ? "selected" : ""}>Ueber uns</option><option value="mitglied_werden" ${item.bereich === "mitglied_werden" ? "selected" : ""}>Mitglied werden</option></select></div>
            <div class="field"><label>Typ</label><select name="typ">${["hero", "textblock", "vorteil", "eventformat", "kachelgruppe", "cta"].map((type) => `<option value="${type}" ${item.typ === type ? "selected" : ""}>${type}</option>`).join("")}</select></div>
            <div class="field"><label>Sortierung</label><input name="sortierung" type="number" value="${escapeHtml(item.sortierung ?? item.sortOrder ?? 10)}"></div>
            <div class="field"><label>Status</label><select name="status"><option value="aktiv" ${statusValue === "aktiv" ? "selected" : ""}>Aktiv</option><option value="inaktiv" ${statusValue === "inaktiv" ? "selected" : ""}>Inaktiv</option></select></div>
            <div class="field"><label>Sichtbarkeit</label><select name="sichtbarkeit"><option value="oeffentlich" ${visibilityValue === "oeffentlich" || visibilityValue === "public" ? "selected" : ""}>Oeffentlich</option><option value="intern" ${visibilityValue === "intern" || visibilityValue === "internal" ? "selected" : ""}>Intern</option><option value="mitglieder" ${visibilityValue === "mitglieder" || visibilityValue === "members" ? "selected" : ""}>Mitglieder</option></select></div>
          </div>
          <div class="field"><label>Titel</label><input name="titel" value="${escapeHtml(item.titel || item.title || "")}" required>${aiFieldActions([{ action: "improveText", target: "titel", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "titel" }])}</div>
          <div class="field"><label>Kurztext</label><textarea name="kurztext">${escapeHtml(item.kurztext || item.introText || "")}</textarea>${aiFieldActions([{ action: "shortenText", target: "kurztext", label: "Kurztext erzeugen", entityType: module, entityId: item.id, fieldName: "kurztext" }])}</div>
          <div class="field"><label>Langtext</label><textarea name="langtext">${escapeHtml(item.langtext || item.bodyText || "")}</textarea>${aiFieldActions([{ action: "improveText", target: "langtext", label: "Mit ChatGPT bearbeiten", entityType: module, entityId: item.id, fieldName: "langtext" }])}</div>
          <details class="editorial-tool-details" open>
            <summary><span>Audio</span><strong>Audio & Barrierefreiheit</strong>${audioStatusBadge(audioVariantState("editorialContent", item, "accessible"))}</summary>
            <div class="editor-tool-section editor-tool-section--audio">${audioGenerationPanel("editorialContent", item, { providerConfig: audioProviders })}</div>
          </details>
          <div class="form-grid--two"><div class="field"><label>Button-Text optional</label><input name="button_text" value="${escapeHtml(item.button_text || item.buttonText || "")}"></div><div class="field"><label>Button-Ziel optional</label><input name="button_ziel" value="${escapeHtml(item.button_ziel || item.buttonUrl || "")}"></div></div>
          <button class="button button--primary">Speichern</button><div id="content-save-result"></div>
        </form></section>`));
    }
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
    if (module === "users" && field === "memberId") {
      const currentMemberId = item?.memberId || "";
      const options = [
        `<option value="" ${currentMemberId ? "" : "selected"}>Keine Verknuepfung</option>`,
        ...memberOptions.map((member) => `<option value="${escapeHtml(member.id)}" ${currentMemberId === member.id ? "selected" : ""}>${escapeHtml([member.name || member.id, member.city].filter(Boolean).join(" / "))}</option>`)
      ].join("");
      return `<div class="field"><label>${label}</label><select name="memberId">${options}</select><p class="muted">Verknuepft diesen User mit dem Mitgliedsprofil, das er im Mitgliederbereich bearbeiten darf.</p></div>`;
    }
    if (module === "members" && field === "membershipType") {
      const currentType = item?.membershipType || "";
      return `<div class="field"><label>${label}</label><select name="membershipType"><option value="" ${currentType ? "" : "selected"}>Nicht festgelegt</option><option value="company" ${currentType === "company" ? "selected" : ""}>Firmenmitglied</option><option value="individual" ${currentType === "individual" ? "selected" : ""}>Einzelmitglied</option></select></div>`;
    }
    return `<div class="field"><label>${label}</label>${long ? `<textarea name="${field}">${escapeHtml(item?.[field] || "")}</textarea>` : `<input name="${field}" value="${escapeHtml(item?.[field] || "")}">`}${ai}</div>`;
  }).join("");
  const memberField = (field, label) => {
    const long = field === "description" || field === "shortDescription";
    const value = field === "contactName"
      ? item?.contactName || item?.profileContactName || ""
      : field === "contactEmail"
        ? item?.contactEmail || item?.email || ""
        : field === "contactPhone"
          ? item?.contactPhone || item?.phone || ""
          : field === "contactMobile"
            ? item?.contactMobile || item?.mobile || ""
            : field === "description"
              ? memberDescriptionValue(item)
              : item?.[field] || "";
    if (field === "membershipType") {
      const currentType = item?.membershipType || "";
      return `<div class="field"><label>${label}</label><select name="membershipType"><option value="" ${currentType ? "" : "selected"}>Nicht festgelegt</option><option value="company" ${currentType === "company" ? "selected" : ""}>Firmenmitglied</option><option value="individual" ${currentType === "individual" ? "selected" : ""}>Einzelmitglied</option></select></div>`;
    }
    return `<div class="field"><label>${label}</label>${long ? `<textarea name="${field}">${escapeHtml(value)}</textarea>` : `<input name="${field}" value="${escapeHtml(value)}">`}</div>`;
  };
  const memberEventContactLimit = item?.membershipType === "company" ? 5 : 1;
  const normalizeMemberEventContact = (contact = {}) => {
    const fullName = String(contact.name || "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    return {
      firstName: contact.firstName || contact.vorname || (parts.length > 1 ? parts.slice(0, -1).join(" ") : fullName),
      lastName: contact.lastName || contact.nachname || (parts.length > 1 ? parts.slice(-1).join(" ") : ""),
      name: fullName,
      role: contact.role || contact.function || contact.department || "",
      email: contact.email || "",
      phone: contact.phone || ""
    };
  };
  const memberEventContacts = Array.isArray(item?.eventContacts) && item.eventContacts.length
    ? item.eventContacts.map(normalizeMemberEventContact)
    : ([{
        firstName: item?.firstName || "",
        lastName: item?.lastName || "",
        name: item?.profileContactName || item?.contactName || [item?.firstName, item?.lastName].filter(Boolean).join(" "),
        role: item?.contactRole || item?.department || "",
        email: item?.contactEmail || item?.email || "",
        phone: item?.phone || item?.contactPhone || item?.mobile || item?.contactMobile || ""
      }].map(normalizeMemberEventContact).filter((contact) => contact.firstName || contact.lastName || contact.name || contact.email || contact.phone));
  const memberEventContactsHtml = module === "members"
    ? `<div class="member-edit-form__event-contacts">
        <p class="eyebrow">Kontaktdaten</p>
        <p class="muted">${memberEventContactLimit === 1 ? "Einzelmitglieder: 1 Kontakt." : "Firmenmitglieder: bis zu 5 Kontakte."}</p>
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
    ? `<div class="member-edit-form__access">
        <p class="eyebrow">Zugang steuern</p>
        <p class="muted">Ab diesem Datum hat das Mitglied keinen Portalzugang mehr und erscheint nicht mehr im Mitgliederverzeichnis.</p>
        <div class="form-grid form-grid--two">
          <div class="field"><label>Mitgliedschaftsstatus</label><select name="membershipAccessStatus">
            <option value="active" ${memberAccessStatus === "active" ? "selected" : ""}>Aktiv</option>
            <option value="inactive" ${memberAccessStatus === "inactive" ? "selected" : ""}>Inaktiv</option>
            <option value="cancelled" ${memberAccessStatus === "cancelled" ? "selected" : ""}>Gekündigt</option>
          </select></div>
          <div class="field"><label>Gekündigt / inaktiv ab</label><input name="membershipAccessEffectiveAt" type="date" value="${escapeHtml(timestampInputDate(item?.membershipAccessEffectiveAt))}"><p class="muted">Leer = sofort.</p></div>
        </div>
      </div>`
    : "";
  const imageUpload = module === "topics"
    ? `<div class="field"><label>Themenbild hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das neue Bild ersetzt beim Speichern das zugeordnete Bild.</p></div>`
    : module === "members"
      ? `<div class="field field--member-logo"><label>Logo</label>${memberLogoEditor(item, memberMediaAssets, `#/cms/edit?module=members&id=${item.id}&section=${query.get("section") || "all"}`)}</div>`
      : module === "boardMembers"
      ? `<div class="field"><label>Vorstandsfoto hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das Foto wird beim Speichern dem Vorstandsprofil zugeordnet.</p></div>`
      : module === "speakers"
        ? `<div class="field"><label>Referentenfoto hochladen</label><input type="file" name="assetFile" accept="image/*"><p class="muted">Das Foto wird beim Speichern dem Referentenprofil zugeordnet und im Eventkontext angezeigt.</p></div>`
      : module === "sponsors"
        ? (() => { const asset = recordMediaAsset(item, editMediaAssets, "sponsors", "logoUrl"); const logoUrl = mediaAssetUrl(asset || {}) || item.logoUrl || ""; return `<div class="field"><label>Logo</label><div class="member-logo-editor"><div class="member-logo-editor__preview">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(item.name || "")}">` : `<span>Noch kein Logo</span>`}</div><div class="member-logo-editor__actions">${linkedMediaActions({ collection: "sponsors", id: item.id, field: "logoUrl", altField: "altText", returnTo: `#/cms/edit?module=sponsors&id=${item.id}`, label: "Logo", assetId: asset?.id || "" })}<input type="file" name="assetFile" accept="image/*"><p class="muted">Logo aus der Mediathek waehlen oder direkt eine neue Datei hochladen.</p></div></div></div>`; })()
      : module === "memberDocuments"
        ? `<div class="field"><label>Dokument hochladen</label><input type="file" name="assetFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*,application/pdf"><p class="muted">PDF oder Datei fuer den Mitgliederbereich.</p></div>`
      : module === "memberDirectories"
        ? `<div class="field"><label>Verzeichnis-Datei hochladen</label><input type="file" name="assetFile" accept=".pdf,.csv,.xlsx,.xls,application/pdf"><p class="muted">Optionales Mitgliederverzeichnis als Datei.</p></div>`
      : "";
  const speakerManager = module === "topics" ? topicSpeakerManager(item, topicSpeakers) : "";
  const memberLiveControl = module === "members"
    ? `<label class="checkbox-line"><input type="checkbox" name="isLive" ${item.isLive !== false ? "checked" : ""}> Live auf Website anzeigen</label><p class="muted">Nur aktive, oeffentliche und live freigegebene Mitglieder erscheinen auf der Website.</p>`
    : "";
  const activeStatus = ["topics", "members", "boardMembers", "memberDirectories", "users"].includes(module) ? "active" : "published";
  const editorialBack = query.get("section") && editorialSections[query.get("section")] ? `editorial/${query.get("section")}` : item.page === "press" ? "editorial/press" : item.page === "news" ? "editorial/news" : module === "editorialContent" ? "editorial/interna" : "editorial";
  const backSection = { boardMembers: "board", editorialContent: editorialBack, speakers: "speakers", sponsors: "sponsors", memberDocuments: "member-documents", memberDirectories: "member-directories" }[module] || module;
  const activeSection = { topics: "cms/topics", speakers: "cms/speakers", sponsors: "cms/sponsors", members: "cms/members", memberDocuments: "cms/member-documents", memberDirectories: "cms/member-directories", users: "cms/users", boardMembers: "cms/board", editorialContent: `cms/${editorialBack}` }[module] || "cms/editorial";
  const statusVisibilityControls = module === "members"
    ? ""
    : `<div class="form-grid--two"><div class="field"><label>Status</label><select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Entwurf</option><option value="${activeStatus}" ${item.status === activeStatus ? "selected" : ""}>Veroeffentlicht / Aktiv</option><option value="archived" ${item.status === "archived" ? "selected" : ""}>Archiviert</option></select></div><div class="field"><label>Sichtbarkeit</label><select name="visibility"><option value="public" ${item.visibility === "public" ? "selected" : ""}>Oeffentlich</option><option value="members" ${item.visibility === "members" ? "selected" : ""}>Mitglieder</option><option value="internal" ${item.visibility === "internal" ? "selected" : ""}>Intern</option></select></div></div>`;
  const formClass = module === "members" ? "form-grid form-grid--two member-edit-form" : "form-grid";
  const editorialVideoHtml = module === "editorialContent" ? articleVideoAttachmentEditor(item, videoLibrary) : "";
  const memberWebsiteValue = String(item?.website || item?.url || "").trim();
  const memberWebsiteHref = memberWebsiteValue && /^https?:\/\//i.test(memberWebsiteValue) ? memberWebsiteValue : memberWebsiteValue ? `https://${memberWebsiteValue}` : "";
  const memberWebsiteLink = memberWebsiteHref ? `<p class="muted"><a class="link" href="${escapeHtml(memberWebsiteHref)}" target="_blank" rel="noopener">Website oeffnen</a></p>` : "";
  const memberEditHtml = module === "members"
    ? `<div class="member-edit-form__column member-edit-form__column--identity">
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
    ? `<div class="member-edit-savebar"><button class="button button--primary">Speichern</button><div id="content-save-result"></div></div>`
    : `<button class="button button--primary">Speichern</button><div id="content-save-result"></div>`;
  return protect(cmsShell(activeSection, `${cmsTitle("Bearbeiten", `${definition.title} pflegen`, `<a class="button button--secondary button--small" href="#/cms/${backSection}">Zurueck</a>`)}<section class="panel"><form id="content-edit-form" data-module="${module}" data-id="${item.id}" class="${formClass}">${memberEditHtml}${statusVisibilityControls}${module === "members" ? "" : memberLiveControl}${saveControls}</form></section>${speakerManager}`));
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
      editHref: `#/cms/edit?module=editorialContent&id=${item.id}${item.section ? `&section=${item.section}` : ""}`
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
  const defaultProviderLabel = elevenlabs.enabled ? "ElevenLabs" : "Gemini";
  const defaultModelLabel = elevenlabs.enabled
    ? (elevenlabs.modelId || "eleven_multilingual_v2")
    : "gemini-2.5-flash-preview-tts";
  const defaultVoiceLabel = elevenlabs.enabled
    ? (elevenlabs.voiceName || elevenlabs.voiceId || "Standardstimme")
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
    const actionLabel = `${info.activeUrl ? "Neu erzeugen" : "Erzeugen"} mit ${defaultProviderLabel}`;
    return `<tr data-audio-area="${escapeHtml(item.audioArea)}" data-audio-subarea="${escapeHtml(item.audioSubarea || "")}">
      <td><a class="link editorial-title-link" href="${escapeHtml(item.editHref)}">${escapeHtml(title)}</a><br><small>${escapeHtml(`${collection}/${item.id}`)}</small></td>
      <td>${escapeHtml(item.audioArea)}</td>
      <td>${audioListCell(collection, item, { meta: "state" })}</td>
      <td>${escapeHtml(info.provider || defaultProviderLabel)}<br><small>${escapeHtml(info.modelId || defaultModelLabel)}</small></td>
      <td>${escapeHtml(info.voiceName || defaultVoiceLabel)}${generatedAt ? `<br><small>${escapeHtml(generatedAt)}</small>` : ""}${info.karaokeEnabled ? "<br><small>Karaoke bereit</small>" : ""}</td>
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
        <div class="setup-step"><span>ElevenLabs</span><strong>${elevenlabs.enabled ? "Aktiv" : "Inaktiv"}</strong><small>${escapeHtml(elevenlabs.voiceName || "Keine Standardstimme gespeichert")}</small></div>
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
