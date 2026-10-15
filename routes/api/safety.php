<?php

use App\Http\Controllers\Safety\SafetyController;
use Illuminate\Support\Facades\Route;

Route::controller(SafetyController::class)
    ->prefix('safety')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:safety.view');
        Route::post('/incidents', 'storeIncident')->middleware('permission:safety.manage_incidents');
        Route::patch('/incidents/{incident}', 'updateIncident')->middleware('permission:safety.manage_incidents');
        Route::post('/inspections', 'storeInspection')->middleware('permission:safety.inspect');
        Route::post('/ppe', 'storePpeAssignment')->middleware('permission:safety.manage_equipment');
        Route::post('/ppe/{assignment}/return', 'returnPpeAssignment')->middleware(
            'permission:safety.manage_equipment',
        );
        Route::post('/corrective-actions', 'storeCorrectiveAction')->middleware('permission:safety.manage_actions');
        Route::patch('/corrective-actions/{action}', 'updateCorrectiveAction')->middleware(
            'permission:safety.manage_actions',
        );
    });
