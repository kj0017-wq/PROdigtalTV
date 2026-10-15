# Persönliche Dokumentenpostfächer – Implementierung vom 14.10.2026

## Stand und Bedienung

Am **14.10.2026 produktiv veröffentlicht** auf [PROdigitalTV](https://prodigitaltv.de/#/portal?tab=my-documents).

Hosting-Version: `sites/prodigitaltv/versions/5bf7cbce7bb01e9a`. Alle zwölf veröffentlichten Dateien stimmen per SHA-256 mit dem geprüften Hosting-Overlay überein. Die 14 ausgewählten Functions sind `ACTIVE`; der Hintergrundjob läuft alle 15 Minuten mit Zeitzone Europe/Berlin. Beide TTL-Policies sind `ACTIVE`.

Der echte Live-Test mit drei isolierten Auth-Konten und zwei für Benachrichtigungen gesperrten Testmitgliedern hat Upload, Mehrfachzustellung, Abrufbestätigung, unveränderlichen ersten Abrufzeitpunkt, unabhängige Empfängerstatus, gesperrte Fremdzugriffe, private Storage-Objekte und fehlgeschlagene Dateiübertragung geprüft. Alle Testkonten, Testmitglieder, Testdateien und zugehörigen Testprotokolle wurden anschließend entfernt; es wurde kein echtes Mitglied benachrichtigt.

Die Live-Prüfung deckte einen Altbestandsfall auf: Ein optionales `membershipAccessStatus`-Feld kann fehlen. Die neue Postfach-Regel behandelt dies nun konsistent zur serverseitigen Mitgliedsprüfung. Tatsächlich gesperrte Mitgliedschaften bleiben ausgeschlossen. Die Regeln bestehen jetzt 22 Firestore- und vier Storage-Zugriffsprüfungen.

Auch die tatsächlich veröffentlichte mobile Seite wurde im Browser ohne JavaScript-Fehler geladen. Die vorhandene Push-Abfrage beim Erststart bleibt erhalten. Browser-CORS für Upload und Download sowie anonyme Zugriffssperren wurden live geprüft.

Administration: **Kommunikation → Postfächer** (`/cms.html#/cms/mailboxes`). Drei Bereiche: Übersicht, Dokument zustellen, Protokoll. Titel, Datei, optionaler Hinweis und einzelne/mehrere/alle aktiven Mitglieder auswählen, anschließend zustellen. Der Upload zeigt Fortschritt. Das Protokoll lässt sich nach Mitglied, Dokument und Status filtern sowie als CSV exportieren. Das Postfach eines Mitglieds lässt sich administrativ ansehen; eine solche Vorschau setzt dessen Abrufstatus nicht.

Mitglieder: Briefumschlag im Header → `#/mailbox`. Neue Dokumente werden hervorgehoben. Öffnen und Herunterladen sind möglich; bereits abgerufene Unterlagen bleiben verfügbar. Die mobile Ansicht verwendet Dokumentkarten. Auch die eigenständigen mobilen Cockpit-Ansichten erhalten einen Postfachlink.

Ein Postfach besteht aus den Zustellungen zur bestehenden Mitglieds-ID. Deshalb braucht ein neues Mitglied weder einen zusätzlichen Datensatz zur Postfachanlage noch ein neues Konto. Die bestehende `users.memberId`-Zuordnung wird verwendet; fehlt sie, kann eine verifizierte Anmelde-E-Mail über den vorhandenen Mitgliederabgleich zugeordnet werden. Inaktive Mitglieder erhalten entsprechend der bestehenden Mitgliedsberechtigung keinen Zugriff.

Erlaubte Dateien: PDF, DOCX, XLSX, TXT, CSV, PNG und JPG bis 20 MiB. Pro Zustellung sind bis zu 2.000 Empfänger vorgesehen. Bei „Alle“ wird die aktuelle aktive Mitgliederliste serverseitig bestimmt. Die Datei wird je Dokument genau einmal gespeichert.

## Ergänzung: Meine Dokumente im Mitgliederprofil

Im Mitgliederprofil gibt es den zusätzlichen Bereich **Meine Dokumente** (`#/portal?tab=my-documents`). Er ist über die Profilnavigation und direkt unter „Mein Profil“ erreichbar. Auf Mobilgeräten stehen sowohl der Bereichswähler als auch ein sichtbarer Menülink mit roter Bubble zur Verfügung; am Desktop erscheint die Bubble am entsprechenden Profilreiter.

Der Profilbereich verwendet dieselbe persönliche Postfachkomponente wie der Briefumschlag im Header. Beide Ansichten laden dieselben `mailboxDeliveries` über dieselben autorisierten Serverfunktionen. Öffnen/Herunterladen, Dateiprüfung und dauerhafte erste Abrufbestätigung werden gemeinsam verwendet. Es werden keine zusätzlichen Dateien, Zustellungen oder Statusfelder angelegt. Alle Zähler hängen am bereits vorhandenen einzigen Firestore-Listener; die bisherigen Sicherheitsregeln bleiben gültig.

Die Browserprüfung umfasst jetzt zusätzlich die tatsächliche Profilfunktion mit kontrollierten Daten: Menü und mobiler Bereichswähler, wiederverwendete Dokumentansicht, Abruf aus dem Profil, anschließender Wechsel zum eigenständigen Postfach und zurück, identischer Status sowie gleichzeitige Aktualisierung aller Profil-/Header-Zähler. Dabei bleibt genau ein Listener aktiv.

## Vorhandene Architektur und geänderte Komponenten

Wiederverwendet werden Firebase Authentication, Firestore, der vorhandene Storage-Bucket `prodigitaltv-da47b.firebasestorage.app`, die Mitglieds-ID und Rollen aus `users`/`members`, vorhandene CMS-/Website-Layouts und der bereits eingerichtete ElevenLabs-Vorlesedienst. Es gibt keine zusätzliche Anmeldung, keine neue Sprachschnittstelle und keine neuen Paketabhängigkeiten.

- `functions/documentMailbox.js`: Mitglieds-/Administrationsprüfung, Upload, Zustellungen, Abrufbestätigungen, Protokoll und nachvollziehbares Zurückziehen.
- `functions/documentMailboxHttp.js`: authentifizierte Dateiübertragung, vollständiger Transferabschluss, private HTTP-Header und Fehlerbehandlung.
- `functions/index.js`: Registrierung der neuen Firebase Functions.
- `functions/audioServiceFunctions.js`: kurze Benachrichtigung mit der bestehenden Stimme; privat zwischengespeichert.
- `src/utils/documentMailbox.js`: Header-Symbol, Live-Zähler, Login-Hinweis, Audiofreigabe und geprüfter Dateitransfer.
- `src/pages/mailboxPage.js`: Verwaltungsoberfläche, persönliches Postfach, Filter und CSV-Export.
- `src/main.js`, `src/cms/cmsLayout.js`, `src/components/layout.js`: Routen, Navigation und Header-Anbindung.
- `src/styles/main.css`: Gestaltung einschließlich mobiler Dokumentkarten.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`: private Daten, serverseitige Schreibrechte und TTL für kurzlebige Transferbestätigungen.
- HTML-Einstiegspunkte und `public/sw.js`: neue Cache-Versionen.

## Daten und technische Nachvollziehbarkeit

| Ablage | Zweck |
| --- | --- |
| `mailboxDocuments/{documentId}` | Zentraler Dokumenteintrag mit Titel, Hinweis, privatem Storage-Pfad, Dateigröße, SHA-256 und Empfängerauswahl |
| `mailboxDeliveries/{deliveryId}` | Je Mitglied/Dokument eigener Zustellungsdatensatz mit Name, Mitglieds-ID, Bereitstellungszeit, erstem Abruf und Status |
| `mailboxAudit/{eventId}` | Unveränderte Ereignisse für Zustellung, ersten Abruf und administratives Zurückziehen samt handelnder Benutzer-ID |
| `mailboxFetchReceipts/{hash}` | Kurzlebige, benutzergebundene technische Transferbestätigung |
| `mailbox-private/{documentId}/…` | Ein privates Dateiobjekt je Dokument, ohne Firebase-Download-Token |

Zustellungs-IDs sind pro Mitglied/Dokument deterministisch. Wiederholte oder parallele Zustellungsaufrufe erzeugen keine doppelten Zustellungen. Größere Empfängerlisten werden in Transaktionen mit jeweils höchstens 150 Empfängern verarbeitet. Ein unterbrochener Lauf kann über „Zustellung fortsetzen“ abgeschlossen werden. Wird ein ausgewähltes Mitglied zwischen Vorbereitung und Zustellung inaktiv, bricht der betreffende Teil mit einer Fehlermeldung ab; bereits erfolgte Zustellungen bleiben nachvollziehbar. Die Administration kann den Lauf nach Klärung fortsetzen oder das Dokument zurückziehen.

Alle Ereigniszeitpunkte entstehen serverseitig. Der erste Abruf wird atomar nur einmal gespeichert. Folgende Schritte zählen ausdrücklich **nicht** als Abruf: Login, Anzeige des Postfachs, Listenabfrage, bloßer Klick und Vorschau durch die Administration in einem fremden Postfach.

Der Dateiserver prüft Berechtigung, Verfügbarkeit, Größe und SHA-256. Nur nach erfolgreichem HTTP-Transferabschluss wird die zugehörige Transferbestätigung freigeschaltet. Der Browser prüft zusätzlich die vollständig empfangenen Bytes und ihre SHA-256-Prüfsumme. Erst danach wird die benutzergebundene Bestätigung serverseitig verbucht. Abgebrochene, fehlgeschlagene oder beschädigte Transfers erhalten keinen Abrufstatus. Falls die Datei übertragen wurde, die anschließende Bestätigung aber nicht gespeichert werden konnte, zeigt die Oberfläche dies an; das Dokument bleibt vorsorglich offen und kann erneut abgerufen werden.

Die Zeiten im CSV stehen im ISO-/UTC-Format; die Oberfläche verwendet die lokale Zeitzone des Browsers. CSV enthält Dokumenten-ID, Titel, Mitglieds-ID, Empfängername, Bereitstellung, ersten Abruf und Status. Formelausführung durch entsprechend beginnende Zellinhalte wird verhindert.

Das Protokoll ist ein **technischer Nachweis über Bereitstellung und Abruf**. Es beweist weder eine inhaltliche Kenntnisnahme noch automatisch einen rechtssicheren Zugang.

## Login, Live-Zähler und Sprache

Ein Firestore-Listener beobachtet ausschließlich die Zustellungen des angemeldeten Mitglieds. Offene Dokumente zählen zur roten Bubble; nach einem bestätigten Abruf oder einer serverseitigen Änderung aktualisiert sie sich auch auf weiteren angemeldeten Geräten. Bei null verschwindet nur die Bubble.

Die erste Liste je Anmeldung wird anhand der Firebase-Authentifizierungszeit und eines Sitzungsmerkers geprüft. Bei neuer Post erscheint der anklickbare Hinweis „Sie haben Post!“. Die bestehende ElevenLabs-Konfiguration erzeugt denselben Satz mit der vorhandenen Stimme. Bei deaktiviertem Anbieter oder Stummschaltung bleibt es beim visuellen Hinweis. Eine Browser-Sperre wird durch Nachholen bei der ersten erlaubten Pointer-/Tastaturinteraktion behandelt. Normale Seitenwechsel lösen keine erneute Ansage aus. Ein Browser ohne verfügbare Audiowiedergabe kann keine Sprachansage garantieren.

## Zugriff und Aufbewahrung

Dateien sind über Firebase Storage Rules für sämtliche direkten Client-Lese- und Schreibzugriffe gesperrt. Upload und Download erfolgen über POST-Endpunkte mit geprüftem Firebase-ID-Token und anschließender serverseitiger Rollen-/Mitgliedsprüfung. Dateien werden mit privater Objekt-ACL und ohne Download-Token gespeichert. Dateiantworten verwenden `private, no-store`; Dateiinhalte werden nicht in den PWA-Cache geschrieben. Bei der Prüfung des vorhandenen Buckets wurden weder öffentliche IAM-Leserollen noch öffentliche Standard-Objekt-ACLs festgestellt.

Mitglieder können nur eigene Zustellungen lesen. Dokumentmetadaten und Auditereignisse sind ausschließlich administrativ lesbar. Zustellungen, Auditereignisse und Transferbestätigungen sind für direkte Client-Schreibzugriffe gesperrt, einschließlich solcher durch Administratoren. Verwaltungsaktionen laufen über die geprüften Serverfunktionen und protokollieren die handelnde Benutzer-ID.

„Dokument zurückziehen“ sperrt die Datei und entfernt sie aus den verfügbaren Mitgliederdokumenten. Die Begründung und ursprünglichen Ereignisse bleiben erhalten. Unterbrochene Rücknahmen können erneut ausgeführt werden, ohne ursprüngliche Ereignisse zu überschreiben.

Für Dokumente und dauerhafte Protokolle wurde im vorhandenen CMS keine allgemeine, bestätigte Aufbewahrungsfrist gefunden. Die versammlungsspezifischen Fristen wurden deshalb nicht pauschal übernommen. Es wurde keine willkürliche automatische Löschfrist für Mitgliederdokumente eingeführt. Physische Löschung/Anonymisierung ist nach der jeweils verbindlichen bestehenden Datenschutz- und Aufbewahrungsvorgabe administrativ durchzuführen; ein verbindlicher allgemeiner Löschlauf ist damit noch nicht eingerichtet.

Nur die kurzlebigen technischen Transferbestätigungen verfallen für die Bestätigung bereits nach 15 Minuten. `deleteAfter` liegt bei 24 Stunden und wird mit der im Index-Manifest enthaltenen TTL-Policy automatisch bereinigt. Dies betrifft keine Zustellungs- oder Abrufereignisse; Die entsprechende TTL-Policy ist produktiv aktiviert.

## E-Mail und Push: höchstens einmal pro Tag

Neue Zustellungen lösen automatisch einen allgemeinen Hinweis „Sie haben Post!“ per E-Mail und über den vorhandenen Browser-Push-Dienst aus. Beide Hinweise führen zu „Mein Profil → Meine Dokumente“. E-Mail und Push enthalten weder Dokumentanhänge noch Titel oder öffentliche Dateilinks. Push verwendet ausschließlich die bereits freigegebenen, aktiven Geräte des bestehenden Push-Dienstes.

Die Grenze gilt **je Mitglied und Kanal pro Kalendertag in Europe/Berlin**, einschließlich Sommer-/Winterzeit. Eine weitere Zustellung am selben Tag erzeugt keinen zweiten Hinweis. Noch offene zusätzliche Zustellungen werden beim nächsten Tageswechsel durch den alle 15 Minuten laufenden Hintergrundprozess berücksichtigt. Bereits gemeldete alte Dokumente erzeugen ohne weitere Zustellung keine täglichen Erinnerungen.

Verwendet wird eine einzelne persönliche Kontaktadresse aus dem vorhandenen Mitgliedsdatensatz. Bestehende Ausschlüsse werden berücksichtigt. Fehlt eine Kontaktadresse, kann die Adresse eines aktiven verknüpften CMS-Kontos verwendet werden. Rechnungsadressen werden nicht automatisch als persönliche Benachrichtigungsadresse verwendet. Ohne geeignete Adresse erfolgt kein Versand; Push ohne vorhandene Gerätefreigabe wird als nicht verfügbar protokolliert, die E-Mail bleibt davon unabhängig.

Die E-Mail landet in der bestehenden `mailQueue` als `mailbox_documents`. Der vorhandene Handler `sendQueuedMail` prüft unmittelbar vor dem Versand erneut Mitgliedsstatus, aktuelle Kontaktadresse, vorhandene offene Dokumente und den tatsächlichen Versandtag. Das verhindert auch bei verzögerten Warteschlangen und mehrfach gelieferten Triggerereignissen einen zweiten Versandversuch pro Tag. Ein Abruf vor dem Mailversand kann den Hinweis entfallen lassen. Der Push-Kanal prüft dieselben grundsätzlichen Verfügbarkeiten.

Die täglichen Sperren werden vor dem jeweiligen externen Versand atomar gesetzt. Mehrdeutige Providerfehler führen deshalb nicht zu automatischen Wiederholungen am selben Tag. Ausfälle stehen in den vorhandenen Mailstatusfeldern beziehungsweise in den Push-Statusfeldern des Tagesdatensatzes. Der Versand kann nicht als Bestätigung des Dokumentenabrufs gelten und verändert keine Abrufzeitpunkte.

Zusätzliche Dateien/Funktionen:

- `functions/documentMailboxNotifications.js`: tägliche Bündelung, Kanal-Sperren und Versandprüfung.
- `notifyNewMailboxDocuments`: Firestore-Auslöser für neue Zustellungen.
- `processMailboxDocumentNotifications`: Hintergrundprüfung alle 15 Minuten und Wiederaufnahme noch nicht gestarteter Push-Aufträge.
- `sendQueuedMail`: bestehender Handler, um Formatierung und atomare Versandfreigabe für Postfachhinweise erweitert.
- `mailboxNotificationState/{memberId}`: kompakter Stand der bereits berücksichtigten Zustellungen.
- `mailboxNotificationDays/{hash}`: tägliche Kanal-Sperren und technische Versandstatus; administrativ lesbar, nicht vom Browser veränderbar.

Die Tagesdatensätze sind reine technische Benachrichtigungsdaten. Ihr `deleteAfter` liegt bei 30 Tagen; die zugehörige TTL-Policy ist in `firestore.indexes.json` enthalten. Die Dokumente und dauerhaften Zustellungs-/Abrufereignisse werden dadurch nicht gelöscht.

Für diese Ergänzung müssen die zwei neuen Functions, der aktualisierte `sendQueuedMail`-Handler, die Firestore-Regeln und die zusätzliche TTL-Feldkonfiguration veröffentlicht werden. Die bestehende SMTP-Konfiguration und Firebase Messaging werden weiterverwendet. Es sind keine zusätzlichen SMTP- oder Push-Anbieter erforderlich.

`node scripts/testMailboxNotifications.cjs` prüft ohne echten Versand: parallele Auslöser, je Kanal nur einen Versand pro Tag, tatsächlichen Mail-Handler bei doppelten Ereignissen, zusätzliche Dokumente am Folgetag, gleiche Zeitstempel, Abruf/Rücknahme/Inaktivität vor dem Versand, Kontakt- und Kontoadressen, fehlende Push-Geräte, Providerfehler, Adressänderungen, verzögerte Warteschlangen und Berliner Tagesgrenzen einschließlich Zeitumstellung. Die Rules-Prüfung umfasst zusätzlich sechs Zugriffsprüfungen für die Benachrichtigungsdaten.

## Veröffentlichung und Firebase-Konfiguration

Erforderlich sind gemeinsam passende Functions, Firestore-/Storage-Regeln, die TTL-Feldkonfiguration und Hosting-Dateien. Nur ein Hosting-Update reicht nicht.

Neue Functions, Region `europe-west3`:

- `mailboxSelf`, `listMailboxDocuments`, `mailboxAdminData`, `mailboxProtocol`
- `beginMailboxDocument`, `deliverMailboxDocument`, `withdrawMailboxDocument`
- `mailboxUpload`, `mailboxFile`, `acknowledgeMailboxDocument`
- `getMailboxAnnouncement`

Das vorhandene Secret `ELEVENLABS_API_KEY` und die aktivierte bestehende `settings/audioProviders.elevenlabs`-Konfiguration werden weiterverwendet. Für reine Dokumentzustellungen ist keine Voice-Konfiguration erforderlich.

`firestore.indexes.json` enthält das Feld-Override für Collection Group `mailboxFetchReceipts`, Feld `deleteAfter`, `ttl: true`. Die Feldkonfiguration wurde beim Rollout gezielt veröffentlicht, ohne andere Indizes zu verändern. Zusätzliche zusammengesetzte Postfach-Indizes sind nicht erforderlich.

Die Umsetzung verwendet die aktuell geprüfte Bucket-Konfiguration mit Objekt-ACLs. Sollte der Bucket später auf Uniform Bucket-Level Access umgestellt werden, muss die Upload-Option `predefinedAcl` entsprechend angepasst werden; ein solcher Wechsel ist nicht Bestandteil dieser Änderung.

Beim Hosting-Rollout ist der bestehende Release-/Overlay-Prozess zu beachten: Der Workspace enthält weitere, nicht zu dieser Funktion gehörende Änderungen. Kein ungeprüftes vollständiges Veröffentlichen des gesamten Arbeitsstands.

Echte Anmeldung, Zustellung an isolierte Testmitglieder und Dateiabruf sind live geprüft. Eine zusätzliche Prüfung der Sprachwiedergabe und der Push-Zustellung auf den tatsächlich verwendeten physischen Mobilgeräten bleibt geräteabhängig; während der Prüfung gingen keine Benachrichtigungen an echte Mitglieder.

## Durchgeführte Prüfungen

- `node scripts/testDocumentMailbox.cjs`: Authentifizierung, verifizierte Mitgliedszuordnung, automatisch leeres Postfach, Adminrechte, Dateivalidierung, einzelne/mehrere/alle Empfänger, 162 Empfänger über Transaktionsgrenzen, parallele Wiederholung ohne Duplikate, eine gespeicherte Datei je Dokument, fremde Postfächer gesperrt, administrative Vorschau, Transferbestätigungen, zeitlich erster Abruf bei Parallelität, beschädigte/abgelaufene Abrufe, Rücknahme und Wiederaufnahme nach simuliertem Fehler, HTTP-Abbruch.
- `node scripts/testDocumentMailboxUi.cjs`: Browserprüfung mit kontrollierten Firebase-/Transfer-Testdaten in Edge, Mobilbreite 390 px und Desktopbreite 1440 px. Header/Bubble, Login-Hinweis, Audio-Sperre und Benutzerinteraktion, einmalige Ansage, Stummschaltung, Anmeldung ohne neue Post, Dokumentkarten, fehlgeschlagene/verkürzte/erfolgreiche Downloads, Geräteänderung per Live-Snapshot, Empfängersuche, geschützter Upload mit Fortschritt, Filter und CSV-Export.
- `node scripts/testMailboxRules.cjs`: echter Firebase-Rules-Compiler mit synthetischen Daten über die reine Test-API, **ohne Veröffentlichung**. Firestore: 22 Zugriffsprüfungen; Storage: 4 direkte Zugriffsprüfungen. Alle bestanden. API: [Firebase Rules Test](https://firebase.google.com/docs/reference/rules/rest/v1/projects/test)
- Firebase-Functions-Modul geladen: alle elf neuen Endpunkte werden erkannt.
- Bestehende Gästeversand-Prüfung: 8 Tests bestanden. Bestehender Excel-Fortschritts-/Downloadtest erfolgreich; ein anfänglicher Timeout unter paralleler Browserlast ließ sich bei separater Wiederholung nicht reproduzieren.
- Syntaxprüfung und Anwendung-Build erfolgreich.

Die lokalen Backend-/Browserprüfungen wurden durch die oben beschriebene Live-Abnahme ergänzt. Echte Browser-Autoplay-Regeln und die vorhandene Providerstimme wurden nicht durch einen produktiven Versand an Mitglieder getestet.

## Homescreen-App-Symbol (14.10.2026)

Die installierte WebApp setzt die Zahl am App-Symbol über die Badging API auf die Anzahl noch nicht abgerufener Dokumente. Bei null und beim Abmelden wird das Badge gelöscht. Die bestehende tägliche Postfach-Pushnachricht trägt `badgeCount` und aktualisiert das Symbol über den bereits vorhandenen Service Worker. Die Tagesbegrenzung für E-Mail und Push bleibt bestehen; es werden keine zusätzlichen stillen Pushnachrichten erzeugt. Ohne laufende App wird die Zahl beim nächsten zugestellten Tageshinweis aktualisiert, beim Öffnen und Abrufen über den bestehenden Firestore-Livestatus. Geräteübergreifende Aktualisierungen setzen eine laufende App oder eine empfangene Pushnachricht voraus.

Auf iOS/iPadOS ist eine zum Homescreen hinzugefügte WebApp mit erlaubten Mitteilungen und aktivierten Kennzeichen erforderlich. Unterstützung und Darstellung hängen vom Betriebssystem ab. Fehler oder eine fehlende Badging API beeinträchtigen die Postfachfunktionen nicht. Die Anzahl und das Löschen sowie die Push-Daten wurden mit isolierten API-/Transportprüfungen getestet; eine reale iPhone-Anzeige wurde nicht simuliert.
