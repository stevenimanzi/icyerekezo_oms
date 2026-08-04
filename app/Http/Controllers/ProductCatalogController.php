<?php

namespace App\Http\Controllers;

use App\Models\BillOfMaterial;
use App\Models\Item;
use App\Models\StockBalance;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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

    public function storeCategory(Request $request): JsonResponse
    {
        return $this->saveCategory($request);
    }

    public function updateCategory(Request $request, int $category): JsonResponse
    {
        return $this->saveCategory($request, $category);
    }

    private function saveCategory(Request $request, ?int $categoryId = null): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        if ($categoryId) abort_unless(DB::table('item_categories')->where('factory_id', $factoryId)->where('id', $categoryId)->exists(), 404);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', Rule::unique('item_categories')->where('factory_id', $factoryId)->ignore($categoryId)],
            'code' => ['required', 'string', 'max:30', Rule::unique('item_categories')->where('factory_id', $factoryId)->ignore($categoryId)],
            'parent_id' => ['nullable', Rule::exists('item_categories', 'id')->where('factory_id', $factoryId), Rule::notIn([$categoryId])],
        ]);
        if ($categoryId) {
            DB::table('item_categories')->where('id', $categoryId)->update($data + ['updated_at' => now()]);
            return response()->json(['message' => 'Category updated successfully.']);
        }
        $id = DB::table('item_categories')->insertGetId($data + ['factory_id' => $factoryId, 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Category created successfully.', 'id' => $id], 201);
    }

    public function storeUnit(Request $request): JsonResponse
    {
        return $this->saveUnit($request);
    }

    public function updateUnit(Request $request, Unit $unit): JsonResponse
    {
        abort_unless((int) $unit->factory_id === (int) $request->user()->current_factory_id, 404);
        return $this->saveUnit($request, $unit);
    }

    private function saveUnit(Request $request, ?Unit $unit = null): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('units')->where('factory_id', $factoryId)->ignore($unit?->id)],
            'symbol' => ['required', 'string', 'max:20', Rule::unique('units')->where('factory_id', $factoryId)->ignore($unit?->id)],
            'dimension' => ['required', Rule::in(['count', 'mass', 'volume', 'length', 'area', 'time', 'other'])],
            'precision' => ['required', 'integer', 'between:0,6'], 'is_active' => ['nullable', 'boolean'],
        ]);
        if ($unit) {
            $unit->update($data);
            return response()->json(['message' => 'Unit updated successfully.', 'unit' => $unit->fresh()]);
        }
        return response()->json(['message' => 'Unit created successfully.', 'unit' => Unit::create($data)], 201);
    }
}
