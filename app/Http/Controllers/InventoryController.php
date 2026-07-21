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
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function overview(): JsonResponse
    {
        return response()->json([
            'items' => Item::count(), 'warehouses' => Warehouse::where('is_active', true)->count(),
            'low_stock' => StockBalance::join('items', 'items.id', '=', 'stock_balances.item_id')->whereColumn('stock_balances.quantity_on_hand', '<=', 'items.reorder_level')->count(),
            'total_value' => StockBalance::join('items', 'items.id', '=', 'stock_balances.item_id')->selectRaw('COALESCE(SUM(stock_balances.quantity_on_hand * items.standard_cost),0) as value')->value('value'),
            'recent_transactions' => StockTransaction::latest('occurred_at')->limit(10)->get(),
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
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:160'], 'sku' => ['required', 'string', 'max:80', Rule::unique('items')->where('factory_id', $factoryId)], 'type' => ['required', Rule::in(['raw_material', 'semi_finished', 'finished_good', 'packaging', 'spare_part', 'waste', 'by_product', 'service'])], 'unit_id' => ['required', 'integer', 'exists:units,id'], 'standard_cost' => ['nullable', 'numeric', 'min:0'], 'selling_price' => ['nullable', 'numeric', 'min:0'], 'minimum_stock' => ['nullable', 'numeric', 'min:0'], 'reorder_level' => ['nullable', 'numeric', 'min:0'], 'batch_tracked' => ['nullable', 'boolean'], 'expiry_tracked' => ['nullable', 'boolean']]);

        return response()->json(Item::create($data), 201);
    }

    public function postTransaction(Request $request, InventoryLedger $ledger): JsonResponse
    {
        $data = $request->validate(['item_id' => ['required', 'integer'], 'warehouse_id' => ['required', 'integer'], 'location_id' => ['nullable', 'integer'], 'batch_id' => ['nullable', 'integer'], 'type' => ['required', 'string'], 'quantity' => ['required', 'numeric', 'gt:0'], 'unit_cost' => ['nullable', 'numeric', 'min:0'], 'reason' => ['nullable', 'string', 'max:1000'], 'occurred_at' => ['nullable', 'date', 'before_or_equal:now']]);

        return response()->json($ledger->post($data), 201);
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
