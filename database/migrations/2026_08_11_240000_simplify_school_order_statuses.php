<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('sales_documents')->whereIn('status', ['draft', 'submitted'])->update(['status' => 'pending']);
        DB::table('sales_documents')->where('status', 'confirmed')->update(['status' => 'accepted']);
        DB::table('sales_documents')->whereIn('status', ['processing', 'ready'])->orderBy('id')->eachById(function ($order) {
            $ordered = (int) DB::table('sales_document_lines')->where('sales_document_id', $order->id)->sum('quantity_ordered');
            $delivered = (int) DB::table('sales_document_lines')->where('sales_document_id', $order->id)->sum('quantity_delivered');
            $status = $ordered > 0 && $delivered >= $ordered ? 'delivered' : ($delivered > 0 ? 'partial' : 'accepted');
            DB::table('sales_documents')->where('id', $order->id)->update(['status' => $status]);
        });
        DB::table('sales_documents')->where('status', 'completed')->update(['status' => 'delivered']);
        DB::table('sales_documents')->where('status', 'cancelled')->update(['status' => 'rejected']);
    }

    public function down(): void
    {
        DB::table('sales_documents')->where('status', 'accepted')->update(['status' => 'confirmed']);
        DB::table('sales_documents')->where('status', 'partial')->update(['status' => 'processing']);
        DB::table('sales_documents')->where('status', 'delivered')->update(['status' => 'completed']);
    }
};
