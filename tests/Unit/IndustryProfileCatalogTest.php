<?php

namespace Tests\Unit;

use App\Support\Catalogs\IndustryProfileCatalog as Catalog;
use Tests\TestCase;

class IndustryProfileCatalogTest extends TestCase
{
    public function test_dairy_inherits_food_safety_and_adds_its_own_features(): void
    {
        $features = Catalog::resolve(['dairy'])['features'];

        foreach (
            [
                'haccp_records',
                'lot_traceability',
                'recall_management',
                'milk_intake',
                'pasteurization_records',
                'cold_chain_logs',
            ] as $feature
        ) {
            $this->assertContains($feature, $features);
        }
    }

    public function test_dairy_flow_matches_the_previous_hand_written_flow(): void
    {
        $this->assertSame(
            [
                'Milk Receiving',
                'Production',
                'Processing',
                'Quality Laboratory',
                'Packaging',
                'Cold Storage',
                'Logistics',
            ],
            Catalog::resolve(['dairy'])['profiles']['dairy']['departments'],
        );
    }

    public function test_clothing_flow_is_unchanged_so_existing_factories_are_not_disturbed(): void
    {
        $this->assertSame(
            [
                'Design',
                'Production',
                'Raw Materials',
                'Cutting',
                'Sewing',
                'Quality Control',
                'Packaging',
                'Finished Goods',
                'Logistics',
            ],
            Catalog::resolve(['clothing_textiles'])['profiles']['clothing_textiles']['departments'],
        );
        $this->assertSame([], Catalog::resolve(['clothing_textiles'])['features']);
    }

    public function test_unknown_or_free_text_industry_falls_back_to_the_general_flow(): void
    {
        $resolved = Catalog::resolve(['Soap and candles']);

        $this->assertSame([Catalog::GENERIC], array_keys($resolved['profiles']));
        $this->assertSame(
            ['Raw Materials', 'Production', 'Quality Control', 'Packaging', 'Finished Goods', 'Logistics'],
            $resolved['departments'],
        );
    }

    public function test_a_factory_with_two_industries_gets_both_flows_and_shared_departments_once(): void
    {
        $resolved = Catalog::resolve(['dairy', 'food_processing']);

        $this->assertSame(['dairy', 'food_processing'], array_keys($resolved['profiles']));
        $names = array_map('strtolower', $resolved['departments']);
        $this->assertSame(
            count($names),
            count(array_unique($names)),
            'Departments shared by both flows must appear once.',
        );
        $this->assertContains('Milk Receiving', $resolved['departments']);
        $this->assertContains('Raw Material Receiving', $resolved['departments']);
        $this->assertSame(1, count(array_keys($names, 'processing')));
    }

    public function test_food_and_dairy_track_batches_and_expiry_by_default_but_clothing_does_not(): void
    {
        $this->assertSame(
            ['batch_tracked' => true, 'expiry_tracked' => true],
            Catalog::resolve(['dairy'])['item_defaults'],
        );
        $this->assertSame([], Catalog::resolve(['clothing_textiles'])['item_defaults']);
    }

    public function test_normalize_drops_invalid_and_internal_keys_and_keeps_the_primary_first(): void
    {
        $this->assertSame(
            ['dairy', 'beverages'],
            Catalog::normalize('dairy', ['food_safety', 'not_an_industry', 'dairy', 'beverages']),
        );
    }

    public function test_dairy_units_include_millilitres_with_a_litre_conversion_available(): void
    {
        $symbols = array_column(Catalog::resolve(['dairy'])['units'], 1);

        $this->assertContains('mL', $symbols);
        $this->assertContains('g', $symbols);
        $this->assertContains(['L', 'mL', 1000], Catalog::conversions());
    }
}
