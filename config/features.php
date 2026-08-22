<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Email OTP Verification
    |--------------------------------------------------------------------------
    |
    | When enabled, a new factory owner or school account must confirm a
    | 4-digit code emailed to them before their account is signed in. Existing
    | accounts (registered before this was enabled) are never affected — only
    | the registration flow checks this.
    |
    */

    'otp_verification' => (bool) env('OTP_VERIFICATION_ENABLED', true),

];
