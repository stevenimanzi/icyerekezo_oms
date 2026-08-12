<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\SalesDocument;
use App\Models\SalesDocumentLine;
use App\Models\School;
use App\Services\RwandaLocationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
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
        $invoices = (clone $documents)->where('document_type', 'invoice');
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
                'invoices' => (clone $invoices)->count(),
                'returns' => (clone $documents)->where('document_type', 'return')->count(),
                'invoiced_amount' => (float) (clone $invoices)->sum('total_amount'),
                'paid_amount' => (float) (clone $invoices)->sum('paid_amount'),
                'outstanding_amount' => (float) (clone $invoices)->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as balance')->value('balance'),
                'past_due_invoices' => (clone $invoices)->whereNotIn('status', ['paid', 'cancelled'])->whereDate('due_date', '<', today())->count(),
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
            'capabilities' => ['review' => $request->user()->hasPermission('sales.fulfill'), 'create' => $request->user()->hasPermission('sales.create') || $request->user()->hasPermission('sales.fulfill')],
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
            $order->lines()->createMany($lines);
            return $order;
        });
        AuditLog::record('sales.school_order_received', "Received school garment order {$order->document_number} from {$order->customer_name}", $order);

        return response()->json(['message' => 'School garment order received.', 'document' => $order->load('lines')], 201);
    }

    public function updateSchoolOrderLine(Request $request, SalesDocumentLine $line): JsonResponse
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
        $line->update($data);
        $document = $line->document()->with('lines')->firstOrFail();
        $delivered = $document->lines->sum('quantity_delivered');
        $ordered = $document->lines->sum('quantity_ordered');
        if ($delivered >= $ordered) $document->update(['status' => 'delivered']);
        elseif ($delivered > 0) $document->update(['status' => 'partial']);
        elseif ($document->status !== 'pending') $document->update(['status' => 'accepted']);
        AuditLog::record('sales.school_order_line_updated', "Updated fulfilment for {$document->document_number}", $line);

        return response()->json(['message' => 'Garment quantities updated.', 'line' => $line->fresh(), 'document_status' => $document->fresh()->status]);
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
