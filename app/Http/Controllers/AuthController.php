<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Factory;
use App\Models\Permission;
use App\Models\PlatformAnnouncement;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\PermissionCatalog;
use App\Support\RoleTemplateCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        abort_unless(SystemSetting::valueFor('registration_enabled', true), 403, 'New factory registration is currently closed. Please contact support.');
        $passwordRule = Password::min(10)->mixedCase()->numbers()->symbols();
        if (app()->isProduction()) {
            $passwordRule->uncompromised();
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', $passwordRule],
            'factory_name' => ['required', 'string', 'max:160'],
            'industry_type' => ['required', 'string', 'max:80'],
            'locale' => ['nullable', 'in:en,fr'],
        ]);

        [$user, $factory] = DB::transaction(function () use ($data) {
            PermissionCatalog::seed();
            $factory = Factory::create([
                'uuid' => (string) Str::uuid(),
                'name' => $data['factory_name'],
                'slug' => $this->uniqueFactorySlug($data['factory_name']),
                'industry_type' => $data['industry_type'],
                'email' => $data['email'],
                'default_locale' => $data['locale'] ?? SystemSetting::valueFor('default_locale', 'en'),
                'currency_code' => SystemSetting::valueFor('currency_code', 'RWF'),
                'timezone' => SystemSetting::valueFor('timezone', 'Africa/Kigali'),
            ]);
            $user = User::create([
                'current_factory_id' => $factory->id,
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'locale' => $data['locale'] ?? SystemSetting::valueFor('default_locale', 'en'),
            ]);
            $factory->users()->attach($user->id, ['is_owner' => true, 'is_active' => true, 'joined_at' => now(), 'job_title' => 'Factory owner']);
            $role = Role::create(['factory_id' => $factory->id, 'name' => 'Factory Owner', 'slug' => 'factory-owner', 'dashboard_key' => 'executive', 'is_system' => true]);
            $role->permissions()->sync(Permission::pluck('id'));
            $user->roles()->attach($role->id, ['factory_id' => $factory->id]);
            RoleTemplateCatalog::createFor($factory);
            foreach ([['Piece', 'pc', 'count', 0], ['Kilogram', 'kg', 'mass', 3], ['Litre', 'L', 'volume', 3], ['Metre', 'm', 'length', 3]] as [$name, $symbol, $dimension, $precision]) {
                Unit::create(compact('name', 'symbol', 'dimension', 'precision') + ['factory_id' => $factory->id]);
            }
            Warehouse::create(['factory_id' => $factory->id, 'name' => 'Main Warehouse', 'code' => 'MAIN', 'type' => 'general']);

            return [$user, $factory];
        });

        Auth::login($user);
        $request->session()->regenerate();
        AuditLog::record('auth.registered', 'Factory and owner account created', $factory);

        return response()->json(['message' => 'Account created.', 'user' => $this->userPayload($user)], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string'], 'remember' => ['nullable', 'boolean']]);
        $user = User::where('email', Str::lower($credentials['email']))->first();
        if (! $user || ! $user->is_active || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'The provided credentials are incorrect.'], 422);
        }
        if (! $user->is_platform_admin && SystemSetting::valueFor('maintenance_enabled', false)) {
            return response()->json(['message' => SystemSetting::valueFor('maintenance_message', 'The platform is undergoing scheduled maintenance.')], 503);
        }
        Auth::login($user, (bool) ($credentials['remember'] ?? false));
        $request->session()->regenerate();
        $user->update(['last_login_at' => now(), 'last_login_ip' => $request->ip()]);
        AuditLog::record('auth.login', 'User signed in');

        return response()->json(['message' => 'Signed in.', 'user' => $this->userPayload($user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        AuditLog::record('auth.logout', 'User signed out');
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    private function userPayload(User $user): array
    {
        $user->load('currentFactory:id,uuid,name,slug,industry_type,currency_code,timezone,default_locale', 'factories:id,uuid,name,slug', 'employeeProfile.department:id,name,code', 'employeeProfile.workstation:id,name,code,type');
        $roles = $user->roles()->wherePivot('factory_id', $user->current_factory_id)->with('permissions:id,slug')->get();
        $permissions = $user->is_platform_admin ? collect(['*']) : $roles->pluck('permissions')->flatten()->pluck('slug')->unique()->values();

        return [
            'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'locale' => $user->locale,
            'is_platform_admin' => $user->is_platform_admin,
            'current_factory' => $user->currentFactory, 'factories' => $user->factories,
            'roles' => $roles->map->only(['id', 'name', 'slug', 'dashboard_key']),
            'permissions' => $permissions,
            'workspace' => $user->is_platform_admin && ! $user->current_factory_id ? 'platform_admin' : ($roles->first()?->dashboard_key ?? 'operations'),
            'employee_profile' => $user->employeeProfile,
            'active_assignments' => $user->workAssignments()->whereNotIn('status', ['completed', 'cancelled'])->orderBy('priority')->orderBy('due_at')->limit(10)->get(['id', 'assignment_type', 'title', 'priority', 'status', 'due_at']),
            'announcements' => PlatformAnnouncement::whereNotNull('published_at')->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))->latest('published_at')->limit(10)->get(['id', 'title', 'message', 'severity', 'published_at']),
            'system' => ['name' => SystemSetting::valueFor('system_name', 'ICYEREKEZO OMS'), 'tagline' => SystemSetting::valueFor('system_tagline', 'Factory operations made clear.'), 'logo_url' => SystemSetting::valueFor('logo_url'), 'support_email' => SystemSetting::valueFor('support_email'), 'support_phone' => SystemSetting::valueFor('support_phone'), 'currency_code' => SystemSetting::valueFor('currency_code', 'RWF'), 'timezone' => SystemSetting::valueFor('timezone', 'Africa/Kigali')],
        ];
    }

    private function uniqueFactorySlug(string $name): string
    {
        $base = Str::slug($name) ?: 'factory';
        $slug = $base;
        $counter = 2;
        while (Factory::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }
}
