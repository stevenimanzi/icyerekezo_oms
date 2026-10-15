<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Support\Reports\OwnerOverviewReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerOverviewController extends Controller
{
    private const ALLOWED_DAYS = [7, 30, 90, 365];

    public function __invoke(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 30);

        if (! in_array($days, self::ALLOWED_DAYS, true)) {
            $days = 30;
        }

        $user = $request->user();
        $factoryId = (int) ($user->currentFactory?->id ?? $user->current_factory_id);

        return response()->json((new OwnerOverviewReport($factoryId, $days))->build());
    }
}
