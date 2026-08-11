<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_can_create_a_role_specific_employee_workspace(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Factory Owner',
            'email' => 'owner@example.com',
            'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Icyerekezo Flour Mill',
            'industry_type' => 'maize_grain_flour',
            'locale' => 'en',
        ])->assertCreated();
        $this->grantCurrentUserFactoryAdministrator();

        $this->assertDatabaseCount('roles', 24);
        $warehouseRole = Role::where('slug', 'warehouse-keeper')->firstOrFail();

        $workstation = $this->postJson('/api/team/workstations', [
            'name' => 'Raw Grain Store',
            'code' => 'RGS-01',
            'type' => 'warehouse',
            'description' => 'Receives and issues maize for production.',
        ])->assertCreated()->json();

        $employee = $this->postJson('/api/team/users', [
            'name' => 'Warehouse Keeper',
            'email' => 'keeper@example.com',
            'password' => 'Keeper@12345',
            'password_confirmation' => 'Keeper@12345',
            'role_id' => $warehouseRole->id,
            'workstation_id' => $workstation['id'],
            'employee_number' => 'WH-001',
            'job_title' => 'Store Keeper',
        ])->assertCreated()->json();

        $assignment = $this->postJson('/api/team/assignments', [
            'user_id' => $employee['id'],
            'workstation_id' => $workstation['id'],
            'assignment_type' => 'stock_receipt',
            'title' => 'Receive maize delivery',
            'priority' => 'high',
        ])->assertCreated()->json();

        $keeper = User::findOrFail($employee['id']);
        $this->actingAs($keeper)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.workspace', 'warehouse')
            ->assertJsonPath('user.employee_profile.workstation.code', 'RGS-01')
            ->assertJsonFragment(['title' => 'Receive maize delivery'])
            ->assertJsonFragment(['permissions' => $this->permissionListFor($keeper)]);

        $permissions = $this->getJson('/api/auth/me')->json('user.permissions');
        $this->assertContains('inventory.view', $permissions);
        $this->assertContains('inventory.receive', $permissions);
        $this->assertNotContains('finance.view', $permissions);

        $this->patchJson("/api/team/assignments/{$assignment['id']}", ['status' => 'in_progress'])
            ->assertOk()
            ->assertJsonPath('status', 'in_progress');
    }

    public function test_logistics_workspace_has_its_operational_and_reporting_permissions(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Factory Owner',
            'email' => 'logistics-owner@example.com',
            'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Icyerekezo Logistics Factory',
            'industry_type' => 'other',
            'locale' => 'en',
        ])->assertCreated();

        $role = Role::where('slug', 'logistics-officer')->firstOrFail();
        $permissions = $role->permissions()->pluck('slug')->all();

        $this->assertContains('logistics.view', $permissions);
        $this->assertContains('logistics.dispatch', $permissions);
        $this->assertContains('logistics.deliver', $permissions);
        $this->assertContains('sales.view', $permissions);
        $this->assertContains('inventory.view', $permissions);
        $this->assertContains('reports.view', $permissions);
        $this->assertNotContains('users.view', $permissions);
        $this->assertNotContains('factory.manage', $permissions);
    }

    public function test_separation_of_duties_roles_are_created_with_least_privilege(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Factory Owner',
            'email' => 'duties-owner@example.com',
            'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Duties Factory',
            'industry_type' => 'other',
            'locale' => 'en',
        ])->assertCreated();

        foreach (['production-planner', 'production-supervisor', 'maintenance-technician', 'quality-manager', 'hr-officer', 'health-safety-officer', 'internal-auditor'] as $slug) {
            $this->assertDatabaseHas('roles', ['slug' => $slug, 'is_system' => true]);
        }

        foreach ([
            'sewing-operator' => 'sewing',
            'mixing-operator' => 'mixing',
            'processing-operator' => 'processing',
            'bottling-operator' => 'bottling',
            'packaging-operator' => 'packaging',
        ] as $slug => $workspace) {
            $this->assertDatabaseHas('roles', ['slug' => $slug, 'dashboard_key' => $workspace, 'is_system' => true]);
            $permissions = Role::where('slug', $slug)->firstOrFail()->permissions()->pluck('slug')->all();
            $this->assertContains('production.execute', $permissions);
            $this->assertContains('maintenance.create', $permissions);
            $this->assertNotContains('production.plan', $permissions);
            $this->assertNotContains('maintenance.execute', $permissions);
            $this->assertNotContains('users.update', $permissions);
        }

        $auditorPermissions = Role::where('slug', 'internal-auditor')->firstOrFail()->permissions()->pluck('slug')->all();
        foreach (['audit.view', 'inventory.view', 'production.view', 'quality.view', 'procurement.view', 'finance.view', 'reports.view'] as $permission) {
            $this->assertContains($permission, $auditorPermissions);
        }
        foreach (['inventory.adjust', 'production.execute', 'quality.approve', 'procurement.approve', 'finance.approve', 'reports.export'] as $permission) {
            $this->assertNotContains($permission, $auditorPermissions);
        }
    }

    private function permissionListFor(User $user): array
    {
        return $user->roles()
            ->wherePivot('factory_id', $user->current_factory_id)
            ->with('permissions:id,slug')
            ->get()
            ->pluck('permissions')
            ->flatten()
            ->pluck('slug')
            ->unique()
            ->values()
            ->all();
    }
}
