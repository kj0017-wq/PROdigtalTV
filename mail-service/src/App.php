<?php

declare(strict_types=1);

namespace MailService;

final class App
{
    private Store $store;
    private Crypto $crypto;

    public function __construct()
    {
        $this->crypto = new Crypto($this->env('APP_ENCRYPTION_KEY'));
        $storage = $this->env('MAIL_SERVICE_STORAGE', 'firestore');
        $this->store = $storage === 'file'
            ? new FileStore($this->env('MAIL_SERVICE_FILE_PATH', sys_get_temp_dir() . '/mail-service'))
            : new FirestoreStore($this->env('FIREBASE_PROJECT_ID', $this->env('GOOGLE_CLOUD_PROJECT')));
    }

    public function handle(string $method, string $path, array $body): void
    {
        $prefix = rtrim($this->env('MAIL_SERVICE_BASE_PATH', '/mail-api'), '/');
        if ($prefix !== '' && str_starts_with($path, $prefix)) {
            $path = substr($path, strlen($prefix)) ?: '/';
        }

        if ($method === 'OPTIONS') {
            $this->cors();
            Http::json(['ok' => true]);
        }
        $this->cors();

        if ($method === 'GET' && $path === '/health') {
            Http::json(['ok' => true, 'service' => 'mail-service']);
        }

        if ($method === 'GET' && in_array($path, ['/admin-ui', '/admin-ui/'], true)) {
            Http::html(file_get_contents(__DIR__ . '/../public/admin.html') ?: '<h1>Mail Admin</h1>');
        }

        if (str_starts_with($path, '/admin/')) {
            Http::requireBearer($this->env('ADMIN_API_TOKEN'));
            $this->admin($method, $path, $body);
        }

        if ($method === 'POST' && $path === '/send') {
            Http::requireAnyBearer([$this->env('MAIL_SEND_TOKEN'), $this->env('ADMIN_API_TOKEN')]);
            $this->send($body);
        }

        Http::json(['error' => 'Not found'], 404);
    }

    private function admin(string $method, string $path, array $body): void
    {
        if ($path === '/admin/accounts' && $method === 'GET') {
            Http::json(['accounts' => array_map(fn ($item) => $this->publicAccount($item), $this->store->list('mailAccounts'))]);
        }
        if ($path === '/admin/accounts' && $method === 'POST') {
            $id = $this->id($body['id'] ?? $body['label'] ?? '');
            $record = $this->accountPayload($body, null);
            Http::json(['account' => $this->publicAccount($this->store->set('mailAccounts', $id, $record))], 201);
        }
        if (preg_match('#^/admin/accounts/([a-zA-Z0-9_-]+)$#', $path, $match)) {
            $id = $match[1];
            if ($method === 'GET') {
                $record = $this->store->get('mailAccounts', $id);
                Http::json(['account' => $record ? $this->publicAccount($record) : null], $record ? 200 : 404);
            }
            if ($method === 'PATCH') {
                $existing = $this->store->get('mailAccounts', $id) ?? [];
                Http::json(['account' => $this->publicAccount($this->store->set('mailAccounts', $id, $this->accountPayload($body, $existing)))]);
            }
            if ($method === 'DELETE') {
                $this->store->delete('mailAccounts', $id);
                Http::json(['deleted' => true]);
            }
        }

        if ($path === '/admin/templates' && $method === 'GET') {
            Http::json(['templates' => $this->store->list('mailTemplates')]);
        }
        if ($path === '/admin/templates' && $method === 'POST') {
            $id = $this->id($body['id'] ?? $body['label'] ?? '');
            Http::json(['template' => $this->store->set('mailTemplates', $id, $this->templatePayload($body, []))], 201);
        }
        if (preg_match('#^/admin/templates/([a-zA-Z0-9_-]+)$#', $path, $match)) {
            $id = $match[1];
            if ($method === 'GET') {
                $record = $this->store->get('mailTemplates', $id);
                Http::json(['template' => $record], $record ? 200 : 404);
            }
            if ($method === 'PATCH') {
                $existing = $this->store->get('mailTemplates', $id) ?? [];
                Http::json(['template' => $this->store->set('mailTemplates', $id, $this->templatePayload($body, $existing))]);
            }
            if ($method === 'DELETE') {
                $this->store->delete('mailTemplates', $id);
                Http::json(['deleted' => true]);
            }
        }

        Http::json(['error' => 'Not found'], 404);
    }

    private function send(array $body): void
    {
        foreach (['accountId', 'templateId', 'to'] as $field) {
            if (empty($body[$field])) {
                Http::json(['error' => "{$field} is required"], 400);
            }
        }
        $account = $this->store->get('mailAccounts', (string) $body['accountId']);
        $template = $this->store->get('mailTemplates', (string) $body['templateId']);
        if (!$account || ($account['active'] ?? true) === false) {
            Http::json(['error' => 'Mail account not found or inactive'], 404);
        }
        if (!$template || ($template['active'] ?? true) === false) {
            Http::json(['error' => 'Mail template not found or inactive'], 404);
        }
        if (($template['accountId'] ?? '') !== $account['id']) {
            Http::json(['error' => 'Template does not belong to account'], 400);
        }

        try {
            $result = (new Mailer($this->crypto))->send($account, $template, $body);
        } catch (\Throwable $error) {
            error_log($error->getMessage());
            Http::json(['error' => 'SMTP-Versand fehlgeschlagen: ' . $error->getMessage()], 502);
        }
        $this->store->set('mailSendLog', 'mail-' . bin2hex(random_bytes(12)), [
            'accountId' => $account['id'],
            'templateId' => $template['id'],
            'to' => (string) $body['to'],
            'status' => 'sent',
            'messageId' => $result['messageId'] ?? '',
            'createdAt' => gmdate('c'),
        ]);
        Http::json(['sent' => true, 'messageId' => $result['messageId'] ?? '']);
    }

    private function accountPayload(array $body, ?array $existing): array
    {
        $record = $existing ?? [];
        foreach (['label', 'smtpHost', 'smtpUser', 'fromEmail', 'fromName'] as $field) {
            if (array_key_exists($field, $body)) {
                $record[$field] = trim((string) $body[$field]);
            }
        }
        if (array_key_exists('smtpPort', $body)) {
            $record['smtpPort'] = (int) $body['smtpPort'];
        }
        if (array_key_exists('active', $body)) {
            $record['active'] = (bool) $body['active'];
        }
        if (!empty($body['smtpPass'])) {
            $record['smtpPassEncrypted'] = $this->crypto->encrypt((string) $body['smtpPass']);
        }
        $record['active'] ??= true;
        return $record;
    }

    private function templatePayload(array $body, array $existing): array
    {
        $record = $existing;
        foreach (['accountId', 'label', 'subject', 'textBody', 'htmlBody'] as $field) {
            if (array_key_exists($field, $body)) {
                $record[$field] = (string) $body[$field];
            }
        }
        if (array_key_exists('active', $body)) {
            $record['active'] = (bool) $body['active'];
        }
        $record['active'] ??= true;
        return $record;
    }

    private function publicAccount(array $account): array
    {
        $hasPassword = !empty($account['smtpPassEncrypted']);
        unset($account['smtpPassEncrypted']);
        $account['hasPassword'] = $hasPassword;
        return $account;
    }

    private function id(string $value): string
    {
        $id = strtolower(trim(preg_replace('/[^a-zA-Z0-9_-]+/', '-', $value), '-'));
        return $id !== '' ? $id : 'item-' . bin2hex(random_bytes(6));
    }

    private function env(string $key, string $fallback = ''): string
    {
        $value = getenv($key);
        return $value === false || $value === '' ? $fallback : $value;
    }

    private function cors(): void
    {
        $allowed = $this->env('ALLOWED_ORIGIN', '*');
        $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowedOrigins = array_filter(array_map('trim', explode(',', $allowed)));
        $origin = $allowed === '*'
            ? '*'
            : (in_array($requestOrigin, $allowedOrigins, true) ? $requestOrigin : ($allowedOrigins[0] ?? ''));
        if ($origin !== '') {
            header("Access-Control-Allow-Origin: {$origin}");
        }
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    }
}
