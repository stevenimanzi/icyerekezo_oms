<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('school_payment_submissions', function (Blueprint $table) {
            $table->string('payment_reference', 120)->nullable()->after('payment_method');
            $table->date('paid_at')->nullable()->after('payment_reference');
        });
    }

    public function down(): void
    {
        Schema::table('school_payment_submissions', fn (Blueprint $table) => $table->dropColumn(['payment_reference', 'paid_at']));
    }
};
