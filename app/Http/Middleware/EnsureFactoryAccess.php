<?php

namespace App\Http\Middleware;

use App\Models\Factory;
use App\Models\FactorySubscription;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFactoryAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_unless($user && $user->is_active !== false, 403, 'This account is inactive.');
        abort_unless($user->current_factory_id, 409, 'Select a factory to continue.');
        abort_unless($user->factories()->whereKey($user->current_factory_id)->wherePivot('is_active', true)->exists(), 403, 'Factory access denied.');
        abort_unless(Factory::whereKey($user->current_factory_id)->where('status', 'active')->exists(), 402, 'This factory is suspended. Contact the platform administrator.');
        $subscription = FactorySubscription::with('plan')->where('factory_id', $user->current_factory_id)->latest('ends_at')->first();
        if ($subscription && $subscription->ends_at->isPast() && (! $subscription->grace_ends_at || $subscription->grace_ends_at->isPast())) {
            abort(402, 'The factory subscription has expired.');
        }
        $path = $request->path();
        $feature = match (true) {
            str_starts_with($path, 'api/executive/'), str_starts_with($path, 'api/department/') => 'dashboard',
            str_starts_with($path, 'api/manufacturing/'), str_starts_with($path, 'api/factory/flow-') => 'production',
            str_starts_with($path, 'api/inventory/'), str_starts_with($path, 'api/factory/setup-'), str_starts_with($path, 'api/factory/units'), str_starts_with($path, 'api/factory/warehouses') => 'inventory',
            str_starts_with($path, 'api/team/') => 'team',
            str_starts_with($path, 'api/quality/') => 'quality',
            str_starts_with($path, 'api/machines/'), str_starts_with($path, 'api/maintenance') => 'maintenance',
            str_starts_with($path, 'api/reports') => 'reports',
            default => null,
        };
        if ($subscription?->plan && $feature && ! in_array($feature, $subscription->plan->features ?? [], true)) {
            abort(403, 'This feature is not included in the factory subscription plan.');
        }

        return $next($request);
    }
}
