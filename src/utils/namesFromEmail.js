export function namesFromEmail(email = "") {
  const local = String(email).trim().split("@")[0];
  const parts = local.split(".");
  if (parts.length !== 2 || parts.some(part => !/^[\p{L}]{2,}(?:-[\p{L}]{2,})*$/u.test(part))) return null;
  const generic = new Set(["info", "office", "kontakt", "contact", "support", "service", "sales", "marketing", "presse", "press", "buchhaltung", "rechnung", "invoice", "admin", "team", "newsletter", "noreply", "no-reply", "mail", "email", "buero"]);
  if (parts.some(part => generic.has(part.toLowerCase()))) return null;
  const name = part => part.split("-").map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join("-");
  return { firstName: name(parts[0]), lastName: name(parts[1]) };
}
