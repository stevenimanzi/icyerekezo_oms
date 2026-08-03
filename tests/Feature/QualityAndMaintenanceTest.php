<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Machine;
use App\Models\Unit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QualityAndMaintenanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_quality_inspections_validate_quantities_and_require_completion_before_approval(): void
    {
        $this->registerOwner();
        $item = Item::create(['name' => 'Finished product', 'sku' => 'FG-001', 'type' => 'finished_good', 'unit_id' => Unit::firstOrFail()->id]);

        $this->postJson('/api/quality/inspections', [
            'item_id' => $item->id, 'inspection_type' => 'finished_goods', 'inspected_quantity' => 10,
            'passed_quantity' => 9, 'rejected_quantity' => 2, 'result' => 'failed',
        ])->assertStatus(422);

        $pending = $this->postJson('/api/quality/inspections', [
            'item_id' => $item->id, 'inspection_type' => 'finished_goods', 'inspected_quantity' => 10,
            'passed_quantity' => 0, 'rejected_quantity' => 0, 'result' => 'pending',
        ])->assertCreated()->json();
        $this->postJson('/api/quality/inspections/'.$pending['id'].'/approve')->assertStatus(422);

        $passed = $this->postJson('/api/quality/inspections', [
            'item_id' => $item->id, 'inspection_type' => 'finished_goods', 'inspected_quantity' => 10,
            'passed_quantity' => 10, 'rejected_quantity' => 0, 'result' => 'passed',
        ])->assertCreated()->json();
        $this->postJson('/api/quality/inspections/'.$passed['id'].'/approve')->assertOk()->assertJsonPath('approved_by', auth()->id());
        $this->getJson('/api/quality/overview')->assertOk()->assertJsonPath('metrics.pass_rate', 100);
    }

    public function test_breakdown_and_repair_update_machine_availability_correctly(): void
    {
        $this->registerOwner();
        $machine = $this->postJson('/api/machines', ['name' => 'Milling Machine', 'code' => 'MILL-01', 'type' => 'Milling'])->assertCreated()->json();
        $record = $this->postJson('/api/maintenance', [
            'machine_id' => $machine['id'], 'maintenance_type' => 'breakdown', 'title' => 'Main motor stopped', 'priority' => 'urgent',
        ])->assertCreated()->json();
        $this->assertSame('broken', Machine::findOrFail($machine['id'])->status);

        $this->patchJson('/api/maintenance/'.$record['id'], ['status' => 'in_progress', 'resolution' => '', 'cost' => 0, 'downtime_minutes' => 30])->assertOk();
        $this->assertSame('maintenance', Machine::findOrFail($machine['id'])->status);
        $this->patchJson('/api/maintenance/'.$record['id'], ['status' => 'completed', 'resolution' => 'Motor contactor replaced', 'cost' => 45000, 'downtime_minutes' => 75])->assertOk();
        $this->assertSame('operational', Machine::findOrFail($machine['id'])->status);
        $this->getJson('/api/machines/overview')->assertOk()->assertJsonPath('metrics.operational', 1)->assertJsonPath('metrics.down', 0);
    }

    private function registerOwner(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Factory Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'Controlled Operations', 'industry_type' => 'maize_grain_flour',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
    }
}
