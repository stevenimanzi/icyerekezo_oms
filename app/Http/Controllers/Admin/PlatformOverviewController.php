<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DatabaseBackup;
use App\Models\Factory;
use App\Models\FactorySubscription;
use App\Models\SupportTicket;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class PlatformOverviewController extends Controller
{
    public function overview(): JsonResponse
    {
        $start = now()->subMonths(11)->startOfMonth();
        $models = [
            'factories' => Factory::class,
            'users' => User::class,
            'subscriptions' => FactorySubscription::class,
        ];
        $totals = [];
        $monthly = [];

        foreach ($models as $key => $model) {
            $totals[$key] = $model::where('created_at', '<', $start)->count();
            $monthly[$key] = $model::where('created_at', '>=', $start)
                ->get(['created_at'])
                ->countBy(fn ($record) => $record->created_at->format('Y-m'));
        }

        $growth = [];
        for ($month = $start->copy(); $month->lte(now()); $month->addMonth()) {
            $date = $month->format('Y-m');
            foreach (array_keys($models) as $key) {
                $totals[$key] += $monthly[$key]->get($date, 0);
            }
            $growth[] = ['date' => $date, 'label' => $month->format('M Y'), ...$totals];
        }

        $revenue = FactorySubscription::with('plan')
            ->get()
            ->sum(function ($sub) {
                if (! $sub->plan || ! $sub->starts_at || ! $sub->ends_at) {
                    return 0;
                }
                $months = max(1, (int) round($sub->starts_at->floatDiffInMonths($sub->ends_at)));

                return $months * (float) $sub->plan->monthly_price;
            });

        return response()->json([
            'statistics' => [
                'factories' => Factory::count(),
                'active_factories' => Factory::where('status', 'active')->count(),
                'users' => User::count(),
                'revenue' => $revenue,
                'open_tickets' => SupportTicket::whereNotIn('status', ['resolved', 'closed'])->count(),
            ],
            'growth' => $growth,
            'factories' => Factory::withCount('users')->latest()->limit(10)->get(),
            'subscriptions' => FactorySubscription::with(['factory:id,name,status', 'plan:id,name'])
                ->latest()
                ->limit(10)
                ->get(),
            'tickets' => SupportTicket::with('messages')->latest()->limit(10)->get(),
            'backups' => DatabaseBackup::latest()->limit(10)->get(),
            'activities' => AuditLog::with('user:id,name,email')->latest()->limit(15)->get(),
            'settings' => SystemSetting::pluck('value', 'key'),
        ]);
    }
}
