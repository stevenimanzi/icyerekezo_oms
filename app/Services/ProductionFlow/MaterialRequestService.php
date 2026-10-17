<?php

namespace App\Services\ProductionFlow;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\MaterialRequest;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionTransfer;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockIssuer;
use App\Support\Catalogs\ProductionFlowCatalog;
use App\Support\Notifications\FactoryNotifier;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MaterialRequestService
{
    public const REQUESTABLE_TYPES = ['raw_material', 'packaging', 'spare_part', 'semi_finished', 'by_product'];

    public function __construct(private readonly StockIssuer $issuer) {}

    public function request(User $user, array $data): MaterialRequest
    {
        $stage = $data['stage'];

        if (($data['source'] ?? 'warehouse') === 'stage') {
            return $this->requestPieces($user, $data);
        }

        abort_unless(
            ProductionFlowCatalog::exists($stage) && FlowAccess::for($user)->canWork($stage),
            403,
            'You cannot ask for materials for this stage.',
        );

        $item = Item::where('is_active', true)->whereIn('type', self::REQUESTABLE_TYPES)->findOrFail($data['item_id']);

        $request = MaterialRequest::create([
            'request_number' => $this->nextNumber(),
            'stage' => $stage,
            'item_id' => $item->id,
            'quantity' => $data['quantity'],
            'reason' => $data['reason'],
            'status' => 'pending',
            'requested_by' => $user->id,
        ]);

        AuditLog::record('production.material_requested', "Requested {$data['quantity']} of {$item->name} for {$stage}", $request);

        FactoryNotifier::notifyRoles(
            $user->current_factory_id,
            ProductionFlowCatalog::WAREHOUSE_ROLES,
            'New material request',
            "{$user->name} asked for {$data['quantity']} {$item->name} for " . strtolower(ProductionFlowCatalog::STAGES[$stage]['label']['en']) . '.',
            '/warehouse/incoming-requests',
            'inventory',
            $user->id,
        );

        return $request->load('item.unit');
    }

    /** A stage asks the stage before it for finished pieces. The answer is the delivery that stage sends. */
    private function requestPieces(User $user, array $data): MaterialRequest
    {
        $stage = $data['stage'];
        $from = ProductionFlowCatalog::previous($stage);
        abort_unless($from !== null && FlowAccess::for($user)->canWork($stage), 403, 'You cannot ask another stage for pieces.');

        $lot = ProductionLot::findOrFail($data['lot_id'] ?? 0);
        $quantity = (int) $data['quantity'];
        $before = app(FlowBalances::class)->forLot($lot->id)['stages'][$from];
        $ready = $before['outbox'] + $before['wip'];

        if ($quantity > $ready) {
            throw ValidationException::withMessages(['quantity' => "Only {$ready} pieces of {$lot->lot_number} are at {$from}."]);
        }

        $request = MaterialRequest::create([
            'request_number' => $this->nextNumber(),
            'stage' => $stage,
            'from_stage' => $from,
            'lot_id' => $lot?->id,
            'quantity' => $quantity,
            'reason' => $data['reason'],
            'status' => 'pending',
            'requested_by' => $user->id,
        ]);

        $label = ProductionFlowCatalog::STAGES[$stage]['label']['en'];
        AuditLog::record('production.pieces_requested', "{$label} asked for {$quantity} pieces from {$from}", $request);

        FactoryNotifier::notifyRoles(
            $user->current_factory_id,
            [...ProductionFlowCatalog::STAGES[$from]['roles'], ...ProductionFlowCatalog::MANAGER_ROLES],
            'Pieces requested',
            "{$label} asked for {$quantity} pieces" . ($lot ? " of {$lot->lot_number}" : '') . ": {$data['reason']}",
            '/production/' . $from . '-workspace',
            'production',
            $user->id,
        );

        return $request->load('lot');
    }

    /** The stage that was asked says it cannot send the pieces. */
    public function decline(MaterialRequest $request, User $user, string $note): MaterialRequest
    {
        abort_unless($request->isForPieces(), 422, 'Only the warehouse can decline a material request.');
        abort_unless(FlowAccess::for($user)->canWork($request->from_stage), 403, 'Only the team that was asked can answer this request.');
        abort_unless($request->status === 'pending', 422, 'This request has already been dealt with.');

        $request->update(['status' => 'rejected', 'decided_by' => $user->id, 'decided_at' => now(), 'decision_note' => $note]);
        AuditLog::record('production.pieces_declined', "Declined {$request->request_number}: {$note}", $request);
        $this->tellRequester($request, "Your request {$request->request_number} was declined", $note);

        return $request;
    }

    /** Counts a delivery towards the oldest waiting requests of the receiving stage, and closes the ones it covers. */
    public function countDelivery(ProductionTransfer $transfer, User $sender): void
    {
        $remaining = (int) $transfer->quantity_sent;

        MaterialRequest::where('status', 'pending')
            ->where('stage', $transfer->to_stage)
            ->where('from_stage', $transfer->from_stage)
            ->where(fn ($query) => $query->whereNull('lot_id')->orWhere('lot_id', $transfer->lot_id))
            ->oldest('id')
            ->lockForUpdate()
            ->get()
            ->each(function (MaterialRequest $request) use (&$remaining, $sender) {
                if ($remaining < 1) {
                    return false;
                }

                $take = min($remaining, (int) $request->quantity - (int) $request->fulfilled_quantity);
                $remaining -= $take;
                $total = (int) $request->fulfilled_quantity + $take;
                $done = $total >= (int) $request->quantity;

                $request->update($done
                    ? ['fulfilled_quantity' => $total, 'status' => 'approved', 'decided_by' => $sender->id, 'decided_at' => now(), 'decision_note' => "{$total} pieces sent"]
                    : ['fulfilled_quantity' => $total]);

                $this->tellRequester(
                    $request,
                    $done ? "Your request {$request->request_number} was fulfilled" : "Part of {$request->request_number} is on its way",
                    "{$total} of {$request->quantity} pieces were sent to you.",
                );
            });
    }

    public function approve(MaterialRequest $request, User $user, ?int $warehouseId, ?string $note): MaterialRequest
    {
        $this->ensureCanDecide($request, $user);

        return DB::transaction(function () use ($request, $user, $warehouseId, $note) {
            $request = MaterialRequest::lockForUpdate()->findOrFail($request->id);
            abort_unless($request->status === 'pending', 422, 'This request has already been dealt with.');

            $item = $request->item;
            $label = ProductionFlowCatalog::STAGES[$request->stage]['label']['en'];

            $posted = $this->issuer->issue(
                $item,
                (float) $request->quantity,
                $warehouseId ? Warehouse::findOrFail($warehouseId) : null,
                'issue',
                "Issued to {$label}: {$request->request_number}",
                $request,
                'quantity',
            );

            $request->update([
                'status' => 'approved',
                'warehouse_id' => $posted[0]->warehouse_id ?? $warehouseId,
                'decided_by' => $user->id,
                'decided_at' => now(),
                'decision_note' => $note,
            ]);

            AuditLog::record('production.material_approved', "Approved {$request->request_number}", $request);
            $this->tellRequester($request, "Your request {$request->request_number} was approved", "{$request->quantity} {$item->name} was issued to {$label}.");

            return $request->load(['item.unit', 'warehouse']);
        });
    }

    public function reject(MaterialRequest $request, User $user, string $note): MaterialRequest
    {
        $this->ensureCanDecide($request, $user);
        abort_unless($request->status === 'pending', 422, 'This request has already been dealt with.');

        $request->update(['status' => 'rejected', 'decided_by' => $user->id, 'decided_at' => now(), 'decision_note' => $note]);
        AuditLog::record('production.material_rejected', "Rejected {$request->request_number}: {$note}", $request);
        $this->tellRequester($request, "Your request {$request->request_number} was declined", $note);

        return $request->load('item.unit');
    }

    public function cancel(MaterialRequest $request, User $user): MaterialRequest
    {
        abort_unless($request->status === 'pending', 422, 'Only a waiting request can be cancelled.');
        abort_unless(
            (int) $request->requested_by === (int) $user->id || FlowAccess::for($user)->isManager(),
            403,
            'Only the person who asked can cancel this request.',
        );

        $request->update(['status' => 'cancelled']);
        AuditLog::record('production.material_cancelled', "Cancelled {$request->request_number}", $request);

        return $request->load('item.unit');
    }

    public function onHand(string $stage): Collection
    {
        $issued = MaterialRequest::where('stage', $stage)
            ->where('status', 'approved')
            ->selectRaw('item_id, SUM(quantity) as issued')
            ->groupBy('item_id')
            ->pluck('issued', 'item_id');

        $used = $stage === 'cutting'
            ? ProductionEntry::where('stage', 'cutting')
                ->whereNull('voided_at')
                ->whereNotNull('fabric_item_id')
                ->selectRaw('fabric_item_id, SUM(fabric_used + fabric_waste) as used')
                ->groupBy('fabric_item_id')
                ->pluck('used', 'fabric_item_id')
            : collect();

        $items = Item::with('unit:id,symbol')->whereIn('id', $issued->keys())->get()->keyBy('id');

        return $issued->map(fn ($quantity, $itemId) => [
            'item_id' => (int) $itemId,
            'name' => $items[$itemId]->name ?? 'Item',
            'color' => $items[$itemId]->color ?? null,
            'unit' => $items[$itemId]->unit->symbol ?? null,
            'issued' => (float) $quantity,
            'used' => (float) ($used[$itemId] ?? 0),
            'on_hand' => round((float) $quantity - (float) ($used[$itemId] ?? 0), 3),
        ])->values();
    }

    public function fabricAvailable(int $itemId): float
    {
        return (float) ($this->onHand('cutting')->firstWhere('item_id', $itemId)['on_hand'] ?? 0);
    }

    private function ensureCanDecide(MaterialRequest $request, User $user): void
    {
        abort_if($request->isForPieces(), 422, 'This request is answered by the team it was sent to, not by the warehouse.');
        abort_unless(FlowAccess::for($user)->canApproveRequests(), 403, 'Only the warehouse can approve or decline material requests.');

        if ((int) $request->requested_by === (int) $user->id) {
            throw ValidationException::withMessages(['request' => 'You cannot approve your own request. Ask another warehouse person.']);
        }
    }

    private function tellRequester(MaterialRequest $request, string $title, string $body): void
    {
        if ($request->requested_by) {
            FactoryNotifier::notifyUser($request->requested_by, $title, $body, '/production/' . $request->stage . '-workspace', 'inventory');
        }
    }

    private function nextNumber(): string
    {
        $prefix = 'REQ-' . now()->format('Y') . '-';
        $next = MaterialRequest::where('request_number', 'like', $prefix . '%')->count() + 1;

        do {
            $number = $prefix . str_pad((string) $next++, 4, '0', STR_PAD_LEFT);
        } while (MaterialRequest::withoutGlobalScopes()->where('factory_id', auth()->user()->current_factory_id)->where('request_number', $number)->exists());

        return $number;
    }
}
