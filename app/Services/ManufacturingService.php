<?php

namespace App\Services;

use App\Models\BillOfMaterial;
use App\Models\ProductionOrder;
use App\Models\ProductionStageExecution;
use App\Models\StockBalance;
use App\Models\WorkflowStage;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManufacturingService
{
    public function requirements(BillOfMaterial $bom, float $quantity): Collection
    {
        $factor = $quantity / (float) $bom->output_quantity;

        return $bom->components()->with('item:id,name,sku,unit_id')->get()->map(function ($component) use ($factor) {
            $required = (float) $component->quantity * $factor * (1 + ((float) $component->waste_percent / 100));
            $available = (float) StockBalance::where('item_id', $component->item_id)->selectRaw('COALESCE(SUM(quantity_on_hand - quantity_reserved - quantity_quarantined), 0) total')->value('total');

            return ['item_id' => $component->item_id, 'item' => $component->item, 'required_quantity' => round($required, 6), 'available_quantity' => $available, 'shortage_quantity' => max(0, round($required - $available, 6)), 'is_optional' => $component->is_optional];
        });
    }

    public function approve(ProductionOrder $order): ProductionOrder
    {
        return DB::transaction(function () use ($order) {
            abort_unless($order->status === 'draft', 422, 'Only draft production orders can be approved.');
            $shortages = $this->requirements($order->billOfMaterial, (float) $order->planned_quantity)->where('is_optional', false)->where('shortage_quantity', '>', 0);
            if ($shortages->isNotEmpty()) {
                throw ValidationException::withMessages(['materials' => 'Required materials are not available.', 'shortages' => $shortages->values()->all()]);
            }
            $stages = WorkflowStage::where('workflow_template_id', $order->workflow_template_id)->orderBy('sequence')->get();
            if ($stages->isEmpty()) {
                throw ValidationException::withMessages(['workflow_template_id' => 'The workflow must contain at least one stage.']);
            }
            foreach ($stages as $index => $stage) {
                ProductionStageExecution::create(['production_order_id' => $order->id, 'workflow_stage_id' => $stage->id, 'status' => $index === 0 ? 'ready' : 'not_started']);
            }
            $order->update(['status' => 'approved', 'approved_by' => auth()->id()]);

            return $order->load('executions.stage');
        });
    }

    public function updateStage(ProductionStageExecution $execution, array $data): ProductionStageExecution
    {
        return DB::transaction(function () use ($execution, $data) {
            $execution->load('stage');
            $order = ProductionOrder::lockForUpdate()->findOrFail($execution->production_order_id);
            $previous = $order->executions()->whereHas('stage', fn ($q) => $q->where('sequence', '<', $execution->stage->sequence))->where('status', '!=', 'completed')->exists();
            if ($data['status'] === 'in_progress' && $previous) {
                throw ValidationException::withMessages(['status' => 'Previous production stages must be completed first.']);
            }
            $updates = $data;
            if ($data['status'] === 'in_progress') {
                $updates['started_at'] = $execution->started_at ?? now();
                $order->update(['status' => 'in_progress', 'started_at' => $order->started_at ?? now()]);
            }
            if ($data['status'] === 'completed') {
                abort_unless(in_array($execution->status, ['ready', 'in_progress'], true), 422, 'This stage is not ready for completion.');
                $updates['completed_at'] = now();
                $next = $order->executions()->whereHas('stage', fn ($q) => $q->where('sequence', '>', $execution->stage->sequence))->with('stage')->get()->sortBy('stage.sequence')->first();
                $next?->update(['status' => 'ready']);
                if (! $next) {
                    $order->update(['status' => 'completed', 'completed_quantity' => $data['output_quantity'] ?? 0, 'completed_at' => now()]);
                }
            }
            $execution->update($updates);

            return $execution->fresh('stage');
        });
    }
}
