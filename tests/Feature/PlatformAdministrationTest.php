<?php

namespace Tests\Feature;

use App\Jobs\CreateDatabaseBackup;
use App\Models\Factory;
use App\Models\FactorySubscription;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PlatformAdministrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_subscription_page_lists_the_three_default_plans_in_price_order(): void
    {
        $admin = User::factory()->create(['current_factory_id' => null, 'is_platform_admin' => true, 'is_active' => true]);

        $this->actingAs($admin)
            ->getJson('/api/platform/subscriptions')
            ->assertOk()
            ->assertJsonPath('plans.0.code', 'STARTER')
            ->assertJsonPath('plans.0.monthly_price', 100000)
            ->assertJsonPath('plans.1.code', 'PROFESSIONAL')
            ->assertJsonPath('plans.1.monthly_price', 200000)
            ->assertJsonPath('plans.2.code', 'ENTERPRISE')
            ->assertJsonPath('plans.2.monthly_price', 300000);
    }

    public function test_only_super_admin_can_control_factories_subscriptions_maintenance_and_backups(): void
    {
        $admin = User::factory()->create(['current_factory_id' => null, 'is_platform_admin' => true, 'is_active' => true]);
        $ordinary = User::factory()->create(['current_factory_id' => null, 'is_platform_admin' => false]);
        $this->actingAs($ordinary)->getJson('/api/platform/overview')->assertForbidden();

        $this->actingAs($admin)->getJson('/api/platform/overview')->assertOk();
        $created = $this->postJson('/api/platform/factories', ['factory_name' => 'New Plastics Factory', 'industry_type' => 'plastics_rubber', 'owner_name' => 'Factory Owner', 'owner_email' => 'owner@plastics.test', 'owner_password' => 'OwnerSecure@12345', 'manager_name' => 'Operations Manager', 'manager_email' => 'manager@plastics.test', 'manager_password' => 'ManagerSecure@12345'])->assertCreated()->assertJsonPath('factory.status', 'pending')->assertJsonPath('manager.email', 'manager@plastics.test')->json();
        $factory = Factory::findOrFail($created['factory']['id']);
        $manager = User::where('email', 'manager@plastics.test')->firstOrFail();
        $this->assertTrue($manager->roles()->wherePivot('factory_id', $factory->id)->where('slug', 'factory-manager')->exists());
        $this->patchJson("/api/platform/factories/{$factory->id}", ['status' => 'active'])->assertOk()->assertJsonPath('status', 'active');
        $warehouseRole = Role::where('factory_id', $factory->id)->where('slug', 'warehouse-keeper')->firstOrFail();
        $worker = $this->postJson('/api/platform/users', ['factory_id' => $factory->id, 'role_id' => $warehouseRole->id, 'name' => 'New Store Keeper', 'email' => 'store@plastics.test', 'password' => 'StoreSecure@12345', 'employee_number' => 'WH-200'])->assertCreated()->json();
        $this->putJson("/api/platform/users/{$worker['id']}/password", ['password' => 'ChangedSecure@12345', 'password_confirmation' => 'ChangedSecure@12345'])->assertOk();
        $this->assertTrue(Hash::check('ChangedSecure@12345', User::findOrFail($worker['id'])->password));

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
        $this->assertDatabaseCount('support_messages', 2);
    }
}
