<?php

use App\Http\Controllers\Sales\ManualSalesController;
use App\Http\Controllers\Sales\SalesController;
use Illuminate\Support\Facades\Route;

Route::controller(SalesController::class)
    ->prefix('sales')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:sales.view');
        Route::get('/orders/{document}/pdf', 'orderPdf')->middleware('permission:sales.view');
        Route::patch('/orders/{document}/decision', 'decide')->middleware(
            'permission:sales.fulfill|logistics.plan|logistics.dispatch|logistics.deliver',
        );
        Route::delete('/orders/{document}', 'destroy')->middleware(
            'permission:sales.fulfill|logistics.plan|logistics.dispatch|logistics.deliver',
        );
        Route::post('/orders/{document}/invoice', 'uploadInvoice')->middleware('permission:sales.fulfill');
        Route::post('/school-orders', 'storeSchoolOrder')->middleware('permission:sales.create|sales.fulfill');
        Route::patch('/school-order-lines/{line}/pack', 'packSchoolOrderLine')->middleware('permission:sales.pack');
        Route::patch('/school-order-lines/{line}/deliver', 'deliverSchoolOrderLine')->middleware(
            'permission:sales.fulfill|logistics.deliver',
        );
        Route::patch('/school-orders/{document}/deliver', 'deliverSchoolOrder')->middleware(
            'permission:sales.fulfill|logistics.deliver',
        );
    });

Route::controller(ManualSalesController::class)
    ->prefix('sales/manual')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:sales.view');
        Route::get('/report', 'report')->middleware('permission:sales.view');
        Route::get('/{document}/receipt', 'receipt')->middleware('permission:sales.view');
        Route::post('/', 'store')->middleware('permission:sales.create|sales.fulfill');
        Route::post('/{document}/payments', 'pay')->middleware('permission:sales.create|sales.fulfill');
        Route::post('/{document}/cancel', 'cancel')->middleware('permission:sales.create|sales.fulfill');
    });
