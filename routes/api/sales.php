<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Sales\SalesController;

Route::controller(SalesController::class)
    ->prefix('sales')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:sales.view');
        Route::get('/orders/{document}/pdf', 'orderPdf')->middleware('permission:sales.view');
        Route::patch('/orders/{document}/decision', 'decide')->middleware('permission:sales.fulfill|logistics.plan|logistics.dispatch|logistics.deliver');
        Route::delete('/orders/{document}', 'destroy')->middleware('permission:sales.fulfill|logistics.plan|logistics.dispatch|logistics.deliver');
        Route::post('/orders/{document}/invoice', 'uploadInvoice')->middleware('permission:sales.fulfill');
        Route::post('/school-orders', 'storeSchoolOrder')->middleware('permission:sales.create|sales.fulfill');
        Route::patch('/school-order-lines/{line}/pack', 'packSchoolOrderLine')->middleware('permission:sales.pack');
        Route::patch('/school-order-lines/{line}/deliver', 'deliverSchoolOrderLine')->middleware('permission:sales.fulfill|logistics.deliver');
        Route::patch('/school-orders/{document}/deliver', 'deliverSchoolOrder')->middleware('permission:sales.fulfill|logistics.deliver');
    });
