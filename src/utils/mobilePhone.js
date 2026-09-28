let validatorPromise;

export function loadMobilePhoneValidator() {
  if (window.libphonenumber?.parsePhoneNumberFromString) return Promise.resolve(window.libphonenumber);
  if (!validatorPromise) {
    validatorPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/assets/js/libphonenumber-mobile.js";
      script.onload = () => window.libphonenumber?.parsePhoneNumberFromString
        ? resolve(window.libphonenumber)
        : reject(new Error("Mobilnummernprüfung ist nicht verfügbar."));
      script.onerror = () => reject(new Error("Mobilnummernprüfung konnte nicht geladen werden."));
      document.head.append(script);
    }).catch((error) => {
      validatorPromise = null;
      throw error;
    });
  }
  return validatorPromise;
}

export function normalizeMobilePhone(value, label = "Mobilnummer") {
  const input = String(value || "").trim();
  if (!input) throw new Error(`Bitte ${label} angeben.`);
  if (!/^\+[\d\s().-]+$/.test(input)) throw new Error(`${label}: Bitte mit Landesvorwahl eingeben, z. B. +49 170 1234567.`);
  const library = window.libphonenumber;
  if (!library?.parsePhoneNumberFromString) throw new Error("Mobilnummernprüfung lädt noch. Bitte gleich erneut versuchen.");
  const parsed = library.parsePhoneNumberFromString(input, { extract: false });
  if (!parsed?.isPossible() || !parsed.isValid() || !["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(parsed.getType())) {
    throw new Error(`${label}: Landesvorwahl und Mobilnummer bitte prüfen.`);
  }
  return parsed.number;
}