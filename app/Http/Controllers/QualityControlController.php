<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\ProductionOrder;
use App\Models\ProductionStageExecution;
use App\Models\QualityInspection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class QualityControlController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $base = QualityInspection::where('factory_id', $factoryId);
        $completed = (clone $base)->whereIn('result', ['passed', 'failed', 'conditional'])->where('inspected_at', '>=', now()->startOfMonth());
        $inspected = (float) (clone $completed)->sum('inspected_quantity');
        $passed = (float) (clone $completed)->sum('passed_quantity');

        return response()->json([
            'metrics' => [
                'pending' => (clone $base)->where('result', 'pending')->count(),
                'passed' => (clone $completed)->where('result', 'passed')->count(),
                'failed' => (clone $completed)->where('result', 'failed')->count(),
                'pass_rate' => $inspected > 0 ? round($passed / $inspected * 100, 1) : 0,
                'rejected_quantity' => (float) (clone $completed)->sum('rejected_quantity'),
            ],
            'inspections' => $base->with(['order:id,order_number', 'item:id,name,sku', 'stageExecution.stage:id,name,code', 'inspector:id,name', 'approver:id,name'])->latest()->paginate(25),
            'orders' => ProductionOrder::whereIn('status', ['approved', 'in_progress', 'paused', 'completed'])->with(['item:id,name,sku', 'executions.stage:id,name,code,quality_required'])->latest()->limit(100)->get(),
            'items' => Item::where('is_active', true)->orderBy('name')->get(['id', 'name', 'sku', 'type']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'production_order_id' => ['nullable', Rule::exists('production_orders', 'id')->where('factory_id', $factoryId)],
            'stage_execution_id' => ['nullable', Rule::exists('production_stage_executions', 'id')->where('factory_id', $factoryId)],
            'item_id' => ['nullable', Rule::exists('items', 'id')->where('factory_id', $factoryId)],
            'inspection_type' => ['required', Rule::in(['incoming_material', 'in_process', 'finished_goods', 'random', 'customer_return'])],
            'sample_size' => ['nullable', 'numeric', 'min:0'], 'inspected_quantity' => ['required', 'numeric', 'gt:0'],
            'passed_quantity' => ['required', 'numeric', 'min:0'], 'rejected_quantity' => ['required', 'numeric', 'min:0'],
            'result' => ['required', Rule::in(['pending', 'passed', 'failed', 'conditional'])],
            'defect_details' => ['nullable', 'string', 'max:5000'], 'corrective_action' => ['nullable', 'string', 'max:5000'], 'notes' => ['nullable', 'string', 'max:5000'],
        ]);
        abort_if((float) $data['passed_quantity'] + (float) $data['rejected_quantity'] > (float) $data['inspected_quantity'], 422, 'Passed and rejected quantities cannot exceed inspected quantity.');
        if (! empty($data['stage_execution_id'])) {
            $execution = ProductionStageExecution::findOrFail($data['stage_execution_id']);
            abort_if(! empty($data['production_order_id']) && (int) $execution->production_order_id !== (int) $data['production_order_id'], 422, 'The selected stage does not belong to that production order.');
        }
        $inspection = DB::transaction(function () use ($data, $request) {
            $inspection = QualityInspection::create($data + [
                'inspection_number' => 'QI-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'inspector_id' => $request->user()->id,
                'inspected_at' => $data['result'] === 'pending' ? null : now(),
            ]);
            if ($data['result'] === 'failed' && $inspection->stage_execution_id) {
                $inspection->stageExecution()->update(['status' => 'rework', 'rejected_quantity' => $data['rejected_quantity']]);
            }
            return $inspection;
        });
        AuditLog::record('quality.inspection_created', "Recorded {$inspection->inspection_number}", $inspection);
        return response()->json($inspection->load(['order:id,order_number', 'item:id,name,sku', 'inspector:id,name']), 201);
    }

    public function approve(Request $request, QualityInspection $inspection): JsonResponse
    {
        abort_unless($inspection->factory_id === $request->user()->current_factory_id, 404);
        abort_if($inspection->result === 'pending', 422, 'Complete the inspection before approval.');
        abort_if($inspection->approved_at, 422, 'This inspection is already approved.');
        $inspection->update(['approved_by' => $request->user()->id, 'approved_at' => now()]);
        AuditLog::record('quality.inspection_approved', "Approved {$inspection->inspection_number}", $inspection);
        return response()->json($inspection->fresh()->load('approver:id,name'));
    }
}
