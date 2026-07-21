<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\FactoryContextController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ManufacturingController;
use App\Http\Controllers\TeamWorkspaceController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('app');
});

Route::get('/dashboard', function () {
    return view('app');
})->name('dashboard');

Route::prefix('api')->group(function () {
    Route::middleware('throttle:6,1')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
    });
    Route::middleware('auth')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/factories/switch', [FactoryContextController::class, 'switch']);
        Route::middleware('tenant')->group(function () {
            Route::get('/inventory/overview', [InventoryController::class, 'overview'])->middleware('permission:inventory.view');
            Route::get('/inventory/items', [InventoryController::class, 'items'])->middleware('permission:products.view');
            Route::post('/inventory/items', [InventoryController::class, 'storeItem'])->middleware('permission:products.create');
            Route::post('/inventory/transactions', [InventoryController::class, 'postTransaction'])->middleware('permission:inventory.adjust');
            Route::get('/factory/setup-options', [InventoryController::class, 'setup'])->middleware('permission:factory.view');
            Route::post('/factory/units', [InventoryController::class, 'storeUnit'])->middleware('permission:factory.manage');
            Route::post('/factory/warehouses', [InventoryController::class, 'storeWarehouse'])->middleware('permission:factory.manage');
            Route::get('/team/workspaces', [TeamWorkspaceController::class, 'index'])->middleware('permission:users.view');
            Route::post('/team/users', [TeamWorkspaceController::class, 'storeUser'])->middleware('permission:users.create');
            Route::patch('/team/users/{user}', [TeamWorkspaceController::class, 'updateUser'])->middleware('permission:users.update');
            Route::post('/team/roles', [TeamWorkspaceController::class, 'storeRole'])->middleware('permission:users.assign_roles');
            Route::post('/team/workstations', [TeamWorkspaceController::class, 'storeWorkstation'])->middleware('permission:factory.manage');
            Route::post('/team/assignments', [TeamWorkspaceController::class, 'assign'])->middleware('permission:users.update');
            Route::patch('/team/assignments/{assignment}', [TeamWorkspaceController::class, 'updateAssignment']);
            Route::get('/manufacturing/overview', [ManufacturingController::class, 'overview'])->middleware('permission:production.view');
            Route::post('/manufacturing/boms', [ManufacturingController::class, 'storeBom'])->middleware('permission:production.plan');
            Route::post('/manufacturing/workflows', [ManufacturingController::class, 'storeWorkflow'])->middleware('permission:production.plan');
            Route::post('/manufacturing/orders', [ManufacturingController::class, 'storeOrder'])->middleware('permission:production.plan');
            Route::post('/manufacturing/orders/{order}/approve', [ManufacturingController::class, 'approveOrder'])->middleware('permission:production.approve');
            Route::patch('/manufacturing/stages/{execution}', [ManufacturingController::class, 'updateStage'])->middleware('permission:production.execute');
        });
    });
});
