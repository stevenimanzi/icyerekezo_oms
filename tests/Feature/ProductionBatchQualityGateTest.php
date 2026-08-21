<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Item;
use App\Models\Role;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionBatchQualityGateTest extends TestCase
{
    use RefreshDatabase;

    public function test_packed_batch_cannot_be_dispatched_until_it_passes_quality_control(): void
    {
        $this->registerOwnerWithWarehouseKeeper();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $item = Item::create(['name' => 'Garment fabric', 'sku' => 'RAW-GAR-001', 'type' => 'raw_material', 'unit_id' => $unit->id]);

        $batch = $this->postJson('/api/inventory/batches', [
            'item_id' => $item->id, 'metadata' => ['style' => 'Shirt', 'color' => 'Blue', 'size' => 'M'],
        ])->assertCreated()->json();
        $this->assertSame('cut', $batch['production_stage']);

        foreach (['cut', 'sewn', 'finished', 'packed'] as $stage) {
            $this->postJson('/api/inventory/transactions', [
                'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'batch_id' => $batch['id'],
                'type' => 'production_output', 'production_stage' => $stage, 'quantity' => 20, 'reason' => "Stage: {$stage}",
            ])->assertCreated();
        }
        $this->assertSame('packed', Batch::findOrFail($batch['id'])->production_stage);
        $this->assertSame('pending', Batch::findOrFail($batch['id'])->qc_status);

        $this->postJson('/api/inventory/transactions', [
            'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'batch_id' => $batch['id'],
            'type' => 'dispatch', 'quantity' => 20, 'reason' => 'Customer delivery',
        ])->assertUnprocessable()->assertJsonPath('errors.batch_id.0', 'This batch has not passed quality control and cannot be issued or dispatched.');

        $this->postJson('/api/quality/inspections', [
            'batch_id' => $batch['id'], 'item_id' => $item->id, 'inspection_type' => 'finished_goods',
            'inspected_quantity' => 20, 'passed_quantity' => 20, 'rejected_quantity' => 0, 'result' => 'passed',
        ])->assertCreated();
        $this->assertSame('passed', Batch::findOrFail($batch['id'])->qc_status);

        $this->postJson('/api/inventory/transactions', [
            'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'batch_id' => $batch['id'],
            'type' => 'dispatch', 'quantity' => 20, 'reason' => 'Customer delivery',
        ])->assertCreated();
    }

    public function test_failed_inspection_keeps_the_batch_blocked(): void
    {
        $this->registerOwnerWithWarehouseKeeper();
        $unit = Unit::firstOrFail();
        $warehouse = Warehouse::firstOrFail();
        $item = Item::create(['name' => 'Garment fabric', 'sku' => 'RAW-GAR-002', 'type' => 'raw_material', 'unit_id' => $unit->id]);
        $batch = $this->postJson('/api/inventory/batches', ['item_id' => $item->id])->assertCreated()->json();
        $this->postJson('/api/inventory/transactions', [
            'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'batch_id' => $batch['id'],
            'type' => 'production_output', 'production_stage' => 'packed', 'quantity' => 15, 'reason' => 'Packed output',
        ])->assertCreated();

        $this->postJson('/api/quality/inspections', [
            'batch_id' => $batch['id'], 'item_id' => $item->id, 'inspection_type' => 'finished_goods',
            'inspected_quantity' => 15, 'passed_quantity' => 0, 'rejected_quantity' => 15, 'result' => 'failed',
        ])->assertCreated();
        $this->assertSame('failed', Batch::findOrFail($batch['id'])->qc_status);

        $this->postJson('/api/inventory/transactions', [
            'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'batch_id' => $batch['id'],
            'type' => 'issue', 'quantity' => 15, 'reason' => 'Attempted release',
        ])->assertUnprocessable()->assertJsonPath('errors.batch_id.0', 'This batch has not passed quality control and cannot be issued or dispatched.');
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
