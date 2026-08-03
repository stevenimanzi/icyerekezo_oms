<?php

namespace Tests;

use App\Models\Role;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function grantCurrentUserFactoryAdministrator(): void
    {
        $user = auth()->user();
        $role = Role::where('factory_id', $user->current_factory_id)->where('slug', 'factory-administrator')->firstOrFail();
        $user->roles()->syncWithoutDetaching([$role->id => ['factory_id' => $user->current_factory_id]]);
    }
}
