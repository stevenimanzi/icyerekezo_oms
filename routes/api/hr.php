<?php

use App\Http\Controllers\Hr\HrController;
use Illuminate\Support\Facades\Route;

Route::controller(HrController::class)
    ->prefix('hr')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:hr.view');
        Route::post('/attendance', 'storeAttendance')->middleware('permission:hr.manage_attendance');
        Route::post('/leave-requests', 'storeLeaveRequest')->middleware('permission:hr.manage_leave');
        Route::post('/leave-requests/{leaveRequest}/decision', 'decideLeaveRequest')->middleware('permission:hr.manage_leave');
        Route::post('/trainings', 'storeTraining')->middleware('permission:hr.manage_training');
        Route::patch('/training-participants/{participant}', 'updateTrainingParticipant')->middleware('permission:hr.manage_training');
    });
