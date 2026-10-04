<?php

namespace App\Console\Commands;

use App\Support\PrivateFile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class SecureLegacyUploads extends Command
{
    protected $signature = 'files:secure-legacy';

    protected $description = 'Move previously public invoices, payment proofs and agreements to the private disk';

    public function handle(): int
    {
        $public = Storage::disk('public');
        $private = Storage::disk('local');
        $moved = 0;
        foreach (PrivateFile::DIRECTORIES as $directory) {
            foreach ($public->allFiles($directory) as $path) {
                $private->put($path, $public->get($path));
                $public->delete($path);
                $moved++;
            }
        }
        $this->info("Moved {$moved} file(s) to private storage.");

        return self::SUCCESS;
    }
}
