<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agreement_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('file_path');
            $table->string('original_name');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['factory_id', 'created_at']);
        });

        Schema::create('school_agreement_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agreement_document_id')->constrained()->cascadeOnDelete();
            $table->string('file_path');
            $table->string('original_name');
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();
            $table->index(['agreement_document_id', 'school_id'], 'school_agreement_signatures_doc_school_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_agreement_signatures');
        Schema::dropIfExists('agreement_documents');
    }
};
