<?php

namespace App\Support\Security;

use Illuminate\Validation\Rules\Password;

final class PasswordPolicy
{
    public static function rule(): Password
    {
        return Password::min(10)->mixedCase()->numbers()->symbols();
    }
}
