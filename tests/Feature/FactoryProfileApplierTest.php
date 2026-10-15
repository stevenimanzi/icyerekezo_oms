<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Factory;
use App\Models\Unit;
use App\Models\WorkflowTemplate;
use App\Models\Workstation;
use App\Services\FactoryProfileApplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class FactoryProfileApplierTest extends TestCase
{
    use RefreshDatabase;

    private function factory(string $industry, array $profiles = []): Factory
    {
        return Factory::create([
            'uuid' => (string) Str::uuid(), 'name' => ucfirst($industry).' Ltd', 'slug' => Str::slug($industry).'-'.Str::random(5),
            'industry_type' => $industry, 'industry_profiles' => $profiles ?: null, 'status' => 'active',
        ]);
    }

    private function counts(Factory $factory): array
    {
        return [
            'departments' => Department::withoutGlobalScopes()->where('factory_id', $factory->id)->count(),
            'workstations' => Workstation::withoutGlobalScopes()->where('factory_id', $factory->id)->count(),
            'workflows' => WorkflowTemplate::withoutGlobalScopes()->where('factory_id', $factory->id)->count(),
            'stages' => DB::table('workflow_stages')->join('workflow_templates', 'workflow_templates.id', '=', 'workflow_stages.workflow_template_id')->where('workflow_templates.factory_id', $factory->id)->count(),
            'units' => Unit::withoutGlobalScopes()->where('factory_id', $factory->id)->count(),
            'categories' => DB::table('item_categories')->where('factory_id', $factory->id)->count(),
            'conversions' => DB::table('unit_conversions')->where('factory_id', $factory->id)->count(),
        ];
    }

    public function test_dairy_factory_is_fully_set_up_with_no_manual_configuration(): void
    {
        $factory = $this->factory('dairy');

        $workflow = app(FactoryProfileApplier::class)->apply($factory);

        $this->assertSame('INDUSTRY-DEFAULT', $workflow->code);
        $this->assertTrue((bool) $workflow->is_default);
        $this->assertSame(
            ['Milk Receiving', 'Production', 'Processing', 'Quality Laboratory', 'Packaging', 'Cold Storage', 'Logistics'],
            $workflow->stages->pluck('name')->all(),
        );
        $this->assertSame([1, 2, 3, 4, 5, 6, 7], $workflow->stages->pluck('sequence')->all());

        $quality = $workflow->stages->firstWhere('name', 'Quality Laboratory');
        $this->assertTrue((bool) $quality->quality_required);
        $this->assertTrue((bool) $quality->approval_required);

        $symbols = Unit::withoutGlobalScopes()->where('factory_id', $factory->id)->pluck('symbol')->all();
        foreach (['pc', 'kg', 'L', 'm', 'g', 'mL'] as $symbol) {
            $this->assertContains($symbol, $symbols);
        }
        $this->assertSame(2, DB::table('unit_conversions')->where('factory_id', $factory->id)->count());
        $this->assertTrue(DB::table('item_categories')->where(['factory_id' => $factory->id, 'code' => 'RAWMILK'])->exists());
    }

    public function test_applying_twice_creates_nothing_new(): void
    {
        $factory = $this->factory('dairy', ['food_processing']);
        $applier = app(FactoryProfileApplier::class);

        $applier->apply($factory);
        $first = $this->counts($factory);
        $applier->apply($factory);

        $this->assertSame($first, $this->counts($factory));
    }

    public function test_two_industries_get_one_workflow_each_and_share_departments(): void
    {
        $factory = $this->factory('dairy', ['food_processing']);

        app(FactoryProfileApplier::class)->apply($factory);

        $codes = WorkflowTemplate::withoutGlobalScopes()->where('factory_id', $factory->id)->pluck('code')->sort()->values()->all();
        $this->assertSame(['INDUSTRY-DEFAULT', 'PROFILE-FOOD-PROCESSING'], $codes);

        $names = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->pluck('name')->map(fn ($n) => strtolower($n));
        $this->assertSame($names->count(), $names->unique()->count());
        $this->assertSame(1, $names->filter(fn ($n) => $n === 'processing')->count());

        $default = WorkflowTemplate::withoutGlobalScopes()->where(['factory_id' => $factory->id, 'code' => 'INDUSTRY-DEFAULT'])->first();
        $secondary = WorkflowTemplate::withoutGlobalScopes()->where(['factory_id' => $factory->id, 'code' => 'PROFILE-FOOD-PROCESSING'])->first();
        $this->assertTrue((bool) $default->is_default);
        $this->assertFalse((bool) $secondary->is_default);
        $this->assertContains('Raw Material Receiving', $secondary->stages->pluck('name')->all());
        $this->assertNotContains('Milk Receiving', $secondary->stages->pluck('name')->all());
    }

    public function test_setting_up_one_factory_never_touches_another(): void
    {
        $dairy = $this->factory('dairy');
        $steel = $this->factory('steel_metals');
        $applier = app(FactoryProfileApplier::class);

        $applier->apply($dairy);
        $applier->apply($steel);

        $this->assertNotContains('Welding', Department::withoutGlobalScopes()->where('factory_id', $dairy->id)->pluck('name')->all());
        $this->assertNotContains('Milk Receiving', Department::withoutGlobalScopes()->where('factory_id', $steel->id)->pluck('name')->all());
        $this->assertFalse(DB::table('item_categories')->where(['factory_id' => $steel->id, 'code' => 'RAWMILK'])->exists());
    }

    public function test_existing_departments_are_reused_by_name_not_duplicated(): void
    {
        $factory = $this->factory('steel_metals');
        Department::withoutGlobalScopes()->create(['factory_id' => $factory->id, 'code' => 'PRODUCTION', 'name' => 'Production', 'is_active' => true]);

        app(FactoryProfileApplier::class)->apply($factory);

        $this->assertSame(1, Department::withoutGlobalScopes()->where('factory_id', $factory->id)->whereRaw('LOWER(name) = ?', ['production'])->count());
    }
}
