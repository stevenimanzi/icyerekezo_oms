<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Factory;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OwnerOverviewTest extends TestCase
{
    use RefreshDatabase;

    private Factory $factory;

    private User $owner;

    private int $orderNumber = 0;

    protected function setUp(): void
    {
        parent::setUp();

        $this->factory = $this->makeFactory('Test Works', 'test-works');
        $this->owner = User::factory()->create([
            'email' => 'owner@test.test',
            'current_factory_id' => $this->factory->id,
        ]);
        $this->owner->factories()->attach($this->factory->id, ['is_owner' => true, 'is_active' => true]);

        $role = Role::create([
            'factory_id' => $this->factory->id,
            'name' => 'Factory Owner',
            'slug' => 'factory-owner',
            'dashboard_key' => 'executive',
            'is_system' => true,
        ]);
        $this->owner->roles()->attach($role->id, ['factory_id' => $this->factory->id]);
    }

    private function makeFactory(string $name, string $slug): Factory
    {
        return Factory::create([
            'uuid' => (string) Str::uuid(),
            'name' => $name,
            'slug' => $slug,
            'industry_type' => 'clothing',
            'status' => 'active',
        ]);
    }

    private function order(Factory $factory, array $values = []): void
    {
        $this->orderNumber++;

        DB::table('sales_documents')->insert(
            array_merge(
                [
                    'factory_id' => $factory->id,
                    'document_type' => 'customer_order',
                    'document_number' => 'CO-' . $this->orderNumber,
                    'customer_name' => 'Customer A',
                    'status' => 'accepted',
                    'currency_code' => 'RWF',
                    'total_amount' => 1000,
                    'paid_amount' => 0,
                    'payment_status' => 'unpaid',
                    'item_count' => 1,
                    'document_date' => today()->toDateString(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                $values,
            ),
        );
    }

    private function overview(string $query = ''): array
    {
        return $this->actingAs($this->owner)
            ->getJson('/api/executive/owner-overview' . $query)
            ->assertOk()
            ->json();
    }

    public function test_it_compares_this_period_revenue_with_the_one_before_and_reports_receivables(): void
    {
        $this->order($this->factory, [
            'total_amount' => 3000,
            'paid_amount' => 1000,
            'payment_status' => 'partially_paid',
        ]);
        $this->order($this->factory, ['total_amount' => 1000, 'document_date' => today()->subDays(40)->toDateString()]);
        $this->order($this->factory, ['total_amount' => 9999, 'status' => 'cancelled']);
        $this->order($this->factory, [
            'total_amount' => 500,
            'due_date' => today()->subDays(3)->toDateString(),
            'document_date' => today()->subDays(10)->toDateString(),
        ]);

        $data = $this->overview('?days=30');

        $this->assertEquals(3500.0, $data['growth']['revenue']['current']);
        $this->assertEquals(1000.0, $data['growth']['revenue']['previous']);
        $this->assertEquals(250.0, $data['growth']['revenue']['change']);
        $this->assertEquals(4500.0, $data['cash']['billed']);
        $this->assertEquals(1000.0, $data['cash']['collected']);
        $this->assertEquals(3500.0, $data['cash']['receivable']);
        $this->assertEquals(500.0, $data['cash']['overdue_receivable']);
        $this->assertSame(1, $data['cash']['overdue_orders']);
        $this->assertContains('overdue_payments', array_column($data['alerts'], 'key'));
        $this->assertCount(12, $data['trend']);
        $this->assertEquals(4500, array_sum(array_column($data['trend'], 'revenue')), 'The chart adds up to the billed total.');
        $this->assertEquals(3, array_sum(array_column($data['trend'], 'orders')));
    }

    public function test_a_growth_change_is_empty_when_there_was_nothing_to_compare_with(): void
    {
        $this->order($this->factory, ['total_amount' => 800]);

        $data = $this->overview();

        $this->assertEquals(800.0, $data['growth']['revenue']['current']);
        $this->assertNull($data['growth']['revenue']['change']);
    }

    public function test_an_empty_factory_returns_zeroes_and_no_alerts_instead_of_failing(): void
    {
        $data = $this->overview();

        $this->assertSame([], $data['alerts']);
        $this->assertEquals(0.0, $data['growth']['revenue']['current']);
        $this->assertNull($data['quality']['pass_rate']);
        $this->assertNull($data['people']['attendance_rate']);
        $this->assertSame(0, $data['stock']['low_stock']);
    }

    public function test_quality_people_safety_and_equipment_are_summarised(): void
    {
        $id = $this->factory->id;
        $now = now();

        foreach (['passed', 'passed', 'passed', 'failed'] as $i => $result) {
            DB::table('quality_inspections')->insert([
                'factory_id' => $id,
                'inspection_number' => 'QI-' . $i,
                'inspection_type' => 'final',
                'result' => $result,
                'inspector_id' => $this->owner->id,
                'inspected_quantity' => 10,
                'passed_quantity' => 8,
                'rejected_quantity' => 2,
                'inspected_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $worker = User::factory()->create(['current_factory_id' => $id]);
        foreach (['present', 'present', 'late', 'absent'] as $day => $status) {
            DB::table('employee_attendances')->insert([
                'factory_id' => $id,
                'user_id' => $worker->id,
                'date' => today()->subDays($day)->toDateString(),
                'status' => $status,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('safety_incidents')->insert([
            'factory_id' => $id,
            'reported_by' => $worker->id,
            'incident_date' => today()->subDays(5)->toDateString(),
            'description' => 'Cut',
            'severity' => 'severe',
            'status' => 'reported',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach (['operational', 'down'] as $i => $status) {
            DB::table('machines')->insert([
                'factory_id' => $id,
                'name' => 'Machine ' . $i,
                'code' => 'M' . $i,
                'type' => 'sewing',
                'status' => $status,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $data = $this->overview();

        $this->assertEquals(75.0, $data['quality']['pass_rate']);
        $this->assertEquals(8.0, $data['quality']['rejected_quantity']);
        $this->assertEquals(75.0, $data['people']['attendance_rate']);
        $this->assertSame(1, $data['people']['absent']);
        $this->assertSame(1, $data['safety']['serious_open']);
        $this->assertSame(5, $data['safety']['days_without_incident']);
        $this->assertEquals(50.0, $data['equipment']['availability_rate']);

        $alerts = array_column($data['alerts'], 'level', 'key');
        $this->assertSame('critical', $alerts['serious_incident']);
        $this->assertSame('critical', $alerts['machines_down']);
        $this->assertSame('warning', $alerts['failed_inspections']);
    }

    public function test_only_the_current_factorys_data_is_included(): void
    {
        $other = $this->makeFactory('Other', 'other');
        $this->order($other, ['total_amount' => 777777]);
        $this->order($this->factory, ['total_amount' => 100]);

        $this->assertEquals(100.0, $this->overview()['growth']['revenue']['current']);
    }

    public function test_an_unsupported_period_falls_back_to_thirty_days(): void
    {
        $this->assertSame(30, $this->overview('?days=9999')['period']['days']);
    }

    private function allowAudit(): void
    {
        $permission = Permission::firstOrCreate(
            ['slug' => 'audit.view'],
            ['name' => 'View audit', 'module' => 'audit'],
        );
        $this->owner->roles()->first()->permissions()->attach($permission->id);
    }

    private function log(Factory $factory, string $event, string $description, ?User $by = null): void
    {
        AuditLog::create([
            'factory_id' => $factory->id,
            'user_id' => $by?->id,
            'event' => $event,
            'description' => $description,
        ]);
    }

    public function test_the_activity_log_needs_the_audit_permission(): void
    {
        $this->actingAs($this->owner)->getJson('/api/executive/activity')->assertForbidden();
    }

    public function test_the_activity_log_lists_only_this_factory_and_can_be_filtered(): void
    {
        $this->allowAudit();
        $other = $this->makeFactory('Other', 'other');

        $this->log($this->factory, 'inventory.adjusted', 'Adjusted cotton stock', $this->owner);
        $this->log($this->factory, 'sales.order_created', 'Created order CO-1', $this->owner);
        $this->log($other, 'inventory.adjusted', 'Secret other factory movement');

        $all = $this->actingAs($this->owner)->getJson('/api/executive/activity')->assertOk()->json();

        $this->assertSame(2, $all['meta']['total']);
        $this->assertSame(['inventory', 'sales'], $all['modules']);
        $this->assertSame('Created order CO-1', $all['data'][0]['description'], 'Newest first.');
        $this->assertStringNotContainsString('Secret', json_encode($all));

        $stock = $this->getJson('/api/executive/activity?module=inventory')->json();
        $this->assertSame(1, $stock['meta']['total']);
        $this->assertSame('inventory', $stock['data'][0]['module']);

        $search = $this->getJson('/api/executive/activity?q=order')->json();
        $this->assertSame(1, $search['meta']['total']);
    }

    public function test_members_without_an_executive_role_cannot_read_the_owner_overview(): void
    {
        $operator = User::factory()->create(['current_factory_id' => $this->factory->id]);
        $operator->factories()->attach($this->factory->id, ['is_owner' => false, 'is_active' => true]);
        $role = Role::create([
            'factory_id' => $this->factory->id, 'name' => 'Cutting Operator', 'slug' => 'cutting-operator',
            'dashboard_key' => 'cutting', 'is_system' => true,
        ]);
        $operator->roles()->attach($role->id, ['factory_id' => $this->factory->id]);

        $this->actingAs($operator)->getJson('/api/executive/owner-overview')->assertForbidden();
        $this->actingAs($operator)->getJson('/api/executive/dashboard')->assertForbidden();
    }

    public function test_packed_garments_count_as_production_output(): void
    {
        DB::table('production_entries')->insert([
            ['factory_id' => $this->factory->id, 'stage' => 'packing', 'entry_date' => today()->toDateString(), 'good_quantity' => 40, 'damaged_quantity' => 0, 'voided_at' => null, 'created_at' => now(), 'updated_at' => now()],
            ['factory_id' => $this->factory->id, 'stage' => 'packing', 'entry_date' => today()->toDateString(), 'good_quantity' => 99, 'damaged_quantity' => 0, 'voided_at' => now(), 'created_at' => now(), 'updated_at' => now()],
            ['factory_id' => $this->factory->id, 'stage' => 'sewing', 'entry_date' => today()->toDateString(), 'good_quantity' => 70, 'damaged_quantity' => 0, 'voided_at' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $data = $this->overview();

        $this->assertEquals(40, $data['growth']['output']['current'], 'Only packed, uncancelled pieces count.');
        $this->assertEquals(40, array_sum(array_column($data['trend'], 'output')));
    }
}
