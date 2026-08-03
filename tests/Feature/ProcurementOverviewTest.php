<?php

namespace Tests\Feature;

use App\Models\PurchaseDocument;
use App\Models\Supplier;
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
            ->assertJsonPath('documents.data.0.supplier.name', 'Materials Ltd');
    }
}
