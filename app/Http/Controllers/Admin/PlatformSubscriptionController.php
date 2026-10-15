<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Factory;
use App\Models\FactorySubscription;
use App\Models\SubscriptionPlan;
use App\Support\Catalogs\SubscriptionFeatureCatalog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformSubscriptionController extends Controller
{
    public function storePlan(Request $request): JsonResponse
    {
        $data = $this->validatePlan($request);
        $data['features'] ??= [];
        $code = strtoupper($data['code']);
        $plan = SubscriptionPlan::updateOrCreate(
            ['code' => $code],
            array_merge($data, ['code' => $code, 'is_active' => true]),
        );

        return response()->json($plan, $plan->wasRecentlyCreated ? 201 : 200);
    }

    public function updatePlan(Request $request, SubscriptionPlan $plan): JsonResponse
    {
        $data = $this->validatePlan($request, $plan);
        $data['code'] = strtoupper($data['code']);
        $plan->update($data);
        AuditLog::record('platform.subscription_plan_updated', "Updated subscription plan {$plan->name}", $plan);

        return response()->json($plan->fresh());
    }

    public function subscriptions(): JsonResponse
    {
        $allSubscriptions = FactorySubscription::with([
            'factory:id,name,status',
            'plan:id,name,code,features,monthly_price,currency_code',
        ])->get();

        $activeSubscriptions = $allSubscriptions->where('status', 'active');
        $activeCount = $activeSubscriptions->count();

        $mrr = $activeSubscriptions->sum(function ($sub) {
            return (float) ($sub->plan?->monthly_price ?? 0);
        });

        $totalRevenue = $allSubscriptions->sum(function ($sub) {
            if (! $sub->plan || ! $sub->starts_at || ! $sub->ends_at) {
                return 0;
            }
            $months = max(1, (int) round($sub->starts_at->floatDiffInMonths($sub->ends_at)));

            return $months * (float) $sub->plan->monthly_price;
        });

        $expiringSoon = $allSubscriptions
            ->filter(function ($sub) {
                return $sub->status === 'active' &&
                    $sub->ends_at &&
                    $sub->ends_at->isFuture() &&
                    $sub->ends_at->diffInDays(now()) <= 30;
            })
            ->count();

        $graceCount = $allSubscriptions
            ->filter(function ($sub) {
                return $sub->status === 'grace_period' ||
                    ($sub->ends_at &&
                        $sub->ends_at->isPast() &&
                        $sub->grace_ends_at &&
                        $sub->grace_ends_at->isFuture());
            })
            ->count();

        $factoriesCount = Factory::count();
        $subscribedFactories = $activeSubscriptions->pluck('factory_id')->unique()->count();
        $subscriptionRate = $factoriesCount > 0 ? round(($subscribedFactories / $factoriesCount) * 100) : 0;

        return response()->json([
            'feature_catalog' => SubscriptionFeatureCatalog::all(),
            'plans' => SubscriptionPlan::orderBy('monthly_price')->get(),
            'factories' => Factory::orderBy('name')->get(['id', 'name', 'status']),
            'analytics' => [
                'active_subscriptions' => $activeCount,
                'monthly_recurring_revenue' => $mrr,
                'total_revenue' => $totalRevenue,
                'expiring_soon' => $expiringSoon,
                'grace_period' => $graceCount,
                'subscribed_factories' => $subscribedFactories,
                'total_factories' => $factoriesCount,
                'subscription_rate' => $subscriptionRate,
            ],
            'subscriptions' => FactorySubscription::with([
                'factory:id,name,status',
                'plan:id,name,code,features,monthly_price,currency_code',
            ])
                ->latest()
                ->paginate(25),
        ]);
    }

    public function subscribe(Request $request, Factory $factory): JsonResponse
    {
        $data = $request->validate([
            'subscription_plan_id' => ['required', 'exists:subscription_plans,id'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'grace_ends_at' => ['nullable', 'date', 'after_or_equal:ends_at'],
            'auto_renew' => ['nullable', 'boolean'],
        ]);
        $subscription = FactorySubscription::create(
            $data + [
                'factory_id' => $factory->id,
                'status' => 'active',
            ],
        );
        $factory->update(['status' => 'active']);

        return response()->json($subscription->load('plan'), 201);
    }

    public function updateSubscription(Request $request, FactorySubscription $subscription): JsonResponse
    {
        $data = $request->validate([
            'subscription_plan_id' => ['required', 'exists:subscription_plans,id'],
            'status' => ['sometimes', Rule::in(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'])],
            'starts_at' => ['sometimes', 'date'],
            'ends_at' => ['sometimes', 'date'],
        ]);

        if (isset($data['ends_at'])) {
            $endDate = Carbon::parse($data['ends_at'])->endOfDay();
            $data['ends_at'] = $endDate;
            $data['grace_ends_at'] = $endDate;
            if ($endDate->isPast()) {
                $data['status'] = 'expired';
                $subscription->factory?->update(['status' => 'suspended']);
            } else {
                if (! isset($data['status']) || $subscription->status === 'expired') {
                    $data['status'] = 'active';
                }
                $subscription->factory?->update(['status' => 'active']);
            }
        }

        $subscription->update($data);
        AuditLog::record(
            'platform.subscription_changed',
            "Changed subscription for {$subscription->factory->name}",
            $subscription,
        );

        return response()->json($subscription->fresh()->load('plan'));
    }

    private function validatePlan(Request $request, ?SubscriptionPlan $plan = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:40', Rule::unique('subscription_plans', 'code')->ignore($plan?->id)],
            'monthly_price' => ['required', 'numeric', 'min:0'],
            'currency_code' => ['required', 'string', 'size:3'],
            'limits' => ['nullable', 'array'],
            'features' => ['sometimes', 'array'],
            'features.*' => ['string', Rule::in(SubscriptionFeatureCatalog::keys())],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
