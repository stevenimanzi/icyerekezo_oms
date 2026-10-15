<?php

use App\Http\Controllers\System\ChatController;
use Illuminate\Support\Facades\Route;

Route::controller(ChatController::class)
    ->prefix('chat')
    ->group(function () {
        Route::get('/overview', 'overview');
        Route::get('/unread', 'unread');
        Route::post('/direct', 'direct');
        Route::get('/conversations/{conversation}/messages', 'messages');
        Route::post('/conversations/{conversation}/messages', 'send')->middleware('throttle:60,1');
    });
