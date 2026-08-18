import { list, listPublicEvents, listPublicContent, listMemberContent, listPublicEventMediaAssets, listPublicMediaAssets, getOne } from "../firebase/dataService.js?v=517";
import { currentUser, isAdmin, isMember } from "../firebase/authService.js?v=471";
import { publicShell, logo } from "../components/layout.js?v=7";
import { eventCard, topicCard } from "../components/cards.js?v=12";
import { accessLabels, lifecycleLabels } from "../data/platformConstants.js?v=1";
import { escapeHtml, formatDate, initials } from "../utils/format.js";
import { liveImageAttrs, stableImageUrl } from "../utils/imageUrls.js?v=1";
import { checkInWithStoredTicket, linkTicketDevice, readStoredTicket, validateStoredTicket } from "../firebase/registrationService.js?v=13";

function subhero(eyebrow, title, text) {
  return `<section class="subhero"><div class="container">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h1>${title}</h1><p>${text}</p></div></section>`;
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

function topicVisualHeader({ topic = {}, speakers = [], title = "", intro = "", mediaAssets = [] } = {}) {
  const imageUrl = stableImageUrl(publicTopicImageUrl(topic, mediaAssets), "topic");
  const logoSpeaker = speakers.find((speaker) => speaker.companyLogoUrl || speaker.logoUrl || speaker.company_logo_url) || {};
  const logoUrl = topic.companyLogoUrl || topic.logoUrl || topic.company_logo_url || logoSpeaker.companyLogoUrl || logoSpeaker.logoUrl || logoSpeaker.company_logo_url || "";
  const visibleSpeakers = speakers.filter(publicSpeakerIsVisible).slice(0, 3);
  const visual = imageUrl
    ? `<figure class="topic-detail-hero__image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(topic.thumbnail_alt || `Themenmotiv ${title}`)}" loading="eager" decoding="async" ${liveImageAttrs("topic")}></figure>`
    : `<div class="topic-detail-hero__speaker-wall">${visibleSpeakers.length ? visibleSpeakers.map((speaker) => `<a class="topic-detail-hero__speaker" href="${speakerProfileHref(speaker)}">${speakerPortrait(speaker)}<span>${escapeHtml(speakerName(speaker))}</span></a>`).join("") : `<span class="topic-detail-hero__placeholder">${escapeHtml(initials(title || "Thema"))}</span>`}</div>`;
  const mobileSpeakerStrip = visibleSpeakers.length
    ? `<div class="topic-detail-hero__mobile-speakers">${visibleSpeakers.map((speaker) => `<a href="${speakerProfileHref(speaker)}" title="${escapeHtml(speakerName(speaker))}">${speakerPortrait(speaker)}<span>${escapeHtml(speakerName(speaker))}</span></a>`).join("")}</div>`
    : "";
  const mobileMedia = imageUrl
    ? `<div class="topic-detail-hero__mobile-media"><figure><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(topic.thumbnail_alt || `Themenmotiv ${title}`)}" loading="eager" decoding="async" ${liveImageAttrs("topic")}></figure>${mobileSpeakerStrip}</div>`
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
  return logoUrl
    ? `<img class="${logoClass}" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(member.name)}" ${liveImageAttrs("member")}>`
    : options.initialFallback
      ? `<span class="member-logo-initials" aria-hidden="true">${escapeHtml(initials(member.name || "Mitglied"))}</span>`
      : escapeHtml(member.name);
}

function blockedMemberLogoUrl(member = {}, url = "") {
  const value = String(url || "");
  if (member.id === "goldvisite-media" && /goldbach/i.test(value)) return true;
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
  const recordUrl = wantsThumb ? topicDirectThumbnailUrl(topic) : topicDirectImageUrl(topic);
  const directIds = wantsThumb
    ? [topic.thumbnail_media_asset_id, topic.thumbnailMediaAssetId].filter(Boolean)
    : [topic.article_media_asset_id, topic.articleMediaAssetId, topic.mediaAssetId, topic.media_asset_id, topic.assetId].filter(Boolean);
  const fieldMatches = (value = "") => {
    const normalized = String(value || "imageUrl").toLowerCase().replace(/[_-]/g, "");
    return wantsThumb
      ? ["thumbnailurl", "thumbnail", "thumb"].includes(normalized)
      : ["imageurl", "image", "asseturl", "articleimageurl", "article"].includes(normalized);
  };
  const variantScore = (asset = {}) => {
    const key = String(asset.variant_key || asset.variantKey || asset.usage_preset || "").toLowerCase();
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

function publicEventMediaAsset(event = {}, mediaAssets = []) {
  const eventImageFields = ["imageUrl", "thumbnail_url", "thumbnailUrl", "assetUrl"];
  return mediaAssets
    .filter((asset) => {
      const eventUrl = event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "";
      const directIds = [event.thumbnail_media_asset_id, event.thumbnailMediaAssetId, event.mediaAssetId, event.media_asset_id, event.assetId].filter(Boolean);
      const urls = mediaAssetUrls(asset);
      return directIds.includes(asset.id)
        || (assetTargetCollection(asset) === "events" && assetTargetId(asset) === event.id && eventImageFields.includes(assetTargetField(asset) || "imageUrl"))
        || (assetLinkedCollection(asset) === "events" && assetLinkedId(asset) === event.id && eventImageFields.includes(assetLinkedField(asset) || "imageUrl"))
        || (eventUrl && urls.includes(eventUrl));
    })
    .filter((asset) => mediaAssetUrl(asset))
    .sort((a, b) => {
      const directIds = [event.thumbnail_media_asset_id, event.thumbnailMediaAssetId, event.mediaAssetId, event.media_asset_id, event.assetId].filter(Boolean);
      const score = (asset = {}) => [
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
  if (mobileLeanStart()) {
    return members.map((member) => ({
      ...member,
      logoDisplayUrl: safeMemberLogoUrl(member, member.logoDisplayUrl || member.logoUrl || "")
    }));
  }
  const mediaAssets = await list("media_assets").catch(() => []);
  return members.map((member) => {
    const asset = publicMemberLogoAsset(member, mediaAssets);
    return {
      ...member,
      logoDisplayUrl: safeMemberLogoUrl(member, mediaAssetUrl(asset || {}) || member.logoUrl || "")
    };
  });
}

function boardPortrait(person) {
  return person.photoUrl
    ? `<img src="${escapeHtml(person.photoUrl)}" alt="Portraet ${escapeHtml(person.name)}" ${liveImageAttrs("member")}>`
    : initials(person.name);
}

function speakerPortrait(speaker) {
  return speaker.photoUrl
    ? `<img src="${escapeHtml(speaker.photoUrl)}" alt="Portraet ${escapeHtml(speaker.name)}" ${liveImageAttrs("member")}>`
    : `<span class="avatar">${initials(speaker.name)}</span>`;
}

function speakerName(speaker = {}) {
  return speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ") || "Referent";
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
    .filter((topic) => topicIsReleasedAfterEvent(topic, events) && (topicIds.has(topic.id) || (topic.speakerIds || []).includes(speaker.id)))
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
  return text.split(/\n+/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function eventIntroText(event = {}) {
  return String(event.description || event.publicTeaser || event.teaserText || event.shortDescription || event.introText || event.subtitle || "").trim();
}

function archiveEventImageUrl(event = {}, mediaAssets = []) {
  const asset = publicEventMediaAsset(event, mediaAssets);
  const candidates = [
    mediaAssetUrl(asset || {}),
    versionedAssetUrl(event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "", event)
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
  const candidates = [directAssetUrl, directUrl].filter(Boolean);
  const match = candidates.find((url) => validEventImageUrl(url) && !blockedHomeEventImageUrl(url));
  return match || "";
}

function eventDetailImageUrl(event = {}, mediaAssets = [], blockedUrls = []) {
  const blocked = new Set(blockedUrls.filter(Boolean));
  const candidate = archiveEventImageUrl(event, mediaAssets);
  if (candidate && !blocked.has(candidate)) return candidate;
  const direct = event.imageUrl || event.thumbnail_url || event.thumbnailUrl || event.assetUrl || "";
  if (validEventImageUrl(direct) && !blocked.has(direct)) return direct;
  return "";
}

function eventTalkSpeakers(topic = {}, event = {}, speakers = []) {
  const eventSpeakerIds = new Set(event.speakerIds || []);
  const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
  return speakers.filter((speaker) => {
    const topicLinked = topicSpeakerIds.size
      ? topicSpeakerIds.has(speaker.id)
      : speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
    const eventLinked = eventSpeakerIds.has(speaker.id) || (speaker.eventIds || []).includes(event.id);
    return topicLinked && eventLinked;
  });
}

function eventTalksMarkup(topics = [], speakers = [], event = {}) {
  if (isPastEvent(event)) return "";
  const assignedTopics = (event.topicIds || []).map((topicId) => topics.find((topic) => topic.id === topicId)).filter(Boolean).slice(0, 6);
  if (!assignedTopics.length) return "";
  return `<section class="event-talks"><div class="section-head"><div><p class="eyebrow">Themen & Referenten</p><h2>Agenda des Medienfruehstuecks</h2></div></div>
    <div class="event-talk-list">${assignedTopics.map((topic) => {
    const topicSpeakers = eventTalkSpeakers(topic, event, speakers);
    const short = topic.shortDescription || topic.teaserText || topic.subtitle || "";
    const text = topic.longDescription && topic.longDescription !== short ? topic.longDescription : "";
    return `<article class="event-talk-card">
      <div class="event-talk-card__body">
        <h3>${escapeHtml(topic.title || "Thema")}</h3>
        ${short ? `<p class="event-talk-card__short">${escapeHtml(short)}</p>` : ""}
        ${text ? `<p>${escapeHtml(text)}</p>` : ""}
        <div class="event-talk-speakers">${topicSpeakers.length ? topicSpeakers.map((speaker) => `<a class="event-talk-speaker" href="${speakerProfileHref(speaker)}">
          <div class="event-talk-speaker__portrait">${speakerPortrait(speaker)}</div>
          <div><strong>${escapeHtml(speakerName(speaker))}</strong><small>${escapeHtml([speaker.position, speaker.company].filter(Boolean).join(" - "))}</small>${speaker.shortBio ? `<p>${escapeHtml(speaker.shortBio)}</p>` : ""}</div>
        </a>`).join("") : `<span class="event-talk-speaker event-talk-speaker--empty">Referent wird ergaenzt.</span>`}</div>
      </div>
    </article>`;
  }).join("")}</div>
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
  const retrospectiveArticle = editorial.find((item) => isRetrospectiveArticle(item) && retrospectiveLinkedEvent(item, [event])?.id === event.id);
  const displayTitle = retrospectiveArticle?.title || event.retrospectiveTitle || event.title;
  const dateLabel = event.displayDate || formatDate(event.date);
  const detailUrl = retrospectiveArticle?.id ? `#/retrospective/${escapeHtml(retrospectiveArticle.id)}` : `#/event/${escapeHtml(event.id)}`;
  const imageUrl = archiveEventImageUrl(event, mediaAssets)
    || retrospectiveThumbUrl(retrospectiveArticle, event, galleries, mediaAssets)
    || eventMediaThumbUrl(event, eventMedia);
  return `<article class="archive-article archive-article--list">
    <a class="archive-article__thumb" href="${detailUrl}" aria-label="Rückblick ${escapeHtml(displayTitle)} ansehen">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Rückblick ${escapeHtml(displayTitle)}" loading="lazy" decoding="async">` : `<span>${escapeHtml(event.eventType || "Archiv")}</span>`}
    </a>
    <div class="archive-article__body">
      <p class="eyebrow">${escapeHtml(dateLabel)}${event.city ? ` · ${escapeHtml(event.city)}` : ""}</p>
      <h2><a href="${detailUrl}">${escapeHtml(displayTitle)}</a></h2>
      <p class="archive-article__meta">${escapeHtml(event.locationName || "Ort nicht angegeben")}${host ? ` · Co-Gastgeber: ${escapeHtml(host.name)}` : ""}</p>
      <p>${escapeHtml(teaserText(event.postEventummary || event.description || "", 260))}</p>
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
  const renderEvent = (event) => `<a class="internal-sticky-event" href="#/event/${event.id}">
    ${event.imageUrl ? `<img src="${escapeHtml(event.imageUrl)}" alt="Eventbild ${escapeHtml(event.title || "")}">` : `<span class="internal-sticky-event__picto">${aboutPicto("breakfast")}</span>`}
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
      ${rubricRotator(eventSlides, renderEvent, `<a class="internal-sticky-event" href="#/events"><span class="internal-sticky-event__picto">${aboutPicto("breakfast")}</span><span><strong>Neue Termine in Vorbereitung</strong><small>Zur Eventübersicht</small></span></a>`)}
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
    const [blocks, events, board, rawMembers, topics] = bereich === "ueber_uns"
      ? await Promise.all([
        internalBlocks(bereich),
        listPublicEvents().catch(() => []),
        listPublicContent("boardMembers").catch(() => []),
        listPublicContent("members").catch(() => []),
        listPublicContent("topics").catch(() => [])
      ])
      : [await internalBlocks(bereich), [], [], [], []];
    const members = mobileLeanStart() ? rawMembers : await withPublicMemberLogos(rawMembers);
    const hero = blocks.find((block) => block.typ === "hero") || blocks[0];
    const cards = blocks.map((block) => internalCard(block, meta)).join("");
    const aboutCards = aboutCardGroups(blocks, meta);
    const aboutTexts = blocks.map((block) => aboutLongTextSection(block)).join("");
    const desktopSections = blocks.map((block) => internalDesktopSection(block, meta)).join("");
    if (bereich === "ueber_uns") {
      return publicShell(meta.active, `${subhero(meta.eyebrow, meta.title, meta.intro)}
      <section class="section internal-overview internal-overview--about"><div class="container"><div class="internal-about-layout"><div class="internal-about-main">
        <div class="internal-mobile-list internal-mobile-list--about">${aboutCards || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
        <div class="internal-about-texts">${aboutTexts}</div>
        </div>${aboutStickyContent(events, board, members, topics)}</div>
      </div></section>`);
    }
    return publicShell(meta.active, `${subhero(meta.eyebrow, hero?.titel || meta.title, hero?.kurztext || meta.intro)}
      <section class="section internal-overview"><div class="container">
        <div class="internal-mobile-list">${cards || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
        <div class="internal-desktop-sections">${desktopSections || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
      </div></section>`);
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
    <section class="section"><div class="container internal-detail"><a class="link" href="#/${meta.route}">← Zurueck</a><article class="detail-main"><div class="editorial-text">${articleParagraphs(block.langtext)}</div>${cta}</article></div></section>`);
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
    return isNews && isVisibleNews && !isHidden;
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

function isStandaloneTopic(item = {}) {
  const category = normalizeTopicType(item.category || item.type || "");
  const section = normalizeTopicType(item.section || item.page || "");
  return category !== "vortrag"
    && section !== "vortraege"
    && section !== "vortrage"
    && item.isTalk !== true;
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
      <button type="button" class="button button--secondary button--small tts-reader__large-text" data-tts-play data-tts-mode="accessible" data-audio-url="${escapeHtml(accessibleUrl)}" data-timing-url="${escapeHtml(serviceTimingUrl)}" aria-pressed="false" aria-label="Gro&szlig;en Text &ouml;ffnen" ${accessibleUrl ? "" : "disabled"}><span class="tts-control-icon tts-control-icon--search" aria-hidden="true"></span></button>
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
  const text = item.articleText || item.bodyText || item.longDescription || item.introText || "";
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

function teaserText(value = "", length = 118) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
}

function downloadUrl(item = {}, fallback = "#/downloads") {
  return item.documentUrl || item.assetUrl || item.fileUrl || fallback;
}

function downloadCard(item) {
  const url = downloadUrl(item);
  const active = url !== "#/downloads";
  return `<a class="quick-card download-card" href="${escapeHtml(url)}" ${active ? `target="_blank" rel="noreferrer"` : ""}>
    <p class="eyebrow">${escapeHtml(item.category || "Download")}</p>
    <h3>${escapeHtml(item.title || item.fileName || "Download")}</h3>
    <p>${escapeHtml(item.description || item.bodyText || item.fileName || "PDF wird öffentlich bereitgestellt.")}</p>
  </a>`;
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
  if (["archived", "archive", "deleted", "cancelled", "canceled", "draft", "inactive", "inaktiv"].includes(status)) return false;
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

function eventRegistrationIsOpen(event = {}) {
  const registrationState = String(event.registrationStatus || event.registration_state || event.registrationState || "").toLowerCase();
  return Boolean(event.registrationEnabled)
    || (event.accessType === "public" && event.allowPublicRegistration === true)
    || (event.accessType === "members_only" && event.allowMemberRegistration === true)
    || ["open", "offen", "active", "aktiv", "registration_open"].includes(registrationState)
    || event.preStatus === "invitation_published"
    || event.lifecyclePhase === "registration_open";
}

function eventRegistrationStatusLabel(event = {}) {
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
            ${next ? `<h2>${escapeHtml(formatDate(next.date))}${next.city ? ` · ${escapeHtml(next.city)}` : ""}</h2><span>${escapeHtml(next.subtitle || next.title || "")}</span><div class="pdtv-mobile-next-actions"><a class="button button--primary button--small" href="#/register/${next.id}">Anmelden</a><a href="#/event/${next.id}">Details ansehen →</a></div>` : `<h2>Neue Termine in Vorbereitung</h2><span>Die nächsten Formate werden in Kürze veröffentlicht.</span><div class="pdtv-mobile-next-actions"><a href="#/events">Events ansehen →</a></div>`}
          </div>
        </article>
      </div>
      <nav class="pdtv-mobile-card-grid" aria-label="Hauptbereiche">
        ${mobileCards.map(([href, type, title, text], index) => `<a class="pdtv-mobile-card pdtv-mobile-card--${type} ${index === 0 || index === 3 ? "pdtv-mobile-card--dark" : ""}" href="${href}"><span class="pdtv-mobile-card__icon" aria-hidden="true"></span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></a>`).join("")}
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
    <div class="home-event-card__actions"><a class="button button--primary" href="#/register/${escapeHtml(next.id)}">Anmelden</a><a class="home-text-link" href="#/event/${escapeHtml(next.id)}">Details ansehen</a></div>
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
    <section class="section section--white"><div class="container feature home-member-feature"><div><p class="eyebrow">Mitglieder</p><h2>Ein Netzwerk für digitale Medien.</h2><p class="lead">Mitglieder profitieren von Fachimpulsen, Medienfruehstuecken und relevanten Branchenkontakten.</p><a class="button button--secondary" href="#/members">Mitglieder entdecken</a></div><div class="member-logos">${featuredMembers.map((member) => `<div class="member-tile">${memberLogo(member)}</div>`).join("")}</div></div></section>
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

function eventShowsOnHome(event = {}) {
  return event.showOnHome !== false;
}

function homeRetrospectiveItems(events = [], editorial = []) {
  const pastEvents = events
    .filter((event) => isPastEvent(event) && homeVisibleRecord(event))
    .map((event) => ({ ...event, homeType: "event-retrospective", href: "#/archive", dateKey: homeDateValue(event) }));
  const articles = editorial
    .filter(isRetrospectiveArticle)
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
      if (key.includes("vondenbestenlernen")) return block.showOnHome === true;
      return key.includes("medienfruehstueck") || key.includes("medienfruehstuecke");
    })
    .sort((a, b) => Number(a.sortierung || 0) - Number(b.sortierung || 0))
    .slice(0, 2);
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
  return selected.map((entry) => entry.speaker).slice(0, 6);
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

export async function homePage() {
  const withHomeTimeout = (promise, fallback = [], ms = 24000) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
  const [events, editorial, topics, speakers, aboutBlocks] = await Promise.all([
    withHomeTimeout(listPublicEvents().catch(() => [])),
    withHomeTimeout(listPublicContent("editorialContent").catch(() => [])),
    withHomeTimeout(listPublicContent("topics").catch(() => [])),
    withHomeTimeout(listPublicContent("speakers").catch(() => [])),
    withHomeTimeout(internalBlocks("ueber_uns").catch(() => []))
  ]);
  const upcoming = events.filter(upcomingEventIsVisible).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const next = upcoming.find(eventShowsOnHome) || null;
  const mediaAssets = next ? await withHomeTimeout(listPublicEventMediaAssets([next]).catch(() => []), [], 8000) : [];
  const nextImageUrl = next ? upcomingEventImageUrl(next, mediaAssets, { fallback: false }) : "";
  const retrospective = homeRetrospectiveItems(events, editorial)[0] || null;
  const seriesItems = homeFormatSeries(aboutBlocks);
  const latestNewsItems = publicNewsItems(editorial)
    .sort(newestContentFirst)
    .slice(0, 3);
  const visibleTopics = topics
    .filter((topic) => topicIsReleasedAfterEvent(topic, events) && isStandaloneTopic(topic) && homeImageUrl(topic, "topic"))
    .sort(newestContentFirst)
    .slice(0, 6);
  const visibleSpeakers = homeSpeakersOnePerTalk(events, topics, speakers);

  const newsBody = latestNewsItems.length ? `<div class="pdtv-home-news-grid">${latestNewsItems.map((item) => {
    const image = homeImageUrl({ ...item, imageUrl: newsThumbUrl(item) }, "news");
    const audio = availableAudioUrl(item.audioUrl || item.audioNaturalUrl || item.audioAccessibleUrl || "", item.audioStatus || item.audioNaturalStatus || item.audioAccessibleStatus || "");
    return `<a class="pdtv-home-news-card" href="#/news/${escapeHtml(item.id)}">
      ${image ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="lazy" decoding="async" ${liveImageAttrs("news")}></figure>` : ""}
      <div><p class="eyebrow">${escapeHtml(item.category || "News")}${audio ? " - Audio" : ""}</p><h3>${escapeHtml(item.title || "News")}</h3>${homeTeaser(item, 160) ? `<p>${escapeHtml(homeTeaser(item, 160))}</p>` : ""}<span>Beitrag öffnen</span></div>
    </a>`;
  }).join("")}</div>` : `<div class="pdtv-home-empty">Aktuell sind keine News veröffentlicht.</div>`;

  const topicsBody = visibleTopics.length ? `<div class="pdtv-home-topic-grid">${visibleTopics.map((topic) => `<a class="pdtv-home-topic-card" href="#/topic/${escapeHtml(topic.id)}">
    <img src="${escapeHtml(homeImageUrl(topic, "topic"))}" alt="${escapeHtml(topic.title || "Thema")}" loading="lazy" decoding="async" ${liveImageAttrs("topic")}><span><strong>${escapeHtml(topic.title || "Thema")}</strong>${homeTeaser(topic, 135) ? `<small>${escapeHtml(homeTeaser(topic, 135))}</small>` : ""}</span>
  </a>`).join("")}</div>` : "";

  const speakersBody = visibleSpeakers.length ? `<div class="pdtv-home-speaker-grid">${visibleSpeakers.map((speaker) => {
    const name = speaker.name || [speaker.firstName, speaker.lastName].filter(Boolean).join(" ");
    const photo = homeImageUrl({ ...speaker, imageUrl: speaker.photoUrl || speaker.imageUrl }, "member");
    return `<article class="pdtv-home-speaker-card">${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" ${liveImageAttrs("member")}>` : `<span>${escapeHtml(initials(name || "Referent"))}</span>`}<div><h3>${escapeHtml(name)}</h3>${speaker.company ? `<p>${escapeHtml(speaker.company)}</p>` : ""}<a class="button button--secondary button--small" href="${speakerProfileHref(speaker)}">Mehr</a></div></article>`;
  }).join("")}</div>` : "";

  const seriesBody = seriesItems.length ? `<div class="pdtv-home-series-grid">${seriesItems.map((series) => {
    const imageUrl = stableImageUrl(series.imageUrl || series.thumbnailUrl || series.assetUrl || "", "event");
    return `<article class="pdtv-home-series-card${imageUrl ? " pdtv-home-series-card--with-bg" : ""}"${imageUrl ? ` style="--series-bg: url('${escapeHtml(imageUrl)}')"` : ""}>
      <div class="pdtv-home-series-card__copy"><h3>${escapeHtml(series.titel)}</h3>${series.kurztext ? `<p>${escapeHtml(series.kurztext)}</p>` : ""}${series.langtext ? `<p>${escapeHtml(teaserText(series.langtext, 210))}</p>` : ""}<a class="button button--secondary button--small" href="#/ueber-uns/${encodeURIComponent(series.slug)}">Artikel öffnen</a></div>
    </article>`;
  }).join("")}</div>` : "";

  return publicShell("home", `<main class="pdtv-home">
    <div class="container">${homeHeroMarkup({ next, nextImageUrl, retrospective, series: seriesItems[0] || null })}</div>
    ${homeSection("Aktuelle News", "News", newsBody, `<a class="link" href="#/news">Alle News</a>`)}
    ${homeSection("Themen", "Dossiers", topicsBody, `<a class="link" href="#/topics">Alle Themen</a>`)}
    ${homeSection("Aktuelle Referenten", "Köpfe", speakersBody, `<a class="link" href="#/speakers">Alle Referenten</a>`)}
    ${homeSection("Vortragsreihen", "Interna", seriesBody)}
  </main>`);
}

export async function speakersPage() {
  const speakers = (await listPublicContent("speakers").catch(() => []))
    .filter(publicSpeakerIsVisible)
    .sort((a, b) => String(speakerName(a)).localeCompare(String(speakerName(b)), "de", { sensitivity: "base" }));
  const cards = speakers.map((speaker) => {
    const name = speakerName(speaker);
    const role = [speaker.position, speaker.company].filter(Boolean).join(" - ");
    const teaser = speaker.shortBio || speaker.bio || speaker.longBio || "";
    return `<article class="speaker-directory-card">
      <a class="speaker-directory-card__portrait" href="${speakerProfileHref(speaker)}">${speakerPortrait(speaker)}</a>
      <div>
        <p class="eyebrow">Referent</p>
        <h2><a href="${speakerProfileHref(speaker)}">${escapeHtml(name)}</a></h2>
        ${role ? `<p class="speaker-profile__position">${escapeHtml(role)}</p>` : ""}
        ${teaser ? `<p>${escapeHtml(teaserText(teaser, 220))}</p>` : ""}
        <a class="button button--secondary button--small" href="${speakerProfileHref(speaker)}">Mehr</a>
      </div>
    </article>`;
  }).join("");
  return publicShell("speakers", `${subhero("Referenten", "Profile und Vitas", "Menschen, Themen und Perspektiven aus den PROdigitalTV-Formaten.")}
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
  const intro = speaker.shortBio || speaker.bio || "";
  const vita = speaker.longBio || speaker.vita || speaker.biography || "";
  const talks = speakerTalkLinks(speaker, topics, events);
  const talksHtml = talks.length ? `<div class="speaker-detail-talks">${talks.map(({ topic, event }) => `<a class="speaker-detail-talk" href="#/topic/${escapeHtml(topic.id)}">
      <span>${escapeHtml(event?.displayDate || formatDate(event?.date || "") || "Vortrag")}</span>
      <strong>${escapeHtml(topic.title || "Vortrag")}</strong>
      ${event?.title ? `<small>${escapeHtml(event.title)}</small>` : ""}
    </a>`).join("")}</div>` : `<div class="alert">Noch keine veroeffentlichten Vortraege zugeordnet.</div>`;
  return publicShell("speakers", `${subhero("Referent", name, role || "PROdigitalTV Referentenprofil")}
    <section class="section section--white"><div class="container speaker-detail">
      <aside class="speaker-detail__portrait">${speakerPortrait(speaker)}</aside>
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
        <h2>Vortraege und Themen</h2>
        ${talksHtml}
      </article>
    </div></section>`);
}

export async function eventsPage() {
  const [events, sponsors] = await Promise.all([
    listPublicEvents(isMember()).catch(() => []),
    listPublicContent("sponsors").catch(() => [])
  ]);
  const user = currentUser();
  const visible = events.filter((event) => event.accessType !== "invitation_only" || isMember(user) || event.showPublicTeaser);
  const rawUpcoming = visible.filter(upcomingEventIsVisible);
  const upcoming = rawUpcoming.map((event) => ({
    ...event,
    imageDisplayUrl: upcomingEventImageUrl(event, [], { fallback: false }),
    storedTicket: readStoredTicket(event.id)
  }));
  return publicShell("events", `${subhero("Veranstaltungen", "Events", "Kuratierte Formate für Wissenstransfer, Partnerschaften und relevante Branchenkontakte.")}
    <section class="section"><div class="container"><div class="filters"><button class="filter active">Kommende Events</button><button class="filter">Öffentlich</button><button class="filter">Mitglieder</button><a class="filter" href="#/archive">Rückblicke</a></div>
    ${upcoming.length ? `<div class="card-grid card-grid--three">${upcoming.map((event) => eventCard(event, false, sponsors)).join("")}</div>` : `<div class="alert">Aktuell sind keine neuen Termine veröffentlicht. Im Eventarchiv finden Sie die letzten PROdigitalTV-Veranstaltungen.</div>`}</div></section>`);
}

async function getPublicRouteEvent(id, includeMemberEvents = false) {
  const directEvent = getOne("events", id).then((event) => {
    if (event) return event;
    throw new Error(`Event ${id} nicht gefunden`);
  });
  const listedEvent = listPublicEvents(includeMemberEvents).then((events) => {
    const event = events.find((item) => item.id === id);
    if (event) return event;
    throw new Error(`Event ${id} nicht in oeffentlicher Liste`);
  });
  try {
    return await Promise.any([directEvent, listedEvent]);
  } catch {
    return null;
  }
}

export async function eventDetailPage(id, query = new URLSearchParams()) {
  const previewMode = query?.get?.("preview") === "1" && isAdmin();
  const ticketToken = String(query?.get?.("ticket") || "").trim();
  let ticketActivation = null;
  if (ticketToken) {
    try {
      const linkedTicket = await linkTicketDevice(ticketToken);
      if (!id || linkedTicket.eventId === id) ticketActivation = linkedTicket;
    } catch {
      ticketActivation = null;
    }
  }
  let event;
  try {
    event = await getPublicRouteEvent(id, isMember());
  } catch {
    return publicShell("events", `${subhero("Geschuetzter Bereich", "Login erforderlich", "Dieses Event ist nur für berechtigte Personen sichtbar.")}<section class="section"><div class="container"><a class="button button--primary" href="#/login">Zum Login</a></div></section>`);
  }
  if (!event) return notFoundPage();
  if (!previewMode && !isPastEvent(event) && !upcomingEventIsVisible(event)) return notFoundPage();
  const [speakers, sponsors, topics, galleries, mediaAssets] = await Promise.all([
    listPublicContent("speakers").catch(() => []),
    listPublicContent("sponsors").catch(() => []),
    listPublicContent("topics").catch(() => []),
    listPublicContent("galleries").catch(() => []),
    listPublicEventMediaAssets([event]).catch(() => [])
  ]);
  const registrationOpen = eventRegistrationIsOpen(event);
  const storedTicket = ticketActivation || await validateStoredTicket(event.id).catch(() => readStoredTicket(event.id));
  const restricted = event.accessType === "members_only" && !isMember() && !registrationOpen && !storedTicket;
  if (restricted && !event.showPublicTeaser) return publicShell("events", subhero("Geschuetzter Bereich", "Nur für Mitglieder", "Bitte melden Sie sich an, um dieses Event zu sehen."));
  const coHost = sponsors.find((sponsor) => sponsor.id === event.hostId) || null;
  const coHostLogo = coHost ? publicSponsorLogoUrl(coHost, mediaAssets) : "";
  const assignedGallery = galleries.find((gallery) => gallery.id === event.galleryId) || galleries.find((gallery) => gallery.eventId === event.id && gallery.status === "published" && gallery.visibility === "public");
  const assignedGalleryImages = Array.isArray(assignedGallery?.images)
    ? [...assignedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 24)
    : [];
  const registrationAllowed = registrationOpen;
  const ticketStatusCard = storedTicket ? `<section class="mobile-ticket-card" aria-label="Gespeichertes Handy-Ticket">
    <div class="mobile-ticket-card__icon" aria-hidden="true"></div>
    <div class="mobile-ticket-card__body">
      <p class="eyebrow">Handy-Ticket aktiv</p>
      <h2>${escapeHtml(event.title || storedTicket.eventTitle || "PROdigitalTV Event")}</h2>
      <p>${escapeHtml([storedTicket.firstName, storedTicket.lastName].filter(Boolean).join(" ") || "Dieses Geraet")}</p>
      <span>Dieses Handy ist fuer den Einlass vorbereitet.</span>
    </div>
  </section>` : "";
  const eventImageUrl = eventDetailImageUrl(event, mediaAssets, [coHostLogo]);
  const introText = eventIntroText(event);
  const longText = event.postEventummary || event.archiveText || event.longDescription || event.bodyText || event.articleText || "";
  const haseparateLongText = longText.trim() && longText.trim() !== introText.trim();
  const registrationCta = registrationAllowed
    ? `<div class="event-registration-cta"><a class="button button--primary" href="#/register/${escapeHtml(event.id)}">Zum Event anmelden</a></div>`
    : `<div class="alert event-registration-cta">${event.accessType === "invitation_only" ? "Teilnahme nur auf Einladung." : "Anmeldung derzeit nicht verfuegbar."}</div>`;
  const eventInfoBlock = restricted ? "" : `<section class="venue-stage event-info-stage"><div class="event-info-stage__facts"><p class="eyebrow">Daten</p><div class="event-info-facts"><div class="event-info-fact"><label>Datum</label><strong>${formatDate(event.date)}</strong></div>${event.startTime ? `<div class="event-info-fact"><label>Zeit</label><strong>${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""} Uhr</strong></div>` : ""}<div class="event-info-fact"><label>Status</label><strong>${escapeHtml(eventRegistrationStatusLabel(event))}</strong></div></div></div><div class="venue-stage__place"><p class="eyebrow">Adresse</p><h2>${escapeHtml(event.locationName)}</h2><p>${escapeHtml(event.address || "")}${event.address ? "<br>" : ""}${escapeHtml(event.city)}${event.phone ? `<br>Telefon: ${escapeHtml(event.phone)}` : ""}</p></div><div class="venue-stage__partners"><p class="eyebrow">Co-Gastgeber</p>${coHost ? `<article class="partner-spotlight">${coHostLogo ? `<img class="partner-spotlight__logo" src="${escapeHtml(coHostLogo)}" alt="Logo ${escapeHtml(coHost.name || "")}" ${liveImageAttrs("sponsor")}>` : `<span class="avatar">${initials(coHost.name)}</span>`}<div><h3>${escapeHtml(coHost.name)}</h3>${coHost.description ? `<p>${escapeHtml(coHost.description)}</p>` : ""}</div></article>` : `<p>Co-Gastgeber wird bei Bekanntgabe ergaenzt.</p>`}</div></section>`;
  const previewNotice = previewMode ? `<div class="alert alert--warning">CMS-Vorschau: Dieses Event ist noch nicht zwingend öffentlich sichtbar.</div>` : "";
  return publicShell("events", `${subhero(event.eventType, event.title, event.subtitle)}
    <section class="section event-detail-section"><div class="container detail-grid event-detail-grid">
      <article class="detail-main">
        ${previewNotice}
        <figure class="event-detail-image"><img src="${escapeHtml(stableImageUrl(eventImageUrl, "event"))}" alt="Eventbild ${escapeHtml(event.title)}" loading="lazy" ${liveImageAttrs("event")}></figure>
        ${ticketStatusCard}
        ${restricted ? `<div class="alert alert--warning">Details und Anmeldung dieses Mitglieder-Events stehen nach dem Login zur Verfuegung.</div>` : ""}
        <h2>Zum Event</h2>${introText ? `<div class="lead editorial-text">${articleParagraphs(introText)}</div>` : ""}
        ${restricted ? "" : registrationCta}
        ${haseparateLongText ? `<h2>Rückblick</h2><div class="editorial-text">${articleParagraphs(longText)}</div>` : ""}
        ${eventTalksMarkup(topics, speakers, event)}
        ${event.lunchNote ? `<div class="alert">${escapeHtml(event.lunchNote)}</div>` : ""}
        ${restricted ? "" : `<section class="venue-stage venue-stage--event-detail"><div class="venue-stage__identity"><p class="eyebrow">Veranstaltungsort</p>${coHost && coHostLogo ? `<img class="venue-stage__logo" src="${escapeHtml(coHostLogo)}" alt="Logo ${escapeHtml(coHost.name || "")}" ${liveImageAttrs("sponsor")}>` : ""}<h2>${escapeHtml(coHost?.name || event.locationName)}</h2><p>${escapeHtml(event.locationName || "")}${event.locationName ? "<br>" : ""}${escapeHtml(event.address || "")}${event.address ? "<br>" : ""}${escapeHtml(event.city)}</p></div><div class="venue-stage__description"><p class="eyebrow">Co-Gastgeber</p>${coHost ? `${coHost.description ? `<p>${escapeHtml(coHost.description)}</p>` : `<p>${escapeHtml(coHost.name)} begleitet dieses PROdigitalTV Event als Co-Gastgeber.</p>`}` : `<p>Co-Gastgeber wird bei Bekanntgabe ergaenzt.</p>`}</div></section>`}
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
        <div class="fact"><label>Ort</label><strong>${escapeHtml(event.locationName)}<br>${escapeHtml(event.city)}</strong></div>
        <div class="fact"><label>Status</label><strong>${escapeHtml(eventRegistrationStatusLabel(event))}</strong></div>
      </aside>
    </div></section>`);
}

export async function registrationPage(id) {
  let event;
  try {
    event = await getPublicRouteEvent(id, true);
  } catch {
    return publicShell("events", `${subhero("Anmeldung", "Eventdaten konnten nicht geladen werden", "Bitte oeffnen Sie die Anmeldung aus der Eventseite erneut.")}<section class="section"><div class="container"><a class="button button--primary" href="#/events">Zu den Events</a></div></section>`);
  }
  if (!event) return notFoundPage();
  if (!eventRegistrationIsOpen(event)) {
    return publicShell("events", `${subhero("Anmeldung", event.title, "Fuer dieses Event ist aktuell keine Anmeldung moeglich.")}
      <section class="section"><div class="container" style="max-width:820px"><div class="alert">Die Anmeldung ist derzeit geschlossen.</div><a class="button button--secondary" href="#/event/${escapeHtml(event.id)}">Zurueck zum Event</a></div></section>`);
  }
  return publicShell("events", `${subhero("Anmeldung", event.title, `${formatDate(event.date)} · ${event.locationName}, ${event.city}`)}
    <section class="section"><div class="container registration-container"><form id="registration-form" data-event-id="${event.id}" class="form-card registration-form">
      <div class="registration-summary">
        <div><span>Event</span><strong>${escapeHtml(event.title || "")}</strong></div>
        <div><span>Termin</span><strong>${escapeHtml(formatDate(event.date))}${event.startTime ?` - ${escapeHtml(event.startTime)} Uhr` : ""}</strong></div>
        <div><span>Ort</span><strong>${escapeHtml([event.locationName, event.city].filter(Boolean).join(", "))}</strong></div>
      </div>
      <div class="alert">Ihre Anmeldung ist erst nach Bestaetigung Ihrer E-Mail-Adresse gueltig.</div>
      <fieldset class="registration-section"><legend>Person und Kontakt</legend>
      <div class="form-grid--two"><div class="field"><label for="firstName">Vorname *</label><input id="firstName" name="firstName" autocomplete="given-name" required></div><div class="field"><label for="lastName">Nachname *</label><input id="lastName" name="lastName" autocomplete="family-name" required></div></div>
      <div class="form-grid--two"><div class="field"><label for="company">Unternehmen *</label><input id="company" name="company" autocomplete="organization" required></div><div class="field"><label for="position">Position / Funktion *</label><input id="position" name="position" autocomplete="organization-title" required></div></div>
      <div class="form-grid--two"><div class="field"><label for="email">E-Mail *</label><input id="email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="phone">Telefon</label><input id="phone" name="phone" autocomplete="tel"></div></div>
      ${event.invitationCodeRequired ? `<div class="field"><label for="invitationCode">Einladungscode *</label><input id="invitationCode" name="invitationCode" autocomplete="one-time-code" required></div>` : ""}
      </fieldset>
      <fieldset class="registration-section registration-section--compact"><legend>Hinweise und Einwilligungen</legend>
      <div class="field"><label for="message">Bemerkung</label><textarea id="message" name="message" rows="3"></textarea></div>
      <div class="registration-consents">
      <label class="checkbox"><input type="checkbox" name="notifyForThisEvent"> Ich moechte an diese Veranstaltung und zukuenftige PROdigitalTV-Veranstaltungen erinnert werden.</label>
      <div class="notification-device-status" data-notification-device-status>Erinnerung noch nicht aktiviert. Wenn Browser-Push auf diesem Geraet nicht moeglich ist, erhalten Sie die Erinnerung per E-Mail.</div>
      <label class="checkbox checkbox--required registration-consent-info"><input type="checkbox" name="privacyMediaConsent" required><span>Datenschutz akzeptiert und Foto-/Video-Hinweis zur Veranstaltung zur Kenntnis genommen *</span><button class="consent-info-button" type="button" aria-label="Erklaerung zu Datenschutz und Foto-/Video-Hinweis" title="Erklaerung">i</button><small>Ihre Daten werden zur Organisation der Veranstaltung verarbeitet. Bei PROdigitalTV-Veranstaltungen koennen Foto- und Videoaufnahmen entstehen, die fuer Dokumentation und Oeffentlichkeitsarbeit genutzt werden.</small></label>
      </div></fieldset>
      <div class="registration-submit"><button class="button button--primary" type="submit">Anmeldung absenden</button><div id="form-result"></div></div>
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
  const [topicsRaw, speakers, mediaAssets, events] = await Promise.all([
    listPublicContent("topics"),
    listPublicContent("speakers").catch(() => []),
    listPublicMediaAssets().catch(() => []),
    listPublicEvents().catch(() => [])
  ]);
  const speakerForTopic = (topic = {}) => speakers.find((speaker) => {
    const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
    return topicSpeakerIds.has(speaker.id) || speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
  }) || {};
  const topics = topicsRaw.filter((topic) => topicIsReleasedAfterEvent(topic, events)).map((topic) => {
    const speaker = speakerForTopic(topic);
    const topicAsset = publicTopicMediaAsset(topic, mediaAssets, "thumb");
    const ownImage = publicTopicThumbnailUrl(topic, mediaAssets);
    const ownImageType = publicTopicImageLooksLikeLogo(topic, topicAsset || {}, ownImage) ? "logo" : "image";
    const logoUrl = topic.companyLogoUrl || topic.logoUrl || topic.company_logo_url || speaker.companyLogoUrl || speaker.logoUrl || speaker.company_logo_url || "";
    const speakerPhoto = speaker.photoUrl || speaker.imageUrl || "";
    return {
      ...topic,
      cardImageUrl: ownImage || logoUrl || speakerPhoto || "",
      cardImageType: ownImage ? ownImageType : logoUrl ? "logo" : speakerPhoto ? "portrait" : ""
    };
  }).sort(newestContentFirst);
  const initialVisible = 9;
  const topicCards = topics.map((topic, index) => {
    const hidden = index >= initialVisible;
    return `<div class="topic-load-item" data-topic-load-item ${hidden ? "hidden" : ""}>${topicCard(topic)}</div>`;
  }).join("");
  const loadMore = topics.length > initialVisible
    ? `<div class="topic-load-more"><button class="button button--secondary" type="button" data-topic-load-more data-topic-load-step="6">Mehr Themen laden</button><small data-topic-load-count>${Math.min(initialVisible, topics.length)} von ${topics.length} Themen sichtbar</small></div>`
    : "";
  return publicShell("topics", `${subhero("Themen", "Die Agenda der digitalen Medienwirtschaft.", "PROdigitalTV buendelt relevante Fragestellungen und bringt sie in konkreten Events zur Diskussion.")}
    <section class="section"><div class="container"><div class="card-grid card-grid--three editorial-list editorial-list--topics" data-topic-load-list>${topicCards}</div>${loadMore}</div></section>`);
}

export async function newsPage(query = new URLSearchParams()) {
  const cmsNews = publicNewsItems(await listPublicContent("editorialContent"));
  const news = cmsNews.sort(newestContentFirst);
  const selectedCategory = String(query?.get?.("category") || "").trim();
  const categoryHref = (category) => `#/news?category=${encodeURIComponent(category || "News")}`;
  const newsCategories = (item = {}) => {
    const values = Array.isArray(item.category) ? item.category : [item.category || "News"];
    const categories = values
      .flatMap((value) => String(value || "").split(/\s*(?:\/|,|;|\|)\s*/))
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set(categories.length ? categories : ["News"])];
  };
  const categoryLinks = (item = {}) => newsCategories(item)
    .map((category) => `<a class="news-category-link" href="${escapeHtml(categoryHref(category))}">${escapeHtml(category)}</a>`)
    .join(`<span class="news-category-separator"> / </span>`);
  const filteredNews = selectedCategory
    ? news.filter((item) => newsCategories(item).includes(selectedCategory))
    : news;
  const featuredNews = filteredNews.slice(0, 6);
  const listedNews = filteredNews.slice(6);
  const newsCard = (item) => {
    const thumb = stableImageUrl(newsThumbUrl(item), "news");
    const teaser = item.shortText || item.teaserText || item.introText || item.bodyText || "";
    const category = newsCategories(item)[0] || "News";
    const detailHref = `#/news/${escapeHtml(item.id)}`;
    return `<article class="quick-card news-card"><a class="news-card__thumb-link" href="${detailHref}"><figure class="news-card__thumb"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="lazy" decoding="async" ${liveImageAttrs("news")}></figure></a><div class="news-card__body"><p class="eyebrow news-category-list">${categoryLinks(item)}</p><h3><a href="${detailHref}">${escapeHtml(item.title || "")}</a></h3>${item.subtitle ? `<p class="news-card__subtitle">${escapeHtml(item.subtitle)}</p>` : ""}<p class="news-card__teaser">${escapeHtml(teaser).slice(0, 320)}</p></div></article>`;
  };
  const newsListItem = (item) => {
    const date = item.publishDate || item.validFrom || item.updatedAt || item.createdAt || "";
    const teaser = item.shortText || item.teaserText || item.introText || item.subtitle || item.bodyText || "";
    const category = newsCategories(item)[0] || "News";
    const thumb = stableImageUrl(newsThumbUrl(item), "news");
    return `<article class="news-list-item">
      <a class="news-list-item__thumb" href="#/news/${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title || "News")}"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.thumbnail_alt || item.title || "News")}" loading="lazy" decoding="async" ${liveImageAttrs("news")}></a>
      <div class="news-list-item__body">
        <span class="news-list-item__meta">${categoryLinks(item)}${date ? ` / ${escapeHtml(formatDate(date))}` : ""}</span>
        <strong><a href="#/news/${escapeHtml(item.id)}">${escapeHtml(item.title || "")}</a></strong>
        ${teaser ? `<span>${escapeHtml(teaser).slice(0, 170)}</span>` : ""}
      </div>
    </article>`;
  };
  return publicShell("news", `${subhero("News", "Aktuelles von PROdigitalTV.", "Meldungen, Hinweise und Neuigkeiten aus dem Verein und der digitalen Medienwirtschaft.")}
    <section class="section"><div class="container">${news.length ? `
      ${selectedCategory ? `<div class="news-filter-state"><span>Rubrik: <strong>${escapeHtml(selectedCategory)}</strong></span><a class="button button--secondary button--small" href="#/news">Alle News</a></div>` : ""}
      <div class="card-grid card-grid--three editorial-list editorial-list--news">${featuredNews.map(newsCard).join("")}</div>
      ${listedNews.length ? `<div class="news-list-view"><div class="section-head"><div><p class="eyebrow">Weitere News</p><h2>${selectedCategory ? `Weitere Meldungen in ${escapeHtml(selectedCategory)}` : "Alle weiteren Meldungen"}</h2></div></div>${listedNews.map(newsListItem).join("")}</div>` : ""}
      ${!filteredNews.length ? `<div class="alert">Zu dieser Rubrik sind aktuell keine News veröffentlicht.</div>` : ""}
    ` : `<div class="alert">Aktuell sind keine News veröffentlicht.</div>`}</div></section>`);
}

export async function newsDetailPage(id) {
  const publicEditorialContent = await listPublicContent("editorialContent").catch(() => []);
  let item = publicEditorialContent.find((entry) => [entry.id, entry.slug, entry.key].filter(Boolean).includes(id))
    || await getOne("editorialContent", id).catch(() => null);
  const isRetrospective = isRetrospectiveArticle(item);
  if (!item || (item.page !== "news" && item.section !== "news" && !isRetrospective)) return notFoundPage();
  if (!isRetrospective && !publicNewsItems([item]).length) return notFoundPage();
  const [sponsors, galleries, events] = await Promise.all([listPublicContent("sponsors"), listPublicContent("galleries"), listPublicEvents()]);
  const date = item.publishDate || item.validFrom || item.date || item.updatedAt || "";
  const text = item.longDescription || item.articleText || item.bodyText || item.mainText || item.text || item.fullText || item.longText || item.shortText || item.teaserText || "";
  const displayTitle = cleanNewsDetailTitle(item);
  const displayText = cleanNewsDetailText(text, displayTitle, item.subtitle || "", item.slug || item.key || item.id || "");
  const sponsor = item.sponsorId ? sponsors.find((entry) => entry.id === item.sponsorId) : null;
  const linkedEvent = retrospectiveLinkedEvent(item, events);
  const mediaAssets = isRetrospective && linkedEvent
    ? await listPublicEventMediaAssets([linkedEvent]).catch(() => [])
    : [];
  const articleImageUrl = stableImageUrl(isRetrospective
    ? retrospectiveThumbUrl(item, linkedEvent, galleries, mediaAssets)
    : item.imageUrl || item.thumbnail_url || item.thumbnailUrl || item.assetUrl || (linkedEvent ? archiveEventImageUrl(linkedEvent, mediaAssets) : ""), isRetrospective ? "event" : "news");
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
        <figure class="news-detail-clean__hero"><img src="${escapeHtml(articleImageUrl)}" alt="${escapeHtml(item.thumbnail_alt || item.thumbnailAlt || `Artikelmotiv ${displayTitle || "News"}`)}" loading="eager" decoding="async" ${liveImageAttrs("news")}><figcaption><h1>${escapeHtml(displayTitle)}</h1></figcaption></figure>
        <div class="news-detail-clean__body">
          ${item.subtitle ? `<p class="article-subline">${escapeHtml(item.subtitle)}</p>` : ""}
          ${ttsReader({ rubric: item.category || "News", title: displayTitle || "", label: "Vorlesen", text: [item.subtitle, displayText].filter(Boolean).join("\n\n"), inlineOffsetText: item.subtitle || "", audio: item.audio || {}, audioProvider: item.audioProvider || "", audioUrl: item.audioUrl || "", audioAccessibleUrl: item.audioAccessibleUrl || "", audioNaturalUrl: item.audioNaturalUrl || "", timingUrl: item.timingUrl || "", audioStatus: item.audioStatus || "", audioAccessibleStatus: item.audioAccessibleStatus || "", audioNaturalStatus: item.audioNaturalStatus || "" })}
          <div class="editorial-text">${articleParagraphs(displayText)}</div>
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
        <figure class="news-detail__thumb news-detail__hero-image"><img src="${escapeHtml(articleImageUrl)}" alt="${escapeHtml(item.thumbnail_alt || item.thumbnailAlt || `Artikelmotiv ${item.title || "News"}`)}" loading="eager" decoding="async" ${liveImageAttrs(isRetrospective ? "event" : "news")}></figure>
        ${ttsReader({ rubric: isRetrospective ? "Rückblick" : item.category || "News", title: item.title || "", text: [item.subtitle, text].filter(Boolean).join("\n\n"), inlineOffsetText: item.subtitle || "", audio: item.audio || {}, audioProvider: item.audioProvider || "", audioUrl: item.audioUrl || "", audioAccessibleUrl: item.audioAccessibleUrl || "", audioNaturalUrl: item.audioNaturalUrl || "", timingUrl: item.timingUrl || "", audioStatus: item.audioStatus || "", audioAccessibleStatus: item.audioAccessibleStatus || "", audioNaturalStatus: item.audioNaturalStatus || "" })}
        <div class="editorial-text">${leadMedia}${item.subtitle ? `<p class="article-subline">${escapeHtml(item.subtitle)}</p>` : ""}${articleParagraphs(text)}</div>
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

export async function topicDetailPage(id) {
  const [topic, events, sponsors, galleries, allTopics, speakers, mediaAssets] = await Promise.all([getOne("topics", id), listPublicEvents(), listPublicContent("sponsors"), listPublicContent("galleries"), listPublicContent("topics"), listPublicContent("speakers"), listPublicMediaAssets().catch(() => [])]);
  if (!topic) return notFoundPage();
  if (!topicIsReleasedAfterEvent(topic, events)) return notFoundPage();
  const linked = topicLinkedEvents(topic, events).filter(publicEventAllowsTopicRelease).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const heroSpeakers = speakers.filter((speaker) => {
    const topicSpeakerIds = new Set(topic.speakerIds || [topic.speakerId].filter(Boolean));
    return topicSpeakerIds.has(speaker.id) || speaker.topicId === topic.id || (speaker.topicIds || []).includes(topic.id);
  });
  const relatedTopics = allTopics
    .filter((entry) => entry.id !== topic.id && topicIsReleasedAfterEvent(entry, events))
    .slice(0, 8)
    .map((entry) => {
      const topicAsset = publicTopicMediaAsset(entry, mediaAssets, "thumb");
      const ownImage = publicTopicThumbnailUrl(entry, mediaAssets);
      const ownImageType = publicTopicImageLooksLikeLogo(entry, topicAsset || {}, ownImage) ? "logo" : "image";
      return {
        ...entry,
        cardImageUrl: ownImage || entry.cardImageUrl || "",
        cardImageType: ownImage ? ownImageType : entry.cardImageType || ""
      };
    });
  const topicIntro = "Einordnung, Hintergruende und Praxisbezug zu zentralen Begriffen der digitalen Medienwirtschaft.";
  const topicText = topic.longDescription || topic.bodyText || topic.shortDescription || "";
  const topicAudioText = [topic.subtitle, topic.longDescription, topic.bodyText, topic.shortDescription].filter(Boolean).join("\n\n");
  const topicVisibleText = `${topic.subtitle ? `<p class="article-subline">${escapeHtml(topic.subtitle)}</p>` : ""}${articleParagraphs(topicText)}`;
  const selectedGallery = topic.galleryId ? galleries.find((gallery) => gallery.id === topic.galleryId) : null;
  const attachedGalleryImages = Array.isArray(selectedGallery?.images)
    ? [...selectedGallery.images].filter((entry) => entry.url).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).slice(0, 12)
    : [];
  const leadMedia = attachedGalleryImages.length ? galleryPlayCta(selectedGallery, attachedGalleryImages) : "";
  const editorialBlock = topicText
    ? `<section class="section section--white"><div class="container topic-article">${ttsReader({ rubric: "Thema", title: topic.title || "", text: topicAudioText || topicText, inlineOffsetText: topic.subtitle || "", audio: topic.audio || {}, audioProvider: topic.audioProvider || "", audioUrl: topic.audioUrl || "", audioAccessibleUrl: topic.audioAccessibleUrl || "", audioNaturalUrl: topic.audioNaturalUrl || "", timingUrl: topic.timingUrl || "", audioStatus: topic.audioStatus || "", audioAccessibleStatus: topic.audioAccessibleStatus || "", audioNaturalStatus: topic.audioNaturalStatus || "" })}${topicVisibleText}</div></section>`
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
    ${relatedTopicsBlock}
    <section class="section"><div class="container"><div class="section-head"><div><p class="eyebrow">Verknuepfte Events</p><h2>Im Dialog</h2></div></div><div class="card-grid card-grid--three">${linked.map((event) => eventCard(event, event.date < "2026-05-26", sponsors)).join("")}</div></div></section>`);
}

export const aboutPage = internalOverviewPage("ueber_uns");

export async function membersPage() {
  const members = await publicManagedMembers();
  const memberRows = members.map((member) => {
    const teaser = member.description || "";
    const searchText = [member.name, teaser, member.city, member.country, member.website].filter(Boolean).join(" ");
    return `<article class="member-directory-card" data-member-card data-search="${escapeHtml(searchText.toLowerCase())}"><div class="member-tile">${memberLogo(member)}</div><div class="member-directory-card__body"><h3>${escapeHtml(member.name)}</h3>${teaser ? `<p>${escapeHtml(teaser)}</p>` : ""}<span class="member-directory-card__meta">${escapeHtml(member.city || "")}${member.country ? ` · ${escapeHtml(member.country)}` : ""}</span></div>${member.website ? `<a class="button button--secondary button--small" href="${escapeHtml(member.website)}" target="_blank" rel="noopener">Website</a>` : ""}</article>`;
  }).join("");
  return publicShell("members", `${subhero("Mitglieder", "Unternehmen im Netzwerk.", "Eine Plattform für Unternehmen, die digitale Medien aktiv weiterentwickeln.")}
    <section class="section"><div class="container"><div class="section-head"><h2>Mitgliedsunternehmen</h2><div class="search"><input data-member-search placeholder="Mitglieder suchen" aria-label="Mitglieder suchen"></div></div><div class="member-directory-list">${memberRows}</div><div class="alert" data-member-empty hidden>Keine passenden sichtbaren Mitglieder gefunden.</div></div></section>`);
  return publicShell("members", `${subhero("Mitglieder", "Unternehmen im Netzwerk.", "Eine Plattform für Unternehmen, die digitale Medien aktiv weiterentwickeln.")}
    <section class="section"><div class="container"><div class="section-head"><h2>Mitgliedsunternehmen</h2><div class="search"><input placeholder="Mitglieder suchen"></div></div><div class="card-grid card-grid--three">${members.map((member) => `<article class="card card__body"><div class="member-tile" style="margin-bottom:16px">${memberLogo(member)}</div><h3 style="margin:15px 0 8px">${escapeHtml(member.name)}</h3><p>${escapeHtml(member.description || "")}</p><p style="margin-top:12px">${escapeHtml(member.city)}${member.country ? ` · ${escapeHtml(member.country)}` : ""}</p>${member.website ? `<a class="link" style="display:inline-block;margin-top:14px" href="${escapeHtml(member.website)}" target="_blank" rel="noopener">Zur Website →</a>` : ""}</article>`).join("")}</div></div></section>`);
}

export async function boardPage() {
  const board = await listPublicContent("boardMembers");
  return publicShell("board", `${subhero("Vorstand", "Verantwortung und Perspektive.", "Der Vorstand repraesentiert die Vielfalt und Expertise der digitalen Medienwirtschaft.")}
    <section class="section"><div class="container card-grid card-grid--three board-grid">${board.map((person) => `<article class="card board-card"><div class="board-photo ${person.id === "board-beate-busch" ? "board-photo--contain" : ""}">${boardPortrait(person)}</div><p class="eyebrow">${escapeHtml(person.role)}</p><h3>${escapeHtml(person.name)}</h3><p style="margin:8px 0">${escapeHtml(person.company)}</p><p>${escapeHtml(person.shortBio)}</p></article>`).join("")}</div></section>`);
}

export async function archivePage() {
  const leanMobile = mobileLeanStart();
  const archiveQuery = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "");
  const showAll = archiveQuery.get("all") === "1";
  const initialLimit = leanMobile ? 8 : 12;
  const [allEvents, sponsors, editorial, galleries, eventMedia] = await Promise.all([listPublicEvents(true), listPublicContent("sponsors"), listPublicContent("editorialContent"), listPublicContent("galleries"), listPublicContent("eventMedia")]);
  const events = allEvents.filter((event) => isPastEvent(event))
    .sort((a, b) => (b.date || "0000-00-00").localeCompare(a.date || "0000-00-00"));
  const visibleEvents = showAll ? events : events.slice(0, initialLimit);
  const mediaLookupEvents = visibleEvents
    .filter((event) => !archiveEventImageUrl(event, []))
    .slice(0, leanMobile ? 8 : 16);
  const mediaAssets = await listPublicEventMediaAssets(mediaLookupEvents).catch(() => []);
  const archiveEvents = visibleEvents;
  const retrospectives = editorial
    .filter(isRetrospectiveArticle)
    .sort((a, b) => String(b.publishDate || b.validFrom || b.updatedAt || "").localeCompare(String(a.publishDate || a.validFrom || a.updatedAt || "")));
  const visibleRetrospectives = showAll ? retrospectives : retrospectives.slice(0, initialLimit);
  const items = archiveEvents.length
    ? archiveEvents.map((event) => archiveListEvent(event, sponsors, mediaAssets, editorial, eventMedia, galleries)).join("")
    : visibleRetrospectives.map((item) => archiveListEditorial(item, sponsors, archiveEvents, mediaAssets, galleries)).join("");
  const totalCount = events.length || retrospectives.length;
  const visibleCount = archiveEvents.length || visibleRetrospectives.length;
  const moreLink = !showAll && totalCount > visibleCount
    ? `<div class="archive-more"><a class="button button--secondary" href="#/archive?all=1">Alle ${totalCount} R&uuml;ckblicke anzeigen</a></div>`
    : "";
  return publicShell("archive", `${leanMobile ? "" : subhero("Rückblick", "Rückblick", "Nachbericht, Bilder und Dokumentation vergangener PROdigitalTV-Veranstaltungen.")}
    <section class="section"><div class="container"><div class="archive-list archive-list--compact">${items || `<div class="alert">Rückblicke werden aktuell vorbereitet.</div>`}</div>${moreLink}</div></section>`);
}

export async function downloadsPage() {
  const downloads = (await listPublicContent("downloads"))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  return publicShell("downloads", `${subhero("Downloads", "Oeffentliche Downloads.", "Vereinssatzung, Beiträge und weitere oeffentliche Dokumente von PROdigitalTV.")}
    <section class="section"><div class="container">${downloads.length ? `<div class="card-grid card-grid--three">${downloads.map(downloadCard).join("")}</div>` : `<div class="alert">Oeffentliche Downloads werden aktuell vorbereitet.</div>`}</div></section>`);
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
    return publicShell("events", `${subhero("Ticket", "Handy ist als Eintrittskarte aktiv.", `${result.eventTitle || "Ihre Anmeldung"} ist auf diesem Geraet gespeichert.`)}
      <section class="section"><div class="container" style="max-width:760px">
        <div class="form-card login-card">
          <p class="eyebrow">Eintrittskarte</p>
          <h2>${escapeHtml(result.firstName || "")} ${escapeHtml(result.lastName || "")}</h2>
          <section class="mobile-ticket-card mobile-ticket-card--standalone" aria-label="Aktives Handy-Ticket">
            <div class="mobile-ticket-card__icon" aria-hidden="true"></div>
            <div class="mobile-ticket-card__body">
              <p class="eyebrow">Handy-Ticket aktiv</p>
              <h2>${escapeHtml(result.eventTitle || "PROdigitalTV Event")}</h2>
              <p>${escapeHtml([result.firstName, result.lastName].filter(Boolean).join(" ") || "Dieses Geraet")}</p>
              <span>Dieses Handy ist fuer den Einlass vorbereitet.</span>
            </div>
          </section>
          <a class="button button--primary" href="#/events">Zu den Events</a>
        </div>
      </div></section>`);
  } catch (error) {
    return publicShell("events", `${subhero("Ticket", "Ticket konnte nicht aktiviert werden.", escapeHtml(error.message || String(error)))}<section class="section"><div class="container"><a class="button button--secondary" href="#/events">Zu den Events</a></div></section>`);
  }
}

export async function eventCheckinPage(eventId = "") {
  const event = eventId ? await getOne("events", eventId).catch(() => null) : null;
  try {
    const result = await checkInWithStoredTicket(eventId);
    return publicShell("events", `${subhero("Check-in", `Willkommen, ${escapeHtml(result.firstName || "Gast")}.`, `${escapeHtml(result.eventTitle || event?.title || "Event")} ist bestaetigt.`)}
      <section class="section"><div class="container" style="max-width:760px">
        <div class="form-card login-card">
          <p class="eyebrow">Einlass</p>
          <h2>${escapeHtml(result.firstName || "")} ${escapeHtml(result.lastName || "")}</h2>
          ${result.company ? `<p>${escapeHtml(result.company)}</p>` : ""}
          <div class="alert alert--success">${result.alreadyCheckedIn ? "Sie waren bereits eingecheckt." : "Check-in erfolgreich."}</div>
        </div>
      </div></section>`);
  } catch (error) {
    const ticket = readStoredTicket(eventId);
    return publicShell("events", `${subhero("Check-in", ticket ? "Ticket konnte nicht geprueft werden." : "Kein Ticket auf diesem Geraet.", ticket ? escapeHtml(error.message || String(error)) : "Bitte oeffnen Sie zuerst den Ticket-Link aus Ihrer Bestaetigungsmail auf diesem Handy.")}
      <section class="section"><div class="container" style="max-width:760px"><div class="alert alert--warning">${escapeHtml(error.message || String(error))}</div><a class="button button--secondary" href="#/events">Zu den Events</a></div></section>`);
  }
}

export async function eventCheckinScreenPage(eventId = "") {
  const event = eventId ? await getOne("events", eventId).catch(() => null) : null;
  if (!event) return notFoundPage();
  const url = `https://prodigitaltv-da47b.web.app/?v=${Date.now()}#/event-checkin/${encodeURIComponent(event.id)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=2&data=${encodeURIComponent(url)}`;
  return publicShell("events", `${subhero("Event-QR", event.title || "Event", "Diesen QR-Code am Empfang anzeigen oder ausdrucken.")}
    <section class="section"><div class="container webapp-qr-page event-checkin-screen" data-checkin-screen-event="${escapeHtml(event.id)}">
      <article class="webapp-qr-card">
        <figure class="webapp-qr-card__code"><img src="${escapeHtml(qrUrl)}" alt="Check-in QR-Code fuer ${escapeHtml(event.title || "Event")}"></figure>
        <div class="webapp-qr-card__copy">
          <p class="eyebrow">Check-in</p>
          <h2>QR-Code fuer den Einlass</h2>
          <p>Teilnehmer scannen diesen Code am Event. Das zuvor gespeicherte Handy-Ticket wird dann geprueft.</p>
          <p class="webapp-qr-card__url">${escapeHtml(url)}</p>
          <div class="actions"><button class="button button--primary" type="button" data-print-page>QR-Code drucken</button><a class="button button--secondary" href="#/cms/event/${escapeHtml(event.id)}?tab=registration">Zur Eventverwaltung</a></div>
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

function membershipFormSection() {
  return `<section class="section"><div class="container join-form-wrap"><form id="membership-application-form" class="form-card form-grid join-form">
    <p class="eyebrow">Mitgliedsantrag</p><h2 style="margin-bottom:6px">Mitglied werden</h2>
    <div class="form-grid--two"><div class="field"><label>Unternehmen / Organisation *</label><input name="company" required></div><div class="field"><label>Rechtsform</label><input name="legalForm" placeholder="z. B. GmbH, AG, e.V."></div></div>
    <div class="form-grid--two"><div class="field"><label>Strasse und Hausnummer *</label><input name="street" required></div><div class="field"><label>PLZ / Ort *</label><input name="city" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Land</label><input name="country" value="Deutschland"></div><div class="field"><label>Website</label><input name="website" type="url" placeholder="https://"></div></div>
    <div class="form-grid--two"><div class="field"><label>Ansprechpartner Vorname *</label><input name="firstName" required></div><div class="field"><label>Ansprechpartner Nachname *</label><input name="lastName" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Position / Funktion *</label><input name="position" required></div><div class="field"><label>E-Mail *</label><input name="email" type="email" required></div></div>
    <div class="form-grid--two"><div class="field"><label>Telefon</label><input name="phone" type="tel"></div><div class="field"><label>Mitgliedschaft</label><select name="membershipType"><option value="company">Unternehmensmitglied</option><option value="individual">Einzelmitglied</option></select></div></div>
    <div class="field"><label>Kurzbeschreibung Unternehmen</label><textarea name="companyDescription" placeholder="Taetigkeitsfeld, Bezug zur digitalen Medienwirtschaft"></textarea></div>
    <div class="field"><label>Nachricht / Rueckfragen</label><textarea name="message"></textarea></div>
    <label class="checkbox"><input type="checkbox" name="statutesAccepted" required> Ich habe die Vereinssatzung gelesen und akzeptiere sie. *</label>
    <label class="checkbox"><input type="checkbox" name="feeInfoAccepted" required> Ich habe die Informationen zu Mitgliedsbeitraegen zur Kenntnis genommen. *</label>
    <label class="checkbox"><input type="checkbox" name="privacyAccepted" required> Ich akzeptiere die Datenschutzerklaerung zur Verarbeitung meines Mitgliedsantrags. *</label>
    <label class="checkbox"><input type="checkbox" name="newsletterConsent"> Ich moechte Informationen zu Veranstaltungen und Vereinsaktivitaeten erhalten.</label>
    <button class="button button--primary" type="submit">Mitgliedsantrag absenden</button><div id="membership-application-result"></div>
  </form></div></section>`;
}

export async function joinPage() {
  const meta = internalPageMeta.mitglied_werden;
  const [blocks, downloads, editorial] = await Promise.all([
    internalBlocks("mitglied_werden"),
    listPublicContent("downloads").catch(() => []),
    listPublicContent("editorialContent").catch(() => [])
  ]);
  const hero = blocks.find((block) => block.typ === "hero") || blocks[0];
  const cardBlocks = blocks.filter((block) => block.typ !== "hero");
  const joinCards = aboutCardGroups(cardBlocks, meta, { summary: "long", all: true, joinCta: true });
  const joinTexts = blocks.map((block) => aboutLongTextSection(block, { joinCta: block.typ !== "hero" })).join("");
  return publicShell("join", `${subhero(meta.eyebrow, hero?.titel || meta.title, hero?.kurztext || meta.intro)}
  <section class="section internal-overview internal-overview--join"><div class="container"><div class="internal-about-layout"><div class="internal-about-main">
    <div class="internal-mobile-list internal-mobile-list--about">${joinCards || `<div class="alert">Inhalte werden aktuell vorbereitet.</div>`}</div>
    <div class="internal-about-texts">${joinTexts}</div>
  </div>${joinAside(downloads, editorial)}</div></div></section>${membershipFormSection()}`);
}

export async function loginPage() {
  const user = currentUser();
  const activeSession = user ? `<div class="alert" style="margin-bottom:18px">Aktuell angemeldet als ${escapeHtml(user.email || user.displayName || user.uid || "Benutzer")} mit Rolle ${escapeHtml(user.role || "guest")}.</div><button id="logout-button" class="button button--secondary" type="button">Abmelden / Session loeschen</button>` : "";
  return publicShell("login", `<section class="login-wrap"><div class="container"><form id="login-form" class="form-card login-card">${logo()}<p class="eyebrow">Mitgliederbereich</p><h1 style="margin-bottom:10px">Anmelden</h1><p style="margin-bottom:25px">Zugriff auf exklusive Events, Downloads und CMS-Funktionen. Nach erfolgreichem Login wird ein Firebase-ID-Token fuer die aktuelle Sitzung gespeichert.</p>${activeSession}<div class="form-grid"><button id="google-login-button" class="button button--secondary" type="button">Mit Google anmelden</button><div class="login-divider"><span>oder mit E-Mail</span></div><div class="field"><label>E-Mail</label><input name="email" type="email" value="" required></div><div class="field"><label>Passwort</label><input name="password" type="password" value="" required></div><button class="button button--primary">Einloggen</button><p class="muted">Produktiv zaehlt die Rolle aus Firestore unter <code>users/{uid}</code>. Der Token wird automatisch erneuert und beim Logout geloescht.</p><div id="login-result"></div></div></form></div></section>`);
}
export async function portalPage() {
  const user = currentUser();
  if (!user) return loginPage();
  if (!isMember(user)) {
    return publicShell("login", `${subhero("Mitgliederbereich", "Zugriff noch nicht freigeschaltet.", "Ihr Login ist aktiv, aber die Rolle für Mitglieder- oder CMS-Inhalte ist noch nicht hinterlegt.")}<section class="section"><div class="container" style="max-width:760px"><div class="form-card"><p>Bitte pruefen Sie in Firebase/Firestore den Eintrag unter <code>users/${escapeHtml(user.uid || "")}</code>. Für CMS-Zugriff muss die Rolle <code>admin</code> oder <code>editor</code> sein, für den Mitgliederbereich <code>member</code>.</p><div class="alert" style="margin-top:18px">Wenn dies die erste Einrichtung ist, kann der aktuell eingeloggte Benutzer einmalig als erster Admin freigeschaltet werden. Das funktioniert nur, solange noch kein aktiver Admin existiert.</div><div class="actions" style="margin-top:22px"><button id="bootstrap-admin-button" class="button button--primary">Als ersten Admin freischalten</button><button id="logout-button" class="button button--secondary">Abmelden</button><a class="button button--secondary" href="#/home">Zur Website</a></div><div id="bootstrap-admin-result"></div></div></div></section>`);
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
  const adminMode = isAdmin(user);
  const selectedMemberId = (() => {
    try {
      return new URLSearchParams((window.location.hash.split("?")[1] || "")).get("memberId") || "";
    } catch {
      return "";
    }
  })();
  const activeTab = (() => {
    try {
      return new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab") || "overview";
    } catch {
      return "overview";
    }
  })();
  const ownMember = adminMode
    ? null
    : user.memberId ? await getOne("members", user.memberId).catch(() => null) : null;
  const linkedMemberBlocked = !adminMode && ownMember?.id && !memberHasPortalAccess(ownMember);
  const [allEvents, sponsors, memberDocuments, members, memberVideos, galleries] = await Promise.all([
    listPublicEvents(true).catch(() => []),
    listPublicContent("sponsors").catch(() => []),
    list("memberDocuments").catch(() => []),
    list("members").catch(() => listPublicContent("members")).then(withPublicMemberLogos).catch(() => []),
    listMemberContent("editorialContent").catch(() => []),
    list("galleries").catch(() => [])
  ]);
  const sortedMembers = members
    .slice()
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999) || String(a.name || "").localeCompare(String(b.name || "")));
  const adminSelectedId = adminMode ? selectedMemberId || user.memberId || sortedMembers[0]?.id || "" : "";
  const adminSelectedMember = adminMode && adminSelectedId
    ? sortedMembers.find((member) => member.id === adminSelectedId) || await getOne("members", adminSelectedId).catch(() => null)
    : null;
  const editableMember = adminMode ? adminSelectedMember : ownMember;
  const profileAccessNotice = !adminMode && (!ownMember?.id || linkedMemberBlocked)
    ? `<div class="alert alert--warning member-portal-link-warning">${linkedMemberBlocked
      ? `Ihr Mitgliedsprofil ist aktuell nicht fuer die Profilpflege freigeschaltet. Die Mitgliederliste bleibt sichtbar.`
      : user.memberId
        ? `Das verknuepfte Mitgliedsprofil <code>${escapeHtml(user.memberId)}</code> wurde noch nicht gefunden. Die Mitgliederliste bleibt sichtbar; die Profilpflege ist erst nach korrekter Verknuepfung moeglich.`
        : `Ihr Login ist noch keinem Mitgliedsprofil zugeordnet. Die Mitgliederliste bleibt sichtbar; die Profilpflege ist erst nach Verknuepfung mit einem Mitgliedsdatensatz moeglich.`}</div>`
    : "";
  const adminDropdown = adminMode ? `<form class="form-card form-grid" data-admin-member-picker>
    <p class="eyebrow">Admin</p>
    <div class="field"><label>Mitglied auswählen</label><select name="memberId" data-admin-member-select>
      ${sortedMembers.map((member) => `<option value="${escapeHtml(member.id)}" ${member.id === adminSelectedId ? "selected" : ""}>${escapeHtml([member.name || member.id, member.city].filter(Boolean).join(" / "))}</option>`).join("")}
    </select></div>
  </form>` : "";
  const events = allEvents.filter((event) => event.accessType === "members_only" && eventRegistrationIsOpen(event));
  const visibleDocuments = memberDocuments
    .filter((item) => item.status === "published" && (item.visibility || "members") === "members")
    .sort((a, b) => String(b.meetingDate || b.publishDate || b.year || b.updatedAt || "").localeCompare(String(a.meetingDate || a.publishDate || a.year || a.updatedAt || "")));
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
    .filter((item) => !["archived", "deleted", "hidden"].includes(String(item.status || "published").toLowerCase()) && item.visible !== false)
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999) || String(b.publishDate || b.updatedAt || "").localeCompare(String(a.publishDate || a.updatedAt || "")));
  const documentUrl = (item) => item.documentUrl || item.assetUrl || item.fileUrl || item.url || "";
  const documentCard = (item) => {
    const url = documentUrl(item);
    return `<article class="card card__body">
      <p class="eyebrow">${escapeHtml([item.category || "Dokument", item.year].filter(Boolean).join(" / "))}</p>
      <h3>${escapeHtml(item.title || item.fileName || "Dokument")}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      ${item.meetingDate ? `<p class="muted">${formatDate(item.meetingDate)}</p>` : ""}
      ${url ? `<a class="button button--secondary button--small" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Datei öffnen</a>` : `<p class="muted">Datei ist noch nicht hinterlegt.</p>`}
    </article>`;
  };
  const tabs = [
    ["overview", "Übersicht"],
    ["profile", "Mein Profil"],
    ["directory", "Mitgliederliste"],
    ["documents", "Member Infos"],
    ["events", "Events"],
    ["upload", "Foto-Upload"]
  ];
  const selectedMemberQuery = adminMode && adminSelectedId ? `&memberId=${encodeURIComponent(adminSelectedId)}` : "";
  const tabNav = `<nav class="member-portal-tabs" aria-label="Mitgliederbereich">${tabs.map(([key, label]) => `<a href="#/portal?tab=${key}${selectedMemberQuery}" class="${activeTab === key ? "active" : ""}">${label}</a>`).join("")}</nav>`;
  const documentsSection = `<section class="member-portal-section member-portal-section--documents"><div class="section-head"><div><h2>Mitglieder-Dokumente</h2><p class="muted">Freigegebene Unterlagen und Anlagen für Mitglieder.</p></div></div><div class="card-grid card-grid--three">${visibleDocuments.length ? visibleDocuments.map(documentCard).join("") : `<div class="alert">Noch keine freigegebenen Mitgliederdokumente.</div>`}</div></section>`;
  const memberInfosSection = `<section class="member-portal-section member-portal-section--infos"><div class="section-head"><h2>Member Infos</h2></div><div class="member-article-list">${visibleMemberArticles.length ? visibleMemberArticles.map((article) => memberArticleCard(article, galleries)).join("") : `<div class="alert">Noch keine Mitgliederbeitr&auml;ge sichtbar.</div>`}</div></section>`;
  const profileSection = `<section class="member-portal-section"><div class="section-head"><h2>${adminMode ? "Mitgliedsprofil bearbeiten" : "Mein Profil"}</h2></div>${adminDropdown}${memberProfileForm(editableMember, user, { adminMode })}</section>`;
  const directorySection = `<section class="member-portal-section"><div class="section-head"><h2>Mitgliederverzeichnis</h2></div><div class="card-grid card-grid--three member-directory-grid">${visibleMembers.length ? visibleMembers.map(memberDirectoryCard).join("") : `<div class="alert">Noch keine freigegebenen Mitglieder.</div>`}</div></section>`;
  const eventsSection = `<section class="member-portal-section"><div class="section-head"><h2>Mitglieder-Events</h2></div><div class="card-grid card-grid--three">${events.length ? events.map((event) => eventCard(event, false, sponsors)).join("") : `<div class="alert">Aktuell keine Mitglieder-Events.</div>`}</div></section>`;
  const uploadSection = `<section class="member-portal-section"><div class="section-head"><div><h2>Foto-Upload</h2><p class="muted">Bilder an die Redaktion senden. Die Zuordnung erfolgt spaeter im CMS.</p></div></div><form id="member-material-upload-form" class="form-card form-grid member-upload-form"><label class="button button--primary member-photo-upload-button">Fotos auswaehlen<input name="files" type="file" accept="image/*" multiple hidden></label><div class="field"><label>Hinweistext</label><textarea name="note" rows="3" placeholder="z. B. Eventname, Ort oder kurzer Hinweis"></textarea></div><label class="checkbox-line"><input type="checkbox" name="rightsConfirmed" value="1" required> Nutzungsfreigabe bestätigen</label><button class="button button--primary" type="submit">Bilder senden</button><div id="member-material-upload-result"></div></form></section>`;
  const overviewSection = `<section class="member-portal-section"><div class="member-portal-overview"><article class="member-portal-card member-portal-card--infos"><span>${visibleMemberArticles.length}</span><h3>Member Infos</h3><p>Mitgliederbeiträge, Dokumente und Anlagen abrufen.</p><a href="#/portal?tab=documents">Öffnen</a></article><article class="member-portal-card member-portal-card--directory"><span>${visibleMembers.length}</span><h3>Mitgliederliste</h3><p>Aktuelle Mitglieder und freigegebene Kontaktdaten.</p><a href="#/portal?tab=directory">Öffnen</a></article><article class="member-portal-card member-portal-card--profile"><span>1</span><h3>Mein Profil</h3><p>Eigene Mitgliedsdaten pflegen.</p><a href="#/portal?tab=profile">Bearbeiten</a></article><article class="member-portal-card member-portal-card--upload"><span>+</span><h3>Foto-Upload</h3><p>Fotos an die Redaktion senden.</p><a href="#/portal?tab=upload">Hochladen</a></article></div></section>`;
  const content = activeTab === "profile" ? profileSection
    : activeTab === "directory" ? directorySection
    : activeTab === "documents" ? memberInfosSection
    : activeTab === "events" ? eventsSection
    : activeTab === "upload" ? uploadSection
    : overviewSection;
  return publicShell("login", `${subhero("Mitgliederbereich", `Willkommen, ${escapeHtml(user.displayName)}.`, "Dokumente, Mitgliederverzeichnis und eigenes Profil.")}
    <section class="section section--white member-portal-shell"><div class="container">
      <div class="section-head member-portal-userbar"><p class="muted">Angemeldet als ${escapeHtml(user.email || "")}</p><button id="logout-button" class="button button--secondary">Abmelden</button></div>
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
  if (!item || ["archived", "deleted", "hidden"].includes(itemStatus) || item.visible === false || !isMemberArticle) return notFoundPage();
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
        ${ttsReader({ rubric: item.category || "Member Info", title: item.title || "", text: [item.subtitle, text].filter(Boolean).join("\n\n"), inlineOffsetText: item.subtitle || "", audio: item.audio || {}, audioProvider: item.audioProvider || item.auaioProvider || "", audioUrl: item.audioUrl || item.auaioUrl || "", audioAccessibleUrl: item.audioAccessibleUrl || item.auaioAccessibleUrl || "", audioNaturalUrl: item.audioNaturalUrl || item.auaioNaturalUrl || "", timingUrl: item.timingUrl || "", audioStatus: item.audioStatus || item.auaioStatus || "", audioAccessibleStatus: item.audioAccessibleStatus || item.auaioAccessibleStatus || "", audioNaturalStatus: item.audioNaturalStatus || item.auaioNaturalStatus || "" })}
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

