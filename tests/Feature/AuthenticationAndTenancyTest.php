<?php

namespace Tests\Feature;

use App\Models\Factory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationAndTenancyTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_register_a_factory_workspace(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Jean Mugabo',
            'email' => 'jean@example.com',
            'password' => 'Secure@12345',
            'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Kigali Manufacturing',
            'industry_type' => 'clothing',
            'locale' => 'en',
        ]);

        $response->assertCreated()->assertJsonPath('user.current_factory.name', 'Kigali Manufacturing');
        $this->assertAuthenticated();
        $this->assertDatabaseCount('factories', 1);
        $this->assertDatabaseCount('permissions', 62);
        $this->assertDatabaseHas('factory_user', ['is_owner' => true, 'is_active' => true]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'auth.registered']);
        $permissions = $this->getJson('/api/auth/me')->assertOk()->json('user.permissions');
        $this->assertContains('production.view', $permissions);
        $this->assertContains('reports.view', $permissions);
        $this->assertContains('reports.export', $permissions);
        $this->assertNotContains('production.plan', $permissions);
        $this->assertNotContains('inventory.adjust', $permissions);
        $this->assertNotContains('users.create', $permissions);
        $this->assertNotContains('factory.manage', $permissions);
        $this->getJson('/api/reports')->assertOk();
        $this->getJson('/api/factory/settings')->assertForbidden();
        $this->postJson('/api/inventory/items', [])->assertForbidden();
    }

    public function test_inactive_user_cannot_sign_in(): void
    {
        User::factory()->create(['email' => 'inactive@example.com', 'password' => 'Secure@12345', 'is_active' => false]);
        $this->postJson('/api/auth/login', ['email' => 'inactive@example.com', 'password' => 'Secure@12345'])
            ->assertUnprocessable();
        $this->assertGuest();
    }

    public function test_user_cannot_switch_to_another_factory(): void
    {
        $user = User::factory()->create();
        $factory = Factory::create(['uuid' => fake()->uuid(), 'name' => 'Other Factory', 'slug' => 'other-factory']);
        $this->actingAs($user)->postJson('/api/factories/switch', ['factory_id' => $factory->id])->assertNotFound();
    }
}
