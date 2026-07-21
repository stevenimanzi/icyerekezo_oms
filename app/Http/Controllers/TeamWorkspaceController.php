<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\EmployeeProfile;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkAssignment;
use App\Models\Workstation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class TeamWorkspaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;

        return response()->json([
            'users' => User::whereHas('factories', fn ($q) => $q->where('factories.id', $factoryId))->with(['roles' => fn ($q) => $q->wherePivot('factory_id', $factoryId), 'employeeProfile.department', 'employeeProfile.workstation'])->paginate(25),
            'roles' => Role::where('factory_id', $factoryId)->get(['id', 'name', 'slug', 'dashboard_key']),
            'departments' => Department::where('is_active', true)->get(),
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
            'employee_number' => ['required', 'string', 'max:50', Rule::unique('employee_profiles')->where('factory_id', $factoryId)],
            'job_title' => ['nullable', 'string', 'max:120'],
        ]);
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

    public function storeWorkstation(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'code' => ['required', 'string', 'max:40', Rule::unique('workstations')->where('factory_id', $factoryId)], 'type' => ['required', Rule::in(['cutting', 'sewing', 'mixing', 'processing', 'bottling', 'packaging', 'quality', 'warehouse', 'dispatch', 'machine', 'other'])], 'department_id' => ['nullable', Rule::exists('departments', 'id')->where('factory_id', $factoryId)], 'description' => ['nullable', 'string', 'max:1000']]);

        return response()->json(Workstation::create($data), 201);
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
        abort_unless($assignment->user_id === $request->user()->id || $request->user()->hasPermission('users.update'), 403, 'You cannot update this assignment.');
        $data = $request->validate(['status' => ['required', Rule::in(['assigned', 'ready', 'in_progress', 'blocked', 'completed', 'cancelled'])]]);
        $assignment->update($data + ['completed_at' => $data['status'] === 'completed' ? now() : null]);
        AuditLog::record('work.status_changed', "Assignment changed to {$assignment->status}", $assignment);

        return response()->json($assignment);
    }
}
