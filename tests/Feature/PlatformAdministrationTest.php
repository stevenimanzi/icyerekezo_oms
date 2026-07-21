<?php

namespace Tests\Feature;

use App\Jobs\CreateDatabaseBackup;
use App\Models\Factory;
use App\Models\FactorySubscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class PlatformAdministrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_super_admin_can_control_factories_subscriptions_maintenance_and_backups(): void
    {
        $admin = User::factory()->create(['current_factory_id' => null, 'is_platform_admin' => true, 'is_active' => true]);
        $ordinary = User::factory()->create(['current_factory_id' => null, 'is_platform_admin' => false]);
        $this->actingAs($ordinary)->getJson('/api/platform/overview')->assertForbidden();

        $this->actingAs($admin)->getJson('/api/platform/overview')->assertOk();
        $created = $this->postJson('/api/platform/factories', ['factory_name' => 'New Plastics Factory', 'industry_type' => 'plastics_rubber', 'owner_name' => 'Factory Owner', 'owner_email' => 'owner@plastics.test', 'owner_password' => 'OwnerSecure@12345'])->assertCreated()->assertJsonPath('factory.status', 'pending')->json();
        $factory = Factory::findOrFail($created['factory']['id']);
        $this->patchJson("/api/platform/factories/{$factory->id}", ['status' => 'active'])->assertOk()->assertJsonPath('status', 'active');

        $plan = $this->postJson('/api/platform/plans', ['name' => 'Professional', 'code' => 'PRO', 'monthly_price' => 50000, 'currency_code' => 'RWF', 'limits' => ['users' => 50]])->assertCreated()->json();
        $this->postJson("/api/platform/factories/{$factory->id}/subscriptions", ['subscription_plan_id' => $plan['id'], 'starts_at' => now()->subMonth()->toISOString(), 'ends_at' => now()->subDay()->toISOString(), 'grace_ends_at' => now()->subHour()->toISOString()])->assertCreated();
        $this->artisan('subscriptions:enforce')->assertSuccessful();
        $this->assertSame('suspended', $factory->fresh()->status);
        $this->assertSame('expired', FactorySubscription::firstOrFail()->status);

        Bus::fake();
        $this->postJson('/api/platform/backups')->assertAccepted();
        Bus::assertDispatched(CreateDatabaseBackup::class);

        $this->putJson('/api/platform/settings', ['system_name' => 'ICYEREKEZO Factory Cloud', 'maintenance_enabled' => true, 'maintenance_message' => 'Scheduled upgrade in progress.'])->assertOk();
        $this->actingAs($ordinary)->getJson('/api/auth/me')->assertStatus(503)->assertJsonPath('message', 'Scheduled upgrade in progress.');
        $this->actingAs($admin)->getJson('/api/platform/overview')->assertOk();
    }

    public function test_super_admin_can_broadcast_and_answer_factory_support_tickets(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Owner', 'email' => 'support-owner@test.local', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345', 'factory_name' => 'Support Factory', 'industry_type' => 'general_manufacturing'])->assertCreated();
        $ticket = $this->postJson('/api/support/tickets', ['subject' => 'Cannot receive stock', 'message' => 'The receipt screen needs help.', 'category' => 'technical', 'priority' => 'high'])->assertCreated()->json();
        $admin = User::factory()->create(['current_factory_id' => null, 'is_platform_admin' => true]);
        $this->actingAs($admin)->postJson('/api/platform/announcements', ['title' => 'Planned maintenance', 'message' => 'The platform will be upgraded tonight.', 'severity' => 'warning', 'audience' => 'all'])->assertCreated();
        $this->postJson("/api/platform/tickets/{$ticket['id']}/reply", ['message' => 'We are investigating this issue.', 'status' => 'in_progress'])->assertCreated();
        $this->assertDatabaseHas('support_tickets', ['id' => $ticket['id'], 'status' => 'in_progress', 'assigned_to' => $admin->id]);
        $this->assertDatabaseCount('support_messages',2);
    }
}
