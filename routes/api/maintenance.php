<?php

use App\Http\Controllers\Production\MachineController;
use App\Http\Controllers\Production\MachinePerformanceController;
use Illuminate\Support\Facades\Route;

Route::controller(MachineController::class)
    ->prefix('machines')
    ->group(function () {
        Route::get('/overview', 'index')->middleware('permission:maintenance.view');
        Route::post('/', 'storeMachine')->middleware('permission:factory.manage|maintenance.manage');
        Route::patch('/{machine}', 'updateMachine')->middleware('permission:maintenance.execute|maintenance.manage|factory.manage');
    });

Route::controller(MachinePerformanceController::class)->group(function () {
    Route::get('/machines/list', 'machines')->middleware('permission:maintenance.view');
    Route::get('/machines/{machine}/history', 'history')->middleware('permission:maintenance.view');

    Route::prefix('maintenance')->group(function () {
        Route::get('/dashboard', 'dashboard')->middleware('permission:maintenance.view');
        Route::get('/jobs', 'jobs')->middleware('permission:maintenance.view');
        Route::get('/performance', 'performance')->middleware('permission:maintenance.view');
        Route::post('/performance', 'storePerformance')->middleware('permission:maintenance.create');
        Route::patch('/performance/{log}', 'updatePerformance')->middleware('permission:maintenance.create');
        Route::delete('/performance/{log}', 'destroyPerformance')->middleware('permission:maintenance.create');
    });
});

Route::controller(MachineController::class)
    ->prefix('maintenance')
    ->group(function () {
        Route::post('/', 'storeMaintenance')->middleware('permission:maintenance.create');
        Route::patch('/{maintenance}', 'updateMaintenance')->middleware('permission:maintenance.execute|maintenance.manage');
    });
