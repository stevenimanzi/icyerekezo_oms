<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Factory\FactoryContextController;
use App\Http\Controllers\System\NotificationController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\System\SearchController;
use App\Http\Controllers\System\SupportController;

Route::controller(AuthController::class)
    ->prefix('auth')
    ->group(function () {
        Route::get('/me', 'me');
        Route::post('/logout', 'logout');
    });

Route::controller(AuthController::class)
    ->prefix('profile')
    ->group(function () {
        Route::get('/', 'profile');
        Route::put('/', 'updateProfile');
        Route::put('/password', 'updatePassword')->middleware('throttle:6,1');
    });

Route::post('/factories/switch', [FactoryContextController::class, 'switch']);

Route::get('/search', SearchController::class);

Route::controller(SupportController::class)
    ->prefix('support')
    ->group(function () {
        Route::get('/tickets', 'index');
        Route::post('/tickets', 'store');
        Route::post('/tickets/{ticket}/reply', 'reply');
    });

Route::controller(NotificationController::class)
    ->prefix('notifications')
    ->group(function () {
        Route::get('/', 'index');
        Route::post('/{id}/read', 'markRead');
        Route::post('/read-all', 'markAllRead');
    });

Route::controller(NotificationController::class)
    ->prefix('push')
    ->group(function () {
        Route::get('/vapid-public-key', 'vapidPublicKey');
        Route::post('/subscriptions', 'storePushSubscription');
        Route::delete('/subscriptions', 'destroyPushSubscription');
    });
