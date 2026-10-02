# PROdigitalTV – Verkettungsplan der CMS-Software

Stand: 2. Oktober 2026 · Aus dem aktuellen Quellcode abgeleitet.

Dieser Plan zeigt, welche Bereiche zusammenarbeiten, wo ihre Daten liegen und welche Aktionen daraus entstehen. Die Diagramme sind eine Übersicht der wichtigsten Verbindungen; sie bilden nicht jeden einzelnen Funktionsaufruf ab.

## 1. Gesamtübersicht

```mermaid
flowchart TB
  CMS[CMS: Verwaltung und Redaktion]
  WEB[Öffentliche Website]
  PORTAL[Mitgliederbereich]
  LIVE[Geschützter Eventbereich]
  AUTH[Firebase Authentication: Anmeldung]
  DB[(Firestore: gemeinsame Daten)]
  FN[Cloud Functions: Prüfung und Verarbeitung]
  STORE[(Firebase Storage: Dateien)]
  MAIL[Mailversand über SMTP]
  PUSH[Browser-Push]
  SMS[SMS-Dienst]
  AI[KI-Dienste]
  CMS --> AUTH
  PORTAL --> AUTH
  LIVE --> AUTH
  CMS --> DB
  WEB --> DB
  PORTAL --> DB
  CMS --> FN
  PORTAL --> FN
  LIVE --> FN
  FN --> DB
  FN --> STORE
  CMS --> STORE
  FN --> MAIL
  FN --> PUSH
  FN --> SMS
  FN --> AI
```

Direkte Daten- und Dateizugriffe werden durch Firestore- und Storage-Regeln geschützt. Cloud Functions prüfen zusätzlich Rollen, Eventberechtigungen und Eingabedaten. Website, CMS und Portal verwenden gemeinsame Datensätze.

## 2. Fachliche Verknüpfung der CMS-Bereiche

```mermaid
flowchart LR
  MEMBERS[Mitglieder und Vorstand] --> ACCOUNTS[Logins und Rollen]
  CONTACTS[Mailingadressen] --> SEND[Event Versand]
  MEMBERS --> SEND
  SPEAKERS[Referenten] --> TALKS[Themen und Vorträge]
  TALKS --> EVENT[Veranstaltung]
  SPONSORS[Sponsoren und Gastgeber] --> EVENT
  EVENT --> AGENDA[Agenda und Moderation]
  AGENDA --> CARDS[Moderationskarten: A5]
  EVENT --> REG[Anmeldungen und Gästeliste]
  REG --> LABELS[Namensetiketten: Avery L4785-20]
  REG --> CHECKIN[Einlass und Check-in]
  REG --> SEND
  EVENT --> SEND
  CHECKIN --> LIVE[Eventbereich: Agenda und Teilnehmer]
  LIVE --> CHAT[Gruppenchat und private Chats]
  LIVE --> PHOTOS[Event-Fotos und Upload]
  EVENT --> FEEDBACK[Gästebefragung]
  MEDIA[Medienbibliothek] --> TALKS
  MEDIA --> EDITORIAL[Redaktion: Presse, News und Rückblicke]
  EVENT --> EDITORIAL
  AI[KI-Redaktion] --> EDITORIAL
  EDITORIAL --> PUBLIC[Öffentliche Website]
  EVENT --> PUBLIC
```

Die Agenda wird im Event gepflegt. Moderationskarten verwenden diese Daten und speichern bearbeitete Karten im Event. Namensetiketten verwenden die vorhandenen Anmeldedaten, keine eigene Teilnehmerdatenbank.

## 3. Personen und Konten: Was gehört zusammen?

| Datensatz | Bedeutung | Verbindung |
|---|---|---|
| `members` | Mitglied bzw. Mitgliedsunternehmen mit Ansprechpersonen | Benutzerkonto kann über `memberId` zugeordnet werden |
| `users` | Persönliches Login, Rolle und Kontostatus | Mit Firebase-Auth-Konto verbunden; Mitglieds- oder Eventzugang |
| `contacts` | Mailingkontakt mit E-Mail und Personendaten | Wird für Empfängerauswahl und persönliche Ansprache verwendet |
| `registrations` | Anmeldung einer Person zu einer bestimmten Veranstaltung | `eventId` verbindet die Anmeldung mit dem Event |
| `speakers` | Referentenprofil mit Funktion, Unternehmen und Vita | Verknüpft mit Events und Themen/Vorträgen |
| `boardMembers` | Vorstandsdaten | Verwendet für Darstellung und zentralen Gruppen-Check-in |

```mermaid
flowchart LR
  MEMBER[(Mitglied)] -->|memberId| USER[(Benutzerkonto)]
  USER --> AUTH[Persönliches Auth-Konto]
  CONTACT[(Mailingkontakt)] -->|E-Mail-Abgleich| RESOLVE[Personenzuordnung]
  MEMBER --> RESOLVE
  USER --> RESOLVE
  SPEAKER[(Referent)] --> RESOLVE
  RESOLVE --> REG[(Eventanmeldung)]
  REG -->|eventId| EVENT[(Veranstaltung)]
  USER --> ROLE{Rolle und Berechtigung}
  ROLE --> MEMBERAREA[Mitgliederbereich]
  ROLE --> EVENTAREA[Freigeschalteter Eventbereich]
  ROLE --> CMS[CMS für Admin und Redaktion]
```

**Wichtig:** Ein Mailingkontakt, ein Login oder eine Eventanmeldung begründet keine Mitgliedschaft. Ein Referent kann zugleich Mitglied sein. Reine Gäste- und Referentenzugänge stehen im Reiter „Eventzugänge“; Mitglieder- und Verwaltungskonten stehen unter „Logins & Rollen“.

Ein E-Mail-Abgleich verbindet Daten, macht sie aber nicht automatisch zu einem einzigen Datensatz. Falsche Stammdaten können daher eine falsche Anrede verursachen. Leere Login-Namensfelder dürfen bestehende Namen nicht überschreiben.

## 4. Einladung, Anmeldung und Eventzugang

```mermaid
flowchart TB
  PLAN[Event anlegen und freischalten] --> INVITE[Einladung: Empfänger und Text auswählen]
  INVITE --> PREVIEW[Vorschau und Namensprüfung]
  PREVIEW --> QUEUE[Versand vorbereiten]
  QUEUE --> EMAIL[Einladung per E-Mail]
  EMAIL --> FORM[Eventanmeldung]
  FORM --> CONFIRM[Bestätigungsmail]
  CONFIRM --> VERIFIED[E-Mail bestätigen]
  VERIFIED --> REG[Bestätigte Anmeldung]
  REG --> CHECKIN[Einlass-QR oder zentraler Check-in]
  CHECKIN --> ACCESS[Berechtigter Eventzugang]
  ACCESS --> LIVE[Agenda, Teilnehmer, Chat und Event-Fotos]
  LOGIN[E-Mail im Login eingeben] --> LOOKUP{Konto und Passwort vorhanden?}
  LOOKUP -->|Ja| PASSWORD[Normaler Passwort-Login]
  LOOKUP -->|Nein, auf berechtigter Gästeliste| START[Startpasswort per E-Mail]
  PASSWORD --> ACCESS
  START --> ACCESS
```

Login und Check-in sind getrennte Zustände. Der serverseitige Berechtigungscheck entscheidet, welche Eventfunktionen geöffnet werden dürfen. Gäste bekommen Zugang zu ihrem freigeschalteten aktuellen Event. Ein vorhandenes Mitgliedskonto wird weiterverwendet.

## 5. Versandkette und Rückmeldungen

```mermaid
flowchart LR
  MANUAL[Event Versand im CMS] --> CHECK[Empfänger, Namen und Inhalt prüfen]
  AUTO[Geplante Event-Mitteilungen] --> CHECK
  GROUP[Zentraler Check-in: Vorstand und Referenten] --> JOB[(checkinWelcomeJobs)]
  JOB -->|ca. 15 Minuten vor Beginn| QUEUE[(mailQueue)]
  CHECK --> QUEUE
  QUEUE --> SMTP[SMTP-Versand]
  SMTP --> RESULT[Versandstatus oder Fehler]
  RESULT --> LOG[Mailing Queue und Event-Protokoll]
  SMTP --> INBOX[Empfänger-Mailserver]
  INBOX --> BOUNCE[Rückläufer]
  BOUNCE --> REPORT[(bounceReports)]
  REPORT --> SUPPRESS[Versandunterdrückung bei Rückläufern]
  CHECK --> SMS[(smsQueue)]
  CHECK --> PUSH[Push-Zustellung]
```

- Personalisierte Event-Mitteilungen werden gestoppt, wenn benötigte Namensfelder fehlen. Die Meldung nennt die betroffenen Empfänger.
- Testgruppen übernehmen ebenfalls die vorhandenen Namensdaten.
- Welcome-Mails für zentral eingecheckte Vorstandsmitglieder und Referenten werden etwa 15 Minuten vor Beginn freigegeben; bei späterem Check-in zeitnah.
- Die Event-Protokollübersicht verbindet Event-Mitteilungen mit automatischen Event-Mails aus `mailQueue`. Welcome-Mails erscheinen dort ab ihrer Versandfreigabe.
- „Gesendet“ bedeutet, dass der SMTP-Server die Mail angenommen hat. Das belegt keine Ablage im Posteingang; Spamfilter und Rückläufer liegen danach in der Zustellkette.

## 6. Wichtigste Datenspeicher

| Bereich | Daten |
|---|---|
| Veranstaltungsplanung | `events`, `topics`, `speakers`, `sponsors` |
| Personen und Rechte | `members`, `users`, `contacts`, `boardMembers` |
| Anmeldung und Einlass | `registrations`, `eventLiveAccess` |
| Eventkommunikation | `eventLiveConversations` mit Gruppen, privaten Threads und Nachrichten; `eventChatAttachments` |
| Teilnehmerfotos | `eventMedia` und Bilddateien in Storage |
| Redaktion und Medien | `editorialContent`, `media_assets`, `media_variants`, `galleries`, `galleryImages`, `memberDocuments` |
| Versand | `eventNotifications`, `mailQueue`, `smsQueue`, `checkinWelcomeJobs`, `bounceReports` |
| Befragung | `event_feedback`, `liveSurveys`, `liveSurveyResponses`, `liveSurveyInvites` |
| KI und Konfiguration | `aiDrafts`, `aiLogs`, `settings` und weitere fachbezogene Sammlungen |

## 7. Technische Zuordnung im Quellcode

| Baustein | Datei / Bereich | Aufgabe |
|---|---|---|
| Navigation und Interaktionen | `src/main.js` | Routing, Formulare, Dialoge, Aufruf der Dienste |
| CMS-Menü | `src/cms/cmsLayout.js` | Bereiche, Seitennavigation und Rahmen |
| CMS-Seiten | `src/cms/cmsPages.js` | Verwaltungsansichten und Listen |
| Datenzugriff | `src/firebase/dataService.js` | Lesen und Schreiben der gemeinsamen Daten |
| Anmeldung und Rollen | `src/firebase/authService.js` | Authentifizierung und Loginzustand |
| Eventanmeldung | `src/firebase/registrationService.js` | Anmeldung und Bestätigungsabläufe |
| Eventbereich | `src/firebase/eventLiveService.js`, `functions/eventLive*.js` | Eventzugang, Teilnehmer und Kommunikation |
| Fotos | `src/firebase/portalGalleryPhotoService.js` | Upload, Anzeige und Gelesen-Status |
| Versand | `src/firebase/notificationService.js`, `functions/index.js` | Vorschau, Empfängerauflösung und Mail-Queue |
| Welcome-Terminierung | `functions/checkinWelcomeSchedule.js` | Zeitgesteuerte Freigabe der Welcome-Mails |
| Rückläufer | `functions/bounceService.js`, `functions/mailingSuppression.js` | Rückläuferverarbeitung und Sperren |
| Moderationskarten / Etiketten | `src/utils/moderationCardPrint.js`, `src/utils/nameBadgePrint.js` | Vorschau, Druck und PDF |
| KI-Überarbeitung | `functions/openaiFunctions.js` | Serverseitige KI-Aufrufe, unter anderem Moderationstexte |
| Zugriffsschutz | `firestore.rules`, `storage.rules`, serverseitige Rollenprüfungen | Schutz der Daten und Dateien |
| Bereitstellung | `scripts/build.mjs`, `firebase.json` | Build und Firebase Hosting; Hosting leitet `/mail-api/` an den Mail-Service weiter |

## 8. Prüfpunkte bei Fehlern

1. **Falscher oder fehlender Name:** Mailingkontakt, Mitglied und Benutzerkonto vergleichen; danach Empfängerauflösung und Vorlagenfelder prüfen.
2. **Kein Eventzugang:** Loginrolle, Freischaltung, Eventstatus und passende Registrierung prüfen.
3. **Mail fehlt:** `mailQueue`, geplanten Versand, Fehlermeldungen, Rückläufer und Spamordner prüfen.
4. **Fotos fehlen:** Eventzuordnung, Berechtigung, Metadatensatz in `eventMedia` und Datei in Storage prüfen.
5. **Falsche Agenda oder Karten:** Verknüpfung von Event, Programmpunkt, Vortrag und Referenten sowie gespeicherte Karten prüfen.

Quelle: Aktuelle CMS-Navigation, Client-Dienste, Cloud Functions und Sicherheitsregeln im PROdigitalTV-Arbeitsverzeichnis. Keine Passwörter, Schlüssel oder personenbezogenen Beispieldaten enthalten.
