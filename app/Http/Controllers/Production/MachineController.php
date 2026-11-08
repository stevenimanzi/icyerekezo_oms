<?php

namespace App\Http\Controllers\Production;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Machine;
use App\Models\MaintenanceRecord;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MachineController extends Controller
{
    /** A job that is not finished yet. */
    public const OPEN_JOB = ['open', 'scheduled', 'in_progress'];

    private const MACHINE_STATUS = ['operational', 'maintenance', 'down', 'broken', 'retired'];

    public function index(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $machines = Machine::where('factory_id', $factoryId);

        return response()->json([
            'metrics' => [
                'total' => (clone $machines)->count(),
                'operational' => (clone $machines)->where('status', 'operational')->count(),
                'maintenance' => (clone $machines)->where('status', 'maintenance')->count(),
                'down' => (clone $machines)->whereIn('status', ['down', 'broken'])->count(),
                'due_maintenance' => (clone $machines)
                    ->whereNotNull('next_maintenance_at')
                    ->where('status', '!=', 'retired')
                    ->where('next_maintenance_at', '<=', now()->addDays(7))
                    ->count(),
                'downtime_month' => (int) MaintenanceRecord::where('created_at', '>=', now()->startOfMonth())->sum(
                    'downtime_minutes',
                ),
            ],
            'machines' => $machines
                ->with(['department:id,name,code', 'maintenanceRecords' => fn ($query) => $query->latest()->limit(3)])
                ->orderBy('name')
                ->get(),
            'maintenance' => MaintenanceRecord::with([
                'machine:id,name,code,status',
                'reporter:id,name',
                'assignee:id,name',
            ])
                ->latest()
                ->paginate(30),
            'departments' => Department::where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'code']),
            'users' => User::whereHas('factories', fn ($query) => $query->where('factories.id', $factoryId))
                ->orderBy('name')
                ->get(['id', 'name', 'email']),
        ]);
    }

    public function storeMachine(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)],
            'name' => ['required', 'string', 'max:160'],
            'code' => ['required', 'string', 'max:50', Rule::unique('machines')->where('factory_id', $factoryId)],
            'type' => ['required', 'string', 'max:80'],
            'serial_number' => ['nullable', 'string', 'max:120'],
            'manufacturer' => ['nullable', 'string', 'max:120'],
            'model' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(self::MACHINE_STATUS)],
            'location' => ['nullable', 'string', 'max:160'],
            'runtime_hours' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'ideal_output_per_hour' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'installed_at' => ['nullable', 'date', 'before_or_equal:today'],
            'next_maintenance_at' => ['nullable', 'date'],
            'maintenance_interval_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ], ['code.unique' => 'Another machine already uses this code.']);

        if (empty($data['next_maintenance_at']) && ! empty($data['maintenance_interval_days'])) {
            $data['next_maintenance_at'] = now()->addDays((int) $data['maintenance_interval_days']);
        }
        $machine = Machine::create($data + ['factory_id' => $factoryId]);
        AuditLog::record('maintenance.machine_created', "Registered machine {$machine->name}", $machine);

        return response()->json($machine->load('department:id,name,code'), 201);
    }

    public function updateMachine(Request $request, Machine $machine): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        abort_unless($machine->factory_id === $factoryId, 404);
        $data = $request->validate([
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)],
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'code' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('machines')->where('factory_id', $factoryId)->ignore($machine->id)],
            'type' => ['sometimes', 'required', 'string', 'max:80'],
            'serial_number' => ['nullable', 'string', 'max:120'],
            'manufacturer' => ['nullable', 'string', 'max:120'],
            'model' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(self::MACHINE_STATUS)],
            'runtime_hours' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'ideal_output_per_hour' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'installed_at' => ['nullable', 'date', 'before_or_equal:today'],
            'next_maintenance_at' => ['nullable', 'date'],
            'maintenance_interval_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'location' => ['nullable', 'string', 'max:160'],
        ], ['code.unique' => 'Another machine already uses this code.']);

        // A machine cannot be marked as working while a breakdown is still being repaired.
        if (($data['status'] ?? null) === 'operational' && $machine->status !== 'operational') {
            $open = MaintenanceRecord::where('machine_id', $machine->id)
                ->where('maintenance_type', 'breakdown')
                ->whereIn('status', self::OPEN_JOB)
                ->exists();
            if ($open) {
                throw ValidationException::withMessages(['status' => 'There is a breakdown that is not closed yet. Close the repair first and the machine goes back to working by itself.']);
            }
        }

        if (array_key_exists('status', $data) && $data['status'] === null) {
            unset($data['status']);
        }
        $machine->update($data);
        AuditLog::record('maintenance.machine_updated', "Updated machine {$machine->name}", $machine);

        return response()->json($machine->fresh()->load('department:id,name,code'));
    }

    public function storeMaintenance(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'machine_id' => ['required', Rule::exists('machines', 'id')->where('factory_id', $factoryId)],
            'assigned_to' => [
                'nullable',
                Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)->where('is_active', true),
            ],
            'maintenance_type' => ['required', Rule::in(['preventive', 'corrective', 'inspection', 'breakdown'])],
            'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'scheduled_at' => ['nullable', 'date'],
        ]);
        $machine = Machine::findOrFail($data['machine_id']);
        abort_if($machine->status === 'retired', 422, 'This machine is retired.');

        $record = DB::transaction(function () use ($data, $request, $machine) {
            $record = MaintenanceRecord::create($data + ['reported_by' => $request->user()->id]);
            if ($data['maintenance_type'] === 'breakdown') {
                $machine->update(['status' => 'broken']);
            }

            return $record;
        });
        $label = $data['maintenance_type'] === 'breakdown' ? 'Problem reported' : 'Maintenance request created';
        AuditLog::record('maintenance.request_created', "{$label} on {$machine->name}: {$record->title}", $record);

        return response()->json(
            $record->load(['machine:id,name,code,status', 'reporter:id,name', 'assignee:id,name']),
            201,
        );
    }

    public function updateMaintenance(Request $request, MaintenanceRecord $maintenance): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        abort_unless($maintenance->factory_id === $factoryId, 404);
        abort_if(in_array($maintenance->status, ['completed', 'cancelled'], true), 422, 'This job is already closed.');
        $data = $request->validate([
            'status' => ['required', Rule::in(['open', 'scheduled', 'in_progress', 'completed', 'cancelled'])],
            'assigned_to' => [
                'nullable',
                Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)->where('is_active', true),
            ],
            'cause' => ['nullable', 'string', 'max:255'],
            'resolution' => ['nullable', 'string', 'max:5000'],
            'parts_used' => ['nullable', 'string', 'max:2000'],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'downtime_minutes' => ['nullable', 'integer', 'min:0', 'max:525600'],
            'scheduled_at' => ['nullable', 'date'],
        ]);

        if ($data['status'] === 'completed') {
            abort_if(empty(trim((string) ($data['resolution'] ?? ''))), 422, 'Write what was done to complete this job.');
            if ($maintenance->maintenance_type === 'breakdown') {
                abort_if(empty(trim((string) ($data['cause'] ?? ''))), 422, 'Write what caused the problem.');
            }
        }

        $machine = Machine::findOrFail($maintenance->machine_id);
        DB::transaction(function () use ($maintenance, $machine, $data) {
            $updates = $data;
            if ($data['status'] === 'in_progress' && ! $maintenance->started_at) {
                $updates['started_at'] = now();
            }
            if ($data['status'] === 'completed') {
                $updates['completed_at'] = now();
                // A breakdown stops the machine from the moment it is reported until it is repaired.
                if ($maintenance->maintenance_type === 'breakdown' && empty($data['downtime_minutes'])) {
                    $updates['downtime_minutes'] = (int) round(abs($maintenance->created_at->diffInMinutes(now())));
                }
                if (in_array($maintenance->maintenance_type, ['preventive', 'inspection'], true)) {
                    $machine->last_maintenance_at = now();
                    if ($machine->maintenance_interval_days) {
                        $machine->next_maintenance_at = now()->addDays($machine->maintenance_interval_days);
                    } elseif ($machine->next_maintenance_at && $machine->next_maintenance_at->isPast()) {
                        $machine->next_maintenance_at = null;
                    }
                    $machine->save();
                }
            }
            $maintenance->update($updates);
            $machine = $machine->fresh();
            if ($data['status'] === 'in_progress') {
                if ($machine->status !== 'retired') {
                    $machine->update(['status' => 'maintenance']);
                }
            } elseif (in_array($data['status'], ['completed', 'cancelled'], true) && in_array($machine->status, ['broken', 'maintenance'], true)) {
                $this->settleMachine($machine);
            }
        });
        AuditLog::record('maintenance.status_updated', "{$machine->name}: \"{$maintenance->title}\" is now " . str_replace('_', ' ', $maintenance->status), $maintenance);

        return response()->json($maintenance->fresh()->load(['machine:id,name,code,status', 'assignee:id,name']));
    }

    /** The machine's state follows its open jobs: being repaired, waiting for repair, or working. */
    private function settleMachine(Machine $machine): void
    {
        if ($machine->status === 'retired') {
            return;
        }
        $open = MaintenanceRecord::where('machine_id', $machine->id)->whereIn('status', self::OPEN_JOB);
        $status = (clone $open)->where('status', 'in_progress')->exists()
            ? 'maintenance'
            : ((clone $open)->where('maintenance_type', 'breakdown')->exists() ? 'broken' : 'operational');
        if ($machine->status !== $status) {
            $machine->update(['status' => $status]);
        }
    }
}
