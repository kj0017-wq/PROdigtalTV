# PROdigitalTV Plattform

Premium-B2B-Website, mobile Progressive Web App und CMS fuer **PROdigitalTV - Das Branchennetzwerk der digitalen Medienwirtschaft.**

## 1. Architekturuebersicht

Die Anwendung ist als mobile-first Single Page App mit nativen ES-Modulen aufgebaut. Sie laeuft ohne Build-Abhaengigkeiten sofort im Demo-Modus und nutzt im Produktionsbetrieb Firebase als gemeinsame Datenbasis fuer Website, App und CMS.

| Ebene | Umsetzung |
| --- | --- |
| Public Website / PWA | `public/index.html`, Views und Komponenten in `src/`, Service Worker und Manifest |
| CMS | Geschuetzte CMS-Routen unter `#/cms/*`, rollenbasierte Navigation und Bearbeitungsdialoge |
| Datenzugriff | Repository-Schicht `src/firebase/dataService.js`, Demo-Fallback oder Cloud Firestore |
| Authentifizierung | Firebase Authentication; Demo-Rollenumschaltung fuer lokale Vorschau |
| Medien | Firebase Storage Adapter fuer Eventfotos, Logos und Downloads |
| E-Mail-Bestaetigung | Firestore `mailQueue` und Cloud Functions in `functions/index.js` |
| Bereitstellung | Firebase Hosting, Regeln und Indizes im Projektroot |

Die oeffentliche Website, mobile Darstellung und das CMS lesen dieselben Entitaeten. Eventbeziehungen bleiben immer der fachliche Kontext fuer Referenten, Sponsoren und Gastgeber.

## 2. Firestore-Datenmodell

| Collection | Zweck | Zentrale Verknuepfung |
| --- | --- | --- |
| `events` | Stammdaten, Zugang, Lifecycle, Nachbericht | `topicIds`, `speakerIds`, `sponsorIds`, `hostId` |
| `topics` | Strategische Themenfelder | ueber Events |
| `speakers` | Referentenprofile mit Foto, Kurzprofil und Vita | erscheinen nur ueber Events |
| `sponsors` | Gastgeber, Partner, Unterstuetzer | erscheinen nur ueber Events |
| `members` | Mitgliedsunternehmen | optional mit Nutzerprofil |
| `boardMembers` | Vorstandsgalerie | redaktionell freigegeben |
| `registrations` | Eventbezogene Anmeldungen und Status | `eventId`, `userId` |
| `eventMedia` | Nachlaufmedien und Freigaben | `eventId` |
| `media` | Allgemeine Medienbibliothek | `usageContext` |
| `editorialContent` | Seiten- und Teasertexte | `page`, `section`, `key` |
| `mailQueue` | Transaktionale Mails | `registrationId`, `eventId` |
| `users` | Rollen und Mitgliederzuordnung | Firebase Auth UID |
| `settings` | Listenwerte und Konfiguration | `key`, `group` |
| `aiLogs` | Protokollierte ChatGPT-Aktionen | `entityType`, `entityId`, `action` |
| `aiDrafts` | Redaktionelle KI-Vorschlaege | `entityType`, `entityId`, `fieldName` |
| `system` | Installationsstatus | Dokument `setup` |
| `auditLog` | Revisionsprotokoll | `entityType`, `entityId` |

Felddefinitionen und produktionsnahe Beispieldaten stehen in [`src/data/demoData.js`](src/data/demoData.js). Alle IDs in Demo-Daten sind stabil, damit die idempotente Einrichtung keine Duplikate erzeugt.

Referenten koennen im CMS mit `photoUrl`, `shortBio` und `longBio` gepflegt werden. Veroeffentlichte Profile werden ausschliesslich innerhalb ihrer zugeordneten Events mit Portrait und Vita ausgegeben.

## 3. Seitenstruktur

Oeffentliche Routen:

- Start, Events, Eventdetail und Anmeldung
- Bestaetigungsseite per Token
- Themen und Themendetails
- Ueber uns, Vorstand, Mitglieder und Mitglied werden
- Login und Mitgliederbereich
- Rueckblicke / Eventarchiv
- Impressum und Datenschutz

Die mobile Ansicht verwendet grosse Startkacheln und eine feste Bottom Navigation (`Start`, `Events`, `Themen`, `Mitglieder`, `Login`). Auf groesseren Viewports wird daraus die Corporate-Website-Navigation.

## 4. CMS-Struktur

CMS-Routen sind fuer `admin` und `editor` vorgesehen:

- Dashboard mit Kennzahlen, Qualitaetshinweisen, offenen Nacharbeiten und Mailfehlern
- Events mit Tabs fuer Stammdaten, Themen, Referenten, Sponsoren, Anmeldung, Vorlauf, Nachlauf und Medien
- Anmeldungen mit Statusverwaltung und UTF-8/CSV-Export pro Event
- Medien/Nacharbeit mit Upload, Freigabe, Titelbild und Sichtbarkeit
- Themen, Referenten mit Foto/Vita, Sponsoren, Mitglieder, Vorstand, Redaktion und Mail-Queue
- ChatGPT mit KI-Vorschlaegen, KI-Pruefung, aiLogs und aiDrafts
- ChatGPT-Einstellungen fuer Modell, Rollen, Tonalitaet und Logging
- System / Einrichtung nur fuer `admin`

## 5. Rollen- und Sicherheitskonzept

| Rolle | Rechte |
| --- | --- |
| `guest` | Oeffentliche freigegebene Inhalte; oeffentliche Anmeldung erstellen |
| `member` | Zusaetzlich Mitglieder-Events, interne Downloads und eigene Anmeldungen |
| `editor` | CMS-Inhalte, Events, Medien und Anmeldungen verwalten; optionaler Export |
| `admin` | Vollzugriff inkl. Setup, Rollen, Export, Audit und System |

`firestore.rules` und `storage.rules` verhindern den oeffentlichen Zugriff auf Registrierungen, Mail-Queue und Tokens. Fuer produktive E-Mail-Token wird nur ein Hash gespeichert; die Validierung erfolgt serverseitig.

## 6. Mailbestaetigungsprozess

1. Anmeldung wird mit `pending_email_confirmation` erstellt.
2. Eine callable Cloud Function erzeugt Token und Hash; nur der Hash landet in `registrations`.
3. Ein Queue-Eintrag `registration_confirmation` wird fuer den Mailversand erzeugt.
4. Der Mailprovider versendet den Link `/confirm.html?token=...`.
5. `confirmRegistrationByToken` validiert Token und Ablaufzeit.
6. Anmeldung wechselt zu `confirmed`, `confirmedAt` wird gesetzt und optional eine Abschlussmail eingereiht.
7. Zeitgesteuerte Bereinigung markiert unbestaetigte abgelaufene Anmeldungen als `expired`.

## 7. Setup-Routine

`src/firebase/setupService.js` stellt die geforderten Funktionen bereit und arbeitet idempotent mit festen Dokument-IDs. Die Seite `#/cms/setup` bietet:

- Verbindungstest fuer Firestore, Authentication und Storage
- Strukturpruefung und initiale Settings/Rollen/Statuswerte
- Optionale Demo-Daten
- Setup- und Audit-Protokoll

Die Routine ergaenzt fehlende Basisdokumente und ueberschreibt keine produktiven Inhalte. Das Entfernen von Demo-Daten ist in der UI bestaetigungspflichtig.

## Lokal starten

```powershell
.\scripts\build.ps1
.\scripts\serve.ps1
```

Danach im Browser `http://localhost:4173` oeffnen. Ohne Firebase-Konfiguration nutzt die Anwendung die Demo-Daten im lokalen Speicher. Im Login kann fuer die Produktvorschau eine Rolle gewaehlt werden.

Alternativ stehen fuer Umgebungen mit Node.js `node scripts/build.mjs` und `node scripts/serve.mjs` bereit.

## Firebase aktivieren

1. Firebase-Projekt mit Firestore, Authentication, Storage und Hosting anlegen.
2. Werte in `src/firebase/firebaseConfig.js` eintragen und `useFirebase: true` setzen.
3. E-Mail/Passwort-Login und Google-Login in Firebase Authentication aktivieren.
4. Service Account in Firebase erzeugen: Projekteinstellungen -> Dienstkonten -> Neuen privaten Schluessel generieren. Die JSON-Datei lokal z. B. unter `.secrets/prodigitaltv-service-account.json` ablegen und nicht committen.
5. Abhaengigkeiten installieren und Demo-Daten nach Firestore exportieren:

```bash
npm install
npm run firebase:seed -- --service-account ./.secrets/prodigitaltv-service-account.json --admin-email admin@example.com
```

Wenn Bilder, Logos und Vorstandsfotos ebenfalls nach Firebase Storage uebernommen werden sollen:

```bash
npm run firebase:seed -- --service-account ./.secrets/prodigitaltv-service-account.json --admin-email admin@example.com --upload-assets
```

Falls der Admin-User in Firebase Authentication noch nicht existiert:

```bash
npm run firebase:seed -- --service-account ./.secrets/prodigitaltv-service-account.json --admin-email admin@example.com --admin-password "SICHERES_PASSWORT"
```

Das Script schreibt alle Demo-Collections idempotent nach Firestore, entfernt Altseiten-Referenzen, markiert die importierten Datensaetze mit `demo: true` und legt fuer den Admin `users/{uid}` sowie den Custom Claim `role=admin` an.

### Event-Pipeline fuer CMS-Rubriken

Wenn Events und Event-Nachlauf neu klassifiziert oder neu aufgebaut werden sollen, nutzt die Pipeline `scripts/eventsPipeline.mjs`.

```bash
npm run firebase:events:pipeline -- --service-account ./.secrets/prodigitaltv-service-account.json --backup
npm run firebase:events:pipeline -- --service-account ./.secrets/prodigitaltv-service-account.json --repair --dry-run
npm run firebase:events:pipeline -- --service-account ./.secrets/prodigitaltv-service-account.json --reset-from-seed --dry-run
```

`--repair` markiert bestehende Events anhand von Datum, `expiresAt` und `lifecyclePhase`. `--reset-from-seed` erstellt zuerst ein Backup, leert `events` und importiert die Seed-Events neu. Echte Schreib- oder Loeschaktionen benoetigen zusaetzlich `--yes`.

6. Regeln und Indizes deployen:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,hosting
```

7. Fuer Mailversand `functions/` mit einem Provider konfigurieren und deployen. Die mitgelieferten Functions enthalten bewusst eine Provider-Schnittstelle statt Zugangsdaten.

## ChatGPT / OpenAI

Die KI-Unterstuetzung fuer die Eventverwaltung laeuft ausschliesslich serverseitig ueber Firebase Cloud Functions. Der OpenAI API-Key wird nicht im Frontend gespeichert.

Secret setzen:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

Danach Functions deployen:

```bash
firebase deploy --only functions
```

Im CMS stehen die Bereiche `ChatGPT` und `ChatGPT-Einstellungen` bereit. KI-Ausgaben werden immer nur als Vorschlag angezeigt; Redakteure koennen uebernehmen, bearbeiten, verwerfen, neu generieren oder als `aiDrafts` speichern.

## Projektstruktur

```text
public/                 HTML, Manifest, Service Worker, Icons
src/components/         Wiederverwendbare UI-Bausteine
src/pages/              Oeffentliche Seiten
src/cms/                CMS-Seiten
src/ai/                 Frontend-Service fuer Firebase-Functions-basierte KI-Aufrufe
src/firebase/           Firebase-Adapter, Anmeldung und Setup
src/styles/             Designsystem
src/data/               Beispiel- und Setup-Daten
src/utils/              Routing, Formatierung, CSV
functions/              Cloud Functions fuer Anmeldungsworkflow und OpenAI
scripts/                Build und lokaler Preview-Server
```
