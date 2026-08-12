<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\DeliveryVehicle;
use App\Models\EmployeeProfile;
use App\Models\Item;
use App\Models\ProductionStageExecution;
use App\Models\SalesDocument;
use App\Models\Shipment;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Warehouse;
use App\Models\WorkAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $factoryId = $user->current_factory_id;
        $profile = EmployeeProfile::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->where('user_id', $user->id)
            ->with(['department.manager:id,name,email', 'workstation:id,name,code,type'])
            ->first();
        $department = $profile?->department;
        $isManager = $department && (int) $department->manager_id === (int) $user->id;
        $isWarehouse = $profile?->workstation?->type === 'warehouse'
            || str_contains(strtolower((string) $profile?->job_title), 'warehouse')
            || str_contains(strtolower((string) $profile?->job_title), 'store keeper')
            || str_contains(strtolower((string) $department?->name), 'raw material')
            || $user->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'warehouse-keeper')->exists();
        $isLogistics = str_contains(strtolower((string) $profile?->job_title), 'logistic')
            || str_contains(strtolower((string) $profile?->job_title), 'dispatch')
            || str_contains(strtolower((string) $profile?->job_title), 'delivery')
            || str_contains(strtolower((string) $department?->name), 'logistic')
            || str_contains(strtolower((string) $department?->name), 'dispatch')
            || $user->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'logistics-officer')->exists();

        $employeeIds = $department
            ? EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factoryId)->where('department_id', $department->id)->pluck('user_id')
            : collect([$user->id]);
        $assignmentUserIds = $isManager ? $employeeIds : collect([$user->id]);
        $assignments = WorkAssignment::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->whereIn('user_id', $assignmentUserIds)
            ->with('user:id,name')
            ->latest('updated_at');

        $stageExecutions = ProductionStageExecution::withoutGlobalScopes()
            ->where('production_stage_executions.factory_id', $factoryId)
            ->when($department, fn ($query) => $query->whereHas('stage', fn ($stage) => $stage->where('department_id', $department->id)))
            ->when(! $department, fn ($query) => $query->where('assigned_user_id', $user->id));

        $stockBalances = StockBalance::withoutGlobalScopes()->where('stock_balances.factory_id', $factoryId);
        $stockTransactions = StockTransaction::withoutGlobalScopes()->where('stock_transactions.factory_id', $factoryId);
        $warehouseMetrics = [
            'stock_items' => Item::withoutGlobalScopes()->where('factory_id', $factoryId)->where('is_active', true)->count(),
            'warehouses' => Warehouse::withoutGlobalScopes()->where('factory_id', $factoryId)->where('is_active', true)->count(),
            'low_stock' => (clone $stockBalances)->join('items', 'items.id', '=', 'stock_balances.item_id')->whereColumn('stock_balances.quantity_on_hand', '<=', 'items.reorder_level')->count(),
            'stock_value' => (float) (clone $stockBalances)->join('items', 'items.id', '=', 'stock_balances.item_id')->selectRaw('COALESCE(SUM(stock_balances.quantity_on_hand * items.standard_cost), 0) AS value')->value('value'),
            'received_today' => (float) (clone $stockTransactions)->whereDate('occurred_at', today())->where('quantity_delta', '>', 0)->sum('quantity_delta'),
            'issued_today' => abs((float) (clone $stockTransactions)->whereDate('occurred_at', today())->where('quantity_delta', '<', 0)->sum('quantity_delta')),
        ];
        $recentStock = (clone $stockTransactions)
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')
            ->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->latest('stock_transactions.occurred_at')->limit(15)
            ->get(['stock_transactions.id', 'stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.balance_after', 'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku', 'warehouses.name as warehouse_name', 'units.symbol as unit']);

        $activeOrderStatuses = ['draft', 'pending', 'confirmed', 'approved', 'processing', 'ready'];
        $incomingOrdersQuery = SalesDocument::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->where('document_type', 'customer_order')
            ->whereIn('status', $activeOrderStatuses);
        $shipmentsQuery = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);
        $logisticsMetrics = [
            'incoming_orders' => (clone $incomingOrdersQuery)->count(),
            'ready_to_dispatch' => (clone $shipmentsQuery)->whereIn('status', ['planned', 'ready'])->count(),
            'in_transit' => (clone $shipmentsQuery)->whereIn('status', ['dispatched', 'in_transit'])->count(),
            'delivered_today' => (clone $shipmentsQuery)->where('status', 'delivered')->whereDate('delivered_at', today())->count(),
            'delayed' => (clone $shipmentsQuery)->whereNotIn('status', ['delivered', 'cancelled'])->whereNotNull('planned_dispatch_at')->where('planned_dispatch_at', '<', now())->count(),
            'available_vehicles' => DeliveryVehicle::withoutGlobalScopes()->where('factory_id', $factoryId)->where('status', 'available')->count(),
        ];
        $logisticsTrends = collect(range(5, 0))->map(function (int $monthsAgo) use ($factoryId) {
            $month = now()->startOfMonth()->subMonths($monthsAgo);
            $orders = SalesDocument::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('document_type', 'customer_order')
                ->whereBetween('document_date', [$month->toDateString(), $month->copy()->endOfMonth()->toDateString()]);
            $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);

            return [
                'month' => $month->format('M'),
                'month_number' => $month->month,
                'orders' => (clone $orders)->count(),
                'order_value' => (float) (clone $orders)->sum('total_amount'),
                'dispatched' => (clone $shipments)->whereBetween('dispatched_at', [$month, $month->copy()->endOfMonth()])->count(),
                'delivered' => (clone $shipments)->whereBetween('delivered_at', [$month, $month->copy()->endOfMonth()])->count(),
            ];
        })->values();
        $incomingOrders = (clone $incomingOrdersQuery)
            ->latest('document_date')->latest('id')->limit(12)
            ->get(['id', 'document_number', 'customer_name', 'status', 'currency_code', 'total_amount', 'item_count', 'document_date', 'due_date']);
        $deliveryActivity = (clone $shipmentsQuery)
            ->with(['vehicle:id,registration_number,driver_name,status', 'salesDocument:id,document_number'])
            ->latest('updated_at')->limit(15)
            ->get(['id', 'shipment_number', 'sales_document_id', 'delivery_vehicle_id', 'customer_name', 'destination', 'status', 'package_count', 'planned_dispatch_at', 'dispatched_at', 'delivered_at', 'proof_reference', 'updated_at']);

        return response()->json([
            'department' => $department ? [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
                'manager' => $department->manager,
                'employees_count' => $employeeIds->count(),
            ] : null,
            'profile' => $profile ? [
                'employee_number' => $profile->employee_number,
                'job_title' => $profile->job_title,
                'workstation' => $profile->workstation,
            ] : null,
            'is_department_manager' => (bool) $isManager,
            'dashboard_type' => $isLogistics ? 'logistics' : ($isWarehouse ? 'warehouse' : 'production'),
            'metrics' => [
                'assigned_work' => (clone $assignments)->whereIn('status', ['assigned', 'ready'])->count(),
                'work_in_progress' => (clone $assignments)->where('status', 'in_progress')->count(),
                'completed_today' => (clone $assignments)->where('status', 'completed')->whereDate('completed_at', today())->count(),
                'stages_in_progress' => (clone $stageExecutions)->where('status', 'in_progress')->count(),
                'output_today' => (float) (clone $stageExecutions)->whereDate('updated_at', today())->sum('output_quantity'),
                'rejected_today' => (float) (clone $stageExecutions)->whereDate('updated_at', today())->sum('rejected_quantity'),
            ],
            'assignments' => $assignments->limit(20)->get(['id', 'user_id', 'title', 'instructions', 'priority', 'status', 'starts_at', 'due_at', 'updated_at']),
            'stage_activity' => $stageExecutions->with(['stage:id,name,code,sequence', 'order:id,order_number,item_id'])->latest('updated_at')->limit(15)->get(['id', 'production_order_id', 'workflow_stage_id', 'assigned_user_id', 'status', 'input_quantity', 'output_quantity', 'waste_quantity', 'rejected_quantity', 'started_at', 'completed_at', 'updated_at']),
            'warehouse_metrics' => $warehouseMetrics,
            'recent_stock' => $recentStock,
            'logistics_metrics' => $logisticsMetrics,
            'logistics_trends' => $logisticsTrends,
            'incoming_orders' => $incomingOrders,
            'delivery_activity' => $deliveryActivity,
        ]);
    }
}
