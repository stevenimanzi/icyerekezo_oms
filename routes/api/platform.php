<?php

use App\Http\Controllers\Admin\PlatformAnnouncementController;
use App\Http\Controllers\Admin\PlatformAuditLogController;
use App\Http\Controllers\Admin\PlatformBackupController;
use App\Http\Controllers\Admin\PlatformFactoryController;
use App\Http\Controllers\Admin\PlatformOverviewController;
use App\Http\Controllers\Admin\PlatformSettingsController;
use App\Http\Controllers\Admin\PlatformSubscriptionController;
use App\Http\Controllers\Admin\PlatformSupportController;
use App\Http\Controllers\Admin\PlatformUserController;
use Illuminate\Support\Facades\Route;

Route::get('/overview', [PlatformOverviewController::class, 'overview']);

Route::controller(PlatformFactoryController::class)->group(function () {
    Route::get('/factories', 'factories');
    Route::post('/factories', 'storeFactory');
    Route::patch('/factories/{factory}', 'updateFactory');
    Route::delete('/factories/{factory}', 'destroyFactory');
});

Route::controller(PlatformUserController::class)->group(function () {
    Route::get('/users', 'users');
    Route::post('/users', 'storeFactoryUser');
    Route::patch('/users/{user}', 'updateUser');
    Route::delete('/users/{user}', 'destroyUser');
    Route::put('/users/{user}/password', 'resetPassword');
});

Route::controller(PlatformSubscriptionController::class)->group(function () {
    Route::post('/plans', 'storePlan');
    Route::put('/plans/{plan}', 'updatePlan');
    Route::get('/subscriptions', 'subscriptions');
    Route::post('/factories/{factory}/subscriptions', 'subscribe');
    Route::patch('/subscriptions/{subscription}', 'updateSubscription');
});

Route::controller(PlatformAnnouncementController::class)->group(function () {
    Route::post('/announcements', 'announce');
    Route::get('/announcements', 'announcements');
});

Route::controller(PlatformSupportController::class)->group(function () {
    Route::get('/tickets', 'tickets');
    Route::post('/tickets/{ticket}/reply', 'replyTicket');
});

Route::controller(PlatformSettingsController::class)->group(function () {
    Route::put('/settings', 'settings');
    Route::post('/settings/logo', 'uploadLogo');
    Route::get('/settings', 'getSettings');
});

Route::controller(PlatformBackupController::class)->group(function () {
    Route::post('/backups', 'backup');
    Route::get('/backups', 'backups');
});

Route::get('/audit-logs', [PlatformAuditLogController::class, 'auditLogs']);
