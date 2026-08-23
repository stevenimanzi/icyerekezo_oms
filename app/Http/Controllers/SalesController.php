<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\SalesDocument;
use App\Models\SalesDocumentLine;
use App\Models\School;
use App\Models\Warehouse;
use App\Services\InventoryLedger;
use App\Services\RwandaLocationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SalesController extends Controller
{
    public function orderPdf(Request $request, SalesDocument $document): Response
    {
        $this->ensureNoguchi($request);
        abort_unless($document->document_type === 'customer_order', 404);

        $document->load(['school', 'lines']);
        $factory = $request->user()->currentFactory;
        $fileName = 'school-order-'.preg_replace('/[^A-Za-z0-9_-]+/', '-', $document->document_number).'.pdf';

        return Pdf::loadView('pdf.school-order', compact('document', 'factory'))
            ->setPaper('a4', 'landscape')
            ->stream($fileName);
    }

    public function overview(Request $request): JsonResponse
    {
        $specialized = $request->user()->currentFactory->hasNoguchiSchoolOrders();
        $northernLocations = $specialized ? app(RwandaLocationService::class)->northernDistrictsAndSectors() : [];
        $documents = SalesDocument::query();
        $orders = (clone $documents)->where('document_type', 'customer_order');
        $list = SalesDocument::query()->with($specialized ? ['lines', 'school'] : []);
        if ($specialized) {
            $list->where('document_type', 'customer_order')
                ->when($request->string('search')->trim()->value(), fn ($query, $value) => $query->where(fn ($match) => $match->where('document_number', 'like', "%{$value}%")->orWhereHas('school', fn ($school) => $school->where('name', 'like', "%{$value}%"))))
                ->when($request->string('district')->trim()->value(), fn ($query, $value) => $query->whereHas('school', fn ($school) => $school->where('district', $value)))
                ->when($request->string('sector')->trim()->value(), fn ($query, $value) => $query->whereHas('school', fn ($school) => $school->where('sector', $value)))
                ->when($request->string('status')->trim()->value(), fn ($query, $value) => $query->where('status', $value))
                ->when($request->string('academic_year')->trim()->value(), fn ($query, $value) => $query->where('academic_year', $value));
        }

        $paginatedDocuments = $list->latest('document_date')->latest('id')->paginate($specialized ? 5 : 50);
        if ($specialized) {
            $paginatedDocuments->getCollection()->each(function (SalesDocument $document) {
                $document->setAttribute('document_number', preg_replace('/^LEGACY-NOGUCHI-/i', '', $document->document_number));
            });
        }

        return response()->json([
            'summary' => [
                'customer_orders' => (clone $orders)->count(),
                'active_orders' => (clone $orders)->whereIn('status', ['accepted', 'partial'])->count(),
                'completed_orders' => (clone $orders)->where('status', 'delivered')->count(),
                'quotations' => (clone $documents)->where('document_type', 'quotation')->count(),
                'invoices' => (clone $orders)->whereNotNull('invoice_path')->count(),
                'returns' => (clone $documents)->where('document_type', 'return')->count(),
                'invoiced_amount' => (float) (clone $orders)->sum('total_amount'),
                'paid_amount' => (float) (clone $orders)->sum('paid_amount'),
                'outstanding_amount' => (float) (clone $orders)->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as balance')->value('balance'),
                'past_due_invoices' => (clone $orders)->whereNotNull('invoice_path')->whereNotIn('status', ['delivered', 'rejected'])->whereDate('due_date', '<', today())->count(),
            ],
            'documents' => $paginatedDocuments,
            'specialization' => $specialized ? [
                'type' => 'noguchi_school_garments',
                'garment_categories' => ['Uniform', 'Sweater', 'Sport Uniform', 'TVET', 'Tourism', 'Polo', 'T-shirt', 'Rain Coat', 'Overall', 'Jumper'],
                'ordered_items' => (int) SalesDocumentLine::sum('quantity_ordered'),
                'packed_items' => (int) SalesDocumentLine::sum('quantity_packed'),
                'delivered_items' => (int) SalesDocumentLine::sum('quantity_delivered'),
                'rejected_items' => (int) SalesDocumentLine::sum('quantity_rejected'),
                'by_category' => SalesDocumentLine::selectRaw('garment_category, SUM(quantity_ordered) ordered, SUM(quantity_packed) packed, SUM(quantity_delivered) delivered, SUM(quantity_rejected) rejected')->groupBy('garment_category')->orderByDesc('ordered')->get(),
                'filters' => [
                    'districts' => array_keys($northernLocations),
                    'sectors_by_district' => $northernLocations,
                    'academic_years' => ['2025-2026', '2026-2027', '2027-2028', '2028-2029', '2029-2030', '2030-2031'],
                    'statuses' => ['pending', 'accepted', 'partial', 'delivered', 'rejected'],
                ],
            ] : null,
            'capabilities' => [
                'review' => $request->user()->hasPermission('sales.fulfill'),
                'create' => $request->user()->hasPermission('sales.create') || $request->user()->hasPermission('sales.fulfill'),
                'invoice' => $request->user()->hasPermission('sales.fulfill'),
            ],
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function storeSchoolOrder(Request $request): JsonResponse
    {
        $this->ensureNoguchi($request);
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'document_number' => ['nullable', 'string', 'max:60', Rule::unique('sales_documents')->where('factory_id', $factoryId)->where('document_type', 'customer_order')],
            'customer_name' => ['required', 'string', 'max:255'], 'customer_email' => ['nullable', 'email', 'max:255'],
            'school_district' => ['nullable', 'string', 'max:80'], 'school_sector' => ['nullable', 'string', 'max:80'], 'academic_year' => ['required', 'string', 'max:20'],
            'document_date' => ['required', 'date'], 'due_date' => ['nullable', 'date', 'after_or_equal:document_date'],
            'total_amount' => ['nullable', 'numeric', 'min:0'], 'currency_code' => ['nullable', 'string', 'size:3'],
            'lines' => ['required', 'array', 'min:1'], 'lines.*.class_level' => ['required', 'string', 'max:30'],
            'lines.*.garment_category' => ['required', Rule::in(['Uniform', 'Sweater', 'Sport Uniform', 'TVET', 'Tourism', 'Polo', 'T-shirt', 'Rain Coat', 'Overall', 'Jumper'])],
            'lines.*.gender' => ['nullable', Rule::in(['Boy', 'Girl', 'Unisex'])], 'lines.*.size' => ['nullable', 'string', 'max:20'],
            'lines.*.color' => ['nullable', 'string', 'max:255'], 'lines.*.quantity_ordered' => ['required', 'integer', 'min:1'],
        ]);
        $order = DB::transaction(function () use ($data, $request) {
            $lines = $data['lines']; unset($data['lines']);
            $schoolData = ['name' => $data['customer_name'], 'email' => $data['customer_email'] ?? null, 'district' => $data['school_district'] ?? null, 'sector' => $data['school_sector'] ?? null];
            unset($data['school_district'], $data['school_sector']);
            $school = School::firstOrCreate(['name' => $schoolData['name'], 'district' => $schoolData['district'], 'sector' => $schoolData['sector']], $schoolData);
            $data['document_number'] ??= 'SO-'.now()->format('Ymd').'-'.str_pad((string) (SalesDocument::where('document_type', 'customer_order')->count() + 1), 4, '0', STR_PAD_LEFT);
            $order = SalesDocument::create($data + ['school_id' => $school->id, 'document_type' => 'customer_order', 'status' => 'pending', 'item_count' => collect($lines)->sum('quantity_ordered'), 'created_by' => $request->user()->id]);
            $factoryId = (int) $request->user()->current_factory_id;
            $order->lines()->createMany(array_map(
                fn ($line) => $line + ['item_id' => Item::resolveFinishedGood($factoryId, $line['garment_category'])->id],
                $lines
            ));
            return $order;
        });
        AuditLog::record('sales.school_order_received', "Received school garment order {$order->document_number} from {$order->customer_name}", $order);

        return response()->json(['message' => 'School garment order received.', 'document' => $order->load('lines')], 201);
    }

    public function updateSchoolOrderLine(Request $request, SalesDocumentLine $line, InventoryLedger $ledger): JsonResponse
    {
        $this->ensureNoguchi($request);
        $data = $request->validate([
            'quantity_packed' => ['nullable', 'integer', 'min:0', 'max:'.$line->quantity_ordered],
            'quantity_delivered' => ['required', 'integer', 'min:0', 'max:'.$line->quantity_ordered],
            'quantity_rejected' => ['nullable', 'integer', 'min:0', 'max:'.$line->quantity_ordered],
            'rejection_reason' => ['nullable', 'string', 'max:255'],
        ]);
        $data['quantity_packed'] = max((int) ($data['quantity_packed'] ?? $line->quantity_packed), (int) $data['quantity_delivered']);
        $data['quantity_rejected'] ??= $line->quantity_rejected;
        $previouslyDelivered = (int) $line->quantity_delivered;
        $line->update($data);
        $document = $line->document()->with('lines')->firstOrFail();

        $newlyDelivered = (int) $data['quantity_delivered'] - $previouslyDelivered;
        if ($newlyDelivered > 0 && $line->item_id) {
            $this->releaseDeliveredStock($ledger, (int) $request->user()->current_factory_id, $line, $document, $newlyDelivered);
        }

        $delivered = $document->lines->sum('quantity_delivered');
        $ordered = $document->lines->sum('quantity_ordered');
        if ($delivered >= $ordered) $document->update(['status' => 'delivered']);
        elseif ($delivered > 0) $document->update(['status' => 'partial']);
        elseif ($document->status !== 'pending') $document->update(['status' => 'accepted']);
        AuditLog::record('sales.school_order_line_updated', "Updated fulfilment for {$document->document_number}", $line);

        return response()->json(['message' => 'Garment quantities updated.', 'line' => $line->fresh(), 'document_status' => $document->fresh()->status]);
    }

    /**
     * Decrements real warehouse stock for the garment just marked delivered, taken from
     * whichever single warehouse holds enough of it. Never blocks delivery bookkeeping —
     * if no warehouse alone has enough (e.g. production never fed this item), it's skipped.
     */
    private function releaseDeliveredStock(InventoryLedger $ledger, int $factoryId, SalesDocumentLine $line, SalesDocument $document, int $quantity): void
    {
        $warehouse = Warehouse::withoutGlobalScopes()
            ->where('warehouses.factory_id', $factoryId)->where('warehouses.is_active', true)
            ->join('stock_balances', 'stock_balances.warehouse_id', '=', 'warehouses.id')
            ->where('stock_balances.item_id', $line->item_id)
            ->selectRaw('warehouses.id, (stock_balances.quantity_on_hand - stock_balances.quantity_reserved - stock_balances.quantity_quarantined) as available')
            ->orderByDesc('available')
            ->first();
        if (! $warehouse || (float) $warehouse->available < $quantity) {
            return;
        }
        try {
            $ledger->post([
                'item_id' => $line->item_id, 'warehouse_id' => $warehouse->id, 'type' => 'dispatch',
                'quantity' => $quantity, 'reason' => "School order {$document->document_number} delivered — {$line->garment_category}",
            ]);
        } catch (\Throwable) {
            // Delivery bookkeeping must never fail because a stock movement couldn't be posted.
        }
    }

    public function uploadInvoice(Request $request, SalesDocument $document): JsonResponse
    {
        abort_unless($document->document_type === 'customer_order', 422, 'Invoices can only be attached to customer orders.');
        $data = $request->validate([
            'invoice' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:15360'],
        ]);
        if ($document->invoice_path) {
            Storage::disk('public')->delete($document->invoice_path);
        }
        $path = $data['invoice']->store('invoices/'.$document->factory_id, 'public');
        $document->update([
            'invoice_path' => $path,
            'invoice_original_name' => $data['invoice']->getClientOriginalName(),
            'invoice_uploaded_at' => now(),
            'invoice_uploaded_by' => $request->user()->id,
        ]);
        AuditLog::record('sales.invoice_uploaded', "Uploaded invoice for order {$document->document_number}", $document);

        return response()->json(['message' => 'Invoice uploaded.', 'document' => $document->fresh()]);
    }

    public function decide(Request $request, SalesDocument $document): JsonResponse
    {
        abort_unless($document->document_type === 'customer_order', 422, 'Only customer orders can be reviewed.');
        abort_unless(in_array($document->status, ['draft', 'pending', 'submitted'], true), 409, 'This order has already been reviewed.');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['accept', 'reject'])],
            'reason' => ['nullable', 'string', 'max:1000', Rule::requiredIf($request->input('decision') === 'reject')],
        ]);
        $status = $data['decision'] === 'accept' ? 'accepted' : 'rejected';
        $document->update(['status' => $status]);
        AuditLog::record('sales.order_'.$status, ucfirst($status)." customer order {$document->document_number}".(!empty($data['reason'])?': '.$data['reason']:''), $document, ['status' => $document->getOriginal('status')], ['status' => $status]);

        return response()->json(['message' => "Order {$status}.", 'document' => $document->fresh()]);
    }

    public function destroy(Request $request, SalesDocument $document): JsonResponse
    {
        abort_unless($document->document_type === 'customer_order', 422, 'Only customer orders can be deleted here.');
        abort_if($document->shipments()->whereNotIn('status', ['cancelled'])->exists(), 409, 'Cancel active shipments before deleting this order.');

        $number = $document->document_number;
        $customer = $document->customer_name;
        AuditLog::record('sales.order_deleted', "Deleted customer order {$number} for {$customer}", $document);
        $document->delete();

        return response()->json(['message' => "Order {$number} deleted."]);
    }

    private function ensureNoguchi(Request $request): void
    {
        abort_unless($request->user()->currentFactory->hasNoguchiSchoolOrders(), 404, 'This specialized school-order workflow is not enabled for this factory.');
    }
}
