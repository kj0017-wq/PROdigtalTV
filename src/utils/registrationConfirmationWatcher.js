import { getRegistrationConfirmationStatus } from "../firebase/registrationService.js?v=30";

export function watchRegistrationConfirmation(form, registration, onConfirmed) {
  if (!registration?.id || !registration.statusToken) return () => {};
  let stopped = false;
  let running = false;
  let timer;
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
  const stop = () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("focus", wake);
    window.removeEventListener("pagehide", stop);
    changes.disconnect();
  };
  const check = async () => {
    if (stopped || running) return;
    if (!form.isConnected || Date.now() >= expiresAt) { stop(); return; }
    if (document.visibilityState === "hidden") return;
    running = true;
    window.clearTimeout(timer);
    try {
      const status = await getRegistrationConfirmationStatus(registration.id, registration.statusToken);
      if (stopped || !form.isConnected) return;
      if (status.confirmed) {
        stop();
        onConfirmed(status);
      } else if (["cancelled", "expired", "deleted"].includes(status.status)) stop();
    } catch (error) {
      if (/permission-denied|invalid-argument/.test(error.code || "")) stop();
    } finally {
      running = false;
      if (!stopped) timer = window.setTimeout(check, 15000);
    }
  };
  const wake = () => { if (document.visibilityState !== "hidden") check(); };
  const changes = new MutationObserver(() => { if (!form.isConnected) stop(); });
  changes.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  window.addEventListener("pagehide", stop, { once: true });
  check();
  return stop;
}
