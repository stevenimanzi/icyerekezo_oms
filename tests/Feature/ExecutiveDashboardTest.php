<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExecutiveDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_executive_dashboard_uses_live_factory_data_and_starts_empty(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Factory Executive',
            'email' => 'executive@test.local',
            'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Real Data Factory',
            'industry_type' => 'general_manufacturing',
        ])->assertCreated();

        $this->getJson('/api/executive/dashboard')
            ->assertOk()
            ->assertJsonPath('metrics.productionToday', 0)
            ->assertJsonPath('metrics.openOrders', 0)
            ->assertJsonPath('metrics.inventoryValue', 0)
            ->assertJsonPath('metrics.completionRate', 0)
            ->assertJsonCount(7, 'chart')
            ->assertJsonCount(0, 'orders');
    }
}
