<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\BillOfMaterial;
use App\Models\ProductionOrder;
use App\Models\ProductionStageExecution;
use App\Models\WorkflowTemplate;
use App\Services\ManufacturingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ManufacturingController extends Controller
{
    public function overview(): JsonResponse
    {
        return response()->json(['orders' => ProductionOrder::with('executions.stage')->latest()->paginate(20), 'boms' => BillOfMaterial::with('components.item')->latest()->get(), 'workflows' => WorkflowTemplate::with('stages')->latest()->get()]);
    }

    public function storeBom(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['item_id' => ['required', Rule::exists('items', 'id')->where('factory_id', $factoryId)], 'name' => ['required', 'string', 'max:160'], 'version' => ['required', 'string', 'max:40'], 'output_quantity' => ['required', 'numeric', 'gt:0'], 'expected_waste_percent' => ['nullable', 'numeric', 'between:0,100'], 'components' => ['required', 'array', 'min:1'], 'components.*.item_id' => ['required', Rule::exists('items', 'id')->where('factory_id', $factoryId)], 'components.*.unit_id' => ['required', Rule::exists('units', 'id')->where('factory_id', $factoryId)], 'components.*.quantity' => ['required', 'numeric', 'gt:0'], 'components.*.waste_percent' => ['nullable', 'numeric', 'between:0,100'], 'components.*.is_optional' => ['nullable', 'boolean']]);
        $bom = DB::transaction(function () use ($data) {
            $components = $data['components'];
            unset($data['components']);
            $bom = BillOfMaterial::create($data);
            $bom->components()->createMany($components);

            return $bom;
        });
        AuditLog::record('production.bom_created', "Created BOM {$bom->name}", $bom);

        return response()->json($bom->load('components.item'), 201);
    }

    public function storeWorkflow(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['name' => ['required', 'string', 'max:160'], 'code' => ['required', 'string', 'max:40', Rule::unique('workflow_templates')->where('factory_id', $factoryId)], 'description' => ['nullable', 'string'], 'stages' => ['required', 'array', 'min:1'], 'stages.*.name' => ['required', 'string', 'max:160'], 'stages.*.code' => ['required', 'string', 'max:40'], 'stages.*.sequence' => ['required', 'integer', 'min:1'], 'stages.*.expected_minutes' => ['nullable', 'integer', 'min:0'], 'stages.*.required_workers' => ['nullable', 'integer', 'min:1'], 'stages.*.quality_required' => ['nullable', 'boolean'], 'stages.*.approval_required' => ['nullable', 'boolean']]);
        $workflow = DB::transaction(function () use ($data) {
            $stages = $data['stages'];
            unset($data['stages']);
            $workflow = WorkflowTemplate::create($data + ['status' => 'active']);
            $workflow->stages()->createMany($stages);

            return $workflow;
        });
        AuditLog::record('production.workflow_created', "Created workflow {$workflow->name}", $workflow);

        return response()->json($workflow->load('stages'), 201);
    }

    public function storeOrder(Request $request, ManufacturingService $service): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['order_number' => ['required', 'string', 'max:60', Rule::unique('production_orders')->where('factory_id', $factoryId)], 'item_id' => ['required', Rule::exists('items', 'id')->where('factory_id', $factoryId)], 'bill_of_material_id' => ['required', Rule::exists('bills_of_materials', 'id')->where('factory_id', $factoryId)], 'workflow_template_id' => ['required', Rule::exists('workflow_templates', 'id')->where('factory_id', $factoryId)], 'warehouse_id' => ['nullable', Rule::exists('warehouses', 'id')->where('factory_id', $factoryId)], 'planned_quantity' => ['required', 'numeric', 'gt:0'], 'planned_start' => ['nullable', 'date'], 'planned_end' => ['nullable', 'date', 'after_or_equal:planned_start']]);
        $bom = BillOfMaterial::findOrFail($data['bill_of_material_id']);
        abort_unless($bom->item_id === (int) $data['item_id'], 422, 'The BOM does not produce the selected item.');
        $order = ProductionOrder::create($data + ['created_by' => $request->user()->id]);

        return response()->json(['order' => $order, 'material_requirements' => $service->requirements($bom, (float) $data['planned_quantity'])], 201);
    }

    public function approveOrder(ProductionOrder $order, ManufacturingService $service): JsonResponse
    {
        $result = $service->approve($order);
        AuditLog::record('production.order_approved', "Approved {$order->order_number}", $order);

        return response()->json($result);
    }

    public function updateStage(Request $request, ProductionStageExecution $execution, ManufacturingService $service): JsonResponse
    {
        abort_unless($execution->factory_id === $request->user()->current_factory_id, 404);
        $data = $request->validate(['status' => ['required', Rule::in(['ready', 'in_progress', 'blocked', 'completed', 'failed', 'rework'])], 'input_quantity' => ['nullable', 'numeric', 'min:0'], 'output_quantity' => ['nullable', 'numeric', 'min:0'], 'waste_quantity' => ['nullable', 'numeric', 'min:0'], 'rejected_quantity' => ['nullable', 'numeric', 'min:0'], 'downtime_minutes' => ['nullable', 'integer', 'min:0'], 'notes' => ['nullable', 'string', 'max:3000']]);

        return response()->json($service->updateStage($execution, $data));
    }
}
