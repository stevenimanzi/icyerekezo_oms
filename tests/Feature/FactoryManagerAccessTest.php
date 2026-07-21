<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FactoryManagerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_manager_can_manage_configuration_people_flows_and_reports_without_operational_access(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Factory Owner', 'email' => 'owner@roles.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Controlled Factory', 'industry_type' => 'steel_metals',
        ])->assertCreated();

        $managerRole = Role::where('slug', 'factory-manager')->firstOrFail();
        $administratorRole = Role::where('slug', 'factory-administrator')->firstOrFail();
        $managerResponse = $this->postJson('/api/team/users', [
            'name' => 'Factory Manager', 'email' => 'manager@roles.test', 'password' => 'Manager@12345', 'password_confirmation' => 'Manager@12345',
            'role_id' => $managerRole->id, 'employee_number' => 'MGR-001', 'job_title' => 'Factory Manager',
        ])->assertCreated()->json();

        $manager = User::findOrFail($managerResponse['id']);
        $this->actingAs($manager)->getJson('/api/auth/me')->assertOk()
            ->assertJsonPath('user.workspace', 'executive');
        $permissions = $this->getJson('/api/auth/me')->json('user.permissions');
        foreach (['factory.manage', 'users.create', 'users.update', 'users.assign_roles', 'production.plan', 'reports.view', 'reports.export'] as $permission) {
            $this->assertContains($permission, $permissions);
        }
        foreach (['inventory.view', 'procurement.view', 'quality.inspect', 'sales.create', 'finance.view', 'logistics.dispatch'] as $permission) {
            $this->assertNotContains($permission, $permissions);
        }

        $this->getJson('/api/team/workspaces')->assertOk();
        $this->getJson('/api/factory/flow-suggestion')->assertOk()
            ->assertJsonPath('industry', 'steel_metals')
            ->assertJsonPath('suggestion.departments.1.name', 'Cutting');
        $this->postJson('/api/factory/flow-suggestion/apply')->assertCreated()
            ->assertJsonCount(8, 'stages');
        $this->assertDatabaseHas('departments', ['name' => 'Welding']);
        $this->assertDatabaseHas('workstations', ['name' => 'Quality Control Main Station']);
        $this->postJson('/api/team/departments', ['name' => 'Research and Development', 'code' => 'RND'])->assertCreated();
        $this->getJson('/api/reports?period=week&type=all')->assertOk()
            ->assertJsonPath('factory.name', 'Controlled Factory')
            ->assertJsonPath('report.type', 'all')
            ->assertJsonStructure(['summary', 'production', 'inventory', 'team', 'activities']);
        $this->postJson('/api/factory/warehouses', ['name' => 'Manager Warehouse', 'code' => 'MGR-WH', 'type' => 'general'])->assertCreated();
        $workflow = $this->postJson('/api/manufacturing/workflows', ['name' => 'Cut and finish', 'code' => 'CUT-FIN', 'stages' => [['name' => 'Cutting', 'code' => 'CUT', 'sequence' => 1]]])->assertCreated()->json();
        $this->putJson('/api/manufacturing/workflows/'.$workflow['id'], ['name' => 'Cut, weld and finish', 'code' => 'CUT-FIN', 'status' => 'active', 'stages' => [
            ['name' => 'Cutting', 'code' => 'CUT', 'expected_minutes' => 30, 'required_workers' => 2, 'quality_required' => false, 'approval_required' => false],
            ['name' => 'Welding', 'code' => 'WELD', 'expected_minutes' => 60, 'required_workers' => 3, 'quality_required' => true, 'approval_required' => true],
        ]])->assertOk()->assertJsonCount(2, 'stages')->assertJsonPath('stages.1.sequence', 2);
        $this->getJson('/api/inventory/overview')->assertForbidden();

        $this->postJson('/api/team/users', [
            'name' => 'Forbidden Admin', 'email' => 'admin@roles.test', 'password' => 'AdminSecure@12345', 'password_confirmation' => 'AdminSecure@12345',
            'role_id' => $administratorRole->id, 'employee_number' => 'ADM-001',
        ])->assertUnprocessable()->assertJsonValidationErrors('permissions');
    }
}
