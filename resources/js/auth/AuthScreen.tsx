import React, { useEffect, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Check,
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    Factory,
    Globe,
    LockKeyhole,
    Mail,
    MapPin,
    Phone,
    RotateCw,
    Shield,
    ShieldCheck,
    Sparkles,
    UserRound,
} from 'lucide-react';
import { api } from '../core/api';
import { type AuthUser, type Locale } from '../core/types';
import { Logo } from '../app/Logo';
import { AuthInput } from './AuthInput';
import { AuthShowcase } from './AuthShowcase';

export const INDUSTRY_OPTIONS: [key: string, en: string, fr: string][] = [
    ['general_manufacturing', 'General manufacturing', 'Fabrication générale'],
    ['clothing_textiles', 'Clothing and textiles', 'Vêtements et textiles'],
    ['food_processing', 'Food processing', 'Transformation alimentaire'],
    ['beverages', 'Beverages and drinks', 'Boissons'],
    ['dairy', 'Milk and dairy products', 'Lait et produits laitiers'],
    [
        'pharmaceuticals_medicines',
        'Medicines and pharmaceuticals',
        'Médicaments et produits pharmaceutiques',
    ],
    ['plastics_rubber', 'Plastics and rubber materials', 'Matières plastiques et caoutchouc'],
    ['steel_metals', 'Steel and metal products', 'Acier et produits métalliques'],
    [
        'grain_flour_milling',
        'Maize, grain and flour milling',
        'Mouture de maïs, céréales et farine',
    ],
    [
        'agriculture_animal_feed',
        'Agriculture and animal feed',
        'Agriculture et alimentation animale',
    ],
    [
        'construction_materials',
        'Construction materials, cement and bricks',
        'Matériaux de construction, ciment et briques',
    ],
    ['furniture_wood', 'Furniture and wood products', 'Meubles et produits du bois'],
    [
        'paper_packaging_printing',
        'Paper, packaging and printing',
        'Papier, emballage et imprimerie',
    ],
    [
        'chemicals_cosmetics_soap',
        'Chemicals, cosmetics and soap',
        'Produits chimiques, cosmétiques et savon',
    ],
    [
        'electronics_electrical',
        'Electronics and electrical products',
        'Produits électroniques et électriques',
    ],
    ['automotive_machinery', 'Automotive parts and machinery', 'Pièces automobiles et machines'],
    ['recycling_waste', 'Recycling and waste processing', 'Recyclage et traitement des déchets'],
];

export function AuthScreen({
    onAuthenticated,
    onMaintenance,
}: {
    onAuthenticated: (user: AuthUser) => void;
    onMaintenance: (message: string) => void;
}) {
    const schoolAuth = window.location.pathname.startsWith('/school/');
    const [mode, setMode] = useState<'login' | 'register' | 'school_register' | 'forgot'>(() =>
        schoolAuth && /\/(?:signup|register)\/?$/.test(window.location.pathname)
            ? 'school_register'
            : 'login',
    );
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [locale, setLocale] = useState<Locale>('en');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [pendingOtpEmail, setPendingOtpEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [schoolStep, setSchoolStep] = useState(0);

    useEffect(() => {
        setSchoolStep(0);
    }, [mode]);

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        factory_name: '',
        industry_type: 'general_manufacturing',
        industry_profiles: [] as string[],
        industry_other: '',
        phone: '',
        district: '',
        sector: '',
        remember: false,
    });

    const [schoolOptions, setSchoolOptions] = useState<{
        factory: { id: number; name: string } | null;
        locations: Record<string, string[]>;
    }>({
        factory: null,
        locations: {},
    });

    useEffect(() => {
        if (schoolAuth) {
            api<typeof schoolOptions>('/api/auth/school-registration-options')
                .then(setSchoolOptions)
                .catch(() => setSchoolOptions({ factory: null, locations: {} }));
        }
    }, [schoolAuth]);

    const update = (key: string, value: string | boolean) =>
        setForm((current) => ({ ...current, [key]: value }));

    const passwordChecks = {
        length: form.password.length >= 10,
        upper: /[A-Z]/.test(form.password),
        lower: /[a-z]/.test(form.password),
        number: /[0-9]/.test(form.password),
        symbol: /[^A-Za-z0-9]/.test(form.password),
    };
    const passwordStrong = Object.values(passwordChecks).every(Boolean);

    const schoolStepValid =
        schoolStep === 0
            ? Boolean(form.email) &&
              passwordStrong &&
              form.password === form.password_confirmation &&
              form.password_confirmation.length > 0
            : schoolStep === 1
              ? Boolean(form.name) && (mode === 'register' || Boolean(form.phone))
              : true;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if ((mode === 'school_register' || mode === 'register') && schoolStep < 2) {
            if (schoolStepValid) setSchoolStep((current) => current + 1);
            return;
        }
        setBusy(true);
        setError('');
        try {
            if (mode === 'forgot') {
                await api('/api/auth/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email: form.email }),
                });
                setForgotSuccess(true);
                setBusy(false);
                return;
            }
            const endpoint =
                mode === 'login'
                    ? '/api/auth/login'
                    : mode === 'school_register'
                      ? '/api/auth/register-school'
                      : '/api/auth/register';
            const payload =
                mode === 'login'
                    ? { email: form.email, password: form.password, remember: form.remember }
                    : mode === 'school_register'
                      ? {
                            name: form.name,
                            school_name: form.factory_name,
                            email: form.email,
                            phone: form.phone,
                            district: form.district,
                            sector: form.sector,
                            password: form.password,
                            password_confirmation: form.password_confirmation,
                            locale,
                        }
                      : {
                            ...form,
                            industry_type:
                                form.industry_type === 'other'
                                    ? form.industry_other
                                    : form.industry_type,
                            industry_profiles: form.industry_profiles.filter(
                                (key) => key !== form.industry_type,
                            ),
                            locale,
                        };
            const data = await api<
                { user: AuthUser } | { status: 'verification_required'; email: string }
            >(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if ('requires_approval' in data) {
                setMode('login');
                setSchoolStep(0);
                setError(
                    locale === 'en'
                        ? 'Account created. Your factory is pending administrator approval.'
                        : "Compte créé. Votre usine est en attente d'approbation.",
                );
                return;
            }
            if (!('user' in data)) {
                setPendingOtpEmail(data.email);
                setOtpCode('');
                setResendCooldown(30);
                return;
            }
            if (schoolAuth && data.user.workspace !== 'school') {
                await api('/api/auth/logout', { method: 'POST' });
                throw new Error('This sign-in page is only for school administrators.');
            }
            onAuthenticated(data.user);
        } catch (reason: any) {
            if (reason?.status === 503) onMaintenance(reason.message);
            else setError(reason instanceof Error ? reason.message : 'Unable to continue.');
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [resendCooldown]);

    const verifyOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const data = await api<{ user: AuthUser }>('/api/auth/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ email: pendingOtpEmail, code: otpCode }),
            });
            onAuthenticated(data.user);
        } catch (reason: any) {
            setError(reason instanceof Error ? reason.message : 'Unable to verify that code.');
        } finally {
            setBusy(false);
        }
    };

    const resendOtp = async () => {
        if (resendCooldown > 0 || busy) return;
        setBusy(true);
        setError('');
        try {
            await api('/api/auth/resend-otp', {
                method: 'POST',
                body: JSON.stringify({ email: pendingOtpEmail }),
            });
            setOtpCode('');
            setResendCooldown(30);
        } catch (reason: any) {
            setError(reason instanceof Error ? reason.message : 'Unable to resend the code.');
        } finally {
            setBusy(false);
        }
    };

    const words =
        locale === 'en'
            ? {
                  ...(schoolAuth
                      ? {
                            title:
                                mode === 'login'
                                    ? 'School administrator sign in'
                                    : 'Create your school account',
                            subtitle:
                                mode === 'login'
                                    ? 'Sign in to place, track and verify your school garment orders.'
                                    : 'Set up your school portal for uniform ordering.',
                            name: 'Administrator name',
                            factory: 'School name',
                            industry: 'District',
                            specifyIndustry: 'Sector',
                            email: mode === 'login' ? 'Email or Username' : 'Email address',
                            password: mode === 'login' ? 'Password' : 'Create password',
                            confirm: 'Confirm password',
                            remember: 'Keep me signed in',
                            namePlaceholder: 'e.g. Jean Bosco Habimana',
                            factoryPlaceholder: 'e.g. Groupe Scolaire Musanze',
                            industryPlaceholder: 'Choose a sector',
                            emailPlaceholder:
                                mode === 'login'
                                    ? 'admin@school.rw or username'
                                    : 'admin@school.rw',
                            passwordPlaceholder: 'Enter your password',
                            confirmPlaceholder: 'Enter the password again',
                            action: mode === 'login' ? 'Sign in to Portal' : 'Create School Account',
                            switchText:
                                mode === 'login'
                                    ? 'Need a school portal account?'
                                    : 'Already registered your school?',
                            switchAction: mode === 'login' ? 'Sign up here' : 'Sign in',
                        }
                      : {
                            title:
                                mode === 'login'
                                    ? 'Welcome back'
                                    : 'Create your factory workspace',
                            subtitle:
                                mode === 'login'
                                    ? 'Enter your credentials to access your operations dashboard.'
                                    : 'Set up your secure factory tenant and start managing production.',
                            name: 'Factory owner name',
                            factory: 'Factory name',
                            industry: 'Primary industry',
                            specifyIndustry: 'Specify the industry',
                            email: mode === 'login' ? 'Email or Username' : 'Work email address',
                            password: 'Create password',
                            confirm: 'Confirm password',
                            remember: 'Keep me signed in',
                            namePlaceholder: "Enter owner's full name",
                            factoryPlaceholder: 'e.g. Kigali Apparel Works Ltd',
                            industryPlaceholder: 'Describe the type of factory',
                            emailPlaceholder:
                                mode === 'login'
                                    ? 'owner@company.com or username'
                                    : 'owner@company.com',
                            passwordPlaceholder: 'Create a strong password',
                            confirmPlaceholder: 'Repeat password to confirm',
                            action: mode === 'login' ? 'Sign in to Dashboard' : 'Create Factory Workspace',
                            switchText:
                                mode === 'login'
                                    ? "Don't have a factory account?"
                                    : 'Already have an account?',
                            switchAction: mode === 'login' ? 'Register factory' : 'Sign in',
                        }),
              }
            : {
                  ...(schoolAuth
                      ? {
                            title:
                                mode === 'login'
                                    ? 'Connexion administrateur scolaire'
                                    : 'Créer le compte de votre école',
                            subtitle:
                                mode === 'login'
                                    ? 'Connectez-vous pour passer et suivre les commandes de votre école.'
                                    : 'Configurez votre portail scolaire pour les tenues uniformes.',
                            name: "Nom de l'administrateur",
                            factory: "Nom de l'école",
                            industry: 'District',
                            specifyIndustry: 'Secteur',
                            email:
                                mode === 'login' ? "E-mail ou nom d'utilisateur" : 'Adresse e-mail',
                            password: mode === 'login' ? 'Mot de passe' : 'Créer un mot de passe',
                            confirm: 'Confirmer le mot de passe',
                            remember: 'Rester connecté',
                            namePlaceholder: "ex: Jean Bosco Habimana",
                            factoryPlaceholder: "ex: Groupe Scolaire Musanze",
                            industryPlaceholder: 'Choisissez un secteur',
                            emailPlaceholder:
                                mode === 'login'
                                    ? "admin@ecole.rw ou nom d'utilisateur"
                                    : 'admin@ecole.rw',
                            passwordPlaceholder: 'Saisissez votre mot de passe',
                            confirmPlaceholder: 'Répétez le mot de passe',
                            action: mode === 'login' ? 'Se connecter au portail' : 'Créer le compte école',
                            switchText:
                                mode === 'login'
                                    ? "Besoin d'un compte scolaire ?"
                                    : 'Vous avez déjà un compte scolaire ?',
                            switchAction: mode === 'login' ? "S'inscrire" : 'Se connecter',
                        }
                      : {
                            title: mode === 'login' ? 'Bon retour' : 'Créez votre espace usine',
                            subtitle:
                                mode === 'login'
                                    ? 'Connectez-vous pour gérer vos opérations industrielles.'
                                    : 'Démarrez votre espace ICYEREKEZO OMS sécurisé et audité.',
                            name: 'Nom complet du propriétaire',
                            factory: "Nom de l'usine",
                            industry: "Secteur industriel principal",
                            specifyIndustry: "Précisez le type d'industrie",
                            email:
                                mode === 'login' ? "E-mail ou nom d'utilisateur" : 'Adresse e-mail professionnelle',
                            password: 'Mot de passe',
                            confirm: 'Confirmer le mot de passe',
                            remember: 'Rester connecté',
                            namePlaceholder: 'Saisissez le nom complet',
                            factoryPlaceholder: "ex: Kigali Apparel Works Ltd",
                            industryPlaceholder: "Décrivez le type d'usine",
                            emailPlaceholder:
                                mode === 'login'
                                    ? "nom@entreprise.com ou nom d'utilisateur"
                                    : 'directeur@entreprise.com',
                            passwordPlaceholder: 'Créez un mot de passe sécurisé',
                            confirmPlaceholder: 'Répétez le mot de passe',
                            action: mode === 'login' ? 'Accéder au tableau de bord' : 'Créer mon espace usine',
                            switchText:
                                mode === 'login'
                                    ? "Vous n'avez pas encore d'espace ?"
                                    : 'Vous avez déjà un compte ?',
                            switchAction: mode === 'login' ? "Créer un espace" : 'Se connecter',
                        }),
              };

    return (
        <div className="auth-viewport">
            <div className="auth-container">
                {/* Left Panel: Showcase Side */}
                <AuthShowcase locale={locale} />

                {/* Right Panel: Form Side */}
                <div className="auth-form-panel">
                    {/* Header Bar: Logo & Language Toggle */}
                    <div className="auth-header-bar">
                        <div className="auth-logo-wrapper">
                            <Logo />
                        </div>
                        <button
                            type="button"
                            className="auth-lang-btn"
                            onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}
                            title={locale === 'en' ? 'Passer en Français' : 'Switch to English'}
                        >
                            <Globe size={15} />
                            <span className="auth-lang-text">
                                {locale === 'en' ? 'FR' : 'EN'}
                            </span>
                        </button>
                    </div>

                    {/* Pending OTP Verification Screen */}
                    {pendingOtpEmail ? (
                        <div className="auth-body">
                            <div className="auth-card-badge">
                                <ShieldCheck size={28} className="text-blue-600" />
                            </div>

                            <div className="auth-heading">
                                <span className="auth-kicker">
                                    {locale === 'en' ? 'SECURITY VERIFICATION' : 'VÉRIFICATION DE SÉCURITÉ'}
                                </span>
                                <h1 className="auth-title">
                                    {locale === 'en' ? 'Enter 4-digit code' : 'Saisissez le code'}
                                </h1>
                                <p className="auth-subtitle">
                                    {locale === 'en' ? (
                                        <>
                                            We sent a verification code to{' '}
                                            <strong className="text-slate-900 font-semibold">{pendingOtpEmail}</strong>.
                                        </>
                                    ) : (
                                        <>
                                            Nous avons envoyé un code de confirmation à{' '}
                                            <strong className="text-slate-900 font-semibold">{pendingOtpEmail}</strong>.
                                        </>
                                    )}
                                </p>
                            </div>

                            {error && (
                                <div className="auth-alert auth-alert-error">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={verifyOtp} className="auth-form">
                                <div className="auth-otp-container">
                                    <input
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={4}
                                        placeholder="••••"
                                        value={otpCode}
                                        onChange={(e) =>
                                            setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                                        }
                                        autoFocus
                                        required
                                        className="auth-otp-input"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="auth-btn-primary"
                                    disabled={busy || otpCode.length !== 4}
                                >
                                    <span>
                                        {busy
                                            ? locale === 'en'
                                                ? 'Verifying...'
                                                : 'Vérification...'
                                            : locale === 'en'
                                              ? 'Verify and continue'
                                              : 'Vérifier et continuer'}
                                    </span>
                                    <ChevronRight size={18} />
                                </button>

                                <div className="auth-resend-row">
                                    <span className="text-slate-500 text-sm">
                                        {locale === 'en' ? "Didn't receive the email?" : "Vous n'avez pas reçu le code ?"}
                                    </span>
                                    <button
                                        type="button"
                                        className="auth-link-btn"
                                        onClick={resendOtp}
                                        disabled={resendCooldown > 0 || busy}
                                    >
                                        <RotateCw size={13} className={busy ? 'animate-spin' : ''} />
                                        <span>
                                            {resendCooldown > 0
                                                ? locale === 'en'
                                                    ? `Resend in ${resendCooldown}s`
                                                    : `Renvoyer (${resendCooldown}s)`
                                                : locale === 'en'
                                                  ? 'Resend code'
                                                  : 'Renvoyer le code'}
                                        </span>
                                    </button>
                                </div>

                                <div className="auth-back-row">
                                    <button
                                        type="button"
                                        className="auth-link-back"
                                        onClick={() => {
                                            setPendingOtpEmail('');
                                            setOtpCode('');
                                            setError('');
                                        }}
                                    >
                                        <ArrowLeft size={15} />
                                        <span>
                                            {locale === 'en'
                                                ? 'Use a different email address'
                                                : 'Utiliser un autre e-mail'}
                                        </span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        /* Standard Form Body: Login, Signup, or In-Page Forgot Password */
                        <div className="auth-body">
                            <div className="auth-heading">
                                <h1 className="auth-title">
                                    {mode === 'forgot'
                                        ? locale === 'en'
                                            ? 'Reset your password'
                                            : 'Réinitialiser votre mot de passe'
                                        : words.title}
                                </h1>
                                <p className="auth-subtitle">
                                    {mode === 'forgot'
                                        ? locale === 'en'
                                            ? "Enter your email address and we'll send a secure password reset link."
                                            : 'Saisissez votre e-mail pour recevoir un lien sécurisé de réinitialisation.'
                                        : words.subtitle}
                                </p>

                                {/* Multi-Step Registration Stepper */}
                                {(mode === 'school_register' || mode === 'register') && (
                                    <div className="auth-stepper">
                                        {[
                                            locale === 'en' ? 'Account' : 'Compte',
                                            mode === 'school_register'
                                                ? locale === 'en'
                                                    ? 'Head teacher'
                                                    : 'Direction'
                                                : locale === 'en'
                                                  ? 'Owner'
                                                  : 'Propriétaire',
                                            mode === 'school_register'
                                                ? locale === 'en'
                                                    ? 'School'
                                                    : 'École'
                                                : locale === 'en'
                                                  ? 'Factory'
                                                  : 'Usine',
                                        ].map((label, index) => (
                                            <div
                                                key={label}
                                                className={`auth-stepper-step ${
                                                    index === schoolStep
                                                        ? 'active'
                                                        : index < schoolStep
                                                          ? 'done'
                                                          : ''
                                                }`}
                                            >
                                                <div className="auth-stepper-circle">
                                                    {index < schoolStep ? (
                                                        <Check size={12} strokeWidth={3} />
                                                    ) : (
                                                        index + 1
                                                    )}
                                                </div>
                                                <span className="auth-stepper-label">{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="auth-alert auth-alert-error">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={submit} className="auth-form">
                                {/* LOGIN FORM FIELDS */}
                                {mode === 'login' && (
                                    <>
                                        <AuthInput
                                            icon={<Mail size={18} />}
                                            label={words.email}
                                        >
                                            <input
                                                placeholder={words.emailPlaceholder}
                                                type="text"
                                                value={form.email}
                                                onChange={(e) => update('email', e.target.value)}
                                                required
                                                autoFocus
                                                autoComplete="username email"
                                                className="auth-input-control"
                                            />
                                        </AuthInput>

                                        <AuthInput
                                            icon={<LockKeyhole size={18} />}
                                            label={words.password}
                                            action={
                                                <button
                                                    type="button"
                                                    className="auth-password-toggle-btn"
                                                    aria-label={
                                                        showPassword
                                                            ? 'Hide password'
                                                            : 'Show password'
                                                    }
                                                    onClick={() =>
                                                        setShowPassword((value) => !value)
                                                    }
                                                >
                                                    {showPassword ? (
                                                        <EyeOff size={18} />
                                                    ) : (
                                                        <Eye size={18} />
                                                    )}
                                                </button>
                                            }
                                        >
                                            <input
                                                placeholder={words.passwordPlaceholder}
                                                type={showPassword ? 'text' : 'password'}
                                                value={form.password}
                                                onChange={(e) => update('password', e.target.value)}
                                                required
                                                autoComplete="current-password"
                                                className="auth-input-control"
                                            />
                                        </AuthInput>

                                        {/* Remember Me & Forgot Password Row */}
                                        <div className="auth-options-row">
                                            <label className="auth-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={form.remember}
                                                    onChange={(e) =>
                                                        update('remember', e.target.checked)
                                                    }
                                                    className="auth-checkbox"
                                                />
                                                <span className="auth-checkbox-text">
                                                    {words.remember}
                                                </span>
                                            </label>

                                            <button
                                                type="button"
                                                className="auth-link-forgot"
                                                onClick={() => {
                                                    window.location.href = '/forgot-password';
                                                }}
                                            >
                                                {locale === 'en'
                                                    ? 'Forgot password?'
                                                    : 'Mot de passe oublié ?'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* REGISTRATION & SCHOOL STEP 0: Credentials */}
                                {(mode === 'school_register' || mode === 'register') &&
                                    schoolStep === 0 && (
                                        <>
                                            <AuthInput
                                                icon={<Mail size={18} />}
                                                label={words.email}
                                            >
                                                <input
                                                    placeholder={words.emailPlaceholder}
                                                    type="email"
                                                    value={form.email}
                                                    onChange={(e) => update('email', e.target.value)}
                                                    required
                                                    autoComplete="email"
                                                    autoFocus
                                                    className="auth-input-control"
                                                />
                                            </AuthInput>

                                            <AuthInput
                                                icon={<LockKeyhole size={18} />}
                                                label={words.password}
                                                action={
                                                    <button
                                                        type="button"
                                                        className="auth-password-toggle-btn"
                                                        aria-label={
                                                            showPassword
                                                                ? 'Hide password'
                                                                : 'Show password'
                                                        }
                                                        onClick={() =>
                                                            setShowPassword((value) => !value)
                                                        }
                                                    >
                                                        {showPassword ? (
                                                            <EyeOff size={18} />
                                                        ) : (
                                                            <Eye size={18} />
                                                        )}
                                                    </button>
                                                }
                                            >
                                                <input
                                                    placeholder={words.passwordPlaceholder}
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={form.password}
                                                    onChange={(e) =>
                                                        update('password', e.target.value)
                                                    }
                                                    required
                                                    autoComplete="new-password"
                                                    className="auth-input-control"
                                                />
                                            </AuthInput>

                                            {/* Live Password Strength Checklist */}
                                            {form.password && (
                                                <div className="auth-password-checklist">
                                                    {[
                                                        [
                                                            passwordChecks.length,
                                                            locale === 'en'
                                                                ? 'At least 10 characters'
                                                                : 'Au moins 10 caractères',
                                                        ],
                                                        [
                                                            passwordChecks.upper,
                                                            locale === 'en'
                                                                ? 'Uppercase letter (A-Z)'
                                                                : 'Une majuscule',
                                                        ],
                                                        [
                                                            passwordChecks.lower,
                                                            locale === 'en'
                                                                ? 'Lowercase letter (a-z)'
                                                                : 'Une minuscule',
                                                        ],
                                                        [
                                                            passwordChecks.number,
                                                            locale === 'en'
                                                                ? 'Number (0-9)'
                                                                : 'Un chiffre',
                                                        ],
                                                        [
                                                            passwordChecks.symbol,
                                                            locale === 'en'
                                                                ? 'Special symbol (!@#$)'
                                                                : 'Un symbole',
                                                        ],
                                                    ].map(([met, text]) => (
                                                        <div
                                                            key={text as string}
                                                            className={`auth-check-item ${
                                                                met ? 'met' : ''
                                                            }`}
                                                        >
                                                            <div className="auth-check-icon">
                                                                {met ? '✓' : '•'}
                                                            </div>
                                                            <span>{text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <AuthInput
                                                icon={<LockKeyhole size={18} />}
                                                label={words.confirm}
                                            >
                                                <input
                                                    placeholder={words.confirmPlaceholder}
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={form.password_confirmation}
                                                    onChange={(e) =>
                                                        update(
                                                            'password_confirmation',
                                                            e.target.value,
                                                        )
                                                    }
                                                    required
                                                    autoComplete="new-password"
                                                    className="auth-input-control"
                                                />
                                            </AuthInput>

                                            {form.password_confirmation.length > 0 &&
                                                form.password !== form.password_confirmation && (
                                                    <div className="auth-field-error-text">
                                                        {locale === 'en'
                                                            ? 'Passwords do not match.'
                                                            : 'Les mots de passe ne correspondent pas.'}
                                                    </div>
                                                )}
                                        </>
                                    )}

                                {/* FACTORY REGISTRATION STEP 1: Owner Name */}
                                {mode === 'register' && schoolStep === 1 && (
                                    <>
                                        <AuthInput
                                            icon={<UserRound size={18} />}
                                            label={words.name}
                                        >
                                            <input
                                                placeholder={words.namePlaceholder}
                                                value={form.name}
                                                onChange={(e) => update('name', e.target.value)}
                                                required
                                                autoComplete="name"
                                                autoFocus
                                                className="auth-input-control"
                                            />
                                        </AuthInput>
                                    </>
                                )}

                                {/* FACTORY REGISTRATION STEP 2: Factory Details & Industries */}
                                {mode === 'register' && schoolStep === 2 && (
                                    <>
                                        <AuthInput
                                            icon={<Building2 size={18} />}
                                            label={words.factory}
                                        >
                                            <input
                                                placeholder={words.factoryPlaceholder}
                                                value={form.factory_name}
                                                onChange={(e) =>
                                                    update('factory_name', e.target.value)
                                                }
                                                required
                                                autoFocus
                                                className="auth-input-control"
                                            />
                                        </AuthInput>

                                        <div className="auth-field">
                                            <span className="auth-field-label">
                                                {words.industry}
                                            </span>
                                            <div className="auth-input-wrapper">
                                                <span className="auth-input-icon">
                                                    <Factory size={18} />
                                                </span>
                                                <select
                                                    aria-label={words.industry}
                                                    value={form.industry_type}
                                                    onChange={(e) =>
                                                        update('industry_type', e.target.value)
                                                    }
                                                    className="auth-input-control auth-select"
                                                >
                                                    {INDUSTRY_OPTIONS.map(([key, en, fr]) => (
                                                        <option key={key} value={key}>
                                                            {locale === 'en' ? en : fr}
                                                        </option>
                                                    ))}
                                                    <option value="other">
                                                        {locale === 'en'
                                                            ? 'Other type of factory'
                                                            : "Autre type d'usine"}
                                                    </option>
                                                </select>
                                                <div className="auth-input-action pointer-events-none">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Industry Profile Chips */}
                                        <div className="auth-field">
                                            <span className="auth-field-label">
                                                {locale === 'en'
                                                    ? 'Also produces (optional additional profiles)'
                                                    : 'Fabrique aussi (profils complémentaires)'}
                                            </span>
                                            <div
                                                className="auth-chips-group"
                                                role="group"
                                                aria-label={
                                                    locale === 'en'
                                                        ? 'Other industries'
                                                        : 'Autres secteurs'
                                                }
                                            >
                                                {INDUSTRY_OPTIONS.filter(
                                                    ([key]) => key !== form.industry_type,
                                                ).map(([key, en, fr]) => (
                                                    <button
                                                        type="button"
                                                        key={key}
                                                        aria-pressed={form.industry_profiles.includes(
                                                            key,
                                                        )}
                                                        className={`auth-chip ${
                                                            form.industry_profiles.includes(key)
                                                                ? 'selected'
                                                                : ''
                                                        }`}
                                                        onClick={() =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                industry_profiles:
                                                                    current.industry_profiles.includes(
                                                                        key,
                                                                    )
                                                                        ? current.industry_profiles.filter(
                                                                              (value) =>
                                                                                  value !== key,
                                                                          )
                                                                        : [
                                                                              ...current.industry_profiles,
                                                                              key,
                                                                          ],
                                                            }))
                                                        }
                                                    >
                                                        {locale === 'en' ? en : fr}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {form.industry_type === 'other' && (
                                            <AuthInput
                                                icon={<Factory size={18} />}
                                                label={words.specifyIndustry}
                                            >
                                                <input
                                                    placeholder={words.industryPlaceholder}
                                                    value={form.industry_other}
                                                    onChange={(e) =>
                                                        update('industry_other', e.target.value)
                                                    }
                                                    required
                                                    maxLength={80}
                                                    className="auth-input-control"
                                                />
                                            </AuthInput>
                                        )}
                                    </>
                                )}

                                {/* SCHOOL REGISTRATION STEP 1: Head Teacher & Phone */}
                                {mode === 'school_register' && schoolStep === 1 && (
                                    <>
                                        <AuthInput
                                            icon={<UserRound size={18} />}
                                            label={
                                                locale === 'en'
                                                    ? 'Head teacher name'
                                                    : 'Nom du directeur/trice'
                                            }
                                        >
                                            <input
                                                placeholder={words.namePlaceholder}
                                                value={form.name}
                                                onChange={(e) => update('name', e.target.value)}
                                                required
                                                autoComplete="name"
                                                autoFocus
                                                className="auth-input-control"
                                            />
                                        </AuthInput>

                                        <AuthInput
                                            icon={<Phone size={18} />}
                                            label={
                                                locale === 'en'
                                                    ? 'Official phone number'
                                                    : 'Numéro de téléphone'
                                            }
                                        >
                                            <input
                                                type="tel"
                                                placeholder="0780 000 000"
                                                value={form.phone}
                                                onChange={(e) => update('phone', e.target.value)}
                                                required
                                                className="auth-input-control"
                                            />
                                        </AuthInput>
                                    </>
                                )}

                                {/* SCHOOL REGISTRATION STEP 2: School Name, District & Sector */}
                                {mode === 'school_register' && schoolStep === 2 && (
                                    <>
                                        <AuthInput
                                            icon={<Building2 size={18} />}
                                            label={words.factory}
                                        >
                                            <input
                                                placeholder={words.factoryPlaceholder}
                                                value={form.factory_name}
                                                onChange={(e) =>
                                                    update('factory_name', e.target.value)
                                                }
                                                required
                                                autoFocus
                                                className="auth-input-control"
                                            />
                                        </AuthInput>

                                        <div className="auth-field">
                                            <span className="auth-field-label">
                                                {words.industry} (District)
                                            </span>
                                            <div className="auth-input-wrapper">
                                                <span className="auth-input-icon">
                                                    <MapPin size={18} />
                                                </span>
                                                <select
                                                    aria-label={words.industry}
                                                    value={form.district}
                                                    onChange={(e) =>
                                                        setForm((current) => ({
                                                            ...current,
                                                            district: e.target.value,
                                                            sector: '',
                                                        }))
                                                    }
                                                    required
                                                    className="auth-input-control auth-select"
                                                >
                                                    <option value="">
                                                        {locale === 'en'
                                                            ? 'Choose a district'
                                                            : 'Choisissez un district'}
                                                    </option>
                                                    {Object.keys(schoolOptions.locations).map(
                                                        (district) => (
                                                            <option key={district} value={district}>
                                                                {district}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                                <div className="auth-input-action pointer-events-none">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="auth-field">
                                            <span className="auth-field-label">
                                                {words.specifyIndustry} (Sector)
                                            </span>
                                            <div className="auth-input-wrapper">
                                                <span className="auth-input-icon">
                                                    <MapPin size={18} />
                                                </span>
                                                <select
                                                    aria-label={words.specifyIndustry}
                                                    value={form.sector}
                                                    onChange={(e) =>
                                                        update('sector', e.target.value)
                                                    }
                                                    required
                                                    disabled={!form.district}
                                                    className="auth-input-control auth-select"
                                                >
                                                    <option value="">
                                                        {locale === 'en'
                                                            ? 'Choose a sector'
                                                            : 'Choisissez un secteur'}
                                                    </option>
                                                    {(
                                                        schoolOptions.locations[form.district] || []
                                                    ).map((sector) => (
                                                        <option key={sector} value={sector}>
                                                            {sector}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="auth-input-action pointer-events-none">
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* IN-CARD FORGOT PASSWORD */}
                                {mode === 'forgot' && !forgotSuccess && (
                                    <>
                                        <AuthInput
                                            icon={<Mail size={18} />}
                                            label={
                                                locale === 'en'
                                                    ? 'Your registered email address'
                                                    : 'Votre adresse e-mail'
                                            }
                                        >
                                            <input
                                                placeholder="owner@company.com"
                                                type="email"
                                                value={form.email}
                                                onChange={(e) => update('email', e.target.value)}
                                                required
                                                autoFocus
                                                autoComplete="email"
                                                className="auth-input-control"
                                            />
                                        </AuthInput>
                                    </>
                                )}

                                {mode === 'forgot' && forgotSuccess && (
                                    <div className="auth-alert auth-alert-success">
                                        <div className="flex gap-2.5">
                                            <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="block font-semibold text-emerald-900 mb-1">
                                                    {locale === 'en'
                                                        ? 'Check your inbox'
                                                        : 'Vérifiez votre boîte de réception'}
                                                </strong>
                                                <p className="text-emerald-800 text-sm leading-relaxed">
                                                    {locale === 'en'
                                                        ? "If an account exists for that email, we've sent a reset link from support@icyerekezooms.com."
                                                        : 'Si un compte existe pour cet e-mail, nous avons envoyé un lien depuis support@icyerekezooms.com.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ACTION BUTTONS */}
                                {(mode === 'school_register' || mode === 'register') ? (
                                    <div className="auth-actions-group">
                                        {schoolStep > 0 && (
                                            <button
                                                type="button"
                                                className="auth-btn-secondary"
                                                onClick={() =>
                                                    setSchoolStep((current) => current - 1)
                                                }
                                                disabled={busy}
                                            >
                                                <ArrowLeft size={16} />
                                                <span>{locale === 'en' ? 'Back' : 'Retour'}</span>
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            className="auth-btn-primary flex-1"
                                            disabled={busy || !schoolStepValid}
                                        >
                                            <span>
                                                {busy
                                                    ? locale === 'en'
                                                        ? 'Please wait...'
                                                        : 'Patientez...'
                                                    : schoolStep < 2
                                                      ? locale === 'en'
                                                          ? 'Continue'
                                                          : 'Continuer'
                                                      : words.action}
                                            </span>
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    mode !== 'forgot' && (
                                        <button
                                            type="submit"
                                            className="auth-btn-primary"
                                            disabled={busy}
                                        >
                                            <span>
                                                {busy
                                                    ? locale === 'en'
                                                        ? 'Signing in...'
                                                        : 'Connexion...'
                                                    : words.action}
                                            </span>
                                            <ChevronRight size={18} />
                                        </button>
                                    )
                                )}

                                {mode === 'forgot' && !forgotSuccess && (
                                    <button
                                        type="submit"
                                        className="auth-btn-primary"
                                        disabled={busy}
                                    >
                                        <span>
                                            {busy
                                                ? locale === 'en'
                                                    ? 'Sending link...'
                                                    : 'Envoi en cours...'
                                                : locale === 'en'
                                                  ? 'Send reset link'
                                                  : 'Envoyer le lien'}
                                        </span>
                                        <ChevronRight size={18} />
                                    </button>
                                )}

                                {/* SWITCH MODES LINK */}
                                <div className="auth-footer-switch">
                                    {mode === 'forgot' ? (
                                        <button
                                            type="button"
                                            className="auth-link-btn font-medium"
                                            onClick={() => {
                                                setMode('login');
                                                setError('');
                                                setForgotSuccess(false);
                                            }}
                                        >
                                            <ArrowLeft size={14} />
                                            <span>
                                                {locale === 'en'
                                                    ? 'Back to sign in'
                                                    : 'Retour à la connexion'}
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="auth-switch-text-row">
                                            <span className="text-slate-500 text-sm">
                                                {words.switchText}
                                            </span>
                                            <button
                                                type="button"
                                                className="auth-link-action"
                                                onClick={() => {
                                                    const next =
                                                        mode === 'login'
                                                            ? schoolAuth
                                                                ? 'school_register'
                                                                : 'register'
                                                            : 'login';
                                                    setMode(next);
                                                    if (schoolAuth)
                                                        window.history.pushState(
                                                            {},
                                                            '',
                                                            next === 'login'
                                                                ? '/school/login'
                                                                : '/school/signup',
                                                        );
                                                    setError('');
                                                }}
                                            >
                                                {words.switchAction}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </form>

                            {/* Trust & Encrypted Badge */}
                            <div className="auth-assurance-badge">
                                <Shield size={13} className="text-blue-600" />
                                <span>
                                    {locale === 'en'
                                        ? 'End-to-end encrypted & tenant isolated connection'
                                        : 'Connexion chiffrée de bout en bout et isolée'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Bottom Copyright */}
                    <div className="auth-bottom-copyright">
                        <span>© 2026 ICYEREKEZO OMS. All rights reserved.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
