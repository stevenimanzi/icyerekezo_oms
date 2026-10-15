<?php

use App\Http\Controllers\Inventory\InventoryController;
use App\Http\Controllers\Inventory\ProductCatalogController;
use App\Http\Controllers\Inventory\StockMovementController;
use Illuminate\Support\Facades\Route;

Route::controller(InventoryController::class)
    ->prefix('inventory')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:inventory.view');
        Route::get('/items', 'items')->middleware('permission:products.view');
        Route::get('/tools', 'tools')->middleware('permission:inventory.view');
        Route::post('/items', 'storeItem')->middleware('permission:inventory.receive');
        Route::post('/batches', 'storeBatch')->middleware('permission:inventory.issue');
        Route::post('/finished-items', 'storeFinishedItem')->middleware('permission:inventory.issue');
        Route::patch('/items/{item}', 'updateItem')->middleware('permission:inventory.receive');
        Route::post('/transactions', 'postTransaction')->middleware('permission:inventory.adjust|inventory.issue');
        Route::patch('/transactions/{transaction}/correct', 'correctTransaction')->middleware(
            'permission:inventory.adjust|inventory.issue',
        );
        Route::post('/transfers', 'transfer')->middleware('permission:inventory.adjust');
        Route::post('/stock-counts', 'stockCount')->middleware('permission:inventory.adjust');
        Route::patch('/items/{item}/status', 'updateItemStatus')->middleware('permission:inventory.adjust');
    });

Route::controller(ProductCatalogController::class)
    ->prefix('products')
    ->group(function () {
        Route::post('/categories', 'storeCategory')->middleware('permission:inventory.receive');
        Route::patch('/categories/{category}', 'updateCategory')->middleware('permission:inventory.receive');
        Route::delete('/categories/{category}', 'destroyCategory')->middleware('permission:inventory.receive');
        Route::post('/units', 'storeUnit')->middleware('permission:inventory.receive');
        Route::patch('/units/{unit}', 'updateUnit')->middleware('permission:inventory.receive');
    });

Route::get('/products/overview', ProductCatalogController::class)->middleware('permission:products.view');

Route::controller(StockMovementController::class)
    ->prefix('stock')
    ->group(function () {
        Route::get('/analytics', 'analytics')->middleware('permission:inventory.view');
        Route::get('/movements', 'index')->middleware('permission:inventory.view');
        Route::post('/suppliers', 'storeSupplier')->middleware('permission:inventory.receive');
        Route::post('/receipts', 'receive')->middleware('permission:inventory.receive');
        Route::post('/issues', 'issue')->middleware('permission:inventory.issue');
    });
