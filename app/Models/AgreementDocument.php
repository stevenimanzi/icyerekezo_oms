<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

#[Fillable(['factory_id', 'file_path', 'original_name', 'uploaded_by'])]
class AgreementDocument extends Model
{
    use BelongsToFactory;

    protected $appends = ['file_url'];

    public function uploadedBy() { return $this->belongsTo(User::class, 'uploaded_by'); }
    public function signatures() { return $this->hasMany(SchoolAgreementSignature::class); }

    protected function fileUrl(): Attribute
    {
        return Attribute::get(fn () => $this->file_path ? Storage::disk('public')->url($this->file_path) : null);
    }
}
