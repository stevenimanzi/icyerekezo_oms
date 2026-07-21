<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 30);
            $table->string('type')->default('plant');
            $table->text('address')->nullable();
            $table->string('phone', 40)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code', 30);
            $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('symbol', 20);
            $table->string('dimension', 40)->default('count');
            $table->unsignedTinyInteger('precision')->default(3);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['factory_id', 'symbol']);
        });
        Schema::create('unit_conversions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_unit_id')->constrained('units')->cascadeOnDelete();
            $table->foreignId('to_unit_id')->constrained('units')->cascadeOnDelete();
            $table->decimal('multiplier', 20, 8);
            $table->timestamps();
            $table->unique(['factory_id', 'from_unit_id', 'to_unit_id']);
        });
        Schema::create('item_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('item_categories')->nullOnDelete();
            $table->string('name');
            $table->string('code', 30);
            $table->timestamps();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('item_categories')->nullOnDelete();
            $table->foreignId('unit_id')->constrained('units');
            $table->string('type')->index();
            $table->string('name');
            $table->string('sku', 80);
            $table->string('barcode', 100)->nullable();
            $table->text('description')->nullable();
            $table->decimal('standard_cost', 20, 4)->default(0);
            $table->decimal('selling_price', 20, 4)->default(0);
            $table->decimal('tax_rate', 7, 4)->default(0);
            $table->decimal('minimum_stock', 20, 6)->default(0);
            $table->decimal('reorder_level', 20, 6)->default(0);
            $table->boolean('batch_tracked')->default(false);
            $table->boolean('serial_tracked')->default(false);
            $table->boolean('expiry_tracked')->default(false);
            $table->string('storage_conditions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['factory_id', 'sku']);
            $table->unique(['factory_id', 'barcode']);
        });
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('code', 30);
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('tax_number', 80)->nullable();
            $table->text('address')->nullable();
            $table->unsignedSmallInteger('payment_terms_days')->default(0);
            $table->string('status')->default('active');
            $table->decimal('rating', 3, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('supplier_item', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->string('supplier_sku')->nullable();
            $table->decimal('unit_price', 20, 4)->default(0);
            $table->unsignedInteger('lead_time_days')->default(0);
            $table->decimal('minimum_order_quantity', 20, 6)->default(0);
            $table->timestamps();
            $table->unique(['supplier_id', 'item_id']);
        });
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code', 30);
            $table->string('type')->default('general');
            $table->boolean('allows_negative_stock')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('storage_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('storage_locations')->nullOnDelete();
            $table->string('name');
            $table->string('code', 50);
            $table->string('type')->default('bin');
            $table->boolean('is_quarantine')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['warehouse_id', 'code']);
        });
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('batch_number', 100);
            $table->date('manufactured_at')->nullable();
            $table->date('expires_at')->nullable()->index();
            $table->string('status')->default('available')->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'item_id', 'batch_number']);
        });
        Schema::create('stock_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('location_id')->nullable()->constrained('storage_locations')->restrictOnDelete();
            $table->foreignId('batch_id')->nullable()->constrained()->restrictOnDelete();
            $table->decimal('quantity_on_hand', 20, 6)->default(0);
            $table->decimal('quantity_reserved', 20, 6)->default(0);
            $table->decimal('quantity_quarantined', 20, 6)->default(0);
            $table->timestamps();
            $table->unique(['factory_id', 'item_id', 'warehouse_id', 'location_id', 'batch_id'], 'stock_balance_dimension_unique');
        });
        Schema::create('stock_transactions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('location_id')->nullable()->constrained('storage_locations')->restrictOnDelete();
            $table->foreignId('batch_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('type', 40)->index();
            $table->decimal('quantity_delta', 20, 6)->default(0);
            $table->decimal('reserved_delta', 20, 6)->default(0);
            $table->decimal('quarantined_delta', 20, 6)->default(0);
            $table->decimal('unit_cost', 20, 4)->default(0);
            $table->decimal('balance_after', 20, 6);
            $table->nullableMorphs('reference');
            $table->text('reason')->nullable();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reverses_transaction_id')->nullable()->constrained('stock_transactions')->restrictOnDelete();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
            $table->index(['factory_id', 'item_id', 'warehouse_id', 'occurred_at'], 'stock_ledger_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transactions');
        Schema::dropIfExists('stock_balances');
        Schema::dropIfExists('batches');
        Schema::dropIfExists('storage_locations');
        Schema::dropIfExists('warehouses');
        Schema::dropIfExists('supplier_item');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('items');
        Schema::dropIfExists('item_categories');
        Schema::dropIfExists('unit_conversions');
        Schema::dropIfExists('units');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('branches');
    }
};
