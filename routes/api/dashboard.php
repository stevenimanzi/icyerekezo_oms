<?php

use App\Http\Controllers\Dashboard\DepartmentDashboardController;
use App\Http\Controllers\Dashboard\ExecutiveDashboardController;
use App\Http\Controllers\Dashboard\OwnerActivityController;
use App\Http\Controllers\Dashboard\OwnerOverviewController;
use Illuminate\Support\Facades\Route;

Route::get('/executive/dashboard', ExecutiveDashboardController::class)->middleware('executive');
Route::get('/executive/owner-overview', OwnerOverviewController::class)->middleware('executive');
Route::get('/executive/activity', OwnerActivityController::class)->middleware('permission:audit.view');

Route::get('/department/dashboard', DepartmentDashboardController::class);
