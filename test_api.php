<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::whereHas('roles', function($q) { $q->where('slug', 'finishing-manager'); })->first();
if (!$user) $user = App\Models\User::first();
$factoryId = 1;

$finishingOutputQuery = App\Models\StockTransaction::withoutGlobalScopes()
    ->where('factory_id', $factoryId)
    ->where('type', 'issue')
    ->where('reason', 'LIKE', '[Finishing Output]%');

$finishingProgress = [
    'weekly' => collect(range(6, 0))->map(function ($daysAgo) use ($finishingOutputQuery) {
        $date = today()->subDays($daysAgo);
        return [
            'period' => $date->format('D'),
            'output' => abs((float) (clone $finishingOutputQuery)->whereDate('occurred_at', $date)->sum('quantity_delta')),
        ];
    })->values(),
    'monthly' => collect(range(29, 0))->map(function ($daysAgo) use ($finishingOutputQuery) {
        $date = today()->subDays($daysAgo);
        return [
            'period' => $date->format('d M'),
            'output' => abs((float) (clone $finishingOutputQuery)->whereDate('occurred_at', $date)->sum('quantity_delta')),
        ];
    })->values(),
    'annually' => collect(range(11, 0))->map(function ($monthsAgo) use ($finishingOutputQuery) {
        $month = now()->startOfMonth()->subMonths($monthsAgo);
        return [
            'period' => $month->format('M'),
            'month_number' => $month->month,
            'output' => abs((float) (clone $finishingOutputQuery)->whereBetween('occurred_at', [$month, $month->copy()->endOfMonth()])->sum('quantity_delta')),
        ];
    })->values(),
];
echo json_encode($finishingProgress);
