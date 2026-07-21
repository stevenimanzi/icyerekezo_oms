<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'item_id', 'warehouse_id', 'location_id', 'batch_id', 'quantity_on_hand', 'quantity_reserved', 'quantity_quarantined'])]
class StockBalance extends Model
{
    use BelongsToFactory;
}
