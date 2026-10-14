<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\School\SchoolPortalController;

Route::controller(SchoolPortalController::class)
    ->prefix('school')
    ->group(function () {
        Route::get('/overview', 'overview');
        Route::post('/orders', 'storeOrder');
        Route::post('/orders/{document}/payments', 'payment');
        Route::post('/orders/{document}/returns', 'returnItems');
        Route::put('/profile', 'updateProfile');
        Route::post('/agreement', 'uploadAgreementSignature');
        Route::get('/orders/{document}/pdf', 'pdf');
    });
