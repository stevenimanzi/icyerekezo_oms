<?php

namespace App\Support\Reports;

use App\Models\SalesPayment;
use App\Models\SchoolPaymentSubmission;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final class SalesReport
{
    private const IGNORED_STATUSES = ['cancelled', 'rejected'];

    private const DAILY_LIMIT_DAYS = 62;

    private CarbonInterface $from;

    private CarbonInterface $to;

    public function __construct(private readonly int $factoryId, CarbonInterface $from, CarbonInterface $to)
    {
        $this->from = $from->copy()->startOfDay();
        $this->to = $to->copy()->endOfDay();
    }

    public function build(): array
    {
        $days = (int) $this->from->diffInDays($this->to) + 1;
        $previousTo = $this->from->copy()->subDay()->endOfDay();
        $previousFrom = $previousTo->copy()->subDays($days - 1)->startOfDay();

        $current = $this->totals($this->from, $this->to);
        $previous = $this->totals($previousFrom, $previousTo);

        return [
            'period' => ['from' => $this->from->toDateString(), 'to' => $this->to->toDateString(), 'days' => $days],
            'summary' => [
                'revenue' => $this->compare($current['revenue'], $previous['revenue']),
                'sales' => $this->compare($current['sales'], $previous['sales']),
                'average_sale' => $this->compare($current['average'], $previous['average']),
                'items_sold' => $this->compare($current['items'], $previous['items']),
                'discounts' => $current['discounts'],
                'collected' => $this->collectedBetween($this->from, $this->to),
                'outstanding' => $this->outstanding(),
            ],
            'trend' => $this->trend($days),
            'top_products' => $this->topProducts(),
            'top_customers' => $this->topCustomers(),
            'payment_methods' => $this->paymentMethods(),
            'debtors' => $this->debtors(),
            'sellers' => $this->sellers(),
        ];
    }

    private function documents()
    {
        return DB::table('sales_documents as d')
            ->where('d.factory_id', $this->factoryId)
            ->where('d.document_type', 'customer_order')
            ->whereNotIn('d.status', self::IGNORED_STATUSES);
    }

    private function inPeriod($query, CarbonInterface $from, CarbonInterface $to)
    {
        return $query
            ->where('d.document_date', '>=', $from->toDateString())
            ->where('d.document_date', '<', $to->copy()->addDay()->toDateString());
    }

    private function totals(CarbonInterface $from, CarbonInterface $to): array
    {
        $row = $this->inPeriod($this->documents(), $from, $to)
            ->selectRaw('COUNT(*) as sales, COALESCE(SUM(d.total_amount), 0) as revenue, COALESCE(SUM(d.item_count), 0) as items, COALESCE(SUM(d.discount_amount), 0) as discounts')
            ->first();

        $sales = (int) $row->sales;
        $revenue = (float) $row->revenue;

        return [
            'sales' => $sales,
            'revenue' => $revenue,
            'items' => (float) $row->items,
            'discounts' => (float) $row->discounts,
            'average' => $sales > 0 ? round($revenue / $sales, 2) : 0.0,
        ];
    }

    private function compare(float|int $current, float|int $previous): array
    {
        return [
            'current' => (float) $current,
            'previous' => (float) $previous,
            'change' => $previous > 0 ? round(($current - $previous) / $previous * 100, 1) : null,
        ];
    }

    private function collectedBetween(CarbonInterface $from, CarbonInterface $to): float
    {
        $manual = (float) SalesPayment::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('paid_on', '>=', $from->toDateString())
            ->where('paid_on', '<', $to->copy()->addDay()->toDateString())
            ->sum('amount');

        $schools = (float) SchoolPaymentSubmission::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('status', 'approved')
            ->whereBetween('reviewed_at', [$from, $to])
            ->sum('amount');

        return $manual + $schools;
    }

    private function outstanding(): float
    {
        return (float) $this->documents()
            ->where('d.payment_status', '!=', 'paid')
            ->selectRaw('COALESCE(SUM(d.total_amount - d.paid_amount), 0) as balance')
            ->value('balance');
    }

    private function trend(int $days): array
    {
        $rows = $this->inPeriod($this->documents(), $this->from, $this->to)
            ->selectRaw('d.document_date as day, COUNT(*) as sales, COALESCE(SUM(d.total_amount), 0) as revenue')
            ->groupBy('d.document_date')
            ->get()
            ->keyBy(fn ($row) => substr((string) $row->day, 0, 10));

        if ($days <= self::DAILY_LIMIT_DAYS) {
            return collect(range(0, $days - 1))->map(function (int $offset) use ($rows) {
                $date = $this->from->copy()->addDays($offset);
                $row = $rows->get($date->toDateString());

                return [
                    'label' => $date->format('d M'),
                    'sales' => (int) ($row->sales ?? 0),
                    'revenue' => (float) ($row->revenue ?? 0),
                ];
            })->all();
        }

        return $rows->groupBy(fn ($row, $day) => substr($day, 0, 7))
            ->map(fn ($group, $month) => [
                'label' => \Carbon\Carbon::createFromFormat('Y-m', $month)->format('M Y'),
                'sales' => (int) $group->sum('sales'),
                'revenue' => (float) $group->sum('revenue'),
            ])
            ->sortKeys()
            ->values()
            ->all();
    }

    private function topProducts(): array
    {
        return $this->inPeriod($this->documents(), $this->from, $this->to)
            ->join('sales_document_lines as l', 'l.sales_document_id', '=', 'd.id')
            ->leftJoin('items as i', 'i.id', '=', 'l.item_id')
            ->selectRaw("COALESCE(i.name, l.garment_category, 'Other') as name, SUM(l.quantity_ordered) as quantity, COALESCE(SUM(l.line_total), 0) as revenue")
            ->groupBy('l.item_id', 'i.name', 'l.garment_category')
            ->orderByDesc('quantity')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'quantity' => (int) $row->quantity, 'revenue' => (float) $row->revenue])
            ->all();
    }

    private function topCustomers(): array
    {
        return $this->inPeriod($this->documents(), $this->from, $this->to)
            ->selectRaw("COALESCE(d.customer_name, 'Unknown') as name, COUNT(*) as sales, COALESCE(SUM(d.total_amount), 0) as revenue, COALESCE(SUM(d.total_amount - d.paid_amount), 0) as owes")
            ->groupBy('d.customer_name')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'sales' => (int) $row->sales, 'revenue' => (float) $row->revenue, 'owes' => (float) $row->owes])
            ->all();
    }

    private function paymentMethods(): array
    {
        return SalesPayment::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('paid_on', '>=', $this->from->toDateString())
            ->where('paid_on', '<', $this->to->copy()->addDay()->toDateString())
            ->selectRaw('method, COUNT(*) as payments, SUM(amount) as amount')
            ->groupBy('method')
            ->orderByDesc('amount')
            ->get()
            ->map(fn ($row) => ['method' => $row->method, 'payments' => (int) $row->payments, 'amount' => (float) $row->amount])
            ->all();
    }

    private function debtors(): array
    {
        return $this->documents()
            ->where('d.payment_status', '!=', 'paid')
            ->whereRaw('d.total_amount - d.paid_amount > 0')
            ->selectRaw('d.id, d.document_number, d.customer_name, d.customer_phone, d.document_date, d.due_date, d.total_amount, d.paid_amount')
            ->orderByRaw('COALESCE(d.due_date, d.document_date)')
            ->limit(12)
            ->get()
            ->map(function ($row) {
                $dueOn = \Carbon\Carbon::parse($row->due_date ?: $row->document_date);

                return [
                    'id' => (int) $row->id,
                    'number' => $row->document_number,
                    'customer' => $row->customer_name,
                    'phone' => $row->customer_phone,
                    'sold_on' => substr((string) $row->document_date, 0, 10),
                    'due_on' => $row->due_date ? substr((string) $row->due_date, 0, 10) : null,
                    'total' => (float) $row->total_amount,
                    'balance' => round((float) $row->total_amount - (float) $row->paid_amount, 2),
                    'days_late' => max(0, (int) $dueOn->diffInDays(now(), false)),
                ];
            })
            ->all();
    }

    private function sellers(): array
    {
        return $this->inPeriod($this->documents(), $this->from, $this->to)
            ->leftJoin('users as u', 'u.id', '=', 'd.created_by')
            ->selectRaw("COALESCE(u.name, 'Unknown') as name, COUNT(*) as sales, COALESCE(SUM(d.total_amount), 0) as revenue")
            ->groupBy('d.created_by', 'u.name')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'sales' => (int) $row->sales, 'revenue' => (float) $row->revenue])
            ->all();
    }
}
