<?php

namespace App\Services;

use App\Models\DatabaseBackup;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;
use Throwable;

class DatabaseBackupService
{
    public function create(DatabaseBackup $backup): void
    {
        $directory = storage_path('app/private/backups');
        File::ensureDirectoryExists($directory);
        $filename = 'icyerekezo_oms_'.now()->format('Ymd_His').'.sql.gz';
        $path = $directory.DIRECTORY_SEPARATOR.$filename;
        $credentials = tempnam(sys_get_temp_dir(), 'icy_db_');
        try {
            File::put($credentials, "[client]\nuser=".config('database.connections.mysql.username')."\npassword=".config('database.connections.mysql.password')."\nhost=".config('database.connections.mysql.host')."\nport=".config('database.connections.mysql.port')."\n");
            $backup->update(['status' => 'running', 'started_at' => now()]);
            $stream = gzopen($path, 'wb9');
            $process = new Process(['mysqldump', '--defaults-extra-file='.$credentials, '--single-transaction', '--routines', '--triggers', config('database.connections.mysql.database')]);
            $process->setTimeout(3600);
            $process->run(function ($type, $buffer) use ($stream) {
                if ($type === Process::OUT) {
                    gzwrite($stream, $buffer);
                }
            });
            gzclose($stream);
            if (! $process->isSuccessful()) {
                throw new \RuntimeException(trim($process->getErrorOutput()) ?: 'Database backup command failed.');
            }
            $backup->update(['status' => 'completed', 'path' => 'backups/'.$filename, 'size_bytes' => filesize($path), 'completed_at' => now()]);
            $this->removeExpiredBackups();
        } catch (Throwable $exception) {
            if (isset($stream) && is_resource($stream)) {
                gzclose($stream);
            } if (File::exists($path)) {
                File::delete($path);
            }
            $backup->update(['status' => 'failed', 'error_message' => mb_substr($exception->getMessage(), 0, 2000), 'completed_at' => now()]);
        } finally {
            if ($credentials && File::exists($credentials)) {
                File::delete($credentials);
            }
        }
    }

    private function removeExpiredBackups(): void
    {
        $days = max(1, (int) SystemSetting::valueFor('backup_retention_days', 30));
        DatabaseBackup::where('status', 'completed')->where('completed_at', '<', now()->subDays($days))->get()->each(function (DatabaseBackup $oldBackup) {
            if ($oldBackup->path) {
                File::delete(storage_path('app/private/'.$oldBackup->path));
            }
            $oldBackup->delete();
        });
    }
}
