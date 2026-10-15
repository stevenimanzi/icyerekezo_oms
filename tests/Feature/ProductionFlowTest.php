<?php

namespace Tests\Feature;

use App\Models\Factory;
use App\Models\Item;
use App\Models\ProductionLot;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductionFlowTest extends TestCase
{
    use RefreshDatabase;

    private Factory $factory;

    private Warehouse $warehouse;

    private Item $fabric;

    private array $users = [];

    protected function setUp(): void
    {
        parent::setUp();
        PermissionCatalog::seed();

        $this->factory = $this->makeFactory('Garment Works', 'garment-works');
        $unit = Unit::create(['factory_id' => $this->factory->id, 'name' => 'Metre', 'symbol' => 'm']);
        $this->warehouse = Warehouse::create(['factory_id' => $this->factory->id, 'name' => 'Main', 'code' => 'MAIN', 'type' => 'general']);
        $this->fabric = Item::create(['factory_id' => $this->factory->id, 'unit_id' => $unit->id, 'type' => 'raw_material', 'name' => 'Blue cotton', 'sku' => 'COT-1', 'standard_cost' => 2000, 'is_active' => true]);
        StockBalance::create(['factory_id' => $this->factory->id, 'item_id' => $this->fabric->id, 'warehouse_id' => $this->warehouse->id, 'quantity_on_hand' => 100]);

        foreach (['warehouse-keeper', 'cutting-operator', 'sewing-operator', 'finishing-manager', 'packaging-operator', 'quality-officer', 'production-manager'] as $slug) {
            $this->users[$slug] = $this->makeUser($this->factory, "{$slug}@test.test", $slug);
        }
    }

    private function makeFactory(string $name, string $slug): Factory
    {
        $factory = Factory::create(['uuid' => (string) Str::uuid(), 'name' => $name, 'slug' => $slug, 'industry_type' => 'clothing', 'status' => 'active', 'currency_code' => 'RWF']);
        RoleTemplateCatalog::createFor($factory);

        return $factory;
    }

    private function makeUser(Factory $factory, string $email, string $slug): User
    {
        $user = User::factory()->create(['email' => $email, 'current_factory_id' => $factory->id]);
        $user->factories()->attach($factory->id, ['is_owner' => false, 'is_active' => true]);
        $user->roles()->attach(Role::where(['factory_id' => $factory->id, 'slug' => $slug])->value('id'), ['factory_id' => $factory->id]);

        return $user;
    }

    private function as(string $slug): static
    {
        return $this->actingAs($this->users[$slug]);
    }

    private function fabricAtWarehouse(): float
    {
        return (float) StockBalance::where('item_id', $this->fabric->id)->where('warehouse_id', $this->warehouse->id)->sum('quantity_on_hand');
    }

    private function approvedFabric(float $quantity = 40): void
    {
        $id = $this->as('cutting-operator')->postJson('/api/flow/requests', [
            'stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => $quantity, 'reason' => 'Polo shirts for the school order',
        ])->assertCreated()->json('request.id');

        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$id}/decision", ['decision' => 'approve'])->assertOk();
    }

    private function cutLot(int $pieces = 100, array $extra = []): int
    {
        $response = $this->as('cutting-operator')->postJson('/api/flow/cutting', array_merge([
            'product_name' => 'Polo shirt', 'color' => 'Blue', 'size' => 'M', 'fabric_item_id' => $this->fabric->id,
            'fabric_used' => 30, 'fabric_waste' => 2, 'good_quantity' => $pieces, 'damaged_quantity' => 3,
        ], $extra));

        return $response->assertCreated()->json('lot.id');
    }

    private function send(string $as, int $lot, string $from, int $quantity): int
    {
        return $this->as($as)->postJson("/api/flow/lots/{$lot}/send", ['from_stage' => $from, 'quantity' => $quantity])->assertCreated()->json('transfer.id');
    }

    private function receive(string $as, int $transfer, int $quantity, ?string $note = null): void
    {
        $this->as($as)->postJson("/api/flow/transfers/{$transfer}/receive", ['quantity' => $quantity, 'note' => $note])->assertOk();
    }

    private function work(string $as, int $lot, string $stage, int $good, int $damaged = 0)
    {
        return $this->as($as)->postJson("/api/flow/lots/{$lot}/entries", ['stage' => $stage, 'good_quantity' => $good, 'damaged_quantity' => $damaged]);
    }

    private function stages(int $lot): array
    {
        return $this->as('production-manager')->getJson("/api/flow/lots/{$lot}")->assertOk()->json('balances.stages');
    }

    private function packedStock(int $lot): array
    {
        $item = ProductionLot::find($lot)->product_item_id;
        $balance = StockBalance::where('item_id', $item)->first();

        return [(float) ($balance->quantity_on_hand ?? 0), (float) ($balance->quantity_quarantined ?? 0)];
    }

    public function test_the_warehouse_approves_a_request_and_the_fabric_really_leaves_its_stock(): void
    {
        $id = $this->as('cutting-operator')->postJson('/api/flow/requests', [
            'stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 40, 'reason' => 'Polo shirts',
        ])->assertCreated()->json('request.id');

        $this->assertEquals(100, $this->fabricAtWarehouse());

        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$id}/decision", ['decision' => 'approve'])
            ->assertOk()->assertJsonPath('request.status', 'approved');

        $this->assertEquals(60, $this->fabricAtWarehouse());

        $overview = $this->as('cutting-operator')->getJson('/api/flow/overview?stage=cutting')->assertOk()->json();
        $this->assertEquals(40, $overview['materials'][0]['on_hand']);
    }

    public function test_only_the_warehouse_decides_and_never_on_its_own_request(): void
    {
        $id = $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 10, 'reason' => 'Test'])->json('request.id');

        $this->as('cutting-operator')->postJson("/api/flow/requests/{$id}/decision", ['decision' => 'approve'])->assertForbidden();
        $this->as('sewing-operator')->postJson("/api/flow/requests/{$id}/decision", ['decision' => 'approve'])->assertForbidden();

        $own = $this->as('warehouse-keeper')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 1, 'reason' => 'Test']);
        $own->assertForbidden();

        $this->assertEquals(100, $this->fabricAtWarehouse());
    }

    public function test_a_request_can_be_declined_with_a_reason_or_cancelled_and_takes_no_stock(): void
    {
        $declined = $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 10, 'reason' => 'Test'])->json('request.id');
        $cancelled = $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 10, 'reason' => 'Test two'])->json('request.id');

        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$declined}/decision", ['decision' => 'reject'])->assertUnprocessable();
        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$declined}/decision", ['decision' => 'reject', 'note' => 'Use the old roll first'])->assertOk()->assertJsonPath('request.status', 'rejected');
        $this->as('cutting-operator')->postJson("/api/flow/requests/{$cancelled}/cancel")->assertOk()->assertJsonPath('request.status', 'cancelled');
        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$cancelled}/decision", ['decision' => 'approve'])->assertUnprocessable();

        $this->assertEquals(100, $this->fabricAtWarehouse());
    }

    public function test_approval_fails_cleanly_when_the_warehouse_does_not_have_enough(): void
    {
        $id = $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 500, 'reason' => 'Big order'])->json('request.id');

        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$id}/decision", ['decision' => 'approve'])->assertUnprocessable()->assertJsonValidationErrors('quantity');

        $this->as('warehouse-keeper')->getJson('/api/flow/requests')->assertJsonPath('requests.0.status', 'pending');
        $this->assertEquals(100, $this->fabricAtWarehouse());
    }

    public function test_cutting_needs_approved_fabric_and_cannot_use_more_than_it_was_given(): void
    {
        $this->as('cutting-operator')->postJson('/api/flow/cutting', [
            'product_name' => 'Polo shirt', 'fabric_item_id' => $this->fabric->id, 'fabric_used' => 5, 'good_quantity' => 20,
        ])->assertUnprocessable()->assertJsonValidationErrors('fabric_used');

        $this->approvedFabric(40);

        $this->cutLot(100, ['fabric_used' => 30, 'fabric_waste' => 2]);

        $this->as('cutting-operator')->postJson('/api/flow/cutting', [
            'product_name' => 'Polo shirt', 'fabric_item_id' => $this->fabric->id, 'fabric_used' => 9, 'good_quantity' => 10,
        ])->assertUnprocessable()->assertJsonValidationErrors('fabric_used');

        $overview = $this->as('cutting-operator')->getJson('/api/flow/overview?stage=cutting')->json();
        $this->assertEquals(8, $overview['materials'][0]['on_hand']);
    }

    public function test_cutting_creates_a_numbered_lot_and_more_can_be_added_to_it(): void
    {
        $this->approvedFabric(80);
        $lot = $this->cutLot(50);

        $this->as('cutting-operator')->postJson('/api/flow/cutting', [
            'lot_id' => $lot, 'fabric_item_id' => $this->fabric->id, 'fabric_used' => 10, 'good_quantity' => 25,
        ])->assertCreated();

        $detail = $this->as('production-manager')->getJson("/api/flow/lots/{$lot}")->json();

        $this->assertStringStartsWith('CUT-' . now()->format('ymd') . '-', $detail['lot']['lot_number']);
        $this->assertSame('Polo shirt', $detail['lot']['product']);
        $this->assertSame(75, $detail['balances']['cut']);
        $this->assertSame(75, $detail['balances']['stages']['cutting']['outbox']);
    }

    public function test_pieces_only_count_at_the_next_stage_after_it_receives_them(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);

        $this->work('sewing-operator', $lot, 'sewing', 10)->assertUnprocessable();

        $transfer = $this->send('cutting-operator', $lot, 'cutting', 60);

        $this->assertSame(40, $this->stages($lot)['cutting']['outbox']);
        $this->assertSame(60, $this->stages($lot)['sewing']['incoming']);
        $this->assertSame(0, $this->stages($lot)['sewing']['wip']);
        $this->work('sewing-operator', $lot, 'sewing', 10)->assertUnprocessable();

        $this->receive('sewing-operator', $transfer, 60);

        $this->assertSame(60, $this->stages($lot)['sewing']['wip']);
        $this->assertSame(0, $this->stages($lot)['sewing']['incoming']);
    }

    public function test_a_stage_cannot_send_more_than_it_finished_or_work_on_more_than_it_received(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);

        $this->as('cutting-operator')->postJson("/api/flow/lots/{$lot}/send", ['from_stage' => 'cutting', 'quantity' => 101])->assertUnprocessable();

        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 50), 50);

        $this->work('sewing-operator', $lot, 'sewing', 40, 11)->assertUnprocessable();
        $this->work('sewing-operator', $lot, 'sewing', 40, 10)->assertCreated();
        $this->as('sewing-operator')->postJson("/api/flow/lots/{$lot}/send", ['from_stage' => 'sewing', 'quantity' => 41])->assertUnprocessable();
    }

    public function test_receiving_fewer_than_were_sent_needs_a_reason_and_is_tracked_as_missing(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);
        $transfer = $this->send('cutting-operator', $lot, 'cutting', 100);

        $this->as('sewing-operator')->postJson("/api/flow/transfers/{$transfer}/receive", ['quantity' => 95])->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->receive('sewing-operator', $transfer, 95, 'Five pieces were still on the cutting table');

        $this->assertSame(5, $this->stages($lot)['sewing']['shortage']);
        $this->assertSame(95, $this->stages($lot)['sewing']['wip']);

        $monitor = $this->as('quality-officer')->getJson('/api/flow/monitor')->json();
        $this->assertSame(5, $monitor['alerts']['missing_pieces']);
    }

    public function test_teams_can_only_act_on_their_own_stage(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);
        $transfer = $this->send('cutting-operator', $lot, 'cutting', 100);

        $this->as('finishing-manager')->postJson("/api/flow/transfers/{$transfer}/receive", ['quantity' => 100])->assertForbidden();
        $this->as('sewing-operator')->postJson("/api/flow/lots/{$lot}/send", ['from_stage' => 'cutting', 'quantity' => 1])->assertForbidden();
        $this->as('sewing-operator')->postJson('/api/flow/cutting', ['product_name' => 'X', 'fabric_item_id' => $this->fabric->id, 'fabric_used' => 1, 'good_quantity' => 1])->assertForbidden();
        $this->as('sewing-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 1, 'reason' => 'Nope'])->assertForbidden();
        $this->work('cutting-operator', $lot, 'sewing', 1)->assertForbidden();

        $this->as('production-manager')->postJson("/api/flow/transfers/{$transfer}/receive", ['quantity' => 100])->assertOk();
    }

    public function test_a_delivery_can_be_taken_back_until_it_is_received(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);
        $transfer = $this->send('cutting-operator', $lot, 'cutting', 100);

        $this->as('cutting-operator')->postJson("/api/flow/transfers/{$transfer}/cancel")->assertOk();
        $this->assertSame(100, $this->stages($lot)['cutting']['outbox']);
        $this->assertSame(0, $this->stages($lot)['sewing']['incoming']);

        $this->as('sewing-operator')->postJson("/api/flow/transfers/{$transfer}/receive", ['quantity' => 100])->assertUnprocessable();

        $second = $this->send('cutting-operator', $lot, 'cutting', 100);
        $this->receive('sewing-operator', $second, 100);
        $this->as('cutting-operator')->postJson("/api/flow/transfers/{$second}/cancel")->assertUnprocessable();
    }

    public function test_the_whole_flow_ends_in_stock_that_stays_unsellable_until_quality_passes_it(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);

        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 100), 100);
        $this->work('sewing-operator', $lot, 'sewing', 92, 8)->assertCreated();
        $this->receive('finishing-manager', $this->send('sewing-operator', $lot, 'sewing', 92), 92);
        $this->work('finishing-manager', $lot, 'finishing', 90, 2)->assertCreated();
        $this->receive('packaging-operator', $this->send('finishing-manager', $lot, 'finishing', 90), 90);
        $this->work('packaging-operator', $lot, 'packing', 90)->assertCreated();

        [$onHand, $held] = $this->packedStock($lot);
        $this->assertEquals(90, $onHand);
        $this->assertEquals(90, $held, 'Packed pieces are in stock but held back until quality passes them.');
        $this->assertSame(90, $this->stages($lot)['packing']['awaiting_quality']);

        $this->as('quality-officer')->postJson('/api/flow/inspections', [
            'lot_id' => $lot, 'stage' => 'packing', 'inspected_quantity' => 90, 'passed_quantity' => 86, 'rejected_quantity' => 4, 'defect_details' => 'Loose buttons',
        ])->assertCreated();

        [$onHand, $held] = $this->packedStock($lot);
        $this->assertEquals(86, $onHand);
        $this->assertEquals(0, $held);

        $balances = $this->as('production-manager')->getJson("/api/flow/lots/{$lot}")->json('balances');
        $this->assertSame(86, $balances['finished']);
        $this->assertSame(0, $balances['in_progress']);
        $this->assertTrue($balances['complete']);
        $this->assertSame('completed', ProductionLot::find($lot)->status);
        $this->assertSame(13, $balances['damaged'], '3 spoiled at cutting, 8 at sewing and 2 at finishing.');
        $this->assertSame(4, $balances['rejected']);
    }

    public function test_a_new_lot_takes_its_colour_from_the_fabric_that_was_cut(): void
    {
        $this->approvedFabric(80);
        $this->fabric->update(['color' => 'Navy']);

        $coloured = $this->cutLot(10, ['color' => 'Red', 'fabric_used' => 10]);
        $this->assertSame('Navy', ProductionLot::find($coloured)->color, 'The fabric colour wins over what was typed.');

        $this->fabric->update(['color' => null]);
        $typed = $this->cutLot(10, ['color' => 'Red', 'fabric_used' => 10]);
        $this->assertSame('Red', ProductionLot::find($typed)->color, 'Without a fabric colour, the typed one is kept.');
        $this->assertSame('Red', $this->fabric->fresh()->color, 'The first colour typed is remembered on the fabric for next time.');

        $next = $this->cutLot(10, ['color' => 'Green', 'fabric_used' => 10]);
        $this->assertSame('Red', ProductionLot::find($next)->color, 'Once the fabric has a colour it fills in by itself.');
        Item::whereKey($this->fabric->id)->update(['color' => null]);

        $options = $this->as('cutting-operator')->getJson('/api/flow/overview?stage=cutting')->json();
        $this->fabric->update(['color' => 'Navy']);
        $again = $this->as('cutting-operator')->getJson('/api/flow/overview?stage=cutting')->json();
        $this->assertSame('Navy', collect($again['materials'])->firstWhere('item_id', $this->fabric->id)['color']);
        $this->assertSame('Navy', collect($again['options']['fabrics'])->firstWhere('id', $this->fabric->id)['color']);
        $this->assertNull(collect($options['materials'])->firstWhere('item_id', $this->fabric->id)['color']);
    }

    public function test_a_team_can_filter_its_own_material_requests_and_see_every_status(): void
    {
        $approved = $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 10, 'reason' => 'Polo order'])->json('request.id');
        $declined = $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 20, 'reason' => 'Skirt order'])->json('request.id');
        $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 30, 'reason' => 'Shirt order'])->assertCreated();
        $this->as('sewing-operator')->postJson('/api/flow/requests', ['stage' => 'sewing', 'item_id' => $this->fabric->id, 'quantity' => 5, 'reason' => 'Thread for polos'])->assertCreated();

        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$approved}/decision", ['decision' => 'approve'])->assertOk();
        $this->as('warehouse-keeper')->postJson("/api/flow/requests/{$declined}/decision", ['decision' => 'reject', 'note' => 'Out of budget'])->assertOk();

        $all = $this->as('cutting-operator')->getJson('/api/flow/requests?stage=cutting&status=all')->assertOk()->json();
        $this->assertCount(3, $all['requests'], 'Only this stage requests, not sewing.');
        $this->assertSame(['pending' => 1, 'approved' => 1, 'rejected' => 1, 'cancelled' => 0, 'all' => 3], $all['counts']);
        $this->assertTrue($all['capabilities']['request']);
        $this->assertNotEmpty($all['options'], 'The catalogue items the team may ask for are returned for the drop-down.');

        $rejected = $this->as('cutting-operator')->getJson('/api/flow/requests?stage=cutting&status=rejected')->json('requests');
        $this->assertSame(['Out of budget'], array_column($rejected, 'decision_note'));

        $found = $this->as('cutting-operator')->getJson('/api/flow/requests?stage=cutting&status=all&q=Shirt')->json('requests');
        $this->assertSame(['Shirt order'], array_column($found, 'reason'));

        $tomorrow = now()->addDay()->toDateString();
        $this->assertCount(0, $this->as('cutting-operator')->getJson("/api/flow/requests?stage=cutting&status=all&from={$tomorrow}")->json('requests'));
    }

    public function test_the_final_check_alert_counts_only_packed_pieces_not_ones_still_to_pack(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);

        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 100), 100);
        $this->work('sewing-operator', $lot, 'sewing', 100)->assertCreated();
        $this->receive('finishing-manager', $this->send('sewing-operator', $lot, 'sewing', 100), 100);
        $this->work('finishing-manager', $lot, 'finishing', 100)->assertCreated();
        $this->receive('packaging-operator', $this->send('finishing-manager', $lot, 'finishing', 100), 100);
        $this->work('packaging-operator', $lot, 'packing', 60)->assertCreated();

        $alert = $this->as('quality-officer')->getJson('/api/flow/monitor')->json('alerts.awaiting_final_check');

        $this->assertCount(1, $alert);
        $this->assertSame(60, $alert[0]['pieces'], '40 more pieces are still waiting to be packed and cannot be checked yet.');

        $this->as('quality-officer')->postJson('/api/flow/inspections', [
            'lot_id' => $lot, 'stage' => 'packing', 'inspected_quantity' => 60, 'passed_quantity' => 60, 'rejected_quantity' => 0,
        ])->assertCreated();

        $checks = $this->as('quality-officer')->getJson('/api/flow/monitor')->assertOk()->json('inspections');
        $this->assertCount(1, $checks);
        $this->assertSame(ProductionLot::find($lot)->lot_number, $checks[0]['lot_number']);
        $this->assertSame(60, $checks[0]['passed']);
    }

    public function test_packed_pieces_cannot_be_checked_for_more_than_is_waiting(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(20);
        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 20), 20);
        $this->work('sewing-operator', $lot, 'sewing', 20)->assertCreated();
        $this->receive('finishing-manager', $this->send('sewing-operator', $lot, 'sewing', 20), 20);
        $this->work('finishing-manager', $lot, 'finishing', 20)->assertCreated();
        $this->receive('packaging-operator', $this->send('finishing-manager', $lot, 'finishing', 20), 20);
        $this->work('packaging-operator', $lot, 'packing', 20)->assertCreated();

        $this->as('quality-officer')->postJson('/api/flow/inspections', ['lot_id' => $lot, 'stage' => 'packing', 'inspected_quantity' => 25, 'passed_quantity' => 21, 'rejected_quantity' => 0])->assertUnprocessable();
        $this->as('packaging-operator')->postJson('/api/flow/inspections', ['lot_id' => $lot, 'stage' => 'packing', 'inspected_quantity' => 20, 'passed_quantity' => 20, 'rejected_quantity' => 0])->assertForbidden();
    }

    public function test_quality_rejections_before_packing_remove_pieces_from_the_stage(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);
        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 100), 100);
        $this->work('sewing-operator', $lot, 'sewing', 80)->assertCreated();

        $this->as('quality-officer')->postJson('/api/flow/inspections', ['lot_id' => $lot, 'stage' => 'sewing', 'inspected_quantity' => 20, 'passed_quantity' => 15, 'rejected_quantity' => 5, 'defect_details' => 'Crooked seams'])->assertCreated();

        $this->assertSame(75, $this->stages($lot)['sewing']['outbox']);
        $this->as('quality-officer')->postJson('/api/flow/inspections', ['lot_id' => $lot, 'stage' => 'sewing', 'inspected_quantity' => 90, 'passed_quantity' => 0, 'rejected_quantity' => 76])->assertUnprocessable();
    }

    public function test_a_lot_on_quality_hold_cannot_move_until_released(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);

        $this->as('cutting-operator')->postJson("/api/flow/lots/{$lot}/hold", ['reason' => 'Wrong fabric'])->assertForbidden();
        $this->as('quality-officer')->postJson("/api/flow/lots/{$lot}/hold", ['reason' => 'Wrong fabric shade'])->assertOk();

        $this->as('cutting-operator')->postJson("/api/flow/lots/{$lot}/send", ['from_stage' => 'cutting', 'quantity' => 10])->assertUnprocessable();

        $monitor = $this->as('quality-officer')->getJson('/api/flow/monitor?status=held')->json();
        $this->assertCount(1, $monitor['lots']);
        $this->assertSame('held', $monitor['lots'][0]['status']);

        $this->as('quality-officer')->postJson("/api/flow/lots/{$lot}/release")->assertOk();
        $this->send('cutting-operator', $lot, 'cutting', 10);
    }

    public function test_a_record_can_be_cancelled_only_if_nothing_later_depends_on_it(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);
        $entry = $this->as('cutting-operator')->getJson('/api/flow/overview?stage=cutting')->json('entries.0.id');

        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 100), 100);

        $this->as('cutting-operator')->postJson("/api/flow/entries/{$entry}/void", ['reason' => 'Typed the wrong number'])->assertUnprocessable();

        $sew = $this->work('sewing-operator', $lot, 'sewing', 50)->json('entry.id');
        $this->as('sewing-operator')->postJson("/api/flow/entries/{$sew}/void", ['reason' => 'Counted twice'])->assertOk();

        $this->assertSame(100, $this->stages($lot)['sewing']['wip']);
        $this->as('sewing-operator')->postJson("/api/flow/entries/{$sew}/void", ['reason' => 'Again'])->assertUnprocessable();
    }

    public function test_cancelling_a_packing_record_takes_the_pieces_back_out_of_stock(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(10);
        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 10), 10);
        $this->work('sewing-operator', $lot, 'sewing', 10);
        $this->receive('finishing-manager', $this->send('sewing-operator', $lot, 'sewing', 10), 10);
        $this->work('finishing-manager', $lot, 'finishing', 10);
        $this->receive('packaging-operator', $this->send('finishing-manager', $lot, 'finishing', 10), 10);
        $entry = $this->work('packaging-operator', $lot, 'packing', 10)->json('entry.id');

        $this->assertEquals([10.0, 10.0], $this->packedStock($lot));

        $this->as('packaging-operator')->postJson("/api/flow/entries/{$entry}/void", ['reason' => 'Packed the wrong lot'])->assertOk();

        $this->assertEquals([0.0, 0.0], $this->packedStock($lot));
        $this->assertSame(10, $this->stages($lot)['packing']['wip']);
    }

    public function test_fabric_that_was_damaged_is_taken_off_the_cutting_balance(): void
    {
        $this->approvedFabric(40);

        $this->as('cutting-operator')->postJson('/api/flow/fabric-loss', ['fabric_item_id' => $this->fabric->id, 'fabric_waste' => 6, 'notes' => 'Water damage on one roll'])->assertCreated();
        $this->as('cutting-operator')->postJson('/api/flow/fabric-loss', ['fabric_item_id' => $this->fabric->id, 'fabric_waste' => 50, 'notes' => 'Too much'])->assertUnprocessable();

        $this->assertEquals(34, $this->as('cutting-operator')->getJson('/api/flow/overview?stage=cutting')->json('materials.0.on_hand'));
    }

    public function test_the_monitor_shows_where_every_piece_is_and_the_report_adds_it_up(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(100);
        $this->receive('sewing-operator', $this->send('cutting-operator', $lot, 'cutting', 70), 70);
        $this->work('sewing-operator', $lot, 'sewing', 50, 5);

        $monitor = $this->as('quality-officer')->getJson('/api/flow/monitor')->assertOk()->json();
        $stages = collect($monitor['flow'])->keyBy('key');

        $this->assertSame(30, $stages['cutting']['here']);
        $this->assertSame(65, $stages['sewing']['here']);
        $this->assertSame(15, $stages['sewing']['in_work']);
        $this->assertSame(50, $stages['sewing']['ready_to_send']);
        $this->assertSame(5, $stages['sewing']['damaged']);
        $this->assertSame(100, $monitor['lots'][0]['cut']);
        $this->assertSame(95, $monitor['lots'][0]['in_progress']);

        $report = $this->as('production-manager')->getJson('/api/flow/report')->assertOk()->json();
        $byStage = collect($report['stages'])->keyBy('key');
        $this->assertSame(100, $byStage['cutting']['good']);
        $this->assertSame(50, $byStage['sewing']['good']);
        $this->assertEquals(32, $report['fabric'][0]['used'] + $report['fabric'][0]['waste']);
    }

    public function test_another_factory_cannot_see_or_touch_these_lots(): void
    {
        $this->approvedFabric();
        $lot = $this->cutLot(10);

        $other = $this->makeFactory('Other Works', 'other-works');
        $stranger = $this->makeUser($other, 'stranger@test.test', 'production-manager');

        $this->actingAs($stranger)->getJson("/api/flow/lots/{$lot}")->assertNotFound();
        $this->actingAs($stranger)->postJson("/api/flow/lots/{$lot}/send", ['from_stage' => 'cutting', 'quantity' => 1])->assertNotFound();
        $this->assertCount(0, $this->actingAs($stranger)->getJson('/api/flow/monitor')->json('lots'));
    }

    public function test_bad_input_is_rejected(): void
    {
        $this->as('cutting-operator')->postJson('/api/flow/cutting', [])->assertUnprocessable();
        $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'baking', 'item_id' => $this->fabric->id, 'quantity' => 1, 'reason' => 'x'])->assertUnprocessable();
        $this->as('cutting-operator')->postJson('/api/flow/requests', ['stage' => 'cutting', 'item_id' => $this->fabric->id, 'quantity' => 0, 'reason' => 'Polo shirts'])->assertUnprocessable();
        $this->as('cutting-operator')->getJson('/api/flow/overview?stage=baking')->assertUnprocessable();
    }
}
