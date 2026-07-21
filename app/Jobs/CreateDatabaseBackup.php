<?php

namespace App\Jobs;

use App\Models\DatabaseBackup;
use App\Services\DatabaseBackupService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CreateDatabaseBackup implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $backupId) {}

    public function handle(DatabaseBackupService $service): void
    {
        $service->create(DatabaseBackup::findOrFail($this->backupId));
    }
}
