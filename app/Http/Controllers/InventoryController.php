<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Unit;
use App\Models\Warehouse;
use App\Services\InventoryLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'warehouses' => Warehouse::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'type']),
            'transaction_types' => ['receipt', 'issue', 'return_in', 'adjustment_in', 'adjustment_out', 'waste'],
        ]);
    }

    public function overview(): JsonResponse
    {
        $stock = StockBalance::query()
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
            ->join('items', 'items.id', '=', 'stock_transactions.item_id')
            ->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
            ->leftJoin('units', 'units.id', '=', 'items.unit_id')
            ->latest('stock_transactions.occurred_at')
            ->latest('stock_transactions.id')
            ->limit(25)
            ->get([
                'stock_transactions.id', 'stock_transactions.type', 'stock_transactions.quantity_delta',
                'stock_transactions.balance_after', 'stock_transactions.unit_cost', 'stock_transactions.reason',
                'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku',
                'warehouses.name as warehouse_name', 'units.symbol as unit',
            ]);

        return response()->json([
            'items' => Item::count(), 'warehouses' => Warehouse::where('is_active', true)->count(),
            'low_stock' => StockBalance::join('items', 'items.id', '=', 'stock_balances.item_id')->whereColumn('stock_balances.quantity_on_hand', '<=', 'items.reorder_level')->count(),
            'total_value' => StockBalance::join('items', 'items.id', '=', 'stock_balances.item_id')->selectRaw('COALESCE(SUM(stock_balances.quantity_on_hand * items.standard_cost),0) as value')->value('value'),
            'stock' => $stock,
            'warehouse_list' => Warehouse::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'type']),
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
        $data = $request->validate(['name' => ['required', 'string', 'max:160'], 'type' => ['required', Rule::in(['raw_material', 'semi_finished', 'finished_good', 'packaging', 'spare_part', 'waste', 'by_product', 'service'])], 'unit_id' => ['required', 'integer', 'exists:units,id'], 'standard_cost' => ['nullable', 'numeric', 'min:0'], 'selling_price' => ['nullable', 'numeric', 'min:0'], 'minimum_stock' => ['nullable', 'numeric', 'min:0'], 'reorder_level' => ['nullable', 'numeric', 'min:0'], 'batch_tracked' => ['nullable', 'boolean'], 'expiry_tracked' => ['nullable', 'boolean']]);
        $data['sku'] = $this->generateStockCode($factoryId, $data['type']);

        return response()->json(Item::create($data), 201);
    }

    public function updateItem(Request $request, Item $item): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);
        abort_unless((int) $item->factory_id === (int) $request->user()->current_factory_id, 404);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'type' => ['required', Rule::in(['raw_material', 'semi_finished', 'finished_good', 'packaging', 'spare_part', 'waste', 'by_product'])],
            'unit_id' => ['required', 'integer', 'exists:units,id'],
            'standard_cost' => ['nullable', 'numeric', 'min:0'], 'reorder_level' => ['nullable', 'numeric', 'min:0'],
        ]);
        $item->update($data);

        return response()->json(['message' => 'Stock item updated.', 'item' => $item->fresh('unit:id,name,symbol')]);
    }

    public function postTransaction(Request $request, InventoryLedger $ledger): JsonResponse
    {
        $this->ensureWarehouseKeeper($request);
        $data = $request->validate(['item_id' => ['required', 'integer'], 'warehouse_id' => ['required', 'integer'], 'location_id' => ['nullable', 'integer'], 'batch_id' => ['nullable', 'integer'], 'type' => ['required', Rule::in(['receipt', 'issue', 'return_in', 'adjustment_in', 'adjustment_out', 'waste'])], 'quantity' => ['required', 'numeric', 'gt:0'], 'unit_cost' => ['nullable', 'numeric', 'min:0'], 'reason' => ['required', 'string', 'max:1000'], 'occurred_at' => ['nullable', 'date', 'before_or_equal:now']]);

        return response()->json($ledger->post($data), 201);
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
}
