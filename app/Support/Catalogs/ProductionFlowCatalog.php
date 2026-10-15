<?php

namespace App\Support\Catalogs;

final class ProductionFlowCatalog
{
    public const STAGES = [
        'cutting' => [
            'label' => ['en' => 'Cutting', 'fr' => 'Coupe'],
            'roles' => ['cutting-operator'],
        ],
        'sewing' => [
            'label' => ['en' => 'Sewing', 'fr' => 'Couture'],
            'roles' => ['sewing-operator'],
        ],
        'finishing' => [
            'label' => ['en' => 'Finishing', 'fr' => 'Finition'],
            'roles' => ['finishing-manager', 'finishing-operator'],
        ],
        'packing' => [
            'label' => ['en' => 'Packing', 'fr' => 'Emballage'],
            'roles' => ['packing-manager', 'packing-operator', 'packaging-manager', 'packaging-operator'],
        ],
    ];

    public const MANAGER_ROLES = [
        'production-manager',
        'production-supervisor',
        'factory-administrator',
        'factory-manager',
    ];

    public const WAREHOUSE_ROLES = ['warehouse-keeper', 'factory-administrator'];

    public static function keys(): array
    {
        return array_keys(self::STAGES);
    }

    public static function exists(string $stage): bool
    {
        return isset(self::STAGES[$stage]);
    }

    public static function next(string $stage): ?string
    {
        $keys = self::keys();
        $position = array_search($stage, $keys, true);

        return $position === false ? null : ($keys[$position + 1] ?? null);
    }

    public static function previous(string $stage): ?string
    {
        $keys = self::keys();
        $position = array_search($stage, $keys, true);

        return $position === false || $position === 0 ? null : $keys[$position - 1];
    }

    public static function stageForRoles(array $roleSlugs): ?string
    {
        foreach (self::STAGES as $key => $stage) {
            if (array_intersect($stage['roles'], $roleSlugs)) {
                return $key;
            }
        }

        return null;
    }

    public static function describe(): array
    {
        return collect(self::STAGES)
            ->map(fn (array $stage, string $key) => [
                'key' => $key,
                'label' => $stage['label'],
                'previous' => self::previous($key),
                'next' => self::next($key),
            ])
            ->values()
            ->all();
    }
}
