<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Mail;

try {
    Mail::raw('SMTP test from ICYEREKEZO OMS', function($msg) {
        $msg->to('support@icyerekezooms.com')->subject('SMTP Test');
    });
    echo "Mail sent successfully.\n";
} catch (\Exception $e) {
    echo "Error sending mail: " . $e->getMessage() . "\n";
}
