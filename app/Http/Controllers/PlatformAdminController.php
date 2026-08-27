<?php

namespace App\Http\Controllers;

use App\Jobs\CreateDatabaseBackup;
use App\Models\AuditLog;
use App\Models\DatabaseBackup;
use App\Models\EmployeeProfile;
use App\Models\Factory;
use App\Models\FactorySubscription;
use App\Models\Permission;
use App\Models\PlatformAnnouncement;
use App\Models\Role;
use App\Models\SubscriptionPlan;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\SystemSetting;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\PermissionCatalog;
use App\Support\RoleTemplateCatalog;
use App\Support\SubscriptionFeatureCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class PlatformAdminController extends Controller
{
    public function overview(): JsonResponse
    {
        $start = now()->subDays(13)->startOfDay();
        $models = ['factories' => Factory::class, 'users' => User::class, 'subscriptions' => FactorySubscription::class];
        $totals = [];
        $daily = [];

        foreach ($models as $key => $model) {
            $totals[$key] = $model::where('created_at', '<', $start)->count();
            $daily[$key] = $model::where('created_at', '>=', $start)->get(['created_at'])->countBy(fn ($record) => $record->created_at->toDateString());
        }

        $growth = [];
        for ($day = $start->copy(); $day->lte(now()); $day->addDay()) {
            $date = $day->toDateString();
            foreach (array_keys($models) as $key) {
                $totals[$key] += $daily[$key]->get($date, 0);
            }
            $growth[] = ['date' => $date, 'label' => $day->format('M j'), ...$totals];
        }

        return response()->json([
            'statistics' => ['factories' => Factory::count(), 'active_factories' => Factory::where('status', 'active')->count(), 'users' => User::count(), 'active_subscriptions' => FactorySubscription::whereIn('status', ['trial', 'active'])->where('ends_at', '>', now())->count(), 'open_tickets' => SupportTicket::whereNotIn('status', ['resolved', 'closed'])->count()],
            'growth' => $growth,
            'factories' => Factory::withCount('users')->latest()->limit(10)->get(),
            'subscriptions' => FactorySubscription::with(['factory:id,name,status', 'plan:id,name'])->latest()->limit(10)->get(),
            'tickets' => SupportTicket::with('messages')->latest()->limit(10)->get(),
            'backups' => DatabaseBackup::latest()->limit(10)->get(),
            'activities' => AuditLog::with('user:id,name,email')->latest()->limit(15)->get(),
            'settings' => SystemSetting::pluck('value', 'key'),
        ]);
    }

    public function factories(Request $request): JsonResponse
    {
        return response()->json(Factory::withCount('users')->when($request->string('search')->value(), fn ($q, $search) => $q->where('name', 'like', "%$search%"))->latest()->paginate(25));
    }

    public function storeFactory(Request $request): JsonResponse
    {
        $data = $request->validate(['factory_name' => ['required', 'string', 'max:160'], 'industry_type' => ['required', 'string', 'max:80'], 'owner_name' => ['required', 'string', 'max:120'], 'owner_email' => ['required', 'email', 'unique:users,email'], 'owner_password' => ['required', Password::min(4)], 'manager_name' => ['nullable', 'required_with:manager_email', 'string', 'max:120'], 'manager_email' => ['nullable', 'required_with:manager_name', 'email', 'different:owner_email', 'unique:users,email'], 'manager_password' => ['nullable', 'required_with:manager_email', Password::min(4)]]);
        [$factory, $owner, $manager] = DB::transaction(function () use ($data) {
            PermissionCatalog::seed();
            $base = Str::slug($data['factory_name']) ?: 'factory';
            $slug = $base;
            $counter = 2;
            while (Factory::where('slug', $slug)->exists()) {
                $slug = $base.'-'.$counter++;
            } $factory = Factory::create(['uuid' => (string) Str::uuid(), 'name' => $data['factory_name'], 'slug' => $slug, 'industry_type' => $data['industry_type'], 'email' => $data['owner_email'], 'currency_code' => SystemSetting::valueFor('currency_code', 'RWF'), 'timezone' => SystemSetting::valueFor('timezone', 'Africa/Kigali'), 'default_locale' => SystemSetting::valueFor('default_locale', 'en'), 'status' => 'pending']);
            $owner = User::create(['current_factory_id' => $factory->id, 'name' => $data['owner_name'], 'email' => Str::lower($data['owner_email']), 'password' => $data['owner_password']]);
            $factory->users()->attach($owner->id, ['is_owner' => true, 'is_active' => true, 'joined_at' => now(), 'job_title' => 'Factory owner']);
            $role = Role::create(['factory_id' => $factory->id, 'name' => 'Factory Owner', 'slug' => 'factory-owner', 'dashboard_key' => 'executive', 'is_system' => true]);
            $role->permissions()->sync(RoleTemplateCatalog::ownerPermissionIds());
            $owner->roles()->attach($role->id, ['factory_id' => $factory->id]);
            RoleTemplateCatalog::createFor($factory);
            $manager = null;
            if (! empty($data['manager_email'])) {
                $manager = User::create(['current_factory_id' => $factory->id, 'name' => $data['manager_name'], 'email' => Str::lower($data['manager_email']), 'password' => $data['manager_password']]);
                $factory->users()->attach($manager->id, ['is_owner' => false, 'is_active' => true, 'joined_at' => now(), 'job_title' => 'Factory Manager']);
                $managerRole = Role::where('factory_id', $factory->id)->where('slug', 'factory-manager')->firstOrFail();
                $manager->roles()->attach($managerRole->id, ['factory_id' => $factory->id]);
                EmployeeProfile::create(['factory_id' => $factory->id, 'user_id' => $manager->id, 'employee_number' => 'MGR-'.str_pad((string) $manager->id, 5, '0', STR_PAD_LEFT), 'job_title' => 'Factory Manager', 'employment_status' => 'active', 'hired_at' => now()]);
            }
            foreach ([['Piece', 'pc', 'count', 0], ['Kilogram', 'kg', 'mass', 3], ['Litre', 'L', 'volume', 3], ['Metre', 'm', 'length', 3]] as [$name,$symbol,$dimension,$precision]) {
                Unit::create(compact('name', 'symbol', 'dimension', 'precision') + ['factory_id' => $factory->id]);
            } Warehouse::create(['factory_id' => $factory->id, 'name' => 'Main Warehouse', 'code' => 'MAIN', 'type' => 'general']);

            return [$factory, $owner, $manager];
        });
        AuditLog::record('platform.factory_registered', "Registered factory {$factory->name}", $factory);

        return response()->json(['factory' => $factory, 'owner' => $owner->only(['id', 'name', 'email']), 'manager' => $manager?->only(['id', 'name', 'email'])], 201);
    }

    public function updateFactory(Request $request, Factory $factory): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['pending', 'active', 'suspended', 'rejected'])]]);
        $factory->update($data);
        AuditLog::record('platform.factory_status', "Factory {$factory->name} changed to {$data['status']}", $factory);

        return response()->json($factory);
    }

    public function users(Request $request): JsonResponse
    {
        $query = User::where('is_platform_admin', false)->with(['factories:id,name', 'school:id,name']);
        
        $tab = $request->string('tab')->value();
        if ($tab === 'factories') {
            $query->whereHas('factories');
        } elseif ($tab === 'schools') {
            $query->whereNotNull('school_id');
        }

        if ($request->has('active') && $request->string('active')->value() !== '') {
            $query->where('is_active', $request->boolean('active'));
        }

        if ($search = $request->string('search')->value()) {
            $query->where(fn ($builder) => $builder->where('name', 'like', "%$search%")->orWhere('email', 'like', "%$search%"));
        }

        return response()->json([
            'users' => $query->latest()->paginate(10)->withQueryString(), 
            'factories' => Factory::with(['roles:id,factory_id,name,slug'])->orderBy('name')->get(['id', 'name'])
        ]);
    }

    public function storeFactoryUser(Request $request): JsonResponse
    {
        $data = $request->validate(['factory_id' => ['required', 'exists:factories,id'], 'role_id' => ['required', Rule::exists('roles', 'id')->where(fn ($q) => $q->where('factory_id', $request->integer('factory_id')))], 'name' => ['required', 'string', 'max:120'], 'email' => ['required', 'email', 'unique:users,email'], 'password' => ['required', Password::min(4)], 'job_title' => ['nullable', 'string', 'max:120'], 'employee_number' => ['required', 'string', 'max:50', Rule::unique('employee_profiles')->where('factory_id', $request->integer('factory_id'))]]);
        $user = DB::transaction(function () use ($data) {
            $user = User::create(['current_factory_id' => $data['factory_id'], 'name' => $data['name'], 'email' => Str::lower($data['email']), 'password' => $data['password']]);
            $user->factories()->attach($data['factory_id'], ['is_active' => true, 'is_owner' => false, 'joined_at' => now(), 'job_title' => $data['job_title'] ?? null]);
            $user->roles()->attach($data['role_id'], ['factory_id' => $data['factory_id']]);
            EmployeeProfile::create(['factory_id' => $data['factory_id'], 'user_id' => $user->id, 'employee_number' => $data['employee_number'], 'job_title' => $data['job_title'] ?? null, 'employment_status' => 'active', 'hired_at' => now()]);

            return $user;
        });
        AuditLog::record('platform.user_created', "Created factory user {$user->email}", $user);

        return response()->json($user, 201);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'confirmed', Password::min(4)]]);
        $user->update(['password' => $data['password']]);
        AuditLog::record('platform.password_reset', "Reset password for {$user->email}", $user);

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        abort_if($user->is($request->user()), 422, 'You cannot change your own platform access here.');
        $data = $request->validate(['is_active' => ['sometimes', 'boolean'], 'is_platform_admin' => ['sometimes', 'boolean']]);
        $user->update($data);
        AuditLog::record('platform.user_access', "Updated platform access for {$user->email}", $user);

        return response()->json($user);
    }

    public function storePlan(Request $request): JsonResponse
    {
        $data = $this->validatePlan($request);
        $data['features'] ??= [];
        $code = strtoupper($data['code']);
        $plan = SubscriptionPlan::updateOrCreate(['code' => $code], array_merge($data, ['code' => $code, 'is_active' => true]));

        return response()->json($plan, $plan->wasRecentlyCreated ? 201 : 200);
    }

    public function subscriptions(): JsonResponse
    {
        return response()->json(['feature_catalog' => SubscriptionFeatureCatalog::all(), 'plans' => SubscriptionPlan::orderBy('monthly_price')->get(), 'factories' => Factory::orderBy('name')->get(['id', 'name', 'status']), 'subscriptions' => FactorySubscription::with(['factory:id,name,status', 'plan:id,name,code,features'])->latest()->paginate(25)]);
    }

    public function updatePlan(Request $request, SubscriptionPlan $plan): JsonResponse
    {
        $data = $this->validatePlan($request, $plan);
        $data['code'] = strtoupper($data['code']);
        $plan->update($data);
        AuditLog::record('platform.subscription_plan_updated', "Updated subscription plan {$plan->name}", $plan);

        return response()->json($plan->fresh());
    }

    public function updateSubscription(Request $request, FactorySubscription $subscription): JsonResponse
    {
        $data = $request->validate(['subscription_plan_id' => ['required', 'exists:subscription_plans,id'], 'status' => ['sometimes', Rule::in(['trial', 'active', 'past_due', 'suspended', 'cancelled'])]]);
        $subscription->update($data);
        AuditLog::record('platform.subscription_changed', "Changed subscription for {$subscription->factory->name}", $subscription);

        return response()->json($subscription->fresh()->load('plan'));
    }

    private function validatePlan(Request $request, ?SubscriptionPlan $plan = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:40', Rule::unique('subscription_plans', 'code')->ignore($plan?->id)],
            'monthly_price' => ['required', 'numeric', 'min:0'],
            'currency_code' => ['required', 'string', 'size:3'],
            'limits' => ['nullable', 'array'],
            'features' => ['sometimes', 'array'],
            'features.*' => ['string', Rule::in(SubscriptionFeatureCatalog::keys())],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    public function subscribe(Request $request, Factory $factory): JsonResponse
    {
        $data = $request->validate(['subscription_plan_id' => ['required', 'exists:subscription_plans,id'], 'starts_at' => ['required', 'date'], 'ends_at' => ['required', 'date', 'after:starts_at'], 'grace_ends_at' => ['nullable', 'date', 'after_or_equal:ends_at'], 'auto_renew' => ['nullable', 'boolean']]);
        $subscription = FactorySubscription::create($data + ['factory_id' => $factory->id, 'status' => 'active']);
        $factory->update(['status' => 'active']);

        return response()->json($subscription->load('plan'), 201);
    }

    public function announce(Request $request): JsonResponse
    {
        $request->merge([
            'severity' => $request->input('severity', 'info'),
            'audience' => $request->input('audience', 'all'),
        ]);
        $data = $request->validate(['title' => ['required', 'string', 'max:180'], 'message' => ['required', 'string', 'max:10000'], 'severity' => ['required', Rule::in(['info', 'success', 'warning', 'critical'])], 'audience' => ['required', Rule::in(['all', 'factory_owners', 'factory_users'])], 'expires_at' => ['nullable', 'date', 'after:now']]);
        $announcement = PlatformAnnouncement::create($data + ['created_by' => $request->user()->id, 'published_at' => now()]);

        return response()->json($announcement, 201);
    }

    public function announcements(): JsonResponse
    {
        return response()->json(PlatformAnnouncement::latest('published_at')->paginate(25));
    }

    public function tickets(): JsonResponse
    {
        return response()->json(SupportTicket::with(['messages.user:id,name,is_platform_admin', 'user:id,name,email', 'factory:id,name'])->latest('updated_at')->paginate(25));
    }

    public function replyTicket(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:10000'], 'status' => ['nullable', Rule::in(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])]]);
        $message = SupportMessage::create(['support_ticket_id' => $ticket->id, 'user_id' => $request->user()->id, 'message' => $data['message']]);
        $status = $data['status'] ?? 'waiting_customer';
        $ticket->update(['status' => $status, 'assigned_to' => $request->user()->id, 'resolved_at' => $status === 'resolved' ? now() : null]);

        return response()->json($message->load('user:id,name,is_platform_admin'), 201);
    }

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
            'account_email' => ['nullable', 'email:rfc', 'max:190', Rule::unique('users', 'email')->ignore($request->user()->id)],
        ]);
        $account = array_filter([
            'name' => $data['account_name'] ?? null,
            'email' => isset($data['account_email']) ? Str::lower($data['account_email']) : null,
        ], fn ($value) => $value !== null);
        unset($data['account_name'], $data['account_email']);
        if ($account) {
            $request->user()->update($account);
        }
        foreach ($data as $key => $value) {
            $type = is_bool($value) ? 'boolean' : (is_int($value) ? 'integer' : 'string');
            SystemSetting::updateOrCreate(['key' => $key], ['value' => is_bool($value) ? ($value ? '1' : '0') : $value, 'type' => $type, 'is_public' => in_array($key, ['system_name', 'system_tagline', 'logo_url', 'support_email', 'support_phone', 'default_locale', 'currency_code', 'timezone', 'maintenance_enabled', 'maintenance_message'])]);
        } AuditLog::record('platform.settings_updated', 'Updated system settings');

        return response()->json(['message' => 'System settings updated.']);
    }

    public function getSettings(Request $request): JsonResponse
    {
        return response()->json(SystemSetting::pluck('value', 'key')->merge([
            'account_name' => $request->user()->name,
            'account_email' => $request->user()->email,
        ]));
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $data = $request->validate(['logo' => ['required', 'file', 'mimes:png,jpg,jpeg,webp,ico', 'max:2048']]);
        $directory = public_path('uploads/system');
        File::ensureDirectoryExists($directory);
        foreach (File::glob($directory.DIRECTORY_SEPARATOR.'system-logo.*') as $oldLogo) {
            File::delete($oldLogo);
        }
        $extension = strtolower($data['logo']->getClientOriginalExtension());
        $filename = 'system-logo.'.$extension;
        $data['logo']->move($directory, $filename);
        $logoUrl = '/uploads/system/'.$filename.'?v='.now()->timestamp;
        SystemSetting::updateOrCreate(['key' => 'logo_url'], ['value' => $logoUrl, 'type' => 'string', 'is_public' => true]);
        AuditLog::record('platform.logo_updated', 'Updated the system logo');

        return response()->json(['logo_url' => $logoUrl]);
    }

    public function backups(): JsonResponse
    {
        return response()->json(DatabaseBackup::latest()->paginate(25));
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $query = AuditLog::with(['user:id,name,email', 'factory:id,name']);
        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(fn ($q) => $q->where('description', 'like', "%{$search}%")->orWhere('event', 'like', "%{$search}%"));
        }
        if ($factoryId = $request->integer('factory_id')) {
            $query->where('factory_id', $factoryId);
        }
        if ($event = $request->string('event')->toString()) {
            $query->where('event', $event);
        }
        if ($from = $request->date('from')) {
            $query->where('created_at', '>=', $from->startOfDay());
        }
        if ($to = $request->date('to')) {
            $query->where('created_at', '<=', $to->endOfDay());
        }

        return response()->json([
            'logs' => $query->latest()->paginate(30)->withQueryString(),
            'events' => AuditLog::select('event')->distinct()->orderBy('event')->pluck('event'),
            'factories' => Factory::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function backup(Request $request): JsonResponse
    {
        $backup = DatabaseBackup::create(['requested_by' => $request->user()->id, 'status' => 'pending']);
        CreateDatabaseBackup::dispatchSync($backup->id);
        AuditLog::record('platform.backup_requested', 'Database backup requested', $backup);

        return response()->json($backup->fresh(), 202);
    }
}
