<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Support\IndustryDailyReportCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FactorySettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $factory = $request->user()->currentFactory;

        return response()->json([
            'factory' => $factory->only(['id', 'name', 'industry_type', 'email', 'phone', 'country_code', 'currency_code', 'timezone', 'default_locale', 'status']),
            'settings' => $this->defaults($factory->settings ?? [], $factory->industry_type),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $factory = $request->user()->currentFactory;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['nullable', 'email:rfc', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'country_code' => ['required', 'string', 'size:2'],
            'currency_code' => ['required', Rule::in(['RWF', 'USD', 'EUR', 'KES', 'UGX'])],
            'timezone' => ['required', Rule::in(['Africa/Kigali', 'Africa/Johannesburg', 'Africa/Nairobi', 'Africa/Kampala', 'UTC'])],
            'default_locale' => ['required', Rule::in(['en', 'fr'])],
            'settings.address' => ['nullable', 'string', 'max:255'],
            'settings.city' => ['nullable', 'string', 'max:100'],
            'settings.registration_number' => ['nullable', 'string', 'max:100'],
            'settings.tax_number' => ['nullable', 'string', 'max:100'],
            'settings.opening_time' => ['required', 'date_format:H:i'],
            'settings.closing_time' => ['required', 'date_format:H:i', 'after:settings.opening_time'],
            'settings.working_days' => ['required', 'array', 'min:1'],
            'settings.working_days.*' => ['required', Rule::in(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])],
            'settings.production_order_prefix' => ['required', 'alpha_dash:ascii', 'max:12'],
            'settings.low_stock_alert_level' => ['required', 'integer', 'min:0', 'max:1000000'],
            'settings.require_production_approval' => ['required', 'boolean'],
            'settings.require_quality_release' => ['required', 'boolean'],
            'settings.allow_negative_stock' => ['required', 'boolean'],
            'settings.report.title' => ['sometimes', 'required', 'string', 'max:120'],
            'settings.report.default_period' => ['sometimes', 'required', Rule::in(['day', 'week', 'month'])],
            'settings.report.orientation' => ['sometimes', 'required', Rule::in(['portrait', 'landscape'])],
            'settings.report.input_label' => ['sometimes', 'required', 'string', 'max:80'],
            'settings.report.output_label' => ['sometimes', 'required', 'string', 'max:80'],
            'settings.report.show_summary' => ['sometimes', 'required', 'boolean'],
            'settings.report.show_daily_register' => ['sometimes', 'required', 'boolean'],
            'settings.report.show_department_totals' => ['sometimes', 'required', 'boolean'],
            'settings.report.show_stock_register' => ['sometimes', 'required', 'boolean'],
            'settings.report.show_guidance' => ['sometimes', 'required', 'boolean'],
            'settings.report.attributes' => ['sometimes', 'array', 'max:8'],
            'settings.report.attributes.*' => ['required', 'string', 'max:60', 'distinct'],
            'settings.report.unit_examples' => ['sometimes', 'array', 'max:8'],
            'settings.report.unit_examples.*' => ['required', 'string', 'max:20', 'distinct'],
        ]);
        $old = $factory->only(['name', 'email', 'phone', 'country_code', 'currency_code', 'timezone', 'default_locale', 'settings']);
        $settings = $this->defaults($data['settings'], $factory->industry_type);
        $factory->update([
            ...collect($data)->except('settings')->all(),
            'country_code' => strtoupper($data['country_code']),
            'settings' => $settings,
        ]);
        AuditLog::record('factory.settings_updated', 'Updated factory profile and operating settings', $factory, $old, $factory->fresh()->only(array_keys($old)));

        return response()->json([
            'message' => 'Factory settings saved successfully.',
            'factory' => $factory->fresh()->only(['id', 'name', 'industry_type', 'email', 'phone', 'country_code', 'currency_code', 'timezone', 'default_locale', 'status']),
            'settings' => $settings,
        ]);
    }

    private function defaults(array $settings, ?string $industry = null): array
    {
        $reportDefaults = IndustryDailyReportCatalog::for($industry);
        $defaults = [
            'address' => '',
            'city' => '',
            'registration_number' => '',
            'tax_number' => '',
            'opening_time' => '08:00',
            'closing_time' => '17:00',
            'working_days' => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            'production_order_prefix' => 'PO',
            'low_stock_alert_level' => 10,
            'require_production_approval' => true,
            'require_quality_release' => true,
            'allow_negative_stock' => false,
            'report' => [
                'title' => $reportDefaults['title'],
                'default_period' => 'day',
                'orientation' => 'landscape',
                'input_label' => $reportDefaults['input_label'],
                'output_label' => $reportDefaults['output_label'],
                'show_summary' => true,
                'show_daily_register' => true,
                'show_department_totals' => true,
                'show_stock_register' => true,
                'show_guidance' => false,
                'attributes' => $reportDefaults['attributes'],
                'unit_examples' => $reportDefaults['unit_examples'],
            ],
        ];

        return [
            ...$defaults,
            ...$settings,
            'report' => [
                ...$defaults['report'],
                ...($settings['report'] ?? []),
            ],
        ];
    }
}
