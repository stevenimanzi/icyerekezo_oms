<?php

use App\Http\Controllers\Admin\PlatformAdminController;
use Illuminate\Support\Facades\Route;

Route::controller(PlatformAdminController::class)
    ->group(function () {
        Route::get('/overview', 'overview');
        Route::get('/factories', 'factories');
        Route::post('/factories', 'storeFactory');
        Route::patch('/factories/{factory}', 'updateFactory');
        Route::delete('/factories/{factory}', 'destroyFactory');
        Route::get('/users', 'users');
        Route::post('/users', 'storeFactoryUser');
        Route::patch('/users/{user}', 'updateUser');
        Route::delete('/users/{user}', 'destroyUser');
        Route::put('/users/{user}/password', 'resetPassword');
        Route::post('/plans', 'storePlan');
        Route::put('/plans/{plan}', 'updatePlan');
        Route::get('/subscriptions', 'subscriptions');
        Route::post('/factories/{factory}/subscriptions', 'subscribe');
        Route::patch('/subscriptions/{subscription}', 'updateSubscription');
        Route::post('/announcements', 'announce');
        Route::get('/announcements', 'announcements');
        Route::get('/tickets', 'tickets');
        Route::post('/tickets/{ticket}/reply', 'replyTicket');
        Route::put('/settings', 'settings');
        Route::post('/settings/logo', 'uploadLogo');
        Route::get('/settings', 'getSettings');
        Route::post('/backups', 'backup');
        Route::get('/backups', 'backups');
        Route::get('/audit-logs', 'auditLogs');
    });
