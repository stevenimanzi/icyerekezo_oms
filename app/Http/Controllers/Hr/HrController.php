<?php

namespace App\Http\Controllers;

use App\Models\EmployeeAttendance;
use App\Models\LeaveRequest;
use App\Models\Training;
use App\Models\TrainingParticipant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HrController extends Controller
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
        $from = today()->subDays(13)->toDateString();

        $attendanceTrend = collect(range(6, 0))->map(function (int $daysAgo) {
            $day = today()->subDays($daysAgo);
            $dayRecords = EmployeeAttendance::whereDate('date', $day);

            return [
                'date' => $day->format('M j'),
                'present' => (clone $dayRecords)->whereIn('status', ['present', 'late'])->count(),
                'absent' => (clone $dayRecords)->where('status', 'absent')->count(),
            ];
        })->values();

        return response()->json([
            'employees' => $this->employees($factoryId),
            'attendance' => EmployeeAttendance::with('user:id,name')->where('date', '>=', $from)->orderByDesc('date')->get(),
            'attendance_trend' => $attendanceTrend,
            'leave_requests' => LeaveRequest::with(['user:id,name', 'reviewer:id,name'])->latest()->limit(100)->get(),
            'trainings' => Training::with(['participants.user:id,name', 'creator:id,name'])->orderByDesc('scheduled_at')->limit(50)->get(),
            'stats' => [
                'present_today' => EmployeeAttendance::whereDate('date', today())->where('status', 'present')->count(),
                'absent_today' => EmployeeAttendance::whereDate('date', today())->where('status', 'absent')->count(),
                'pending_leave' => LeaveRequest::where('status', 'pending')->count(),
                'upcoming_trainings' => Training::where('status', 'scheduled')->where('scheduled_at', '>=', today())->count(),
            ],
        ]);
    }

    public function storeAttendance(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'user_id' => ['required', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'status' => ['required', Rule::in(['present', 'absent', 'late', 'on_leave'])],
            'check_in_time' => ['nullable', 'date_format:H:i'],
            'check_out_time' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $record = EmployeeAttendance::updateOrCreate(
            ['factory_id' => $factoryId, 'user_id' => $data['user_id'], 'date' => $data['date']],
            [...$data, 'recorded_by' => $request->user()->id]
        );

        return response()->json($record->load('user:id,name'), 201);
    }

    public function storeLeaveRequest(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'user_id' => ['required', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)],
            'leave_type' => ['required', Rule::in(['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other'])],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after_or_equal:starts_at'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);
        $days = \Carbon\Carbon::parse($data['starts_at'])->diffInDays(\Carbon\Carbon::parse($data['ends_at'])) + 1;
        $leave = LeaveRequest::create([...$data, 'days_requested' => $days, 'status' => 'pending']);

        return response()->json($leave->load('user:id,name'), 201);
    }

    public function decideLeaveRequest(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        abort_unless($leaveRequest->factory_id === $request->user()->current_factory_id, 404);
        abort_unless($leaveRequest->status === 'pending', 422, 'This leave request has already been reviewed.');
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'review_note' => ['nullable', 'string', 'max:2000'],
        ]);
        $leaveRequest->update([
            'status' => $data['decision'],
            'review_note' => $data['review_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json($leaveRequest->fresh()->load(['user:id,name', 'reviewer:id,name']));
    }

    public function storeTraining(Request $request): JsonResponse
    {
        $factoryId = $request->user()->current_factory_id;
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'trainer' => ['nullable', 'string', 'max:160'],
            'scheduled_at' => ['required', 'date'],
            'duration_hours' => ['required', 'numeric', 'min:0.5', 'max:200'],
            'participant_ids' => ['nullable', 'array'],
            'participant_ids.*' => ['integer', Rule::exists('factory_user', 'user_id')->where('factory_id', $factoryId)],
        ]);
        $training = Training::create([...collect($data)->except('participant_ids')->all(), 'status' => 'scheduled', 'created_by' => $request->user()->id]);
        foreach ($data['participant_ids'] ?? [] as $userId) {
            TrainingParticipant::create(['training_id' => $training->id, 'user_id' => $userId, 'status' => 'registered']);
        }

        return response()->json($training->load('participants.user:id,name'), 201);
    }

    public function updateTrainingParticipant(Request $request, TrainingParticipant $participant): JsonResponse
    {
        abort_unless($participant->training->factory_id === $request->user()->current_factory_id, 404);
        $data = $request->validate([
            'status' => ['required', Rule::in(['registered', 'attended', 'absent', 'completed'])],
            'certified' => ['nullable', 'boolean'],
        ]);
        $participant->update($data);

        return response()->json($participant->fresh()->load('user:id,name'));
    }
}
