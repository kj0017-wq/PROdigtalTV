# PROdigitalTV aktueller Codex-Kontext

Stand: 2026-06-15

## Projekt

- Workspace: `D:\Dropbox\Dropbox\VBA\PROdigitalTV - Gaestelistenanalyse\Neue webseite\prodigitaltv_firebase_project_v2\prodigitaltv_firebase_project_v2`
- Firebase-Projekt: `prodigitaltv-da47b`
- Live-URL: https://prodigitaltv-da47b.web.app
- Lokale Vorschau: http://127.0.0.1:4173

## Letzter Deploy

- Ausgefuehrt am 2026-06-15.
- Befehl: `firebase deploy --project prodigitaltv-da47b`
- Ergebnis: erfolgreich.
- Deploy umfasste Hosting, Functions, Firestore-Regeln/Indexes und Storage-Regeln.
- Vor Deploy erfolgreich gebaut mit `npm.cmd run build`.

## Wichtige aktuelle Aenderungen

- Mobile Startgeschwindigkeit verbessert:
  - Public-Firestore liest jetzt zunaechst nur `firebase-app` und `firebase-firestore`.
  - Auth, Storage und Functions werden erst bei CMS/Login/Upload/KI-Funktionen geladen.
  - Public-Listen haben einen kurzen Cache von 45 Sekunden.
  - Mobile Home laedt initial keine Mitglieder- und Medienasset-Listen mehr.
  - Karten-, News- und Archivbilder nutzen `loading="lazy"` und `decoding="async"`.

- Audio/Vorlesen:
  - Frontend nutzt fuer den Player nur noch vorhandene ElevenLabs-Audios.
  - Player hat zwei Icons: Play/Pause und grosser Text; auf Mobile bleibt nur Play/Pause.
  - Beim Verlassen der Seite stoppt Audio.
  - Es kann nur eine Audio-Datei gleichzeitig laufen.
  - Karaoke/Markierung beruecksichtigt Headline, Subline und Fliesstext.
  - Normales Vorlesen markiert dezent den Originaltext und scrollt nach.

- CMS/Audio:
  - Audio-Liste wurde nach Bereichen/Rubriken ueberarbeitet.
  - News, Themen, Rueckblicke, Presse und Interna wurden getrennt bzw. besser zugeordnet.
  - Redakteur kann Audio in relevanten Listen/Editoren direkter erzeugen.

- News/Rueckblicke/Medien:
  - Newsseite: erste 6 Kacheln bleiben gross, danach Listenansicht.
  - Rubrik-Klick filtert nach Kategorie, mehrere Rubriken werden beruecksichtigt.
  - Rueckblicke und Presse getrennt.
  - GEMA/Suno-Artikel wurde wieder in die Redaktion uebernommen.
  - Veraltete Demo-/Fallback-Bilder wurden an mehreren Stellen ersetzt oder blockiert.

## Bekannte Hinweise

- Firebase Deploy meldet Warnungen:
  - Cloud Functions Node.js 20 ist deprecated und wird am 2026-10-30 decommissioned.
  - `firebase-functions` ist veraltet.
- Das ist aktuell nicht kaputt, sollte aber als Wartungspunkt eingeplant werden.

## Naechste sinnvolle Schritte

- Mobile Performance live auf echtem Smartphone pruefen.
- Functions Runtime und `firebase-functions` sauber aktualisieren.
- Falls die mobile Startseite noch zu langsam wirkt: Firestore-Abfragen fuer Home weiter auf gezielte Queries oder vorberechnete Public-Snapshots reduzieren.
