<?php

namespace App\Http\Controllers\System;

use App\Support\Security\PrivateFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Http\Controllers\Controller;

class PrivateFileController extends Controller
{
    public function __invoke(Request $request): StreamedResponse
    {
        $path = (string) $request->query('path', '');
        $disk = PrivateFile::diskFor($path);
        abort_unless($disk, 404);

        return Storage::disk($disk)->response($path, null, ['Content-Security-Policy' => "default-src 'none'; sandbox", 'Cache-Control' => 'private, max-age=600']);
    }
}
