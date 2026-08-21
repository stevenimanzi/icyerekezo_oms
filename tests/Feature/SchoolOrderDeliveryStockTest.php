<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Role;
use App\Models\SalesDocument;
use App\Models\StockBalance;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SchoolOrderDeliveryStockTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivering_a_school_order_line_decrements_matching_stock(): void
    {
        $this->registerOwnerWithWarehouseKeeper();
        $warehouse = Warehouse::firstOrFail();

        $order = $this->postJson('/api/sales/school-orders', [
            'customer_name' => 'Kigali Primary School', 'academic_year' => '2025-2026', 'document_date' => today()->toDateString(),
            'lines' => [['class_level' => 'P4', 'garment_category' => 'Uniform', 'gender' => 'Boy', 'size' => 'M', 'color' => 'Blue', 'quantity_ordered' => 10]],
        ])->assertCreated()->json('document');

        $line = $order['lines'][0];
        $this->assertNotNull($line['item_id']);
        $item = Item::findOrFail($line['item_id']);
        $this->assertSame('finished_good', $item->type);

        $this->postJson('/api/inventory/transactions', [
            'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'production_output',
            'quantity' => 10, 'reason' => 'Packed uniforms',
        ])->assertCreated();

        $this->patchJson('/api/sales/orders/'.$order['id'].'/decision', ['decision' => 'accept'])->assertOk();

        $this->patchJson('/api/sales/school-order-lines/'.$line['id'], [
            'quantity_packed' => 10, 'quantity_delivered' => 6, 'quantity_rejected' => 0,
        ])->assertOk();

        $this->assertEquals(4.0, (float) StockBalance::where('item_id', $item->id)->where('warehouse_id', $warehouse->id)->value('quantity_on_hand'));

        $this->patchJson('/api/sales/school-order-lines/'.$line['id'], [
            'quantity_packed' => 10, 'quantity_delivered' => 10, 'quantity_rejected' => 0,
        ])->assertOk();

        $this->assertEquals(0.0, (float) StockBalance::where('item_id', $item->id)->where('warehouse_id', $warehouse->id)->value('quantity_on_hand'));
    }

    public function test_delivery_without_matching_stock_still_succeeds(): void
    {
        $this->registerOwnerWithWarehouseKeeper();

        $order = $this->postJson('/api/sales/school-orders', [
            'customer_name' => 'Musanze School', 'academic_year' => '2025-2026', 'document_date' => today()->toDateString(),
            'lines' => [['class_level' => 'S2', 'garment_category' => 'Sweater', 'gender' => 'Girl', 'size' => 'S', 'color' => 'Green', 'quantity_ordered' => 5]],
        ])->assertCreated()->json('document');
        $line = $order['lines'][0];

        $this->patchJson('/api/sales/orders/'.$order['id'].'/decision', ['decision' => 'accept'])->assertOk();

        $this->patchJson('/api/sales/school-order-lines/'.$line['id'], [
            'quantity_packed' => 5, 'quantity_delivered' => 5, 'quantity_rejected' => 0,
        ])->assertOk()->assertJsonPath('document_status', 'delivered');

        $this->assertDatabaseCount('stock_transactions', 0);
    }

    private function registerOwnerWithWarehouseKeeper(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Noguchi Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'NOGUCHI HOLDINGS Ltd', 'industry_type' => 'clothing_textiles',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $user = auth()->user();
        $role = Role::where('factory_id', $user->current_factory_id)->where('slug', 'warehouse-keeper')->firstOrFail();
        $user->roles()->syncWithoutDetaching([$role->id => ['factory_id' => $user->current_factory_id]]);
    }
}
