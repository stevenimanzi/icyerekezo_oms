<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['factory_id', 'category_id', 'unit_id', 'type', 'name', 'sku', 'barcode', 'description', 'standard_cost', 'tax_rate', 'minimum_stock', 'reorder_level', 'batch_tracked', 'serial_tracked', 'expiry_tracked', 'storage_conditions', 'is_active'])]
class Item extends Model
{
    use BelongsToFactory, SoftDeletes;

    private const SKU_PREFIXES = [
        'raw_material' => 'RAW', 'semi_finished' => 'WIP', 'finished_good' => 'FIN', 'packaging' => 'PKG',
        'spare_part' => 'SPR', 'waste' => 'WST', 'by_product' => 'BYP', 'service' => 'SRV',
    ];

    protected function casts(): array
    {
        return ['batch_tracked' => 'boolean', 'serial_tracked' => 'boolean', 'expiry_tracked' => 'boolean', 'is_active' => 'boolean'];
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * A factory-unique SKU for a new item, prefixed by its type (e.g. FIN-XXXXXXXX).
     */
    public static function generateSku(int $factoryId, string $type): string
    {
        $prefix = self::SKU_PREFIXES[$type] ?? 'STK';
        do {
            $sku = $prefix.'-'.Str::upper(Str::random(8));
        } while (self::withoutGlobalScopes()->where('factory_id', $factoryId)->where('sku', $sku)->exists());

        return $sku;
    }

    /**
     * The catalog item a finished product name (e.g. a school garment_category like
     * "T-shirt") represents, creating it on first use so production and sales always
     * agree on what a product is without requiring a manual catalog setup step first.
     */
    public static function resolveFinishedGood(int $factoryId, string $name): self
    {
        return self::withoutGlobalScopes()->firstOrCreate(
            ['factory_id' => $factoryId, 'name' => $name, 'type' => 'finished_good'],
            [
                'unit_id' => Unit::withoutGlobalScopes()->where('factory_id', $factoryId)
                    ->where(fn ($query) => $query->where('dimension', 'count')->orWhere('symbol', 'pcs'))
                    ->value('id') ?? Unit::withoutGlobalScopes()->where('factory_id', $factoryId)->value('id'),
                'sku' => self::generateSku($factoryId, 'finished_good'),
                'is_active' => true,
            ]
        );
    }
}
