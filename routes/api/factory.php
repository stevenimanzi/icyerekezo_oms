<?php

use App\Http\Controllers\Factory\FactoryFlowController;
use App\Http\Controllers\Factory\FactorySettingsController;
use App\Http\Controllers\Inventory\InventoryController;
use Illuminate\Support\Facades\Route;

Route::controller(FactoryFlowController::class)
    ->prefix('factory')
    ->group(function () {
        Route::get('/flow-suggestion', 'suggestion')->middleware('permission:factory.manage');
        Route::post('/flow-suggestion/apply', 'apply')->middleware('permission:factory.manage');
    });

Route::controller(FactorySettingsController::class)
    ->prefix('factory')
    ->group(function () {
        Route::get('/settings', 'show')->middleware('permission:factory.manage');
        Route::put('/settings', 'update')->middleware('permission:factory.manage');
    });

Route::controller(InventoryController::class)
    ->prefix('factory')
    ->group(function () {
        Route::get('/setup-options', 'setup')->middleware('permission:factory.view');
        Route::post('/units', 'storeUnit')->middleware('permission:factory.manage');
        Route::post('/warehouses', 'storeWarehouse')->middleware('permission:factory.manage');
    });
