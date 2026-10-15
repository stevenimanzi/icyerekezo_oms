<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Factory;
use App\Models\Item;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class StockMovementTest extends TestCase
{
    use RefreshDatabase;

    private Factory $factory;

    private Warehouse $warehouse;

    private Unit $unit;

    private User $keeper;

    private Supplier $supplier;

    protected function setUp(): void
    {
        parent::setUp();
        PermissionCatalog::seed();

        $this->factory = $this->makeFactory('Garment Works', 'garment-works');
        $this->unit = Unit::create(['factory_id' => $this->factory->id, 'name' => 'Metre', 'symbol' => 'm']);
        $this->warehouse = Warehouse::create(['factory_id' => $this->factory->id, 'name' => 'Main', 'code' => 'MAIN', 'type' => 'general']);
        $this->keeper = $this->member('warehouse-keeper');
        $this->supplier = $this->makeSupplier('Kigali Textiles');
    }

    private function makeFactory(string $name, string $slug): Factory
    {
        $factory = Factory::create(['uuid' => (string) Str::uuid(), 'name' => $name, 'slug' => $slug, 'industry_type' => 'clothing_textiles', 'status' => 'active', 'currency_code' => 'RWF']);
        RoleTemplateCatalog::createFor($factory);

        return $factory;
    }

    private function member(string $slug, ?Factory $factory = null): User
    {
        $factory ??= $this->factory;
        $user = User::factory()->create(['email' => Str::random(8) . "-{$slug}@test.test", 'current_factory_id' => $factory->id]);
        $user->factories()->attach($factory->id, ['is_owner' => false, 'is_active' => true]);
        $user->roles()->attach(Role::where(['factory_id' => $factory->id, 'slug' => $slug])->value('id'), ['factory_id' => $factory->id]);

        return $user;
    }

    private function makeSupplier(string $name, ?Factory $factory = null, string $status = 'active'): Supplier
    {
        return Supplier::create([
            'factory_id' => ($factory ?? $this->factory)->id, 'code' => 'SUP-' . Str::upper(Str::random(5)), 'name' => $name,
            'phone' => '0788000000', 'payment_terms_days' => 0, 'status' => $status,
        ]);
    }

    private function item(string $name, string $type = 'raw_material', array $extra = []): Item
    {
        return Item::create(array_merge([
            'factory_id' => $this->factory->id, 'unit_id' => $this->unit->id, 'type' => $type, 'name' => $name,
            'sku' => Str::upper(Str::random(6)), 'standard_cost' => 1000, 'is_active' => true,
        ], $extra));
    }

    private function onHand(Item $item): float
    {
        return (float) StockBalance::where('item_id', $item->id)->sum('quantity_on_hand');
    }

    private function receive(array $extra = [], ?Item $item = null)
    {
        $item ??= $this->item('Blue cotton');

        return $this->actingAs($this->keeper)->postJson('/api/stock/receipts', array_merge([
            'item_id' => $item->id, 'warehouse_id' => $this->warehouse->id, 'quantity' => 50, 'unit_cost' => 2500, 'supplier_id' => $this->supplier->id, 'reference' => 'DN-77',
        ], $extra));
    }

    public function test_recording_a_delivery_adds_it_to_stock_with_who_and_where_it_came_from(): void
    {
        $item = $this->item('Blue cotton');

        $this->receive([], $item)->assertCreated();

        $this->assertSame(50.0, $this->onHand($item));
        $row = StockTransaction::where('item_id', $item->id)->firstOrFail();
        $this->assertSame('receipt', $row->type);
        $this->assertSame($this->keeper->id, $row->performed_by);
        $this->assertSame(2500.0, (float) $row->unit_cost);
        $this->assertStringContainsString('Kigali Textiles', $row->reason);
        $this->assertStringContainsString('DN-77', $row->reason);
        $this->assertSame($this->supplier->id, (int) $row->reference_id, 'The delivery is linked to the supplier record.');
    }

    public function test_a_delivery_must_name_a_supplier_that_belongs_to_this_factory_and_is_active(): void
    {
        $item = $this->item('Blue cotton');
        $other = $this->makeFactory('Other Works', 'other-works');

        $this->receive(['supplier_id' => null], $item)->assertUnprocessable()->assertJsonValidationErrors('supplier_id');
        $this->receive(['supplier_id' => $this->makeSupplier('Theirs', $other)->id], $item)->assertUnprocessable()->assertJsonValidationErrors('supplier_id');
        $this->receive(['supplier_id' => $this->makeSupplier('Closed', null, 'inactive')->id], $item)->assertUnprocessable()->assertJsonValidationErrors('supplier_id');

        $this->assertSame(0.0, $this->onHand($item));
    }

    public function test_a_new_supplier_is_saved_with_all_its_contact_details(): void
    {
        $response = $this->actingAs($this->keeper)->postJson('/api/stock/suppliers', [
            'name' => 'Musanze Fabrics Ltd', 'contact_person' => 'Jean Claude', 'phone' => '0788123456', 'email' => 'sales@musanze.test',
            'address' => 'KG 7 Ave, Kigali', 'tax_number' => 'TIN-998', 'payment_terms_days' => 30, 'notes' => 'Delivers on Mondays',
        ])->assertCreated();

        $saved = Supplier::findOrFail($response->json('supplier.id'));
        $this->assertSame($this->factory->id, $saved->factory_id);
        $this->assertSame('Jean Claude', $saved->contact_person);
        $this->assertSame('0788123456', $saved->phone);
        $this->assertSame('sales@musanze.test', $saved->email);
        $this->assertSame('KG 7 Ave, Kigali', $saved->address);
        $this->assertSame('TIN-998', $saved->tax_number);
        $this->assertSame(30, (int) $saved->payment_terms_days);
        $this->assertSame('Delivers on Mondays', $saved->notes);
        $this->assertStringStartsWith('SUP-', $saved->code);

        $listed = collect($this->actingAs($this->keeper)->getJson('/api/stock/movements?direction=in')->json('suppliers'))->pluck('name');
        $this->assertTrue($listed->contains('Musanze Fabrics Ltd'));
    }

    public function test_a_supplier_needs_a_name_and_a_phone_and_cannot_be_added_twice(): void
    {
        $this->actingAs($this->keeper)->postJson('/api/stock/suppliers', ['name' => 'No Phone Ltd'])->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->actingAs($this->keeper)->postJson('/api/stock/suppliers', ['phone' => '078'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->actingAs($this->keeper)->postJson('/api/stock/suppliers', ['name' => 'Kigali Textiles', 'phone' => '0788'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->actingAs($this->member('cutting-operator'))->postJson('/api/stock/suppliers', ['name' => 'Sneaky Ltd', 'phone' => '0788'])->assertForbidden();

        $this->assertSame(1, Supplier::count());
    }

    public function test_the_stock_in_list_names_the_supplier_and_a_batch_remembers_it(): void
    {
        $milk = $this->item('Milk', 'raw_material', ['batch_tracked' => true]);
        $this->receive(['batch_number' => 'B-9'], $milk)->assertCreated();

        $row = $this->actingAs($this->keeper)->getJson('/api/stock/movements?direction=in')->json('movements.data.0');

        $this->assertSame('Kigali Textiles', $row['supplier']);
        $this->assertSame($this->supplier->id, Batch::where('item_id', $milk->id)->value('supplier_id'));
    }

    public function test_batch_and_expiry_tracked_items_need_a_batch_number_and_an_expiry_date(): void
    {
        $milk = $this->item('Milk', 'raw_material', ['batch_tracked' => true, 'expiry_tracked' => true]);

        $this->receive([], $milk)->assertUnprocessable()->assertJsonValidationErrors('batch_number');
        $this->receive(['batch_number' => 'B-1'], $milk)->assertUnprocessable()->assertJsonValidationErrors('expires_on');
        $this->receive(['batch_number' => 'B-1', 'expires_on' => now()->subDay()->toDateString()], $milk)->assertUnprocessable()->assertJsonValidationErrors('expires_on');
        $this->assertSame(0.0, $this->onHand($milk));

        $this->receive(['batch_number' => 'B-1', 'expires_on' => now()->addDays(10)->toDateString()], $milk)->assertCreated();
        $this->receive(['batch_number' => 'B-1', 'expires_on' => now()->addDays(10)->toDateString(), 'quantity' => 10], $milk)->assertCreated();

        $this->assertSame(1, Batch::where('item_id', $milk->id)->count(), 'The same lot number is one batch, not two.');
        $this->assertSame(60.0, $this->onHand($milk));
    }

    public function test_a_delivery_cannot_go_to_another_factorys_warehouse_or_item(): void
    {
        $other = $this->makeFactory('Other Works', 'other-works');
        $foreign = Warehouse::create(['factory_id' => $other->id, 'name' => 'Theirs', 'code' => 'T', 'type' => 'general']);

        $this->receive(['warehouse_id' => $foreign->id])->assertUnprocessable();
        $this->assertSame(0, StockTransaction::count());
    }

    public function test_only_people_with_receive_permission_can_record_a_delivery(): void
    {
        $item = $this->item('Blue cotton');

        $this->actingAs($this->member('cutting-operator'))->postJson('/api/stock/receipts', [
            'item_id' => $item->id, 'warehouse_id' => $this->warehouse->id, 'quantity' => 5,
        ])->assertForbidden();
    }

    public function test_stock_out_takes_stock_away_and_damage_is_recorded_as_waste(): void
    {
        $item = $this->item('Blue cotton');
        $this->receive(['quantity' => 100], $item)->assertCreated();

        $this->actingAs($this->keeper)->postJson('/api/stock/issues', ['item_id' => $item->id, 'quantity' => 30, 'reason_type' => 'used'])->assertCreated();
        $this->actingAs($this->keeper)->postJson('/api/stock/issues', ['item_id' => $item->id, 'quantity' => 5, 'reason_type' => 'damaged', 'note' => 'Water damage'])->assertCreated();

        $this->assertSame(65.0, $this->onHand($item));
        $this->assertSame(['issue', 'waste'], StockTransaction::where('item_id', $item->id)->whereIn('type', ['issue', 'waste'])->orderBy('id')->pluck('type')->all());
    }

    public function test_stock_out_cannot_take_more_than_is_there_and_damage_needs_a_note(): void
    {
        $item = $this->item('Blue cotton');
        $this->receive(['quantity' => 10], $item)->assertCreated();

        $this->actingAs($this->keeper)->postJson('/api/stock/issues', ['item_id' => $item->id, 'quantity' => 11, 'reason_type' => 'used'])->assertUnprocessable();
        $this->actingAs($this->keeper)->postJson('/api/stock/issues', ['item_id' => $item->id, 'quantity' => 1, 'reason_type' => 'lost'])->assertUnprocessable()->assertJsonValidationErrors('note');

        $this->assertSame(10.0, $this->onHand($item));
    }

    public function test_the_lists_show_only_this_factorys_movements_in_the_right_direction(): void
    {
        $item = $this->item('Blue cotton');
        $this->receive(['quantity' => 100, 'unit_cost' => 1000], $item)->assertCreated();
        $this->actingAs($this->keeper)->postJson('/api/stock/issues', ['item_id' => $item->id, 'quantity' => 20, 'reason_type' => 'used'])->assertCreated();

        $in = $this->actingAs($this->keeper)->getJson('/api/stock/movements?direction=in')->assertOk();
        $this->assertSame(1, $in->json('summary.entries'));
        $this->assertEquals(100000, $in->json('summary.value'));
        $this->assertSame('receipt', $in->json('movements.data.0.type'));
        $this->assertEquals(80, collect($in->json('items'))->firstWhere('id', $item->id)['available']);

        $out = $this->actingAs($this->keeper)->getJson('/api/stock/movements?direction=out')->assertOk();
        $this->assertSame(1, $out->json('summary.entries'));
        $this->assertEquals(20, $out->json('movements.data.0.quantity'));

        $other = $this->makeFactory('Other Works', 'other-works');
        $stranger = $this->member('warehouse-keeper', $other);
        $this->assertSame(0, $this->actingAs($stranger)->getJson('/api/stock/movements?direction=in')->json('summary.entries'));
    }

    public function test_fabric_approved_for_cutting_shows_up_as_stock_out(): void
    {
        $item = $this->item('Blue cotton');
        $this->receive(['quantity' => 100], $item)->assertCreated();
        $cutter = $this->member('cutting-operator');

        $id = $this->actingAs($cutter)->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $item->id, 'quantity' => 40, 'reason' => 'School polo order'])->assertCreated()->json('request.id');
        $this->actingAs($this->keeper)->postJson("/api/flow/requests/{$id}/decision", ['decision' => 'approve'])->assertOk();

        $out = $this->actingAs($this->keeper)->getJson('/api/stock/movements?direction=out')->json('movements.data');
        $this->assertCount(1, $out);
        $this->assertEquals(40, $out[0]['quantity']);
        $this->assertSame(60.0, $this->onHand($item));
    }

    public function test_analytics_separates_raw_materials_from_finished_goods_and_flags_low_stock(): void
    {
        $fabric = $this->item('Blue cotton', 'raw_material', ['standard_cost' => 1000, 'reorder_level' => 100]);
        $thread = $this->item('Thread', 'raw_material', ['standard_cost' => 50, 'reorder_level' => 10]);
        $polo = $this->item('School polo', 'finished_good', ['standard_cost' => 5000]);
        $this->item('Empty item', 'raw_material');

        $this->receive(['quantity' => 40, 'unit_cost' => 1000], $fabric)->assertCreated();
        $this->receive(['quantity' => 500, 'unit_cost' => 50], $thread)->assertCreated();
        $this->receive(['quantity' => 20, 'unit_cost' => 5000], $polo)->assertCreated();
        StockBalance::where('item_id', $polo->id)->update(['quantity_quarantined' => 8]);

        $report = $this->actingAs($this->keeper)->getJson('/api/stock/analytics?days=7')->assertOk()->json();

        $this->assertEquals(40000 + 25000, $report['kpis']['raw_value']);
        $this->assertEquals(100000, $report['kpis']['finished_value']);
        $this->assertSame(1, $report['kpis']['low_stock'], 'Fabric is at 40 against a reorder level of 100.');
        $this->assertSame(1, $report['kpis']['out_of_stock']);
        $this->assertEquals(8, $report['kpis']['held_for_quality']);
        $this->assertSame(['School polo'], array_column($report['finished_goods'], 'name'));
        $this->assertEquals(12, $report['finished_goods'][0]['available'], 'Eight pieces wait for quality control and are not available.');
        $this->assertCount(3, $report['raw_materials']);
        $this->assertSame('Blue cotton', $report['attention'][0]['name']);
        $this->assertCount(7, $report['movement']['daily']);
        $this->assertEquals(40000 + 25000 + 100000, $report['movement']['received_value']);
    }
}
