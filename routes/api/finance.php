<?php

use App\Http\Controllers\Finance\FinanceController;
use Illuminate\Support\Facades\Route;

Route::controller(FinanceController::class)
    ->prefix('finance')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:finance.view');
        Route::get('/report', 'report')->middleware('permission:finance.view');
        Route::post('/payments/{submission}/decision', 'decidePayment')->middleware('permission:finance.approve');
    });
