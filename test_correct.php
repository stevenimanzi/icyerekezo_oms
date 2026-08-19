<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::find(9);
auth()->login($user);
echo "current_factory_id = {$user->current_factory_id}\n";

$req = Illuminate\Http\Request::create('/inventory/transactions/11/correct', 'PATCH', [
    'quantity' => 10,
    'reason' => 'Test reason'
]); 
$req->setUserResolver(fn() => $user);

try {
    app()->make(App\Http\Controllers\InventoryController::class)->correctTransaction($req, App\Models\StockTransaction::find(11), app()->make(App\Services\InventoryLedger::class)); 
    echo "SUCCESS\n";
} catch (\Exception $e) {
    if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpException) {
        echo "HTTP " . $e->getStatusCode() . " - " . $e->getMessage() . "\n";
    } else {
        echo "ERROR: " . get_class($e) . " - " . $e->getMessage() . "\n";
    }
}
