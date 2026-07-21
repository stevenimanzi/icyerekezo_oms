<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFactoryAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_unless($user && $user->is_active, 403, 'This account is inactive.');
        abort_unless($user->current_factory_id, 409, 'Select a factory to continue.');
        abort_unless($user->factories()->whereKey($user->current_factory_id)->wherePivot('is_active', true)->exists(), 403, 'Factory access denied.');

        return $next($request);
    }
}
