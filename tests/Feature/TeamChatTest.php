<?php

namespace Tests\Feature;

use App\Models\Factory;
use App\Models\Role;
use App\Models\User;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TeamChatTest extends TestCase
{
    use RefreshDatabase;

    private Factory $factory;

    protected function setUp(): void
    {
        parent::setUp();
        PermissionCatalog::seed();
        $this->factory = $this->makeFactory('Garment Works', 'garment-works');
    }

    private function makeFactory(string $name, string $slug): Factory
    {
        $factory = Factory::create(['uuid' => (string) Str::uuid(), 'name' => $name, 'slug' => $slug, 'industry_type' => 'clothing_textiles', 'status' => 'active', 'currency_code' => 'RWF']);
        RoleTemplateCatalog::createFor($factory);

        return $factory;
    }

    private function member(string $name, string $slug = 'cutting-operator', ?Factory $factory = null): User
    {
        $factory ??= $this->factory;
        $user = User::factory()->create(['name' => $name, 'email' => Str::random(8) . '@test.test', 'current_factory_id' => $factory->id]);
        $user->factories()->attach($factory->id, ['is_owner' => false, 'is_active' => true]);
        $user->roles()->attach(Role::where(['factory_id' => $factory->id, 'slug' => $slug])->value('id'), ['factory_id' => $factory->id]);

        return $user;
    }

    private function group(User $user): int
    {
        return collect($this->actingAs($user)->getJson('/api/chat/overview')->assertOk()->json('conversations'))->firstWhere('type', 'group')['id'];
    }

    private function say(User $user, int $conversation, string $body)
    {
        return $this->actingAs($user)->postJson("/api/chat/conversations/{$conversation}/messages", ['body' => $body]);
    }

    public function test_everyone_in_the_factory_shares_one_group_and_sees_each_others_messages(): void
    {
        $amina = $this->member('Amina');
        $eric = $this->member('Eric', 'sewing-operator');

        $group = $this->group($amina);
        $this->assertSame($group, $this->group($eric), 'There is a single group for the factory.');

        $this->say($amina, $group, 'Morning team')->assertCreated();

        $seen = $this->actingAs($eric)->getJson("/api/chat/conversations/{$group}/messages")->assertOk()->json('messages');
        $this->assertCount(1, $seen);
        $this->assertSame('Morning team', $seen[0]['body']);
        $this->assertSame('Amina', $seen[0]['user']['name']);
        $this->assertFalse($seen[0]['mine']);
    }

    public function test_a_private_chat_is_only_for_its_two_people(): void
    {
        $amina = $this->member('Amina');
        $eric = $this->member('Eric');
        $spy = $this->member('Spy');

        $dm = $this->actingAs($amina)->postJson('/api/chat/direct', ['user_id' => $eric->id])->assertCreated()->json('id');
        $again = $this->actingAs($eric)->postJson('/api/chat/direct', ['user_id' => $amina->id])->assertCreated()->json('id');
        $this->assertSame($dm, $again, 'Starting the same private chat twice opens the same one.');

        $this->say($amina, $dm, 'Can you cover my shift?')->assertCreated();

        $this->actingAs($spy)->getJson("/api/chat/conversations/{$dm}/messages")->assertNotFound();
        $this->say($spy, $dm, 'hello')->assertNotFound();
        $this->assertSame('Can you cover my shift?', $this->actingAs($eric)->getJson("/api/chat/conversations/{$dm}/messages")->json('messages.0.body'));
    }

    public function test_unread_counts_follow_what_each_person_has_opened(): void
    {
        $amina = $this->member('Amina');
        $eric = $this->member('Eric');
        $group = $this->group($amina);
        $this->group($eric);

        $this->say($amina, $group, 'One')->assertCreated();
        $this->say($amina, $group, 'Two')->assertCreated();

        $this->assertSame(2, $this->actingAs($eric)->getJson('/api/chat/unread')->json('unread'));
        $this->assertSame(0, $this->actingAs($amina)->getJson('/api/chat/unread')->json('unread'), 'Your own messages are never unread.');

        $this->actingAs($eric)->getJson("/api/chat/conversations/{$group}/messages")->assertOk();
        $this->assertSame(0, $this->actingAs($eric)->getJson('/api/chat/unread')->json('unread'));

        $this->say($amina, $group, 'Three')->assertCreated();
        $overview = $this->actingAs($eric)->getJson('/api/chat/overview')->json();
        $this->assertSame(1, $overview['unread']);
        $this->assertSame('Three', $overview['conversations'][0]['last_message']['body']);
    }

    public function test_polling_with_the_last_id_returns_only_new_messages(): void
    {
        $amina = $this->member('Amina');
        $group = $this->group($amina);
        $first = $this->say($amina, $group, 'First')->json('id');
        $this->say($amina, $group, 'Second')->assertCreated();

        $newer = $this->actingAs($amina)->getJson("/api/chat/conversations/{$group}/messages?after={$first}")->json();

        $this->assertSame(['Second'], array_column($newer['messages'], 'body'));
        $this->assertSame($newer['messages'][0]['id'], $newer['last_id']);
    }

    public function test_other_factories_and_system_admins_are_kept_out(): void
    {
        $amina = $this->member('Amina');
        $group = $this->group($amina);
        $other = $this->makeFactory('Other Works', 'other-works');
        $stranger = $this->member('Stranger', 'cutting-operator', $other);
        $admin = User::factory()->create(['is_platform_admin' => true]);

        $this->actingAs($stranger)->getJson("/api/chat/conversations/{$group}/messages")->assertNotFound();
        $this->actingAs($stranger)->postJson('/api/chat/direct', ['user_id' => $amina->id])->assertNotFound();
        $this->assertNotContains($amina->id, array_column($this->actingAs($stranger)->getJson('/api/chat/overview')->json('people'), 'id'));
        $this->actingAs($admin)->getJson('/api/chat/overview')->assertClientError();
    }

    public function test_the_people_list_names_everyone_else_with_their_role(): void
    {
        $amina = $this->member('Amina');
        $this->member('Eric', 'sewing-operator');

        $people = $this->actingAs($amina)->getJson('/api/chat/overview')->json('people');

        $this->assertSame(['Eric'], array_column($people, 'name'));
        $this->assertSame('Sewing Operator', $people[0]['role']);
    }

    public function test_empty_and_oversized_messages_are_refused(): void
    {
        $amina = $this->member('Amina');
        $group = $this->group($amina);

        $this->say($amina, $group, '   ')->assertUnprocessable();
        $this->say($amina, $group, str_repeat('a', 2001))->assertUnprocessable();
        $this->assertSame([], $this->actingAs($amina)->getJson("/api/chat/conversations/{$group}/messages")->json('messages'));
    }
}
