<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\DeliveryVehicle;
use App\Models\SalesDocument;
use App\Models\SalesDocumentLine;
use App\Models\Shipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LogisticsController extends Controller
{
    public function overview(): JsonResponse
    {
        $shipments = Shipment::query();
        $vehicles = DeliveryVehicle::query();
        $schoolGarments = auth()->user()->currentFactory->hasNoguchiSchoolOrders();

        return response()->json([
            'summary' => [
                'total_shipments' => (clone $shipments)->count(),
                'planned' => (clone $shipments)->where('status', 'planned')->count(),
                'ready' => (clone $shipments)->where('status', 'ready')->count(),
                'in_transit' => (clone $shipments)->where('status', 'in_transit')->count(),
                'delivered' => (clone $shipments)->where('status', 'delivered')->count(),
                'delayed' => (clone $shipments)->whereNotIn('status', ['delivered', 'cancelled'])->where('planned_dispatch_at', '<', now())->count(),
                'proof_of_delivery' => (clone $shipments)->whereNotNull('proof_reference')->count(),
                'vehicles' => (clone $vehicles)->count(),
                'available_vehicles' => (clone $vehicles)->where('status', 'available')->count(),
                'delivered_items' => $schoolGarments
                    ? (int) SalesDocumentLine::sum('quantity_delivered')
                    : (int) Shipment::where('shipments.status', 'delivered')->join('sales_documents', 'sales_documents.id', '=', 'shipments.sales_document_id')->sum('sales_documents.item_count'),
                'delivered_packages' => (int) (clone $shipments)->where('status', 'delivered')->sum('package_count'),
                'delivered_today' => (clone $shipments)->where('status', 'delivered')->whereDate('delivered_at', today())->count(),
            ],
            'shipments' => Shipment::with(['vehicle', 'salesDocument:id,document_number'])->latest('planned_dispatch_at')->latest('id')->paginate(50),
            'vehicles' => DeliveryVehicle::latest()->get(),
            'incoming_orders' => SalesDocument::where('document_type', 'customer_order')->whereIn('status', ['confirmed', 'processing', 'ready'])->whereDoesntHave('shipments', fn ($query) => $query->whereNotIn('status', ['cancelled']))->latest('document_date')->get(),
            'specialization' => $schoolGarments ? ['type' => 'noguchi_school_garments'] : null,
            'capabilities' => ['plan' => auth()->user()->hasPermission('logistics.plan'), 'dispatch' => auth()->user()->hasPermission('logistics.dispatch'), 'deliver' => auth()->user()->hasPermission('logistics.deliver')],
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function storeShipment(Request $request): JsonResponse
    {
        $factoryId = (int) $request->user()->current_factory_id;
        $data = $request->validate([
            'sales_document_id' => ['required', Rule::exists('sales_documents', 'id')->where('factory_id', $factoryId)->where('document_type', 'customer_order')],
            'delivery_vehicle_id' => ['nullable', Rule::exists('delivery_vehicles', 'id')->where('factory_id', $factoryId)],
            'destination' => ['required', 'string', 'max:255'], 'package_count' => ['required', 'integer', 'min:1'],
            'total_weight' => ['nullable', 'numeric', 'min:0'], 'weight_unit' => ['nullable', 'string', 'max:20'],
            'planned_dispatch_at' => ['nullable', 'date'], 'delivery_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $order = SalesDocument::findOrFail($data['sales_document_id']);
        abort_unless(in_array($order->status, ['confirmed', 'processing', 'ready'], true), 409, 'Accept the customer order before creating a shipment.');
        abort_if(Shipment::where('sales_document_id', $order->id)->whereNotIn('status', ['cancelled'])->exists(), 409, 'This order already has an active shipment.');
        $next = Shipment::count() + 1;
        $shipment = Shipment::create($data + ['shipment_number' => 'SHP-'.now()->format('Y').'-'.str_pad((string) $next, 6, '0', STR_PAD_LEFT), 'customer_name' => $order->customer_name, 'status' => empty($data['delivery_vehicle_id']) ? 'planned' : 'ready']);
        $order->update(['status' => 'processing']);
        if ($shipment->delivery_vehicle_id) DeliveryVehicle::whereKey($shipment->delivery_vehicle_id)->update(['status' => 'assigned']);
        AuditLog::record('logistics.shipment_created', "Created {$shipment->shipment_number} for {$order->document_number}", $shipment);

        return response()->json(['message' => 'Shipment created.', 'shipment' => $shipment->load('vehicle', 'salesDocument')], 201);
    }

    public function updateShipment(Request $request, Shipment $shipment): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['ready', 'dispatch', 'deliver', 'cancel'])],
            'delivery_vehicle_id' => ['nullable', Rule::exists('delivery_vehicles', 'id')->where('factory_id', $request->user()->current_factory_id)],
            'planned_dispatch_at' => ['nullable', 'date'], 'received_by' => ['nullable', 'string', 'max:255'],
            'proof_reference' => ['nullable', 'string', 'max:255'], 'delivery_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $requiredPermission = match ($data['action']) {
            'ready', 'cancel' => 'logistics.plan',
            'dispatch' => 'logistics.dispatch',
            'deliver' => 'logistics.deliver',
        };
        abort_unless($request->user()->hasPermission($requiredPermission), 403, 'You do not have permission for this shipment action.');
        $oldVehicle = $shipment->delivery_vehicle_id;
        DB::transaction(function () use ($shipment, $data, $oldVehicle) {
            if ($data['action'] === 'ready') {
                abort_unless(in_array($shipment->status, ['planned', 'ready'], true), 409, 'Only planned shipments can be prepared.');
                abort_unless($data['delivery_vehicle_id'] ?? $shipment->delivery_vehicle_id, 422, 'Assign a vehicle before marking the shipment ready.');
                $shipment->update(['status' => 'ready', 'delivery_vehicle_id' => $data['delivery_vehicle_id'] ?? $shipment->delivery_vehicle_id, 'planned_dispatch_at' => $data['planned_dispatch_at'] ?? $shipment->planned_dispatch_at]);
            } elseif ($data['action'] === 'dispatch') {
                abort_unless($shipment->status === 'ready' && $shipment->delivery_vehicle_id, 409, 'The shipment must be ready and assigned to a vehicle.');
                $shipment->update(['status' => 'in_transit', 'dispatched_at' => now()]);
            } elseif ($data['action'] === 'deliver') {
                abort_unless($shipment->status === 'in_transit', 409, 'Only shipments in transit can be delivered.');
                abort_unless(!empty($data['received_by']) && !empty($data['proof_reference']), 422, 'Receiver and proof reference are required.');
                $shipment->update(['status' => 'delivered', 'delivered_at' => now(), 'received_by' => $data['received_by'], 'proof_reference' => $data['proof_reference'], 'delivery_notes' => $data['delivery_notes'] ?? $shipment->delivery_notes]);
                $shipment->salesDocument?->update(['status' => 'completed']);
            } else {
                abort_unless(in_array($shipment->status, ['planned', 'ready'], true), 409, 'Dispatched or delivered shipments cannot be cancelled.');
                $shipment->update(['status' => 'cancelled', 'delivery_notes' => $data['delivery_notes'] ?? $shipment->delivery_notes]);
                $shipment->salesDocument?->update(['status' => 'confirmed']);
            }
            if ($oldVehicle && ($shipment->status === 'delivered' || $shipment->status === 'cancelled' || $oldVehicle !== $shipment->delivery_vehicle_id)) DeliveryVehicle::whereKey($oldVehicle)->update(['status' => 'available']);
            if ($shipment->delivery_vehicle_id && in_array($shipment->status, ['ready', 'in_transit'], true)) DeliveryVehicle::whereKey($shipment->delivery_vehicle_id)->update(['status' => 'assigned']);
        });
        AuditLog::record('logistics.shipment_'.$data['action'], ucfirst($data['action'])." {$shipment->shipment_number}", $shipment);

        return response()->json(['message' => 'Shipment updated.', 'shipment' => $shipment->fresh()->load('vehicle', 'salesDocument')]);
    }
}
