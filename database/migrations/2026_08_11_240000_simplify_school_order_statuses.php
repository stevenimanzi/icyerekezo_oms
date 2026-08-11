<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('sales_documents')->whereIn('status', ['draft', 'submitted'])->update(['status' => 'pending']);
        DB::table('sales_documents')->where('status', 'confirmed')->update(['status' => 'accepted']);
        DB::table('sales_documents')->whereIn('status', ['processing', 'ready'])->update(['status' => 'partial']);
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
