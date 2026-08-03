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
}
