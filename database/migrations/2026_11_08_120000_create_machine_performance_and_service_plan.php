<?php

use App\Support\Catalogs\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Adds the daily machine performance log, the service plan of each machine and what was found on a repair. */
    public function up(): void
    {
        Schema::table('machines', function (Blueprint $table) {
            if (! Schema::hasColumn('machines', 'maintenance_interval_days')) {
                $table->unsignedSmallInteger('maintenance_interval_days')->nullable()->after('next_maintenance_at');
            }
            if (! Schema::hasColumn('machines', 'last_maintenance_at')) {
                $table->timestamp('last_maintenance_at')->nullable()->after('next_maintenance_at');
            }
            if (! Schema::hasColumn('machines', 'ideal_output_per_hour')) {
                $table->unsignedInteger('ideal_output_per_hour')->nullable()->after('runtime_hours');
            }
        });

        Schema::table('maintenance_records', function (Blueprint $table) {
            if (! Schema::hasColumn('maintenance_records', 'cause')) {
                $table->string('cause')->nullable()->after('description');
            }
            if (! Schema::hasColumn('maintenance_records', 'parts_used')) {
                $table->text('parts_used')->nullable()->after('resolution');
            }
        });

        if (! Schema::hasTable('machine_performance_logs')) {
            Schema::create('machine_performance_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
                $table->foreignId('machine_id')->constrained()->cascadeOnDelete();
                $table->date('log_date');
                $table->string('shift', 20)->default('day');
                $table->unsignedSmallInteger('planned_minutes');
                $table->unsignedSmallInteger('run_minutes');
                $table->string('stop_reason', 40)->nullable();
                $table->unsignedInteger('units_produced')->default(0);
                $table->unsignedInteger('units_target')->default(0);
                $table->unsignedInteger('units_rejected')->default(0);
                $table->text('notes')->nullable();
                $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
                $table->timestamps();
                $table->unique(['machine_id', 'log_date', 'shift']);
                $table->index(['factory_id', 'log_date']);
            });
        }

        // The "manage" permission is for the person responsible for machines (register, plan, correct records).
        PermissionCatalog::seed();
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_performance_logs');
        Schema::table('maintenance_records', function (Blueprint $table) {
            foreach (['cause', 'parts_used'] as $column) {
                if (Schema::hasColumn('maintenance_records', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
        Schema::table('machines', function (Blueprint $table) {
            foreach (['maintenance_interval_days', 'last_maintenance_at', 'ideal_output_per_hour'] as $column) {
                if (Schema::hasColumn('machines', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
