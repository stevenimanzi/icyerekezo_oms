<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use App\Support\Reports\SalesReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * One report per department, shown only to the people who work in that department.
 * The department comes from the user's role, never from the request, so a sales officer
 * cannot ask for the payroll or audit report.
 *
 * Production, warehouse, logistics and finance have their own report pages.
 */
class DepartmentReportController extends Controller
{
    private const LIMIT = 500;

    /** Role workspace (dashboard key) => report builder. */
    private const REPORTS = [
        'sales' => 'sales',
        'procurement' => 'procurement',
        'quality' => 'quality',
        'people' => 'people',
        'maintenance' => 'maintenance',
        'safety' => 'safety',
        'audit' => 'audit',
    ];

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $factoryId = (int) $user->current_factory_id;
        $keys = $user
            ->roles()
            ->wherePivot('factory_id', $factoryId)
            ->pluck('dashboard_key')
            ->map(fn ($key) => (string) $key);
        $key = $keys->first(fn ($key) => isset(self::REPORTS[$key]));
        abort_unless($key, 403, 'There is no separate report for your department.');

        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:60'],
        ]);
        $to = isset($filters['to']) ? Carbon::parse($filters['to'])->endOfDay() : now()->endOfDay();
        $from = isset($filters['from']) ? Carbon::parse($filters['from'])->startOfDay() : $to->copy()->subDays(29)->startOfDay();
        $search = trim((string) ($filters['search'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));
        $currency = $user->currentFactory?->currency_code ?: 'RWF';

        $report = $this->{self::REPORTS[$key]}($factoryId, $from, $to, $search, $status);

        return response()->json(
            $report + [
                'department' => $key,
                'currency' => $currency,
                'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'limit' => self::LIMIT,
            ],
        );
    }

    // ---------------------------------------------------------------- sales

    private function sales(int $factoryId, Carbon $from, Carbon $to, string $search, string $status): array
    {
        $base = DB::table('sales_documents')
            ->where('factory_id', $factoryId)
            ->whereBetween('document_date', [$from->toDateString(), $to->toDateString()]);
        $statuses = $this->statuses(clone $base, 'status');
        $query = clone $base;
        $this->like($query, $search, ['document_number', 'customer_name']);
        if ($status !== '') $query->where('status', $status);

        $rows = (clone $query)
            ->orderByDesc('document_date')
            ->orderByDesc('id')
            ->limit(self::LIMIT)
            ->get(['document_date', 'document_number', 'customer_name', 'document_type', 'status', 'item_count', 'total_amount', 'paid_amount'])
            ->map(fn ($row) => [
                'date' => $row->document_date,
                'number' => $row->document_number,
                'customer' => $row->customer_name ?: 'Not named',
                'type' => $this->words($row->document_type),
                'status' => $this->words($row->status),
                'items' => (int) $row->item_count,
                'total' => (float) $row->total_amount,
                'paid' => (float) $row->paid_amount,
                'balance' => max(0, (float) $row->total_amount - (float) $row->paid_amount),
            ]);
        $totals = (clone $query)->selectRaw('COUNT(*) c, COALESCE(SUM(total_amount),0) t, COALESCE(SUM(paid_amount),0) p')->first();
        $summary = (new SalesReport($factoryId, $from, $to))->build();
        $money = fn (string $label, string $key) => ['label' => $label, 'key' => $key, 'kind' => 'money'];
        $count = fn (string $label, string $key) => ['label' => $label, 'key' => $key, 'kind' => 'number'];
        $text = fn (string $label, string $key) => ['label' => $label, 'key' => $key, 'kind' => 'text'];

        return [
            'extra_tables' => [
                [
                    'heading' => 'Best customers',
                    'columns' => [$text('Customer', 'name'), $count('Sales', 'sales'), $money('Bought', 'revenue'), $money('Still owes', 'owes')],
                    'rows' => $summary['top_customers'],
                ],
                [
                    'heading' => 'Best selling products',
                    'columns' => [$text('Product', 'name'), $count('Quantity', 'quantity'), $money('Sales value', 'revenue')],
                    'rows' => $summary['top_products'],
                ],
                [
                    'heading' => 'How customers paid',
                    'columns' => [$text('Method', 'method'), $count('Payments', 'payments'), $money('Amount', 'amount')],
                    'rows' => collect($summary['payment_methods'])->map(fn ($row) => ['method' => $this->words($row['method']), 'payments' => $row['payments'], 'amount' => $row['amount']])->all(),
                ],
                [
                    'heading' => 'Customers who still owe money',
                    'columns' => [$text('Number', 'number'), $text('Customer', 'customer'), $text('Phone', 'phone'), ['label' => 'Sold on', 'key' => 'sold_on', 'kind' => 'date'], ['label' => 'Due on', 'key' => 'due_on', 'kind' => 'date'], $money('Total', 'total'), $money('Balance', 'balance'), $count('Days late', 'days_late')],
                    'rows' => $summary['debtors'],
                ],
                [
                    'heading' => 'Sales by team member',
                    'columns' => [$text('Name', 'name'), $count('Sales', 'sales'), $money('Sales value', 'revenue')],
                    'rows' => $summary['sellers'],
                ],
            ],
            'title' => 'Sales report',
            'intro' => 'Orders and sales documents made by the sales team in the chosen dates.',
            'kpis' => [
                ['label' => 'Documents', 'value' => (int) $totals->c, 'kind' => 'number'],
                ['label' => 'Total value', 'value' => (float) $totals->t, 'kind' => 'money'],
                ['label' => 'Money received', 'value' => (float) $totals->p, 'kind' => 'money'],
                ['label' => 'Still to be paid', 'value' => max(0, (float) $totals->t - (float) $totals->p), 'kind' => 'money'],
                ['label' => 'Average sale', 'value' => (float) $summary['summary']['average_sale']['current'], 'kind' => 'money'],
                ['label' => 'Unpaid in total', 'value' => (float) $summary['summary']['outstanding'], 'kind' => 'money'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'kind' => 'date'],
                ['key' => 'number', 'label' => 'Number', 'kind' => 'text'],
                ['key' => 'customer', 'label' => 'Customer', 'kind' => 'text'],
                ['key' => 'type', 'label' => 'Type', 'kind' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'kind' => 'text'],
                ['key' => 'items', 'label' => 'Items', 'kind' => 'number'],
                ['key' => 'total', 'label' => 'Total', 'kind' => 'money'],
                ['key' => 'paid', 'label' => 'Paid', 'kind' => 'money'],
                ['key' => 'balance', 'label' => 'Balance', 'kind' => 'money'],
            ],
            'rows' => $rows,
            'statuses' => $statuses,
            'search_hint' => 'Search by number or customer',
        ];
    }

    // ---------------------------------------------------------------- procurement

    private function procurement(int $factoryId, Carbon $from, Carbon $to, string $search, string $status): array
    {
        $base = DB::table('purchase_documents as d')
            ->leftJoin('suppliers as s', 's.id', '=', 'd.supplier_id')
            ->where('d.factory_id', $factoryId)
            ->whereBetween('d.document_date', [$from->toDateString(), $to->toDateString()]);
        $statuses = $this->statuses(clone $base, 'd.status');
        $query = clone $base;
        $this->like($query, $search, ['d.document_number', 's.name']);
        if ($status !== '') $query->where('d.status', $status);

        $rows = (clone $query)
            ->orderByDesc('d.document_date')
            ->orderByDesc('d.id')
            ->limit(self::LIMIT)
            ->get(['d.document_date', 'd.document_number', 's.name as supplier', 'd.document_type', 'd.status', 'd.line_count', 'd.total_amount', 'd.expected_date'])
            ->map(fn ($row) => [
                'date' => $row->document_date,
                'number' => $row->document_number,
                'supplier' => $row->supplier ?: 'Not chosen yet',
                'type' => $this->words($row->document_type),
                'status' => $this->words($row->status),
                'lines' => (int) $row->line_count,
                'total' => (float) $row->total_amount,
                'expected' => $row->expected_date,
            ]);
        $totals = (clone $query)->selectRaw('COUNT(*) c, COALESCE(SUM(d.total_amount),0) t')->first();
        $open = (clone $query)->whereNotIn('d.status', ['received', 'closed', 'cancelled', 'rejected'])->count();

        return [
            'title' => 'Purchasing report',
            'intro' => 'Purchase requests and orders made in the chosen dates.',
            'kpis' => [
                ['label' => 'Documents', 'value' => (int) $totals->c, 'kind' => 'number'],
                ['label' => 'Total value', 'value' => (float) $totals->t, 'kind' => 'money'],
                ['label' => 'Still open', 'value' => $open, 'kind' => 'number'],
                ['label' => 'Closed or received', 'value' => max(0, (int) $totals->c - $open), 'kind' => 'number'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'kind' => 'date'],
                ['key' => 'number', 'label' => 'Number', 'kind' => 'text'],
                ['key' => 'supplier', 'label' => 'Supplier', 'kind' => 'text'],
                ['key' => 'type', 'label' => 'Type', 'kind' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'kind' => 'text'],
                ['key' => 'lines', 'label' => 'Items', 'kind' => 'number'],
                ['key' => 'total', 'label' => 'Total', 'kind' => 'money'],
                ['key' => 'expected', 'label' => 'Expected on', 'kind' => 'date'],
            ],
            'rows' => $rows,
            'statuses' => $statuses,
            'search_hint' => 'Search by number or supplier',
        ];
    }

    // ---------------------------------------------------------------- quality

    private function quality(int $factoryId, Carbon $from, Carbon $to, string $search, string $status): array
    {
        $base = DB::table('quality_inspections as q')
            ->leftJoin('items as i', 'i.id', '=', 'q.item_id')
            ->leftJoin('users as u', 'u.id', '=', 'q.inspector_id')
            ->where('q.factory_id', $factoryId)
            ->whereBetween(DB::raw('COALESCE(q.inspected_at, q.created_at)'), [$from, $to]);
        $statuses = $this->statuses(clone $base, 'q.result');
        $query = clone $base;
        $this->like($query, $search, ['q.inspection_number', 'i.name', 'u.name']);
        if ($status !== '') $query->where('q.result', $status);

        $rows = (clone $query)
            ->orderByDesc(DB::raw('COALESCE(q.inspected_at, q.created_at)'))
            ->limit(self::LIMIT)
            ->get([
                DB::raw('COALESCE(q.inspected_at, q.created_at) as at'),
                'q.inspection_number', 'i.name as item', 'q.inspection_type', 'q.inspected_quantity',
                'q.passed_quantity', 'q.rejected_quantity', 'q.result', 'u.name as inspector',
            ])
            ->map(fn ($row) => [
                'date' => $row->at,
                'number' => $row->inspection_number,
                'item' => $row->item ?: 'Not named',
                'type' => $this->words($row->inspection_type),
                'checked' => (float) $row->inspected_quantity,
                'passed' => (float) $row->passed_quantity,
                'rejected' => (float) $row->rejected_quantity,
                'result' => $this->words($row->result),
                'inspector' => $row->inspector ?: 'Not set',
            ]);
        $totals = (clone $query)->selectRaw('COUNT(*) c, COALESCE(SUM(q.inspected_quantity),0) k, COALESCE(SUM(q.passed_quantity),0) p, COALESCE(SUM(q.rejected_quantity),0) r')->first();
        $rate = (float) $totals->k > 0 ? round(((float) $totals->p / (float) $totals->k) * 100, 1) : 0;

        return [
            'title' => 'Quality report',
            'intro' => 'Quality checks done in the chosen dates and how many items passed.',
            'kpis' => [
                ['label' => 'Checks done', 'value' => (int) $totals->c, 'kind' => 'number'],
                ['label' => 'Items checked', 'value' => (float) $totals->k, 'kind' => 'number'],
                ['label' => 'Items rejected', 'value' => (float) $totals->r, 'kind' => 'number'],
                ['label' => 'Pass rate', 'value' => $rate, 'kind' => 'percent'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'kind' => 'date'],
                ['key' => 'number', 'label' => 'Check number', 'kind' => 'text'],
                ['key' => 'item', 'label' => 'Item', 'kind' => 'text'],
                ['key' => 'type', 'label' => 'Type', 'kind' => 'text'],
                ['key' => 'checked', 'label' => 'Checked', 'kind' => 'number'],
                ['key' => 'passed', 'label' => 'Passed', 'kind' => 'number'],
                ['key' => 'rejected', 'label' => 'Rejected', 'kind' => 'number'],
                ['key' => 'result', 'label' => 'Result', 'kind' => 'text'],
                ['key' => 'inspector', 'label' => 'Checked by', 'kind' => 'text'],
            ],
            'rows' => $rows,
            'statuses' => $statuses,
            'search_hint' => 'Search by check number, item or inspector',
        ];
    }

    // ---------------------------------------------------------------- people

    private function people(int $factoryId, Carbon $from, Carbon $to, string $search, string $status): array
    {
        $attendance = DB::table('employee_attendances')
            ->where('factory_id', $factoryId)
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw("user_id, SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) present_days, SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) absent_days")
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');
        $leave = DB::table('leave_requests')
            ->where('factory_id', $factoryId)
            ->where('status', 'approved')
            ->where('starts_at', '<=', $to->toDateString())
            ->where('ends_at', '>=', $from->toDateString())
            ->selectRaw('user_id, SUM(days_requested) days')
            ->groupBy('user_id')
            ->pluck('days', 'user_id');

        $base = DB::table('employee_profiles as p')
            ->join('users as u', 'u.id', '=', 'p.user_id')
            ->leftJoin('departments as d', 'd.id', '=', 'p.department_id')
            ->where('p.factory_id', $factoryId);
        $statuses = $this->statuses(clone $base, 'p.employment_status');
        $query = clone $base;
        $this->like($query, $search, ['u.name', 'p.employee_number', 'p.job_title', 'd.name']);
        if ($status !== '') $query->where('p.employment_status', $status);

        $rows = (clone $query)
            ->orderBy('u.name')
            ->limit(self::LIMIT)
            ->get(['p.user_id', 'u.name', 'p.employee_number', 'p.job_title', 'd.name as department', 'p.employment_status', 'p.hired_at'])
            ->map(fn ($row) => [
                'name' => $row->name,
                'number' => $row->employee_number ?: '—',
                'job' => $row->job_title ?: 'Not set',
                'department' => $row->department ?: 'Not set',
                'status' => $this->words($row->employment_status),
                'hired' => $row->hired_at,
                'present' => (int) ($attendance[$row->user_id]->present_days ?? 0),
                'absent' => (int) ($attendance[$row->user_id]->absent_days ?? 0),
                'leave' => (int) ($leave[$row->user_id] ?? 0),
            ]);
        $pending = DB::table('leave_requests')->where('factory_id', $factoryId)->where('status', 'pending')->count();

        return [
            'title' => 'People report',
            'intro' => 'Staff list with days present, absent and on leave in the chosen dates.',
            'kpis' => [
                ['label' => 'Staff', 'value' => $rows->count(), 'kind' => 'number'],
                ['label' => 'Days present', 'value' => $rows->sum('present'), 'kind' => 'number'],
                ['label' => 'Days absent', 'value' => $rows->sum('absent'), 'kind' => 'number'],
                ['label' => 'Leave waiting for a reply', 'value' => $pending, 'kind' => 'number'],
            ],
            'columns' => [
                ['key' => 'name', 'label' => 'Name', 'kind' => 'text'],
                ['key' => 'number', 'label' => 'Staff number', 'kind' => 'text'],
                ['key' => 'job', 'label' => 'Job', 'kind' => 'text'],
                ['key' => 'department', 'label' => 'Department', 'kind' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'kind' => 'text'],
                ['key' => 'hired', 'label' => 'Hired on', 'kind' => 'date'],
                ['key' => 'present', 'label' => 'Days present', 'kind' => 'number'],
                ['key' => 'absent', 'label' => 'Days absent', 'kind' => 'number'],
                ['key' => 'leave', 'label' => 'Days on leave', 'kind' => 'number'],
            ],
            'rows' => $rows,
            'statuses' => $statuses,
            'search_hint' => 'Search by name, staff number, job or department',
        ];
    }

    // ---------------------------------------------------------------- maintenance

    private function maintenance(int $factoryId, Carbon $from, Carbon $to, string $search, string $status): array
    {
        $base = DB::table('maintenance_records as m')
            ->leftJoin('machines as c', 'c.id', '=', 'm.machine_id')
            ->leftJoin('users as u', 'u.id', '=', 'm.assigned_to')
            ->where('m.factory_id', $factoryId)
            ->whereBetween('m.created_at', [$from, $to]);
        $statuses = $this->statuses(clone $base, 'm.status');
        $query = clone $base;
        $this->like($query, $search, ['m.title', 'c.name', 'u.name']);
        if ($status !== '') $query->where('m.status', $status);

        $rows = (clone $query)
            ->orderByDesc('m.created_at')
            ->limit(self::LIMIT)
            ->get(['m.created_at', 'm.title', 'c.name as machine', 'm.maintenance_type', 'm.priority', 'm.status', 'u.name as assigned', 'm.downtime_minutes', 'm.cost'])
            ->map(fn ($row) => [
                'date' => $row->created_at,
                'title' => $row->title,
                'machine' => $row->machine ?: 'Not set',
                'type' => $this->words($row->maintenance_type),
                'priority' => $this->words($row->priority),
                'status' => $this->words($row->status),
                'assigned' => $row->assigned ?: 'Not assigned',
                'downtime' => (int) $row->downtime_minutes,
                'cost' => (float) $row->cost,
            ]);
        $open = (clone $query)->whereNotIn('m.status', ['completed', 'closed', 'cancelled'])->count();
        $totals = (clone $query)->selectRaw('COUNT(*) c, COALESCE(SUM(m.downtime_minutes),0) d, COALESCE(SUM(m.cost),0) cost')->first();

        return [
            'title' => 'Maintenance report',
            'intro' => 'Repair and service jobs opened in the chosen dates.',
            'kpis' => [
                ['label' => 'Jobs', 'value' => (int) $totals->c, 'kind' => 'number'],
                ['label' => 'Still open', 'value' => $open, 'kind' => 'number'],
                ['label' => 'Minutes machines stopped', 'value' => (int) $totals->d, 'kind' => 'number'],
                ['label' => 'Repair cost', 'value' => (float) $totals->cost, 'kind' => 'money'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'kind' => 'date'],
                ['key' => 'title', 'label' => 'Job', 'kind' => 'text'],
                ['key' => 'machine', 'label' => 'Machine', 'kind' => 'text'],
                ['key' => 'type', 'label' => 'Type', 'kind' => 'text'],
                ['key' => 'priority', 'label' => 'Priority', 'kind' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'kind' => 'text'],
                ['key' => 'assigned', 'label' => 'Given to', 'kind' => 'text'],
                ['key' => 'downtime', 'label' => 'Minutes stopped', 'kind' => 'number'],
                ['key' => 'cost', 'label' => 'Cost', 'kind' => 'money'],
            ],
            'rows' => $rows,
            'statuses' => $statuses,
            'search_hint' => 'Search by job, machine or person',
        ];
    }

    // ---------------------------------------------------------------- safety

    private function safety(int $factoryId, Carbon $from, Carbon $to, string $search, string $status): array
    {
        $base = DB::table('safety_incidents as s')
            ->leftJoin('users as u', 'u.id', '=', 's.reported_by')
            ->where('s.factory_id', $factoryId)
            ->whereBetween('s.incident_date', [$from->toDateString(), $to->toDateString()]);
        $statuses = $this->statuses(clone $base, 's.status');
        $query = clone $base;
        $this->like($query, $search, ['s.location', 's.description', 's.injured_person', 'u.name']);
        if ($status !== '') $query->where('s.status', $status);

        $rows = (clone $query)
            ->orderByDesc('s.incident_date')
            ->orderByDesc('s.id')
            ->limit(self::LIMIT)
            ->get(['s.incident_date', 's.location', 's.description', 's.severity', 's.injured_person', 's.status', 'u.name as reporter'])
            ->map(fn ($row) => [
                'date' => $row->incident_date,
                'location' => $row->location ?: 'Not set',
                'description' => $row->description,
                'severity' => $this->words($row->severity),
                'injured' => $row->injured_person ?: 'Nobody',
                'status' => $this->words($row->status),
                'reporter' => $row->reporter ?: 'Not set',
            ]);
        $open = (clone $query)->whereNotIn('s.status', ['resolved', 'closed'])->count();
        $serious = (clone $query)->whereIn('s.severity', ['major', 'serious', 'critical', 'high'])->count();
        $injured = (clone $query)->whereNotNull('s.injured_person')->where('s.injured_person', '!=', '')->count();

        return [
            'title' => 'Safety report',
            'intro' => 'Accidents and near misses reported in the chosen dates.',
            'kpis' => [
                ['label' => 'Incidents', 'value' => (clone $query)->count(), 'kind' => 'number'],
                ['label' => 'Still open', 'value' => $open, 'kind' => 'number'],
                ['label' => 'Serious cases', 'value' => $serious, 'kind' => 'number'],
                ['label' => 'People hurt', 'value' => $injured, 'kind' => 'number'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'kind' => 'date'],
                ['key' => 'location', 'label' => 'Place', 'kind' => 'text'],
                ['key' => 'description', 'label' => 'What happened', 'kind' => 'text'],
                ['key' => 'severity', 'label' => 'How serious', 'kind' => 'text'],
                ['key' => 'injured', 'label' => 'Person hurt', 'kind' => 'text'],
                ['key' => 'status', 'label' => 'Status', 'kind' => 'text'],
                ['key' => 'reporter', 'label' => 'Reported by', 'kind' => 'text'],
            ],
            'rows' => $rows,
            'statuses' => $statuses,
            'search_hint' => 'Search by place, description or person',
        ];
    }

    // ---------------------------------------------------------------- audit

    private function audit(int $factoryId, Carbon $from, Carbon $to, string $search, string $status): array
    {
        $base = DB::table('audit_logs as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.user_id')
            ->where('a.factory_id', $factoryId)
            ->whereBetween('a.created_at', [$from, $to]);
        $statuses = $this->statuses(clone $base, 'a.event');
        $query = clone $base;
        $this->like($query, $search, ['a.description', 'a.event', 'u.name']);
        if ($status !== '') $query->where('a.event', $status);

        $rows = (clone $query)
            ->orderByDesc('a.created_at')
            ->limit(self::LIMIT)
            ->get(['a.created_at', 'u.name as person', 'a.event', 'a.description'])
            ->map(fn ($row) => [
                'date' => $row->created_at,
                'person' => $row->person ?: 'System',
                'event' => $this->words($row->event),
                'description' => $row->description,
            ]);
        $people = (clone $query)->whereNotNull('a.user_id')->distinct()->count('a.user_id');

        return [
            'title' => 'Audit report',
            'intro' => 'Who did what in the system during the chosen dates.',
            'kpis' => [
                ['label' => 'Actions recorded', 'value' => (clone $query)->count(), 'kind' => 'number'],
                ['label' => 'People active', 'value' => $people, 'kind' => 'number'],
                ['label' => 'Kinds of action', 'value' => (clone $query)->distinct()->count('a.event'), 'kind' => 'number'],
            ],
            'columns' => [
                ['key' => 'date', 'label' => 'Date', 'kind' => 'date'],
                ['key' => 'person', 'label' => 'Person', 'kind' => 'text'],
                ['key' => 'event', 'label' => 'Action', 'kind' => 'text'],
                ['key' => 'description', 'label' => 'Details', 'kind' => 'text'],
            ],
            'rows' => $rows,
            'statuses' => $statuses,
            'status_label' => 'Action',
            'search_hint' => 'Search by person or details',
        ];
    }

    // ---------------------------------------------------------------- helpers

    /** Add an "any column contains the text" filter. */
    private function like($query, string $search, array $columns): void
    {
        if ($search === '') return;
        $term = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
        $query->where(function ($inner) use ($columns, $term) {
            foreach ($columns as $column) {
                $inner->orWhere($column, 'like', $term);
            }
        });
    }

    /** The values that exist in the chosen dates, so the filter only offers real choices. */
    private function statuses($query, string $column): array
    {
        return $query
            ->whereNotNull($column)
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->map(fn ($value) => ['value' => (string) $value, 'label' => $this->words((string) $value)])
            ->values()
            ->all();
    }

    private function words(?string $value): string
    {
        return $value === null || $value === '' ? '—' : Str::of($value)->replace(['_', '.'], ' ')->lower()->ucfirst()->toString();
    }
}
