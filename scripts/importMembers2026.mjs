import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, true);
  else {
    args.set(key, next);
    index += 1;
  }
}

if (args.has("help")) {
  console.log(`PROdigitalTV Mitgliederliste 2026 importieren

Pflicht:
  --service-account <pfad>   Firebase Service-Account JSON

Optional:
  --project-id <id>          Firebase Projekt-ID, sonst aus Service Account
  --hide-existing            Alle vorhandenen members vor dem Import auf intern/nicht live setzen
  --dry-run                  Nur anzeigen, was geschrieben wuerde

Beispiel:
  node scripts/importMembers2026.mjs --service-account ./.secrets/prodigitaltv-service-account.json --dry-run
`);
  process.exit(0);
}

const serviceAccountPath = args.get("service-account") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) throw new Error("Bitte --service-account <pfad> angeben oder GOOGLE_APPLICATION_CREDENTIALS setzen.");

const dryRun = args.has("dry-run");
const serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), "utf8"));
const projectId = args.get("project-id") || serviceAccount.project_id || "prodigitaltv-da47b";

if (!dryRun) initializeApp({ credential: cert(serviceAccount), projectId });
const db = dryRun ? null : getFirestore();

const logoById = {
  "3q-medien": "/assets/official/members/3q.png",
  "anixe-hd": "/assets/official/members/anixe-hd.png",
  "bibel-tv-stiftung": "/assets/official/members/bibel-tv.jpg",
  "blu-tec-one": "/assets/official/members/blu-tec-one.png",
  "channel-21": "/assets/official/members/channel-21.jpg",
  "dsc-dietmar-schickel-consulting": "/assets/official/members/dsc.jpg",
  "eutelsat": "/assets/official/members/eutelsat.png",
  "farbi-flora": "/assets/official/members/farbi-flora.png",
  "fashion-tv": "/assets/official/members/fashion-tv-production.jpg",
  "hardy-heine": "/assets/official/members/hardy-heine.png",
  "house-of-research": "/assets/official/members/house-of-research.png",
  "idee-medien": "/assets/official/members/idee-medien.jpg",
  "itsmaxsuhr": "/assets/official/members/itsmaxsuhr.png",
  "js-consult": "/assets/official/members/js-consult.jpg",
  "no-limits-media": "/assets/official/members/no-limits-media.png",
  "ors": "/assets/official/members/ors.jpg",
  "red-bull-media-house": "/assets/official/members/red-bull-media-house.jpg",
  "stingray-digital-international": "/assets/official/members/stingray-music.jpg"
};

const websiteById = {
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

const rows = [
  ["bibel-tv-stiftung", "Bibel TV Stiftung gGmbH", "2026-001", "company", 800, "Frau", "Beate", "Busch", "", "Wandalenweg 26", "20097", "Hamburg", "DE", "busch@bibeltv.de", "040 - 445066-17", "0160 - 97221802", "Sehr geehrte Frau Busch,"],
  ["channel-21", "Channel 21 GmbH", "2026-002", "company", 800, "Frau", "Birgit", "Zimmerhofer", "", "Grosser Kolonnenweg 18 d", "30163", "Hannover", "DE", "buchhaltung@channel21.de", "0511 - 8998-1381", "", "Sehr geehrte Frau Zimmerhofer"],
  ["kj-technical-consulting", "KJ Technical Consulting Klaus Juli", "2026-003", "individual", 180, "Herr", "Klaus", "Juli", "", "Kamillenstrasse 50", "12203", "Berlin", "DE", "kj_privat@yahoo.de", "", "0172 - 3074583", "Sehr geehrter Herr Juli,"],
  ["dsc-dietmar-schickel-consulting", "DSC Dietmar Schickel Consulting GmbH", "2026-004", "individual", 180, "Herr", "Dietmar", "Schickel", "", "Emser Strasse 9", "10719", "Berlin", "DE", "dietmar@schickel.de", "030 - 3388 4123", "0172 - 6503405", "Sehr geehrter Herr Schickel,"],
  ["ors", "ORS Comm GmbH & Co KG", "2026-005", "company", 800, "Herr", "Michael", "Weber", "", "Hugo-Portisch-Gasse 1", "1136", "Wien", "AT", "invoice@orf.at", "+43 (1) 87040-12942", "", "Sehr geehrter Herr Weber,"],
  ["moderne-werbung-tv", "Buero fuer moderne Werbung.tv", "2026-006", "individual", 180, "Frau", "Stefanie", "Mobius", "", "Owiesenstrasse 3", "22177", "Hamburg", "DE", "stefanie.moebius@moderne-werbung.tv", "040 - 43020827", "0173 - 2405839", "Sehr geehrte Frau Moebius,"],
  ["markus-vogelbacher", "Markus Vogelbacher", "2026-007", "individual", 180, "Herr", "Markus", "Vogelbacher", "", "Claudius-Keller-Str. 2", "81669", "Muenchen", "DE", "markus@ensider.net", "089 2314 123 30", "0174 333 0701", "Sehr geehrter Herr Vogelbacher,"],
  ["blu-tec-one", "BLU TEC ONE GmbH", "2026-008", "individual", 180, "Herr", "Volker", "Blume", "", "Eichholzkoppel 34", "22889", "Tangstedt", "DE", "volker.blume@blume-tv.de", "", "0177 - 7122132", "Sehr geehrter Herr Blume,"],
  ["house-of-research", "HOR House of Research GmbH", "2026-009", "individual", 180, "Herr", "Dirk", "Martens", "", "Fischerhuettenstr. 81a", "14163", "Berlin", "DE", "d.martens@house-of-research.de", "030 - 700 103-0", "0172 / 4013623", "Sehr geehrter Herr Martens,"],
  ["goldvisite-media", "Goldvisite Media GmbH", "2026-010", "company", 800, "Frau", "Alexandra", "Koch", "", "Beta-Str. 10H", "85774", "Unterfoehring", "DE", "alexandra.koch@goldvisite.com", "089/614240400", "", "Sehr geehrte Frau Koch,"],
  ["schneider-enterprise", "Schneider-Enterprise", "2026-011", "individual", 180, "Herr", "Normann", "Schneider", "", "Ritterstrasse 28", "56076", "Koblenz", "DE", "normann.schneider@schneider-enterprise.de", "", "0171 - 31 54 333", "Sehr geehrter Herr Schneider,"],
  ["fashion-tv", "Fashion tv production UG", "2026-012", "individual", 180, "Frau", "Manuela", "Brodersen Horn", "", "Iserstr. 110", "20149", "Hamburg", "DE", "fashion-tv@t-online.de", "040 - 41467770", "0170 - 2938536", "Sehr geehrte Frau Brodersen Horn,"],
  ["stingray-digital-international", "STINGRAY Digital International LTD", "2026-013", "company", 800, "Herr", "Tom", "Adams", "Riverside Studios", "101 Queen Caroline St", "W6 9BN", "London", "GB", "tadams@stingray.com", "0561 - 51096607", "0171 - 9925025", "Sehr geehrter Herr Adams,"],
  ["eutelsat", "Eutelsat Services und Beteiligungen GmbH", "2026-014", "company", 800, "Frau", "Petra", "Konrad", "", "Beethovenstrasse 5-13", "50674", "Koeln", "DE", "petra.konrad@eutelsat.net", "+49 (0) 221 65 00 45 23", "+49 151 42 52 32 31", "Sehr geehrte Frau Konrad,"],
  ["farbi-flora", "Farbi Flora GmbH", "2026-015", "individual", 180, "Herr", "Frank", "Audehm", "", "Am Mueggelpark 23", "15537", "Gosen-Neu Zittau", "DE", "frank.audehm@farbiflora.com", "03362 888 9160", "", "Sehr geehrter Herr Audehm,"],
  ["anixe-hd", "ANIXE HD TELEVISION GmbH & Co KG", "2026-016", "company", 800, "Herr", "Emmanouil", "Lapidakis", "", "Theatinerstrasse 11", "80333", "Muenchen", "DE", "t.faber@anixehd.tv", "0621 49091160", "", "Sehr geehrter Herr Lapidakis,"],
  ["js-consult", "JS Consult Ing.-buero und Medienberatung", "2026-017", "individual", 180, "Herr", "Juergen", "Sewczyk", "", "Nikolaus-Lauxen-Str. 6", "50259", "Pulheim", "DE", "js@jsconsult.net", "+49 2234 989689", "+49 171 4187 128", "Sehr geehrter Herr Sewczyk,"],
  ["thorsten-lork", "Thorsten Lork", "2026-018", "individual", 180, "Herr", "Thorsten", "Lork", "", "Cosimastrasse 298", "81927", "Muenchen", "DE", "thorstenlork@googlemail.com", "+4915730909549", "", "Sehr geehrter Herr Lork,"],
  ["red-bull-media-house", "RED Bull Media House GmbH", "2026-019", "company", 800, "Herr", "Slaven", "Paunovic Gregoric", "", "Oberst-Lepperdinger Strasse", "5071", "Wals-Siezenheim", "AT", "invoice-stv.rbmh@redbull.com", "+43 66488840116", "", "Sehr geehrte Frau Fitzen,"],
  ["hardy-heine", "Hardy Heine", "2026-020", "individual", 180, "Herr", "Hardy", "Heine", "", "Kaethe-Kollwitz-Weg 10", "31542", "Bad Nenndorf", "DE", "mail@hardy-heine.com", "+49 173 / 27307226", "", "Sehr geehrter Herr Heine,"],
  ["no-limits-media", "No Limits Media GmbH", "2026-021", "company", 800, "Herr", "Stephan", "Kalesse", "", "Luetzowufer 9", "10785", "Berlin", "DE", "stephan.kalesse@no-limits-media.de", "+49 30 26480 379", "", "Sehr geehrter Herr Kalesse,"],
  ["itsmaxsuhr", "itsmaxsuhr", "2026-022", "individual", 180, "Herr", "Maximillian", "Suhr", "", "Allermoeher Deich 68", "21037", "Hamburg", "DE", "suhr@itsmaxsuhr.de", "", "+49 1626291539", "Sehr geehrter Herr Suhr"],
  ["major-seven-consulting", "Major Seven Consulting", "2026-023", "individual", 180, "Herr", "Gerhard", "Fischer", "", "Neue Rothofstr. 13-19", "60313", "Frankfurt / Main", "DE", "gerhard.fischer@majorsevenconsulting.com", "01608402887", "", "Sehr geehrter Herr Fischer"],
  ["sebastian-labonte", "Sebastian Labonte", "2026-024", "individual", 180, "Herr", "Sebastian", "Labonte", "", "Rektor-Foerster-Strasse", "55122", "Mainz", "DE", "sebastian.labonte@l-a-b-com.de", "0151/52479540", "", "Sehr geehrter Herr Labonte,"],
  ["michael-kayser", "Michael Kayser", "2026-025", "individual", 180, "Herr", "Michael", "Kayser", "", "Keplerstrasse 10", "81679", "Muenchen", "DE", "michkayser@t-online.de", "01622531175", "", "Sehr geehrter Herr Kayser"],
  ["idee-medien", "Idee Medien UG", "2026-026", "individual", 180, "Herr", "Juergen", "Grobbin", "", "Annenheider Str. 159", "27755", "Delmenhorst", "DE", "buero@ideemedien.de", "+4915156080080", "", "Sehr geehrter Herr Grobbin"],
  ["prof-dr-conrad-heberling", "Prof. Dr Conrad Heberling", "2026-027", "individual", 180, "Herr Prof. Dr", "Conrad", "Heberling", "", "Marlene-Dietrich-Allee 11", "14482", "Potsdam", "DE", "c.heberling@filmuniversitaet.de", "0172953890", "", "Sehr geehrter Herr Prof. Dr Heberling"],
  ["tv-2000plus", "TV.2000Plus GmbH", "2026-028", "individual", 180, "Herr", "Ulrich", "Borawski", "", "Wilhelm-Hachtel-Str. 9", "70771", "Leinfelden-Echterdingen", "DE", "ub@tv2000plus.de", "01787607603", "", "Sehr geehrter Herr Borawski"],
  ["3q-medien", "3Q Medien", "2026-029", "company", 800, "Herr", "Julius", "Thomas", "", "Belfortstr. 5", "10711", "Muenchen", "DE", "kreditoren@3q.video", "+4930120833020", "", "Sehr geehrter Herr Thomas"],
  ["johannes-kors", "Johannes Kors", "2026-030", "individual", 180, "Herr", "Johannes", "Kors", "", "Farchanter Str. 47", "81377", "Muenchen", "DE", "kors@gmx.eu", "+49 175 1834672", "", "Sehr geehrter Herr Kors"],
  ["claudio-malasomma-bellavista", "Claudio Malasomma BellaVista", "2026-031", "individual", 180, "Herr", "Claudio", "Malasomma", "", "Wielandstrasse 36", "60318", "Frankfurt / Main", "DE", "malasomma@bellavista-film.com", "069 40590275", "", "Sehr geehrter Herr Malasomma"]
];

const countryName = { DE: "Deutschland", AT: "Oesterreich", GB: "Grossbritannien" };
const membershipLabel = { company: "Unternehmensmitgliedschaft", individual: "Einzelmitgliedschaft" };

function fullName(row) {
  return [row[5], row[6], row[7]].filter(Boolean).join(" ").trim();
}

function memberRecord(row, sortOrder) {
  const [id, name, rgNumber, membershipType, membershipFeeAnnual, salutation, firstName, lastName, department, street, postalCode, city, countryCode, contactEmail, contactPhone, contactMobile, personalSalutation] = row;
  const contactName = fullName(row);
  const hasPhoneContact = Boolean(contactPhone || contactMobile);
  const logoUrl = logoById[id] || "";
  const website = websiteById[id] || "";
  const description = "";
  return {
    id,
    name,
    membershipType,
    membershipLabel: membershipLabel[membershipType] || membershipType,
    membershipFeeAnnual,
    membershipFeeCurrency: "EUR",
    category: membershipLabel[membershipType] || "Mitglied",
    salutation,
    firstName,
    lastName,
    contactName,
    profileContactName: contactName,
    department,
    street,
    postalCode,
    city,
    country: countryName[countryCode] || countryCode,
    countryCode,
    contactPhone,
    phone: contactPhone,
    contactMobile,
    mobile: contactMobile,
    contactEmail,
    email: contactEmail,
    eventContacts: contactName && contactEmail && hasPhoneContact
      ? [{ name: contactName, email: contactEmail, phone: contactPhone || contactMobile }]
      : [],
    personalSalutation,
    logoUrl,
    website,
    url: website,
    description,
    profileCompleteness: {
      logo: Boolean(logoUrl),
      website: Boolean(website),
      description: Boolean(description)
    },
    needsProfileContentReview: [!logoUrl ? "Logo" : "", !website ? "Website" : "", !description ? "Beschreibung" : ""].filter(Boolean),
    status: "active",
    membershipAccessStatus: "active",
    membershipAccessEffectiveAt: "",
    visibility: "internal",
    isLive: false,
    source: "members-2026-screenshot",
    sourceNote: "Aus Ursprungsliste 2026 und aktueller Kontaktliste zusammengefuehrt. Nicht oeffentlich freigegeben.",
    sourceLists: ["members-2026-master", "members-2026-contact"],
    sourceLinked: true,
    needsReview: !contactName || !contactEmail || !hasPhoneContact,
    needsContactReview: !contactName || !contactEmail || !hasPhoneContact,
    missingContactFields: [
      !contactName ? "contactName" : "",
      !contactEmail ? "contactEmail" : "",
      !hasPhoneContact ? "contactPhone" : ""
    ].filter(Boolean),
    sortOrder,
    updatedAt: new Date().toISOString()
  };
}

const records = rows.map((row, index) => memberRecord(row, index + 1));
const hideExisting = args.has("hide-existing");
const obsoleteMemberIds = ["goldvertise-media"];

if (dryRun) {
  console.log(`Dry-run: ${records.length} interne Mitglieder wuerden in members geschrieben.`);
  if (hideExisting) console.log("Dry-run: Vorhandene members wuerden vorher auf visibility=internal und isLive=false gesetzt.");
  console.table(records.map(({ id, name, contactName, contactEmail, contactPhone, membershipLabel, city, visibility, isLive, needsContactReview }) => ({ id, name, contactName, contactEmail, contactPhone, membershipLabel, city, visibility, isLive, needsContactReview })));
  process.exit(0);
}

let batch = db.batch();
let pending = 0;
let written = 0;

async function queue(reference, data, options = { merge: true }) {
  batch.set(reference, data, options);
  pending += 1;
  written += 1;
  if (pending === 450) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}

if (hideExisting) {
  const snapshot = await db.collection("members").get();
  for (const doc of snapshot.docs) {
    await queue(doc.ref, {
      visibility: "internal",
      isLive: false,
      publicHiddenAt: FieldValue.serverTimestamp(),
      publicHiddenReason: "Mitgliederverwaltung 2026 wird zuerst intern aufgebaut."
    });
  }
}

for (const id of obsoleteMemberIds) {
  batch.delete(db.collection("members").doc(id));
  pending += 1;
}

for (const record of records) {
  const reference = db.collection("members").doc(record.id);
  await queue(reference, {
    ...record,
    rgNumber: FieldValue.delete(),
    registrationNumber: FieldValue.delete(),
    importedAt: FieldValue.serverTimestamp()
  });
}
if (pending) await batch.commit();
console.log(`${records.length} interne Mitglieder nach ${projectId}/members importiert${hideExisting ? "; vorhandene Mitglieder wurden auf intern/nicht live gesetzt" : ""}.`);
