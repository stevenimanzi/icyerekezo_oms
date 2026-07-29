<?php

namespace App\Services;

use App\Models\Department;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DepartmentDeduplicationService
{
    public function mergeForFactory(int $factoryId): int
    {
        return DB::transaction(function () use ($factoryId) {
            $departments = Department::withoutGlobalScopes()
                ->where('factory_id', $factoryId)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $merged = 0;

            foreach ($departments->groupBy(fn (Department $department) => Str::lower(trim($department->name))) as $name => $duplicates) {
                if ($name === '' || $duplicates->count() < 2) {
                    continue;
                }

                $canonical = $duplicates->sortByDesc(fn (Department $department) => ($department->manager_id ? 1000000 : 0) + $department->employees()->count())->first();
                $managerId = $duplicates->pluck('manager_id')->filter()->first();
                if (! $canonical->manager_id && $managerId) {
                    $canonical->update(['manager_id' => $managerId]);
                }

                foreach ($duplicates->where('id', '!=', $canonical->id) as $duplicate) {
                    DB::table('employee_profiles')->where('department_id', $duplicate->id)->update(['department_id' => $canonical->id]);
                    DB::table('workstations')->where('department_id', $duplicate->id)->update(['department_id' => $canonical->id]);
                    DB::table('workflow_stages')->where('department_id', $duplicate->id)->update(['department_id' => $canonical->id]);
                    DB::table('machines')->where('department_id', $duplicate->id)->update(['department_id' => $canonical->id]);
                    $duplicate->delete();
                    $merged++;
                }
            }

            return $merged;
        });
    }
}
