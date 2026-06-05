<?php

declare(strict_types=1);

use MailService\App;
use MailService\Http;

require __DIR__ . '/../vendor/autoload.php';

$app = new App();

try {
    $app->handle(
        $_SERVER['REQUEST_METHOD'] ?? 'GET',
        parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/',
        Http::jsonBody()
    );
} catch (Throwable $error) {
    error_log($error->getMessage());
    Http::json(['error' => 'Internal server error'], 500);
}
