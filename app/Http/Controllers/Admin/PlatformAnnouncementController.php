<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformAnnouncement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformAnnouncementController extends Controller
{
    public function announce(Request $request): JsonResponse
    {
        $request->merge([
            'severity' => $request->input('severity', 'info'),
            'audience' => $request->input('audience', 'all'),
        ]);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'message' => ['required', 'string', 'max:10000'],
            'severity' => ['required', Rule::in(['info', 'success', 'warning', 'critical'])],
            'audience' => ['required', Rule::in(['all', 'factory_owners', 'factory_users'])],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);
        $announcement = PlatformAnnouncement::create(
            $data + [
                'created_by' => $request->user()->id,
                'published_at' => now(),
            ],
        );

        return response()->json($announcement, 201);
    }

    public function announcements(): JsonResponse
    {
        return response()->json(PlatformAnnouncement::latest('published_at')->paginate(25));
    }
}
