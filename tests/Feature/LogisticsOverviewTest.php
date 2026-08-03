<?php

namespace Tests\Feature;

use App\Models\DeliveryVehicle;
use App\Models\Shipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogisticsOverviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_logistics_overview_returns_live_factory_records(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Delivery Factory', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $vehicle = DeliveryVehicle::create(['registration_number' => 'RAB 123A', 'vehicle_type' => 'Truck', 'driver_name' => 'Jean', 'status' => 'assigned']);
        Shipment::create(['shipment_number' => 'SHP-001', 'delivery_vehicle_id' => $vehicle->id, 'customer_name' => 'Kigali Retail', 'destination' => 'Kigali', 'status' => 'in_transit', 'package_count' => 10, 'total_weight' => 500, 'planned_dispatch_at' => now(), 'dispatched_at' => now()]);

        $this->getJson('/api/logistics/overview')->assertOk()
            ->assertJsonPath('summary.total_shipments', 1)
            ->assertJsonPath('summary.in_transit', 1)
            ->assertJsonPath('summary.vehicles', 1)
            ->assertJsonPath('shipments.data.0.vehicle.registration_number', 'RAB 123A')
            ->assertJsonCount(1, 'vehicles');
    }
}
