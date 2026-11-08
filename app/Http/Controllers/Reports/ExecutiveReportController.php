<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Finance\FinanceBooksController;
use App\Models\User;
use App\Support\Reports\OwnerOverviewReport;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The "whole factory" overview shown to the owner, administrator and manager of the active factory.
 * Every number comes from the same builders the department reports use, for the same dates.
 */
class ExecutiveReportController extends Controller
{
    /** Roles that may read every department of the factory they are working in. */
    public const EXECUTIVE_ROLES = ['factory-owner', 'factory-administrator', 'factory-manager'];

    public static function isExecutive(User $user, int $factoryId): bool
    {
        if ($user->is_platform_admin) {
            return true;
        }

        return $user
            ->roles()
            ->wherePivot('factory_id', $factoryId)
            ->get(['roles.slug', 'roles.dashboard_key'])
            ->contains(fn ($role) => in_array($role->slug, self::EXECUTIVE_ROLES, true) || $role->dashboard_key === 'executive');
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $factoryId = (int) $user->current_factory_id;
        abort_unless(self::isExecutive($user, $factoryId), 403, 'Only the factory owner, administrator or manager can open the whole-factory report.');

        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $to = isset($filters['to']) ? Carbon::parse($filters['to'])->endOfDay() : now()->endOfDay();
        $from = isset($filters['from']) ? Carbon::parse($filters['from'])->startOfDay() : $to->copy()->subDays(29)->startOfDay();
        abort_if($from->diffInDays($to) > 800, 422, 'Please choose a shorter period.');

        $report = (new OwnerOverviewReport($factoryId, max(1, (int) $from->diffInDays($to) + 1), $from, $to))->build();
        $currency = $user->currentFactory?->currency_code ?: 'RWF';

        $books = rescue(function () use ($user, $from, $to) {
            $inner = Request::create('/', 'GET', ['from' => $from->toDateString(), 'to' => $to->toDateString()]);
            $inner->setUserResolver(fn () => $user);

            return app(FinanceBooksController::class)->cashbook($inner)->getData(true);
        }, null, false);

        $purchasing = DB::table('purchase_documents')
            ->where('factory_id', $factoryId)
            ->whereBetween('document_date', [$from->toDateString(), $to->toDateString()])
            ->whereNotIn('status', ['cancelled', 'rejected'])
            ->selectRaw("COUNT(*) c, COALESCE(SUM(total_amount),0) t, COALESCE(SUM(CASE WHEN status NOT IN ('received','closed') THEN 1 ELSE 0 END),0) open_count")
            ->first();

        $number = fn (string $label, $value, ?string $hint = null, bool $bad = false) => ['label' => $label, 'value' => $value, 'kind' => 'number', 'hint' => $hint, 'tone' => $bad && $value > 0 ? 'bad' : null];
        $money = fn (string $label, $value, ?string $hint = null, bool $bad = false) => ['label' => $label, 'value' => $value, 'kind' => 'money', 'hint' => $hint, 'tone' => $bad && $value > 0 ? 'bad' : null];
        $percent = fn (string $label, $value, ?string $hint = null) => ['label' => $label, 'value' => $value, 'kind' => 'percent', 'hint' => $hint, 'tone' => null];
        $minutes = fn (string $label, $value, ?string $hint = null) => ['label' => $label, 'value' => $value, 'kind' => 'minutes', 'hint' => $hint, 'tone' => null];

        $c = $report['customers'];
        $cash = $report['cash'];
        $p = $report['production'];
        $s = $report['stock'];
        $q = $report['quality'];
        $h = $report['people'];
        $m = $report['equipment'];
        $f = $report['safety'];
        $growth = $report['growth']['revenue'];
        $change = $growth['change'] === null ? 'No earlier period to compare' : ($growth['change'] >= 0 ? '+' : '') . $growth['change'] . '% compared with the period before';

        $sections = [
            [
                'key' => 'sales',
                'title' => 'Sales',
                'tab' => 'sales',
                'kpis' => [
                    $money('Sales value', $growth['current'], $change),
                    $number('Orders received', $c['received']),
                    $number('Orders still open', $c['open']),
                    $number('Orders late', $c['late'], 'Past their due date and not delivered', true),
                    $percent('Delivered of ordered', $c['fulfilment_rate'], 'All orders to date'),
                    $number('Returns', $c['returns']),
                ],
            ],
            [
                'key' => 'finance',
                'title' => 'Money',
                'tab' => 'finance',
                'kpis' => array_values(array_filter([
                    $books ? $money('Money received', $books['summary']['money_in'], 'Cash book, same dates') : null,
                    $books ? $money('Money paid out', $books['summary']['money_out'], 'Cash book, same dates') : null,
                    $books ? $money('Net cash', $books['summary']['net'], 'Received minus paid out') : null,
                    $books ? $money('Cash position today', $books['summary']['cash_position']) : null,
                    $money('Customers still owe', $cash['receivable'], 'All unpaid orders to date'),
                    $money('Overdue from customers', $cash['overdue_receivable'], $cash['overdue_orders'] . ' orders past due date', true),
                    $money('We still owe suppliers', $cash['payable'], 'Unpaid purchase orders to date'),
                    $number('Receipts waiting for approval', $cash['pending_receipts']),
                ])),
            ],
            [
                'key' => 'production',
                'title' => 'Production',
                'tab' => 'production',
                'kpis' => array_values(array_filter([
                    $number('Planned', $p['planned'], 'Orders opened in these dates'),
                    $number('Made', $p['completed']),
                    $percent('Made of planned', $p['completion_rate']),
                    $percent('Rejected', $p['reject_rate'], 'Rejected out of made plus rejected'),
                    $number('Orders open now', $p['open_orders']),
                    $number('Orders late', $p['late_orders'], 'Open and past planned end date', true),
                    $percent('Finished on time', $p['on_time_rate'], 'Orders completed in these dates'),
                    $minutes('Machine time lost', $p['downtime_minutes'], 'From production stage records'),
                    $report['flow'] ? $number('Lots in production', $report['flow']['lots_open']) : null,
                    $report['flow'] ? $number('Lots on hold', $report['flow']['lots_held'], null, true) : null,
                    $report['flow'] ? $number('Waiting for final check', $report['flow']['awaiting_final_check']) : null,
                ])),
            ],
            [
                'key' => 'stock',
                'title' => 'Stock',
                'tab' => 'stock',
                'kpis' => [
                    $money('Stock value', $s['value'], 'On hand now, at standard cost'),
                    $number('Items tracked', $s['tracked_items']),
                    $number('Items running low', $s['low_stock'], 'At or below the reorder level', true),
                    $number('Items out of stock', $s['out_of_stock'], null, true),
                    $number('Batches expiring in 30 days', $s['expiring_soon'], null, true),
                ],
            ],
            [
                'key' => 'procurement',
                'title' => 'Purchasing',
                'tab' => 'procurement',
                'kpis' => [
                    $number('Purchase documents', (int) $purchasing->c, 'Cancelled and rejected not counted'),
                    $money('Purchase value', (float) $purchasing->t),
                    $number('Still open', (int) $purchasing->open_count),
                ],
            ],
            [
                'key' => 'quality',
                'title' => 'Quality',
                'tab' => 'quality',
                'kpis' => [
                    $number('First checks done', $q['inspections'], 'Re-checks are not counted again'),
                    $percent('Checks passed', $q['pass_rate']),
                    $number('Checks failed', $q['failed'], null, true),
                    $number('Pieces rejected', $q['rejected_quantity']),
                    $number('Pieces recovered by re-check', $q['recovered_quantity']),
                    $number('Checks waiting', $q['pending']),
                ],
            ],
            [
                'key' => 'people',
                'title' => 'People',
                'tab' => 'people',
                'kpis' => [
                    $number('Active staff', $h['headcount']),
                    $percent('Attendance', $h['attendance_rate'], 'Present or late, out of marked days'),
                    $number('Late arrivals', $h['late']),
                    $number('Absences', $h['absent'], null, true),
                    $number('On leave today', $h['on_leave_today']),
                    $number('Leave waiting for a reply', $h['pending_leave']),
                ],
            ],
            [
                'key' => 'maintenance',
                'title' => 'Machines',
                'tab' => 'maintenance',
                'kpis' => [
                    $number('Machines', $m['machines']),
                    $number('Not working now', $m['unavailable'], 'Stopped, broken or being repaired', true),
                    $percent('Machines working', $m['availability_rate']),
                    $number('Service overdue', $m['service_overdue'], null, true),
                    $number('Jobs open', $m['open_jobs']),
                    $minutes('Stopped for repairs', $m['downtime_minutes']),
                    $money('Repair cost', $cash['maintenance_cost']),
                ],
            ],
            [
                'key' => 'safety',
                'title' => 'Safety',
                'tab' => 'safety',
                'kpis' => [
                    $number('Incidents', $f['incidents']),
                    $number('Still open', $f['open'], 'All dates', true),
                    $number('Serious and open', $f['serious_open'], null, true),
                    $f['days_without_incident'] === null
                        ? $number('Days without incident', 0, 'No incident has been recorded')
                        : $number('Days without incident', $f['days_without_incident']),
                ],
            ],
        ];

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'currency' => $currency,
            'factory' => $user->currentFactory?->name,
            'sections' => $sections,
            'alerts' => $report['alerts'],
            'trend' => $report['trend'],
            'top_customers' => $c['top'],
            'generated_at' => now()->toIso8601String(),
        ]);
    }
}
