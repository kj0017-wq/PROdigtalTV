const pronunciationDictionary = {
  PROdigitalTV: "Pro Digital T V",
  HbbTV: "H B B T V",
  "DVB-T2": "D V B T zwei",
  DVB: "D V B",
  CTV: "C T V",
  OTT: "O T T",
  KI: "K I",
  AI: "A I",
  "5G": "fünf G",
  "4K": "vier K",
  "8K": "acht K"
};

const numberOnes = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const numberTeens = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const numberTens = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

function underHundred(value) {
  if (value < 10) return numberOnes[value];
  if (value < 20) return numberTeens[value - 10];
  const ones = value % 10;
  return ones ? `${numberOnes[ones]}und${numberTens[Math.floor(value / 10)]}` : numberTens[value / 10];
}

function germanNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 999999999) return String(value);
  if (number < 100) return underHundred(number);
  if (number < 1000) {
    const hundreds = Math.floor(number / 100);
    const rest = number % 100;
    return `${hundreds === 1 ? "" : numberOnes[hundreds]}hundert${rest ? underHundred(rest) : ""}`;
  }
  const thousands = Math.floor(number / 1000);
  const rest = number % 1000;
  return `${thousands === 1 ? "ein" : germanNumber(thousands)}tausend${rest ? germanNumber(rest) : ""}`;
}

function decimalWords(integerPart, fractionalPart, useHalf = false) {
  const integer = germanNumber(Number(integerPart));
  if (fractionalPart === undefined || fractionalPart === "") return integer;
  const fraction = String(fractionalPart).replace(/0+$/, "");
  if (useHalf && fraction === "5") return Number(integerPart) === 0 ? "einhalb" : `${integer}einhalb`;
  return `${integer} Komma ${fraction.split("").map((digit) => numberOnes[Number(digit)]).join(" ")}`;
}

function amountWords(integerPart, fractionalPart = "") {
  const euros = Number(integerPart) === 1 ? "ein" : germanNumber(Number(integerPart));
  if (!fractionalPart || /^0+$/.test(fractionalPart)) return `${euros} Euro`;
  const cents = String(fractionalPart).padEnd(2, "0").slice(0, 2);
  return `${euros} Euro ${germanNumber(Number(cents))}`;
}

function germanYear(value) {
  const year = Number(value);
  if (year >= 2000 && year < 2100) return `zweitausend${year % 100 ? germanNumber(year % 100) : ""}`;
  if (year >= 1900 && year < 2000) return `neunzehnhundert${year % 100 ? germanNumber(year % 100) : ""}`;
  return germanNumber(year);
}

function germanDay(value) {
  const day = Number(value);
  if (day === 1) return "erster";
  if (day === 3) return "dritter";
  if (day === 7) return "siebter";
  if (day === 8) return "achter";
  return `${germanNumber(day)}ter`;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, ". ")
    .replace(/<\/(p|div|li|h[1-6]|section|article|blockquote)>/gi, ". ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x20;|&#32;/gi, " ")
    .replace(/&euro;|&#8364;|&#x20ac;/gi, " € ")
    .replace(/&amp;/gi, " und ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeGermanSpeechText(input = "", options = {}) {
  const debug = options.debug === true;
  const steps = [];
  const step = (name, value) => {
    if (debug) steps.push({ name, value });
    return value;
  };
  let text = step("html", decodeHtml(input).replace(/^\s*#{1,6}\s*/gm, ""));
  const protectedTerms = [];
  const protect = (value) => {
    const token = `__PDTV_TERM_${protectedTerms.length}__`;
    protectedTerms.push([token, value]);
    return token;
  };
  const dictionary = Object.entries(pronunciationDictionary).sort((a, b) => b[0].length - a[0].length);
  for (const [term, spoken] of dictionary) {
    text = text.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "g"), () => protect(spoken));
  }
  text = step("protected", text);
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  text = text.replace(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/g, (_, day, month, year) => `${germanDay(day)} ${months[Number(month) - 1] || month} ${germanYear(year)}`);
  text = text.replace(/\b(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})\b/g, (_, day, month, year) => `${germanDay(day)} ${month} ${germanYear(year)}`);
  text = text.replace(/\b(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\b/g, (_, day, month) => `${germanDay(day)} ${month}`);
  text = text.replace(/\b(\d{1,2})\.\s*(\d{1,2})\.(?!\d)/g, (_, day, month) => `${germanDay(day)} ${months[Number(month) - 1] || month}`);
  text = step("dates", text);
  text = text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\s*Uhr?\b/gi, (_, hour, minute) => `${germanNumber(Number(hour))} Uhr${Number(minute) ? ` ${germanNumber(Number(minute))}` : ""}`);
  text = text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, hour, minute) => `${germanNumber(Number(hour))} Uhr${Number(minute) ? ` ${germanNumber(Number(minute))}` : ""}`);
  text = step("times", text);
  text = text.replace(/\b(\d{1,3}(?:[.]\d{3})*|\d+)(?:,(\d{1,2}))?\s*(€|EUR|Euro)(?!\w)/gi, (_, integer, fraction = "") => amountWords(integer.replace(/[.]/g, ""), fraction));
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*(USD|US-Dollar|\$)\b/gi, (_, number, currency) => `${decimalWords(...number.replace(",", ".").split("."))} ${currency.toLowerCase() === "$" ? "Dollar" : "US-Dollar"}`);
  text = step("money", text);
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*%/g, (_, number) => `${decimalWords(...number.replace(",", ".").split("."))} Prozent`);
  text = step("percent", text);
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*(Mio\.|Mio|Millionen?|Mrd\.|Mrd|Milliarden?|Tsd\.|Tsd|Tausend)(?=\s|$)/gi, (_, number, unit) => {
    const parts = number.replace(",", ".").split(".");
    const isMillion = /^mio|million/i.test(unit);
    const isBillion = /^mrd|milliard/i.test(unit);
    const scaleName = isMillion ? "Million" : isBillion ? "Milliarde" : "Tausend";
    const plural = isMillion ? "Millionen" : isBillion ? "Milliarden" : "Tausend";
    const isOne = Number(parts[0]) === 1 && (!parts[1] || /^0+$/.test(parts[1]));
    const value = isOne ? (isMillion ? "eine" : isBillion ? "eine" : "ein") : Number(parts[0]) === 2 && parts[1] === "5" && (isMillion || isBillion) ? "zweieinhalb" : decimalWords(parts[0], parts[1]).replace(/^eins\b/, "eine");
    const scale = isOne ? `${value} ${scaleName}` : `${value} ${plural}`;
    return scale;
  });
  text = text.replace(/\b(zweieinhalb|[a-zäöüß]+(?: Komma [a-zäöüß ]+)?)\s+(Millionen?|Milliarden?|Tausend)\s*€/gi, "$1 $2 Euro");
  text = text.replace(/\s*\.\s+(Euro|€)/g, " $1");
  text = text.replace(/\s+€/g, " Euro");
  text = step("scales", text);
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*(?:–|-|bis)\s*(\d+(?:[.,]\d+)?)/g, (_, left, right) => `${decimalWords(...left.replace(",", ".").split("."))} bis ${decimalWords(...right.replace(",", ".").split("."))}`);
  text = step("ranges", text);
  text = text.replace(/\b(19\d{2}|20\d{2})\b/g, (match, year, offset, full) => {
    const before = full.slice(Math.max(0, offset - 12), offset).toLowerCase();
    const after = full.slice(offset + match.length, offset + match.length + 8).toLowerCase();
    return /jahr|seit|bis|im\s*$/.test(before) || /wurde|werden|soll|invest/.test(after) ? germanYear(year) : match;
  });
  text = step("years", text);
  const units = [[/\b1080p\b/gi, "tausendachtzig P"], [/\b(\d+)\s*Mbit\/s\b/gi, "$1 Megabit pro Sekunde"], [/\b(\d+)\s*Gbit\/s\b/gi, "$1 Gigabit pro Sekunde"], [/\b(\d+)\s*fps\b/gi, "$1 Frames pro Sekunde"], [/\b(\d+)\s*Hz\b/gi, "$1 Hertz"], [/\b(\d+)\s*GHz\b/gi, "$1 Gigahertz"], [/\b(\d+)\s*MHz\b/gi, "$1 Megahertz"], [/\b(\d+)\s*GB\b/gi, "$1 Gigabyte"], [/\b(\d+)\s*TB\b/gi, "$1 Terabyte"], [/\b(\d+)\s*p\b/gi, "$1 P"]];
  for (const [pattern, replacement] of units) text = text.replace(pattern, replacement);
  text = step("units", text);
  text = text.replace(/\b\d+(?:[.,]\d+)?\b/g, (match) => {
    if (match.includes(",") || match.includes(".")) return decimalWords(...match.replace(",", ".").split("."));
    return germanNumber(Number(match));
  });
  text = step("numbers", text);
  text = text.replace(/([+*=<>|])/g, " ");
  text = text.replace(/\s*[/]s\b/gi, " pro Sekunde");
  text = text.replace(/\.{2,}/g, ".").replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  for (const [token, value] of protectedTerms) text = text.replaceAll(token, value);
  text = step("final", text);
  return debug ? { text, steps } : text;
}

module.exports = { normalizeGermanSpeechText, pronunciationDictionary, germanNumber };
