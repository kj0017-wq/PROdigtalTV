import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const root = "C:/Users/Klaus-HP/Dropbox/Codex/PROdigitalTV_Work";
const outDir = path.join(root, "docs/ppt-build/output");
const finalPath = path.join(root, "docs/PROdigitalTV_Funktionsbeschreibung_Praesentation.pptx");
const logoPath = path.join(root, "public/assets/official/brand/prodigitaltv-logo-claim.png");

const W = 1280;
const H = 720;
const navy = "#071a33";
const red = "#e30613";
const softBlue = "#eef5ff";
const line = "#d9e4f2";
const muted = "#5e6b7f";
const darkMuted = "#2b3b52";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function readImageBlob(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function addText(slide, text, x, y, w, h, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: style.fontSize ?? 22,
    bold: style.bold ?? false,
    color: style.color ?? navy,
    alignment: style.alignment ?? "left",
  };
  return shape;
}

function addBox(slide, x, y, w, h, fill = "white", stroke = line, radius = "rounded-xl") {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: stroke, width: 1 },
    borderRadius: radius,
  });
}

function addRule(slide, x, y, w = 88) {
  slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: 6 },
    fill: red,
    line: { style: "solid", fill: red, width: 0 },
  });
}

async function addLogo(slide, x = 72, y = 48, w = 230) {
  const blob = await readImageBlob(logoPath);
  slide.images.add({
    blob,
    contentType: "image/png",
    alt: "PROdigitalTV Logo",
    fit: "contain",
    position: { left: x, top: y, width: w, height: 64 },
  });
}

function addHeader(slide, eyebrow, title, subtitle = "") {
  addText(slide, eyebrow.toUpperCase(), 72, 54, 520, 26, { fontSize: 15, bold: true, color: red });
  addText(slide, title, 72, 92, 880, 90, { fontSize: 40, bold: true, color: navy });
  if (subtitle) addText(slide, subtitle, 72, 180, 920, 58, { fontSize: 21, color: muted });
}

function addFooter(slide, index) {
  addText(slide, "PROdigitalTV Plattform", 72, 670, 360, 26, { fontSize: 13, color: muted });
  addText(slide, String(index).padStart(2, "0"), 1150, 670, 56, 26, { fontSize: 13, color: muted, alignment: "right" });
}

function addBullets(slide, items, x, y, w, fontSize = 22, gap = 44) {
  items.forEach((item, i) => {
    const yy = y + i * gap;
    slide.shapes.add({
      geometry: "ellipse",
      position: { left: x, top: yy + 9, width: 10, height: 10 },
      fill: red,
      line: { style: "solid", fill: red, width: 0 },
    });
    addText(slide, item, x + 26, yy, w - 26, gap + 8, { fontSize, color: darkMuted });
  });
}

function addNumberCard(slide, n, title, text, x, y, w, h, fill = "white") {
  addBox(slide, x, y, w, h, fill);
  slide.shapes.add({
    geometry: "ellipse",
    position: { left: x + 22, top: y + 22, width: 42, height: 42 },
    fill: red,
    line: { style: "solid", fill: red, width: 0 },
  });
  addText(slide, String(n), x + 22, y + 29, 42, 24, { fontSize: 18, bold: true, color: "white", alignment: "center" });
  addText(slide, title, x + 78, y + 22, w - 100, 34, { fontSize: 24, bold: true, color: navy });
  addText(slide, text, x + 78, y + 66, w - 100, h - 82, { fontSize: 17, color: muted });
}

function addNotes(slide, text) {
  slide.speakerNotes.textFrame.setText(text);
  slide.speakerNotes.setVisible(true);
}

function createSlide(p, index, eyebrow, title, subtitle, notes) {
  const slide = p.slides.add();
  slide.background.fill = "#f4f8fd";
  addHeader(slide, eyebrow, title, subtitle);
  addFooter(slide, index);
  addNotes(slide, `${notes}\n\n[Sources]\nInterne PROdigitalTV Funktionsbeschreibung, Stand August 2026.`);
  return slide;
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1
{
  const s = deck.slides.add();
  s.background.fill = "white";
  await addLogo(s, 72, 60, 290);
  addText(s, "Funktionsbeschreibung der Plattform", 72, 210, 980, 72, { fontSize: 54, bold: true });
  addRule(s, 72, 312, 118);
  addText(s, "Mobile-first Web-App, Eventsteuerung, Redaktion, Mitgliederbereich und professionelle Veranstaltungsdurchfuehrung.", 72, 350, 820, 100, { fontSize: 26, color: muted });
  addText(s, "Konzeptpraesentation | Stand August 2026", 72, 610, 520, 28, { fontSize: 16, color: muted });
  addNotes(s, "Begruessen Sie die Zuhörer mit dem Kern dieser Praesentation: Es geht nicht um eine einfache Vereinswebseite, sondern um eine integrierte Plattform fuer redaktionelle Kommunikation, Veranstaltungen, Mitglieder und professionelle Eventprozesse. Die folgenden Folien zeigen, wie aus einem Event ein kompletter digitaler Kommunikationskreislauf wird.\n\n[Sources]\nInterne PROdigitalTV Funktionsbeschreibung, Stand August 2026.");
}

// 2
{
  const s = createSlide(deck, 2, "Zielbild", "Eine Plattform fuer den gesamten Kommunikationskreislauf", "PROdigitalTV verbindet Webseite, CMS, Events, Redaktion, Mitgliederbereich und Medienverwaltung.", "Diese Folie setzt das Zielbild: Die Plattform soll viele bisher getrennte Aufgaben zusammenfuehren. Planung, Einladung, Anmeldung, Ticket, Durchfuehrung, Rueckblick, Themenbeitraege und Nachkommunikation liegen in einem System.");
  addBullets(s, ["Events planen, bewerben und nachbereiten", "Teilnehmer digital anmelden und begleiten", "Redaktionelle Inhalte dauerhaft nutzbar machen", "Mitgliederbereich und interne Kommunikation staerken"], 110, 290, 980, 24, 56);
}

// 3
{
  const s = createSlide(deck, 3, "Highlights", "Die wichtigsten Staerken auf einen Blick", "", "Hier geben Sie eine schnelle Orientierung. Betonen Sie, dass der Nutzen nicht aus einer Einzelfunktion entsteht, sondern aus dem Zusammenspiel von Eventsystem, Redaktion, Medien, Mitgliedern und Kommunikation.");
  addNumberCard(s, 1, "Events als Prozess", "Planung, Einladung, Anmeldung, Check-in und Nachlauf bleiben verbunden.", 72, 220, 350, 155, softBlue);
  addNumberCard(s, 2, "Referentenbuehne", "Vortraege werden zu sichtbaren Fachbeitraegen mit Foto, Vita und Kontext.", 465, 220, 350, 155, "white");
  addNumberCard(s, 3, "Redaktion plus Medien", "News, Themen, Galerien, PDF, Video, Audio und Thumbs greifen zusammen.", 858, 220, 350, 155, "white");
  addNumberCard(s, 4, "Mail und Push", "Einladungen, Erinnerungen und Nachkommunikation erreichen passende Zielgruppen.", 72, 420, 350, 155, "white");
  addNumberCard(s, 5, "Handy-Ticket", "Desktop-Anmeldung wird per QR-Code auf das Smartphone uebertragen.", 465, 420, 350, 155, "white");
  addNumberCard(s, 6, "Mobile first", "Besucher, Teilnehmer und Mitglieder nutzen die Web-App vor allem mobil.", 858, 420, 350, 155, softBlue);
}

// 4
{
  const s = createSlide(deck, 4, "Architektur", "Mobile first fuer Nutzer, Desktop fuer Verwaltung", "", "Erklaeren Sie die Rollenverteilung. Die oeffentliche Web-App ist auf schnelle mobile Nutzung ausgelegt. Das CMS bleibt bewusst Desktop-orientiert, weil Redaktion, Bildbearbeitung und Verwaltung Raum brauchen.");
  addBox(s, 86, 230, 500, 270, "white");
  addText(s, "Mobile Web-App", 124, 264, 420, 34, { fontSize: 30, bold: true });
  addBullets(s, ["Events und Anmeldung", "Handy-Ticket", "Mitgliederbereich", "News, Themen, Referenten"], 124, 326, 390, 21, 42);
  addBox(s, 694, 230, 500, 270, "white");
  addText(s, "Desktop-CMS", 732, 264, 420, 34, { fontSize: 30, bold: true });
  addBullets(s, ["Eventorganisation", "Redaktion und Medien", "Teilnehmerverwaltung", "Qualitaetssicherung"], 732, 326, 390, 21, 42);
}

// 5
{
  const s = createSlide(deck, 5, "Eventsteuerung", "Aus einem Event entsteht ein redaktioneller Kreislauf", "", "Diese Folie zeigt den Kernprozess. Wichtig ist die neue zentrale Einladung zwischen Veroeffentlichung und Anmeldung. So wird zuerst festgelegt, wer angesprochen werden soll, bevor die Registrierung beginnt.");
  const steps = [
    ["1", "Event planen"], ["2", "Inhalte vorbereiten"], ["3", "Veroeffentlichen"], ["4", "Zentrale Einladung"],
    ["5", "Anmeldung"], ["6", "Durchfuehrung"], ["7", "Rueckblick"], ["8", "Robo-Themen"], ["9", "Referentenbuehne"], ["10", "Nachkommunikation"],
  ];
  steps.forEach(([n, t], i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = 78 + col * 236;
    const y = 250 + row * 155;
    addBox(s, x, y, 190, 92, i === 3 ? "#fff1f2" : i > 5 ? "#f1fbf6" : "white");
    addText(s, n, x + 16, y + 14, 34, 28, { fontSize: 22, bold: true, color: red });
    addText(s, t, x + 54, y + 18, 118, 48, { fontSize: 18, bold: true, color: navy });
  });
}

// 6
{
  const s = createSlide(deck, 6, "Eventplanung", "Stammdaten schaffen die Grundlage fuer alles Weitere", "", "Hier geht es um die Basis eines Events: Titel, Datum, Ort, Gastgeber, Sichtbarkeit und Startseitenfreigabe. Diese Informationen steuern, ob und wo ein Event sichtbar wird.");
  addBullets(s, ["Titel, Datum, Uhrzeit und Ort", "Gastgeber, Partner, Eventtyp und Sichtbarkeit", "Startseiten-Schalter und Mitgliederfreigabe", "Eventbild, Einladungstext und Anmeldeoptionen"], 110, 260, 940, 25, 58);
}

// 7
{
  const s = createSlide(deck, 7, "Einladung", "Mail und Push adressieren den richtigen Besucherkreis", "", "Betonen Sie, dass Kommunikation nicht pauschal sein muss. Schon bei der ersten Einladung kann ausgewaehlt werden, ob der gesamte Adressbestand, nur Mitglieder oder spezifische Gruppen angesprochen werden.");
  addNumberCard(s, 1, "Empfaengerkreis waehlen", "Gesamter Adressbestand, Vereinsmitglieder, Teilnehmergruppen, Partner oder manuelle Verteiler.", 92, 235, 500, 160, "white");
  addNumberCard(s, 2, "Einladung versenden", "Mail ist der verlaessliche Kanal fuer Einladung, Save-the-Date und konkrete Eventinformationen.", 688, 235, 500, 160, softBlue);
  addNumberCard(s, 3, "Push ergaenzen", "Push ist der schnelle mobile Kanal fuer kurze Hinweise, Erinnerungen und kurzfristige Updates.", 390, 440, 500, 160, "#fff6f7");
}

// 8
{
  const s = createSlide(deck, 8, "Anmeldung", "Die Registrierung verbindet Teilnehmer, Event und Kommunikation", "", "Erklaeren Sie, dass die Anmeldung mehr ist als ein Formular. Sie erzeugt einen belastbaren Datensatz fuer Teilnahme, Mailkommunikation, Ticketstatus, Check-in und Nachlauf.");
  addBullets(s, ["Formular mit Datenschutz- und Foto-/Videohinweis", "Dublettenpruefung und Wartelistenlogik", "Bestaetigungsmail auch bei manueller Anlage", "Status fuer Eventliste und Handy-Ticket"], 110, 260, 940, 25, 58);
}

// 9
{
  const s = createSlide(deck, 9, "Desktop zu Handy", "Der QR-Code uebertraegt den Token auf das Smartphone", "", "Diese Folie korrigiert den haeufigen Denkfehler: Der QR-Code ist nicht das Ticket am Handy. Er ist die Bruecke vom Desktop zum Smartphone. Beim Scan wird der persoenliche Token auf dem betreffenden Handy gespeichert.");
  addNumberCard(s, 1, "Desktop-Anmeldung", "Der Gast meldet sich am Desktop an und sieht danach einen QR-Code.", 72, 245, 340, 180, "white");
  addNumberCard(s, 2, "QR-Code scannen", "Das Smartphone uebernimmt den persoenlichen Token fuer diese Anmeldung.", 470, 245, 340, 180, "#fff6f7");
  addNumberCard(s, 3, "Handy wird Ticket", "Das System kann dieses Handy der konkreten Anmeldung und dem Event zuordnen.", 868, 245, 340, 180, softBlue);
  addText(s, "Der QR-Code ist die Uebergabe, nicht das Ticket selbst.", 190, 500, 900, 40, { fontSize: 28, bold: true, alignment: "center" });
}

// 10
{
  const s = createSlide(deck, 10, "Professioneller Check-in", "Der Einlass erkennt das Handy und begruesst den Gast", "", "Beschreiben Sie den Wert fuer die Eventdurchfuehrung. Durch den gespeicherten Token kann das System die Person schnell zuordnen. Auf dem Screen kann der Gast persoenlich begruesst werden.");
  addBox(s, 130, 240, 1020, 270, navy, navy);
  addText(s, "Willkommen, Martina Becker", 190, 285, 900, 56, { fontSize: 40, bold: true, color: "white", alignment: "center" });
  addText(s, "PROdigitalTV Medienfruehstueck · Status: angemeldet · Check-in bereit", 220, 365, 840, 40, { fontSize: 23, color: "#d9e4f2", alignment: "center" });
  addRule(s, 565, 435, 150);
  addText(s, "Schneller Einlass, persoenlicher Empfang, sauberer Teilnehmerstatus.", 210, 470, 860, 38, { fontSize: 24, bold: true, color: "white", alignment: "center" });
}

// 11
{
  const s = createSlide(deck, 11, "Eventdurchfuehrung", "Das System begleitet den Ablauf vor Ort", "", "Zeigen Sie, dass digitale Funktionen direkt in der operativen Eventdurchfuehrung helfen: Check-in, Teilnehmerstatus, Foto-Uploads, Medienmaterial und Kommunikation.");
  addBullets(s, ["Check-in und Einlasskontrolle", "Status: angemeldet, Warteliste, eingecheckt", "Eventkontakte und Teilnehmerdaten im Blick", "Foto-Upload durch Mitglieder waehrend oder nach dem Event"], 110, 260, 940, 25, 58);
}

// 12
{
  const s = createSlide(deck, 12, "Nachkommunikation", "Teilnehmer bleiben nach dem Event erreichbar", "", "Der entscheidende strategische Nutzen: Nach dem Event koennen Teilnehmer gezielt mit Rueckblicken, Galerien, Vortragsveroeffentlichungen, Robo-Themen und Folgeevents angesprochen werden.");
  addBullets(s, ["Dankesmail und Rueckblick", "Fotogalerie und redaktioneller Nachbericht", "Hinweise auf Robo-Themen und Referentenprofile", "Einladung zu thematisch passenden Folgeevents"], 110, 260, 940, 25, 58);
}

// 13
{
  const s = createSlide(deck, 13, "Robo-Themen", "Vortraege werden zu dauerhaften Fachbeitraegen", "", "Erklaeren Sie die inhaltliche Grenze: Robo-Themen sind den Vortraegen der Medienfruehstuecke vorbehalten. Sie sind keine allgemeine Newsrubrik, sondern eine redaktionelle Auswertung der Fachimpulse.");
  addText(s, "Keine beliebige Newsrubrik", 110, 250, 460, 44, { fontSize: 30, bold: true });
  addText(s, "Robo-Themen sind den Vortraegen der Medienfruehstuecke vorbehalten.", 110, 310, 460, 92, { fontSize: 23, color: muted });
  addText(s, "Dauerhaft auffindbar", 700, 250, 460, 44, { fontSize: 30, bold: true });
  addText(s, "Aus einem Vortrag wird ein teilbarer, zitierbarer Fachbeitrag.", 700, 310, 460, 92, { fontSize: 23, color: muted });
  addRule(s, 110, 440, 120);
  addText(s, "Die Plattform verlaengert die Wirkung der Medienfruehstuecke redaktionell.", 110, 475, 980, 46, { fontSize: 27, bold: true });
}

// 14
{
  const s = createSlide(deck, 14, "Referentenbuehne", "Die fachlichen Koepfe werden sichtbar", "", "Hier geht es um Wertigkeit fuer Referenten. Sie erscheinen nicht nur als Name in einer Agenda, sondern mit Foto, Vita, Unternehmen, Funktion, Vortrag und verknuepftem Themenbeitrag.");
  addBullets(s, ["Foto und Vita", "Unternehmen und Funktion", "Vortragstitel und Themenbeitrag", "Profilseite und Verknuepfung zum Event"], 110, 260, 940, 25, 58);
}

// 15
{
  const s = createSlide(deck, 15, "Redaktion", "Das CMS buendelt Text, Medien und Veroeffentlichung", "", "Betonen Sie, dass Redaktion hier nicht nur Schreiben bedeutet. Es geht um vollstaendige Artikelpakete: Text, Bild, Galerie, Video, Audio, PDF, Thumbnail und Freigabe.");
  addNumberCard(s, 1, "News und Beitraege", "Manuell, per Import oder mit KI-Unterstuetzung vorbereiten und veroeffentlichen.", 90, 240, 340, 180, "white");
  addNumberCard(s, 2, "Themen und Rueckblicke", "Vortraege, Events und Galerien redaktionell nachbereiten.", 470, 240, 340, 180, softBlue);
  addNumberCard(s, 3, "Medienpakete", "Bild, Thumb, Audio, PDF, Video und Galerie zusammenfuehren.", 850, 240, 340, 180, "white");
}

// 16
{
  const s = createSlide(deck, 16, "Medienwerkzeuge", "Galerie, PDF, Video und Thumbnails gehoeren zur Redaktion", "", "Erklaeren Sie, dass ein moderner Beitrag nicht nur aus Text besteht. Die Redaktion kann je nach Inhalt Galerien, PDFs, Videos, Audios und Thumbnails zuordnen.");
  addBullets(s, ["Galerien fuer Rueckblicke und Eventdokumentation", "PDFs fuer Programme, Presseunterlagen und Mitgliederinformationen", "Videos fuer Mitschnitte, Interviews oder externe Inhalte", "Thumbnails fuer professionelle Listen- und Mobile-Ansichten"], 110, 260, 940, 25, 58);
}

// 17
{
  const s = createSlide(deck, 17, "Bildworkflow", "Upload, Crop und WebP-Varianten laufen zusammen", "", "Diese Folie erklaert den praktischen Bildprozess. Uploads werden skaliert, bei Bedarf gecroppt, als WebP optimiert und der passenden Darstellung zugeordnet.");
  addBullets(s, ["Upload direkt im Formular oder aus der Mediathek", "Cropfenster fuer Vortrag, Thema, Referent oder Logo", "Warnung bei zu kleiner Aufloesung", "Automatische WebP-Varianten fuer schnelle Ladezeiten"], 110, 260, 940, 25, 58);
}

// 18
{
  const s = createSlide(deck, 18, "Vorleser-Funktion", "Natuerliche Stimmen machen Inhalte barriereaermer", "", "Betonen Sie, dass Audio nicht nur Komfort ist. Die Vorleser-Funktion ist ein Beitrag zur Barrierefreiheit. Die Karaoke-Funktion hilft beim Mitlesen laengerer Texte.");
  addText(s, "Sehr natuerliche Sprachstimmen", 110, 250, 480, 38, { fontSize: 30, bold: true });
  addText(s, "Audiofassungen entstehen mit moderner Sprachtechnologie und machen Beitraege auch hoerbar.", 110, 310, 480, 96, { fontSize: 23, color: muted });
  addText(s, "Karaoke-/Mitlesefunktion", 700, 250, 480, 38, { fontSize: 30, bold: true });
  addText(s, "Gesprochene Textabschnitte werden hervorgehoben und verbessern Orientierung und Verstaendlichkeit.", 700, 310, 480, 96, { fontSize: 23, color: muted });
  addRule(s, 110, 455, 120);
  addText(s, "Ein redaktioneller Beitrag kann gelesen, gehoert und mitverfolgt werden.", 110, 490, 940, 44, { fontSize: 26, bold: true });
}

// 19
{
  const s = createSlide(deck, 19, "KI-Unterstuetzung", "KI ergaenzt die Redaktion, ersetzt sie aber nicht", "", "Diese Aussage sollte klar und ruhig vorgetragen werden. KI ist Werkzeug, nicht Redaktion. Verantwortung, Auswahl, Quellenpruefung und Freigabe bleiben beim Menschen.");
  addBox(s, 92, 235, 500, 250, "white");
  addText(s, "KI hilft bei", 130, 270, 420, 36, { fontSize: 30, bold: true });
  addBullets(s, ["Formulierungen", "Rechtschreibung", "Strukturierung", "Artikelbildern"], 130, 330, 380, 20, 34);
  addBox(s, 688, 235, 500, 250, "#fff6f7");
  addText(s, "Redaktion entscheidet", 726, 270, 420, 36, { fontSize: 30, bold: true });
  addBullets(s, ["Auswahl", "Bewertung", "Quellenpruefung", "Freigabe"], 726, 330, 380, 20, 34);
}

// 20
{
  const s = createSlide(deck, 20, "Mitgliederbereich", "Geschuetzte Funktionen erweitern die Webseite", "", "Zeigen Sie, dass der Mitgliederbereich kein CMS ist, sondern Teil der mobilen Webseite. Mitglieder finden Events, Dokumente, Verzeichnis, Profil und Uploadmoeglichkeiten.");
  addBullets(s, ["Mitglieder-Events und interne Inhalte", "Dokumente und Mitgliederverzeichnis", "Profilpflege und Kontaktinformationen", "Foto-Upload waehrend oder nach Veranstaltungen"], 110, 260, 940, 25, 58);
}

// 21
{
  const s = createSlide(deck, 21, "Foto-Upload", "Mitglieder liefern Material, Redaktion behaelt Kontrolle", "", "Erklaeren Sie den Prozess: Mitglieder koennen Fotos senden, aber nichts wird ungeprueft veroeffentlicht. Die Redaktion sichtet, sortiert, gibt frei und ordnet Galerien oder Rueckblicken zu.");
  addNumberCard(s, 1, "Mitglied laedt hoch", "Waehrend oder nach dem Event ueber den Mitgliederbereich.", 110, 245, 310, 170, "white");
  addNumberCard(s, 2, "Redaktion prueft", "Material wird gesichtet, bewertet und bei Bedarf aussortiert.", 485, 245, 310, 170, softBlue);
  addNumberCard(s, 3, "Galerie entsteht", "Freigegebene Bilder koennen Rueckblick und Dokumentation staerken.", 860, 245, 310, 170, "white");
}

// 22
{
  const s = createSlide(deck, 22, "Qualitaetssicherung", "Das CMS zeigt, was vor der Veroeffentlichung fehlt", "", "Diese Folie zeigt den Sicherheitsnutzen: Fehlende Bilder, Alt-Texte, Links, Galerien, Videos oder Sichtbarkeiten koennen erkannt werden, bevor Besucher sie sehen.");
  addBullets(s, ["fehlende Bilder, Thumbnails und Alt-Texte", "fehlerhafte Links oder leere Galerien", "fehlende Video-Poster und Medienzuordnungen", "Sichtbarkeit, Status und Startseitenfreigabe pruefen"], 110, 260, 940, 25, 58);
}

// 23
{
  const s = createSlide(deck, 23, "Datensicherheit", "Loeschschutz und Statuslogik vermeiden Fehler", "", "Hier geht es um organisatorische Sicherheit. Kritische Datensaetze sollen nicht versehentlich verschwinden. Status, Sichtbarkeit und Bestaetigungen schuetzen die Arbeitsprozesse.");
  addBullets(s, ["Nachfrage beim Loeschen ganzer Datensaetze", "Stornierte oder geloeschte Anmeldungen blockieren keine Neuanmeldung", "Statuslogik fuer Entwurf, aktiv, archiviert und sichtbar", "GitHub, Dropbox und Deploy als Betriebs- und Sicherungsschritte"], 110, 260, 940, 25, 58);
}

// 24
{
  const s = createSlide(deck, 24, "Betriebsmodell", "Ein Event wird zum dauerhaften Kommunikationsanlass", "", "Fassen Sie den operativen Nutzen zusammen: Das Event ist nicht vorbei, wenn die Veranstaltung endet. Die Plattform verlaengert den Wert durch Rueckblick, Themen, Referenten, Mailing und Mitgliederkommunikation.");
  addText(s, "Vor dem Event", 110, 245, 280, 34, { fontSize: 28, bold: true });
  addBullets(s, ["Einladung", "Anmeldung", "Ticket"], 110, 305, 260, 22, 40);
  addText(s, "Beim Event", 500, 245, 280, 34, { fontSize: 28, bold: true });
  addBullets(s, ["Check-in", "Begruessung", "Foto-Upload"], 500, 305, 260, 22, 40);
  addText(s, "Nach dem Event", 890, 245, 300, 34, { fontSize: 28, bold: true });
  addBullets(s, ["Rueckblick", "Robo-Themen", "Nachkommunikation"], 890, 305, 300, 22, 40);
}

// 25
{
  const s = createSlide(deck, 25, "Fazit", "PROdigitalTV wird zur digitalen Infrastruktur des Vereins", "", "Schliessen Sie mit der strategischen Aussage. Die Plattform macht PROdigitalTV sichtbarer, Events professioneller, Referenten wertiger, Inhalte nachhaltiger und Mitgliederkommunikation direkter.");
  addBox(s, 120, 245, 1040, 260, navy, navy);
  addText(s, "Sichtbarkeit, Professionalitaet und Nachhaltigkeit in einem System.", 180, 295, 920, 70, { fontSize: 38, bold: true, color: "white", alignment: "center" });
  addText(s, "Die Plattform verbindet Eventdurchfuehrung, Redaktion, Mitgliederkommunikation und digitale Services zu einem dauerhaften Nutzen fuer PROdigitalTV.", 220, 390, 840, 78, { fontSize: 23, color: "#d9e4f2", alignment: "center" });
}

const audienceTalkNotes = [
  "Guten Tag und herzlich willkommen. Ich moechte Ihnen heute zeigen, wie sich PROdigitalTV von einer klassischen Webseite zu einer echten digitalen Plattform weiterentwickelt. Im Mittelpunkt stehen dabei Veranstaltungen, redaktionelle Inhalte, Mitgliederkommunikation und professionelle Eventprozesse. Entscheidend ist: Diese Plattform soll nicht nur Informationen anzeigen. Sie soll Arbeit erleichtern, Kommunikation buendeln und aus jeder Veranstaltung einen nachhaltigen fachlichen Inhalt machen. Deshalb sprechen wir heute ueber eine Loesung, die vor dem Event beginnt, den Einlass vor Ort unterstuetzt und nach der Veranstaltung weiterwirkt.",
  "Wenn wir auf das Zielbild schauen, sehen wir einen geschlossenen Kommunikationskreislauf. Ein Event wird geplant, beworben, durch Anmeldungen strukturiert und vor Ort professionell begleitet. Danach entstehen Rueckblicke, Themenbeitraege, Referentenprofile und gezielte Nachkommunikation. Der grosse Unterschied zu vielen Einzelsystemen ist: Die Informationen muessen nicht immer wieder neu zusammengesucht werden. Die Plattform verbindet Webseite, CMS, Eventverwaltung, Medien und Mitgliederbereich zu einem Arbeitsraum, in dem Inhalte dauerhaft nutzbar bleiben.",
  "Die wichtigsten Staerken liegen im Zusammenspiel der Funktionen. Events werden nicht mehr isoliert betrachtet, sondern als kompletter Prozess. Referenten bekommen eine eigene sichtbare Buehne. Redaktionelle Inhalte koennen mit Bildern, Audio, Video, PDF und Galerien angereichert werden. Mail und Push helfen, die richtigen Zielgruppen zu erreichen. Das Handy-Ticket macht die Teilnahme komfortabler. Und weil die Web-App mobile first gedacht ist, funktioniert der Zugang dort, wo Besucher, Teilnehmer und Mitglieder ihn am haeufigsten brauchen: auf dem Smartphone.",
  "Die Plattform folgt einer klaren Aufgabenteilung. Die oeffentliche Web-App ist fuer Nutzerinnen und Nutzer optimiert: schnell, mobil, direkt und uebersichtlich. Dort finden sie Events, Themen, News, Referenten, Mitgliederfunktionen und ihr Ticket. Das CMS dagegen ist die Arbeitsoberflaeche fuer Redaktion und Verwaltung. Dort werden Inhalte gepflegt, Bilder bearbeitet, Teilnehmer organisiert und Freigaben gesetzt. Diese Trennung ist wichtig, weil mobile Nutzung einfach sein muss, waehrend redaktionelle Arbeit Platz, Kontrolle und Uebersicht braucht.",
  "Hier sehen wir den Kern der Eventsteuerung. Ein Event beginnt mit Planung und inhaltlicher Vorbereitung. Danach wird entschieden, wann es veroeffentlicht wird und welche Zielgruppen eingeladen werden. Erst dann folgen Anmeldung, Durchfuehrung und Rueckblick. Besonders wichtig ist der hintere Teil des Prozesses: Aus Vortraegen werden Robo-Themen, aus Referenten werden sichtbare Fachprofile, und aus Teilnehmern wird ein gezielt ansprechbarer Kreis fuer die Nachkommunikation. So verlaengert die Plattform die Wirkung eines Events deutlich ueber den Veranstaltungstag hinaus.",
  "Die Eventplanung ist die Grundlage fuer alle weiteren Schritte. Hier werden Titel, Termin, Ort, Gastgeber, Eventtyp, Sichtbarkeit und Startseitenfreigabe festgelegt. Gerade diese scheinbar einfachen Angaben sind entscheidend, weil sie steuern, ob ein Event oeffentlich sichtbar ist, nur fuer Mitglieder erscheint oder auf der Startseite hervorgehoben wird. Damit wird aus einer redaktionellen Eingabe eine klare Steuerung fuer Webseite, Anmeldung, Kommunikation und Archiv.",
  "Ein wichtiger Baustein ist die zentrale Einladung. PROdigitalTV kann sehr genau entscheiden, welcher Besucherkreis angesprochen werden soll: der gesamte Adressbestand, nur Vereinsmitglieder, eine bestimmte Teilnehmergruppe oder ein ausgewaehlter Verteiler. Die Mail bleibt dabei der verlaessliche Kanal fuer ausfuehrliche Informationen. Push-Nachrichten ergaenzen das durch kurze, schnelle Hinweise auf dem Smartphone. So wird Kommunikation gezielter, weniger beliebig und fuer die Empfaenger relevanter.",
  "Die Anmeldung ist mehr als ein Formular. Sie erzeugt den Datensatz, mit dem die Veranstaltung organisatorisch steuerbar wird. Dazu gehoeren Datenschutz- und Foto-/Videohinweise, Dublettenpruefung, Wartelistenlogik, Bestaetigungsmails und der Status der Teilnahme. Auch manuell hinzugefuegte Personen sollen eine Bestaetigung erhalten und sich aktivieren koennen. Damit entsteht eine belastbare Grundlage fuer Einlass, Kommunikation, Stornierung und Nachbereitung.",
  "Der QR-Code spielt vor allem dann eine Rolle, wenn sich ein Teilnehmer am Desktop anmeldet. Dann erscheint am Desktop ein QR-Code, der mit dem Smartphone gescannt wird. Wichtig ist: Dieser QR-Code ist nicht das eigentliche Ticket. Er uebertraegt den persoenlichen Token auf das betreffende Handy. Ab diesem Moment kann das System genau dieses Smartphone der konkreten Anmeldung und dem konkreten Event zuordnen. Das Handy wird damit zum persoenlichen Zugangstraeger.",
  "Beim Einlass wird daraus ein professioneller Prozess. Das System erkennt anhand des gespeicherten Tokens, welche Anmeldung zu diesem Handy gehoert. Dadurch kann der Teilnehmerstatus schnell geprueft werden. Gleichzeitig entsteht die Moeglichkeit, den Gast persoenlich auf einem Screen zu begruessen. Das wirkt nicht nur hochwertig, sondern hilft auch organisatorisch: Der Einlass sieht sofort, ob jemand angemeldet, storniert, auf der Warteliste oder bereits eingecheckt ist.",
  "Waehrend der Veranstaltung unterstuetzt die Plattform den Ablauf vor Ort. Check-in, Status, Teilnehmeruebersicht und Eventkontakte bleiben an einer Stelle verfuegbar. Gleichzeitig kann Material gesammelt werden, zum Beispiel Fotos von Mitgliedern waehrend oder nach dem Event. Dadurch wird die Veranstaltung nicht nur administriert, sondern auch dokumentiert. Das ist besonders wichtig, weil gute Eventkommunikation nicht erst nachtraeglich beginnt, sondern schon waehrend der Veranstaltung vorbereitet wird.",
  "Nach dem Event beginnt die zweite Wirkungsebene. Teilnehmer koennen gezielt informiert werden: mit Dankesmail, Rueckblick, Fotogalerie, Hinweisen auf Robo-Themen oder passenden Folgeevents. Das ist ein grosser Vorteil gegenueber einer einmaligen Einladung. Wer an einer Veranstaltung teilgenommen hat, interessiert sich oft auch fuer die Inhalte danach. Die Plattform macht diesen Kreis erreichbar und ermoeglicht eine fachlich passende Anschlusskommunikation.",
  "Die Robo-Themen sind bewusst den Vortraegen der Medienfruehstuecke vorbehalten. Sie sind keine beliebige Newsrubrik, sondern eine redaktionelle Verlaengerung der Veranstaltungen. Aus einem Vortrag entsteht ein dauerhaft auffindbarer Fachbeitrag. Das staerkt die Sichtbarkeit der Inhalte, gibt den Referenten mehr Reichweite und macht die Medienfruehstuecke auch fuer Menschen interessant, die nicht live teilnehmen konnten. So wird das Event zu einem nachhaltigen Wissensformat.",
  "Referenten sind nicht nur Namen in einem Programm. Die Plattform gibt ihnen eine eigene Buehne: mit Foto, Vita, Unternehmen, Funktion, Vortragstitel und Verknuepfung zum jeweiligen Event. Das ist fuer die Aussendarstellung wichtig, weil Kompetenz sichtbar wird. Gleichzeitig entsteht fuer PROdigitalTV ein wachsendes Netzwerk aus fachlichen Koepfen, Themen und Institutionen. Die Referentenprofile machen deutlich, wer die Inhalte traegt und welche Expertise hinter den Veranstaltungen steht.",
  "Im redaktionellen Bereich werden News, Themen und Rueckblicke gebuendelt. Die Redaktion kann Inhalte erstellen, bearbeiten, pruefen und veroeffentlichen. Wichtig ist dabei: Die Plattform soll die Redaktion nicht ersetzen, sondern ihr bessere Werkzeuge geben. Inhalte koennen strukturiert gepflegt, mit Medien verbunden und fuer verschiedene Ausspielungen vorbereitet werden. So entsteht eine professionelle redaktionelle Arbeitsweise, die zugleich effizienter und konsistenter wird.",
  "Zur redaktionellen Arbeit gehoeren heute nicht nur Texte. Galerien, PDF-Dokumente, Videos, Audiodateien und Thumbnails sind feste Bestandteile professioneller Medienkommunikation. Die Plattform soll diese Medien nicht nur speichern, sondern sinnvoll zuordnen: zu News, Rueckblicken, Events, Referenten oder Mitgliederinformationen. Dadurch koennen Inhalte hochwertiger praesentiert werden, und die Redaktion behaelt den Ueberblick, welches Material wo eingesetzt wird.",
  "Der Bildworkflow ist besonders wichtig, weil gute Bilder ueber die Qualitaet der Webseite entscheiden. Upload, Crop, WebP-Varianten und Thumbnail-Erstellung muessen zusammenlaufen. Bei Vortraegen, Referenten und Logos sollen die benoetigten Varianten moeglichst direkt nach dem Upload entstehen und passend zugeordnet werden. Gleichzeitig braucht die Redaktion Hinweise, wenn ein Bild zu klein ist oder fuer eine bestimmte Nutzung nicht ausreicht. Das verbessert Qualitaet und Ladezeiten.",
  "Die Vorleser-Funktion ist ein eigener Beitrag zur Barrierefreiheit. Artikel koennen mit sehr natuerlich klingenden Stimmen auf dem neuesten Stand der Sprachtechnologie vorgelesen werden. Das hilft Menschen, die Inhalte lieber hoeren, unterwegs sind oder beim Lesen eingeschraenkt sind. Die Karaoke- beziehungsweise Mitlesefunktion hebt den gesprochenen Text sichtbar hervor und verbessert Orientierung und Verstaendlichkeit. Damit wird aus einem Text ein zugaenglicheres Medienangebot.",
  "KI kann die Redaktion sinnvoll unterstuetzen, aber sie ersetzt sie nicht. Das ist ein wichtiger Punkt. Die redaktionelle Verantwortung bleibt beim Menschen. KI hilft bei Formulierungen, Rechtschreibung, Strukturierung und der Erstellung von Artikelbildern. Die Auswahl, Bewertung, Quellenpruefung und Freigabe liegen weiterhin bei der Redaktion. Genau dadurch entsteht ein verantwortungsvoller Einsatz: schneller und hilfreicher, aber nicht automatisch oder ungeprueft.",
  "Der Mitgliederbereich erweitert die oeffentliche Webseite um geschuetzte Funktionen. Mitglieder koennen interne Inhalte sehen, Mitgliederevents finden, Dokumente abrufen, ihr Profil pflegen und Kontaktinformationen nutzen. Gerade mobil ist das wichtig, weil viele dieser Situationen unterwegs entstehen. Der Mitgliederbereich soll deshalb kein schwerfaelliges CMS sein, sondern ein zuganglicher Bereich innerhalb der Web-App, der relevante Funktionen schnell verfuegbar macht.",
  "Beim Foto-Upload geht es um Beteiligung ohne Kontrollverlust. Mitglieder koennen waehrend oder nach einer Veranstaltung Bilder hochladen. Diese Bilder werden aber nicht automatisch oeffentlich ausgespielt. Die Redaktion prueft, sortiert, entscheidet und ordnet das Material Rueckblicken oder Galerien zu. So kann die Community zur Dokumentation beitragen, waehrend die redaktionelle Qualitaet und rechtliche Sorgfalt erhalten bleiben.",
  "Qualitaetssicherung bedeutet, Fehler zu erkennen, bevor sie auf der Webseite sichtbar werden. Das CMS soll Hinweise geben, wenn Bilder, Thumbnails, Alt-Texte, Links, Galerien, Video-Poster oder Medienzuordnungen fehlen. Auch Status und Sichtbarkeit muessen klar nachvollziehbar sein. Gerade wenn viele Inhalte parallel entstehen, ist diese Form der Kontrolle entscheidend. Sie verhindert leere Seiten, falsche Darstellungen und unvollstaendige Veroeffentlichungen.",
  "Datensicherheit und organisatorische Sicherheit gehoeren zusammen. Beim Loeschen ganzer Datensaetze sollte immer eine Bestaetigung erfolgen, damit nicht versehentlich Vortraege, Referenten, Events oder Anmeldungen verschwinden. Gleichzeitig muss die Statuslogik sauber sein: Entwurf, aktiv, archiviert, sichtbar, storniert oder geloescht muessen eindeutig wirken. GitHub, Dropbox und Deploy-Prozesse ergaenzen diese Sicherheit, weil Arbeitsstaende nachvollziehbar und wiederherstellbar bleiben.",
  "Das Betriebsmodell zeigt, dass ein Event kein einzelner Termin ist, sondern ein dauerhafter Kommunikationsanlass. Vor dem Event geht es um Einladung, Anmeldung und Ticket. Beim Event geht es um Check-in, Begruessung und Dokumentation. Nach dem Event geht es um Rueckblick, Robo-Themen und Nachkommunikation. Diese drei Phasen greifen ineinander. Genau dadurch entsteht der groesste Nutzen: Inhalte und Kontakte bleiben nach der Veranstaltung weiter aktiv.",
  "Zusammengefasst wird PROdigitalTV mit dieser Plattform zu einer digitalen Infrastruktur des Vereins. Sie macht Veranstaltungen professioneller, Referenten sichtbarer, Inhalte nachhaltiger und Mitgliederkommunikation direkter. Der Kern ist nicht eine einzelne Funktion, sondern die Verbindung vieler Bausteine zu einem durchgaengigen System. So kann PROdigitalTV seine Rolle als Mediennetzwerk staerken und gleichzeitig die praktische Arbeit in Redaktion, Eventorganisation und Kommunikation deutlich erleichtern."
];

deck.slides.items.forEach((slide, index) => {
  addNotes(slide, `${audienceTalkNotes[index]}\n\n[Sources]\nInterne PROdigitalTV Funktionsbeschreibung, Stand August 2026.`);
});

await fs.mkdir(outDir, { recursive: true });
for (const [index, slide] of deck.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  await writeBlob(path.join(outDir, `${stem}.png`), await deck.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(path.join(outDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
}
await writeBlob(path.join(outDir, "deck-montage.webp"), await deck.export({ format: "webp", montage: true, scale: 1 }));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(finalPath);
console.log(finalPath);
