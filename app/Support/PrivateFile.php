<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * Uploaded business documents (invoices, payment proofs, agreements) live on the
 * private disk and are only reachable through short-lived signed links.
 */
final class PrivateFile
{
    public const DIRECTORIES = ['agreement', 'invoices', 'payment-proofs'];

    public static function store(UploadedFile $file, string $directory): string
    {
        return $file->store($directory, 'local');
    }

    public static function delete(?string $path): void
    {
        if ($path && self::isAllowed($path)) {
            Storage::disk('local')->delete($path);
            Storage::disk('public')->delete($path);
        }
    }

    public static function url(?string $path): ?string
    {
        if (! $path || ! self::isAllowed($path)) {
            return null;
        }

        return URL::temporarySignedRoute('files.show', now()->addMinutes(30), ['path' => $path], absolute: false);
    }

    /** Disk holding the file, or null. Legacy uploads may still sit on the public disk. */
    public static function diskFor(string $path): ?string
    {
        if (! self::isAllowed($path)) {
            return null;
        }
        foreach (['local', 'public'] as $disk) {
            if (Storage::disk($disk)->exists($path)) {
                return $disk;
            }
        }

        return null;
    }

    public static function isAllowed(string $path): bool
    {
        if (str_contains($path, '..') || str_contains($path, "\0") || str_contains($path, chr(92)) ||str_starts_with($path, '/')) {
            return false;
        }

        return in_array(explode('/', $path)[0], self::DIRECTORIES, true);
    }
}
