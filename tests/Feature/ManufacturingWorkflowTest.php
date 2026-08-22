<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\ProductionOrder;
use App\Models\Role;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManufacturingWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_bom_scales_materials_and_workflow_stages_run_in_order(): void
    {
        $this->registerOwner();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $material = Item::create(['name' => 'Maize grain', 'sku' => 'RAW-MAIZE', 'type' => 'raw_material', 'unit_id' => $unit->id]);
        $product = Item::create(['name' => 'Maize flour', 'sku' => 'FIN-FLOUR', 'type' => 'finished_good', 'unit_id' => $unit->id]);
        $this->postJson('/api/inventory/transactions', ['item_id' => $material->id, 'warehouse_id' => $warehouse->id, 'type' => 'receipt', 'quantity' => 200, 'reason' => 'Opening stock for workflow test'])->assertCreated();

        $bom = $this->postJson('/api/manufacturing/boms', [
            'item_id' => $product->id, 'name' => 'Standard maize flour', 'version' => '1.0', 'output_quantity' => 10,
            'components' => [['item_id' => $material->id, 'unit_id' => $unit->id, 'quantity' => 20, 'waste_percent' => 10]],
        ])->assertCreated()->json();

        $workflow = $this->postJson('/api/manufacturing/workflows', [
            'name' => 'Milling flow', 'code' => 'MILL-01',
            'stages' => [
                ['name' => 'Milling', 'code' => 'MILL', 'sequence' => 1, 'expected_minutes' => 60],
                ['name' => 'Packing', 'code' => 'PACK', 'sequence' => 2, 'quality_required' => true],
            ],
        ])->assertCreated()->json();

        $created = $this->postJson('/api/manufacturing/orders', [
            'order_number' => 'PO-0001', 'item_id' => $product->id, 'bill_of_material_id' => $bom['id'],
            'workflow_template_id' => $workflow['id'], 'warehouse_id' => $warehouse->id, 'planned_quantity' => 50,
        ])->assertCreated()->assertJsonPath('material_requirements.0.required_quantity', 110)->json();

        $approved = $this->postJson("/api/manufacturing/orders/{$created['order']['id']}/approve")->assertOk()->assertJsonPath('status', 'approved')->json();
        $first = $approved['executions'][0];
        $second = $approved['executions'][1];
        $this->assertSame('ready', $first['status']);
        $this->assertSame('not_started', $second['status']);

        // Approving the order must actually issue the recipe's raw material out of stock,
        // not just check availability — 200 opening stock minus the 110 required above.
        $this->assertSame(90.0, (float) \App\Models\StockBalance::where('item_id', $material->id)->where('warehouse_id', $warehouse->id)->value('quantity_on_hand'));

        $this->patchJson("/api/manufacturing/stages/{$second['id']}", ['status' => 'in_progress'])->assertUnprocessable();
        $this->patchJson("/api/manufacturing/stages/{$first['id']}", ['status' => 'in_progress'])->assertOk();
        $this->patchJson("/api/manufacturing/stages/{$first['id']}", ['status' => 'completed', 'output_quantity' => 48, 'waste_quantity' => 2])->assertOk();
        $this->patchJson("/api/manufacturing/stages/{$second['id']}", ['status' => 'in_progress'])->assertOk();
        $this->patchJson("/api/manufacturing/stages/{$second['id']}", ['status' => 'completed', 'output_quantity' => 47, 'rejected_quantity' => 1])->assertOk();

        $order = ProductionOrder::findOrFail($created['order']['id']);
        $this->assertSame('completed', $order->status);
        $this->assertEquals(47, (float) $order->completed_quantity);
        $this->assertDatabaseCount('production_stage_executions', 2);

        // Completing the final stage must land real finished-goods stock in the order's warehouse.
        $this->assertSame(47.0, (float) \App\Models\StockBalance::where('item_id', $product->id)->where('warehouse_id', $warehouse->id)->value('quantity_on_hand'));

        $this->getJson('/api/manufacturing/overview')
            ->assertOk()
            ->assertJsonPath('summary.total_orders', 1)
            ->assertJsonPath('summary.completed_orders', 1)
            ->assertJsonPath('summary.planned_quantity', 50)
            ->assertJsonPath('summary.completed_quantity', 47)
            ->assertJsonPath('summary.stage_output_quantity', 95)
            ->assertJsonPath('summary.rejected_quantity', 1)
            ->assertJsonPath('summary.waste_quantity', 2)
            ->assertJsonCount(1, 'orders.data')
            ->assertJsonCount(1, 'warehouses');
    }

    public function test_production_order_requires_a_warehouse(): void
    {
        $this->registerOwner();
        $unit = Unit::firstOrFail();
        $material = Item::create(['name' => 'Rice paddy', 'sku' => 'RAW-PADDY', 'type' => 'raw_material', 'unit_id' => $unit->id]);
        $product = Item::create(['name' => 'Milled rice', 'sku' => 'FIN-RICE', 'type' => 'finished_good', 'unit_id' => $unit->id]);
        $bom = $this->postJson('/api/manufacturing/boms', [
            'item_id' => $product->id, 'name' => 'Standard milled rice', 'version' => '1.0', 'output_quantity' => 10,
            'components' => [['item_id' => $material->id, 'unit_id' => $unit->id, 'quantity' => 15]],
        ]);
        $workflow = $this->postJson('/api/manufacturing/workflows', [
            'name' => 'Milling flow', 'code' => 'MILL-01',
            'stages' => [['name' => 'Milling', 'code' => 'MILL', 'sequence' => 1]],
        ])->json();

        $this->postJson('/api/manufacturing/orders', [
            'order_number' => 'PO-0002', 'item_id' => $product->id, 'bill_of_material_id' => $bom->json('id'),
            'workflow_template_id' => $workflow['id'], 'planned_quantity' => 5,
        ])->assertInvalid(['warehouse_id']);
    }

    public function test_generic_production_roles_can_post_stock_movements_their_permissions_allow(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Mill Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Rice Mill', 'industry_type' => 'food_processing'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $owner = auth()->user();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $material = Item::create(['name' => 'Rice paddy', 'sku' => 'RAW-PADDY2', 'type' => 'raw_material', 'unit_id' => $unit->id]);
        $this->postJson('/api/inventory/transactions', ['item_id' => $material->id, 'warehouse_id' => $warehouse->id, 'type' => 'receipt', 'quantity' => 100, 'reason' => 'Opening stock'])->assertCreated();

        // Switch to a Mixing Operator — a generic production role with no bespoke role-slug
        // allow-list entry, only the standard inventory.issue permission from RoleTemplateCatalog.
        $mixingRole = Role::where('factory_id', $owner->current_factory_id)->where('slug', 'mixing-operator')->firstOrFail();
        $owner->roles()->detach();
        $owner->roles()->attach($mixingRole->id, ['factory_id' => $owner->current_factory_id]);

        $this->postJson('/api/inventory/transactions', ['item_id' => $material->id, 'warehouse_id' => $warehouse->id, 'type' => 'issue', 'quantity' => 5, 'reason' => 'Fed into mixer'])
            ->assertCreated();
        $this->postJson('/api/inventory/transactions', ['item_id' => $material->id, 'warehouse_id' => $warehouse->id, 'type' => 'receipt', 'quantity' => 5, 'reason' => 'Not allowed to receive'])
            ->assertForbidden();
    }

    private function registerOwner(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Production Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Flour Factory', 'industry_type' => 'maize_grain_flour'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $user = auth()->user();
        $warehouseRole = Role::where('factory_id', $user->current_factory_id)->where('slug', 'warehouse-keeper')->firstOrFail();
        $user->roles()->attach($warehouseRole->id, ['factory_id' => $user->current_factory_id]);
    }
}
