export function mountEventLivePersonTabs(panel, person, { mountChat, view = "legacy", onWriteMessage } = {}) {
  const back = panel.querySelector("[data-live-detail-close]");
  panel.dataset.personMode = view;
  if (back && view === "chat") {
    back.setAttribute("aria-label", "Zur Chatliste");
    const label = back.querySelector("span");
    if (label) label.textContent = "Chats";
  }
  const profile = document.createElement("section");
  profile.dataset.personPanel = "profile";
  profile.className = "event-live-person-panel";
  [...panel.children].filter(child => child !== back).forEach(child => profile.append(child));
  if (person.boardRole) {
    const role = profile.querySelector(".eyebrow") || document.createElement("p");
    role.className = "eyebrow";
    role.textContent = "PROdigitalTV · " + person.boardRole;
    if (!role.parentElement) profile.querySelector("h2")?.before(role);
  }
  if (person.title) {
    const title = document.createElement("p");
    title.className = "event-live-person-title";
    title.textContent = person.title;
    profile.querySelector("h2")?.before(title);
  }
  [...profile.querySelectorAll("a")].filter(a => a.textContent === "Website öffnen").forEach(a => a.remove());
  try {
    const website = new URL(person.website);
    if (["https:", "http:"].includes(website.protocol)) {
      // Keep one website link even when no company description is present.
      const link = document.createElement("a");
      link.href = website.href;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = website.hostname;
      link.className = "event-live-person-website";
      profile.querySelector(".event-live-detail__position")?.after(link);
    }
  } catch { /* An absent or invalid website is not a link. */ }
  const companyLogo = profile.querySelector(".event-live-company-logo");
  function addIdentityLogo(heading, nodes = [], logo = companyLogo?.cloneNode(true)) {
    if (!heading || !logo) return;
    const identity = document.createElement("div");
    identity.className = "event-live-person-identity";
    const text = document.createElement("div");
    text.className = "event-live-person-identity__text";
    const media = document.createElement("div");
    media.className = "event-live-person-identity__logo";
    heading.before(identity);
    text.append(heading, ...nodes.filter(Boolean));
    media.append(logo);
    identity.append(text, media);
  }
  addIdentityLogo(profile.querySelector("h2"),
    [profile.querySelector(".event-live-detail__position"), profile.querySelector(".event-live-person-website")],
    companyLogo);
  const vita = document.createElement("section");
  vita.dataset.personPanel = "vita";
  vita.className = "event-live-person-panel";
  const photo = profile.querySelector(".event-live-detail__avatar");
  if (photo) vita.append(photo.cloneNode(true));
  const name = document.createElement("h2");
  name.textContent = person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ");
  vita.append(name);
  addIdentityLogo(name);
  const bio = [...profile.querySelectorAll(":scope > section")].find(section => section.querySelector("h3")?.textContent === "Vita");
  if (bio) vita.append(bio);
  else {
    const text = document.createElement("p");
    text.textContent = person.biography || "Noch keine Vita hinterlegt.";
    vita.append(text);
  }
  const chat = document.createElement("section");
  chat.dataset.personPanel = "chat";
  chat.className = "event-live-person-panel event-live-person-panel--chat";
  if (!person.self) {
    const chatHeader = document.createElement("header");
    chatHeader.className = "event-live-chat__header";
    if (photo) chatHeader.append(photo.cloneNode(true));
    const chatName = document.createElement("strong");
    chatName.textContent = name.textContent;
    chatHeader.append(chatName);
    addIdentityLogo(chatName);
    chat.append(chatHeader);
  }
  if (person.self) {
    const text = document.createElement("p");
    text.textContent = "Ihre Gespräche finden Sie in der Teilnehmerliste.";
    chat.append(text);
  }
  const header = document.createElement("header");
  header.className = "event-live-person-tabs-header";
  if (back) header.append(back);
  const tabs = document.createElement("div");
  tabs.className = "event-live-person-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Personenansicht");
  const panels = view === "profile" ? { profile, vita } : view === "chat" ? { chat } : { chat, profile, vita };
  if (view === "profile" && !person.self && onWriteMessage) {
    const write = document.createElement("button");
    write.type = "button";
    write.className = "button button--primary";
    write.textContent = "Nachricht schreiben";
    write.dataset.personWriteMessage = "";
    write.addEventListener("click", onWriteMessage);
    const actions = profile.querySelector(".event-live-detail__contact") || document.createElement("div");
    actions.classList.add("event-live-detail__contact");
    if (!actions.parentElement) profile.append(actions);
    actions.append(write);
  }
  let mounted = false;
  function select(key) {
    for (const [id, element] of Object.entries(panels)) {
      element.hidden = id !== key;
      const tab = tabs.querySelector('[data-person-tab="' + id + '"]');
      tab.setAttribute("aria-selected", String(id === key));
      tab.tabIndex = id === key ? 0 : -1;
    }
    panel.dataset.personView = key;
    if (key === "chat" && !person.self && !mounted) {
      mounted = true;
      mountChat?.(chat);
    }
    if (key === "chat") chat.dispatchEvent(new Event("event-chat-visible"));
  }
  for (const [key, label] of [["chat", "Event Chat"], ["profile", "Profil"], ["vita", "Vita"]]) {
    if (!panels[key]) continue;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.dataset.personTab = key;
    tab.id = "person-tab-" + key;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "person-panel-" + key);
    tab.textContent = label;
    panels[key].id = "person-panel-" + key;
    panels[key].setAttribute("role", "tabpanel");
    panels[key].setAttribute("aria-labelledby", tab.id);
    tab.addEventListener("click", () => select(key));
    tab.addEventListener("keydown", event => {
      const keys = Object.keys(panels);
      let index = keys.indexOf(key);
      if (event.key === "ArrowRight") index = (index + 1) % keys.length;
      else if (event.key === "ArrowLeft") index = (index + keys.length - 1) % keys.length;
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = keys.length - 1;
      else return;
      event.preventDefault();
      select(keys[index]);
      tabs.children[index].focus();
    });
    tabs.append(tab);
  }
  panel.classList.add("event-live-detail--tabs");
  header.append(tabs);
  tabs.hidden = view === "chat";
  panel.append(header, ...Object.values(panels));
  select(view === "profile" || (view === "legacy" && person.self) ? "profile" : "chat");
}
