<?php

namespace App\Support\Catalogs;

final class IndustryProfileCatalog
{
    public const GENERIC = 'general_manufacturing';

    private const BASE_UNITS = [
        ['Piece', 'pc', 'count', 0],
        ['Kilogram', 'kg', 'mass', 3],
        ['Litre', 'L', 'volume', 3],
        ['Metre', 'm', 'length', 3],
    ];

    private const CONVERSIONS = [
        ['kg', 'g', 1000],
        ['t', 'kg', 1000],
        ['L', 'mL', 1000],
    ];

    public static function definitions(): array
    {
        $generic = ['Raw Materials', 'Production', 'Quality Control', 'Packaging', 'Finished Goods', 'Logistics'];

        return [
            self::GENERIC => ['label' => 'General manufacturing', 'departments' => $generic],

            'food_safety' => [
                'label' => 'Food safety',
                'internal' => true,
                'units' => [['Gram', 'g', 'mass', 3]],
                'categories' => [['INGREDIENTS', 'Ingredients'], ['PACKAGING', 'Packaging materials'], ['FOODPRODUCTS', 'Finished food products']],
                'item_defaults' => ['batch_tracked' => true, 'expiry_tracked' => true],
                'features' => ['haccp_records', 'lot_traceability', 'recall_management', 'supplier_approval', 'allergen_control'],
            ],

            'clothing_textiles' => ['label' => 'Clothing and textiles', 'departments' => ['Design', 'Raw Materials', 'Cutting', 'Sewing', 'Quality Control', 'Packaging', 'Finished Goods', 'Logistics']],

            'food_processing' => [
                'label' => 'Food processing',
                'extends' => ['food_safety'],
                'departments' => ['Raw Material Receiving', 'Processing', 'Quality Laboratory', 'Packaging', 'Finished Goods', 'Logistics'],
            ],

            'dairy' => [
                'label' => 'Milk and dairy products',
                'extends' => ['food_safety'],
                'departments' => ['Milk Receiving', 'Processing', 'Quality Laboratory', 'Packaging', 'Cold Storage', 'Logistics'],
                'units' => [['Millilitre', 'mL', 'volume', 0]],
                'categories' => [['RAWMILK', 'Raw milk'], ['DAIRYPRODUCTS', 'Dairy products']],
                'features' => ['milk_intake', 'pasteurization_records', 'cold_chain_logs'],
            ],

            'beverages' => [
                'label' => 'Beverages and drinks',
                'extends' => ['food_safety'],
                'departments' => ['Raw Material Receiving', 'Mixing and Processing', 'Bottling', 'Quality Laboratory', 'Packaging', 'Finished Goods', 'Logistics'],
                'units' => [['Millilitre', 'mL', 'volume', 0], ['Bottle', 'btl', 'count', 0], ['Crate', 'crate', 'count', 0]],
            ],

            'grain_flour_milling' => [
                'label' => 'Maize, grain and flour milling',
                'extends' => ['food_safety'],
                'departments' => ['Grain Receiving', 'Cleaning and Sorting', 'Milling', 'Quality Laboratory', 'Packing', 'Finished Goods', 'Logistics'],
                'units' => [['Tonne', 't', 'mass', 3], ['Bag', 'bag', 'count', 0]],
            ],

            'pharmaceuticals_medicines' => [
                'label' => 'Medicines and pharmaceuticals',
                'departments' => ['Raw Materials', 'Formulation', 'Controlled Production', 'Quality Assurance', 'Packaging', 'Finished Goods', 'Logistics'],
                'item_defaults' => ['batch_tracked' => true, 'expiry_tracked' => true],
                'features' => ['lot_traceability', 'recall_management'],
            ],

            'plastics_rubber' => ['label' => 'Plastics and rubber materials', 'departments' => ['Raw Materials', 'Moulding and Extrusion', 'Trimming and Finishing', 'Quality Control', 'Packaging', 'Finished Goods', 'Logistics']],
            'steel_metals' => ['label' => 'Steel and metal products', 'departments' => ['Raw Materials', 'Cutting', 'Fabrication', 'Welding', 'Finishing', 'Quality Control', 'Finished Goods', 'Logistics']],
            'furniture_wood' => ['label' => 'Furniture and wood products', 'departments' => ['Raw Materials', 'Cutting', 'Assembly', 'Finishing', 'Quality Control', 'Packaging', 'Finished Goods']],

            'agriculture_animal_feed' => ['label' => 'Agriculture and animal feed', 'extends' => [self::GENERIC]],
            'construction_materials' => ['label' => 'Construction materials, cement and bricks', 'extends' => [self::GENERIC]],
            'paper_packaging_printing' => ['label' => 'Paper, packaging and printing', 'extends' => [self::GENERIC]],
            'chemicals_cosmetics_soap' => ['label' => 'Chemicals, cosmetics and soap', 'extends' => [self::GENERIC]],
            'electronics_electrical' => ['label' => 'Electronics and electrical products', 'extends' => [self::GENERIC]],
            'automotive_machinery' => ['label' => 'Automotive parts and machinery', 'extends' => [self::GENERIC]],
            'recycling_waste' => ['label' => 'Recycling and waste processing', 'extends' => [self::GENERIC]],
        ];
    }

    public static function keys(): array
    {
        return array_keys(array_filter(self::definitions(), fn (array $definition) => empty($definition['internal'])));
    }

    public static function normalize(?string $primary, array $additional = []): array
    {
        $selectable = self::keys();
        $first = in_array($primary, $selectable, true) ? $primary : self::GENERIC;

        return array_values(array_unique([
            $first,
            ...array_filter($additional, fn ($key) => is_string($key) && in_array($key, $selectable, true)),
        ]));
    }

    public static function resolve(array $profileKeys): array
    {
        $profiles = $units = $categories = $itemDefaults = $features = $allDepartments = [];
        $seenDepartments = [];

        foreach (self::normalize($profileKeys[0] ?? null, array_slice($profileKeys, 1)) as $key) {
            $merged = self::mergeWithParents($key);

            $departments = $merged['departments'] ?: self::definitions()[self::GENERIC]['departments'];
            if (! in_array('Production', $departments, true)) {
                array_splice($departments, 1, 0, ['Production']);
            }

            $profiles[$key] = ['label' => self::definitions()[$key]['label'], 'departments' => $departments];
            foreach ($departments as $name) {
                if (! isset($seenDepartments[strtolower($name)])) {
                    $seenDepartments[strtolower($name)] = true;
                    $allDepartments[] = $name;
                }
            }
            foreach ($merged['units'] as $unit) {
                $units[$unit[1]] = $unit;
            }
            foreach ($merged['categories'] as $category) {
                $categories[$category[0]] = $category;
            }
            $itemDefaults = array_merge($itemDefaults, array_filter($merged['item_defaults']));
            $features = array_merge($features, $merged['features']);
        }

        return [
            'profiles' => $profiles,
            'departments' => $allDepartments,
            'units' => array_values($units),
            'categories' => array_values($categories),
            'item_defaults' => $itemDefaults,
            'features' => array_values(array_unique($features)),
        ];
    }

    public static function baseUnits(): array
    {
        return self::BASE_UNITS;
    }

    public static function stationType(string $departmentName): string
    {
        $value = strtolower($departmentName);

        return match (true) {
            str_contains($value, 'cut') => 'cutting',
            str_contains($value, 'sew') => 'sewing',
            str_contains($value, 'mix') || str_contains($value, 'formulation') => 'mixing',
            str_contains($value, 'bottl') => 'bottling',
            str_contains($value, 'pack') => 'packaging',
            str_contains($value, 'quality') => 'quality',
            str_contains($value, 'storage') || str_contains($value, 'goods') || str_contains($value, 'material') => 'warehouse',
            str_contains($value, 'logistic') => 'dispatch',
            default => 'processing',
        };
    }

    public static function conversions(): array
    {
        return self::CONVERSIONS;
    }

    private static function mergeWithParents(string $key): array
    {
        $definition = self::definitions()[$key] ?? [];
        $result = ['departments' => $definition['departments'] ?? [], 'units' => [], 'categories' => [], 'item_defaults' => [], 'features' => []];

        foreach ($definition['extends'] ?? [] as $parentKey) {
            $parent = self::mergeWithParents($parentKey);
            $result['departments'] = $result['departments'] ?: $parent['departments'];
            $result['units'] = array_merge($result['units'], $parent['units']);
            $result['categories'] = array_merge($result['categories'], $parent['categories']);
            $result['item_defaults'] = array_merge($result['item_defaults'], $parent['item_defaults']);
            $result['features'] = array_merge($result['features'], $parent['features']);
        }

        $result['units'] = array_merge($result['units'], $definition['units'] ?? []);
        $result['categories'] = array_merge($result['categories'], $definition['categories'] ?? []);
        $result['item_defaults'] = array_merge($result['item_defaults'], $definition['item_defaults'] ?? []);
        $result['features'] = array_merge($result['features'], $definition['features'] ?? []);

        return $result;
    }
}
