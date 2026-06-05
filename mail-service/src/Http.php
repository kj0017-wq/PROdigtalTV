<?php

declare(strict_types=1);

namespace MailService;

final class Http
{
    public static function jsonBody(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function html(string $html, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
        exit;
    }

    public static function requireBearer(string $expected): void
    {
        self::requireAnyBearer([$expected]);
    }

    public static function requireAnyBearer(array $expectedTokens): void
    {
        $headers = function_exists('apache_request_headers') ? apache_request_headers() : [];
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? $headers['Authorization']
            ?? $headers['authorization']
            ?? '';
        $token = str_starts_with($header, 'Bearer ') ? substr($header, 7) : '';
        $matches = array_filter($expectedTokens, fn ($expected) => trim((string) $expected) !== '' && hash_equals(trim((string) $expected), $token));
        if ($token === '' || !$matches) {
            self::json(['error' => 'Unauthorized'], 401);
        }
    }
}
