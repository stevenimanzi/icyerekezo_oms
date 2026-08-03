<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'shipment_number', 'sales_document_id', 'delivery_vehicle_id', 'customer_name', 'destination', 'status', 'package_count', 'total_weight', 'weight_unit', 'planned_dispatch_at', 'dispatched_at', 'delivered_at', 'received_by', 'delivery_notes', 'proof_reference'])]
class Shipment extends Model
{
    use BelongsToFactory;

    protected function casts(): array { return ['planned_dispatch_at' => 'datetime', 'dispatched_at' => 'datetime', 'delivered_at' => 'datetime']; }
    public function vehicle() { return $this->belongsTo(DeliveryVehicle::class, 'delivery_vehicle_id'); }
    public function salesDocument() { return $this->belongsTo(SalesDocument::class); }
}
