<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerActivityController extends Controller
{
    private const PER_PAGE = 25;

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $factoryId = (int) ($user->currentFactory?->id ?? $user->current_factory_id);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'module' => ['nullable', 'string', 'max:60'],
            'user_id' => ['nullable', 'integer'],
        ]);

        $logs = AuditLog::where('factory_id', $factoryId)->with('user:id,name');

        if (! empty($filters['q'])) {
            $term = '%'.$filters['q'].'%';
            $logs->where(fn ($query) => $query->where('description', 'like', $term)->orWhere('event', 'like', $term));
        }

        if (! empty($filters['module'])) {
            $logs->where('event', 'like', $filters['module'].'.%');
        }

        if (! empty($filters['user_id'])) {
            $logs->where('user_id', $filters['user_id']);
        }

        $page = $logs->latest('id')->paginate(self::PER_PAGE);

        return response()->json([
            'data' => $page->getCollection()->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'who' => $log->user?->name ?? 'System',
                'module' => str($log->event)->before('.')->toString(),
                'event' => $log->event,
                'description' => $log->description,
                'at' => $log->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
            'modules' => AuditLog::where('factory_id', $factoryId)
                ->distinct()
                ->pluck('event')
                ->map(fn (string $event) => str($event)->before('.')->toString())
                ->unique()
                ->sort()
                ->values(),
        ]);
    }
}
