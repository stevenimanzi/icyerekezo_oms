<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Factory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformAuditLogController extends Controller
{
    public function auditLogs(Request $request): JsonResponse
    {
        $query = AuditLog::with(['user:id,name,email', 'factory:id,name']);
        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")->orWhere('event', 'like', "%{$search}%");
            });
        }
        if ($factoryId = $request->integer('factory_id')) {
            $query->where('factory_id', $factoryId);
        }
        if ($event = $request->string('event')->toString()) {
            $query->where('event', $event);
        }
        if ($from = $request->date('from')) {
            $query->where('created_at', '>=', $from->startOfDay());
        }
        if ($to = $request->date('to')) {
            $query->where('created_at', '<=', $to->endOfDay());
        }

        return response()->json([
            'logs' => $query->latest()->paginate(30)->withQueryString(),
            'events' => AuditLog::select('event')->distinct()->orderBy('event')->pluck('event'),
            'factories' => Factory::orderBy('name')->get(['id', 'name']),
        ]);
    }
}
