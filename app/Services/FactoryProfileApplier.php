<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Factory;
use App\Models\Unit;
use App\Models\WorkflowTemplate;
use App\Models\Workstation;
use App\Support\Catalogs\IndustryProfileCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FactoryProfileApplier
{
    public function apply(Factory $factory): WorkflowTemplate
    {
        $resolved = IndustryProfileCatalog::resolve($factory->profileKeys());

        return DB::transaction(function () use ($factory, $resolved) {
            app(DepartmentDeduplicationService::class)->mergeForFactory($factory->id);

            $this->ensureUnits($factory, $resolved['units']);
            $this->ensureCategories($factory, $resolved['categories']);
            $departments = $this->ensureDepartments($factory, $resolved['departments']);

            $primary = null;
            foreach ($resolved['profiles'] as $key => $profile) {
                $workflow = $this->syncWorkflow($factory, $key, $profile, $departments, $primary === null);
                $primary ??= $workflow;
            }

            return $primary;
        });
    }

    private function ensureUnits(Factory $factory, array $profileUnits): void
    {
        foreach ([...IndustryProfileCatalog::baseUnits(), ...$profileUnits] as [$name, $symbol, $dimension, $precision]) {
            Unit::withoutGlobalScopes()->firstOrCreate(
                ['factory_id' => $factory->id, 'symbol' => $symbol],
                ['name' => $name, 'dimension' => $dimension, 'precision' => $precision, 'is_active' => true],
            );
        }

        $unitIds = Unit::withoutGlobalScopes()->where('factory_id', $factory->id)->pluck('id', 'symbol');
        foreach (IndustryProfileCatalog::conversions() as [$from, $to, $multiplier]) {
            if (! isset($unitIds[$from], $unitIds[$to])) {
                continue;
            }
            $keys = ['factory_id' => $factory->id, 'from_unit_id' => $unitIds[$from], 'to_unit_id' => $unitIds[$to]];
            if (! DB::table('unit_conversions')->where($keys)->exists()) {
                DB::table('unit_conversions')->insert($keys + ['multiplier' => $multiplier, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    private function ensureCategories(Factory $factory, array $categories): void
    {
        foreach ($categories as [$code, $name]) {
            $exists = DB::table('item_categories')->where(['factory_id' => $factory->id, 'code' => $code])->exists();
            if (! $exists) {
                DB::table('item_categories')->insert(['factory_id' => $factory->id, 'parent_id' => null, 'name' => $name, 'code' => $code, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    private function ensureDepartments(Factory $factory, array $names): array
    {
        $existing = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->get();
        $byName = $existing->keyBy(fn (Department $department) => Str::lower(trim($department->name)));
        $usedCodes = $existing->pluck('code')->flip()->map(fn () => true)->all();

        $result = [];
        foreach ($names as $index => $name) {
            $department = $byName[Str::lower(trim($name))] ?? null;
            if ($department) {
                $department->update(['name' => $name, 'is_active' => true]);
            } else {
                $department = Department::withoutGlobalScopes()->create(['factory_id' => $factory->id, 'code' => $this->uniqueCode($name, $index + 1, $usedCodes), 'name' => $name, 'is_active' => true]);
            }

            $type = IndustryProfileCatalog::stationType($name);
            $workstation = Workstation::withoutGlobalScopes()->where('factory_id', $factory->id)
                ->where(fn ($query) => $query->where('code', $department->code.'-MAIN')->orWhere('name', $name.' Main Station'))
                ->first();
            if ($workstation) {
                $workstation->update(['department_id' => $department->id, 'name' => $name.' Main Station', 'type' => $type, 'is_active' => true]);
            } else {
                $workstation = Workstation::withoutGlobalScopes()->create(['factory_id' => $factory->id, 'code' => $department->code.'-MAIN', 'department_id' => $department->id, 'name' => $name.' Main Station', 'type' => $type, 'is_active' => true]);
            }

            $result[Str::lower(trim($name))] = ['department' => $department, 'workstation' => $workstation];
        }

        return $result;
    }

    private function syncWorkflow(Factory $factory, string $key, array $profile, array $departments, bool $isPrimary): WorkflowTemplate
    {
        $code = $isPrimary ? 'INDUSTRY-DEFAULT' : 'PROFILE-'.strtoupper(str_replace('_', '-', $key));
        $workflow = WorkflowTemplate::withoutGlobalScopes()->where(['factory_id' => $factory->id, 'code' => $code])->first()
            ?? new WorkflowTemplate(['factory_id' => $factory->id, 'code' => $code, 'is_default' => $isPrimary]);
        $workflow->fill([
            'name' => $isPrimary ? 'Recommended '.str_replace('_', ' ', $key).' workflow' : $profile['label'].' workflow',
            'description' => 'Industry-based workflow. Factory managers can extend it.',
            'status' => 'active',
        ]);
        if ($isPrimary) {
            $workflow->is_default = true;
        }
        $workflow->save();

        foreach ($workflow->stages()->lockForUpdate()->get()->values() as $index => $stage) {
            $stage->update(['sequence' => 65000 - $index]);
        }

        $stageIds = [];
        foreach ($profile['departments'] as $index => $name) {
            $entry = $departments[Str::lower(trim($name))];
            $isQuality = str_contains(strtolower($name), 'quality');
            $stage = $workflow->stages()->updateOrCreate(
                ['code' => Str::slug($name, '_')],
                ['department_id' => $entry['department']->id, 'workstation_id' => $entry['workstation']->id, 'name' => $name, 'sequence' => $index + 1, 'required_workers' => 1, 'quality_required' => $isQuality, 'approval_required' => $isQuality],
            );
            $stageIds[] = $stage->id;
        }

        $nextSequence = count($stageIds) + 1;
        foreach ($workflow->stages()->whereNotIn('id', $stageIds)->get() as $obsolete) {
            if (DB::table('production_stage_executions')->where('workflow_stage_id', $obsolete->id)->exists()) {
                $obsolete->update(['sequence' => $nextSequence++]);
            } else {
                $obsolete->delete();
            }
        }

        return $workflow;
    }

    private function uniqueCode(string $name, int $position, array &$usedCodes): string
    {
        $base = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 8));
        do {
            $code = $base.str_pad((string) $position, 2, '0', STR_PAD_LEFT);
            $position++;
        } while (isset($usedCodes[$code]));
        $usedCodes[$code] = true;

        return $code;
    }
}
