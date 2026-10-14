<?php

use App\Http\Controllers\Procurement\ProcurementController;
use Illuminate\Support\Facades\Route;

Route::controller(ProcurementController::class)
    ->prefix('procurement')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:procurement.view');
        Route::post('/suppliers', 'storeSupplier')->middleware('permission:procurement.create');
        Route::put('/suppliers/{supplier}/prices', 'savePrice')->middleware('permission:procurement.create');
        Route::post('/requests', 'storeRequest')->middleware('permission:procurement.create');
        Route::post('/requests/{document}/approve', 'approveRequest')->middleware('permission:procurement.approve');
        Route::post('/requests/{document}/order', 'createOrder')->middleware('permission:procurement.create');
        Route::post('/orders/{document}/receive', 'receive')->middleware('permission:procurement.receive');
        Route::post('/orders/{document}/payments', 'recordPayment')->middleware('permission:finance.receive_payment');
    });
