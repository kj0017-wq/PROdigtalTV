import { agendaMarkup } from "../utils/eventArea.js?v=8";
import { eventAgendaItems } from "../utils/eventAgenda.js?v=2";
import { list, listPublicEvents, listPublicContent, listMemberContent, listPublicEventMediaAssets, listPublicMediaAssets, getOne } from "../firebase/dataService.js?v=535";
import { currentUser, canUseCms, isAdmin, isMember } from "../firebase/authService.js?v=477";
import { publicShell, logo } from "../components/layout.js?v=17";
import { eventCard, topicCard, topicImageTransformStyle } from "../components/cards.js?v=25";
import { pushControls } from "../components/pushControls.js?v=3";
import { accessLabels, lifecycleLabels, normalizeLifecyclePhase } from "../data/platformConstants.js?v=1";
import { escapeHtml, formatDate, initials, linkedText, richTextHtml, richTextPlainText } from "../utils/format.js?v=3";
import { calendarFileName, generateGoogleCalendarUrl, generateGoogleDecisionReminderUrl, generateICS, generateICSDataUrl, generateOutlookCalendarUrl, generateOutlookDecisionReminderUrl } from "../utils/calendar.js?v=1";
import { liveImageAttrs, stableImageUrl } from "../utils/imageUrls.js?v=2";
import { checkInWithStoredTicket, confirmRegistration, getEventCheckinAccess, getPublicEventCheckinQr, getEventRegistrationPrefill, linkTicketDevice, listMyEventRegistrations, listStoredTickets, readStoredTicket, validateStoredTicket } from "../firebase/registrationService.js?v=29";
import { getFirebaseServices } from "../firebase/firebaseClient.js?v=1";
import { hiddenTalkTitles, isVisibleEventTalk, removeHiddenTalkMentions } from "../utils/eventTalkVisibility.js";
import { eventRegistrationCtaState } from "../utils/eventRegistrationDisplay.js?v=1";

async function callSpeakerApprovalFunction(name, data = {}) {
  const firebase = await getFirebaseServices();
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, name, { timeout: 30000 });
  return (await callable(data)).data;
}
async function callEventFeedbackFunction(name, data = {}) {
  const firebase = await getFirebaseServices();
  const callable = firebase.functionsLib.httpsCallable(firebase.functions, name, { timeout: 30000 });
  return (await callable(data)).data;
}
function subhero(eyebrow, title, text) {
  const cleanEyebrow = String(eyebrow || "").trim();
  const cleanTitle = String(title || "").trim();
  const cleanText = String(text || "").trim();
  return `<section class="subhero"><div class="container">${cleanEyebrow ? `<p class="eyebrow">${escapeHtml(cleanEyebrow)}</p>` : ""}<h1>${escapeHtml(cleanTitle)}</h1>${cleanText ? `<p>${escapeHtml(cleanText)}</p>` : ""}</div></section>`;
}

function articleHeader({ eyebrow = "", title = "", intro = "", logoUrl = "", logoAlt = "" } = {}) {
  return `<header class="article-header">
    <div class="article-header__copy">
      ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
      <h1>${escapeHtml(title)}</h1>
      ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
    </div>
    ${logoUrl ? `<figure class="article-header__logo"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(logoAlt || title)}" ${liveImageAttrs("topic")}></figure>` : ""}
  </header>`;
}

function aiDisclosureNote(item = {}) {
  const explicitValue = item.aiDisclosure ?? item.ai_disclosure ?? item.aiUsage ?? item.ai_usage;
  const inferredValue = [
    item.generation_origin,
    item.generationOrigin,
    item.ai_log_json,
    item.aiLogJson,
    item.source_snapshot_json,
    item.sources,
    item.sourceType,
    item.category
  ].some((value) => /ai|ki|news-import|morning|briefing|import/i.test(String(Array.isArray(value) ? value.join(" ") : value || "")))
    ? "partial_ai"
    : "";
  const value = String(explicitValue ?? inferredValue).trim();
  if (!value || value === "none") return "";
  const labels = {
    text_edit: "Dieser Inhalt wurde mit KI-Unterstuetzung sprachlich bearbeitet und redaktionell geprueft.",
    partial_ai: "Dieser Inhalt wurde mit KI-Unterstuetzung vorbereitet und redaktionell verantwortet.",
    image_ai: "Das Bild zu diesem Inhalt wurde mithilfe von KI erstellt oder bearbeitet.",
    audio_ai: "Die Vorlesefunktion wurde mit synthetischer Stimme erzeugt.",
    media_ai: "Mediale Bestandteile dieses Inhalts wurden mithilfe von KI erstellt oder bearbeitet."
  };
  const text = labels[value] || value;
  return `<details class="ai-disclosure-note"><summary><span>KI</span></summary><p>${escapeHtml(text)}</p></details>`;
}

function imageRightsNotice(item = {}, asset = null) {
  const source = asset || {};
  const value = source.rights_notice
    || source.rightsNotice
    || source.copyright_notice
    || source.copyrightNotice
    || source.credit
    || item.image_rights_notice
    || item.imageRightsNotice
    || item.rights_notice
    || item.rightsNotice
    || item.copyright_notice
    || item.copyrightNotice
    || item.credit
    || "";
  return String(value || "").trim();
}

function imageRightsDisclosure(item = {}, asset = null) {
  const text = imageRightsNotice(item, asset);
  if (!text) return "";
  return `<details class="image-rights-note"><summary>Bildrechte</summary><p>${escapeHtml(text)}</p></details>`;
}

function topicVisualHeader({ topic = {}, speakers = [], title = "", intro = "", mediaAssets = [] } = {}) {
  const imageAsset = publicTopicMediaAsset(topic, mediaAssets, "article");
  const imageUrl = stableImageUrl(mediaAssetUrl(imageAsset || {}) || topicDirectImageUrl(topic), "topic");
  const rightsNote = imageRightsDisclosure(topic, imageAsset);
  const logoSpeaker = speakers.find((speaker) => speaker.companyLogoUrl || speaker.logoUrl || speaker.company_logo_url) || {};
  const logoUrl = topic.companyLogoUrl || topic.logoUrl || topic.company_logo_url || logoSpeaker.companyLogoUrl || logoSpeaker.logoUrl || logoSpeaker.company_logo_url || "";
  const visibleSpeakers = speakers.filter(publicSpeakerIsVisible).slice(0, 3);
  const visual = imageUrl
    ? `<figure class="topic-detail-hero__image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(topic.thumbnail_alt || `Themenmotiv ${title}`)}" loading="eager" decoding="async"${topicImageTransformStyle(topic)} ${liveImageAttrs("topic")}>${rightsNote}</figure>`
    : `<div class="topic-detail-hero__speaker-wall">${visibleSpeakers.length ? visibleSpeakers.map((speaker) => `<a class="topic-detail-hero__speaker" href="${speakerProfileHref(speaker)}">${speakerPortrait(speaker)}<span>${escapeHtml(speakerName(speaker))}</span></a>`).join("") : `<span class="topic-detail-hero__placeholder">${escapeHtml(initials(title || "Thema"))}</span>`}</div>`;
  const mobileSpeakerStrip = visibleSpeakers.length
    ? `<div class="topic-detail-hero__mobile-speakers">${visibleSpeakers.map((speaker) => `<a href="${speakerProfileHref(speaker)}" title="${escapeHtml(speakerName(speaker))}">${speakerPortrait(speaker)}<span>${escapeHtml(speakerName(speaker))}</span></a>`).join("")}</div>`
    : "";
  const mobileMedia = imageUrl
    ? `<div class="topic-detail-hero__mobile-media"><figure><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(topic.thumbnail_alt || `Themenmotiv ${title}`)}" loading="eager" decoding="async"${topicImageTransformStyle(topic)} ${liveImageAttrs("topic")}>${rightsNote}</figure>${mobileSpeakerStrip}</div>`
    : (logoUrl || mobileSpeakerStrip)
      ? `<div class="topic-detail-hero__mobile-media topic-detail-hero__mobile-media--identity">${logoUrl ? `<figure class="topic-detail-hero__mobile-logo"><img src="${escapeHtml(logoUrl)}" alt="Logo" loading="eager" decoding="async" ${liveImageAttrs("sponsor")}></figure>` : ""}${mobileSpeakerStrip}</div>`
      : "";
  return `<header class="topic-detail-hero ${imageUrl ? "topic-detail-hero--with-image" : "topic-detail-hero--no-image"}">
    <div class="topic-detail-hero__visual">
      ${visual}
      ${(logoUrl || visibleSpeakers.length) ? `<div class="topic-detail-hero__people">
        ${logoUrl ? `<div class="topic-detail-hero__logo"><img src="${escapeHtml(logoUrl)}" alt="Logo" loading="eager" decoding="async" ${liveImageAttrs("sponsor")}></div>` : ""}
        ${visibleSpeakers.length ? `<div class="topic-detail-hero__avatars">${visibleSpeakers.map((speaker) => `<a href="${speakerProfileHref(speaker)}" title="${escapeHtml(speakerName(speaker))}">${speakerPortrait(speaker)}</a>`).join("")}</div>` : ""}
      </div>` : ""}
    </div>
    <div class="topic-detail-hero__copy">
      ${mobileMedia}
      <p class="eyebrow">Unsere Themen</p>
      <h1>${escapeHtml(title)}</h1>
      ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
    </div>
  </header>`;
}

function memberLogo(member, options = {}) {
  const logoClass = `member-logo member-logo--${String(member.id || "").replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;
  const logoUrl = safeMemberLogoUrl(member, member.logoDisplayUrl || member.logoUrl || "");
  const logoScale = Math.min(180, Math.max(50, Number(member.logoScale) || 100)) / 100;
  const logoOffsetX = Math.min(50, Math.max(-50, Number(member.logoOffsetX) || 0));
  const logoOffsetY = Math.min(50, Math.max(-50, Number(member.logoOffsetY) || 0));
  return logoUrl
    ? `<img class="${logoClass}" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(member.name)}" style="position:relative;left:${logoOffsetX}%;top:${logoOffsetY}%;transform:scale(${logoScale}) !important" ${liveImageAttrs("member")}>`
    : options.initialFallback
      ? `<span class="member-logo-initials" aria-hidden="true">${escapeHtml(initials(member.name || "Mitglied"))}</span>`
      : escapeHtml(member.name);
}

function blockedMemberLogoUrl(member = {}, url = "") {
  const value = String(url || "");
  const isGoldvisite = member.id === "goldvisite-media" || /goldvisite/i.test(String(member.name || ""));
  if (isGoldvisite && /goldbach/i.test(value)) return true;
  return false;
}

function safeMemberLogoUrl(member = {}, url = "") {
  return blockedMemberLogoUrl(member, url) ? "" : url;
}

function cacheVersionFrom(record = {}) {
  return record.updatedAt || record.updated_at || record.createdAt || record.created_at || record.version || "";
}

function versionedAssetUrl(url = "", record = {}) {
  const value = String(url || "");
  const version = cacheVersionFrom(record);
  if (!value || !version || value.startsWith("data:") || value.includes("pdtv_v=")) return value;
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}pdtv_v=${encodeURIComponent(version)}`;
}

function mediaAssetUrl(asset = {}) {
  const url = asset.file_path_web_url || asset.filePathWebUrl || asset.webUrl
    || asset.file_path_original_url || asset.filePathOriginalUrl || asset.originalUrl
    || asset.file_path_thumb_url || asset.filePathThumbUrl || asset.thumbUrl || asset.thumb_url
    || asset.downloadUrl || asset.downloadURL || asset.url
    || asset.thumbnail_url || asset.thumbnailUrl
    || asset.imageUrl || asset.assetUrl || "";
  return versionedAssetUrl(url, asset);
}
function mediaAssetPreferredImageUrl(asset = {}) {
  const url = asset.file_path_original_url || asset.filePathOriginalUrl || asset.originalUrl
    || asset.file_path_web_url || asset.filePathWebUrl || asset.webUrl
    || asset.downloadUrl || asset.downloadURL || asset.url
    || asset.imageUrl || asset.assetUrl
    || asset.file_path_thumb_url || asset.filePathThumbUrl || asset.thumbUrl || asset.thumb_url
    || asset.thumbnail_url || asset.thumbnailUrl || "";
  return versionedAssetUrl(url, asset);
}

function imageWidthFromVariantUrl(url = "") {
  let path = String(url || "").split("?")[0];
  try { path = decodeURIComponent(path); } catch {}
  const dimensions = [...path.matchAll(/(?:^|[_-])(\d{3,4})x\d{3,4}(?=[_.-]|$)/gi)];
  return Number(dimensions.at(-1)?.[1] || 0);
}

function mediaAssetImageSrcset(asset = {}, minWidth = 780) {
  const thumb = asset.file_path_thumb_url || asset.filePathThumbUrl || asset.thumbUrl || asset.thumb_url || "";
  const web = asset.file_path_web_url || asset.filePathWebUrl || asset.webUrl || "";
  const original = asset.file_path_original_url || asset.filePathOriginalUrl || asset.originalUrl || asset.downloadUrl || asset.downloadURL || asset.url || "";
  const originalWidth = Number(asset.file_path_original_width || asset.original_width || asset.originalWidth || asset.image_width || asset.imageWidth || imageWidthFromVariantUrl(original));
  const candidates = [
    [thumb, Number(asset.thumb_image_width || asset.file_path_thumb_width || asset.thumb_width || asset.thumbWidth || imageWidthFromVariantUrl(thumb) || (thumb === original ? originalWidth : 0))],
    [web, Number(asset.web_image_width || asset.file_path_web_width || asset.web_width || asset.webWidth || imageWidthFromVariantUrl(web) || (web === original ? originalWidth : 0))],
    [original, originalWidth]
  ];
  const widths = new Map();
  candidates.forEach(([url, width]) => {
    if (!url || !Number.isFinite(width) || width <= 0) return;
    const versioned = versionedAssetUrl(url, asset);
    widths.set(versioned, Math.max(widths.get(versioned) || 0, width));
  });
  const preferred = mediaAssetPreferredImageUrl(asset);
  if (!widths.has(preferred)) return "";
  const seenWidths = new Set();
  const sorted = [...widths].sort((a, b) => a[1] - b[1]).filter(([, width]) => {
    if (seenWidths.has(width)) return false;
    seenWidths.add(width);
    return true;
  });
  const suitable = sorted.filter(([, width]) => width >= minWidth);
  return (suitable.length ? suitable : sorted.slice(-1))
    .map(([url, width]) => `${escapeHtml(url)} ${Math.round(width)}w`)
    .join(", ");
}
function mediaAssetUrls(asset = {}) {
  return [
    asset.file_path_web_url, asset.filePathWebUrl, asset.webUrl,
    asset.file_path_thumb_url, asset.filePathThumbUrl, asset.thumbUrl, asset.thumb_url,
    asset.file_path_original_url, asset.filePathOriginalUrl, asset.originalUrl,
    asset.downloadUrl, asset.downloadURL, asset.url,
    asset.thumbnail_url, asset.thumbnailUrl,
    asset.imageUrl, asset.assetUrl
  ].filter(Boolean);
}

function topicDirectImageUrl(topic = {}) {
  return topic.imageUrl
    || topic.assetUrl
    || topic.file_path_web_url
    || topic.filePathWebUrl
    || topic.webUrl
    || topic.web_url
    || topic.file_path_original_url
    || topic.filePathOriginalUrl
    || topic.originalUrl
    || topic.original_url
    || topic.file_path_thumb_url
    || topic.filePathThumbUrl
    || topic.thumbUrl
    || topic.thumb_url
    || "";
}

function topicDirectThumbnailUrl(topic = {}) {
  return topic.thumbnail_url
    || topic.thumbnailUrl
    || topic.cardImageUrl
    || topic.imageUrl
    || topic.assetUrl
    || topic.file_path_thumb_url
    || topic.filePathThumbUrl
    || topic.thumbUrl
    || topic.thumb_url
    || "";
}

function mediaAssetResolutionScore(asset = {}) {
  const pairs = [
    [asset.file_path_web_width || asset.web_width || asset.webWidth || asset.width, asset.file_path_web_height || asset.web_height || asset.webHeight || asset.height],
    [asset.file_path_original_width || asset.original_width || asset.originalWidth || asset.image_width || asset.imageWidth, asset.file_path_original_height || asset.original_height || asset.originalHeight || asset.image_height || asset.imageHeight],
    [asset.file_path_thumb_width || asset.thumb_width || asset.thumbWidth, asset.file_path_thumb_height || asset.thumb_height || asset.thumbHeight]
  ];
  return pairs.reduce((best, [width, height]) => Math.max(best, Number(width || 0) * Number(height || 0)), 0);
}

function publicTopicMediaAsset(topic = {}, mediaAssets = [], purpose = "article") {
  const wantsThumb = purpose === "thumb";
  const wantsCard = purpose === "card";
  const recordUrl = wantsThumb
    ? topicDirectThumbnailUrl(topic)
    : wantsCard
      ? topicDirectImageUrl(topic) || topicDirectThumbnailUrl(topic)
      : topicDirectImageUrl(topic);
  const directIds = wantsThumb
    ? [topic.thumbnail_media_asset_id, topic.thumbnailMediaAssetId].filter(Boolean)
    : wantsCard
      ? [
        topic.article_media_asset_id,
        topic.articleMediaAssetId,
        topic.mediaAssetId,
        topic.media_asset_id,
        topic.assetId,
        topic.thumbnail_media_asset_id,
        topic.thumbnailMediaAssetId
      ].filter(Boolean)
      : [topic.article_media_asset_id, topic.articleMediaAssetId, topic.mediaAssetId, topic.media_asset_id, topic.assetId].filter(Boolean);
  const fieldMatches = (value = "") => {
    const normalized = String(value || "imageUrl").toLowerCase().replace(/[_-]/g, "");
    if (wantsCard) {
      return ["imageurl", "image", "asseturl", "articleimageurl", "article", "thumbnailurl", "thumbnail", "thumb"].includes(normalized);
    }
    return wantsThumb
      ? ["thumbnailurl", "thumbnail", "thumb"].includes(normalized)
      : ["imageurl", "image", "asseturl", "articleimageurl", "article"].includes(normalized);
  };
  const variantScore = (asset = {}) => {
    const key = String(asset.variant_key || asset.variantKey || asset.usage_preset || "").toLowerCase();
    if (wantsCard) {
      if (key === "article_xl") return "9";
      if (key === "news_desktop") return "8";
      if (key === "social_share") return "7";
      if (key === "web" || key === "image") return "6";
      if (key === "thumbnail") return "3";
      if (key === "square") return "2";
      if (/thumb/.test(key)) return "1";
      return "5";
    }
    if (wantsThumb) {
      if (key === "thumbnail") return "9";
      if (key === "square") return "7";
      if (/thumb/.test(key)) return "6";
      return "0";
    }
    if (key === "article_xl") return "9";
    if (key === "news_desktop") return "8";
    if (key === "social_share") return "6";
    if (key === "thumbnail" || key === "square") return "0";
    return "4";
  };
  return mediaAssets
    .filter((asset) => {
      const urls = mediaAssetUrls(asset);
      const targetCollection = asset.target_collection || asset.targetCollection;
      const targetId = asset.target_id || asset.targetId;
      const targetField = asset.target_field || asset.targetField;
      const linkedCollection = asset.linked_collection || asset.linkedCollection;
      const linkedId = asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId;
      const linkedField = asset.linked_field || asset.linkedField;
      return directIds.includes(asset.id)
        || targetCollection === "topics" && targetId === topic.id && fieldMatches(targetField)
        || linkedCollection === "topics" && linkedId === topic.id && fieldMatches(linkedField)
        || (recordUrl && urls.includes(recordUrl));
    })
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const rank = (asset = {}) => {
        const targetMatch = (asset.target_collection || asset.targetCollection) === "topics" && (asset.target_id || asset.targetId) === topic.id && fieldMatches(asset.target_field || asset.targetField);
        const linkedMatch = (asset.linked_collection || asset.linkedCollection) === "topics" && (asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId) === topic.id && fieldMatches(asset.linked_field || asset.linkedField);
        return [
          variantScore(asset),
          directIds.includes(asset.id) ? "5" : "0",
          targetMatch ? "4" : "0",
          linkedMatch ? "3" : "0",
          asset.source_type === "edited" ? "2" : "0",
          asset.status === "active" ? "2" : "1"
        ].join("|");
      };
      return rank(b).localeCompare(rank(a))
        || mediaAssetResolutionScore(b) - mediaAssetResolutionScore(a)
        || String(b.updated_at || b.updatedAt || b.created_at || b.createdAt || b.id || "").localeCompare(String(a.updated_at || a.updatedAt || a.created_at || a.createdAt || a.id || ""));
    })[0];
}

function publicTopicImageUrl(topic = {}, mediaAssets = []) {
  return mediaAssetUrl(publicTopicMediaAsset(topic, mediaAssets, "article") || {}) || topicDirectImageUrl(topic);
}

function publicTopicThumbnailUrl(topic = {}, mediaAssets = []) {
  return topicDirectThumbnailUrl(topic) || mediaAssetUrl(publicTopicMediaAsset(topic, mediaAssets, "thumb") || {});
}

function publicTopicCardImageUrl(topic = {}, mediaAssets = []) {
  return mediaAssetUrl(publicTopicMediaAsset(topic, mediaAssets, "card") || {})
    || topicDirectImageUrl(topic)
    || topicDirectThumbnailUrl(topic);
}

function publicTopicImageLooksLikeLogo(topic = {}, asset = {}, url = "") {
  const mediaType = String(asset.media_type || asset.usage_preset || asset.variant_key || "").toLowerCase();
  const field = String(asset.target_field || asset.targetField || asset.linked_field || asset.linkedField || "").toLowerCase();
  const text = [
    url,
    asset.title,
    asset.slug,
    asset.original_filename,
    asset.filename_original,
    asset.filename_web,
    topic.title,
    topic.subtitle,
    topic.shortDescription,
    topic.description,
    topic.longDescription,
    topic.company,
    topic.companyName,
    topic.companyLogoUrl,
    topic.logoUrl
  ].filter(Boolean).join(" ").toLowerCase();
  return mediaType.includes("logo")
    || field.includes("logo")
    || /\blogo\b/.test(text)
    || /\bgema\b/.test(text);
}

function eventMediaImageUrl(medium = {}) {
  const url = medium.fileUrl || medium.file_url || medium.assetUrl || medium.asset_url
    || medium.downloadUrl || medium.downloadURL || medium.url || medium.imageUrl || medium.thumbnailUrl || "";
  return validEventImageUrl(url) ? versionedAssetUrl(url, medium) : "";
}

function eventMediaThumbUrl(event = {}, eventMedia = []) {
  return eventMedia
    .filter((medium) => medium.eventId === event.id)
    .filter((medium) => String(medium.mediaType || medium.type || "").toLowerCase().includes("image") || eventMediaImageUrl(medium))
    .filter((medium) => ["approved", "published", "active"].includes(String(medium.status || "approved").toLowerCase()))
    .filter((medium) => ["public", "öffentlich"].includes(String(medium.visibility || "public").toLowerCase()))
    .filter((medium) => eventMediaImageUrl(medium))
    .sort((a, b) => {
      const score = (medium = {}) => [
        medium.isCoverImage ? "5" : "0",
        Number.isFinite(Number(medium.sortOrder)) ? String(9999 - Number(medium.sortOrder)).padStart(4, "0") : "0000",
        medium.updatedAt || medium.updated_at || medium.uploadedAt || medium.createdAt || "",
        medium.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })
    .map(eventMediaImageUrl)[0] || "";
}

function assetTargetCollection(asset = {}) {
  return asset.target_collection || asset.targetCollection || "";
}

function assetTargetId(asset = {}) {
  return asset.target_id || asset.targetId || "";
}

function assetTargetField(asset = {}) {
  return asset.target_field || asset.targetField || "";
}

function assetLinkedCollection(asset = {}) {
  return asset.linked_collection || asset.linkedCollection || "";
}

function assetLinkedId(asset = {}) {
  return asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId || "";
}

function assetLinkedField(asset = {}) {
  return asset.linked_field || asset.linkedField || "";
}

function eventMediaAssetVariantScore(asset = {}, purpose = "detail") {
  const key = String(asset.variant_key || asset.variantKey || asset.usage_preset || "").toLowerCase();
  if (purpose === "thumb") {
    if (key === "thumbnail") return "9";
    if (key === "news_desktop") return "6";
    if (key === "event_header") return "5";
    return "0";
  }
  if (key === "event_header") return "9";
  if (key === "news_desktop") return "8";
  if (key === "social_share") return "6";
  if (key === "thumbnail") return "0";
  return "4";
}

function publicEventMediaAsset(event = {}, mediaAssets = [], purpose = "detail") {
  const eventImageFields = ["imageUrl", "thumbnail_url", "thumbnailUrl", "assetUrl"];
  const eventUrl = event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "";
  const directIds = purpose === "thumb"
    ? [event.thumbnail_media_asset_id, event.thumbnailMediaAssetId, event.mediaAssetId, event.media_asset_id, event.assetId].filter(Boolean)
    : [event.article_media_asset_id, event.articleMediaAssetId, event.mediaAssetId, event.media_asset_id, event.assetId, event.thumbnail_media_asset_id, event.thumbnailMediaAssetId].filter(Boolean);
  return mediaAssets
    .filter((asset) => {
      const urls = mediaAssetUrls(asset);
      return directIds.includes(asset.id)
        || (assetTargetCollection(asset) === "events" && assetTargetId(asset) === event.id && eventImageFields.includes(assetTargetField(asset) || "imageUrl"))
        || (assetLinkedCollection(asset) === "events" && assetLinkedId(asset) === event.id && eventImageFields.includes(assetLinkedField(asset) || "imageUrl"))
        || (eventUrl && urls.includes(eventUrl));
    })
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const score = (asset = {}) => [
        eventMediaAssetVariantScore(asset, purpose),
        directIds.includes(asset.id) ? "5" : "0",
        assetTargetCollection(asset) === "events" && assetTargetId(asset) === event.id && eventImageFields.includes(assetTargetField(asset) || "imageUrl") ? "4" : "0",
        assetLinkedCollection(asset) === "events" && assetLinkedId(asset) === event.id && eventImageFields.includes(assetLinkedField(asset) || "imageUrl") ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.status === "active" ? "2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function upcomingEventMediaAsset(event = {}, mediaAssets = []) {
  const eventImageFields = ["imageUrl", "thumbnail_url", "thumbnailUrl", "assetUrl"];
  const directIds = [event.thumbnail_media_asset_id, event.thumbnailMediaAssetId, event.mediaAssetId, event.media_asset_id, event.assetId].filter(Boolean);
  return mediaAssets
    .filter((asset) => directIds.includes(asset.id)
      || (assetTargetCollection(asset) === "events" && assetTargetId(asset) === event.id && eventImageFields.includes(assetTargetField(asset) || "imageUrl"))
      || (assetLinkedCollection(asset) === "events" && assetLinkedId(asset) === event.id && eventImageFields.includes(assetLinkedField(asset) || "imageUrl")))
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const score = (asset = {}) => [
        eventMediaAssetVariantScore(asset, "thumb"),
        directIds.includes(asset.id) ? "5" : "0",
        assetTargetCollection(asset) === "events" && assetTargetId(asset) === event.id && eventImageFields.includes(assetTargetField(asset) || "imageUrl") ? "4" : "0",
        assetLinkedCollection(asset) === "events" && assetLinkedId(asset) === event.id && eventImageFields.includes(assetLinkedField(asset) || "imageUrl") ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

const currentMemberIds = new Set([
  "bibel-tv-stiftung",
  "channel-21",
  "kj-technical-consulting-klaus-juli",
  "dsc-dietmar-schickel-consulting",
  "ors-comm",
  "buero-für-moderne-werbung-tv",
  "markus-vogelbacher",
  "blu-tec-one",
  "house-of-research",
  "goldvisite-media",
  "schneider-enterprise",
  "fashion-tv-production",
  "stingray-digital-international",
  "eutelsat-services-beteiligungen",
  "farbi-flora",
  "anixe-hd",
  "js-consult",
  "thorsten-lork",
  "red-bull-media-house",
  "hardy-heine",
  "no-limits-media",
  "itsmaxsuhr",
  "major-seven-consulting",
  "sebastian-labonte",
  "michael-kayser",
  "idee-medien",
  "conrad-heberling",
  "tv-2000plus",
  "3q",
  "johannes-kors",
  "claudio-malasomma-bellavista"
]);

function publicMemberTypeKey(member = {}) {
  const value = String(member.membershipType || member.membership_type || member.membershipLabel || member.memberType || member.membershipKind || member.category || "").toLowerCase();
  if (/(unternehmens|firmen|company|um\b)/i.test(value)) return "company";
  if (/(einzel|individual|em\b)/i.test(value)) return "individual";
  return "";
}

async function publicManagedMembers() {
  const liveMembers = (await listPublicContent("members").catch(() => []))
    .filter((member) => !memberAccessBlocked(member)
      && !["inactive", "cancelled", "archived", "deleted"].includes(String(member.status || "").toLowerCase()))
    .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || String(a.name || "").localeCompare(String(b.name || ""), "de"));
  return liveMembers;
}

function publicEditorialMediaAsset(item = {}, mediaAssets = []) {
  return mediaAssets
    .filter((asset) => {
      const imageUrl = item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || "";
      const directIds = [item.thumbnail_media_asset_id, item.thumbnailMediaAssetId, item.mediaAssetId, item.media_asset_id, item.assetId].filter(Boolean);
      const urls = mediaAssetUrls(asset);
      return directIds.includes(asset.id)
        || (assetTargetCollection(asset) === "editorialContent" && assetTargetId(asset) === item.id && ["imageUrl", "thumbnail_url", "thumbnailUrl"].includes(assetTargetField(asset) || "imageUrl"))
        || (assetLinkedCollection(asset) === "editorialContent" && assetLinkedId(asset) === item.id && ["imageUrl", "thumbnail_url", "thumbnailUrl"].includes(assetLinkedField(asset) || "imageUrl"))
        || (imageUrl && urls.includes(imageUrl));
    })
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const directIds = [item.thumbnail_media_asset_id, item.thumbnailMediaAssetId, item.mediaAssetId, item.media_asset_id, item.assetId].filter(Boolean);
      const score = (asset = {}) => [
        directIds.includes(asset.id) ? "5" : "0",
        assetTargetCollection(asset) === "editorialContent" && assetTargetId(asset) === item.id ? "4" : "0",
        assetLinkedCollection(asset) === "editorialContent" && assetLinkedId(asset) === item.id ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.status === "active" ? "2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

export function publicEditorialCardImage(item = {}, mediaAssets = [], minWidth = 780) {
  const asset = publicEditorialMediaAsset(item, mediaAssets);
  const preferred = mediaAssetPreferredImageUrl(asset || {});
  const articleImage = item.imageDisplayUrl || item.articleImageUrl || item.imageUrl || item.assetUrl || item.asset_url || "";
  const thumbnail = item.thumbnail_url || item.thumbnailUrl || "";
  const direct = thumbnail && thumbnail.split("?")[0] !== String(item.imageUrl || "").split("?")[0]
    ? thumbnail
    : articleImage || thumbnail;
  const assetWidth = Number(asset?.image_width || asset?.imageWidth || imageWidthFromVariantUrl(preferred));
  const assetContainsDirect = asset && mediaAssetUrls(asset).some((url) => String(url).split("?")[0] === String(direct).split("?")[0]);
  const useDirect = Boolean(direct && preferred && direct !== preferred && (!assetContainsDirect || (assetWidth > 0 && assetWidth < minWidth)));
  const url = stableImageUrl(useDirect ? direct : preferred || direct, "news");
  return { url, srcset: asset && !useDirect ? mediaAssetImageSrcset(asset, minWidth) : "" };
}
function publicMemberLogoAsset(member = {}, mediaAssets = []) {
  return mediaAssets
    .filter((asset) => {
      const logoUrl = member.logoUrl || "";
      const directIds = [member.logo_media_asset_id, member.logoMediaAssetId, member.thumbnail_media_asset_id, member.mediaAssetId, member.media_asset_id].filter(Boolean);
      const urls = mediaAssetUrls(asset);
      return directIds.includes(asset.id)
        || (assetTargetCollection(asset) === "members" && assetTargetId(asset) === member.id && (assetTargetField(asset) || "logoUrl") === "logoUrl")
        || (assetLinkedCollection(asset) === "members" && assetLinkedId(asset) === member.id && (assetLinkedField(asset) || "logoUrl") === "logoUrl")
        || (logoUrl && urls.includes(logoUrl));
    })
    .filter((asset) => safeMemberLogoUrl(member, mediaAssetUrl(asset)))
    .sort((a, b) => {
      const directIds = [member.logo_media_asset_id, member.logoMediaAssetId, member.thumbnail_media_asset_id, member.mediaAssetId, member.media_asset_id].filter(Boolean);
      const score = (asset = {}) => [
        directIds.includes(asset.id) ? "5" : "0",
        assetTargetCollection(asset) === "members" && assetTargetId(asset) === member.id && (assetTargetField(asset) || "logoUrl") === "logoUrl" ? "4" : "0",
        assetLinkedCollection(asset) === "members" && assetLinkedId(asset) === member.id && (assetLinkedField(asset) || "logoUrl") === "logoUrl" ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.status === "active" ? "2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function publicSponsorLogoAsset(sponsor = {}, mediaAssets = []) {
  const collectionMatches = (value = "") => ["sponsors", "sponsor", "partners", "partner", "hosts", "host", "co_hosts", "coHosts"].includes(String(value || ""));
  const fieldMatches = (value = "") => {
    const normalized = String(value || "logoUrl").toLowerCase().replace(/[_-]/g, "");
    return ["logourl", "logo", "imageurl", "image", "asseturl", "thumbnailurl"].includes(normalized);
  };
  return mediaAssets
    .filter((asset) => {
      const logoUrl = sponsor.logoUrl || sponsor.logo_url || sponsor.imageUrl || sponsor.image_url || sponsor.assetUrl || "";
      const directIds = [sponsor.logo_media_asset_id, sponsor.logoMediaAssetId, sponsor.logoAssetId, sponsor.thumbnail_media_asset_id, sponsor.thumbnailMediaAssetId, sponsor.mediaAssetId, sponsor.media_asset_id, sponsor.assetId].filter(Boolean);
      const urls = [asset.file_path_web_url, asset.file_path_thumb_url, asset.file_path_original_url, asset.imageUrl, asset.image_url, asset.assetUrl, asset.url].filter(Boolean);
      return directIds.includes(asset.id)
        || (collectionMatches(assetTargetCollection(asset)) && assetTargetId(asset) === sponsor.id && fieldMatches(assetTargetField(asset)))
        || (collectionMatches(assetLinkedCollection(asset)) && assetLinkedId(asset) === sponsor.id && fieldMatches(assetLinkedField(asset)))
        || (logoUrl && urls.includes(logoUrl));
    })
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const directIds = [sponsor.logo_media_asset_id, sponsor.logoMediaAssetId, sponsor.logoAssetId, sponsor.thumbnail_media_asset_id, sponsor.thumbnailMediaAssetId, sponsor.mediaAssetId, sponsor.media_asset_id, sponsor.assetId].filter(Boolean);
      const score = (asset = {}) => [
        directIds.includes(asset.id) ? "5" : "0",
        collectionMatches(assetTargetCollection(asset)) && assetTargetId(asset) === sponsor.id && fieldMatches(assetTargetField(asset)) ? "4" : "0",
        collectionMatches(assetLinkedCollection(asset)) && assetLinkedId(asset) === sponsor.id && fieldMatches(assetLinkedField(asset)) ? "3" : "0",
        asset.source_type === "edited" ? "2" : "0",
        asset.status === "active" ? "2" : "1",
        asset.updated_at || asset.updatedAt || asset.created_at || asset.createdAt || "",
        asset.id || ""
      ].join("|");
      return score(b).localeCompare(score(a));
    })[0];
}

function publicSponsorLogoUrl(sponsor = {}, mediaAssets = []) {
  const asset = publicSponsorLogoAsset(sponsor, mediaAssets);
  return mediaAssetUrl(asset || {}) || sponsor.logoUrl || sponsor.logo_url || sponsor.imageUrl || sponsor.image_url || sponsor.assetUrl || "";
}

async function withPublicMemberLogos(members = []) {
  const mediaAssets = await listPublicMediaAssets().catch(() => []);
  return members.map((member) => {
    const asset = publicMemberLogoAsset(member, mediaAssets);
    const officialLogo = /^\/assets\/official\/members\//i.test(String(member.logoUrl || "")) ? member.logoUrl : "";
    return {
      ...member,
      logoDisplayUrl: safeMemberLogoUrl(member, officialLogo || mediaAssetUrl(asset || {}) || member.logoUrl || "")
    };
  });
}

function boardPortrait(person) {
  const photo = stableImageUrl(person.photoUrl || person.imageUrl || person.thumbnailUrl || person.portraitUrl || person.profileImageUrl || person.assetUrl || "", "member");
  const name = person.name || "Vorstand";
  return photo
    ? `<img src="${escapeHtml(photo)}" alt="Portraet ${escapeHtml(name)}" ${liveImageAttrs("member")}>`
    : `<span class="avatar">${escapeHtml(initials(name))}</span>`;
}

function speakerPortrait(speaker) {
  const photo = speakerPhotoUrl(speaker);
  return photo
    ? `<img src="${escapeHtml(photo)}" alt="Portraet ${escapeHtml(speakerName(speaker))}" ${liveImageAttrs("member")}>`
    : `<span class="avatar">${initials(speakerName(speaker))}</span>`;
}

function speakerName(speaker = {}) {
  return speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ") || "Referent";
}

function speakerPhotoUrl(speaker = {}) {
  return stableImageUrl(speaker.photoUrl || speaker.imageUrl || speaker.thumbnailUrl || speaker.thumbnail_url || speaker.assetUrl || speaker.portraitUrl || speaker.profileImageUrl || "", "member");
}

function speakerCompanyLogoUrl(speaker = {}, topic = {}) {
  return stableImageUrl(
    speaker.companyLogoUrl
      || speaker.logoUrl
      || speaker.company_logo_url
      || speaker.company_logo
      || topic.companyLogoUrl
      || topic.logoUrl
      || topic.company_logo_url
      || "",
    "sponsor"
  );
}

function speakerIntroText(speaker = {}) {
  return speaker.shortBio || speaker.bio || speaker.introText || speaker.description || speaker.shortDescription || speaker.teaserText || "";
}

function speakerVitaText(speaker = {}) {
  return speaker.longBio || speaker.vita || speaker.biography || speaker.bodyText || speaker.longDescription || speaker.profileText || speaker.description || "";
}

function speakerProfileHref(speaker = {}) {
  return `#/speaker/${encodeURIComponent(speaker.id || speaker.slug || "")}`;
}

function publicSpeakerIsVisible(speaker = {}) {
  const status = String(speaker.status || "published").toLowerCase();
  const visibility = String(speaker.visibility || "public").toLowerCase();
  return !["archived", "deleted", "hidden", "inactive"].includes(status)
    && !["internal", "hidden"].includes(visibility)
    && Boolean(speakerName(speaker));
}

function speakerTalkLinks(speaker = {}, topics = [], events = []) {
  const topicIds = new Set([speaker.topicId, ...(speaker.topicIds || [])].filter(Boolean));
  const eventIds = new Set(speaker.eventIds || []);
  return topics
    .filter((topic) => topicIsReleasedAfterEvent(topic, events) && (topicIds.has(topic.id) || (topic.speakerIds || []).includes(speaker.id) || (topic.moderatorIds || []).includes(speaker.id)))
    .map((topic) => {
      const event = events.find((item) => eventIds.has(item.id) && (item.topicIds || []).includes(topic.id))
        || events.find((item) => (item.topicIds || []).includes(topic.id));
      return { topic, event };
    });
}

function archiveArticle(event, partners = []) {
  const host = partners.find((partner) => partner.id === event.hostId);
  const dateLabel = event.displayDate || formatDate(event.date);
  return `<article class="archive-article">
    ${event.imageUrl ? `<figure class="archive-article__image"><img src="${escapeHtml(event.imageUrl)}" alt="Rückblick ${escapeHtml(event.title)}" loading="lazy" decoding="async"></figure>` : `<div class="archive-article__placeholder"><span>${escapeHtml(event.eventType || "Archiv")}</span></div>`}
    <div class="archive-article__body">
      <p class="eyebrow">${escapeHtml(dateLabel)}${event.city ? ` · ${escapeHtml(event.city)}` : ""}</p>
      <h2>${escapeHtml(event.title)}</h2>
      <p class="archive-article__meta">${escapeHtml(event.locationName || "Ort nicht angegeben")}${host ? ` · Co-Gastgeber: ${escapeHtml(host.name)}` : ""}</p>
      <p>${escapeHtml(event.postEventSummary || event.description)}</p>
    </div>
  </article>`;
}

function archiveEditorialArticle(item, partners = []) {
  const sponsor = item.sponsorId ? partners.find((partner) => partner.id === item.sponsorId) : null;
  const dateLabel = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  return `<article class="archive-article">
    ${item.imageUrl ? `<figure class="archive-article__image"><img src="${escapeHtml(item.imageUrl)}" alt="Rückblick ${escapeHtml(item.title || "")}" loading="lazy" decoding="async"></figure>` : `<div class="archive-article__placeholder"><span>Rückblick</span></div>`}
    <div class="archive-article__body">
      <p class="eyebrow">${dateLabel ? formatDate(dateLabel.slice(0, 10)) : "Rückblick"}${sponsor ? ` · ${escapeHtml(sponsor.name)}` : ""}</p>
      <h2>${escapeHtml(item.title || "Rückblick")}</h2>
      ${item.subtitle ? `<p class="archive-article__meta">${escapeHtml(item.subtitle)}</p>` : ""}
      <p>${escapeHtml(teaserText(item.longDescription || item.articleText || item.bodyText || item.mainText || item.fullText || item.longText || item.introText || "", 260))}</p>
      <a class="link" href="#/retrospective/${item.id}">Rückblick lesen →</a>
    </div>
  </article>`;
}

function articleParagraphs(text = "") {
  return richTextHtml(text);
}

function looksTruncatedText(text = "") {
  return /(?:\.\.\.|…)$/u.test(String(text || "").trim());
}

function cleanPublicArticleText(text = "") {
  return String(text || "")
    .replace(/(?:^|\n{2,})(?:keywords?|tags?|schlagworte?)\s*[:\n][\s\S]*$/i, "")
    .trim();
}

function eventTopicTeaser(topic = {}) {
  const short = cleanPublicArticleText(topic.shortDescription || topic.teaserText || topic.subtitle || "");
  const long = cleanPublicArticleText(topic.longDescription || topic.bodyText || topic.articleText || "");
  return teaserText(long || short, 220);
}

function registrationPartyNames(registration = {}) {
  const primary = [registration.firstName, registration.lastName].filter(Boolean).join(" ").trim();
  const companion = registration.companion || {};
  const companionName = [companion.firstName, companion.lastName].filter(Boolean).join(" ").trim();
  return [primary, companionName].filter(Boolean);
}

function registrationPartyLabel(registration = {}) {
  return registrationPartyNames(registration).join(" und ") || "Dieses Geraet";
}

function eventIntroText(event = {}) {
  return cleanPublicArticleText(event.description || event.publicTeaser || event.teaserText || event.shortDescription || event.introText || event.subtitle || "");
}

function eventLongText(event = {}) {
  return cleanPublicArticleText(event.postEventSummary || event.postEventummary || event.archiveText || event.longDescription || event.bodyText || event.articleText || "");
}

function eventOnlineLabel(event = {}) {
  return event.onlineMeetingLabel || (event.isVirtualEvent ? "Zoom Meeting" : "");
}

function eventLocationDisplay(event = {}) {
  if (event.isVirtualEvent) return [eventOnlineLabel(event), event.city].filter(Boolean).join(", ") || "Online";
  return [event.locationName, event.city].filter(Boolean).join(", ") || "Ort wird bekanntgegeben";
}

function eventAddressMarkup(event = {}) {
  if (event.isVirtualEvent || (!event.address && !event.postalCode && !event.zipCode)) return "";
  const cityLine = [event.postalCode || event.zipCode, event.city].filter(Boolean).join(" ");
  return [event.address, cityLine].filter(Boolean).map((line) => escapeHtml(line)).join("<br>");
}

function eventCalendarSaveEnabled(event = {}) {
  return event.calendarSaveEnabled !== false && event.calendar_vormerkung !== false;
}

function eventCalendarIcsUrl(event = {}, includeDecisionReminder = true) {
  const id = String(event.id || "").trim();
  const reminder = includeDecisionReminder ? "1" : "0";
  return id ? `https://europe-west3-prodigitaltv-da47b.cloudfunctions.net/eventCalendarIcs?eventId=${encodeURIComponent(id)}&decisionReminder=${reminder}` : "";
}
function eventCalendarSaveMarkup(event = {}) {
  if (!eventCalendarSaveEnabled(event)) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://prodigitaltv.de";
  const googleUrl = generateGoogleCalendarUrl(event, { origin });
  const googleReminderUrl = generateGoogleDecisionReminderUrl(event, { origin });
  const outlookUrl = generateOutlookCalendarUrl(event, { origin });
  const outlookReminderUrl = generateOutlookDecisionReminderUrl(event, { origin });
  const fileName = calendarFileName(event);
  const cloudIcsUrl = eventCalendarIcsUrl(event, true);
  const cloudIcsPlainUrl = eventCalendarIcsUrl(event, false);
  const fallbackIcsContent = cloudIcsUrl ? "" : generateICS(event, { origin, includeDecisionReminder: true });
  const fallbackIcsPlainContent = cloudIcsUrl ? "" : generateICS(event, { origin, includeDecisionReminder: false });
  const fallbackIcsAttrs = cloudIcsUrl ? "" : ` data-calendar-ics-download data-calendar-file="${escapeHtml(fileName)}" data-calendar-ics-on="${escapeHtml(encodeURIComponent(fallbackIcsContent))}" data-calendar-ics-off="${escapeHtml(encodeURIComponent(fallbackIcsPlainContent))}"`;
  const icsUrl = cloudIcsUrl || generateICSDataUrl(event, { origin, includeDecisionReminder: true });
  const icsPlainUrl = cloudIcsPlainUrl || generateICSDataUrl(event, { origin, includeDecisionReminder: false });
  return `<div class="event-calendar-save" data-calendar-save><button class="button button--secondary" type="button" data-calendar-overlay-open aria-haspopup="dialog">Termin merken</button><p>Unverbindlich im Kalender speichern. Das erstellt keine Anmeldung.</p><div class="event-calendar-overlay" data-calendar-overlay hidden><div class="event-calendar-overlay__backdrop" data-calendar-overlay-close></div><div class="event-calendar-dialog" role="dialog" aria-modal="true" aria-label="Termin merken"><button class="event-calendar-dialog__close" type="button" data-calendar-overlay-close aria-label="Schliessen">&times;</button><strong>Termin merken</strong><p>Veranstaltung im persönlichen Kalender speichern.</p><label class="event-calendar-switch"><input type="checkbox" data-calendar-decision-toggle role="switch" aria-label="Teilnahme 7 Tage vorher noch einmal pruefen" aria-checked="true" checked><span class="event-calendar-switch__track" aria-hidden="true"></span><span><b>Teilnahme 7 Tage vorher noch einmal prüfen</b><small data-calendar-decision-state>AN</small></span></label><small>Wir tragen zusätzlich eine Erinnerung ein, damit Sie eine Woche vor der Veranstaltung entscheiden können, ob Sie teilnehmen möchten. Es wird nichts bei PROdigitalTV gespeichert.</small><div class="event-calendar-menu" data-calendar-options><a class="button button--secondary button--small" href="${escapeHtml(googleUrl)}" data-calendar-provider="google" data-calendar-reminder-url="${escapeHtml(googleReminderUrl)}" target="_blank" rel="noopener">Google Kalender</a><a class="button button--secondary button--small" href="${escapeHtml(outlookUrl)}" data-calendar-provider="outlook" data-calendar-reminder-url="${escapeHtml(outlookReminderUrl)}" target="_blank" rel="noopener">Outlook / Microsoft 365</a><a class="button button--secondary button--small" href="${escapeHtml(icsUrl)}" data-calendar-url-on="${escapeHtml(icsUrl)}" data-calendar-url-off="${escapeHtml(icsPlainUrl)}" download="${escapeHtml(fileName)}"${fallbackIcsAttrs}>Apple / iCal</a><a class="button button--secondary button--small" href="${escapeHtml(icsUrl)}" data-calendar-url-on="${escapeHtml(icsUrl)}" data-calendar-url-off="${escapeHtml(icsPlainUrl)}" download="${escapeHtml(fileName)}"${fallbackIcsAttrs}>ICS herunterladen</a></div><p class="event-calendar-mobile-note"><a class="link" href="${escapeHtml(icsUrl)}" target="_blank" rel="noopener">Kalenderdatei fürs Handy öffnen</a> – enthält Event und 7-Tage-Wiedervorlage.</p><div class="event-calendar-fallback" data-calendar-reminder-fallback hidden tabindex="-1"><strong>Zweiter Kalendereintrag wurde blockiert.</strong><p>Bitte die Wiedervorlage zusätzlich öffnen und in Google/Outlook speichern.</p><a class="button button--secondary button--small" href="#" target="_blank" rel="noopener">Wiedervorlage öffnen</a></div><small>Vormerken ist keine Anmeldung, Reservierung oder Zusage.</small></div></div></div>`;
}
function eventLocationDetailMarkup(event = {}) {
  if (event.isVirtualEvent) {
    return `<h2>${escapeHtml(eventOnlineLabel(event) || "Online")}</h2><p>Virtuelle Teilnahme per Zoom Meeting.${event.zoomLink ? "<br>Den Zugangslink erhalten angemeldete Teilnehmer separat." : ""}</p>`;
  }
  return `<h2>${escapeHtml(event.locationName || "Ort wird bekanntgegeben")}</h2>${eventAddressMarkup(event) || event.phone ? `<p>${eventAddressMarkup(event)}${event.phone ? `<br>Telefon: ${escapeHtml(event.phone)}` : ""}</p>` : ""}`;
}

function archiveEventImageUrl(event = {}, mediaAssets = []) {
  const directUrl = versionedAssetUrl(event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "", event);
  const asset = publicEventMediaAsset(event, mediaAssets, "detail");
  const candidates = [
    directUrl,
    mediaAssetUrl(asset || {})
  ].filter(Boolean);
  return candidates.find((url) => validEventImageUrl(url)) || "";
}

function staticOfficialEventImageUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return false;
  return /(?:\/|%2F)assets(?:\/|%2F)official(?:\/|%2F)events(?:\/|%2F)/i.test(value);
}

function blockedStaticEventPlaceholder(url = "") {
  return staticOfficialEventImageUrl(url);
}

function blockedLegacyEventImageUrl(url = "") {
  return /DSC06819\.jpg|Images%2FDSC06819\.jpg|Images\/DSC06819\.jpg/i.test(String(url || ""));
}

function validEventImageUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return false;
  if (value.startsWith("data:image/")) return false;
  if (blockedLegacyEventImageUrl(value)) return false;
  if (staticOfficialEventImageUrl(value)) return false;
  return true;
}

function blockedHomeEventImageUrl(url = "") {
  return blockedLegacyEventImageUrl(url) || staticOfficialEventImageUrl(url);
}

function upcomingEventImageUrl(event = {}, mediaAssets = [], options = {}) {
  const directUrl = versionedAssetUrl(event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "", event);
  const directAssetUrl = mediaAssetUrl(upcomingEventMediaAsset(event, mediaAssets) || {});
  const candidates = [directUrl, directAssetUrl].filter(Boolean);
  const match = candidates.find((url) => validEventImageUrl(url) && !blockedHomeEventImageUrl(url));
  return match || "";
}

function eventDetailImageUrl(event = {}, mediaAssets = [], blockedUrls = []) {
  const blocked = new Set(blockedUrls.filter(Boolean));
  const direct = versionedAssetUrl(event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "", event);
  if (validEventImageUrl(direct) && !blocked.has(direct)) return direct;
  const candidate = archiveEventImageUrl(event, mediaAssets);
  if (candidate && !blocked.has(candidate)) return candidate;
  return "";
}

function eventTalkSpeakers(topic = {}, event = {}, speakers = []) {
  const eventSpeakerIds = new Set(event.speakerIds || []);
  const topicSpeakerIds = new Set([topic.speakerId, ...(topic.speakerIds || []), topic.moderatorId, ...(topic.moderatorIds || [])].filter(Boolean));
  return speakers.filter((speaker) => {
    const topicLinked = topicSpeakerIds.size
      ? topicSpeakerIds.has(speaker.id)
      : speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
    const eventLinked = eventSpeakerIds.has(speaker.id) || (speaker.eventIds || []).includes(event.id);
    return topicLinked && eventLinked;
  });
}

function eventTalkSpeakerLabel(topic = {}, speaker = {}, index = 0) {
  const explicit = [topic.speakerRoles, topic.speakerRoleById]
    .filter((roles) => roles && !Array.isArray(roles))
    .map((roles) => String(roles[speaker.id] || "").trim())
    .find(Boolean);
  if (explicit) return explicit;
  if ((topic.moderatorIds || []).includes(speaker.id) || topic.moderatorId === speaker.id) return "Moderation";
  const contributionType = String(topic.contributionType || "lecture").toLowerCase();
  if (contributionType === "discussion" || contributionType === "interview") return "Teilnehmer/in";
  const primaryId = topic.speakerId || topic.speakerIds?.[0];
  return (primaryId ? speaker.id === primaryId : index === 0) ? "Referent" : "Co-Referent";
}

function eventInvitationProgramText(topics = [], speakers = [], event = {}, currentText = "") {
  if (isPastEvent(event)) return "";
  const assignedTopics = (event.topicIds || []).map((topicId) => topics.find((topic) => topic.id === topicId)).filter((topic) => topic && isVisibleEventTalk(topic));
  const existingText = String(currentText || "").toLocaleLowerCase("de");
  const missingTalks = assignedTopics.map((topic) => {
    const title = String(topic.title || topic.headline || "").trim();
    if (!title) return null;
    const topicSpeakers = eventTalkSpeakers(topic, event, speakers);
    const requiredValues = [title, ...topicSpeakers.flatMap((speaker) => [speakerName(speaker), speaker.company || ""])].filter(Boolean);
    if (requiredValues.every((value) => existingText.includes(String(value).toLocaleLowerCase("de")))) return null;
    return { title, speakers: topicSpeakers };
  }).filter(Boolean);
  if (!missingTalks.length) return "";
  const sentences = missingTalks.map((talk, index) => {
    const speakerLabels = talk.speakers.map((speaker) => {
      const name = speakerName(speaker);
      return speaker.company ? `${name} von ${speaker.company}` : name;
    }).filter(Boolean);
    if (!speakerLabels.length) {
      return index % 2 === 0
        ? `Zum Programm gehört der Vortrag „${talk.title}“.`
        : `Ein weiterer fachlicher Schwerpunkt ist „${talk.title}“.`;
    }
    const subject = speakerLabels.length === 1
      ? speakerLabels[0]
      : `${speakerLabels.slice(0, -1).join(", ")} und ${speakerLabels.at(-1)}`;
    const plural = speakerLabels.length > 1;
    const variants = [
      `${subject} ${plural ? "stellen" : "stellt"} den Vortrag „${talk.title}“ vor.`,
      `${subject} ${plural ? "sprechen" : "spricht"} über „${talk.title}“.`,
      `${subject} ${plural ? "setzen" : "setzt"} mit „${talk.title}“ einen weiteren fachlichen Schwerpunkt.`,
      `${subject} ${plural ? "präsentieren" : "präsentiert"} „${talk.title}“.`
    ];
    return variants[index % variants.length];
  });
  return `Das Programm verbindet mehrere Perspektiven aus der digitalen Medienwirtschaft: ${sentences.join(" ")}`;
}

function eventInvitationClosingText(event = {}, registrationAllowed = false) {
  if (isPastEvent(event)) return "";
  const city = String(event.city || "").trim();
  const welcome = city
    ? `Wir freuen uns darauf, Sie in ${city} persönlich zu begrüßen.`
    : "Wir freuen uns darauf, Sie persönlich begrüßen zu dürfen.";
  return registrationAllowed
    ? `${welcome} Bitte melden Sie sich frühzeitig an, damit wir Ihre Teilnahme verbindlich einplanen können.`
    : welcome;
}

function eventScheduleMarkup(event = {}, topics = [], speakers = []) {
  const topicIds = new Set(event.topicIds || []);
  const eventTopics = topics.filter(topic => topicIds.has(topic.id) || topic.eventId === event.id || (topic.eventIds || []).includes(event.id));
  const visibleTopics = eventTopics.filter(isVisibleEventTalk);
  const hiddenTopics = eventTopics.filter(topic => !isVisibleEventTalk(topic));
  const items = eventAgendaItems(event, visibleTopics, speakers).filter(item =>
    !hiddenTopics.some(topic => item.topicId === topic.id || String(item.title).trim().toLowerCase() === String(topic.title || "").trim().toLowerCase()));
  items.forEach(item => {
    item.speakerLinks = [...new Set([...(item.moderatorIds || []), ...(item.speakerIds || [])])].map(id => speakers.find(speaker => speaker.id === id)).filter(Boolean)
      .map(speaker => ({ name: speakerName(speaker), href: speakerProfileHref(speaker) }));
  });
  const moderatorName = String(event.moderatorName || "").trim();
  if (!items.length && !moderatorName) return "";
  return `<section class="event-schedule" aria-label="Agenda">
    ${moderatorName ? `<p class="event-schedule__moderator">Durch das Programm führt Sie <strong>${escapeHtml(moderatorName)}</strong>.</p>` : ""}
    ${agendaMarkup({ scheduleItems: items })}
  </section>`;
}

function retrospectiveLinkedEvent(item = {}, events = []) {
  const explicit = events.find((event) => event.id === item.linkedEventId || event.id === item.galleryEventId);
  if (explicit) return explicit;
  const haystack = `${item.title || ""} ${item.subtitle || ""} ${item.introText || ""} ${item.bodyText || ""} ${item.longDescription || ""} ${item.articleText || ""}`.toLowerCase();
  const knownEventId = haystack.includes("leica") || haystack.includes("wetzlar")
    ? "event-leica-welt-2026"
    : haystack.includes("berlinale") || haystack.includes("heussen")
      ? "event-berlinale-2026"
      : haystack.includes("salzburg") || haystack.includes("red bull")
        ? "event-salzburg-2025"
        : "";
  if (knownEventId) return events.find((event) => event.id === knownEventId) || null;
  return null;
}

function archiveListEvent(event, partners = [], mediaAssets = [], editorial = [], eventMedia = [], galleries = []) {
  const host = partners.find((partner) => partner.id === event.hostId);
  const retrospectiveArticle = editorial.find((item) => retrospectiveArticleIsVisible(item, [event]) && retrospectiveLinkedEvent(item, [event])?.id === event.id);
  const displayTitle = retrospectiveArticle?.title || event.retrospectiveTitle || event.title;
  const dateLabel = event.displayDate || formatDate(event.date);
  const detailUrl = retrospectiveArticle?.id ? `#/retrospective/${escapeHtml(retrospectiveArticle.id)}` : `#/event/${escapeHtml(event.id)}`;
  const imageUrl = retrospectiveThumbUrl(retrospectiveArticle, event, galleries, mediaAssets)
    || archiveEventImageUrl(event, mediaAssets)
    || eventMediaThumbUrl(event, eventMedia);
  return `<article class="archive-article archive-article--list">
    <a class="archive-article__thumb" href="${detailUrl}" aria-label="Rückblick ${escapeHtml(displayTitle)} ansehen">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Rückblick ${escapeHtml(displayTitle)}" loading="lazy" decoding="async">` : `<span>${escapeHtml(event.eventType || "Archiv")}</span>`}
    </a>
    <div class="archive-article__body">
      <p class="eyebrow">${escapeHtml(dateLabel)}${event.city ? ` · ${escapeHtml(event.city)}` : ""}</p>
      <h2><a href="${detailUrl}">${escapeHtml(displayTitle)}</a></h2>
      <p class="archive-article__meta">${escapeHtml(event.locationName || "Ort nicht angegeben")}${host ? ` · Co-Gastgeber: ${escapeHtml(host.name)}` : ""}</p>
      <p>${escapeHtml(teaserText(event.postEventSummary || event.postEventummary || event.description || "", 260))}</p>
      <a class="link" href="${detailUrl}">Rückblick ansehen -></a>
    </div>
  </article>`;
}

function galleryThumbUrlForRetrospective(item = {}, linkedEvent = null, galleries = []) {
  const galleryIds = [item.galleryId, item.gallery_id, linkedEvent?.galleryId, linkedEvent?.gallery_id].filter(Boolean);
  const gallery = galleries.find((entry) => galleryIds.includes(entry.id))
    || galleries.find((entry) => linkedEvent?.id && entry.eventId === linkedEvent.id && entry.status === "published" && entry.visibility === "public")
    || galleries.find((entry) => item.id && (entry.linkedRecordId === item.id || entry.targetId === item.id));
  const images = Array.isArray(gallery?.images) ? gallery.images : [];
  const firstImage = [...images]
    .filter((entry) => validEventImageUrl(entry.url || entry.imageUrl || entry.assetUrl || entry.thumbnailUrl || ""))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))[0];
  return firstImage ? versionedAssetUrl(firstImage.url || firstImage.imageUrl || firstImage.assetUrl || firstImage.thumbnailUrl || "", gallery) : "";
}

function retrospectiveThumbUrl(item = {}, linkedEvent = null, galleries = [], mediaAssets = []) {
  const directAssetIds = [item.thumbnail_media_asset_id, item.thumbnailMediaAssetId, item.mediaAssetId, item.media_asset_id, item.assetId].filter(Boolean);
  const articleAsset = publicEditorialMediaAsset(item, mediaAssets);
  const hasBrokenDirectAssetReference = directAssetIds.length && !articleAsset;
  const linkedEventThumb = linkedEvent ? archiveEventImageUrl(linkedEvent, mediaAssets) : "";
  const preferredLinkedEventThumb = linkedEventThumb || "";
  const articleThumb = mediaAssetUrl(articleAsset || {}) || versionedAssetUrl(item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || "", item);
  const galleryThumb = galleryThumbUrlForRetrospective(item, linkedEvent, galleries);
  if (hasBrokenDirectAssetReference && preferredLinkedEventThumb) return preferredLinkedEventThumb;
  if (validEventImageUrl(articleThumb)) return articleThumb;
  if (validEventImageUrl(galleryThumb)) return galleryThumb;
  return preferredLinkedEventThumb || linkedEventThumb;
}

function archiveListEditorial(item, partners = [], events = [], mediaAssets = [], galleries = []) {
  const sponsor = item.sponsorId ? partners.find((partner) => partner.id === item.sponsorId) : null;
  const linkedEvent = retrospectiveLinkedEvent(item, events);
  const thumbUrl = retrospectiveThumbUrl(item, linkedEvent, galleries, mediaAssets);
  const dateLabel = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  const detailUrl = `#/retrospective/${escapeHtml(item.id)}`;
  return `<article class="archive-article archive-article--list">
    <a class="archive-article__thumb" href="${detailUrl}" aria-label="Rückblick ${escapeHtml(item.title || "Rückblick")} lesen">
      ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="Rückblick ${escapeHtml(item.title || "")}" loading="lazy" decoding="async">` : `<span>Rückblick</span>`}
    </a>
    <div class="archive-article__body">
      <p class="eyebrow">${dateLabel ? formatDate(dateLabel.slice(0, 10)) : "Rückblick"}${sponsor ? ` · ${escapeHtml(sponsor.name)}` : ""}</p>
      <h2><a href="${detailUrl}">${escapeHtml(item.title || "Rückblick")}</a></h2>
      ${item.subtitle ? `<p class="archive-article__meta">${escapeHtml(item.subtitle)}</p>` : ""}
      <p>${escapeHtml(teaserText(item.longDescription || item.articleText || item.bodyText || item.mainText || item.fullText || item.longText || item.introText || "", 260))}</p>
      <a class="link" href="${detailUrl}">Rückblick lesen -></a>
    </div>
  </article>`;
}

async function hydrateArchiveEventImages(events = [], mediaAssets = []) {
  const hydrateOne = async (event) => {
    if (archiveEventImageUrl(event, mediaAssets)) return event;
    const freshEvent = await getOne("events", event.id).catch(() => null);
    if (!freshEvent) return event;
    return {
      ...event,
      imageUrl: freshEvent.imageUrl || event.imageUrl || "",
      thumbnail_url: freshEvent.thumbnail_url || event.thumbnail_url || "",
      thumbnailUrl: freshEvent.thumbnailUrl || event.thumbnailUrl || "",
      assetUrl: freshEvent.assetUrl || event.assetUrl || "",
      mediaAssetId: freshEvent.mediaAssetId || event.mediaAssetId || "",
      media_asset_id: freshEvent.media_asset_id || event.media_asset_id || "",
      thumbnail_media_asset_id: freshEvent.thumbnail_media_asset_id || event.thumbnail_media_asset_id || "",
      thumbnailMediaAssetId: freshEvent.thumbnailMediaAssetId || event.thumbnailMediaAssetId || "",
      updatedAt: freshEvent.updatedAt || event.updatedAt || "",
      updated_at: freshEvent.updated_at || event.updated_at || ""
    };
  };
  const hydrated = [];
  for (let index = 0; index < events.length; index += 4) {
    const chunk = events.slice(index, index + 4);
    hydrated.push(...await Promise.all(chunk.map(hydrateOne)));
  }
  return hydrated;
}

const internalPageMeta = {
  ueber_uns: {
    active: "about",
    route: "about",
    detailRoute: "über-uns",
    eyebrow: "Über uns",
    title: "Das Branchennetzwerk der digitalen Medienwirtschaft.",
    intro: "PROdigitalTV vernetzt Unternehmen und Akteure der digitalen Medienwirtschaft im deutschsprachigen Raum."
  },
  mitglied_werden: {
    active: "join",
    route: "join",
    detailRoute: "mitglied-werden",
    eyebrow: "Mitglied werden",
    title: "Teil eines starken Branchennetzwerks werden",
    intro: "Eine Mitgliedschaft bei PROdigitalTV bietet Zugang zu Austausch, Wissen, Sichtbarkeit und exklusiven Formaten der digitalen Medienwirtschaft."
  }
};

function canonicalInternalBlock(item = {}) {
  return {
    ...item,
    slug: item.slug || item.id,
    bereich: item.bereich || (item.page === "about" ? "ueber_uns" : item.page === "join" ? "mitglied_werden" : ""),
    typ: item.typ || item.section || "textblock",
    titel: item.titel || item.title || "",
    kurztext: item.kurztext || item.introText || item.subtitle || "",
    langtext: item.langtext || item.bodyText || "",
    icon: item.icon || "modules",
    sortierung: Number(item.sortierung ?? item.sortOrder ?? 0),
    button_text: item.button_text || item.buttonText || "",
    button_ziel: item.button_ziel || item.buttonUrl || ""
  };
}

function isPublicInternalBlock(item = {}, bereich) {
  const block = canonicalInternalBlock(item);
  const managedInternal = item.editorialManaged || ["ueber_uns", "mitglied_werden"].includes(block.bereich);
  const visibility = String(item.sichtbarkeit || item.visibility || "").toLowerCase();
  return managedInternal
    && block.bereich === bereich
    && ["aktiv", "published"].includes(String(item.status || ""))
    && ["öffentlich", "oeffentlich", "public"].includes(visibility);
}

async function internalBlocks(bereich) {
  const records = await listPublicContent("editorialContent").catch(() => []);
  return records
    .filter((item) => isPublicInternalBlock(item, bereich))
    .map(canonicalInternalBlock)
    .sort((a, b) => Number(a.sortierung || 0) - Number(b.sortierung || 0));
}

function internalIcon(name = "") {
  const labels = {
    network: "N", compass: "K", modules: "M", dialog: "D", breakfast: "B", interview: "I", transformation: "T", impact: "W",
    membership: "M", knowledge: "W", visibility: "S", presentation: "P", guest: "G", exclusive: "E", law: "R", gema: "G", cooperation: "K", discount: "%", cta: ">"
  };
  return `<span class="internal-card__icon" aria-hidden="true">${escapeHtml(labels[name] || "•")}</span>`;
}

function internalCard(block, meta) {
  const href = `#/${meta.detailRoute}/${encodeURIComponent(block.slug)}`;
  return `<a class="internal-card internal-card--${escapeHtml(block.typ)}" href="${href}">
    ${internalIcon(block.icon)}
    <span><strong>${escapeHtml(block.titel)}</strong><small>${escapeHtml(block.kurztext)}</small></span>
    <b aria-hidden="true">→</b>
  </a>`;
}

function aboutThumbLabel(icon = "") {
  const labels = {
    network: "Netz",
    membership: "Mitglied",
    knowledge: "Wissen",
    visibility: "Sichtbar",
    presentation: "Events",
    guest: "Gaeste",
    exclusive: "Exklusiv",
    law: "Recht",
    gema: "GEMA",
    cooperation: "Kontakt",
    discount: "Rabatt",
    cta: "Anfrage",
    compass: "Werte",
    modules: "Leistung",
    dialog: "Dialog",
    breakfast: "Events",
    interview: "Talk",
    transformation: "Wandel",
    impact: "Wirkung"
  };
  return labels[icon] || "PDT";
}

function aboutPicto(icon = "") {
  const pictos = {
    network: `<svg viewBox="0 0 24 24"><path d="M7 20v-1.5a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4V20"/><circle cx="12" cy="7" r="4"/><path d="M4 19v-1.2a3.6 3.6 0 0 1 3-3.55"/><path d="M20 19v-1.2a3.6 3.6 0 0 0-3-3.55"/></svg>`,
    compass: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.25 5.25L8.4 15.6l2.25-5.25 4.95-1.95z"/></svg>`,
    modules: `<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="m7.2 10.8 9.6-4.6"/><path d="m7.2 13.2 9.6 4.6"/></svg>`,
    membership: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
    knowledge: `<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.6 15.1A6 6 0 1 1 15.4 15c-.8.6-1.4 1.5-1.4 2.5h-4c0-1-.6-1.8-1.4-2.4z"/></svg>`,
    visibility: `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg>`,
    presentation: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>`,
    guest: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="M16 11h5"/><path d="M18.5 8.5v5"/></svg>`,
    exclusive: `<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9L12 3z"/></svg>`,
    law: `<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M6 7l-4 7h8L6 7z"/><path d="M18 7l-4 7h8l-4-7z"/><path d="M8 21h8"/></svg>`,
    gema: `<svg viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></svg>`,
    cooperation: `<svg viewBox="0 0 24 24"><circle cx="7" cy="12" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="m9.6 10.5 4.8-2.1"/><path d="m9.6 13.5 4.8 2.1"/></svg>`,
    discount: `<svg viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M7 7h.01"/><path d="M17 17h.01"/></svg>`,
    cta: `<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/><rect x="3" y="4" width="18" height="16" rx="3"/></svg>`,
    dialog: `<svg viewBox="0 0 24 24"><path d="M5 18 3 21V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5z"/><path d="M7 8h10"/><path d="M7 12h7"/></svg>`,
    breakfast: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>`,
    interview: `<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>`,
    transformation: `<svg viewBox="0 0 24 24"><rect x="3" y="13" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/><path d="M3 20h19"/></svg>`,
    impact: `<svg viewBox="0 0 24 24"><rect x="3" y="13" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/><path d="M3 20h19"/></svg>`
  };
  return `<span class="about-picto" aria-hidden="true">${pictos[icon] || pictos.modules}</span>`;
}

function aboutButtonGallery(blocks, meta) {
  return `<div class="internal-button-gallery" aria-label="Über-uns Bereiche">${blocks.map((block) => {
    const href = `#/${meta.detailRoute}/${encodeURIComponent(block.slug)}`;
    return `<a href="${href}">${aboutPicto(block.icon)}<span>${escapeHtml(block.titel)}</span></a>`;
  }).join("")}</div>`;
}

function aboutInternalCard(block, meta, options = {}) {
  const summary = options.summary === "long"
    ? teaserText(block.langtext || block.kurztext, 190)
    : block.kurztext;
  if (options.joinCta) {
    return `<article class="internal-card internal-card--about internal-card--join internal-card--${escapeHtml(block.typ)}" role="button" tabindex="0" data-about-jump="${escapeHtml(block.slug)}">
    <span class="internal-about-thumb internal-about-thumb--${escapeHtml(block.icon || "modules")}" aria-hidden="true">${aboutPicto(block.icon)}<strong>${escapeHtml(aboutThumbLabel(block.icon))}</strong></span>
    <span class="internal-about-copy"><strong>${escapeHtml(block.titel)}</strong><small>${escapeHtml(summary)}</small></span>
    <button class="join-text-link internal-card__join-cta" type="button" data-join-scroll>Mitgliedsantrag -></button>
  </article>`;
  }
  return `<button class="internal-card internal-card--about internal-card--${escapeHtml(block.typ)}" type="button" data-about-jump="${escapeHtml(block.slug)}">
    <span class="internal-about-thumb internal-about-thumb--${escapeHtml(block.icon || "modules")}" aria-hidden="true">${aboutPicto(block.icon)}<strong>${escapeHtml(aboutThumbLabel(block.icon))}</strong></span>
    <span class="internal-about-copy"><strong>${escapeHtml(block.titel)}</strong><small>${escapeHtml(summary)}</small></span>
  </button>`;
}

function aboutLongTextSection(block, options = {}) {
  return `<article class="internal-about-text" id="about-text-${escapeHtml(block.slug)}">
    <div class="internal-about-text__head">${aboutPicto(block.icon)}<div><p class="eyebrow">${escapeHtml(block.titel)}</p><h2>${escapeHtml(block.titel)}</h2><p>${escapeHtml(block.kurztext)}</p></div></div>
    ${ttsReader({ rubric: "Interna", title: block.titel || "", text: block.langtext || "", audio: block.audio || {}, audioProvider: block.audioProvider || "", audioUrl: block.audioUrl || "", audioAccessibleUrl: block.audioAccessibleUrl || "", audioNaturalUrl: block.audioNaturalUrl || "", timingUrl: block.timingUrl || "", audioStatus: block.audioStatus || "", audioAccessibleStatus: block.audioAccessibleStatus || "", audioNaturalStatus: block.audioNaturalStatus || "" })}
    <div class="editorial-text">${articleParagraphs(block.langtext)}</div>
    ${options.joinCta ? `<button class="join-text-link internal-text-join-cta" type="button" data-join-scroll>Mitgliedsantrag -></button>` : ""}
    <button class="internal-about-top-button" type="button" data-internal-scroll-top aria-label="Nach oben">&uarr;</button>
  </article>`;
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function shuffledItems(items = []) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function rubricRotator(items, renderItem, emptyHtml = "") {
  const slides = items.length ? items : [null];
  return `<div class="internal-rubric-rotator" data-rubric-rotator>${slides.map((item, index) => `<div class="internal-rubric-slide${index === 0 ? " is-active" : ""}" data-rubric-slide>${item ? renderItem(item) : emptyHtml}</div>`).join("")}</div>`;
}

function aboutStickyContent(events = [], board = [], members = [], topics = []) {
  const upcomingEvents = events.filter(upcomingEventIsVisible).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const eventSlides = upcomingEvents.length ? upcomingEvents.slice(0, 5) : events.slice(0, 5);
  const topicSlides = topics.filter((topic) => topicIsReleasedAfterEvent(topic, events)).slice(0, 6);
  const boardSlides = chunkItems(board.slice(0, 8), 2);
  const memberSlides = chunkItems(members.filter((member) => member.featured || member.logoUrl).slice(0, 15), 3);
  const renderEvent = (event) => `<a class="internal-sticky-event internal-sticky-event--text" href="#/event/${event.id}">
    <span><strong>${escapeHtml(event.title || "Event")}</strong><small>${formatDate(event.date)}${event.city ? ` · ${escapeHtml(event.city)}` : ""}</small></span>
  </a>`;
  const renderTopic = (topic) => `<a class="internal-sticky-topic" href="#/topic/${topic.id}">
    <span class="internal-sticky-event__picto">${aboutPicto("dialog")}</span>
    <span><strong>${escapeHtml(topic.title || "Thema")}</strong><small>${escapeHtml(topic.subtitle || topic.shortDescription || "Aktuelle Themen im Netzwerk")}</small></span>
  </a>`;
  const renderBoardPair = (pair) => `<div class="internal-about-sticky__grid">${pair.map((person) => `<a class="internal-sticky-person" href="#/board">
    <span class="internal-sticky-person__photo">${boardPortrait(person)}</span>
    <span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role || person.company || "")}</small></span>
  </a>`).join("")}</div>`;
  const renderMemberGroup = (group) => `<div class="internal-about-sticky__members">${group.map((member) => `<a class="internal-sticky-member" href="#/members">
    <span class="member-tile" aria-label="${escapeHtml(member.name)}">${memberLogo(member)}</span>
  </a>`).join("")}</div>`;
  return `<aside class="internal-about-sticky" aria-label="Aktuelle Inhalte">
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/events">Aktuelles Event <span aria-hidden="true">→</span></a>
      ${rubricRotator(eventSlides, renderEvent, `<a class="internal-sticky-event internal-sticky-event--text" href="#/events"><span><strong>Neue Termine in Vorbereitung</strong><small>Zur Eventübersicht</small></span></a>`)}
    </section>
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/topics">Themen <span aria-hidden="true">→</span></a>
      ${rubricRotator(topicSlides, renderTopic, `<a class="internal-sticky-topic" href="#/topics"><span class="internal-sticky-event__picto">${aboutPicto("dialog")}</span><span><strong>Themen ansehen</strong><small>Aktuelle Themen im Netzwerk</small></span></a>`)}
    </section>
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/board">Vorstand <span aria-hidden="true">→</span></a>
      ${rubricRotator(boardSlides, renderBoardPair, `<a class="internal-sticky-person" href="#/board">Vorstand ansehen</a>`)}
    </section>
    <section class="internal-sticky-section">
      <a class="internal-sticky-section-title" href="#/members">Mitglieder <span aria-hidden="true">→</span></a>
      ${rubricRotator(memberSlides, renderMemberGroup, `<a class="internal-sticky-member" href="#/members">Mitglieder ansehen</a>`)}
    </section>
  </aside>`;
}

function aboutCardGroups(blocks, meta, options = {}) {
  const visibleBlocks = options.all ? blocks : blocks.slice(0, 8);
  const groups = chunkItems(visibleBlocks, 4).filter((group) => group.length);
  return groups.map((group) => `<div class="internal-about-button-block">${group.map((block) => aboutInternalCard(block, meta, options)).join("")}</div>`).join("");
}

function internalDesktopSection(block, meta) {
  const detailHref = `#/${meta.detailRoute}/${encodeURIComponent(block.slug)}`;
  const cta = block.button_text ? `<a class="button button--primary button--small" href="${escapeHtml(block.button_ziel || detailHref)}">${escapeHtml(block.button_text)}</a>` : `<a class="link" href="${detailHref}">Mehr lesen →</a>`;
  return `<article class="internal-section internal-section--${escapeHtml(block.typ)}">
    <div class="internal-section__head">${internalIcon(block.icon)}<div><p class="eyebrow">${escapeHtml(block.typ)}</p><h2>${escapeHtml(block.titel)}</h2><p>${escapeHtml(block.kurztext)}</p></div></div>
    <div class="editorial-text internal-section__body">${articleParagraphs(block.langtext)}</div>
    ${cta}
  </article>`;
}

function internalOverviewPage(bereich) {
  return async function renderInternalOverview() {
    const meta = internalPageMeta[bereich];
    const leanInternal = mobileLeanStart();
    const cacheName = `internal-${bereich}`;
    const cacheVariant = leanInternal ? "mobile" : "desktop";
    const cachedInternal = readPageContentCache(cacheName, cacheVariant, 600000);
    if (cachedInternal) return publicShell(meta.active, cachedInternal);
    const blocks = await fastFallback(internalBlocks(bereich).catch(() => []), [], leanInternal ? 900 : 1800);
    const hero = blocks.find((block) => block.typ === "hero") || blocks[0];
    const cards = blocks.map((block) => internalCard(block, meta)).join("");
    const aboutCards = aboutCardGroups(blocks, meta);
    const aboutTexts = blocks.map((block) => aboutLongTextSection(block)).join("");
    const desktopSections = blocks.map((block) => internalDesktopSection(block, meta)).join("");
    if (bereich === "ueber_uns") {
      const content = `${subhero(meta.eyebrow, meta.title, meta.intro)}
      <section class="section internal-overview internal-overview--about-simple"><div class="container">
        <div class="join-simple-copy about-strategy-copy">
          <div class="join-simple-intro"><div><p class="join-simple-lead"><strong>PROdigitalTV ist das unabhängige Branchennetzwerk für Menschen und Unternehmen, die digitale Medien aktiv gestalten.</strong> Wir verbinden Erfahrung mit neuen Perspektiven und schaffen einen persönlichen Ort für Austausch, Orientierung und Zusammenarbeit.</p><p>Unsere Mitglieder kommen aus TV, Streaming, Plattformen, Produktion, Distribution, Technologie, Start-ups und Medienservices. Gemeinsam greifen wir Veränderungen früh auf und machen sie für die Praxis nutzbar.</p></div><aside><strong>PROdigitalTV auf einen Blick</strong><p><b>Mehr als 60 Veranstaltungen</b> zu zentralen Entwicklungen der Medienwirtschaft.</p><p><b>Persönlicher B2B-Austausch</b> im deutschsprachigen Raum.</p><p><b>Unabhängig und praxisnah</b> mit direktem Zugang zu Expertise.</p></aside></div>
          <ul class="join-benefit-list about-principle-list">
            <li><span>01</span><div><strong>Netzwerk</strong><p>Wir bringen etablierte Marktteilnehmer, innovative Unternehmen, Entscheider und Fachleute in einem vertrauensvollen Rahmen zusammen.</p></div></li>
            <li><span>02</span><div><strong>Dialog</strong><p>Persönliche Gespräche und unterschiedliche Perspektiven stehen im Mittelpunkt, weil tragfähige Beziehungen nicht allein digital entstehen.</p></div></li>
            <li><span>03</span><div><strong>Wissen</strong><p>Wir ordnen Entwicklungen rund um Streaming, KI, Content, Plattformen, Vermarktung, Medienrecht und neue Geschäftsmodelle ein.</p></div></li>
            <li><span>04</span><div><strong>Formate</strong><p>Medienfrühstücke, Fachgespräche und „Von den Besten lernen“ verbinden kompakte Impulse mit Begegnung und offenem Austausch.</p></div></li>
            <li><span>05</span><div><strong>Sichtbarkeit</strong><p>Wir machen Expertise, Projekte und Perspektiven unserer Mitglieder innerhalb der digitalen Medienwirtschaft sichtbar.</p></div></li>
            <li><span>06</span><div><strong>Zukunft</strong><p>Als generationsübergreifende Medien- und Technologie-Community gestalten wir Wandel gemeinsam, offen und praxisorientiert.</p></div></li>
          </ul>
          <div class="join-simple-action about-simple-action"><p>Menschen, Themen und Veranstaltungen machen das Netzwerk erlebbar.</p><div class="actions"><a class="button button--secondary" href="#/board">Vorstand</a><a class="button button--secondary" href="#/members">Mitglieder</a><a class="button button--primary" href="#/join">Mitglied werden</a></div></div>
        </div>
      </div></section>`;
      writePageContentCache(cacheName, cacheVariant, content);
      return publicShell(meta.active, content);
    }
    const content = `${subhero(meta.eyebrow, hero?.titel || meta.title, hero?.kurztext || meta.intro)}
      <section class="section internal-overview"><div class="container">
        <div class="internal-mobile-list">${cards || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
        <div class="internal-desktop-sections">${desktopSections || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
      </div></section>`;
    writePageContentCache(cacheName, cacheVariant, content);
    return publicShell(meta.active, content);
  };
}

export async function internalDetailPage(bereich, slug) {
  const meta = internalPageMeta[bereich];
  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug || "");
    } catch {
      return slug || "";
    }
  })();
  const blocks = await internalBlocks(bereich);
  const block = blocks.find((item) => item.slug === decodedSlug || encodeURIComponent(item.slug) === slug);
  if (!block) return notFoundPage();
  const cta = block.button_text ? `<div class="actions" style="margin-top:24px"><a class="button button--primary" href="${escapeHtml(block.button_ziel || `#/${meta.route}`)}">${escapeHtml(block.button_text)}</a></div>` : "";
  return publicShell(meta.active, `${subhero(meta.eyebrow, block.titel, block.kurztext)}
    <section class="section"><div class="container internal-detail"><a class="link" href="#/${meta.route}">← Zurueck</a><article class="detail-main"><div class="editorial-text">${articleParagraphs(block.langtext)}</div>${aiDisclosureNote(block)}${cta}</article></div></section>`);
}

function articleSourcesList(item = {}) {
  const sources = articleSources(item).slice(0, 8);
  if (!sources.length) return "";
  return `<details class="sources-list" open><summary>Quellen anzeigen</summary><ul>${sources.map((source) => `<li><a class="link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher || source.name || "Quelle")}: ${escapeHtml(source.title || source.relevance_note || source.url)}</a></li>`).join("")}</ul></details>`;
}

function articleSources(item = {}) {
  const rawSources = Array.isArray(item.sources)
    ? item.sources
    : Array.isArray(item.source_snapshot_json)
      ? item.source_snapshot_json
      : Array.isArray(item.sourceSnapshotJson)
        ? item.sourceSnapshotJson
        : [];
  const sources = rawSources.filter((source) => source?.url && (source.title || source.publisher || source.name));
  const fallbackUrl = item.original_url || item.originalUrl || item.source_url || item.sourceUrl || item.url || "";
  const fallbackName = item.source || item.publisher || item.sourceName || "";
  if (!sources.length && fallbackUrl) {
    sources.push({
      title: item.sourceTitle || item.title || "",
      publisher: fallbackName || "Quelle",
      url: fallbackUrl
    });
  }
  return sources;
}

function newsDetailSources(item = {}) {
  const sources = articleSources(item).slice(0, 4);
  if (!sources.length) return "";
  return `<div class="news-detail-source"><p class="eyebrow">Quelle${sources.length > 1 ? "n" : ""}</p>${sources.map((source) => `<a class="link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher || source.name || "Quelle")}${source.title ? `: ${escapeHtml(source.title)}` : ""}</a>`).join("")}</div>`;
}

function articleKeywords(item = {}) {
  const keywords = [];
  const add = (value) => {
    const keyword = typeof value === "string" ? value : value?.keyword || value?.name || "";
    const clean = String(keyword || "").trim();
    if (!clean) return;
    if (keywords.some((entry) => entry.toLowerCase() === clean.toLowerCase())) return;
    keywords.push(clean);
  };
  if (Array.isArray(item.tags)) item.tags.forEach(add);
  else String(item.tags || "").split(/[,;]+/).forEach(add);
  if (Array.isArray(item.keyword_json)) item.keyword_json.forEach(add);
  if (Array.isArray(item.keywords)) item.keywords.forEach(add);
  String(item.seoKeywords || item.seo_keywords || "").split(/[,;]+/).forEach(add);
  add(item.primary_keyword || item.primaryKeyword || "");
  return keywords.slice(0, 12);
}

function newsDetailKeywords(item = {}) {
  const keywords = articleKeywords(item);
  if (!keywords.length) return "";
  return `<div class="news-detail-keywords"><p class="eyebrow">Keywords</p><div>${keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join("")}</div></div>`;
}

function cleanNewsDetailTitle(item = {}) {
  let title = String(item.title || item.headline || "").trim();
  const slug = String(item.slug || item.key || item.id || "").trim();
  if (slug && title.endsWith(slug)) title = title.slice(0, -slug.length).trim();
  for (let length = Math.floor(title.length / 2); length > 12; length -= 1) {
    const left = title.slice(0, length).trim();
    const right = title.slice(length, length * 2).trim();
    if (left && left === right) {
      title = left;
      break;
    }
  }
  return title || String(item.title || item.headline || "").trim();
}

function cleanNewsDetailText(text = "", title = "", subtitle = "", slug = "") {
  let value = String(text || "").trim();
  value = value.replace(/(?:^|\n{2,})(?:keywords?|tags?|schlagworte?|seo|thumbnail(?:-idee|-prompt)?|quellen?)\s*[:\n][\s\S]*$/i, "").trim();
  [slug, title, subtitle].filter(Boolean).forEach((part) => {
    const escaped = String(part).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`^\\s*${escaped}\\s*`, "i"), "").trim();
  });
  const blocks = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const first = blocks[0] || "";
  const titleKey = String(title || "").toLowerCase().replace(/[^a-z0-9äöüß]+/gi, " ").trim();
  const firstKey = first.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, " ").trim();
  const titleLead = titleKey.split(/\s+/).slice(0, 3).join(" ");
  if (blocks.length > 1 && first.length < 150 && titleLead && firstKey.startsWith(titleLead)) {
    value = blocks.slice(1).join("\n\n");
  }
  return value;
}

function publicNewsItems(items = []) {
  const filtered = items.filter((item) => {
    const isNews = item.page === "news" || item.section === "news";
    const isPublishedPublic = item.status === "published" && item.visibility === "public";
    const isVisibleNews = item.visible === true || (isPublishedPublic && item.visible !== false);
    const isHidden = item.status === "archived" || item.visibility === "internal";
    const pressMarker = [
      item.page,
      item.section,
      item.publication_target,
      item.publicationTarget,
      item.category,
      item.type,
      item.contentType,
      item.origin,
      item.workflow
    ].filter(Boolean).join(" ").toLowerCase();
    const isPress = item.imported_press_release_id
      || item.importedPressReleaseId
      || item.ai_log_json?.import_flow === "german_press_release_import"
      || /(^|\s)(press|presse|presseimport|pressemitteilung|pressemeldung|pressrelease|press-release)(\s|$)/.test(pressMarker)
      || ["pressRelease", "press"].includes(item.section)
      || item.page === "press";
    return isNews && isVisibleNews && !isHidden && !isPress;
  });
  return dedupeNewsItems(filtered);
}

function newsThumbUrl(item = {}) {
  return item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || item.asset_url || "";
}

function newsIdentity(item = {}) {
  const value = item.title || item.headline || item.slug || item.key || item.id || "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, "");
}

function newsDateValue(item = {}) {
  return String(item.publishDate || item.validFrom || item.updatedAt || item.createdAt || "");
}

function newestContentValue(item = {}) {
  const value = item.publishDate || item.validFrom || item.date || item.updatedAt || item.updated_at || item.createdAt || item.created_at || "";
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (value && typeof value === "object" && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
  if (value && typeof value === "object" && Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
  return String(value || "");
}

function newestContentFirst(a = {}, b = {}) {
  const dateCompare = newestContentValue(b).localeCompare(newestContentValue(a));
  if (dateCompare) return dateCompare;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

function normalizeTopicType(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

function dedupeNewsItems(items = []) {
  const byKey = new Map();
  items
    .slice()
    .sort((a, b) => newsDateValue(b).localeCompare(newsDateValue(a)))
    .forEach((item) => {
      const key = newsIdentity(item);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        return;
      }
      const existingThumb = newsThumbUrl(existing);
      const itemThumb = newsThumbUrl(item);
      if (!existingThumb && itemThumb) byKey.set(key, item);
    });
  return Array.from(byKey.values());
}

function isRetrospectiveArticle(item = {}) {
  const category = String(item.category || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const inPress = item.page === "press" || item.section === "pressRelease";
  const isRetrospective = item.isRetrospective
    || category.includes("ruckblick")
    || category.includes("rueckblick")
    || category.includes("retrospective")
    || category.includes("nachlauf");
  const isHidden = item.status === "archived" || item.status === "draft" || item.visibility === "internal";
  return inPress && isRetrospective && !isHidden;
}

function retrospectiveArticleIsVisible(item = {}, events = []) {
  if (!isRetrospectiveArticle(item)) return false;
  const linkedEvent = retrospectiveLinkedEvent(item, events);
  return Boolean(linkedEvent && eventHasEnded(linkedEvent));
}

function isAiGeneratedArticle(item = {}) {
  return item.author_type === "ai" || item.authorType === "ai" || item.aiGenerated === true;
}

function editorialPrioritySort(a = {}, b = {}) {
  return newestContentFirst(a, b);
}

function isAudioAvailableStatus(status = "") {
  return ["aktuell", "ready", "available", "fertig"].includes(String(status || "").toLowerCase());
}

function availableAudioUrl(url = "", status = "", fallbackStatus = "") {
  if (!url) return "";
  const effectiveStatus = status || fallbackStatus;
  return isAudioAvailableStatus(effectiveStatus) ? url : "";
}

function countTextWords(value = "") {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function isElevenLabsAudioUrl(url = "") {
  return /(?:elevenlabs|elevenlabs-v)/i.test(String(url || ""));
}

function isElevenLabsAudio({ audio = {}, audioProvider = "", audioUrl = "", audioAccessibleUrl = "", audioNaturalUrl = "" }) {
  return String(audio.provider || audioProvider || "").toLowerCase() === "elevenlabs"
    || isElevenLabsAudioUrl(audio.audioUrl || audioUrl || audioAccessibleUrl || audioNaturalUrl);
}

function cleanTtsReaderText(value = "") {
  return String(value || "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/(?:^|\s)(keywords?|schlagworte|quelle|quellen)\s*:.*/is, "")
    .trim();
}

function ttsReader({ rubric = "Audio", title = "", label = title || "Vorlesen", text = "", inlineOffsetText = "", includeTitleInText = true, audio = {}, audioProvider = "", audioUrl = "", audioAccessibleUrl = "", audioNaturalUrl = "", timingUrl = "", audioStatus = "", audioAccessibleStatus = "", audioNaturalStatus = "" }) {
  const readerText = [includeTitleInText ? cleanTtsReaderText(title) : "", cleanTtsReaderText(text)].filter(Boolean).join("\n\n");
  const serviceStatus = audio.status || audioStatus;
  const serviceUrl = isElevenLabsAudio({ audio, audioProvider, audioUrl, audioAccessibleUrl, audioNaturalUrl })
    ? availableAudioUrl(audio.audioUrl || audioAccessibleUrl || audioUrl, serviceStatus, audioStatus)
    : "";
  const serviceTimingUrl = serviceUrl ? (audio.timingUrl || timingUrl || "") : "";
  const fallbackUrl = serviceUrl || (isElevenLabsAudio({ audioProvider, audioUrl })
    ? availableAudioUrl(audioUrl, audioStatus)
    : "");
  const accessibleUrl = serviceUrl || (isElevenLabsAudio({ audioProvider, audioUrl: audioAccessibleUrl })
    ? availableAudioUrl(audioAccessibleUrl, audioAccessibleStatus, audioStatus)
    : "") || fallbackUrl;
  const naturalUrl = serviceUrl || (isElevenLabsAudio({ audioProvider, audioUrl: audioNaturalUrl })
    ? availableAudioUrl(audioNaturalUrl, audioNaturalStatus, audioStatus)
    : "") || accessibleUrl;
  if (!accessibleUrl && !naturalUrl) return "";
  return `<div class="tts-reader" data-tts-reader data-timing-url="${escapeHtml(serviceTimingUrl)}" data-tts-inline-offset="${countTextWords(inlineOffsetText)}">
    <div class="tts-reader__meta"><p class="eyebrow">${escapeHtml(rubric || "Audio")}</p><strong>${escapeHtml(label || "Vorlesen")}</strong></div>
    <template data-tts-source>${escapeHtml(readerText)}</template>
    <div class="tts-reader__actions" data-tts-actions>
      <button type="button" class="button button--primary button--small tts-reader__play" data-tts-play data-tts-mode="natural" data-audio-url="${escapeHtml(naturalUrl)}" aria-pressed="false" aria-label="Audio abspielen oder pausieren" ${naturalUrl ? "" : "disabled"}><span class="tts-control-icon tts-control-icon--play" aria-hidden="true"></span></button>
      <button type="button" class="button button--secondary button--small tts-reader__large-text" data-tts-play data-tts-mode="accessible" data-audio-url="${escapeHtml(accessibleUrl)}" data-timing-url="${escapeHtml(serviceTimingUrl)}" aria-pressed="false" aria-label="Text synchron mitlesen" title="Text synchron mitlesen" ${accessibleUrl ? "" : "disabled"}><span class="tts-control-icon tts-control-icon--search" aria-hidden="true"></span><b class="tts-reader__text-label">Mitlesen</b></button>
    </div>
  </div>`;
}
function galleryPlayCta(gallery, images) {
  if (!gallery || !images.length) return "";
  const payload = escapeHtml(JSON.stringify({
    title: gallery.title || "Bildergalerie",
    images: images.map((image) => ({
      url: image.url,
      caption: image.caption || image.title || "",
      altText: image.altText || image.caption || gallery.title || "Galeriebild"
    }))
  }));
  return `<section class="article-gallery-cta"><div><p class="eyebrow">Bildergalerie</p><h3>${escapeHtml(gallery.title || "Bilder ansehen")}</h3><p>${images.length} Bilder als Slideshow ansehen.</p></div><button class="button button--primary gallery-play-cta__button" type="button" data-gallery-play data-gallery-payload="${payload}"><span aria-hidden="true"></span> Galerie abspielen</button></section>`;
}

function youtubeVideoIdFromValue(value = "") {
  const text = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  const match = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/i)
    || text.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
  return match?.[1] || "";
}

function articleVideoAttachments(item = {}) {
  const videos = Array.isArray(item.videoAttachments)
    ? item.videoAttachments
    : Array.isArray(item.videos)
      ? item.videos
      : [];
  return videos
    .map((video, index) => ({
      ...video,
      id: video.id || `video-${index + 1}`,
      youtubeVideoId: youtubeVideoIdFromValue(video.youtubeVideoId || video.youtube_video_id || video.videoId || video.youtubeId || video.youtubeVideoIa || video.youtubeUrl || video.url || video.embedUrl || ""),
      posterImageUrl: video.posterImageUrl || video.thumbnailUrl || video.youtubeThumbnailUrl || "",
      title: video.title || video.caption || "",
      visibility: video.visibility || "public",
      status: video.status || "ready",
      sortOrder: Number(video.sortOrder ?? index + 1)
    }))
    .filter((video) => video && video.youtubeVideoId && !["hidden", "error", "deleted"].includes(video.status || "ready"))
    .filter((video) => ["public", "members", ""].includes(video.visibility || ""))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function articlePdfAssets(item = {}) {
  const candidates = [
    ...(Array.isArray(item.pdfAttachments) ? item.pdfAttachments : []),
    ...(Array.isArray(item.documentAttachments) ? item.documentAttachments : []),
    ...(Array.isArray(item.attachments) ? item.attachments : []),
    ...(Array.isArray(item.assets) ? item.assets : [])
  ];
  if (item.documentUrl || item.document_url || item.aocumentUrl || item.aocument_url) {
    candidates.push({
      url: item.documentUrl || item.document_url || item.aocumentUrl || item.aocument_url,
      title: item.documentTitle || item.documentFileName || item.aocumentFileName || item.assetFileName || item.fileName || "PDF-Anhang",
      fileName: item.documentFileName || item.aocumentFileName || item.assetFileName || item.fileName || "PDF-Anhang"
    });
  }
  return candidates
    .map((asset) => ({
      url: asset.url || asset.fileUrl || asset.assetUrl || asset.downloadUrl || asset.documentUrl || "",
      title: asset.title || asset.fileName || asset.name || "PDF-Anhang",
      type: String(asset.type || asset.fileType || asset.mimeType || asset.mediaType || "").toLowerCase()
    }))
    .filter((asset) => asset.url && (asset.type.includes("pdf") || /\.pdf(\?|#|$)/i.test(asset.url) || /\.pdf$/i.test(asset.title)));
}

function articlePdfBlock(item = {}) {
  const pdfs = articlePdfAssets(item);
  if (!pdfs.length) return "";
  return `<section class="member-article-assets"><div><p class="eyebrow">PDF</p><h2>Anhang</h2></div><div class="member-article-assets__list">${pdfs.map((pdf) => `<button class="button button--secondary button--small" type="button" data-pdf-overlay data-pdf-url="${escapeHtml(pdf.url)}" data-pdf-title="${escapeHtml(pdf.title)}">${escapeHtml(pdf.title || "PDF öffnen")}</button>`).join("")}</div></section>`;
}

function articleGallery(item = {}, galleries = []) {
  const galleryIds = [item.galleryId, item.gallery_id, item.galleryIa, item.linkedGalleryId, item.linkeaGalleryIa, item.gallery].filter(Boolean);
  if (!galleryIds.length) return null;
  return galleries.find((gallery) => galleryIds.includes(gallery.id) || galleryIds.includes(gallery.ia) || galleryIds.includes(gallery.slug) || galleryIds.includes(gallery.key)) || null;
}

function visibleGalleryImages(gallery = {}) {
  return (Array.isArray(gallery.images) ? gallery.images : [])
    .filter((image) => image.url || image.imageUrl || image.assetUrl || image.downloadUrl)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((image) => ({ ...image, url: image.url || image.imageUrl || image.assetUrl || image.downloadUrl }));
}

function articleHasAudio(item = {}) {
  return Boolean(item.audioUrl || item.auaioUrl || item.audioAccessibleUrl || item.audioNaturalUrl || item.audio?.audioUrl);
}

function memberArticleAssetBar(item = {}, galleries = [], options = {}) {
  const videos = articleVideoAttachments(item);
  const gallery = articleGallery(item, galleries);
  const galleryImages = visibleGalleryImages(gallery || {});
  const pdfs = articlePdfAssets(item);
  const parts = [];
  if (videos.length) {
    parts.push(options.href
      ? `<a class="member-asset-pill member-asset-pill--video" href="${escapeHtml(options.href)}">Video</a>`
      : `<span class="member-asset-pill member-asset-pill--video">Video</span>`);
  }
  if (galleryImages.length) {
    const payload = escapeHtml(JSON.stringify({
      title: gallery.title || "Bildergalerie",
      images: galleryImages.map((image) => ({
        url: image.url,
        caption: image.caption || image.title || "",
        altText: image.altText || image.caption || gallery.title || "Galeriebild"
      }))
    }));
    parts.push(`<button class="member-asset-pill member-asset-pill--gallery" type="button" data-gallery-play data-gallery-payload="${payload}">Galerie</button>`);
  }
  if (pdfs.length) parts.push(`<button class="member-asset-pill member-asset-pill--pdf" type="button" data-pdf-overlay data-pdf-url="${escapeHtml(pdfs[0].url)}" data-pdf-title="${escapeHtml(pdfs[0].title)}">PDF</button>`);
  if (articleHasAudio(item)) parts.push(`<span class="member-asset-pill member-asset-pill--audio">Audio</span>`);
  return parts.length ? `<div class="member-asset-bar" aria-label="Anh&auml;nge">${parts.join("")}</div>` : "";
}

function youtubeEmbedSrc(videoId = "") {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? `&origin=${encodeURIComponent(window.location.origin)}`
    : "";
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&rel=0&fs=1&playsinline=0${origin}`;
}

function articleVideoFrame(video = {}, title = "Video") {
  return `<iframe data-youtube-src="${escapeHtml(youtubeEmbedSrc(video.youtubeVideoId))}" title="${escapeHtml(title)}" loading="eager" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen tabindex="-1"></iframe>`;
}

function articleVideosBlock(item = {}) {
  const videos = articleVideoAttachments(item);
  if (!videos.length) return "";
  return `<section class="article-videos" aria-label="Videoanhaenge">${videos.map((video) => {
    const poster = video.posterImageUrl || video.youtubeThumbnailUrl || `https://img.youtube.com/vi/${escapeHtml(video.youtubeVideoId)}/hqdefault.jpg`;
    const title = video.title || video.caption || "Video abspielen";
    return `<article class="article-video-card">
      <div class="article-video-poster" data-youtube-video="${escapeHtml(video.youtubeVideoId)}" data-youtube-title="${escapeHtml(title)}" role="button" tabindex="0" aria-label="${escapeHtml(`${title} abspielen`)}">
        <img src="${escapeHtml(stableImageUrl(poster, "video"))}" alt="${escapeHtml(video.posterImageAlt || title)}" loading="lazy" decoding="async" ${liveImageAttrs("video")}>
        ${articleVideoFrame(video, title)}
        <span class="article-video-play" aria-hidden="true"></span>
        <small>Mit Klick wird das Video gestartet.</small>
      </div>
      ${video.title ? `<h3>${escapeHtml(video.title)}</h3>` : ""}
      ${video.caption ? `<p class="article-video-caption">${escapeHtml(video.caption)}</p>` : ""}
    </article>`;
  }).join("")}</section>`;
}

function articleVideoHero(item = {}) {
  const [video] = articleVideoAttachments(item);
  if (!video) return "";
  const poster = video.posterImageUrl || video.youtubeThumbnailUrl || `https://img.youtube.com/vi/${escapeHtml(video.youtubeVideoId)}/hqdefault.jpg`;
  const title = video.title || video.caption || item.title || "Video abspielen";
  return `<div class="article-video-poster member-article-card__hero" data-youtube-video="${escapeHtml(video.youtubeVideoId)}" data-youtube-title="${escapeHtml(title)}" role="button" tabindex="0" aria-label="${escapeHtml(`${title} abspielen`)}">
    <img src="${escapeHtml(stableImageUrl(poster, "video"))}" alt="${escapeHtml(video.posterImageAlt || title)}" loading="lazy" decoding="async" ${liveImageAttrs("video")}>
    ${articleVideoFrame(video, title)}
    <span class="article-video-play" aria-hidden="true"></span>
    <small>Mit Klick wird das Video gestartet.</small>
  </div>`;
}

function memberArticleImageUrl(item = {}) {
  return item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || item.asset_url || "";
}

function memberArticleImageHero(item = {}, loading = "lazy") {
  const imageUrl = stableImageUrl(memberArticleImageUrl(item), "memberArea");
  const alt = item.thumbnail_alt || item.thumbnailAlt || item.imageAlt || item.title || "Artikelbild";
  return `<figure class="member-article-card__hero member-article-card__image">
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" loading="${escapeHtml(loading)}" decoding="async" ${liveImageAttrs("memberArea")}>
  </figure>`;
}

function memberArticleHero(item = {}, loading = "lazy") {
  return articleVideoHero(item) || memberArticleImageHero(item, loading);
}

function memberArticleCard(item = {}, galleries = []) {
  const date = item.publishDate || item.validFrom || item.date || "";
  const text = richTextPlainText(item.articleText || item.bodyText || item.longDescription || item.introText || "");
  const href = `#/portal/article/${encodeURIComponent(item.slug || item.id || item.key || "")}`;
  return `<article class="card card__body member-article-card">
    ${memberArticleImageHero(item)}
    <p class="eyebrow">${escapeHtml(item.category || "Mitgliederbeitrag")}${date ? ` / ${formatDate(date)}` : ""}</p>
    <h3>${escapeHtml(item.title || "Redaktioneller Beitrag")}</h3>
    ${item.subtitle ? `<p class="article-subline">${escapeHtml(item.subtitle)}</p>` : ""}
    <p class="member-article-card__text">${escapeHtml(teaserText(text, 260))}</p>
    ${memberArticleAssetBar(item, galleries, { href })}
    <a class="button button--secondary button--small" href="${href}">Beitrag öffnen</a>
  </article>`;
}

function memberArticleEventIds(item = {}) {
  return [
    item.linkedEventId,
    item.linked_event_id,
    item.eventId,
    item.event_id,
    item.galleryEventId,
    item.gallery_event_id
  ].filter(Boolean);
}

function memberArticleIsCommunication(item = {}) {
  return item.section === "member-communication"
    || item.publication_target === "member-communication"
    || item.publicationTarget === "member-communication"
    || item.communicationType === "member-news"
    || item.contentType === "member-news";
}

function memberArticleIsInPublicationWindow(item = {}, now = new Date()) {
  const nowTime = now.getTime();
  const validFrom = eventDateMillis(item.validFrom || item.publishDate || item.date || "");
  if (Number.isFinite(validFrom) && validFrom > nowTime) return false;
  const validToValue = item.validTo || item.expiresAt || item.expireAt || item.until || "";
  if (!validToValue) return true;
  const validTo = eventDateMillis(String(validToValue).length <= 10 ? `${validToValue}T23:59:59` : validToValue);
  return !Number.isFinite(validTo) || validTo >= nowTime;
}

function memberArticleLinkedEventHasEnded(item = {}, events = []) {
  const ids = new Set(memberArticleEventIds(item));
  if (!ids.size) return false;
  const linkedEvent = events.find((event) => event?.id && ids.has(event.id));
  if (!linkedEvent) return false;
  return eventHasEnded(linkedEvent) || normalizeLifecyclePhase(linkedEvent.lifecyclePhase || linkedEvent.lifecycle_phase || linkedEvent.phase || "") === "archived";
}

function memberArticleIsVisibleNow(item = {}, events = []) {
  const status = String(item.status || "published").toLowerCase();
  if (["archived", "deleted", "hidden", "draft", "inactive"].includes(status) || item.visible === false) return false;
  if (!memberArticleIsInPublicationWindow(item)) return false;
  if (memberArticleIsCommunication(item) && memberArticleLinkedEventHasEnded(item, events)) return false;
  return true;
}

function teaserText(value = "", length = 118) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
}

function downloadUrl(item = {}, fallback = "") {
  return item.documentUrl || item.assetUrl || item.fileUrl || fallback;
}

function downloadCard(item) {
  const url = downloadUrl(item);
  const active = Boolean(url);
  const tag = active ? "a" : "article";
  const attributes = active
    ? ` href="${escapeHtml(url)}" download="${escapeHtml(item.fileName || "")}"`
    : ` aria-disabled="true"`;
  return `<${tag} class="quick-card download-card${active ? "" : " download-card--disabled"}"${attributes}>
    <p class="eyebrow">${escapeHtml(item.category || "Download")}</p>
    <h3>${escapeHtml(item.title || item.fileName || "Download")}</h3>
    <p>${escapeHtml(item.description || item.bodyText || item.fileName || "PDF wird öffentlich bereitgestellt.")}</p>
    <span class="download-card__action">${active ? "PDF herunterladen" : "Datei noch nicht hinterlegt"}</span>
  </${tag}>`;
}

function eventExpires(event) {
  if (!event.expiresAt) return false;
  return new Date(event.expiresAt).getTime() <= Date.now();
}

function isPastEvent(event) {
  const today = new Date().toISOString().slice(0, 10);
  if (event.date && event.date >= today) return false;
  return event.lifecyclePhase === "archive_published" || event.lifecyclePhase === "post_processing" || eventExpires(event) || (event.date && event.date < today);
}

function upcomingEventIsVisible(event = {}) {
  if (isPastEvent(event)) return false;
  const status = String(event.status || "").toLowerCase();
  if (["archived", "archive", "deleted", "cancelled", "canceled", "draft"].includes(status)) return false;
  if (["inactive", "inaktiv"].includes(status) && event.preStatus !== "save_the_date") return false;
  if (event.visible === false || event.isLive === false) return false;
  return true;
}

function publicEventAllowsTopicRelease(event = {}) {
  const status = String(event.status || "published").toLowerCase();
  const visibility = String(event.visibility || event.sichtbarkeit || "public").toLowerCase();
  return !["deleted", "cancelled", "canceled", "draft", "inactive", "inaktiv"].includes(status)
    && !["internal", "private", "hidden"].includes(visibility)
    && event.visible !== false
    && event.isLive !== false;
}

function eventDateMillis(value) {
  if (!value) return NaN;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "object" && Number.isFinite(value.seconds)) return value.seconds * 1000;
  if (typeof value === "object" && Number.isFinite(value._seconds)) return value._seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function eventStartMillis(event = {}) {
  const direct = eventDateMillis(event.startAt || event.startsAt || event.startDateTime || event.beginAt);
  if (Number.isFinite(direct)) return direct;
  const date = String(event.date || event.startDate || event.eventDate || event.datum || "").slice(0, 10);
  if (!date) return NaN;
  const startTime = String(event.startTime || event.start_time || event.time || "00:00").trim();
  const time = /^\d{1,2}:\d{2}/.test(startTime) ? startTime.slice(0, 5) : "00:00";
  const parsed = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(parsed) ? parsed : eventDateMillis(date);
}

function compareEventsByDateAsc(a = {}, b = {}) {
  const left = eventStartMillis(a);
  const right = eventStartMillis(b);
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
  if (Number.isFinite(left) !== Number.isFinite(right)) return Number.isFinite(left) ? -1 : 1;
  return String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" });
}

function compareEventsByDateDesc(a = {}, b = {}) {
  return compareEventsByDateAsc(b, a);
}

function eventEndMillis(event = {}) {
  const direct = eventDateMillis(event.endDate || event.endsAt || event.endAt || event.end_date || event.endedAt);
  if (Number.isFinite(direct)) return direct;
  const date = String(event.date || event.startDate || event.eventDate || event.datum || "").slice(0, 10);
  if (!date) return NaN;
  const endTime = String(event.endTime || event.end_time || event.startTime || event.time || "23:59").trim();
  const time = /^\d{1,2}:\d{2}/.test(endTime) ? endTime.slice(0, 5) : "23:59";
  const parsed = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(parsed) ? parsed : eventDateMillis(date);
}

function eventHasEnded(event = {}) {
  if (isPastEvent(event)) return true;
  const endMillis = eventEndMillis(event);
  return Number.isFinite(endMillis) && endMillis <= Date.now();
}

function topicEventIds(topic = {}) {
  return new Set([
    topic.eventId,
    topic.event_id,
    topic.linkedEventId,
    topic.linked_event_id,
    ...(topic.eventIds || []),
    ...(topic.event_ids || [])
  ].filter(Boolean));
}

function topicLinkedEvents(topic = {}, events = []) {
  const ids = topicEventIds(topic);
  return events.filter((event) => {
    if (!event?.id) return false;
    return ids.has(event.id) || (event.topicIds || []).includes(topic.id) || (event.topic_ids || []).includes(topic.id);
  });
}

function topicIsReleasedAfterEvent(topic = {}, events = []) {
  if (!homeVisibleRecord(topic)) return false;
  return topicLinkedEvents(topic, events)
    .some((event) => publicEventAllowsTopicRelease(event) && eventHasEnded(event));
}

function publicReleasedTopics(topics = [], events = []) {
  return topics
    .filter((topic) => topicIsReleasedAfterEvent(topic, events))
    .sort(newestContentFirst);
}

function eventRegistrationIsOpen(event = {}) {
  if (event.preStatus === "save_the_date" || ["inactive", "draft", "archived", "deleted", "hidden"].includes(String(event.status || "").toLowerCase())) return false;
  const registrationState = String(event.registrationStatus || event.registration_state || event.registrationState || "").toLowerCase();
  return Boolean(event.registrationEnabled)
    || (event.accessType === "public" && event.allowPublicRegistration === true)
    || (event.accessType === "members_only" && event.allowMemberRegistration === true)
    || ["open", "offen", "active", "aktiv", "registration_open"].includes(registrationState)
    || event.preStatus === "invitation_published"
    || event.lifecyclePhase === "registration_open";
}

function eventRegistrationStatusLabel(event = {}) {
  if (event.preStatus === "save_the_date") return "Save the Date";
  if (event.accessType === "invitation_only") return "Teilnahme nur auf Einladung";
  if (eventRegistrationIsOpen(event)) return "Anmeldung geoeffnet";
  return "Anmeldung geschlossen";
}

function mobileLeanStart() {
  return Boolean(window.matchMedia?.("(max-width: 760px)").matches);
}

async function legacyHomePage() {
  const [events, rawMembers, editorial] = await Promise.all([
    listPublicEvents(),
    publicManagedMembers(),
    listPublicContent("editorialContent")
  ]);
  const members = rawMembers;
  const upcoming = events.filter(upcomingEventIsVisible).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const next = upcoming.find(eventShowsOnHome);
  const mediaAssets = next ? await listPublicEventMediaAssets([next]) : [];
  const latestNewsItems = publicNewsItems(editorial)
    .sort(newestContentFirst)
    .slice(0, 6);
  const logoMembers = members.filter((member) => member.logoDisplayUrl || member.logoUrl);
  const featuredMembers = shuffledItems(logoMembers.length >= 3 ? logoMembers : members).slice(0, 3);
  const memberCount = "30+";
  const quickCards = [
    ["#/events", "events", "Events", "Medienfrühstücke, Veranstaltungen und Rückblicke", "Alle Events ansehen"],
    ["#/topics", "topics", "Themen", "Aktuelle Entwicklungen, Positionen und Expertise", "Alle Themen ansehen"],
    ["#/members", "members", "Mitglieder", "Unser Netzwerk, Vorteile und Mitglied werden", "Mitglieder entdecken"],
    ["#/about", "about", "Über uns", "Der Verband, Vorstand und Ziele", "Mehr über uns"]
  ];
  const mobileCards = [
    ["#/events", "events", "Events", "Medienfrühstücke, Veranstaltungen und Rückblicke"],
    ["#/topics", "topics", "Themen", "Aktuelle Entwicklungen, Positionen und Expertise"],
    ["#/members", "members", "Mitglieder", "Unser Netzwerk, Vorteile und Mitglied werden"],
    ["#/about", "about", "Über uns", "Der Verband, Vorstand und Ziele"]
  ];
  if (isMember(currentUser())) {
    mobileCards.splice(1, 0, ["#/portal?tab=strategy", "strategy", "Strategie", "Zukunftsstrategie 2027–2030 mitgestalten"]);
  }
  const nextImageUrl = next ? upcomingEventImageUrl(next, mediaAssets, { fallback: false }) : "";
  const nextImageStyle = nextImageUrl ? ` style="--home-event-card-image:url(&quot;${escapeHtml(nextImageUrl)}&quot;)"` : "";
  const mobileNextImageStyle = nextImageUrl ? ` style="--mobile-event-card-image:url(&quot;${escapeHtml(nextImageUrl)}&quot;)"` : "";
  const mobileHome = `<section class="pdtv-mobile-home" aria-label="Mobile Startseite">
    <div class="container">
      <div class="pdtv-mobile-hero">
        <h1>Digitaler Content.<br>Starke Verbindungen.<br>Gemeinsam für die <span>Medienzukunft.</span></h1>
        <p>PROdigitalTV ist das Netzwerk für digitale Medien, Streaming, Smart-TV, Plattformen und regionale Anbieter.</p>
        <article class="pdtv-mobile-next-event ${nextImageUrl ? "pdtv-mobile-next-event--with-image" : ""}"${mobileNextImageStyle}>
          ${nextImageUrl ? `<img class="pdtv-mobile-next-event__image" src="${escapeHtml(nextImageUrl)}" alt="" loading="eager" decoding="async" fetchpriority="high">` : ""}
          <span class="pdtv-mobile-icon" aria-hidden="true">?</span>
          <div>
            <p>Nächstes Medienfrühstück</p>
            ${next ? `<h2>${escapeHtml(formatDate(next.date))}${next.city ? ` · ${escapeHtml(next.city)}` : ""}</h2><span>${escapeHtml(next.subtitle || next.title || "")}</span><div class="pdtv-mobile-next-actions">${eventRegistrationIsOpen(next) ? `<a class="button button--primary button--small" href="#/register/${next.id}">Anmelden</a>` : `<span>Save the Date</span>`}<a href="#/event/${next.id}">Details ansehen →</a></div>` : `<h2>Neue Termine in Vorbereitung</h2><span>Die nächsten Formate werden in Kürze veröffentlicht.</span><div class="pdtv-mobile-next-actions"><a href="#/events">Events ansehen →</a></div>`}
          </div>
        </article>
      </div>
      <nav class="pdtv-mobile-card-grid" aria-label="Hauptbereiche">
        ${mobileCards.map(([href, type, title, text]) => `<a class="pdtv-mobile-card pdtv-mobile-card--${type} ${["events", "about", "strategy"].includes(type) ? "pdtv-mobile-card--dark" : ""}" href="${href}"><span class="pdtv-mobile-card__icon" aria-hidden="true"></span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></a>`).join("")}
      </nav>
    </div>
  </section>`;
  const nextEventCard = next ? `<article class="home-event-card ${nextImageUrl ? "home-event-card--with-image" : ""}"${nextImageStyle}>
    ${nextImageUrl ? `<img class="home-event-card__image" src="${escapeHtml(nextImageUrl)}" alt="" loading="eager" decoding="async" fetchpriority="high">` : ""}
    <div class="home-event-card__icon" aria-hidden="true"><span></span></div>
    <p class="eyebrow">Nächstes Medienfrühstück</p>
    <h2>${escapeHtml(next.title || "Naechste Veranstaltung")}</h2>
    <p class="home-event-card__meta">${escapeHtml(formatDate(next.date))}${next.startTime ? ` · ${escapeHtml(next.startTime)} Uhr` : ""}${next.city ? ` · ${escapeHtml(next.city)}` : ""}</p>
    <p>${escapeHtml(next.subtitle || next.locationName || "Austausch, Orientierung und relevante Branchenkontakte.")}</p>
    <div class="home-event-card__actions">${eventRegistrationIsOpen(next) ? `<a class="button button--primary" href="#/register/${escapeHtml(next.id)}">Anmelden</a>` : `<span>Save the Date</span>`}<a class="home-text-link" href="#/event/${escapeHtml(next.id)}">Details ansehen</a></div>
  </article>` : `<article class="home-event-card">
    <div class="home-event-card__icon" aria-hidden="true"><span></span></div>
    <p class="eyebrow">Nächstes Medienfrühstück</p>
    <h2>Neue Termine in Vorbereitung</h2>
    <p class="home-event-card__meta">PROdigitalTV</p>
    <p>Die nächsten Formate werden in Kürze veröffentlicht.</p>
    <div class="home-event-card__actions"><a class="button button--primary" href="#/events">Events ansehen</a></div>
  </article>`;
  const newsCards = latestNewsItems.map((item) => {
    const thumb = stableImageUrl(newsThumbUrl(item), "news");
    const date = item.publishDate || item.validFrom || item.updatedAt || "";
    return `<a class="home-news-card" href="#/news/${escapeHtml(item.id)}">
      <figure class="home-news-card__thumb"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="lazy" decoding="async" ${liveImageAttrs("news")}></figure>
      <div class="home-news-card__body">
        <div class="home-news-card__meta"><span>${escapeHtml(item.category || "News")}</span>${date ? `<time>${escapeHtml(formatDate(date))}</time>` : ""}</div>
        <h3>${escapeHtml(item.title || "Aktuelles von PROdigitalTV")}</h3>
        <p class="home-news-card__teaser">${escapeHtml(teaserText(item.subtitle || item.shortText || item.teaserText || item.introText || item.bodyText || "Meldungen aus dem Netzwerk.", 260))}</p>
      </div>
    </a>`;
  }).join("");
  return publicShell("home", `
    ${mobileHome}
    <section class="hero home-hero"><div class="container hero__grid home-hero__grid">
      <div class="home-hero__copy"><p class="eyebrow">PROdigitalTV</p><h1>Digitaler Content.<br>Starke Verbindungen.<br>Gemeinsam für die <span>Medienzukunft.</span></h1><p class="lead">PROdigitalTV ist das Netzwerk für digitale Medien, Streaming, Smart-TV, Plattformen und regionale Anbieter.</p>
        <div class="hero__buttons"><a class="button button--primary" href="#/events">Events entdecken</a><a class="button button--secondary" href="#/join">Mitglied werden</a></div>
      </div>
      ${nextEventCard}
    </div></section>
    <section class="section home-quick-section"><div class="container">
      <div class="section-head"><div><p class="eyebrow">Schnellzugriff</p><h2>Direkt ins Netzwerk</h2></div></div>
      <div class="home-quick-grid">
        ${quickCards.map(([href, type, title, text, cta], index) => `<a class="home-quick-card ${index === 0 || index === 3 ? "home-quick-card--dark" : ""}" href="${href}"><span class="home-quick-card__icon home-quick-card__icon--${type}" aria-hidden="true"></span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><strong>${escapeHtml(cta)}</strong></a>`).join("")}
      </div>
      <nav class="mobile-sublinks" aria-label="Weitere Informationen"><a href="#/board">Vorstand</a><a href="#/join">Mitglied werden</a><a href="#/archive">Rückblicke</a></nav>
    </div></section>
    <section class="section section--white home-news-section"><div class="container"><div class="section-head"><div><p class="eyebrow">Aktuelles</p><h2>News aus der Medienwirtschaft</h2></div><a class="link" href="#/news">Alle Nachrichten ansehen</a></div>
      ${latestNewsItems.length ? `<div class="home-news-grid">${newsCards}</div>` : `<div class="alert">Aktuell sind keine News veröffentlicht.</div>`}
    </div></section>
    <section class="section home-info-section"><div class="container"><div class="home-info-grid">
      <article class="home-info-card home-info-card--newsletter"><p class="eyebrow">Newsletter</p><h3>Bleiben Sie auf dem Laufenden</h3><p>Impulse, Termine und Nachrichten aus dem PROdigitalTV-Netzwerk.</p><form class="home-newsletter-form"><input type="email" placeholder="E-Mail-Adresse"><button class="button button--primary" type="submit">Abonnieren</button></form></article>
      <article class="home-info-card"><p class="eyebrow">Event</p><h3>${escapeHtml(next?.title || "Nächstes Medienfrühstück")}</h3><p>${next ? `${escapeHtml(formatDate(next.date))}${next.city ? ` · ${escapeHtml(next.city)}` : ""}` : "Neue Termine in Vorbereitung"}</p><a class="home-text-link" href="${next ? `#/event/${escapeHtml(next.id)}` : "#/events"}">Event ansehen</a></article>
      <article class="home-info-card"><p class="eyebrow">Social</p><h3>Mit uns vernetzen</h3><p>Folgen Sie PROdigitalTV auf den relevanten Branchenkanaelen.</p><div class="home-socials"><a href="#/news">RSS</a><a class="home-socials__linkedin" href="#/about" aria-label="LinkedIn"><span aria-hidden="true">in</span></a><a href="#/events">YouTube</a></div></article>
      <article class="home-info-card home-info-card--stat"><p class="eyebrow">Netzwerk</p><h3>${escapeHtml(memberCount)}</h3><p>Mitglieder und Partner im digitalen Mediennetzwerk.</p></article>
    </div></div></section>
    <section class="section section--white"><div class="container feature home-member-feature"><div><p class="eyebrow">Mitglieder</p><h2>Ein Netzwerk für digitale Medien.</h2><p class="lead">Mitglieder profitieren von Fachimpulsen, Medienfrühstücken und relevanten Branchenkontakten.</p><a class="button button--secondary" href="#/members">Mitglieder entdecken</a></div><div class="member-logos">${featuredMembers.map((member) => `<div class="member-tile">${memberLogo(member)}</div>`).join("")}</div></div></section>
    <section class="section home-final-cta"><div class="container home-final-cta__inner"><div><h2>Gemeinsam für die Medienzukunft.</h2><p>Vernetzen, informieren und die digitale Zukunft gestalten.</p></div><a class="button button--primary" href="#/join">Mitglied werden</a></div></section>
  `);
}

function homeDateValue(item = {}) {
  return String(item.date || item.publishDate || item.validFrom || item.updatedAt || item.createdAt || "");
}

function homeImageUrl(item = {}, type = "news") {
  return stableImageUrl(item.imageDisplayUrl || item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || item.logoUrl || item.photoUrl || "", type);
}

function homeTeaser(item = {}, length = 170) {
  return teaserText(item.subtitle || item.subline || item.shortDescription || item.shortText || item.teaserText || item.introText || item.description || item.bodyText || item.longDescription || "", length);
}

function homeEventTeaser(event = {}, length = 170) {
  return teaserText(eventIntroText(event), length);
}

function homeVisibleRecord(item = {}) {
  const status = String(item.status || "published").toLowerCase();
  const visibility = String(item.visibility || item.sichtbarkeit || "public").toLowerCase();
  return !["draft", "inactive", "archived", "deleted", "hidden"].includes(status)
    && !["internal", "private", "hidden"].includes(visibility)
    && item.visible !== false
    && item.isLive !== false;
}

function explicitOffFlag(value) {
  if (value === false || value === 0) return true;
  if (typeof value !== "string") return false;
  return ["false", "0", "no", "nein", "off", "aus", "inactive", "inaktiv"].includes(value.trim().toLowerCase());
}

function eventShowsOnHome(event = {}) {
  const homeKey = normalizeTopicType(`${event.id || ""} ${event.title || event.titel || ""} ${event.eventType || ""} ${event.series || ""}`);
  if (homeKey.includes("vondenbestenlernen")) return false;
  return ![
    event.showOnHome,
    event.show_on_home,
    event.displayOnHome,
    event.display_on_home,
    event.homePage,
    event.homepage,
    event.startseite,
    event.onHome
  ].some(explicitOffFlag);
}

function homeRetrospectiveItems(events = [], editorial = []) {
  const pastEvents = events
    .filter((event) => isPastEvent(event) && homeVisibleRecord(event) && eventShowsOnHome(event))
    .map((event) => ({ ...event, homeType: "event-retrospective", href: "#/archive", dateKey: homeDateValue(event) }));
  const articles = editorial
    .filter((item) => retrospectiveArticleIsVisible(item, events))
    .map((item) => ({ ...item, homeType: "article-retrospective", href: `#/retrospective/${item.id}`, dateKey: homeDateValue(item) }));
  return [...pastEvents, ...articles].sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));
}

function homeEventSeries(events = []) {
  const series = new Map();
  events.filter(homeVisibleRecord).forEach((event) => {
    const title = String(event.eventSeries || event.seriesTitle || event.series || event.eventType || "").trim();
    if (!title) return;
    const key = title.toLowerCase();
    const existing = series.get(key) || { title, description: "", latestDate: "", eventIds: [] };
    existing.description = existing.description || event.seriesDescription || event.eventSeriesDescription || event.shortDescription || event.subtitle || event.description || "";
    existing.latestDate = [existing.latestDate, event.date || event.updatedAt || ""].sort().pop() || "";
    existing.eventIds = [...new Set([...existing.eventIds, event.id].filter(Boolean))];
    series.set(key, existing);
  });
  return Array.from(series.values()).sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate))).slice(0, 3);
}

function homeFormatSeries(blocks = []) {
  return blocks
    .filter((block) => block.typ === "eventformat")
    .filter((block) => {
      const key = normalizeTopicType(`${block.slug || ""} ${block.titel || ""}`);
      return key.includes("medienfruehstueck") || key.includes("medienfruehstuecke") || key.includes("vondenbestenlernen");
    })
    .sort((a, b) => Number(a.sortierung || 0) - Number(b.sortierung || 0))
    .slice(0, 2);
}

function homeSeriesFallback(series = {}) {
  const key = normalizeTopicType(`${series.slug || ""} ${series.titel || ""}`);
  if (!key.includes("vondenbestenlernen")) return {};
  return {
    imageUrl: "/assets/official/events/von-den-besten-lernen-bg.svg",
    kurztext: "Das Gesprächsformat für exklusiven Erfahrungsaustausch mit prägenden Persönlichkeiten der Medien- und Digitalwirtschaft.",
    langtext: "In persönlicher Atmosphäre sprechen Unternehmer, Führungskräfte und Branchenpersönlichkeiten über Entscheidungen, Wendepunkte und Erfahrungen, aus denen andere lernen können. Das Format schafft Nähe, Orientierung und konkrete Impulse für Mitglieder und ausgewählte Gäste."
  };
}

function homeTalkItems(events = [], topics = [], speakers = []) {
  const topicById = new Map(topics.filter((topic) => topicIsReleasedAfterEvent(topic, events)).map((topic) => [topic.id, topic]));
  const items = [];
  events
    .filter(homeVisibleRecord)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .forEach((event) => {
      (event.topicIds || []).forEach((topicId) => {
        const topic = topicById.get(topicId);
        if (!topic || items.some((item) => item.topic.id === topic.id)) return;
        const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
        const topicSpeaker = speakers.find((speaker) => {
          const topicLinked = topicSpeakerIds.size
            ? topicSpeakerIds.has(speaker.id)
            : speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
          const eventLinked = (speaker.eventIds || []).includes(event.id) || (event.speakerIds || []).includes(speaker.id);
          return homeVisibleRecord(speaker) && topicLinked && eventLinked;
        });
        items.push({ topic, event, speaker: topicSpeaker || null });
      });
    });
  return items.slice(0, 4);
}

function homeSpeakersOnePerTalk(events = [], topics = [], speakers = []) {
  const topicById = new Map(topics.filter((topic) => topicIsReleasedAfterEvent(topic, events)).map((topic) => [topic.id, topic]));
  const speakerById = new Map(speakers.filter(homeVisibleRecord).map((speaker) => [speaker.id, speaker]));
  const selected = [];
  const usedSpeakerIds = new Set();
  const addSpeaker = (speaker, topicKey = "") => {
    if (!speaker?.id || usedSpeakerIds.has(speaker.id)) return;
    selected.push({ speaker, topicKey: topicKey || speaker.id });
    usedSpeakerIds.add(speaker.id);
  };
  events
    .filter(homeVisibleRecord)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .forEach((event) => {
      (event.topicIds || []).forEach((topicId) => {
        if (selected.some((entry) => entry.topicKey === topicId)) return;
        const topic = topicById.get(topicId);
        if (!topic) return;
        const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
        const speaker = speakers.find((candidate) => {
          const topicLinked = topicSpeakerIds.size
            ? topicSpeakerIds.has(candidate.id)
            : candidate.topicId === topic.id || (candidate.topicIds || []).includes(topic.id);
          const eventLinked = (candidate.eventIds || []).includes(event.id) || (event.speakerIds || []).includes(candidate.id);
          return homeVisibleRecord(candidate) && topicLinked && eventLinked;
        });
        if (speaker) addSpeaker(speaker, topicId);
      });
    });
  speakers
    .filter((speaker) => homeVisibleRecord(speaker) && (speaker.name || speaker.firstName || speaker.lastName))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .forEach((speaker) => {
      const topicKey = [speaker.topicId, ...(speaker.topicIds || [])].find(Boolean) || speaker.id;
      if (!selected.some((entry) => entry.topicKey === topicKey)) addSpeaker(speaker, topicKey);
    });
  return selected.map((entry) => entry.speaker);
}

function homeSection(title, eyebrow, body, action = "") {
  if (!body) return "";
  return `<section class="pdtv-home-section"><div class="container">
    <div class="pdtv-home-section__head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2></div>${action}</div>
    ${body}
  </div></section>`;
}

function homeHeroMarkup({ next, nextImageUrl, retrospective, series }) {
  if (next) {
    const image = nextImageUrl || homeImageUrl(next, "event");
    return `<section class="pdtv-home-hero pdtv-home-hero--event">
      ${image ? `<figure class="pdtv-home-hero__media"><img src="${escapeHtml(image)}" alt="${escapeHtml(next.title || "Event")}" loading="eager" decoding="async" fetchpriority="high"></figure>` : ""}
      <div class="pdtv-home-hero__content">
        <p class="eyebrow">Kommendes Event</p>
        <h1>${escapeHtml(next.title || "PROdigitalTV Event")}</h1>
        <p>${escapeHtml(homeEventTeaser(next, 210) || [formatDate(next.date), next.city].filter(Boolean).join(" - "))}</p>
        <div class="pdtv-home-hero__meta">${[formatDate(next.date), next.startTime ? `${next.startTime} Uhr` : "", next.city].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        <div class="pdtv-home-actions"><a class="button button--primary" href="#/event/${escapeHtml(next.id)}">Event ansehen</a>${eventRegistrationIsOpen(next) ? `<a class="button button--secondary" href="#/register/${escapeHtml(next.id)}">Anmelden</a>` : ""}</div>
      </div>
    </section>`;
  }
  if (retrospective) {
    const image = homeImageUrl(retrospective, "event");
    return `<section class="pdtv-home-hero pdtv-home-hero--retrospective">
      ${image ? `<figure class="pdtv-home-hero__media"><img src="${escapeHtml(image)}" alt="${escapeHtml(retrospective.title || "Rueckblick")}" loading="eager" decoding="async" fetchpriority="high"></figure>` : ""}
      <div class="pdtv-home-hero__content">
        <p class="eyebrow">Aktueller Rückblick</p>
        <h1>${escapeHtml(retrospective.title || "Rückblick")}</h1>
        ${homeTeaser(retrospective, 220) ? `<p>${escapeHtml(homeTeaser(retrospective, 220))}</p>` : ""}
        <div class="pdtv-home-actions"><a class="button button--primary" href="${escapeHtml(retrospective.href || "#/archive")}">Rückblick ansehen</a></div>
      </div>
    </section>`;
  }
  if (series) {
    const title = series.title || series.titel || "";
    const description = series.description || series.kurztext || series.langtext || "";
    return `<section class="pdtv-home-hero pdtv-home-hero--series">
      <div class="pdtv-home-hero__content">
        <p class="eyebrow">Veranstaltungsreihe</p>
        <h1>${escapeHtml(title)}</h1>
        ${description ? `<p>${escapeHtml(teaserText(description, 220))}</p>` : ""}
        <div class="pdtv-home-actions"><a class="button button--primary" href="#/events">Alle Veranstaltungen</a></div>
      </div>
    </section>`;
  }
  return `<section class="pdtv-home-hero pdtv-home-hero--neutral">
    <div class="pdtv-home-hero__content">
      <p class="eyebrow">PROdigitalTV</p>
      <h1>Digitales Mediennetzwerk mit Haltung.</h1>
      <p>Willkommen bei PROdigitalTV. Aktuelle Inhalte erscheinen hier, sobald sie im CMS veröffentlicht sind.</p>
      <div class="pdtv-home-actions"><a class="button button--primary" href="#/events">Events</a><a class="button button--secondary" href="#/topics">Themen</a></div>
    </div>
  </section>`;
}

function pageContentCacheKey(name = "", variant = "public") {
  return `pdtv-page-content-${name === "news" ? "v48" : ["topics", "home"].includes(name) ? "v45" : "v44"}:${name}:${variant}`;
}

function readPageContentCache(name = "", variant = "public", maxAgeMs = 600000) {
  try {
    const cached = JSON.parse(localStorage.getItem(pageContentCacheKey(name, variant)) || "null");
    if (!cached?.html || Date.now() - Number(cached.createdAt || 0) > maxAgeMs) return "";
    return cached.html;
  } catch {
    return "";
  }
}

function writePageContentCache(name = "", variant = "public", html = "") {
  try {
    if (html) localStorage.setItem(pageContentCacheKey(name, variant), JSON.stringify({ createdAt: Date.now(), html }));
  } catch {}
}

function eventDetailCacheVariant(eventId = "") {
  return `${mobileLeanStart() ? "mobile" : "desktop"}:${currentUser()?.uid || "guest"}:${eventId}`;
}

function eventDetailCacheName(eventId = "") {
  return `event-detail-v5:${eventId}`;
}
function readEmbeddedEventDetail(eventId = "") {
  try {
    const detail = window.__PDT_PUBLIC_SNAPSHOT?.eventDetails?.[eventId];
    if (!detail?.event) return null;
    return {
      event: detail.event,
      speakers: Array.isArray(detail.speakers) ? detail.speakers : [],
      sponsors: Array.isArray(detail.sponsors) ? detail.sponsors : [],
      topics: Array.isArray(detail.topics) ? detail.topics : [],
      galleries: Array.isArray(detail.galleries) ? detail.galleries : [],
      mediaAssets: Array.isArray(detail.mediaAssets) ? detail.mediaAssets : []
    };
  } catch {
    return null;
  }
}
function memberProfileCacheKey(user = {}) {
  const memberId = user.memberId || "";
  const userKey = user.uid || user.email || "member";
  return memberId ? `pdtv-member-profile-v2:${userKey}:${memberId}` : "";
}

function readCachedMemberProfile(user = {}, maxAgeMs = 900000) {
  try {
    const key = memberProfileCacheKey(user);
    if (!key) return null;
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (!cached?.member || Date.now() - Number(cached.createdAt || 0) > maxAgeMs) return null;
    return cached.member;
  } catch {
    return null;
  }
}

function writeCachedMemberProfile(user = {}, member = null) {
  try {
    const key = memberProfileCacheKey(user);
    if (key && member?.id) localStorage.setItem(key, JSON.stringify({ createdAt: Date.now(), member }));
  } catch {}
}

function fastFallback(promise, fallback = [], ms = 1500) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

export async function homePage() {
  const homeVariant = mobileLeanStart() ? "mobile" : "desktop";
  const cachedHome = readPageContentCache("home", homeVariant, 600000);
  if (cachedHome) return publicShell("home", cachedHome);
  const withHomeTimeout = (promise, fallback = [], ms = 24000) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
  const leanHome = homeVariant === "mobile";
  const [events, editorial, topics, speakers, aboutBlocks] = await Promise.all([
    withHomeTimeout(listPublicEvents(true).catch(() => []), [], leanHome ? 9000 : 24000),
    withHomeTimeout(listPublicContent("editorialContent").catch(() => []), [], leanHome ? 9000 : 24000),
    withHomeTimeout(listPublicContent("topics").catch(() => []), [], leanHome ? 7000 : 24000),
    withHomeTimeout(listPublicContent("speakers").catch(() => []), [], leanHome ? 7000 : 24000),
    leanHome ? [] : withHomeTimeout(internalBlocks("ueber_uns").catch(() => []))
  ]);
  const upcoming = events.filter(upcomingEventIsVisible).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const next = upcoming.find(eventShowsOnHome) || null;
  let nextImageUrl = next ? upcomingEventImageUrl(next, [], { fallback: false }) : "";
  if (next) {
    const mediaAssets = await withHomeTimeout(listPublicEventMediaAssets([next]).catch(() => []), [], leanHome ? 900 : 1400);
    nextImageUrl = upcomingEventImageUrl(next, mediaAssets, { fallback: false }) || nextImageUrl;
  }
  const retrospective = homeRetrospectiveItems(events, editorial)[0] || null;
  const seriesItems = homeFormatSeries(aboutBlocks);
  const latestNewsItems = publicNewsItems(editorial)
    .sort(newestContentFirst)
    .slice(0, 3);
  const newsMediaAssets = latestNewsItems.length
    ? await withHomeTimeout(listPublicMediaAssets().catch(() => []), [], leanHome ? 1400 : 3600)
    : [];
  const visibleTopics = publicReleasedTopics(topics, events).slice(0, 6);
  const visibleSpeakers = homeSpeakersOnePerTalk(events, topics, speakers)
    .sort((a, b) => Number(Boolean(speakerPhotoUrl(b))) - Number(Boolean(speakerPhotoUrl(a))))
    .slice(0, 6);

  const newsBody = latestNewsItems.length ? `<div class="pdtv-home-news-grid">${latestNewsItems.map((item) => {
    const cardImage = publicEditorialCardImage(item, newsMediaAssets);
    const image = cardImage.url;
    const audio = availableAudioUrl(item.audioUrl || item.audioNaturalUrl || item.audioAccessibleUrl || "", item.audioStatus || item.audioNaturalStatus || item.audioAccessibleStatus || "");
    return `<a class="pdtv-home-news-card" href="#/news/${escapeHtml(item.id)}">
      ${image ? `<figure><img src="${escapeHtml(image)}"${cardImage.srcset ? ` srcset="${cardImage.srcset}" sizes="(max-width: 760px) 92vw, 390px"` : ""} alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="lazy" decoding="async" ${liveImageAttrs("news")}></figure>` : ""}
      <div><p class="eyebrow">${escapeHtml(item.category || "News")}${audio ? " - Audio" : ""}</p><h3>${escapeHtml(item.title || "News")}</h3>${homeTeaser(item, 160) ? `<p>${escapeHtml(homeTeaser(item, 160))}</p>` : ""}<span>Beitrag öffnen</span></div>
    </a>`;
  }).join("")}</div>` : `<div class="pdtv-home-empty">Aktuell sind keine News veröffentlicht.</div>`;

  const topicsBody = visibleTopics.length ? `<div class="pdtv-home-topic-grid">${visibleTopics.map((topic) => `<a class="pdtv-home-topic-card" href="#/topic/${escapeHtml(topic.id)}">
    ${homeImageUrl(topic, "topic") ? `<img src="${escapeHtml(homeImageUrl(topic, "topic"))}" alt="${escapeHtml(topic.title || "Thema")}" loading="lazy" decoding="async"${topicImageTransformStyle(topic)} ${liveImageAttrs("topic")}>` : `<span class="pdtv-home-topic-card__placeholder" aria-hidden="true">${escapeHtml(initials(topic.title || "Thema"))}</span>`}<span><strong>${escapeHtml(topic.title || "Thema")}</strong></span>
  </a>`).join("")}</div>` : "";

  const speakersBody = visibleSpeakers.length ? `<div class="pdtv-home-speaker-grid">${visibleSpeakers.map((speaker) => {
    const name = speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ");
    const photo = speakerPhotoUrl(speaker);
    return `<article class="pdtv-home-speaker-card">${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" ${liveImageAttrs("member")}>` : `<span>${escapeHtml(initials(name || "Referent"))}</span>`}<div><h3>${escapeHtml(name)}</h3>${speaker.company ? `<p>${escapeHtml(speaker.company)}</p>` : ""}<a class="button button--secondary button--small" href="${speakerProfileHref(speaker)}">Mehr</a></div></article>`;
  }).join("")}</div>` : "";

  const seriesBody = seriesItems.length ? `<div class="pdtv-home-series-grid">${seriesItems.map((series) => {
    const fallback = homeSeriesFallback(series);
    const imageUrl = stableImageUrl(series.imageUrl || series.thumbnailUrl || series.assetUrl || fallback.imageUrl || "", "event");
    const shortText = series.kurztext || fallback.kurztext || "";
    const longText = series.langtext || fallback.langtext || "";
    return `<article class="pdtv-home-series-card${imageUrl ? " pdtv-home-series-card--with-bg" : ""}"${imageUrl ? ` style="--series-bg: url('${escapeHtml(imageUrl)}')"` : ""}>
      <div class="pdtv-home-series-card__copy"><h3>${escapeHtml(series.titel)}</h3>${shortText ? `<p>${escapeHtml(shortText)}</p>` : ""}${longText ? `<p>${escapeHtml(teaserText(longText, 260))}</p>` : ""}<a class="button button--secondary button--small" href="#/ueber-uns/${encodeURIComponent(series.slug)}">Artikel öffnen</a></div>
    </article>`;
  }).join("")}</div>` : "";

  const homeContent = `<main class="pdtv-home">
    <div class="container">${homeHeroMarkup({ next, nextImageUrl, retrospective, series: seriesItems[0] || null })}</div>
    ${homeSection("Aktuelle News", "News", newsBody, `<a class="link" href="#/news">Alle News</a>`)}
    ${homeSection("Themen", "Dossiers", topicsBody, `<a class="link" href="#/topics">Alle Themen</a>`)}
    ${homeSection("Aktuelle Referenten", "Köpfe", speakersBody, `<a class="link" href="#/speakers">Alle Referenten</a>`)}
    ${homeSection("Vortragsreihen", "Interna", seriesBody)}
  </main>`;
  if (latestNewsItems.length || publicNewsItems(editorial).length) writePageContentCache("home", homeVariant, homeContent);
  return publicShell("home", homeContent);
}

export async function speakersPage() {
  const speakerSortParts = (speaker = {}) => {
    const displayName = speakerName(speaker).trim();
    const nameParts = displayName.split(/\s+/).filter(Boolean);
    return {
      lastName: String(speaker.lastName || nameParts.at(-1) || ""),
      firstName: String(speaker.firstName || nameParts.slice(0, -1).join(" ") || displayName)
    };
  };
  const speakers = (await listPublicContent("speakers").catch(() => []))
    .filter(publicSpeakerIsVisible)
    .sort((a, b) => {
      const aName = speakerSortParts(a);
      const bName = speakerSortParts(b);
      return aName.lastName.localeCompare(bName.lastName, "de", { sensitivity: "base" })
        || aName.firstName.localeCompare(bName.firstName, "de", { sensitivity: "base" });
    });
  const cards = speakers.map((speaker) => {
    const name = speakerName(speaker);
    const role = [speaker.position, speaker.company].filter(Boolean).join(" - ");
    const teaser = speakerIntroText(speaker) || speakerVitaText(speaker);
    return `<article class="speaker-directory-card">
      <a class="speaker-directory-card__portrait" href="${speakerProfileHref(speaker)}">${speakerPortrait(speaker)}</a>
      <div>
        <h2><a href="${speakerProfileHref(speaker)}">${escapeHtml(name)}</a></h2>
        ${role ? `<p class="speaker-profile__position">${escapeHtml(role)}</p>` : ""}
        ${teaser ? `<p>${escapeHtml(teaserText(teaser, 220))}</p>` : ""}
        <a class="button button--secondary button--small speaker-directory-card__more" href="${speakerProfileHref(speaker)}">Mehr</a>
      </div>
    </article>`;
  }).join("");
  return publicShell("speakers", `${subhero("Referenten", "Profile und Viten", "Menschen, Themen und Perspektiven aus den PROdigitalTV-Formaten.")}
    <section class="section section--white"><div class="container speaker-directory-grid">
      ${cards || `<div class="alert">Aktuell sind noch keine Referentenprofile veroeffentlicht.</div>`}
    </div></section>`);
}

export async function speakerDetailPage(id) {
  const [speakers, topics, events] = await Promise.all([
    listPublicContent("speakers").catch(() => []),
    listPublicContent("topics").catch(() => []),
    listPublicEvents(true).catch(() => [])
  ]);
  const speaker = speakers.find((item) => [item.id, item.slug].filter(Boolean).includes(id));
  if (!speaker || !publicSpeakerIsVisible(speaker)) return notFoundPage();
  const name = speakerName(speaker);
  const role = [speaker.position, speaker.company].filter(Boolean).join(" - ");
  const intro = speakerIntroText(speaker);
  const vita = speakerVitaText(speaker);
  const profileTopic = topics.find((topic) => (speaker.topicIds || []).includes(topic.id) || topic.speakerId === speaker.id || (topic.speakerIds || []).includes(speaker.id) || topic.moderatorId === speaker.id || (topic.moderatorIds || []).includes(speaker.id)) || {};
  const profileLogoUrl = speakerCompanyLogoUrl(speaker, profileTopic);
  const talks = speakerTalkLinks(speaker, topics, events);
  const talksHtml = talks.length ? `<div class="speaker-detail-talks">${talks.map(({ topic, event }) => `<a class="speaker-detail-talk" href="#/topic/${escapeHtml(topic.id)}">
      <span>${escapeHtml(event?.displayDate || formatDate(event?.date || "") || "Vortrag")}</span>
      <strong>${escapeHtml(topic.title || "Vortrag")}</strong>
      ${event?.title ? `<small>${escapeHtml(event.title)}</small>` : ""}
    </a>`).join("")}</div>` : `<div class="alert">Noch keine veroeffentlichten Vortraege zugeordnet.</div>`;
  return publicShell("speakers", `${subhero("Referent", name, role || "PROdigitalTV Referentenprofil")}
    <section class="section section--white"><div class="container speaker-detail">
      <aside class="speaker-detail__identity"><div class="speaker-detail__portrait">${speakerPortrait(speaker)}</div>${profileLogoUrl ? `<div class="speaker-detail__logo"><img src="${escapeHtml(profileLogoUrl)}" alt="Logo ${escapeHtml(speaker.company || "Unternehmen")}" loading="eager" decoding="async" ${liveImageAttrs("sponsor")}></div>` : ""}</aside>
      <article class="speaker-detail__body">
        <a class="link" href="#/speakers">Zurueck zu allen Referenten</a>
        <h1>${escapeHtml(name)}</h1>
        ${role ? `<p class="speaker-profile__position">${escapeHtml(role)}</p>` : ""}
        ${intro ? `<p class="speaker-profile__intro">${escapeHtml(intro)}</p>` : ""}
        ${vita ? `<div class="editorial-text">${articleParagraphs(vita)}</div>` : ""}
        <div class="speaker-detail__links">
          ${speaker.website ? `<a class="button button--secondary button--small" href="${escapeHtml(/^https?:\/\//i.test(speaker.website) ? speaker.website : `https://${speaker.website}`)}" target="_blank" rel="noopener">Website</a>` : ""}
          ${speaker.linkedIn ? `<a class="button button--secondary button--small" href="${escapeHtml(speaker.linkedIn)}" target="_blank" rel="noopener">LinkedIn</a>` : ""}
        </div>
        <h2>Vorträge und Themen</h2>
        ${talksHtml}
      </article>
    </div></section>`);
}

function eventFeedbackQuestionHtml(question = {}, index = 0) {
  const inputName = `q_${question.id}`;
  const commentName = `comment_${question.id}`;
  const isMultiple = question.type === "multiple";
  return `<fieldset class="event-feedback-question" data-feedback-question="${escapeHtml(question.id)}" data-feedback-type="${escapeHtml(question.type || "single")}">
    <legend><span>${index + 1}</span>${escapeHtml(question.title || "Feedbackfrage")}</legend>
    <div class="event-feedback-options">
      ${(question.options || []).map((option) => `<label class="event-feedback-option"><input type="${isMultiple ? "checkbox" : "radio"}" name="${escapeHtml(inputName)}" value="${escapeHtml(option)}" ${isMultiple ? "" : "required"}><span>${escapeHtml(option)}</span></label>`).join("")}
    </div>
    <div class="field"><label>${escapeHtml(question.commentPrompt || "Kommentar")}</label><textarea name="${escapeHtml(commentName)}" rows="3" placeholder="Optional"></textarea></div>

  </fieldset>`;
}

export async function eventFeedbackPage(query = new URLSearchParams()) {
  const token = String(query?.get?.("token") || "").trim();
  if (!token) return publicShell("events", `${subhero("Feedback", "Link unvollstaendig", "Bitte oeffnen Sie den vollstaendigen Feedback-Link aus Ihrer E-Mail.")}`);
  let payload = null;
  try {
    payload = await callEventFeedbackFunction("getEventFeedbackByToken", { token });
  } catch (error) {
    return publicShell("events", `${subhero("Feedback", "Link nicht verfuegbar", error?.message || "Der Feedback-Link konnte nicht geoeffnet werden.")}`);
  }
  const eventRecord = payload.event || {};
  const guest = payload.guest || {};
  const alreadySubmitted = payload.feedback?.submittedAt ? `<div class="alert alert--success">Vielen Dank, Ihre Rueckmeldung wurde bereits gespeichert. Sie koennen sie bei Bedarf erneut absenden.</div>` : "";
  const eventMeta = [formatDate(eventRecord.date), eventRecord.locationName, eventRecord.city].filter(Boolean).join(" · ");
  return publicShell("events", `${subhero("Feedback", "Ihre Rueckmeldung", "Ihre Einschätzung hilft PROdigitalTV, Veranstaltungen und Netzwerkangebote gezielt weiterzuentwickeln.")}
    <section class="section section--white"><div class="container event-feedback-page">
      <aside class="event-feedback-summary">
        <p class="eyebrow">Veranstaltung</p>
        <h2>${escapeHtml(eventRecord.title || "PROdigitalTV Event")}</h2>
        ${eventMeta ? `<p class="muted">${escapeHtml(eventMeta)}</p>` : ""}
        <div class="event-feedback-guest"><strong>${escapeHtml(guest.guestName || "Gast")}</strong>${guest.guestCompany ? `<span>${escapeHtml(guest.guestCompany)}</span>` : ""}${guest.guestEmail ? `<span>${escapeHtml(guest.guestEmail)}</span>` : ""}</div>
      </aside>
      <form id="event-feedback-form" class="form-card event-feedback-form" data-token="${escapeHtml(token)}">
        ${alreadySubmitted}
        ${(payload.questions || []).map(eventFeedbackQuestionHtml).join("")}
        <fieldset class="event-feedback-question event-feedback-question--compact">
          <legend><span>+</span>Dürfen wir Sie zu PROdigitalTV-Veranstaltungen und Informationen zum Netzwerk kontaktieren?</legend>
          <div class="event-feedback-options event-feedback-options--inline">
            <label class="event-feedback-option"><input type="radio" name="contactConsent" value="Ja"><span>Ja</span></label>
            <label class="event-feedback-option"><input type="radio" name="contactConsent" value="Nein"><span>Nein</span></label>
          </div>
        </fieldset>
        <div id="event-feedback-result" role="status" aria-live="polite"></div>
        <div class="actions"><button class="button button--primary" type="submit">Feedback absenden</button></div>
      </form>
    </div></section>`);
}
export async function speakerApprovalPage(id = "", query = new URLSearchParams()) {
  const token = String(query?.get?.("token") || "").trim();
  if (!id || !token) return publicShell("speakers", `${subhero("Referentenfreigabe", "Link unvollstaendig", "Bitte oeffnen Sie den vollstaendigen Link aus Ihrer E-Mail.")}`);
  let payload = null;
  try {
    payload = (await callSpeakerApprovalFunction("getSpeakerApproval", { approvalId: id, token })).approval;
  } catch (error) {
    return publicShell("speakers", `${subhero("Referentenfreigabe", "Link nicht verfuegbar", error?.message || "Der Freigabelink konnte nicht geoeffnet werden.")}`);
  }
  const speaker = payload.speaker || {};
  const topic = payload.topic || {};
  const eventRecord = payload.event || {};
  const statusNote = payload.status === "submitted"
    ? payload.speakerDecision === "approved"
      ? `<div class="alert alert--success"><strong>Verbindlich freigegeben.</strong> Ihre Freigabe wurde an PROdigitalTV übermittelt. Sie können Ihre Angaben bei Bedarf erneut bearbeiten.</div>`
      : `<div class="alert alert--success">Vielen Dank, Ihre Korrekturen wurden bereits übermittelt. Sie können bei Bedarf erneut speichern.</div>`
    : "";
  const role = [speaker.position, speaker.company].filter(Boolean).join(" - ");
  const eventMeta = [formatDate(eventRecord.date), eventRecord.locationName, eventRecord.city].filter(Boolean).join(" · ");
  return publicShell("speakers", `${subhero("Referentenfreigabe", "Profil und Vortragsbeschreibung", "Bitte pruefen Sie nur Ihre eigenen Angaben und senden Sie Korrekturen direkt an PROdigitalTV.")}
    <section class="section section--white"><div class="container speaker-approval-page">
      <aside class="speaker-approval-summary">
        <div class="speaker-detail__portrait">${speaker.photoUrl ? `<img src="${escapeHtml(speaker.photoUrl)}" alt="${escapeHtml(speaker.name || "Referent")}" loading="eager" decoding="async">` : `<span>${escapeHtml(initials(speaker.name || "Referent"))}</span>`}</div>
        <p class="eyebrow">${escapeHtml(eventRecord.title || "PROdigitalTV Event")}</p>
        ${eventMeta ? `<p class="muted">${escapeHtml(eventMeta)}</p>` : ""}
        <h2>${escapeHtml(speaker.name || "Referent")}</h2>
        ${role ? `<p>${escapeHtml(role)}</p>` : ""}
      </aside>
      <form id="speaker-approval-form" class="form-card speaker-approval-form" data-approval-id="${escapeHtml(id)}" data-token="${escapeHtml(token)}">
        ${statusNote}
        <div class="form-grid--two">
          <div class="field"><label>Name</label><input name="speakerName" value="${escapeHtml(speaker.name || "")}" required></div>
          <div class="field"><label>Firma</label><input name="company" value="${escapeHtml(speaker.company || "")}"></div>
        </div>
        <div class="field"><label>Funktion / Position</label><input name="position" value="${escapeHtml(speaker.position || "")}"></div>
        <div class="form-grid--two">
          <div class="field"><label>E-Mail</label><input name="email" type="email" value="${escapeHtml(speaker.email || "")}" required></div>
          <div class="field"><label>Telefon</label><input name="phone" type="tel" value="${escapeHtml(speaker.phone || "")}"></div>
        </div>
        <div class="field"><label>LinkedIn</label><input name="linkedIn" type="url" value="${escapeHtml(speaker.linkedIn || "")}" placeholder="https://www.linkedin.com/in/..."></div>
        <div class="field"><label>Kurzvita</label><textarea name="shortBio" rows="4">${escapeHtml(speaker.shortBio || "")}</textarea></div>
        <div class="field"><label>Ausfuehrliche Vita</label><textarea name="longBio" rows="6">${escapeHtml(speaker.longBio || "")}</textarea></div>
        <hr>
        <div class="field"><label>Vortragstitel</label><input name="topicTitle" value="${escapeHtml(topic.title || "")}" required></div>
        <div class="field"><label>Vortragsbeschreibung</label><textarea name="topicDescription" rows="10" required>${escapeHtml(topic.description || "")}</textarea></div>
        <div class="field"><label>Hinweis an die Redaktion</label><textarea name="note" rows="3" placeholder="Optional: Was wurde geaendert oder worauf sollen wir achten?"></textarea></div>
        <div class="speaker-approval-decision">
          <p><strong>Bitte wählen Sie eindeutig:</strong> Senden Sie entweder Korrekturen an die Redaktion oder bestätigen Sie alle Angaben verbindlich.</p>
          <div class="actions">
            <button class="button button--secondary" type="submit" name="decision" value="corrections">Korrekturen an PROdigitalTV senden</button>
            <button class="button button--primary" type="submit" name="decision" value="approved">Profil und Vortrag verbindlich freigeben</button>
          </div>
          <span id="speaker-approval-result" role="status" aria-live="polite"></span>
        </div>
      </form>
    </div></section>`);
}
export async function eventsPage() {
  const user = currentUser();
  const eventVariant = `${isMember(user) ? "member" : "public"}:${user?.uid || "guest"}`;
  const cachedEvents = readPageContentCache("events", eventVariant, user ? 30000 : 120000);
  if (cachedEvents) return publicShell("events", cachedEvents);
  const leanEvents = mobileLeanStart();
  const [events, sponsors] = await Promise.all([
    listPublicEvents(true).catch(() => []),
    leanEvents ? [] : listPublicContent("sponsors").catch(() => [])
  ]);
  const visible = events.filter((event) => event.accessType !== "invitation_only" || isMember(user) || event.showPublicTeaser);
  const rawUpcoming = visible.filter(upcomingEventIsVisible);
  const withRegistrationTimeout = (promise, fallback = []) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), leanEvents ? 700 : 1200))
  ]);
  const myRegistrationByEventId = new Map(
    user?.email
      ? (await withRegistrationTimeout(listMyEventRegistrations(rawUpcoming.map((event) => event.id)).catch(() => [])))
        .map((registration) => [registration.eventId, registration])
      : []
  );
  const upcoming = rawUpcoming.map((event) => ({
    ...event,
    imageDisplayUrl: upcomingEventImageUrl(event, [], { fallback: false }),
    storedTicket: readStoredTicket(event.id),
    myRegistration: myRegistrationByEventId.get(event.id) || null
  })).sort(compareEventsByDateAsc);
  const latestRetrospectives = visible
    .filter((event) => isPastEvent(event) && homeVisibleRecord(event))
    .sort(compareEventsByDateDesc)
    .slice(0, 3);
  const retrospectiveCards = latestRetrospectives.map((event) => {
    const imageUrl = archiveEventImageUrl(event, []) || event.imageDisplayUrl || event.imageUrl || event.thumbnail_url || event.thumbnailUrl || "";
    const detailUrl = event.retrospectiveArticleId ? `#/retrospective/${escapeHtml(event.retrospectiveArticleId)}` : `#/event/${escapeHtml(event.id)}`;
    const teaser = teaserText(event.retrospectiveTitle || event.description || event.publicTeaser || event.shortDescription || event.subtitle || "", 150);
    return `<a class="card event-retrospective-card" href="${detailUrl}">
      ${imageUrl ? `<figure class="event-retrospective-card__image"><img src="${escapeHtml(imageUrl)}" alt="Rückblick ${escapeHtml(event.title || "")}" loading="lazy" decoding="async"></figure>` : `<span class="quick-card__icon">${escapeHtml(event.eventType || "R")}</span>`}
      <div class="card__body"><p class="eyebrow">${formatDate((event.date || "").slice(0, 10)) || "Rückblick"}</p><h3>${escapeHtml(event.retrospectiveTitle || event.title || "Rückblick")}</h3>${teaser ? `<p>${escapeHtml(teaser)}</p>` : ""}<span class="link">Rückblick ansehen -></span></div>
    </a>`;
  }).join("");
  const eventsContent = `${subhero("Veranstaltungen", "Events", "Kuratierte Formate für Wissenstransfer, Partnerschaften und relevante Branchenkontakte.")}
    <section class="section"><div class="container"><div class="filters" data-public-event-filters><button type="button" class="filter active" data-public-event-filter="upcoming">Kommende Events</button><button type="button" class="filter" data-public-event-filter="public">Öffentlich</button><button type="button" class="filter" data-public-event-filter="members">Mitglieder</button><a class="filter" href="#/archive">Rückblicke</a></div>
    ${upcoming.length ? `<div class="card-grid card-grid--three" data-public-event-grid>${upcoming.map((event) => `<div class="event-filter-card" data-public-event-card data-event-audience="${event.accessType === "members_only" ? "members" : "public"}">${eventCard(event, false, sponsors)}</div>`).join("")}</div><div class="alert" data-public-event-empty hidden>Für diesen Filter sind aktuell keine kommenden Events veröffentlicht.</div>` : `<div class="alert">Aktuell sind keine neuen Termine veröffentlicht. Im Eventarchiv finden Sie die letzten PROdigitalTV-Veranstaltungen.</div>`}
    ${retrospectiveCards ? `<div class="section-head section-head--inline events-retrospective-head"><div><p class="eyebrow">Rückblicke</p><h2>Letzte Veranstaltungen</h2></div><a class="link" href="#/archive">Alle Rückblicke -></a></div><div class="card-grid card-grid--three">${retrospectiveCards}</div>` : ""}</div></section>`;
  writePageContentCache("events", eventVariant, eventsContent);
  return publicShell("events", eventsContent);
}

function eventDetailUpdatedAt(record = {}) {
  const value = record.updatedAt || record.updated_at;
  return typeof value?.toMillis === "function" ? value.toMillis() : Date.parse(String(value || "")) || 0;
}

function mergeEventDetailRecords(loaded = [], embedded = []) {
  const records = new Map(embedded.filter((record) => record?.id).map((record) => [record.id, record]));
  loaded.forEach((record) => {
    if (!record?.id) return;
    const current = records.get(record.id);
    if (!current || eventDetailUpdatedAt(record) >= eventDetailUpdatedAt(current)) records.set(record.id, record);
  });
  return Array.from(records.values());
}

async function getPublicRouteEvent(id, includeMemberEvents = false) {
  const embeddedEvent = readEmbeddedEventDetail(id)?.event || null;
  const directEvent = await fastFallback(getOne("events", id).catch(() => null), null, 4000);
  if (directEvent) return directEvent;
  const events = await listPublicEvents(includeMemberEvents).catch(() => []);
  const listedEvent = events.find((event) => event.id === id);
  if (!listedEvent) return embeddedEvent;
  if (!embeddedEvent) return listedEvent;
  return eventDetailUpdatedAt(embeddedEvent) > eventDetailUpdatedAt(listedEvent)
    ? { ...listedEvent, ...embeddedEvent }
    : listedEvent;
}

export async function eventDetailPage(id, query = new URLSearchParams()) {
  const previewMode = query?.get?.("preview") === "1" && isAdmin();
  const ticketToken = String(query?.get?.("ticket") || "").trim();
  const leanEventDetail = mobileLeanStart();
  const locallyStoredTicket = id ? readStoredTicket(id) : null;
  const canUseCachedDetail = id && !previewMode && !ticketToken && !locallyStoredTicket?.ticketToken;
  const embeddedDetail = canUseCachedDetail ? readEmbeddedEventDetail(id) : null;
  const cachedDetail = canUseCachedDetail ? readPageContentCache(eventDetailCacheName(id), eventDetailCacheVariant(id), 30000) : "";
  if (cachedDetail) return publicShell("events", cachedDetail);
  let ticketActivation = null;
  if (ticketToken) {
    try {
      const linkedTicket = await linkTicketDevice(ticketToken);
      if (!id || linkedTicket.eventId === id) ticketActivation = linkedTicket;
    } catch {
      ticketActivation = null;
    }
  }
  let event = null;
  try {
    event = await getPublicRouteEvent(id, isMember());
  } catch {
    event = embeddedDetail?.event || null;
  }
  if (!event && embeddedDetail?.event) event = embeddedDetail.event;
  if (!event) return notFoundPage();
  if (!previewMode && !isPastEvent(event) && !upcomingEventIsVisible(event)) return notFoundPage();
  const [loadedSpeakers, sponsors, loadedTopics, galleries, mediaAssets] = await Promise.all([
    fastFallback(listPublicContent("speakers").catch(() => []), embeddedDetail?.speakers || [], leanEventDetail ? 1200 : 22000),
    fastFallback(listPublicContent("sponsors").catch(() => []), embeddedDetail?.sponsors || [], leanEventDetail ? 900 : 22000),
    fastFallback(listPublicContent("topics").catch(() => []), embeddedDetail?.topics || [], leanEventDetail ? 1200 : 22000),
    fastFallback(listPublicContent("galleries").catch(() => []), embeddedDetail?.galleries || [], leanEventDetail ? 700 : 22000),
    fastFallback(listPublicEventMediaAssets([event]).catch(() => []), embeddedDetail?.mediaAssets || [], leanEventDetail ? 900 : 22000)
  ]);
  const speakers = mergeEventDetailRecords(loadedSpeakers, embeddedDetail?.speakers || []);
  const topics = mergeEventDetailRecords(loadedTopics, embeddedDetail?.topics || []);
  const registrationOpen = eventRegistrationIsOpen(event);
  const storedTicket = ticketActivation || await validateStoredTicket(event.id).catch(() => locallyStoredTicket || readStoredTicket(event.id));
  const restricted = event.accessType === "members_only" && !isMember() && !registrationOpen && !storedTicket;
  if (restricted && !event.showPublicTeaser) return publicShell("events", subhero("Geschuetzter Bereich", "Nur für Mitglieder", "Bitte melden Sie sich an, um dieses Event zu sehen."));
  const eventFormatKey = normalizeTopicType(`${event.id || ""} ${event.title || event.titel || ""} ${event.eventType || ""} ${event.series || ""}`);
  const suppressCoHost = eventFormatKey.includes("vondenbestenlernen");
  const coHost = suppressCoHost ? null : sponsors.find((sponsor) => sponsor.id === event.hostId) || null;
  const coHostLogo = coHost ? publicSponsorLogoUrl(coHost, mediaAssets) : "";
  const assignedGallery = galleries.find((gallery) => gallery.id === event.galleryId) || galleries.find((gallery) => gallery.eventId === event.id && gallery.status === "published" && gallery.visibility === "public");
  const assignedGalleryImages = Array.isArray(assignedGallery?.images)
    ? [...assignedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 24)
    : [];
  const registrationAllowed = registrationOpen;
  const ticketStatusCard = storedTicket ? `<section class="mobile-ticket-card" aria-label="Gespeichertes Handy-Ticket">
    <div class="mobile-ticket-card__icon" aria-hidden="true"></div>
    <div class="mobile-ticket-card__body">
      <p class="eyebrow">${storedTicket.status === "checked_in" ? "Eingecheckt" : "Angemeldet"}</p>
      <h2>${escapeHtml(event.title || storedTicket.eventTitle || "PROdigitalTV Event")}</h2>
      <p>${escapeHtml(registrationPartyLabel(storedTicket))}</p>
      <span>${storedTicket.status === "checked_in" ? "Ihr Check-in ist gespeichert." : `Dieses Handy ist fuer ${storedTicket.participantCount > 1 || storedTicket.companion ? "beide Personen" : "den Einlass"} vorbereitet.`}</span>
    </div>
  </section>` : !isPastEvent(event) ? `<p class="event-ticket-recovery-link"><a href="#/ticket/recover/${encodeURIComponent(event.id)}">Handy-Ticket wiederherstellen</a></p>` : "";
  const eventImageUrl = eventDetailImageUrl(event, mediaAssets, [coHostLogo]);
  const rawIntroText = eventIntroText(event);
  const longText = eventLongText(event);
  const introText = looksTruncatedText(rawIntroText) && longText ? "" : rawIntroText;
  const hasSeparateLongText = longText.trim() && longText.trim() !== introText.trim();
  const isPast = isPastEvent(event);
  const hasCompleteDescription = !isPast && event.descriptionMode === "complete";
  const eventMainText = hasCompleteDescription
    ? rawIntroText
    : !isPast && hasSeparateLongText
      ? [introText, longText].filter(Boolean).join("\n\n")
      : introText || longText;
  const visibleEventMainText = removeHiddenTalkMentions(eventMainText, hiddenTalkTitles(event, topics));
  const eventProgramText = hasCompleteDescription ? "" : eventInvitationProgramText(topics, speakers, event, visibleEventMainText);
  const eventClosingText = hasCompleteDescription ? "" : eventInvitationClosingText(event, registrationAllowed);
  const eventPageText = [visibleEventMainText, eventProgramText, eventClosingText].filter(Boolean).join("\n\n");
  const retrospectiveText = isPast && hasSeparateLongText ? longText : "";
  const calendarSave = eventCalendarSaveMarkup(event);
  const invitationToken = /^[a-f0-9]{48}$/.test(query?.get?.("invite") || "") ? query.get("invite") : "";
  const registrationCtaState = eventRegistrationCtaState({ registrationAllowed, storedTicket });
  const registrationCta = registrationCtaState === "confirmed"
    ? `<div class="event-registration-cta event-registration-cta--split"><div class="alert alert--success"><strong>Anmeldung bestätigt.</strong><br>Eine erneute Anmeldung ist nicht erforderlich.</div>${calendarSave}</div>`
    : registrationCtaState === "checked_in"
      ? `<div class="event-registration-cta event-registration-cta--split"><div class="alert alert--success"><strong>Bereits eingecheckt.</strong><br>Ihr Check-in ist gespeichert.</div>${calendarSave}</div>`
      : registrationCtaState === "open"
        ? `<div class="event-registration-cta event-registration-cta--split"><a class="button button--primary" href="#/register/${escapeHtml(event.id)}${invitationToken ? `?invite=${encodeURIComponent(invitationToken)}` : ""}">Jetzt anmelden</a>${calendarSave}</div>`
        : `<div class="event-registration-cta event-registration-cta--split"><div class="alert">${event.preStatus === "save_the_date" ? "Save the Date: Die Anmeldung startet zu einem spaeteren Zeitpunkt." : event.accessType === "invitation_only" ? "Teilnahme nur auf Einladung." : "Anmeldung derzeit nicht verfuegbar."}</div>${calendarSave}</div>`;
  const eventLiveCta = event.eventLiveEnabled ? `<a class="button button--secondary event-live-event-link" href="#/event-live/${encodeURIComponent(event.id)}">Event Chat öffnen</a>` : "";
  const eventInfoBlock = restricted ? "" : `<section class="venue-stage event-info-stage"><div class="event-info-stage__facts"><p class="eyebrow">Daten</p><div class="event-info-facts"><div class="event-info-fact"><label>Datum</label><strong>${formatDate(event.date)}</strong></div>${event.startTime ? `<div class="event-info-fact"><label>Zeit</label><strong>${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""} Uhr</strong></div>` : ""}<div class="event-info-fact"><label>Status</label><strong>${escapeHtml(eventRegistrationStatusLabel(event))}</strong></div></div></div><div class="venue-stage__place"><p class="eyebrow">${event.isVirtualEvent ? "Online-Teilnahme" : "Adresse"}</p>${eventLocationDetailMarkup(event)}</div>${suppressCoHost ? "" : `<div class="venue-stage__partners"><p class="eyebrow">Co-Gastgeber</p>${coHost ? `<article class="partner-spotlight">${coHostLogo ? `<img class="partner-spotlight__logo" src="${escapeHtml(coHostLogo)}" alt="Logo ${escapeHtml(coHost.name || "")}" ${liveImageAttrs("sponsor")}>` : `<span class="avatar">${initials(coHost.name)}</span>`}<div><h3>${escapeHtml(coHost.name)}</h3>${coHost.description ? `<p>${escapeHtml(coHost.description)}</p>` : ""}</div></article>` : `<p>Co-Gastgeber wird bei Bekanntgabe ergaenzt.</p>`}</div>`}</section>`;
  const previewNotice = previewMode ? `<div class="alert alert--warning">CMS-Vorschau: Dieses Event ist noch nicht zwingend öffentlich sichtbar.</div>` : "";
  const eventImageAsset = publicEventMediaAsset(event, mediaAssets, "detail");
  const eventImageRights = imageRightsDisclosure(event, eventImageAsset);
  const eventDetailContent = `${subhero(event.eventType, event.title, event.subtitle)}
    <section class="section event-detail-section"><div class="container detail-grid event-detail-grid">
      <article class="detail-main">
        ${previewNotice}
        <figure class="event-detail-image"><img src="${escapeHtml(stableImageUrl(eventImageUrl, "event"))}" alt="Eventbild ${escapeHtml(event.title)}" loading="eager" decoding="async" fetchpriority="high" ${liveImageAttrs("event")}>${eventImageRights}</figure>
        ${ticketStatusCard}
        ${!restricted && eventAddressMarkup(event) ? `<div class="event-quick-address"><span>Veranstaltungsadresse</span><strong>${escapeHtml(event.locationName || "")}</strong><div>${eventAddressMarkup(event)}</div></div>` : ""}
        ${restricted ? `<div class="alert alert--warning">Details und Anmeldung dieses Mitglieder-Events stehen nach dem Login zur Verfuegung.</div>` : ""}
        <h2>Zum Event</h2>${eventPageText ? `<div class="lead editorial-text event-detail-text">${articleParagraphs(eventPageText)}</div>` : ""}
        ${restricted ? "" : registrationCta}${eventLiveCta}
        ${restricted ? "" : eventScheduleMarkup(event, topics, speakers)}
        ${retrospectiveText ? `<h2>Rückblick</h2><div class="editorial-text">${articleParagraphs(retrospectiveText)}</div>` : ""}
        ${event.lunchNote ? `<div class="alert">${escapeHtml(event.lunchNote)}</div>` : ""}
        ${restricted ? "" : `<section class="venue-stage venue-stage--event-detail"><div class="venue-stage__identity"><p class="eyebrow">${event.isVirtualEvent ? "Online-Teilnahme" : "Veranstaltungsort"}</p>${!event.isVirtualEvent && coHost && coHostLogo ? `<img class="venue-stage__logo" src="${escapeHtml(coHostLogo)}" alt="Logo ${escapeHtml(coHost.name || "")}" ${liveImageAttrs("sponsor")}>` : ""}${event.isVirtualEvent ? eventLocationDetailMarkup(event) : `<h2>${escapeHtml(coHost?.name || event.locationName || "Ort wird bekanntgegeben")}</h2>${eventAddressMarkup(event) ? `<p>${eventAddressMarkup(event)}</p>` : ""}`}</div>${suppressCoHost ? "" : `<div class="venue-stage__description"><p class="eyebrow">Co-Gastgeber</p>${coHost ? `${coHost.description ? `<p>${escapeHtml(coHost.description)}</p>` : `<p>${escapeHtml(coHost.name)} begleitet dieses PROdigitalTV Event als Co-Gastgeber.</p>`}` : `<p>Co-Gastgeber wird bei Bekanntgabe ergaenzt.</p>`}</div>`}</section>`}
        ${assignedGalleryImages.length ? galleryPlayCta(assignedGallery, assignedGalleryImages) : ""}
      </article>
      <aside class="detail-aside">
        <div class="event-host-card">
          <p class="eyebrow">Gastgeber</p>
          <strong>PROdigitalTV</strong>
          ${coHost ? `<div class="event-host-card__cohost"><span>Co-Gastgeber</span>${coHostLogo ? `<img src="${escapeHtml(coHostLogo)}" alt="Logo ${escapeHtml(coHost.name || "")}" ${liveImageAttrs("sponsor")}>` : ""}<b>${escapeHtml(coHost.name || "")}</b></div>` : ""}
        </div>
        <span class="tag ${event.accessType !== "public" ? "tag--red" : ""}">${accessLabels[event.accessType]}</span>
        <div class="fact"><label>Datum</label><strong>${formatDate(event.date)}</strong></div>
        ${event.startTime ? `<div class="fact"><label>Zeit</label><strong>${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""} Uhr</strong></div>` : ""}
        <div class="fact"><label>Ort</label><strong>${escapeHtml(eventLocationDisplay(event))}</strong>${eventAddressMarkup(event) ? `<small class="event-fact-address">${eventAddressMarkup(event)}</small>` : ""}</div>
        <div class="fact"><label>Status</label><strong>${escapeHtml(eventRegistrationStatusLabel(event))}</strong></div>
      </aside>
    </div></section>`;
  if (canUseCachedDetail) writePageContentCache(eventDetailCacheName(id), eventDetailCacheVariant(id), eventDetailContent);
  return publicShell("events", eventDetailContent);
}

export async function registrationConfirmPage(token = "") {
  if (!token) return publicShell("events", `${subhero("Anmeldung", "Bestaetigungslink unvollstaendig.", "Bitte oeffnen Sie den Link aus Ihrer E-Mail erneut.")}`);
  try {
    const result = await confirmRegistration(token);
    return publicShell("events", `${subhero("Anmeldung bestaetigt", result.eventTitle || "Ihre Veranstaltung", "Ihre Anmeldung ist bestaetigt. Push kann jetzt direkt auf diesem Geraet aktiviert werden.")}
      <section class="section"><div class="container" style="max-width:760px">
        <div class="form-card login-card">
          <p class="eyebrow">Event-Erinnerung</p>
          <h2>${escapeHtml(result.eventTitle || "PROdigitalTV Event")}</h2>
          <p>${escapeHtml(registrationPartyLabel(result) || "Ihre Anmeldung")}</p>
          <div class="alert alert--success">Ihre E-Mail ist bestaetigt. Wenn Sie Push-Nachrichten wuenschen, aktivieren Sie diese jetzt direkt hier auf dem Geraet.</div>
          ${pushControls(result.eventId, { auto: true, primary: true, status: "Wenn Push im Browser schon erlaubt ist, wird dieses Geraet automatisch verknuepft. Sonst bitte einmal aktivieren." })}
          ${result.ticketLink ? `<a class="button button--secondary" href="${escapeHtml(result.ticketLink)}">Ticket oeffnen</a>` : ""}
          <a class="button button--primary" href="#/events">Zu den Events</a>
        </div>
      </div></section>`);
  } catch (error) {
    return publicShell("events", `${subhero("Anmeldung", "Bestaetigung nicht moeglich.", escapeHtml(error.message || String(error)))}<section class="section"><div class="container"><a class="button button--secondary" href="#/events">Zu den Events</a></div></section>`);
  }
}
export async function registrationPage(id, query = new URLSearchParams()) {
  const checkinMode = query.get("source") === "checkin";
  const checkinToken = checkinMode ? query.get("access") || "" : "";
  let event;
  try {
    event = await getPublicRouteEvent(id, true);
  } catch {
    return publicShell("events", `${subhero("Anmeldung", "Eventdaten konnten nicht geladen werden", "Bitte oeffnen Sie die Anmeldung aus der Eventseite erneut.")}<section class="section"><div class="container"><a class="button button--primary" href="#/events">Zu den Events</a></div></section>`);
  }
  if (!event) return notFoundPage();
  const deviceTickets = listStoredTickets(event.id);
  const invitationToken = /^[a-f0-9]{48}$/.test(query?.get?.("invite") || "") ? query.get("invite") : "";
  let prefill = {};
  if (invitationToken) prefill = await getEventRegistrationPrefill(event.id, invitationToken).catch(() => ({})) || {};
  if (!prefill.email && currentUser()?.email && !deviceTickets.length) {
    const user = currentUser();
    const parts = String(user.displayName || "").trim().split(/\s+/);
    prefill = { email: user.email, firstName: parts.length > 1 ? parts[0] : "", lastName: parts.length > 1 ? parts.slice(1).join(" ") : "" };
  }
  const prefillValue = key => escapeHtml(String(prefill[key] || ""));
  const prefillNotice = prefill.email ? `<p class="alert alert--success registration-prefill-notice">Ihre bekannten Kontaktdaten wurden vorausgefüllt. Sie können alle Angaben vor dem Absenden ändern.</p>` : "";
  if (!eventRegistrationIsOpen(event)) {
    return publicShell("events", `${subhero(checkinMode ? "Einlass-Anmeldung" : "Anmeldung", event.title, "Fuer dieses Event ist aktuell keine Anmeldung moeglich.")}
      <section class="section"><div class="container" style="max-width:820px"><div class="alert">${event.preStatus === "save_the_date" ? "Save the Date: Fuer dieses Event ist noch keine Anmeldung moeglich." : "Die Anmeldung ist derzeit geschlossen."}</div><a class="button button--secondary" href="#/event/${escapeHtml(event.id)}">Zurueck zum Event</a></div></section>`);
  }
  return publicShell("events", `${subhero(checkinMode ? "Einlass-Anmeldung" : "Anmeldung", event.title, `${formatDate(event.date)} · ${eventLocationDisplay(event)}`)}
    <section class="section"><div class="container registration-container"><form id="registration-form" data-event-id="${event.id}" data-checkin-mode="${checkinMode ? "1" : "0"}" data-checkin-token="${escapeHtml(checkinToken)}" class="form-card registration-form">
      <div class="registration-summary">
        <div><span>Event</span><strong>${escapeHtml(event.title || "")}</strong></div>
        <div><span>Termin</span><strong>${escapeHtml(formatDate(event.date))}${event.startTime ?` - ${escapeHtml(event.startTime)} Uhr` : ""}</strong></div>
        <div><span>Ort</span><strong>${escapeHtml(eventLocationDisplay(event))}</strong>${eventAddressMarkup(event) ? `<small class="registration-summary__address">${eventAddressMarkup(event)}</small>` : ""}</div>
      </div>
      ${prefillNotice}
      ${deviceTickets.length ? `<div class="alert alert--warning"><strong>Auf diesem Handy ist bereits ein Ticket gespeichert:</strong> ${deviceTickets.map((ticket) => escapeHtml(registrationPartyLabel(ticket))).join(", ")}. Sie können eine weitere Person anmelden. Beim Einlass wählen Sie aus, wen Sie einchecken möchten. Der Event-Chat verwendet weiterhin das separat angemeldete Benutzerkonto.</div>` : ""}
      <div class="alert">${checkinMode
        ? "Sie melden sich direkt am Einlass an. Nach dem Speichern sind Sie angemeldet und eingecheckt."
        : event.accessType === "members_only"
        ? "Dieses Event ist fuer Mitglieder und deren eingeladene Gaeste vorgesehen. Bitte melden Sie sich einfach mit Name und E-Mail an; das System gleicht die E-Mail mit vorhandenen Datensaetzen ab."
        : "Ihre Anmeldung ist erst nach Bestaetigung Ihrer E-Mail-Adresse gueltig."}</div>
      <fieldset class="registration-section"><legend>Person und Kontakt</legend>
      <p class="muted">Für den persönlichen Event-Chat benötigt jede Person eine eigene E-Mail-Adresse. Ein Handy kann mehrere Einlass-Tickets verwalten; der Chat bleibt dem jeweils angemeldeten Konto zugeordnet.</p>
      <div class="form-grid--two"><div class="field"><label for="firstName">Vorname *</label><input id="firstName" name="firstName" autocomplete="given-name" value="${prefillValue("firstName")}" required></div><div class="field"><label for="lastName">Nachname *</label><input id="lastName" name="lastName" autocomplete="family-name" value="${prefillValue("lastName")}" required></div></div>
      <div class="form-grid--two"><div class="field"><label for="company">Unternehmen</label><input id="company" name="company" autocomplete="organization" value="${prefillValue("company")}"></div><div class="field"><label for="position">Position / Funktion</label><input id="position" name="position" autocomplete="organization-title" value="${prefillValue("position")}"></div></div>
      <div class="field"><label for="linkedIn">LinkedIn-Profil (optional)</label><input id="linkedIn" name="linkedIn" type="url" autocomplete="url" placeholder="https://www.linkedin.com/in/..." value="${prefillValue("linkedIn")}"></div>
      <div class="form-grid--two"><div class="field"><label for="email">E-Mail *</label><input id="email" name="email" type="email" autocomplete="email" value="${prefillValue("email")}" required></div><div class="field"><label for="phone">Mobilnummer mit Landesvorwahl *</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+49 170 1234567" value="${prefillValue("phone")}" required><small>Bitte mit + und Landesvorwahl eingeben. Falls Ihre E-Mail-Bestätigung ausbleibt, senden wir nach etwa 30 Minuten einmalig eine SMS mit dem Bestätigungslink.</small></div></div>
      ${event.invitationCodeRequired ? `<div class="field"><label for="invitationCode">Einladungscode *</label><input id="invitationCode" name="invitationCode" autocomplete="one-time-code" required></div>` : ""}
      </fieldset>
      <fieldset class="registration-section registration-section--compact"><legend>Zweite Person mit anmelden</legend>
        <label class="checkbox"><input type="checkbox" name="hasCompanion" data-registration-companion-toggle> Ich melde eine zweite Person mit an</label>
        <div data-registration-companion-fields hidden>
          <div class="form-grid--two"><div class="field"><label for="companionFirstName">Vorname der Begleitperson *</label><input id="companionFirstName" name="companionFirstName" autocomplete="off" disabled></div><div class="field"><label for="companionLastName">Nachname der Begleitperson *</label><input id="companionLastName" name="companionLastName" autocomplete="off" disabled></div></div>
          <div class="form-grid--two"><div class="field"><label for="companionEmail">E-Mail der Begleitperson *</label><input id="companionEmail" name="companionEmail" type="email" autocomplete="off" disabled></div><div class="field"><label for="companionPhone">Mobilnummer der Begleitperson mit Landesvorwahl *</label><input id="companionPhone" name="companionPhone" type="tel" inputmode="tel" autocomplete="off" placeholder="+49 170 1234567" disabled></div></div>
          <div class="field"><label for="companionLinkedIn">LinkedIn-Profil der Begleitperson (optional)</label><input id="companionLinkedIn" name="companionLinkedIn" type="url" autocomplete="off" placeholder="https://www.linkedin.com/in/..." disabled></div>
          <p class="muted">Die zweite Person wird als eigenständige Anmeldung geführt und erhält an ihre E-Mail-Adresse einen eigenen Bestätigungslink sowie ein eigenes Ticket.</p>
        </div>
      </fieldset>
      <fieldset class="registration-section registration-section--compact"><legend>Hinweise und Einwilligungen</legend>
      <div class="field"><label for="message">Bemerkung</label><textarea id="message" name="message" rows="3"></textarea></div>
      <div class="registration-consents">
      <label class="checkbox"><input type="checkbox" name="notifyForThisEvent"><span class="registration-consent-summary"><strong>Event-Erinnerungen erhalten</strong><small>Per E-Mail, Push oder SMS; jederzeit abbestellbar.</small></span></label>
      <label class="checkbox registration-push-choice"><input type="checkbox" name="enablePushCommunication"><span class="registration-consent-summary"><strong>Push auf diesem Gerät aktivieren</strong><small>Gilt für alle PROdigitalTV-Mitteilungen. Ohne Auswahl bleiben bestehende Einstellungen unverändert.</small></span></label>
      <p class="muted" data-notification-device-status></p>
      <label class="checkbox checkbox--required registration-consent-info"><input type="checkbox" name="privacyMediaConsent" required><span>Datenschutz und Foto-/Video-Hinweis akzeptiert *</span><small>Daten werden für die Anmeldung verarbeitet; Aufnahmen können für Dokumentation und Öffentlichkeitsarbeit genutzt werden.</small></label>
      </div></fieldset>
      <div class="registration-submit"><button class="button button--primary" type="submit">${checkinMode ? "Anmelden und einchecken" : "Anmeldung absenden"}</button><div id="form-result" role="status" aria-live="polite"></div></div>
    </form></div></section>`);
}

export async function notificationUnsubscribePage(hash = "") {
  return publicShell("events", `${subhero("Benachrichtigungen", "Veranstaltungserinnerungen abmelden", "Wenn Sie keine PROdigitalTV-Veranstaltungserinnerungen mehr erhalten moechten, koennen Sie diese hier abbestellen.")}
    <section class="section"><div class="container"><div class="form-card login-card">
      <h2>Erinnerungen abbestellen</h2>
      <p class="muted">Diese Abmeldung betrifft nur freiwillige Veranstaltungshinweise und Erinnerungen. Notwendige Mails zu bestehenden Anmeldungen, Tickets oder Stornierungen bleiben davon unberuehrt.</p>
      <button class="button button--primary" type="button" data-notification-unsubscribe="${escapeHtml(hash || "")}">Keine Erinnerungen mehr erhalten</button>
      <div id="notification-unsubscribe-result" style="margin-top:18px"></div>
    </div></div></section>`);
}

export async function topicsPage() {
  const cachedTopics = readPageContentCache("topics", "public", 600000);
  if (cachedTopics) return publicShell("topics", cachedTopics);
  const leanTopics = mobileLeanStart();
  const withTopicsTimeout = (promise, fallback = [], ms = 6000) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
  const [topicsRaw, speakers, mediaAssets, events] = await Promise.all([
    listPublicContent("topics"),
    listPublicContent("speakers").catch(() => []),
    withTopicsTimeout(listPublicMediaAssets().catch(() => []), [], leanTopics ? 2500 : 8000),
    listPublicEvents().catch(() => [])
  ]);
  const speakerForTopic = (topic = {}) => speakers.find((speaker) => {
    const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
    return topicSpeakerIds.has(speaker.id) || speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
  }) || {};
  const topics = publicReleasedTopics(topicsRaw, events).map((topic) => {
    const speaker = speakerForTopic(topic);
    const topicAsset = publicTopicMediaAsset(topic, mediaAssets, "card");
    const ownImage = publicTopicCardImageUrl(topic, mediaAssets);
    const ownImageType = publicTopicImageLooksLikeLogo(topic, topicAsset || {}, ownImage) ? "logo" : "image";
    const logoUrl = topic.companyLogoUrl || topic.logoUrl || topic.company_logo_url || speaker.companyLogoUrl || speaker.logoUrl || speaker.company_logo_url || "";
    const speakerPhoto = speaker.photoUrl || speaker.imageUrl || "";
    return {
      ...topic,
      cardImageUrl: ownImage || logoUrl || speakerPhoto || "",
      cardImageType: ownImage ? ownImageType : logoUrl ? "logo" : speakerPhoto ? "portrait" : ""
    };
  });
  const initialVisible = 9;
  const topicCards = topics.map((topic, index) => {
    const hidden = index >= initialVisible;
    return `<div class="topic-load-item" data-topic-load-item ${hidden ? "hidden" : ""}>${topicCard(topic)}</div>`;
  }).join("");
  const loadMore = topics.length > initialVisible
    ? `<div class="topic-load-more"><button class="button button--secondary" type="button" data-topic-load-more data-topic-load-step="6">Mehr Themen laden</button><small data-topic-load-count>${Math.min(initialVisible, topics.length)} von ${topics.length} Themen sichtbar</small></div>`
    : "";
  const topicsContent = `${subhero("Themen", "Die Agenda der digitalen Medienwirtschaft.", "PROdigitalTV buendelt relevante Fragestellungen und bringt sie in konkreten Events zur Diskussion.")}
    <section class="section"><div class="container"><div class="card-grid card-grid--three editorial-list editorial-list--topics" data-topic-load-list>${topicCards}</div>${loadMore}</div></section>`;
  writePageContentCache("topics", "public", topicsContent);
  return publicShell("topics", topicsContent);
}

export async function newsPage(query = new URLSearchParams()) {
  const rawSelectedCategory = String(query?.get?.("category") || "").trim();
  const displayNewsCategory = (category = "") => {
    const value = String(category || "").trim();
    if (!value || /^(?:ki[-\s_]*)?news[-\s_]*import$/i.test(value)) return "News";
    return value;
  };
  const selectedCategory = rawSelectedCategory ? displayNewsCategory(rawSelectedCategory) : "";
  const newsVariant = selectedCategory ?`category:${selectedCategory}` : "public";
  const cachedNews = readPageContentCache("news", newsVariant, 600000);
  if (cachedNews) return publicShell("news", cachedNews);
  const [editorialContent, mediaAssets] = await Promise.all([listPublicContent("editorialContent"), listPublicMediaAssets().catch(() => [])]);
  const cmsNews = publicNewsItems(editorialContent);
  const galleries = cmsNews.some((item) => [item.galleryId, item.gallery_id, item.galleryIa, item.linkedGalleryId, item.linkeaGalleryIa, item.gallery].some(Boolean))
    ? await listPublicContent("galleries").catch(() => [])
    : [];
  const news = cmsNews.sort(newestContentFirst);
  const categoryHref = (category) => `#/news?category=${encodeURIComponent(category || "News")}`;
  const newsCategories = (item = {}) => {
    const values = Array.isArray(item.category) ? item.category : [item.category || "News"];
    const categories = values
      .flatMap((value) => String(value || "").split(/\s*(?:\/|,|;|\|)\s*/))
      .map(displayNewsCategory)
      .filter(Boolean);
    return [...new Set(categories.length ? categories : ["News"])];
  };
  const allCategories = Array.from(new Set(news.flatMap(newsCategories))).sort((a, b) => {
    if (a === "News") return -1;
    if (b === "News") return 1;
    return a.localeCompare(b, "de", { sensitivity: "base" });
  }).slice(0, 10);
  const categoryLinks = (item = {}) => newsCategories(item)
    .map((category) => `<a class="news-category-link" href="${escapeHtml(categoryHref(category))}">${escapeHtml(category)}</a>`)
    .join(`<span class="news-category-separator"> / </span>`);
  const filteredNews = selectedCategory
    ? news.filter((item) => newsCategories(item).includes(selectedCategory))
    : news;
  const featuredNews = filteredNews.slice(0, 6);
  const listedNews = filteredNews.slice(6);
  const newsAudioOptions = (item) => ({
    audio: item.audio || {},
    audioProvider: item.audioProvider || "",
    audioUrl: item.audioUrl || "",
    audioAccessibleUrl: item.audioAccessibleUrl || "",
    audioNaturalUrl: item.audioNaturalUrl || "",
    timingUrl: item.timingUrl || "",
    audioStatus: item.audioStatus || "",
    audioAccessibleStatus: item.audioAccessibleStatus || "",
    audioNaturalStatus: item.audioNaturalStatus || ""
  });
  const hasPlayableNewsAudio = (item) => Boolean(ttsReader(newsAudioOptions(item)));
  const newsCard = (item) => {
    const cardImage = publicEditorialCardImage(item, mediaAssets);
    const thumb = cardImage.url;
    const teaser = item.shortText || item.teaserText || item.introText || item.bodyText || "";
    const category = newsCategories(item)[0] || "News";
    const detailHref = `#/news/${escapeHtml(item.id)}`;
    return `<article class="quick-card news-card"><a class="news-card__thumb-link" href="${detailHref}"><figure class="news-card__thumb"><img src="${escapeHtml(thumb)}"${cardImage.srcset ? ` srcset="${cardImage.srcset}" sizes="(max-width: 760px) 92vw, 390px"` : ""} alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="lazy" decoding="async" ${liveImageAttrs("news")}></figure></a><div class="news-card__body"><p class="eyebrow news-category-list">${categoryLinks(item)}${hasPlayableNewsAudio(item) ? " · Audio" : ""}</p><h3><a href="${detailHref}">${escapeHtml(item.title || "")}</a></h3>${item.subtitle ? `<p class="news-card__subtitle">${escapeHtml(item.subtitle)}</p>` : ""}<p class="news-card__teaser">${escapeHtml(teaser).slice(0, 320)}</p></div></article>`;
  };
  const newsListItem = (item) => {
    const date = item.publishDate || item.validFrom || item.updatedAt || item.createdAt || "";
    const teaser = item.shortText || item.teaserText || item.introText || item.subtitle || item.bodyText || "";
    const category = newsCategories(item)[0] || "News";
    const cardImage = publicEditorialCardImage(item, mediaAssets, 360);
    const thumb = cardImage.url;
    return `<article class="news-list-item">
      <a class="news-list-item__thumb" href="#/news/${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title || "News")}"><img src="${escapeHtml(thumb)}"${cardImage.srcset ? ` srcset="${cardImage.srcset}" sizes="(max-width: 760px) 92vw, 180px"` : ""} alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="lazy" decoding="async" ${liveImageAttrs("news")}></a>
      <div class="news-list-item__body">
        <span class="news-list-item__meta">${categoryLinks(item)}${date ? ` / ${escapeHtml(formatDate(date))}` : ""}${hasPlayableNewsAudio(item) ? " / Audio" : ""}</span>
        <strong><a href="#/news/${escapeHtml(item.id)}">${escapeHtml(item.title || "")}</a></strong>
        ${teaser ? `<span>${escapeHtml(teaser).slice(0, 170)}</span>` : ""}
      </div>
    </article>`;
  };
  const newsFlipCard = (item, index) => {
    const cardImage = publicEditorialCardImage(item, mediaAssets);
    const date = item.publishDate || item.validFrom || item.updatedAt || item.createdAt || "";
    const teaserSource = item.shortText || item.teaserText || item.introText || item.bodyText || item.longDescription || item.articleText || item.mainText || item.text || "";
    const teaserBody = cleanNewsDetailText(teaserSource, item.title || "", item.subtitle || "", item.slug || item.key || item.id || "");
    const teaser = teaserText([item.subtitle, teaserBody].filter(Boolean).join(" "), 240);
    return `<article class="news-flip-card${index === 0 ? " is-active" : ""}" data-news-flip-card role="button" tabindex="${index === 0 ? "0" : "-1"}" aria-label="${escapeHtml(item.title || "News")} lesen" aria-hidden="${index === 0 ? "false" : "true"}">
      <div class="news-flip-card__image"><img src="${escapeHtml(cardImage.url)}"${cardImage.srcset ? ` srcset="${cardImage.srcset}" sizes="92vw"` : ""} alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" ${liveImageAttrs("news")}><span class="news-flip-card__category">${escapeHtml(newsCategories(item)[0] || "News")}${hasPlayableNewsAudio(item) ? " · Audio" : ""}</span></div>
      <div class="news-flip-card__content"><h2>${escapeHtml(item.title || "")}</h2>
      ${teaser ? `<p class="news-flip-card__teaser">${escapeHtml(teaser)}</p>` : ""}
      <span class="news-flip-card__meta">PROdigitalTV${date ? ` · ${escapeHtml(formatDate(date))}` : ""}</span></div>
    </article>`;
  };
  const newsFlipArticle = (item) => {
    const date = item.publishDate || item.validFrom || item.updatedAt || item.createdAt || "";
    const title = cleanNewsDetailTitle(item);
    const text = item.longDescription || item.articleText || item.bodyText || item.mainText || item.text || item.fullText || item.longText || item.shortText || item.teaserText || "";
    const body = cleanNewsDetailText(text, title, item.subtitle || "", item.slug || item.key || item.id || "");
    const gallery = articleGallery(item, galleries);
    const galleryImages = visibleGalleryImages(gallery || {}).slice(0, 12);
    return `<template data-news-flip-article><p class="news-flip__reader-meta">${escapeHtml(newsCategories(item)[0] || "News")}${date ? ` · ${escapeHtml(formatDate(date))}` : ""}</p>
      <h2>${escapeHtml(title)}</h2>${item.subtitle ? `<p class="news-flip__reader-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
      ${ttsReader({ rubric: newsCategories(item)[0] || "News", title, label: "Vorlesen", text: [item.subtitle, body].filter(Boolean).join("\n\n"), inlineOffsetText: item.subtitle || "", ...newsAudioOptions(item) })}
      <div class="editorial-text">${articleParagraphs(body)}</div>
      ${galleryPlayCta(gallery, galleryImages)}</template>`;
  };
  const newsContent = `${subhero("News", "Aktuelles von PROdigitalTV.", "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.")}
    <section class="section"><div class="container">${news.length ? `
      <div class="news-category-nav" aria-label="News-Kategorien">
        <a class="news-category-pill ${selectedCategory ? "" : "is-active"}" href="#/news">Alle</a>
        ${allCategories.map((category) => `<a class="news-category-pill ${selectedCategory === category ? "is-active" : ""}" href="${escapeHtml(categoryHref(category))}">${escapeHtml(category)}</a>`).join("")}
      </div>
      ${selectedCategory ? `<div class="news-filter-state"><span>Rubrik: <strong>${escapeHtml(selectedCategory)}</strong></span><a class="button button--secondary button--small" href="#/news">Alle News</a></div>` : ""}
      ${filteredNews.length ? `<div class="news-mobile-toolbar"><h1>News</h1><div class="news-mobile-mode" data-news-mode-switch role="group" aria-label="News-Ansicht"><button type="button" data-news-mode="classic" aria-pressed="true">Klassisch</button><button type="button" data-news-mode="flip" aria-pressed="false">Flip</button></div></div>` : ""}
      <div data-news-classic><div class="card-grid card-grid--three editorial-list editorial-list--news">${featuredNews.map(newsCard).join("")}</div>
      ${listedNews.length ? `<div class="news-list-view"><div class="section-head"><div><p class="eyebrow">Weitere News</p><h2>${selectedCategory ? `Weitere Meldungen in ${escapeHtml(selectedCategory)}` : "Alle weiteren Meldungen"}</h2></div></div>${listedNews.map(newsListItem).join("")}</div>` : ""}</div>
      ${filteredNews.length ? `<div class="news-flip" data-news-flip tabindex="0" aria-label="News mit Wischgeste oder Pfeiltasten durchblaettern"><div class="news-flip__stage">${filteredNews.map(newsFlipCard).join("")}</div><div class="news-flip__controls"><span class="news-flip__label">News</span><span data-news-flip-count role="status" aria-live="polite">1 / ${filteredNews.length}</span></div><div class="news-flip__reader" data-news-flip-reader role="dialog" aria-modal="true" aria-label="Artikeltext" tabindex="-1" hidden><div class="news-flip__reader-toolbar"><button class="news-flip__reader-top-back" type="button" data-news-flip-reader-close aria-label="Zurück zur News" title="Zurück zur News">←</button><span>News</span></div><div class="news-flip__reader-inner"><div data-news-flip-reader-content></div><button class="news-flip__reader-back" type="button" data-news-flip-reader-close aria-label="Zurück zur News" title="Zurück zur News">→</button></div></div>${filteredNews.map(newsFlipArticle).join("")}</div>` : ""}
      ${!filteredNews.length ? `<div class="alert">Zu dieser Rubrik sind aktuell keine News veröffentlicht.</div>` : ""}
    ` : `<div class="alert">Aktuell sind keine News veröffentlicht.</div>`}</div></section>`;
  writePageContentCache("news", newsVariant, newsContent);
  return publicShell("news", newsContent);
}

export async function newsDetailPage(id) {
  const publicEditorialContent = await listPublicContent("editorialContent").catch(() => []);
  let item = publicEditorialContent.find((entry) => [entry.id, entry.slug, entry.key].filter(Boolean).includes(id))
    || await getOne("editorialContent", id).catch(() => null);
  const isRetrospective = isRetrospectiveArticle(item);
  if (!item || (item.page !== "news" && item.section !== "news" && !isRetrospective)) return notFoundPage();
  if (!isRetrospective && !publicNewsItems([item]).length) return notFoundPage();
  const [sponsors, galleries, events, allMediaAssets] = await Promise.all([listPublicContent("sponsors"), listPublicContent("galleries"), listPublicEvents(), listPublicMediaAssets().catch(() => [])]);
  if (isRetrospective && !retrospectiveArticleIsVisible(item, events)) return notFoundPage();
  const date = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  const text = item.longDescription || item.articleText || item.bodyText || item.mainText || item.text || item.fullText || item.longText || item.shortText || item.teaserText || "";
  const displayTitle = cleanNewsDetailTitle(item);
  const displayText = cleanNewsDetailText(text, displayTitle, item.subtitle || "", item.slug || item.key || item.id || "");
  const sponsor = item.sponsorId ? sponsors.find((entry) => entry.id === item.sponsorId) : null;
  const linkedEvent = retrospectiveLinkedEvent(item, events);
  const mediaAssets = isRetrospective && linkedEvent
    ? await listPublicEventMediaAssets([linkedEvent]).catch(() => [])
    : allMediaAssets;
  const articleImageAsset = isRetrospective && linkedEvent
    ? publicEventMediaAsset(linkedEvent, mediaAssets, "detail") || publicEditorialMediaAsset(item, mediaAssets)
    : publicEditorialMediaAsset(item, mediaAssets);
  const articleImageUrl = stableImageUrl(isRetrospective
    ? retrospectiveThumbUrl(item, linkedEvent, galleries, mediaAssets)
    : mediaAssetUrl(articleImageAsset || {}) || item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || (linkedEvent ? archiveEventImageUrl(linkedEvent, mediaAssets) : ""), isRetrospective ? "event" : "news");
  const articleImageRights = imageRightsDisclosure(item, articleImageAsset);
  const selectedGallery = item.galleryId ? galleries.find((gallery) => gallery.id === item.galleryId) : null;
  const attachedGalleryImages = Array.isArray(selectedGallery?.images)
    ? [...selectedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 12)
    : [];
  const leadMedia = attachedGalleryImages.length ? galleryPlayCta(selectedGallery, attachedGalleryImages) : "";
  const detailSection = isRetrospective ? "archive" : "news";
  const detailTitle = isRetrospective ? "Rückblick" : "News";
  const detailIntro = isRetrospective ? "Nachbericht, Bilder und Dokumentation vergangener PROdigitalTV-Veranstaltungen." : "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.";
  const backHref = isRetrospective ? "#/archive" : "#/news";
  const backText = isRetrospective ? "Zurück zu Rückblick" : "Zurück zu News";
  const sectionLabel = isRetrospective ? "Rückblick" : item.category || "News";
  const allText = isRetrospective ? "Alle Rückblicke" : "Alle News";
  if (!isRetrospective) {
    return publicShell("news", `<section class="section news-detail-clean-section"><div class="container">
      <article class="news-detail-clean">
        <a class="link news-detail-clean__back" href="#/news">Zur&uuml;ck zu News</a>
        <figure class="news-detail-clean__hero"><img src="${escapeHtml(articleImageUrl)}" alt="${escapeHtml(item.thumbnail_alt || item.thumbnailAlt || `Artikelmotiv ${displayTitle || "News"}`)}" loading="eager" decoding="async" ${liveImageAttrs("news")}>${articleImageRights}<figcaption><h1>${escapeHtml(displayTitle)}</h1></figcaption></figure>
        <div class="news-detail-clean__body">
          ${item.subtitle ? `<p class="article-subline">${escapeHtml(item.subtitle)}</p>` : ""}
          ${ttsReader({ rubric: item.category || "News", title: displayTitle || "", label: "Vorlesen", text: [item.subtitle, displayText].filter(Boolean).join("\n\n"), inlineOffsetText: item.subtitle || "", audio: item.audio || {}, audioProvider: item.audioProvider || "", audioUrl: item.audioUrl || "", audioAccessibleUrl: item.audioAccessibleUrl || "", audioNaturalUrl: item.audioNaturalUrl || "", timingUrl: item.timingUrl || "", audioStatus: item.audioStatus || "", audioAccessibleStatus: item.audioAccessibleStatus || "", audioNaturalStatus: item.audioNaturalStatus || "" })}
          <div class="editorial-text">${articleParagraphs(displayText)}</div>
          ${aiDisclosureNote(item)}
          ${articleVideosBlock(item)}
          ${newsDetailSources(item)}
          ${newsDetailKeywords(item)}
        </div>
      </article>
    </div></section>`);
  }
  return publicShell(detailSection, `${subhero("", detailTitle, detailIntro)}
    <section class="section"><div class="container detail-grid">
      <article class="detail-main news-detail">
        <a class="link news-detail__back" href="${backHref}">${backText}</a>
        <p class="eyebrow">${escapeHtml(item.category || "News")}${date ? ` · ${formatDate(date)}` : ""}</p>
        ${articleHeader({
          title: item.title || "",
          intro: item.subtitle || ""
        })}
        <figure class="news-detail__thumb news-detail__hero-image"><img src="${escapeHtml(articleImageUrl)}" alt="${escapeHtml(item.thumbnail_alt || item.thumbnailAlt || `Artikelmotiv ${item.title || "News"}`)}" loading="eager" decoding="async" ${liveImageAttrs(isRetrospective ? "event" : "news")}>${articleImageRights}</figure>
        ${ttsReader({ rubric: isRetrospective ? "Rückblick" : item.category || "News", title: item.title || "", text: [item.subtitle, text].filter(Boolean).join("\n\n"), inlineOffsetText: item.subtitle || "", audio: item.audio || {}, audioProvider: item.audioProvider || "", audioUrl: item.audioUrl || "", audioAccessibleUrl: item.audioAccessibleUrl || "", audioNaturalUrl: item.audioNaturalUrl || "", timingUrl: item.timingUrl || "", audioStatus: item.audioStatus || "", audioAccessibleStatus: item.audioAccessibleStatus || "", audioNaturalStatus: item.audioNaturalStatus || "" })}
        <div class="editorial-text">${leadMedia}${item.subtitle ? `<p class="article-subline">${escapeHtml(item.subtitle)}</p>` : ""}${articleParagraphs(text)}</div>
        ${aiDisclosureNote(item)}
        ${articleVideosBlock(item)}
        ${articleSourcesList(item)}
      </article>
      <aside class="detail-aside">
        ${sponsor?.logoUrl ? `<div class="sponsor-logo-card"><span>${escapeHtml(sponsor.role || "Sponsor")}</span><img src="${escapeHtml(sponsor.logoUrl)}" alt="Logo ${escapeHtml(sponsor.name || "")}" ${liveImageAttrs("sponsor")}><strong>${escapeHtml(sponsor.name || "")}</strong></div>` : ""}
        <div class="fact"><label>Rubrik</label><strong>${escapeHtml(item.isRetrospective ? "Rückblick" : item.category || "News")}</strong></div>
        ${date ? `<div class="fact"><label>Datum</label><strong>${formatDate(date)}</strong></div>` : ""}
        <a class="button button--secondary" href="${backHref}">${allText}</a>
      </aside>
    </div></section>`);
}

export async function topicDetailPage(id, query = new URLSearchParams()) {
  const preview = query?.get?.("preview") === "1" && canUseCms(currentUser());
  const [topic, events, galleries, allTopics, speakers, mediaAssets] = await Promise.all([
    getOne("topics", id),
    preview ? list("events") : listPublicEvents(),
    preview ? list("galleries") : listPublicContent("galleries"),
    preview ? list("topics") : listPublicContent("topics"),
    preview ? list("speakers") : listPublicContent("speakers"),
    listPublicMediaAssets().catch(() => [])
  ]);
  if (!topic) return notFoundPage();
  if (!preview && !topicIsReleasedAfterEvent(topic, events)) return notFoundPage();
  const linked = topicLinkedEvents(topic, events).filter(publicEventAllowsTopicRelease).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const primaryLinkedEvent = linked[0] || {};
  const heroSpeakers = speakers.filter((speaker) => {
    const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
    return topicSpeakerIds.has(speaker.id) || speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
  });
  const relatedTopics = allTopics
    .filter((entry) => entry.id !== topic.id && (preview || topicIsReleasedAfterEvent(entry, events)))
    .slice(0, 8)
    .map((entry) => {
      const topicAsset = publicTopicMediaAsset(entry, mediaAssets, "card");
      const ownImage = publicTopicCardImageUrl(entry, mediaAssets);
      const ownImageType = publicTopicImageLooksLikeLogo(entry, topicAsset || {}, ownImage) ? "logo" : "image";
      return {
        ...entry,
        cardImageUrl: ownImage || entry.cardImageUrl || "",
        cardImageType: ownImage ? ownImageType : entry.cardImageType || ""
      };
    });
  const fallbackEventText = [eventIntroText(primaryLinkedEvent), eventLongText(primaryLinkedEvent)].filter(Boolean).join("\n\n");
  const topicIntro = topic.subtitle || eventIntroText(primaryLinkedEvent) || "Einordnung, Hintergruende und Praxisbezug zu zentralen Begriffen der digitalen Medienwirtschaft.";
  const topicText = topic.longDescription || topic.bodyText || topic.shortDescription || fallbackEventText || "";
  const topicAudioText = [topic.subtitle, topic.longDescription, topic.bodyText, topic.shortDescription, fallbackEventText].filter(Boolean).join("\n\n");
  const topicVisibleText = `${topic.subtitle ? `<p class="article-subline">${escapeHtml(topic.subtitle)}</p>` : ""}${articleParagraphs(topicText)}`;
  const selectedGallery = topic.galleryId ? galleries.find((gallery) => gallery.id === topic.galleryId) : null;
  const attachedGalleryImages = Array.isArray(selectedGallery?.images)
    ? [...selectedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 12)
    : [];
  const leadMedia = attachedGalleryImages.length ? galleryPlayCta(selectedGallery, attachedGalleryImages) : "";
  const editorialBlock = topicText
    ? `<section class="section section--white"><div class="container topic-article">${ttsReader({ rubric: "Thema", title: topic.title || "", text: topicAudioText || topicText, inlineOffsetText: topic.subtitle || "", audio: topic.audio || {}, audioProvider: topic.audioProvider || "", audioUrl: topic.audioUrl || "", audioAccessibleUrl: topic.audioAccessibleUrl || "", audioNaturalUrl: topic.audioNaturalUrl || "", timingUrl: topic.timingUrl || "", audioStatus: topic.audioStatus || "", audioAccessibleStatus: topic.audioAccessibleStatus || "", audioNaturalStatus: topic.audioNaturalStatus || "" })}${topicVisibleText}${aiDisclosureNote(topic)}</div></section>`
    : "";
  const relatedTopicsBlock = relatedTopics.length
    ? `<section class="section section--white section--related-topics"><div class="container"><div class="section-head"><div><p class="eyebrow">Weitere Themen</p><h2>Mehr aus der Rubrik</h2></div></div><div class="card-grid card-grid--four editorial-list editorial-list--topics">${relatedTopics.map(topicCard).join("")}</div></div></section>`
    : "";
  return publicShell("topics", `<section class="section section--article-head section--topic-detail-hero"><div class="container">
      ${topicVisualHeader({
        topic,
        speakers: heroSpeakers,
        title: topic.title || "",
        intro: topicIntro,
        mediaAssets
      })}
    </div></section>
    ${leadMedia ? `<section class="section section--flush"><div class="container">${leadMedia}</div></section>` : ""}
    ${editorialBlock}
    ${relatedTopicsBlock}`);
}

export const aboutPage = internalOverviewPage("ueber_uns");

export async function membersPage() {
  const memberVariant = mobileLeanStart() ? "mobile" : "desktop";
  const cachedMembers = readPageContentCache("members", memberVariant, 600000);
  if (cachedMembers) return publicShell("members", cachedMembers);
  const rawMembers = await fastFallback(publicManagedMembers().catch(() => []), [], mobileLeanStart() ? 4500 : 9000);
  const members = await fastFallback(withPublicMemberLogos(rawMembers).catch(() => rawMembers), rawMembers, mobileLeanStart() ? 2500 : 5000);
  const memberRows = members.map((member) => {
    const teaser = member.description || member.shortDescription || "";
    const searchText = [member.name, teaser, member.city, member.country, member.website].filter(Boolean).join(" ");
    const logoUrl = safeMemberLogoUrl(member, member.logoDisplayUrl || member.logoUrl || "");
    return `<article class="member-directory-card ${logoUrl ? "" : "member-directory-card--no-logo"}" data-member-card data-search="${escapeHtml(searchText.toLowerCase())}"><div class="member-tile">${memberLogo(member, { initialFallback: true })}</div><div class="member-directory-card__body"><h3>${escapeHtml(member.name)}</h3>${teaser ? `<p>${escapeHtml(teaser)}</p>` : ""}<span class="member-directory-card__meta">${escapeHtml(member.city || "")}${member.country ? ` · ${escapeHtml(member.country)}` : ""}</span></div>${member.website ? `<a class="button button--secondary button--small" href="${escapeHtml(member.website)}" target="_blank" rel="noopener">Website</a>` : ""}</article>`;
  }).join("");
  const content = `${subhero("Mitglieder", "Unternehmen im Netzwerk.", "Eine Plattform für Unternehmen, die digitale Medien aktiv weiterentwickeln.")}
    <section class="section"><div class="container"><div class="section-head"><h2>Mitgliedsunternehmen</h2><div class="search"><input data-member-search placeholder="Mitglieder suchen" aria-label="Mitglieder suchen"></div></div><div class="member-directory-list">${memberRows}</div><div class="alert" data-member-empty hidden>Keine passenden sichtbaren Mitglieder gefunden.</div></div></section>`;
  if (members.length) writePageContentCache("members", memberVariant, content);
  return publicShell("members", content);
}

export async function boardPage() {
  const board = (await listPublicContent("boardMembers").catch(() => []))
    .filter((person) => {
      const status = String(person.status || "active").toLowerCase();
      const visibility = String(person.visibility || "public").toLowerCase();
      return !["inactive", "draft", "archived", "deleted"].includes(status) && !["hidden", "private", "internal"].includes(visibility);
    })
    .sort((a, b) => Number(a.sort || a.order || 999) - Number(b.sort || b.order || 999));
  return publicShell("board", `${subhero("Vorstand", "Verantwortung und Perspektive.", "Der Vorstand repraesentiert die Vielfalt und Expertise der digitalen Medienwirtschaft.")}
    <section class="section"><div class="container card-grid card-grid--three board-grid">${board.length ? board.map((person) => `<article class="card board-card"><div class="board-photo ${person.id === "board-beate-busch" ? "board-photo--contain" : ""}">${boardPortrait(person)}</div><p class="eyebrow">${escapeHtml(person.role || "Vorstand")}</p><h3>${escapeHtml(person.name || "Vorstandsmitglied")}</h3>${person.company ? `<p style="margin:8px 0">${escapeHtml(person.company)}</p>` : ""}${person.shortBio ? `<p>${escapeHtml(person.shortBio)}</p>` : ""}</article>`).join("") : `<div class="alert">Der Vorstand wird aktuell vorbereitet.</div>`}</div></section>`);
}

export async function archivePage() {
  const leanMobile = mobileLeanStart();
  const archiveQuery = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "");
  const showAll = archiveQuery.get("all") === "1";
  const archiveVariant = `${leanMobile ? "mobile" : "desktop"}:${showAll ? "all" : "initial"}`;
  const cachedArchive = readPageContentCache("archive", archiveVariant, 600000);
  if (cachedArchive) return publicShell("archive", cachedArchive);
  const withArchiveTimeout = (promise, fallback = [], ms = 6000) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
  const initialLimit = leanMobile ? 8 : 12;
  const [allEvents, sponsors, editorial, galleries, eventMedia] = await Promise.all([
    withArchiveTimeout(listPublicEvents(true).catch(() => []), [], leanMobile ? 5000 : 14000),
    leanMobile ? [] : withArchiveTimeout(listPublicContent("sponsors").catch(() => []), [], 6000),
    withArchiveTimeout(listPublicContent("editorialContent").catch(() => []), [], leanMobile ? 5000 : 12000),
    leanMobile ? [] : withArchiveTimeout(listPublicContent("galleries").catch(() => []), [], 6000),
    leanMobile ? [] : withArchiveTimeout(listPublicContent("eventMedia").catch(() => []), [], 6000)
  ]);
  const events = allEvents.filter((event) => isPastEvent(event))
    .sort((a, b) => (b.date || "0000-00-00").localeCompare(a.date || "0000-00-00"));
  const retrospectives = editorial
    .filter(isRetrospectiveArticle)
    .sort((a, b) => String(b.publishDate || b.validFrom || b.updatedAt || "").localeCompare(String(a.publishDate || a.validFrom || a.updatedAt || "")));
  const linkedRetrospectiveEventIds = new Set(retrospectives.flatMap((item) => [item.linkedEventId, item.galleryEventId]).filter(Boolean));
  const eventEntries = events.map((event) => ({
    kind: "event",
    date: event.date || event.updatedAt || "",
    event
  }));
  const editorialEntries = retrospectives
    .filter((item) => !events.some((event) => linkedRetrospectiveEventIds.has(event.id) && (item.linkedEventId === event.id || item.galleryEventId === event.id)))
    .map((item) => ({
      kind: "editorial",
      date: item.publishDate || item.validFrom || item.updatedAt || "",
      item
    }));
  const combinedEntries = [...eventEntries, ...editorialEntries]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const visibleEntries = showAll ? combinedEntries : combinedEntries.slice(0, initialLimit);
  const visibleEvents = visibleEntries.filter((entry) => entry.kind === "event").map((entry) => entry.event);
  const mediaLookupEvents = visibleEvents
    .filter((event) => !archiveEventImageUrl(event, []))
    .slice(0, leanMobile ? 8 : 16);
  const mediaAssets = await withArchiveTimeout(listPublicEventMediaAssets(mediaLookupEvents).catch(() => []), [], leanMobile ? 2500 : 8000);
  const items = visibleEntries.map((entry) => entry.kind === "event"
    ? archiveListEvent(entry.event, sponsors, mediaAssets, editorial, eventMedia, galleries)
    : archiveListEditorial(entry.item, sponsors, events, mediaAssets, galleries)).join("");
  const totalCount = combinedEntries.length;
  const visibleCount = visibleEntries.length;
  const moreLink = !showAll && totalCount > visibleCount
    ? `<div class="archive-more"><a class="button button--secondary" href="#/archive?all=1">Alle ${totalCount} R&uuml;ckblicke anzeigen</a></div>`
    : "";
  const archiveContent = `${leanMobile ? "" : subhero("Rückblick", "Rückblick", "Nachbericht, Bilder und Dokumentation vergangener PROdigitalTV-Veranstaltungen.")}
    <section class="section"><div class="container"><div class="archive-list archive-list--compact">${items || `<div class="alert">Rückblicke werden aktuell vorbereitet.</div>`}</div>${moreLink}</div></section>`;
  writePageContentCache("archive", archiveVariant, archiveContent);
  return publicShell("archive", archiveContent);
}

export async function downloadsPage() {
  return publicShell("downloads", `${subhero("Downloads", "Dokumente im Mitgliederbereich.", "Vereinssatzung, Beitragsordnung und weitere Unterlagen stehen unseren Mitgliedern geschützt zur Verfügung.")}
    <section class="section"><div class="container" style="max-width:780px"><div class="detail-main">
      <h2>Mitgliederdokumente öffnen</h2>
      <p>Bitte melden Sie sich an. Nach dem Login finden Sie die freigegebenen PDFs im Mitgliederbereich unter „Member Infos“.</p>
      <div class="actions" style="margin-top:22px"><a class="button button--primary" href="#/login">Zum Login</a></div>
    </div></div></section>`);
}

export function webappQrPage() {
  const webappUrl = `https://prodigitaltv-da47b.web.app/?v=${Date.now()}#/home`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=2&data=${encodeURIComponent(webappUrl)}`;
  return publicShell("webapp-qr", `${subhero("WebApp", "QR-Code zur mobilen WebApp.", "Direkt scannen und PROdigitalTV auf dem Smartphone öffnen.")}
    <section class="section"><div class="container webapp-qr-page">
      <article class="webapp-qr-card">
        <figure class="webapp-qr-card__code"><img src="${escapeHtml(qrUrl)}" alt="QR-Code zur PROdigitalTV WebApp" loading="lazy"></figure>
        <div class="webapp-qr-card__copy">
          <p class="eyebrow">PROdigitalTV WebApp</p>
          <h2>QR-Code scannen</h2>
          <p>Der Code fuehrt direkt zur mobilen PROdigitalTV-WebApp.</p>
          <div class="webapp-qr-card__desktop-note"><strong>Am PC oder Mac?</strong><p>Sie muessen den QR-Code nicht scannen. Oeffnen Sie die WebApp einfach direkt ueber den Button oder den angezeigten Link.</p></div>
          <p class="webapp-qr-card__url">${escapeHtml(webappUrl)}</p>
          <div class="actions"><a class="button button--primary" href="${escapeHtml(webappUrl)}" target="_blank" rel="noreferrer">WebApp öffnen</a><a class="button button--secondary" href="#/home">Zur Website</a></div>
        </div>
      </article>
    </div></section>`);
}

export async function ticketLinkPage(token = "") {
  if (!token) return publicShell("events", `${subhero("Ticket", "Ticket-Link unvollstaendig.", "Bitte oeffnen Sie den Link aus Ihrer Bestaetigungsmail erneut.")}`);
  try {
    const result = await linkTicketDevice(token);
    const { isMobileTicketDevice, ticketTransfer } = await import("../components/ticketTransfer.js?v=1");
    const mobile = isMobileTicketDevice();
    const transfer = ticketTransfer(`${location.origin}/#/ticket/link/${encodeURIComponent(token)}`);
    return publicShell("events", `${subhero("Ticket", mobile ? "Handy ist als Eintrittskarte aktiv." : "Ticket auf das Handy uebertragen.", `${escapeHtml(result.eventTitle || "Ihre Anmeldung")} ist auf diesem Geraet gespeichert.`)}
      <section class="section"><div class="container" style="max-width:760px">
        <div class="form-card login-card">
          <p class="eyebrow">Eintrittskarte</p>
          <h2>${escapeHtml(registrationPartyLabel(result))}</h2>
          ${!mobile ? transfer : `<section class="mobile-ticket-card mobile-ticket-card--standalone" aria-label="Aktives Handy-Ticket">
            <div class="mobile-ticket-card__icon" aria-hidden="true"></div>
            <div class="mobile-ticket-card__body">
              <p class="eyebrow">Handy-Ticket aktiv</p>
              <h2>${escapeHtml(result.eventTitle || "PROdigitalTV Event")}</h2>
              <p>${escapeHtml(registrationPartyLabel(result))}</p>
              <span>Dieses Handy ist fuer ${result.participantCount > 1 || result.companion ? "beide Personen" : "den Einlass"} vorbereitet.</span>
            </div>
          </section>`}
          ${pushControls(result.eventId, { auto: true, primary: true, status: "Wenn Push im Browser schon erlaubt ist, wird dieses Geraet automatisch verknuepft. Sonst bitte einmal aktivieren." })}
          <a class="button button--primary" href="#/events">Zu den Events</a>
        </div>
      </div></section>`);
  } catch (error) {
    return publicShell("events", `${subhero("Ticket", "Ticket konnte nicht aktiviert werden.", escapeHtml(error.message || String(error)))}<section class="section"><div class="container"><a class="button button--secondary" href="#/events">Zu den Events</a></div></section>`);
  }
}

export async function ticketRecoveryPage(eventId = "") {
  if (!eventId) return notFoundPage();
  const event = eventId ? await getPublicRouteEvent(eventId, true).catch(() => null) : null;
  const existing = listStoredTickets(eventId);
  return publicShell("events", `${subhero("Handy-Ticket", "Ticket wiederherstellen", event?.title || "")}
    <section class="section"><div class="container ticket-recovery-container">
      <div class="form-card login-card ticket-recovery-card">
        ${existing.length ? `<div class="alert">Auf diesem Handy gespeichert: ${existing.map((ticket) => escapeHtml(registrationPartyLabel(ticket))).join(", ")}. Hier können Sie ein weiteres Ticket verknüpfen.</div>` : ""}
        <p>Geben Sie die E-Mail-Adresse Ihrer bestaetigten Anmeldung ein. Wir senden Ihnen einen sechsstelligen Code.</p>
        <form id="ticket-recovery-request-form" data-event-id="${escapeHtml(eventId)}">
          <label for="ticket-recovery-email">E-Mail-Adresse</label>
          <input id="ticket-recovery-email" name="email" type="email" autocomplete="email" inputmode="email" required>
          <button class="button button--primary" type="submit">Code anfordern</button>
        </form>
        <form id="ticket-recovery-verify-form" data-event-id="${escapeHtml(eventId)}" hidden>
          <label for="ticket-recovery-code">Code aus der E-Mail</label>
          <input id="ticket-recovery-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>
          <button class="button button--primary" type="submit">Ticket anzeigen</button>
        </form>
        <p id="ticket-recovery-status" role="status" aria-live="polite"></p>
        <button id="ticket-recovery-change-email" class="button button--secondary" type="button" hidden>E-Mail-Adresse ändern</button>
        <a href="#/event/${encodeURIComponent(eventId)}">Zur Veranstaltung</a>
      </div>
    </div></section>`);
}

export async function eventCheckinPage(eventId = "", query = new URLSearchParams()) {
  const accessToken = query.get("access") || "";
  const event = eventId ? await getPublicRouteEvent(eventId, true) : null;
  const ticket = await validateStoredTicket(eventId);
  // A missing browser token does not mean that the person's registration is missing.
  const accountRegistrations = !ticket?.ticketToken && query.get("selected") !== "1" && currentUser()
    ? await listMyEventRegistrations([eventId]).catch(() => []) : [];
  const ownRegistration = accountRegistrations.find((item) => item.eventId === eventId && item.status === "checked_in")
    || accountRegistrations.find((item) => item.eventId === eventId);
  const storedTickets = listStoredTickets(eventId);
  if (query.get("selected") !== "1" && (accessToken || storedTickets.length > 1)) {
    const registrationOpen = Boolean(event && eventRegistrationIsOpen(event));
    const registrationUrl = accessToken
      ? `#/register/${encodeURIComponent(eventId)}?source=checkin&access=${encodeURIComponent(accessToken)}`
      : `#/register/${encodeURIComponent(eventId)}`;
    const choices = storedTickets.map((person) => {
      const personId = person.registrationId || person.ticketToken;
      const status = person.status === "checked_in" ? "Bereits eingecheckt" : "Angemeldet";
      return `<button class="button button--secondary" type="button" data-ticket-person="${escapeHtml(personId)}" data-event-id="${escapeHtml(eventId)}" data-access-token="${escapeHtml(accessToken)}">${escapeHtml(registrationPartyLabel(person))} · ${status}</button>`;
    }).join("");
    const otherPerson = accessToken
      ? `<form class="form-card login-card" data-entrance-link data-event-id="${escapeHtml(eventId)}" data-access-token="${escapeHtml(accessToken)}"><h3>Andere bestätigte Anmeldung</h3><p>Wenn das Ticket dieser Person noch nicht auf diesem Handy gespeichert ist, geben Sie die E-Mail-Adresse ihrer Anmeldung ein.</p><label>E-Mail-Adresse<input type="email" name="email" autocomplete="email" required></label><button type="submit" class="button button--primary">Diese Person verknüpfen und einchecken</button><p data-entrance-link-result role="status"></p></form>`
      : `<p><a href="#/ticket/recover/${encodeURIComponent(eventId)}">Weiteres Ticket per E-Mail-Code verknüpfen</a></p>`;
    return publicShell("events", `${subhero("Einlass", event?.title || "Veranstaltung", "Wen möchten Sie mit diesem Handy einchecken?")}
      <section class="section"><div class="container ticket-person-choice" style="max-width:760px">
        ${storedTickets.length ? `<div class="form-card login-card"><h2>Gespeicherte Personen</h2><div class="ticket-person-choice__buttons">${choices}</div></div>` : ""}
        ${otherPerson}
        ${registrationOpen ? `<p><a class="button button--secondary" href="${registrationUrl}">Neuen Gast anmelden</a></p>` : ""}
        <p class="muted">Die Auswahl gilt für den Einlass. Der Event-Chat bleibt ${currentUser()?.email ? `als ${escapeHtml(currentUser().email)}` : "mit einem separat angemeldeten Benutzerkonto"} verbunden. Für eine andere Chat-Person öffnen Sie deren persönlichen Zugangslink.</p>
      </div></section>`);
  }
  const checkedIn = (ticket?.valid === true && ticket.status === "checked_in")
    ? ticket : ownRegistration?.status === "checked_in" ? ownRegistration : null;
  if (checkedIn) {
    return publicShell("events", `${subhero("Einlass", event?.title || checkedIn.eventTitle || "Veranstaltung", "Sie sind eingecheckt.")}
      <section class="section"><div class="container" style="max-width:760px"><div class="form-card login-card"><h2>${escapeHtml(registrationPartyLabel(checkedIn))}</h2><div class="alert alert--success">Sie sind bereits eingecheckt. Ein erneuter Check-in ist nicht erforderlich.</div><a class="button button--secondary" href="#/event/${encodeURIComponent(eventId)}">Zum Event</a></div></div></section>`);
  }
  if ((!ticket?.ticketToken || query.get("relink") === "1") && accessToken) {
    return publicShell("events", `${subhero("Einlass", event?.title || "Veranstaltung", "Verknüpfen Sie dieses Handy mit Ihrer vorhandenen Anmeldung.")}<section class="section"><div class="container" style="max-width:760px"><form class="form-card login-card" data-entrance-link data-event-id="${escapeHtml(eventId)}" data-access-token="${escapeHtml(accessToken)}"><label>E-Mail-Adresse Ihrer Anmeldung<input type="email" name="email" autocomplete="email" required></label><button type="submit" class="button button--primary">Handy verknüpfen und einchecken</button><p data-entrance-link-result role="status"></p></form></div></section>`);
  }
  if (!ticket?.ticketToken) {
    const registrationOpen = Boolean(event && eventRegistrationIsOpen(event));
    const registrationUrl = accessToken
      ? `#/register/${escapeHtml(eventId)}?source=checkin&access=${encodeURIComponent(accessToken)}`
      : `#/register/${escapeHtml(eventId)}`;
    const closedUrl = event ? `#/event/${escapeHtml(eventId)}` : "#/events";
    return publicShell("events", `${subhero("Check-in", ownRegistration ? "Ihre Anmeldung ist vorhanden." : "Handy-Ticket verknüpfen", "In diesem Browser ist noch kein verknüpftes Handy-Ticket verfügbar.")}
      <section class="section"><div class="container" style="max-width:760px"><div class="form-card login-card checkin-registration-card"><div class="alert">${ownRegistration ? "Ihre Anmeldung wurde gefunden. Bitte verknüpfen Sie Ihr Handy-Ticket, um den Einlassstatus zu prüfen." : "Eine vorhandene Anmeldung bleibt bestehen. Bitte verknüpfen Sie Ihr Handy-Ticket oder scannen Sie den aktuellen Einlass-QR und geben Sie dort Ihre E-Mail-Adresse ein."}</div><p><a href="#/ticket/recover/${encodeURIComponent(eventId)}">Handy-Ticket verknüpfen</a></p>${registrationOpen && !ownRegistration ? `<a class="button button--secondary" href="${registrationUrl}">Noch nicht angemeldet? Zur Anmeldung</a>` : `<a class="button button--secondary" href="${closedUrl}">Zum Event</a>`}</div></div></section>`);
  }
  if (ticket.eventId && ticket.eventId !== eventId) {
    return publicShell("events", `${subhero("Check-in", "Falsches Ticket.", "Das gespeicherte Ticket gehoert zu einer anderen Veranstaltung.")}
      <section class="section"><div class="container" style="max-width:760px"><div class="alert alert--warning">Das gespeicherte Ticket gehoert zu einer anderen Veranstaltung.</div><a class="button button--secondary" href="#/events">Zu den Events</a></div></section>`);
  }
  return publicShell("events", `${subhero("Check-in", event?.title || ticket.eventTitle || "PROdigitalTV Event", "Bitte bestaetigen Sie den Check-in erst direkt am Einlass.")}
    <section class="section"><div class="container" style="max-width:760px">
      <div class="form-card login-card">
        <p class="eyebrow">Einlass</p>
        <h2>${escapeHtml(registrationPartyLabel(ticket))}</h2>
        ${ticket.eventTitle ? `<p>${escapeHtml(ticket.eventTitle)}</p>` : ""}
        <div class="alert">${ticket.valid === true ? "Noch nicht eingecheckt" : "Der aktuelle Einlassstatus konnte nicht bestätigt werden"}. Bitte tippen Sie erst am Empfang auf den Button.</div>
        <button class="button button--primary" type="button" data-confirm-ticket-checkin data-event-id="${escapeHtml(eventId)}">${ticket.participantCount > 1 || ticket.companion ? "Beide Personen einchecken" : "Jetzt einchecken"}</button>
        <div id="ticket-checkin-result" style="margin-top:16px"></div>
      </div>
    </div></section>`);
}

export async function eventCheckinScreenPage(eventId = "", query = new URLSearchParams()) {
  const event = eventId ? await getPublicRouteEvent(eventId, true) : null;
  if (!event) return notFoundPage();
  let accessToken = query.get("access") || "";
  let qrDataUrl = "";
  if (currentUser()) {
    const access = await getEventCheckinAccess(event.id).catch(() => null);
    accessToken = access?.accessToken || accessToken;
    qrDataUrl = access?.qrDataUrl || "";
  }
  if (!qrDataUrl && accessToken) {
    const access = await getPublicEventCheckinQr(event.id, accessToken).catch(() => null);
    qrDataUrl = access?.qrDataUrl || "";
  }
  const accessQuery = accessToken ? `?access=${encodeURIComponent(accessToken)}` : "";
  const url = `https://prodigitaltv.de/checkin.html?v=${Date.now()}#/event-checkin/${encodeURIComponent(event.id)}${accessQuery}`;
  return publicShell("events", `${subhero("Event-QR", event.title || "Event", "Diesen QR-Code am Empfang anzeigen oder ausdrucken.")}
    <section class="section"><div class="container webapp-qr-page event-checkin-screen" data-checkin-screen-event="${escapeHtml(event.id)}" data-checkin-screen-title="${escapeHtml(event.title || "PROdigitalTV Veranstaltung")}" data-checkin-screen-date="${escapeHtml(event.date || "")}" data-checkin-screen-url="${escapeHtml(url)}">
      <article class="webapp-qr-card">
        <figure class="webapp-qr-card__code">${qrDataUrl ? `<img src="${escapeHtml(qrDataUrl)}" alt="Check-in QR-Code fuer ${escapeHtml(event.title || "Event")}">` : `<div class="alert alert--warning">Der geschuetzte Einlass-QR konnte nicht geladen werden. Bitte oeffnen Sie ihn erneut aus dem CMS.</div>`}</figure>
        <div class="webapp-qr-card__copy">
          <p class="eyebrow">Check-in</p>
          <h2>${escapeHtml(event.title || "PROdigitalTV Veranstaltung")}</h2>
          <p class="event-checkin-screen__date">${escapeHtml(event.date ? formatDate(event.date) : "Veranstaltungsdatum nicht hinterlegt")}</p>
          <h3>QR-Code für den Einlass</h3>
          <p>Teilnehmer scannen diesen Code am Event. Das zuvor gespeicherte Handy-Ticket wird dann geprueft.</p>
          <p class="webapp-qr-card__url">${escapeHtml(url)}</p>
          <div class="actions"><button class="button button--primary" type="button" data-checkin-screen-pdf>QR-Code als PDF</button><button class="button button--secondary" type="button" data-print-page>QR-Code drucken</button><a class="button button--secondary" href="#/cms/event/${escapeHtml(event.id)}?tab=registration">Zur Eventverwaltung</a></div>
          <div data-checkin-screen-pdf-status></div>
        </div>
      </article>
      <div class="event-checkin-screen__overlay" data-checkin-welcome hidden>
        <div class="event-checkin-screen__welcome">
          <p class="eyebrow">Check-in erfolgreich</p>
          <h2 data-checkin-welcome-name>Herzlich willkommen</h2>
          <p>Wir freuen uns, Sie heute begruessen zu duerfen und wuenschen Ihnen eine erfolgreiche Veranstaltung.</p>
        </div>
      </div>
    </div></section>`);
}

export async function registrationCancelPage(token = "") {
  return publicShell("events", `${subhero("Storno", "Anmeldung stornieren.", "Bitte bestaetigen Sie die Stornierung nur, wenn Sie nicht teilnehmen koennen.")}
    <section class="section"><div class="container" style="max-width:760px">
      <div class="form-card login-card">
        <p class="eyebrow">Event-Anmeldung</p>
        <h2>Stornierung bestaetigen</h2>
        <p>Nach der Stornierung ist diese Anmeldung nicht mehr fuer den Einlass gueltig.</p>
        <button class="button button--primary" type="button" data-cancel-registration-token="${escapeHtml(token || "")}">Anmeldung stornieren</button>
        <a class="button button--secondary" href="#/events">Abbrechen</a>
        <div id="registration-cancel-result"></div>
      </div>
    </div></section>`);
}

function joinAside(downloads, editorial) {
  const publicDownloads = downloads
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const downloadInfo = (item) => {
    const linked = editorial.find((content) => (content.downloadId || content.download_id) === item.id);
    if (linked) return linked;
    const key = /satzung/i.test(item.title || item.fileName || "") ? "join.downloadInfo.satzung" : /beitrag/i.test(item.title || item.fileName || "") ? "join.downloadInfo.membershipFees" : "";
    return editorial.find((content) => content.key === key || content.title === item.title);
  };
  const downloadField = (item) => {
    const url = downloadUrl(item);
    const info = downloadInfo(item);
    return `<details class="download-field"><summary><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.fileName || item.description || "Download")}</span></summary><div class="download-field__body"><p>${escapeHtml(info?.bodyText || item.description || "Weitere Informationen zu diesem Dokument.")}</p><a class="link" href="${escapeHtml(url)}" ${url !== "#/downloads" ? `target="_blank" rel="noreferrer"` : ""}>PDF öffnen</a></div></details>`;
  };
  const joinCta = `<a class="join-aside-cta" href="#membership-application-form" data-join-scroll>
    ${aboutPicto("membership")}
    <span><strong>Mitglied werden</strong><small>Direkt zum Antrag springen</small></span>
  </a>`;
  return `<aside class="join-aside join-aside--overview">${joinCta}<h2>Downloads</h2>${publicDownloads.length ? `<div class="join-download-fields">${publicDownloads.map(downloadField).join("")}</div>` : `<a class="button button--secondary" href="#/downloads">Zu den oeffentlichen Downloads</a>`}</aside>`;
}

const MEMBERSHIP_APPLICATION_DOCUMENTS = {
  statutes: {
    title: "Vereinssatzung",
    fileName: "PROdigitalTV-Vereinssatzung.pdf",
    url: "https://firebasestorage.googleapis.com/v0/b/prodigitaltv-da47b.firebasestorage.app/o/member-documents%2FmemberDocuments-dfe8b3f2-7009-4ed3-9d7b-7ed32e148ef8%2F1782028461345-8f50d9d5-bd18-4f81-84f7-72902ff6d4ab.pdf?alt=media&token=368d3d46-b2e7-44e5-b448-23eef7e35c8d"
  },
  fees: {
    title: "Gebührenordnung",
    fileName: "PROdigitalTV-Gebuehrenordnung.pdf",
    url: "https://firebasestorage.googleapis.com/v0/b/prodigitaltv-da47b.firebasestorage.app/o/member-documents%2FmemberDocuments-dff340dd-5da9-483f-b4fd-df773d5a8b87%2F1782028326547-ad7011e7-aaac-45a8-9afa-f44907d81228.pdf?alt=media&token=6fc26d5a-380b-49d7-8f85-59a184bbde6d"
  }
};

function membershipDocumentLink(document, label = document.title) {
  return `<a href="${escapeHtml(document.url)}" target="_blank" rel="noopener" download="${escapeHtml(document.fileName)}">${escapeHtml(label)}</a>`;
}

function membershipFormSection() {
  const statutes = MEMBERSHIP_APPLICATION_DOCUMENTS.statutes;
  const fees = MEMBERSHIP_APPLICATION_DOCUMENTS.fees;
  return `<section class="section"><div class="container join-form-wrap"><form id="membership-application-form" class="form-card form-grid join-form">
    <p class="eyebrow">Mitgliedsantrag</p><h2 style="margin-bottom:6px">Mitglied werden</h2>
    <div class="form-grid--two"><div class="field"><label>Unternehmen / Organisation *</label><input name="company" required></div><div class="field"><label>Rechtsform</label><input name="legalForm" placeholder="z. B. GmbH, AG, e.V."></div></div>
    <div class="form-grid--two"><div class="field"><label>Strasse und Hausnummer *</label><input name="street" required></div><div class="field"><label>PLZ / Ort *</label><input name="city" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Land</label><input name="country" value="Deutschland"></div><div class="field"><label>Website</label><input name="website" type="url" placeholder="https://"></div></div>
    <div class="form-grid--two"><div class="field"><label>Ansprechpartner Vorname *</label><input name="firstName" required></div><div class="field"><label>Ansprechpartner Nachname *</label><input name="lastName" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Position / Funktion *</label><input name="position" required></div><div class="field"><label>E-Mail *</label><input name="email" type="email" required></div></div>
    <div class="field"><label>LinkedIn-Profil (optional)</label><input name="linkedIn" type="url" autocomplete="url" placeholder="https://www.linkedin.com/in/..."></div>
    <div class="form-grid--two"><div class="field"><label>Telefon</label><input name="phone" type="tel"></div><div class="field"><label>Mitgliedschaft</label><select name="membershipType"><option value="company">Unternehmensmitglied</option><option value="individual">Einzelmitglied</option></select></div></div>
    <div class="field"><label>Kurzbeschreibung Unternehmen</label><textarea name="companyDescription" placeholder="Taetigkeitsfeld, Bezug zur digitalen Medienwirtschaft"></textarea></div>
    <div class="field"><label>Nachricht / Rueckfragen</label><textarea name="message"></textarea></div>
    <fieldset class="registration-section registration-section--compact"><legend>Dokumente zur Mitgliedschaft</legend><p>Bitte laden Sie beide Dokumente herunter und lesen Sie sie vor dem Absenden des Antrags.</p><div class="actions"><a class="button button--secondary" href="${escapeHtml(statutes.url)}" target="_blank" rel="noopener" download="${escapeHtml(statutes.fileName)}">Satzung herunterladen (PDF)</a><a class="button button--secondary" href="${escapeHtml(fees.url)}" target="_blank" rel="noopener" download="${escapeHtml(fees.fileName)}">Gebührenordnung herunterladen (PDF)</a></div></fieldset>
    <label class="checkbox"><input type="checkbox" name="statutesAccepted" required> <span>Ich habe die ${membershipDocumentLink(statutes)} gelesen und akzeptiere sie. *</span></label>
    <label class="checkbox"><input type="checkbox" name="feeInfoAccepted" required> <span>Ich habe die ${membershipDocumentLink(fees)} zur Kenntnis genommen. *</span></label>
    <label class="checkbox"><input type="checkbox" name="privacyAccepted" required> Ich akzeptiere die Datenschutzerklaerung zur Verarbeitung meines Mitgliedsantrags. *</label>
    <label class="checkbox"><input type="checkbox" name="newsletterConsent"> Ich moechte Informationen zu Veranstaltungen und Vereinsaktivitaeten erhalten.</label>
    <button class="button button--primary" type="submit">Mitgliedsantrag absenden</button><div id="membership-application-result"></div>
  </form></div></section>`;
}

export async function joinPage() {
  const meta = internalPageMeta.mitglied_werden;
  const joinVariant = mobileLeanStart() ? "mobile" : "desktop";
  const cachedJoin = readPageContentCache("join-linkedin", joinVariant, 600000);
  if (cachedJoin) return publicShell("join", cachedJoin);
  const content = `${subhero(meta.eyebrow, meta.title, meta.intro)}
  <section class="section internal-overview internal-overview--join-simple"><div class="container"><div class="join-simple-copy">
    <div class="join-simple-intro"><div><p class="join-simple-lead"><strong>PROdigitalTV entwickelt sich vom klassischen Verband zu einem aktiven, generationsübergreifenden Netzwerk.</strong> In unserer Medien- und Technologie-Community treffen Erfahrung, neue Perspektiven und konkretes Branchenwissen aufeinander.</p><p>Mitglieder finden relevante Kontakte, ordnen Veränderungen gemeinsam ein und können Themen, Formate und Projekte aktiv mitgestalten. So entsteht ein Netzwerk, das nicht nur informiert, sondern persönliche und geschäftliche Chancen eröffnet.</p></div><aside><strong>Mitglied werden können</strong><p><b>Unternehmen und Organisationen</b>, die mehrere Fach- und Führungskräfte in das Netzwerk einbinden möchten.</p><p><b>Einzelpersonen</b>, die ihre Erfahrung, Expertise und Perspektive aktiv einbringen wollen.</p></aside></div>
    <ul class="join-benefit-list">
      <li><span>01</span><div><strong>Zugang</strong><p>Relevante Menschen persönlich kennenlernen, die im beruflichen Alltag oft nur schwer erreichbar sind.</p></div></li>
      <li><span>02</span><div><strong>Orientierung</strong><p>KI, Streaming, Plattformen, Content, Medienrecht und neue Geschäftsmodelle gemeinsam einordnen.</p></div></li>
      <li><span>03</span><div><strong>Sichtbarkeit</strong><p>Eigene Expertise über Veranstaltungen, Interviews, Fachbeiträge und Mitgliederprofile sichtbar machen.</p></div></li>
      <li><span>04</span><div><strong>Mitgestaltung</strong><p>Themen, Fachvorträge und Formate aktiv prägen und eigene Praxisimpulse in die Community einbringen.</p></div></li>
      <li><span>05</span><div><strong>Netzwerk</strong><p>Belastbare Beziehungen zwischen Erfahrungsträgern, Entscheidern und zukünftigen Führungskräften aufbauen.</p></div></li>
      <li><span>06</span><div><strong>Chancen</strong><p>Kooperationen, Empfehlungen, neue Projekte und Geschäftsmöglichkeiten aus persönlichem Austausch entwickeln.</p></div></li>
    </ul>
    <div class="join-simple-steps"><span><b>1</b><strong>Antrag ausfüllen</strong><small>Kontaktdaten und gewünschte Mitgliedschaft angeben.</small></span><span><b>2</b><strong>Persönliche Rückmeldung</strong><small>Wir melden uns zum weiteren Ablauf direkt bei Ihnen.</small></span><span><b>3</b><strong>Netzwerk nutzen</strong><small>An Veranstaltungen, Austausch und Mitgliederformaten teilnehmen.</small></span></div>
    <div class="join-simple-action"><p>Der Mitgliedsantrag kann direkt im Anschluss ausgefüllt werden.</p><a class="button button--primary" href="#membership-application-form" data-join-scroll>Zum Mitgliedsantrag</a></div>
  </div></div></section>${membershipFormSection()}`;
  writePageContentCache("join-linkedin", joinVariant, content);
  return publicShell("join", content);
}

export async function loginPage() {
  const user = currentUser();
  const activeSession = user ? `<div class="alert" style="margin-bottom:18px">Aktuell angemeldet als ${escapeHtml(user.email || user.displayName || user.uid || "Benutzer")} mit Rolle ${escapeHtml(user.role || "guest")}.</div><button id="logout-button" class="button button--secondary" type="button">Abmelden / Session loeschen</button>` : "";
  return publicShell("login", `<section class="login-wrap"><div class="container"><form id="login-form" class="form-card login-card">${logo()}<p class="eyebrow">Mitgliederbereich</p><h1 style="margin-bottom:10px">Anmelden</h1><p style="margin-bottom:25px">Zugriff auf exklusive Events, Downloads und CMS-Funktionen.</p>${activeSession}<div class="form-grid"><div class="field"><label>E-Mail</label><input name="email" type="email" value="" required></div><div class="field"><label>Passwort</label><input name="password" type="password" value="" required></div><button class="button button--primary">Einloggen</button><div id="login-result"></div></div></form></div></section>`);
}

export async function userInvitationPage(invitationId = "", query = new URLSearchParams(), tokenFromPath = "") {
  invitationId = invitationId || query.get("invitationId") || query.get("invitation") || query.get("id") || "";
  const token = tokenFromPath || query.get("token") || "";
  if (!invitationId || !token) {
    return publicShell("login", `${subhero("Zugang", "Einladungslink unvollstaendig", "Bitte oeffnen Sie den vollstaendigen Link aus der E-Mail.")}`, { prompts: false, bottomNav: false });
  }
  return publicShell("login", `<section class="login-wrap"><div class="container"><form id="user-invitation-form" class="form-card login-card" data-invitation-id="${escapeHtml(invitationId)}" data-token="${escapeHtml(token)}">${logo()}<p class="eyebrow">Zugang aktivieren</p><h1 style="margin-bottom:10px">Passwort vergeben</h1><p style="margin-bottom:25px">Dieser Link legitimiert Sie fuer den vorbereiteten PROdigitalTV-Zugang. Nach dem Speichern werden Sie mit Ihrer Rolle am System angemeldet.</p><div class="form-grid"><div class="field"><label>Neues Passwort</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Passwort wiederholen</label><input name="passwordRepeat" type="password" minlength="8" autocomplete="new-password" required></div><button class="button button--primary">Zugang aktivieren</button><p class="muted">Das Passwort muss mindestens 8 Zeichen lang sein. Der Einladungslink kann nur einmal verwendet werden.</p><div id="user-invitation-result"></div></div></form></div></section>`, { prompts: false, bottomNav: false });
}
function portalGalleryUploadForm(eventId) {
  return `<form id="member-material-upload-form" class="form-card member-upload-form"><input name="eventId" type="hidden" value="${escapeHtml(eventId)}"><div class="member-upload-form__top"><label class="button button--primary member-photo-upload-button">Fotos auswählen<input name="files" type="file" accept="image/*" multiple hidden></label><label class="checkbox-line member-upload-form__rights"><input type="checkbox" name="rightsConfirmed" value="1" required> Nutzungsfreigabe</label></div><div class="member-photo-upload-state" data-member-photo-state>Keine Bilder ausgewählt.</div><div class="member-photo-preview" data-member-photo-preview hidden></div><div class="field member-upload-form__note"><label>Hinweis</label><textarea name="note" rows="2" placeholder="Event, Ort oder kurzer Hinweis"></textarea></div><button class="button button--primary member-upload-form__send" type="submit">Bilder senden</button><div id="member-material-upload-result" role="status" aria-live="polite"></div></form>`;
}

function participantPhotoBadge(count = 0, eventId = "") {
  return `<span class="participant-photo-badge" data-participant-photo-badge="${escapeHtml(eventId)}" ${count ? "" : "hidden"} aria-label="${count} ungesehene Fotos">${count}</span>`;
}

async function myEventPhotosSection() {
  try {
    const { listPortalParticipantPhotos } = await import("../firebase/portalGalleryPhotoService.js?v=3");
    const { photos = [], events = [] } = await listPortalParticipantPhotos();
    const photoQuery = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const guestPreviewQuery = photoQuery.get("preview") === "guest" && isAdmin(currentUser()) ? "&preview=guest" : "";
    const selectedId = photoQuery.get("eventId") || "";
    const selected = events.find((event) => event.eventId === selectedId);
    const cards = events.map((event) => `<article class="card card__body"><p class="eyebrow">${escapeHtml(event.eventDate ? formatDate(event.eventDate) : "Veranstaltung")}</p><h3>${escapeHtml(event.eventTitle || "Meine Veranstaltung")}</h3><a class="button button--primary button--small" href="#/event-live/${encodeURIComponent(event.eventId)}">Veranstaltungsbereich öffnen</a><a class="button button--secondary button--small" href="#/portal?tab=my-events&eventId=${encodeURIComponent(event.eventId)}${guestPreviewQuery}">Teilnehmerfotos ${participantPhotoBadge(event.unreadCount, event.eventId)}</a><p class="muted">${event.photoCount} Fotos</p></article>`).join("");
    let gallery = "";
    if (selected) {
      const eventPhotos = photos.filter((photo) => photo.eventId === selectedId);
      gallery = `<section class="member-portal-section"><div class="section-head"><div><h2>${escapeHtml(selected.eventTitle)} · Teilnehmerfotos</h2><p class="muted">Fotos dieser Veranstaltung sind für ihre Teilnehmer direkt sichtbar.</p></div></div><div class="participant-photo-grid" data-participant-photos data-event-id="${escapeHtml(selectedId)}">${eventPhotos.length ? eventPhotos.map((photo) => `<figure class="participant-photo-card" data-participant-photo="${escapeHtml(photo.id)}" data-photo-unread="${photo.unread ? "1" : "0"}"><button type="button" data-participant-photo-link aria-label="Foto vergrößern"><img data-participant-photo-image alt="${escapeHtml(photo.caption || photo.fileName || "Teilnehmerfoto")}" hidden><span data-participant-photo-status>Foto wird geladen …</span></button><figcaption>${photo.caption ? `<p>${escapeHtml(photo.caption)}</p>` : ""}<small>${escapeHtml(photo.uploadedByName || "Eventteilnehmer")}</small></figcaption></figure>`).join("") : `<div class="alert">Für diese Veranstaltung wurden noch keine Fotos hochgeladen.</div>`}</div></section><section class="member-portal-section member-portal-section--upload"><h2>Fotos für diese Veranstaltung hochladen</h2>${portalGalleryUploadForm(selectedId)}</section>`;
    } else if (selectedId) {
      gallery = `<div class="alert alert--warning">Für diese Veranstaltung sind Sie nicht freigeschaltet.</div>`;
    }
    return `<section class="member-portal-section" data-participant-photo-area><div class="section-head"><h2>Meine Veranstaltungen ${participantPhotoBadge(photos.filter((photo) => photo.unread).length)}</h2></div><div class="card-grid card-grid--three">${cards || `<div class="alert">Noch keine bestätigten Veranstaltungen mit diesem Konto verknüpft.</div>`}</div>${gallery}</section>`;
  } catch (error) {
    return `<section class="member-portal-section"><h2>Meine Veranstaltungen</h2><div class="alert alert--warning">${escapeHtml(error.message || "Veranstaltungen konnten nicht geladen werden.")}</div></section>`;
  }
}

export async function portalPage({ guestPreview = false } = {}) {
  const user = currentUser();
  if (!user) return loginPage();
  if (!isMember(user) || (guestPreview && isAdmin(user))) {
    const { listPortalParticipantPhotos } = await import("../firebase/portalGalleryPhotoService.js?v=3");
    const query = new URLSearchParams(window.location.hash.split("?")[1] || "");
    let eventId = guestPreview ? query.get("eventId") : "";
    if (!eventId) {
      const { events = [] } = await listPortalParticipantPhotos();
      eventId = events[0]?.eventId || "";
    }
    if (eventId) {
      window.location.hash = `#/event-live/${encodeURIComponent(eventId)}${guestPreview ? "?preview=guest" : ""}`;
      return publicShell("login", '<section class="section"><div class="container"><p>Ihre Veranstaltung wird geöffnet …</p></div></section>');
    }
    return publicShell("login", `${subhero("Gästebereich", "Aktuell keine Veranstaltung freigeschaltet", "Ihr Zugang ist während Ihrer aktuellen Veranstaltung verfügbar.")}<section class="section"><div class="container"><button class="button button--secondary" type="button" data-logout-button>Abmelden</button></div></section>`);
  }
  const [allEvents, sponsors] = await Promise.all([listPublicEvents(true), listPublicContent("sponsors")]);
  const events = allEvents.filter((event) => event.accessType === "members_only" && eventRegistrationIsOpen(event));
  return publicShell("login", `${subhero("Mitgliederbereich", `Willkommen, ${escapeHtml(user.displayName)}.`, "Exklusive Inhalte und Ihre Veranstaltungen auf einen Blick.")}
    <section class="section"><div class="container"><div class="section-head"><div><h2>Mitglieder-Events</h2><p class="muted">Angemeldet als ${escapeHtml(user.email || "")} · Rolle: ${escapeHtml(user.role || "guest")} · Token bis: ${escapeHtml(user.tokenExpiresAt || "nicht verfuegbar")}</p></div><button id="logout-button" class="button button--secondary">Abmelden</button></div><div class="card-grid card-grid--three">${events.map((event) => eventCard(event, false, sponsors)).join("")}</div></div></section>`);
}

function memberDirectoryContact(member = {}) {
  const contacts = normalizedMemberEventContacts(member);
  const primary = contacts.find((contact) => contact.name || contact.email || contact.phone || contact.mobile) || {};
  return {
    name: primary.name || member.profileContactName || member.contactName || [member.firstName, member.lastName].filter(Boolean).join(" "),
    role: primary.role || primary.function || member.department || member.contactRole || "",
    email: primary.email || member.contactEmail || member.email || "",
    phone: primary.phone || member.contactPhone || member.phone || "",
    mobile: primary.mobile || member.contactMobile || member.mobile || ""
  };
}

function externalUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function urlLabel(value = "") {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function websiteFromEmail(value = "") {
  const email = String(value || "").trim();
  const domain = email.includes("@") ? email.split("@").pop().toLowerCase() : "";
  const privateMailDomains = ["gmail.com", "googlemail.com", "gmx.de", "gmx.net", "web.de", "t-online.de", "hotmail.com", "outlook.com", "icloud.com"];
  if (!domain || !domain.includes(".") || privateMailDomains.includes(domain) || domain.includes("yahoo.")) return "";
  return domain.startsWith("www.") ? `https://${domain}` : `https://www.${domain}`;
}

function phoneHref(value = "") {
  return String(value || "").replace(/[^\d+]/g, "");
}

function memberPublicDescription(member = {}) {
  const description = String(member.description || "").trim();
  if (!description) return "";
  if (/^Internes Mitgliedsprofil aus der Mitgliederliste 2026\.?$/i.test(description)) return "";
  return description;
}

function comparableName(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9äöüß]+/gi, " ").replace(/\s+/g, " ").trim();
}

function memberDirectoryCard(member = {}) {
  const contact = memberDirectoryContact(member);
  const website = externalUrl(member.website || member.url || websiteFromEmail(contact.email) || "");
  const description = memberPublicDescription(member);
  const showContactName = contact.name && comparableName(contact.name) !== comparableName(member.name);
  return `<article class="card card__body member-directory-card member-directory-card--portal-item">
    <div class="member-tile" style="margin-bottom:16px">${memberLogo(member, { initialFallback: true })}</div>
    <h3 style="margin:15px 0 8px">${escapeHtml(member.name || "Mitglied")}</h3>
    ${description ? `<p>${escapeHtml(description)}</p>` : ""}
    <p style="margin-top:12px">${escapeHtml(member.category || "Mitglied")}${member.city ? ` / ${escapeHtml(member.city)}` : ""}${member.country ? ` / ${escapeHtml(member.country)}` : ""}</p>
    <div class="member-directory-contact">
      ${showContactName ? `<span class="member-directory-contact__full"><b>Ansprechperson:</b> ${escapeHtml(contact.name)}${contact.role ? ` · ${escapeHtml(contact.role)}` : ""}</span>` : ""}
      ${contact.email ? `<span class="member-directory-contact__full"><b>Mail:</b> <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></span>` : ""}
      ${contact.phone || contact.mobile ? `<span class="member-directory-contact__full member-directory-contact__phones">${contact.phone ? `<span><b>Tel:</b> <a href="tel:${escapeHtml(phoneHref(contact.phone))}">${escapeHtml(contact.phone)}</a></span>` : ""}${contact.mobile ? `<span><b>Mobil:</b> <a href="tel:${escapeHtml(phoneHref(contact.mobile))}">${escapeHtml(contact.mobile)}</a></span>` : ""}</span>` : ""}
      ${website ? `<span class="member-directory-contact__full"><b>Web:</b> <a href="${escapeHtml(website)}" target="_blank" rel="noopener">${escapeHtml(urlLabel(website))}</a></span>` : ""}
    </div>
  </article>`;
}

function memberEventContactLimit(member = {}) {
  return member.membershipType === "company" ? 5 : 1;
}

function memberAccessBlocked(member = {}, now = new Date()) {
  if (!["inactive", "cancelled"].includes(member.membershipAccessStatus)) return false;
  const effective = member.membershipAccessEffectiveAt;
  if (!effective) return true;
  const effectiveDate = effective.seconds ? new Date(effective.seconds * 1000) : new Date(effective);
  return !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= now;
}

function memberHasPortalAccess(member = {}) {
  return Boolean(member?.id)
    && (member.status || "active") === "active"
    && !memberAccessBlocked(member);
}

function normalizedMemberEventContacts(member = {}) {
  const existing = Array.isArray(member.eventContacts) ? member.eventContacts : [];
  const fallback = {
    name: member.profileContactName || member.contactName || "",
    email: member.contactEmail || member.email || "",
    phone: member.phone || member.contactPhone || member.mobile || member.contactMobile || ""
  };
  return existing.length ? existing : (fallback.name || fallback.email || fallback.phone ? [fallback] : []);
}

function memberEventContactsFields(member = {}) {
  const limit = memberEventContactLimit(member);
  const contacts = normalizedMemberEventContacts(member);
  return `<div class="form-card form-grid member-event-contacts">
    <div>
      <p class="eyebrow">Eventberechtigte Kontakte</p>
      <p class="muted">${limit === 1 ? "Einzelmitglieder können eine eventberechtigte Person hinterlegen." : "Firmenmitglieder können bis zu 5 eventberechtigte Personen hinterlegen."}</p>
    </div>
    ${Array.from({ length: limit }, (_, index) => {
      const contact = contacts[index] || {};
      return `<div class="form-grid--three member-event-contact-row">
        <div class="field"><label>Kontakt ${index + 1} Name</label><input name="eventContactName${index}" value="${escapeHtml(contact.name || "")}"></div>
        <div class="field"><label>E-Mail</label><input name="eventContactEmail${index}" type="email" value="${escapeHtml(contact.email || "")}"></div>
        <div class="field"><label>Telefon</label><input name="eventContactPhone${index}" type="tel" value="${escapeHtml(contact.phone || "")}"></div>
      </div>`;
    }).join("")}
  </div>`;
}

function memberProfileForm(member = {}, user = {}, options = {}) {
  const adminMode = options.adminMode === true;
  if (!adminMode && !user.memberId) {
    return `<div class="alert">Ihr Login ist noch keinem Mitgliedsprofil zugeordnet. Bitte im CMS beim Benutzer <code>${escapeHtml(user.uid || user.email || "")}</code> das Feld <code>memberId</code> setzen.</div>`;
  }
  if (!member?.id) {
    return `<div class="alert">${adminMode ? "Bitte ein Mitgliedsprofil auswählen." : `Das verknüpfte Mitgliedsprofil <code>${escapeHtml(user.memberId)}</code> wurde noch nicht gefunden.`}</div>`;
  }
  return `<form id="member-profile-form" class="form-card form-grid" data-member-id="${escapeHtml(member.id)}">
    <p class="eyebrow">${adminMode ? "Admin-Mitgliederpflege" : "Eigenes Mitgliedsprofil"}</p>
    <h2 style="margin-bottom:6px">${adminMode ? escapeHtml(member.name || "Mitglied bearbeiten") : "Profil bearbeiten"}</h2>
    <p class="muted">${adminMode ? "Als Admin können Sie den ausgewählten Mitgliedsdatensatz bearbeiten." : "Diese Angaben werden direkt im eigenen Mitglieder-Datensatz gespeichert."}</p>
    <div class="field"><label>Name / Unternehmen</label><input name="name" value="${escapeHtml(member.name || "")}" required></div>
    <div class="field"><label>Beschreibung</label><textarea name="description" rows="5">${escapeHtml(member.description || "")}</textarea></div>
    <div class="field"><label>LinkedIn-Profil (optional)</label><input name="linkedIn" type="url" autocomplete="url" value="${escapeHtml(member.linkedIn || "")}" placeholder="https://www.linkedin.com/in/..."></div>
    <div class="form-grid--two">
      <div class="field"><label>Website</label><input name="website" type="url" value="${escapeHtml(member.website || "")}" placeholder="https://"></div>
      <div class="field"><label>Kontakt-E-Mail</label><input name="contactEmail" type="email" value="${escapeHtml(member.contactEmail || member.email || "")}"></div>
    </div>
    <div class="form-grid--two">
      <div class="field"><label>Telefon</label><input name="phone" type="tel" value="${escapeHtml(member.phone || member.contactPhone || "")}"></div>
      <div class="field"><label>Mobil</label><input name="mobile" type="tel" value="${escapeHtml(member.mobile || member.contactMobile || "")}"></div>
    </div>
    <div class="form-grid--two">
      <div class="field"><label>Ansprechpartner</label><input name="profileContactName" value="${escapeHtml(member.profileContactName || member.contactName || "")}"></div>
      <div class="field"><label>Briefanrede</label><input name="personalSalutation" value="${escapeHtml(member.personalSalutation || "")}"></div>
    </div>
    <div class="form-grid--two">
      <div class="field"><label>Straße</label><input name="street" value="${escapeHtml(member.street || "")}"></div>
      <div class="field"><label>PLZ</label><input name="postalCode" value="${escapeHtml(member.postalCode || "")}"></div>
    </div>
    <div class="form-grid--two">
      <div class="field"><label>Ort</label><input name="city" value="${escapeHtml(member.city || "")}"></div>
      <div class="field"><label>Land</label><input name="country" value="${escapeHtml(member.country || "")}"></div>
    </div>
    ${memberEventContactsFields(member)}
    <button class="button button--primary" type="submit">${adminMode ? "Mitgliedsprofil speichern" : "Eigenes Profil speichern"}</button>
    <div id="member-profile-result"></div>
  </form>`;
}

export async function memberPortalPage() {
  const user = currentUser();
  if (!user) return loginPage();
  if (!isMember(user)) return portalPage();
  if (isAdmin(user) && new URLSearchParams(window.location.hash.split("?")[1] || "").get("preview") === "guest") return portalPage({ guestPreview: true });
  const leanPortal = mobileLeanStart();
  const activeTab = (() => {
    try {
      const tab = new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab") || "overview";
      return ["photos", "upload"].includes(tab) ? "my-events" : tab;
    } catch {
      return "overview";
    }
  })();
  const cachedDirectorySection = activeTab === "directory"
    ? readPageContentCache("member-portal-directory", "members", 900000)
    : "";
  const cachedOwnMember = readCachedMemberProfile(user);
  const ownMemberPromise = user.memberId
    ? getOne("members", user.memberId).then((member) => {
      if (member?.id) writeCachedMemberProfile(user, member);
      return member;
    }).catch(() => null)
    : Promise.resolve(null);
  if (cachedOwnMember) ownMemberPromise.catch(() => {});
  const ownMember = cachedOwnMember || (activeTab === "profile" ? await fastFallback(ownMemberPromise, null, 2500) : null);
  const linkedMemberBlocked = ownMember?.id && !memberHasPortalAccess(ownMember);
  const needsEvents = activeTab === "overview" || activeTab === "events" || activeTab === "documents";
  const needsSponsors = needsEvents;
  const needsDocuments = activeTab === "documents" || activeTab === "strategy";
  const needsArticles = activeTab === "overview" || activeTab === "documents";
  const needsGalleries = needsArticles;
  const needsMembers = !cachedDirectorySection && (activeTab === "directory" || (!leanPortal && activeTab === "overview"));
  const [allEvents, sponsors, memberDocuments, members, memberVideos, galleries] = await Promise.all([
    needsEvents ? listPublicEvents(true).catch(() => []) : [],
    needsSponsors ? listPublicContent("sponsors").catch(() => []) : [],
    needsDocuments ? list("memberDocuments").catch(() => []) : [],
    needsMembers ? list("members").catch(() => listPublicContent("members")).then(withPublicMemberLogos).catch(() => []) : [],
    needsArticles ? listMemberContent("editorialContent").catch(() => []) : [],
    needsGalleries ? list("galleries").catch(() => []) : []
  ]);
  const sortedMembers = members
    .slice()
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999) || String(a.name || "").localeCompare(String(b.name || "")));
  const profileAccessNotice = activeTab === "profile" && (!ownMember?.id || linkedMemberBlocked)
    ? `<div class="alert alert--warning member-portal-link-warning">${linkedMemberBlocked
      ? `Ihr Mitgliedsprofil ist aktuell nicht fuer die Profilpflege freigeschaltet. Die Mitgliederliste bleibt sichtbar.`
      : user.memberId
        ? `Das verknuepfte Mitgliedsprofil <code>${escapeHtml(user.memberId)}</code> wurde noch nicht gefunden. Die Mitgliederliste bleibt sichtbar; die Profilpflege ist erst nach korrekter Verknuepfung moeglich.`
        : `Ihr Login ist noch keinem Mitgliedsprofil zugeordnet. Die Mitgliederliste bleibt sichtbar; die Profilpflege ist erst nach Verknuepfung mit einem Mitgliedsdatensatz moeglich.`}</div>`
    : "";
  const events = allEvents.filter((event) => event.accessType === "members_only" && eventRegistrationIsOpen(event));
  const visibleDocuments = memberDocuments
    .filter((item) => item.status === "published" && (item.visibility || "members") === "members")
    .sort((a, b) => String(b.meetingDate || b.publishDate || b.year || b.updatedAt || "").localeCompare(String(a.meetingDate || a.publishDate || a.year || a.updatedAt || "")));
  const strategyDocument = visibleDocuments.find((item) =>
    item.id === "zukunftsstrategie-2027-2030"
      || String(item.contentType || item.type || "").toLowerCase() === "strategy-page"
  );
  const visibleMembers = sortedMembers
    .filter((member) => {
      const status = String(member.status || "active").toLowerCase();
      return member.visible !== false
        && member.isLive !== false
        && !memberAccessBlocked(member)
        && !["inactive", "cancelled", "archived", "deleted"].includes(status);
    });
  const visibleMemberArticles = memberVideos
    .filter((item) => (item.visibility || "members") === "members" || item.page === "member-area" || item.section === "member-area" || String(item.category || "").toLowerCase().includes("mitglied"))
    .filter((item) => memberArticleIsVisibleNow(item, allEvents))
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999) || String(b.publishDate || b.updatedAt || "").localeCompare(String(a.publishDate || a.updatedAt || "")));
  const documentUrl = (item) => item.documentUrl || item.assetUrl || item.fileUrl || item.url || "";
  const documentCard = (item) => {
    const url = documentUrl(item);
    return `<article class="card card__body">
      <p class="eyebrow">${escapeHtml([item.category || "Dokument", item.year].filter(Boolean).join(" / "))}</p>
      <h3>${escapeHtml(item.title || item.fileName || "Dokument")}</h3>
      ${item.description ? `<p>${linkedText(item.description)}</p>` : ""}
      ${item.meetingDate ? `<p class="muted">${formatDate(item.meetingDate)}</p>` : ""}
      ${url ? `<a class="button button--secondary button--small" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Datei öffnen</a>` : `<p class="muted">Datei ist noch nicht hinterlegt.</p>`}
    </article>`;
  };
  const tabs = [
    ["overview", "Übersicht"],
    ["my-events", "Meine Veranstaltungen"],
    ["strategy", "Zukunftsstrategie"],
    ["profile", "Mein Profil"],
    ["directory", "Mitgliederliste"],
    ["documents", "Member Infos"],
    ["events", "Events"]
  ];
  const mobileTabNav = `<div class="member-portal-mobile-nav"><label><span>Bereich auswählen ${participantPhotoBadge()}</span><select class="member-portal-select" data-member-portal-select aria-label="Bereich im Mitgliederportal auswählen">${tabs.map(([key, label]) => `<option value="#/portal?tab=${key}" ${activeTab === key ? "selected" : ""}>${label}</option>`).join("")}</select></label><button class="member-portal-logout-tab" type="button" data-logout-button>Abmelden</button></div>`;
  const tabNav = `${mobileTabNav}<nav class="member-portal-tabs" aria-label="Mitgliederbereich">${tabs.map(([key, label]) => `<a href="#/portal?tab=${key}" class="${activeTab === key ? "active" : ""}">${label}${key === "my-events" ? participantPhotoBadge() : ""}</a>`).join("")}<button class="member-portal-logout-tab" type="button" data-logout-button>Abmelden</button></nav>`;
  const documentsSection = `<section class="member-portal-section member-portal-section--documents"><div class="section-head"><div><h2>Mitglieder-Dokumente</h2><p class="muted">Freigegebene Unterlagen und Anlagen für Mitglieder.</p></div></div><div class="card-grid card-grid--three">${visibleDocuments.length ? visibleDocuments.map(documentCard).join("") : `<div class="alert">Noch keine freigegebenen Mitgliederdokumente.</div>`}</div></section>`;
  const memberInfosSection = `<section class="member-portal-section member-portal-section--infos"><div class="section-head"><h2>Member Infos</h2></div><div class="member-article-list">${visibleMemberArticles.length ? visibleMemberArticles.map((article) => memberArticleCard(article, galleries)).join("") : `<div class="alert">Noch keine Mitgliederbeitr&auml;ge sichtbar.</div>`}</div></section>`;
  const strategyFrameSrcdoc = (html = "") => {
    const resizeScript = `<script>(function(){var last=0;function send(){var d=document.documentElement,b=document.body,h=Math.ceil(Math.max(d?d.scrollHeight:0,b?b.scrollHeight:0,d?d.offsetHeight:0,b?b.offsetHeight:0));if(!h||Math.abs(h-last)<8)return;last=h;parent.postMessage({type:"pdtv-member-strategy-resize",height:h},"*");}function scrollToTarget(target){if(!target)return;var r=target.getBoundingClientRect();parent.postMessage({type:"pdtv-member-strategy-scroll",top:Math.max(0,r.top+(window.scrollY||window.pageYOffset||0))},"*");}window.openModal=function(title,text){parent.postMessage({type:"pdtv-member-strategy-modal",title:String(title||""),text:String(text||"")},"*");};try{if("ResizeObserver" in window){var ro=new ResizeObserver(send);ro.observe(document.documentElement);if(document.body)ro.observe(document.body);}}catch(e){}document.addEventListener("click",function(event){var el=event.target.closest("a[href^='#'],button[onclick*='scrollIntoView']");if(!el)return;var id="";if(el.tagName==="A")id=(el.getAttribute("href")||"").replace(/^#/,"");else{var m=String(el.getAttribute("onclick")||"").match(/getElementById\\(['\"]([^'\"]+)['\"]\\)/);id=m&&m[1]||"";}var target=id&&document.getElementById(id);if(target){event.preventDefault();event.stopImmediatePropagation();scrollToTarget(target);}},true);window.addEventListener("load",send);window.addEventListener("resize",send);document.addEventListener("input",send,true);document.addEventListener("change",send,true);setTimeout(send,50);setTimeout(send,400);setTimeout(send,1200);})();<\/script>`;
    const value = String(html || "");
    return /<\/body>/i.test(value) ? value.replace(/<\/body>/i, `${resizeScript}</body>`) : `${value}${resizeScript}`;
  };
  const strategySection = `<section class="member-portal-section member-portal-section--strategy">
    <div class="section-head"><div><p class="eyebrow">Strategie & Zukunft</p><h2>Zukunftsstrategie 2027–2030</h2><p class="muted">PROdigitalTV gemeinsam weiterdenken und die nächsten Schritte mitgestalten.</p></div></div>
    ${strategyDocument?.htmlContent
      ? `<div class="member-strategy-frame-wrap"><iframe class="member-strategy-frame" data-member-strategy-frame title="PROdigitalTV Zukunftsstrategie 2027 bis 2030" sandbox="allow-scripts" scrolling="no" srcdoc="${escapeHtml(strategyFrameSrcdoc(strategyDocument.htmlContent))}"></iframe></div>`
      : `<div class="alert alert--warning">Die Zukunftsstrategie ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.</div>`}
  </section>`;
  const profileSection = `<section class="member-portal-section"><div class="section-head"><h2>Mein Profil</h2></div>${memberProfileForm(ownMember, user, { adminMode: false })}${pushControls()}</section>`;
  const renderedDirectorySection = `<section class="member-portal-section"><div class="section-head"><h2>Mitgliederverzeichnis</h2></div><div class="card-grid card-grid--three member-directory-grid">${visibleMembers.length ? visibleMembers.map(memberDirectoryCard).join("") : `<div class="alert">Noch keine freigegebenen Mitglieder.</div>`}</div></section>`;
  if (!cachedDirectorySection && activeTab === "directory" && visibleMembers.length) {
    writePageContentCache("member-portal-directory", "members", renderedDirectorySection);
  }
  const directorySection = cachedDirectorySection || renderedDirectorySection;
  const eventsSection = `<section class="member-portal-section"><div class="section-head"><h2>Mitglieder-Events</h2></div><div class="card-grid card-grid--three">${events.length ? events.map((event) => eventCard(event, false, sponsors)).join("") : `<div class="alert">Aktuell keine Mitglieder-Events.</div>`}</div></section>`;
  const myEventsSection = activeTab === "my-events" ? await myEventPhotosSection() : "";
  const directoryCount = needsMembers ? visibleMembers.length : ">";
  const overviewSection = `<section class="member-portal-section"><div class="member-portal-overview"><article class="member-portal-card member-portal-card--event-live"><span>EVENTS</span><h3>MEINE VERANSTALTUNGEN ${participantPhotoBadge()}</h3><p>Agenda, Teilnehmer und Gespräche.</p><a href="#/portal?tab=my-events">Öffnen</a></article><article class="member-portal-card member-portal-card--strategy"><span>2030</span><h3>Zukunftsstrategie</h3><p>Strategie, Fahrplan und Mitgliederfragen gemeinsam bearbeiten.</p><a href="#/portal?tab=strategy">Öffnen</a></article><article class="member-portal-card member-portal-card--infos"><span>${visibleMemberArticles.length}</span><h3>Member Infos</h3><p>Mitgliederbeiträge, Dokumente und Anlagen abrufen.</p><a href="#/portal?tab=documents">Öffnen</a></article><article class="member-portal-card member-portal-card--directory"><span>${escapeHtml(String(directoryCount))}</span><h3>Mitgliederliste</h3><p>Aktuelle Mitglieder und freigegebene Kontaktdaten.</p><a href="#/portal?tab=directory">Öffnen</a></article><article class="member-portal-card member-portal-card--profile"><span>1</span><h3>Mein Profil</h3><p>Eigene Mitgliedsdaten pflegen.</p><a href="#/portal?tab=profile">Bearbeiten</a></article></div></section>`;
  const content = activeTab === "my-events" ? myEventsSection
    : activeTab === "profile" ? profileSection
    : activeTab === "directory" ? directorySection
    : activeTab === "documents" ? memberInfosSection
    : activeTab === "strategy" ? strategySection
    : activeTab === "events" ? eventsSection
    : overviewSection;
  return publicShell("login", `${subhero("Mitgliederbereich", `Willkommen, ${escapeHtml(user.displayName)}.`, "Dokumente, Mitgliederverzeichnis und eigenes Profil.")}
    <section class="section section--white member-portal-shell"><div class="container">
      ${tabNav}
      ${profileAccessNotice}
      ${content}
    </div></section>`);
}

export async function memberArticleDetailPage(id) {
  const user = currentUser();
  if (!user) return loginPage();
  if (!isMember(user)) return portalPage();
  const articles = await listMemberContent("editorialContent").catch(() => []);
  const galleries = await list("galleries").catch(() => []);
  const item = articles.find((entry) => [entry.id, entry.slug, entry.key].filter(Boolean).includes(id))
    || await getOne("editorialContent", id).catch(() => null);
  const itemStatus = String(item?.status || "published").toLowerCase();
  const isMemberArticle = item && ((item.visibility || "members") === "members" || item.page === "member-area" || item.section === "member-area");
  const events = memberArticleEventIds(item || {}).length ? await listPublicEvents(true).catch(() => []) : [];
  if (!item || ["archived", "deleted", "hidden"].includes(itemStatus) || item.visible === false || !isMemberArticle || !memberArticleIsVisibleNow(item, events)) return notFoundPage();
  const date = item.publishDate || item.validFrom || item.date || "";
  const text = item.articleText || item.bodyText || item.longDescription || item.introText || "";
  const selectedGallery = articleGallery(item, galleries);
  const galleryImages = visibleGalleryImages(selectedGallery || {});
  return publicShell("login", `${subhero("Mitgliederbereich", item.title || "Redaktioneller Beitrag", item.subtitle || "Exklusiv für Mitglieder.")}
    <section class="section section--white"><div class="container detail-main" style="max-width:920px">
      <a class="link" href="#/portal">Zurueck zum Mitgliederbereich</a>
      <article class="member-article-detail">
        ${memberArticleHero(item, "eager")}
        <p class="eyebrow">${escapeHtml(item.category || "Mitgliederbeitrag")}${date ? ` / ${formatDate(date)}` : ""}</p>
        <h1>${escapeHtml(item.title || "Redaktioneller Beitrag")}</h1>
        ${item.subtitle ? `<p class="article-subline">${escapeHtml(item.subtitle)}</p>` : ""}
        ${memberArticleAssetBar(item, galleries)}
        ${ttsReader({ rubric: item.category || "Member Info", title: item.title || "", text: [item.subtitle, richTextPlainText(text)].filter(Boolean).join("\n\n"), inlineOffsetText: item.subtitle || "", audio: item.audio || {}, audioProvider: item.audioProvider || item.auaioProvider || "", audioUrl: item.audioUrl || item.auaioUrl || "", audioAccessibleUrl: item.audioAccessibleUrl || item.auaioAccessibleUrl || "", audioNaturalUrl: item.audioNaturalUrl || item.auaioNaturalUrl || "", timingUrl: item.timingUrl || "", audioStatus: item.audioStatus || item.auaioStatus || "", audioAccessibleStatus: item.audioAccessibleStatus || item.auaioAccessibleStatus || "", audioNaturalStatus: item.audioNaturalStatus || item.auaioNaturalStatus || "" })}
        <div class="editorial-text">${articleParagraphs(text)}</div>
        ${galleryImages.length ? galleryPlayCta(selectedGallery, galleryImages) : ""}
        ${articlePdfBlock(item)}
      </article>
    </div></section>`);
}

export async function legalPage(type) {
  const privacy = type === "privacy";
  const content = await getOne("editorialContent", privacy ? "legal-privacy" : "legal-imprint");
  if (!content) {
    return publicShell("", `${subhero("Rechtliches", privacy ? "Datenschutz" : "Impressum", "Live-Inhalt ist aktuell nicht gespeichert.")}
    <section class="section"><div class="container detail-main" style="max-width:820px"><div class="alert">Dieser Inhalt fehlt in Firestore.</div></div></section>`);
  }
  return publicShell("", `${subhero("Rechtliches", privacy ? "Datenschutz" : "Impressum", content.introText || "")}
  <section class="section"><div class="container detail-main" style="max-width:820px"><h2>${escapeHtml(content.title || "")}</h2><div class="editorial-text">${articleParagraphs(content.bodyText || "")}</div></div></section>`);
}
export function notFoundPage() {
  return publicShell("", `<section class="section"><div class="container empty"><h1>Seite nicht gefunden</h1><p>Die angeforderte Seite ist nicht verfuegbar.</p><a class="button button--primary" style="margin-top:20px" href="#/home">Zur Startseite</a></div></section>`);
}






