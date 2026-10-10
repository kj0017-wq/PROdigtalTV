let stopActiveGong = null;
export function stopPauseGong() {
  stopActiveGong?.();
  stopActiveGong = null;
}
export function wirePauseGong(root = document) {
  root.querySelectorAll("[data-pause-gong]").forEach(button => {
    if (button.dataset.gongBound === "1") return;
    button.dataset.gongBound = "1";
    const label = button.querySelector("[data-gong-label]");
    const audio = new Audio("/assets/audio/pause-gong-announcement-loud.wav?v=1");
    audio.preload = "auto";
    audio.volume = 1;
    let playing = false;
    const reset = () => {
      playing = false;
      if (stopActiveGong === stop) stopActiveGong = null;
      label.textContent = "Pausengong";
      button.setAttribute("aria-pressed", "false");
    };
    const stop = () => {
      audio.pause();
      audio.currentTime = 0;
      reset();
    };
    audio.addEventListener("ended", reset);
    button.addEventListener("click", () => {
      if (playing) { stop(); return; }
      stopPauseGong();
      stopActiveGong = stop;
      playing = true;
      label.textContent = "Gong / Ansage stoppen";
      button.setAttribute("aria-pressed", "true");
      // Call play directly in the user gesture, including on mobile Safari.
      audio.play().catch(() => {
        reset();
        label.textContent = "Gong erneut starten";
        button.title = "Audio konnte nicht abgespielt werden. Bitte erneut drücken.";
      });
    });

  });
}
