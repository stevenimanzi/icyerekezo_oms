<?php

namespace App\Http\Controllers;

use App\Models\Factory;
use App\Models\Item;
use App\Models\ProductionOrder;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $query = trim($request->string('q')->value());
        if (mb_strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        if ($request->user()->is_platform_admin) {
            $results = collect()
                ->merge(Factory::where('name', 'like', "%{$query}%")->limit(5)->get()->map(fn ($item) => ['type' => 'Factory', 'title' => $item->name, 'subtitle' => $item->industry_type, 'page' => 'factories']))
                ->merge(User::where(fn ($builder) => $builder->where('name', 'like', "%{$query}%")->orWhere('email', 'like', "%{$query}%"))->limit(5)->get()->map(fn ($item) => ['type' => 'User', 'title' => $item->name, 'subtitle' => $item->email, 'page' => 'platform-users']));
        } else {
            $factoryId = $request->user()->current_factory_id;
            $results = collect()
                ->merge(Item::withoutGlobalScopes()->where('factory_id', $factoryId)->where(fn ($builder) => $builder->where('name', 'like', "%{$query}%")->orWhere('sku', 'like', "%{$query}%"))->limit(5)->get()->map(fn ($item) => ['type' => 'Product', 'title' => $item->name, 'subtitle' => $item->sku, 'page' => 'products']))
                ->merge(ProductionOrder::withoutGlobalScopes()->where('factory_id', $factoryId)->where('order_number', 'like', "%{$query}%")->limit(5)->get()->map(fn ($item) => ['type' => 'Production order', 'title' => $item->order_number, 'subtitle' => $item->status, 'page' => 'production']))
                ->merge(SupportTicket::where('user_id', $request->user()->id)->where(fn ($builder) => $builder->where('subject', 'like', "%{$query}%")->orWhere('ticket_number', 'like', "%{$query}%"))->limit(5)->get()->map(fn ($item) => ['type' => 'Support', 'title' => $item->subject, 'subtitle' => $item->ticket_number, 'page' => 'support']));
        }

        return response()->json(['data' => $results->take(10)->values()]);
    }
}
