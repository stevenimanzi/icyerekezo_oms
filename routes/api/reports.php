<?php

use App\Http\Controllers\Reports\DepartmentReportController;
use App\Http\Controllers\Reports\ExecutiveReportController;
use App\Http\Controllers\Reports\ExportController;
use App\Http\Controllers\Reports\ReportController;
use Illuminate\Support\Facades\Route;

Route::controller(ReportController::class)
    ->prefix('reports')
    ->group(function () {
        Route::get('/daily.xlsx', 'exportDaily')->middleware('permission:reports.view');
        Route::get('/daily.pdf', 'exportDailyPdf')->middleware('permission:reports.view');
        Route::get('/orders.xlsx', 'exportOrders')->middleware('permission:reports.view');
        Route::get('/summary.xlsx', 'exportSummary')->middleware('permission:reports.view');
    });

Route::get('/reports/department', DepartmentReportController::class)->middleware('permission:reports.view');
Route::get('/reports/overview', ExecutiveReportController::class)->middleware('permission:reports.view');
Route::get('/reports', ReportController::class)->middleware('permission:reports.view');

Route::post('/exports/{format}', ExportController::class)
    ->whereIn('format', ['pdf', 'xlsx'])
    ->middleware('permission:reports.view|finance.view|sales.view|inventory.view|production.view|procurement.view|quality.view|logistics.view|hr.view|safety.view|maintenance.view|audit.view');
