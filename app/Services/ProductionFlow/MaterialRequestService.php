<?php

namespace App\Services\ProductionFlow;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\MaterialRequest;
use App\Models\ProductionEntry;
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
            "{$user->name} asked for {$data['quantity']} {$item->name} for ".strtolower(ProductionFlowCatalog::STAGES[$stage]['label']['en']).'.',
            '/warehouse/incoming-requests',
            'inventory',
            $user->id,
        );

        return $request->load('item.unit');
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

    /**
     * Fabric (or any material) handed to a stage minus what that stage has used up.
     *
     * @return Collection<int, array{item_id: int, name: string, unit: ?string, issued: float, used: float, on_hand: float}>
     */
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
        abort_unless(FlowAccess::for($user)->canApproveRequests(), 403, 'Only the warehouse can approve or decline material requests.');

        if ((int) $request->requested_by === (int) $user->id) {
            throw ValidationException::withMessages(['request' => 'You cannot approve your own request. Ask another warehouse person.']);
        }
    }

    private function tellRequester(MaterialRequest $request, string $title, string $body): void
    {
        if ($request->requested_by) {
            FactoryNotifier::notifyUser($request->requested_by, $title, $body, '/production/'.$request->stage.'-workspace', 'inventory');
        }
    }

    private function nextNumber(): string
    {
        $prefix = 'REQ-'.now()->format('Y').'-';
        $next = MaterialRequest::where('request_number', 'like', $prefix.'%')->count() + 1;

        do {
            $number = $prefix.str_pad((string) $next++, 4, '0', STR_PAD_LEFT);
        } while (MaterialRequest::withoutGlobalScopes()->where('factory_id', auth()->user()->current_factory_id)->where('request_number', $number)->exists());

        return $number;
    }
}
