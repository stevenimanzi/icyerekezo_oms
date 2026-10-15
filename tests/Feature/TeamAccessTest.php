<?php

namespace Tests\Feature;

use App\Models\Factory;
use App\Models\Role;
use App\Models\User;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class TeamAccessTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Str0ng!Passw0rd#2026';

    private Factory $factory;

    protected function setUp(): void
    {
        parent::setUp();
        PermissionCatalog::seed();
        $this->factory = $this->makeFactory('Garment Works', 'garment-works', 'clothing_textiles');
    }

    private function makeFactory(string $name, string $slug, string $industry): Factory
    {
        $factory = Factory::create(['uuid' => (string) Str::uuid(), 'name' => $name, 'slug' => $slug, 'industry_type' => $industry, 'status' => 'active', 'currency_code' => 'RWF']);
        RoleTemplateCatalog::createFor($factory);
        $owner = Role::create(['factory_id' => $factory->id, 'slug' => 'factory-owner', 'name' => 'Factory Owner', 'dashboard_key' => 'executive', 'is_system' => true]);
        $owner->permissions()->sync(RoleTemplateCatalog::ownerPermissionIds());

        return $factory;
    }

    private function member(string $slug, ?Factory $factory = null, bool $isOwner = false): User
    {
        $factory ??= $this->factory;
        $user = User::factory()->create(['email' => Str::random(8) . "-{$slug}@test.test", 'current_factory_id' => $factory->id]);
        $user->factories()->attach($factory->id, ['is_owner' => $isOwner, 'is_active' => true]);
        $user->roles()->attach(Role::where(['factory_id' => $factory->id, 'slug' => $slug])->value('id'), ['factory_id' => $factory->id]);

        return $user;
    }

    private function roleId(string $slug, ?Factory $factory = null): int
    {
        return Role::where(['factory_id' => ($factory ?? $this->factory)->id, 'slug' => $slug])->value('id');
    }

    private function newAccount(User $actor, string $slug, ?Factory $factory = null)
    {
        return $this->actingAs($actor)->postJson('/api/team/users', [
            'name' => 'New Person', 'email' => Str::random(8) . '@test.test', 'role_id' => $this->roleId($slug, $factory),
            'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ]);
    }

    public function test_the_owner_can_add_a_factory_manager(): void
    {
        $owner = $this->member('factory-owner', isOwner: true);

        $this->newAccount($owner, 'factory-manager')->assertCreated();

        $this->assertSame(1, User::whereHas('roles', fn ($q) => $q->where('slug', 'factory-manager'))->count());
    }

    public function test_nobody_can_hand_out_the_owner_role(): void
    {
        $owner = $this->member('factory-owner', isOwner: true);
        $manager = $this->member('factory-manager');

        $this->newAccount($owner, 'factory-owner')->assertUnprocessable();
        $this->newAccount($manager, 'factory-owner')->assertUnprocessable();
    }

    public function test_a_manager_manages_staff_but_cannot_create_managers_or_administrators(): void
    {
        $manager = $this->member('factory-manager');

        $this->newAccount($manager, 'cutting-operator')->assertCreated();
        $this->newAccount($manager, 'factory-manager')->assertUnprocessable();
        $this->newAccount($manager, 'factory-administrator')->assertUnprocessable();
    }

    public function test_a_manager_cannot_touch_the_owner_administrators_or_other_managers(): void
    {
        $manager = $this->member('factory-manager');
        $staff = $this->member('sewing-operator');

        foreach (['factory-administrator', 'factory-manager'] as $slug) {
            $protected = $this->member($slug);

            $this->actingAs($manager)->patchJson("/api/team/users/{$protected->id}", ['is_active' => false])->assertForbidden();
            $this->actingAs($manager)->postJson("/api/team/users/{$protected->id}/reset-password", ['password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD])->assertForbidden();
            $this->actingAs($manager)->deleteJson("/api/team/users/{$protected->id}")->assertForbidden();
            $this->assertTrue($protected->fresh()->factories()->where('factories.id', $this->factory->id)->exists());
        }

        $owner = $this->member('factory-owner', isOwner: true);
        $this->actingAs($manager)->patchJson("/api/team/users/{$owner->id}", ['is_active' => false])->assertUnprocessable();

        $this->actingAs($manager)->postJson("/api/team/users/{$staff->id}/reset-password", ['password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD])->assertOk();
        $this->actingAs($manager)->patchJson("/api/team/users/{$staff->id}", ['role_id' => $this->roleId('finishing-manager')])->assertOk();
        $this->actingAs($manager)->deleteJson("/api/team/users/{$staff->id}")->assertOk();
    }

    public function test_the_owner_can_manage_managers_and_administrators(): void
    {
        $owner = $this->member('factory-owner', isOwner: true);
        $manager = $this->member('factory-manager');

        $this->actingAs($owner)->patchJson("/api/team/users/{$manager->id}", ['is_active' => false])->assertOk();
        $this->actingAs($owner)->deleteJson("/api/team/users/{$manager->id}")->assertOk();
    }

    public function test_the_list_shows_only_roles_the_actor_may_give_and_marks_locked_accounts(): void
    {
        $manager = $this->member('factory-manager');
        $this->member('factory-administrator');
        $this->member('cutting-operator');

        $response = $this->actingAs($manager)->getJson('/api/team/workspaces')->assertOk();
        $slugs = collect($response->json('roles'))->pluck('slug');
        $this->assertFalse($slugs->contains('factory-manager'));
        $this->assertFalse($slugs->contains('factory-administrator'));
        $this->assertTrue($slugs->contains('cutting-operator'));

        $locked = collect($response->json('users.data'))->mapWithKeys(fn ($u) => [$u['roles'][0]['slug'] => $u['can_manage']]);
        $this->assertFalse($locked['factory-administrator']);
        $this->assertFalse($locked['factory-manager']);
        $this->assertTrue($locked['cutting-operator']);

        $owner = $this->member('factory-owner', isOwner: true);
        $ownerSlugs = collect($this->actingAs($owner)->getJson('/api/team/workspaces')->json('roles'))->pluck('slug');
        $this->assertTrue($ownerSlugs->contains('factory-manager'));
        $this->assertFalse($ownerSlugs->contains('factory-owner'), 'The owner role can never be assigned, so it is never offered.');
    }

    public function test_roles_follow_the_type_of_factory(): void
    {
        $owner = $this->member('factory-owner', isOwner: true);
        $garment = collect($this->actingAs($owner)->getJson('/api/team/workspaces')->json('roles'))->pluck('slug');
        $this->assertTrue($garment->contains('cutting-operator'));
        $this->assertFalse($garment->contains('bottling-operator'));

        $dairy = $this->makeFactory('Milk Works', 'milk-works', 'dairy');
        $dairyOwner = $this->member('factory-owner', $dairy, true);
        $slugs = collect($this->actingAs($dairyOwner)->getJson('/api/team/workspaces')->json('roles'))->pluck('slug');
        $this->assertTrue($slugs->contains('bottling-operator'));
        $this->assertFalse($slugs->contains('cutting-operator'));
        $this->assertTrue($slugs->contains('warehouse-keeper'), 'General roles are available to every factory.');

        $this->newAccount($dairyOwner, 'cutting-operator', $dairy)->assertUnprocessable();
        $this->newAccount($dairyOwner, 'bottling-operator', $dairy)->assertCreated();
    }

    public function test_every_factory_can_place_staff_in_a_warehouse_department(): void
    {
        $owner = $this->member('factory-owner', isOwner: true);

        $names = collect($this->actingAs($owner)->getJson('/api/team/workspaces')->json('departments'))->pluck('name');

        $this->assertTrue($names->contains('Warehouse'));
        $this->assertTrue($names->contains('Production'));
        $this->assertSame(1, $names->filter(fn ($name) => $name === 'Warehouse')->count());
    }

    public function test_school_accounts_exist_only_for_the_factory_that_takes_online_school_orders(): void
    {
        $owner = $this->member('factory-owner', isOwner: true);
        $response = $this->actingAs($owner)->getJson('/api/team/workspaces')->assertOk();

        $this->assertFalse($response->json('online_orders'));
        $this->assertFalse(collect($response->json('roles'))->pluck('slug')->contains('school-user'));
        $this->newAccount($owner, 'school-user')->assertUnprocessable();

        $noguchi = $this->makeFactory('Noguchi Holdings Ltd', 'noguchi', 'clothing_textiles');
        $noguchiOwner = $this->member('factory-owner', $noguchi, true);
        $response = $this->actingAs($noguchiOwner)->getJson('/api/team/workspaces')->assertOk();

        $this->assertTrue($response->json('online_orders'));
        $this->assertTrue(collect($response->json('roles'))->pluck('slug')->contains('school-user'));
    }

    public function test_an_owner_can_give_staff_a_simple_password_but_not_a_tiny_one(): void
    {
        $owner = $this->member('factory-owner', isOwner: true);
        $payload = fn (string $password) => [
            'name' => 'Store Keeper', 'email' => Str::random(8) . '@test.test', 'role_id' => $this->roleId('warehouse-keeper'),
            'password' => $password, 'password_confirmation' => $password,
        ];

        $this->actingAs($owner)->postJson('/api/team/users', $payload('abc'))->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->actingAs($owner)->postJson('/api/team/users', $payload('store1'))->assertCreated();

        $staff = $this->member('sewing-operator');
        $this->actingAs($owner)->postJson("/api/team/users/{$staff->id}/reset-password", ['password' => '1234', 'password_confirmation' => '1234'])->assertOk();
        $this->assertTrue(Hash::check('1234', $staff->fresh()->password));
    }

    public function test_staff_without_user_permissions_cannot_manage_the_team(): void
    {
        $staff = $this->member('cutting-operator');

        $this->newAccount($staff, 'sewing-operator')->assertForbidden();
        $this->actingAs($staff)->getJson('/api/team/workspaces')->assertForbidden();
    }
}
