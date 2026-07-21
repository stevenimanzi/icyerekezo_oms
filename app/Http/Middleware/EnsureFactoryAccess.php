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
        $subscription = FactorySubscription::where('factory_id', $user->current_factory_id)->latest('ends_at')->first();
        if ($subscription && $subscription->ends_at->isPast() && (! $subscription->grace_ends_at || $subscription->grace_ends_at->isPast())) {
            abort(402, 'The factory subscription has expired.');
        }

        return $next($request);
    }
}
