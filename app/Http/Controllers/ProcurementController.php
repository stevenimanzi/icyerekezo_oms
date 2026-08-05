<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\ProcurementPayment;
use App\Models\PurchaseDocument;
use App\Models\Supplier;
use App\Models\StockTransaction;
use App\Models\Warehouse;
use App\Services\InventoryLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProcurementController extends Controller
{
    public function overview(): JsonResponse
    {
        $documents = PurchaseDocument::query();
        $orders = (clone $documents)->where('document_type', 'purchase_order');

        return response()->json([
            'summary' => [
                'requests' => (clone $documents)->where('document_type', 'purchase_request')->count(),
                'pending_requests' => (clone $documents)->where('document_type', 'purchase_request')->whereIn('status', ['draft', 'submitted', 'pending_approval'])->count(),
                'purchase_orders' => (clone $orders)->count(),
                'open_orders' => (clone $orders)->whereIn('status', ['approved', 'ordered', 'partially_received'])->count(),
                'ordered_value' => (float) (clone $orders)->whereNotIn('status', ['draft', 'cancelled'])->sum('total_amount'),
                'unpaid_value' => (float) (clone $orders)->whereNotIn('status', ['draft', 'cancelled'])->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) value')->value('value'),
                'suppliers' => Supplier::count(),
                'active_suppliers' => Supplier::where('status', 'active')->count(),
                'receipts' => StockTransaction::whereIn('type', ['receipt', 'return_in', 'adjustment_in'])->count(),
            ],
            'documents' => PurchaseDocument::with(['supplier:id,name,code', 'lines.item:id,name,sku', 'payments'])->latest('document_date')->latest('id')->limit(100)->get(),
            'suppliers' => Supplier::with(['items:id,name,sku'])->orderBy('name')->get(),
            'items' => Item::where('is_active', true)->with('unit:id,name,symbol')->orderBy('name')->get(['id', 'name', 'sku', 'unit_id']),
            'warehouses' => Warehouse::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'stock_receipts' => StockTransaction::whereIn('type', ['receipt', 'return_in', 'adjustment_in'])->latest('occurred_at')->limit(100)->get(),
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $factory = $request->user()->current_factory_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'], 'email' => ['nullable', 'email', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'], 'tax_number' => ['nullable', 'string', 'max:80'],
            'address' => ['nullable', 'string', 'max:1000'], 'payment_terms_days' => ['required', 'integer', 'min:0', 'max:365'],
        ]);
        $data['code'] = $this->number('SUP', Supplier::withTrashed()->where('factory_id', $factory)->count() + 1);
        return response()->json(['message' => 'Supplier saved.', 'supplier' => Supplier::create($data)], 201);
    }

    public function savePrice(Request $request, Supplier $supplier): JsonResponse
    {
        $data = $request->validate([
            'item_id' => ['required', Rule::exists('items', 'id')->where('factory_id', $request->user()->current_factory_id)],
            'unit_price' => ['required', 'numeric', 'min:0'], 'supplier_sku' => ['nullable', 'string', 'max:100'],
            'lead_time_days' => ['required', 'integer', 'min:0', 'max:365'], 'minimum_order_quantity' => ['required', 'numeric', 'min:0'],
        ]);
        $supplier->items()->syncWithoutDetaching([$data['item_id'] => collect($data)->except('item_id')->all()]);
        $supplier->items()->updateExistingPivot($data['item_id'], collect($data)->except('item_id')->all());
        return response()->json(['message' => 'Supplier price saved.']);
    }

    public function storeRequest(Request $request): JsonResponse
    {
        $data = $this->documentData($request, false);
        $document = DB::transaction(function () use ($request, $data) {
            $document = PurchaseDocument::create([
                'document_type' => 'purchase_request', 'document_number' => $this->nextDocumentNumber('PR'),
                'status' => 'submitted', 'purpose' => $data['purpose'], 'currency_code' => 'RWF',
                'document_date' => now()->toDateString(), 'expected_date' => $data['expected_date'],
                'created_by' => $request->user()->id,
            ]);
            $this->saveLines($document, $data['lines']);
            return $document->fresh('lines.item:id,name,sku');
        });
        return response()->json(['message' => 'Purchase request submitted for approval.', 'document' => $document], 201);
    }

    public function approveRequest(Request $request, PurchaseDocument $document): JsonResponse
    {
        $this->assertTypeAndStatus($document, 'purchase_request', ['submitted', 'pending_approval']);
        $document->update(['status' => 'approved', 'approved_by' => $request->user()->id]);
        return response()->json(['message' => 'Purchase request approved.']);
    }

    public function createOrder(Request $request, PurchaseDocument $document): JsonResponse
    {
        $this->assertTypeAndStatus($document, 'purchase_request', ['approved']);
        $supplierId = $request->validate(['supplier_id' => ['required', Rule::exists('suppliers', 'id')->where('factory_id', $request->user()->current_factory_id)]])['supplier_id'];
        $requestDocument = $document->load('lines');
        $order = DB::transaction(function () use ($request, $requestDocument, $supplierId) {
            $supplier = Supplier::with('items')->findOrFail($supplierId);
            $prices = $supplier->items->keyBy('id');
            $order = PurchaseDocument::create([
                'document_type' => 'purchase_order', 'document_number' => $this->nextDocumentNumber('PO'),
                'supplier_id' => $supplierId, 'status' => 'ordered', 'purpose' => $requestDocument->purpose,
                'currency_code' => 'RWF', 'document_date' => now()->toDateString(), 'expected_date' => $requestDocument->expected_date,
                'ordered_at' => now(), 'created_by' => $request->user()->id, 'approved_by' => $requestDocument->approved_by,
            ]);
            $lines = $requestDocument->lines->map(fn ($line) => [
                'item_id' => $line->item_id, 'description' => $line->description, 'quantity' => $line->quantity,
                'unit_price' => (float) ($prices->get($line->item_id)?->pivot?->unit_price ?? 0),
            ])->all();
            $this->saveLines($order, $lines);
            $requestDocument->update(['status' => 'converted']);
            return $order->fresh(['supplier:id,name,code', 'lines.item:id,name,sku']);
        });
        return response()->json(['message' => 'Purchase order created and sent to the supplier.', 'document' => $order], 201);
    }

    public function receive(Request $request, PurchaseDocument $document, InventoryLedger $ledger): JsonResponse
    {
        $this->assertTypeAndStatus($document, 'purchase_order', ['ordered', 'partially_received']);
        $data = $request->validate([
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('factory_id', $request->user()->current_factory_id)],
            'lines' => ['required', 'array', 'min:1'], 'lines.*.line_id' => ['required', 'integer'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0'], 'delivery_reference' => ['required', 'string', 'max:160'],
        ]);
        $document->load('lines');
        DB::transaction(function () use ($document, $data, $ledger) {
            foreach ($data['lines'] as $received) {
                $line = $document->lines->firstWhere('id', (int) $received['line_id']);
                if (! $line) throw ValidationException::withMessages(['lines' => 'Choose items from this purchase order.']);
                $remaining = (float) $line->quantity - (float) $line->received_quantity;
                if ((float) $received['quantity'] > $remaining) throw ValidationException::withMessages(['lines' => $line->item->name.': only '.$remaining.' remains to receive.']);
                $ledger->post(['item_id' => $line->item_id, 'warehouse_id' => $data['warehouse_id'], 'type' => 'receipt', 'quantity' => $received['quantity'], 'unit_cost' => $line->unit_price, 'reason' => 'Purchase order '.$document->document_number.'; delivery '.$data['delivery_reference']]);
                $line->increment('received_quantity', $received['quantity']);
            }
            $document->refresh()->load('lines');
            $complete = $document->lines->every(fn ($line) => (float) $line->received_quantity >= (float) $line->quantity);
            $document->update(['status' => $complete ? 'received' : 'partially_received', 'received_at' => $complete ? now() : null]);
        });
        return response()->json(['message' => 'Goods received and stock updated.']);
    }

    public function recordPayment(Request $request, PurchaseDocument $document): JsonResponse
    {
        $this->assertTypeAndStatus($document, 'purchase_order', ['ordered', 'partially_received', 'received']);
        $remaining = (float) $document->total_amount - (float) $document->paid_amount;
        $data = $request->validate(['amount' => ['required', 'numeric', 'gt:0', 'max:'.$remaining], 'method' => ['required', Rule::in(['bank_transfer', 'cash', 'mobile_money', 'cheque', 'card'])], 'reference' => ['nullable', 'string', 'max:160'], 'paid_on' => ['required', 'date', 'before_or_equal:today']]);
        DB::transaction(function () use ($request, $document, $data) {
            ProcurementPayment::create([...$data, 'purchase_document_id' => $document->id, 'payment_number' => $this->nextPaymentNumber(), 'recorded_by' => $request->user()->id]);
            $paid = (float) $document->paid_amount + (float) $data['amount'];
            $document->update(['paid_amount' => $paid, 'payment_status' => $paid >= (float) $document->total_amount ? 'paid' : 'partially_paid']);
        });
        return response()->json(['message' => 'Payment recorded.']);
    }

    private function documentData(Request $request, bool $supplier): array
    {
        return $request->validate(['purpose' => ['required', 'string', 'max:1000'], 'expected_date' => ['nullable', 'date', 'after_or_equal:today'], 'lines' => ['required', 'array', 'min:1'], 'lines.*.item_id' => ['required', Rule::exists('items', 'id')->where('factory_id', $request->user()->current_factory_id)], 'lines.*.description' => ['nullable', 'string', 'max:500'], 'lines.*.quantity' => ['required', 'numeric', 'gt:0'], 'lines.*.unit_price' => ['nullable', 'numeric', 'min:0']]);
    }

    private function saveLines(PurchaseDocument $document, array $lines): void
    {
        foreach ($lines as $line) {
            $price = (float) ($line['unit_price'] ?? 0);
            $document->lines()->create([...$line, 'line_total' => $price * (float) $line['quantity']]);
        }
        $document->update(['line_count' => count($lines), 'total_amount' => $document->lines()->sum('line_total')]);
    }

    private function assertTypeAndStatus(PurchaseDocument $document, string $type, array $statuses): void
    {
        if ($document->document_type !== $type || ! in_array($document->status, $statuses, true)) abort(422, 'This action is not available for the current record.');
    }

    private function nextDocumentNumber(string $prefix): string { return $this->number($prefix.'-'.now()->format('Y'), PurchaseDocument::where('document_type', $prefix === 'PR' ? 'purchase_request' : 'purchase_order')->count() + 1); }
    private function nextPaymentNumber(): string { return $this->number('PAY-'.now()->format('Y'), ProcurementPayment::count() + 1); }
    private function number(string $prefix, int $sequence): string { return $prefix.'-'.str_pad((string) $sequence, 5, '0', STR_PAD_LEFT); }
}
