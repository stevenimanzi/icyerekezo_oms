<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Batch;
use App\Models\Item;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Services\InventoryLedger;
use App\Services\StockAnalytics;
use App\Services\StockIssuer;
use App\Support\Tenancy\OperationalScope;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StockMovementController extends Controller
{
    private const ISSUE_REASONS = [
        'used' => 'issue',
        'cutting' => 'issue',
        'sample' => 'issue',
        'damaged' => 'waste',
        'lost' => 'waste',
        'other' => 'issue',
    ];

    public function analytics(Request $request, StockAnalytics $analytics): JsonResponse
    {
        $data = $request->validate(['days' => ['nullable', Rule::in([7, 30, 90])]]);

        $warehouseIds = OperationalScope::for($request->user())->warehouseIds();

        return response()->json($analytics->report($warehouseIds, (int) ($data['days'] ?? 30)) + [
            'warehouses' => Warehouse::whereIn('id', $warehouseIds)->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function index(Request $request, StockAnalytics $analytics): JsonResponse
    {
        $data = $request->validate([
            'direction' => ['required', Rule::in(['in', 'out'])],
            'q' => ['nullable', 'string', 'max:80'],
            'type' => ['nullable', 'string', 'max:30'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'warehouse_id' => ['nullable', 'integer'],
        ]);
        $scope = OperationalScope::for($request->user());
        $warehouseIds = $scope->warehouseIds();
        $types = $data['direction'] === 'in' ? StockAnalytics::IN_TYPES : StockAnalytics::OUT_TYPES;
        $from = Carbon::parse($data['from'] ?? now()->subDays(29))->startOfDay();
        $to = Carbon::parse($data['to'] ?? now())->endOfDay();

        $query = StockTransaction::query()
            ->whereIn('stock_transactions.warehouse_id', $warehouseIds)
            ->whereIn('stock_transactions.type', $types)
            ->whereBetween('stock_transactions.occurred_at', [$from, $to]);

        if (! empty($data['type']) && in_array($data['type'], $types, true)) {
            $query->where('stock_transactions.type', $data['type']);
        }
        if (! empty($data['warehouse_id'])) {
            $query->where('stock_transactions.warehouse_id', $data['warehouse_id']);
        }
        if (! empty($data['q'])) {
            $like = '%' . addcslashes($data['q'], '\\%_') . '%';
            $query->where(fn ($match) => $match
                ->where('stock_transactions.reason', 'like', $like)
                ->orWhereHas('item', fn ($item) => $item->where('name', 'like', $like)->orWhere('sku', 'like', $like)));
        }

        $summary = (clone $query)->get(['quantity_delta', 'unit_cost', 'item_id', 'occurred_at']);
        $suppliers = Supplier::pluck('name', 'id');
        $page = $query
            ->with(['item:id,name,color,sku,type,unit_id', 'item.unit:id,symbol', 'warehouse:id,name', 'batch:id,batch_number,expires_at', 'performer:id,name'])
            ->latest('stock_transactions.occurred_at')
            ->latest('stock_transactions.id')
            ->paginate(20)
            ->through(fn (StockTransaction $row) => [
                'id' => $row->id,
                'supplier' => $row->reference_type === Supplier::class ? ($suppliers[$row->reference_id] ?? null) : null,
                'at' => $row->occurred_at?->toIso8601String(),
                'type' => $row->type,
                'item' => $row->item?->name,
                'sku' => $row->item?->sku,
                'color' => $row->item?->color,
                'item_type' => $row->item?->type,
                'unit' => $row->item?->unit?->symbol,
                'warehouse' => $row->warehouse?->name,
                'quantity' => abs((float) $row->quantity_delta),
                'unit_cost' => (float) $row->unit_cost,
                'value' => round(abs((float) $row->quantity_delta) * (float) $row->unit_cost, 2),
                'batch' => $row->batch?->batch_number,
                'expires_on' => $row->batch?->expires_at?->toDateString(),
                'note' => $row->reason,
                'by' => $row->performer?->name,
            ]);

        $availability = StockBalance::whereIn('warehouse_id', $warehouseIds)
            ->selectRaw('item_id, SUM(quantity_on_hand - quantity_reserved - quantity_quarantined) as available')
            ->groupBy('item_id')
            ->pluck('available', 'item_id');

        return response()->json([
            'direction' => $data['direction'],
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'summary' => [
                'entries' => $summary->count(),
                'items' => $summary->pluck('item_id')->unique()->count(),
                'value' => round($summary->sum(fn ($row) => abs((float) $row->quantity_delta) * (float) $row->unit_cost), 2),
                'today' => $summary->filter(fn ($row) => $row->occurred_at->isToday())->count(),
            ],
            'movements' => $page,
            'items' => Item::with('unit:id,symbol')
                ->where('is_active', true)
                ->where('type', '!=', 'service')
                ->orderBy('name')
                ->get(['id', 'unit_id', 'name', 'color', 'sku', 'type', 'standard_cost', 'batch_tracked', 'expiry_tracked'])
                ->map(fn (Item $item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'color' => $item->color,
                    'type' => $item->type,
                    'unit' => $item->unit?->symbol,
                    'cost' => (float) $item->standard_cost,
                    'batch_tracked' => (bool) $item->batch_tracked,
                    'expiry_tracked' => (bool) $item->expiry_tracked,
                    'available' => (float) ($availability[$item->id] ?? 0),
                ])
                ->values(),
            'warehouses' => Warehouse::whereIn('id', $warehouseIds)->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'suppliers' => $this->supplierList(),
            'reasons' => array_keys(self::ISSUE_REASONS),
        ]);
    }

    public function receive(Request $request, InventoryLedger $ledger): JsonResponse
    {
        $scope = OperationalScope::for($request->user());
        $data = $request->validate([
            'item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('factory_id', $request->user()->current_factory_id)],
            'warehouse_id' => ['required', 'integer', Rule::in($scope->warehouseIds()->all())],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier_id' => ['required', 'integer', Rule::exists('suppliers', 'id')->where('factory_id', $request->user()->current_factory_id)->where('status', 'active')->whereNull('deleted_at')],
            'reference' => ['nullable', 'string', 'max:80'],
            'note' => ['nullable', 'string', 'max:500'],
            'received_on' => ['nullable', 'date', 'before_or_equal:today'],
            'batch_number' => ['nullable', 'string', 'max:60'],
            'expires_on' => ['nullable', 'date'],
        ]);
        $item = Item::where('is_active', true)->where('type', '!=', 'service')->findOrFail($data['item_id']);
        $supplier = Supplier::where('status', 'active')->findOrFail($data['supplier_id']);

        if ($item->batch_tracked && empty($data['batch_number'])) {
            throw ValidationException::withMessages(['batch_number' => 'Write the batch or lot number printed on the delivery.']);
        }
        if ($item->expiry_tracked && empty($data['expires_on'])) {
            throw ValidationException::withMessages(['expires_on' => 'Enter the expiry date of this delivery.']);
        }
        if (! empty($data['expires_on']) && Carbon::parse($data['expires_on'])->isBefore(today())) {
            throw ValidationException::withMessages(['expires_on' => 'This delivery has already expired and cannot be added to stock.']);
        }

        $batch = $item->batch_tracked
            ? Batch::firstOrCreate(
                ['item_id' => $item->id, 'batch_number' => trim($data['batch_number'])],
                ['supplier_id' => $supplier->id, 'expires_at' => $data['expires_on'] ?? null, 'status' => 'released'],
            )
            : null;

        $receivedOn = isset($data['received_on']) ? Carbon::parse($data['received_on']) : now();
        $parts = array_filter(['Received from ' . $supplier->name, $data['reference'] ?? null ? '(ref ' . $data['reference'] . ')' : null, $data['note'] ?? null ? '- ' . $data['note'] : null]);

        $transaction = $ledger->post([
            'item_id' => $item->id,
            'warehouse_id' => $data['warehouse_id'],
            'batch_id' => $batch?->id,
            'type' => 'receipt',
            'quantity' => $data['quantity'],
            'unit_cost' => $data['unit_cost'] ?? null,
            'reason' => implode(' ', $parts),
            'reference_type' => Supplier::class,
            'reference_id' => $supplier->id,
            'occurred_at' => $receivedOn->isToday() ? now() : $receivedOn->setTime(12, 0),
        ]);

        AuditLog::record('stock.received', "Received {$data['quantity']} of {$item->name}", $transaction);

        return response()->json(['message' => "{$item->name}: {$data['quantity']} added to stock.", 'transaction_id' => $transaction->id], 201);
    }

    public function issue(Request $request, StockIssuer $issuer): JsonResponse
    {
        $scope = OperationalScope::for($request->user());
        $data = $request->validate([
            'item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('factory_id', $request->user()->current_factory_id)],
            'warehouse_id' => ['nullable', 'integer', Rule::in($scope->warehouseIds()->all())],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'reason_type' => ['required', Rule::in(array_keys(self::ISSUE_REASONS))],
            'note' => ['nullable', 'string', 'max:500', Rule::requiredIf(fn () => in_array($request->input('reason_type'), ['other', 'damaged', 'lost']))],
        ]);
        $item = Item::where('is_active', true)->where('type', '!=', 'service')->findOrFail($data['item_id']);
        $warehouse = isset($data['warehouse_id']) ? Warehouse::find($data['warehouse_id']) : null;
        $label = ucfirst($data['reason_type']);
        $reason = trim("Stock out - {$label}" . (! empty($data['note']) ? ': ' . $data['note'] : ''));

        $posted = $issuer->issue($item, (float) $data['quantity'], $warehouse, self::ISSUE_REASONS[$data['reason_type']], $reason, $item, 'quantity');

        AuditLog::record('stock.issued', "Stock out {$data['quantity']} of {$item->name} ({$data['reason_type']})", $posted[0]);

        return response()->json(['message' => "{$item->name}: {$data['quantity']} taken out of stock."], 201);
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', Rule::unique('suppliers', 'name')->where('factory_id', $factoryId)->whereNull('deleted_at')],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string', 'max:1000'],
            'tax_number' => ['nullable', 'string', 'max:80'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $data['payment_terms_days'] ??= 0;
        $data['code'] = 'SUP-' . str_pad((string) (Supplier::withTrashed()->where('factory_id', $factoryId)->count() + 1), 5, '0', STR_PAD_LEFT);
        $data['status'] = 'active';

        $supplier = Supplier::create($data);
        AuditLog::record('stock.supplier_added', "Added supplier {$supplier->name}", $supplier);

        return response()->json(['message' => "{$supplier->name} was saved as a supplier.", 'supplier' => $this->supplierRow($supplier)], 201);
    }

    private function supplierList()
    {
        return Supplier::where('status', 'active')->orderBy('name')->get()->map(fn (Supplier $supplier) => $this->supplierRow($supplier))->values();
    }

    private function supplierRow(Supplier $supplier): array
    {
        return [
            'id' => $supplier->id,
            'code' => $supplier->code,
            'name' => $supplier->name,
            'contact_person' => $supplier->contact_person,
            'phone' => $supplier->phone,
            'email' => $supplier->email,
        ];
    }
}
