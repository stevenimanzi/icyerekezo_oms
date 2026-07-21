<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\FactoryContextController;
use App\Http\Controllers\InventoryController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('app');
});

Route::get('/dashboard', function () {
    return view('app');
})->name('dashboard');

Route::prefix('api')->group(function () {
    Route::middleware('throttle:6,1')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
    });
    Route::middleware('auth')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/factories/switch', [FactoryContextController::class, 'switch']);
        Route::middleware('tenant')->group(function () {
            Route::get('/inventory/overview', [InventoryController::class, 'overview'])->middleware('permission:inventory.view');
            Route::get('/inventory/items', [InventoryController::class, 'items'])->middleware('permission:products.view');
            Route::post('/inventory/items', [InventoryController::class, 'storeItem'])->middleware('permission:products.create');
            Route::post('/inventory/transactions', [InventoryController::class, 'postTransaction'])->middleware('permission:inventory.adjust');
            Route::get('/factory/setup-options', [InventoryController::class, 'setup'])->middleware('permission:factory.view');
            Route::post('/factory/units', [InventoryController::class, 'storeUnit'])->middleware('permission:factory.manage');
            Route::post('/factory/warehouses', [InventoryController::class, 'storeWarehouse'])->middleware('permission:factory.manage');
        });
    });
});
