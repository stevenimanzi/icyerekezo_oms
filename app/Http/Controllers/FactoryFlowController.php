<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\WorkflowTemplate;
use App\Models\Workstation;
use App\Support\IndustryFlowCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FactoryFlowController extends Controller
{
    public function suggestion(Request $request): JsonResponse
    {
        return response()->json(['industry' => $request->user()->currentFactory->industry_type, 'suggestion' => IndustryFlowCatalog::for($request->user()->currentFactory->industry_type)]);
    }

    public function apply(Request $request): JsonResponse
    {
        $factory = $request->user()->currentFactory;
        $template = IndustryFlowCatalog::for($factory->industry_type);
        $workflow = DB::transaction(function () use ($factory, $template) {
            $workflow = WorkflowTemplate::updateOrCreate(['factory_id' => $factory->id, 'code' => 'INDUSTRY-DEFAULT'], ['name' => $template['name'], 'description' => 'Industry-based workflow. Factory managers can extend it.', 'status' => 'active', 'is_default' => true]);
            $stageIds = [];
            foreach ($template['departments'] as $index => $entry) {
                $department = Department::updateOrCreate(['factory_id' => $factory->id, 'code' => $entry['code']], ['name' => $entry['name'], 'is_active' => true]);
                $workstation = Workstation::updateOrCreate(['factory_id' => $factory->id, 'code' => $entry['code'].'-MAIN'], ['department_id' => $department->id, 'name' => $entry['name'].' Main Station', 'type' => $entry['workstation_type'], 'is_active' => true]);
                $stage = $workflow->stages()->updateOrCreate(['code' => Str::slug($entry['name'], '_')], ['department_id' => $department->id, 'workstation_id' => $workstation->id, 'name' => $entry['name'], 'sequence' => $index + 1, 'required_workers' => 1, 'quality_required' => str_contains(strtolower($entry['name']), 'quality'), 'approval_required' => str_contains(strtolower($entry['name']), 'quality')]);
                $stageIds[] = $stage->id;
            }
            $workflow->stages()->whereNotIn('id', $stageIds)->delete();

            return $workflow;
        });
        AuditLog::record('factory.flow_applied', 'Applied the recommended industry workflow', $workflow);

        return response()->json($workflow->load('stages'), 201);
    }
}
