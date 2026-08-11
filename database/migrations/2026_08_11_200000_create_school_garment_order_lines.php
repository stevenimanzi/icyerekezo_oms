<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_document_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_document_id')->constrained()->cascadeOnDelete();
            $table->string('class_level', 30);
            $table->string('garment_category', 60);
            $table->string('gender', 20)->nullable();
            $table->string('size', 20)->nullable();
            $table->string('color')->nullable();
            $table->unsignedInteger('quantity_ordered');
            $table->unsignedInteger('quantity_packed')->default(0);
            $table->unsignedInteger('quantity_delivered')->default(0);
            $table->unsignedInteger('quantity_rejected')->default(0);
            $table->string('rejection_reason')->nullable();
            $table->timestamps();
            $table->index(['factory_id', 'garment_category']);
            $table->index(['sales_document_id', 'class_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_document_lines');
    }
};
