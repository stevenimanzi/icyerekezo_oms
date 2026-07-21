<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformAvailable
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('/') || $request->is('api/auth/login') || $request->is('up')) {
            return $next($request);
        }
        if (! $request->user()?->is_platform_admin && SystemSetting::valueFor('maintenance_enabled', false)) {
            return $request->expectsJson() ? response()->json(['message' => SystemSetting::valueFor('maintenance_message', 'The platform is undergoing scheduled maintenance.')], 503) : response(SystemSetting::valueFor('maintenance_message', 'The platform is undergoing scheduled maintenance.'), 503);
        }

        return $next($request);
    }
}
