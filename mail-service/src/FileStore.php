<?php

declare(strict_types=1);

namespace MailService;

final class FileStore implements Store
{
    public function __construct(private string $basePath)
    {
        if (!is_dir($this->basePath)) {
            mkdir($this->basePath, 0770, true);
        }
    }

    public function list(string $collection): array
    {
        $dir = $this->dir($collection);
        if (!is_dir($dir)) {
            return [];
        }
        return array_values(array_filter(array_map(
            fn (string $file) => $this->readFile($file),
            glob($dir . '/*.json') ?: []
        )));
    }

    public function get(string $collection, string $id): ?array
    {
        return $this->readFile($this->path($collection, $id));
    }

    public function set(string $collection, string $id, array $data): array
    {
        $dir = $this->dir($collection);
        if (!is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        $record = ['id' => $id, ...$data, 'updatedAt' => gmdate('c')];
        file_put_contents($this->path($collection, $id), json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return $record;
    }

    public function delete(string $collection, string $id): void
    {
        $path = $this->path($collection, $id);
        if (is_file($path)) {
            unlink($path);
        }
    }

    private function dir(string $collection): string
    {
        return $this->basePath . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $collection);
    }

    private function path(string $collection, string $id): string
    {
        return $this->dir($collection) . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $id) . '.json';
    }

    private function readFile(string $file): ?array
    {
        if (!is_file($file)) {
            return null;
        }
        $data = json_decode(file_get_contents($file) ?: '', true);
        return is_array($data) ? $data : null;
    }
}
