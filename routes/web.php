<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ExecutiveDashboardController;
use App\Http\Controllers\DepartmentDashboardController;
use App\Http\Controllers\FactoryContextController;
use App\Http\Controllers\FactoryFlowController;
use App\Http\Controllers\FactorySettingsController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ManufacturingController;
use App\Http\Controllers\MachineController;
use App\Http\Controllers\LogisticsController;
use App\Http\Controllers\PlatformAdminController;
use App\Http\Controllers\ProductCatalogController;
use App\Http\Controllers\ProcurementController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\QualityControlController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\SchoolPortalController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\TeamWorkspaceController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('app');
});

Route::get('/dashboard', function () {
    return view('app');
})->name('dashboard');

Route::get('/manifest.json', function () {
    $name = \App\Models\SystemSetting::valueFor('system_name', 'ICYEREKEZO OMS');
    $shortName = strlen($name) <= 12 ? $name : explode(' ', trim($name))[0];

    return response()->json([
        'name' => $name,
        'short_name' => $shortName,
        'description' => 'Factory operations, production and inventory management.',
        'start_url' => '/dashboard',
        'scope' => '/',
        'display' => 'standalone',
        'background_color' => '#f5f7fb',
        'theme_color' => '#2563eb',
        'orientation' => 'any',
        'icons' => [
            ['src' => '/assets/images/pwa/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/assets/images/pwa/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/assets/images/pwa/icon-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
        ],
    ])->header('Content-Type', 'application/manifest+json');
});

Route::prefix('api')->group(function () {
    Route::middleware('throttle:6,1')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/register-school', [AuthController::class, 'registerSchool']);
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
    });
    Route::middleware('throttle:20,1')->group(function () {
        Route::post('/auth/verify-otp', [AuthController::class, 'verifyOtp']);
    });
    Route::middleware('throttle:3,1')->group(function () {
        Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('/auth/resend-otp', [AuthController::class, 'resendOtp']);
    });
    Route::get('/auth/school-registration-options', [AuthController::class, 'schoolRegistrationOptions']);
    Route::middleware('auth')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/profile', [AuthController::class, 'profile']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::put('/profile/password', [AuthController::class, 'updatePassword'])->middleware('throttle:6,1');
        Route::post('/factories/switch', [FactoryContextController::class, 'switch']);
        Route::get('/search', SearchController::class);
        Route::get('/support/tickets', [SupportController::class, 'index']);
        Route::post('/support/tickets', [SupportController::class, 'store']);
        Route::post('/support/tickets/{ticket}/reply', [SupportController::class, 'reply']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::get('/push/vapid-public-key', [NotificationController::class, 'vapidPublicKey']);
        Route::post('/push/subscriptions', [NotificationController::class, 'storePushSubscription']);
        Route::delete('/push/subscriptions', [NotificationController::class, 'destroyPushSubscription']);
        Route::prefix('platform')->middleware('platform')->group(function () {
            Route::get('/overview', [PlatformAdminController::class, 'overview']);
            Route::get('/factories', [PlatformAdminController::class, 'factories']);
            Route::post('/factories', [PlatformAdminController::class, 'storeFactory']);
            Route::patch('/factories/{factory}', [PlatformAdminController::class, 'updateFactory']);
            Route::get('/users', [PlatformAdminController::class, 'users']);
            Route::post('/users', [PlatformAdminController::class, 'storeFactoryUser']);
            Route::patch('/users/{user}', [PlatformAdminController::class, 'updateUser']);
            Route::put('/users/{user}/password', [PlatformAdminController::class, 'resetPassword']);
            Route::post('/plans', [PlatformAdminController::class, 'storePlan']);
            Route::put('/plans/{plan}', [PlatformAdminController::class, 'updatePlan']);
            Route::get('/subscriptions', [PlatformAdminController::class, 'subscriptions']);
            Route::post('/factories/{factory}/subscriptions', [PlatformAdminController::class, 'subscribe']);
            Route::patch('/subscriptions/{subscription}', [PlatformAdminController::class, 'updateSubscription']);
            Route::post('/announcements', [PlatformAdminController::class, 'announce']);
            Route::get('/announcements', [PlatformAdminController::class, 'announcements']);
            Route::get('/tickets', [PlatformAdminController::class, 'tickets']);
            Route::post('/tickets/{ticket}/reply', [PlatformAdminController::class, 'replyTicket']);
            Route::put('/settings', [PlatformAdminController::class, 'settings']);
            Route::post('/settings/logo', [PlatformAdminController::class, 'uploadLogo']);
            Route::get('/settings', [PlatformAdminController::class, 'getSettings']);
            Route::post('/backups', [PlatformAdminController::class, 'backup']);
            Route::get('/backups', [PlatformAdminController::class, 'backups']);
        });
        Route::middleware('tenant')->group(function () {
            Route::get('/executive/dashboard', ExecutiveDashboardController::class);
            Route::get('/department/dashboard', DepartmentDashboardController::class);
            Route::get('/factory/flow-suggestion', [FactoryFlowController::class, 'suggestion'])->middleware('permission:factory.manage');
            Route::post('/factory/flow-suggestion/apply', [FactoryFlowController::class, 'apply'])->middleware('permission:factory.manage');
            Route::get('/factory/settings', [FactorySettingsController::class, 'show'])->middleware('permission:factory.manage');
            Route::put('/factory/settings', [FactorySettingsController::class, 'update'])->middleware('permission:factory.manage');
            Route::get('/reports', ReportController::class)->middleware('permission:reports.view');
            Route::get('/reports/daily.xlsx', [ReportController::class, 'exportDaily'])->middleware('permission:reports.view');
            Route::get('/reports/orders.xlsx', [ReportController::class, 'exportOrders'])->middleware('permission:reports.view');
            Route::get('/inventory/overview', [InventoryController::class, 'overview'])->middleware('permission:inventory.view');
            Route::get('/inventory/items', [InventoryController::class, 'items'])->middleware('permission:products.view');
            Route::get('/products/overview', ProductCatalogController::class)->middleware('permission:products.view');
            Route::post('/products/categories', [ProductCatalogController::class, 'storeCategory'])->middleware('permission:inventory.receive');
            Route::patch('/products/categories/{category}', [ProductCatalogController::class, 'updateCategory'])->middleware('permission:inventory.receive');
            Route::delete('/products/categories/{category}', [ProductCatalogController::class, 'destroyCategory'])->middleware('permission:inventory.receive');
            Route::post('/products/units', [ProductCatalogController::class, 'storeUnit'])->middleware('permission:inventory.receive');
            Route::patch('/products/units/{unit}', [ProductCatalogController::class, 'updateUnit'])->middleware('permission:inventory.receive');
            Route::get('/inventory/tools', [InventoryController::class, 'tools'])->middleware('permission:inventory.view');
            Route::post('/inventory/items', [InventoryController::class, 'storeItem'])->middleware('permission:inventory.receive');
            Route::post('/inventory/batches', [InventoryController::class, 'storeBatch'])->middleware('permission:inventory.issue');
            Route::post('/inventory/finished-items', [InventoryController::class, 'storeFinishedItem'])->middleware('permission:inventory.issue');
            Route::patch('/inventory/items/{item}', [InventoryController::class, 'updateItem'])->middleware('permission:inventory.receive');
            Route::post('/inventory/transactions', [InventoryController::class, 'postTransaction'])->middleware('permission:inventory.adjust|inventory.issue');
            Route::patch('/inventory/transactions/{transaction}/correct', [InventoryController::class, 'correctTransaction'])->middleware('permission:inventory.adjust|inventory.issue');
            Route::post('/inventory/transfers', [InventoryController::class, 'transfer'])->middleware('permission:inventory.adjust');
            Route::post('/inventory/stock-counts', [InventoryController::class, 'stockCount'])->middleware('permission:inventory.adjust');
            Route::patch('/inventory/items/{item}/status', [InventoryController::class, 'updateItemStatus'])->middleware('permission:inventory.adjust');
            Route::get('/factory/setup-options', [InventoryController::class, 'setup'])->middleware('permission:factory.view');
            Route::post('/factory/units', [InventoryController::class, 'storeUnit'])->middleware('permission:factory.manage');
            Route::post('/factory/warehouses', [InventoryController::class, 'storeWarehouse'])->middleware('permission:factory.manage');
            Route::get('/team/workspaces', [TeamWorkspaceController::class, 'index'])->middleware('permission:users.view');
            Route::post('/team/users', [TeamWorkspaceController::class, 'storeUser'])->middleware('permission:users.create');
            Route::patch('/team/users/{user}', [TeamWorkspaceController::class, 'updateUser'])->middleware('permission:users.update');
            Route::post('/team/users/{user}/reset-password', [TeamWorkspaceController::class, 'resetPassword'])->middleware('permission:users.update');
            Route::delete('/team/users/{user}', [TeamWorkspaceController::class, 'destroyUser'])->middleware('permission:users.update');
            Route::post('/team/roles', [TeamWorkspaceController::class, 'storeRole'])->middleware('permission:users.assign_roles');
            Route::post('/team/workstations', [TeamWorkspaceController::class, 'storeWorkstation'])->middleware('permission:factory.manage');
            Route::post('/team/departments', [TeamWorkspaceController::class, 'storeDepartment'])->middleware('permission:factory.manage|users.update');
            Route::patch('/team/departments/{department}', [TeamWorkspaceController::class, 'updateDepartment'])->middleware('permission:factory.manage|users.update');
            Route::post('/team/assignments', [TeamWorkspaceController::class, 'assign'])->middleware('permission:users.update');
            Route::patch('/team/assignments/{assignment}', [TeamWorkspaceController::class, 'updateAssignment']);
            Route::get('/manufacturing/overview', [ManufacturingController::class, 'overview'])->middleware('permission:production.view');
            Route::get('/sales/overview', [SalesController::class, 'overview'])->middleware('permission:sales.view');
            Route::get('/sales/orders/{document}/pdf', [SalesController::class, 'orderPdf'])->middleware('permission:sales.view');
            Route::patch('/sales/orders/{document}/decision', [SalesController::class, 'decide'])->middleware('permission:sales.fulfill');
            Route::delete('/sales/orders/{document}', [SalesController::class, 'destroy'])->middleware('permission:sales.fulfill');
            Route::post('/sales/school-orders', [SalesController::class, 'storeSchoolOrder'])->middleware('permission:sales.create|sales.fulfill');
            Route::patch('/sales/school-order-lines/{line}', [SalesController::class, 'updateSchoolOrderLine'])->middleware('permission:sales.fulfill');
            Route::get('/school/overview', [SchoolPortalController::class, 'overview']);
            Route::post('/school/orders', [SchoolPortalController::class, 'storeOrder']);
            Route::post('/school/orders/{document}/payments', [SchoolPortalController::class, 'payment']);
            Route::post('/school/orders/{document}/returns', [SchoolPortalController::class, 'returnItems']);
            Route::put('/school/profile', [SchoolPortalController::class, 'updateProfile']);
            Route::get('/school/orders/{document}/pdf', [SchoolPortalController::class, 'pdf']);
            Route::get('/logistics/overview', [LogisticsController::class, 'overview'])->middleware('permission:logistics.view');
            Route::post('/logistics/shipments', [LogisticsController::class, 'storeShipment'])->middleware('permission:logistics.plan');
            Route::patch('/logistics/shipments/{shipment}', [LogisticsController::class, 'updateShipment'])->middleware('permission:logistics.dispatch|logistics.deliver');
            Route::post('/logistics/vehicles', [LogisticsController::class, 'storeVehicle'])->middleware('permission:logistics.plan');
            Route::patch('/logistics/vehicles/{vehicle}', [LogisticsController::class, 'updateVehicle'])->middleware('permission:logistics.plan');
            Route::delete('/logistics/vehicles/{vehicle}', [LogisticsController::class, 'destroyVehicle'])->middleware('permission:logistics.plan');
            Route::get('/procurement/overview', [ProcurementController::class, 'overview'])->middleware('permission:procurement.view');
            Route::post('/procurement/suppliers', [ProcurementController::class, 'storeSupplier'])->middleware('permission:procurement.create');
            Route::put('/procurement/suppliers/{supplier}/prices', [ProcurementController::class, 'savePrice'])->middleware('permission:procurement.create');
            Route::post('/procurement/requests', [ProcurementController::class, 'storeRequest'])->middleware('permission:procurement.create');
            Route::post('/procurement/requests/{document}/approve', [ProcurementController::class, 'approveRequest'])->middleware('permission:procurement.approve');
            Route::post('/procurement/requests/{document}/order', [ProcurementController::class, 'createOrder'])->middleware('permission:procurement.create');
            Route::post('/procurement/orders/{document}/receive', [ProcurementController::class, 'receive'])->middleware('permission:procurement.receive');
            Route::post('/procurement/orders/{document}/payments', [ProcurementController::class, 'recordPayment'])->middleware('permission:finance.receive_payment');
            Route::post('/manufacturing/boms', [ManufacturingController::class, 'storeBom'])->middleware('permission:production.plan');
            Route::post('/manufacturing/workflows', [ManufacturingController::class, 'storeWorkflow'])->middleware('permission:factory.manage');
            Route::put('/manufacturing/workflows/{workflow}', [ManufacturingController::class, 'updateWorkflow'])->middleware('permission:factory.manage');
            Route::post('/manufacturing/orders', [ManufacturingController::class, 'storeOrder'])->middleware('permission:production.plan');
            Route::post('/manufacturing/orders/{order}/approve', [ManufacturingController::class, 'approveOrder'])->middleware('permission:production.approve');
            Route::patch('/manufacturing/stages/{execution}', [ManufacturingController::class, 'updateStage'])->middleware('permission:production.execute');
            Route::get('/quality/overview', [QualityControlController::class, 'index'])->middleware('permission:quality.view');
            Route::post('/quality/inspections', [QualityControlController::class, 'store'])->middleware('permission:quality.inspect');
            Route::post('/quality/inspections/{inspection}/approve', [QualityControlController::class, 'approve'])->middleware('permission:quality.approve');
            Route::get('/machines/overview', [MachineController::class, 'index'])->middleware('permission:maintenance.view');
            Route::post('/machines', [MachineController::class, 'storeMachine'])->middleware('permission:factory.manage');
            Route::patch('/machines/{machine}', [MachineController::class, 'updateMachine'])->middleware('permission:maintenance.execute');
            Route::post('/maintenance', [MachineController::class, 'storeMaintenance'])->middleware('permission:maintenance.create');
            Route::patch('/maintenance/{maintenance}', [MachineController::class, 'updateMaintenance'])->middleware('permission:maintenance.execute');
        });
    });
});

Route::get('/{path?}', fn () => view('app'))->where('path', '^(?!api(?:/|$)).*');
