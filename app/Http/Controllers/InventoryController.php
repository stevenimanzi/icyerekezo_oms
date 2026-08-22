<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Services\InventoryLedger;
use App\Support\OperationalScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function tools(Request $request): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);

        return response()->json([
            'items' => Item::with('unit:id,name,symbol')->where('is_active', true)->orderBy('name')->get(['id', 'unit_id', 'name', 'sku', 'type', 'standard_cost', 'reorder_level']),
            'units' => Unit::where('is_active', true)->orderBy('name')->get(['id', 'name', 'symbol']),
            'warehouses' => Warehouse::whereIn('id', OperationalScope::for($request->user())->warehouseIds())->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'type']),
            'transaction_types' => ['receipt', 'production_output', 'return_in', 'issue', 'dispatch', 'adjustment_in', 'adjustment_out', 'waste', 'reserve', 'release_reservation', 'quarantine', 'release_quarantine'],
        ]);
    }

    public function overview(Request $request): JsonResponse
    {
        $warehouseIds = OperationalScope::for($request->user())->warehouseIds();
        $stock = StockBalance::query()
            ->whereIn('stock_balances.warehouse_id', $warehouseIds)
            ->join('items', 'items.id', '=', 'stock_balances.item_id')
            ->join('warehouses', 'warehouses.id', '=', 'stock_balances.warehouse_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->orderBy('items.name')
            ->get([
                'stock_balances.id', 'items.id as item_id', 'items.name as item_name', 'items.sku', 'items.type as item_type',
                'warehouses.id as warehouse_id', 'warehouses.name as warehouse_name', 'warehouses.code as warehouse_code',
                'units.symbol as unit', 'stock_balances.quantity_on_hand', 'stock_balances.quantity_reserved',
                'stock_balances.quantity_quarantined', 'items.reorder_level', 'items.standard_cost',
            ])->map(function ($row) {
                $row->available_quantity = (float) $row->quantity_on_hand - (float) $row->quantity_reserved - (float) $row->quantity_quarantined;
                $row->stock_value = (float) $row->quantity_on_hand * (float) $row->standard_cost;
                $row->is_low_stock = (float) $row->quantity_on_hand <= (float) $row->reorder_level;
                return $row;
            });

        $transactions = StockTransaction::query()
            ->whereIn('stock_transactions.warehouse_id', $warehouseIds)
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')
            ->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->latest('stock_transactions.occurred_at')
            ->latest('stock_transactions.id')
            ->limit(25)
            ->get([
                'stock_transactions.id', 'stock_transactions.item_id', 'stock_transactions.warehouse_id', 
                'stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.reserved_delta',
                'stock_transactions.balance_after', 'stock_transactions.unit_cost', 'stock_transactions.reason',
                'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku',
                'warehouses.name as warehouse_name', 'units.symbol as unit',
            ]);

        $catalogTotals = StockBalance::whereIn('warehouse_id', $warehouseIds)->selectRaw('item_id, COALESCE(SUM(quantity_on_hand), 0) as quantity_on_hand')
            ->groupBy('item_id')->pluck('quantity_on_hand', 'item_id');
        $catalog = Item::with('unit:id,name,symbol')->orderBy('name')
            ->get(['id', 'unit_id', 'name', 'sku', 'type', 'standard_cost', 'reorder_level', 'is_active'])
            ->map(function (Item $item) use ($catalogTotals) {
                $item->total_quantity = (float) ($catalogTotals[$item->id] ?? 0);
                $item->stock_value = $item->total_quantity * (float) $item->standard_cost;
                return $item;
            });

        return response()->json([
            'items' => Item::count(), 'warehouses' => Warehouse::whereIn('id', $warehouseIds)->where('is_active', true)->count(),
            'low_stock' => StockBalance::whereIn('stock_balances.warehouse_id', $warehouseIds)->join('items', 'items.id', '=', 'stock_balances.item_id')->whereColumn('stock_balances.quantity_on_hand', '<=', 'items.reorder_level')->count(),
            'total_value' => StockBalance::whereIn('stock_balances.warehouse_id', $warehouseIds)->join('items', 'items.id', '=', 'stock_balances.item_id')->selectRaw('COALESCE(SUM(stock_balances.quantity_on_hand * items.standard_cost),0) as value')->value('value'),
            'stock' => $stock,
            'cut_pieces' => $this->batchesAtStage($warehouseIds, 'cut'),
            'sewn_pieces' => $this->batchesAtStage($warehouseIds, 'sewn'),
            'finished_pieces' => $this->batchesAtStage($warehouseIds, 'finished'),
            'catalog' => $catalog,
            'warehouse_list' => Warehouse::whereIn('id', $warehouseIds)->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'type']),
            'recent_transactions' => $transactions,
        ]);
    }

    public function items(Request $request): JsonResponse
    {
        $query = Item::with('unit:id,name,symbol')->latest();
        if ($search = $request->string('search')->trim()->value()) {
            $query->where(fn ($q) => $q->where('name', 'like', "%$search%")->orWhere('sku', 'like', "%$search%"));
        }

        return response()->json($query->paginate(min($request->integer('per_page', 20), 100)));
    }

    public function storeItem(Request $request): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:160', Rule::unique('items')->where('factory_id', $factoryId)], 'category_id' => ['nullable', Rule::exists('item_categories', 'id')->where('factory_id', $factoryId)], 'type' => ['required', Rule::in(['raw_material', 'semi_finished', 'finished_good', 'packaging', 'spare_part', 'waste', 'by_product', 'service'])], 'unit_id' => ['required', Rule::exists('units', 'id')->where('factory_id', $factoryId)], 'standard_cost' => ['nullable', 'numeric', 'min:0'], 'selling_price' => ['nullable', 'numeric', 'min:0'], 'minimum_stock' => ['nullable', 'numeric', 'min:0'], 'reorder_level' => ['nullable', 'numeric', 'min:0'], 'batch_tracked' => ['nullable', 'boolean'], 'expiry_tracked' => ['nullable', 'boolean']]);
        $data['sku'] = $this->generateStockCode($factoryId, $data['type']);

        return response()->json(Item::create($data), 201);
    }

    public function updateItem(Request $request, Item $item): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);
        abort_unless((int) $item->factory_id === (int) $request->user()->current_factory_id, 404);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', Rule::unique('items')->where('factory_id', $request->user()->current_factory_id)->ignore($item->id)],
            'category_id' => ['nullable', Rule::exists('item_categories', 'id')->where('factory_id', $request->user()->current_factory_id)],
            'type' => ['required', Rule::in(['raw_material', 'semi_finished', 'finished_good', 'packaging', 'spare_part', 'waste', 'by_product'])],
            'unit_id' => ['required', Rule::exists('units', 'id')->where('factory_id', $request->user()->current_factory_id)],
            'standard_cost' => ['nullable', 'numeric', 'min:0'], 'selling_price' => ['nullable', 'numeric', 'min:0'], 'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $item->update($data);

        return response()->json(['message' => 'Stock item updated.', 'item' => $item->fresh('unit:id,name,symbol')]);
    }

    public function storeBatch(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $roles = $this->productionRoles($request);
        abort_unless($roles['cuttingOperator'] || $roles['warehouseKeeper'], 403, 'You do not have permission to create a production batch.');

        $data = $request->validate([
            'item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('factory_id', $factoryId)],
            'metadata' => ['nullable', 'array'],
            'metadata.style' => ['nullable', 'string', 'max:80'],
            'metadata.color' => ['nullable', 'string', 'max:80'],
            'metadata.size' => ['nullable', 'string', 'max:40'],
        ]);

        do {
            $batchNumber = 'CUT-'.now()->format('ymd').'-'.Str::upper(Str::random(6));
        } while (\App\Models\Batch::where('item_id', $data['item_id'])->where('batch_number', $batchNumber)->exists());

        $batch = \App\Models\Batch::create([
            'item_id' => $data['item_id'],
            'batch_number' => $batchNumber,
            'production_stage' => 'cut',
            'metadata' => $data['metadata'] ?? null,
        ]);

        return response()->json($batch, 201);
    }

    /**
     * A narrow item-creation endpoint for production staff: only ever creates a
     * finished_good, so it can be safely opened to packing roles without granting
     * them the full storeItem/ensureWarehouseKeeper permission surface.
     */
    public function storeFinishedItem(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $roles = $this->productionRoles($request);
        abort_unless($roles['packingManager'] || $roles['warehouseKeeper'], 403, 'You do not have permission to add a finished product.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', Rule::unique('items')->where('factory_id', $factoryId)],
        ]);

        return response()->json(Item::resolveFinishedGood($factoryId, $data['name']), 201);
    }

    public function postTransaction(Request $request, InventoryLedger $ledger): JsonResponse
    {
        $data = $request->validate(['item_id' => ['required', 'integer'], 'warehouse_id' => ['required', 'integer'], 'location_id' => ['nullable', 'integer'], 'batch_id' => ['nullable', 'integer'], 'production_stage' => ['nullable', Rule::in(['cut', 'sewn', 'finished', 'packed'])], 'type' => ['required', Rule::in(['receipt', 'production_output', 'return_in', 'issue', 'dispatch', 'adjustment_in', 'adjustment_out', 'waste', 'reserve', 'release_reservation', 'quarantine', 'release_quarantine'])], 'quantity' => ['required', 'numeric', 'gt:0'], 'unit_cost' => ['nullable', 'numeric', 'min:0'], 'reason' => ['required', 'string', 'max:1000'], 'occurred_at' => ['nullable', 'date', 'before_or_equal:now']]);

        $roles = $this->productionRoles($request);
        $allowed = $roles['warehouseKeeper'] ||
            ($roles['cuttingOperator'] && in_array($data['type'], ['reserve', 'issue', 'waste', 'production_output'])) ||
            ($roles['sewingOperator'] && in_array($data['type'], ['receipt', 'issue', 'waste', 'production_output'])) ||
            ($roles['finishingManager'] && in_array($data['type'], ['receipt', 'issue', 'waste', 'production_output'])) ||
            ($roles['packingManager'] && in_array($data['type'], ['receipt', 'issue', 'waste', 'production_output'])) ||
            $this->allowedByGenericPermission($request, $data['type']);
        abort_unless($allowed, 403, 'You do not have permission to post this type of transaction.');

        return response()->json($ledger->post($data), 201);
    }

    public function correctTransaction(Request $request, StockTransaction $transaction, InventoryLedger $ledger): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $roles = $this->productionRoles($request);
        $allowed = $roles['warehouseKeeper'] ||
            ($roles['cuttingOperator'] && in_array($transaction->type, ['reserve', 'issue', 'waste'])) ||
            ($roles['sewingOperator'] && in_array($transaction->type, ['receipt', 'issue', 'waste'])) ||
            ($roles['finishingManager'] && in_array($transaction->type, ['receipt', 'issue', 'waste', 'production_output'])) ||
            ($roles['packingManager'] && in_array($transaction->type, ['receipt', 'issue', 'waste', 'production_output'])) ||
            $this->allowedByGenericPermission($request, $transaction->type);
        abort_unless($allowed, 403, 'You do not have permission to edit this transaction.');

        abort_unless((int) $transaction->factory_id === (int) $request->user()->current_factory_id, 404);

        // Prevent editing old transactions unless warehouse keeper
        if (! $roles['warehouseKeeper'] && $transaction->occurred_at->diffInHours(now()) > 24) {
            abort(403, 'You can only edit recent transactions. Please contact the warehouse keeper.');
        }

        $corrected = $ledger->correct($transaction, (float) $data['quantity'], $data['reason'] ?? null);

        return response()->json(['message' => 'Transaction corrected.', 'transaction' => $corrected], 200);
    }

    public function transfer(Request $request, InventoryLedger $ledger): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);
        $data = $request->validate([
            'item_id' => ['required', 'integer', 'exists:items,id'],
            'from_warehouse_id' => ['required', 'integer', 'exists:warehouses,id', 'different:to_warehouse_id'],
            'to_warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $reference = 'TRANSFER-'.Str::upper(Str::random(10));
        $entries = DB::transaction(function () use ($data, $ledger, $reference) {
            $out = $ledger->post(['item_id' => $data['item_id'], 'warehouse_id' => $data['from_warehouse_id'], 'type' => 'issue', 'quantity' => $data['quantity'], 'reason' => $reference.' | '.$data['reason']]);
            $in = $ledger->post(['item_id' => $data['item_id'], 'warehouse_id' => $data['to_warehouse_id'], 'type' => 'receipt', 'quantity' => $data['quantity'], 'reason' => $reference.' | '.$data['reason']]);
            return [$out, $in];
        });

        return response()->json(['message' => 'Stock transferred successfully.', 'reference' => $reference, 'transactions' => $entries], 201);
    }

    public function stockCount(Request $request, InventoryLedger $ledger): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);
        $data = $request->validate([
            'item_id' => ['required', 'integer', 'exists:items,id'],
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'counted_quantity' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $recorded = (float) StockBalance::where('item_id', $data['item_id'])->where('warehouse_id', $data['warehouse_id'])->sum('quantity_on_hand');
        $difference = (float) $data['counted_quantity'] - $recorded;
        if (abs($difference) < 0.000001) {
            return response()->json(['message' => 'Stock count confirmed. No adjustment was needed.', 'recorded_quantity' => $recorded, 'counted_quantity' => (float) $data['counted_quantity']]);
        }
        $transaction = $ledger->post(['item_id' => $data['item_id'], 'warehouse_id' => $data['warehouse_id'], 'type' => $difference > 0 ? 'adjustment_in' : 'adjustment_out', 'quantity' => abs($difference), 'reason' => 'STOCK COUNT | '.$data['reason']]);

        return response()->json(['message' => 'Stock count saved and balance adjusted.', 'transaction' => $transaction], 201);
    }

    public function updateItemStatus(Request $request, Item $item): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);
        abort_unless((int) $item->factory_id === (int) $request->user()->current_factory_id, 404);
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $item->update($data);

        return response()->json(['message' => $item->is_active ? 'Stock item activated.' : 'Stock item deactivated.', 'item' => $item]);
    }

    private function ensureWarehouseKeeper(Request $request): void
    {
        $allowed = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->where('slug', 'warehouse-keeper')->exists();
        abort_unless($allowed, 403, 'Only the assigned Warehouse Keeper can record or change stock.');
    }

    /**
     * Which production-floor role(s) the current user holds, keyed for the
     * per-transaction-type permission checks in postTransaction/correctTransaction.
     */
    private function productionRoles(Request $request): array
    {
        $factoryId = $request->user()->current_factory_id;
        $hasRole = fn (array $slugs) => $request->user()->roles()
            ->wherePivot('factory_id', $factoryId)
            ->whereIn('slug', $slugs)->exists();

        return [
            'warehouseKeeper' => $hasRole(['warehouse-keeper']),
            'cuttingOperator' => $hasRole(['cutting-operator']),
            'sewingOperator' => $hasRole(['sewing-operator']),
            'finishingManager' => $hasRole(['finishing-manager', 'finishing-operator']),
            'packingManager' => $hasRole(['packing-manager', 'packing-operator', 'packaging-manager', 'packaging-operator']),
        ];
    }

    /**
     * Fallback for every role outside the bespoke garment pipeline above (mixing,
     * processing, bottling, maintenance, logistics, and any future industry role):
     * trust the same inventory.receive/issue/adjust permissions the route middleware
     * already enforces, mapped to the transaction types each permission covers.
     */
    private function allowedByGenericPermission(Request $request, string $type): bool
    {
        $user = $request->user();

        return ($user->hasPermission('inventory.receive') && in_array($type, ['receipt', 'return_in', 'adjustment_in'], true))
            || ($user->hasPermission('inventory.issue') && in_array($type, ['issue', 'dispatch', 'waste', 'reserve', 'release_reservation'], true))
            || ($user->hasPermission('inventory.adjust') && in_array($type, ['adjustment_in', 'adjustment_out', 'quarantine', 'release_quarantine'], true));
    }

    private function generateStockCode(int $factoryId, string $type): string
    {
        return Item::generateSku($factoryId, $type);
    }

    public function setup(): JsonResponse
    {
        return response()->json(['units' => Unit::where('is_active', true)->get(), 'warehouses' => Warehouse::where('is_active', true)->get()]);
    }

    public function storeUnit(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:80'], 'symbol' => ['required', 'string', 'max:20', Rule::unique('units')->where('factory_id', $factoryId)], 'dimension' => ['required', Rule::in(['count', 'mass', 'volume', 'length', 'area', 'time', 'other'])], 'precision' => ['nullable', 'integer', 'between:0,6']]);

        return response()->json(Unit::create($data), 201);
    }

    public function storeWarehouse(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'code' => ['required', 'string', 'max:30', Rule::unique('warehouses')->where('factory_id', $factoryId)], 'type' => ['required', Rule::in(['general', 'raw_material', 'finished_goods', 'cold_storage', 'quarantine', 'spare_parts'])], 'branch_id' => ['nullable', 'integer'], 'allows_negative_stock' => ['nullable', 'boolean']]);

        return response()->json(Warehouse::create($data), 201);
    }

    /**
     * Batches currently sitting (with positive stock) at a given production stage,
     * across the given warehouses. Backs the cross-stage "pending pieces to accept"
     * lists and the QC queue with real Batch/StockBalance rows instead of parsing
     * synthetic ids out of free-text transaction reasons.
     */
    public static function batchesAtStage(iterable $warehouseIds, string $stage, ?string $qcStatus = null): array
    {
        return StockBalance::query()
            ->whereIn('stock_balances.warehouse_id', $warehouseIds)
            ->where('stock_balances.quantity_on_hand', '>', 0)
            ->join('batches', 'batches.id', '=', 'stock_balances.batch_id')
            ->join('items', 'items.id', '=', 'stock_balances.item_id')
            ->where('batches.production_stage', $stage)
            ->when($qcStatus, fn ($query) => $query->where('batches.qc_status', $qcStatus))
            ->get(['stock_balances.warehouse_id', 'stock_balances.quantity_on_hand', 'batches.id as batch_id', 'batches.item_id', 'batches.metadata', 'items.name as item_name'])
            ->map(function ($row) {
                $meta = is_string($row->metadata) ? (json_decode($row->metadata, true) ?: []) : ($row->metadata ?? []);
                $label = trim(($meta['style'] ?? '').(! empty($meta['color']) ? ' / '.$meta['color'] : '').(! empty($meta['size']) ? ' ('.$meta['size'].')' : ''));

                return [
                    'id' => $row->batch_id,
                    'item_id' => $row->item_id,
                    'warehouse_id' => $row->warehouse_id,
                    'name' => trim(($label !== '' ? $label.' - ' : '').$row->item_name),
                    'available_qty' => (float) $row->quantity_on_hand,
                ];
            })->values()->all();
    }
}
