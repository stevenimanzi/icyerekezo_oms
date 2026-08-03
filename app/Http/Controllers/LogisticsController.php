<?php

namespace App\Http\Controllers;

use App\Models\DeliveryVehicle;
use App\Models\Shipment;
use Illuminate\Http\JsonResponse;

class LogisticsController extends Controller
{
    public function overview(): JsonResponse
    {
        $shipments = Shipment::query();
        $vehicles = DeliveryVehicle::query();

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
            ],
            'shipments' => Shipment::with(['vehicle', 'salesDocument:id,document_number'])->latest('planned_dispatch_at')->latest('id')->paginate(50),
            'vehicles' => DeliveryVehicle::latest()->get(),
            'updated_at' => now()->toIso8601String(),
        ]);
    }
}
