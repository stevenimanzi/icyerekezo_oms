<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DepartmentDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_warehouse_dashboard_returns_current_factory_stock_data(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'owner@warehouse.test', 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'Warehouse Factory',
            'industry_type' => 'clothing_textiles', 'locale' => 'en',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $factoryId = auth()->user()->current_factory_id;
        $role = Role::where('factory_id', $factoryId)->where('slug', 'warehouse-keeper')->firstOrFail();
        $workstation = $this->postJson('/api/team/workstations', ['name' => 'Raw Store', 'code' => 'RAW-STORE', 'type' => 'warehouse'])->assertCreated()->json();
        $employee = $this->postJson('/api/team/users', [
            'name' => 'Store Keeper', 'email' => 'keeper@warehouse.test', 'password' => 'Keeper@12345',
            'password_confirmation' => 'Keeper@12345', 'role_id' => $role->id,
            'workstation_id' => $workstation['id'], 'job_title' => 'Warehouse Keeper',
        ])->assertCreated()->json();

        $unit = Unit::where('factory_id', $factoryId)->firstOrFail();
        $warehouse = Warehouse::where('factory_id', $factoryId)->firstOrFail();
        $item = Item::create(['factory_id' => $factoryId, 'unit_id' => $unit->id, 'type' => 'raw_material', 'name' => 'Cotton', 'sku' => 'COT-01', 'standard_cost' => 2000, 'reorder_level' => 20, 'is_active' => true]);
        StockBalance::create(['factory_id' => $factoryId, 'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'quantity_on_hand' => 15]);
        StockTransaction::create(['uuid' => (string) Str::uuid(), 'factory_id' => $factoryId, 'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'type' => 'receipt', 'quantity_delta' => 15, 'balance_after' => 15, 'unit_cost' => 2000, 'occurred_at' => now()]);

        $this->actingAs(User::findOrFail($employee['id']))->getJson('/api/department/dashboard')
            ->assertOk()
            ->assertJsonPath('dashboard_type', 'warehouse')
            ->assertJsonPath('warehouse_metrics.stock_items', 1)
            ->assertJsonPath('warehouse_metrics.low_stock', 1)
            ->assertJsonPath('warehouse_metrics.stock_value', 30000)
            ->assertJsonPath('warehouse_metrics.received_today', 15)
            ->assertJsonPath('recent_stock.0.item_name', 'Cotton');
    }
}
