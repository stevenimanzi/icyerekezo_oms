<?php

use App\Http\Controllers\Reports\ReportController;
use Illuminate\Support\Facades\Route;

Route::controller(ReportController::class)
    ->prefix('reports')
    ->group(function () {
        Route::get('/daily.xlsx', 'exportDaily')->middleware('permission:reports.view');
        Route::get('/orders.xlsx', 'exportOrders')->middleware('permission:reports.view');
        Route::get('/summary.xlsx', 'exportSummary')->middleware('permission:reports.view');
    });

Route::get('/reports', ReportController::class)->middleware('permission:reports.view');
