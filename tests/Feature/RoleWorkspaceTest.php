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

        $this->assertDatabaseCount('roles', 12);
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
