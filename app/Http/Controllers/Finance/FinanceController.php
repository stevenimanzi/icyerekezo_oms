<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\SalesDocument;
use App\Models\SalesPayment;
use App\Models\SchoolPaymentSubmission;
use App\Models\StockBalance;
use App\Models\Warehouse;
use App\Support\Security\PrivateFile;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FinanceController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $orders = SalesDocument::where('factory_id', $factoryId)->where('document_type', 'customer_order');

        $invoiced = (float) (clone $orders)->sum('total_amount');
        $paid = (float) (clone $orders)->sum('paid_amount');

        $paymentTrend = collect(range(6, 0))
            ->map(function (int $daysAgo) use ($factoryId) {
                $day = today()->subDays($daysAgo);

                $schoolPaid = (float) SchoolPaymentSubmission::where('factory_id', $factoryId)
                    ->where('status', 'approved')
                    ->whereDate('reviewed_at', $day)
                    ->sum('amount');

                $directPaid = (float) SalesPayment::whereHas('salesDocument', fn ($q) => $q->where('factory_id', $factoryId))
                    ->whereDate('paid_on', $day)
                    ->sum('amount');

                return [
                    'date' => $day->format('M j'),
                    'approved' => round($schoolPaid + $directPaid, 2),
                ];
            })
            ->values();

        $warehouseIds = Warehouse::where('factory_id', $factoryId)->pluck('id');
        $inventoryValue = (float) StockBalance::whereIn('stock_balances.warehouse_id', $warehouseIds)
            ->join('items', 'items.id', '=', 'stock_balances.item_id')
            ->selectRaw('COALESCE(SUM(stock_balances.quantity_on_hand * items.standard_cost), 0) as val')
            ->value('val');

        return response()->json([
            'payment_trend' => $paymentTrend,
            'summary' => [
                'invoiced_amount' => $invoiced,
                'paid_amount' => $paid,
                'outstanding_amount' => max(0, $invoiced - $paid),
                'inventory_value' => round($inventoryValue, 2),
                'pending_receipts' => SchoolPaymentSubmission::where('factory_id', $factoryId)
                    ->where('status', 'pending')
                    ->count(),
                'orders_count' => (clone $orders)->count(),
            ],
            'orders' => (clone $orders)
                ->with('school:id,name')
                ->latest('document_date')
                ->latest('id')
                ->limit(200)
                ->get([
                    'id',
                    'document_number',
                    'customer_name',
                    'school_id',
                    'status',
                    'payment_status',
                    'currency_code',
                    'total_amount',
                    'paid_amount',
                    'item_count',
                    'document_date',
                ]),
            'pending_receipts' => SchoolPaymentSubmission::where('factory_id', $factoryId)
                ->where('status', 'pending')
                ->with(['school:id,name', 'salesDocument:id,document_number,total_amount,paid_amount,payment_status'])
                ->latest()
                ->get()
                ->map(
                    fn ($submission) => [
                        ...$submission->toArray(),
                        'proof_url' => PrivateFile::url($submission->proof_path),
                    ],
                ),
            'recent_decisions' => SchoolPaymentSubmission::where('factory_id', $factoryId)
                ->whereIn('status', ['approved', 'rejected'])
                ->with(['school:id,name', 'salesDocument:id,document_number', 'reviewer:id,name'])
                ->latest('reviewed_at')
                ->limit(30)
                ->get(),
        ]);
    }

    public function decidePayment(Request $request, SchoolPaymentSubmission $submission): JsonResponse
    {
        abort_unless($submission->factory_id === $request->user()->current_factory_id, 404);
        abort_unless($submission->status === 'pending', 422, 'This receipt has already been reviewed.');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'review_note' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($submission, $data, $request) {
            $submission->update([
                'status' => $data['decision'],
                'review_note' => $data['review_note'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);
            if ($data['decision'] === 'approved') {
                $document = SalesDocument::where('factory_id', $request->user()->current_factory_id)
                    ->lockForUpdate()
                    ->findOrFail($submission->sales_document_id);
                $paid = (float) $document->paid_amount + (float) $submission->amount;
                $document->update([
                    'paid_amount' => $paid,
                    'payment_status' => $paid >= (float) $document->total_amount ? 'paid' : ($paid > 0 ? 'partially_paid' : 'unpaid'),
                ]);
            }
        });

        return response()->json([
            'message' => $data['decision'] === 'approved'
                    ? 'Payment approved and applied to the order.'
                    : 'Payment receipt rejected.',
        ]);
    }

    private const REPORT_TYPE_LABELS = [
        'revenue' => 'Revenue & collections summary',
        'invoices' => 'Invoice register',
        'receipts' => 'Cash receipts book',
        'aging' => 'Outstanding & aging report',
    ];

    public function report(Request $request): JsonResponse
    {
        $factory = $request->user()->currentFactory;
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'type' => ['nullable', Rule::in(array_keys(self::REPORT_TYPE_LABELS))],
            'period' => ['nullable', Rule::in(['today', 'week', 'month', 'quarter', 'year', 'custom'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $type = $data['type'] ?? 'revenue';
        $period = $data['period'] ?? 'month';
        [$from, $to] = $this->resolveReportRange($period, $data['from'] ?? null, $data['to'] ?? null);

        $ordersBase = SalesDocument::where('factory_id', $factoryId)->where('document_type', 'customer_order');
        $receiptsBase = SchoolPaymentSubmission::where('factory_id', $factoryId)->where('status', 'approved');
        $directPaymentsBase = SalesPayment::whereHas('salesDocument', fn ($q) => $q->where('factory_id', $factoryId));

        $orders = (clone $ordersBase)->whereBetween('document_date', [$from->toDateString(), $to->toDateString()]);
        $receipts = (clone $receiptsBase)->whereBetween('reviewed_at', [
            $from->copy()->startOfDay(),
            $to->copy()->endOfDay(),
        ]);
        $directPayments = (clone $directPaymentsBase)->whereBetween('paid_on', [
            $from->toDateString(),
            $to->toDateString(),
        ]);

        $invoiced = (float) (clone $orders)->sum('total_amount');
        $schoolCollected = (float) (clone $receipts)->sum('amount');
        $directCollected = (float) (clone $directPayments)->sum('amount');
        $collected = round($schoolCollected + $directCollected, 2);

        $warehouseIds = Warehouse::where('factory_id', $factoryId)->pluck('id');
        $inventoryValue = (float) StockBalance::whereIn('stock_balances.warehouse_id', $warehouseIds)
            ->join('items', 'items.id', '=', 'stock_balances.item_id')
            ->selectRaw('COALESCE(SUM(stock_balances.quantity_on_hand * items.standard_cost), 0) as val')
            ->value('val');

        $payload = [
            'report' => [
                'type' => $type,
                'type_label' => self::REPORT_TYPE_LABELS[$type],
                'period' => $period,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'generated_at' => now()->toIso8601String(),
                'generated_by' => $request->user()->name,
            ],
            'factory' => [
                'name' => $factory->name,
                'industry' => str_replace('_', ' ', (string) ($factory->industry_type ?? '')),
            ],
            'summary' => [
                'invoiced_amount' => $invoiced,
                'collected_amount' => $collected,
                'outstanding_amount' => (float) (clone $ordersBase)
                    ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as balance')
                    ->value('balance'),
                'inventory_value' => round($inventoryValue, 2),
                'orders_count' => (clone $orders)->count(),
                'receipts_count' => (clone $receipts)->count() + (clone $directPayments)->count(),
                'overdue_count' => (clone $ordersBase)
                    ->whereNotIn('payment_status', ['paid'])
                    ->whereNotNull('due_date')
                    ->whereDate('due_date', '<', today())
                    ->count(),
            ],
        ];

        if ($type === 'invoices') {
            $payload['rows'] = (clone $orders)
                ->with('school:id,name')
                ->orderBy('document_date')
                ->orderBy('id')
                ->get([
                    'id',
                    'document_number',
                    'customer_name',
                    'school_id',
                    'document_date',
                    'due_date',
                    'status',
                    'payment_status',
                    'currency_code',
                    'total_amount',
                    'paid_amount',
                    'invoice_path',
                ])
                ->map(
                    fn (SalesDocument $order) => [
                        'document_number' => $order->document_number,
                        'customer_name' => $order->school?->name ?? $order->customer_name,
                        'document_date' => $order->document_date?->toDateString(),
                        'due_date' => $order->due_date?->toDateString(),
                        'status' => $order->status,
                        'payment_status' => $order->payment_status,
                        'currency_code' => $order->currency_code,
                        'total_amount' => (float) $order->total_amount,
                        'paid_amount' => (float) $order->paid_amount,
                        'balance' => (float) $order->total_amount - (float) $order->paid_amount,
                        'invoice_uploaded' => (bool) $order->invoice_path,
                    ],
                );
        } elseif ($type === 'receipts') {
            $schoolRows = (clone $receipts)
                ->with(['school:id,name', 'salesDocument:id,document_number', 'reviewer:id,name'])
                ->get()
                ->map(
                    fn (SchoolPaymentSubmission $receipt) => [
                        'reviewed_at' => $receipt->reviewed_at?->toDateString(),
                        'customer_name' => $receipt->school?->name ?? 'School',
                        'document_number' => $receipt->salesDocument?->document_number,
                        'payment_method' => $receipt->payment_method,
                        'payment_reference' => $receipt->payment_reference,
                        'amount' => (float) $receipt->amount,
                        'reviewer' => $receipt->reviewer?->name ?? 'Finance Officer',
                    ],
                );

            $directRows = (clone $directPayments)
                ->with(['salesDocument:id,document_number,customer_name', 'recorder:id,name'])
                ->get()
                ->map(
                    fn (SalesPayment $payment) => [
                        'reviewed_at' => $payment->paid_on?->toDateString() ?? $payment->created_at?->toDateString(),
                        'customer_name' => $payment->salesDocument?->customer_name ?? 'Customer',
                        'document_number' => $payment->salesDocument?->document_number,
                        'payment_method' => $payment->method,
                        'payment_reference' => $payment->reference,
                        'amount' => (float) $payment->amount,
                        'reviewer' => $payment->recorder?->name ?? 'Sales Officer',
                    ],
                );

            $payload['rows'] = $schoolRows->concat($directRows)->sortByDesc('reviewed_at')->values();
        } elseif ($type === 'aging') {
            $payload['rows'] = (clone $ordersBase)
                ->whereIn('payment_status', ['unpaid', 'partially_paid'])
                ->with('school:id,name')
                ->orderBy('due_date')
                ->orderBy('id')
                ->get([
                    'id',
                    'document_number',
                    'customer_name',
                    'school_id',
                    'due_date',
                    'currency_code',
                    'total_amount',
                    'paid_amount',
                    'payment_status',
                ])
                ->map(
                    fn (SalesDocument $order) => [
                        'document_number' => $order->document_number,
                        'customer_name' => $order->school?->name ?? $order->customer_name,
                        'due_date' => $order->due_date?->toDateString(),
                        'currency_code' => $order->currency_code,
                        'balance' => (float) $order->total_amount - (float) $order->paid_amount,
                        'days_overdue' => $order->due_date && $order->due_date->lt(today())
                                ? (int) today()->diffInDays($order->due_date)
                                : 0,
                    ],
                );
        } else {
            $payload['trend'] = $this->buildRevenueTrend($from, $to, $ordersBase, $receiptsBase);
        }

        return response()->json($payload);
    }

    private function resolveReportRange(string $period, ?string $from, ?string $to): array
    {
        $today = today();

        return match ($period) {
            'today' => [$today->copy(), $today->copy()],
            'week' => [$today->copy()->startOfWeek(), $today->copy()->endOfWeek()],
            'quarter' => [$today->copy()->startOfQuarter(), $today->copy()->endOfQuarter()],
            'year' => [$today->copy()->startOfYear(), $today->copy()->endOfYear()],
            'custom' => [
                Carbon::parse($from ?: $today->toDateString())->startOfDay(),
                Carbon::parse($to ?: $today->toDateString())->startOfDay(),
            ],
            default => [$today->copy()->startOfMonth(), $today->copy()->endOfMonth()],
        };
    }

    private function buildRevenueTrend(Carbon $from, Carbon $to, $ordersBase, $receiptsBase): array
    {
        $monthly = $from->diffInDays($to) > 62;
        $rows = [];
        $cursor = $monthly ? $from->copy()->startOfMonth() : $from->copy();
        while ($cursor <= $to) {
            $periodStart = $cursor->lt($from) ? $from->copy() : $cursor->copy();
            $monthEnd = $cursor->copy()->endOfMonth();
            $periodEnd = $monthly ? ($monthEnd->gt($to) ? $to->copy() : $monthEnd) : $cursor->copy();
            $rows[] = [
                'label' => $monthly ? $cursor->format('M Y') : $cursor->format('M j'),
                'invoiced' => (float) (clone $ordersBase)
                    ->whereBetween('document_date', [$periodStart->toDateString(), $periodEnd->toDateString()])
                    ->sum('total_amount'),
                'collected' => (float) (clone $receiptsBase)
                    ->whereBetween('reviewed_at', [$periodStart->copy()->startOfDay(), $periodEnd->copy()->endOfDay()])
                    ->sum('amount'),
            ];
            $monthly ? $cursor->addMonthNoOverflow() : $cursor->addDay();
        }

        return $rows;
    }
}
