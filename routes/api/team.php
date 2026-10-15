<?php

use App\Http\Controllers\Team\TeamWorkspaceController;
use Illuminate\Support\Facades\Route;

Route::controller(TeamWorkspaceController::class)
    ->prefix('team')
    ->group(function () {
        Route::get('/workspaces', 'index')->middleware('permission:users.view');
        Route::post('/users', 'storeUser')->middleware('permission:users.create');
        Route::patch('/users/{user}', 'updateUser')->middleware('permission:users.update');
        Route::post('/users/{user}/reset-password', 'resetPassword')->middleware('permission:users.update');
        Route::delete('/users/{user}', 'destroyUser')->middleware('permission:users.update');
        Route::patch('/departments/{department}', 'updateDepartment')->middleware(
            'permission:factory.manage|users.update',
        );
        Route::post('/assignments', 'assign')->middleware('permission:users.update');
        Route::patch('/assignments/{assignment}', 'updateAssignment');
    });
