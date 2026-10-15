<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\EmployeeProfile;
use App\Models\Factory;
use App\Models\Role;
use App\Models\User;
use App\Support\Security\PasswordPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlatformUserController extends Controller
{
    public function users(Request $request): JsonResponse
    {
        $query = User::where('is_platform_admin', false)->with([
            'factories:id,name',
            'school:id,name,factory_id',
            'school.factory:id,name',
            'roles:id,name,slug',
        ]);

        $tab = $request->string('tab')->value();
        if ($tab === 'factories') {
            $query->whereHas('factories')->whereNull('school_id');
        } elseif ($tab === 'schools') {
            $query->whereNotNull('school_id');
        }

        if ($request->has('active') && $request->string('active')->value() !== '') {
            $query->where('is_active', $request->boolean('active'));
        }

        if ($search = $request->string('search')->value()) {
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($role = $request->string('role')->value()) {
            $query->whereHas('roles', fn ($q) => $q->where('slug', $role));
        }

        return response()->json([
            'users' => $query->latest()->paginate(10)->withQueryString(),
            'factories' => Factory::with(['roles:id,factory_id,name,slug'])
                ->orderBy('name')
                ->get(['id', 'name']),
            'roles' => Role::select('name', 'slug')->distinct()->orderBy('name')->get(),
        ]);
    }

    public function storeFactoryUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'factory_id' => ['required', 'exists:factories,id'],
            'role_id' => [
                'required',
                Rule::exists('roles', 'id')->where(fn ($q) => $q->where('factory_id', $request->integer('factory_id'))),
            ],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', PasswordPolicy::rule()],
            'job_title' => ['nullable', 'string', 'max:120'],
            'employee_number' => [
                'required',
                'string',
                'max:50',
                Rule::unique('employee_profiles')->where('factory_id', $request->integer('factory_id')),
            ],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'current_factory_id' => $data['factory_id'],
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
            ]);
            $user->factories()->attach($data['factory_id'], [
                'is_active' => true,
                'is_owner' => false,
                'joined_at' => now(),
                'job_title' => $data['job_title'] ?? null,
            ]);
            $user->roles()->attach($data['role_id'], [
                'factory_id' => $data['factory_id'],
            ]);
            EmployeeProfile::create([
                'factory_id' => $data['factory_id'],
                'user_id' => $user->id,
                'employee_number' => $data['employee_number'],
                'job_title' => $data['job_title'] ?? null,
                'employment_status' => 'active',
                'hired_at' => now(),
            ]);

            return $user;
        });
        AuditLog::record('platform.user_created', "Created factory user {$user->email}", $user);

        return response()->json($user, 201);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'confirmed', PasswordPolicy::rule()],
        ]);
        $user->update(['password' => $data['password']]);
        AuditLog::record('platform.password_reset', "Reset password for {$user->email}", $user);

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        abort_if($user->is($request->user()), 422, 'You cannot change your own platform access here.');
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => ['nullable', PasswordPolicy::rule()],
            'is_active' => ['sometimes', 'boolean'],
            'is_platform_admin' => ['sometimes', 'boolean'],
            'role_slug' => ['sometimes', 'string'],
        ]);

        DB::transaction(function () use ($data, $user) {
            $updateData = Arr::except($data, ['role_slug', 'password']);
            if (! empty($data['password'])) {
                $updateData['password'] = $data['password'];
            }
            if (! empty($updateData)) {
                $user->update($updateData);
            }

            if (isset($data['role_slug'])) {
                $factoryId = $user->current_factory_id ?? $user->factories()->first()?->id;
                if ($factoryId) {
                    $role = Role::where('factory_id', $factoryId)
                        ->where('slug', $data['role_slug'])
                        ->first();
                    if ($role) {
                        $user->roles()->wherePivot('factory_id', $factoryId)->detach();
                        $user->roles()->attach($role->id, ['factory_id' => $factoryId]);
                    }
                }
            }
        });

        AuditLog::record('platform.user_access', "Updated platform access for {$user->email}", $user);

        return response()->json($user);
    }

    public function destroyUser(User $user): JsonResponse
    {
        abort_if($user->is(request()->user()), 422, 'You cannot delete yourself.');
        $user->delete();
        AuditLog::record('platform.user_deleted', "Deleted user {$user->email}");

        return response()->json(['message' => 'User deleted']);
    }
}
