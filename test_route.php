<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$user = App\Models\User::find(9);

$req = Illuminate\Http\Request::create('/api/inventory/transactions/11/correct', 'PATCH', [
    'quantity' => 10,
    'reason' => 'Test reason'
]);
$req->headers->set('Accept', 'application/json');
$req->setUserResolver(fn() => $user);

$response = $kernel->handle($req);

echo "Status: " . $response->getStatusCode() . "\n";
echo "Content: " . $response->getContent() . "\n";
