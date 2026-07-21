<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FactoryContextController extends Controller
{
    public function switch(Request $request): JsonResponse
    {
        $data = $request->validate(['factory_id' => ['required', 'integer']]);
        $factory = $request->user()->factories()->whereKey($data['factory_id'])->wherePivot('is_active', true)->firstOrFail();
        $request->user()->update(['current_factory_id' => $factory->id]);
        $request->session()->regenerate();
        AuditLog::record('factory.switched', "Switched to {$factory->name}", $factory);

        return response()->json(['message' => 'Factory selected.', 'factory' => $factory->only(['id', 'uuid', 'name', 'slug'])]);
    }
}
