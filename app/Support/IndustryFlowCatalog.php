<?php

namespace App\Support;

class IndustryFlowCatalog
{
    public static function for(string $industry): array
    {
        $groups = [
            'clothing_textiles' => ['Design', 'Raw Materials', 'Cutting', 'Sewing', 'Quality Control', 'Packaging', 'Finished Goods', 'Logistics'],
            'food_processing' => ['Raw Material Receiving', 'Processing', 'Quality Laboratory', 'Packaging', 'Finished Goods', 'Logistics'],
            'grain_flour_milling' => ['Grain Receiving', 'Cleaning and Sorting', 'Milling', 'Quality Laboratory', 'Packing', 'Finished Goods', 'Logistics'],
            'beverages' => ['Raw Material Receiving', 'Mixing and Processing', 'Bottling', 'Quality Laboratory', 'Packaging', 'Finished Goods', 'Logistics'],
            'dairy' => ['Milk Receiving', 'Processing', 'Quality Laboratory', 'Packaging', 'Cold Storage', 'Logistics'],
            'pharmaceuticals_medicines' => ['Raw Materials', 'Formulation', 'Controlled Production', 'Quality Assurance', 'Packaging', 'Finished Goods', 'Logistics'],
            'plastics_rubber' => ['Raw Materials', 'Moulding and Extrusion', 'Trimming and Finishing', 'Quality Control', 'Packaging', 'Finished Goods', 'Logistics'],
            'steel_metals' => ['Raw Materials', 'Cutting', 'Fabrication', 'Welding', 'Finishing', 'Quality Control', 'Finished Goods', 'Logistics'],
            'furniture_wood' => ['Raw Materials', 'Cutting', 'Assembly', 'Finishing', 'Quality Control', 'Packaging', 'Finished Goods'],
        ];
        $departments = $groups[$industry] ?? ['Raw Materials', 'Production', 'Quality Control', 'Packaging', 'Finished Goods', 'Logistics'];
        if (! in_array('Production', $departments, true)) {
            array_splice($departments, 1, 0, ['Production']);
        }

        return [
            'name' => 'Recommended '.str_replace('_', ' ', $industry).' workflow',
            'departments' => collect($departments)->map(fn ($name, $index) => [
                'name' => $name,
                'code' => strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 8)).str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                'workstation_type' => self::stationType($name),
            ])->all(),
        ];
    }

    private static function stationType(string $name): string
    {
        $value = strtolower($name);

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
}
