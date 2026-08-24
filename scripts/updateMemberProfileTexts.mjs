import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "prodigitaltv-da47b";
const apply = process.argv.includes("--apply");

const profileTexts = new Map(Object.entries({
  "3q": "3Q bietet eine europäische Plattform für Video-Hosting, Livestreaming, Webcasting, OTT und FAST-Channels. Dazu gehören Player, CDN, APIs, Analytics und DSGVO-konforme Ausspielung.",
  "anixe-hd": "ANIXE verbindet lineares Fernsehen mit Mediathek, Livestream, App, HbbTV und Smart-TV-Angeboten. Das Programm umfasst Serien, Filme, Dokumentationen und Magazine.",
  "bibel-tv": "Bibel TV betreibt ein christlich geprägtes TV- und Digitalangebot mit linearem Programm, Livestreams und Mediathek. Sendungen und thematische Kanäle sind auch online abrufbar.",
  "blu-tec-one": "BLU TEC ONE ist ein Medien- und Technikunternehmen von Volker Blume aus Tangstedt. Der Fokus liegt auf praxisnaher Beratung und technischen Leistungen im Medienumfeld.",
  "channel-21": "CHANNEL21 war ein deutscher Teleshopping- und E-Commerce-Anbieter mit TV-Programm und Online-Shop. Laut Website wurde der Betrieb zum 01.06.2026 eingestellt.",
  "dsc-dietmar-schickel-consulting": "DSC Dietmar Schickel Consulting berät Unternehmen an der Schnittstelle von Medien, Telekommunikation, Regulierung und digitaler Distribution.",
  "eutelsat": "Eutelsat unterstützt Broadcast- und Videodistribution über Satellit. Die Services reichen von TV-Verbreitung über Zuführung und DTH bis zu IP-, OTT- und Multiscreen-Lösungen.",
  "farbi-flora": "Farbi Flora verbindet Kunstvermittlung, Malerei und Medienproduktion. Das Unternehmen bietet Kurse, Seminare, Fachinhalte sowie begleitende Bild- und Audiomedien.",
  "fashion-tv-production": "Fashion tv production arbeitet im Umfeld von Mode, Fernsehen und Bewegtbildproduktion und verbindet visuelle Markeninszenierung mit redaktionellen Medienformaten.",
  "goldbach-germany": "Goldvisite ist im Umfeld von Medien, Vermarktung und Kommunikation tätig und unterstützt Unternehmen bei Sichtbarkeit, Positionierung und digitaler Ansprache.",
  "hardy-heine": "Hardy Heine berät Unternehmen in IT, Telekommunikation und Medien. Schwerpunkte sind interaktives Fernsehen, Breitband, IPTV, Pay-TV und digitale Mediendienste.",
  "house-of-research": "House of Research ist ein Berliner Institut für Medien-, Kommunikations- und Marktforschung. Das Team arbeitet qualitativ, quantitativ und technologiegestützt.",
  "idee-medien": "Idee Medien entwickelt und begleitet Medien- und Kommunikationsprojekte mit Blick auf Inhalte, Formate und zielgerichtete Ansprache.",
  "itsmaxsuhr": "itsmaxsuhr steht für persönliche Medien-, Kommunikations- und Beratungsleistungen an der Schnittstelle von Kreativität, Organisation und digitaler Umsetzung.",
  "js-consult": "JS Consult berät zu Distribution, IPTV, DVB-S/C/T2, OTT, Smart-TV-Apps, HbbTV und Mediatheken. Weitere Themen sind Addressable TV, Reichweitenaufbau und Projektmanagement.",
  "major-seven-consulting": "Major Seven Consulting begleitet Strategie-, Medien- und Kommunikationsprojekte und unterstützt bei Positionierung, Umsetzung und Entwicklung tragfähiger Konzepte.",
  "moderne-werbung": "Büro für moderne Werbung.tv arbeitet im Umfeld von Werbung, Medien und TV-Kommunikation und unterstützt bei Konzeption, Gestaltung und aufmerksamkeitsstarker Ansprache.",
  "no-limits-media": "No Limits Media macht Filme, Videos und Live-Events barrierefrei. Das Unternehmen erstellt Untertitel, Audiodeskriptionen und Live-Transkriptionen für Medien und Institutionen.",
  "ors": "ORS ist ein österreichischer Broadcast- und Streaming-Dienstleister für Sendernetze, TV-Verbreitung und digitale Plattformen. Das Angebot verbindet Rundfunktechnik mit IP-Services.",
  "red-bull-media-house": "Red Bull Media House verbindet Medienproduktion, Sport, Entertainment und digitale Distribution. Das Unternehmen entwickelt Inhalte, Events und Bewegtbildformate für viele Kanäle.",
  "schneider-enterprise": "Schneider-Enterprise unterstützt Medien- und Digitalprojekte mit Beratung, Netzwerk und operativer Erfahrung.",
  "sebastian-labonte": "Sebastian Labonte arbeitet im Umfeld von Medien, Kommunikation und Beratung und begleitet Projekte mit persönlicher Expertise und Branchenverständnis.",
  "stingray-digital-international": "Stingray entwickelt Musik-, Karaoke-, Konzert- und Entertainmentangebote für TV-Plattformen, Smart-TVs, Web und mobile Nutzung, einschließlich FAST- und Partnerkanälen.",
  "tv-2000plus": "TV.2000Plus arbeitet im Umfeld von Fernsehen, Medien und Bewegtbildkommunikation und bringt Erfahrung in Entwicklung, Umsetzung und Begleitung von Medienprojekten ein."
}));

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const rows = [];
for (const [id, description] of profileTexts) {
  const ref = db.collection("members").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    rows.push({ id, status: "missing" });
    continue;
  }
  const member = snapshot.data() || {};
  rows.push({
    id,
    name: member.name || member.title || id,
    status: apply ? "updated" : "dry-run",
    oldDescription: member.description || "",
    newDescription: description
  });
  if (apply) {
    await ref.set({
      description,
      profileTextSource: "website-link-review-2026-08",
      profileTextUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

for (const row of rows) {
  console.log(JSON.stringify(row));
}
