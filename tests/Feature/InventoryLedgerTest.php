<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Factory;
use App\Models\Item;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InventoryLedgerTest extends TestCase
{
    use RefreshDatabase;

    private Factory $factory;
    private Warehouse $warehouse;
    private Item $item;
    private InventoryLedger $ledger;

    protected function setUp(): void
    {
        parent::setUp();

        [$this->factory, $user] = $this->tenant('Alpha');
        $this->actingAs($user);
        $this->warehouse = $this->warehouseFor($this->factory);
        $this->item = $this->itemFor($this->factory);
        $this->ledger = new InventoryLedger();
    }

    private function tenant(string $name): array
    {
        $factory = Factory::create(['uuid' => (string) Str::uuid(), 'name' => $name, 'slug' => Str::slug($name).Str::random(4), 'industry_type' => 'steel_metals', 'status' => 'active']);
        $user = User::factory()->create(['current_factory_id' => $factory->id]);
        $factory->users()->attach($user->id, ['is_owner' => true, 'is_active' => true, 'joined_at' => now()]);

        return [$factory, $user];
    }

    private function warehouseFor(Factory $factory, bool $negative = false): Warehouse
    {
        return Warehouse::withoutGlobalScopes()->create(['factory_id' => $factory->id, 'name' => 'Main', 'code' => 'M'.Str::random(3), 'type' => 'general', 'allows_negative_stock' => $negative]);
    }

    private function itemFor(Factory $factory, array $overrides = []): Item
    {
        $unit = Unit::withoutGlobalScopes()->firstOrCreate(['factory_id' => $factory->id, 'symbol' => 'kg'], ['name' => 'Kilogram', 'dimension' => 'mass', 'precision' => 3]);

        return Item::withoutGlobalScopes()->create(array_merge(['factory_id' => $factory->id, 'unit_id' => $unit->id, 'type' => 'raw_material', 'name' => 'Steel '.Str::random(4), 'sku' => 'SKU'.Str::random(5)], $overrides));
    }

    private function move(string $type, float $quantity, array $extra = []): StockTransaction
    {
        return $this->ledger->post(array_merge(['item_id' => $this->item->id, 'warehouse_id' => $this->warehouse->id, 'type' => $type, 'quantity' => $quantity], $extra));
    }

    private function onHand(?Item $item = null): float
    {
        return (float) StockBalance::withoutGlobalScopes()->where('item_id', ($item ?? $this->item)->id)->sum('quantity_on_hand');
    }

    public function test_receipts_and_issues_move_the_balance_and_record_a_running_total(): void
    {
        $this->move('receipt', 10);
        $issue = $this->move('issue', 4);

        $this->assertSame(6.0, $this->onHand());
        $this->assertSame(6.0, (float) $issue->balance_after);
        $this->assertSame(-4.0, (float) $issue->quantity_delta);
    }

    public function test_issuing_more_than_is_on_hand_is_refused_and_changes_nothing(): void
    {
        $this->move('receipt', 5);

        try {
            $this->move('issue', 6);
            $this->fail('Issuing more than the balance should be refused.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('quantity', $e->errors());
        }

        $this->assertSame(5.0, $this->onHand());
        $this->assertSame(1, StockTransaction::withoutGlobalScopes()->where('item_id', $this->item->id)->count());
    }

    public function test_reserved_stock_cannot_be_issued_but_the_rest_can(): void
    {
        $this->move('receipt', 10);
        $this->move('reserve', 4);

        $this->assertThrows(fn () => $this->move('issue', 7), ValidationException::class);

        $this->move('issue', 6);
        $this->assertSame(4.0, $this->onHand());
    }

    public function test_a_warehouse_that_allows_negative_stock_can_go_below_zero(): void
    {
        $this->warehouse->update(['allows_negative_stock' => true]);

        $this->move('issue', 3);

        $this->assertSame(-3.0, $this->onHand());
    }

    public function test_correcting_a_movement_nets_to_the_corrected_quantity_and_links_the_reversal(): void
    {
        $original = $this->move('receipt', 10);

        $corrected = $this->ledger->correct($original, 8);

        $this->assertSame(8.0, $this->onHand());
        $this->assertSame('receipt', $corrected->type);
        $reversal = StockTransaction::withoutGlobalScopes()->where('reverses_transaction_id', $original->id)->first();
        $this->assertNotNull($reversal, 'The reversal must reference the transaction it cancels.');
        $this->assertSame('adjustment_out', $reversal->type);
        $this->assertSame(3, StockTransaction::withoutGlobalScopes()->where('item_id', $this->item->id)->count(), 'Nothing is deleted or edited: original, reversal and corrected movement all remain.');
    }

    public function test_expired_stock_cannot_be_issued(): void
    {
        $this->item->update(['batch_tracked' => true, 'expiry_tracked' => true]);
        $batch = Batch::withoutGlobalScopes()->create(['factory_id' => $this->factory->id, 'item_id' => $this->item->id, 'batch_number' => 'L1', 'expires_at' => now()->subDay(), 'status' => 'available']);
        $this->move('receipt', 10, ['batch_id' => $batch->id]);

        try {
            $this->move('issue', 1, ['batch_id' => $batch->id]);
            $this->fail('Expired stock must not be issued.');
        } catch (ValidationException $e) {
            $this->assertStringContainsString('Expired', $e->errors()['batch_id'][0]);
        }
    }

    public function test_a_batch_tracked_item_cannot_move_without_a_batch(): void
    {
        $this->item->update(['batch_tracked' => true]);

        $this->assertThrows(fn () => $this->move('receipt', 5), ValidationException::class);
    }

    public function test_one_factory_cannot_move_another_factorys_stock(): void
    {
        [$otherFactory] = $this->tenant('Beta');
        $foreignItem = $this->itemFor($otherFactory);

        $this->assertThrows(
            fn () => $this->ledger->post(['item_id' => $foreignItem->id, 'warehouse_id' => $this->warehouse->id, 'type' => 'receipt', 'quantity' => 5]),
            \Illuminate\Database\Eloquent\ModelNotFoundException::class,
        );
        $this->assertSame(0.0, $this->onHand($foreignItem));
    }
}
