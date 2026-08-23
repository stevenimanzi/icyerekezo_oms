<?php

namespace App\Http\Controllers;

use App\Models\SalesDocument;
use App\Models\SchoolPaymentSubmission;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class FinanceController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $orders = SalesDocument::where('factory_id', $factoryId)->where('document_type', 'customer_order');

        $invoiced = (float) (clone $orders)->sum('total_amount');
        $paid = (float) (clone $orders)->sum('paid_amount');

        $paymentTrend = collect(range(6, 0))->map(function (int $daysAgo) use ($factoryId) {
            $day = today()->subDays($daysAgo);

            return [
                'date' => $day->format('M j'),
                'approved' => (float) SchoolPaymentSubmission::where('factory_id', $factoryId)->where('status', 'approved')->whereDate('reviewed_at', $day)->sum('amount'),
            ];
        })->values();

        return response()->json([
            'payment_trend' => $paymentTrend,
            'summary' => [
                'invoiced_amount' => $invoiced,
                'paid_amount' => $paid,
                'outstanding_amount' => max(0, $invoiced - $paid),
                'pending_receipts' => SchoolPaymentSubmission::where('factory_id', $factoryId)->where('status', 'pending')->count(),
                'orders_count' => (clone $orders)->count(),
            ],
            'orders' => (clone $orders)->with('school:id,name')
                ->latest('document_date')->latest('id')->limit(200)
                ->get(['id', 'document_number', 'customer_name', 'school_id', 'status', 'payment_status', 'currency_code', 'total_amount', 'paid_amount', 'item_count', 'document_date']),
            'pending_receipts' => SchoolPaymentSubmission::where('factory_id', $factoryId)->where('status', 'pending')
                ->with(['school:id,name', 'salesDocument:id,document_number,total_amount,paid_amount,payment_status'])
                ->latest()->get()
                ->map(fn ($submission) => [...$submission->toArray(), 'proof_url' => $submission->proof_path ? Storage::disk('public')->url($submission->proof_path) : null]),
            'recent_decisions' => SchoolPaymentSubmission::where('factory_id', $factoryId)->whereIn('status', ['approved', 'rejected'])
                ->with(['school:id,name', 'salesDocument:id,document_number', 'reviewer:id,name'])
                ->latest('reviewed_at')->limit(30)->get(),
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
                $document = SalesDocument::where('factory_id', $request->user()->current_factory_id)->lockForUpdate()->findOrFail($submission->sales_document_id);
                $paid = (float) $document->paid_amount + (float) $submission->amount;
                $document->update([
                    'paid_amount' => $paid,
                    'payment_status' => $paid >= (float) $document->total_amount ? 'paid' : ($paid > 0 ? 'partially_paid' : 'unpaid'),
                ]);
            }
        });

        return response()->json(['message' => $data['decision'] === 'approved' ? 'Payment approved and applied to the order.' : 'Payment receipt rejected.']);
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
        $orders = (clone $ordersBase)->whereBetween('document_date', [$from->toDateString(), $to->toDateString()]);
        $receipts = (clone $receiptsBase)->whereBetween('reviewed_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);

        $invoiced = (float) (clone $orders)->sum('total_amount');
        $collected = (float) (clone $receipts)->sum('amount');

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
            'factory' => ['name' => $factory->name, 'industry' => str_replace('_', ' ', (string) ($factory->industry_type ?? ''))],
            'summary' => [
                'invoiced_amount' => $invoiced,
                'collected_amount' => $collected,
                'outstanding_amount' => (float) (clone $ordersBase)->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as balance')->value('balance'),
                'orders_count' => (clone $orders)->count(),
                'receipts_count' => (clone $receipts)->count(),
                'overdue_count' => (clone $ordersBase)->whereNotIn('payment_status', ['paid'])->whereNotNull('due_date')->whereDate('due_date', '<', today())->count(),
            ],
        ];

        if ($type === 'invoices') {
            $payload['rows'] = (clone $orders)->with('school:id,name')
                ->orderBy('document_date')->orderBy('id')
                ->get(['id', 'document_number', 'customer_name', 'school_id', 'document_date', 'due_date', 'status', 'payment_status', 'currency_code', 'total_amount', 'paid_amount', 'invoice_path'])
                ->map(fn (SalesDocument $order) => [
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
                ]);
        } elseif ($type === 'receipts') {
            $payload['rows'] = (clone $receipts)->with(['school:id,name', 'salesDocument:id,document_number', 'reviewer:id,name'])
                ->orderBy('reviewed_at')->orderBy('id')
                ->get()
                ->map(fn (SchoolPaymentSubmission $receipt) => [
                    'reviewed_at' => $receipt->reviewed_at?->toDateString(),
                    'customer_name' => $receipt->school?->name,
                    'document_number' => $receipt->salesDocument?->document_number,
                    'payment_method' => $receipt->payment_method,
                    'payment_reference' => $receipt->payment_reference,
                    'amount' => (float) $receipt->amount,
                    'reviewer' => $receipt->reviewer?->name,
                ]);
        } elseif ($type === 'aging') {
            $payload['rows'] = (clone $ordersBase)->whereIn('payment_status', ['unpaid', 'partially_paid'])
                ->with('school:id,name')->orderBy('due_date')->orderBy('id')
                ->get(['id', 'document_number', 'customer_name', 'school_id', 'due_date', 'currency_code', 'total_amount', 'paid_amount', 'payment_status'])
                ->map(fn (SalesDocument $order) => [
                    'document_number' => $order->document_number,
                    'customer_name' => $order->school?->name ?? $order->customer_name,
                    'due_date' => $order->due_date?->toDateString(),
                    'currency_code' => $order->currency_code,
                    'balance' => (float) $order->total_amount - (float) $order->paid_amount,
                    'days_overdue' => $order->due_date && $order->due_date->lt(today()) ? (int) today()->diffInDays($order->due_date) : 0,
                ]);
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
            'custom' => [Carbon::parse($from ?: $today->toDateString())->startOfDay(), Carbon::parse($to ?: $today->toDateString())->startOfDay()],
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
                'invoiced' => (float) (clone $ordersBase)->whereBetween('document_date', [$periodStart->toDateString(), $periodEnd->toDateString()])->sum('total_amount'),
                'collected' => (float) (clone $receiptsBase)->whereBetween('reviewed_at', [$periodStart->copy()->startOfDay(), $periodEnd->copy()->endOfDay()])->sum('amount'),
            ];
            $monthly ? $cursor->addMonthNoOverflow() : $cursor->addDay();
        }

        return $rows;
    }
}
