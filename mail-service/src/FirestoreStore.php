<?php

declare(strict_types=1);

namespace MailService;

final class FirestoreStore implements Store
{
    private string $baseUrl;

    public function __construct(private string $projectId)
    {
        $this->baseUrl = "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents";
    }

    public function list(string $collection): array
    {
        $response = $this->request('GET', "/{$collection}");
        return array_map(fn (array $doc) => $this->decodeDocument($doc), $response['documents'] ?? []);
    }

    public function get(string $collection, string $id): ?array
    {
        try {
            return $this->decodeDocument($this->request('GET', "/{$collection}/{$id}"));
        } catch (\RuntimeException $error) {
            if (str_contains($error->getMessage(), '404')) {
                return null;
            }
            throw $error;
        }
    }

    public function set(string $collection, string $id, array $data): array
    {
        $record = ['id' => $id, ...$data, 'updatedAt' => gmdate('c')];
        $this->request('PATCH', "/{$collection}/{$id}", ['fields' => $this->encodeFields($record)]);
        return $record;
    }

    public function delete(string $collection, string $id): void
    {
        $this->request('DELETE', "/{$collection}/{$id}");
    }

    private function request(string $method, string $path, ?array $body = null): array
    {
        $ch = curl_init($this->baseUrl . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->accessToken(),
                'Content-Type: application/json',
            ],
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
        }
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($status >= 400) {
            throw new \RuntimeException("Firestore request failed with {$status}: {$raw}");
        }
        return $raw ? (json_decode($raw, true) ?: []) : [];
    }

    private function accessToken(): string
    {
        $localToken = getenv('FIRESTORE_BEARER_TOKEN') ?: '';
        if ($localToken !== '') {
            return $localToken;
        }
        $ch = curl_init('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Metadata-Flavor: Google'],
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($raw ?: '', true);
        if (!is_array($data) || empty($data['access_token'])) {
            throw new \RuntimeException('Could not resolve Google service account token.');
        }
        return $data['access_token'];
    }

    private function encodeFields(array $data): array
    {
        $fields = [];
        foreach ($data as $key => $value) {
            $fields[$key] = $this->encodeValue($value);
        }
        return $fields;
    }

    private function encodeValue(mixed $value): array
    {
        if (is_bool($value)) return ['booleanValue' => $value];
        if (is_int($value)) return ['integerValue' => (string) $value];
        if (is_float($value)) return ['doubleValue' => $value];
        if (is_array($value)) {
            return ['arrayValue' => ['values' => array_map(fn ($item) => $this->encodeValue($item), array_values($value))]];
        }
        return ['stringValue' => (string) ($value ?? '')];
    }

    private function decodeDocument(array $doc): array
    {
        $fields = $doc['fields'] ?? [];
        $record = [];
        foreach ($fields as $key => $value) {
            $record[$key] = $this->decodeValue($value);
        }
        if (!isset($record['id']) && isset($doc['name'])) {
            $parts = explode('/', $doc['name']);
            $record['id'] = end($parts);
        }
        return $record;
    }

    private function decodeValue(array $value): mixed
    {
        if (array_key_exists('stringValue', $value)) return $value['stringValue'];
        if (array_key_exists('booleanValue', $value)) return (bool) $value['booleanValue'];
        if (array_key_exists('integerValue', $value)) return (int) $value['integerValue'];
        if (array_key_exists('doubleValue', $value)) return (float) $value['doubleValue'];
        if (array_key_exists('arrayValue', $value)) return array_map(fn ($item) => $this->decodeValue($item), $value['arrayValue']['values'] ?? []);
        return null;
    }
}
