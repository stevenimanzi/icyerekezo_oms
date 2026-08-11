<?php

namespace Tests\Feature;

use App\Models\DeliveryVehicle;
use App\Models\Shipment;
use App\Models\SalesDocument;
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

    public function test_logistics_can_review_dispatch_and_deliver_an_order(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Order Delivery Factory', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $order = SalesDocument::create(['document_type' => 'customer_order', 'document_number' => 'SO-100', 'customer_name' => 'Rubavu Retail', 'status' => 'pending', 'total_amount' => 500000, 'item_count' => 24, 'document_date' => today()]);
        $vehicle = DeliveryVehicle::create(['registration_number' => 'RAC 500L', 'vehicle_type' => 'Truck', 'driver_name' => 'Alice', 'status' => 'available']);

        $this->patchJson("/api/sales/orders/{$order->id}/decision", ['decision' => 'accept'])
            ->assertOk()->assertJsonPath('document.status', 'confirmed');

        $shipmentId = $this->postJson('/api/logistics/shipments', [
            'sales_document_id' => $order->id, 'delivery_vehicle_id' => $vehicle->id,
            'destination' => 'Rubavu', 'package_count' => 6, 'total_weight' => 180,
        ])->assertCreated()->assertJsonPath('shipment.status', 'ready')->json('shipment.id');

        $this->patchJson("/api/logistics/shipments/{$shipmentId}", ['action' => 'dispatch'])
            ->assertOk()->assertJsonPath('shipment.status', 'in_transit');
        $this->patchJson("/api/logistics/shipments/{$shipmentId}", ['action' => 'deliver', 'received_by' => 'Store Manager', 'proof_reference' => 'POD-100'])
            ->assertOk()->assertJsonPath('shipment.status', 'delivered');

        $this->getJson('/api/logistics/overview')->assertOk()
            ->assertJsonPath('summary.delivered', 1)
            ->assertJsonPath('summary.delivered_items', 24)
            ->assertJsonPath('summary.delivered_packages', 6)
            ->assertJsonPath('summary.delivered_today', 1);
        $this->assertDatabaseHas('sales_documents', ['id' => $order->id, 'status' => 'completed']);
        $this->assertDatabaseHas('delivery_vehicles', ['id' => $vehicle->id, 'status' => 'available']);
    }
}
