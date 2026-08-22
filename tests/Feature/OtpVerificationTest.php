<?php

namespace Tests\Feature;

use App\Mail\OtpVerificationMail;
use App\Models\Factory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OtpVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['features.otp_verification' => true]);
        Mail::fake();
    }

    private function capturedCode(string $email): string
    {
        $code = null;
        Mail::assertSent(OtpVerificationMail::class, function (OtpVerificationMail $mail) use ($email, &$code) {
            if (! $mail->hasTo($email)) {
                return false;
            }
            $code = $mail->code;

            return true;
        });

        return $code;
    }

    public function test_registration_holds_the_account_unverified_until_the_emailed_code_is_confirmed(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'owner@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'OTP Test Factory', 'industry_type' => 'general_manufacturing',
        ])->assertCreated()->assertJsonPath('status', 'verification_required')->assertJsonPath('email', 'owner@otp.test');

        $this->assertGuest();
        $this->assertNull(User::where('email', 'owner@otp.test')->value('email_verified_at'));

        $code = $this->capturedCode('owner@otp.test');
        $this->assertMatchesRegularExpression('/^\d{4}$/', $code);

        // A wrong code is rejected and does not sign the user in.
        $this->postJson('/api/auth/verify-otp', ['email' => 'owner@otp.test', 'code' => '0000'])->assertUnprocessable();
        $this->assertGuest();

        // The correct code verifies and signs the user in with the normal registration payload shape.
        $this->postJson('/api/auth/verify-otp', ['email' => 'owner@otp.test', 'code' => $code])
            ->assertOk()->assertJsonPath('user.email', 'owner@otp.test');
        $this->assertAuthenticated();
        $user = User::where('email', 'owner@otp.test')->firstOrFail();
        $this->assertNotNull($user->email_verified_at);
        $this->assertNull($user->otp_code);
    }

    public function test_otp_locks_out_after_too_many_wrong_attempts(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'lockout@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Lockout Factory', 'industry_type' => 'general_manufacturing',
        ])->assertCreated();
        $code = $this->capturedCode('lockout@otp.test');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/verify-otp', ['email' => 'lockout@otp.test', 'code' => '9999'])->assertUnprocessable();
        }

        // Even the correct code is now refused until a fresh one is requested.
        $this->postJson('/api/auth/verify-otp', ['email' => 'lockout@otp.test', 'code' => $code])
            ->assertUnprocessable()->assertJsonPath('errors.code.0', 'Too many incorrect attempts. Request a new code.');
        $this->assertGuest();
    }

    public function test_resend_issues_a_fresh_code_and_invalidates_the_old_one(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'resend@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Resend Factory', 'industry_type' => 'general_manufacturing',
        ])->assertCreated();
        $firstCode = $this->capturedCode('resend@otp.test');

        $this->postJson('/api/auth/resend-otp', ['email' => 'resend@otp.test'])->assertOk();
        Mail::assertSent(OtpVerificationMail::class, 2);
        $user = User::where('email', 'resend@otp.test')->firstOrFail();
        $secondCode = $user->otp_code;
        $this->assertNotSame($firstCode, $secondCode);

        $this->postJson('/api/auth/verify-otp', ['email' => 'resend@otp.test', 'code' => $firstCode])->assertUnprocessable();
        $this->postJson('/api/auth/verify-otp', ['email' => 'resend@otp.test', 'code' => $secondCode])->assertOk();
        $this->assertAuthenticated();
    }

    public function test_expired_code_is_rejected(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'expired@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Expired Factory', 'industry_type' => 'general_manufacturing',
        ])->assertCreated();
        $code = $this->capturedCode('expired@otp.test');
        User::where('email', 'expired@otp.test')->update(['otp_expires_at' => now()->subMinute()]);

        $this->postJson('/api/auth/verify-otp', ['email' => 'expired@otp.test', 'code' => $code])
            ->assertUnprocessable()->assertJsonPath('errors.code.0', 'This code has expired. Request a new one.');
        $this->assertGuest();
    }

    public function test_reregistering_an_unverified_email_discards_the_abandoned_signup(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'abandoned@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Abandoned Factory', 'industry_type' => 'general_manufacturing',
        ])->assertCreated();
        $staleFactoryId = User::where('email', 'abandoned@otp.test')->value('current_factory_id');

        // Never verified — try again with the same email and different factory details.
        $this->postJson('/api/auth/register', [
            'name' => 'Owner Retry', 'email' => 'abandoned@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Second Attempt Factory', 'industry_type' => 'food_processing',
        ])->assertCreated()->assertJsonPath('status', 'verification_required');

        $this->assertDatabaseCount('users', 1);
        $this->assertSoftDeleted('factories', ['id' => $staleFactoryId]);
        $code = $this->capturedCode('abandoned@otp.test');
        $this->postJson('/api/auth/verify-otp', ['email' => 'abandoned@otp.test', 'code' => $code])->assertOk();
        $factory = Factory::firstOrFail();
        $this->assertSame('Second Attempt Factory', $factory->name);
    }

    public function test_verified_accounts_are_never_reclaimed_by_a_new_registration_attempt(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Owner', 'email' => 'taken@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Taken Factory', 'industry_type' => 'general_manufacturing',
        ])->assertCreated();
        $code = $this->capturedCode('taken@otp.test');
        $this->postJson('/api/auth/verify-otp', ['email' => 'taken@otp.test', 'code' => $code])->assertOk();

        $this->postJson('/api/auth/logout')->assertOk();
        $this->postJson('/api/auth/register', [
            'name' => 'Impersonator', 'email' => 'taken@otp.test', 'password' => 'Secure@12345', 'password_confirmation' => 'Secure@12345',
            'factory_name' => 'Hijack Factory', 'industry_type' => 'general_manufacturing',
        ])->assertUnprocessable()->assertJsonValidationErrors(['email']);
    }
}
