<?php

namespace App\Support\Security;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

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
