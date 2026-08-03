<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_view_and_update_personal_profile(): void
    {
        $user = User::factory()->create(['name' => 'Old Name', 'email' => 'old@example.com', 'locale' => 'en', 'timezone' => 'Africa/Kigali']);

        $this->actingAs($user)->getJson('/api/profile')
            ->assertOk()->assertJsonPath('profile.email', 'old@example.com');

        $this->actingAs($user)->putJson('/api/profile', [
            'name' => 'New Name', 'email' => 'new@example.com', 'locale' => 'fr', 'timezone' => 'Africa/Johannesburg',
        ])->assertOk()->assertJsonPath('profile.name', 'New Name');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'New Name', 'email' => 'new@example.com', 'locale' => 'fr', 'timezone' => 'Africa/Johannesburg']);
    }

    public function test_password_change_requires_the_correct_current_password(): void
    {
        $user = User::factory()->create(['password' => 'Current@12345']);
        $payload = ['current_password' => 'Wrong@12345', 'password' => 'Updated@12345', 'password_confirmation' => 'Updated@12345'];

        $this->actingAs($user)->putJson('/api/profile/password', $payload)->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $payload['current_password'] = 'Current@12345';
        $this->actingAs($user)->putJson('/api/profile/password', $payload)->assertOk();

        $this->assertTrue(Hash::check('Updated@12345', $user->fresh()->password));
    }
}
