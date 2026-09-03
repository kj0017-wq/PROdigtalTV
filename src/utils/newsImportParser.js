const FIELD_LABELS = new Set([
  "headline",
  "subline",
  "kurztext",
  "langtext",
  "quelle",
  "source",
  "praxisnutzen",
  "datum",
  "veroeffentlichungsdatum",
  "veroffentlichungsdatum",
  "quellentitel",
  "source title",
  "source url",
  "url"
]);

function cleanNewsImportValue(value = "") {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function stripMarkdown(value = "") {
  return String(value || "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, "$1")
    .replace(/^#{1,6}\s*/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function normalizeLabel(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fieldFromLine(line = "") {
  const stripped = stripMarkdown(line);
  const match = stripped.match(/^([A-Za-zÄÖÜäöüß -]{2,34})\s*:\s*(.*)$/);
  if (!match) {
    const bare = normalizeLabel(stripped);
    return FIELD_LABELS.has(bare) ? { field: bare, value: "" } : null;
  }
  const label = normalizeLabel(match[1]);
  if (!FIELD_LABELS.has(label)) return null;
  return { field: label, value: match[2].trim() };
}

function urlFromLine(line = "") {
  const markdownMatch = String(line || "").match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch) return markdownMatch[2];
  return String(line || "").match(/https?:\/\/\S+/i)?.[0]?.replace(/[)\].,;]+$/, "") || "";
}

function emptyArticle() {
  return {
    headline: "",
    subline: "",
    shortText: "",
    longText: "",
    sourceName: "",
    sourceDate: "",
    sourceTitle: "",
    sourceUrl: "",
    rawLines: [],
    sourceComplete: false,
    sourceLineCount: 0
  };
}

function hasMeaningfulBody(article) {
  return cleanNewsImportValue([article.subline, article.shortText, article.longText].filter(Boolean).join("\n")).length >= 80;
}

function hasCompleteEnoughArticle(article) {
  return Boolean(article.headline && (hasMeaningfulBody(article) || article.sourceComplete));
}

function isStandaloneLabel(line = "") {
  const label = fieldFromLine(line);
  return Boolean(label && !label.value);
}

function isSeparator(line = "") {
  return /^(?:-{3,}|={3,}|\*{3,}|@@NEWS_SPLIT@@)$/i.test(String(line || "").trim());
}

function isArticleNumberLine(line = "") {
  return /^(?:artikel|news|meldung|thema)\s+\d{1,2}\s*$/i.test(stripMarkdown(line));
}

function isStrongHeadline(line = "") {
  const raw = String(line || "").trim();
  const text = stripMarkdown(raw)
    .replace(/^(?:artikel|news|meldung|thema)\s+\d{1,2}\s*[:.-]\s*/i, "")
    .replace(/^\d{1,2}[.)]\s+/, "")
    .trim();
  if (!text || isStandaloneLabel(text) || urlFromLine(text)) return false;
  if (text.length < 10 || text.length > 150) return false;
  if (/^(?:quelle|source|datum|url)\b/i.test(text)) return false;
  if (/[.!?]$/.test(text) && !/^#{1,6}\s+/.test(raw)) return false;
  const explicit = /^#{1,6}\s+\S/.test(raw)
    || /^(?:artikel|news|meldung|thema)\s+\d{1,2}\s*[:.-]\s+\S/i.test(raw)
    || /^\d{1,2}[.)]\s+\S/.test(raw);
  const startsLikeHeadline = /^[A-ZÄÖÜ0-9]/.test(text);
  return explicit || startsLikeHeadline;
}

function appendText(article, field, value) {
  const text = stripMarkdown(value);
  if (!text) return;
  article[field] = article[field] ? `${article[field]}\n\n${text}` : text;
}

function applySourceLine(article, value = "") {
  const text = stripMarkdown(value);
  const url = urlFromLine(value);
  if (url && !article.sourceUrl) article.sourceUrl = url;
  article.sourceLineCount = (article.sourceLineCount || 0) + 1;
  const withoutUrl = text.replace(/https?:\/\/\S+/gi, "").replace(/[|;,]+$/g, "").trim();
  if (!withoutUrl) {
    article.sourceComplete = Boolean(article.sourceUrl || article.sourceName || article.sourceTitle);
    return;
  }
  const parts = withoutUrl.split(/\s*[|;]\s*/).filter(Boolean);
  if (parts.length >= 3) {
    article.sourceName ||= parts[0];
    article.sourceDate ||= parts[1];
    article.sourceTitle ||= parts.slice(2).join(" | ");
  } else if (parts.length === 2) {
    article.sourceName ||= parts[0];
    if (/\d{4}|\d{1,2}\.\d{1,2}\./.test(parts[1])) article.sourceDate ||= parts[1];
    else article.sourceTitle ||= parts[1];
  } else if (/^(?:\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})\b/.test(withoutUrl)) {
    article.sourceDate ||= withoutUrl;
  } else if (!article.sourceName) {
    article.sourceName = withoutUrl;
  } else if (!article.sourceTitle && withoutUrl !== article.sourceName) {
    article.sourceTitle = withoutUrl;
  }
  article.sourceComplete = Boolean(article.sourceUrl || (article.sourceName && (article.sourceTitle || article.sourceDate)));
}

function finalizeArticle(article) {
  const cleaned = {
    headline: stripMarkdown(article.headline),
    subline: cleanNewsImportValue(article.subline),
    shortText: cleanNewsImportValue(article.shortText),
    longText: cleanNewsImportValue(article.longText),
    sourceName: cleanNewsImportValue(article.sourceName),
    sourceDate: cleanNewsImportValue(article.sourceDate),
    sourceTitle: cleanNewsImportValue(article.sourceTitle),
    sourceUrl: article.sourceUrl || "",
    rawText: cleanNewsImportValue(article.rawLines.join("\n"))
  };
  if (!cleaned.headline) {
    const firstText = cleaned.rawText.split(/\n+/).map((line) => stripMarkdown(line)).find((line) => line && !isStandaloneLabel(line) && !urlFromLine(line));
    cleaned.headline = firstText || "";
  }
  if (!cleaned.longText) cleaned.longText = cleanNewsImportValue([cleaned.subline, cleaned.shortText].filter(Boolean).join("\n\n"));
  if (!cleaned.shortText) cleaned.shortText = cleanNewsImportValue(cleaned.subline || cleaned.longText.split(/\n\n/)[0] || "");
  if (!cleaned.subline) cleaned.subline = cleaned.shortText;
  return cleaned.headline && cleanNewsImportValue([cleaned.shortText, cleaned.longText, cleaned.sourceName, cleaned.sourceUrl].join("\n")).length >= 40
    ? cleaned
    : null;
}

export function articleToImportBlock(article = {}) {
  return cleanNewsImportValue([
    article.headline,
    article.subline ? `Subline: ${article.subline}` : "",
    article.shortText ? `Kurztext: ${article.shortText}` : "",
    article.longText ? `Langtext:\n${article.longText}` : "",
    [article.sourceName, article.sourceDate, article.sourceTitle].filter(Boolean).length
      ? `Quelle: ${[article.sourceName, article.sourceDate, article.sourceTitle].filter(Boolean).join(" | ")}`
      : "",
    article.sourceUrl || ""
  ].filter(Boolean).join("\n\n"));
}

export function parseImportedNewsArticles(rawText = "") {
  const text = cleanNewsImportValue(rawText);
  if (!text) return [];
  const lines = text.split(/\n/);
  const articles = [];
  let current = emptyArticle();
  let pendingField = "";
  let expectingHeadlineAfterNumber = false;

  const closeCurrent = () => {
    const article = finalizeArticle(current);
    if (article) articles.push(article);
    current = emptyArticle();
    pendingField = "";
  };

  lines.forEach((rawLine) => {
    const line = String(rawLine || "").trim();
    if (!line) {
      if (current.rawLines.length) current.rawLines.push("");
      return;
    }
    if (isSeparator(line)) return;
    if (isArticleNumberLine(line)) {
      expectingHeadlineAfterNumber = true;
      return;
    }

    const label = fieldFromLine(line);
    const sourceNeedsContinuation = !current.sourceUrl && !(current.sourceName && current.sourceTitle) && (current.sourceLineCount || 0) < 3;
    const inSourceContinuation = ["source", "sourceDate", "sourceTitle"].includes(pendingField) && sourceNeedsContinuation && !/^#{1,6}\s+/.test(line) && !/^(?:headline|artikel|news|meldung|thema)\b/i.test(stripMarkdown(line));
    const headlineAfterCompleteSource = current.sourceComplete && !inSourceContinuation && isStrongHeadline(line);
    const headlineAfterNumber = expectingHeadlineAfterNumber && isStrongHeadline(line);
    const shouldStartNewArticle = (headlineAfterCompleteSource || headlineAfterNumber)
      && hasCompleteEnoughArticle(current);

    if (shouldStartNewArticle) closeCurrent();
    expectingHeadlineAfterNumber = false;

    if (label) {
      const field = label.field;
      const value = label.value;
      if (field === "headline") {
        if (hasCompleteEnoughArticle(current)) closeCurrent();
        if (value) {
          current.headline = stripMarkdown(value);
          current.rawLines.push(line);
        }
        pendingField = "headline";
        return;
      }
      if (["quelle", "source"].includes(field)) {
        current.rawLines.push(line);
        if (value) applySourceLine(current, value);
        pendingField = "source";
        return;
      }
      if (field === "datum" || field === "veroeffentlichungsdatum" || field === "veroffentlichungsdatum") {
        current.rawLines.push(line);
        current.sourceDate ||= stripMarkdown(value);
        pendingField = "sourceDate";
        return;
      }
      if (field === "quellentitel" || field === "source title") {
        current.rawLines.push(line);
        current.sourceTitle ||= stripMarkdown(value);
        pendingField = "sourceTitle";
        return;
      }
      if (field === "url" || field === "source url") {
        current.rawLines.push(line);
        current.sourceUrl ||= urlFromLine(value) || value.trim();
        current.sourceComplete = true;
        pendingField = "source";
        return;
      }
      current.rawLines.push(line);
      const target = field === "subline" ? "subline" : field === "kurztext" || field === "praxisnutzen" ? "shortText" : "longText";
      appendText(current, target, value);
      pendingField = target;
      return;
    }

    if (["source", "sourceDate", "sourceTitle"].includes(pendingField) && !shouldStartNewArticle) {
      current.rawLines.push(line);
      applySourceLine(current, line);
      pendingField = "source";
      return;
    }

    if (!current.headline && isStrongHeadline(line)) {
      current.headline = stripMarkdown(line);
      current.rawLines.push(line);
      pendingField = "headline";
      return;
    }

    if (urlFromLine(line) && (pendingField === "source" || current.sourceComplete || hasMeaningfulBody(current))) {
      current.rawLines.push(line);
      applySourceLine(current, line);
      pendingField = "source";
      return;
    }

    current.rawLines.push(line);
    if (pendingField === "headline" && !current.subline) appendText(current, "subline", line);
    else if (pendingField === "shortText") appendText(current, "shortText", line);
    else appendText(current, "longText", line);
  });

  closeCurrent();
  return articles.slice(0, 30);
}





