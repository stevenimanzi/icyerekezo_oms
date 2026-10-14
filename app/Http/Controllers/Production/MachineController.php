<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Machine;
use App\Models\MaintenanceRecord;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MachineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $machines = Machine::where('factory_id', $factoryId);
        return response()->json([
            'metrics' => [
                'total' => (clone $machines)->count(), 'operational' => (clone $machines)->where('status', 'operational')->count(),
                'maintenance' => (clone $machines)->where('status', 'maintenance')->count(), 'down' => (clone $machines)->whereIn('status', ['down', 'broken'])->count(),
                'due_maintenance' => (clone $machines)->whereNotNull('next_maintenance_at')->where('next_maintenance_at', '<=', now()->addDays(7))->count(),
                'downtime_month' => (int) MaintenanceRecord::where('created_at', '>=', now()->startOfMonth())->sum('downtime_minutes'),
            ],
            'machines' => $machines->with(['department:id,name,code', 'maintenanceRecords' => fn ($query) => $query->latest()->limit(3)])->orderBy('name')->get(),
            'maintenance' => MaintenanceRecord::with(['machine:id,name,code,status', 'reporter:id,name', 'assignee:id,name'])->latest()->paginate(30),
            'departments' => Department::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'users' => User::whereHas('factories', fn ($query) => $query->where('factories.id', $factoryId))->orderBy('name')->get(['id', 'name', 'email']),
        ]);
    }

    public function storeMachine(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)], 'name' => ['required', 'string', 'max:160'],
            'code' => ['required', 'string', 'max:50', Rule::unique('machines')->where('factory_id', $factoryId)], 'type' => ['required', 'string', 'max:80'],
            'serial_number' => ['nullable', 'string', 'max:120'], 'manufacturer' => ['nullable', 'string', 'max:120'], 'model' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['operational', 'maintenance', 'down', 'broken', 'retired'])], 'location' => ['nullable', 'string', 'max:160'],
            'runtime_hours' => ['nullable', 'numeric', 'min:0'], 'installed_at' => ['nullable', 'date'], 'next_maintenance_at' => ['nullable', 'date'],
        ]);
        $machine = Machine::create($data + ['factory_id' => $factoryId]);
        AuditLog::record('maintenance.machine_created', "Registered machine {$machine->name}", $machine);
        return response()->json($machine->load('department:id,name,code'), 201);
    }

    public function updateMachine(Request $request, Machine $machine): JsonResponse
    {
        abort_unless($machine->factory_id === $request->user()->current_factory_id, 404);
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['operational', 'maintenance', 'down', 'broken', 'retired'])],
            'runtime_hours' => ['nullable', 'numeric', 'min:0'], 'next_maintenance_at' => ['nullable', 'date'], 'location' => ['nullable', 'string', 'max:160'],
        ]);
        $machine->update($data);
        AuditLog::record('maintenance.machine_updated', "Updated machine {$machine->name}", $machine);
        return response()->json($machine->fresh()->load('department:id,name,code'));
    }

    public function storeMaintenance(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'machine_id' => ['required', Rule::exists('machines', 'id')->where('factory_id', $factoryId)], 'assigned_to' => ['nullable', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)->where('is_active', true)],
            'maintenance_type' => ['required', Rule::in(['preventive', 'corrective', 'inspection', 'breakdown'])], 'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'], 'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])], 'scheduled_at' => ['nullable', 'date'],
        ]);
        $record = DB::transaction(function () use ($data, $request) {
            $record = MaintenanceRecord::create($data + ['reported_by' => $request->user()->id]);
            if ($data['maintenance_type'] === 'breakdown') $record->machine()->update(['status' => 'broken']);
            return $record;
        });
        AuditLog::record('maintenance.request_created', "Created maintenance request {$record->title}", $record);
        return response()->json($record->load(['machine:id,name,code,status', 'reporter:id,name', 'assignee:id,name']), 201);
    }

    public function updateMaintenance(Request $request, MaintenanceRecord $maintenance): JsonResponse
    {
        abort_unless($maintenance->factory_id === $request->user()->current_factory_id, 404);
        $data = $request->validate([
            'status' => ['required', Rule::in(['open', 'scheduled', 'in_progress', 'completed', 'cancelled'])], 'assigned_to' => ['nullable', Rule::exists('factory_user', 'user_id')->where('factory_id', $request->user()->current_factory_id)->where('is_active', true)],
            'resolution' => ['nullable', 'string', 'max:5000'], 'cost' => ['nullable', 'numeric', 'min:0'], 'downtime_minutes' => ['nullable', 'integer', 'min:0'], 'scheduled_at' => ['nullable', 'date'],
        ]);
        abort_if($data['status'] === 'completed' && empty($data['resolution']), 422, 'A resolution is required to complete maintenance.');
        DB::transaction(function () use ($maintenance, $data) {
            $updates = $data;
            if ($data['status'] === 'in_progress' && ! $maintenance->started_at) $updates['started_at'] = now();
            if ($data['status'] === 'completed') { $updates['completed_at'] = now(); $maintenance->machine()->update(['status' => 'operational']); }
            elseif (in_array($data['status'], ['scheduled', 'in_progress'])) $maintenance->machine()->update(['status' => 'maintenance']);
            $maintenance->update($updates);
        });
        AuditLog::record('maintenance.status_updated', "Maintenance changed to {$maintenance->status}", $maintenance);
        return response()->json($maintenance->fresh()->load(['machine:id,name,code,status', 'assignee:id,name']));
    }
}
