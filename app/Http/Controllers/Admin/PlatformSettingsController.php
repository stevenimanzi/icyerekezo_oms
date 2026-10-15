<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlatformSettingsController extends Controller
{
    public function settings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'system_name' => ['nullable', 'string', 'max:120'],
            'system_tagline' => ['nullable', 'string', 'max:180'],
            'logo_url' => ['nullable', 'string', 'max:1000', 'regex:/^(https?:\/\/|\/)/'],
            'support_email' => ['nullable', 'email'],
            'support_phone' => ['nullable', 'string', 'max:40'],
            'default_locale' => ['nullable', Rule::in(['en', 'fr'])],
            'currency_code' => ['nullable', Rule::in(['RWF', 'USD', 'EUR'])],
            'timezone' => ['nullable', Rule::in(['Africa/Kigali', 'Africa/Johannesburg', 'Africa/Nairobi', 'UTC'])],
            'backup_retention_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'registration_enabled' => ['nullable', 'boolean'],
            'maintenance_enabled' => ['nullable', 'boolean'],
            'maintenance_message' => ['nullable', 'string', 'max:1000'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'account_email' => [
                'nullable',
                'email:rfc',
                'max:190',
                Rule::unique('users', 'email')->ignore($request->user()->id),
            ],
        ]);
        $account = array_filter(
            [
                'name' => $data['account_name'] ?? null,
                'email' => isset($data['account_email']) ? Str::lower($data['account_email']) : null,
            ],
            fn ($value) => $value !== null,
        );
        unset($data['account_name'], $data['account_email']);
        if ($account) {
            $request->user()->update($account);
        }

        $publicKeys = [
            'system_name',
            'system_tagline',
            'logo_url',
            'support_email',
            'support_phone',
            'default_locale',
            'currency_code',
            'timezone',
            'maintenance_enabled',
            'maintenance_message',
        ];

        foreach ($data as $key => $value) {
            $type = is_bool($value) ? 'boolean' : (is_int($value) ? 'integer' : 'string');
            SystemSetting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => is_bool($value) ? ($value ? '1' : '0') : $value,
                    'type' => $type,
                    'is_public' => in_array($key, $publicKeys, true),
                ],
            );
        }
        AuditLog::record('platform.settings_updated', 'Updated system settings');

        return response()->json(['message' => 'System settings updated.']);
    }

    public function getSettings(Request $request): JsonResponse
    {
        return response()->json(
            SystemSetting::pluck('value', 'key')->merge([
                'account_name' => $request->user()->name,
                'account_email' => $request->user()->email,
            ]),
        );
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'logo' => ['required', 'file', 'mimes:png,jpg,jpeg,webp,ico', 'max:2048'],
        ]);
        $directory = public_path('uploads/system');
        File::ensureDirectoryExists($directory);
        foreach (File::glob($directory . DIRECTORY_SEPARATOR . 'system-logo.*') as $oldLogo) {
            File::delete($oldLogo);
        }
        $extension = strtolower($data['logo']->getClientOriginalExtension());
        $filename = 'system-logo.' . $extension;
        $data['logo']->move($directory, $filename);
        $logoUrl = '/uploads/system/' . $filename . '?v=' . now()->timestamp;
        SystemSetting::updateOrCreate(
            ['key' => 'logo_url'],
            ['value' => $logoUrl, 'type' => 'string', 'is_public' => true],
        );
        AuditLog::record('platform.logo_updated', 'Updated the system logo');

        return response()->json(['logo_url' => $logoUrl]);
    }
}
