<?php

use App\Http\Controllers\Dashboard\DepartmentDashboardController;
use App\Http\Controllers\Dashboard\ExecutiveDashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/executive/dashboard', ExecutiveDashboardController::class);

Route::get('/department/dashboard', DepartmentDashboardController::class);
