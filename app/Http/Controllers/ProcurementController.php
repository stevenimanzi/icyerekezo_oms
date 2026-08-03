<?php

namespace App\Http\Controllers;

use App\Models\PurchaseDocument;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;

class ProcurementController extends Controller
{
    public function overview(): JsonResponse
    {
        $documents = PurchaseDocument::query();
        $orders = (clone $documents)->where('document_type', 'purchase_order');

        return response()->json([
            'summary' => [
                'requests' => (clone $documents)->where('document_type', 'purchase_request')->count(),
                'pending_requests' => (clone $documents)->where('document_type', 'purchase_request')->whereIn('status', ['draft', 'submitted', 'pending_approval'])->count(),
                'purchase_orders' => (clone $orders)->count(),
                'open_orders' => (clone $orders)->whereIn('status', ['approved', 'ordered', 'partially_received'])->count(),
                'ordered_value' => (float) (clone $orders)->whereNotIn('status', ['draft', 'cancelled'])->sum('total_amount'),
                'receipts' => (clone $documents)->where('document_type', 'goods_receipt')->count(),
                'suppliers' => Supplier::query()->count(),
                'active_suppliers' => Supplier::query()->where('status', 'active')->count(),
            ],
            'documents' => PurchaseDocument::with('supplier:id,name,code')->latest('document_date')->latest('id')->paginate(50),
            'supplier_prices' => Supplier::with(['items:id,name,sku'])->whereHas('items')->latest()->get(),
            'updated_at' => now()->toIso8601String(),
        ]);
    }
}
