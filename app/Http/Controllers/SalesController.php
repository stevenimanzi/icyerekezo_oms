<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\SalesDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalesController extends Controller
{
    public function overview(): JsonResponse
    {
        $documents = SalesDocument::query();
        $orders = (clone $documents)->where('document_type', 'customer_order');
        $invoices = (clone $documents)->where('document_type', 'invoice');

        return response()->json([
            'summary' => [
                'customer_orders' => (clone $orders)->count(),
                'active_orders' => (clone $orders)->whereIn('status', ['confirmed', 'processing', 'ready'])->count(),
                'completed_orders' => (clone $orders)->where('status', 'completed')->count(),
                'quotations' => (clone $documents)->where('document_type', 'quotation')->count(),
                'invoices' => (clone $invoices)->count(),
                'returns' => (clone $documents)->where('document_type', 'return')->count(),
                'invoiced_amount' => (float) (clone $invoices)->sum('total_amount'),
                'paid_amount' => (float) (clone $invoices)->sum('paid_amount'),
                'outstanding_amount' => (float) (clone $invoices)->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as balance')->value('balance'),
                'past_due_invoices' => (clone $invoices)->whereNotIn('status', ['paid', 'cancelled'])->whereDate('due_date', '<', today())->count(),
            ],
            'documents' => SalesDocument::query()->latest('document_date')->latest('id')->paginate(50),
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function decide(Request $request, SalesDocument $document): JsonResponse
    {
        abort_unless($document->document_type === 'customer_order', 422, 'Only customer orders can be reviewed.');
        abort_unless(in_array($document->status, ['draft', 'pending', 'submitted'], true), 409, 'This order has already been reviewed.');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['accept', 'reject'])],
            'reason' => ['nullable', 'string', 'max:1000', Rule::requiredIf($request->input('decision') === 'reject')],
        ]);
        $status = $data['decision'] === 'accept' ? 'confirmed' : 'rejected';
        $document->update(['status' => $status]);
        AuditLog::record('sales.order_'.$status, ucfirst($status)." customer order {$document->document_number}".(!empty($data['reason'])?': '.$data['reason']:''), $document, ['status' => $document->getOriginal('status')], ['status' => $status]);

        return response()->json(['message' => "Order {$status}.", 'document' => $document->fresh()]);
    }
}
