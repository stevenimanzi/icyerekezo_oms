<?php

use App\Http\Controllers\System\ManifestController;
use App\Http\Controllers\System\PrivateFileController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', fn () => view('app'))->name('dashboard');
Route::get('/manifest.json', ManifestController::class);

Route::prefix('api')->group(function () {
    Route::get('/files', PrivateFileController::class)
        ->middleware(['signed:relative', 'throttle:60,1'])
        ->name('files.show');

    Route::group([], base_path('routes/api/auth.php'));

    Route::middleware('auth')->group(function () {
        Route::group([], base_path('routes/api/account.php'));

        Route::prefix('platform')->middleware('platform')->group(base_path('routes/api/platform.php'));

        Route::middleware('tenant')->group(function () {
            Route::group([], base_path('routes/api/chat.php'));
            Route::group([], base_path('routes/api/dashboard.php'));
            Route::group([], base_path('routes/api/factory.php'));
            Route::group([], base_path('routes/api/team.php'));
            Route::group([], base_path('routes/api/hr.php'));
            Route::group([], base_path('routes/api/safety.php'));
            Route::group([], base_path('routes/api/inventory.php'));
            Route::group([], base_path('routes/api/procurement.php'));
            Route::group([], base_path('routes/api/production.php'));
            Route::group([], base_path('routes/api/quality.php'));
            Route::group([], base_path('routes/api/maintenance.php'));
            Route::group([], base_path('routes/api/sales.php'));
            Route::group([], base_path('routes/api/school.php'));
            Route::group([], base_path('routes/api/logistics.php'));
            Route::group([], base_path('routes/api/finance.php'));
            Route::group([], base_path('routes/api/reports.php'));
        });
    });
});

Route::get('/{path?}', fn () => view('app'))->where('path', '^(?!api(?:/|$)).*')->name('login');
