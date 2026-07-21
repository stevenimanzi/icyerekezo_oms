<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Factory;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
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
                'default_locale' => $data['locale'] ?? 'en',
            ]);
            $user = User::create([
                'current_factory_id' => $factory->id,
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'locale' => $data['locale'] ?? 'en',
            ]);
            $factory->users()->attach($user->id, ['is_owner' => true, 'is_active' => true, 'joined_at' => now(), 'job_title' => 'Factory owner']);
            $role = Role::create(['factory_id' => $factory->id, 'name' => 'Factory Owner', 'slug' => 'factory-owner', 'is_system' => true]);
            $role->permissions()->sync(Permission::pluck('id'));
            $user->roles()->attach($role->id, ['factory_id' => $factory->id]);

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
        $user->load('currentFactory:id,uuid,name,slug,industry_type,currency_code,timezone,default_locale', 'factories:id,uuid,name,slug');

        return [
            'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'locale' => $user->locale,
            'current_factory' => $user->currentFactory, 'factories' => $user->factories,
            'permissions' => $user->roles()->wherePivot('factory_id', $user->current_factory_id)->with('permissions:id,slug')->get()->pluck('permissions')->flatten()->pluck('slug')->unique()->values(),
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
