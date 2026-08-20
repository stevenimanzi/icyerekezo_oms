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
            
            $previousExecution = $order->executions()
                ->whereHas('stage', fn ($q) => $q->where('sequence', '<', $execution->stage->sequence))
                ->with('stage')
                ->get()
                ->sortByDesc('stage.sequence')
                ->first();
                
            if ($data['status'] === 'in_progress' && $previousExecution && $previousExecution->status !== 'completed') {
                throw ValidationException::withMessages(['status' => 'Previous production stages must be completed first.']);
            }
            
            if (isset($data['input_quantity']) && $previousExecution) {
                if ($data['input_quantity'] > $previousExecution->output_quantity) {
                    throw ValidationException::withMessages(['input_quantity' => 'Cannot input more than what the previous stage ('.$previousExecution->stage->name.') outputted ('.$previousExecution->output_quantity.').']);
                }
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
                    
                    if (($data['output_quantity'] ?? 0) > 0) {
                        $order->load('item');
                        $batchId = null;
                        if ($order->item->batch_tracked) {
                            $batch = \App\Models\Batch::firstOrCreate([
                                'factory_id' => $order->factory_id,
                                'item_id' => $order->item_id,
                                'batch_number' => $order->order_number . '-BATCH',
                            ], [
                                'manufactured_date' => now()->toDateString(),
                            ]);
                            $batchId = $batch->id;
                        }
                        
                        $ledger = new \App\Services\InventoryLedger();
                        $ledger->post([
                            'item_id' => $order->item_id,
                            'warehouse_id' => $order->warehouse_id,
                            'type' => 'receipt',
                            'quantity' => $data['output_quantity'],
                            'reason' => 'Production completed for ' . $order->order_number,
                            'batch_id' => $batchId
                        ]);
                    }
                }
            }
            $execution->update($updates);

            return $execution->fresh('stage');
        });
    }
}
