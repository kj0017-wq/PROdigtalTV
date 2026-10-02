# Wiederhergestellter Hosting-Stand

Am 29.09.2026 wurde die veröffentlichte Website lokal wiederhergestellt.

- Firebase-Projekt: `prodigitaltv-da47b`
- Hosting-Site: `prodigitaltv`
- Veröffentlichte Version: `805e67db989ad593`
- 231 öffentliche Dateien übernommen bzw. abgeglichen; Firebase-Systemdateien unter `/__/` ausgenommen.
- 34 lokale Dateien wiederhergestellt oder ergänzt.
- Vorherige Inhalte aller überschriebenen Dateien: `backups/published-recovery-805e67db989ad593/before/`.
- Heruntergeladene Veröffentlichung: `backups/published-recovery-805e67db989ad593/published/`.
- Einzeldateien und Prüfsummen: `backups/published-recovery-805e67db989ad593/report.json`.

`npm run build` verwendet den wiederhergestellten öffentlichen Snapshot aus `public/public-snapshot.json` und die bereits eingebetteten Startdaten. Es findet dabei kein Firestore-Zugriff statt. Eine bewusste Neuerstellung des Snapshots ist mit `node scripts/build.mjs --refresh-public-snapshot` möglich; sie greift auf Firestore zu und wurde bei dieser Wiederherstellung nicht ausgeführt.

## Prüfung

- Build erfolgreich.
- Alle 231 Build-Dateien bytegenau identisch mit der heruntergeladenen Veröffentlichung; keine zusätzlichen Dateien.
- Syntaxprüfung von 65 JavaScript-Dateien bestanden; alle erkannten relativen Modulimporte vorhanden.
- Neun Tests für Event-Zeitfenster, eventbezogene Gruppenposts, Wiederholungsversand, Nachrichtenbilder und CMS-Mailfehler bestanden.

Es wurde bei dieser Wiederherstellung nichts veröffentlicht. Die Prüfung betrifft ausschließlich die Website/Hosting-Dateien. Cloud-Functions-Quellcode, Firestore-/Storage-Regeln und andere Serverkonfigurationen wurden nicht aus Hosting rekonstruiert und nicht als vollständiger Deploy geprüft. Der vorhandene lokale Stand dieser Bereiche blieb erhalten.

Für eine spätere Veröffentlichung dieses geprüften Website-Stands ist das Ziel ausschließlich `hosting:prodigitaltv`. Das ältere Skript `deployEventGroupOverlay.cjs` ist an die frühere Ausgangsversion gebunden und wird für diesen wiederhergestellten Stand nicht benötigt.
