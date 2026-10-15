<?php

use App\Http\Controllers\Logistics\LogisticsController;
use Illuminate\Support\Facades\Route;

Route::controller(LogisticsController::class)
    ->prefix('logistics')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:logistics.view');
        Route::post('/shipments', 'storeShipment')->middleware('permission:logistics.plan');
        Route::patch('/shipments/{shipment}', 'updateShipment')->middleware(
            'permission:logistics.dispatch|logistics.deliver',
        );
        Route::post('/vehicles', 'storeVehicle')->middleware('permission:logistics.plan');
        Route::patch('/vehicles/{vehicle}', 'updateVehicle')->middleware('permission:logistics.plan');
        Route::delete('/vehicles/{vehicle}', 'destroyVehicle')->middleware('permission:logistics.plan');
        Route::get('/agreements', 'agreements')->middleware('permission:logistics.view');
        Route::post('/agreements', 'uploadAgreement')->middleware('permission:logistics.plan');
    });
