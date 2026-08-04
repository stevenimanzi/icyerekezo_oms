<?php

namespace App\Http\Controllers;

use App\Models\PurchaseDocument;
use App\Models\Supplier;
use App\Models\StockTransaction;
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
                'receipts' => StockTransaction::whereIn('type', ['receipt', 'return_in', 'adjustment_in'])->count(),
                'suppliers' => Supplier::query()->count(),
                'active_suppliers' => Supplier::query()->where('status', 'active')->count(),
            ],
            'documents' => PurchaseDocument::with('supplier:id,name,code')->latest('document_date')->latest('id')->paginate(50),
            'supplier_prices' => Supplier::with(['items:id,name,sku'])->whereHas('items')->latest()->get(),
            'stock_receipts' => StockTransaction::query()->whereIn('stock_transactions.type', ['receipt', 'return_in', 'adjustment_in'])
                ->join('items', 'items.id', '=', 'stock_transactions.item_id')
                ->join('warehouses', 'warehouses.id', '=', 'stock_transactions.warehouse_id')
                ->leftJoin('units', 'units.id', '=', 'items.unit_id')
                ->leftJoin('users', 'users.id', '=', 'stock_transactions.performed_by')
                ->latest('stock_transactions.occurred_at')->limit(100)
                ->get(['stock_transactions.id', 'stock_transactions.type', 'stock_transactions.quantity_delta', 'stock_transactions.unit_cost', 'stock_transactions.balance_after', 'stock_transactions.reason', 'stock_transactions.occurred_at', 'items.name as item_name', 'items.sku', 'warehouses.name as warehouse_name', 'units.symbol as unit', 'users.name as recorded_by']),
            'updated_at' => now()->toIso8601String(),
        ]);
    }
}
