<?php

namespace App\Http\Controllers\Production;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionTarget;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductionTargetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $factoryId = $user->current_factory_id;

        // Auto-seed initial default targets if factory has none yet
        if (ProductionTarget::where('factory_id', $factoryId)->count() === 0) {
            ProductionTarget::create([
                'factory_id' => $factoryId,
                'title' => 'Weekly Shirts Target',
                'product_name' => 'Shirts',
                'stage' => 'finished',
                'target_quantity' => 100,
                'start_date' => now()->startOfWeek(),
                'end_date' => now()->endOfWeek(),
                'period_type' => 'weekly',
                'status' => 'active',
                'notes' => 'Complete customer order for white cotton shirts.',
                'created_by' => $user->id,
            ]);

            ProductionTarget::create([
                'factory_id' => $factoryId,
                'title' => 'Waiters Uniforms Batch',
                'product_name' => 'Waiters Uniforms',
                'stage' => 'finished',
                'target_quantity' => 50,
                'start_date' => now()->startOfMonth(),
                'end_date' => now()->endOfMonth(),
                'period_type' => 'monthly',
                'status' => 'active',
                'notes' => 'Target hospitality batch uniforms.',
                'created_by' => $user->id,
            ]);

            ProductionTarget::create([
                'factory_id' => $factoryId,
                'title' => 'Cutting Line Output Target',
                'product_name' => null,
                'stage' => 'cutting',
                'target_quantity' => 150,
                'start_date' => now()->startOfWeek(),
                'end_date' => now()->endOfWeek(),
                'period_type' => 'weekly',
                'status' => 'active',
                'notes' => 'Feed all line stages with sufficient cut pieces.',
                'created_by' => $user->id,
            ]);
        }

        $targets = ProductionTarget::where('factory_id', $factoryId)
            ->orderBy('id', 'desc')
            ->get();

        // Fetch products for selector
        $products = Item::where('is_active', true)
            ->where(function ($q) {
                $q->where('type', 'finished_good')
                    ->orWhere('type', 'raw_material');
            })
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'color']);

        // Fetch lots in factory to measure actual output
        $lots = ProductionLot::where('factory_id', $factoryId)->get();

        $calculatedTargets = $targets->map(function ($target) use ($lots) {
            $stage = $target->stage;
            $productFilter = strtolower(trim($target->product_name ?? ''));

            $filteredLots = $lots->filter(function ($lot) use ($productFilter) {
                if (empty($productFilter) || $productFilter === 'all' || $productFilter === 'all products') {
                    return true;
                }
                $lotProduct = strtolower(trim($lot->product ?? ''));
                $lotNumber = strtolower(trim($lot->lot_number ?? ''));
                return str_contains($lotProduct, $productFilter) || str_contains($lotNumber, $productFilter);
            });

            $actualQty = 0;
            if ($stage === 'cutting') {
                $actualQty = (float) $filteredLots->sum(fn ($l) => $l->cut > 0 ? $l->cut : ($l->wip ?? 0));
            } elseif ($stage === 'sewing') {
                $actualQty = (float) $filteredLots->sum(fn ($l) => ($l->good ?? 0) + ($l->outbox ?? 0));
            } elseif ($stage === 'finishing') {
                $actualQty = (float) $filteredLots->sum(fn ($l) => ($l->good ?? 0) + ($l->outbox ?? 0));
            } else {
                // finished / packing / overall
                $actualQty = (float) $filteredLots->sum(fn ($l) => ($l->ready_for_stock ?? 0) + ($l->good ?? 0));
                if ($actualQty === 0.0) {
                    $actualQty = (float) $filteredLots->sum(fn ($l) => max($l->cut, $l->good, $l->outbox));
                }
            }

            $targetQty = max(1.0, (float) $target->target_quantity);
            $remaining = max(0.0, $targetQty - $actualQty);
            $progressPercent = min(100.0, round(($actualQty / $targetQty) * 100, 1));
            $isCompleted = $actualQty >= $targetQty;

            $now = Carbon::today();
            $endDate = $target->end_date ? Carbon::parse($target->end_date) : null;
            $daysLeft = $endDate ? max(0, $now->diffInDays($endDate, false)) : null;
            $dailyPaceNeeded = ($daysLeft !== null && $daysLeft > 0 && $remaining > 0)
                ? round($remaining / $daysLeft, 1)
                : $remaining;

            return [
                'id' => $target->id,
                'title' => $target->title,
                'product_name' => $target->product_name ?: 'All Products',
                'stage' => $target->stage,
                'target_quantity' => (float) $target->target_quantity,
                'actual_quantity' => $actualQty,
                'remaining_quantity' => $remaining,
                'progress_percent' => $progressPercent,
                'is_completed' => $isCompleted,
                'start_date' => $target->start_date?->format('Y-m-d'),
                'end_date' => $target->end_date?->format('Y-m-d'),
                'days_left' => $daysLeft,
                'daily_pace_needed' => $dailyPaceNeeded,
                'period_type' => $target->period_type,
                'status' => $isCompleted ? 'completed' : ($target->status ?? 'active'),
                'notes' => $target->notes,
                'created_at' => $target->created_at?->format('Y-m-d H:i'),
            ];
        });

        $totalTargetUnits = $calculatedTargets->sum('target_quantity');
        $totalActualUnits = $calculatedTargets->sum('actual_quantity');
        $totalRemaining = max(0, $totalTargetUnits - $totalActualUnits);
        $overallProgress = $totalTargetUnits > 0
            ? min(100.0, round(($totalActualUnits / $totalTargetUnits) * 100, 1))
            : 0.0;

        return response()->json([
            'summary' => [
                'total_target_units' => $totalTargetUnits,
                'total_actual_units' => $totalActualUnits,
                'total_remaining_units' => $totalRemaining,
                'overall_progress_percent' => $overallProgress,
                'active_targets_count' => $calculatedTargets->where('is_completed', false)->count(),
                'completed_targets_count' => $calculatedTargets->where('is_completed', true)->count(),
                'total_targets_count' => $calculatedTargets->count(),
            ],
            'targets' => $calculatedTargets->values(),
            'products' => $products,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'stage' => ['required', 'string', 'in:cutting,sewing,finishing,packing,finished'],
            'target_quantity' => ['required', 'numeric', 'min:1'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'period_type' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $target = ProductionTarget::create([
            'factory_id' => $request->user()->current_factory_id,
            'title' => $validated['title'],
            'product_name' => $validated['product_name'] ?? null,
            'stage' => $validated['stage'],
            'target_quantity' => $validated['target_quantity'],
            'start_date' => $validated['start_date'] ?? now()->toDateString(),
            'end_date' => $validated['end_date'] ?? now()->addDays(7)->toDateString(),
            'period_type' => $validated['period_type'] ?? 'weekly',
            'status' => 'active',
            'notes' => $validated['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Production target created successfully.',
            'target' => $target,
        ], 201);
    }

    public function update(Request $request, ProductionTarget $target): JsonResponse
    {
        abort_unless($target->factory_id === $request->user()->current_factory_id, 403);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'stage' => ['sometimes', 'required', 'string', 'in:cutting,sewing,finishing,packing,finished'],
            'target_quantity' => ['sometimes', 'required', 'numeric', 'min:1'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'period_type' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'in:active,completed,paused'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $target->update($validated);

        return response()->json([
            'message' => 'Production target updated successfully.',
            'target' => $target,
        ]);
    }

    public function destroy(Request $request, ProductionTarget $target): JsonResponse
    {
        abort_unless($target->factory_id === $request->user()->current_factory_id, 403);

        $target->delete();

        return response()->json([
            'message' => 'Production target deleted successfully.',
        ]);
    }
}
