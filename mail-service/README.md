# PHP Mail Microservice

Dieser Service laeuft als PHP-Container auf Google Cloud Run und kann von Firebase Hosting per Rewrite erreichbar gemacht werden.

## Funktionen

- mehrere SMTP-Mailaccounts verwalten
- eigene Templates pro Kunde/Account verwalten
- Template-Variablen mit `{{name}}`, `{{company}}`, `{{message}}`
- SMTP-Passwoerter verschluesselt in Firestore speichern
- Versand per geschuetztem `/send` Endpoint

## Wichtige Umgebungsvariablen

```text
APP_ENCRYPTION_KEY=32-byte-key-oder-base64-32-byte-key
ADMIN_API_TOKEN=langes-admin-token
MAIL_SEND_TOKEN=langes-send-token
FIREBASE_PROJECT_ID=dein-firebase-projekt
ALLOWED_ORIGIN=https://deine-domain.de
MAIL_SERVICE_STORAGE=firestore
```

Fuer lokale Tests kann `MAIL_SERVICE_STORAGE=file` gesetzt werden. Produktiv sollte Firestore verwendet werden.

## Deploy auf Cloud Run

```powershell
gcloud run deploy prodigitaltv-mail-service `
  --source mail-service `
  --region europe-west3 `
  --allow-unauthenticated `
  --set-env-vars FIREBASE_PROJECT_ID=DEIN_PROJECT_ID,ALLOWED_ORIGIN=https://deine-domain.de
```

Secrets sollten nicht als normale Env-Vars gesetzt werden. Besser:

```powershell
gcloud secrets create mail-service-encryption-key --replication-policy=automatic
gcloud secrets create mail-service-admin-token --replication-policy=automatic
gcloud secrets create mail-service-send-token --replication-policy=automatic

gcloud secrets versions add mail-service-encryption-key --data-file=-
gcloud secrets versions add mail-service-admin-token --data-file=-
gcloud secrets versions add mail-service-send-token --data-file=-

gcloud run services update prodigitaltv-mail-service `
  --region europe-west3 `
  --set-secrets APP_ENCRYPTION_KEY=mail-service-encryption-key:latest,ADMIN_API_TOKEN=mail-service-admin-token:latest,MAIL_SEND_TOKEN=mail-service-send-token:latest
```

In diesem Projekt ist `firebase.json` bereits so vorbereitet, dass Firebase Hosting `/mail-api/**` an den Cloud-Run-Service `prodigitaltv-mail-service` in `europe-west3` weiterleitet.

Nach dem Deploy ist die Verwaltung erreichbar unter:

```text
https://deine-domain.de/mail-api/admin-ui
```

Die API bleibt unter:

```text
https://deine-domain.de/mail-api/admin/accounts
https://deine-domain.de/mail-api/admin/templates
https://deine-domain.de/mail-api/send
```

## API Beispiele

Alle Admin-Aufrufe brauchen:

```text
Authorization: Bearer ADMIN_API_TOKEN
```

Account anlegen:

```json
POST /admin/accounts
{
  "id": "kunde-a",
  "label": "Kunde A",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpUser": "mail@example.com",
  "smtpPass": "passwort",
  "fromEmail": "mail@example.com",
  "fromName": "Kunde A"
}
```

Template anlegen:

```json
POST /admin/templates
{
  "id": "kunde-a-kontakt",
  "accountId": "kunde-a",
  "label": "Kontaktformular",
  "subject": "Neue Anfrage von {{name}}",
  "textBody": "Name: {{name}}\nFirma: {{company}}\n\n{{message}}",
  "htmlBody": "<p>Name: {{name}}</p><p>Firma: {{company}}</p><p>{{message}}</p>"
}
```

Mail senden:

```json
POST /send
{
  "accountId": "kunde-a",
  "templateId": "kunde-a-kontakt",
  "to": "ziel@example.com",
  "replyTo": "absender@example.com",
  "variables": {
    "name": "Max Mustermann",
    "company": "Muster GmbH",
    "message": "Bitte melden."
  }
}
```
