<?php

namespace App\Http\Controllers\Production;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Machine;
use App\Models\MachinePerformanceLog;
use App\Models\MaintenanceRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The record of how each machine performed (daily log), the problems it had, and the figures that come out
 * of both: availability, output against target, quality, OEE, time between breakdowns and repair time.
 */
class MachinePerformanceController extends Controller
{
    // ---------------------------------------------------------------- dashboard

    public function dashboard(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $machines = Machine::where('factory_id', $factoryId)->get();
        $live = $machines->where('status', '!=', 'retired');
        $monthStart = now()->startOfMonth();
        $today = today();

        $jobs = MaintenanceRecord::where('factory_id', $factoryId)->whereIn('status', MachineController::OPEN_JOB);
        $month = $this->totals($factoryId, $monthStart->toDateString(), $today->toDateString());
        $repairs = $this->repairStats($factoryId, $monthStart, now());

        $loggedToday = MachinePerformanceLog::where('factory_id', $factoryId)->whereDate('log_date', $today)->pluck('machine_id')->unique();

        $trend = collect(range(13, 0))->map(function (int $daysAgo) use ($factoryId) {
            $day = today()->subDays($daysAgo);
            $row = MachinePerformanceLog::where('factory_id', $factoryId)->whereDate('log_date', $day)
                ->selectRaw('COALESCE(SUM(run_minutes),0) run, COALESCE(SUM(planned_minutes),0) planned')->first();

            return [
                'date' => $day->format('M j'),
                'run_hours' => round($row->run / 60, 1),
                'stop_hours' => round(max(0, $row->planned - $row->run) / 60, 1),
            ];
        })->values();

        $attention = MaintenanceRecord::with(['machine:id,name,code,status', 'assignee:id,name'])
            ->where('factory_id', $factoryId)
            ->whereIn('status', MachineController::OPEN_JOB)
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderBy('created_at')
            ->limit(8)
            ->get();

        $due = $live->filter(fn ($m) => $m->next_maintenance_at && $m->next_maintenance_at->lte(now()->addDays(14)))
            ->sortBy('next_maintenance_at')->take(8)->values()
            ->map(fn ($m) => ['id' => $m->id, 'name' => $m->name, 'code' => $m->code, 'next_maintenance_at' => $m->next_maintenance_at, 'overdue' => $m->next_maintenance_at->isPast()]);

        return response()->json([
            'machines' => [
                'total' => $live->count(),
                'working' => $live->where('status', 'operational')->count(),
                'under_maintenance' => $live->where('status', 'maintenance')->count(),
                'stopped' => $live->whereIn('status', ['down', 'broken'])->count(),
                'retired' => $machines->where('status', 'retired')->count(),
            ],
            'jobs' => [
                'open' => (clone $jobs)->count(),
                'urgent' => (clone $jobs)->whereIn('priority', ['urgent', 'high'])->count(),
                'breakdowns' => (clone $jobs)->where('maintenance_type', 'breakdown')->count(),
                'unassigned' => (clone $jobs)->whereNull('assigned_to')->count(),
            ],
            'service' => [
                'overdue' => $live->filter(fn ($m) => $m->next_maintenance_at && $m->next_maintenance_at->isPast())->count(),
                'due_soon' => $live->filter(fn ($m) => $m->next_maintenance_at && $m->next_maintenance_at->isFuture() && $m->next_maintenance_at->lte(now()->addDays(7)))->count(),
            ],
            'month' => $this->figures($month) + [
                'run_hours' => round($month['run'] / 60, 1),
                'stop_hours' => round(max(0, $month['planned'] - $month['run']) / 60, 1),
                'units_produced' => $month['produced'],
            ] + $repairs,
            'not_logged_today' => $live->where('status', 'operational')->whereNotIn('id', $loggedToday)->count(),
            'trend' => $trend,
            'attention' => $attention,
            'due' => $due,
            'currency' => $request->user()->currentFactory?->currency_code ?: 'RWF',
        ]);
    }

    // ---------------------------------------------------------------- performance log

    public function performance(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        [$from, $to] = $this->period($request);
        $machineId = $request->integer('machine_id') ?: null;

        $logs = MachinePerformanceLog::with(['machine:id,name,code', 'recorder:id,name'])
            ->where('factory_id', $factoryId)
            ->whereBetween('log_date', [$from, $to])
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId))
            ->orderByDesc('log_date')->orderByDesc('id')
            ->limit(500)
            ->get();

        $perMachine = MachinePerformanceLog::where('factory_id', $factoryId)
            ->whereBetween('log_date', [$from, $to])
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId))
            ->selectRaw($this->sums() . ', machine_id, COUNT(*) logs')
            ->groupBy('machine_id')
            ->get()->keyBy('machine_id');

        $repairs = MaintenanceRecord::where('factory_id', $factoryId)
            ->where('maintenance_type', 'breakdown')
            ->whereBetween('created_at', [Carbon::parse($from)->startOfDay(), Carbon::parse($to)->endOfDay()])
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId))
            ->selectRaw('machine_id, COUNT(*) breakdowns, COALESCE(SUM(downtime_minutes),0) downtime, COALESCE(SUM(cost),0) cost, AVG(CASE WHEN status = \'completed\' THEN downtime_minutes END) mttr')
            ->groupBy('machine_id')->get()->keyBy('machine_id');
        $serviceCost = MaintenanceRecord::where('factory_id', $factoryId)
            ->where('status', 'completed')
            ->whereBetween('completed_at', [Carbon::parse($from)->startOfDay(), Carbon::parse($to)->endOfDay()])
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId))
            ->selectRaw('machine_id, COALESCE(SUM(cost),0) cost')->groupBy('machine_id')->pluck('cost', 'machine_id');

        $machines = Machine::where('factory_id', $factoryId)->orderBy('name')
            ->get(['id', 'name', 'code', 'status', 'ideal_output_per_hour']);

        $rows = $machines
            ->when($machineId, fn ($c) => $c->where('id', $machineId))
            ->map(function ($machine) use ($perMachine, $repairs, $serviceCost) {
                $t = $perMachine->get($machine->id);
                $totals = $t ? $this->totalsFrom($t) : ['planned' => 0, 'run' => 0, 'produced' => 0, 'target' => 0, 'rejected' => 0, 'vs_target' => 0];
                $r = $repairs->get($machine->id);
                $breakdowns = (int) ($r->breakdowns ?? 0);
                $runHours = $totals['run'] / 60;

                return [
                    'machine_id' => $machine->id,
                    'name' => $machine->name,
                    'code' => $machine->code,
                    'status' => $machine->status,
                    'logs' => (int) ($t->logs ?? 0),
                    'planned_hours' => round($totals['planned'] / 60, 1),
                    'run_hours' => round($runHours, 1),
                    'stop_hours' => round(max(0, $totals['planned'] - $totals['run']) / 60, 1),
                    'units_produced' => $totals['produced'],
                    'units_target' => $totals['target'],
                    'units_rejected' => $totals['rejected'],
                    'breakdowns' => $breakdowns,
                    'repair_hours' => round(((int) ($r->downtime ?? 0)) / 60, 1),
                    'mtbf_hours' => $breakdowns > 0 && $runHours > 0 ? round($runHours / $breakdowns, 1) : null,
                    'mttr_minutes' => $r && $r->mttr !== null ? (int) round($r->mttr) : null,
                    'repair_cost' => (float) ($serviceCost[$machine->id] ?? 0),
                ] + $this->figures($totals);
            })
            ->filter(fn ($row) => $row['logs'] > 0 || $row['breakdowns'] > 0)
            ->values();

        $all = $this->totals($factoryId, $from, $to, $machineId);
        $reasons = MachinePerformanceLog::where('factory_id', $factoryId)
            ->whereBetween('log_date', [$from, $to])
            ->whereNotNull('stop_reason')
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId))
            ->selectRaw('stop_reason, COALESCE(SUM(planned_minutes - run_minutes),0) minutes, COUNT(*) times')
            ->groupBy('stop_reason')->orderByDesc('minutes')->get()
            ->map(fn ($row) => ['reason' => $row->stop_reason, 'label' => MachinePerformanceLog::STOP_REASONS[$row->stop_reason] ?? $row->stop_reason, 'minutes' => (int) $row->minutes, 'times' => (int) $row->times]);

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'logs' => $logs,
            'machines' => $machines,
            'summary' => $rows,
            'totals' => $this->figures($all) + [
                'planned_hours' => round($all['planned'] / 60, 1),
                'run_hours' => round($all['run'] / 60, 1),
                'stop_hours' => round(max(0, $all['planned'] - $all['run']) / 60, 1),
                'units_produced' => $all['produced'],
                'units_target' => $all['target'],
                'units_rejected' => $all['rejected'],
                'breakdowns' => (int) $rows->sum('breakdowns'),
                'repair_cost' => (float) $rows->sum('repair_cost'),
            ],
            'stop_reasons' => $reasons,
            'reasons' => MachinePerformanceLog::STOP_REASONS,
            'shifts' => MachinePerformanceLog::SHIFTS,
            'can_manage' => $request->user()->hasPermission('maintenance.manage') || $request->user()->hasPermission('factory.manage'),
        ]);
    }

    public function storePerformance(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $data = $this->validated($request, $factoryId);
        $machine = Machine::where('factory_id', $factoryId)->findOrFail($data['machine_id']);
        abort_if($machine->status === 'retired', 422, 'This machine is retired.');
        $this->checkDuplicate($data, null);
        $data = $this->withTarget($data, $machine);

        $log = DB::transaction(function () use ($data, $machine, $request) {
            $log = MachinePerformanceLog::create($data + ['recorded_by' => $request->user()->id]);
            $machine->increment('runtime_hours', round($data['run_minutes'] / 60, 2));

            return $log;
        });
        AuditLog::record('maintenance.performance_logged', "Logged {$machine->name} for " . Carbon::parse($data['log_date'])->format('d M Y') . ": ran " . round($data['run_minutes'] / 60, 1) . ' of ' . round($data['planned_minutes'] / 60, 1) . ' hours', $log);

        return response()->json($log->load(['machine:id,name,code', 'recorder:id,name']), 201);
    }

    public function updatePerformance(Request $request, MachinePerformanceLog $log): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        abort_unless($log->factory_id === $factoryId, 404);
        $this->requireOwnerOrManager($request, $log);
        $data = $this->validated($request, $factoryId);
        abort_unless((int) $data['machine_id'] === (int) $log->machine_id, 422, 'Delete this record and record it again for a different machine.');
        $machine = Machine::where('factory_id', $factoryId)->findOrFail($log->machine_id);
        $this->checkDuplicate($data, $log->id);
        $data = $this->withTarget($data, $machine);

        DB::transaction(function () use ($log, $data, $machine) {
            $delta = round(($data['run_minutes'] - $log->run_minutes) / 60, 2);
            $log->update($data);
            if ($delta != 0) {
                $machine->update(['runtime_hours' => max(0, round((float) $machine->runtime_hours + $delta, 2))]);
            }
        });
        AuditLog::record('maintenance.performance_corrected', "Corrected the log of {$machine->name} for " . Carbon::parse($log->log_date)->format('d M Y'), $log);

        return response()->json($log->fresh()->load(['machine:id,name,code', 'recorder:id,name']));
    }

    public function destroyPerformance(Request $request, MachinePerformanceLog $log): JsonResponse
    {
        abort_unless($log->factory_id === $this->factoryId($request), 404);
        $this->requireOwnerOrManager($request, $log);
        $machine = Machine::find($log->machine_id);

        DB::transaction(function () use ($log, $machine) {
            if ($machine) {
                $machine->update(['runtime_hours' => max(0, round((float) $machine->runtime_hours - $log->run_minutes / 60, 2))]);
            }
            $log->delete();
        });
        AuditLog::record('maintenance.performance_deleted', 'Deleted the log of ' . ($machine?->name ?? 'a machine') . ' for ' . Carbon::parse($log->log_date)->format('d M Y'));

        return response()->json(['message' => 'The record was deleted.']);
    }

    // ---------------------------------------------------------------- jobs / problems

    public function jobs(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $filters = $request->validate([
            'view' => ['nullable', Rule::in(['active', 'done', 'all'])],
            'type' => ['nullable', Rule::in(['preventive', 'corrective', 'inspection', 'breakdown'])],
            'machine_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $view = $filters['view'] ?? 'active';

        $query = MaintenanceRecord::with(['machine:id,name,code,status', 'reporter:id,name', 'assignee:id,name'])
            ->where('factory_id', $factoryId)
            ->when($view === 'active', fn ($q) => $q->whereIn('status', MachineController::OPEN_JOB))
            ->when($view === 'done', fn ($q) => $q->whereIn('status', ['completed', 'cancelled']))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', Carbon::parse($from)->startOfDay()))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<=', Carbon::parse($to)->endOfDay()))
            ->when($filters['type'] ?? null, fn ($q, $type) => $q->where('maintenance_type', $type))
            ->when($filters['machine_id'] ?? null, fn ($q, $id) => $q->where('machine_id', $id))
            ->when(trim((string) ($filters['search'] ?? '')), fn ($q, $term) => $q->where(fn ($w) => $w->where('title', 'like', "%{$term}%")->orWhereHas('machine', fn ($m) => $m->where('name', 'like', "%{$term}%")->orWhere('code', 'like', "%{$term}%"))));

        $active = MaintenanceRecord::where('factory_id', $factoryId)->whereIn('status', MachineController::OPEN_JOB);

        return response()->json([
            'jobs' => $query
                ->orderByRaw("CASE WHEN status IN ('completed','cancelled') THEN 1 ELSE 0 END")
                ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
                ->orderByDesc('created_at')
                ->limit(300)
                ->get(),
            'counts' => [
                'active' => (clone $active)->count(),
                'breakdowns' => (clone $active)->where('maintenance_type', 'breakdown')->count(),
                'unassigned' => (clone $active)->whereNull('assigned_to')->count(),
                'done_month' => MaintenanceRecord::where('factory_id', $factoryId)->where('status', 'completed')->where('completed_at', '>=', now()->startOfMonth())->count(),
            ],
            'machines' => Machine::where('factory_id', $factoryId)->where('status', '!=', 'retired')->orderBy('name')->get(['id', 'name', 'code', 'status']),
            'users' => User::where('is_platform_admin', false)
                ->whereHas('factories', fn ($q) => $q->where('factories.id', $factoryId)->where('factory_user.is_active', true))
                ->orderBy('name')->get(['id', 'name']),
            'currency' => $request->user()->currentFactory?->currency_code ?: 'RWF',
        ]);
    }

    // ---------------------------------------------------------------- machines and service plan

    public function machines(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $monthStart = now()->subDays(29)->toDateString();
        $stats = MachinePerformanceLog::where('factory_id', $factoryId)
            ->whereBetween('log_date', [$monthStart, today()->toDateString()])
            ->selectRaw($this->sums() . ', machine_id')->groupBy('machine_id')->get()->keyBy('machine_id');
        $open = MaintenanceRecord::where('factory_id', $factoryId)->whereIn('status', MachineController::OPEN_JOB)
            ->selectRaw('machine_id, COUNT(*) jobs')->groupBy('machine_id')->pluck('jobs', 'machine_id');

        return response()->json([
            'machines' => Machine::with('department:id,name')->where('factory_id', $factoryId)->orderBy('name')->get()->map(function ($machine) use ($stats, $open) {
                $t = $stats->get($machine->id);

                return $machine->toArray() + [
                    'open_jobs' => (int) ($open[$machine->id] ?? 0),
                    'availability' => $t ? $this->figures($this->totalsFrom($t))['availability'] : null,
                    'oee' => $t ? $this->figures($this->totalsFrom($t))['oee'] : null,
                ];
            })->values(),
            'departments' => \App\Models\Department::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'can_manage' => $request->user()->hasPermission('maintenance.manage') || $request->user()->hasPermission('factory.manage'),
        ]);
    }

    public function history(Request $request, Machine $machine): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        abort_unless($machine->factory_id === $factoryId, 404);
        $from = now()->subDays(89)->toDateString();
        $to = today()->toDateString();
        $totals = $this->totals($factoryId, $from, $to, $machine->id);
        $repairs = $this->repairStats($factoryId, now()->subDays(89)->startOfDay(), now(), $machine->id);
        $breakdowns = $repairs['breakdowns'];

        return response()->json([
            'machine' => $machine->load('department:id,name'),
            'last_90_days' => $this->figures($totals) + $repairs + [
                'run_hours' => round($totals['run'] / 60, 1),
                'mtbf_hours' => $breakdowns > 0 && $totals['run'] > 0 ? round($totals['run'] / 60 / $breakdowns, 1) : null,
            ],
            'logs' => MachinePerformanceLog::with('recorder:id,name')->where('machine_id', $machine->id)->orderByDesc('log_date')->limit(20)->get(),
            'jobs' => MaintenanceRecord::with(['reporter:id,name', 'assignee:id,name'])->where('machine_id', $machine->id)->latest()->limit(20)->get(),
        ]);
    }

    // ---------------------------------------------------------------- helpers

    private function factoryId(Request $request): int
    {
        return (int) $request->user()->current_factory_id;
    }

    /** @return array{0:string,1:string} */
    private function period(Request $request): array
    {
        $data = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $to = Carbon::parse($data['to'] ?? today());
        $from = Carbon::parse($data['from'] ?? $to->copy()->subDays(29));
        if ($from->diffInDays($to) > 366) {
            throw ValidationException::withMessages(['from' => 'Choose a period of at most one year.']);
        }

        return [$from->toDateString(), $to->toDateString()];
    }

    private function validated(Request $request, int $factoryId): array
    {
        $shifts = array_keys(MachinePerformanceLog::SHIFTS);
        $data = $request->validate([
            'machine_id' => ['required', 'integer', Rule::exists('machines', 'id')->where('factory_id', $factoryId)],
            'log_date' => ['required', 'date', 'before_or_equal:today', 'after_or_equal:' . today()->subDays(90)->toDateString()],
            'shift' => ['nullable', Rule::in($shifts)],
            'planned_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'run_minutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'stop_reason' => ['nullable', Rule::in(array_keys(MachinePerformanceLog::STOP_REASONS))],
            'units_produced' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'units_target' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'units_rejected' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $data['shift'] = $data['shift'] ?? 'day';
        $data['units_produced'] = (int) ($data['units_produced'] ?? 0);
        $data['units_target'] = (int) ($data['units_target'] ?? 0);
        $data['units_rejected'] = (int) ($data['units_rejected'] ?? 0);

        if ($data['run_minutes'] > $data['planned_minutes']) {
            throw ValidationException::withMessages(['run_minutes' => 'The machine cannot run longer than the planned time.']);
        }
        if ($data['units_rejected'] > $data['units_produced']) {
            throw ValidationException::withMessages(['units_rejected' => 'Rejected pieces cannot be more than the pieces made.']);
        }
        if ($data['run_minutes'] < $data['planned_minutes'] && empty($data['stop_reason'])) {
            throw ValidationException::withMessages(['stop_reason' => 'Say why the machine stood still.']);
        }
        if ($data['run_minutes'] === $data['planned_minutes']) {
            $data['stop_reason'] = null;
        }

        return $data;
    }

    private function checkDuplicate(array $data, ?int $ignoreId): void
    {
        $exists = MachinePerformanceLog::where('machine_id', $data['machine_id'])
            ->whereDate('log_date', $data['log_date'])
            ->where('shift', $data['shift'])
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();
        if ($exists) {
            throw ValidationException::withMessages(['log_date' => 'This machine already has a record for that day and shift. Open it and correct it instead.']);
        }
    }

    /** No target typed: use the machine's usual output per hour for the time it ran. */
    private function withTarget(array $data, Machine $machine): array
    {
        if ($data['units_target'] === 0 && $machine->ideal_output_per_hour > 0 && $data['run_minutes'] > 0) {
            $data['units_target'] = (int) round($machine->ideal_output_per_hour * $data['run_minutes'] / 60);
        }

        return $data;
    }

    private function requireOwnerOrManager(Request $request, MachinePerformanceLog $log): void
    {
        $user = $request->user();
        abort_unless(
            $log->recorded_by === $user->id || $user->hasPermission('maintenance.manage') || $user->hasPermission('factory.manage'),
            403,
            'Only the person who recorded this, or the maintenance manager, can change it.',
        );
    }

    private function sums(): string
    {
        return 'COALESCE(SUM(planned_minutes),0) planned, COALESCE(SUM(run_minutes),0) run, COALESCE(SUM(units_produced),0) produced, '
            . 'COALESCE(SUM(units_target),0) target, COALESCE(SUM(units_rejected),0) rejected, '
            . 'COALESCE(SUM(CASE WHEN units_target > 0 THEN units_produced ELSE 0 END),0) vs_target';
    }

    private function totals(int $factoryId, string $from, string $to, ?int $machineId = null): array
    {
        $row = MachinePerformanceLog::where('factory_id', $factoryId)
            ->whereBetween('log_date', [$from, $to])
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId))
            ->selectRaw($this->sums())->first();

        return $this->totalsFrom($row);
    }

    private function totalsFrom($row): array
    {
        return [
            'planned' => (int) $row->planned,
            'run' => (int) $row->run,
            'produced' => (int) $row->produced,
            'target' => (int) $row->target,
            'rejected' => (int) $row->rejected,
            'vs_target' => (int) $row->vs_target,
        ];
    }

    /**
     * Availability = time run / time planned.
     * Performance  = pieces made / target (only for records that had a target).
     * Quality      = good pieces / pieces made.
     * OEE          = availability x performance (at most 100%) x quality.
     */
    private function figures(array $t): array
    {
        $availability = $t['planned'] > 0 ? $t['run'] / $t['planned'] * 100 : null;
        $performance = $t['target'] > 0 ? $t['vs_target'] / $t['target'] * 100 : null;
        $quality = $t['produced'] > 0 ? ($t['produced'] - $t['rejected']) / $t['produced'] * 100 : null;
        $oee = $availability !== null && $performance !== null && $quality !== null
            ? $availability * min(100, $performance) * $quality / 10000
            : null;

        return [
            'availability' => $availability !== null ? round($availability, 1) : null,
            'performance' => $performance !== null ? round($performance, 1) : null,
            'quality' => $quality !== null ? round($quality, 1) : null,
            'oee' => $oee !== null ? round($oee, 1) : null,
        ];
    }

    private function repairStats(int $factoryId, Carbon $from, Carbon $to, ?int $machineId = null): array
    {
        $breakdowns = MaintenanceRecord::where('factory_id', $factoryId)->where('maintenance_type', 'breakdown')
            ->whereBetween('created_at', [$from, $to])
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId));
        $done = MaintenanceRecord::where('factory_id', $factoryId)->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->when($machineId, fn ($q) => $q->where('machine_id', $machineId));

        return [
            'breakdowns' => (clone $breakdowns)->count(),
            'mttr_minutes' => ($mttr = (clone $done)->where('maintenance_type', 'breakdown')->avg('downtime_minutes')) !== null ? (int) round($mttr) : null,
            'repair_cost' => (float) (clone $done)->sum('cost'),
            'jobs_done' => (clone $done)->count(),
        ];
    }
}
