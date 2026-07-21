<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\EmployeeProfile;
use App\Models\ProductionOrder;
use App\Models\StockTransaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate(['period' => ['nullable', Rule::in(['day', 'week', 'month', 'custom'])], 'type' => ['nullable', Rule::in(['all', 'production', 'inventory', 'team', 'activity'])], 'from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        [$from, $to] = $this->range($data);
        $factory = $request->user()->currentFactory;
        $type = $data['type'] ?? 'all';
        $includes = fn (string $section) => $type === 'all' || $type === $section;

        $production = $includes('production') ? ProductionOrder::withoutGlobalScopes()->where('factory_id', $factory->id)->whereBetween('created_at', [$from, $to])->with('item:id,name,sku')->latest()->get() : collect();
        $inventory = $includes('inventory') ? StockTransaction::withoutGlobalScopes()->where('stock_transactions.factory_id', $factory->id)->whereBetween('occurred_at', [$from, $to])->join('items', 'items.id', '=', 'stock_transactions.item_id')->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')->select('stock_transactions.id', 'stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.unit_cost', 'stock_transactions.balance_after', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku', 'warehouses.name as warehouse_name')->latest('occurred_at')->get() : collect();
        $team = $includes('team') ? EmployeeProfile::withoutGlobalScopes()->where('employee_profiles.factory_id', $factory->id)->join('users', 'users.id', '=', 'employee_profiles.user_id')->leftJoin('departments', 'departments.id', '=', 'employee_profiles.department_id')->leftJoin('workstations', 'workstations.id', '=', 'employee_profiles.workstation_id')->select('employee_profiles.id', 'employee_profiles.employee_number', 'employee_profiles.job_title', 'employee_profiles.employment_status', 'users.name', 'users.email', 'departments.name as department', 'workstations.name as workstation')->orderBy('users.name')->get() : collect();
        $activities = $includes('activity') ? AuditLog::where('factory_id', $factory->id)->whereBetween('created_at', [$from, $to])->with('user:id,name')->latest()->get(['id', 'user_id', 'event', 'description', 'created_at']) : collect();

        return response()->json([
            'factory' => $factory->only(['name', 'industry_type', 'email', 'phone', 'currency_code', 'timezone']),
            'report' => ['type' => $type, 'period' => $data['period'] ?? 'week', 'from' => $from->toDateString(), 'to' => $to->toDateString(), 'generated_at' => now()->toIso8601String(), 'generated_by' => $request->user()->name],
            'summary' => ['production_orders' => $production->count(), 'planned_quantity' => (float) $production->sum('planned_quantity'), 'completed_quantity' => (float) $production->sum('completed_quantity'), 'rejected_quantity' => (float) $production->sum('rejected_quantity'), 'stock_movements' => $inventory->count(), 'employees' => $team->count(), 'activities' => $activities->count()],
            'production' => $production,
            'inventory' => $inventory,
            'team' => $team,
            'activities' => $activities,
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
