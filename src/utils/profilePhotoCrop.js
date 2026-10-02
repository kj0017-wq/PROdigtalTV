export async function cropProfilePhoto(file, { logo = false } = {}) {
  if (!file?.type?.startsWith("image/")) throw new Error("Bitte eine Bilddatei auswählen.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "profile-photo-crop";
    dialog.setAttribute("aria-label", "Profilfoto zuschneiden");
    dialog.innerHTML = `<h2>Profilfoto zuschneiden</h2><canvas width="640" height="640" tabindex="0" aria-label="Bildausschnitt verschieben" role="img"></canvas><label>Zoom<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label><div class="profile-photo-crop__actions"><button type="button" data-crop-cancel>Abbrechen</button><button type="button" data-crop-apply>Übernehmen</button></div><p role="status"></p>`;
    document.body.append(dialog);
    if (logo) {
      dialog.setAttribute("aria-label", "Firmenlogo zuschneiden");
      dialog.querySelector("h2").textContent = "Firmenlogo zuschneiden";
    }
    const canvas = dialog.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const slider = dialog.querySelector("input");
    const base = (logo ? Math.min : Math.max)(640 / bitmap.width, 640 / bitmap.height);
    let zoom = 1, x = 0, y = 0, drag = null, done = false;
    const draw = () => {
      const width = bitmap.width * base * zoom;
      const height = bitmap.height * base * zoom;
      const maxX = Math.max(0, (width - 640) / 2);
      const maxY = Math.max(0, (height - 640) / 2);
      x = Math.max(-maxX, Math.min(maxX, x));
      y = Math.max(-maxY, Math.min(maxY, y));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 640, 640);
      ctx.drawImage(bitmap, (640 - width) / 2 + x, (640 - height) / 2 + y, width, height);
    };
    const finish = (result) => {
      if (done) return;
      done = true;
      dialog.close(); dialog.remove(); bitmap.close();
      previousFocus?.focus?.();
      resolve(result);
    };
    slider.addEventListener("input", () => {
      const next = Number(slider.value);
      x *= next / zoom; y *= next / zoom; zoom = next; draw();
    });
    canvas.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary) return;
      canvas.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const scale = 640 / canvas.getBoundingClientRect().width;
      x += (event.clientX - drag.x) * scale; y += (event.clientY - drag.y) * scale;
      drag.x = event.clientX; drag.y = event.clientY; draw();
    });
    canvas.addEventListener("pointerup", () => { drag = null; });
    canvas.addEventListener("pointercancel", () => { drag = null; });
    canvas.addEventListener("keydown", (event) => {
      const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key];
      if (!delta) return;
      event.preventDefault(); x += delta[0]; y += delta[1]; draw();
    });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(null); });
    dialog.querySelector("[data-crop-cancel]").addEventListener("click", () => finish(null));
    dialog.querySelector("[data-crop-apply]").addEventListener("click", () => {
      const button = dialog.querySelector("[data-crop-apply]");
      button.disabled = true;
      canvas.toBlob((blob) => {
        if (done) return;
        if (blob) finish(new File([blob], "profile-crop.jpg", { type: "image/jpeg" }));
        else { dialog.querySelector('[role="status"]').textContent = "Bild konnte nicht verarbeitet werden."; button.disabled = false; }
      }, "image/jpeg", 0.9);
    });
    dialog.showModal(); draw();
  });
}
