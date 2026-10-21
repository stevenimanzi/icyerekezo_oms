<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\DeliveryVehicle;
use App\Models\EmployeeProfile;
use App\Models\Item;
use App\Models\ProductionStageExecution;
use App\Models\QualityInspection;
use App\Models\SalesDocument;
use App\Models\Shipment;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Warehouse;
use App\Models\WorkAssignment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DepartmentDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $period = $request->query('period', 'daily');
        $dateParam = $request->query('date');
        $fromParam = $request->query('from', $dateParam);
        $toParam = $request->query('to', $dateParam);

        $today = today();
        $startDate = match ($period) {
            'daily' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfDay(),
            'weekly' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->subDays(6)->startOfDay(),
            'monthly' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfMonth(),
            'yearly', 'anualy' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfYear(),
            'custom', 'specific_date' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfDay(),
            'all_time' => Carbon::parse('2020-01-01')->startOfDay(),
            default => $today->copy()->startOfDay(),
        };

        $endDate = match ($period) {
            'daily' => $toParam ? Carbon::parse($toParam)->endOfDay() : ($fromParam ? Carbon::parse($fromParam)->endOfDay() : $today->copy()->endOfDay()),
            'custom', 'specific_date' => $toParam ? Carbon::parse($toParam)->endOfDay() : ($fromParam ? Carbon::parse($fromParam)->endOfDay() : $today->copy()->endOfDay()),
            default => $today->copy()->endOfDay(),
        };

        $specificDate = $endDate->copy();
        $now = $endDate->copy();
        $factoryId = $user->current_factory_id;
        $profile = EmployeeProfile::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->where('user_id', $user->id)
            ->with(['department.manager:id,name,email', 'workstation:id,name,code,type'])
            ->first();
        $department = $profile?->department;
        $isManager = $department && (int) $department->manager_id === (int) $user->id;
        $isWarehouse =
            $profile?->workstation?->type === 'warehouse' ||
            str_contains(strtolower((string) $profile?->job_title), 'warehouse') ||
            str_contains(strtolower((string) $profile?->job_title), 'store keeper') ||
            str_contains(strtolower((string) $department?->name), 'raw material') ||
            $user->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'warehouse-keeper')->exists();
        $isLogistics =
            str_contains(strtolower((string) $profile?->job_title), 'logistic') ||
            str_contains(strtolower((string) $profile?->job_title), 'dispatch') ||
            str_contains(strtolower((string) $profile?->job_title), 'delivery') ||
            str_contains(strtolower((string) $department?->name), 'logistic') ||
            str_contains(strtolower((string) $department?->name), 'dispatch') ||
            $user->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'logistics-officer')->exists();

        $isNoguchiFactory = $user->currentFactory?->hasNoguchiSchoolOrders() ?? false;

        $isFinishingUser =
            $isNoguchiFactory &&
            (str_contains(strtolower((string) $profile?->job_title), 'finishing') ||
                str_contains(strtolower((string) $department?->name), 'finishing') ||
                $user->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'finishing-manager')->exists());

        $isPackingUser =
            $isNoguchiFactory &&
            (str_contains(strtolower((string) $profile?->job_title), 'packing') ||
                str_contains(strtolower((string) $profile?->job_title), 'packaging') ||
                str_contains(strtolower((string) $department?->name), 'packing') ||
                str_contains(strtolower((string) $department?->name), 'packaging') ||
                $user
                    ->roles()
                    ->wherePivot('factory_id', $factoryId)
                    ->whereIn('slug', ['packing-manager', 'packaging-manager', 'packaging-operator'])
                    ->exists());

        $isQualityUser =
            str_contains(strtolower((string) $profile?->job_title), 'quality') ||
            str_contains(strtolower((string) $department?->name), 'quality') ||
            $user
                ->roles()
                ->wherePivot('factory_id', $factoryId)
                ->whereIn('slug', ['quality-manager', 'quality-officer'])
                ->exists();

        $isCutting =
            $user->workspace === 'cutting' ||
            str_contains(strtolower((string) $profile?->job_title), 'cutting') ||
            str_contains(strtolower((string) $department?->name), 'cutting') ||
            $user->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'cutting-operator')->exists();

        $isSewing =
            $user->workspace === 'sewing' ||
            str_contains(strtolower((string) $profile?->job_title), 'sewing') ||
            str_contains(strtolower((string) $department?->name), 'sewing') ||
            $user->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'sewing-operator')->exists();

        $employeeIds = $department
            ? EmployeeProfile::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('department_id', $department->id)
                ->pluck('user_id')
            : collect([$user->id]);
        $assignmentUserIds = $isManager ? $employeeIds : collect([$user->id]);
        $assignments = WorkAssignment::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->whereIn('user_id', $assignmentUserIds)
            ->with('user:id,name')
            ->latest('updated_at');

        $stageExecutions = ProductionStageExecution::withoutGlobalScopes()
            ->where('production_stage_executions.factory_id', $factoryId)
            ->when(
                $department,
                fn ($query) => $query->whereHas('stage', fn ($stage) => $stage->where('department_id', $department->id)),
            )
            ->when(! $department, fn ($query) => $query->where('assigned_user_id', $user->id));

        $stockBalances = StockBalance::withoutGlobalScopes()->where('stock_balances.factory_id', $factoryId);
        $stockTransactions = StockTransaction::withoutGlobalScopes()->where(
            'stock_transactions.factory_id',
            $factoryId,
        );
        $warehouseMetrics = [
            'stock_items' => Item::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('is_active', true)
                ->count(),
            'warehouses' => Warehouse::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('is_active', true)
                ->count(),
            'low_stock' => (clone $stockBalances)
                ->join('items', 'items.id', '=', 'stock_balances.item_id')
                ->whereColumn('stock_balances.quantity_on_hand', '<=', 'items.reorder_level')
                ->count(),
            'stock_value' => (float) (clone $stockBalances)
                ->join('items', 'items.id', '=', 'stock_balances.item_id')
                ->selectRaw('COALESCE(SUM(stock_balances.quantity_on_hand * items.standard_cost), 0) AS value')
                ->value('value'),
            'received_today' => (float) (clone $stockTransactions)
                ->whereBetween('occurred_at', [$startDate, $endDate])
                ->where('quantity_delta', '>', 0)
                ->sum('quantity_delta'),
            'issued_today' => abs(
                (float) (clone $stockTransactions)
                    ->whereBetween('occurred_at', [$startDate, $endDate])
                    ->where('quantity_delta', '<', 0)
                    ->sum('quantity_delta'),
            ),
        ];
        $recentStock = (clone $stockTransactions)
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')
            ->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->latest('stock_transactions.occurred_at')
            ->limit(15)
            ->get([
                'stock_transactions.id',
                'stock_transactions.type',
                'stock_transactions.quantity_delta',
                'stock_transactions.balance_after',
                'stock_transactions.occurred_at',
                'items.name as item_name',
                'items.sku',
                'warehouses.name as warehouse_name',
                'units.symbol as unit',
            ]);
        $stockStatus = (clone $stockBalances)
            ->join('items', 'items.id', '=', 'stock_balances.item_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->where('items.is_active', true)
            ->groupBy('items.id', 'items.name', 'items.sku', 'items.reorder_level', 'units.symbol')
            ->orderByRaw('SUM(stock_balances.quantity_on_hand) <= MAX(items.reorder_level) DESC')
            ->orderBy('items.name')
            ->limit(20)
            ->get([
                'items.id',
                'items.name',
                'items.sku',
                'items.reorder_level',
                'units.symbol as unit',
                DB::raw('SUM(stock_balances.quantity_on_hand) as quantity_on_hand'),
            ]);

        $stockTrends = match ($period) {
            'daily' => collect(range(23, 0))
                ->map(function (int $hoursAgo) use ($stockTransactions, $now) {
                    $time = $now->copy()->subHours($hoursAgo);
                    $hourTransactions = (clone $stockTransactions)->whereBetween('occurred_at', [
                        $time->copy()->startOfHour(),
                        $time->copy()->endOfHour(),
                    ]);

                    return [
                        'date' => $time->format('H:00'),
                        'received' => (float) (clone $hourTransactions)
                            ->where('quantity_delta', '>', 0)
                            ->sum('quantity_delta'),
                        'issued' => abs(
                            (float) (clone $hourTransactions)->where('quantity_delta', '<', 0)->sum('quantity_delta'),
                        ),
                    ];
                })
                ->values(),
            'weekly' => collect(range(6, 0))
                ->map(function (int $daysAgo) use ($stockTransactions, $now) {
                    $day = $now->copy()->subDays($daysAgo);
                    $dayTransactions = (clone $stockTransactions)->whereDate('occurred_at', $day);

                    return [
                        'date' => $day->format('M j'),
                        'received' => (float) (clone $dayTransactions)
                            ->where('quantity_delta', '>', 0)
                            ->sum('quantity_delta'),
                        'issued' => abs(
                            (float) (clone $dayTransactions)->where('quantity_delta', '<', 0)->sum('quantity_delta'),
                        ),
                    ];
                })
                ->values(),
            'monthly' => collect(range(3, 0))
                ->map(function (int $weeksAgo) use ($stockTransactions, $now) {
                    $start = $now->copy()->subWeeks($weeksAgo)->startOfWeek();
                    $end = $start->copy()->endOfWeek();
                    $weekTransactions = (clone $stockTransactions)->whereBetween('occurred_at', [$start, $end]);

                    return [
                        'date' => $start->format('d M') . ' - ' . $end->format('d M'),
                        'received' => (float) (clone $weekTransactions)
                            ->where('quantity_delta', '>', 0)
                            ->sum('quantity_delta'),
                        'issued' => abs(
                            (float) (clone $weekTransactions)->where('quantity_delta', '<', 0)->sum('quantity_delta'),
                        ),
                    ];
                })
                ->values(),
            'yearly' => collect(range(11, 0))
                ->map(function (int $monthsAgo) use ($stockTransactions, $now) {
                    $month = $now->copy()->subMonths($monthsAgo);
                    $monthTransactions = (clone $stockTransactions)
                        ->whereYear('occurred_at', $month->year)
                        ->whereMonth('occurred_at', $month->month);

                    return [
                        'date' => $month->format('M Y'),
                        'received' => (float) (clone $monthTransactions)
                            ->where('quantity_delta', '>', 0)
                            ->sum('quantity_delta'),
                        'issued' => abs(
                            (float) (clone $monthTransactions)->where('quantity_delta', '<', 0)->sum('quantity_delta'),
                        ),
                    ];
                })
                ->values(),
            default => collect(range(max(0, $now->year - 2025), 0))
                ->map(function (int $yearsAgo) use ($stockTransactions, $now) {
                    $year = $now->copy()->subYears($yearsAgo);
                    $yearTransactions = (clone $stockTransactions)->whereYear('occurred_at', $year->year);

                    return [
                        'date' => $year->format('Y'),
                        'received' => (float) (clone $yearTransactions)
                            ->where('quantity_delta', '>', 0)
                            ->sum('quantity_delta'),
                        'issued' => abs(
                            (float) (clone $yearTransactions)->where('quantity_delta', '<', 0)->sum('quantity_delta'),
                        ),
                    ];
                })
                ->values(),
        };

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
            'delivered_today' => (clone $shipmentsQuery)
                ->where('status', 'delivered')
                ->whereDate('delivered_at', $specificDate)
                ->count(),
            'delayed' => (clone $shipmentsQuery)
                ->whereNotIn('status', ['delivered', 'cancelled'])
                ->whereNotNull('planned_dispatch_at')
                ->where('planned_dispatch_at', '<', now())
                ->count(),
            'available_vehicles' => DeliveryVehicle::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('status', 'available')
                ->count(),
        ];

        if ($isNoguchiFactory) {
            $ordersQ = SalesDocument::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('document_type', 'customer_order');
            if ($period === 'specific_date') {
                $ordersQ->whereDate('document_date', $specificDate);
            }
            $logisticsMetrics['noguchi_total_orders'] = (clone $ordersQ)->count();
            $logisticsMetrics['noguchi_pending'] = (clone $ordersQ)->where('status', 'pending')->count();
            $logisticsMetrics['noguchi_accepted'] = (clone $ordersQ)
                ->whereNotIn('status', ['pending', 'rejected', 'cancelled', 'delivered'])
                ->count();
            $logisticsMetrics['noguchi_rejected'] = (clone $ordersQ)->where('status', 'rejected')->count();
            $logisticsMetrics['noguchi_delivered'] = (clone $ordersQ)->where('status', 'delivered')->count();
            $logisticsMetrics['noguchi_revenue'] = (clone $ordersQ)
                ->whereNotIn('status', ['rejected', 'cancelled'])
                ->sum('total_amount');
        }

        $logisticsTrends = match ($period) {
            'daily' => collect(range(23, 0))
                ->map(function (int $hoursAgo) use ($factoryId, $now, $isNoguchiFactory) {
                    $time = $now->copy()->subHours($hoursAgo);
                    $orders = SalesDocument::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('document_type', 'customer_order')
                        ->whereBetween('document_date', [
                            $time->copy()->startOfHour()->toDateString(),
                            $time->copy()->endOfHour()->toDateString(),
                        ]);
                    $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);

                    return [
                        'month' => $time->format('H:00'),
                        'month_number' => $time->hour,
                        'orders' => (clone $orders)->count(),
                        'order_value' => (float) (clone $orders)->sum('total_amount'),
                        'dispatched' => $isNoguchiFactory
                            ? 0
                            : (clone $shipments)
                                ->whereBetween('dispatched_at', [
                                    $time->copy()->startOfHour(),
                                    $time->copy()->endOfHour(),
                                ])
                                ->count(),
                        'delivered' => $isNoguchiFactory
                            ? (clone $orders)
                                ->whereIn('status', ['partial', 'delivered'])
                                ->whereBetween('updated_at', [$time->copy()->startOfHour(), $time->copy()->endOfHour()])
                                ->count()
                            : (clone $shipments)
                                ->whereBetween('delivered_at', [
                                    $time->copy()->startOfHour(),
                                    $time->copy()->endOfHour(),
                                ])
                                ->count(),
                    ];
                })
                ->values(),
            'weekly' => collect(range(6, 0))
                ->map(function (int $daysAgo) use ($factoryId, $now, $isNoguchiFactory) {
                    $day = $now->copy()->subDays($daysAgo);
                    $orders = SalesDocument::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('document_type', 'customer_order')
                        ->whereDate('document_date', $day);
                    $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);

                    return [
                        'month' => $day->format('M j'),
                        'month_number' => $day->dayOfYear,
                        'orders' => (clone $orders)->count(),
                        'order_value' => (float) (clone $orders)->sum('total_amount'),
                        'dispatched' => $isNoguchiFactory
                            ? 0
                            : (clone $shipments)->whereDate('dispatched_at', $day)->count(),
                        'delivered' => $isNoguchiFactory
                            ? (clone $orders)
                                ->whereIn('status', ['partial', 'delivered'])
                                ->whereDate('updated_at', $day)
                                ->count()
                            : (clone $shipments)->whereDate('delivered_at', $day)->count(),
                    ];
                })
                ->values(),
            'monthly' => collect(range(3, 0))
                ->map(function (int $weeksAgo) use ($factoryId, $now, $isNoguchiFactory) {
                    $start = $now->copy()->subWeeks($weeksAgo)->startOfWeek();
                    $end = $start->copy()->endOfWeek();
                    $orders = SalesDocument::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('document_type', 'customer_order')
                        ->whereBetween('document_date', [$start->toDateString(), $end->toDateString()]);
                    $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);

                    return [
                        'month' => $start->format('d M') . ' - ' . $end->format('d M'),
                        'month_number' => $start->weekOfYear,
                        'orders' => (clone $orders)->count(),
                        'order_value' => (float) (clone $orders)->sum('total_amount'),
                        'dispatched' => $isNoguchiFactory
                            ? 0
                            : (clone $shipments)->whereBetween('dispatched_at', [$start, $end])->count(),
                        'delivered' => $isNoguchiFactory
                            ? (clone $orders)
                                ->whereIn('status', ['partial', 'delivered'])
                                ->whereBetween('updated_at', [$start, $end])
                                ->count()
                            : (clone $shipments)->whereBetween('delivered_at', [$start, $end])->count(),
                    ];
                })
                ->values(),
            'yearly' => collect(range(11, 0))
                ->map(function (int $monthsAgo) use ($factoryId, $now, $isNoguchiFactory) {
                    $month = $now->copy()->startOfMonth()->subMonths($monthsAgo);
                    $orders = SalesDocument::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('document_type', 'customer_order')
                        ->whereBetween('document_date', [
                            $month->toDateString(),
                            $month->copy()->endOfMonth()->toDateString(),
                        ]);
                    $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);

                    return [
                        'month' => $month->format('M'),
                        'month_number' => $month->month,
                        'orders' => (clone $orders)->count(),
                        'order_value' => (float) (clone $orders)->sum('total_amount'),
                        'dispatched' => $isNoguchiFactory
                            ? 0
                            : (clone $shipments)
                                ->whereBetween('dispatched_at', [$month, $month->copy()->endOfMonth()])
                                ->count(),
                        'delivered' => $isNoguchiFactory
                            ? (clone $orders)
                                ->whereIn('status', ['partial', 'delivered'])
                                ->whereBetween('updated_at', [$month, $month->copy()->endOfMonth()])
                                ->count()
                            : (clone $shipments)
                                ->whereBetween('delivered_at', [$month, $month->copy()->endOfMonth()])
                                ->count(),
                    ];
                })
                ->values(),
            default => collect(range(max(0, $now->year - 2025), 0))
                ->map(function (int $yearsAgo) use ($factoryId, $now, $isNoguchiFactory) {
                    $year = $now->copy()->subYears($yearsAgo);
                    $orders = SalesDocument::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('document_type', 'customer_order')
                        ->whereYear('document_date', $year->year);
                    $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);

                    return [
                        'month' => $year->format('Y'),
                        'month_number' => $year->year,
                        'orders' => (clone $orders)->count(),
                        'order_value' => (float) (clone $orders)->sum('total_amount'),
                        'dispatched' => $isNoguchiFactory
                            ? 0
                            : (clone $shipments)->whereYear('dispatched_at', $year->year)->count(),
                        'delivered' => $isNoguchiFactory
                            ? (clone $orders)
                                ->whereIn('status', ['partial', 'delivered'])
                                ->whereYear('updated_at', $year->year)
                                ->count()
                            : (clone $shipments)->whereYear('delivered_at', $year->year)->count(),
                    ];
                })
                ->values(),
        };
        $incomingOrders = (clone $incomingOrdersQuery)
            ->latest('document_date')
            ->latest('id')
            ->limit(12)
            ->get([
                'id',
                'document_number',
                'customer_name',
                'status',
                'currency_code',
                'total_amount',
                'item_count',
                'document_date',
                'due_date',
            ]);
        $deliveryActivity = (clone $shipmentsQuery)
            ->with(['vehicle:id,registration_number,driver_name,status', 'salesDocument:id,document_number'])
            ->latest('updated_at')
            ->limit(15)
            ->get([
                'id',
                'shipment_number',
                'sales_document_id',
                'delivery_vehicle_id',
                'customer_name',
                'destination',
                'status',
                'package_count',
                'planned_dispatch_at',
                'dispatched_at',
                'delivered_at',
                'proof_reference',
                'updated_at',
            ]);

        $productionTrends = match ($period) {
            'daily' => collect(range(23, 0))
                ->map(function (int $hoursAgo) use ($stageExecutions, $now) {
                    $time = $now->copy()->subHours($hoursAgo);
                    $executions = (clone $stageExecutions)->whereBetween('updated_at', [
                        $time->copy()->startOfHour(),
                        $time->copy()->endOfHour(),
                    ]);

                    return [
                        'month' => $time->format('H:00'),
                        'month_number' => $time->hour,
                        'output' => (float) (clone $executions)->sum('output_quantity'),
                        'rejected' => (float) (clone $executions)->sum('rejected_quantity'),
                        'waste' => (float) (clone $executions)->sum('waste_quantity'),
                    ];
                })
                ->values(),
            'weekly' => collect(range(6, 0))
                ->map(function (int $daysAgo) use ($stageExecutions, $now) {
                    $day = $now->copy()->subDays($daysAgo);
                    $executions = (clone $stageExecutions)->whereDate('updated_at', $day);

                    return [
                        'month' => $day->format('M j'),
                        'month_number' => $day->dayOfYear,
                        'output' => (float) (clone $executions)->sum('output_quantity'),
                        'rejected' => (float) (clone $executions)->sum('rejected_quantity'),
                        'waste' => (float) (clone $executions)->sum('waste_quantity'),
                    ];
                })
                ->values(),
            'monthly' => collect(range(3, 0))
                ->map(function (int $weeksAgo) use ($stageExecutions, $now) {
                    $start = $now->copy()->subWeeks($weeksAgo)->startOfWeek();
                    $end = $start->copy()->endOfWeek();
                    $executions = (clone $stageExecutions)->whereBetween('updated_at', [$start, $end]);

                    return [
                        'month' => $start->format('d M') . ' - ' . $end->format('d M'),
                        'month_number' => $start->weekOfYear,
                        'output' => (float) (clone $executions)->sum('output_quantity'),
                        'rejected' => (float) (clone $executions)->sum('rejected_quantity'),
                        'waste' => (float) (clone $executions)->sum('waste_quantity'),
                    ];
                })
                ->values(),
            'yearly' => collect(range(11, 0))
                ->map(function (int $monthsAgo) use ($stageExecutions, $now) {
                    $month = $now->copy()->startOfMonth()->subMonths($monthsAgo);
                    $executions = (clone $stageExecutions)->whereBetween('updated_at', [
                        $month,
                        $month->copy()->endOfMonth(),
                    ]);

                    return [
                        'month' => $month->format('M'),
                        'month_number' => $month->month,
                        'output' => (float) (clone $executions)->sum('output_quantity'),
                        'rejected' => (float) (clone $executions)->sum('rejected_quantity'),
                        'waste' => (float) (clone $executions)->sum('waste_quantity'),
                    ];
                })
                ->values(),
            default => collect(range(max(0, $now->year - 2025), 0))
                ->map(function (int $yearsAgo) use ($stageExecutions, $now) {
                    $year = $now->copy()->subYears($yearsAgo);
                    $executions = (clone $stageExecutions)->whereYear('updated_at', $year->year);

                    return [
                        'month' => $year->format('Y'),
                        'month_number' => $year->year,
                        'output' => (float) (clone $executions)->sum('output_quantity'),
                        'rejected' => (float) (clone $executions)->sum('rejected_quantity'),
                        'waste' => (float) (clone $executions)->sum('waste_quantity'),
                    ];
                })
                ->values(),
        };

        $finishingProgress = [];
        if ($isFinishingUser) {
            $finishingOutputQuery = StockTransaction::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('type', 'issue')
                ->where('reason', 'LIKE', '[Finishing Output]%');

            $finishingProgress = [
                'weekly' => collect(range(6, 0))
                    ->map(function ($daysAgo) use ($finishingOutputQuery, $specificDate) {
                        $date = $specificDate->copy()->subDays($daysAgo);

                        return [
                            'period' => $date->format('D'),
                            'output' => abs(
                                (float) (clone $finishingOutputQuery)
                                    ->whereDate('occurred_at', $date)
                                    ->sum('quantity_delta'),
                            ),
                        ];
                    })
                    ->values(),
                'monthly' => collect(range(29, 0))
                    ->map(function ($daysAgo) use ($finishingOutputQuery, $specificDate) {
                        $date = $specificDate->copy()->subDays($daysAgo);

                        return [
                            'period' => $date->format('d M'),
                            'output' => abs(
                                (float) (clone $finishingOutputQuery)
                                    ->whereDate('occurred_at', $date)
                                    ->sum('quantity_delta'),
                            ),
                        ];
                    })
                    ->values(),
                'annually' => collect(range(11, 0))
                    ->map(function ($monthsAgo) use ($finishingOutputQuery) {
                        $month = now()->startOfMonth()->subMonths($monthsAgo);

                        return [
                            'period' => $month->format('M'),
                            'month_number' => $month->month,
                            'output' => abs(
                                (float) (clone $finishingOutputQuery)
                                    ->whereBetween('occurred_at', [$month, $month->copy()->endOfMonth()])
                                    ->sum('quantity_delta'),
                            ),
                        ];
                    })
                    ->values(),
            ];

            $finishingMetrics = [
                'pending_finishing' => abs(
                    (float) StockTransaction::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('type', 'receipt')
                        ->where('reason', 'LIKE', '[Finishing Receipt]%')
                        ->sum('quantity_delta'),
                ) - abs((float) (clone $finishingOutputQuery)->sum('quantity_delta')),
                'finished_today' => abs(
                    (float) (clone $finishingOutputQuery)
                        ->whereDate('occurred_at', $specificDate)
                        ->sum('quantity_delta'),
                ),
                'rejected_today' => abs(
                    (float) StockTransaction::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('type', 'issue')
                        ->where('reason', 'LIKE', '[Finishing Waste]%')
                        ->whereDate('occurred_at', $specificDate)
                        ->sum('quantity_delta'),
                ),
            ];
        }

        $packingProgress = [];
        $packingMetrics = null;
        if ($isPackingUser) {
            $packingOutputQuery = StockTransaction::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->where('type', 'issue')
                ->where('reason', 'LIKE', '[Packing Output]%');

            $packingProgress = [
                'weekly' => collect(range(6, 0))
                    ->map(function ($daysAgo) use ($packingOutputQuery, $specificDate) {
                        $date = $specificDate->copy()->subDays($daysAgo);

                        return [
                            'period' => $date->format('D'),
                            'output' => abs(
                                (float) (clone $packingOutputQuery)
                                    ->whereDate('occurred_at', $date)
                                    ->sum('quantity_delta'),
                            ),
                        ];
                    })
                    ->values(),
                'monthly' => collect(range(29, 0))
                    ->map(function ($daysAgo) use ($packingOutputQuery, $specificDate) {
                        $date = $specificDate->copy()->subDays($daysAgo);

                        return [
                            'period' => $date->format('d M'),
                            'output' => abs(
                                (float) (clone $packingOutputQuery)
                                    ->whereDate('occurred_at', $date)
                                    ->sum('quantity_delta'),
                            ),
                        ];
                    })
                    ->values(),
                'annually' => collect(range(11, 0))
                    ->map(function ($monthsAgo) use ($packingOutputQuery) {
                        $month = now()->startOfMonth()->subMonths($monthsAgo);

                        return [
                            'period' => $month->format('M'),
                            'month_number' => $month->month,
                            'output' => abs(
                                (float) (clone $packingOutputQuery)
                                    ->whereBetween('occurred_at', [$month, $month->copy()->endOfMonth()])
                                    ->sum('quantity_delta'),
                            ),
                        ];
                    })
                    ->values(),
            ];

            $packingMetrics = [
                'pending_packing' => abs(
                    (float) StockTransaction::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('type', 'receipt')
                        ->where('reason', 'LIKE', '[Packing Receipt]%')
                        ->sum('quantity_delta'),
                ) - abs((float) (clone $packingOutputQuery)->sum('quantity_delta')),
                'packed_today' => abs(
                    (float) (clone $packingOutputQuery)->whereDate('occurred_at', $specificDate)->sum('quantity_delta'),
                ),
                'deposited_to_warehouse' => abs(
                    (float) StockTransaction::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('type', 'receipt')
                        ->whereDate('occurred_at', $specificDate)
                        ->sum('quantity_delta'),
                ),
            ];
        }

        $qualityProgress = [];
        $qualityMetrics = null;
        $recentInspections = [];
        if ($isQualityUser) {
            $inspectionsQuery = QualityInspection::withoutGlobalScopes()->where('factory_id', $factoryId);
            $monthStart = now()->startOfMonth();
            $monthEnd = now()->endOfMonth();

            $monthTotal = (float) (clone $inspectionsQuery)
                ->whereBetween('inspected_at', [$monthStart, $monthEnd])
                ->sum('inspected_quantity');
            $monthPassed = (float) (clone $inspectionsQuery)
                ->whereBetween('inspected_at', [$monthStart, $monthEnd])
                ->sum('passed_quantity');

            $qualityProgress = [
                'weekly' => collect(range(6, 0))
                    ->map(function ($daysAgo) use ($inspectionsQuery, $specificDate) {
                        $date = $specificDate->copy()->subDays($daysAgo);

                        return [
                            'period' => $date->format('D'),
                            'inspections' => (clone $inspectionsQuery)
                                ->whereDate('inspected_at', $date)
                                ->sum('inspected_quantity'),
                            'passed' => (float) (clone $inspectionsQuery)
                                ->whereDate('inspected_at', $date)
                                ->sum('passed_quantity'),
                            'failed' => (float) (clone $inspectionsQuery)
                                ->whereDate('inspected_at', $date)
                                ->sum('rejected_quantity'),
                        ];
                    })
                    ->values(),
                'monthly' => collect(range(29, 0))
                    ->map(function ($daysAgo) use ($inspectionsQuery, $specificDate) {
                        $date = $specificDate->copy()->subDays($daysAgo);

                        return [
                            'period' => $date->format('d M'),
                            'inspections' => (clone $inspectionsQuery)
                                ->whereDate('inspected_at', $date)
                                ->sum('inspected_quantity'),
                            'passed' => (float) (clone $inspectionsQuery)
                                ->whereDate('inspected_at', $date)
                                ->sum('passed_quantity'),
                            'failed' => (float) (clone $inspectionsQuery)
                                ->whereDate('inspected_at', $date)
                                ->sum('rejected_quantity'),
                        ];
                    })
                    ->values(),
                'annually' => collect(range(11, 0))
                    ->map(function ($monthsAgo) use ($inspectionsQuery) {
                        $month = now()->startOfMonth()->subMonths($monthsAgo);

                        return [
                            'period' => $month->format('M'),
                            'month_number' => $month->month,
                            'inspections' => (clone $inspectionsQuery)
                                ->whereBetween('inspected_at', [$month, $month->copy()->endOfMonth()])
                                ->sum('inspected_quantity'),
                            'passed' => (float) (clone $inspectionsQuery)
                                ->whereBetween('inspected_at', [$month, $month->copy()->endOfMonth()])
                                ->sum('passed_quantity'),
                            'failed' => (float) (clone $inspectionsQuery)
                                ->whereBetween('inspected_at', [$month, $month->copy()->endOfMonth()])
                                ->sum('rejected_quantity'),
                        ];
                    })
                    ->values(),
            ];

            $qualityMetrics = [
                'pending_inspections' => (clone $inspectionsQuery)->where('result', 'pending')->count(),
                'inspections_today' => (float) (clone $inspectionsQuery)
                    ->whereDate('inspected_at', $specificDate)
                    ->sum('inspected_quantity'),
                'failed_today' => (float) (clone $inspectionsQuery)
                    ->whereDate('inspected_at', $specificDate)
                    ->sum('rejected_quantity'),
                'pass_rate' => $monthTotal > 0 ? round(($monthPassed / $monthTotal) * 100, 1) : 0,
            ];

            $recentInspections = (clone $inspectionsQuery)
                ->with(['order:id,order_number', 'item:id,name', 'inspector:id,name'])
                ->latest('id')
                ->limit(15)
                ->get();
        }

        // Whole Project & End-to-End Pipeline Overview
        $allOrdersCount = SalesDocument::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->whereIn('document_type', ['order', 'invoice', 'sales_order'])
            ->count();

        $allOrdersTarget = (float) SalesDocument::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->whereIn('document_type', ['order', 'invoice', 'sales_order'])
            ->sum('item_count');

        $prodOrdersQuery = DB::table('production_orders')->where('factory_id', $factoryId);
        $prodOrdersCount = (clone $prodOrdersQuery)->count();
        $prodPlannedQty = (float) (clone $prodOrdersQuery)->sum('planned_quantity');
        $prodCompletedQty = (float) (clone $prodOrdersQuery)->sum('completed_quantity');

        $totalProjectTarget = $allOrdersTarget > 0 ? $allOrdersTarget : ($prodPlannedQty > 0 ? $prodPlannedQty : 1000);

        // Cutting metrics across whole factory
        $cuttingExec = ProductionStageExecution::withoutGlobalScopes()
            ->where('production_stage_executions.factory_id', $factoryId)
            ->whereHas('stage', fn ($q) => $q->where('code', 'CUTTING'));
        $cuttingInput = (float) (clone $cuttingExec)->sum('input_quantity');
        $cuttingOutput = (float) (clone $cuttingExec)->sum('output_quantity');
        $cuttingWaste = (float) (clone $cuttingExec)->sum('waste_quantity');

        $cuttingTx = StockTransaction::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->where('reason', 'like', '%Cut%');
        if ($cuttingOutput == 0) {
            $cuttingOutput = abs((float) (clone $cuttingTx)->where('quantity_delta', '<', 0)->sum('quantity_delta'));
            $cuttingInput = abs((float) (clone $cuttingTx)->where('quantity_delta', '>', 0)->sum('quantity_delta'));
            if ($cuttingInput == 0 && $cuttingOutput > 0) {
                $cuttingInput = $cuttingOutput;
            }
        }

        // Sewing metrics across whole factory
        $sewingExec = ProductionStageExecution::withoutGlobalScopes()
            ->where('production_stage_executions.factory_id', $factoryId)
            ->whereHas('stage', fn ($q) => $q->where('code', 'SEWING'));
        $sewingInput = (float) (clone $sewingExec)->sum('input_quantity');
        $sewingOutput = (float) (clone $sewingExec)->sum('output_quantity');
        $sewingWaste = (float) (clone $sewingExec)->sum('waste_quantity');

        $sewingTx = StockTransaction::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->where('reason', 'like', '%Sew%');
        if ($sewingOutput == 0) {
            $sewingOutput = abs((float) (clone $sewingTx)->where('quantity_delta', '<', 0)->sum('quantity_delta'));
            $sewingInput = abs((float) (clone $sewingTx)->where('quantity_delta', '>', 0)->sum('quantity_delta'));
            if ($sewingInput == 0 && $sewingOutput > 0) {
                $sewingInput = $sewingOutput;
            }
        }

        if ($period !== 'all_time') {
            $cuttingExecInPeriod = (clone $cuttingExec)->whereBetween('updated_at', [$startDate, $endDate]);
            if ((clone $cuttingExecInPeriod)->count() > 0) {
                $cuttingInput = (float) (clone $cuttingExecInPeriod)->sum('input_quantity');
                $cuttingOutput = (float) (clone $cuttingExecInPeriod)->sum('output_quantity');
                $cuttingWaste = (float) (clone $cuttingExecInPeriod)->sum('waste_quantity');
            }

            $sewingExecInPeriod = (clone $sewingExec)->whereBetween('updated_at', [$startDate, $endDate]);
            if ((clone $sewingExecInPeriod)->count() > 0) {
                $sewingInput = (float) (clone $sewingExecInPeriod)->sum('input_quantity');
                $sewingOutput = (float) (clone $sewingExecInPeriod)->sum('output_quantity');
                $sewingWaste = (float) (clone $sewingExecInPeriod)->sum('waste_quantity');
            }
        }

        // Quality control metrics across whole factory
        $allInspections = QualityInspection::withoutGlobalScopes()->where('factory_id', $factoryId);
        if ($period !== 'all_time') {
            $allInspections->whereBetween('inspected_at', [$startDate, $endDate]);
        }
        $totalQcChecks = (clone $allInspections)->count();
        $passedQcChecks = (clone $allInspections)->where('result', 'passed')->count();
        $failedQcChecks = (clone $allInspections)->where('result', 'failed')->count();
        $overallQcRate = $totalQcChecks > 0 ? round(($passedQcChecks / $totalQcChecks) * 100, 1) : 100.0;

        // Finishing metrics
        $finishingExec = ProductionStageExecution::withoutGlobalScopes()
            ->where('production_stage_executions.factory_id', $factoryId)
            ->whereHas('stage', fn ($q) => $q->whereIn('code', ['FINISHING', 'PACKING', 'PACKAGING']));
        $finishingOutput = (float) (clone $finishingExec)->sum('output_quantity');
        if ($finishingOutput == 0 && isset($finishingMetrics['output_today'])) {
            $finishingOutput = (float) $finishingMetrics['output_today'];
        }

        // Logistics shipments
        $allShipments = Shipment::withoutGlobalScopes()->where('factory_id', $factoryId);
        $totalShipments = (clone $allShipments)->count();
        $deliveredShipments = (clone $allShipments)->where('status', 'delivered')->count();
        $inTransitShipments = (clone $allShipments)->whereIn('status', ['dispatched', 'in_transit'])->count();

        $totalProjectCompleted = $prodCompletedQty > 0 ? $prodCompletedQty : max($sewingOutput, $cuttingOutput);
        $completionPercent = $totalProjectTarget > 0 ? min(100.0, round(($totalProjectCompleted / $totalProjectTarget) * 100, 1)) : 0.0;

        $projectOverview = [
            'factory_name' => $user->currentFactory?->name ?? 'ICYEREKEZO Factory',
            'total_orders' => $allOrdersCount > 0 ? $allOrdersCount : $prodOrdersCount,
            'total_target_units' => $totalProjectTarget,
            'total_completed_units' => $totalProjectCompleted,
            'completion_rate' => $completionPercent,
            'overall_quality_pass_rate' => $overallQcRate,
            'qc_checks_count' => $totalQcChecks,
            'qc_passed_count' => $passedQcChecks,
            'qc_failed_count' => $failedQcChecks,
            'active_workstations' => (int) DB::table('workstations')->where('factory_id', $factoryId)->count(),
            'pipeline' => [
                [
                    'key' => 'warehouse',
                    'title' => 'Raw Materials & Warehouse',
                    'department' => 'Warehouse',
                    'status' => $warehouseMetrics['low_stock'] > 0 ? 'NEEDS RESTOCK' : 'STOCKED',
                    'input' => $warehouseMetrics['received_today'],
                    'input_label' => 'Materials received',
                    'output' => $warehouseMetrics['stock_items'],
                    'output_label' => 'Items in stock',
                    'damaged' => $warehouseMetrics['low_stock'],
                    'damaged_label' => 'Low stock alerts',
                    'qc_status' => 'INVENTORY VERIFIED',
                ],
                [
                    'key' => 'cutting',
                    'title' => 'Cutting Department',
                    'department' => 'Cutting',
                    'status' => $cuttingOutput > 0 ? 'ACTIVE' : 'READY',
                    'input' => $cuttingInput,
                    'input_label' => 'Fabric pieces/meters',
                    'output' => $cuttingOutput,
                    'output_label' => 'Cut pieces produced',
                    'damaged' => $cuttingWaste,
                    'damaged_label' => 'Fabric scrap / waste',
                    'qc_status' => $cuttingWaste == 0 && $cuttingOutput > 0 ? 'QC PASSED (100%)' : ($cuttingOutput > 0 ? 'QC MONITORED' : 'PENDING'),
                ],
                [
                    'key' => 'sewing',
                    'title' => 'Sewing Lines & Assembly',
                    'department' => 'Sewing',
                    'status' => $sewingOutput > 0 ? 'IN PRODUCTION' : 'READY',
                    'input' => $sewingInput > 0 ? $sewingInput : $cuttingOutput,
                    'input_label' => 'Cut pieces supplied',
                    'output' => $sewingOutput,
                    'output_label' => 'Garments sewn',
                    'damaged' => $sewingWaste,
                    'damaged_label' => 'Defects / Rework',
                    'qc_status' => $sewingWaste == 0 && $sewingOutput > 0 ? 'QC PASSED (100%)' : ($sewingOutput > 0 ? 'QC MONITORED' : 'PENDING'),
                ],
                [
                    'key' => 'quality',
                    'title' => 'Quality Control & Audit',
                    'department' => 'Quality Control',
                    'status' => $totalQcChecks > 0 ? ($failedQcChecks > 0 ? 'FLAGGED' : 'PASSED') : 'MONITORING',
                    'input' => $totalQcChecks,
                    'input_label' => 'Total QC audits',
                    'output' => $passedQcChecks,
                    'output_label' => 'Approved lots',
                    'damaged' => $failedQcChecks,
                    'damaged_label' => 'Rejected lots',
                    'qc_status' => "{$overallQcRate}% PASS RATE",
                ],
                [
                    'key' => 'finishing',
                    'title' => 'Finishing & Packaging',
                    'department' => 'Finishing & Packaging',
                    'status' => $finishingOutput > 0 ? 'COMPLETED' : 'READY',
                    'input' => $sewingOutput,
                    'input_label' => 'Sewn items received',
                    'output' => $finishingOutput > 0 ? $finishingOutput : $sewingOutput,
                    'output_label' => 'Packed goods',
                    'damaged' => 0,
                    'damaged_label' => 'Packing flaws',
                    'qc_status' => 'FINAL CHECK PASSED',
                ],
                [
                    'key' => 'logistics',
                    'title' => 'Logistics & Dispatch',
                    'department' => 'Logistics',
                    'status' => $inTransitShipments > 0 ? 'IN TRANSIT' : ($totalShipments > 0 ? 'DISPATCHED' : 'READY'),
                    'input' => $totalShipments,
                    'input_label' => 'Total consignments',
                    'output' => $deliveredShipments,
                    'output_label' => 'Delivered to clients',
                    'damaged' => $inTransitShipments,
                    'damaged_label' => 'Currently en route',
                    'qc_status' => 'DELIVERY CONFIRMED',
                ],
            ],
        ];

        $deptOverview = null;
        if ($isCutting) {
            $deptOverview = [
                'department_name' => 'Cutting Department',
                'stage_key' => 'cutting',
                'input' => $cuttingInput,
                'input_label' => 'Received Fabric',
                'in_progress' => (float) (clone $stageExecutions)->where('status', 'in_progress')->sum('input_quantity'),
                'output' => $cuttingOutput,
                'output_label' => 'Cut Pieces Output',
                'damaged' => $cuttingWaste,
                'damaged_label' => 'Fabric Waste / Scrap',
                'qc_status' => $cuttingWaste == 0 && $cuttingOutput > 0 ? 'PASSED (100%)' : ($cuttingOutput > 0 ? 'MONITORED' : 'PENDING'),
                'qc_rate' => $cuttingOutput > 0 ? round(($cuttingOutput / ($cuttingOutput + $cuttingWaste)) * 100, 1) : 100.0,
            ];
        } elseif ($isSewing) {
            $deptOverview = [
                'department_name' => 'Sewing Lines & Assembly',
                'stage_key' => 'sewing',
                'input' => $sewingInput > 0 ? $sewingInput : $cuttingOutput,
                'input_label' => 'Cut Pieces Received',
                'in_progress' => (float) (clone $stageExecutions)->where('status', 'in_progress')->sum('input_quantity'),
                'output' => $sewingOutput,
                'output_label' => 'Garments Sewn',
                'damaged' => $sewingWaste,
                'damaged_label' => 'Defects / Rework',
                'qc_status' => $sewingWaste == 0 && $sewingOutput > 0 ? 'PASSED (100%)' : ($sewingOutput > 0 ? 'MONITORED' : 'PENDING'),
                'qc_rate' => $sewingOutput > 0 ? round(($sewingOutput / ($sewingOutput + $sewingWaste)) * 100, 1) : 100.0,
            ];
        } elseif ($isFinishingUser) {
            $finRec = (float) ($finishingMetrics['received_today'] ?? $sewingOutput);
            $finOut = (float) ($finishingMetrics['output_today'] ?? $finishingOutput);
            $finDam = (float) ($finishingMetrics['damaged_today'] ?? 0);
            $deptOverview = [
                'department_name' => 'Finishing Department',
                'stage_key' => 'finishing',
                'input' => $finRec,
                'input_label' => 'Sewn Items Received',
                'in_progress' => (float) ($finishingMetrics['in_progress'] ?? 0),
                'output' => $finOut,
                'output_label' => 'Finished & Ironed',
                'damaged' => $finDam,
                'damaged_label' => 'Finishing Flaws',
                'qc_status' => $finishingMetrics['quality_status'] ?? 'PASSED (100%)',
                'qc_rate' => 100.0,
            ];
        } elseif ($isPackingUser) {
            $packRec = (float) ($packingMetrics['received_today'] ?? $finishingOutput);
            $packOut = (float) ($packingMetrics['packed_today'] ?? ($packingMetrics['output_today'] ?? 0));
            $packDam = (float) ($packingMetrics['damaged_today'] ?? 0);
            $deptOverview = [
                'department_name' => 'Packing & Packaging',
                'stage_key' => 'packing',
                'input' => $packRec,
                'input_label' => 'Finished Goods Received',
                'in_progress' => (float) ($packingMetrics['in_progress'] ?? 0),
                'output' => $packOut,
                'output_label' => 'Cartons / Boxes Packed',
                'damaged' => $packDam,
                'damaged_label' => 'Packaging Rejects',
                'qc_status' => 'FINAL CHECK PASSED',
                'qc_rate' => 100.0,
            ];
        } elseif ($isQualityUser) {
            $deptOverview = [
                'department_name' => 'Quality Control & Audit',
                'stage_key' => 'quality',
                'input' => $totalQcChecks,
                'input_label' => 'Inspection Audits',
                'in_progress' => (float) ($qualityMetrics['pending_reviews'] ?? 0),
                'output' => $passedQcChecks,
                'output_label' => 'Lots Approved',
                'damaged' => $failedQcChecks,
                'damaged_label' => 'Lots Rejected',
                'qc_status' => "{$overallQcRate}% PASS RATE",
                'qc_rate' => $overallQcRate,
            ];
        } elseif ($isWarehouse) {
            $deptOverview = [
                'department_name' => 'Warehouse & Inventory',
                'stage_key' => 'warehouse',
                'input' => (float) ($warehouseMetrics['received_today'] ?? 0),
                'input_label' => 'Raw Materials In',
                'in_progress' => (float) ($warehouseMetrics['pending_assignments'] ?? 0),
                'output' => (float) ($warehouseMetrics['issued_today'] ?? $warehouseMetrics['stock_items']),
                'output_label' => 'Items Issued / Available',
                'damaged' => (float) ($warehouseMetrics['low_stock'] ?? 0),
                'damaged_label' => 'Low Stock Alerts',
                'qc_status' => 'INVENTORY AUDITED',
                'qc_rate' => 100.0,
            ];
        } elseif ($isLogistics) {
            $deptOverview = [
                'department_name' => 'Logistics & Dispatch',
                'stage_key' => 'logistics',
                'input' => (float) $totalShipments,
                'input_label' => 'Total Consignments',
                'in_progress' => (float) $inTransitShipments,
                'output' => (float) $deliveredShipments,
                'output_label' => 'Delivered to Clients',
                'damaged' => (float) ($logisticsMetrics['delayed'] ?? 0),
                'damaged_label' => 'Delayed Shipments',
                'qc_status' => 'DELIVERY CONFIRMED',
                'qc_rate' => 100.0,
            ];
        } else {
            $deptOverview = [
                'department_name' => $department?->name ?? 'Production Operations',
                'stage_key' => 'production',
                'input' => $cuttingInput > 0 ? $cuttingInput : $totalProjectTarget,
                'input_label' => 'Introduced Materials',
                'in_progress' => (float) (clone $assignments)->where('status', 'in_progress')->count(),
                'output' => $totalProjectCompleted,
                'output_label' => 'Total Produced Units',
                'damaged' => (float) ($cuttingWaste + $sewingWaste),
                'damaged_label' => 'Scrap & Rejected',
                'qc_status' => "{$overallQcRate}% PASSED",
                'qc_rate' => $overallQcRate,
            ];
        }

        return response()->json([
            'department_overview' => $deptOverview,
            'project_overview' => $projectOverview,
            'department' => $department
                ? [
                    'id' => $department->id,
                    'name' => $department->name,
                    'code' => $department->code,
                    'manager' => $department->manager,
                    'employees_count' => $employeeIds->count(),
                ]
                : null,
            'profile' => $profile
                ? [
                    'employee_number' => $profile->employee_number,
                    'job_title' => $profile->job_title,
                    'workstation' => $profile->workstation,
                ]
                : null,
            'is_department_manager' => (bool) $isManager,
            'dashboard_type' => $isQualityUser
                ? 'quality'
                : ($isLogistics
                    ? 'logistics'
                    : ($isWarehouse
                        ? 'warehouse'
                        : 'production')),
            'metrics' => [
                'assigned_work' => (clone $assignments)->whereIn('status', ['assigned', 'ready'])->count(),
                'work_in_progress' => (clone $assignments)->where('status', 'in_progress')->count(),
                'completed_today' => (clone $assignments)
                    ->where('status', 'completed')
                    ->when($period !== 'all_time', fn ($q) => $q->whereBetween('completed_at', [$startDate, $endDate]))
                    ->count(),
                'stages_in_progress' => (clone $stageExecutions)->where('status', 'in_progress')->count(),
                'output_today' => (float) (clone $stageExecutions)
                    ->when($period !== 'all_time', fn ($q) => $q->whereBetween('updated_at', [$startDate, $endDate]))
                    ->sum('output_quantity'),
                'rejected_today' => (float) (clone $stageExecutions)
                    ->when($period !== 'all_time', fn ($q) => $q->whereBetween('updated_at', [$startDate, $endDate]))
                    ->sum('rejected_quantity'),
                'cutting_not_sewn' => (float) ProductionStageExecution::withoutGlobalScopes()
                    ->where('factory_id', $factoryId)
                    ->whereHas('stage', fn ($q) => $q->where('code', 'CUTTING'))
                    ->sum('output_quantity') -
                    (float) ProductionStageExecution::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->whereHas('stage', fn ($q) => $q->where('code', 'SEWING'))
                        ->sum('input_quantity'),
            ],
            'assignments' => $assignments
                ->limit(20)
                ->get([
                    'id',
                    'user_id',
                    'title',
                    'instructions',
                    'priority',
                    'status',
                    'starts_at',
                    'due_at',
                    'updated_at',
                ]),
            'stage_activity' => $stageExecutions
                ->with(['stage:id,name,code,sequence', 'order:id,order_number,item_id'])
                ->latest('updated_at')
                ->limit(15)
                ->get([
                    'id',
                    'production_order_id',
                    'workflow_stage_id',
                    'assigned_user_id',
                    'status',
                    'input_quantity',
                    'output_quantity',
                    'waste_quantity',
                    'rejected_quantity',
                    'started_at',
                    'completed_at',
                    'updated_at',
                ]),
            'warehouse_metrics' => $warehouseMetrics,
            'recent_stock' => $recentStock,
            'stock_status' => $stockStatus,
            'stock_trends' => $stockTrends,
            'logistics_metrics' => $logisticsMetrics,
            'logistics_trends' => $logisticsTrends,
            'production_trends' => $productionTrends,
            'incoming_orders' => $incomingOrders,
            'delivery_activity' => $deliveryActivity,
            'finishing_progress' => $finishingProgress,
            'finishing_metrics' => $finishingMetrics ?? null,
            'is_finishing_user' => (bool) $isFinishingUser,
            'is_packing_user' => (bool) $isPackingUser,
            'packing_progress' => $packingProgress,
            'packing_metrics' => $packingMetrics,
            'is_quality_user' => (bool) $isQualityUser,
            'quality_progress' => $qualityProgress,
            'quality_metrics' => $qualityMetrics,
            'recent_inspections' => $recentInspections,
        ]);
    }
}
