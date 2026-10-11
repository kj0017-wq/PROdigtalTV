# Präsentationen: Architektur und Betrieb

Die bestehende Sammlung `galleries` enthält weiterhin Bildergalerien und zusätzlich Datensätze mit `type: presentation`. Die vorhandene Sammlung `media_assets` enthält das originale Medium, seinen Galeriebezug und den Verarbeitungsstatus. Es entsteht keine zweite Medienverwaltung.

Beiträge, News, Themen und Events speichern `presentationIds` zusätzlich zu `galleryId`. Die bisherige Bildergalerie bleibt erhalten. Der vorhandene Galerie-Overlay lädt bei `type: presentation` das Manifest und verwendet Foliennavigation sowie Audio. Öffentliche und interne Freigaben werden vor der Ausgabe temporärer URLs geprüft.

Originale: `presentations/{galleryId}/original.pptx`. Ausgaben: `presentations/{galleryId}/processed/{processingRunId}/`. Folien enthalten Reihenfolge, Bildpfad, Audio-Tracks, Dauer, Sprechertext/Transkript und einen stabilen Folienbezeichner. Dies erlaubt spätere TTS- und Untertitel-Funktionen. Bestehende Audio-/ElevenLabs-Funktionen bleiben unabhängig.

Der Cloud-Run-Dienst verwendet LibreOffice (PDF-Zwischenformat), PyMuPDF/Pillow (WebP, maximal 2560 Pixel) und FFmpeg (MP3). Eingebettete Audios werden anhand ihrer Folien-Relationships zugeordnet. Sprechertexte werden gespeichert, aber ohne Audiodatei nicht als Ton ausgegeben. Animationen und interaktive PowerPoint-Effekte werden als statische Folien gerendert.

Verarbeitung ist asynchron zur Veröffentlichung des Beitrags, mit Status awaiting_upload / processing / ready / error. Das Original wird bei Fehlern erhalten. Erneute Verarbeitung ersetzt das Manifest erst nach vollständigem Erfolg. Veraltete parallele Verarbeitung wird durch Lauf-ID und zeitlich begrenzte Sperre abgewehrt. Maximal 80 MB PPTX, 200 Folien, 512 MB entpackte Daten.

Der Dienst benötigt Firestore-Zugriff, Objektzugriff nur auf dem privaten Bucket `prodigitaltv-da47b-presentations` und SignBlob auf dem eigenen Servicekonto. POST benötigt ein Firebase-Token eines CMS-Editors. Lesemanifeste benötigen die Freigabe published/public oder eine gültige Mitgliedschaft bzw. Redaktion. Originale und Ausgaben bleiben in Google Cloud Storage privat; der Player erhält zeitlich begrenzte URLs. Poster sind nur bei öffentlicher Freigabe abrufbar.

## Freigabe für den Betrieb

Die Bereitstellung wurde am 10.10.2026 vom Nutzer freigegeben. Es erstellt ausschließlich das Konto `presentation-worker@prodigitaltv-da47b.iam.gserviceaccount.com` und den Dienst `presentation-worker` in `europe-west3`.

Erforderliche Rechte:
- `roles/datastore.user` im Projekt: Datensätze in Firestore lesen und schreiben. Diese IAM-Rolle ist projektweit; die Anwendung begrenzt ihre Zugriffe auf Präsentationen, Medien, zugeordnete Beiträge und die Prüfung vorhandener Nutzerrollen.
- `roles/storage.objectUser` am getrennten privaten Präsentations-Bucket, mit Bedingung auf Objektpfade `presentations/`: Originale lesen und konvertierte Folien, Ton und Texte speichern. Keine Bucket-Administration.
- `roles/iam.serviceAccountTokenCreator` ausschließlich am eigenen Servicekonto: zeitlich begrenzte Datei-URLs signieren.
- Öffentliche HTTP-Erreichbarkeit des Cloud-Run-Dienstes. Schreibzugriffe erfordern weiterhin ein geprüftes Firebase-Token und eine CMS-Redaktionsrolle; private Lesemanifeste werden ebenfalls geprüft.

Betrieb: 2 CPUs, 2 GiB RAM, eine Verarbeitung je Instanz, maximal zwei Instanzen, keine Mindestinstanz, 600 Sekunden Anfragegrenze. Cloud Run, Storage und Verarbeitung verursachen nutzungsabhängige Kosten. Hosting wird anschließend gezielt ergänzt; die bisherigen Storage-Regeln bleiben unverändert; vorhandene CMS-Änderungen dürfen dabei nicht überschrieben werden.

## Prüfung vor Veröffentlichung (10.10.2026)

- Browser-Test: PC (1280×900), Smartphone (390×844), Querformat (844×390); Audio startet erst nach Benutzeraktion, Navigation per Tastatur/Swipe, Folienübersicht, automatischer Wechsel und Stopp am Ende, Schließen und Fokus-Rückgabe.
- CMS-Test: vorhandene Bildergalerie bleibt erhalten, zusätzliche Präsentationsauswahl und Upload, richtige Originaldatei-Ablage, Fehleranzeige, erneute Verarbeitung, Titel und Freigabe.
- Bestehende Bildergalerie: Pfeile, Tastatur, Pause und Schließen erfolgreich geprüft.
- Isolierter Container-Test mit realem LibreOffice und FFmpeg: drei Folien in abweichender tatsächlicher PPTX-Reihenfolge einschließlich ausgeblendeter Folie, eine eingebettete Audiospur, Sprechertexte, WebP-Ausgabe, Zugriffsschutz, Original-Erhalt bei Fehler und erfolgreicher Wiederholung. Keine Produktionsdatensätze wurden dafür verändert.

Dienst und Hosting wurden nach Nutzerfreigabe veröffentlicht. Der abschließende echte Upload-, Konvertierungs- und Browser-Test war erfolgreich.

## Private Ablage und Upload

Der bestehende Medien-Bucket erlaubt keine IAM-Bedingungen auf Ordner ohne eine Umstellung seiner gesamten Zugriffsverwaltung. Deshalb liegen ausschließlich Präsentationsdateien im neuen privaten Bucket `prodigitaltv-da47b-presentations`, mit einheitlichen Bucket-Rechten und gesperrtem öffentlichem Zugriff. Der Dienst darf dort nur Objekte unter `presentations/` lesen/schreiben. Original-Uploads verwenden einen signierten PUT-Link (10 Minuten), der nur nach Redaktionsanmeldung ausgegeben wird. CORS erlaubt die vorhandenen PROdigitalTV-Domains. Damit bleiben alle bisherigen Storage-Regeln und Medienrechte erhalten. Diese getrennte Dateiablage bildet keine zweite Medienverwaltung: sämtliche Metadaten, Zuordnungen und Bedienoberflächen verwenden weiterhin die vorhandenen CMS-Sammlungen.

## Veröffentlichung

Am 10.10.2026 auf beiden bisherigen Hosting-Sites gezielt veröffentlicht:
- `prodigitaltv`: Version `306c494341f26c6c`
- `prodigitaltv-da47b`: Version `90a8bceaeb33b3b2`
- Produktionsdomain: `https://prodigitaltv.de`
- Dienst: `https://presentation-worker-769486150443.europe-west3.run.app`, Revision `presentation-worker-00003-25z`

Geprüft gegen den echten Dienst: Anmeldung, privater Original-Upload, tatsächliche PPTX-Konvertierung, Bild-/Audio-Downloads, Sprechertexte, unveränderter Originaldatei-Hash, private/öffentliche Freigaben. Zusätzlich im echten CMS-Browser: Medienbibliothek, Präsentationseditor, Overlay, mobile Darstellung, echte Audiowiedergabe, Tastaturnavigation und Schließen. Temporäre Testdateien und Konten wurden nach jedem Lauf entfernt; es wurden keine Mails verschickt. Die vorhandenen Storage-Regeln bleiben unverändert.

Auch der originale CMS-Upload-Button wurde am 10.10.2026 gegen die Produktionsdomain geprüft: echter Browser-PUT einschließlich CORS, Dateikonvertierung und Status „Bereit“. Zwei temporäre Präsentationen und das Testkonto wurden nach Behebung eines Fehlers im Test-Aufräumskript vollständig entfernt. Die Produktivfunktion war von diesem Testskriptfehler nicht betroffen.
