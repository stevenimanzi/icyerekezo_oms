<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\BillOfMaterial;
use App\Models\ProductionOrder;
use App\Models\ProductionStageExecution;
use App\Models\Warehouse;
use App\Models\WorkflowTemplate;
use App\Services\ManufacturingService;
use App\Support\OperationalScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ManufacturingController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $scope = OperationalScope::for($request->user());
        $executions = $scope->scopeExecutions(ProductionStageExecution::query());
        $orders = $scope->isFactoryWide()
            ? ProductionOrder::query()
            : ProductionOrder::whereHas('executions', fn ($query) => $scope->scopeExecutions($query));

        return response()->json([
            'summary' => [
                'total_orders' => (clone $orders)->count(),
                'needs_approval' => (clone $orders)->where('status', 'draft')->count(),
                'active_orders' => (clone $orders)->whereIn('status', ['approved', 'in_progress', 'paused'])->count(),
                'completed_orders' => (clone $orders)->where('status', 'completed')->count(),
                'past_due' => (clone $orders)->whereNotIn('status', ['completed', 'cancelled'])->whereDate('planned_end', '<', today())->count(),
                'planned_quantity' => (float) (clone $orders)->sum('planned_quantity'),
                'completed_quantity' => (float) (clone $orders)->sum('completed_quantity'),
                'stage_output_quantity' => (float) (clone $executions)->sum('output_quantity'),
                'rejected_quantity' => (float) (clone $executions)->sum('rejected_quantity'),
                'waste_quantity' => (float) (clone $executions)->sum('waste_quantity'),
                'downtime_minutes' => (int) (clone $executions)->sum('downtime_minutes'),
                'completed_stages' => (clone $executions)->where('status', 'completed')->count(),
                'total_stages' => (clone $executions)->count(),
            ],
            'orders' => (clone $orders)->with(['item:id,name,sku', 'warehouse:id,name', 'executions' => fn ($query) => $scope->scopeExecutions($query), 'executions.stage'])->latest()->paginate(20),
            'boms' => BillOfMaterial::with(['item:id,name,sku', 'components.item'])->latest()->get(),
            'workflows' => WorkflowTemplate::with('stages')->latest()->get(),
            'warehouses' => Warehouse::whereIn('id', $scope->warehouseIds())->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
        ]);
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
        $request->merge(['stages' => $this->normalizeWorkflowStages($request->input('stages', []))]);
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

    public function updateWorkflow(Request $request, WorkflowTemplate $workflow): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        abort_unless($workflow->factory_id === $factoryId, 404);
        $request->merge(['stages' => $this->normalizeWorkflowStages($request->input('stages', []))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'code' => ['required', 'string', 'max:40', Rule::unique('workflow_templates')->where('factory_id', $factoryId)->ignore($workflow->id)],
            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'stages' => ['required', 'array', 'min:1'],
            'stages.*.name' => ['required', 'string', 'max:160'],
            'stages.*.code' => ['required', 'string', 'max:40'],
            'stages.*.expected_minutes' => ['nullable', 'integer', 'min:0'],
            'stages.*.required_workers' => ['nullable', 'integer', 'min:1'],
            'stages.*.quality_required' => ['required', 'boolean'],
            'stages.*.approval_required' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($workflow, $data) {
            $stages = $data['stages'];
            unset($data['stages']);
            $workflow->update($data);
            $workflow->stages()->delete();
            $workflow->stages()->createMany(collect($stages)->values()->map(fn ($stage, $index) => $stage + ['sequence' => $index + 1])->all());
        });
        AuditLog::record('production.workflow_updated', "Updated workflow {$workflow->name}", $workflow);

        return response()->json($workflow->fresh()->load('stages'));
    }

    private function normalizeWorkflowStages(array $stages): array
    {
        return collect($stages)->values()->map(function (array $stage, int $index) {
            $name = trim((string) ($stage['name'] ?? ''));

            return [
                ...$stage,
                'code' => Str::upper(Str::limit(Str::slug($name, '-'), 40, '')),
                'sequence' => $index + 1,
                'expected_minutes' => 0,
            ];
        })->all();
    }

    public function storeOrder(Request $request, ManufacturingService $service): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate(['order_number' => ['required', 'string', 'max:60', Rule::unique('production_orders')->where('factory_id', $factoryId)], 'item_id' => ['required', Rule::exists('items', 'id')->where('factory_id', $factoryId)], 'bill_of_material_id' => ['required', Rule::exists('bills_of_materials', 'id')->where('factory_id', $factoryId)], 'workflow_template_id' => ['required', Rule::exists('workflow_templates', 'id')->where('factory_id', $factoryId)], 'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('factory_id', $factoryId)], 'planned_quantity' => ['required', 'numeric', 'gt:0'], 'planned_start' => ['nullable', 'date'], 'planned_end' => ['nullable', 'date', 'after_or_equal:planned_start']]);
        $bom = BillOfMaterial::findOrFail($data['bill_of_material_id']);
        abort_unless($bom->item_id === (int) $data['item_id'], 422, 'The BOM does not produce the selected item.');
        $order = ProductionOrder::create($data + ['created_by' => $request->user()->id]);
        \App\Support\FactoryNotifier::notify(
            $factoryId, 'production.approve',
            'New production order needs approval',
            "{$order->order_number} for {$data['planned_quantity']} units was created by {$request->user()->name} and is waiting for approval.",
            '/executive/production', 'production', $request->user()->id
        );

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
        abort_unless(OperationalScope::for($request->user())->allowsExecution($execution), 403, 'This production stage is outside your assigned department or workstation.');
        $data = $request->validate(['status' => ['required', Rule::in(['ready', 'in_progress', 'blocked', 'completed', 'failed', 'rework'])], 'input_quantity' => ['nullable', 'numeric', 'min:0'], 'output_quantity' => ['nullable', 'numeric', 'min:0'], 'waste_quantity' => ['nullable', 'numeric', 'min:0'], 'rejected_quantity' => ['nullable', 'numeric', 'min:0'], 'downtime_minutes' => ['nullable', 'integer', 'min:0'], 'notes' => ['nullable', 'string', 'max:3000']]);

        return response()->json($service->updateStage($execution, $data));
    }
}
