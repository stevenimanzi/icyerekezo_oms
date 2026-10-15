<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Factory;
use App\Models\WorkflowTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FactoryRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge(
            [
                'name' => 'Amina Owner',
                'email' => 'amina@dairy.test',
                'password' => 'StrongPass123!',
                'password_confirmation' => 'StrongPass123!',
                'factory_name' => 'Green Valley Dairy',
                'industry_type' => 'dairy',
                'locale' => 'en',
            ],
            $overrides,
        );
    }

    public function test_registering_a_dairy_sets_the_factory_up_automatically(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertCreated();

        $factory = Factory::where('name', 'Green Valley Dairy')->firstOrFail();
        $departments = Department::withoutGlobalScopes()->where('factory_id', $factory->id)->pluck('name')->all();

        $this->assertContains('Milk Receiving', $departments);
        $this->assertContains('Cold Storage', $departments);
        $this->assertTrue(
            WorkflowTemplate::withoutGlobalScopes()
                ->where(['factory_id' => $factory->id, 'code' => 'INDUSTRY-DEFAULT'])
                ->exists(),
        );
        $this->assertTrue(
            DB::table('units')
                ->where(['factory_id' => $factory->id, 'symbol' => 'mL'])
                ->exists(),
        );
        $this->assertTrue($factory->hasFeature('milk_intake'));
        $this->assertSame(['batch_tracked' => true, 'expiry_tracked' => true], $factory->itemDefaults());
    }

    public function test_a_factory_can_register_with_more_than_one_industry(): void
    {
        $this->postJson(
            '/api/auth/register',
            $this->payload(['industry_profiles' => ['food_processing', 'dairy']]),
        )->assertCreated();

        $factory = Factory::where('name', 'Green Valley Dairy')->firstOrFail();

        $this->assertSame(
            ['food_processing'],
            $factory->industry_profiles,
            'The primary industry is not repeated in the additional list.',
        );
        $this->assertSame(['dairy', 'food_processing'], $factory->profileKeys());
        $codes = WorkflowTemplate::withoutGlobalScopes()
            ->where('factory_id', $factory->id)
            ->pluck('code')
            ->sort()
            ->values()
            ->all();
        $this->assertSame(['INDUSTRY-DEFAULT', 'PROFILE-FOOD-PROCESSING'], $codes);
    }

    public function test_an_unrecognised_industry_is_rejected_rather_than_silently_ignored(): void
    {
        $this->postJson('/api/auth/register', $this->payload(['industry_profiles' => ['not_an_industry']]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('industry_profiles.0');

        $this->assertSame(0, Factory::count());
    }

    public function test_free_text_industry_still_registers_with_the_general_flow(): void
    {
        $this->postJson(
            '/api/auth/register',
            $this->payload([
                'industry_type' => 'Candle making',
                'email' => 'c@candles.test',
                'factory_name' => 'Candle Co',
            ]),
        )->assertCreated();

        $factory = Factory::where('name', 'Candle Co')->firstOrFail();

        $this->assertSame(['general_manufacturing'], $factory->profileKeys());
        $this->assertContains(
            'Quality Control',
            Department::withoutGlobalScopes()->where('factory_id', $factory->id)->pluck('name')->all(),
        );
        $this->assertFalse($factory->hasFeature('milk_intake'));
    }

    public function test_a_weak_password_cannot_register_a_factory(): void
    {
        $this->postJson(
            '/api/auth/register',
            $this->payload(['password' => 'weakpass', 'password_confirmation' => 'weakpass']),
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }
}
