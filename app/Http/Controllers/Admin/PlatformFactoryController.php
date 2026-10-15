<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\EmployeeProfile;
use App\Models\Factory;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\FactoryProfileApplier;
use App\Support\Catalogs\IndustryProfileCatalog;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use App\Support\Security\PasswordPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlatformFactoryController extends Controller
{
    public function factories(Request $request): JsonResponse
    {
        return response()->json(
            Factory::withCount('users')
                ->with(['subscriptions' => fn ($q) => $q->latest()->limit(1)])
                ->when($request->string('search')->value(), fn ($q, $search) => $q->where('name', 'like', "%{$search}%"))
                ->latest()
                ->paginate(25),
        );
    }

    public function storeFactory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'factory_name' => ['required', 'string', 'max:160'],
            'industry_type' => ['required', 'string', 'max:80'],
            'industry_profiles' => ['nullable', 'array', 'max:6'],
            'industry_profiles.*' => ['string', Rule::in(IndustryProfileCatalog::keys())],
            'owner_name' => ['required', 'string', 'max:120'],
            'owner_email' => ['required', 'email', 'unique:users,email'],
            'owner_password' => ['required', PasswordPolicy::rule()],
            'manager_name' => ['nullable', 'required_with:manager_email', 'string', 'max:120'],
            'manager_email' => [
                'nullable',
                'required_with:manager_name',
                'email',
                'different:owner_email',
                'unique:users,email',
            ],
            'manager_password' => [
                'nullable',
                'required_with:manager_email',
                PasswordPolicy::rule(),
            ],
        ]);

        [$factory, $owner, $manager] = DB::transaction(function () use ($data) {
            PermissionCatalog::seed();
            $base = Str::slug($data['factory_name']) ?: 'factory';
            $slug = $base;
            $counter = 2;
            while (Factory::where('slug', $slug)->exists()) {
                $slug = $base . '-' . $counter++;
            }

            $factory = Factory::create([
                'uuid' => (string) Str::uuid(),
                'name' => $data['factory_name'],
                'slug' => $slug,
                'industry_type' => $data['industry_type'],
                'industry_profiles' => array_slice(
                    IndustryProfileCatalog::normalize($data['industry_type'], $data['industry_profiles'] ?? []),
                    1,
                ) ?:
                    null,
                'email' => $data['owner_email'],
                'currency_code' => SystemSetting::valueFor('currency_code', 'RWF'),
                'timezone' => SystemSetting::valueFor('timezone', 'Africa/Kigali'),
                'default_locale' => SystemSetting::valueFor('default_locale', 'en'),
                'status' => 'pending',
            ]);

            $owner = User::create([
                'current_factory_id' => $factory->id,
                'name' => $data['owner_name'],
                'email' => Str::lower($data['owner_email']),
                'password' => $data['owner_password'],
            ]);

            $factory->users()->attach($owner->id, [
                'is_owner' => true,
                'is_active' => true,
                'joined_at' => now(),
                'job_title' => 'Factory owner',
            ]);

            $role = Role::create([
                'factory_id' => $factory->id,
                'name' => 'Factory Owner',
                'slug' => 'factory-owner',
                'dashboard_key' => 'executive',
                'is_system' => true,
            ]);
            $role->permissions()->sync(RoleTemplateCatalog::ownerPermissionIds());
            $owner->roles()->attach($role->id, ['factory_id' => $factory->id]);

            RoleTemplateCatalog::createFor($factory);

            $manager = null;
            if (! empty($data['manager_email'])) {
                $manager = User::create([
                    'current_factory_id' => $factory->id,
                    'name' => $data['manager_name'],
                    'email' => Str::lower($data['manager_email']),
                    'password' => $data['manager_password'],
                ]);
                $factory->users()->attach($manager->id, [
                    'is_owner' => false,
                    'is_active' => true,
                    'joined_at' => now(),
                    'job_title' => 'Factory Manager',
                ]);
                $managerRole = Role::where('factory_id', $factory->id)->where('slug', 'factory-manager')->firstOrFail();
                $manager->roles()->attach($managerRole->id, ['factory_id' => $factory->id]);
                EmployeeProfile::create([
                    'factory_id' => $factory->id,
                    'user_id' => $manager->id,
                    'employee_number' => 'MGR-' . str_pad((string) $manager->id, 5, '0', STR_PAD_LEFT),
                    'job_title' => 'Factory Manager',
                    'employment_status' => 'active',
                    'hired_at' => now(),
                ]);
            }

            Warehouse::create([
                'factory_id' => $factory->id,
                'name' => 'Main Warehouse',
                'code' => 'MAIN',
                'type' => 'general',
            ]);
            app(FactoryProfileApplier::class)->apply($factory);

            return [$factory, $owner, $manager];
        });

        AuditLog::record('platform.factory_registered', "Registered factory {$factory->name}", $factory);

        return response()->json(
            [
                'factory' => $factory,
                'owner' => $owner->only(['id', 'name', 'email']),
                'manager' => $manager?->only(['id', 'name', 'email']),
            ],
            201,
        );
    }

    public function updateFactory(Request $request, Factory $factory): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'active', 'suspended', 'rejected'])],
        ]);
        $factory->update($data);
        AuditLog::record('platform.factory_status', "Factory {$factory->name} changed to {$data['status']}", $factory);

        return response()->json($factory);
    }

    public function destroyFactory(Factory $factory): JsonResponse
    {
        $factory->forceDelete();
        AuditLog::record('platform.factory_deleted', "Permanently deleted factory {$factory->name}");

        return response()->json(['message' => 'Factory deleted']);
    }
}
