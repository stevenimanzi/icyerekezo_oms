<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (range(2026, 2031) as $endingYear) {
            DB::table('sales_documents')
                ->where('academic_year', (string) $endingYear)
                ->update(['academic_year' => ($endingYear - 1).'-'.$endingYear]);
        }
    }

    public function down(): void
    {
        foreach (range(2026, 2031) as $endingYear) {
            DB::table('sales_documents')
                ->where('academic_year', ($endingYear - 1).'-'.$endingYear)
                ->update(['academic_year' => (string) $endingYear]);
        }
    }
};
