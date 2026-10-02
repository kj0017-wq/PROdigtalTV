export function mountEventLiveTestControls(menu, root, data, change) {
  if (!menu || menu.querySelector("[data-admin-test-controls]")) return;
  const controls = document.createElement("div");
  controls.dataset.adminTestControls = "";
  const label = document.createElement("label");
  label.textContent = "Als Teilnehmer testen";
  const select = document.createElement("select");
  select.add(new Option("Mein eigener Account", ""));
  for (const person of data.participants || []) {
    select.add(new Option(person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" "), person.contactId));
  }
  select.value = data.adminTest ? data.profile?.contactId || "" : "";
  const onlineLabel = document.createElement("label");
  const online = document.createElement("input");
  online.type = "checkbox";
  online.checked = data.adminTestAllOnline === true;
  onlineLabel.append(online, "Alle als Online anzeigen (Test)");
  const result = document.createElement("p");
  result.setAttribute("role", "status");
  const banner = document.createElement("aside");
  banner.className = "alert alert--warning";
  banner.hidden = true;
  const text = document.createElement("p");
  const stop = document.createElement("button");
  stop.type = "button";
  stop.className = "button button--secondary";
  stop.textContent = "Testmodus beenden";
  banner.append(text, stop);
  root.querySelector(".event-live-roster").before(banner);
  label.append(select);
  controls.append(label, onlineLabel, result);
  menu.append(controls);
  let previous = { person: select.value, online: online.checked };
  function updateBanner() {
    banner.hidden = !select.value && !online.checked;
    text.textContent = select.value
      ? "Admin-Test als " + select.selectedOptions[0].text + ": Nachrichten und Lesebestätigungen wirken auf echte Chats. Nachrichten sind als Admin-Test gekennzeichnet."
      : "Admin-Test: Online-Anzeige simuliert. Niemand wird dadurch angemeldet.";
  }
  updateBanner();
  async function apply() {
    select.disabled = online.disabled = stop.disabled = true;
    try {
      await change(select.value, online.checked);
      previous = { person: select.value, online: online.checked };
      updateBanner();
      const dropdown = menu.closest("details");
      if (dropdown) dropdown.open = false;
      result.textContent = "";
    } catch (error) {
      select.value = previous.person;
      online.checked = previous.online;
      result.textContent = error.message;
    } finally { select.disabled = online.disabled = stop.disabled = false; }
  }
  select.addEventListener("change", async () => {
    if (select.value && !window.confirm("Als diese Person echte Chats lesen und gekennzeichnete Admin-Testnachrichten senden? Lesebestätigungen werden gespeichert.")) {
      select.value = previous.person;
      return;
    }
    await apply();
  });
  online.addEventListener("change", apply);
  stop.addEventListener("click", () => { select.value = ""; online.checked = false; apply(); });
}
