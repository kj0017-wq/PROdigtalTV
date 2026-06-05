<?php

declare(strict_types=1);

namespace MailService;

interface Store
{
    public function list(string $collection): array;
    public function get(string $collection, string $id): ?array;
    public function set(string $collection, string $id, array $data): array;
    public function delete(string $collection, string $id): void;
}
