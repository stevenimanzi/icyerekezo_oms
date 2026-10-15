<?php

use App\Http\Controllers\Dashboard\DepartmentDashboardController;
use App\Http\Controllers\Dashboard\ExecutiveDashboardController;
use App\Http\Controllers\Dashboard\OwnerOverviewController;
use Illuminate\Support\Facades\Route;

Route::get('/executive/dashboard', ExecutiveDashboardController::class);
Route::get('/executive/owner-overview', OwnerOverviewController::class);

Route::get('/department/dashboard', DepartmentDashboardController::class);
