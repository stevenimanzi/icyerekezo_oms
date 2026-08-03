<?php

namespace Tests\Feature;

use App\Models\Item;
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
        $this->assertTrue(auth()->user()->hasPermission('products.create'));
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

        $this->postJson('/api/inventory/transactions', ['item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'issue', 'quantity' => 1])->assertUnprocessable();
        $this->assertDatabaseCount('stock_transactions', 0);
    }

    private function registerOwner(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Inventory Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Ledger Factory', 'industry_type' => 'manufacturing'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
    }
}
