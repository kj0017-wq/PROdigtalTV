# Jahreshauptversammlung: Architektur und Umsetzung

Stand: 11.10.2026. Produktiver Betrieb bleibt gesperrt bis zur geprüften Satzungskonfiguration und Freigabe.

## Vorhandene Architektur
- Eine Vanilla-JavaScript-PWA, hashbasierte Routen, gemeinsames CMS-Designsystem.
- Firebase Authentication; private Benutzerprofile `users`, Verknüpfung `memberId` mit `members`.
- Rollen Admin/Editor/Mitglied; Versammlungsleitung erhält explizite Benutzer-IDs, Admin bleibt kontrollierende Rolle.
- `events` und `registrations`: QR-Check-in setzt `checked_in`, `checkedInEventId`, `checkedInAt`.
- Cloud Functions v2 in europe-west3, Firestore-Transaktionen und Auditdaten.
- Bestehende `liveSurveys` sind Eventbefragungen, keine rechtssichere Mitgliederabstimmung; keine Übernahme als Stimmregister.
- Bestehende PowerPoint-Galerie zeigt konvertierte, statische Folien. Liveergebnisse erhalten eine Browseransicht; gewöhnliche PPTX aktualisiert sich nicht selbst.

## Implementierungsplan
1. Modulare Backend-Domänenlogik und isoliertes Testversammlungsregister mit Referenzen auf bestehende Event-/Mitglieder-IDs; keine zweite Mitgliederverwaltung.
2. Anwesenheit, geprüfte Vollmachten (maximal drei), konfigurierbare Beschlussfähigkeit und nachvollziehbare Bestätigung.
3. Servergesteuerte Wahlgänge, getrennte eigene/vertretene Stimmen, Ausschlüsse des Stimmrechtsträgers UND Ausübenden, transaktionssichere eindeutige Ballots und unveränderliche Abschlüsse.
4. Smartphone-Voting, Tablet-Leitung, getrennte Moderation und aggregierte Live-Präsentationsansicht; authentifizierter API-Vertrag für Windows-PowerPoint.
5. Bearbeitbares Protokoll, PDF/DOCX/JSON und statischer PPTX-Export mit Sprechernotizen; keine öffentliche Anzeige von Einzelstimmen/Notizen.
6. Fiktive Daten: Vollmachtsgrenze, Widerruf, Konflikte, Ausschlüsse, Parallelität, Abschluss und Auth-/Datenschutzprüfungen.

## Noch anhand der aktuellen Satzung zu bestätigen
Keine verbindlichen Standardwerte: Stimmrecht pro Mitgliedschaftsart, Beschlussfähigkeitsregel inklusive Wiederholungsversammlung, Mehrheit je Beschlussart, Bezugsgröße und Enthaltungen, Einzel-/Blockentlastung und persönliche Ausschlüsse, Wahlverfahren/Sitze/Gleichstand/Annahme, Kassenprüferverfahren, zulässige digitale Vollmachtsform, Einladung/hybride Teilnahme, Aufbewahrung/Löschung.
Die ausdrücklich angegebene Obergrenze von drei Vollmachten wird implementiert; sie ersetzt nicht die Prüfung der wirksamen Satzungsgrundlage.

Rechtsquellen zur Prüfung, keine Rechtsberatung/kein automatisches Satzungsersatzregelwerk:
- https://www.gesetze-im-internet.de/bgb/__32.html
- https://www.gesetze-im-internet.de/bgb/__33.html
- https://www.gesetze-im-internet.de/bgb/__34.html
- https://www.gesetze-im-internet.de/bgb/__38.html
- https://www.gesetze-im-internet.de/bgb/__40.html

## Daten und Grenzen
`assemblies/{id}`: versammlungsbezogener Status, minimaler Stimmrechts-/Anwesenheitssnapshot, Agenda, geprüfte Vollmachten, Konfiguration. `ballots` und `audit` als private Unterkollektionen; direkter Clientzugriff verweigert, Zugriff nur über autorisierte Cloud Functions. Keine Kontaktdatenkopie. Offene Stimmen sind für die Leitung nachvollziehbar, öffentlich nur aggregierte Ergebnisse.
Jeder Wahlgang besitzt einen eigenen eingefrorenen Berechtigungssnapshot. Während eines laufenden Wahlgangs werden Anwesenheits-/Vollmachtänderungen gesperrt; nach Schließen gelten Änderungen für folgende Wahlgänge. Historische Stimmen bleiben erhalten. Entlastungsausschlüsse blockieren sowohl eigene als auch übertragene Stimmen ausgeschlossener Ausübender.
Unbestätigte oder widersprüchliche Regeln blockieren Freigabe/Start. Testbetrieb zeigt ein dauerndes Testbanner. Keine Verarbeitung echter Mitgliedsdaten für Testabstimmungen und keine Änderungen an bestehenden Events/Registrierungen.
Liveanzeige: Browser auf Präsentationsrechner, getrennt vom Moderationsfenster; PowerPoint kann diese Ansicht per Link öffnen. Eine Windows-VBA-Anbindung benötigt explizite Authentifizierung und eigene lokale Prüfung; kein im Dokument eingebettetes dauerhaftes Token.

## Stand und Freigabe
Das Modul wurde im bestehenden CMS als gekennzeichneter Testbetrieb integriert. Produktive Versammlungen sind nicht angelegt oder freigegeben. Eine spätere produktive Anlage benötigt eine ausdrücklich geprüfte Satzungsreferenz, konfigurierte Stimmrechte je Mitgliedschaftsart, Beschlussfähigkeits-, Vollmachts- und Aufbewahrungsregeln sowie die administrative Bestätigung. Sie übernimmt Mitglieder aus der bestehenden Verwaltung und ordnet ein bestehendes Event zu. Fiktive Vollmachten, Stimmen und Kandidaten werden nicht übernommen. Jeder Beschluss muss zusätzlich vor Öffnung eigenständig geprüft werden.

Prüfungen: Domain- und Oberflächentests mit fiktiven Mitgliedern; tatsächliche Cloud-Functions-/Firestore-Integration mit temporären Konten; vier parallele Eingaben derselben Stimme ergeben genau einen gespeicherten Stimmzettel; getrennte eigene/übertragene Stimmen; gesperrte geschlossene Ergebnisse; direkte private Firestore-Lesezugriffe verweigert; PDF/DOCX/JSON/PPTX-Export. Temporäre Live-Testdaten wurden entfernt. QR-Check-in berücksichtigt die bestätigte E-Mail-Zuordnung und ignoriert behauptete Mitglieds-IDs.

PowerPoint: Statischer Export mit Sprechernotizen und Link zur laufend aktualisierten Browseransicht. Authentifizierte API und optionales Windows-VBA-Beispiel sind vorhanden; der VBA-Weg wurde nicht in einer Windows-PowerPoint-Bildschirmpräsentation geprüft. Bei mehreren Vorstandssitzen werden getrennte Wahlgänge angelegt; das konkrete Wahlverfahren muss anhand der Satzung festgelegt werden.
