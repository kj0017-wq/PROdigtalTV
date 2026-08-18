import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault(),
  projectId: "prodigitaltv-da47b"
});

const kurztext = "Die Medienfrühstücke sind die etablierte Vortrags- und Eventreihe von PROdigitalTV: kompakte Fachimpulse, persönlicher Austausch und relevantes Networking für die digitale Medienwirtschaft.";

const langtext = `Die PROdigitalTV-Medienfrühstücke sind eine der prägenden Vortrags- und Eventreihen des Vereins. Sie verbinden fachliche Orientierung mit persönlicher Begegnung: Branchenexpertinnen und -experten geben kompakte Einblicke in aktuelle Entwicklungen, Unternehmen stellen Praxisbeispiele vor und die Teilnehmenden kommen in einem überschaubaren, hochwertigen Rahmen miteinander ins Gespräch.

Im Mittelpunkt stehen Themen, die die digitale Medienwirtschaft unmittelbar bewegen: Streaming, Plattformstrategien, KI, Bewegtbildproduktion, Vermarktung, Medienrecht, Regulierung, Distribution, Content-Strategien und neue Geschäftsmodelle. Die Vorträge sind bewusst praxisnah angelegt. Sie sollen Entwicklungen einordnen, Erfahrungen aus der Branche sichtbar machen und konkrete Impulse für Entscheiderinnen, Entscheider und Fachleute liefern.

Das Format lebt von seiner Mischung aus Vortrag, Diskussion und Networking. Ein Medienfrühstück ist kein großer Kongress, sondern ein konzentrierter Treffpunkt: morgens, persönlich, gut kuratiert und mit Raum für direkte Gespräche. Genau dadurch entsteht der besondere Charakter der Reihe. Fachliche Inhalte werden nicht isoliert präsentiert, sondern mit Austausch, Kontakten und neuen Anknüpfungspunkten verbunden.

Historisch gehört das Medienfrühstück zu den langjährigen Kernformaten von PROdigitalTV. Das digitale Archiv dokumentiert die Reihe mindestens seit dem 32. Medienfrühstück am 27. Februar 2014 in Berlin. Seitdem fanden zahlreiche Ausgaben an wichtigen Medienstandorten im deutschsprachigen Raum statt, darunter Berlin, Wien, Hamburg, Köln, München, Salzburg und Wetzlar. Die Veranstaltungen begleiteten über viele Jahre hinweg die Transformation der Medienbranche: von digitaler Distribution und Video-on-Demand über Plattformökonomie und Monetarisierung bis hin zu Virtual Production, KI und rechtlichen Fragen des digitalen Wandels.

Mit jeder Ausgabe greift PROdigitalTV aktuelle Fragestellungen auf und bringt relevante Akteure zusammen: Medienunternehmen, Technologieanbieter, Produzenten, Plattformen, Dienstleister, Juristinnen und Juristen, Kreative sowie Entscheiderinnen und Entscheider aus der Branche. Dadurch sind die Medienfrühstücke zugleich Wissensformat, Netzwerkplattform und Spiegel der Entwicklung digitaler Medien.

Ziel der Reihe ist es, Orientierung zu schaffen, Expertise sichtbar zu machen und persönliche Beziehungen innerhalb der Branche zu stärken. Wer an einem Medienfrühstück teilnimmt, erhält nicht nur fachlichen Input, sondern auch Zugang zu einem gewachsenen Netzwerk, das die Zukunft digitaler Medien aktiv mitgestaltet.`;

const db = getFirestore();
const ref = db.collection("editorialContent").doc("ueber-uns-medienfruehstuecke");

await ref.set({
  titel: "Medienfrühstücke",
  title: "Medienfrühstücke",
  kurztext,
  introText: kurztext,
  langtext,
  bodyText: langtext,
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

const doc = await ref.get();
const data = doc.data() || {};
console.log(JSON.stringify({
  id: doc.id,
  titel: data.titel,
  kurztext: data.kurztext,
  chars: String(data.langtext || "").length,
  updated: true
}, null, 2));
