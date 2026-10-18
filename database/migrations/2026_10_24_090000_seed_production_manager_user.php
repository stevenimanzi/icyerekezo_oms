<?php

use App\Models\Department;
use App\Models\EmployeeProfile;
use App\Models\Factory;
use App\Models\Role;
use App\Models\User;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration {
    public function up(): void
    {
        $factories = Factory::all();
        if ($factories->isEmpty()) {
            return;
        }

        $defaultFactory = $factories->firstWhere('slug', 'noguchi-holdings-ltd') ?? $factories->first();

        $user = User::updateOrCreate(
            ['email' => 'productionmanager@gmail.com'],
            [
                'name' => 'Production Manager',
                'username' => 'productionmanager',
                'password' => Hash::make('Password123!'),
                'is_active' => true,
                'email_verified_at' => now(),
                'current_factory_id' => $defaultFactory->id,
                'locale' => 'en',
            ]
        );

        foreach ($factories as $factory) {
            RoleTemplateCatalog::createFor($factory);

            $role = Role::where('factory_id', $factory->id)->where('slug', 'production-manager')->first();
            if ($role) {
                $user->roles()->syncWithPivotValues([$role->id], ['factory_id' => $factory->id], false);
            }

            $factory->users()->syncWithoutDetaching([
                $user->id => [
                    'job_title' => 'Production Manager',
                    'is_active' => true,
                    'is_owner' => false,
                    'joined_at' => now(),
                ],
            ]);

            $prodDept = Department::withoutGlobalScopes()
                ->where('factory_id', $factory->id)
                ->where(function ($q) {
                    $q->where('name', 'like', '%Production%')
                        ->orWhere('code', 'PROD');
                })
                ->first();

            EmployeeProfile::withoutGlobalScopes()->updateOrCreate(
                ['factory_id' => $factory->id, 'user_id' => $user->id],
                [
                    'employee_number' => 'EMP-PM-' . str_pad((string) $user->id, 4, '0', STR_PAD_LEFT),
                    'department_id' => $prodDept?->id,
                    'job_title' => 'Production Manager',
                    'status' => 'active',
                    'hired_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        User::where('email', 'productionmanager@gmail.com')->delete();
    }
};
