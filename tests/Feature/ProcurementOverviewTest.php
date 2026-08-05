<?php

namespace Tests\Feature;

use App\Models\PurchaseDocument;
use App\Models\Supplier;
use App\Models\Item;
use App\Models\Unit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProcurementOverviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_procurement_overview_returns_live_factory_records(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Purchase Factory', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $supplier = Supplier::create(['code' => 'SUP-01', 'name' => 'Materials Ltd', 'status' => 'active']);
        PurchaseDocument::create(['document_type' => 'purchase_order', 'document_number' => 'PO-001', 'supplier_id' => $supplier->id, 'status' => 'ordered', 'total_amount' => 400000, 'line_count' => 3, 'document_date' => today(), 'expected_date' => today()->addDays(5)]);

        $this->getJson('/api/procurement/overview')->assertOk()
            ->assertJsonPath('summary.purchase_orders', 1)
            ->assertJsonPath('summary.open_orders', 1)
            ->assertJsonPath('summary.ordered_value', 400000)
            ->assertJsonPath('summary.active_suppliers', 1)
            ->assertJsonPath('documents.0.supplier.name', 'Materials Ltd');
    }

    public function test_purchase_request_can_be_approved_and_converted_to_an_order(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Workflow Factory', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();
        $unit = Unit::create(['name' => 'Piece', 'symbol' => 'pcs', 'is_base' => true]);
        $item = Item::create(['name' => 'Cotton', 'sku' => 'RAW-001', 'type' => 'raw_material', 'unit_id' => $unit->id]);
        $supplier = $this->postJson('/api/procurement/suppliers', ['name' => 'Cotton Supplier', 'payment_terms_days' => 30])->assertCreated()->json('supplier');
        $this->putJson('/api/procurement/suppliers/'.$supplier['id'].'/prices', ['item_id' => $item->id, 'unit_price' => 2500, 'lead_time_days' => 2, 'minimum_order_quantity' => 1])->assertOk();
        $document = $this->postJson('/api/procurement/requests', ['purpose' => 'Materials for next production run', 'expected_date' => today()->addWeek()->toDateString(), 'lines' => [['item_id' => $item->id, 'quantity' => 10]]])->assertCreated()->json('document');
        $this->postJson('/api/procurement/requests/'.$document['id'].'/approve')->assertOk();
        $this->postJson('/api/procurement/requests/'.$document['id'].'/order', ['supplier_id' => $supplier['id']])->assertCreated()
            ->assertJsonPath('document.status', 'ordered')->assertJsonPath('document.total_amount', '25000.00');
        $this->assertDatabaseHas('purchase_documents', ['document_type' => 'purchase_request', 'status' => 'converted']);
    }
}
