<?php

use App\Http\Controllers\Hr\HrController;
use App\Http\Controllers\Hr\HrWorkforceController;
use Illuminate\Support\Facades\Route;

Route::controller(HrController::class)
    ->prefix('hr')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:hr.view');
        Route::post('/attendance', 'storeAttendance')->middleware('permission:hr.manage_attendance');
        Route::post('/leave-requests', 'storeLeaveRequest')->middleware('permission:hr.manage_leave');
        Route::post('/leave-requests/{leaveRequest}/decision', 'decideLeaveRequest')->middleware(
            'permission:hr.manage_leave',
        );
        Route::post('/trainings', 'storeTraining')->middleware('permission:hr.manage_training');
        Route::patch('/training-participants/{participant}', 'updateTrainingParticipant')->middleware(
            'permission:hr.manage_training',
        );
    });

Route::controller(HrWorkforceController::class)
    ->prefix('hr')
    ->group(function () {
        Route::get('/dashboard', 'dashboard')->middleware('permission:hr.view');
        Route::get('/employees', 'employeesIndex')->middleware('permission:hr.view');
        Route::put('/employees/{user}', 'updateEmployee')->middleware('permission:hr.manage_employees');
        Route::get('/attendance-register', 'attendanceRegister')->middleware('permission:hr.view');
        Route::post('/attendance-register', 'saveAttendanceRegister')->middleware('permission:hr.manage_attendance');
        Route::get('/attendance-summary', 'attendanceSummary')->middleware('permission:hr.view');
        Route::get('/leave', 'leaveIndex')->middleware('permission:hr.view');
        Route::get('/overtime', 'overtimeIndex')->middleware('permission:hr.view');
        Route::post('/overtime', 'storeOvertime')->middleware('permission:hr.manage_attendance');
        Route::post('/overtime/{overtime}/decision', 'decideOvertime')->middleware('permission:hr.manage_attendance');
        Route::get('/payroll', 'payrollIndex')->middleware('permission:hr.view');
        Route::post('/payroll', 'createPayroll')->middleware('permission:hr.manage_employees');
        Route::get('/payroll/{run}', 'payrollShow')->middleware('permission:hr.view|finance.view');
        Route::patch('/payroll/lines/{line}', 'updatePayrollLine')->middleware('permission:hr.manage_employees');
        Route::post('/payroll/{run}/submit', 'submitPayroll')->middleware('permission:hr.manage_employees');
        Route::post('/payroll/{run}/cancel', 'cancelPayroll')->middleware('permission:hr.manage_employees');
        Route::get('/payroll/{run}/payslips', 'payslips')->middleware('permission:hr.view|finance.view');
    });
