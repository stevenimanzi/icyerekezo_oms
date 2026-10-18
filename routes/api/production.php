<?php

use App\Http\Controllers\Production\ManufacturingController;
use App\Http\Controllers\Production\ProductionFlowController;
use Illuminate\Support\Facades\Route;

Route::controller(ManufacturingController::class)
    ->prefix('manufacturing')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:production.view');
        Route::post('/boms', 'storeBom')->middleware('permission:production.plan');
        Route::post('/workflows', 'storeWorkflow')->middleware('permission:factory.manage');
        Route::put('/workflows/{workflow}', 'updateWorkflow')->middleware('permission:factory.manage');
        Route::post('/orders', 'storeOrder')->middleware('permission:production.plan');
        Route::post('/orders/{order}/approve', 'approveOrder')->middleware('permission:production.approve');
        Route::patch('/stages/{execution}', 'updateStage')->middleware('permission:production.execute');
    });

Route::controller(ProductionFlowController::class)
    ->prefix('flow')
    ->group(function () {
        Route::get('/overview', 'overview')->middleware('permission:production.view');
        Route::get('/monitor', 'monitor')->middleware('permission:production.view|quality.view');
        Route::get('/factory-report', 'factoryReport')->middleware('permission:reports.view');
        Route::get('/factory-report.xlsx', 'factoryReportExcel')->middleware('permission:reports.view');
        Route::get('/factory-report.pdf', 'factoryReportPdf')->middleware('permission:reports.view');
        Route::get('/cutting-report.pdf', 'cuttingReportPdf')->middleware('permission:production.view|reports.view');
        Route::get('/report', 'report')->middleware('permission:production.view|quality.view');
        Route::get('/lots/{lot}', 'lot')->middleware('permission:production.view|quality.view');

        Route::get('/requests', 'requests')->middleware('permission:inventory.issue|production.view');
        Route::post('/requests', 'storeRequest')->middleware('permission:production.execute');
        Route::post('/requests/{materialRequest}/decision', 'decide')->middleware('permission:inventory.issue');
        Route::post('/requests/{materialRequest}/cancel', 'cancelRequest')->middleware('permission:production.execute');
        Route::post('/requests/{materialRequest}/answer', 'answerRequest')->middleware('permission:production.execute');

        Route::post('/cutting', 'cut')->middleware('permission:production.execute');
        Route::post('/fabric-loss', 'fabricLoss')->middleware('permission:production.execute');
        Route::post('/lots/{lot}/entries', 'work')->middleware('permission:production.execute');
        Route::post('/lots/{lot}/send', 'send')->middleware('permission:production.execute');
        Route::post('/transfers/{transfer}/receive', 'receive')->middleware('permission:production.execute');
        Route::post('/transfers/{transfer}/cancel', 'cancelTransfer')->middleware('permission:production.execute');
        Route::get('/stock-handovers', 'stockHandovers')->middleware('permission:inventory.view|production.view');
        Route::post('/lots/{lot}/stock-handover', 'sendToStock')->middleware('permission:production.execute');
        Route::post('/stock-handovers/{handover}/receive', 'receiveStock')->middleware('permission:inventory.issue');
        Route::post('/stock-handovers/{handover}/cancel', 'cancelStockHandover')->middleware('permission:production.execute');
        Route::post('/entries/{entry}/void', 'voidEntry')->middleware('permission:production.execute');

        Route::post('/inspections', 'inspect')->middleware('permission:quality.inspect');
        Route::post('/lots/{lot}/hold', 'hold')->middleware('permission:quality.inspect');
        Route::post('/lots/{lot}/release', 'release')->middleware('permission:quality.inspect');
    });
