<?php

namespace App\Http\Controllers\Production;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Inventory\InventoryController;
use App\Models\AuditLog;
use App\Models\Item;
use App\Models\ProductionLot;
use App\Models\ProductionOrder;
use App\Models\ProductionStageExecution;
use App\Models\QualityInspection;
use App\Services\ProductionFlow\FlowAccess;
use App\Services\ProductionFlow\FlowQueries;
use App\Support\Notifications\FactoryNotifier;
use App\Support\Tenancy\OperationalScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class QualityControlController extends Controller
{
    public function dashboard(Request $request, FlowQueries $queries): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $factory = $request->user()->currentFactory;
        $hasFlow = $factory && in_array('garment_flow', $factory->feature_flags ?? []);

        $base = QualityInspection::where('factory_id', $factoryId);
        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        $completedThisMonth = (clone $base)
            ->where(function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('inspected_at', [$monthStart, $monthEnd])
                  ->orWhere(function ($sub) use ($monthStart, $monthEnd) {
                      $sub->whereNull('inspected_at')->whereBetween('created_at', [$monthStart, $monthEnd]);
                  });
            });

        $inspectedMonth = (float) (clone $completedThisMonth)->sum('inspected_quantity');
        $passedMonth = (float) (clone $completedThisMonth)->sum('passed_quantity');
        $rejectedMonth = (float) (clone $completedThisMonth)->sum('rejected_quantity');
        $overallInspected = (float) (clone $base)->sum('inspected_quantity');
        $overallPassed = (float) (clone $base)->sum('passed_quantity');

        $passRate = $overallInspected > 0
            ? round(($overallPassed / $overallInspected) * 100, 1)
            : ($inspectedMonth > 0 ? round(($passedMonth / $inspectedMonth) * 100, 1) : 100.0);

        // 14-day Quality Inspection Trend from real database records
        $trend = collect(range(13, 0))->map(function ($daysAgo) use ($factoryId) {
            $day = today()->subDays($daysAgo);
            $dayInspections = QualityInspection::where('factory_id', $factoryId)
                ->where(function ($q) use ($day) {
                    $q->whereDate('inspected_at', $day)
                      ->orWhere(function ($sub) use ($day) {
                          $sub->whereNull('inspected_at')->whereDate('created_at', $day);
                      });
                });

            return [
                'date' => $day->format('M j'),
                'inspected' => (float) (clone $dayInspections)->sum('inspected_quantity'),
                'passed' => (float) (clone $dayInspections)->sum('passed_quantity'),
                'rejected' => (float) (clone $dayInspections)->sum('rejected_quantity'),
            ];
        })->values();

        // Query real inspection statistics grouped by stage from database
        $stageInspectionStats = QualityInspection::where('factory_id', $factoryId)
            ->whereNotNull('stage')
            ->selectRaw('LOWER(stage) as stage, SUM(inspected_quantity) as inspected, SUM(passed_quantity) as passed, SUM(rejected_quantity) as rejected')
            ->groupBy(DB::raw('LOWER(stage)'))
            ->get()
            ->keyBy('stage');

        $stages = [];
        $pendingQueue = [];
        $lots = [];
        $totalAwaitingQc = 0;

        if ($hasFlow) {
            $monitor = $queries->monitor(['status' => 'open']);
            $lots = $monitor['lots'] ?? [];

            foreach ($monitor['flow'] ?? [] as $stg) {
                $key = strtolower($stg['key']);
                $awaiting = (int) ($stg['awaiting_quality'] ?? 0);
                $totalAwaitingQc += $awaiting;

                // REAL quality control metrics from database
                $stats = $stageInspectionStats->get($key);
                $passed = (float) ($stats->passed ?? 0);
                $rejected = (float) ($stats->rejected ?? 0);
                $inspected = (float) ($stats->inspected ?? 0);
                $decided = $passed + $rejected;

                // If inspections were conducted, compute exact pass and defect rates from DB
                // If 0 inspections yet, pass rate is 100% baseline and defect rate is 0%
                $rate = $decided > 0 ? round(($passed / $decided) * 100, 1) : 100.0;
                $defectRate = $decided > 0 ? round(($rejected / $decided) * 100, 1) : 0.0;

                $stages[] = [
                    'key' => $key,
                    'name' => ucfirst($key),
                    'awaiting_qc' => $awaiting,
                    'inspected_qc' => $inspected,
                    'passed_qc' => $passed,
                    'rejected_qc' => $rejected,
                    'defect_rate' => $defectRate,
                    'pass_rate' => $rate,
                    'status' => $awaiting > 0 ? 'attention' : ($rejected > 0 ? 'conditional' : 'optimal'),
                ];
            }

            foreach ($lots as $lot) {
                foreach (['cutting', 'sewing', 'finishing', 'packing'] as $stgKey) {
                    $waiting = (int) ($lot['stages'][$stgKey]['awaiting_quality'] ?? 0);
                    if ($waiting > 0) {
                        $pendingQueue[] = [
                            'lot_id' => $lot['id'],
                            'lot_number' => $lot['lot_number'],
                            'product' => $lot['product'] ?? 'Garment Unit',
                            'stage' => $stgKey,
                            'stage_label' => ucfirst($stgKey),
                            'quantity_waiting' => $waiting,
                            'age_days' => $lot['age_days'] ?? 0,
                            'idle_days' => $lot['idle_days'] ?? 0,
                            'status' => $lot['status'] ?? 'open',
                        ];
                    }
                }
            }
        } else {
            $warehouseIds = OperationalScope::for($request->user())->warehouseIds();
            $packedPending = InventoryController::batchesAtStage($warehouseIds, 'packed', 'pending');
            $totalAwaitingQc = count($packedPending);
            foreach ($packedPending as $batch) {
                $pendingQueue[] = [
                    'lot_id' => $batch['id'],
                    'lot_number' => 'BATCH-' . $batch['id'],
                    'product' => $batch['name'],
                    'stage' => 'packed',
                    'stage_label' => 'Packing (Final)',
                    'quantity_waiting' => (int) $batch['available_qty'],
                    'age_days' => 0,
                    'idle_days' => 0,
                    'status' => 'pending',
                ];
            }
        }

        $recentInspections = QualityInspection::where('factory_id', $factoryId)
            ->with([
                'order:id,order_number',
                'item:id,name,sku',
                'lot:id,lot_number',
                'inspector:id,name',
            ])
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(fn (QualityInspection $i) => [
                'id' => $i->id,
                'inspection_number' => $i->inspection_number ?? ('QI-' . $i->id),
                'target' => $i->lot?->lot_number ?? ($i->order?->order_number ?? ($i->item?->name ?? 'Standard Item')),
                'stage' => $i->stage ? ucfirst($i->stage) : ucfirst($i->inspection_type ?: 'General Inspection'),
                'inspected_quantity' => (float) $i->inspected_quantity,
                'passed_quantity' => (float) $i->passed_quantity,
                'rejected_quantity' => (float) $i->rejected_quantity,
                'defect_details' => $i->defect_details ?: $i->notes,
                'result' => $i->result,
                'inspector' => $i->inspector?->name ?? 'Quality Officer',
                'date' => $i->inspected_at?->toIso8601String() ?? $i->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'metrics' => [
                'pass_rate' => $passRate,
                'total_awaiting_qc' => $totalAwaitingQc,
                'inspected_month' => $inspectedMonth,
                'passed_month' => $passedMonth,
                'rejected_month' => $rejectedMonth,
                'inspections_count' => (clone $base)->count(),
                'held_lots' => ProductionLot::where('factory_id', $factoryId)->whereNotNull('held_at')->count(),
            ],
            'stages' => $stages,
            'trend' => $trend,
            'pending_queue' => $pendingQueue,
            'recent_inspections' => $recentInspections,
            'lots' => $lots,
            'capabilities' => [
                'inspect' => FlowAccess::for($request->user())->canInspect(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $base = QualityInspection::where('factory_id', $factoryId);
        $completed = (clone $base)
            ->whereIn('result', ['passed', 'failed', 'conditional'])
            ->where('inspected_at', '>=', now()->startOfMonth());
        $inspected = (float) (clone $completed)->sum('inspected_quantity');
        $passed = (float) (clone $completed)->sum('passed_quantity');
        $warehouseIds = OperationalScope::for($request->user())->warehouseIds();

        return response()->json([
            'metrics' => [
                'pending' => (clone $base)->where('result', 'pending')->count(),
                'passed' => (clone $completed)->where('result', 'passed')->count(),
                'failed' => (clone $completed)->where('result', 'failed')->count(),
                'pass_rate' => $inspected > 0 ? round(($passed / $inspected) * 100, 1) : 0,
                'rejected_quantity' => (float) (clone $completed)->sum('rejected_quantity'),
            ],
            'inspections' => $base
                ->with([
                    'order:id,order_number',
                    'item:id,name,sku',
                    'stageExecution.stage:id,name,code',
                    'batch:id,batch_number,item_id',
                    'inspector:id,name',
                    'approver:id,name',
                ])
                ->latest()
                ->paginate(25),
            'orders' => ProductionOrder::whereIn('status', ['approved', 'in_progress', 'paused', 'completed'])
                ->with(['item:id,name,sku', 'executions.stage:id,name,code,quality_required'])
                ->latest()
                ->limit(100)
                ->get(),
            'packed_batches' => InventoryController::batchesAtStage($warehouseIds, 'packed', 'pending'),
            'items' => Item::where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'sku', 'type']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'production_order_id' => [
                'nullable',
                Rule::exists('production_orders', 'id')->where('factory_id', $factoryId),
            ],
            'stage_execution_id' => [
                'nullable',
                Rule::exists('production_stage_executions', 'id')->where('factory_id', $factoryId),
            ],
            'batch_id' => ['nullable', Rule::exists('batches', 'id')->where('factory_id', $factoryId)],
            'item_id' => ['nullable', Rule::exists('items', 'id')->where('factory_id', $factoryId)],
            'inspection_type' => [
                'required',
                Rule::in(['incoming_material', 'in_process', 'finished_goods', 'random', 'customer_return']),
            ],
            'sample_size' => ['nullable', 'numeric', 'min:0'],
            'inspected_quantity' => ['required', 'numeric', 'gt:0'],
            'passed_quantity' => ['required', 'numeric', 'min:0'],
            'rejected_quantity' => ['required', 'numeric', 'min:0'],
            'result' => ['required', Rule::in(['pending', 'passed', 'failed', 'conditional'])],
            'defect_details' => ['nullable', 'string', 'max:5000'],
            'corrective_action' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
        abort_if(
            (float) $data['passed_quantity'] + (float) $data['rejected_quantity'] > (float) $data['inspected_quantity'],
            422,
            'Passed and rejected quantities cannot exceed inspected quantity.',
        );
        if (! empty($data['stage_execution_id'])) {
            $execution = ProductionStageExecution::findOrFail($data['stage_execution_id']);
            abort_if(
                ! empty($data['production_order_id']) &&
                    (int) $execution->production_order_id !== (int) $data['production_order_id'],
                422,
                'The selected stage does not belong to that production order.',
            );
        }
        $inspection = DB::transaction(function () use ($data, $request) {
            $inspection = QualityInspection::create(
                $data + [
                    'inspection_number' => 'QI-' . now()->format('ymd') . '-' . Str::upper(Str::random(6)),
                    'inspector_id' => $request->user()->id,
                    'inspected_at' => $data['result'] === 'pending' ? null : now(),
                ],
            );
            if ($data['result'] === 'failed' && $inspection->stage_execution_id) {
                $inspection
                    ->stageExecution()
                    ->update(['status' => 'rework', 'rejected_quantity' => $data['rejected_quantity']]);
            }
            if ($inspection->batch_id && in_array($data['result'], ['passed', 'failed'], true)) {
                $inspection->batch()->update(['qc_status' => $data['result']]);
            }

            return $inspection;
        });
        AuditLog::record('quality.inspection_created', "Recorded {$inspection->inspection_number}", $inspection);
        if ($data['result'] === 'failed') {
            FactoryNotifier::notify(
                $factoryId,
                'quality.approve',
                'Quality inspection failed',
                "{$inspection->inspection_number} failed inspection — {$data['rejected_quantity']} units rejected.",
                '/executive/quality',
                'quality',
                $request->user()->id,
            );
        }

        return response()->json(
            $inspection->load(['order:id,order_number', 'item:id,name,sku', 'inspector:id,name']),
            201,
        );
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
