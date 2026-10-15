<?php

namespace Tests\Feature;

use App\Models\Factory;
use App\Models\Item;
use App\Models\Permission;
use App\Models\Role;
use App\Models\SalesDocument;
use App\Models\SalesPayment;
use App\Models\StockBalance;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ManualSalesTest extends TestCase
{
    use RefreshDatabase;

    private Factory $factory;

    private User $seller;

    private Item $shirt;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        PermissionCatalog::seed();

        $this->factory = $this->makeFactory('Counter Works', 'counter-works');
        $this->seller = $this->makeUser($this->factory, 'sales@test.test', 'sales-officer');
        $this->actingAs($this->seller);

        $unit = Unit::create(['factory_id' => $this->factory->id, 'name' => 'Piece', 'symbol' => 'pc']);
        $this->warehouse = Warehouse::create(['factory_id' => $this->factory->id, 'name' => 'Main', 'code' => 'MAIN', 'type' => 'general']);
        $this->shirt = Item::create([
            'factory_id' => $this->factory->id, 'unit_id' => $unit->id, 'type' => 'finished_good', 'name' => 'Polo shirt',
            'sku' => 'POLO-1', 'standard_cost' => 3000, 'is_active' => true,
        ]);
        StockBalance::create([
            'factory_id' => $this->factory->id, 'item_id' => $this->shirt->id, 'warehouse_id' => $this->warehouse->id, 'quantity_on_hand' => 50,
        ]);
    }

    private function makeFactory(string $name, string $slug): Factory
    {
        $factory = Factory::create([
            'uuid' => (string) Str::uuid(), 'name' => $name, 'slug' => $slug, 'industry_type' => 'clothing', 'status' => 'active', 'currency_code' => 'RWF',
        ]);
        RoleTemplateCatalog::createFor($factory);

        return $factory;
    }

    private function makeUser(Factory $factory, string $email, string $roleSlug): User
    {
        $user = User::factory()->create(['email' => $email, 'current_factory_id' => $factory->id]);
        $user->factories()->attach($factory->id, ['is_owner' => false, 'is_active' => true]);
        $role = Role::where(['factory_id' => $factory->id, 'slug' => $roleSlug])->first()
            ?? Role::create(['factory_id' => $factory->id, 'name' => 'Factory Owner', 'slug' => $roleSlug, 'dashboard_key' => 'executive', 'is_system' => true]);
        if ($roleSlug === 'factory-owner') {
            $role->permissions()->sync(Permission::whereIn('slug', RoleTemplateCatalog::FACTORY_OWNER_PERMISSIONS)->pluck('id'));
        }
        $user->roles()->attach($role->id, ['factory_id' => $factory->id]);

        return $user;
    }

    private function sale(array $overrides = []): array
    {
        return array_merge([
            'customer_name' => 'Jean Claude',
            'customer_phone' => '0788000000',
            'sale_date' => today()->toDateString(),
            'lines' => [['item_id' => $this->shirt->id, 'quantity' => 4, 'unit_price' => 5000]],
            'discount_amount' => 0,
            'paid_amount' => 20000,
            'payment_method' => 'cash',
        ], $overrides);
    }

    private function onHand(): float
    {
        return (float) StockBalance::where('item_id', $this->shirt->id)->sum('quantity_on_hand');
    }

    public function test_recording_a_sale_takes_stock_out_and_works_out_the_totals(): void
    {
        $response = $this->postJson('/api/sales/manual', $this->sale(['discount_amount' => 2000, 'paid_amount' => 10000]))->assertCreated();

        $sale = $response->json('sale');
        $this->assertStringStartsWith('SL-' . now()->format('Y') . '-', $sale['document_number']);
        $this->assertEquals(18000, $sale['total_amount']);
        $this->assertEquals(10000, $sale['paid_amount']);
        $this->assertSame('partially_paid', $sale['payment_status']);
        $this->assertSame('delivered', $sale['status']);
        $this->assertEquals(46, $this->onHand());
    }

    public function test_a_fully_paid_sale_is_marked_paid_and_a_credit_sale_unpaid(): void
    {
        $paid = $this->postJson('/api/sales/manual', $this->sale())->assertCreated()->json('sale');
        $credit = $this->postJson('/api/sales/manual', $this->sale(['paid_amount' => 0, 'payment_method' => null, 'due_date' => today()->addDays(7)->toDateString()]))->assertCreated()->json('sale');

        $this->assertSame('paid', $paid['payment_status']);
        $this->assertSame('unpaid', $credit['payment_status']);
        $this->assertCount(0, $credit['payments']);
    }

    public function test_it_refuses_to_sell_more_than_is_in_stock_and_changes_nothing(): void
    {
        $this->postJson('/api/sales/manual', $this->sale(['lines' => [['item_id' => $this->shirt->id, 'quantity' => 51, 'unit_price' => 5000]], 'paid_amount' => 0]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('lines.0.quantity');

        $this->assertSame(0, SalesDocument::count());
        $this->assertEquals(50, $this->onHand());
    }

    public function test_stock_can_be_left_alone_when_the_factory_does_not_track_it(): void
    {
        $this->postJson('/api/sales/manual', $this->sale(['lines' => [['item_id' => $this->shirt->id, 'quantity' => 80, 'unit_price' => 5000]], 'paid_amount' => 0, 'deduct_stock' => false]))->assertCreated();

        $this->assertEquals(50, $this->onHand());
    }

    public function test_a_payment_can_be_added_later_but_never_more_than_is_owed(): void
    {
        $sale = $this->postJson('/api/sales/manual', $this->sale(['paid_amount' => 5000]))->assertCreated()->json('sale');

        $this->postJson("/api/sales/manual/{$sale['id']}/payments", ['amount' => 20000, 'method' => 'cash'])->assertUnprocessable();

        $this->postJson("/api/sales/manual/{$sale['id']}/payments", ['amount' => 15000, 'method' => 'mobile_money', 'reference' => 'MM123'])
            ->assertOk()
            ->assertJsonPath('sale.payment_status', 'paid');

        $this->postJson("/api/sales/manual/{$sale['id']}/payments", ['amount' => 1, 'method' => 'cash'])->assertUnprocessable();
    }

    public function test_cancelling_a_sale_puts_the_stock_back_and_refunds_what_was_paid(): void
    {
        $sale = $this->postJson('/api/sales/manual', $this->sale())->assertCreated()->json('sale');
        $this->assertEquals(46, $this->onHand());

        $this->postJson("/api/sales/manual/{$sale['id']}/cancel", ['reason' => 'Wrong size'])->assertOk()->assertJsonPath('sale.status', 'cancelled');

        $this->assertEquals(50, $this->onHand());
        $this->assertEquals(0, SalesDocument::find($sale['id'])->paid_amount);
        $this->assertEquals(0, SalesPayment::where('sales_document_id', $sale['id'])->sum('amount'), 'Payment and refund cancel out.');

        $this->postJson("/api/sales/manual/{$sale['id']}/cancel", ['reason' => 'Again'])->assertUnprocessable();
        $this->assertEquals(50, $this->onHand(), 'A second cancel does not return stock twice.');
    }

    public function test_the_report_adds_up_and_ignores_cancelled_sales(): void
    {
        $this->postJson('/api/sales/manual', $this->sale())->assertCreated();
        $this->postJson('/api/sales/manual', $this->sale(['customer_name' => 'Marie', 'paid_amount' => 0, 'payment_method' => null, 'lines' => [['item_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 6000]]]))->assertCreated();
        $cancelled = $this->postJson('/api/sales/manual', $this->sale(['customer_name' => 'Void', 'paid_amount' => 0, 'payment_method' => null]))->json('sale');
        $this->postJson("/api/sales/manual/{$cancelled['id']}/cancel", ['reason' => 'Mistake'])->assertOk();

        $report = $this->getJson('/api/sales/manual/report?from=' . today()->subDays(6)->toDateString() . '&to=' . today()->toDateString())->assertOk()->json();

        $this->assertEquals(32000, $report['summary']['revenue']['current']);
        $this->assertEquals(2, $report['summary']['sales']['current']);
        $this->assertEquals(16000, $report['summary']['average_sale']['current']);
        $this->assertEquals(6, $report['summary']['items_sold']['current']);
        $this->assertEquals(20000, $report['summary']['collected']);
        $this->assertEquals(12000, $report['summary']['outstanding']);
        $this->assertCount(7, $report['trend']);
        $this->assertSame('Polo shirt', $report['top_products'][0]['name']);
        $this->assertEquals(6, $report['top_products'][0]['quantity']);
        $this->assertSame('Marie', $report['debtors'][0]['customer']);
        $this->assertEquals(12000, $report['debtors'][0]['balance']);
        $this->assertSame('cash', $report['payment_methods'][0]['method']);
    }

    public function test_the_overview_lists_sales_and_the_products_that_can_be_sold(): void
    {
        $this->postJson('/api/sales/manual', $this->sale())->assertCreated();

        $data = $this->getJson('/api/sales/manual/overview')->assertOk()->json();

        $this->assertCount(1, $data['sales']['data']);
        $this->assertSame(1, $data['today']['sales']);
        $this->assertEquals(46, $data['form']['items'][0]['on_hand']);
        $this->assertEquals(5000, $data['form']['items'][0]['last_price']);
        $this->assertSame('Jean Claude', $data['form']['customers'][0]['name']);
        $this->assertTrue($data['capabilities']['record']);
    }

    public function test_an_owner_can_read_the_reports_but_cannot_record_sales(): void
    {
        $owner = $this->makeUser($this->factory, 'owner@test.test', 'factory-owner');

        $this->actingAs($owner)->getJson('/api/sales/manual/report')->assertOk();
        $this->actingAs($owner)->getJson('/api/sales/manual/overview')->assertOk()->assertJsonPath('capabilities.record', false)->assertJsonPath('form', null);
        $this->actingAs($owner)->postJson('/api/sales/manual', $this->sale())->assertForbidden();
    }

    public function test_one_factory_cannot_see_or_touch_another_factorys_sales(): void
    {
        $sale = $this->postJson('/api/sales/manual', $this->sale())->assertCreated()->json('sale');

        $other = $this->makeFactory('Other Works', 'other-works');
        $stranger = $this->makeUser($other, 'other@test.test', 'sales-officer');

        $this->actingAs($stranger)->postJson("/api/sales/manual/{$sale['id']}/payments", ['amount' => 1, 'method' => 'cash'])->assertNotFound();
        $this->actingAs($stranger)->getJson("/api/sales/manual/{$sale['id']}/receipt")->assertNotFound();
        $this->assertSame(0, $this->actingAs($stranger)->getJson('/api/sales/manual/overview')->json('sales.total'));
    }

    public function test_a_receipt_can_be_printed(): void
    {
        $sale = $this->postJson('/api/sales/manual', $this->sale())->assertCreated()->json('sale');

        $response = $this->get("/api/sales/manual/{$sale['id']}/receipt")->assertOk();

        $this->assertStringContainsString('application/pdf', $response->headers->get('Content-Type'));
    }

    public function test_bad_input_is_rejected(): void
    {
        $this->postJson('/api/sales/manual', $this->sale(['lines' => []]))->assertUnprocessable();
        $this->postJson('/api/sales/manual', $this->sale(['paid_amount' => 999999]))->assertUnprocessable();
        $this->postJson('/api/sales/manual', $this->sale(['discount_amount' => 999999]))->assertUnprocessable();
        $this->postJson('/api/sales/manual', $this->sale(['sale_date' => today()->addDay()->toDateString()]))->assertUnprocessable();
        $this->postJson('/api/sales/manual', $this->sale(['payment_method' => 'gold']))->assertUnprocessable();
        $this->postJson('/api/sales/manual', $this->sale(['lines' => [['item_id' => 99999, 'quantity' => 1, 'unit_price' => 1]]]))->assertUnprocessable();
    }
}
