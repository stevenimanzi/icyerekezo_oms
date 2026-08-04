<?php

namespace Tests\Feature;

use App\Models\BillOfMaterial;
use App\Models\Item;
use App\Models\Role;
use App\Models\Unit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_warehouse_keeper_sees_live_factory_product_data(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Warehouse User', 'email' => 'products@factory.test', 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'Product Factory', 'industry_type' => 'clothing_textiles',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $user = auth()->user();
        $role = Role::where('factory_id', $user->current_factory_id)->where('slug', 'warehouse-keeper')->firstOrFail();
        $user->roles()->detach();
        $user->roles()->attach($role->id, ['factory_id' => $user->current_factory_id]);
        $unit = Unit::firstOrFail();
        $categoryId = DB::table('item_categories')->insertGetId([
            'factory_id' => $user->current_factory_id, 'name' => 'Fabric', 'code' => 'FAB', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $material = Item::create(['name' => 'Cotton', 'sku' => 'RAW-COT-001', 'type' => 'raw_material', 'unit_id' => $unit->id, 'category_id' => $categoryId]);
        $product = Item::create(['name' => 'Shirt', 'sku' => 'FIN-SHI-001', 'type' => 'finished_good', 'unit_id' => $unit->id]);
        $bom = BillOfMaterial::create(['item_id' => $product->id, 'name' => 'Shirt recipe', 'version' => '1', 'output_quantity' => 1, 'status' => 'active']);
        $bom->components()->create(['item_id' => $material->id, 'unit_id' => $unit->id, 'quantity' => 2]);

        $this->getJson('/api/products/overview')->assertOk()
            ->assertJsonPath('summary.items', 2)
            ->assertJsonPath('summary.finished_products', 1)
            ->assertJsonPath('summary.raw_materials', 1)
            ->assertJsonPath('summary.recipes', 1)
            ->assertJsonPath('categories.0.name', 'Fabric')
            ->assertJsonPath('categories.0.items_count', 1)
            ->assertJsonPath('boms.0.components.0.item.name', 'Cotton')
            ->assertJsonStructure(['items', 'categories', 'units', 'conversions', 'boms', 'updated_at']);
    }

    public function test_warehouse_keeper_can_manage_unique_items_categories_and_units(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Keeper', 'email' => 'keeper@catalog.test', 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'Catalog Factory', 'industry_type' => 'metals_steel',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $user = auth()->user();
        $role = Role::where('factory_id', $user->current_factory_id)->where('slug', 'warehouse-keeper')->firstOrFail();
        $user->roles()->detach();
        $user->roles()->attach($role->id, ['factory_id' => $user->current_factory_id]);

        $category = $this->postJson('/api/products/categories', ['name' => 'Metals', 'code' => 'MET'])
            ->assertCreated()->json('id');
        $this->postJson('/api/products/categories', ['name' => 'Duplicate metals', 'code' => 'MET'])
            ->assertUnprocessable()->assertJsonValidationErrors('code');
        $unit = $this->postJson('/api/products/units', [
            'name' => 'Coil kilogram', 'symbol' => 'kgx', 'dimension' => 'mass', 'precision' => 3, 'is_active' => true,
        ])->assertCreated()->json('unit.id');
        $item = $this->postJson('/api/inventory/items', [
            'name' => 'Steel coil', 'type' => 'raw_material', 'category_id' => $category, 'unit_id' => $unit,
            'standard_cost' => 1200, 'selling_price' => 1500, 'reorder_level' => 10,
        ])->assertCreated()->json();

        $this->assertNotEmpty($item['sku']);
        $this->patchJson('/api/inventory/items/'.$item['id'], [
            'name' => 'Steel coil premium', 'type' => 'raw_material', 'category_id' => $category, 'unit_id' => $unit,
            'standard_cost' => 1300, 'selling_price' => 1600, 'reorder_level' => 12, 'is_active' => true,
        ])->assertOk()->assertJsonPath('item.name', 'Steel coil premium');
        $this->getJson('/api/products/overview')->assertOk()
            ->assertJsonPath('summary.items', 1)->assertJsonPath('items.0.category_name', 'Metals');
    }
}
