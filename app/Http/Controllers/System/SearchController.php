<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\Factory;
use App\Models\Item;
use App\Models\ProductionOrder;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $query = trim($request->string('q')->value());
        if (mb_strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $like = addcslashes($query, '\%_');

        if ($request->user()->is_platform_admin) {
            $modules = [
                [
                    'type' => 'Page',
                    'title' => 'Dashboard',
                    'subtitle' => 'Dashboard and live system activity',
                    'page' => 'platform-dashboard',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Factories',
                    'subtitle' => 'Register and manage factories',
                    'page' => 'factories',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Users',
                    'subtitle' => 'Accounts, roles and passwords',
                    'page' => 'platform-users',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Subscriptions',
                    'subtitle' => 'Plans, renewals and payments',
                    'page' => 'subscriptions',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Announcements',
                    'subtitle' => 'Messages to system users',
                    'page' => 'announcements',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Notifications',
                    'subtitle' => 'Live system notifications',
                    'page' => 'notifications',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Support',
                    'subtitle' => 'User questions and conversations',
                    'page' => 'support-center',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Backups',
                    'subtitle' => 'Backup history and recovery files',
                    'page' => 'backups',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Settings',
                    'subtitle' => 'Branding, logo, defaults and maintenance',
                    'page' => 'system-settings',
                ],
            ];
            $results = $this->matchingModules($modules, $query)
                ->merge(
                    Factory::where('name', 'like', "%{$like}%")
                        ->limit(5)
                        ->get()
                        ->map(
                            fn ($item) => [
                                'type' => 'Factory',
                                'title' => $item->name,
                                'subtitle' => $item->industry_type,
                                'page' => 'factories',
                            ],
                        ),
                )
                ->merge(
                    User::where(
                        fn ($builder) => $builder
                            ->where('name', 'like', "%{$like}%")
                            ->orWhere('email', 'like', "%{$like}%"),
                    )
                        ->limit(5)
                        ->get()
                        ->map(
                            fn ($item) => [
                                'type' => 'User',
                                'title' => $item->name,
                                'subtitle' => $item->email,
                                'page' => 'platform-users',
                            ],
                        ),
                );
        } else {
            $factoryId = $request->user()->current_factory_id;
            $modules = [
                [
                    'type' => 'Page',
                    'title' => 'Dashboard',
                    'subtitle' => 'Factory overview and live activity',
                    'page' => 'dashboard',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Purchases',
                    'subtitle' => 'Purchasing and suppliers',
                    'page' => 'procurement',
                ],
                ['type' => 'Page', 'title' => 'Stock', 'subtitle' => 'Warehouses and stock', 'page' => 'inventory'],
                [
                    'type' => 'Page',
                    'title' => 'Products',
                    'subtitle' => 'Products, materials and recipes',
                    'page' => 'products',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Production',
                    'subtitle' => 'Production orders and workflows',
                    'page' => 'production',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Quality',
                    'subtitle' => 'Inspections and defects',
                    'page' => 'quality',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Sales & Marketing',
                    'subtitle' => 'Customers, sales and invoices',
                    'page' => 'sales',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Deliveries',
                    'subtitle' => 'Shipments and deliveries',
                    'page' => 'logistics',
                ],
                [
                    'type' => 'Page',
                    'title' => 'People',
                    'subtitle' => 'Users, roles and assignments',
                    'page' => 'team',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Reports',
                    'subtitle' => 'Factory reports and analytics',
                    'page' => 'reports',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Help',
                    'subtitle' => 'Ask the system administrator',
                    'page' => 'support',
                ],
                [
                    'type' => 'Page',
                    'title' => 'Notifications',
                    'subtitle' => 'Live system messages',
                    'page' => 'notifications',
                ],
            ];
            $results = $this->matchingModules($modules, $query)
                ->merge(
                    Item::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where(
                            fn ($builder) => $builder
                                ->where('name', 'like', "%{$like}%")
                                ->orWhere('sku', 'like', "%{$like}%"),
                        )
                        ->limit(5)
                        ->get()
                        ->map(
                            fn ($item) => [
                                'type' => 'Product',
                                'title' => $item->name,
                                'subtitle' => $item->sku,
                                'page' => 'products',
                            ],
                        ),
                )
                ->merge(
                    ProductionOrder::withoutGlobalScopes()
                        ->where('factory_id', $factoryId)
                        ->where('order_number', 'like', "%{$like}%")
                        ->limit(5)
                        ->get()
                        ->map(
                            fn ($item) => [
                                'type' => 'Production order',
                                'title' => $item->order_number,
                                'subtitle' => $item->status,
                                'page' => 'production',
                            ],
                        ),
                )
                ->merge(
                    SupportTicket::where('user_id', $request->user()->id)
                        ->where(
                            fn ($builder) => $builder
                                ->where('subject', 'like', "%{$like}%")
                                ->orWhere('ticket_number', 'like', "%{$like}%"),
                        )
                        ->limit(5)
                        ->get()
                        ->map(
                            fn ($item) => [
                                'type' => 'Support',
                                'title' => $item->subject,
                                'subtitle' => $item->ticket_number,
                                'page' => 'support',
                            ],
                        ),
                );
        }

        if (! $request->user()->is_platform_admin) {
            $results = $results->filter(fn (array $result) => $this->mayOpen($request->user(), $result['page']));
        }

        return response()->json(['data' => $results->take(10)->values()]);
    }

    private const PAGE_PERMISSIONS = [
        'procurement' => 'procurement.view',
        'inventory' => 'inventory.view',
        'products' => 'products.view',
        'production' => 'production.view',
        'quality' => 'quality.view',
        'sales' => 'sales.view',
        'logistics' => 'logistics.view',
        'team' => 'users.view',
        'reports' => 'reports.view',
    ];

    private function mayOpen($user, string $page): bool
    {
        $permission = self::PAGE_PERMISSIONS[$page] ?? null;

        return $permission === null || $user->hasPermission($permission);
    }

    private function matchingModules(array $modules, string $query)
    {
        $needle = mb_strtolower($query);

        return collect($modules)->filter(
            fn (array $module) => str_contains(mb_strtolower($module['title'] . ' ' . $module['subtitle']), $needle),
        );
    }
}
