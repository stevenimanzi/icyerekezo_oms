<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\SalesDocument;
use App\Models\SalesPayment;
use App\Models\Warehouse;
use App\Services\ManualSaleService;
use App\Support\Reports\SalesReport;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ManualSalesController extends Controller
{
    private const SELLABLE_TYPES = ['finished_good', 'by_product', 'service'];

    private const PER_PAGE = 15;

    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'payment' => ['nullable', Rule::in(['unpaid', 'partially_paid', 'paid', 'cancelled'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $sales = SalesDocument::query()
            ->where('source', 'manual')
            ->with(['lines.item:id,name,sku', 'payments', 'creator:id,name'])
            ->when($filters['search'] ?? null, function ($query, string $term) {
                $like = '%' . addcslashes($term, '\\%_') . '%';
                $query->where(fn ($match) => $match->where('document_number', 'like', $like)->orWhere('customer_name', 'like', $like)->orWhere('customer_phone', 'like', $like));
            })
            ->when($filters['payment'] ?? null, fn ($query, string $status) => $status === 'cancelled'
                ? $query->where('status', 'cancelled')
                : $query->where('status', '!=', 'cancelled')->where('payment_status', $status))
            ->when($filters['from'] ?? null, fn ($query, string $date) => $query->where('document_date', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, string $date) => $query->where('document_date', '<', Carbon::parse($date)->addDay()->toDateString()))
            ->latest('document_date')
            ->latest('id')
            ->paginate(self::PER_PAGE);

        $counted = SalesDocument::query()->where('source', 'manual')->where('status', '!=', 'cancelled');

        return response()->json([
            'sales' => $sales,
            'today' => [
                'sales' => (clone $counted)->whereDate('document_date', today())->count(),
                'revenue' => (float) (clone $counted)->whereDate('document_date', today())->sum('total_amount'),
            ],
            'outstanding' => (float) (clone $counted)->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as balance')->value('balance'),
            'capabilities' => ['record' => $this->mayRecord($request)],
            'form' => $this->mayRecord($request) ? $this->formOptions() : null,
            'currency' => $user->currentFactory?->currency_code ?: 'RWF',
        ]);
    }

    public function store(Request $request, ManualSaleService $service): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;

        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'sale_date' => ['required', 'date', 'before_or_equal:today'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('factory_id', $factoryId)->where('is_active', true)],
            'lines.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'max:999999999'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => [Rule::requiredIf(fn () => (float) $request->input('paid_amount') > 0), 'nullable', Rule::in(SalesPayment::METHODS)],
            'payment_reference' => ['nullable', 'string', 'max:100'],
            'due_date' => ['nullable', 'date', 'after_or_equal:sale_date'],
            'deduct_stock' => ['nullable', 'boolean'],
            'warehouse_id' => ['nullable', 'integer', Rule::exists('warehouses', 'id')->where('factory_id', $factoryId)],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $sale = $service->record($data, $request->user());

        return response()->json(['message' => "Sale {$sale->document_number} recorded.", 'sale' => $sale], 201);
    }

    public function pay(Request $request, SalesDocument $document, ManualSaleService $service): JsonResponse
    {
        $this->ensureManual($document);
        abort_if($document->status === 'cancelled', 422, 'This sale was cancelled.');

        $balance = round((float) $document->total_amount - (float) $document->paid_amount, 2);
        abort_if($balance <= 0, 422, 'This sale is already fully paid.');

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:' . $balance],
            'method' => ['required', Rule::in(SalesPayment::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
        ]);

        $service->addPayment($document, (float) $data['amount'], $data['method'], $data['reference'] ?? null, $data['paid_on'] ?? today()->toDateString(), $request->user());

        return response()->json(['message' => 'Payment recorded.', 'sale' => $document->fresh(['lines.item', 'payments', 'creator'])]);
    }

    public function cancel(Request $request, SalesDocument $document, ManualSaleService $service): JsonResponse
    {
        $this->ensureManual($document);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $sale = $service->cancel($document, $data['reason'], $request->user());

        return response()->json(['message' => 'Sale cancelled and stock returned.', 'sale' => $sale]);
    }

    public function receipt(Request $request, SalesDocument $document): Response
    {
        $this->ensureManual($document);
        $document->load(['lines.item.unit', 'payments', 'creator']);
        $factory = $request->user()->currentFactory;
        $fileName = 'receipt-' . preg_replace('/[^A-Za-z0-9_-]+/', '-', $document->document_number) . '.pdf';

        return Pdf::loadView('pdf.sale-receipt', compact('document', 'factory'))->setPaper('a5')->stream($fileName);
    }

    public function report(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $to = isset($data['to']) ? Carbon::parse($data['to']) : today();
        $from = isset($data['from']) ? Carbon::parse($data['from']) : $to->copy()->subDays(29);

        abort_if($from->diffInDays($to) > 800, 422, 'Please choose a shorter period.');

        $report = (new SalesReport((int) $request->user()->current_factory_id, $from, $to))->build();

        return response()->json($report + ['currency' => $request->user()->currentFactory?->currency_code ?: 'RWF']);
    }

    private function mayRecord(Request $request): bool
    {
        return $request->user()->hasPermission('sales.create') || $request->user()->hasPermission('sales.fulfill');
    }

    private function ensureManual(SalesDocument $document): void
    {
        abort_unless($document->source === 'manual' && $document->document_type === 'customer_order', 404);
    }

    private function formOptions(): array
    {
        $available = DB::table('stock_balances')
            ->leftJoin('batches', 'batches.id', '=', 'stock_balances.batch_id')
            ->where(function ($query) {
                $query->whereNull('stock_balances.batch_id')
                    ->orWhere('batches.qc_status', 'passed')
                    ->orWhereNull('batches.qc_status');
            })
            ->selectRaw('stock_balances.item_id, SUM(stock_balances.quantity_on_hand - stock_balances.quantity_reserved - stock_balances.quantity_quarantined) as available')
            ->groupBy('stock_balances.item_id');

        $lastPrice = DB::table('sales_document_lines as l')
            ->join(DB::raw('(SELECT MAX(id) as id FROM sales_document_lines WHERE unit_price > 0 GROUP BY item_id) as latest'), 'latest.id', '=', 'l.id')
            ->select('l.item_id', 'l.unit_price');

        $items = Item::query()
            ->whereIn('items.type', self::SELLABLE_TYPES)
            ->where('items.is_active', true)
            ->leftJoinSub($available, 'stock', 'stock.item_id', '=', 'items.id')
            ->leftJoinSub($lastPrice, 'price', 'price.item_id', '=', 'items.id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->orderBy('items.name')
            ->get([
                'items.id', 'items.name', 'items.sku', 'items.type',
                DB::raw('COALESCE(stock.available, 0) as on_hand'),
                DB::raw('COALESCE(price.unit_price, 0) as last_price'),
                'units.symbol as unit',
            ]);

        $warehouseStock = DB::table('stock_balances')
            ->leftJoin('batches', 'batches.id', '=', 'stock_balances.batch_id')
            ->where(function ($query) {
                $query->whereNull('stock_balances.batch_id')
                    ->orWhere('batches.qc_status', 'passed')
                    ->orWhereNull('batches.qc_status');
            })
            ->selectRaw('stock_balances.item_id, stock_balances.warehouse_id, SUM(stock_balances.quantity_on_hand - stock_balances.quantity_reserved - stock_balances.quantity_quarantined) as available')
            ->groupBy('stock_balances.item_id', 'stock_balances.warehouse_id')
            ->get();

        $customers = SalesDocument::query()
            ->where('source', 'manual')
            ->selectRaw('customer_name as name, MAX(customer_phone) as phone, MAX(id) as last_id')
            ->groupBy('customer_name')
            ->orderByDesc('last_id')
            ->limit(100)
            ->get(['name', 'phone']);

        return [
            'items' => $items,
            'warehouse_stock' => $warehouseStock,
            'customers' => $customers,
            'warehouses' => Warehouse::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'payment_methods' => SalesPayment::METHODS,
        ];
    }
}
