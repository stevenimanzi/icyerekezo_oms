<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

#[Fillable(['factory_id', 'school_id', 'agreement_document_id', 'file_path', 'original_name', 'submitted_at'])]
class SchoolAgreementSignature extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime'];
    }

    protected $appends = ['file_url'];

    public function school() { return $this->belongsTo(School::class); }
    public function agreementDocument() { return $this->belongsTo(AgreementDocument::class); }

    protected function fileUrl(): Attribute
    {
        return Attribute::get(fn () => $this->file_path ? Storage::disk('public')->url($this->file_path) : null);
    }
}
