<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequirePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        abort_unless($request->attributes->has('factory') && $request->attributes->has('factory_roles'), 403, 'Factory context was not verified.');
        $permissions = explode('|', $permission);
        $hasPermission = false;

        foreach ($permissions as $p) {
            if ($request->user()?->hasPermission($p)) {
                $hasPermission = true;
                break;
            }
        }

        abort_unless($hasPermission, 403, 'You do not have permission to perform this action.');

        return $next($request);
    }
}
