<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\CreateDatabaseBackup;
use App\Models\AuditLog;
use App\Models\DatabaseBackup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformBackupController extends Controller
{
    public function backups(): JsonResponse
    {
        return response()->json(DatabaseBackup::latest()->paginate(25));
    }

    public function backup(Request $request): JsonResponse
    {
        $backup = DatabaseBackup::create(['requested_by' => $request->user()->id, 'status' => 'pending']);
        CreateDatabaseBackup::dispatchSync($backup->id);
        AuditLog::record('platform.backup_requested', 'Database backup requested', $backup);

        return response()->json($backup->fresh(), 202);
    }
}
