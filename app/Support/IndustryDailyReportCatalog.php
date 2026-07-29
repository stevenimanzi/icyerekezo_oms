<?php

namespace App\Support;

class IndustryDailyReportCatalog
{
    public static function for(?string $industry): array
    {
        $profiles = [
            'dairy' => [
                'input_label' => 'Milk or material received',
                'output_label' => 'Processed dairy product',
                'unit_examples' => ['L', 'kg', 'pcs'],
                'attributes' => ['Product', 'Batch', 'Milk source or supplier', 'Fat/quality grade', 'Package size'],
            ],
            'clothing_textiles' => [
                'input_label' => 'Fabric or pieces received',
                'output_label' => 'Metres or pieces completed',
                'unit_examples' => ['m', 'pcs', 'kg'],
                'attributes' => ['Product/style', 'Batch', 'Colour', 'Size', 'Material'],
            ],
            'steel_metals' => [
                'input_label' => 'Metal received',
                'output_label' => 'Parts or weight completed',
                'unit_examples' => ['kg', 't', 'pcs', 'm'],
                'attributes' => ['Product', 'Batch/heat number', 'Metal grade', 'Thickness/size'],
            ],
            'plastics_rubber' => [
                'input_label' => 'Material received',
                'output_label' => 'Parts or weight completed',
                'unit_examples' => ['kg', 'pcs', 'm'],
                'attributes' => ['Product', 'Batch', 'Material/resin', 'Colour', 'Mould/size'],
            ],
            'grain_flour_milling' => [
                'input_label' => 'Grain received',
                'output_label' => 'Flour or product completed',
                'unit_examples' => ['kg', 't', 'bags'],
                'attributes' => ['Product', 'Batch', 'Grain type/grade', 'Package size'],
            ],
            'food_processing' => [
                'input_label' => 'Ingredients received',
                'output_label' => 'Food product completed',
                'unit_examples' => ['kg', 'L', 'pcs'],
                'attributes' => ['Product', 'Batch', 'Recipe/grade', 'Package size'],
            ],
            'beverages' => [
                'input_label' => 'Liquid or material received',
                'output_label' => 'Beverage completed',
                'unit_examples' => ['L', 'bottles', 'crates'],
                'attributes' => ['Product', 'Batch', 'Flavour/type', 'Bottle/package size'],
            ],
            'furniture_wood' => [
                'input_label' => 'Timber or parts received',
                'output_label' => 'Furniture or parts completed',
                'unit_examples' => ['m', 'm²', 'pcs'],
                'attributes' => ['Product', 'Batch', 'Wood/material', 'Model/size'],
            ],
        ];

        return [
            'title' => 'Daily production and stock report',
            'input_label' => 'Material or work received',
            'output_label' => 'Work completed',
            'unit_examples' => ['kg', 'L', 'm', 'pcs'],
            'attributes' => ['Product', 'Batch', 'Type/grade', 'Size or package'],
            ...($profiles[$industry ?? ''] ?? []),
        ];
    }
}
