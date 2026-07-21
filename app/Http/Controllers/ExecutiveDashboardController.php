<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\ProductionOrder;
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
        $productionToday = (float) ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereDate('updated_at', today())->sum('completed_quantity');
        $openOrders = ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereIn('status', $openStatuses)->count();
        $inventoryValue = (float) StockBalance::withoutGlobalScopes()->where('stock_balances.factory_id', $factoryId)->join('items', 'items.id', '=', 'stock_balances.item_id')->sum(DB::raw('stock_balances.quantity_on_hand * items.standard_cost'));
        $lowStock = Item::withoutGlobalScopes()->select('items.id', 'items.reorder_level')->where('items.factory_id', $factoryId)->where('items.is_active', true)->leftJoin('stock_balances', 'stock_balances.item_id', '=', 'items.id')->groupBy('items.id', 'items.reorder_level')->havingRaw('COALESCE(SUM(stock_balances.quantity_on_hand), 0) <= items.reorder_level')->get()->count();
        $totals = ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->selectRaw('COALESCE(SUM(planned_quantity),0) planned, COALESCE(SUM(completed_quantity),0) completed')->first();
        $completionRate = (float) $totals->planned > 0 ? round(((float) $totals->completed / (float) $totals->planned) * 100, 1) : 0;

        $chart = collect(range(6, 0))->map(function (int $daysAgo) use ($factoryId) {
            $date = today()->subDays($daysAgo);

            return [
                'date' => $date->format('d M'),
                'actual' => (float) ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereDate('completed_at', $date)->sum('completed_quantity'),
                'target' => (float) ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->whereDate('planned_end', $date)->sum('planned_quantity'),
            ];
        });

        return response()->json([
            'metrics' => compact('productionToday', 'openOrders', 'inventoryValue', 'lowStock', 'completionRate'),
            'chart' => $chart,
            'activities' => AuditLog::where('factory_id', $factoryId)->with('user:id,name')->latest()->limit(8)->get(['id', 'user_id', 'event', 'description', 'created_at']),
            'orders' => ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->with('item:id,name,sku')->whereIn('status', $openStatuses)->latest()->limit(10)->get(['id', 'order_number', 'item_id', 'planned_quantity', 'completed_quantity', 'status', 'planned_end']),
        ]);
    }
}
