<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NoguchiLogisticsReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_noguchi_logistics_users_receive_the_special_daily_report(): void
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
            ->assertJsonPath('report.scope', 'noguchi_logistics')
            ->assertJsonPath('standard.title', 'NOGUCHI daily logistics report')
            ->assertJsonPath('standard.orientation', 'landscape');

        $this->actingAs($owner)->getJson('/api/reports?period=day&type=all')
            ->assertOk()
            ->assertJsonPath('report.scope', 'factory');
    }
}
