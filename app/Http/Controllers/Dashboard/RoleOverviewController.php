<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Support\Reports\OwnerOverviewReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** The factory overview, cut down to the parts this person's permissions allow, for roles that have no dashboard of their own. */
class RoleOverviewController extends Controller
{
    private const ALLOWED_DAYS = [7, 30, 90, 365];

    /** Which part of the overview each permission unlocks. */
    private const SECTIONS = [
        'cash' => ['finance.view'],
        'customers' => ['sales.view', 'logistics.view'],
        'stock' => ['inventory.view', 'procurement.view'],
        'equipment' => ['maintenance.view'],
        'quality' => ['quality.view'],
        'flow' => ['production.view'],
        'production' => ['production.view'],
    ];

    public function __invoke(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 30);
        $days = in_array($days, self::ALLOWED_DAYS, true) ? $days : 30;

        $user = $request->user();
        $factoryId = (int) ($user->currentFactory?->id ?? $user->current_factory_id);

        $report = Cache::remember(
            "owner-overview:{$factoryId}:{$days}",
            30,
            fn () => (new OwnerOverviewReport($factoryId, $days))->build(),
        );

        $allowed = collect(self::SECTIONS)
            ->filter(fn (array $permissions) => collect($permissions)->contains(fn (string $permission) => $user->hasPermission($permission)))
            ->keys();

        $sections = $allowed->mapWithKeys(fn (string $key) => [$key => $report[$key] ?? null])->all();

        // Show the stage flow where the factory uses it, and the older production figures where it does not.
        if (($report['flow'] ?? null) !== null) {
            unset($sections['production']);
        } else {
            unset($sections['flow']);
        }

        return response()->json([
            'period' => $report['period'],
            'sections' => array_keys(array_filter($sections, fn ($value) => $value !== null)),
            'growth' => [
                'revenue' => $allowed->contains('customers') ? $report['growth']['revenue'] : null,
                'orders' => $allowed->contains('customers') ? $report['growth']['orders'] : null,
                'units_delivered' => $allowed->contains('customers') ? $report['growth']['units_delivered'] : null,
                'output' => $allowed->contains('flow') || $allowed->contains('production') ? $report['growth']['output'] : null,
                'collected' => $allowed->contains('cash') ? $report['growth']['collected'] : null,
            ],
        ] + $sections);
    }
}
