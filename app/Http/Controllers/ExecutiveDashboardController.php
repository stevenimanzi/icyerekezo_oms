<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\ProductionOrder;
use App\Models\ProductionStageExecution;
use App\Models\StockBalance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExecutiveDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $openStatuses = ['draft', 'planned', 'approved', 'in_progress', 'paused'];
        $productionToday = (float) ProductionStageExecution::withoutGlobalScopes()->where('factory_id', $factoryId)->where('status', 'completed')->whereDate('completed_at', today())->sum('output_quantity');
        $openOrders = ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereIn('status', $openStatuses)->count();
        $inventoryValue = (float) StockBalance::withoutGlobalScopes()->where('stock_balances.factory_id', $factoryId)->join('items', 'items.id', '=', 'stock_balances.item_id')->sum(DB::raw('stock_balances.quantity_on_hand * items.standard_cost'));
        $lowStock = Item::withoutGlobalScopes()->select('items.id', 'items.reorder_level')->where('items.factory_id', $factoryId)->where('items.is_active', true)->leftJoin('stock_balances', 'stock_balances.item_id', '=', 'items.id')->groupBy('items.id', 'items.reorder_level')->havingRaw('COALESCE(SUM(stock_balances.quantity_on_hand), 0) <= items.reorder_level')->get()->count();
        $totals = ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->selectRaw('COALESCE(SUM(planned_quantity),0) planned, COALESCE(SUM(completed_quantity),0) completed')->first();
        $completionRate = (float) $totals->planned > 0 ? round(((float) $totals->completed / (float) $totals->planned) * 100, 1) : 0;

        $period = $request->query('period', 'all_time');
        $now = now();
        
        $chart = match ($period) {
            'daily' => collect(range(23, 0))->map(function (int $hoursAgo) use ($factoryId, $now) {
                $date = $now->copy()->subHours($hoursAgo);
                return [
                    'date' => $date->format('H:00'),
                    'actual' => (float) ProductionStageExecution::withoutGlobalScopes()->where('factory_id', $factoryId)->where('status', 'completed')->whereBetween('completed_at', [$date->copy()->startOfHour(), $date->copy()->endOfHour()])->sum('output_quantity'),
                    'target' => 0,
                ];
            }),
            'weekly' => collect(range(6, 0))->map(function (int $daysAgo) use ($factoryId, $now) {
                $date = $now->copy()->subDays($daysAgo);
                return [
                    'date' => $date->format('d M'),
                    'actual' => (float) ProductionStageExecution::withoutGlobalScopes()->where('factory_id', $factoryId)->where('status', 'completed')->whereDate('completed_at', $date)->sum('output_quantity'),
                    'target' => (float) ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereDate('planned_end', $date)->sum('planned_quantity'),
                ];
            }),
            'monthly' => collect(range(3, 0))->map(function (int $weeksAgo) use ($factoryId, $now) {
                $start = $now->copy()->subWeeks($weeksAgo)->startOfWeek();
                $end = $start->copy()->endOfWeek();
                return [
                    'date' => $start->format('d M') . ' - ' . $end->format('d M'),
                    'actual' => (float) ProductionStageExecution::withoutGlobalScopes()->where('factory_id', $factoryId)->where('status', 'completed')->whereBetween('completed_at', [$start, $end])->sum('output_quantity'),
                    'target' => (float) ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereBetween('planned_end', [$start, $end])->sum('planned_quantity'),
                ];
            }),
            'yearly' => collect(range(11, 0))->map(function (int $monthsAgo) use ($factoryId, $now) {
                $date = $now->copy()->subMonths($monthsAgo);
                return [
                    'date' => $date->format('M Y'),
                    'actual' => (float) ProductionStageExecution::withoutGlobalScopes()->where('factory_id', $factoryId)->where('status', 'completed')->whereYear('completed_at', $date->year)->whereMonth('completed_at', $date->month)->sum('output_quantity'),
                    'target' => (float) ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereYear('planned_end', $date->year)->whereMonth('planned_end', $date->month)->sum('planned_quantity'),
                ];
            }),
            default => collect(range(4, 0))->map(function (int $yearsAgo) use ($factoryId, $now) {
                $date = $now->copy()->subYears($yearsAgo);
                return [
                    'date' => $date->format('Y'),
                    'actual' => (float) ProductionStageExecution::withoutGlobalScopes()->where('factory_id', $factoryId)->where('status', 'completed')->whereYear('completed_at', $date->year)->sum('output_quantity'),
                    'target' => (float) ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereYear('planned_end', $date->year)->sum('planned_quantity'),
                ];
            }),
        };

        return response()->json([
            'metrics' => compact('productionToday', 'openOrders', 'inventoryValue', 'lowStock', 'completionRate'),
            'chart' => $chart,
            'activities' => AuditLog::where('factory_id', $factoryId)->with('user:id,name')->latest()->limit(8)->get(['id', 'user_id', 'event', 'description', 'created_at']),
            'orders' => ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->with('item:id,name,sku')->whereIn('status', $openStatuses)->latest()->limit(10)->get(['id', 'order_number', 'item_id', 'planned_quantity', 'completed_quantity', 'status', 'planned_end']),
        ]);
    }
}
