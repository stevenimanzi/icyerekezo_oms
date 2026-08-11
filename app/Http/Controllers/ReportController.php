<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\DeliveryVehicle;
use App\Models\ProductionStageExecution;
use App\Models\SalesDocument;
use App\Models\Shipment;
use App\Models\StockTransaction;
use App\Support\IndustryDailyReportCatalog;
use App\Support\OperationalScope;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $factory = $request->user()->currentFactory;
        $roles = $request->attributes->get('factory_roles') ?? $request->user()->roles()->wherePivot('factory_id', $factory->id)->get();
        $isExecutive = $request->user()->is_platform_admin || $roles->whereIn('slug', ['factory-owner', 'factory-administrator', 'factory-manager'])->isNotEmpty();
        $dashboardKey = (string) ($roles->first()?->dashboard_key ?? 'operations');
        $logisticsOnly = ! $isExecutive && in_array($dashboardKey, ['logistics', 'warehouse'], true);
        $departmentOnly = ! $isExecutive && ! $logisticsOnly;
        $operationalScope = OperationalScope::for($request->user());
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'week', 'month', 'custom'])],
            'type' => ['nullable', Rule::in(['all', 'departments', 'production', 'inventory', 'activity'])],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factory->id)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', Rule::in(['pending', 'accepted', 'rejected', 'partial', 'delivered'])],
            'district' => ['nullable', 'string', 'max:80'],
        ]);
        [$from, $to] = $this->range($data);
        $type = $departmentOnly ? 'production' : ($logisticsOnly ? 'inventory' : ($data['type'] ?? 'all'));
        $departmentId = isset($data['department_id']) ? (int) $data['department_id'] : null;
        if ($departmentOnly) {
            $departmentId = $operationalScope->profile?->department_id;
            if (! $departmentId) {
                $departmentId = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)
                    ->where(fn ($query) => $query->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower(str_replace('_', ' ', $dashboardKey)).'%'])->orWhereRaw('LOWER(code) = ?', [strtolower($dashboardKey)]))
                    ->value('id');
            }
        }
        $configuredDepartmentIds = collect($factory->settings['report']['department_ids'] ?? [])->map(fn ($id) => (int) $id)->filter()->unique();

        $flowDepartmentIds = DB::table('workflow_stages')
            ->join('workflow_templates', 'workflow_templates.id', '=', 'workflow_stages.workflow_template_id')
            ->where('workflow_templates.factory_id', $factory->id)->where('workflow_templates.status', 'active')
            ->whereNotNull('workflow_stages.department_id')->distinct()->pluck('workflow_stages.department_id');
        if ($departmentOnly && $departmentId && ! $flowDepartmentIds->contains($departmentId)) {
            abort(403, 'This department is not part of the active production flow.');
        }

        $departments = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)
            ->when($departmentOnly, fn ($query) => $query->whereIn('id', $flowDepartmentIds))
            ->when(! $departmentId && $configuredDepartmentIds->isNotEmpty(), fn ($query) => $query->whereIn('id', $configuredDepartmentIds))
            ->when($departmentId, fn ($query) => $query->whereKey($departmentId))
            ->orderBy('name')->get();

        $executions = ProductionStageExecution::withoutGlobalScopes()->where('production_stage_executions.factory_id', $factory->id)
            ->whereBetween('production_stage_executions.updated_at', [$from, $to])
            ->join('workflow_stages', 'workflow_stages.id', '=', 'production_stage_executions.workflow_stage_id')
            ->join('production_orders', 'production_orders.id', '=', 'production_stage_executions.production_order_id')
            ->leftJoin('items', 'items.id', '=', 'production_orders.item_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->when($logisticsOnly || ($departmentOnly && ! $departmentId), fn ($query) => $query->whereRaw('1 = 0'))
            ->when(! $departmentId && $configuredDepartmentIds->isNotEmpty(), fn ($query) => $query->whereIn('workflow_stages.department_id', $configuredDepartmentIds))
            ->when($departmentId, fn ($query) => $query->where('workflow_stages.department_id', $departmentId))
            ->select('production_stage_executions.id', 'production_stage_executions.status', 'production_stage_executions.input_quantity', 'production_stage_executions.output_quantity', 'production_stage_executions.waste_quantity', 'production_stage_executions.rejected_quantity', 'production_stage_executions.updated_at', 'workflow_stages.department_id', 'workflow_stages.name as stage_name', 'production_orders.id as production_order_id', 'production_orders.order_number', 'items.name as product_name', 'units.name as unit_name', 'units.symbol as unit_symbol')
            ->latest('production_stage_executions.updated_at')->get();

        $departmentActivity = $departments->map(function ($department) use ($executions) {
            $records = $executions->where('department_id', $department->id);

            return [
                'id' => $department->id, 'code' => $department->code, 'name' => $department->name,
                'production_orders' => $records->pluck('production_order_id')->unique()->count(),
                'work_records' => $records->count(), 'completed_records' => $records->where('status', 'completed')->count(),
                'in_progress_stages' => $records->where('status', 'in_progress')->count(),
                'received_quantity' => (float) $records->sum('input_quantity'),
                'completed_quantity' => (float) $records->sum('output_quantity'), 'damaged_quantity' => (float) $records->sum('rejected_quantity'),
                'waste_quantity' => (float) $records->sum('waste_quantity'),
                'unit' => $records->pluck('unit_symbol')->filter()->unique()->count() === 1 ? $records->pluck('unit_symbol')->filter()->first() : ($records->isEmpty() ? '—' : 'mixed'),
            ];
        })->values();

        $inventory = ! $departmentOnly && in_array($type, ['all', 'inventory'], true) ? StockTransaction::withoutGlobalScopes()
            ->where('stock_transactions.factory_id', $factory->id)->whereBetween('occurred_at', [$from, $to])
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
            ->select('stock_transactions.id', 'stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.unit_cost', 'stock_transactions.balance_after', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku', 'warehouses.name as warehouse_name')->latest('occurred_at')->get() : collect();

        $dailyActivity = $executions->groupBy(fn ($record) => $record->updated_at->toDateString())
            ->sortKeys()
            ->map(function ($dayRecords, $date) {
                return [
                    'date' => $date,
                    'departments' => $dayRecords->groupBy('department_id')->map(function ($departmentRecords) {
                        return [
                            'department_id' => (int) $departmentRecords->first()->department_id,
                            'department' => Department::withoutGlobalScopes()->find($departmentRecords->first()->department_id)?->name ?? 'Unassigned',
                            'records' => $departmentRecords->groupBy(fn ($record) => implode('|', [$record->production_order_id, $record->stage_name, $record->product_name, $record->unit_symbol]))
                                ->map(fn ($records) => [
                                    'order_number' => $records->first()->order_number,
                                    'product' => $records->first()->product_name ?? 'Unspecified product',
                                    'work_step' => $records->first()->stage_name,
                                    'received' => (float) $records->sum('input_quantity'),
                                    'completed' => (float) $records->sum('output_quantity'),
                                    'damaged' => (float) $records->sum('rejected_quantity'),
                                    'waste' => (float) $records->sum('waste_quantity'),
                                    'unit' => $records->first()->unit_symbol ?: 'unit',
                                ])->values(),
                        ];
                    })->values(),
                ];
            })->values();

        $stockRegister = $inventory->groupBy(fn ($record) => implode('|', [$record->item_name, $record->sku, $record->warehouse_name]))
            ->map(function ($records) {
                $ordered = $records->sortBy('occurred_at')->values();
                $first = $ordered->first();
                $last = $ordered->last();

                return [
                    'item' => $first->item_name,
                    'sku' => $first->sku,
                    'warehouse' => $first->warehouse_name,
                    'opening_balance' => (float) $first->balance_after - (float) $first->quantity_delta,
                    'quantity_in' => (float) $ordered->where('quantity_delta', '>', 0)->sum('quantity_delta'),
                    'quantity_out' => abs((float) $ordered->where('quantity_delta', '<', 0)->sum('quantity_delta')),
                    'closing_balance' => (float) $last->balance_after,
                ];
            })->values();

        $logistics = null;
        if ($logisticsOnly) {
            $orderQuery = SalesDocument::withoutGlobalScopes()->where('sales_documents.factory_id', $factory->id)
                ->where('document_type', 'customer_order')->whereBetween('document_date', [$from->toDateString(), $to->toDateString()])
                ->with(['school:id,name,district,sector', 'lines:id,sales_document_id,quantity_delivered,quantity_rejected,rejection_reason', 'shipments.vehicle']);
            $orderQuery->when($data['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
                ->when($data['district'] ?? null, fn ($query, $district) => $query->whereHas('school', fn ($school) => $school->where('district', $district)));
            $logisticsOrders = $orderQuery->latest('document_date')->latest('id')->get();
            $shipments = Shipment::withoutGlobalScopes()->where('factory_id', $factory->id)
                ->where(fn ($query) => $query->whereBetween('created_at', [$from, $to])->orWhereBetween('planned_dispatch_at', [$from, $to])->orWhereBetween('delivered_at', [$from, $to]))
                ->with(['vehicle', 'salesDocument:id,document_number'])->latest()->get();
            $vehicles = DeliveryVehicle::withoutGlobalScopes()->where('factory_id', $factory->id)->orderBy('registration_number')->get();
            $delivered = $logisticsOrders->sum(fn ($order) => $order->lines->sum('quantity_delivered'));
            $rejected = $logisticsOrders->sum(fn ($order) => $order->lines->sum('quantity_rejected'));
            $logistics = [
                'summary' => [
                    'orders_processed' => $logisticsOrders->count(), 'items_ordered' => (int) $logisticsOrders->sum('item_count'),
                    'items_delivered' => (int) $delivered, 'items_remaining' => max(0, (int) $logisticsOrders->sum('item_count') - (int) $delivered),
                    'items_returned' => (int) $rejected, 'total_value' => (float) $logisticsOrders->sum('total_amount'),
                    'shipments' => $shipments->count(), 'deliveries_completed' => $shipments->where('status', 'delivered')->count(),
                ],
                'order_statuses' => $logisticsOrders->countBy('status')->map(fn ($count, $status) => ['status' => $status, 'count' => $count])->values(),
                'return_reasons' => $logisticsOrders->flatMap->lines->where('quantity_rejected', '>', 0)->groupBy(fn ($line) => $line->rejection_reason ?: 'Reason not specified')->map(fn ($lines, $reason) => ['reason' => $reason, 'quantity' => (int) $lines->sum('quantity_rejected')])->values(),
                'orders' => $logisticsOrders,
                'shipments' => $shipments,
                'vehicles' => $vehicles,
            ];
        }

        return response()->json([
            'factory' => $factory->only(['name', 'industry_type', 'email', 'phone', 'currency_code', 'timezone']),
            'standard' => array_replace(
                IndustryDailyReportCatalog::for($factory->industry_type),
                array_filter($factory->settings['report'] ?? [], fn ($value) => $value !== '' && $value !== []),
                $logisticsOnly ? ['title' => 'Daily logistics report', 'orientation' => 'landscape', 'show_department_totals' => false, 'show_daily_register' => false] : ($departmentOnly ? ['title' => ($departments->first()?->name ?? ucfirst($dashboardKey)).' daily report', 'show_stock_register' => false] : [])
            ),
            'filters' => ['departments' => $isExecutive ? Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)->when($configuredDepartmentIds->isNotEmpty(), fn ($query) => $query->whereIn('id', $configuredDepartmentIds))->orderBy('name')->get(['id', 'name']) : [], 'districts' => $logisticsOnly ? SalesDocument::withoutGlobalScopes()->where('sales_documents.factory_id', $factory->id)->where('document_type', 'customer_order')->join('schools', 'schools.id', '=', 'sales_documents.school_id')->whereNotNull('schools.district')->distinct()->orderBy('schools.district')->pluck('schools.district') : []],
            'report' => ['scope' => $logisticsOnly ? 'logistics' : ($departmentOnly ? 'department' : 'factory'), 'scope_label' => $logisticsOnly ? 'Logistics' : ($departments->first()?->name ?? 'Whole factory'), 'type' => $type, 'period' => $data['period'] ?? 'week', 'department_id' => $departmentId, 'from' => $from->toDateString(), 'to' => $to->toDateString(), 'generated_at' => now()->toIso8601String(), 'generated_by' => $request->user()->name],
            'summary' => array_filter([($departmentOnly ? 'flow_categories' : 'departments') => $departmentActivity->count(), 'production_orders' => $executions->pluck('production_order_id')->unique()->count(), 'work_records' => $executions->count(), 'completed_records' => $executions->where('status', 'completed')->count(), 'quantity_received' => (float) $executions->sum('input_quantity'), 'quantity_completed' => (float) $executions->sum('output_quantity'), 'damaged_quantity' => (float) $executions->sum('rejected_quantity'), 'waste_quantity' => (float) $executions->sum('waste_quantity'), 'stock_movements' => $departmentOnly ? null : $inventory->count()], fn ($value) => $value !== null),
            'department_activity' => $departmentActivity,
            'daily_activity' => $dailyActivity,
            'stock_register' => $stockRegister,
            'production' => in_array($type, ['all', 'departments', 'production'], true) ? $executions : [],
            'inventory' => $inventory,
            'activities' => [],
            'logistics' => $logistics,
        ]);
    }

    private function range(array $data): array
    {
        $period = $data['period'] ?? 'week';
        if ($period === 'custom') {
            return [Carbon::parse($data['from'] ?? today())->startOfDay(), Carbon::parse($data['to'] ?? today())->endOfDay()];
        }

        return match ($period) {
            'day' => [today()->startOfDay(), today()->endOfDay()],
            'month' => [today()->startOfMonth(), today()->endOfDay()],
            default => [today()->subDays(6)->startOfDay(), today()->endOfDay()],
        };
    }
}
