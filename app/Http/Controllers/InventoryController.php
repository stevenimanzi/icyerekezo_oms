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
            'cut_pieces' => $this->getVirtualCutPieces($warehouseIds),
            'sewn_pieces' => $this->getVirtualSewnPieces($warehouseIds),
            'finished_pieces' => $this->getVirtualFinishedPieces($warehouseIds),
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

    public function postTransaction(Request $request, InventoryLedger $ledger): JsonResponse
    {
        $data = $request->validate(['item_id' => ['required', 'integer'], 'warehouse_id' => ['required', 'integer'], 'location_id' => ['nullable', 'integer'], 'batch_id' => ['nullable', 'integer'], 'type' => ['required', Rule::in(['receipt', 'production_output', 'return_in', 'issue', 'dispatch', 'adjustment_in', 'adjustment_out', 'waste', 'reserve', 'release_reservation', 'quarantine', 'release_quarantine'])], 'quantity' => ['required', 'numeric', 'gt:0'], 'unit_cost' => ['nullable', 'numeric', 'min:0'], 'reason' => ['required', 'string', 'max:1000'], 'occurred_at' => ['nullable', 'date', 'before_or_equal:now']]);
        
        $isWarehouseKeeper = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->where('slug', 'warehouse-keeper')->exists();
            
        $isCuttingOperator = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->where('slug', 'cutting-operator')->exists();
            
        $isSewingOperator = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->where('slug', 'sewing-operator')->exists();

        $isFinishingManager = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->whereIn('slug', ['finishing-manager', 'finishing-operator'])->exists();
            
        $isPackingManager = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->whereIn('slug', ['packing-manager', 'packing-operator', 'packaging-manager', 'packaging-operator'])->exists();
        
        $allowed = $isWarehouseKeeper || 
            ($isCuttingOperator && in_array($data['type'], ['reserve', 'issue', 'waste'])) ||
            ($isSewingOperator && in_array($data['type'], ['receipt', 'issue', 'waste'])) ||
            ($isFinishingManager && in_array($data['type'], ['receipt', 'issue', 'waste', 'production_output'])) ||
            ($isPackingManager && in_array($data['type'], ['receipt', 'issue', 'waste', 'production_output']));
        abort_unless($allowed, 403, 'You do not have permission to post this type of transaction.');

        return response()->json($ledger->post($data), 201);
    }

    public function correctTransaction(Request $request, StockTransaction $transaction, InventoryLedger $ledger): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $isWarehouseKeeper = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->where('slug', 'warehouse-keeper')->exists();

        $isCuttingOperator = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->where('slug', 'cutting-operator')->exists();

        $isSewingOperator = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->where('slug', 'sewing-operator')->exists();

        $isFinishingManager = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->whereIn('slug', ['finishing-manager', 'finishing-operator'])->exists();
            
        $isPackingManager = $request->user()->roles()
            ->wherePivot('factory_id', $request->user()->current_factory_id)
            ->whereIn('slug', ['packing-manager', 'packing-operator', 'packaging-manager', 'packaging-operator'])->exists();

        $allowed = $isWarehouseKeeper || 
            ($isCuttingOperator && in_array($transaction->type, ['reserve', 'issue', 'waste'])) ||
            ($isSewingOperator && in_array($transaction->type, ['receipt', 'issue', 'waste'])) ||
            ($isFinishingManager && in_array($transaction->type, ['receipt', 'issue', 'waste', 'production_output'])) ||
            ($isPackingManager && in_array($transaction->type, ['receipt', 'issue', 'waste', 'production_output']));
            
        if (!$allowed) {
            \Illuminate\Support\Facades\Log::error('InventoryController@correctTransaction blocked.');
        }
        abort_unless($allowed, 403, 'You do not have permission to edit this transaction.');

        abort_unless((int) $transaction->factory_id === (int) $request->user()->current_factory_id, 404);
        
        // Prevent editing old transactions unless warehouse keeper
        if (!$isWarehouseKeeper && $transaction->occurred_at->diffInHours(now()) > 24) {
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

    private function generateStockCode(int $factoryId, string $type): string
    {
        $prefix = match ($type) {
            'raw_material' => 'RAW',
            'semi_finished' => 'WIP',
            'finished_good' => 'FIN',
            'packaging' => 'PKG',
            'spare_part' => 'SPR',
            'waste' => 'WST',
            'by_product' => 'BYP',
            'service' => 'SRV',
            default => 'STK',
        };

        do {
            $code = $prefix.'-'.Str::upper(Str::random(8));
        } while (Item::withoutGlobalScopes()->where('factory_id', $factoryId)->where('sku', $code)->exists());

        return $code;
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

    private function getVirtualCutPieces($warehouseIds): array
    {
        $cutTransactions = \App\Models\StockTransaction::whereIn('stock_transactions.warehouse_id', $warehouseIds)
            ->where('stock_transactions.type', 'issue')
            ->where('stock_transactions.reason', 'LIKE', '[Cut Output]%')
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')
            ->get(['stock_transactions.*', 'items.name as item_name']);

        $sewingReceipts = \App\Models\StockTransaction::whereIn('stock_transactions.warehouse_id', $warehouseIds)
            ->where('stock_transactions.type', 'receipt')
            ->where('stock_transactions.reason', 'LIKE', '[Sewing Receipt] CutID:%')
            ->get();

        $pieces = [];
        foreach ($cutTransactions as $tx) {
            $details = str_replace('[Cut Output] ', '', $tx->reason ?? '');
            if (preg_match('/\|\s*([\d,.]+)x\s+(.+?)(?:\s+\/\s+(.+?))?\s+\(([^)]+)\)\s+produced/i', $details, $matches)) {
                $qty = (float) str_replace(',', '', $matches[1]);
                $style = trim($matches[2]);
                $color = trim($matches[3] ?? '');
                $size = trim($matches[4]);
                $cutId = "{$tx->item_id}-{$style}-{$color}-{$size}";

                if (!isset($pieces[$cutId])) {
                    $pieces[$cutId] = [
                        'id' => $cutId,
                        'item_id' => $tx->item_id,
                        'name' => "{$style}" . ($color ? " / {$color}" : "") . " ({$size}) - {$tx->item_name}",
                        'available_qty' => 0,
                    ];
                }
                $pieces[$cutId]['available_qty'] += $qty;
            }
        }

        foreach ($sewingReceipts as $tx) {
            if (preg_match('/CutID:\s*([^\s|]+)/i', $tx->reason ?? '', $matches)) {
                $cutId = $matches[1];
                if (isset($pieces[$cutId])) {
                    $pieces[$cutId]['available_qty'] -= abs((float) $tx->quantity_delta);
                }
            }
        }

        return array_values(array_filter($pieces, fn($p) => $p['available_qty'] > 0));
    }

    private function getVirtualSewnPieces($warehouseIds): array
    {
        $sewTransactions = StockTransaction::query()
            ->whereIn('stock_transactions.warehouse_id', $warehouseIds)
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')
            ->where('stock_transactions.type', 'issue')
            ->where('stock_transactions.reason', 'LIKE', '[Sewing Output]%')
            ->get(['stock_transactions.*', 'items.name as item_name']);

        $finishingReceipts = StockTransaction::query()
            ->whereIn('warehouse_id', $warehouseIds)
            ->where('type', 'receipt')
            ->where('reason', 'LIKE', '[Finishing Receipt] SewnID:%')
            ->get();

        $pieces = [];
        foreach ($sewTransactions as $tx) {
            if (preg_match('/CutID:\s*([^\s|]+)\s*\|\s*([\d,.]+)\s+items\s+sewn/i', $tx->reason ?? '', $matches)) {
                $cutId = $matches[1];
                $qty = (float) str_replace(',', '', $matches[2]);
                $sewnId = $cutId;

                if (!isset($pieces[$sewnId])) {
                    $parts = explode('-', $sewnId);
                    $style = $parts[1] ?? '';
                    $color = $parts[2] ?? '';
                    $size = $parts[3] ?? '';
                    
                    $pieces[$sewnId] = [
                        'id' => $sewnId,
                        'item_id' => $tx->item_id,
                        'name' => "{$style}" . ($color ? " / {$color}" : "") . " ({$size}) - {$tx->item_name}",
                        'available_qty' => 0,
                    ];
                }
                $pieces[$sewnId]['available_qty'] += $qty;
            }
        }

        foreach ($finishingReceipts as $tx) {
            if (preg_match('/SewnID:\s*([^\s|]+)/i', $tx->reason ?? '', $matches)) {
                $sewnId = $matches[1];
                if (isset($pieces[$sewnId])) {
                    $pieces[$sewnId]['available_qty'] -= abs((float) $tx->quantity_delta);
                }
            }
        }

        return array_values(array_filter($pieces, fn($p) => $p['available_qty'] > 0));
    }

    private function getVirtualFinishedPieces($warehouseIds): array
    {
        $finishTransactions = StockTransaction::query()
            ->whereIn('stock_transactions.warehouse_id', $warehouseIds)
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')
            ->where('stock_transactions.type', 'issue')
            ->where('stock_transactions.reason', 'LIKE', '[Finishing Output]%')
            ->get(['stock_transactions.*', 'items.name as item_name']);

        $packingReceipts = StockTransaction::query()
            ->whereIn('warehouse_id', $warehouseIds)
            ->where('type', 'receipt')
            ->where('reason', 'LIKE', '[Packing Receipt] FinishedID:%')
            ->get();

        $pieces = [];
        foreach ($finishTransactions as $tx) {
            if (preg_match('/SewnID:\s*([^\s|]+)\s*\|\s*([\d,.]+)\s+items\s+finished/i', $tx->reason ?? '', $matches)) {
                $sewnId = $matches[1];
                $qty = (float) str_replace(',', '', $matches[2]);
                $finishedId = $sewnId;

                if (!isset($pieces[$finishedId])) {
                    $parts = explode('-', $finishedId);
                    $style = $parts[1] ?? '';
                    $color = $parts[2] ?? '';
                    $size = $parts[3] ?? '';
                    
                    $pieces[$finishedId] = [
                        'id' => $finishedId,
                        'item_id' => $tx->item_id,
                        'name' => "{$style}" . ($color ? " / {$color}" : "") . " ({$size}) - {$tx->item_name}",
                        'available_qty' => 0,
                    ];
                }
                $pieces[$finishedId]['available_qty'] += $qty;
            }
        }

        foreach ($packingReceipts as $tx) {
            if (preg_match('/FinishedID:\s*([^\s|]+)/i', $tx->reason ?? '', $matches)) {
                $finishedId = $matches[1];
                if (isset($pieces[$finishedId])) {
                    $pieces[$finishedId]['available_qty'] -= abs($tx->quantity_delta);
                }
            }
        }

        return array_values(array_filter($pieces, fn($p) => $p['available_qty'] > 0));
    }
}
