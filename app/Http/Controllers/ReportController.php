<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\EmployeeProfile;
use App\Models\ProductionStageExecution;
use App\Models\StockTransaction;
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
        $productionOnly = $request->user()->roles()->wherePivot('factory_id', $factory->id)->where('dashboard_key', 'production')->exists()
            && ! $request->user()->roles()->wherePivot('factory_id', $factory->id)->whereIn('slug', ['factory-owner', 'factory-administrator', 'factory-manager'])->exists();
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'week', 'month', 'custom'])],
            'type' => ['nullable', Rule::in(['all', 'departments', 'production', 'inventory', 'activity'])],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factory->id)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        [$from, $to] = $this->range($data);
        $type = $productionOnly ? 'production' : ($data['type'] ?? 'all');
        $departmentId = isset($data['department_id']) ? (int) $data['department_id'] : null;

        $flowDepartmentIds = DB::table('workflow_stages')
            ->join('workflow_templates', 'workflow_templates.id', '=', 'workflow_stages.workflow_template_id')
            ->where('workflow_templates.factory_id', $factory->id)->where('workflow_templates.status', 'active')
            ->whereNotNull('workflow_stages.department_id')->distinct()->pluck('workflow_stages.department_id');
        if ($productionOnly && $departmentId && ! $flowDepartmentIds->contains($departmentId)) {
            abort(403, 'This department is not part of the active production flow.');
        }

        $departments = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)
            ->when($productionOnly, fn ($query) => $query->whereIn('id', $flowDepartmentIds))
            ->when($departmentId, fn ($query) => $query->whereKey($departmentId))
            ->orderBy('name')->get();

        $executions = ProductionStageExecution::withoutGlobalScopes()->where('production_stage_executions.factory_id', $factory->id)
            ->whereBetween('production_stage_executions.updated_at', [$from, $to])
            ->join('workflow_stages', 'workflow_stages.id', '=', 'production_stage_executions.workflow_stage_id')
            ->join('production_orders', 'production_orders.id', '=', 'production_stage_executions.production_order_id')
            ->leftJoin('items', 'items.id', '=', 'production_orders.item_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->when($departmentId, fn ($query) => $query->where('workflow_stages.department_id', $departmentId))
            ->select('production_stage_executions.id', 'production_stage_executions.status', 'production_stage_executions.input_quantity', 'production_stage_executions.output_quantity', 'production_stage_executions.waste_quantity', 'production_stage_executions.rejected_quantity', 'production_stage_executions.updated_at', 'workflow_stages.department_id', 'workflow_stages.name as stage_name', 'production_orders.id as production_order_id', 'production_orders.order_number', 'items.name as product_name', 'units.name as unit_name', 'units.symbol as unit_symbol')
            ->latest('production_stage_executions.updated_at')->get();

        $operationalEvents = ['production.%', 'inventory.%', 'quality.%', 'work.%', 'procurement.%', 'logistics.%', 'sales.%', 'maintenance.%'];
        $activitiesQuery = AuditLog::where('factory_id', $factory->id)->whereBetween('created_at', [$from, $to])
            ->where(fn ($query) => collect($operationalEvents)->each(fn ($pattern) => $query->orWhere('event', 'like', $pattern)));
        if ($departmentId) {
            $userIds = EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factory->id)->where('department_id', $departmentId)->pluck('user_id');
            $activitiesQuery->whereIn('user_id', $userIds);
        }
        $activities = $productionOnly ? collect() : $activitiesQuery->with('user:id,name')->latest()->get(['id', 'user_id', 'event', 'description', 'created_at']);
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

        $inventory = ! $productionOnly && in_array($type, ['all', 'inventory'], true) ? StockTransaction::withoutGlobalScopes()
            ->where('stock_transactions.factory_id', $factory->id)->whereBetween('occurred_at', [$from, $to])
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
            ->select('stock_transactions.id', 'stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.unit_cost', 'stock_transactions.balance_after', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku', 'warehouses.name as warehouse_name')->latest('occurred_at')->get() : collect();

        return response()->json([
            'factory' => $factory->only(['name', 'industry_type', 'email', 'phone', 'currency_code', 'timezone']),
            'filters' => ['departments' => Department::withoutGlobalScopes()->where('factory_id', $factory->id)->where('is_active', true)->when($productionOnly, fn ($query) => $query->whereIn('id', $flowDepartmentIds))->orderBy('name')->get(['id', 'name'])],
            'report' => ['scope' => $productionOnly ? 'production_flow' : 'factory', 'type' => $type, 'period' => $data['period'] ?? 'week', 'department_id' => $departmentId, 'from' => $from->toDateString(), 'to' => $to->toDateString(), 'generated_at' => now()->toIso8601String(), 'generated_by' => $request->user()->name],
            'summary' => array_filter([($productionOnly ? 'flow_categories' : 'departments') => $departmentActivity->count(), 'production_orders' => $executions->pluck('production_order_id')->unique()->count(), 'work_records' => $executions->count(), 'completed_records' => $executions->where('status', 'completed')->count(), 'quantity_received' => (float) $executions->sum('input_quantity'), 'quantity_completed' => (float) $executions->sum('output_quantity'), 'damaged_quantity' => (float) $executions->sum('rejected_quantity'), 'waste_quantity' => (float) $executions->sum('waste_quantity'), 'stock_movements' => $productionOnly ? null : $inventory->count()], fn ($value) => $value !== null),
            'department_activity' => $departmentActivity,
            'production' => in_array($type, ['all', 'departments', 'production'], true) ? $executions : [],
            'inventory' => $inventory,
            'activities' => ! $productionOnly && in_array($type, ['all', 'departments', 'activity'], true) ? $activities : [],
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
