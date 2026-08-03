<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'registration_number', 'vehicle_type', 'driver_name', 'driver_phone', 'status', 'capacity', 'capacity_unit'])]
class DeliveryVehicle extends Model
{
    use BelongsToFactory;
}
