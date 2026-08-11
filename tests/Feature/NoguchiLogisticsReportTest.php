<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NoguchiLogisticsReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_logistics_receives_only_logistics_data_while_management_receives_factory_report(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'owner@noguchi-report.test', 'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345', 'factory_name' => 'NOGUCHI HOLDINGS Ltd',
            'industry_type' => 'clothing_textiles',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();

        $owner = auth()->user();
        $role = Role::where('factory_id', $owner->current_factory_id)->where('slug', 'logistics-officer')->firstOrFail();
        $employee = $this->postJson('/api/team/users', [
            'name' => 'Logistics Officer', 'email' => 'logistics@noguchi-report.test',
            'password' => 'Officer@12345', 'password_confirmation' => 'Officer@12345',
            'role_id' => $role->id, 'job_title' => 'Logistics Officer',
        ])->assertCreated()->json();

        $this->actingAs(User::findOrFail($employee['id']))
            ->getJson('/api/reports?period=day&type=all')
            ->assertOk()
            ->assertJsonPath('report.scope', 'logistics')
            ->assertJsonPath('report.type', 'inventory')
            ->assertJsonPath('standard.title', 'Daily logistics report')
            ->assertJsonPath('production', [])
            ->assertJsonStructure(['logistics' => ['summary' => ['orders_processed', 'items_ordered', 'items_delivered', 'items_remaining', 'items_returned', 'total_value', 'shipments', 'deliveries_completed'], 'order_statuses', 'return_reasons', 'orders', 'shipments', 'vehicles'], 'stock_register', 'filters' => ['districts']]);

        $this->actingAs($owner)->getJson('/api/reports?period=day&type=all')
            ->assertOk()
            ->assertJsonPath('report.scope', 'factory');
    }
}
