<?php

use App\Http\Controllers\Production\QualityControlController;
use Illuminate\Support\Facades\Route;

Route::controller(QualityControlController::class)
    ->prefix('quality')
    ->group(function () {
        Route::get('/overview', 'index')->middleware('permission:quality.view');
        Route::get('/dashboard', 'dashboard')->middleware('permission:quality.view');
        Route::post('/inspections', 'store')->middleware('permission:quality.inspect');
        Route::post('/inspections/{inspection}/approve', 'approve')->middleware('permission:quality.approve');
    });
