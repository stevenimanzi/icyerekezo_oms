<?php

use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;

Route::controller(AuthController::class)
    ->prefix('auth')
    ->group(function () {
        Route::middleware('throttle:6,1')->group(function () {
            Route::post('/register', 'register');
            Route::post('/register-school', 'registerSchool');
            Route::post('/login', 'login');
            Route::post('/reset-password', 'resetPassword');
        });

        Route::post('/verify-otp', 'verifyOtp')->middleware('throttle:20,1');

        Route::middleware('throttle:3,1')->group(function () {
            Route::post('/forgot-password', 'forgotPassword');
            Route::post('/resend-otp', 'resendOtp');
        });

        Route::get('/school-registration-options', 'schoolRegistrationOptions');
    });
