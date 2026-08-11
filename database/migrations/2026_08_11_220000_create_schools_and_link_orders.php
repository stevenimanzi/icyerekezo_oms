<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('legacy_id')->nullable();
            $table->string('name');
            $table->string('district', 80)->nullable()->index();
            $table->string('sector', 80)->nullable()->index();
            $table->string('contact_name')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'legacy_id']);
            $table->index(['factory_id', 'name']);
        });

        if (! Schema::hasColumn('sales_documents', 'academic_year')) {
            Schema::table('sales_documents', fn (Blueprint $table) => $table->string('academic_year', 20)->nullable()->after('customer_email')->index());
        }
        Schema::table('sales_documents', fn (Blueprint $table) => $table->foreignId('school_id')->nullable()->after('factory_id')->constrained()->nullOnDelete());

        if (Schema::hasColumn('sales_documents', 'school_district')) {
            DB::table('sales_documents')->where('document_type', 'customer_order')->orderBy('id')->each(function ($order) {
                $schoolQuery = DB::table('schools')->where('factory_id', $order->factory_id)->where('name', $order->customer_name);
                $order->school_district ? $schoolQuery->where('district', $order->school_district) : $schoolQuery->whereNull('district');
                $order->school_sector ? $schoolQuery->where('sector', $order->school_sector) : $schoolQuery->whereNull('sector');
                $schoolId = $schoolQuery->value('id') ?? DB::table('schools')->insertGetId([
                    'factory_id' => $order->factory_id, 'name' => $order->customer_name, 'district' => $order->school_district,
                    'sector' => $order->school_sector, 'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('sales_documents')->where('id', $order->id)->update(['school_id' => $schoolId]);
            });
        }
    }

    public function down(): void
    {
        Schema::table('sales_documents', fn (Blueprint $table) => $table->dropConstrainedForeignId('school_id'));
        Schema::dropIfExists('schools');
    }
};
