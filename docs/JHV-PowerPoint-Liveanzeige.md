# PowerPoint und Liveergebnisse

Die bestehende PowerPoint bleibt das Präsentationsmedium. Der Export aus dem Modul erzeugt Beschluss-/Ergebnisfolien und Sprechernotizen. Jede Folie enthält einen Link zur Liveansicht. Der Export ist ein Snapshot, kein selbstaktualisierendes PowerPoint-Dokument.

## Verlässlicher Anzeigeweg
1. Leitungsdashboard in einem privaten Browserfenster öffnen.
2. Präsentationsansicht aus dem Dashboard in einem zweiten Fenster starten, auf den Projektor legen und maximieren. Sie lädt ausschließlich aggregierte Daten alle zwei Sekunden.
3. Mit der Auswahl „Aktueller TOP“, „Beschlussfähigkeit“, „Stimmrechtsübertragungen“ oder „Alle Beschlüsse“ die Ausgabe steuern. Die Leitung bestimmt den aktuellen TOP im Dashboard.
4. Von PowerPoint per Link oder Alt+Tab in dieses Fenster wechseln. Für den Zugriff über den exportierten stabilen Link muss die Leitung im selben Browser bei PROdigitalTV angemeldet sein.
5. Alternativ erstellt die Leitung einen 12 Stunden gültigen Anzeigezugang. Der neue Zugang ersetzt den vorherigen. Dieser Zugang enthält keine Einzelstimmen, Anwesenheitsnamen oder Sprechernotizen.
6. Referententexte und Hinweise bleiben in der separaten autorisierten Moderationsansicht. Dynamische Platzhalter werden nach Ergebnisfeststellung ersetzt.

## Authentifizierte Windows-API
GET https://europe-west3-prodigitaltv-da47b.cloudfunctions.net/assemblyApi?assemblyId=VERSAMMLUNGS_ID
Header: Authorization: Bearer FIREBASE_ID_TOKEN
Optional: &format=text

Der Server validiert das Firebase-ID-Token inklusive Widerruf und prüft die Leitungsrolle. Die Antwort ist ein Aggregat; keine Einzelstimmen und keine Sprechernotizen. Kein dauerhafter Schlüssel gehört in eine PPTX/PPTM-Datei. ID-Tokens müssen im angemeldeten Client erneuert werden.

Das Beispiel `JHV-Live.bas` aktualisiert ein bewusst benanntes Textfeld `JHV_LIVE` auf der gerade angezeigten Folie. Es benutzt ein kurzlebiges, über die lokale Umgebung übergebenes Token. Das ist eine optionale Windows-VBA-Anbindung mit manueller Aktualisierung, keine automatische Zeitsteuerung. Makros benötigen eine PPTM und die zulässigen lokalen Office-Sicherheitseinstellungen. Der konkrete Windows-PowerPoint-Betrieb und der sichere interaktive Tokenbezug müssen auf dem Präsentationsrechner geprüft werden; diese Prüfung wurde hier nicht behauptet.

Die browserbasierte Liveanzeige benötigt weder VBA noch eine veränderte Office-Makrosicherheit und ist der implementierte Standardweg.

Offizielle Microsoft-Dokumentation zur verwendeten PowerPoint-VBA-Schnittstelle:
- https://learn.microsoft.com/en-us/office/vba/api/powerpoint.view.slide
- https://learn.microsoft.com/en-us/office/vba/api/powerpoint.textrange
