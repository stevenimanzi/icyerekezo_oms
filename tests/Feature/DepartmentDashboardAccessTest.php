<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentDashboardAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_manager_has_department_operations_but_cannot_edit_factory_workflow(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'owner@department.test',
            'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Department Factory', 'industry_type' => 'steel_metals',
        ])->assertCreated();

        $this->postJson('/api/factory/flow-suggestion/apply')->assertCreated();
        $production = Department::where('name', 'Production')->firstOrFail();
        $role = Role::where('slug', 'production-manager')->firstOrFail();
        $created = $this->postJson('/api/team/users', [
            'name' => 'Production Manager', 'email' => 'production@department.test',
            'password' => 'Production@12345', 'password_confirmation' => 'Production@12345',
            'role_id' => $role->id, 'department_id' => $production->id,
        ])->assertCreated()->json();

        $manager = User::findOrFail($created['id']);
        $this->actingAs($manager)
            ->getJson('/api/department/dashboard')
            ->assertOk()
            ->assertJsonPath('department.id', $production->id)
            ->assertJsonPath('department.name', 'Production')
            ->assertJsonStructure(['metrics' => ['assigned_work', 'work_in_progress', 'completed_today', 'stages_in_progress', 'output_today', 'rejected_today'], 'assignments', 'stage_activity']);

        $this->postJson('/api/manufacturing/workflows', [
            'name' => 'Forbidden change', 'code' => 'FORBIDDEN',
            'stages' => [['name' => 'Production', 'code' => 'PROD', 'sequence' => 1]],
        ])->assertForbidden();

        $this->getJson('/api/manufacturing/overview')->assertOk();
    }
}
