<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\SalesDocument;
use App\Models\SalesPayment;
use App\Models\StockTransaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManualSaleService
{
    public function __construct(private readonly InventoryLedger $ledger, private readonly StockIssuer $issuer) {}

    public function record(array $data, User $user): SalesDocument
    {
        return DB::transaction(function () use ($data, $user) {
            $factory = $user->currentFactory;
            $lines = $this->priceLines($data['lines']);
            $subtotal = round($lines->sum('line_total'), 2);
            $discount = round((float) ($data['discount_amount'] ?? 0), 2);
            $paid = round((float) ($data['paid_amount'] ?? 0), 2);

            if ($discount > $subtotal) {
                throw ValidationException::withMessages(['discount_amount' => 'The discount cannot be more than the sale total.']);
            }

            $total = round($subtotal - $discount, 2);

            if ($paid > $total) {
                throw ValidationException::withMessages(['paid_amount' => 'The customer cannot pay more than the sale total.']);
            }

            $document = SalesDocument::create([
                'document_type' => 'customer_order',
                'source' => 'manual',
                'document_number' => $this->nextNumber(),
                'customer_name' => $data['customer_name'],
                'customer_phone' => $data['customer_phone'] ?? null,
                'status' => 'delivered',
                'currency_code' => $factory?->currency_code ?: 'RWF',
                'total_amount' => $total,
                'discount_amount' => $discount,
                'paid_amount' => 0,
                'payment_status' => 'unpaid',
                'item_count' => (int) $lines->sum('quantity'),
                'document_date' => $data['sale_date'],
                'due_date' => $paid < $total ? ($data['due_date'] ?? null) : null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            foreach ($lines as $index => $line) {
                $document->lines()->create([
                    'item_id' => $line['item']->id,
                    'quantity_ordered' => $line['quantity'],
                    'quantity_packed' => $line['quantity'],
                    'quantity_delivered' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'line_total' => $line['line_total'],
                ]);

                if (($data['deduct_stock'] ?? true) && $line['item']->type !== 'service') {
                    $this->takeOutOfStock($document, $line['item'], $line['quantity'], $data['warehouse_id'] ?? null, $index);
                }
            }

            if ($paid > 0) {
                $this->addPayment($document, $paid, $data['payment_method'], $data['payment_reference'] ?? null, $data['sale_date'], $user);
            }

            AuditLog::record('sales.sale_recorded', "Recorded sale {$document->document_number} for {$document->customer_name}", $document);

            return $document->load(['lines.item', 'payments']);
        });
    }

    public function addPayment(
        SalesDocument $document,
        float $amount,
        string $method,
        ?string $reference,
        string $paidOn,
        User $user,
    ): SalesPayment {
        $payment = SalesPayment::create([
            'sales_document_id' => $document->id,
            'amount' => round($amount, 2),
            'method' => $method,
            'reference' => $reference,
            'paid_on' => $paidOn,
            'recorded_by' => $user->id,
        ]);

        $this->syncPaid($document);
        AuditLog::record('sales.payment_recorded', "Received {$amount} for sale {$document->document_number}", $document);

        return $payment;
    }

    public function cancel(SalesDocument $document, string $reason, User $user): SalesDocument
    {
        abort_if($document->status === 'cancelled', 422, 'This sale is already cancelled.');

        return DB::transaction(function () use ($document, $reason, $user) {
            $this->returnStock($document);

            $paid = (float) $document->paid_amount;
            if ($paid > 0) {
                SalesPayment::create([
                    'sales_document_id' => $document->id,
                    'amount' => -$paid,
                    'method' => $document->payments()->latest('id')->value('method') ?? 'cash',
                    'reference' => 'Refund: sale cancelled',
                    'paid_on' => now()->toDateString(),
                    'recorded_by' => $user->id,
                ]);
            }

            $document->update(['status' => 'cancelled', 'cancel_reason' => $reason, 'paid_amount' => 0, 'payment_status' => 'unpaid']);
            AuditLog::record('sales.sale_cancelled', "Cancelled sale {$document->document_number}: {$reason}", $document);

            return $document->fresh(['lines.item', 'payments']);
        });
    }

    private function priceLines(array $lines)
    {
        $items = Item::whereIn('id', collect($lines)->pluck('item_id'))->get()->keyBy('id');

        return collect($lines)->map(function (array $line) use ($items) {
            $quantity = (int) $line['quantity'];
            $price = round((float) $line['unit_price'], 2);

            return [
                'item' => $items[$line['item_id']],
                'quantity' => $quantity,
                'unit_price' => $price,
                'line_total' => round($quantity * $price, 2),
            ];
        })->values();
    }

    private function takeOutOfStock(SalesDocument $document, Item $item, int $quantity, ?int $warehouseId, int $lineIndex): void
    {
        $this->issuer->issue(
            $item,
            $quantity,
            $warehouseId ? Warehouse::findOrFail($warehouseId) : null,
            'dispatch',
            "Sale {$document->document_number}",
            $document,
            "lines.{$lineIndex}.quantity",
        );
    }

    private function returnStock(SalesDocument $document): void
    {
        $alreadyReversed = StockTransaction::whereNotNull('reverses_transaction_id')->pluck('reverses_transaction_id');

        StockTransaction::where('reference_type', $document->getMorphClass())
            ->where('reference_id', $document->id)
            ->where('type', 'dispatch')
            ->whereNotIn('id', $alreadyReversed)
            ->get()
            ->each(fn (StockTransaction $out) => $this->ledger->post([
                'item_id' => $out->item_id,
                'warehouse_id' => $out->warehouse_id,
                'location_id' => $out->location_id,
                'batch_id' => $out->batch_id,
                'type' => 'return_in',
                'quantity' => abs((float) $out->quantity_delta),
                'unit_cost' => $out->unit_cost,
                'reason' => "Sale {$document->document_number} cancelled",
                'reverses_transaction_id' => $out->id,
                'reference_type' => $document->getMorphClass(),
                'reference_id' => $document->id,
            ]));
    }

    private function syncPaid(SalesDocument $document): void
    {
        $paid = round((float) $document->payments()->sum('amount'), 2);
        $total = (float) $document->total_amount;

        $document->update([
            'paid_amount' => $paid,
            'payment_status' => $paid >= $total ? 'paid' : ($paid > 0 ? 'partially_paid' : 'unpaid'),
        ]);
    }

    private function nextNumber(): string
    {
        $prefix = 'SL-' . now()->format('Y') . '-';
        $next = SalesDocument::where('source', 'manual')->where('document_number', 'like', $prefix . '%')->count() + 1;

        do {
            $number = $prefix . str_pad((string) $next++, 4, '0', STR_PAD_LEFT);
        } while (SalesDocument::where('document_number', $number)->exists());

        return $number;
    }
}
