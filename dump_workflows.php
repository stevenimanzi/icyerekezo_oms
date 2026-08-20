<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$factory = App\Models\Factory::where('name', 'Noguchi Holdings Ltd')->first();
if ($factory) {
    $templates = App\Models\WorkflowTemplate::with('stages')->where('factory_id', $factory->id)->get();
    echo $templates->toJson(JSON_PRETTY_PRINT);
} else {
    echo "Factory not found";
}
