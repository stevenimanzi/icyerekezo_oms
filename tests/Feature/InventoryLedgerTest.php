<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

class InventoryLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_receipts_and_issues_create_immutable_ledger_entries(): void
    {
        $this->registerOwner();
        $this->assertFalse(auth()->user()->hasPermission('products.create'));
        $this->assertTrue(auth()->user()->hasPermission('inventory.adjust'));
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $item = $this->postJson('/api/inventory/items', ['name' => 'Cotton fabric', 'sku' => 'RAW-FAB-001', 'type' => 'raw_material', 'unit_id' => $unit->id, 'standard_cost' => 2500, 'reorder_level' => 20])->assertCreated()->json();

        $this->postJson('/api/inventory/transactions', ['item_id' => $item['id'], 'warehouse_id' => $warehouse->id, 'type' => 'receipt', 'quantity' => 100, 'reason' => 'Opening stock'])->assertCreated();
        $this->postJson('/api/inventory/transactions', ['item_id' => $item['id'], 'warehouse_id' => $warehouse->id, 'type' => 'issue', 'quantity' => 25, 'reason' => 'Production order'])->assertCreated();

        $this->getJson('/api/inventory/overview')->assertOk()
            ->assertJsonPath('items', 1)
            ->assertJsonPath('warehouses', 1)
            ->assertJsonPath('stock.0.item_name', 'Cotton fabric')
            ->assertJsonPath('stock.0.warehouse_name', 'Main Warehouse')
            ->assertJsonPath('stock.0.quantity_on_hand', 75)
            ->assertJsonPath('recent_transactions.0.type', 'issue')
            ->assertJsonPath('recent_transactions.0.item_name', 'Cotton fabric');

        $this->assertEquals(75.0, (float) StockBalance::firstOrFail()->quantity_on_hand);
        $this->assertDatabaseCount('stock_transactions', 2);
        $this->expectException(LogicException::class);
        StockTransaction::firstOrFail()->update(['reason' => 'tampered']);
    }

    public function test_stock_cannot_be_issued_below_available_quantity(): void
    {
        $this->registerOwner();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $item = Item::create(['name' => 'Thread', 'sku' => 'RAW-THR-001', 'type' => 'raw_material', 'unit_id' => $unit->id]);

        $this->postJson('/api/inventory/transactions', ['item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'issue', 'quantity' => 1, 'reason' => 'Production issue'])
            ->assertUnprocessable()->assertJsonPath('errors.quantity.0', 'Not enough stock. Only 0 is currently in this warehouse.');
        $this->assertDatabaseCount('stock_transactions', 0);
    }

    public function test_reservation_error_explains_available_quantity(): void
    {
        $this->registerOwner();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $item = Item::create(['name' => 'Reserve material', 'sku' => 'RAW-RES-001', 'type' => 'raw_material', 'unit_id' => $unit->id]);
        $this->postJson('/api/inventory/transactions', ['item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'receipt', 'quantity' => 6, 'reason' => 'Opening balance'])->assertCreated();

        $this->postJson('/api/inventory/transactions', ['item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'reserve', 'quantity' => 10, 'reason' => 'Planned work'])
            ->assertUnprocessable()->assertJsonPath('errors.quantity.0', 'Not enough available stock. You can use up to 6.');
    }

    public function test_factory_output_and_customer_dispatch_movements_are_recorded(): void
    {
        $this->registerOwner();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $item = Item::create(['name' => 'Finished roll', 'sku' => 'FIN-ROL-001', 'type' => 'finished_good', 'unit_id' => $unit->id]);

        $this->postJson('/api/inventory/transactions', [
            'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'production_output',
            'quantity' => 10, 'reason' => 'Production order PO-001 completed',
        ])->assertCreated()->assertJsonPath('balance_after', 10);
        $this->postJson('/api/inventory/transactions', [
            'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'dispatch',
            'quantity' => 4.25, 'reason' => 'Customer delivery DN-001',
        ])->assertCreated()->assertJsonPath('balance_after', 5.75);

        $this->assertEquals(5.75, (float) StockBalance::firstOrFail()->quantity_on_hand);
    }

    private function registerOwner(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Inventory Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Ledger Factory', 'industry_type' => 'manufacturing'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $user = auth()->user();
        $role = Role::where('factory_id', $user->current_factory_id)->where('slug', 'warehouse-keeper')->firstOrFail();
        $user->roles()->detach();
        $user->roles()->attach($role->id, ['factory_id' => $user->current_factory_id]);
    }
}
