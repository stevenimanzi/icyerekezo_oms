<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeProfile;
use App\Models\LeaveRequest;
use App\Models\OvertimeRequest;
use App\Models\PayrollLine;
use App\Models\PayrollRun;
use App\Models\Training;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Everything the HR department does day to day: employee records, the daily attendance register,
 * leave balances, overtime and payroll. HR prepares payroll and sends it to finance; finance pays it
 * and records the money paid out (see FinanceBooksController).
 */
class HrWorkforceController extends Controller
{
    /** Paid annual leave each employee is entitled to in a year. */
    private const ANNUAL_LEAVE_DAYS = 18;

    /** Working days in a pay month, used to turn a monthly salary into a daily and hourly rate. */
    private const WORK_DAYS_PER_MONTH = 26;

    private const HOURS_PER_DAY = 8;

    private const OVERTIME_MULTIPLIER = 1.5;

    // ---------------------------------------------------------------- dashboard

    public function dashboard(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $employees = $this->employees($factoryId);
        $today = today()->toDateString();
        $records = EmployeeAttendance::whereDate('date', $today)->get()->keyBy('user_id');
        $onLeaveToday = LeaveRequest::where('status', 'approved')
            ->whereDate('starts_at', '<=', $today)
            ->whereDate('ends_at', '>=', $today)
            ->pluck('user_id')
            ->unique();

        $present = $records->whereIn('status', ['present', 'late'])->count();
        $absent = $records->where('status', 'absent')->count();
        $onLeave = $records->where('status', 'on_leave')->keys()->merge($onLeaveToday)->unique()->count();
        $marked = $records->keys()->merge($onLeaveToday)->unique()->count();

        $trend = collect(range(13, 0))->map(function (int $daysAgo) {
            $day = today()->subDays($daysAgo);
            $rows = EmployeeAttendance::whereDate('date', $day);

            return [
                'date' => $day->format('M j'),
                'present' => (clone $rows)->whereIn('status', ['present', 'late'])->count(),
                'absent' => (clone $rows)->where('status', 'absent')->count(),
            ];
        })->values();

        $period = today()->format('Y-m');
        $run = PayrollRun::where('period', $period)->where('status', '!=', 'cancelled')->latest('id')->first();

        return response()->json([
            'stats' => [
                'headcount' => $employees->count(),
                'present_today' => $present,
                'absent_today' => $absent,
                'on_leave_today' => $onLeave,
                'not_marked_today' => max(0, $employees->count() - $marked),
                'pending_leave' => LeaveRequest::where('status', 'pending')->count(),
                'pending_overtime' => OvertimeRequest::where('status', 'pending')->count(),
                'upcoming_trainings' => Training::where('status', 'scheduled')->where('scheduled_at', '>=', today())->count(),
                'missing_salary' => $employees->filter(fn ($e) => (float) $e['base_salary'] <= 0)->count(),
            ],
            'trend' => $trend,
            'payroll' => $run ? $this->runSummary($run) : null,
            'payroll_period' => $period,
            'pending_leave' => LeaveRequest::with('user:id,name')->where('status', 'pending')->orderBy('starts_at')->limit(6)->get(),
            'pending_overtime' => OvertimeRequest::with('user:id,name')->where('status', 'pending')->orderBy('work_date')->limit(6)->get(),
            'new_hires' => $employees->filter(fn ($e) => $e['hired_at'])->sortByDesc('hired_at')->take(5)->values(),
            'currency' => $request->user()->currentFactory?->currency_code ?: 'RWF',
        ]);
    }

    // ---------------------------------------------------------------- employee records

    public function employeesIndex(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);

        return response()->json([
            'employees' => $this->employees($factoryId)->values(),
            'departments' => Department::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'statuses' => self::STATUSES,
            'contracts' => self::CONTRACTS,
            'currency' => $request->user()->currentFactory?->currency_code ?: 'RWF',
        ]);
    }

    private const STATUSES = ['active' => 'Working', 'suspended' => 'Suspended', 'on_leave' => 'Long leave', 'terminated' => 'Left the factory'];

    private const CONTRACTS = ['permanent' => 'Permanent', 'fixed_term' => 'Fixed term', 'casual' => 'Casual / daily', 'intern' => 'Intern'];

    public function updateEmployee(Request $request, User $user): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $this->requireEmployee($user, $factoryId);
        $data = $request->validate([
            'job_title' => ['nullable', 'string', 'max:120'],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)],
            'base_salary' => ['required', 'numeric', 'min:0', 'max:999999999999'],
            'overtime_rate' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'contract_type' => ['nullable', Rule::in(array_keys(self::CONTRACTS))],
            'employment_status' => ['required', Rule::in(array_keys(self::STATUSES))],
            'hired_at' => ['nullable', 'date', 'before_or_equal:today'],
            'phone' => ['nullable', 'string', 'max:40'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
        ]);

        $profile = $this->profile($user, $factoryId);
        $before = $profile->only(['job_title', 'base_salary', 'employment_status']);
        $profile->update($data);

        AuditLog::record(
            'hr.employee_updated',
            "Updated the record of {$user->name}" . ((float) $before['base_salary'] !== (float) $data['base_salary'] ? ' (salary changed)' : ''),
            $profile,
            $before,
            $profile->only(['job_title', 'base_salary', 'employment_status']),
        );

        return response()->json(['message' => "{$user->name}'s record was saved.", 'employee' => $this->employeeRow($user->fresh(['employeeProfile.department', 'roles']), $factoryId)]);
    }

    // ---------------------------------------------------------------- attendance register

    public function attendanceRegister(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $date = Carbon::parse($request->validate(['date' => ['nullable', 'date']])['date'] ?? today())->toDateString();
        $records = EmployeeAttendance::whereDate('date', $date)->get()->keyBy('user_id');
        $onLeave = LeaveRequest::where('status', 'approved')
            ->whereDate('starts_at', '<=', $date)
            ->whereDate('ends_at', '>=', $date)
            ->pluck('user_id')
            ->flip();

        $rows = $this->employees($factoryId)
            ->filter(fn ($e) => $e['employment_status'] === 'active')
            ->map(function ($employee) use ($records, $onLeave) {
                $record = $records->get($employee['id']);

                return [
                    'user_id' => $employee['id'],
                    'name' => $employee['name'],
                    'job_title' => $employee['job_title'],
                    'department' => $employee['department'],
                    'status' => $record?->status ?? ($onLeave->has($employee['id']) ? 'on_leave' : null),
                    'check_in_time' => $record?->check_in_time ? substr((string) $record->check_in_time, 0, 5) : null,
                    'check_out_time' => $record?->check_out_time ? substr((string) $record->check_out_time, 0, 5) : null,
                    'notes' => $record?->notes,
                    'saved' => $record !== null,
                    'on_approved_leave' => $onLeave->has($employee['id']),
                ];
            })
            ->values();

        return response()->json(['date' => $date, 'rows' => $rows]);
    }

    public function saveAttendanceRegister(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $data = $request->validate([
            'date' => ['required', 'date', 'before_or_equal:today'],
            'records' => ['required', 'array', 'min:1', 'max:500'],
            'records.*.user_id' => ['required', 'integer', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)],
            'records.*.status' => ['required', Rule::in(['present', 'absent', 'late', 'on_leave'])],
            'records.*.check_in_time' => ['nullable', 'date_format:H:i'],
            'records.*.check_out_time' => ['nullable', 'date_format:H:i'],
            'records.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($data, $factoryId, $request) {
            foreach ($data['records'] as $record) {
                EmployeeAttendance::updateOrCreate(
                    ['factory_id' => $factoryId, 'user_id' => $record['user_id'], 'date' => $data['date']],
                    [
                        'status' => $record['status'],
                        'check_in_time' => $record['check_in_time'] ?? null,
                        'check_out_time' => $record['check_out_time'] ?? null,
                        'notes' => $record['notes'] ?? null,
                        'recorded_by' => $request->user()->id,
                    ],
                );
            }
        });

        AuditLog::record('hr.attendance_saved', 'Saved the attendance register for ' . Carbon::parse($data['date'])->format('d M Y') . ' (' . count($data['records']) . ' employees)');

        return response()->json(['message' => 'Attendance for ' . Carbon::parse($data['date'])->format('d M Y') . ' was saved.']);
    }

    public function attendanceSummary(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $month = $request->validate(['month' => ['nullable', 'date_format:Y-m']])['month'] ?? today()->format('Y-m');
        $start = Carbon::parse($month . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $records = EmployeeAttendance::whereBetween('date', [$start->toDateString(), $end->toDateString()])->get()->groupBy('user_id');

        $rows = $this->employees($factoryId)->map(function ($employee) use ($records) {
            $mine = $records->get($employee['id'], collect());

            return [
                'user_id' => $employee['id'],
                'name' => $employee['name'],
                'job_title' => $employee['job_title'],
                'present' => $mine->where('status', 'present')->count(),
                'late' => $mine->where('status', 'late')->count(),
                'absent' => $mine->where('status', 'absent')->count(),
                'on_leave' => $mine->where('status', 'on_leave')->count(),
                'recorded' => $mine->count(),
            ];
        })->values();

        return response()->json(['month' => $month, 'rows' => $rows]);
    }

    // ---------------------------------------------------------------- leave

    public function leaveIndex(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $year = today()->year;
        $used = LeaveRequest::where('status', 'approved')
            ->where('leave_type', 'annual')
            ->whereYear('starts_at', $year)
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows) => (int) $rows->sum('days_requested'));

        return response()->json([
            'requests' => LeaveRequest::with(['user:id,name', 'reviewer:id,name'])->latest()->limit(300)->get(),
            'balances' => $this->employees($factoryId)->map(fn ($e) => [
                'user_id' => $e['id'],
                'name' => $e['name'],
                'entitled' => self::ANNUAL_LEAVE_DAYS,
                'used' => (int) ($used[$e['id']] ?? 0),
                'left' => max(0, self::ANNUAL_LEAVE_DAYS - (int) ($used[$e['id']] ?? 0)),
            ])->values(),
            'entitlement' => self::ANNUAL_LEAVE_DAYS,
            'year' => $year,
        ]);
    }

    // ---------------------------------------------------------------- overtime

    public function overtimeIndex(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $month = $request->validate(['month' => ['nullable', 'date_format:Y-m']])['month'] ?? null;

        return response()->json([
            'requests' => OvertimeRequest::with(['user:id,name', 'decider:id,name'])
                ->when($month, fn ($q) => $q->whereBetween('work_date', [Carbon::parse($month . '-01')->startOfMonth()->toDateString(), Carbon::parse($month . '-01')->endOfMonth()->toDateString()]))
                ->orderByDesc('work_date')
                ->orderByDesc('id')
                ->limit(300)
                ->get(),
            'employees' => $this->employees($factoryId)->filter(fn ($e) => $e['employment_status'] === 'active')->map(fn ($e) => ['id' => $e['id'], 'name' => $e['name']])->values(),
            'multiplier' => self::OVERTIME_MULTIPLIER,
        ]);
    }

    public function storeOvertime(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $data = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)],
            'work_date' => ['required', 'date', 'before_or_equal:today'],
            'hours' => ['required', 'numeric', 'gt:0', 'max:16'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $already = (float) OvertimeRequest::where('user_id', $data['user_id'])
            ->whereDate('work_date', $data['work_date'])
            ->whereIn('status', ['pending', 'approved'])
            ->sum('hours');
        if ($already + (float) $data['hours'] > 16) {
            throw ValidationException::withMessages(['hours' => 'That is more than 16 hours of overtime for one day.']);
        }

        $overtime = OvertimeRequest::create($data + ['status' => 'pending', 'recorded_by' => $request->user()->id]);
        $overtime->load('user:id,name');
        AuditLog::record('hr.overtime_recorded', "Recorded {$data['hours']} hours of overtime for {$overtime->user->name}", $overtime);

        return response()->json($overtime, 201);
    }

    public function decideOvertime(Request $request, OvertimeRequest $overtime): JsonResponse
    {
        abort_unless($overtime->factory_id === $this->factoryId($request), 404);
        abort_unless($overtime->status === 'pending', 422, 'This overtime was already decided.');
        $data = $request->validate(['decision' => ['required', Rule::in(['approved', 'rejected'])]]);

        $overtime->update(['status' => $data['decision'], 'decided_by' => $request->user()->id, 'decided_at' => now()]);
        $overtime->load('user:id,name');
        AuditLog::record('hr.overtime_' . $data['decision'], ucfirst($data['decision']) . " {$overtime->hours} hours of overtime for {$overtime->user->name}", $overtime);

        return response()->json($overtime->load('decider:id,name'));
    }

    // ---------------------------------------------------------------- payroll

    public function payrollIndex(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $employees = $this->employees($factoryId);

        return response()->json([
            'runs' => PayrollRun::with('creator:id,name')->latest('id')->limit(60)->get(),
            'missing_salary' => $employees->filter(fn ($e) => $e['employment_status'] === 'active' && (float) $e['base_salary'] <= 0)->map(fn ($e) => $e['name'])->values(),
            'rules' => [
                'work_days' => self::WORK_DAYS_PER_MONTH,
                'overtime_multiplier' => self::OVERTIME_MULTIPLIER,
                'hours_per_day' => self::HOURS_PER_DAY,
            ],
            'currency' => $request->user()->currentFactory?->currency_code ?: 'RWF',
        ]);
    }

    public function payrollShow(Request $request, PayrollRun $run): JsonResponse
    {
        abort_unless($run->factory_id === $this->factoryId($request), 404);

        return response()->json(['run' => $run->load(['creator:id,name', 'payer:id,name']), 'lines' => $run->lines()->get(), 'currency' => $request->user()->currentFactory?->currency_code ?: 'RWF']);
    }

    public function createPayroll(Request $request): JsonResponse
    {
        $factoryId = $this->factoryId($request);
        $data = $request->validate([
            'period' => ['required', 'date_format:Y-m'],
            'statutory_rate' => ['nullable', 'numeric', 'min:0', 'max:60'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);
        abort_if(Carbon::parse($data['period'] . '-01')->startOfMonth()->gt(today()), 422, 'You cannot prepare payroll for a month that has not started.');

        if (PayrollRun::where('period', $data['period'])->whereIn('status', ['draft', 'submitted', 'paid'])->exists()) {
            throw ValidationException::withMessages(['period' => 'Payroll for this month already exists. Cancel it first if you need to redo it.']);
        }

        $rate = (float) ($data['statutory_rate'] ?? 0);
        $start = Carbon::parse($data['period'] . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $run = DB::transaction(function () use ($data, $factoryId, $request, $rate, $start, $end) {
            $sequence = PayrollRun::withoutGlobalScopes()->where('factory_id', $factoryId)->lockForUpdate()->count() + 1;
            $run = PayrollRun::create([
                'run_number' => sprintf('PAY-%s-%03d', str_replace('-', '', $data['period']), $sequence),
                'period' => $data['period'],
                'status' => 'draft',
                'statutory_rate' => $rate,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $employees = $this->employees($factoryId)->filter(fn ($e) => $e['employment_status'] === 'active' && (float) $e['base_salary'] > 0);
            $absences = EmployeeAttendance::whereBetween('date', [$start->toDateString(), $end->toDateString()])->where('status', 'absent')->get()->groupBy('user_id')->map->count();
            $unpaidLeave = $this->unpaidLeaveDays($start, $end);
            $overtime = OvertimeRequest::where('status', 'approved')->whereNull('payroll_run_id')
                ->whereBetween('work_date', [$start->toDateString(), $end->toDateString()])->get()->groupBy('user_id');

            foreach ($employees as $employee) {
                $base = (float) $employee['base_salary'];
                $daily = $base / self::WORK_DAYS_PER_MONTH;
                $rateOt = (float) ($employee['overtime_rate'] ?: round($daily / self::HOURS_PER_DAY * self::OVERTIME_MULTIPLIER, 2));
                $hours = (float) ($overtime->get($employee['id'], collect())->sum('hours'));
                $absentDays = (int) ($absences[$employee['id']] ?? 0) + (int) ($unpaidLeave[$employee['id']] ?? 0);

                $line = new PayrollLine([
                    'payroll_run_id' => $run->id,
                    'user_id' => $employee['id'],
                    'employee_name' => $employee['name'],
                    'employee_number' => $employee['employee_number'],
                    'job_title' => $employee['job_title'],
                    'base_salary' => $base,
                    'overtime_hours' => $hours,
                    'overtime_pay' => round($hours * $rateOt, 2),
                    'allowances' => 0,
                    'absent_days' => $absentDays,
                    'absence_deduction' => round(min($base, $absentDays * $daily), 2),
                    'other_deductions' => 0,
                ]);
                $line->settle($rate);
                $line->save();

                if ($hours > 0) {
                    OvertimeRequest::where('status', 'approved')->whereNull('payroll_run_id')->where('user_id', $employee['id'])
                        ->whereBetween('work_date', [$start->toDateString(), $end->toDateString()])->update(['payroll_run_id' => $run->id]);
                }
            }
            $run->recalculate();

            if ($run->employee_count === 0) {
                throw ValidationException::withMessages(['period' => 'No working employee has a salary set yet. Set salaries in Employees first.']);
            }

            return $run;
        });

        AuditLog::record('hr.payroll_created', "Prepared payroll {$run->run_number} for " . Carbon::parse($run->period . '-01')->format('F Y') . " ({$run->employee_count} employees)", $run);

        return response()->json($run->fresh(), 201);
    }

    public function updatePayrollLine(Request $request, PayrollLine $line): JsonResponse
    {
        $run = $line->run;
        abort_unless($run->factory_id === $this->factoryId($request), 404);
        abort_unless($run->status === 'draft', 422, 'Only payroll that was not yet sent to finance can be changed.');
        $data = $request->validate([
            'allowances' => ['required', 'numeric', 'min:0', 'max:999999999'],
            'other_deductions' => ['required', 'numeric', 'min:0', 'max:999999999'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $line->fill($data);
        $line->settle((float) $run->statutory_rate);
        $line->save();
        $run->recalculate();

        return response()->json(['line' => $line->fresh(), 'run' => $run->fresh()]);
    }

    public function submitPayroll(Request $request, PayrollRun $run): JsonResponse
    {
        abort_unless($run->factory_id === $this->factoryId($request), 404);
        abort_unless($run->status === 'draft', 422, 'This payroll was already sent.');
        abort_if($run->lines()->count() === 0, 422, 'This payroll has no employees.');

        $run->update(['status' => 'submitted', 'submitted_at' => now()]);
        $currency = $request->user()->currentFactory?->currency_code ?: 'RWF';
        AuditLog::record(
            'hr.payroll_sent_to_finance',
            "Payroll {$run->run_number} for " . Carbon::parse($run->period . '-01')->format('F Y') . " sent to finance: {$currency} " . number_format((float) $run->total_net, 0) . " for {$run->employee_count} employees",
            $run,
        );

        return response()->json($run->fresh());
    }

    public function cancelPayroll(Request $request, PayrollRun $run): JsonResponse
    {
        abort_unless($run->factory_id === $this->factoryId($request), 404);
        abort_unless(in_array($run->status, ['draft', 'submitted'], true), 422, 'Paid payroll cannot be cancelled.');

        DB::transaction(function () use ($run) {
            OvertimeRequest::where('payroll_run_id', $run->id)->update(['payroll_run_id' => null]);
            $run->update(['status' => 'cancelled']);
        });
        AuditLog::record('hr.payroll_cancelled', "Cancelled payroll {$run->run_number}", $run);

        return response()->json($run->fresh());
    }

    /** One payslip per employee, one page each. */
    public function payslips(Request $request, PayrollRun $run): Response
    {
        abort_unless($run->factory_id === $this->factoryId($request), 404);
        abort_if($run->status === 'cancelled', 404);

        $factory = $request->user()->currentFactory;
        $lines = $run->lines()->get();
        if ($request->filled('user_id')) {
            $lines = $lines->where('user_id', (int) $request->query('user_id'))->values();
            abort_if($lines->isEmpty(), 404);
        }

        return Pdf::loadView('pdf.payslips', ['run' => $run, 'lines' => $lines, 'factory' => $factory, 'currency' => $factory?->currency_code ?: 'RWF'])
            ->setPaper('a4')
            ->download('payslips-' . $run->period . '.pdf');
    }

    // ---------------------------------------------------------------- helpers

    private function factoryId(Request $request): int
    {
        return (int) $request->user()->current_factory_id;
    }

    private function requireEmployee(User $user, int $factoryId): void
    {
        abort_unless(
            $user->factories()->where('factories.id', $factoryId)->exists() && ! $user->is_platform_admin && ! $user->school_id,
            404,
        );
    }

    private function profile(User $user, int $factoryId): EmployeeProfile
    {
        $profile = EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factoryId)->where('user_id', $user->id)->first();
        if ($profile) {
            return $profile;
        }

        $next = EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factoryId)->count() + 1;
        do {
            $number = sprintf('EMP-%04d', $next++);
        } while (EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factoryId)->where('employee_number', $number)->exists());

        return EmployeeProfile::create([
            'factory_id' => $factoryId,
            'user_id' => $user->id,
            'employee_number' => $number,
            'employment_status' => 'active',
        ]);
    }

    /** Everyone who works in the factory, with their HR record (people without a record count as working with no salary yet). */
    private function employees(int $factoryId)
    {
        $users = User::where('is_platform_admin', false)
            ->whereNull('school_id')
            ->whereHas('factories', fn ($q) => $q->where('factories.id', $factoryId)->where('factory_user.is_active', true))
            ->with(['roles' => fn ($q) => $q->wherePivot('factory_id', $factoryId)])
            ->orderBy('name')
            ->get();
        $profiles = EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factoryId)->with('department:id,name')->get()->keyBy('user_id');

        return $users->map(fn (User $user) => $this->employeeRow($user, $factoryId, $profiles->get($user->id)));
    }

    private function employeeRow(User $user, int $factoryId, ?EmployeeProfile $profile = null): array
    {
        $profile ??= EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factoryId)->where('user_id', $user->id)->with('department:id,name')->first();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->values(),
            'employee_number' => $profile?->employee_number,
            'job_title' => $profile?->job_title,
            'department_id' => $profile?->department_id,
            'department' => $profile?->department?->name,
            'base_salary' => (float) ($profile?->base_salary ?? 0),
            'overtime_rate' => $profile?->overtime_rate !== null ? (float) $profile->overtime_rate : null,
            'contract_type' => $profile?->contract_type,
            'employment_status' => $profile?->employment_status ?? 'active',
            'hired_at' => $profile?->hired_at?->toDateString(),
            'phone' => $profile?->phone,
            'emergency_contact' => $profile?->emergency_contact,
        ];
    }

    private function unpaidLeaveDays(Carbon $start, Carbon $end): array
    {
        $days = [];
        LeaveRequest::where('status', 'approved')->where('leave_type', 'unpaid')
            ->whereDate('starts_at', '<=', $end->toDateString())
            ->whereDate('ends_at', '>=', $start->toDateString())
            ->get()
            ->each(function (LeaveRequest $leave) use (&$days, $start, $end) {
                $from = $leave->starts_at->gt($start) ? $leave->starts_at : $start;
                $to = $leave->ends_at->lt($end) ? $leave->ends_at : $end;
                $days[$leave->user_id] = ($days[$leave->user_id] ?? 0) + (int) $from->diffInDays($to) + 1;
            });

        return $days;
    }

    private function runSummary(PayrollRun $run): array
    {
        return [
            'id' => $run->id,
            'run_number' => $run->run_number,
            'period' => $run->period,
            'status' => $run->status,
            'total_net' => (float) $run->total_net,
            'employee_count' => $run->employee_count,
        ];
    }
}
