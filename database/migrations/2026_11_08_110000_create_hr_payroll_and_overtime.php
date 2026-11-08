<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('employee_profiles', 'base_salary')) {
                $table->decimal('base_salary', 14, 2)->default(0)->after('job_title');
                $table->decimal('overtime_rate', 12, 2)->nullable()->after('base_salary');
                $table->string('contract_type', 30)->nullable()->after('overtime_rate');
                $table->string('phone', 40)->nullable()->after('contract_type');
                $table->string('emergency_contact')->nullable()->after('phone');
            }
        });

        Schema::create('overtime_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->decimal('hours', 5, 2);
            $table->text('reason')->nullable();
            $table->string('status', 20)->default('pending');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->unsignedBigInteger('payroll_run_id')->nullable()->index();
            $table->timestamps();
            $table->index(['factory_id', 'work_date']);
        });

        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('run_number', 30);
            $table->string('period', 7);
            $table->string('status', 20)->default('draft'); // draft, submitted, paid, cancelled
            $table->decimal('statutory_rate', 5, 2)->default(0);
            $table->decimal('total_gross', 14, 2)->default(0);
            $table->decimal('total_deductions', 14, 2)->default(0);
            $table->decimal('total_net', 14, 2)->default(0);
            $table->unsignedSmallInteger('employee_count')->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('finance_entry_id')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'run_number']);
            $table->index(['factory_id', 'period']);
        });

        Schema::create('payroll_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('employee_name');
            $table->string('employee_number', 50)->nullable();
            $table->string('job_title')->nullable();
            $table->decimal('base_salary', 14, 2)->default(0);
            $table->decimal('overtime_hours', 7, 2)->default(0);
            $table->decimal('overtime_pay', 14, 2)->default(0);
            $table->decimal('allowances', 14, 2)->default(0);
            $table->unsignedSmallInteger('absent_days')->default(0);
            $table->decimal('absence_deduction', 14, 2)->default(0);
            $table->decimal('statutory_deduction', 14, 2)->default(0);
            $table->decimal('other_deductions', 14, 2)->default(0);
            $table->decimal('gross_pay', 14, 2)->default(0);
            $table->decimal('net_pay', 14, 2)->default(0);
            $table->string('note')->nullable();
            $table->timestamps();
            $table->unique(['payroll_run_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_lines');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('overtime_requests');
        Schema::table('employee_profiles', function (Blueprint $table) {
            foreach (['base_salary', 'overtime_rate', 'contract_type', 'phone', 'emergency_contact'] as $column) {
                if (Schema::hasColumn('employee_profiles', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
