<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireExecutiveRole
{
    private const EXECUTIVE_ROLES = ['factory-owner', 'factory-administrator', 'factory-manager'];

    public function handle(Request $request, Closure $next): Response
    {
        $roles = $request->attributes->get('factory_roles');

        abort_unless($roles, 403, 'Factory context was not verified.');

        $isExecutive = $roles->contains(
            fn ($role) => in_array($role->slug, self::EXECUTIVE_ROLES, true) || $role->dashboard_key === 'executive',
        );

        abort_unless($isExecutive, 403, 'This view is for factory owners and managers.');

        return $next($request);
    }
}
