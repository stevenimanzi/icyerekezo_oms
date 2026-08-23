<?php

namespace App\Http\Controllers;

use App\Models\CorrectiveAction;
use App\Models\PpeAssignment;
use App\Models\SafetyIncident;
use App\Models\SafetyInspection;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SafetyController extends Controller
{
    private function employees(int $factoryId)
    {
        return User::where('is_platform_admin', false)->whereNull('school_id')
            ->whereHas('factories', fn ($q) => $q->where('factories.id', $factoryId)->where('factory_user.is_active', true))
            ->orderBy('name')->get(['id', 'name', 'email']);
    }

    public function overview(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;

        $incidentTrend = collect(range(6, 0))->map(function (int $daysAgo) {
            $day = today()->subDays($daysAgo);

            return [
                'date' => $day->format('M j'),
                'incidents' => SafetyIncident::whereDate('incident_date', $day)->count(),
                'resolved' => SafetyIncident::whereDate('resolved_at', $day)->count(),
            ];
        })->values();

        return response()->json([
            'employees' => $this->employees($factoryId),
            'incidents' => SafetyIncident::with(['reporter:id,name', 'resolver:id,name'])->latest('incident_date')->limit(100)->get(),
            'incident_trend' => $incidentTrend,
            'inspections' => SafetyInspection::with('inspector:id,name')->latest('inspection_date')->limit(100)->get(),
            'ppe_assignments' => PpeAssignment::with(['user:id,name', 'issuer:id,name'])->latest('issued_at')->limit(100)->get(),
            'corrective_actions' => CorrectiveAction::with(['assignee:id,name', 'creator:id,name'])->latest()->limit(100)->get(),
            'stats' => [
                'open_incidents' => SafetyIncident::whereIn('status', ['reported', 'investigating'])->count(),
                'incidents_this_month' => SafetyIncident::whereMonth('incident_date', now()->month)->whereYear('incident_date', now()->year)->count(),
                'failed_inspections' => SafetyInspection::where('result', 'fail')->whereMonth('inspection_date', now()->month)->count(),
                'open_actions' => CorrectiveAction::whereIn('status', ['open', 'in_progress'])->count(),
            ],
        ]);
    }

    public function storeIncident(Request $request): JsonResponse
    {
        $data = $request->validate([
            'incident_date' => ['required', 'date', 'before_or_equal:today'],
            'location' => ['nullable', 'string', 'max:160'],
            'description' => ['required', 'string', 'max:3000'],
            'severity' => ['required', Rule::in(['minor', 'moderate', 'severe', 'critical'])],
            'injured_person' => ['nullable', 'string', 'max:160'],
        ]);
        $incident = SafetyIncident::create([...$data, 'status' => 'reported', 'reported_by' => $request->user()->id]);

        return response()->json($incident->load('reporter:id,name'), 201);
    }

    public function updateIncident(Request $request, SafetyIncident $incident): JsonResponse
    {
        abort_unless($incident->factory_id === $request->user()->current_factory_id, 404);
        $data = $request->validate([
            'status' => ['required', Rule::in(['reported', 'investigating', 'resolved'])],
            'resolution_note' => ['nullable', 'string', 'max:3000'],
        ]);
        $incident->update([
            ...$data,
            'resolved_by' => $data['status'] === 'resolved' ? $request->user()->id : $incident->resolved_by,
            'resolved_at' => $data['status'] === 'resolved' ? now() : $incident->resolved_at,
        ]);

        return response()->json($incident->fresh()->load(['reporter:id,name', 'resolver:id,name']));
    }

    public function storeInspection(Request $request): JsonResponse
    {
        $data = $request->validate([
            'area' => ['required', 'string', 'max:160'],
            'inspection_date' => ['required', 'date', 'before_or_equal:today'],
            'result' => ['required', Rule::in(['pass', 'fail', 'needs_attention'])],
            'notes' => ['nullable', 'string', 'max:3000'],
        ]);
        $inspection = SafetyInspection::create([...$data, 'inspector_id' => $request->user()->id]);

        return response()->json($inspection->load('inspector:id,name'), 201);
    }

    public function storePpeAssignment(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'user_id' => ['required', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)],
            'equipment_name' => ['required', 'string', 'max:160'],
            'issued_at' => ['required', 'date', 'before_or_equal:today'],
            'condition' => ['required', Rule::in(['new', 'good', 'worn', 'damaged'])],
        ]);
        $assignment = PpeAssignment::create([...$data, 'issued_by' => $request->user()->id]);

        return response()->json($assignment->load('user:id,name'), 201);
    }

    public function returnPpeAssignment(Request $request, PpeAssignment $assignment): JsonResponse
    {
        abort_unless($assignment->factory_id === $request->user()->current_factory_id, 404);
        $assignment->update(['returned_at' => now()]);

        return response()->json($assignment->fresh());
    }

    public function storeCorrectiveAction(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'source_type' => ['required', Rule::in(['incident', 'inspection', 'general'])],
            'source_id' => ['nullable', 'integer'],
            'description' => ['required', 'string', 'max:2000'],
            'assigned_to' => ['nullable', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)],
            'due_date' => ['nullable', 'date'],
        ]);
        $action = CorrectiveAction::create([...$data, 'status' => 'open', 'created_by' => $request->user()->id]);

        return response()->json($action->load(['assignee:id,name', 'creator:id,name']), 201);
    }

    public function updateCorrectiveAction(Request $request, CorrectiveAction $action): JsonResponse
    {
        abort_unless($action->factory_id === $request->user()->current_factory_id, 404);
        $data = $request->validate([
            'status' => ['required', Rule::in(['open', 'in_progress', 'completed'])],
        ]);
        $action->update([
            'status' => $data['status'],
            'completed_at' => $data['status'] === 'completed' ? now() : null,
        ]);

        return response()->json($action->fresh()->load(['assignee:id,name', 'creator:id,name']));
    }
}
