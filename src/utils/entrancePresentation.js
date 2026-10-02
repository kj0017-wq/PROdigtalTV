export function applyEntrancePresentation(root, browser = window) {
  const route = /^#\/event-checkin\/([^/?#]+)/.exec(browser.location.hash);
  if (!route) return;
  const shell = root.querySelector(".pdtv-mobile-shell");
  const main = shell?.querySelector("main.page");
  if (!main) return;
  const standalone = browser.navigator.standalone === true
    || browser.matchMedia("(display-mode: standalone)").matches
    || browser.matchMedia("(display-mode: fullscreen)").matches;
  shell.dataset.entranceMode = standalone ? "app" : "browser";
  main.querySelector("[data-entrance-browser-hint]")?.remove();
  if (standalone) return;
  const hint = root.ownerDocument.createElement("section");
  hint.className = "entrance-browser-hint container";
  hint.dataset.entranceBrowserHint = "";
  hint.setAttribute("aria-label", "Zur Web-App");
  const link = root.ownerDocument.createElement("a");
  link.className = "button button--primary";
  link.textContent = "Event-Seite öffnen";
  link.setAttribute("href", `/#/event/${route[1]}`);
  const copy = root.ownerDocument.createElement("p");
  copy.textContent = "PROdigitalTV als Web-App nutzen";
  hint.append(copy);
  const choices = [
    ["Bereits installiert", "Öffnen Sie PROdigitalTV über das Symbol auf Ihrem Home-Bildschirm. Eine erneute Installation ist nicht nötig."],
    ["Noch nicht installiert", /iPhone|iPad|iPod/.test(browser.navigator.userAgent || "")
      ? 'Im Browser-Menü "Teilen" und anschließend "Zum Home-Bildschirm" wählen. Danach PROdigitalTV über das neue Symbol öffnen.'
      : 'Im Browser-Menü "App installieren" oder "Zum Home-Bildschirm" wählen. Danach PROdigitalTV über das neue Symbol öffnen.']
  ];
  for (const [label, description] of choices) {
    const details = root.ownerDocument.createElement("details");
    details.className = "home-screen-choice";
    const summary = root.ownerDocument.createElement("summary");
    summary.textContent = label;
    const text = root.ownerDocument.createElement("p");
    text.textContent = description;
    details.append(summary, text);
    hint.append(details);
  }
  hint.append(link);
  main.append(hint);
}
