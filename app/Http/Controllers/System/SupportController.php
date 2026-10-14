<?php

namespace App\Http\Controllers;

use App\Models\SupportMessage;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SupportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(SupportTicket::where('user_id', $request->user()->id)->with(['messages.user:id,name,is_platform_admin', 'factory:id,name'])->latest('updated_at')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['subject' => ['required', 'string', 'max:180'], 'message' => ['required', 'string', 'max:10000'], 'category' => ['required', Rule::in(['general', 'technical', 'billing', 'security', 'data'])], 'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])]]);
        $ticket = SupportTicket::create(['factory_id' => $request->user()->current_factory_id, 'user_id' => $request->user()->id, 'ticket_number' => 'SUP-'.now()->format('ymd').'-'.Str::upper(Str::random(6)), 'subject' => $data['subject'], 'category' => $data['category'], 'priority' => $data['priority'] ?? 'normal']);
        SupportMessage::create(['support_ticket_id' => $ticket->id, 'user_id' => $request->user()->id, 'message' => $data['message']]);

        return response()->json($ticket->load(['messages.user:id,name,is_platform_admin', 'factory:id,name']), 201);
    }

    public function reply(Request $request, SupportTicket $ticket): JsonResponse
    {
        abort_unless($ticket->user_id === $request->user()->id, 404);
        $data = $request->validate(['message' => ['required', 'string', 'max:10000']]);

        $message = SupportMessage::create(['support_ticket_id' => $ticket->id, 'user_id' => $request->user()->id, 'message' => $data['message']]);
        $ticket->update(['status' => 'open', 'resolved_at' => null]);

        return response()->json($message->load('user:id,name,is_platform_admin'), 201);
    }
}
