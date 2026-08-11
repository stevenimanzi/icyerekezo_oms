<?php

namespace App\Http\Middleware;

use App\Models\Factory;
use App\Models\FactorySubscription;
use App\Models\EmployeeProfile;
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
        $membership = $user->factories()->whereKey($user->current_factory_id)->wherePivot('is_active', true)->first();
        abort_unless($membership, 403, 'Factory access denied.');
        $factory = Factory::whereKey($user->current_factory_id)->where('status', 'active')->first();
        abort_unless($factory, 402, 'This factory is suspended. Contact the platform administrator.');
        $roles = $user->roles()->wherePivot('factory_id', $factory->id)->get();
        abort_unless($user->is_platform_admin || $roles->isNotEmpty(), 403, 'No role is assigned for this factory.');

        $profile = EmployeeProfile::withoutGlobalScopes()->with(['department', 'workstation'])
            ->where('factory_id', $factory->id)->where('user_id', $user->id)->first();
        abort_if($profile && $profile->employment_status !== 'active', 403, 'This employee profile is inactive.');
        abort_if($profile?->department && (int) $profile->department->factory_id !== (int) $factory->id, 403, 'Invalid department scope.');
        abort_if($profile?->workstation && (int) $profile->workstation->factory_id !== (int) $factory->id, 403, 'Invalid workstation scope.');
        abort_if($profile?->department_id && $profile?->workstation?->department_id && (int) $profile->department_id !== (int) $profile->workstation->department_id, 403, 'The workstation is outside the assigned department.');

        $request->attributes->set('factory', $factory);
        $request->attributes->set('factory_membership', $membership->pivot);
        $request->attributes->set('factory_roles', $roles);
        $request->attributes->set('employee_scope', $profile);
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
