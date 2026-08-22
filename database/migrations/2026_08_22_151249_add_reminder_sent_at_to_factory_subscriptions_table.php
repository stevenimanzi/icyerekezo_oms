<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factory_subscriptions', function (Blueprint $table) {
            $table->timestamp('expiry_reminder_sent_at')->nullable()->after('grace_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('factory_subscriptions', function (Blueprint $table) {
            $table->dropColumn('expiry_reminder_sent_at');
        });
    }
};
