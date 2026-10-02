const hosts = new Set(["prodigitaltv.de", "www.prodigitaltv.de", "prodigitaltv.web.app", "prodigitaltv.firebaseapp.com", "prodigitaltv-da47b.web.app", "prodigitaltv-da47b.firebaseapp.com"]);

export function entranceScanRoute(value, origin) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.origin !== origin && (url.protocol !== "https:" || url.port || !hosts.has(url.hostname))) return null;
    if (!["/", "/index.html", "/checkin.html"].includes(url.pathname)) return null;
    const match = /^#\/event-checkin\/([A-Za-z0-9_-]{1,160})(?:\?(.*))?$/.exec(url.hash);
    if (!match) return null;
    const access = new URLSearchParams(match[2] || "").get("access");
    if (access && !/^[a-f0-9]{64}$/i.test(access)) return null;
    return `#/event-checkin/${match[1]}${access ? `?access=${encodeURIComponent(access)}` : ""}`;
  } catch { return null; }
}

let library;
function loadDecoder() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!library) library = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/assets/js/jsqr-1.4.0.js";
    const timeout = setTimeout(() => finish(new Error("Scanner konnte nicht geladen werden.")), 15000);
    function finish(error) {
      clearTimeout(timeout);
      script.onload = script.onerror = null;
      if (error) { script.remove(); reject(error); }
      else resolve(window.jsQR);
    }
    script.onload = () => finish(typeof window.jsQR === "function" ? null : new Error("Scanner ist nicht verfügbar."));
    script.onerror = () => finish(new Error("Scanner konnte nicht geladen werden. Bitte Verbindung prüfen."));
    document.head.append(script);
  }).catch(error => { library = null; throw error; });
  return library;
}

export function openEntranceScanner() {
  if (document.querySelector("[data-entrance-scanner]")) return;
  const dialog = document.createElement("dialog");
  dialog.className = "entrance-scanner";
  dialog.dataset.entranceScanner = "";
  dialog.setAttribute("aria-labelledby", "entrance-scanner-title");
  dialog.innerHTML = `<header><h2 id="entrance-scanner-title">Einlass-QR scannen</h2><button type="button" class="button button--secondary" data-scan-close>Abbrechen</button></header><video autoplay muted playsinline aria-label="Kameravorschau"></video><p role="status" aria-live="polite">Kamera wird gestartet ...</p><button type="button" class="button button--primary" data-scan-retry hidden>Erneut versuchen</button>`;
  document.body.append(dialog);
  dialog.showModal();
  const video = dialog.querySelector("video");
  const status = dialog.querySelector("[role=status]");
  const retry = dialog.querySelector("[data-scan-retry]");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let stream, timer, closed = false;
  function stop() {
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }
  function close() {
    if (closed) return;
    closed = true;
    stop();
    window.removeEventListener("hashchange", close);
    window.removeEventListener("pagehide", close);
    document.removeEventListener("visibilitychange", onVisibility);
    dialog.close();
    dialog.remove();
  }
  function onVisibility() { if (document.visibilityState === "hidden") close(); }
  function fail(error) {
    stop();
    if (closed) return;
    status.textContent = error.name === "NotAllowedError" ? "Kamerazugriff ist nicht erlaubt. Bitte in den Geräteeinstellungen freigeben. Der Scan mit der normalen Kamera bleibt möglich."
      : error.name === "NotFoundError" ? "Keine Kamera gefunden. Sie können weiterhin die normale Kamera zum Scannen nutzen."
      : error.message || "Die Kamera konnte nicht gestartet werden.";
    retry.hidden = false;
  }
  async function start() {
    retry.hidden = true;
    status.textContent = "Kamera wird gestartet ...";
    try {
      if (!navigator.mediaDevices?.getUserMedia || !context) throw new Error("Die Kamera ist hier nicht verfügbar. Bitte den Einlasscode mit der normalen Kamera scannen.");
      const decoder = await loadDecoder();
      if (closed) return;
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      if (closed) { next.getTracks().forEach(track => track.stop()); return; }
      stream = next;
      video.srcObject = stream;
      await video.play();
      if (closed) return;
      status.textContent = "Einlass-QR vor die Kamera halten.";
      function scan() {
        if (closed) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            const scale = Math.min(1, 800 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = decoder(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" });
            if (code) {
              const route = entranceScanRoute(code.data, location.origin);
              if (route) { close(); location.hash = route; return; }
              status.textContent = "Kein gültiger PROdigitalTV-Einlasscode. Bitte den QR-Code am Empfang scannen.";
            }
          }
          timer = setTimeout(scan, 250);
        } catch (error) { fail(error); }
      }
      scan();
    } catch (error) { fail(error); }
  }
  dialog.querySelector("[data-scan-close]").addEventListener("click", close);
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("close", close);
  retry.addEventListener("click", start);
  window.addEventListener("hashchange", close);
  window.addEventListener("pagehide", close);
  document.addEventListener("visibilitychange", onVisibility);
  start();
}

export function wireEntranceScanner(root) {
  if (!/^#\/(?:events|event|portal|ticket)(?:[/?]|$)/.test(location.hash)) return;
  const main = root.querySelector("main.page");
  if (!main || main.querySelector("[data-open-entrance-scanner]")) return;
  const toolbar = document.createElement("div");
  toolbar.className = "container entrance-scanner-entry";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--secondary";
  button.dataset.openEntranceScanner = "";
  button.textContent = "Einlass-QR scannen";
  button.addEventListener("click", openEntranceScanner);
  toolbar.append(button);
  main.prepend(toolbar);
}
