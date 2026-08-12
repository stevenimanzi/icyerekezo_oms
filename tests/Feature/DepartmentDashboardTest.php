<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\DeliveryVehicle;
use App\Models\Role;
use App\Models\SalesDocument;
use App\Models\Shipment;
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

    public function test_logistics_dashboard_returns_orders_shipments_and_vehicle_data(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'owner@logistics.test', 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'Logistics Factory',
            'industry_type' => 'clothing_textiles', 'locale' => 'en',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $factoryId = auth()->user()->current_factory_id;
        $role = Role::where('factory_id', $factoryId)->where('slug', 'logistics-officer')->firstOrFail();
        $employee = $this->postJson('/api/team/users', [
            'name' => 'Logistics Officer', 'email' => 'officer@logistics.test', 'password' => 'Officer@12345',
            'password_confirmation' => 'Officer@12345', 'role_id' => $role->id,
            'job_title' => 'Logistics Officer',
        ])->assertCreated()->json();

        $order = SalesDocument::create([
            'factory_id' => $factoryId, 'document_type' => 'customer_order', 'document_number' => 'SO-1001',
            'customer_name' => 'Kigali Retailer', 'status' => 'confirmed', 'currency_code' => 'RWF',
            'total_amount' => 120000, 'paid_amount' => 0, 'item_count' => 4, 'document_date' => today(),
            'due_date' => today()->addDay(), 'created_by' => auth()->id(),
        ]);
        $vehicle = DeliveryVehicle::create([
            'factory_id' => $factoryId, 'registration_number' => 'RAB 123 A', 'vehicle_type' => 'Truck',
            'driver_name' => 'Driver One', 'status' => 'available',
        ]);
        Shipment::create([
            'factory_id' => $factoryId, 'shipment_number' => 'SHP-1001', 'sales_document_id' => $order->id,
            'delivery_vehicle_id' => $vehicle->id, 'customer_name' => 'Kigali Retailer',
            'destination' => 'Kigali', 'status' => 'in_transit', 'package_count' => 4,
            'planned_dispatch_at' => now()->subHour(), 'dispatched_at' => now()->subMinutes(30),
        ]);

        $this->actingAs(User::findOrFail($employee['id']))->getJson('/api/department/dashboard')
            ->assertOk()
            ->assertJsonPath('dashboard_type', 'logistics')
            ->assertJsonPath('logistics_metrics.incoming_orders', 1)
            ->assertJsonPath('logistics_metrics.in_transit', 1)
            ->assertJsonPath('logistics_metrics.delayed', 1)
            ->assertJsonPath('logistics_metrics.available_vehicles', 1)
            ->assertJsonCount(6, 'logistics_trends')
            ->assertJsonPath('logistics_trends.5.orders', 1)
            ->assertJsonPath('logistics_trends.5.dispatched', 1)
            ->assertJsonPath('incoming_orders.0.document_number', 'SO-1001')
            ->assertJsonPath('delivery_activity.0.shipment_number', 'SHP-1001');
    }
}
