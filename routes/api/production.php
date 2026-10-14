<?php

use App\Http\Controllers\Production\ManufacturingController;
use Illuminate\Support\Facades\Route;

Route::controller(ManufacturingController::class)
    ->prefix('manufacturing')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:production.view');
        Route::post('/boms', 'storeBom')->middleware('permission:production.plan');
        Route::post('/workflows', 'storeWorkflow')->middleware('permission:factory.manage');
        Route::put('/workflows/{workflow}', 'updateWorkflow')->middleware('permission:factory.manage');
        Route::post('/orders', 'storeOrder')->middleware('permission:production.plan');
        Route::post('/orders/{order}/approve', 'approveOrder')->middleware('permission:production.approve');
        Route::patch('/stages/{execution}', 'updateStage')->middleware('permission:production.execute');
    });
