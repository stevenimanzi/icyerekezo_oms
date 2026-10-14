<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;

class ManifestController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $name = SystemSetting::valueFor('system_name', 'ICYEREKEZO OMS');
        $shortName = strlen($name) <= 12 ? $name : explode(' ', trim($name))[0];

        return response()
            ->json([
                'name' => $name,
                'short_name' => $shortName,
                'description' => 'Factory operations, production and inventory management.',
                'start_url' => '/dashboard',
                'scope' => '/',
                'display' => 'standalone',
                'background_color' => '#f5f7fb',
                'theme_color' => '#2563eb',
                'orientation' => 'any',
                'icons' => [
                    ['src' => '/assets/images/pwa/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
                    ['src' => '/assets/images/pwa/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                    ['src' => '/assets/images/pwa/icon-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
                ],
            ])
            ->header('Content-Type', 'application/manifest+json');
    }
}
