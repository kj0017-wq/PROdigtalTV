import { demoDatabase } from "../data/demoData.js?v=5";
import { getFirebaseServices, getFirestoreServices, firebaseEnabled, realDataMode } from "./firebaseClient.js?v=2";

const STORE_KEY = "prodigitaltv-demo-db-official-assets-v7";
const PUBLIC_LIST_CACHE_MS = 45000;
const publicListCache = new Map();

const currentMemberSeeds = [
  ["bibel-tv-stiftung", "Bibel TV Stiftung gGmbH", "Hamburg"],
  ["channel-21", "Channel 21 GmbH", "Hannover"],
  ["kj-technical-consulting", "KJ Technical Consulting Klaus Juli", "Berlin"],
  ["dsc-dietmar-schickel-consulting", "DSC Dietmar Schickel Consulting GmbH", "Berlin"],
  ["ors", "ORS Comm GmbH & Co KG", "Wien"],
  ["moderne-werbung-tv", "Buero fuer moderne Werbung.tv", "Hamburg"],
  ["markus-vogelbacher", "Markus Vogelbacher", "Muenchen"],
  ["blu-tec-one", "BLU TEC ONE GmbH", "Tangstedt"],
  ["house-of-research", "HOR House of Research GmbH", "Berlin"],
  ["goldvisite-media", "Goldvisite Media GmbH", "Unterfoehring"],
  ["schneider-enterprise", "Schneider-Enterprise", "Koblenz"],
  ["fashion-tv", "Fashion TV Production UG", "Hamburg"],
  ["stingray-digital-international", "STINGRAY Digital International LTD", "London"],
  ["eutelsat", "Eutelsat Services und Beteiligungen GmbH", "Koeln"],
  ["farbi-flora", "Farbi Flora GmbH", "Gosen-Neu Zittau"],
  ["anixe-hd", "ANIXE HD TELEVISION GmbH & Co KG", "Muenchen"],
  ["js-consult", "JS Consult Ing.-buero und Medienberatung", "Pulheim"],
  ["thorsten-lork", "Thorsten Lork", "Muenchen"],
  ["red-bull-media-house", "RED Bull Media House GmbH", "Wals-Siezenheim"],
  ["hardy-heine", "Hardy Heine", "Bad Nenndorf"],
  ["no-limits-media", "No Limits Media GmbH", "Berlin"],
  ["itsmaxsuhr", "itsmaxsuhr", "Hamburg"],
  ["major-seven-consulting", "Major Seven Consulting", "Frankfurt / Main"],
  ["sebastian-labonte", "Sebastian Labonte", "Mainz"],
  ["michael-kayser", "Michael Kayser", "Muenchen"],
  ["idee-medien", "Idee Medien UG", "Delmenhorst"],
  ["prof-dr-conrad-heberling", "Prof. Dr Conrad Heberling", "Potsdam"],
  ["tv-2000plus", "TV.2000plus GmbH", "Leinfelden-Echterdingen"],
  ["3q-medien", "3Q Medien", "Muenchen"],
  ["johannes-kors", "Johannes Kors", "Muenchen"],
  ["claudio-malasomma-bellavista", "Claudio Malasomma BellaVista", "Frankfurt / Main"]
].map(([id, name, city]) => ({ id, name, city, status: "active", visible: true, visibility: "public", isLive: true }));

const currentMemberLogoUrls = {
  "bibel-tv-stiftung": "/assets/official/members/bibel-tv.jpg",
  "channel-21": "/assets/official/members/channel-21.jpg",
  "dsc-dietmar-schickel-consulting": "/assets/official/members/dsc.jpg",
  "ors": "/assets/official/members/ors.jpg",
  "moderne-werbung-tv": "/assets/official/members/moderne-werbung.png",
  "blu-tec-one": "/assets/official/members/blu-tec-one.png",
  "house-of-research": "/assets/official/members/house-of-research.png",
  "fashion-tv": "/assets/official/members/fashion-tv-production.jpg",
  "stingray-digital-international": "/assets/official/members/stingray-music.jpg",
  "eutelsat": "/assets/official/members/eutelsat.png",
  "farbi-flora": "/assets/official/members/farbi-flora.png",
  "anixe-hd": "/assets/official/members/anixe-hd.png",
  "js-consult": "/assets/official/members/js-consult.jpg",
  "red-bull-media-house": "/assets/official/members/red-bull-media-house.jpg",
  "hardy-heine": "/assets/official/members/hardy-heine.png",
  "no-limits-media": "/assets/official/members/no-limits-media.png",
  "itsmaxsuhr": "/assets/official/members/itsmaxsuhr.png",
  "idee-medien": "/assets/official/members/idee-medien.jpg",
  "3q-medien": "/assets/official/members/3q.png"
};

const currentMemberWebsiteUrls = {
  "bibel-tv-stiftung": "https://www.bibeltv.de",
  "channel-21": "https://www.channel21.de",
  "dsc-dietmar-schickel-consulting": "https://www.schickel.de",
  "moderne-werbung-tv": "https://www.moderne-werbung.tv",
  "blu-tec-one": "https://www.blume-tv.de",
  "house-of-research": "https://www.house-of-research.de",
  "goldvisite-media": "https://www.goldvisite.com",
  "schneider-enterprise": "https://www.schneider-enterprise.de",
  "stingray-digital-international": "https://www.stingray.com",
  "eutelsat": "https://www.eutelsat.com",
  "farbi-flora": "https://www.farbiflora.com",
  "anixe-hd": "https://www.anixehd.tv",
  "js-consult": "https://www.jsconsult.net",
  "red-bull-media-house": "https://www.redbull.com",
  "hardy-heine": "https://www.hardy-heine.com",
  "no-limits-media": "https://www.no-limits-media.de",
  "itsmaxsuhr": "https://www.itsmaxsuhr.de",
  "major-seven-consulting": "https://www.majorsevenconsulting.com",
  "sebastian-labonte": "https://www.l-a-b-com.de",
  "idee-medien": "https://www.ideemedien.de",
  "tv-2000plus": "https://www.tv2000plus.de",
  "3q-medien": "https://www.3q.video",
  "claudio-malasomma-bellavista": "https://www.bellavista-film.com"
};
const currentCompanyMemberIds = new Set([
  "bibel-tv-stiftung",
  "channel-21",
  "ors",
  "goldvisite-media",
  "stingray-digital-international",
  "anixe-hd",
  "red-bull-media-house",
  "no-limits-media",
  "3q-medien"
]);

function memberContactDataRow([
  id, membershipType, firstName, lastName, department, street, postalCode, city, countryCode, email, phone, mobile, salutation
]) {
  const countryNames = { DE: "Deutschland", AT: "Oesterreich", GB: "Grossbritannien" };
  const contactName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const contactPhone = phone || "";
  const contactMobile = mobile || "";
  return {
    id,
    membershipType,
    firstName,
    lastName,
    contactName,
    profileContactName: contactName,
    department,
    street,
    postalCode,
    city,
    countryCode,
    country: countryNames[countryCode] || countryCode || "",
    email,
    contactEmail: email,
    phone: contactPhone,
    contactPhone,
    mobile: contactMobile,
    contactMobile,
    personalSalutation: salutation,
    eventContacts: contactName || email || contactPhone || contactMobile
      ? [{
          firstName,
          lastName,
          name: contactName,
          role: department || "",
          email,
          phone: contactPhone || contactMobile,
          mobile: contactMobile
        }]
      : []
  };
}

const currentMemberContactData = Object.fromEntries([
  ["bibel-tv-stiftung", "company", "Beate", "Busch", "", "Wandalenweg 26", "20097", "Hamburg", "DE", "busch@bibeltv.de", "040 - 445066-17", "0160 - 97221802", "Sehr geehrte Frau Busch,"],
  ["channel-21", "company", "Birgit", "Zimmerhofer", "", "Grosser Kolonnenweg 18 d", "30163", "Hannover", "DE", "buchhaltung@channel21.de", "0511 - 8998-1381", "", "Sehr geehrte Frau Zimmerhofer"],
  ["kj-technical-consulting", "individual", "Klaus", "Juli", "", "Kamillenstrasse 50", "12203", "Berlin", "DE", "kj_privat@yahoo.de", "", "0172 - 3074583", "Sehr geehrter Herr Juli,"],
  ["dsc-dietmar-schickel-consulting", "individual", "Dietmar", "Schickel", "", "Emser Strasse 9", "10719", "Berlin", "DE", "dietmar@schickel.de", "030 - 3388 4123", "0172 - 6503405", "Sehr geehrter Herr Schickel,"],
  ["ors", "company", "Michael", "Weber", "", "Hugo-Portisch-Gasse 1", "1136", "Wien", "AT", "invoice@orf.at", "+43 (1) 87040-12942", "", "Sehr geehrter Herr Weber,"],
  ["moderne-werbung-tv", "individual", "Stefanie", "Mobius", "", "Owiesenstrasse 3", "22177", "Hamburg", "DE", "stefanie.moebius@moderne-werbung.tv", "040 - 43020827", "0173 - 2405839", "Sehr geehrte Frau Moebius,"],
  ["markus-vogelbacher", "individual", "Markus", "Vogelbacher", "", "Claudius-Keller-Str. 2", "81669", "Muenchen", "DE", "markus@ensider.net", "089 2314 123 30", "0174 333 0701", "Sehr geehrter Herr Vogelbacher,"],
  ["blu-tec-one", "individual", "Volker", "Blume", "", "Eichholzkoppel 34", "22889", "Tangstedt", "DE", "volker.blume@blume-tv.de", "", "0177 - 7122132", "Sehr geehrter Herr Blume,"],
  ["house-of-research", "individual", "Dirk", "Martens", "", "Fischerhuettenstr. 81a", "14163", "Berlin", "DE", "d.martens@house-of-research.de", "030 - 700 103-0", "0172 / 4013623", "Sehr geehrter Herr Martens,"],
  ["goldvisite-media", "company", "Alexandra", "Koch", "", "Beta-Str. 10H", "85774", "Unterfoehring", "DE", "alexandra.koch@goldvisite.com", "089/614240400", "", "Sehr geehrte Frau Koch,"],
  ["schneider-enterprise", "individual", "Normann", "Schneider", "", "Ritterstrasse 28", "56076", "Koblenz", "DE", "normann.schneider@schneider-enterprise.de", "", "0171 - 31 54 333", "Sehr geehrter Herr Schneider,"],
  ["fashion-tv", "individual", "Manuela", "Brodersen Horn", "", "Iserstr. 110", "20149", "Hamburg", "DE", "fashion-tv@t-online.de", "040 - 41467770", "0170 - 2938536", "Sehr geehrte Frau Brodersen Horn,"],
  ["stingray-digital-international", "company", "Tom", "Adams", "Riverside Studios", "101 Queen Caroline St", "W6 9BN", "London", "GB", "tadams@stingray.com", "0561 - 51096607", "0171 - 9925025", "Sehr geehrter Herr Adams,"],
  ["eutelsat", "company", "Petra", "Konrad", "", "Beethovenstrasse 5-13", "50674", "Koeln", "DE", "petra.konrad@eutelsat.net", "+49 (0) 221 65 00 45 23", "+49 151 42 52 32 31", "Sehr geehrte Frau Konrad,"],
  ["farbi-flora", "individual", "Frank", "Audehm", "", "Am Mueggelpark 23", "15537", "Gosen-Neu Zittau", "DE", "frank.audehm@farbiflora.com", "03362 888 9160", "", "Sehr geehrter Herr Audehm,"],
  ["anixe-hd", "company", "Emmanouil", "Lapidakis", "", "Theatinerstrasse 11", "80333", "Muenchen", "DE", "t.faber@anixehd.tv", "0621 49091160", "", "Sehr geehrter Herr Lapidakis,"],
  ["js-consult", "individual", "Juergen", "Sewczyk", "", "Nikolaus-Lauxen-Str. 6", "50259", "Pulheim", "DE", "js@jsconsult.net", "+49 2234 989689", "+49 171 4187 128", "Sehr geehrter Herr Sewczyk,"],
  ["thorsten-lork", "individual", "Thorsten", "Lork", "", "Cosimastrasse 298", "81927", "Muenchen", "DE", "thorstenlork@googlemail.com", "+4915730909549", "", "Sehr geehrter Herr Lork,"],
  ["red-bull-media-house", "company", "Slaven", "Paunovic Gregoric", "", "Oberst-Lepperdinger Strasse", "5071", "Wals-Siezenheim", "AT", "invoice-stv.rbmh@redbull.com", "+43 66488840116", "", "Sehr geehrte Frau Fitzen,"],
  ["hardy-heine", "individual", "Hardy", "Heine", "", "Kaethe-Kollwitz-Weg 10", "31542", "Bad Nenndorf", "DE", "mail@hardy-heine.com", "+49 173 / 27307226", "", "Sehr geehrter Herr Heine,"],
  ["no-limits-media", "company", "Stephan", "Kalesse", "", "Luetzowufer 9", "10785", "Berlin", "DE", "stephan.kalesse@no-limits-media.de", "+49 30 26480 379", "", "Sehr geehrter Herr Kalesse,"],
  ["itsmaxsuhr", "individual", "Maximillian", "Suhr", "", "Allermoeher Deich 68", "21037", "Hamburg", "DE", "suhr@itsmaxsuhr.de", "", "+49 1626291539", "Sehr geehrter Herr Suhr"],
  ["major-seven-consulting", "individual", "Gerhard", "Fischer", "", "Neue Rothofstr. 13-19", "60313", "Frankfurt / Main", "DE", "gerhard.fischer@majorsevenconsulting.com", "01608402887", "", "Sehr geehrter Herr Fischer"],
  ["sebastian-labonte", "individual", "Sebastian", "Labonte", "", "Rektor-Foerster-Strasse", "55122", "Mainz", "DE", "sebastian.labonte@l-a-b-com.de", "0151/52479540", "", "Sehr geehrter Herr Labonte,"],
  ["michael-kayser", "individual", "Michael", "Kayser", "", "Keplerstrasse 10", "81679", "Muenchen", "DE", "michkayser@t-online.de", "01622531175", "", "Sehr geehrter Herr Kayser"],
  ["idee-medien", "individual", "Juergen", "Grobbin", "", "Annenheider Str. 159", "27755", "Delmenhorst", "DE", "buero@ideemedien.de", "+4915156080080", "", "Sehr geehrter Herr Grobbin"],
  ["prof-dr-conrad-heberling", "individual", "Conrad", "Heberling", "", "Marlene-Dietrich-Allee 11", "14482", "Potsdam", "DE", "c.heberling@filmuniversitaet.de", "0172953890", "", "Sehr geehrter Herr Prof. Dr Heberling"],
  ["tv-2000plus", "individual", "Ulrich", "Borawski", "", "Wilhelm-Hachtel-Str. 9", "70771", "Leinfelden-Echterdingen", "DE", "ub@tv2000plus.de", "01787607603", "", "Sehr geehrter Herr Borawski"],
  ["3q-medien", "company", "Julius", "Thomas", "", "Belfortstr. 5", "10711", "Muenchen", "DE", "kreditoren@3q.video", "+4930120833020", "", "Sehr geehrter Herr Thomas"],
  ["johannes-kors", "individual", "Johannes", "Kors", "", "Farchanter Str. 47", "81377", "Muenchen", "DE", "kors@gmx.eu", "+49 175 1834672", "", "Sehr geehrter Herr Kors"],
  ["claudio-malasomma-bellavista", "individual", "Claudio", "Malasomma", "", "Wielandstrasse 36", "60318", "Frankfurt / Main", "DE", "malasomma@bellavista-film.com", "069 40590275", "", "Sehr geehrter Herr Malasomma"]
].map((row) => {
  const data = memberContactDataRow(row);
  return [data.id, data];
}));

function safeCurrentMemberLogo(memberId = "", url = "") {
  if (memberId === "goldvisite-media" && /goldbach/i.test(String(url || ""))) return "";
  return url || "";
}

function normalizedCurrentLocalMembers() {
  let stored = [];
  try {
    stored = localDb().members || [];
  } catch {}
  const storedById = new Map(stored.filter((member) => member?.id).map((member) => [member.id, member]));
  return currentMemberSeeds.map((seed, index) => {
    const existing = storedById.get(seed.id) || {};
    const contactData = currentMemberContactData[seed.id] || {};
    const membershipType = existing.membershipType || existing.membership_type || existing.memberType || contactData.membershipType || (currentCompanyMemberIds.has(seed.id) ? "company" : "individual");
    const eventContacts = Array.isArray(existing.eventContacts) && existing.eventContacts.length
      ? existing.eventContacts
      : contactData.eventContacts || [];
    const logoUrl = safeCurrentMemberLogo(seed.id, existing.logoUrl || currentMemberLogoUrls[seed.id] || "");
    const website = existing.website || existing.url || contactData.website || currentMemberWebsiteUrls[seed.id] || "";
    const description = existing.description || contactData.description || "";
    return {
      ...seed,
      ...contactData,
      ...existing,
      id: seed.id,
      name: existing.name || existing.title || seed.name,
      firstName: existing.firstName || contactData.firstName || "",
      lastName: existing.lastName || contactData.lastName || "",
      contactName: existing.contactName || existing.profileContactName || contactData.contactName || "",
      profileContactName: existing.profileContactName || existing.contactName || contactData.profileContactName || "",
      street: existing.street || contactData.street || "",
      postalCode: existing.postalCode || contactData.postalCode || "",
      city: existing.city || contactData.city || seed.city,
      country: existing.country || contactData.country || "",
      countryCode: existing.countryCode || contactData.countryCode || "",
      email: existing.email || existing.contactEmail || contactData.email || "",
      contactEmail: existing.contactEmail || existing.email || contactData.contactEmail || "",
      phone: existing.phone || existing.contactPhone || contactData.phone || "",
      contactPhone: existing.contactPhone || existing.phone || contactData.contactPhone || "",
      mobile: existing.mobile || existing.contactMobile || contactData.mobile || "",
      contactMobile: existing.contactMobile || existing.mobile || contactData.contactMobile || "",
      personalSalutation: existing.personalSalutation || contactData.personalSalutation || "",
      eventContacts,
      logoUrl,
      website,
      url: existing.url || website,
      description,
      profileCompleteness: {
        logo: Boolean(logoUrl),
        website: Boolean(website),
        description: Boolean(String(description || "").trim())
      },
      needsProfileContentReview: [!logoUrl ? "Logo" : "", !website ? "Website" : "", !String(description || "").trim() ? "Beschreibung" : ""].filter(Boolean),
      sortOrder: Number.isFinite(Number(existing.sortOrder)) ? Number(existing.sortOrder) : index + 1,
      membershipType,
      membershipLabel: existing.membershipLabel || (membershipType === "company" ? "Firmenmitglied" : "Einzelmitglied"),
      status: ["inactive", "cancelled", "archived", "deleted"].includes(existing.status) ? "active" : existing.status || "active",
      visible: existing.visible === false ? false : true,
      visibility: existing.visibility || "public",
      isLive: existing.isLive === false ? false : true,
      membershipAccessStatus: existing.membershipAccessStatus || "active"
    };
  });
}
function cmsDataMode() {
  return String(window.location.pathname || "").endsWith("/cms.html")
    || String(window.location.hash || "").startsWith("#/cms");
}

function memberPortalDataMode() {
  return String(window.location.hash || "").startsWith("#/portal");
}

function localCmsDataFallbackAllowed() {
  const pageQuery = new URLSearchParams(window.location.search || "");
  const hashQuery = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "");
  const explicitLocalFallback = pageQuery.get("lite") === "1"
    || hashQuery.get("lite") === "1"
    || pageQuery.get("demo") === "1"
    || hashQuery.get("demo") === "1";
  return cmsDataMode()
    && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    && explicitLocalFallback;
}

async function waitForFirebaseAuth(firebase) {
  if (!firebase?.auth || firebase.auth.currentUser || !realDataMode()) return;
  await new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 2000);
    const unsubscribe = firebase.authLib.onAuthStateChanged(firebase.auth, () => {
      window.clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

async function getDataFirebase({ write = false } = {}) {
  if (localCmsDataFallbackAllowed()) return null;
  const firebase = write || cmsDataMode() || memberPortalDataMode()
    ? await getFirebaseServices()
    : await getFirestoreServices();
  if (firebase && (write || cmsDataMode() || memberPortalDataMode())) await waitForFirebaseAuth(firebase);
  return firebase;
}

function canFallbackToLocal(error) {
  if (realDataMode() && !localCmsDataFallbackAllowed()) return false;
  return localCmsDataFallbackAllowed()
    && ["permission-denied", "unauthenticated", "failed-precondition", "login erforderlich"].some((code) => String(error?.code || error?.message || "").toLowerCase().includes(code));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeMissingDemoRecords(db, collectionName) {
  const collection = db[collectionName] || (db[collectionName] = []);
  const missing = (demoDatabase[collectionName] || []).filter((record) => !collection.some((item) => item.id === record.id));
  collection.push(...missing.map(clone));
  return missing.length;
}

function syncManagedInternalEditorial(db, bereich) {
  const seedRecords = (demoDatabase.editorialContent || [])
    .filter((record) => record.editorialManaged && record.bereich === bereich);
  if (!seedRecords.length) return;
  const seedIds = new Set(seedRecords.map((record) => record.id));
  const existing = db.editorialContent || (db.editorialContent = []);
  db.editorialContent = existing.filter((record) => !(record.editorialManaged && record.bereich === bereich && !seedIds.has(record.id)));
  seedRecords.forEach((seedRecord) => {
    const index = db.editorialContent.findIndex((record) => record.id === seedRecord.id);
    if (index >= 0) db.editorialContent[index] = { ...db.editorialContent[index], ...clone(seedRecord) };
    else db.editorialContent.push(clone(seedRecord));
  });
}

function localDb() {
  const stored = localStorage.getItem(STORE_KEY);
  if (stored) {
    const db = JSON.parse(stored);
    mergeMissingDemoRecords(db, "members");
    mergeMissingDemoRecords(db, "events");
    mergeMissingDemoRecords(db, "eventMedia");
    mergeMissingDemoRecords(db, "galleries");
    mergeMissingDemoRecords(db, "media_assets");
    mergeMissingDemoRecords(db, "media_variants");
    mergeMissingDemoRecords(db, "downloads");
    mergeMissingDemoRecords(db, "memberDocuments");
    mergeMissingDemoRecords(db, "memberDirectories");
    mergeMissingDemoRecords(db, "editorialContent");
    mergeMissingDemoRecords(db, "verified_sources");
    mergeMissingDemoRecords(db, "ai_prompts");
    mergeMissingDemoRecords(db, "ai_prompt_versions");
    mergeMissingDemoRecords(db, "ai_editorial_logs");
    syncManagedInternalEditorial(db, "mitglied_werden");
    ["event-salzburg-red-bull-hangar7-2026", "event-berlinale-2026", "event-leica-welt-2026", "event-salzburg-2025"].forEach((eventId) => {
      const demoEvent = demoDatabase.events.find((event) => event.id === eventId);
      const localEvent = (db.events || []).find((event) => event.id === eventId);
      if (demoEvent && localEvent) {
        localEvent.title = demoEvent.title;
        localEvent.subtitle = demoEvent.subtitle;
        localEvent.description = demoEvent.description;
        localEvent.date = demoEvent.date;
        localEvent.startTime = demoEvent.startTime;
        localEvent.endTime = demoEvent.endTime;
        localEvent.locationName = demoEvent.locationName;
        localEvent.address = demoEvent.address;
        localEvent.city = demoEvent.city;
        localEvent.phone = demoEvent.phone;
        localEvent.lunchNote = demoEvent.lunchNote;
        if (!localEvent.imageUrl) localEvent.imageUrl = demoEvent.imageUrl;
        localEvent.expiresAt = demoEvent.expiresAt;
        localEvent.status = demoEvent.status;
        localEvent.lifecyclePhase = demoEvent.lifecyclePhase;
        localEvent.postEventSummary = demoEvent.postEventSummary;
        delete localEvent.sourceUrl;
      }
    });
    (db.events || []).forEach((event) => {
      delete event.sourceUrl;
    });
    (db.editorialContent || []).forEach((item) => {
      if (["press", "news"].includes(item.page) && item.status === "published" && item.visibility === "public" && !Object.prototype.hasOwnProperty.call(item, "visible")) {
        item.visible = true;
      }
      if (typeof item.title === "string") item.title = item.title.replace(/^Themenvorschlag:\s*/i, "");
      if (typeof item.headline === "string") item.headline = item.headline.replace(/^Themenvorschlag:\s*/i, "");
      if (typeof item.bodyText === "string") {
        item.bodyText = item.bodyText
          .replace(/^Dies ist ein sicherer Themenvorschlag der lokalen KI-Redaktion\.\s*/i, "")
          .replace(/Der Themenvorschlag betrifft/i, "Der Beitrag betrifft");
      }
    });
    (demoDatabase.topics || []).forEach((demoTopic) => {
      const localTopic = (db.topics || []).find((topic) => topic.id === demoTopic.id);
      if (localTopic) {
        if (!Object.prototype.hasOwnProperty.call(localTopic, "imageUrl")) localTopic.imageUrl = demoTopic.imageUrl;
        if (!Object.prototype.hasOwnProperty.call(localTopic, "longDescription")) localTopic.longDescription = demoTopic.longDescription;
        if (!Object.prototype.hasOwnProperty.call(localTopic, "shortDescription")) localTopic.shortDescription = demoTopic.shortDescription;
      }
    });
    ["about-intro"].forEach((contentId) => {
      const demoContent = demoDatabase.editorialContent.find((content) => content.id === contentId);
      const localContent = (db.editorialContent || []).find((content) => content.id === contentId);
      if (demoContent && localContent) {
        localContent.title = demoContent.title;
        localContent.introText = demoContent.introText;
        localContent.bodyText = demoContent.bodyText;
      }
    });
    saveLocal(db);
    return db;
  }
  const db = clone(demoDatabase);
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
  return db;
}

function saveLocal(db) {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

function scrubOversizedInlineImages(record = {}) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (typeof value === "string" && value.startsWith("data:image/") && value.length > 900000) {
      return [key, ""];
    }
    return [key, value];
  }));
}

export async function list(collectionName) {
  if (collectionName === "members" && localCmsDataFallbackAllowed()) {
    return normalizedCurrentLocalMembers();
  }
  const firebase = await getDataFirebase();
  if (!firebase) {
    if (realDataMode() && !localCmsDataFallbackAllowed()) throw new Error("Firebase ist im Real-Modus nicht erreichbar.");
    return localDb()[collectionName] || [];
  }
  try {
    const result = await firebase.firestore.getDocs(firebase.firestore.collection(firebase.db, collectionName));
    return result.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    if (canFallbackToLocal(error)) return localDb()[collectionName] || [];
    throw error;
  }
}

async function constrainedList(collectionName, predicates) {
  const firebase = await getDataFirebase();
  if (!firebase) {
    if (realDataMode() && !localCmsDataFallbackAllowed()) throw new Error("Firebase ist im Real-Modus nicht erreichbar.");
    return (localDb()[collectionName] || []).filter((record) => predicates.every(([field, operator, value]) => {
      if (operator === "==") return record[field] === value;
      return true;
    }));
  }
  try {
    const constraints = predicates.map(([field, operator, value]) => firebase.firestore.where(field, operator, value));
    const request = firebase.firestore.query(firebase.firestore.collection(firebase.db, collectionName), ...constraints);
    const result = await firebase.firestore.getDocs(request);
    return result.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    if (canFallbackToLocal(error)) {
      return (localDb()[collectionName] || []).filter((record) => predicates.every(([field, operator, value]) => {
        if (operator === "==") return record[field] === value;
        return true;
      }));
    }
    throw error;
  }
}

function publicCacheKey(collectionName, predicates) {
  return `${collectionName}:${JSON.stringify(predicates || [])}`;
}

async function cachedConstrainedList(collectionName, predicates) {
  const key = publicCacheKey(collectionName, predicates);
  const cached = publicListCache.get(key);
  if (cached && Date.now() - cached.createdAt < PUBLIC_LIST_CACHE_MS) return cached.promise;
  const promise = constrainedList(collectionName, predicates);
  publicListCache.set(key, { createdAt: Date.now(), promise });
  try {
    return await promise;
  } catch (error) {
    publicListCache.delete(key);
    throw error;
  }
}

function mediaAssetEventIds(asset = {}) {
  return [
    (asset.target_collection || asset.targetCollection) === "events" ? asset.target_id || asset.targetId : "",
    (asset.linked_collection || asset.linkedCollection) === "events" ? asset.linked_record_id || asset.linkedRecordId || asset.linked_id || asset.linkedId : ""
  ].filter(Boolean);
}

function publicActiveMediaAsset(asset = {}) {
  const status = String(asset.status || "active").toLowerCase();
  const visibility = String(asset.visibility || "public").toLowerCase();
  return visibility === "public" && !["archived", "deleted", "hidden", "inactive"].includes(status);
}

function directMediaAssetIds(record = {}) {
  return [
    record.thumbnail_media_asset_id,
    record.thumbnailMediaAssetId,
    record.mediaAssetId,
    record.media_asset_id,
    record.assetId
  ].filter(Boolean);
}

export async function listPublicEventMediaAssets(eventsOrIds = []) {
  const events = eventsOrIds.map((item) => typeof item === "string" ? { id: item } : item).filter((item) => item?.id);
  const eventIds = [...new Set(events.map((event) => event.id))];
  if (!eventIds.length) return [];

  const directIds = [...new Set(events.flatMap(directMediaAssetIds))];
  const firebase = await getDataFirebase();
  if (!firebase) {
    if (realDataMode()) return [];
    return (localDb().media_assets || []).filter((asset) => {
      if (!publicActiveMediaAsset(asset)) return false;
      if (directIds.includes(asset.id)) return true;
      return mediaAssetEventIds(asset).some((eventId) => eventIds.includes(eventId));
    });
  }

  const requests = eventIds.flatMap((eventId) => [
    cachedConstrainedList("media_assets", [["status", "==", "active"], ["visibility", "==", "public"], ["target_collection", "==", "events"], ["target_id", "==", eventId]]).catch(() => []),
    cachedConstrainedList("media_assets", [["status", "==", "active"], ["visibility", "==", "public"], ["linked_collection", "==", "events"], ["linked_record_id", "==", eventId]]).catch(() => []),
    cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["target_collection", "==", "events"], ["target_id", "==", eventId]]).catch(() => []),
    cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["linked_collection", "==", "events"], ["linked_record_id", "==", eventId]]).catch(() => []),
    cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["targetCollection", "==", "events"], ["targetId", "==", eventId]]).catch(() => []),
    cachedConstrainedList("media_assets", [["visibility", "==", "public"], ["linkedCollection", "==", "events"], ["linkedRecordId", "==", eventId]]).catch(() => [])
  ]);
  directIds.forEach((assetId) => {
    requests.push(getOne("media_assets", assetId).then((asset) => publicActiveMediaAsset(asset || {}) ? [asset] : []).catch(() => []));
  });
  requests.push(
    cachedConstrainedList("media_assets", [["visibility", "==", "public"]])
      .then((assets) => assets.filter((asset) => publicActiveMediaAsset(asset) && mediaAssetEventIds(asset).some((eventId) => eventIds.includes(eventId))))
      .catch(() => [])
  );

  const records = (await Promise.all(requests)).flat().filter(publicActiveMediaAsset);
  return Array.from(new Map(records.filter(Boolean).map((record) => [record.id, record])).values());
}

export async function listPublicMediaAssets() {
  const firebase = await getDataFirebase();
  if (!firebase) {
    if (realDataMode()) return [];
    return (localDb().media_assets || []).filter(publicActiveMediaAsset);
  }
  return cachedConstrainedList("media_assets", [["status", "==", "active"], ["visibility", "==", "public"]])
    .then((assets) => assets.filter(publicActiveMediaAsset))
    .catch(() => []);
}

export async function listPublicEvents(includeMemberEvents = false) {
  const publicEvents = await cachedConstrainedList("events", [["status", "==", "published"], ["visibility", "==", "public"]]);
  const activePublicEvents = publicEvents.filter(isEventVisible);
  if (!includeMemberEvents) return activePublicEvents;
  const memberEvents = await cachedConstrainedList("events", [["accessType", "==", "members_only"]]);
  const activeMemberEvents = memberEvents.filter(isEventVisible);
  return [...activePublicEvents, ...activeMemberEvents.filter((event) => !activePublicEvents.some((publicEvent) => publicEvent.id === event.id))];
}

function isEventVisible(event) {
  if (event.status === "inactive" || event.visibility === "internal") return false;
  return true;
}

function isPublicLiveMember(member) {
  const status = String(member.status || "active").toLowerCase();
  const visibility = String(member.visibility || "public").toLowerCase();
  return !["inactive", "cancelled", "archived", "deleted"].includes(status)
    && !["internal", "private", "hidden"].includes(visibility)
    && member.visible !== false
    && member.isLive !== false
    && !memberAccessBlocked(member);
}

function memberAccessBlocked(member = {}, now = new Date()) {
  if (!["inactive", "cancelled"].includes(member.membershipAccessStatus)) return false;
  const effective = member.membershipAccessEffectiveAt;
  if (!effective) return true;
  const effectiveDate = effective.seconds ? new Date(effective.seconds * 1000) : new Date(effective);
  return !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= now;
}

export async function listPublicContent(collectionName) {
  if (collectionName === "editorialContent") {
    const [published, activeManaged] = await Promise.all([
      cachedConstrainedList(collectionName, [["status", "==", "published"], ["visibility", "==", "public"]]).catch(() => []),
      cachedConstrainedList(collectionName, [["status", "==", "aktiv"], ["sichtbarkeit", "==", "oeffentlich"]]).catch(() => [])
    ]);
    const merged = new Map();
    [...published, ...activeManaged].forEach((record) => merged.set(record.id, record));
    return Array.from(merged.values());
  }
  const filters = {
    topics: [["status", "==", "active"]],
    speakers: [["status", "==", "published"]],
    sponsors: [["status", "==", "published"]],
    members: [["visible", "==", true]],
    boardMembers: [["status", "==", "active"], ["visibility", "==", "public"]],
    editorialContent: [["status", "==", "published"], ["visibility", "==", "public"]],
    galleries: [["status", "==", "published"], ["visibility", "==", "public"]],
    eventMedia: [["status", "==", "approved"], ["visibility", "==", "public"]]
  };
  if (collectionName === "members") {
    const queried = await cachedConstrainedList(collectionName, filters.members).catch(() => []);
    const merged = new Map(normalizedCurrentLocalMembers().map((member) => [member.id, member]));
    queried.forEach((member) => merged.set(member.id, { ...(merged.get(member.id) || {}), ...member }));
    return Array.from(merged.values()).filter(isPublicLiveMember);
  }
  const records = await cachedConstrainedList(collectionName, filters[collectionName] || []);
  return records;
}

export async function listMemberContent(collectionName) {
  if (collectionName !== "editorialContent") return cachedConstrainedList(collectionName, [["visibility", "==", "members"]]);
  const queries = [
    [["visibility", "==", "members"]],
    [["section", "==", "member-area"]],
    [["page", "==", "member-area"]]
  ];
  const batches = await Promise.all(queries.map((predicates) => cachedConstrainedList(collectionName, predicates).catch(() => [])));
  const merged = new Map();
  batches.flat().forEach((item) => {
    if (item?.id) merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
  });
  return Array.from(merged.values());
}

export async function getOne(collectionName, id) {
  const firebase = await getDataFirebase();
  if (!firebase) {
    if (realDataMode() && !localCmsDataFallbackAllowed()) throw new Error("Firebase ist im Real-Modus nicht erreichbar.");
    if (collectionName === "members" && localCmsDataFallbackAllowed()) {
      return (localDb().members || []).find((item) => item.id === id) || normalizedCurrentLocalMembers().find((item) => item.id === id) || null;
    }
    return (localDb()[collectionName] || []).find((item) => item.id === id) || null;
  }
  try {
    const snapshot = await firebase.firestore.getDoc(firebase.firestore.doc(firebase.db, collectionName, id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    if (canFallbackToLocal(error)) {
      if (collectionName === "members" && localCmsDataFallbackAllowed()) return (localDb().members || []).find((item) => item.id === id) || normalizedCurrentLocalMembers().find((item) => item.id === id) || null;
      return (localDb()[collectionName] || []).find((item) => item.id === id) || null;
    }
    throw error;
  }
}

export async function upsert(collectionName, entity) {
  const record = scrubOversizedInlineImages({ ...entity, updatedAt: new Date().toISOString() });
  const firebase = await getDataFirebase({ write: true });
  if (firebase) {
    const id = record.id || crypto.randomUUID();
    try {
      await firebase.firestore.setDoc(firebase.firestore.doc(firebase.db, collectionName, id), record, { merge: true });
      return { id, ...record };
    } catch (error) {
      if (!canFallbackToLocal(error)) throw error;
    }
  }
  const db = localDb();
  const collection = db[collectionName] || (db[collectionName] = []);
  const id = record.id || `${collectionName}-${crypto.randomUUID()}`;
  const index = collection.findIndex((item) => item.id === id);
  const result = { id, ...record };
  if (index >= 0) collection[index] = { ...collection[index], ...result };
  else collection.push(result);
  saveLocal(db);
  return result;
}

export async function remove(collectionName, id) {
  const firebase = await getDataFirebase({ write: true });
  if (firebase) {
    try {
      return await firebase.firestore.deleteDoc(firebase.firestore.doc(firebase.db, collectionName, id));
    } catch (error) {
      if (!canFallbackToLocal(error)) throw error;
    }
  }
  const db = localDb();
  db[collectionName] = (db[collectionName] || []).filter((item) => item.id !== id);
  saveLocal(db);
}

export function isDemoMode() {
  return !firebaseEnabled();
}

export function resetDemoDatabase() {
  localStorage.setItem(STORE_KEY, JSON.stringify(clone(demoDatabase)));
}

export function resetLocalCollection(collectionName) {
  const db = localDb();
  db[collectionName] = [];
  saveLocal(db);
}

export function replaceLocalCollection(collectionName, records = []) {
  const db = localDb();
  db[collectionName] = records.map((record) => ({ ...record }));
  saveLocal(db);
}
