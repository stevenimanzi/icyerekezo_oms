<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Support\Reports\OwnerOverviewReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class OwnerOverviewController extends Controller
{
    private const ALLOWED_DAYS = [1, 7, 30, 90, 365];

    private const CACHE_SECONDS = 30;

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $factoryId = (int) ($user->currentFactory?->id ?? $user->current_factory_id);

        $from = $request->query('from');
        $to = $request->query('to');

        if ($from && $to) {
            $fromDate = rescue(fn () => \Carbon\Carbon::parse($from)->startOfDay());
            $toDate = rescue(fn () => \Carbon\Carbon::parse($to)->endOfDay());
            if ($fromDate && $toDate && $fromDate->lte($toDate)) {
                $report = (new OwnerOverviewReport(
                    $factoryId,
                    max(1, (int) $fromDate->diffInDays($toDate) + 1),
                    $fromDate,
                    $toDate,
                ))->build();

                return response()->json($report);
            }
        }

        $days = (int) $request->query('days', 30);

        if (! in_array($days, self::ALLOWED_DAYS, true)) {
            $days = 30;
        }

        $report = Cache::remember(
            "owner-overview:{$factoryId}:{$days}",
            self::CACHE_SECONDS,
            fn () => (new OwnerOverviewReport($factoryId, $days))->build(),
        );

        return response()->json($report);
    }
}
