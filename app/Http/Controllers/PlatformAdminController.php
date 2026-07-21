<?php

namespace App\Http\Controllers;

use App\Jobs\CreateDatabaseBackup;
use App\Models\AuditLog;
use App\Models\DatabaseBackup;
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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class PlatformAdminController extends Controller
{
    public function overview(): JsonResponse
    {
        return response()->json(['statistics' => ['factories' => Factory::count(), 'active_factories' => Factory::where('status', 'active')->count(), 'users' => User::count(), 'active_subscriptions' => FactorySubscription::whereIn('status', ['trial', 'active'])->where('ends_at', '>', now())->count(), 'open_tickets' => SupportTicket::whereNotIn('status', ['resolved', 'closed'])->count()], 'factories' => Factory::withCount('users')->latest()->limit(10)->get(), 'subscriptions' => FactorySubscription::with(['factory:id,name,status', 'plan:id,name'])->latest()->limit(10)->get(), 'tickets' => SupportTicket::with('messages')->latest()->limit(10)->get(), 'backups' => DatabaseBackup::latest()->limit(10)->get(), 'settings' => SystemSetting::pluck('value', 'key')]);
    }

    public function factories(Request $request): JsonResponse
    {
        return response()->json(Factory::withCount('users')->when($request->string('search')->value(), fn ($q, $search) => $q->where('name', 'like', "%$search%"))->latest()->paginate(25));
    }

    public function storeFactory(Request $request): JsonResponse
    {
        $data = $request->validate(['factory_name' => ['required', 'string', 'max:160'], 'industry_type' => ['required', 'string', 'max:80'], 'owner_name' => ['required', 'string', 'max:120'], 'owner_email' => ['required', 'email', 'unique:users,email'], 'owner_password' => ['required', Password::min(10)->mixedCase()->numbers()->symbols()]]);
        [$factory,$owner] = DB::transaction(function () use ($data) {
            PermissionCatalog::seed();
            $base = Str::slug($data['factory_name']) ?: 'factory';
            $slug = $base;
            $counter = 2;
            while (Factory::where('slug', $slug)->exists()) {
                $slug = $base.'-'.$counter++;
            } $factory = Factory::create(['uuid' => (string) Str::uuid(), 'name' => $data['factory_name'], 'slug' => $slug, 'industry_type' => $data['industry_type'], 'email' => $data['owner_email'], 'status' => 'pending']);
            $owner = User::create(['current_factory_id' => $factory->id, 'name' => $data['owner_name'], 'email' => Str::lower($data['owner_email']), 'password' => $data['owner_password']]);
            $factory->users()->attach($owner->id, ['is_owner' => true, 'is_active' => true, 'joined_at' => now(), 'job_title' => 'Factory owner']);
            $role = Role::create(['factory_id' => $factory->id, 'name' => 'Factory Owner', 'slug' => 'factory-owner', 'dashboard_key' => 'executive', 'is_system' => true]);
            $role->permissions()->sync(Permission::pluck('id'));
            $owner->roles()->attach($role->id, ['factory_id' => $factory->id]);
            RoleTemplateCatalog::createFor($factory);
            foreach ([['Piece', 'pc', 'count', 0], ['Kilogram', 'kg', 'mass', 3], ['Litre', 'L', 'volume', 3], ['Metre', 'm', 'length', 3]] as [$name,$symbol,$dimension,$precision]) {
                Unit::create(compact('name', 'symbol', 'dimension', 'precision') + ['factory_id' => $factory->id]);
            } Warehouse::create(['factory_id' => $factory->id, 'name' => 'Main Warehouse', 'code' => 'MAIN', 'type' => 'general']);

            return [$factory, $owner];
        });
        AuditLog::record('platform.factory_registered', "Registered factory {$factory->name}", $factory);

        return response()->json(['factory' => $factory, 'owner' => $owner->only(['id', 'name', 'email'])], 201);
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
        return response()->json(User::with('factories:id,name')->when($request->string('search')->value(), fn ($q, $search) => $q->where(fn ($builder) => $builder->where('name', 'like', "%$search%")->orWhere('email', 'like', "%$search%")))->latest()->paginate(25));
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
        $data = $request->validate(['name' => ['required', 'string', 'max:100'], 'code' => ['required', 'string', 'max:40', 'unique:subscription_plans,code'], 'monthly_price' => ['required', 'numeric', 'min:0'], 'currency_code' => ['required', 'string', 'size:3'], 'limits' => ['nullable', 'array'], 'features' => ['nullable', 'array']]);

        return response()->json(SubscriptionPlan::create($data), 201);
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
        $data = $request->validate(['title' => ['required', 'string', 'max:180'], 'message' => ['required', 'string', 'max:10000'], 'severity' => ['required', Rule::in(['info', 'success', 'warning', 'critical'])], 'audience' => ['required', Rule::in(['all', 'factory_owners', 'factory_users'])], 'expires_at' => ['nullable', 'date', 'after:now']]);
        $announcement = PlatformAnnouncement::create($data + ['created_by' => $request->user()->id, 'published_at' => now()]);

        return response()->json($announcement, 201);
    }

    public function tickets(): JsonResponse
    {
        return response()->json(SupportTicket::with('messages')->latest()->paginate(25));
    }

    public function replyTicket(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:10000'], 'status' => ['nullable', Rule::in(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])]]);
        $message = SupportMessage::create(['support_ticket_id' => $ticket->id, 'user_id' => $request->user()->id, 'message' => $data['message']]);
        if (isset($data['status'])) {
            $ticket->update(['status' => $data['status'], 'assigned_to' => $request->user()->id, 'resolved_at' => $data['status'] === 'resolved' ? now() : null]);
        }

return response()->json($message, 201);
    }

    public function settings(Request $request): JsonResponse
    {
        $data = $request->validate(['system_name' => ['nullable', 'string', 'max:120'], 'logo_url' => ['nullable', 'url', 'max:1000'], 'support_email' => ['nullable', 'email'], 'registration_enabled' => ['nullable', 'boolean'], 'maintenance_enabled' => ['nullable', 'boolean'], 'maintenance_message' => ['nullable', 'string', 'max:1000']]);
        foreach ($data as $key => $value) {
            SystemSetting::updateOrCreate(['key' => $key], ['value' => is_bool($value) ? ($value ? '1' : '0') : $value, 'type' => is_bool($value) ? 'boolean' : 'string', 'is_public' => in_array($key, ['system_name', 'logo_url', 'support_email', 'maintenance_enabled', 'maintenance_message'])]);
        } AuditLog::record('platform.settings_updated', 'Updated system settings');

        return response()->json(['message' => 'System settings updated.']);
    }

    public function backup(Request $request): JsonResponse
    {
        $backup = DatabaseBackup::create(['requested_by' => $request->user()->id, 'status' => 'pending']);
        CreateDatabaseBackup::dispatch($backup->id);
        AuditLog::record('platform.backup_requested', 'Database backup requested', $backup);

        return response()->json($backup,202);
    }
}
