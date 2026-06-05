<?php

declare(strict_types=1);

namespace MailService;

final class Crypto
{
    private string $key;

    public function __construct(string $key)
    {
        $decoded = base64_decode($key, true);
        $this->key = $decoded !== false ? $decoded : $key;
        if (strlen($this->key) !== 32) {
            throw new \RuntimeException('APP_ENCRYPTION_KEY must be 32 bytes or base64 encoded 32 bytes.');
        }
    }

    public function encrypt(string $plain): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            throw new \RuntimeException('Encryption failed.');
        }
        return base64_encode($iv . $tag . $cipher);
    }

    public function decrypt(string $encoded): string
    {
        $data = base64_decode($encoded, true);
        if ($data === false || strlen($data) < 29) {
            throw new \RuntimeException('Invalid encrypted value.');
        }
        $iv = substr($data, 0, 12);
        $tag = substr($data, 12, 16);
        $cipher = substr($data, 28);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($plain === false) {
            throw new \RuntimeException('Decryption failed.');
        }
        return $plain;
    }
}
