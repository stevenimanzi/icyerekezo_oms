<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEXES = [
        'sales_documents' => [
            'idx_sales_documents_type_date' => ['factory_id', 'document_type', 'document_date'],
            'idx_sales_documents_payment_due' => ['factory_id', 'payment_status', 'due_date'],
        ],
        'quality_inspections' => ['idx_quality_inspections_date' => ['factory_id', 'inspected_at']],
        'employee_attendances' => ['idx_employee_attendances_date' => ['factory_id', 'date']],
        'production_orders' => ['idx_production_orders_status_end' => ['factory_id', 'status', 'planned_end']],
        'production_stage_executions' => ['idx_stage_executions_status_done' => ['factory_id', 'status', 'completed_at']],
        'safety_incidents' => ['idx_safety_incidents_date' => ['factory_id', 'incident_date']],
        'maintenance_records' => ['idx_maintenance_records_created' => ['factory_id', 'created_at']],
        'leave_requests' => ['idx_leave_requests_status' => ['factory_id', 'status']],
        'school_payment_submissions' => ['idx_payment_submissions_status' => ['factory_id', 'status', 'reviewed_at']],
        'audit_logs' => ['idx_audit_logs_recent' => ['factory_id', 'created_at']],
        'items' => ['idx_items_active' => ['factory_id', 'is_active']],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            foreach ($indexes as $name => $columns) {
                if (! Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($columns, $name));
                }
            }
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            foreach (array_keys($indexes) as $name) {
                if (Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropIndex($name));
                }
            }
        }
    }
};
