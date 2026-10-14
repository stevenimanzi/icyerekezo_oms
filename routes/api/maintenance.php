<?php

use App\Http\Controllers\Production\MachineController;
use Illuminate\Support\Facades\Route;

Route::controller(MachineController::class)
    ->prefix('machines')
    ->group(function () {
        Route::get('/overview', 'index')->middleware('permission:maintenance.view');
        Route::post('/', 'storeMachine')->middleware('permission:factory.manage');
        Route::patch('/{machine}', 'updateMachine')->middleware('permission:maintenance.execute');
    });

Route::controller(MachineController::class)
    ->prefix('maintenance')
    ->group(function () {
        Route::post('/', 'storeMaintenance')->middleware('permission:maintenance.create');
        Route::patch('/{maintenance}', 'updateMaintenance')->middleware('permission:maintenance.execute');
    });
