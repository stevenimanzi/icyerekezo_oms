<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\EmployeeProfile;
use App\Models\ProductionStageExecution;
use App\Models\WorkAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $factoryId = $user->current_factory_id;
        $profile = EmployeeProfile::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->where('user_id', $user->id)
            ->with(['department.manager:id,name,email', 'workstation:id,name,code,type'])
            ->first();
        $department = $profile?->department;
        $isManager = $department && (int) $department->manager_id === (int) $user->id;

        $employeeIds = $department
            ? EmployeeProfile::withoutGlobalScopes()->where('factory_id', $factoryId)->where('department_id', $department->id)->pluck('user_id')
            : collect([$user->id]);
        $assignmentUserIds = $isManager ? $employeeIds : collect([$user->id]);
        $assignments = WorkAssignment::withoutGlobalScopes()
            ->where('factory_id', $factoryId)
            ->whereIn('user_id', $assignmentUserIds)
            ->with('user:id,name')
            ->latest('updated_at');

        $stageExecutions = ProductionStageExecution::withoutGlobalScopes()
            ->where('production_stage_executions.factory_id', $factoryId)
            ->when($department, fn ($query) => $query->whereHas('stage', fn ($stage) => $stage->where('department_id', $department->id)))
            ->when(! $department, fn ($query) => $query->where('assigned_user_id', $user->id));

        return response()->json([
            'department' => $department ? [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
                'manager' => $department->manager,
                'employees_count' => $employeeIds->count(),
            ] : null,
            'profile' => $profile ? [
                'employee_number' => $profile->employee_number,
                'job_title' => $profile->job_title,
                'workstation' => $profile->workstation,
            ] : null,
            'is_department_manager' => (bool) $isManager,
            'metrics' => [
                'assigned_work' => (clone $assignments)->whereIn('status', ['assigned', 'ready'])->count(),
                'work_in_progress' => (clone $assignments)->where('status', 'in_progress')->count(),
                'completed_today' => (clone $assignments)->where('status', 'completed')->whereDate('completed_at', today())->count(),
                'stages_in_progress' => (clone $stageExecutions)->where('status', 'in_progress')->count(),
                'output_today' => (float) (clone $stageExecutions)->whereDate('updated_at', today())->sum('output_quantity'),
                'rejected_today' => (float) (clone $stageExecutions)->whereDate('updated_at', today())->sum('rejected_quantity'),
            ],
            'assignments' => $assignments->limit(20)->get(['id', 'user_id', 'title', 'instructions', 'priority', 'status', 'starts_at', 'due_at', 'updated_at']),
            'stage_activity' => $stageExecutions->with(['stage:id,name,code,sequence', 'order:id,order_number,item_id'])->latest('updated_at')->limit(15)->get(['id', 'production_order_id', 'workflow_stage_id', 'assigned_user_id', 'status', 'input_quantity', 'output_quantity', 'waste_quantity', 'rejected_quantity', 'started_at', 'completed_at', 'updated_at']),
        ]);
    }
}
