<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\EmployeeProfile;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkAssignment;
use App\Models\Workstation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class TeamWorkspaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $memberships = DB::table('factory_user')->where('factory_id', $factoryId);
        $totalUsers = (clone $memberships)->count();
        $activeUsers = (clone $memberships)->where('is_active', true)->count();
        $assignedUsers = EmployeeProfile::where('factory_id', $factoryId)->whereNotNull('department_id')->count();
        Department::firstOrCreate(
            ['factory_id' => $factoryId, 'code' => 'PRODUCTION'],
            ['name' => 'Production', 'is_active' => true],
        );
        $roles = Role::where('factory_id', $factoryId);
        $isManagerOnly = $request->user()->roles()->wherePivot('factory_id', $factoryId)->where('slug', 'factory-manager')->exists()
            && ! $request->user()->roles()->wherePivot('factory_id', $factoryId)->whereIn('slug', ['factory-owner', 'factory-administrator'])->exists();
        if ($isManagerOnly) {
            $roles->whereNotIn('slug', ['factory-owner', 'factory-administrator', 'factory-manager']);
        }

        return response()->json([
            'statistics' => [
                'total_users' => $totalUsers,
                'active_users' => $activeUsers,
                'assigned_users' => $assignedUsers,
                'unassigned_users' => max(0, $totalUsers - $assignedUsers),
            ],
            'users' => User::whereHas('factories', fn ($q) => $q->where('factories.id', $factoryId))->with(['factories' => fn ($q) => $q->where('factories.id', $factoryId), 'roles' => fn ($q) => $q->wherePivot('factory_id', $factoryId), 'employeeProfile.department', 'employeeProfile.workstation'])->paginate(25),
            'roles' => $roles->with('permissions:id,name,slug,module')->get(['id', 'name', 'slug', 'dashboard_key', 'is_system']),
            'permissions' => Permission::orderBy('module')->orderBy('name')->get(['id', 'name', 'slug', 'module']),
            'departments' => Department::where('is_active', true)->with('manager:id,name,email')->withCount('employees')->orderBy('name')->get(),
            'workstations' => Workstation::where('is_active', true)->get(),
        ]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'], 'email' => ['required', 'email:rfc', 'max:190'],
            'password' => ['required', 'confirmed', Password::min(10)->mixedCase()->numbers()->symbols()],
            'role_id' => ['required', Rule::exists('roles', 'id')->where('factory_id', $factoryId)],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)],
            'workstation_id' => ['nullable', Rule::exists('workstations', 'id')->where('factory_id', $factoryId)],
            'employee_number' => ['nullable', 'string', 'max:50', Rule::unique('employee_profiles')->where('factory_id', $factoryId)],
            'job_title' => ['nullable', 'string', 'max:120'],
        ]);
        if (empty($data['employee_number'])) {
            do {
                $data['employee_number'] = 'EMP-'.Str::upper(Str::random(8));
            } while (EmployeeProfile::where('factory_id', $factoryId)->where('employee_number', $data['employee_number'])->exists());
        }
        $role = Role::where('factory_id', $factoryId)->with('permissions:id,slug')->findOrFail($data['role_id']);
        $this->assertCanGrantRole($request->user(), $role);
        $user = DB::transaction(function () use ($data, $factoryId) {
            $user = User::firstOrCreate(['email' => strtolower($data['email'])], ['name' => $data['name'], 'password' => $data['password'], 'locale' => 'en']);
            $user->factories()->syncWithoutDetaching([$factoryId => ['is_active' => true, 'is_owner' => false, 'joined_at' => now(), 'job_title' => $data['job_title'] ?? null]]);
            $user->roles()->syncWithoutDetaching([$data['role_id'] => ['factory_id' => $factoryId]]);
            EmployeeProfile::updateOrCreate(['factory_id' => $factoryId, 'user_id' => $user->id], ['department_id' => $data['department_id'] ?? null, 'workstation_id' => $data['workstation_id'] ?? null, 'employee_number' => $data['employee_number'], 'job_title' => $data['job_title'] ?? null, 'employment_status' => 'active', 'hired_at' => now()]);
            if (! $user->current_factory_id) {
                $user->update(['current_factory_id' => $factoryId]);
            }

            return $user;
        });
        AuditLog::record('team.user_created', "Created workspace account for {$user->name}", $user);

        return response()->json($user->load('employeeProfile.department', 'employeeProfile.workstation'), 201);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'dashboard_key' => ['required', Rule::in(['executive', 'production', 'warehouse', 'procurement', 'quality', 'cutting', 'workstation', 'logistics', 'sales', 'finance'])],
            'description' => ['nullable', 'string', 'max:1000'],
            'permission_ids' => ['required', 'array', 'min:1'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);
        $permissions = Permission::whereIn('id', $data['permission_ids'])->get();
        $this->assertCanGrantPermissions($request->user(), $permissions->pluck('slug')->all());
        $role = DB::transaction(function () use ($data, $permissions, $factoryId) {
            $base = Str::slug($data['name']) ?: 'custom-role';
            $slug = $base;
            $counter = 2;
            while (Role::where('factory_id', $factoryId)->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$counter++;
            }
            $role = Role::create(['factory_id' => $factoryId, 'name' => $data['name'], 'slug' => $slug, 'dashboard_key' => $data['dashboard_key'], 'description' => $data['description'] ?? null, 'is_system' => false]);
            $role->permissions()->sync($permissions->pluck('id'));

            return $role;
        });
        AuditLog::record('team.role_created', "Created custom role {$role->name}", $role);

        return response()->json($role->load('permissions:id,name,slug,module'), 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $membership = $user->factories()->where('factories.id', $factoryId)->firstOrFail()->pivot;
        abort_if($membership->is_owner, 422, 'The factory owner account cannot be changed here.');
        $data = $request->validate([
            'role_id' => ['nullable', Rule::exists('roles', 'id')->where('factory_id', $factoryId)],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)],
            'workstation_id' => ['nullable', Rule::exists('workstations', 'id')->where('factory_id', $factoryId)],
            'job_title' => ['nullable', 'string', 'max:120'], 'is_active' => ['nullable', 'boolean'],
        ]);
        if (! empty($data['role_id'])) {
            $role = Role::where('factory_id', $factoryId)->with('permissions:id,slug')->findOrFail($data['role_id']);
            $this->assertCanGrantRole($request->user(), $role);
            $user->roles()->wherePivot('factory_id', $factoryId)->detach();
            $user->roles()->attach($role->id, ['factory_id' => $factoryId]);
        }
        $profileData = collect($data)->only(['department_id', 'workstation_id', 'job_title'])->all();
        if ($profileData) {
            EmployeeProfile::where(['factory_id' => $factoryId, 'user_id' => $user->id])->update($profileData);
        }
        if (array_key_exists('is_active', $data)) {
            $user->factories()->updateExistingPivot($factoryId, ['is_active' => $data['is_active']]);
        }
        AuditLog::record('team.user_updated', "Updated workspace access for {$user->name}", $user);

        return response()->json(['message' => 'User access updated.']);
    }

    public function storeWorkstation(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'code' => ['required', 'string', 'max:40', Rule::unique('workstations')->where('factory_id', $factoryId)], 'type' => ['required', Rule::in(['cutting', 'sewing', 'mixing', 'processing', 'bottling', 'packaging', 'quality', 'warehouse', 'dispatch', 'machine', 'other'])], 'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)], 'description' => ['nullable', 'string', 'max:1000']]);

        return response()->json(Workstation::create($data), 201);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'code' => ['required', 'string', 'max:40', Rule::unique('departments')->where('factory_id', $factoryId)]]);
        $department = Department::create($data + ['factory_id' => $factoryId, 'is_active' => true]);
        AuditLog::record('team.department_created', "Created department {$department->name}", $department);

        return response()->json($department, 201);
    }

    public function updateDepartment(Request $request, Department $department): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        abort_unless($department->factory_id === $factoryId, 404);
        $data = $request->validate([
            'manager_id' => ['nullable', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)->where('is_active', true)],
        ]);

        DB::transaction(function () use ($department, $data, $factoryId) {
            $department->update(['manager_id' => $data['manager_id'] ?? null]);
            if (! empty($data['manager_id'])) {
                EmployeeProfile::where(['factory_id' => $factoryId, 'user_id' => $data['manager_id']])->update([
                    'department_id' => $department->id,
                ]);
            }
        });
        AuditLog::record('team.department_manager_updated', "Updated manager for {$department->name}", $department);

        return response()->json($department->fresh()->load('manager:id,name,email')->loadCount('employees'));
    }

    public function assign(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['user_id' => ['required', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)], 'workstation_id' => ['nullable', Rule::exists('workstations', 'id')->where('factory_id', $factoryId)], 'assignment_type' => ['required', 'string', 'max:60'], 'title' => ['required', 'string', 'max:180'], 'instructions' => ['nullable', 'string', 'max:2000'], 'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])], 'starts_at' => ['nullable', 'date'], 'due_at' => ['nullable', 'date', 'after_or_equal:starts_at']]);
        $assignment = WorkAssignment::create($data + ['assigned_by' => $request->user()->id]);
        AuditLog::record('work.assigned', "Assigned {$assignment->title}", $assignment);

        return response()->json($assignment, 201);
    }

    public function updateAssignment(Request $request, WorkAssignment $assignment): JsonResponse
    {
        abort_unless($assignment->factory_id === $request->user()->current_factory_id, 404);
        $managesAssigneeDepartment = Department::where('factory_id', $request->user()->current_factory_id)
            ->where('manager_id', $request->user()->id)
            ->whereHas('employees', fn ($query) => $query->where('user_id', $assignment->user_id))
            ->exists();
        abort_unless($assignment->user_id === $request->user()->id || $request->user()->hasPermission('users.update') || $managesAssigneeDepartment, 403, 'You cannot update this assignment.');
        $data = $request->validate(['status' => ['required', Rule::in(['assigned', 'ready', 'in_progress', 'blocked', 'completed', 'cancelled'])]]);
        $assignment->update($data + ['completed_at' => $data['status'] === 'completed' ? now() : null]);
        AuditLog::record('work.status_changed', "Assignment changed to {$assignment->status}", $assignment);

        return response()->json($assignment);
    }

    private function assertCanGrantRole(User $actor, Role $role): void
    {
        $isFactoryManager = $actor->roles()->wherePivot('factory_id', $actor->current_factory_id)->where('slug', 'factory-manager')->exists();
        if ($isFactoryManager && ! in_array($role->slug, ['factory-owner', 'factory-administrator', 'factory-manager'], true)) {
            return;
        }
        $this->assertCanGrantPermissions($actor, $role->permissions->pluck('slug')->all());
    }

    private function assertCanGrantPermissions(User $actor, array $permissions): void
    {
        $isFactoryAdministrator = $actor->roles()->wherePivot('factory_id', $actor->current_factory_id)->whereIn('slug', ['factory-owner', 'factory-administrator'])->exists();
        if ($actor->is_platform_admin || $isFactoryAdministrator) {
            return;
        }
        $unauthorized = collect($permissions)->reject(fn ($permission) => $actor->hasPermission($permission));
        if ($unauthorized->isNotEmpty()) {
            throw ValidationException::withMessages(['permissions' => 'You cannot grant access that you do not have.']);
        }
    }
}
