# PROdigitalTV – Funktionsbeschreibung von Website und CMS

Stand: 8. Oktober 2026

Diese Dokumentation beschreibt den aktuellen Funktionsumfang der PROdigitalTV-Plattform. Sie richtet sich an Vorstand, Administration, Redaktion und Veranstaltungsteam. Sie erklärt, wo Inhalte gepflegt werden, wie die einzelnen Bereiche zusammenarbeiten und welche Schritte bei wiederkehrenden Aufgaben zu beachten sind.

## Kurzüberblick

PROdigitalTV verbindet eine öffentliche Website, eine installierbare Web-App, ein Content-Managementsystem (CMS), eine integrierte Buchhaltung und einen geschützten Eventbereich in einem System.

- Veranstaltungen werden von der Planung über Einladung, Anmeldung und Einlass bis zum Rückblick verwaltet.
- Teilnehmende melden sich online an und können ihr Smartphone als persönliches Ticket verwenden.
- Das CMS verwaltet Veranstaltungen, Referierende, Mitglieder, Redaktion, Medien, Mailings, Buchhaltung und Systemeinstellungen.
- Die Buchhaltung verbindet Mitgliedsbeiträge, Rechnungs-PDFs, Versand, Mahnungen, Kontoauszüge und Zahlungszuordnungen.
- Zugewiesene Moderatoren erhalten einen eigenen Eventzugang und bearbeiten getrennte persönliche Moderationskartensätze.
- Der Event-Chat verbindet ausschließlich Personen, die für das jeweilige Event eingecheckt wurden.
- Persönliche Chats, ein eventbezogener Gruppenchat, Kontaktanfragen und Kontaktkarten unterstützen das Networking.
- Event-Fotos können mobil hochgeladen, mit einer Fortschrittsanzeige verfolgt und als Thumbnails angesehen werden.
- Moderationskarten im Format DIN A5 und Namensetiketten können direkt aus den Eventdaten erzeugt werden.
- Einladungen, Erinnerungen, Gästebefragungen und weitere Mailings laufen über eine zentrale Versandverwaltung.
- Rückläufer, SMTP-Ablehnungen und verzögerte Zustellungen werden sichtbar gemacht.
- Push-Nachrichten ergänzen E-Mails bei zeitkritischen persönlichen Benachrichtigungen.
- Medien werden zentral gespeichert, optimiert, zugeschnitten und verschiedenen Inhalten zugeordnet.
- Die KI-Redaktion unterstützt bei Entwürfen, Importen, Zusammenfassungen und Bildern; die redaktionelle Freigabe bleibt beim Menschen.

## 1. Plattform und Zugänge

Die Plattform besteht aus vier eng verbundenen Oberflächen:

- Die öffentliche Website informiert über PROdigitalTV, Veranstaltungen, Themen, News, Mitglieder und Referierende.
- Die Web-App optimiert zentrale Funktionen für Smartphones und kann auf dem Home-Bildschirm gespeichert werden.
- Das CMS ist die Verwaltungsoberfläche für Redaktion, Events, Medien, Kommunikation und Systempflege.
- Der Eventbereich ist ein geschützter Raum für eingecheckte Gäste und berechtigte Mitglieder.

Die Website und die Web-App sind mobile-first aufgebaut. Das CMS ist auch mobil erreichbar, bleibt für umfangreiche redaktionelle Aufgaben aber auf einem großen Bildschirm übersichtlicher.

### Rollen

- Gäste sehen öffentliche Inhalte und können sich zu freigegebenen Veranstaltungen anmelden.
- Eventgäste erhalten nach Einladung, Anmeldung und Check-in Zugang zu den für sie freigegebenen Eventfunktionen.
- Mitglieder erhalten zusätzlich Zugriff auf den Mitgliederbereich und auf Mitgliederveranstaltungen.
- Redakteure pflegen Inhalte und Medien entsprechend ihrer Berechtigungen.
- Administratoren verwalten zusätzlich Benutzer, Systemeinstellungen, Löschvorgänge, Mailrückläufer, Event-Reset-Funktionen und die Buchhaltung.
- Zugewiesene Moderatoren mit aktivem Benutzerkonto erhalten Zugriff auf die Moderationskarten ihres Events. Die Zuweisung erteilt keine allgemeinen CMS- oder Buchhaltungsrechte.

Der CMS-Link wird nur für berechtigte Rollen angezeigt. Schreibende und löschende Aktionen werden serverseitig erneut geprüft.

## 2. Öffentliche Website und Web-App

### Startseite

Die Startseite zeigt ausgewählte Veranstaltungen, redaktionelle Inhalte, Themen, News, Referierende und weitere hervorgehobene Bereiche. Ein Inhalt erscheint nur, wenn Status, Sichtbarkeit und Startseitenfreigabe dies erlauben.

### Veranstaltungen

Die Eventübersicht unterscheidet kommende Veranstaltungen, Mitgliederveranstaltungen und Rückblicke. Eine Eventdetailseite kann enthalten:

- Titel, Datum, Uhrzeit und Veranstaltungsort
- Gastgeber, Partner und Logos
- Beschreibung und Keywords
- Ablaufplan und Referierende
- Anmeldung oder gespeicherten Anmeldestatus
- Funktion „Termin merken“ ohne automatische Anmeldung
- Rückblick, Galerie, Downloads und weiterführende Themen

Nach einer bestätigten Anmeldung wird der Gast nicht erneut mit einem irreführenden Anmeldebutton konfrontiert. Der sichtbare Zustand richtet sich nach der konkreten Registrierung.

### Themen, News und Referierende

Themenbeiträge machen Fachinhalte und Vorträge dauerhaft auffindbar. News erscheinen als einzelne redaktionelle Beiträge. Referierendenprofile verbinden Foto, Funktion, Unternehmen, Vita, Vortrag und zugehöriges Event.

### Navigation und Darstellung

Die Oberfläche besitzt eine Desktop- und eine mobile Navigation. Tag- und Nachtansicht können umgeschaltet werden. Auf Mobilgeräten ist die untere Navigation auf die wichtigsten Bereiche reduziert.

## 3. CMS-Navigation

Das CMS ist in folgende Hauptbereiche gegliedert:

- Dashboard
- Buchhaltung (nur Administration)
- Event Verwaltung
- Mitglieder
- Redaktion
- Medien
- Papierkorb
- KI-Redaktion
- Kommunikation
- System

Aufklappbare Seitengruppen halten die Navigation kompakt. Der aktive Bereich bleibt sichtbar markiert.

### Event Verwaltung

- Events
- Veranstaltungs-Cockpit
- Anmeldungen
- Referenten
- Gästebefragung
- Sponsoren und Gastgeber

### Buchhaltung

- Ausgangsrechnungen
- Eingangsrechnungen
- Kontoauszüge / Zahlungsverkehr
- Kassen- & Kontenübersicht
- Kreditoren / Debitoren

Die Buchhaltung steht ausschließlich Administratoren zur Verfügung. Die ausführliche Beschreibung befindet sich in Kapitel 24.

### KI-Redaktion

- Themenliste
- News importieren
- Morgenbriefing
- Beiträge
- Quellen
- Prompts
- Automatisierung
- Logs

### Mitglieder

- Mitglieder
- Mitgliederbereich
- Strategie-Auswertung
- Mitgliedsanträge
- Vorstand

### Redaktion

- Presse
- Themen
- News
- Rückblicke
- Interna

### Medien

- Bilder
- KI-Bilder
- Videos
- Dokumente
- Bildergalerien
- Audio und Barrierefreiheit
- Papierkorb

### Kommunikation

- Event-Versand
- Mailingadressen
- Mailing Queue
- Rückläufer
- Mailingverwaltung

### System

- Funktionsbeschreibung
- Qualitätsprüfung
- Datenschutz-Consents
- KI-Zugänge
- ChatGPT
- ChatGPT-Einstellungen
- System und Einrichtung

## 4. Eventverwaltung

Jedes Event besitzt eine eigene Verwaltungsseite mit den Reitern Stammdaten, Vorträge/Referenten, Einladungen, Anmeldung, Ablauf, Event Chat, Live-Umfrage, Gästebefragung, Rückblick und Foto.

### Stammdaten

Hier werden die grundlegenden Angaben gepflegt:

- Titel, Untertitel und Eventtyp
- Datum, Beginn und Ende
- Veranstaltungsort und Adresse
- Status und Sichtbarkeit
- öffentliche oder mitgliederbezogene Zugangsart
- Anmeldefreigabe
- Darstellung auf der Startseite
- Eventbild, Gastgeber und Sponsoren

Die Schalter „Aktiv“, „Startseite“, „Agenda öffentlich“ und „Handy-Ticket“ haben unterschiedliche Aufgaben. Im Reiter „Anmeldung“ öffnet „Aktiv“ die Anmeldung; „Startseite“ steuert die prominente Platzierung. „Agenda öffentlich“ blendet das Programm im öffentlichen Veranstaltungsbereich ein oder aus. „Handy-Ticket“ steuert die Ticket- und Einlass-QR-Funktion.

### Beiträge und Mitwirkende

Beiträge werden dem Event als Referat, Diskussionsrunde oder Interview zugeordnet und in eine Reihenfolge gebracht. Referate besitzen Referierende. Bei Diskussionsrunden und Interviews werden Moderation und Teilnehmende getrennt erfasst.

Alle Mitwirkenden werden als zentrale Personenprofile gespeichert. Ist eine Person bereits vorhanden, wird dasselbe Profil erneut ausgewählt und nur mit dem neuen Beitrag und ihrer Rolle verknüpft. So werden Person, Foto, Vita und Kontaktdaten nicht doppelt angelegt. Profile enthalten insbesondere:

- Name
- Unternehmen und Position
- Referierendenfoto
- Unternehmenslogo
- Kurzvita und ausführlichere Vita
- Kontaktdaten und LinkedIn-Link
- Vortragstitel und Beschreibung

Referierende können Änderungs- oder Freigabelinks erhalten. Eingereichte Änderungen werden im CMS mit dem bisherigen Stand verglichen und anschließend übernommen oder verworfen.

### Einladungen

Der Einladungsbereich bündelt Eventbeschreibung, Einladungstext, Aktualisierungen, Mailtexte und Vorschau. Betreff und Mailinhalt werden getrennt gepflegt. Einladungen enthalten eine persönliche Anrede, wenn ein Personenname vorliegt.

Nach Änderungen an Veranstaltungsdaten oder Moderation kann „Texte anpassen?“ die vorhandenen Beschreibungen und Einladungstexte anhand der aktuellen Daten überarbeiten. Die Redaktion prüft und bearbeitet die KI-Vorschläge und übernimmt sie erst mit „Änderungen speichern“. „Später“ schließt den Dialog ohne Übernahme.

### Rückblick und Foto

Nach dem Event werden Kurztext, Langtext, Rückblickstatus, Bilder, Downloads und Galeriezuordnung gepflegt. Die Rückblickfreigabe steuert, ob das Event als redaktioneller Nachbericht erscheint.

## 5. Ablaufplan und Veranstaltungsunterlagen

Der Ablaufplan verwaltet Uhrzeit, Dauer, Referent oder Moderation und Titel jedes Programmpunkts. Einlass, Begrüßung, Vorträge, Pausen, Networking und Veranstaltungsende können frei angeordnet werden.

Programmpunkte lassen sich verschieben, bearbeiten, ergänzen und entfernen. Aus bereits zugeordneten Vorträgen kann ein Ablauf automatisch aufgebaut werden.

### Moderationskarten

Über „Moderationskarten“ werden aus Ablauf, Beitrag und Personenprofil automatisch DIN-A5-Karten erzeugt. Begrüßung, Referate, Diskussionsrunden, Interviews und Verabschiedung werden berücksichtigt; reine Pausen oder Networking-Blöcke werden nicht als Moderationskarte angelegt.

Die Karten übernehmen, soweit vorhanden:

- Uhrzeit
- Name, Position und Unternehmen
- Vortrag oder Programmpunkt
- Kurzvita
- Kurzbeschreibung
- Fragen und Moderationshinweise

Einzelne Karten können ausgewählt, sortiert und vor dem Ausdruck bearbeitet werden. Die Karten werden fortlaufend nummeriert. Vorschau, Druck und PDF können gemeinsam auf Hochkant oder Querformat eingestellt werden. Karten können auch einzeln entfernt und ihre Reihenfolge angepasst werden.

### Moderatorenzugang und persönliche Kartensätze

Im Reiter „Anmeldung“ wird unter „Moderation“ eine oder werden mehrere Personen aus der Gästeliste ausgewählt. Nach „Moderation speichern“ erhalten die ausgewählten Personen mit aktivem Benutzerkonto Zugriff auf die Karten des betreffenden Events. Eine leere Auswahl hebt die Zuweisung auf.

Jeder Moderator speichert einen eigenen Kartensatz mit persönlichen Texten, Reihenfolge und entfernten Karten. Änderungen überschreiben nicht die Karten anderer Moderatoren. Berechtigte CMS-Nutzer können den Kartensatz einer zugewiesenen Person auswählen und verwalten. Der Zugang bleibt auf das zugewiesene Event begrenzt.

### Namensetiketten

Im Reiter „Anmeldung“ steht oberhalb der Gästeliste die Funktion „Namensetiketten drucken“. Sie erzeugt Etiketten aus den aktuellen Teilnehmendendaten. Auswahl, Vorschau und Druck erfolgen vor der endgültigen Ausgabe.

## 6. Anmeldung und Gästeliste

Der Reiter „Anmeldung“ steuert Anmeldestatus, Ticketfunktion und Teilnehmendenverwaltung.

### Öffentliche Anmeldung

Ein Anmeldeformular kann bekannte Daten aus einer persönlichen Einladung vorausfüllen. Die Felder bleiben editierbar. Erfasst werden unter anderem Vorname, Nachname, Unternehmen, Funktion, E-Mail und Mobilnummer.

Datenschutz sowie Foto- und Videohinweis werden aktiv bestätigt. Das System prüft Pflichtfelder, Mobilnummern und mögliche Dubletten.

Nach dem Absenden erhält die Person eine eindeutige Registrierung. Bestätigungs-, Wartelisten- und Stornierungsstatus bleiben eventbezogen.

### Manuelle Anmeldung

Administratoren können Personen direkt im CMS hinzufügen. Eine Suche in den Mailingadressen übernimmt vorhandene Personen-, Unternehmens- und Kontaktdaten ins Anmeldeformular; die Angaben können vor dem Speichern bearbeitet werden. Auch manuell hinzugefügte Personen können eine Bestätigung und später einen Eventzugang erhalten.

### Gästeliste des Events

Die Liste zeigt Hauptpersonen und Begleitpersonen mit Unternehmen, E-Mail, Mobilnummer und Status. Verfügbare Aktionen umfassen:

- Personendaten öffnen und bearbeiten
- ausgewählte Personen einchecken
- Buchung löschen
- Startpasswort prüfen oder senden
- Gastkonten vorbereiten
- CSV exportieren
- Namensetiketten drucken

Vorstandsmitglieder und Referierende können als Gruppe für den Eventbetrieb eingecheckt werden.

### Gastkonten

„Gastkonten vorbereiten“ legt Zugänge für angemeldete Gäste an oder verknüpft bestehende Konten. Dabei werden Mitgliederkonten berücksichtigt und E-Mail-Konflikte gemeldet. Das Vorbereiten allein versendet noch keinen Zugangslink.

## 7. Handy-Ticket, QR-Code und Check-in

Das Handy-Ticket verbindet eine Registrierung mit dem Smartphone. Ein persönlicher Token ordnet Ticket, Person und Event eindeutig zu.

Nach einer Desktop-Anmeldung kann ein QR-Code angezeigt werden. Der Scan öffnet die persönliche mobile Ansicht und übernimmt die Zuordnung auf das Smartphone.

Der Einlass kann über mehrere Wege erfolgen:

- persönliches Handy-Ticket des Gastes
- Event-QR am Empfang
- Suche im Veranstaltungs-Cockpit
- manuelles Einchecken in der Gästeliste

Das Cockpit zeigt live, wie viele Personen angemeldet, bestätigt und eingecheckt sind. Ein Präsentationsmodus kann die zuletzt eingecheckte Person mit Namen und Unternehmen begrüßen.

„Termin merken“ erstellt lediglich einen Kalendereintrag und keine Anmeldung. Dieser Unterschied wird ausdrücklich angezeigt.

## 8. Event-Chat und Networking

Der Event-Chat ist immer an genau ein Event gebunden. Sichtbar sind ausschließlich die eingecheckten Personen dieses Events. Gäste erhalten ihren zeitlich begrenzten Zugang rund um die Veranstaltung; Mitglieder können entsprechend ihrer Berechtigung zugreifen.

### Gästeliste und Profile

Die Eventansicht nennt die Teilnehmendenliste „Gästeliste des Events“. Jede Karte zeigt Name, Funktion, Unternehmen, Online-Status und – soweit vorhanden – Profilbild und Firmenlogo. Fehlt ein Profilbild, werden die Anfangsbuchstaben aus Vor- und Nachname angezeigt.

Das persönliche Profil ist in Chat, Profil und Vita gegliedert. Profilbild und Firmenlogo können bearbeitet werden. Ein Klick auf das Firmenlogo öffnet dieselbe Auswahl- und Bearbeitungslogik wie beim Profilbild.

### Persönlicher Chat

Jede Person kann einen persönlichen Chat mit einer anderen eingecheckten Person führen. Nachrichten zeigen Zustell- und Lesestatus. Ungelesene Nachrichten werden mit einer roten Anzahl-Bubble in der Gästeliste und am Home-Screen-Zugang angezeigt.

Ist der Empfänger offline, wird bei persönlichen Chats unmittelbar nach dem Senden eine Push-Benachrichtigung ausgelöst, sofern auf dem Zielgerät Push aktiviert ist. Gruppenbeiträge lösen keine persönliche Offline-Push-Nachricht aus.

### Gruppenchat

Der Gruppenchat fügt sich in die vorhandene Chatliste ein. Ein Beitrag erreicht alle eingecheckten Gäste desselben Events. Andere Veranstaltungen bleiben vollständig getrennt.

### Kontaktanfragen und Kontaktkarten

Kontaktdaten werden nicht automatisch öffentlich angezeigt. Eine Person kann im persönlichen Chat eine Kontaktanfrage senden. Die empfangende Person kann freigeben oder ablehnen. Bei Freigabe wird eine Kontaktkarte mit den erlaubten Angaben bereitgestellt.

### Chat Reset

Administratoren können alle Chats eines Events zurücksetzen. Dabei werden gemeinsam gelöscht:

- persönliche Chatnachrichten
- Gruppenchat-Nachrichten
- geteilte Kontaktkarten im Chat
- offene Kontaktanfragen
- angenommene oder abgelehnte Kontaktfreigaben

Der Reset ist auf das ausgewählte Event begrenzt. Profile und bereits auf einem Gerät gespeicherte Kontakte bleiben erhalten. Vor der unwiderruflichen Löschung erscheint eine eindeutige Bestätigung.

## 9. Event-Fotos

Im Veranstaltungsbereich können berechtigte Personen Fotos aus ihrer Fotomediathek hochladen. Vor dem Upload muss bestätigt werden, dass die Bilder mit den Eventteilnehmenden geteilt werden dürfen.

Der Uploadbereich steht kompakt oberhalb der Galerie. Der Auswahlknopf ist für die mobile Nutzung vergrößert. Mehrere Fotos können gemeinsam gewählt werden.

Die Fortschrittsanzeige zeigt die Verarbeitungsschritte einzeln:

1. Auswahl prüfen
2. Upload vorbereiten
3. Fotos übertragen
4. Fotos verarbeiten
5. Galerie aktualisieren

Bei mehreren Dateien wird „Foto X von Y“ sowie der Übertragungsfortschritt in Prozent angezeigt. Fehler markieren den betroffenen Schritt, ohne die Ursache zu verschleiern.

Nach erfolgreicher Verarbeitung erscheinen die Bilder als platzsparende Thumbnails. Ein Klick öffnet die große Darstellung. Neue Fotos werden eventbezogen synchronisiert und können von Administratoren moderiert oder entfernt werden.

## 10. Live-Umfrage und Gästebefragung

### Live-Umfrage

Live-Umfragen werden im Event vorbereitet und im mobilen Veranstaltungs-Cockpit versendet. Eine Umfrage kann mehrere Fragen enthalten:

- Einzelauswahl
- Mehrfachauswahl
- Freitext

Vor dem Versand werden Empfängerkreis, Mail- oder Push-Vorschau und Eventbezug geprüft. Persönliche Tokens verhindern unbeabsichtigte Mehrfachabgaben. Die Auswertung aktualisiert Stimmen und Prozentwerte laufend.

### Gästebefragung

Die Gästebefragung dient der strukturierten Nachbereitung. Fragen und Vorschau werden im Event gepflegt. Der Versand kann an die registrierten Gäste vorbereitet werden. Ergebnisse lassen sich filtern und als CSV exportieren.

## 11. Event-Versand und Mailtexte

Der Bereich „Event-Versand“ bündelt geplante Kommunikation zu Veranstaltungen. Abhängig vom Zweck können unter anderem versendet werden:

- Save-the-Date
- Einladung
- Einladungsupdate
- Anmeldebestätigung
- Bestätigungserinnerung
- Event-Erinnerung
- Startpasswort oder Zugangslink
- Live-Umfrage
- Gästebefragung
- Rückblick und Nachfassmail

Empfängergruppen werden vor dem Versand ausgewählt und gezählt. Die Versandvorschau zeigt je nach Versandart die personalisierte E-Mail und SMS sowie Empfänger- und Kostenhinweise. Erst die ausdrückliche Versandfreigabe löst den Versand aus; „Zurück zur Bearbeitung“ ermöglicht Korrekturen. Betreff, persönliche Anrede, Absender und Ziel-Link sollen vor der Freigabe kontrolliert werden.

Der Begriff „Anmeldung“ wird in Einladungsbetreffzeilen vermieden, wenn dadurch der Eindruck entstehen könnte, die Person sei bereits registriert.

## 12. Mailingadressen, Queue und Rückläufer

### Mailingadressen

Mailingadressen führen Kontakte aus Mitgliedern, Anmeldungen, Referierenden und manuell angelegten Personen zusammen. Angezeigt werden Name, E-Mail, Herkunft, Push-Status, Aktivität und mögliche Mailprobleme.

Eine Mailingadresse kann bearbeitet, vorübergehend deaktiviert oder aus der Mailingverwaltung entfernt werden, ohne automatisch das Mitgliedsprofil oder Login zu löschen.

### Mailing Queue

Die Queue zeigt geplante, versendete und fehlgeschlagene Nachrichten. Ein Eintrag kann Versandzeit, Öffnung, Klick, Zustellstatus und Fehlermeldung enthalten.

### Rückläufer und Ablehnungen

Der Rückläuferbereich unterscheidet insbesondere:

- SMTP-Ablehnung vor Annahme
- späteren Bounce nach Annahme
- verzögerte Zustellung
- manuell gemeldeten Spamverdacht
- technische Versandfehler

Adressen werden nur dann automatisch zugeordnet oder gesperrt, wenn eine sichere Mailkennung oder eindeutige Adresse vorliegt. Eine verspätete Zustellung ist nicht automatisch mit einer dauerhaft ungültigen Adresse gleichzusetzen.

## 13. Push-Benachrichtigungen und Web-App

Push muss freiwillig auf dem jeweiligen Gerät aktiviert werden. Die Einstellung gilt für PROdigitalTV-Mitteilungen auf diesem Gerät. Bestehende Einstellungen bleiben unverändert, wenn keine neue Auswahl getroffen wird.

Auf dem iPhone funktioniert Web-Push erst zuverlässig, wenn die Website zum Home-Bildschirm hinzugefügt und von dort geöffnet wurde. Die Oberfläche erklärt diesen Schritt, wenn Push im normalen Browserkontext nicht aktiviert werden kann.

Push wird eingesetzt für zeitkritische Hinweise, persönliche Offline-Chatnachrichten, Eventerinnerungen und – abhängig vom Versandtyp – Umfragen. Gruppenchat-Nachrichten erzeugen bewusst keine Push-Flut.

Homescreen- und Navigationssymbole können rote Badges mit der Anzahl ungelesener persönlicher Nachrichten anzeigen.

## 14. Medienverwaltung

Die Medienverwaltung ist die zentrale Ablage für Bilder, Logos, Videos, Dokumente und abgeleitete Varianten.

### Upload und Optimierung

Beim Bild-Upload werden Original, Web-Version und Thumbnail erzeugt. Webbilder werden in passende Abmessungen gebracht und komprimiert. Dateiname, Bildcode, Format, Abmessungen und Speicherpfad werden dokumentiert.

### Bildbearbeitung

Die Redaktion kann Bildausschnitt, Zoom und Position für verschiedene Einsatzzwecke festlegen. Typische Varianten sind:

- Eventbild
- News- und Themenbild
- Listen-Thumbnail
- Referierendenfoto
- Mitgliederlogo
- Gastgeber- und Sponsorenlogo
- Social-Media-Format

### Mediathek und Zuordnung

Bilder können direkt hochgeladen oder aus der Mediathek ausgewählt werden. Ein Medium kann einem Event, Beitrag, Mitglied, Referierenden oder einer Galerie zugeordnet werden.

Nicht mehr benötigte Medien werden zunächst in den Papierkorb verschoben. So bleiben versehentliche Löschungen besser kontrollierbar.

## 15. Referierendenverwaltung und Freigabe

Referierende werden zentral und im Eventkontext gepflegt. Mehrere Personen können demselben Vortrag zugeordnet werden.

Das Freigabeverfahren ermöglicht externen Personen, ihre Angaben zu prüfen. Das CMS protokolliert Öffnung, Rückmeldung, Freigabe und Übernahme. Änderungen an Vita, Funktion, Unternehmen oder Vortrag können vor der Veröffentlichung verglichen werden.

Ein Referierendenprofil sollte vor Veröffentlichung mindestens Namen, Funktion, Unternehmen, Foto, Vita und Eventzuordnung enthalten.

Vorhandene Personen können aus den Mailingadressen übernommen werden. „Aus Vortrag entfernen“ löst die Zuordnung zum einzelnen Beitrag. Das Entfernen aus einem Event löst die Verbindungen zu dessen Vorträgen und Moderationsrollen; das zentrale Personenprofil und Zuordnungen zu anderen Events bleiben erhalten. Bei veranstaltungsübergreifend verwendeten Beiträgen wird die Änderung auf das ausgewählte Event begrenzt. Anschließend können die betroffenen Beschreibungen und Einladungstexte zur Überarbeitung vorgeschlagen werden.

## 16. Redaktion und KI-Unterstützung

### Redaktionelle Inhalte

Presse, Themen, News, Rückblicke und Interna werden getrennt verwaltet. Status, Sichtbarkeit, Datum, Rubrik, Teaser, Langtext, Bild und Verknüpfungen steuern die Veröffentlichung.

### KI-Newsimport und Morgenbriefing

Importierte Quellen können in einzelne Meldungen zerlegt werden. Das Morgenbriefing bündelt ausgewählte Branchenthemen. Entwürfe werden nicht ungeprüft veröffentlicht.

### KI-Regeln

KI unterstützt bei:

- Struktur- und Formulierungsvorschlägen
- Rechtschreibung und Stil
- Zusammenfassungen
- Einladungs- und Rückblickentwürfen
- Moderationshinweisen
- Bildideen und Bildvarianten
- Alt-Texten und Metadaten

Quellenprüfung, Tatsachenprüfung, Rechteprüfung und Veröffentlichung bleiben Aufgabe der Redaktion.

### Audio und Barrierefreiheit

Aus geeigneten Beiträgen können Audiofassungen erzeugt werden. Der Player unterstützt Mitlesen und abschnittsweise Hervorhebung. Alt-Texte, klare Kontraste, Tastaturbedienung und verständliche Statusmeldungen ergänzen die Barrierefreiheit.

## 17. Mitglieder, Benutzer und Profile

Mitglieder und Benutzer sind fachlich verbunden, aber nicht identisch. Ein Mitgliedsdatensatz beschreibt die Organisation oder Person; ein Benutzerkonto regelt den Login.

Mitgliederprofile können Logo, Beschreibung, Website, Ort, Land und zugeordnete Personen enthalten. Unternehmensmitglieder können mehrere Personen besitzen.

Benutzer werden mit Rolle und Aktivstatus verwaltet. Einladungslinks sind zeitlich begrenzt. Startpasswörter müssen beim ersten Zugriff durch ein dauerhaftes Passwort ersetzt werden.

Im persönlichen Profil können Name, Unternehmen, Funktion, Telefonnummer, Profilbild, Firmenlogo, Vita, Unternehmensbeschreibung und Freigabeeinstellungen gepflegt werden. Kontaktdaten werden erst nach einer entsprechenden Freigabe geteilt.

## 18. Mobile CMS und Veranstaltungs-Cockpit

Das mobile CMS konzentriert sich auf Aufgaben während einer Veranstaltung:

- Event auswählen
- Einlass-QR anzeigen
- QR als PDF bereitstellen
- Einlasszahlen verfolgen
- Personen suchen und einchecken
- Live-Umfragen auswählen und versenden
- Ergebnisse beobachten
- letzte Aktionen kontrollieren

Das mobile CMS ersetzt nicht die vollständige Desktop-Verwaltung. Komplexe Medienbearbeitung, große Tabellen und redaktionelle Langtexte bleiben am Desktop übersichtlicher.

## 19. Datenschutz und Sicherheit

Datenschutz-Consents werden mit Zeitpunkt und technischem Kontext dokumentiert. Pflichtbestätigungen werden nicht automatisch gesetzt.

Wesentliche Sicherheitsprinzipien sind:

- Rollen- und Rechteprüfung im Frontend und auf dem Server
- eventbezogene Trennung von Chats, Fotos, Anmeldungen und Kontaktanfragen
- persönliche, schwer erratbare Ticket- und Umfragetokens
- zeitlich begrenzte Einladungs- und Aktivierungslinks
- Bestätigung vor unwiderruflichen Löschungen
- begrenzte Dateitypen und Dateigrößen
- keine automatische Veröffentlichung ungeprüfter Uploads oder KI-Inhalte

Beim Löschen kompletter Event-Chatdaten wird nur das gewählte Event bearbeitet. Beim Löschen aller personenbezogenen Testdaten müssen auch Kontaktanfragen und Kontaktfreigaben berücksichtigt werden.

## 20. Qualitätssicherung und Betrieb

Die Qualitätsprüfung sucht unter anderem nach fehlenden Bildern, Alt-Texten, Links, Logos, Zuordnungen, leeren Galerien und inkonsistenten Sichtbarkeiten.

Die Website wird als statischer Build auf Firebase Hosting veröffentlicht. Cloud Functions übernehmen geschützte Servervorgänge wie Mailversand, Uploadfreigaben, Chataktionen und administrative Löschungen.

Versionsnummern an JavaScript- und CSS-Dateien verhindern, dass nach einem Deployment dauerhaft veraltete Browserdateien verwendet werden. HTML und Service Worker werden mit restriktiven Cache-Regeln ausgeliefert.

Ein Hosting-Deployment veröffentlicht keine Cloud Functions. Werden Serverfunktionen geändert, müssen die betroffenen Functions zusätzlich veröffentlicht und anschließend separat geprüft werden.

## 21. Typische Arbeitsabläufe

### Neues Event vorbereiten

1. Event anlegen und Stammdaten speichern.
2. Eventbild, Gastgeber und Sponsoren zuordnen.
3. Vorträge und Referierende erfassen.
4. Ablaufplan aufbauen und prüfen.
5. Einladungstext und Mailvorschau kontrollieren.
6. Anmeldung und gegebenenfalls Handy-Ticket aktivieren.
7. Event aktivieren und Startseitenfreigabe bewusst setzen.
8. Testanmeldung durchführen.
9. Einladung zunächst an Testadressen und danach an die Zielgruppe senden.

### Veranstaltung durchführen

1. Gastkonten und Zugänge vorbereiten.
2. Veranstaltungs-Cockpit öffnen.
3. Einlass-QR und Check-in testen.
4. Referierende und Vorstand gegebenenfalls gesammelt einchecken.
5. Moderationskarten und Namensetiketten erstellen.
6. Event-Chat und Gruppenchat kontrollieren.
7. Live-Umfrage vorbereiten und bei Bedarf versenden.
8. Event-Fotos und Einlassstatus beobachten.

### Veranstaltung nachbereiten

1. Gästebefragung versenden.
2. Rückblicktext und Kurzfassung erstellen.
3. Fotos sichten und Galerie freigeben.
4. Vorträge in Themenbeiträge überführen.
5. Referierendenfreigaben und Profile vervollständigen.
6. Rückblick veröffentlichen.
7. Nachfassmail mit Rückblick, Galerie und weiterführenden Inhalten senden.

### Mailing prüfen

1. Empfängerzahl und Filter kontrollieren.
2. Betreff und persönliche Anrede prüfen.
3. Ziel-Link in der Vorschau öffnen.
4. Testmail senden.
5. Versand freigeben.
6. Queue, Öffnungen, Klicks und Rückläufer beobachten.
7. Abgelehnte oder unzustellbare Adressen nachvollziehbar bearbeiten.

### Chatdaten zurücksetzen

1. Richtiges Event öffnen.
2. Reiter „Event Chat“ wählen.
3. „Chat Reset“ auswählen.
4. Hinweis zu Chats, Kontaktkarten und Kontaktanfragen vollständig lesen.
5. Löschung bestätigen.
6. Erfolgsmeldung abwarten und Eventbereich neu laden.

### Buchhaltungsjahr bearbeiten

1. Als Administrator „Buchhaltung“ öffnen und das gewünschte Jahr wählen.
2. Buchhaltungsordner zuweisen und den Zugriff auf diesem Gerät freigeben.
3. Rechnungen und Kontoauszüge einlesen; erkannte Angaben mit den PDFs prüfen.
4. Jahresbeiträge beziehungsweise Rechnungs-PDFs erzeugen und kontrollieren.
5. Rechnungen auswählen, Versandvorschau prüfen und Versand freigeben.
6. Bankbuchungen zuordnen, fehlende Belege und Gebühren prüfen.
7. Offene Beiträge, Versandfehler und Mahnstufen kontrollieren.
8. Kassen- & Kontenübersicht zum gewünschten Stichtag prüfen und exportieren.
9. Ein abgeschlossenes Vorjahr nach der Prüfung mit PIN sperren.

## 22. Wichtige Begriffe

- Aktiv: Datensatz oder Funktion ist grundsätzlich nutzbar.
- Startseite: Inhalt ist zusätzlich für die prominente Startseitendarstellung freigegeben.
- Öffentlich: Inhalt ist ohne Login sichtbar.
- Mitglieder: Inhalt ist nur für berechtigte Mitglieder sichtbar.
- Intern: Inhalt ist ausschließlich für Verwaltung oder Redaktion bestimmt.
- Hauptperson: Primäre Person einer Eventbuchung.
- Begleitperson: Weitere Person innerhalb derselben Buchung.
- Check-in: Bestätigung, dass die Person beim Event anwesend ist.
- Event-Chat: Geschützter Kommunikationsbereich eines einzelnen Events.
- Kontaktanfrage: Bitte einer Person, freigegebene Kontaktdaten zu erhalten.
- Mailing Queue: Warteschlange und Protokoll des Mailversands.
- Bounce: Nachträgliche Unzustellbarkeitsmeldung eines Mailservers.
- SMTP-Ablehnung: Nachricht wurde bereits bei der Übergabe abgelehnt.
- Cache-Buster: Versionswert, der Browser zum Laden einer neuen Datei veranlasst.

## 23. Administrative Abschlusskontrolle

Vor einem größeren Versand oder Eventstart sollten folgende Punkte geprüft werden:

- Eventdatum, Uhrzeit, Ort und Ansprechpartner stimmen.
- Anmeldestatus und Startseitenfreigabe sind richtig gesetzt.
- Einladung verwendet eine eindeutige Formulierung und persönliche Anrede.
- Anmeldeformular ist getestet und bekannte Daten werden korrekt vorausgefüllt.
- Bestätigungsmail, QR-Code und Handy-Ticket führen zum richtigen Event.
- Ablauf, Referierende, Fotos, Firmenlogos und Moderationskarten sind vollständig.
- Namensetiketten enthalten die aktuellen Gästedaten.
- Event-Chat zeigt nur eingecheckte Personen des Events.
- Persönliche Push-Nachrichten wurden auf mindestens einem Offline-Testgerät geprüft.
- Event-Foto-Upload zeigt alle Verarbeitungsschritte.
- Testmailing wurde zugestellt und Links wurden geöffnet.
- Rückläuferbereich und Mailing Queue sind erreichbar.
- Nach Änderungen an Cloud Functions wurde nicht nur Hosting, sondern auch die jeweilige Function veröffentlicht.

## 24. Buchhaltung und Mitgliedsbeiträge

Die integrierte Buchhaltung bündelt Ausgangsrechnungen, Eingangsrechnungen, Kontoauszüge und die Kassen- & Kontenübersicht. Kreditoren und Debitoren verbinden Geschäftspartner mit Rechnungen, Bankdaten und Buchungskonten. Der Bereich ist nur für Administratoren zugänglich.

### Ordnerzuordnung und Belegbestand

Über „Ordner zuweisen“ werden die Ablagen für Ausgangsrechnungen, Eingangsrechnungen und Kontoauszüge eingebunden. Die zentrale Zuordnung gilt für die beteiligten Rechner; der Browserzugriff muss auf jedem neuen Gerät einmal freigegeben werden. Alternativ können PDF-Dateien ausgewählt werden. Umfang und Dauer des Zugriffs richten sich nach der gewählten Freigabe.

Der Belegbestand wird mit den gespeicherten Datensätzen abgeglichen. Umbenannte Dateien können über ihren Dateiinhalt wiedererkannt werden. Fehlt ein Rechnungs-PDF im zugeordneten Ordner, erscheint ein entsprechender Hinweis; ein bereits erfasster Zahlungseingang wird dadurch nicht aufgehoben. Eingangs-PDFs können zusätzlich als geprüfte Archivkopie bereitgestellt werden.

### Ausgangsrechnungen und Jahresbeiträge

Die Ausgangsliste zeigt Buchungskonto, Datum, Mitglied beziehungsweise Ansprechpartner, Rechnungsnummer, Betrag, Zahlungsdatum sowie Rechnungs- und Mahnstatus. Nach Jahr, Suchtext, Zahlungsstatus und Rechnungsstatus kann gefiltert werden. Summen unterscheiden Beiträge, bezahlte und unbezahlte Beträge sowie Datensätze ohne erfassten Zahlungsstatus.

- Mitgliedsdatensätze können mit Beitragsrechnungen verknüpft werden. Zugeordnete Anschriften und Kontaktdaten kommen aus der Mitgliederdatenbank.
- „Rechnungen erstellen“ legt ohne Rechnungsauswahl Jahresbeiträge an. Bei ausgewählten Rechnungen werden die jeweiligen PDFs neu erzeugt.
- Rechnungs-PDFs lassen sich über Rechnungsnummer oder Betrag öffnen.
- Änderungen an Rechnungsdaten werden als Revision berücksichtigt. Der Status zeigt, wenn ein PDF neu erstellt oder eine geänderte Rechnung erneut versendet werden muss.
- „Rechnungen senden“ verarbeitet ausgewählte Rechnungen nach Vorbereitung und Freigabe. Erfolg, Warteschlange und Fehler bleiben nachvollziehbar.
- Die gefilterten Beitragsdaten können als CSV heruntergeladen werden.

„Bezahlt“ setzt einen erfassten oder zugeordneten Zahlungsvorgang voraus. Eine leere Bestätigung aus einem historischen Import belegt keinen Zahlungseingang.

### Mahnungen und Versandkontrolle

Über „Mahnungen senden“ können ausgewählte offene Beitragsrechnungen bearbeitet werden. Mahntext, Zahlungsfrist, Rechnungs-PDF und Vorschau werden vor der Freigabe kontrolliert. Versandstatus und Öffnung beziehungsweise Klick bleiben getrennte Informationen: Eine geöffnete Nachricht bedeutet nicht, dass die Rechnung bezahlt wurde.

Die automatische Mahnlogik prüft täglich um 08:00 Uhr:

- Erste Mahnung frühestens 90 Tage nach dem erfolgreichen Rechnungsversand.
- Weitere Mahnungen jeweils nach 30 Tagen bis Mahnstufe 4.
- Weitere 30 Tage nach der vierten Mahnung wird der Status „Vakant“ gesetzt.

Bezahlte, stornierte, archivierte, nicht fällige oder für ein abgeschlossenes Jahr gesperrte Datensätze werden nicht automatisch weitergemahnt. Ein ausstehender oder fehlgeschlagener früherer Versand sowie geänderte, noch nicht korrekt neu erzeugte oder versendete Rechnungen müssen geprüft werden, bevor die automatische Folge fortgesetzt wird. Die Durchführung setzt die veröffentlichte und aktive Serverfunktion voraus.

### Eingangsrechnungen

Eingangs-PDFs können eingelesen und als Rechnungsdatensätze übernommen werden. Die Prüfansicht zeigt erkannte Angaben zur Kontrolle vor dem Speichern. Verwaltet werden unter anderem Lieferant, Rechnungsnummer, Rechnungsdatum, Betrag, IBAN, Fälligkeit, Beschreibung, Buchungskonto und Zahlungsstatus.

Rechnungen lassen sich bearbeiten, als PDF öffnen, mit Bankbuchungen verbinden und als CSV exportieren. Hinweise unterscheiden ein fehlendes PDF, einen fehlenden Rechnungsbeleg, offene Beträge und bereits zugeordnete Zahlungen. Automatisch erkannte Angaben werden vor der Übernahme mit dem Original verglichen.

### Kontoauszüge und Zahlungsverkehr

Kontoauszüge werden eingelesen und ihre Buchungen in einer gemeinsamen Übersicht dargestellt. Rechnungen und Bankbuchungen können einander zugeordnet werden. Zahlungsdatum, Zuordnungsstatus und offene Beträge werden dadurch im Zusammenhang sichtbar.

Der Abgleich berücksichtigt Eingangs- und Ausgangsrechnungen sowie Geschäftspartnerdaten. Automatische Zuordnungen und verbleibende Unklarheiten können kontrolliert und korrigiert werden. Fehlende Belege bleiben erkennbar. Bankgebühren können getrennt vom Rechnungsbetrag behandelt und durch interne Gebührenbelege dokumentiert werden; Bruttobetrag, Gebühr und Nettogutschrift bleiben nachvollziehbar.

### Kassen- & Kontenübersicht und Exporte

Jahr und Stichtag bestimmen den betrachteten Zeitraum. Die Übersicht bündelt Bankbestand, Buchungskonten, offene Rechnungen, noch nicht zugeordnete Buchungen und Planungswerte. Ein Konto kann geöffnet werden, um zugehörige Buchungen und Belege zu prüfen, PDFs aufzurufen und die Kontenzuordnung zu bearbeiten.

Anlagevermögen und Abschreibungen werden für entsprechend erfasste Eingangsrechnungen berücksichtigt. Die derzeitige Webportal-Anlageberechnung verwendet eine Nutzungsdauer von 36 Monaten ab dem hinterlegten Startmonat.

Die Kassen- & Kontenübersicht kann als CSV oder stichtagsbezogenes PDF ausgegeben werden. Ein zusätzlicher Gesamt-PDF-Export bündelt die Buchhaltungsdaten.

### Kreditoren und Debitoren

Geschäftspartner werden mit Nummer, Art, Name, IBAN und Standardkonto geführt. Neue Rechnungen können das Standardkonto übernehmen; das Konto einer einzelnen Rechnung bleibt gesondert änderbar. Partnerbezogene Buchungen und offene Salden erleichtern die Kontrolle von Lieferantenrechnungen und Mitgliedsbeiträgen.

### Jahresabschluss und Schutz vor Änderungen

In der Kassen- & Kontenübersicht kann ein geprüftes Vorjahr abgeschlossen werden. Das laufende Jahr kann noch nicht abgeschlossen werden. Beim ersten Abschluss wird eine sechsstellige PIN eingerichtet und bestätigt.

Ein abgeschlossenes Jahr bleibt lesbar, während zugehörige schreibende Buchhaltungsvorgänge gesperrt werden. Der Schutz wird auch auf dem Server geprüft. Das Entsperren erfolgt mit PIN oder über den angebotenen SMS-Code an die hinterlegte berechtigte Mobilnummer. Der SMS-Code ist zeitlich begrenzt; eine Entsperrung hebt die Jahressperre erst nach erfolgreicher Prüfung auf.

### Abschlusskontrolle der Buchhaltung

- Gewähltes Jahr, Stichtag und Ordnerzuordnung stimmen.
- Rechnungsangaben, Empfänger und PDFs sind geprüft.
- Geänderte Rechnungen wurden bei Bedarf neu erstellt und erneut versendet.
- Versandfehler und ausstehende Nachrichten wurden kontrolliert.
- Bankbuchungen sind zugeordnet; fehlende Belege und Gebühren sind geklärt.
- Offene Beiträge und Mahnstufen sind nachvollziehbar.
- Kontenzuordnungen, Anlagewerte und Abschreibungen wurden geprüft.
- Die Übersicht wurde vor der Sperre des Vorjahres exportiert und kontrolliert.
