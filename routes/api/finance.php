<?php

use App\Http\Controllers\Finance\FinanceBooksController;
use App\Http\Controllers\Finance\FinanceController;
use Illuminate\Support\Facades\Route;

Route::controller(FinanceController::class)
    ->prefix('finance')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:finance.view');
        Route::get('/report', 'report')->middleware('permission:finance.view');
        Route::post('/payments/{submission}/decision', 'decidePayment')->middleware('permission:finance.approve');
    });

Route::controller(FinanceBooksController::class)
    ->prefix('finance/books')
    ->group(function () {
        Route::get('/cashbook', 'cashbook')->middleware('permission:finance.view');
        Route::post('/entries', 'store')->middleware('permission:finance.manage_books');
        Route::post('/entries/{entry}/void', 'void')->middleware('permission:finance.manage_books');
        Route::get('/clients', 'clients')->middleware('permission:finance.view|sales.view');
        Route::get('/clients/detail', 'clientDetail')->middleware('permission:finance.view|sales.view');
        Route::get('/sold-goods', 'soldGoods')->middleware('permission:finance.view|sales.view');
    });
