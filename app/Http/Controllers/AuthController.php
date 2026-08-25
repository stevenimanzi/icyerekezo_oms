<?php

namespace App\Http\Controllers;

use App\Mail\OtpVerificationMail;
use App\Models\AuditLog;
use App\Models\Factory;
use App\Models\Permission;
use App\Models\PlatformAnnouncement;
use App\Models\Role;
use App\Models\School;
use App\Services\RwandaLocationService;
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
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    private const OTP_TTL_MINUTES = 10;

    private const OTP_MAX_ATTEMPTS = 5;

    public function schoolRegistrationOptions(): JsonResponse
    {
        $factory = Factory::get()->first(fn (Factory $factory) => $factory->hasNoguchiSchoolOrders());
        return response()->json(['factory' => $factory?->only(['id', 'name']), 'locations' => app(RwandaLocationService::class)->northernDistrictsAndSectors()]);
    }

    public function registerSchool(Request $request): JsonResponse
    {
        abort_unless(SystemSetting::valueFor('registration_enabled', true), 403, 'School registration is currently closed. Please contact support.');
        $this->reclaimUnverifiedEmail($request->input('email', ''));
        $locations = app(RwandaLocationService::class)->northernDistrictsAndSectors();
        $passwordRule = PasswordRule::min(10)->mixedCase()->numbers()->symbols();
        if (app()->isProduction()) $passwordRule->uncompromised();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'], 'school_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'], 'phone' => ['required', 'string', 'max:40'],
            'district' => ['required', Rule::in(array_keys($locations))], 'sector' => ['required', Rule::in($locations[$request->input('district')] ?? [])],
            'password' => ['required', 'confirmed', $passwordRule], 'locale' => ['nullable', 'in:en,fr'],
        ]);
        $factory = Factory::get()->first(fn (Factory $candidate) => $candidate->hasNoguchiSchoolOrders());
        abort_unless($factory, 422, 'The school ordering factory is not available yet. Please contact NOGUCHI support.');

        $user = DB::transaction(function () use ($data, $factory) {
            PermissionCatalog::seed();
            RoleTemplateCatalog::createFor($factory);

            // Schools can re-register a contact without duplicating the school record itself.
            $school = School::firstOrCreate(
                ['factory_id' => $factory->id, 'name' => $data['school_name'], 'district' => $data['district'], 'sector' => $data['sector']],
                ['contact_name' => $data['name'], 'phone' => $data['phone'], 'email' => Str::lower($data['email'])]
            );
            $school->update(['contact_name' => $data['name'], 'phone' => $data['phone'], 'email' => Str::lower($data['email'])]);

            $user = User::create([
                'current_factory_id' => $factory->id,
                'school_id' => $school->id,
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'locale' => $data['locale'] ?? 'en',
            ]);
            $factory->users()->attach($user->id, ['is_owner' => false, 'is_active' => true, 'joined_at' => now(), 'job_title' => 'School Administrator']);
            $role = Role::where('factory_id', $factory->id)->where('slug', 'school-user')->firstOrFail();
            $user->roles()->attach($role->id, ['factory_id' => $factory->id]);

            return $user;
        });

        AuditLog::record('auth.school_registered', 'School administrator account created', $user->school);

        return $this->completeRegistration($request, $user, 'School administrator account created.');
    }

    public function register(Request $request): JsonResponse
    {
        abort_unless(SystemSetting::valueFor('registration_enabled', true), 403, 'New factory registration is currently closed. Please contact support.');
        $this->reclaimUnverifiedEmail($request->input('email', ''));
        $passwordRule = PasswordRule::min(10)->mixedCase()->numbers()->symbols();
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
            $role->permissions()->sync(RoleTemplateCatalog::ownerPermissionIds());
            $user->roles()->attach($role->id, ['factory_id' => $factory->id]);
            RoleTemplateCatalog::createFor($factory);
            foreach ([['Piece', 'pc', 'count', 0], ['Kilogram', 'kg', 'mass', 3], ['Litre', 'L', 'volume', 3], ['Metre', 'm', 'length', 3]] as [$name, $symbol, $dimension, $precision]) {
                Unit::create(compact('name', 'symbol', 'dimension', 'precision') + ['factory_id' => $factory->id]);
            }
            Warehouse::create(['factory_id' => $factory->id, 'name' => 'Main Warehouse', 'code' => 'MAIN', 'type' => 'general']);

            return [$user, $factory];
        });

        AuditLog::record('auth.registered', 'Factory and owner account created', $factory);

        return $this->completeRegistration($request, $user, 'Account created.');
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string', 'size:4'],
        ]);
        $email = Str::lower(trim($data['email']));
        $user = User::where('email', $email)->whereNull('email_verified_at')->first();
        if (! $user || ! $user->otp_code) {
            throw ValidationException::withMessages(['code' => 'This code is no longer valid. Request a new one.']);
        }
        if ($user->otp_expires_at?->isPast()) {
            throw ValidationException::withMessages(['code' => 'This code has expired. Request a new one.']);
        }
        if ($user->otp_attempts >= self::OTP_MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => 'Too many incorrect attempts. Request a new code.']);
        }
        if (! hash_equals((string) $user->otp_code, trim($data['code']))) {
            $user->increment('otp_attempts');
            throw ValidationException::withMessages(['code' => 'That code is incorrect.']);
        }

        $user->update(['email_verified_at' => now(), 'otp_code' => null, 'otp_expires_at' => null, 'otp_attempts' => 0]);
        Auth::login($user);
        $request->session()->regenerate();
        AuditLog::record('auth.email_verified', 'Verified account email with a one-time code', $user);

        return response()->json(['message' => 'Email verified.', 'user' => $this->userPayload($user)]);
    }

    public function resendOtp(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $user = User::where('email', Str::lower(trim($data['email'])))->whereNull('email_verified_at')->first();
        if ($user) {
            $this->issueOtp($user);
        }

        // Same response whether or not a matching unverified account exists, to avoid leaking registration state.
        return response()->json(['message' => 'If that account is awaiting verification, a new code has been sent.']);
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

        return response()->json(['message' => 'Signed in.', 'user' => $this->userPayload($user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    public function profile(Request $request): JsonResponse
    {
        return response()->json(['profile' => $this->profilePayload($request->user(), $request)]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190', 'unique:users,email,'.$user->id],
            'locale' => ['required', 'in:en,fr'],
            'timezone' => ['required', 'timezone:all'],
        ]);

        $user->update([
            'name' => trim($data['name']),
            'email' => Str::lower(trim($data['email'])),
            'locale' => $data['locale'],
            'timezone' => $data['timezone'],
        ]);
        AuditLog::record('account.profile_updated', 'Updated personal profile and preferences', $user);

        return response()->json([
            'message' => 'Your profile has been updated.',
            'profile' => $this->profilePayload($user->fresh(), $request),
            'user' => $this->userPayload($user->fresh()),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $passwordRule = PasswordRule::min(10)->mixedCase()->numbers()->symbols();
        if (app()->isProduction()) {
            $passwordRule->uncompromised();
        }
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', $passwordRule],
        ]);
        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['The current password is incorrect.']]);
        }
        if (Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['Choose a new password.']]);
        }

        $user->update(['password' => $data['password']]);
        $request->session()->regenerate();
        AuditLog::record('account.password_updated', 'Changed account password', $user);

        return response()->json(['message' => 'Your password has been changed securely.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        // Always send the same response to prevent email enumeration.
        Password::sendResetLink(
            ['email' => Str::lower(trim($request->input('email')))]
        );

        return response()->json([
            'message' => 'If that email is registered, a password reset link has been sent from support@icyerekezooms.com.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $passwordRule = PasswordRule::min(10)->mixedCase()->numbers()->symbols();
        if (app()->isProduction()) {
            $passwordRule->uncompromised();
        }

        $data = $request->validate([
            'token'    => ['required', 'string'],
            'email'    => ['required', 'email'],
            'password' => ['required', 'confirmed', $passwordRule],
        ]);

        $status = Password::reset(
            [
                'email'                 => Str::lower(trim($data['email'])),
                'password'              => $data['password'],
                'password_confirmation' => $data['password_confirmation'] ?? $data['password'],
                'token'                 => $data['token'],
            ],
            function (User $user, string $password) use ($request) {
                $user->forceFill(['password' => Hash::make($password)])
                     ->setRememberToken(Str::random(60));
                $user->save();

                AuditLog::record('account.password_reset', 'Password reset via email link', $user);
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => 'Your password has been reset. You can now sign in.']);
    }

    /**
     * Finishes a registration request: with OTP verification enabled, this issues a code
     * and holds off on signing the user in until it's confirmed via verifyOtp(); otherwise
     * it preserves the previous behaviour of signing the user in immediately.
     */
    private function completeRegistration(Request $request, User $user, string $message): JsonResponse
    {
        if (! config('features.otp_verification')) {
            Auth::login($user);
            $request->session()->regenerate();

            return response()->json(['message' => $message, 'user' => $this->userPayload($user)], 201);
        }

        $this->issueOtp($user);

        return response()->json([
            'status' => 'verification_required',
            'email' => $user->email,
            'message' => "We sent a 4-digit code to {$user->email}. Enter it to finish creating your account.",
        ], 201);
    }

    private function issueOtp(User $user): void
    {
        $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $user->update([
            'otp_code' => $code,
            'otp_expires_at' => now()->addMinutes(self::OTP_TTL_MINUTES),
            'otp_attempts' => 0,
        ]);
        try {
            Mail::to($user->email)->send(new OtpVerificationMail($user->name, $code, self::OTP_TTL_MINUTES));
        } catch (\Throwable $exception) {
            report($exception);
            throw ValidationException::withMessages([
                'email' => 'We could not send a verification email right now. Please try again shortly or contact support.',
            ]);
        }
    }

    /**
     * A registration that was never confirmed with its OTP shouldn't permanently occupy
     * its email address. If an unverified account owns this email, discard it (and any
     * factory it created as owner) so a fresh registration attempt can proceed cleanly.
     */
    private function reclaimUnverifiedEmail(string $email): void
    {
        if (! config('features.otp_verification') || ! $email) {
            return;
        }
        $stale = User::where('email', Str::lower(trim($email)))->whereNull('email_verified_at')->first();
        if (! $stale) {
            return;
        }
        $ownedFactoryId = $stale->factories()->wherePivot('is_owner', true)->value('factories.id');
        $stale->delete();
        if ($ownedFactoryId) {
            Factory::find($ownedFactoryId)?->delete();
        }
    }

    private function profilePayload(User $user, Request $request): array
    {
        $user->loadMissing('currentFactory:id,name,industry_type,timezone');

        return [
            'id' => $user->id, 'name' => $user->name, 'email' => $user->email,
            'locale' => $user->locale ?: 'en',
            'timezone' => $user->timezone ?: $user->currentFactory?->timezone ?: SystemSetting::valueFor('timezone', 'Africa/Kigali'),
            'last_login_at' => $user->last_login_at, 'last_login_ip' => $user->last_login_ip,
            'current_ip' => $request->ip(), 'created_at' => $user->created_at,
            'factory' => $user->currentFactory,
        ];
    }

    private function userPayload(User $user): array
    {
        $user->load('currentFactory:id,uuid,name,slug,industry_type,currency_code,timezone,default_locale', 'factories:id,uuid,name,slug', 'school:id,name,district,sector,contact_name,phone,email', 'employeeProfile.department:id,name,code', 'employeeProfile.workstation:id,name,code,type');
        $roles = $user->roles()->wherePivot('factory_id', $user->current_factory_id)->with('permissions:id,slug')->get();
        $permissions = $user->is_platform_admin ? collect(['*']) : $roles->pluck('permissions')->flatten()->pluck('slug')->unique()->values();
        $subscription = $user->current_factory_id ? \App\Models\FactorySubscription::with('plan:id,name,code,features')->where('factory_id', $user->current_factory_id)->latest('ends_at')->first() : null;

        return [
            'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'locale' => $user->locale, 'timezone' => $user->timezone,
            'is_platform_admin' => $user->is_platform_admin,
            'current_factory' => $user->currentFactory, 'factories' => $user->factories,
            'roles' => $roles->map->only(['id', 'name', 'slug', 'dashboard_key']),
            'permissions' => $permissions,
            'subscription' => $subscription ? ['id' => $subscription->id, 'status' => $subscription->status, 'plan' => $subscription->plan] : null,
            'workspace' => $user->is_platform_admin && ! $user->current_factory_id ? 'platform_admin' : ($roles->first()?->dashboard_key ?? 'operations'),
            'employee_profile' => $user->employeeProfile,
            'school' => $user->school,
            'unread_notifications_count' => $user->unreadNotifications()->count(),
            'notifications' => $user->notifications()->limit(5)->get(),
            'pending_orders_count' => \App\Models\SalesDocument::where('factory_id', $user->current_factory_id)->where('status', 'pending')->count(),
            'access_scope' => $user->current_factory_id ? \App\Support\OperationalScope::for($user)->payload() : null,
            'active_assignments' => $user->workAssignments()->whereNotIn('status', ['completed', 'cancelled'])->orderBy('priority')->orderBy('due_at')->limit(10)->get(['id', 'assignment_type', 'title', 'priority', 'status', 'due_at']),
            'announcements' => PlatformAnnouncement::whereNotNull('published_at')->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))->latest('published_at')->limit(10)->get(['id', 'title', 'message', 'severity', 'published_at']),
            'system' => ['name' => SystemSetting::valueFor('system_name', 'ICYEREKEZO OMS'), 'tagline' => SystemSetting::valueFor('system_tagline', 'Factory operations made clear.'), 'logo_url' => SystemSetting::valueFor('logo_url', '/assets/images/icyerekezo_oms_logo.svg'), 'support_email' => SystemSetting::valueFor('support_email'), 'support_phone' => SystemSetting::valueFor('support_phone'), 'currency_code' => SystemSetting::valueFor('currency_code', 'RWF'), 'timezone' => SystemSetting::valueFor('timezone', 'Africa/Kigali')],
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
