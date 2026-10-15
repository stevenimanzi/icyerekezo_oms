<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformSupportController extends Controller
{
    public function tickets(): JsonResponse
    {
        return response()->json(
            SupportTicket::with(['messages.user:id,name,is_platform_admin', 'user:id,name,email', 'factory:id,name'])
                ->latest('updated_at')
                ->paginate(25),
        );
    }

    public function replyTicket(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:10000'],
            'status' => ['nullable', Rule::in(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])],
        ]);
        $message = SupportMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'message' => $data['message'],
        ]);
        $status = $data['status'] ?? 'waiting_customer';
        $ticket->update([
            'status' => $status,
            'assigned_to' => $request->user()->id,
            'resolved_at' => $status === 'resolved' ? now() : null,
        ]);

        return response()->json($message->load('user:id,name,is_platform_admin'), 201);
    }
}
