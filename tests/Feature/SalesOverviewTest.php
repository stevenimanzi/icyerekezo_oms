<?php

namespace Tests\Feature;

use App\Models\SalesDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalesOverviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_sales_overview_returns_live_factory_totals_and_records(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Sales Factory', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();

        SalesDocument::create(['document_type' => 'invoice', 'document_number' => 'INV-001', 'customer_name' => 'Kigali Retail', 'status' => 'partially_paid', 'total_amount' => 250000, 'paid_amount' => 100000, 'item_count' => 4, 'document_date' => today(), 'due_date' => today()->addDays(7)]);
        SalesDocument::create(['document_type' => 'customer_order', 'document_number' => 'SO-001', 'customer_name' => 'Kigali Retail', 'status' => 'processing', 'total_amount' => 250000, 'item_count' => 4, 'document_date' => today()]);

        $this->getJson('/api/sales/overview')->assertOk()
            ->assertJsonPath('summary.customer_orders', 1)
            ->assertJsonPath('summary.active_orders', 1)
            ->assertJsonPath('summary.invoices', 1)
            ->assertJsonPath('summary.invoiced_amount', 250000)
            ->assertJsonPath('summary.paid_amount', 100000)
            ->assertJsonPath('summary.outstanding_amount', 150000)
            ->assertJsonCount(2, 'documents.data');
    }

    public function test_noguchi_receives_and_fulfils_detailed_school_garment_orders(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'NOGUCHI HOLDINGS Ltd', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();

        $document = $this->postJson('/api/sales/school-orders', [
            'document_number' => 'SO-SCHOOL-001', 'customer_name' => 'GS KAGAMBA', 'school_district' => 'Gicumbi', 'school_sector' => 'Kageyo', 'academic_year' => '2026', 'document_date' => today()->toDateString(), 'total_amount' => 500000,
            'lines' => [
                ['class_level' => 'P1', 'garment_category' => 'Uniform', 'gender' => 'Boy', 'size' => 'M', 'color' => 'Sky blue / Navy blue', 'quantity_ordered' => 20],
                ['class_level' => 'P1', 'garment_category' => 'Sweater', 'gender' => 'Girl', 'size' => 'S', 'color' => 'Navy blue', 'quantity_ordered' => 10],
            ],
        ])->assertCreated()->assertJsonPath('document.status', 'pending')->assertJsonCount(2, 'document.lines')->json('document');

        $this->patchJson("/api/sales/orders/{$document['id']}/decision", ['decision' => 'accept'])->assertOk();
        $this->patchJson('/api/sales/school-order-lines/'.$document['lines'][0]['id'], ['quantity_packed' => 15, 'quantity_delivered' => 10, 'quantity_rejected' => 2, 'rejection_reason' => 'Size mismatch'])->assertOk();

        $this->getJson('/api/sales/overview')->assertOk()
            ->assertJsonPath('specialization.type', 'noguchi_school_garments')
            ->assertJsonPath('specialization.ordered_items', 30)
            ->assertJsonPath('specialization.packed_items', 15)
            ->assertJsonPath('specialization.delivered_items', 10)
            ->assertJsonPath('specialization.rejected_items', 2)
            ->assertJsonPath('documents.data.0.lines.0.class_level', 'P1');

        $this->getJson('/api/sales/overview?search=KAGAMBA&district=Gicumbi&sector=Kageyo&status=processing&academic_year=2026')->assertOk()
            ->assertJsonPath('documents.total', 1)
            ->assertJsonPath('documents.data.0.customer_name', 'GS KAGAMBA')
            ->assertJsonCount(5, 'specialization.filters.districts')
            ->assertJsonPath('specialization.filters.districts.2', 'Gicumbi')
            ->assertJsonPath('specialization.filters.sectors_by_district.Gicumbi.5', 'Kageyo');

        $this->get("/api/sales/orders/{$document['id']}/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_school_garment_workflow_is_hidden_from_other_clothing_factories(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => fake()->unique()->safeEmail(), 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Another Clothing Factory', 'industry_type' => 'clothing_textiles'])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();

        $this->getJson('/api/sales/overview')->assertOk()->assertJsonPath('specialization', null);
        $this->postJson('/api/sales/school-orders', ['customer_name' => 'School', 'document_date' => today()->toDateString(), 'lines' => []])->assertNotFound();
    }
}
