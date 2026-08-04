<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WarehouseKeeperAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_warehouse_keeper_can_change_stock(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => 'owner@stock.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Secure Stock Factory', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $user = auth()->user();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $itemPayload = ['name' => 'Cotton', 'sku' => 'COT-001', 'type' => 'raw_material', 'unit_id' => $unit->id, 'standard_cost' => 1000, 'reorder_level' => 10];

        $this->postJson('/api/inventory/items', $itemPayload)->assertForbidden()
            ->assertJsonPath('message', 'Only the assigned Warehouse Keeper can record or change stock.');

        $role = Role::where('factory_id', $user->current_factory_id)->where('slug', 'warehouse-keeper')->firstOrFail();
        $user->roles()->detach();
        $user->roles()->attach($role->id, ['factory_id' => $user->current_factory_id]);

        $item = $this->postJson('/api/inventory/items', $itemPayload)->assertCreated()->json();
        $this->assertMatchesRegularExpression('/^RAW-[A-Z0-9]{8}$/', $item['sku']);
        $this->assertNotSame($itemPayload['sku'], $item['sku']);
        $this->patchJson('/api/inventory/items/'.$item['id'], [...$itemPayload, 'sku' => 'USER-CANNOT-CHANGE', 'name' => 'Cotton Fabric'])->assertOk()->assertJsonPath('item.name', 'Cotton Fabric')->assertJsonPath('item.sku', $item['sku']);
        $this->postJson('/api/inventory/transactions', ['item_id' => $item['id'], 'warehouse_id' => $warehouse->id, 'type' => 'receipt', 'quantity' => 25, 'reason' => 'Delivery DN-001'])->assertCreated();
        $this->getJson('/api/inventory/tools')->assertOk()->assertJsonPath('items.0.name', 'Cotton Fabric');
        $this->getJson('/api/procurement/overview')->assertOk()->assertJsonPath('summary.receipts', 1)->assertJsonPath('stock_receipts.0.reason', 'Delivery DN-001');
    }
}
