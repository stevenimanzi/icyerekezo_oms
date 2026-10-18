<?php

namespace App\Http\Controllers\Production;

use App\Http\Controllers\Controller;
use App\Models\MaterialRequest;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionTransfer;
use App\Models\StockHandover;
use App\Services\ProductionFlow\FactoryReport;
use App\Services\ProductionFlow\FlowAccess;
use App\Services\ProductionFlow\FlowQueries;
use App\Services\ProductionFlow\MaterialRequestService;
use App\Services\ProductionFlow\ProductionFlowService;
use App\Support\Catalogs\ProductionFlowCatalog;
use App\Support\Exports\NoguchiDailyReportXlsxExporter;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProductionFlowController extends Controller
{
    public function overview(Request $request, FlowQueries $queries): JsonResponse
    {
        $access = FlowAccess::for($request->user());
        $data = $request->validate(['stage' => ['nullable', Rule::in(ProductionFlowCatalog::keys())]]);
        $stage = $data['stage'] ?? $access->defaultStage() ?? ProductionFlowCatalog::keys()[0];

        return response()->json($queries->stage($request->user(), $stage));
    }

    public function monitor(Request $request, FlowQueries $queries): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'held', 'completed', 'all'])],
            'q' => ['nullable', 'string', 'max:80'],
            'color' => ['nullable', 'string', 'max:80'],
            'size' => ['nullable', 'string', 'max:40'],
            'product_id' => ['nullable', 'integer'],
            'fabric_id' => ['nullable', 'integer'],
        ]);

        return response()->json($queries->monitor($filters) + [
            'capabilities' => ['inspect' => FlowAccess::for($request->user())->canInspect()],
            'stages' => ProductionFlowCatalog::describe(),
        ]);
    }

    public function lot(ProductionLot $lot, FlowQueries $queries): JsonResponse
    {
        return response()->json($queries->lot($lot));
    }

    public function factoryReport(Request $request, FactoryReport $report): JsonResponse
    {
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'week', 'month', 'year', 'custom'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'department' => ['nullable', Rule::in(['cutting', 'sewing', 'finishing', 'packing', 'warehouse', 'quality', 'sales'])],
        ]);

        [$from, $to] = $this->reportRange($data);

        return response()->json($report->build($request->user(), $from, $to, $data['department'] ?? null));
    }

    public function factoryReportExcel(Request $request, FactoryReport $report): BinaryFileResponse
    {
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'week', 'month', 'year', 'custom'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'department' => ['nullable', Rule::in(['cutting', 'sewing', 'finishing', 'packing', 'warehouse', 'quality', 'sales'])],
        ]);
        [$from, $to] = $this->reportRange($data);
        $result = $report->build($request->user(), $from, $to, $data['department'] ?? null);

        $path = tempnam(sys_get_temp_dir(), 'factory-register-') . '.xlsx';
        NoguchiDailyReportXlsxExporter::createRegister(
            $result['register']['days'],
            array_values(array_diff($result['register']['sections'], ['quality', 'sales'])),
            ' ' . strtoupper($request->user()->currentFactory->name) . ' - DAILY REPORT   |   ' . $result['period']['from'] . ' to ' . $result['period']['to'],
            $path,
            ['prod' => 'SEWING', 'fin' => 'FINISHING', 'stock' => 'PACKED INTO STOCK'],
        );

        return response()
            ->download($path, 'factory-daily-report-' . now()->format('Y-m-d-His') . '.xlsx', [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }

    public function factoryReportPdf(Request $request, FactoryReport $report): Response
    {
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'week', 'month', 'year', 'custom'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'department' => ['nullable', Rule::in(['cutting', 'sewing', 'finishing', 'packing', 'warehouse', 'quality', 'sales'])],
        ]);
        [$from, $to] = $this->reportRange($data);
        $result = $report->build($request->user(), $from, $to, $data['department'] ?? null);

        $factory = $request->user()->currentFactory;
        $departmentName = ! empty($data['department'])
            ? ucfirst($data['department']) . ' Department'
            : 'All Factory Departments';
        $reportTitle = 'FACTORY OPERATIONS & QUALITY CONTROL REGISTER';
        $periodString = $result['period']['from'] . ' to ' . $result['period']['to'];

        $summaryStages = [];
        $detailRows = [];

        foreach (ProductionFlowCatalog::keys() as $key) {
            if (isset($result[$key])) {
                $block = $result[$key];
                $qc = $block['quality'] ?? [];
                $inputVal = $key === 'cutting'
                    ? (float) collect($block['fabric'] ?? [])->sum('used')
                    : (float) ($block['received'] ?? 0);

                $summaryStages[] = [
                    'key' => $key,
                    'name' => ProductionFlowCatalog::STAGES[$key]['label']['en'] ?? ucfirst($key),
                    'input' => $inputVal,
                    'input_unit' => $key === 'cutting' ? 'Meters fabric' : 'Pieces received',
                    'good' => $block['good'] ?? 0,
                    'damaged' => $block['damaged'] ?? 0,
                    'inspected' => $qc['inspected'] ?? 0,
                    'passed' => $qc['passed'] ?? 0,
                    'rejected' => $qc['rejected'] ?? 0,
                    'output_status' => ($block['good'] ?? 0) > 0 ? 'COMPLETED' : 'IN WORK',
                ];

                foreach ($block['lots'] ?? [] as $lot) {
                    $detailRows[] = [
                        'date' => $result['period']['from'],
                        'lot_number' => $lot['lot_number'] ?? '—',
                        'product' => $lot['product'] ?? 'Garment',
                        'style' => $lot['product'] ?? '',
                        'color' => $lot['color'] ?? '',
                        'size' => $lot['size'] ?? '',
                        'input' => $key === 'cutting' ? ($lot['fabric'] ?? 'Fabric') : null,
                        'input_unit' => '',
                        'good' => $lot['good'] ?? 0,
                        'damaged' => $lot['damaged'] ?? 0,
                        'qc_passed' => $lot['qc_passed'] ?? $lot['good'] ?? 0,
                        'qc_result' => $lot['qc_status'] ?? 'PASSED',
                        'notes' => 'Stage: ' . ucfirst($key),
                    ];
                }
            }
        }

        $user = $request->user();
        $userRole = 'Operations Officer';

        $pdf = Pdf::loadView('pdf.operations-report', compact(
            'factory',
            'reportTitle',
            'departmentName',
            'periodString',
            'user',
            'userRole',
            'summaryStages',
            'detailRows'
        ))->setPaper('a4', 'portrait');

        $fileName = 'factory-operations-report-' . now()->format('Y-m-d-His') . '.pdf';

        return $pdf->stream($fileName);
    }

    public function cuttingReportPdf(Request $request, FactoryReport $report): Response
    {
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'week', 'month', 'year', 'custom'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        [$from, $to] = $this->reportRange($data);
        $result = $report->build($request->user(), $from, $to, 'cutting');

        $factory = $request->user()->currentFactory;
        $departmentName = 'Cutting Department';
        $reportTitle = 'CUTTING OPERATIONS, MATERIAL USAGE & QUALITY REGISTER';
        $periodString = $result['period']['from'] . ' to ' . $result['period']['to'];

        $block = $result['cutting'] ?? [];
        $qc = $block['quality'] ?? [];
        $inputVal = (float) collect($block['fabric'] ?? [])->sum('used');

        $summaryStages = [
            [
                'key' => 'cutting',
                'name' => 'Cutting Operations',
                'input' => $inputVal,
                'input_unit' => 'Meters fabric used',
                'good' => $block['good'] ?? 0,
                'damaged' => $block['damaged'] ?? 0,
                'inspected' => $qc['inspected'] ?? ($block['good'] ?? 0),
                'passed' => $qc['passed'] ?? ($block['good'] ?? 0),
                'rejected' => $qc['rejected'] ?? ($block['damaged'] ?? 0),
                'output_status' => 'CUT OUTPUT',
            ],
        ];

        $detailRows = [];
        foreach ($block['lots'] ?? [] as $lot) {
            $detailRows[] = [
                'date' => $result['period']['from'],
                'lot_number' => $lot['lot_number'] ?? '—',
                'product' => $lot['product'] ?? 'Garment',
                'style' => $lot['product'] ?? '',
                'color' => $lot['color'] ?? '',
                'size' => $lot['size'] ?? '',
                'input' => $lot['fabric'] ?? null,
                'input_unit' => '',
                'good' => $lot['good'] ?? 0,
                'damaged' => $lot['damaged'] ?? 0,
                'qc_passed' => $lot['qc_passed'] ?? $lot['good'] ?? 0,
                'qc_result' => $lot['qc_status'] ?? 'PASSED',
                'notes' => 'Cutting register record',
            ];
        }

        $user = $request->user();
        $userRole = 'Cutting Floor Supervisor';

        $pdf = Pdf::loadView('pdf.operations-report', compact(
            'factory',
            'reportTitle',
            'departmentName',
            'periodString',
            'user',
            'userRole',
            'summaryStages',
            'detailRows'
        ))->setPaper('a4', 'portrait');

        $fileName = 'cutting-report-' . now()->format('Y-m-d-His') . '.pdf';

        return $pdf->stream($fileName);
    }

    private function reportRange(array $data): array
    {
        return match ($data['period'] ?? 'week') {
            'day' => [today(), today()],
            'month' => [today()->startOfMonth(), today()],
            'year' => [today()->startOfYear(), today()],
            'custom' => [Carbon::parse($data['from'] ?? today()), Carbon::parse($data['to'] ?? $data['from'] ?? today())],
            default => [today()->subDays(6), today()],
        };
    }

    public function report(Request $request, FlowQueries $queries): JsonResponse
    {
        $data = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $to = isset($data['to']) ? Carbon::parse($data['to']) : today();
        $from = isset($data['from']) ? Carbon::parse($data['from']) : $to->copy()->subDays(6);

        abort_if($from->diffInDays($to) > 400, 422, 'Please choose a shorter period.');

        return response()->json($queries->report($from, $to));
    }

    public function requests(Request $request, FlowQueries $queries): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'cancelled', 'all'])],
            'stage' => ['nullable', Rule::in(ProductionFlowCatalog::keys())],
            'direction' => ['nullable', Rule::in(['mine', 'asked'])],
            'q' => ['nullable', 'string', 'max:80'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return response()->json($queries->requests($request->user(), $data['status'] ?? 'pending', collect($data)->only(['stage', 'direction', 'q', 'from', 'to'])->all()));
    }

    public function storeRequest(Request $request, MaterialRequestService $service): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'stage' => ['required', Rule::in(ProductionFlowCatalog::keys())],
            'source' => ['nullable', Rule::in(['warehouse', 'stage'])],
            'item_id' => ['required_unless:source,stage', 'nullable', 'integer', Rule::exists('items', 'id')->where('factory_id', $factoryId)],
            'lot_id' => ['required_if:source,stage', 'nullable', 'integer', Rule::exists('production_lots', 'id')->where('factory_id', $factoryId)],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:1000000', Rule::when($request->input('source') === 'stage', ['integer'])],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $created = $service->request($request->user(), $data);
        $to = $created->isForPieces() ? ProductionFlowCatalog::STAGES[$created->from_stage]['label']['en'] : 'the warehouse';

        return response()->json(['message' => "Request {$created->request_number} sent to {$to}.", 'request' => $created], 201);
    }

    public function answerRequest(Request $request, MaterialRequest $materialRequest, MaterialRequestService $service): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:255']]);

        return response()->json(['message' => 'Request declined.', 'request' => $service->decline($materialRequest, $request->user(), $data['note'])]);
    }

    public function decide(Request $request, MaterialRequest $materialRequest, MaterialRequestService $service): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'warehouse_id' => ['nullable', 'integer', Rule::exists('warehouses', 'id')->where('factory_id', $factoryId)],
            'note' => ['nullable', 'string', 'max:255', Rule::requiredIf(fn () => $request->input('decision') === 'reject')],
        ]);

        $result = $data['decision'] === 'approve'
            ? $service->approve($materialRequest, $request->user(), $data['warehouse_id'] ?? null, $data['note'] ?? null)
            : $service->reject($materialRequest, $request->user(), $data['note']);

        return response()->json([
            'message' => $data['decision'] === 'approve' ? 'Approved. The materials were taken out of stock and given to the team.' : 'Request declined.',
            'request' => $result,
        ]);
    }

    public function cancelRequest(Request $request, MaterialRequest $materialRequest, MaterialRequestService $service): JsonResponse
    {
        return response()->json(['message' => 'Request cancelled.', 'request' => $service->cancel($materialRequest, $request->user())]);
    }

    public function cut(Request $request, ProductionFlowService $service): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'lot_id' => ['nullable', 'integer', Rule::exists('production_lots', 'id')->where('factory_id', $factoryId)],
            'product_item_id' => ['nullable', 'integer', Rule::exists('items', 'id')->where('factory_id', $factoryId)->where('type', 'finished_good')],
            'product_name' => ['nullable', 'string', 'max:160', 'required_without_all:lot_id,product_item_id'],
            'style' => ['nullable', 'string', 'max:80'],
            'color' => ['nullable', 'string', 'max:80'],
            'size' => ['nullable', 'string', 'max:40'],
            'fabric_item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('factory_id', $factoryId)],
            'fabric_used' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'fabric_waste' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'good_quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'damaged_quantity' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'entry_date' => ['nullable', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:500'],
            'lot_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $lot = $service->recordCut($request->user(), $data);

        return response()->json(['message' => "Saved on lot {$lot->lot_number}.", 'lot' => $lot], 201);
    }

    public function fabricLoss(Request $request, ProductionFlowService $service): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'fabric_item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('factory_id', $factoryId)],
            'fabric_waste' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'entry_date' => ['nullable', 'date', 'before_or_equal:today'],
            'notes' => ['required', 'string', 'min:3', 'max:500'],
        ]);

        return response()->json(['message' => 'Damaged fabric recorded.', 'entry' => $service->recordFabricLoss($request->user(), $data)], 201);
    }

    public function work(Request $request, ProductionLot $lot, ProductionFlowService $service): JsonResponse
    {
        $data = $request->validate([
            'stage' => ['required', Rule::in(ProductionFlowCatalog::keys())],
            'good_quantity' => ['required', 'integer', 'min:0', 'max:1000000'],
            'damaged_quantity' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'entry_date' => ['nullable', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $entry = $service->recordWork($request->user(), $lot, $data['stage'], $data);

        return response()->json(['message' => 'Work recorded.', 'entry' => $entry], 201);
    }

    public function send(Request $request, ProductionLot $lot, ProductionFlowService $service): JsonResponse
    {
        $data = $request->validate([
            'from_stage' => ['required', Rule::in(ProductionFlowCatalog::keys())],
            'to_stage' => ['nullable', Rule::in(ProductionFlowCatalog::keys())],
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $transfer = $service->send($request->user(), $lot, $data['from_stage'], (int) $data['quantity'], $data['note'] ?? null, $data['to_stage'] ?? null);

        return response()->json(['message' => "Sent {$transfer->quantity_sent} pieces to the next stage. They will count there once received.", 'transfer' => $transfer], 201);
    }

    public function stockHandovers(Request $request): JsonResponse
    {
        $access = FlowAccess::for($request->user());
        $rows = StockHandover::with(['lot.product:id,name', 'sender:id,name', 'receiver:id,name'])
            ->when(! $request->boolean('all'), fn ($query) => $query->where('status', 'sent'))
            ->latest('id')->limit(100)->get()
            ->map(fn (StockHandover $handover) => [
                'id' => $handover->id,
                'lot_number' => $handover->lot?->lot_number,
                'product' => $handover->lot?->product?->name,
                'color' => $handover->lot?->color,
                'size' => $handover->lot?->size,
                'quantity' => $handover->quantity,
                'quantity_received' => $handover->quantity_received,
                'status' => $handover->status,
                'note' => $handover->note,
                'sent_by' => $handover->sender?->name,
                'received_by' => $handover->receiver?->name,
                'sent_at' => $handover->sent_at?->toIso8601String(),
                'received_at' => $handover->received_at?->toIso8601String(),
            ]);

        return response()->json(['capabilities' => ['receive' => $access->canApproveRequests()], 'handovers' => $rows]);
    }

    public function sendToStock(Request $request, ProductionLot $lot, ProductionFlowService $service): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $handover = $service->sendToStock($request->user(), $lot, (int) $data['quantity'], $data['note'] ?? null);

        return response()->json(['message' => "Sent {$handover->quantity} pieces to stock. They count as stock once the storekeeper receives them.", 'handover' => $handover], 201);
    }

    public function receiveStock(Request $request, StockHandover $handover, ProductionFlowService $service): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['message' => 'Received into stock.', 'handover' => $service->receiveIntoStock($request->user(), $handover, (int) $data['quantity'], $data['note'] ?? null)]);
    }

    public function cancelStockHandover(Request $request, StockHandover $handover, ProductionFlowService $service): JsonResponse
    {
        return response()->json(['message' => 'Handover taken back.', 'handover' => $service->cancelStockHandover($request->user(), $handover)]);
    }

    public function receive(Request $request, ProductionTransfer $transfer, ProductionFlowService $service): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['message' => 'Received.', 'transfer' => $service->receive($request->user(), $transfer, (int) $data['quantity'], $data['note'] ?? null)]);
    }

    public function cancelTransfer(Request $request, ProductionTransfer $transfer, ProductionFlowService $service): JsonResponse
    {
        return response()->json(['message' => 'Delivery taken back.', 'transfer' => $service->cancelTransfer($request->user(), $transfer)]);
    }

    public function voidEntry(Request $request, ProductionEntry $entry, ProductionFlowService $service): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        return response()->json(['message' => 'Record cancelled.', 'entry' => $service->voidEntry($request->user(), $entry, $data['reason'])]);
    }

    public function hold(Request $request, ProductionLot $lot, ProductionFlowService $service): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        return response()->json(['message' => 'Lot put on hold. No stage can move it until it is released.', 'lot' => $service->hold($request->user(), $lot, $data['reason'])]);
    }

    public function release(Request $request, ProductionLot $lot, ProductionFlowService $service): JsonResponse
    {
        return response()->json(['message' => 'Lot released.', 'lot' => $service->release($request->user(), $lot)]);
    }

    public function inspect(Request $request, ProductionFlowService $service): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'lot_id' => ['required', 'integer', Rule::exists('production_lots', 'id')->where('factory_id', $factoryId)],
            'stage' => ['required', Rule::in(ProductionFlowCatalog::keys())],
            'inspected_quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'passed_quantity' => ['required', 'integer', 'min:0', 'max:1000000'],
            'rejected_quantity' => ['required', 'integer', 'min:0', 'max:1000000'],
            'defect_details' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'hold' => ['nullable', 'boolean'],
        ]);

        $inspection = $service->inspect($request->user(), ProductionLot::findOrFail($data['lot_id']), $data['stage'], $data);

        return response()->json(['message' => "Check {$inspection->inspection_number} saved.", 'inspection' => $inspection], 201);
    }
}
