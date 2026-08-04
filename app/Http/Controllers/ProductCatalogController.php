<?php

namespace App\Http\Controllers;

use App\Models\BillOfMaterial;
use App\Models\Item;
use App\Models\StockBalance;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductCatalogController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $stock = StockBalance::query()->selectRaw('item_id, COALESCE(SUM(quantity_on_hand), 0) as quantity')
            ->groupBy('item_id')->pluck('quantity', 'item_id');

        $items = Item::query()->with('unit:id,name,symbol')->leftJoin('item_categories', 'item_categories.id', '=', 'items.category_id')
            ->orderBy('items.name')->get([
                'items.id', 'items.category_id', 'items.unit_id', 'items.name', 'items.sku', 'items.type', 'items.description',
                'items.standard_cost', 'items.selling_price', 'items.reorder_level', 'items.is_active', 'item_categories.name as category_name',
            ])->map(function ($item) use ($stock) {
                $item->quantity_on_hand = (float) ($stock[$item->id] ?? 0);
                $item->stock_value = $item->quantity_on_hand * (float) $item->standard_cost;
                return $item;
            });

        $categories = DB::table('item_categories')->where('factory_id', $factoryId)->orderBy('name')->get()
            ->map(function ($category) use ($items) {
                $category->items_count = $items->where('category_id', $category->id)->count();
                return $category;
            });
        $units = Unit::query()->orderBy('name')->get(['id', 'name', 'symbol', 'dimension', 'precision', 'is_active']);
        $conversions = DB::table('unit_conversions as conversions')
            ->join('units as source', 'source.id', '=', 'conversions.from_unit_id')
            ->join('units as target', 'target.id', '=', 'conversions.to_unit_id')
            ->where('conversions.factory_id', $factoryId)->orderBy('source.name')->get([
                'conversions.id', 'conversions.multiplier', 'source.name as from_unit', 'source.symbol as from_symbol',
                'target.name as to_unit', 'target.symbol as to_symbol',
            ]);
        $boms = BillOfMaterial::query()->with([
            'item:id,name,sku,unit_id',
            'components:id,bill_of_material_id,item_id,unit_id,quantity,waste_percent,is_optional',
            'components.item:id,name,sku',
        ])->latest()->get();

        return response()->json([
            'summary' => [
                'items' => $items->count(), 'active_items' => $items->where('is_active', true)->count(),
                'finished_products' => $items->where('type', 'finished_good')->count(),
                'raw_materials' => $items->where('type', 'raw_material')->count(), 'recipes' => $boms->count(),
            ],
            'items' => $items, 'categories' => $categories, 'units' => $units,
            'conversions' => $conversions, 'boms' => $boms, 'updated_at' => now()->toIso8601String(),
        ]);
    }
}
