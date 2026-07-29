<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkflowTemplate;
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
            'role_id' => $managerRole->id, 'job_title' => 'Factory Manager',
        ])->assertCreated()->json();

        $manager = User::findOrFail($managerResponse['id']);
        $this->assertMatchesRegularExpression('/^EMP-[A-Z0-9]{8}$/', $manager->employeeProfile->employee_number);
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
        $this->assertDatabaseHas('departments', ['factory_id' => $manager->current_factory_id, 'name' => 'Production', 'code' => 'PRODUCTION']);
        $productionManagerRole = Role::where('slug', 'production-manager')->firstOrFail();
        $this->postJson('/api/team/users', [
            'name' => 'Production Lead', 'email' => 'production.lead@roles.test', 'password' => 'Production@12345', 'password_confirmation' => 'Production@12345',
            'role_id' => $productionManagerRole->id,
        ])->assertCreated();
        $this->getJson('/api/factory/flow-suggestion')->assertOk()
            ->assertJsonPath('industry', 'steel_metals')
            ->assertJsonFragment(['name' => 'Production'])
            ->assertJsonFragment(['name' => 'Cutting']);
        $this->postJson('/api/factory/flow-suggestion/apply')->assertCreated()
            ->assertJsonCount(9, 'stages');
        $suggestedWorkflow = WorkflowTemplate::where('code', 'INDUSTRY-DEFAULT')->firstOrFail();
        $suggestedWorkflow->stages()->whereIn('code', ['raw_materials', 'production'])->delete();
        $suggestedWorkflow->stages()->where('code', 'cutting')->update(['sequence' => 1]);
        $this->postJson('/api/factory/flow-suggestion/apply')->assertCreated()
            ->assertJsonPath('message', 'Suggested flow applied successfully. You can apply it again whenever your factory setup changes.')
            ->assertJsonCount(9, 'stages');
        $this->postJson('/api/factory/flow-suggestion/apply')->assertCreated()
            ->assertJsonCount(9, 'stages');
        $this->assertDatabaseHas('departments', ['name' => 'Welding']);
        $this->assertDatabaseHas('workstations', ['name' => 'Quality Control Main Station']);
        $welding = Department::where('name', 'Welding')->firstOrFail();
        $this->patchJson('/api/team/departments/'.$welding->id, ['manager_id' => $manager->id])->assertOk()
            ->assertJsonPath('manager.id', $manager->id);
        $this->assertDatabaseHas('employee_profiles', ['user_id' => $manager->id, 'department_id' => $welding->id]);
        $this->postJson('/api/team/departments', ['name' => 'Research and Development', 'code' => 'RND'])->assertCreated();
        $this->getJson('/api/reports?period=week&type=all')->assertOk()
            ->assertJsonPath('factory.name', 'Controlled Factory')
            ->assertJsonPath('report.type', 'all')
            ->assertJsonStructure(['summary', 'department_activity', 'production', 'inventory', 'activities'])
            ->assertJsonFragment(['name' => 'Research and Development', 'stages_processed' => 0, 'output_quantity' => 0]);
        $productionDepartment = Department::where('code', 'PRODUCTION')->firstOrFail();
        $this->getJson('/api/reports?period=day&type=departments&department_id='.$productionDepartment->id)->assertOk()
            ->assertJsonCount(1, 'department_activity')
            ->assertJsonPath('department_activity.0.name', 'Production')
            ->assertJsonPath('department_activity.0.production_orders', 0);
        $this->postJson('/api/factory/warehouses', ['name' => 'Manager Warehouse', 'code' => 'MGR-WH', 'type' => 'general'])->assertCreated();
        $workflow = $this->postJson('/api/manufacturing/workflows', ['name' => 'Cut and finish', 'code' => 'CUT-FIN', 'stages' => [['name' => 'Cutting', 'code' => 'MANUAL-CODE-IGNORED', 'sequence' => 9]]])
            ->assertCreated()
            ->assertJsonPath('stages.0.code', 'CUTTING')
            ->assertJsonPath('stages.0.sequence', 1)
            ->assertJsonPath('stages.0.expected_minutes', 0)
            ->json();
        $this->putJson('/api/manufacturing/workflows/'.$workflow['id'], ['name' => 'Cut, weld and finish', 'code' => 'CUT-FIN', 'status' => 'active', 'stages' => [
            ['name' => 'Cutting', 'code' => 'CUT', 'expected_minutes' => 30, 'required_workers' => 2, 'quality_required' => false, 'approval_required' => false],
            ['name' => 'Welding', 'code' => 'WELD', 'expected_minutes' => 60, 'required_workers' => 3, 'quality_required' => true, 'approval_required' => true],
        ]])->assertOk()->assertJsonCount(2, 'stages')
            ->assertJsonPath('stages.0.code', 'CUTTING')
            ->assertJsonPath('stages.1.code', 'WELDING')
            ->assertJsonPath('stages.1.sequence', 2)
            ->assertJsonPath('stages.1.expected_minutes', 0);
        $this->getJson('/api/inventory/overview')->assertForbidden();

        $this->postJson('/api/team/users', [
            'name' => 'Forbidden Admin', 'email' => 'admin@roles.test', 'password' => 'AdminSecure@12345', 'password_confirmation' => 'AdminSecure@12345',
            'role_id' => $administratorRole->id, 'employee_number' => 'ADM-001',
        ])->assertUnprocessable()->assertJsonValidationErrors('permissions');
    }
}
