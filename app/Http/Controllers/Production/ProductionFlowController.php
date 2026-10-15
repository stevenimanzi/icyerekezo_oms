<?php

namespace App\Http\Controllers\Production;

use App\Http\Controllers\Controller;
use App\Models\MaterialRequest;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionTransfer;
use App\Services\ProductionFlow\FlowAccess;
use App\Services\ProductionFlow\FlowQueries;
use App\Services\ProductionFlow\MaterialRequestService;
use App\Services\ProductionFlow\ProductionFlowService;
use App\Support\Catalogs\ProductionFlowCatalog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
            'q' => ['nullable', 'string', 'max:80'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return response()->json($queries->requests($request->user(), $data['status'] ?? 'pending', collect($data)->only(['stage', 'q', 'from', 'to'])->all()));
    }

    public function storeRequest(Request $request, MaterialRequestService $service): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'stage' => ['required', Rule::in(ProductionFlowCatalog::keys())],
            'item_id' => ['required', 'integer', Rule::exists('items', 'id')->where('factory_id', $factoryId)],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:1000000'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $created = $service->request($request->user(), $data);

        return response()->json(['message' => "Request {$created->request_number} sent to the warehouse.", 'request' => $created], 201);
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
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $transfer = $service->send($request->user(), $lot, $data['from_stage'], (int) $data['quantity'], $data['note'] ?? null);

        return response()->json(['message' => "Sent {$transfer->quantity_sent} pieces to the next stage. They will count there once received.", 'transfer' => $transfer], 201);
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
