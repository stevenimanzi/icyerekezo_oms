<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$factory = \App\Models\Factory::first();
if (!$factory) die("No factory found\n");

$mainWarehouse = \App\Models\Warehouse::where('factory_id', $factory->id)->where('type', 'main')->first();
if (!$mainWarehouse) {
    echo "No main warehouse found, creating one...\n";
    $mainWarehouse = \App\Models\Warehouse::create(['name' => 'Main Warehouse', 'code' => 'MAIN-01', 'type' => 'main', 'is_active' => true, 'factory_id' => $factory->id]);
}

$unit = \App\Models\Unit::firstOrCreate(['name' => 'Pieces', 'symbol' => 'pcs'], ['factory_id' => $factory->id]);

$item1 = \App\Models\Item::firstOrCreate(['sku' => 'BTN-BLK'], ['name' => 'Buttons - Black', 'category' => 'Raw Materials', 'type' => 'material', 'unit_id' => $unit->id, 'factory_id' => $factory->id]);
$item2 = \App\Models\Item::firstOrCreate(['sku' => 'THR-WHT'], ['name' => 'Thread - White (1000m)', 'category' => 'Raw Materials', 'type' => 'material', 'unit_id' => $unit->id, 'factory_id' => $factory->id]);
$item3 = \App\Models\Item::firstOrCreate(['sku' => 'ZIP-15'], ['name' => 'Zippers - 15cm', 'category' => 'Raw Materials', 'type' => 'material', 'unit_id' => $unit->id, 'factory_id' => $factory->id]);
$item4 = \App\Models\Item::firstOrCreate(['sku' => 'LBL-NOG'], ['name' => 'Noguchi Labels', 'category' => 'Raw Materials', 'type' => 'material', 'unit_id' => $unit->id, 'factory_id' => $factory->id]);

$now = now();
\App\Models\StockTransaction::create(['uuid' => \Illuminate\Support\Str::uuid(), 'warehouse_id' => $mainWarehouse->id, 'item_id' => $item1->id, 'type' => 'receipt', 'quantity_delta' => 5000, 'balance_after' => 5000, 'reason' => 'Initial stock for finishing', 'factory_id' => $factory->id, 'occurred_at' => $now]);
\App\Models\StockTransaction::create(['uuid' => \Illuminate\Support\Str::uuid(), 'warehouse_id' => $mainWarehouse->id, 'item_id' => $item2->id, 'type' => 'receipt', 'quantity_delta' => 200, 'balance_after' => 200, 'reason' => 'Initial stock for finishing', 'factory_id' => $factory->id, 'occurred_at' => $now]);
\App\Models\StockTransaction::create(['uuid' => \Illuminate\Support\Str::uuid(), 'warehouse_id' => $mainWarehouse->id, 'item_id' => $item3->id, 'type' => 'receipt', 'quantity_delta' => 1000, 'balance_after' => 1000, 'reason' => 'Initial stock for finishing', 'factory_id' => $factory->id, 'occurred_at' => $now]);
\App\Models\StockTransaction::create(['uuid' => \Illuminate\Support\Str::uuid(), 'warehouse_id' => $mainWarehouse->id, 'item_id' => $item4->id, 'type' => 'receipt', 'quantity_delta' => 2000, 'balance_after' => 2000, 'reason' => 'Initial stock for finishing', 'factory_id' => $factory->id, 'occurred_at' => $now]);

echo 'Sample materials added successfully!';
