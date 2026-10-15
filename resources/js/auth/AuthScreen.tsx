import React, { useEffect, useState } from 'react';
import {
    Activity,
    Building2,
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    Factory,
    Languages,
    LockKeyhole,
    Mail,
    PackageCheck,
    Send,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { api } from '../core/api';
import { type AuthUser, type Locale } from '../core/types';
import { Logo } from '../app/Logo';
import { AuthInput } from './AuthInput';

export const INDUSTRY_OPTIONS: [key: string, en: string, fr: string][] = [
    ['general_manufacturing', 'General manufacturing', 'Fabrication generale'],
    ['clothing_textiles', 'Clothing and textiles', 'Vetements et textiles'],
    ['food_processing', 'Food processing', 'Transformation alimentaire'],
    ['beverages', 'Beverages and drinks', 'Boissons'],
    ['dairy', 'Milk and dairy products', 'Lait et produits laitiers'],
    [
        'pharmaceuticals_medicines',
        'Medicines and pharmaceuticals',
        'Medicaments et produits pharmaceutiques',
    ],
    ['plastics_rubber', 'Plastics and rubber materials', 'Matieres plastiques et caoutchouc'],
    ['steel_metals', 'Steel and metal products', 'Acier et produits metalliques'],
    [
        'grain_flour_milling',
        'Maize, grain and flour milling',
        'Mouture de mais, cereales et farine',
    ],
    [
        'agriculture_animal_feed',
        'Agriculture and animal feed',
        'Agriculture et alimentation animale',
    ],
    [
        'construction_materials',
        'Construction materials, cement and bricks',
        'Materiaux de construction, ciment et briques',
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
        'Produits chimiques, cosmetiques et savon',
    ],
    [
        'electronics_electrical',
        'Electronics and electrical products',
        'Produits electroniques et electriques',
    ],
    ['automotive_machinery', 'Automotive parts and machinery', 'Pieces automobiles et machines'],
    ['recycling_waste', 'Recycling and waste processing', 'Recyclage et traitement des dechets'],
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
                                    ? 'Sign in to place and follow your school orders.'
                                    : '',
                            name: 'Administrator name',
                            factory: 'School name',
                            industry: 'District',
                            specifyIndustry: 'Sector',
                            email: mode === 'login' ? 'Email or Username' : 'Email address',
                            password: mode === 'login' ? 'Password' : 'Create password',
                            confirm: 'Confirm password',
                            remember: 'Keep me signed in',
                            namePlaceholder: 'Enter the administrator name',
                            factoryPlaceholder: 'Enter the school name',
                            industryPlaceholder: 'Choose a sector',
                            emailPlaceholder:
                                mode === 'login'
                                    ? 'admin@school.rw or username'
                                    : 'admin@school.rw',
                            passwordPlaceholder: 'Enter your password',
                            confirmPlaceholder: 'Enter the password again',
                            action: mode === 'login' ? 'Sign in' : 'Create account',
                            switchText:
                                mode === 'login'
                                    ? 'Need a school account?'
                                    : 'Already have a school account?',
                            switchAction: mode === 'login' ? 'Sign up' : 'Sign in',
                        }
                      : {
                            title:
                                mode === 'login' ? 'Welcome back' : 'Create your factory workspace',
                            subtitle:
                                mode === 'login'
                                    ? 'Sign in to manage your operations.'
                                    : 'Register the factory owner and set up your factory.',
                            name: 'Factory owner name',
                            factory: 'Factory name',
                            industry: 'Industry type',
                            specifyIndustry: 'Specify the industry',
                            email: mode === 'login' ? 'Email or Username' : 'Email address',
                            password: 'Create password',
                            confirm: 'Confirm password',
                            remember: 'Keep me signed in',
                            namePlaceholder: "Enter the owner's full name",
                            factoryPlaceholder: 'Enter the factory name',
                            industryPlaceholder: 'Describe the type of factory',
                            emailPlaceholder:
                                mode === 'login'
                                    ? 'owner@company.com or username'
                                    : 'owner@company.com',
                            passwordPlaceholder: 'Create a strong password',
                            confirmPlaceholder: 'Enter the password again',
                            action: mode === 'login' ? 'Sign in' : 'Create Account',
                            switchText:
                                mode === 'login'
                                    ? 'New to ICYEREKEZO?'
                                    : 'Already have an account?',
                            switchAction: mode === 'login' ? 'Create account' : 'Sign in',
                        }),
              }
            : {
                  ...(schoolAuth
                      ? {
                            title:
                                mode === 'login'
                                    ? 'Connexion administrateur scolaire'
                                    : 'Creer le compte de votre ecole',
                            subtitle:
                                mode === 'login'
                                    ? 'Connectez-vous pour passer et suivre les commandes de votre ecole.'
                                    : '',
                            name: "Nom de l'administrateur",
                            factory: "Nom de l'ecole",
                            industry: 'District',
                            specifyIndustry: 'Secteur',
                            email:
                                mode === 'login' ? "E-mail ou nom d'utilisateur" : 'Adresse e-mail',
                            password: mode === 'login' ? 'Mot de passe' : 'Creer un mot de passe',
                            confirm: 'Confirmer le mot de passe',
                            remember: 'Rester connecte',
                            namePlaceholder: "Saisissez le nom de l'administrateur",
                            factoryPlaceholder: "Saisissez le nom de l'ecole",
                            industryPlaceholder: 'Choisissez un secteur',
                            emailPlaceholder:
                                mode === 'login'
                                    ? "admin@ecole.rw ou nom d'utilisateur"
                                    : 'admin@ecole.rw',
                            passwordPlaceholder: 'Saisissez votre mot de passe',
                            confirmPlaceholder: 'Saisissez encore le mot de passe',
                            action: mode === 'login' ? 'Se connecter' : 'Creer le compte',
                            switchText:
                                mode === 'login'
                                    ? "Besoin d'un compte scolaire ?"
                                    : 'Vous avez deja un compte scolaire ?',
                            switchAction: mode === 'login' ? "S'inscrire" : 'Se connecter',
                        }
                      : {
                            title: mode === 'login' ? 'Bon retour' : 'Creez votre espace usine',
                            subtitle:
                                mode === 'login'
                                    ? 'Connectez-vous pour gerer vos operations.'
                                    : 'Demarrez votre espace ICYEREKEZO OMS securise.',
                            name: 'Nom complet',
                            factory: "Nom de l'usine",
                            industry: "Type d'industrie",
                            specifyIndustry: "Precisez le type d'industrie",
                            email:
                                mode === 'login' ? "E-mail ou nom d'utilisateur" : 'Adresse e-mail',
                            password: 'Mot de passe',
                            confirm: 'Confirmer le mot de passe',
                            remember: 'Rester connecte',
                            namePlaceholder: 'Saisissez votre nom complet',
                            factoryPlaceholder: "Saisissez le nom de l'usine",
                            industryPlaceholder: "Decrivez le type d'usine",
                            emailPlaceholder:
                                mode === 'login'
                                    ? "nom@entreprise.com ou nom d'utilisateur"
                                    : 'nom@entreprise.com',
                            passwordPlaceholder: 'Saisissez votre mot de passe',
                            confirmPlaceholder: 'Saisissez encore le mot de passe',
                            action: mode === 'login' ? 'Se connecter' : 'Creer le compte',
                            switchText:
                                mode === 'login'
                                    ? 'Nouveau sur ICYEREKEZO ?'
                                    : 'Vous avez deja un compte ?',
                            switchAction: mode === 'login' ? 'Creer un espace' : 'Se connecter',
                        }),
              };

    return (
        <main className={`auth-page${schoolAuth ? ' school-auth-page' : ''}`}>
            <section className="auth-story">
                <div className="auth-orb auth-orb-one"></div>
                <div className="auth-orb auth-orb-two"></div>
                <Logo />
                <div className="auth-story-copy">
                    <span className="auth-kicker">
                        <ShieldCheck size={16} /> Secure factory operations
                    </span>
                    <h1>
                        Every factory move,
                        <br />
                        <em>clearly connected.</em>
                    </h1>
                    <p>
                        Run production, stock, quality and delivery from one calm, real-time
                        workspace.
                    </p>
                    <div className="auth-points">
                        <span>
                            <i>
                                <PackageCheck />
                            </i>
                            <b>
                                Full traceability
                                <small>Follow every batch</small>
                            </b>
                        </span>
                        <span>
                            <i>
                                <Activity />
                            </i>
                            <b>
                                Live operations
                                <small>See work as it happens</small>
                            </b>
                        </span>
                        <span>
                            <i>
                                <ShieldCheck />
                            </i>
                            <b>
                                Protected data
                                <small>Access by responsibility</small>
                            </b>
                        </span>
                    </div>
                </div>
                <div className="auth-story-foot">
                    <span className="auth-live-dot"></span>
                    <p>Operations platform online</p>
                    <small>ICYEREKEZO means direction.</small>
                </div>
            </section>
            <section className="auth-form-side">
                <div className="auth-topbar">
                    <div className="auth-mobile-logo">
                        <Logo />
                    </div>
                    <button
                        type="button"
                        className="auth-language"
                        onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}
                    >
                        <Languages size={18} />
                        {locale === 'en' ? 'Francais' : 'English'}
                    </button>
                </div>
                {pendingOtpEmail ? (
                    <form className="auth-card" onSubmit={verifyOtp}>
                        <div className="auth-heading">
                            <span>
                                {locale === 'en' ? 'CHECK YOUR EMAIL' : 'VÉRIFIEZ VOS E-MAILS'}
                            </span>
                            <h2>{locale === 'en' ? 'Enter your code' : 'Saisissez le code'}</h2>
                            <p>
                                {locale === 'en'
                                    ? `We sent a 4-digit code to ${pendingOtpEmail}.`
                                    : `Nous avons envoyé un code à 4 chiffres à ${pendingOtpEmail}.`}
                            </p>
                        </div>
                        {error && <div className="form-error">{error}</div>}
                        <AuthInput
                            icon={<ShieldCheck />}
                            label={locale === 'en' ? 'Verification code' : 'Code de vérification'}
                        >
                            <input
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={4}
                                placeholder="0000"
                                value={otpCode}
                                onChange={(e) =>
                                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                                }
                                autoFocus
                                required
                                style={{
                                    letterSpacing: '0.5em',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                }}
                            />
                        </AuthInput>
                        <button className="auth-submit" disabled={busy || otpCode.length !== 4}>
                            <span>
                                {busy
                                    ? locale === 'en'
                                        ? 'Verifying...'
                                        : 'Vérification...'
                                    : locale === 'en'
                                      ? 'Verify and continue'
                                      : 'Vérifier et continuer'}
                            </span>
                            <i>
                                <ChevronRight size={18} />
                            </i>
                        </button>
                        <div className="auth-switch">
                            <span>
                                {locale === 'en' ? "Didn't get a code?" : "Vous n'avez rien reçu ?"}
                            </span>
                            <button
                                type="button"
                                onClick={resendOtp}
                                disabled={resendCooldown > 0 || busy}
                            >
                                {resendCooldown > 0
                                    ? locale === 'en'
                                        ? `Resend in ${resendCooldown}s`
                                        : `Renvoyer dans ${resendCooldown}s`
                                    : locale === 'en'
                                      ? 'Resend code'
                                      : 'Renvoyer le code'}
                            </button>
                        </div>
                        <div className="auth-switch">
                            <button
                                type="button"
                                onClick={() => {
                                    setPendingOtpEmail('');
                                    setOtpCode('');
                                    setError('');
                                }}
                            >
                                {locale === 'en'
                                    ? '← Use a different email'
                                    : '← Utiliser un autre e-mail'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form className="auth-card" onSubmit={submit}>
                        <div className="auth-heading">
                            <h2>
                                {mode === 'forgot'
                                    ? locale === 'en'
                                        ? 'Reset your password'
                                        : 'Réinitialiser le mot de passe'
                                    : words.title}
                            </h2>
                            {(mode === 'forgot' || words.subtitle) && (
                                <p style={{ whiteSpace: 'normal' }}>
                                    {mode === 'forgot'
                                        ? locale === 'en'
                                            ? "Enter your email and we'll send a reset link."
                                            : 'Entrez votre e-mail pour recevoir un lien.'
                                        : words.subtitle}
                                </p>
                            )}
                            {(mode === 'school_register' || mode === 'register') && (
                                <div
                                    className="auth-steps"
                                    role="list"
                                    aria-label={
                                        locale === 'en' ? 'Signup steps' : "Étapes d'inscription"
                                    }
                                >
                                    {[
                                        locale === 'en' ? 'Account' : 'Compte',
                                        mode === 'school_register'
                                            ? locale === 'en'
                                                ? 'Head teacher'
                                                : 'Directeur/trice'
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
                                            role="listitem"
                                            className={
                                                'auth-step' +
                                                (index === schoolStep
                                                    ? ' active'
                                                    : index < schoolStep
                                                      ? ' done'
                                                      : '')
                                            }
                                        >
                                            <span>{index < schoolStep ? '✓' : index + 1}</span>
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {error && <div className="form-error">{error}</div>}

                        {mode === 'register' && schoolStep === 1 && (
                            <>
                                <AuthInput icon={<UserRound />} label={words.name}>
                                    <input
                                        placeholder={words.namePlaceholder}
                                        value={form.name}
                                        onChange={(e) => update('name', e.target.value)}
                                        required
                                        autoComplete="name"
                                        autoFocus
                                    />
                                </AuthInput>
                            </>
                        )}
                        {mode === 'register' && schoolStep === 2 && (
                            <>
                                <AuthInput icon={<Building2 />} label={words.factory}>
                                    <input
                                        placeholder={words.factoryPlaceholder}
                                        value={form.factory_name}
                                        onChange={(e) => update('factory_name', e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </AuthInput>
                                {
                                    <label className="auth-field auth-select-field">
                                        <span>{words.industry}</span>
                                        <div>
                                            <Factory />
                                            <select
                                                aria-label={words.industry}
                                                value={form.industry_type}
                                                onChange={(e) =>
                                                    update('industry_type', e.target.value)
                                                }
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
                                            <ChevronDown />
                                        </div>
                                    </label>
                                }
                                <div className="auth-field">
                                    <span>
                                        {locale === 'en'
                                            ? 'Also makes (optional)'
                                            : 'Fabrique aussi (facultatif)'}
                                    </span>
                                    <div
                                        className="industry-chips"
                                        role="group"
                                        aria-label={
                                            locale === 'en' ? 'Other industries' : 'Autres secteurs'
                                        }
                                    >
                                        {INDUSTRY_OPTIONS.filter(
                                            ([key]) => key !== form.industry_type,
                                        ).map(([key, en, fr]) => (
                                            <button
                                                type="button"
                                                key={key}
                                                aria-pressed={form.industry_profiles.includes(key)}
                                                className={
                                                    form.industry_profiles.includes(key)
                                                        ? 'selected'
                                                        : ''
                                                }
                                                onClick={() =>
                                                    setForm((current) => ({
                                                        ...current,
                                                        industry_profiles:
                                                            current.industry_profiles.includes(key)
                                                                ? current.industry_profiles.filter(
                                                                      (value) => value !== key,
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
                                {mode === 'register' && form.industry_type === 'other' && (
                                    <AuthInput icon={<Factory />} label={words.specifyIndustry}>
                                        <input
                                            placeholder={words.industryPlaceholder}
                                            value={form.industry_other}
                                            onChange={(e) =>
                                                update('industry_other', e.target.value)
                                            }
                                            required
                                            maxLength={80}
                                        />
                                    </AuthInput>
                                )}
                            </>
                        )}
                        {(mode === 'school_register' || mode === 'register') &&
                            schoolStep === 0 && (
                                <>
                                    <AuthInput icon={<Mail />} label={words.email}>
                                        <input
                                            placeholder={words.emailPlaceholder}
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => update('email', e.target.value)}
                                            required
                                            autoComplete="email"
                                            autoFocus
                                        />
                                    </AuthInput>
                                    <AuthInput
                                        icon={<LockKeyhole />}
                                        label={words.password}
                                        action={
                                            <button
                                                type="button"
                                                className="password-toggle"
                                                aria-label={
                                                    showPassword ? 'Hide password' : 'Show password'
                                                }
                                                onClick={() => setShowPassword((value) => !value)}
                                            >
                                                {showPassword ? <EyeOff /> : <Eye />}
                                            </button>
                                        }
                                    >
                                        <input
                                            placeholder={words.passwordPlaceholder}
                                            type={showPassword ? 'text' : 'password'}
                                            value={form.password}
                                            onChange={(e) => update('password', e.target.value)}
                                            required
                                            autoComplete="new-password"
                                        />
                                    </AuthInput>
                                    {form.password && (
                                        <ul className="password-strength">
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
                                                        ? 'An uppercase letter'
                                                        : 'Une majuscule',
                                                ],
                                                [
                                                    passwordChecks.lower,
                                                    locale === 'en'
                                                        ? 'A lowercase letter'
                                                        : 'Une minuscule',
                                                ],
                                                [
                                                    passwordChecks.number,
                                                    locale === 'en' ? 'A number' : 'Un chiffre',
                                                ],
                                                [
                                                    passwordChecks.symbol,
                                                    locale === 'en' ? 'A symbol' : 'Un symbole',
                                                ],
                                            ].map(([met, text]) => (
                                                <li
                                                    key={text as string}
                                                    className={met ? 'met' : ''}
                                                >
                                                    {met ? '✓' : '•'} {text}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <AuthInput icon={<LockKeyhole />} label={words.confirm}>
                                        <input
                                            placeholder={words.confirmPlaceholder}
                                            type={showPassword ? 'text' : 'password'}
                                            value={form.password_confirmation}
                                            onChange={(e) =>
                                                update('password_confirmation', e.target.value)
                                            }
                                            required
                                            autoComplete="new-password"
                                        />
                                    </AuthInput>
                                    {form.password_confirmation.length > 0 &&
                                        form.password !== form.password_confirmation && (
                                            <div className="form-error">
                                                {locale === 'en'
                                                    ? 'Passwords do not match.'
                                                    : 'Les mots de passe ne correspondent pas.'}
                                            </div>
                                        )}
                                </>
                            )}
                        {mode === 'school_register' && schoolStep === 1 && (
                            <>
                                <AuthInput
                                    icon={<UserRound />}
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
                                    />
                                </AuthInput>
                                <AuthInput
                                    icon={<UserRound />}
                                    label={locale === 'en' ? 'Phone number' : 'Numero de telephone'}
                                >
                                    <input
                                        type="tel"
                                        placeholder="0780 000 000"
                                        value={form.phone}
                                        onChange={(e) => update('phone', e.target.value)}
                                        required
                                    />
                                </AuthInput>
                            </>
                        )}
                        {mode === 'school_register' && schoolStep === 2 && (
                            <>
                                <AuthInput icon={<Building2 />} label={words.factory}>
                                    <input
                                        placeholder={words.factoryPlaceholder}
                                        value={form.factory_name}
                                        onChange={(e) => update('factory_name', e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </AuthInput>
                                <AuthInput icon={<Building2 />} label={words.industry}>
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
                                    >
                                        <option value="">
                                            {locale === 'en'
                                                ? 'Choose a district'
                                                : 'Choisissez un district'}
                                        </option>
                                        {Object.keys(schoolOptions.locations).map((district) => (
                                            <option key={district} value={district}>
                                                {district}
                                            </option>
                                        ))}
                                    </select>
                                </AuthInput>
                                <AuthInput icon={<Building2 />} label={words.specifyIndustry}>
                                    <select
                                        aria-label={words.specifyIndustry}
                                        value={form.sector}
                                        onChange={(e) => update('sector', e.target.value)}
                                        required
                                        disabled={!form.district}
                                    >
                                        <option value="">
                                            {locale === 'en'
                                                ? 'Choose a sector'
                                                : 'Choisissez un secteur'}
                                        </option>
                                        {(schoolOptions.locations[form.district] || []).map(
                                            (sector) => (
                                                <option key={sector} value={sector}>
                                                    {sector}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </AuthInput>
                            </>
                        )}
                        {mode === 'login' && (
                            <>
                                <AuthInput icon={<Mail />} label={words.email}>
                                    <input
                                        placeholder={words.emailPlaceholder}
                                        type={mode === 'login' ? 'text' : 'email'}
                                        value={form.email}
                                        onChange={(e) => update('email', e.target.value)}
                                        required
                                        autoComplete={mode === 'login' ? 'username' : 'email'}
                                    />
                                </AuthInput>
                                <AuthInput
                                    icon={<LockKeyhole />}
                                    label={words.password}
                                    action={
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            aria-label={
                                                showPassword ? 'Hide password' : 'Show password'
                                            }
                                            onClick={() => setShowPassword((value) => !value)}
                                        >
                                            {showPassword ? <EyeOff /> : <Eye />}
                                        </button>
                                    }
                                >
                                    <input
                                        placeholder={words.passwordPlaceholder}
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={(e) => update('password', e.target.value)}
                                        required
                                        autoComplete={
                                            mode === 'login' ? 'current-password' : 'new-password'
                                        }
                                    />
                                </AuthInput>
                            </>
                        )}
                        {mode === 'login' && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '20px',
                                }}
                            >
                                <label className="check-row" style={{ margin: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={form.remember}
                                        onChange={(e) => update('remember', e.target.checked)}
                                    />
                                    <span>{words.remember}</span>
                                </label>
                                <button
                                    type="button"
                                    style={{
                                        padding: 0,
                                        background: 'none',
                                        border: 'none',
                                        color: '#2563eb',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                        window.location.href = '/forgot-password';
                                    }}
                                >
                                    {locale === 'en' ? 'Forgot password?' : 'Mot de passe oublié ?'}
                                </button>
                            </div>
                        )}
                        {mode === 'forgot' && !forgotSuccess && (
                            <>
                                <AuthInput
                                    icon={<Mail />}
                                    label={
                                        locale === 'en'
                                            ? 'Your email address'
                                            : 'Votre adresse e-mail'
                                    }
                                >
                                    <input
                                        placeholder="owner@company.com"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => update('email', e.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </AuthInput>
                                <button className="auth-submit" disabled={busy}>
                                    <span>
                                        {busy
                                            ? locale === 'en'
                                                ? 'Sending...'
                                                : 'Envoi...'
                                            : locale === 'en'
                                              ? 'Send reset link'
                                              : 'Envoyer le lien'}
                                    </span>
                                </button>
                            </>
                        )}
                        {mode === 'forgot' && forgotSuccess && (
                            <div
                                style={{
                                    padding: '16px',
                                    borderRadius: '14px',
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    color: '#166534',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                }}
                            >
                                <strong style={{ display: 'block', marginBottom: '4px' }}>
                                    {locale === 'en'
                                        ? 'Check your inbox'
                                        : 'Vérifiez votre boîte mail'}
                                </strong>
                                {locale === 'en'
                                    ? "If an account exists for that email, we've sent a reset link from support@icyerekezooms.com. It can take a few minutes to arrive — check your spam or junk folder if you don't see it."
                                    : 'Si un compte existe pour cet email, nous avons envoyé un lien depuis support@icyerekezooms.com. Cela peut prendre quelques minutes — vérifiez votre dossier spam si vous ne le voyez pas.'}
                            </div>
                        )}
                        {mode === 'school_register' || mode === 'register' ? (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {schoolStep > 0 && (
                                    <button
                                        type="button"
                                        className="auth-submit"
                                        style={{
                                            background: 'transparent',
                                            color: 'var(--auth-blue, #225eea)',
                                            border: '1px solid #dce4f2',
                                            boxShadow: 'none',
                                        }}
                                        onClick={() => setSchoolStep((current) => current - 1)}
                                        disabled={busy}
                                    >
                                        <span>{locale === 'en' ? 'Back' : 'Retour'}</span>
                                    </button>
                                )}
                                <button className="auth-submit" disabled={busy || !schoolStepValid}>
                                    <span>
                                        {busy
                                            ? locale === 'en'
                                                ? 'Please wait...'
                                                : 'Veuillez patienter...'
                                            : schoolStep < 2
                                              ? locale === 'en'
                                                  ? 'Continue'
                                                  : 'Continuer'
                                              : words.action}
                                    </span>
                                </button>
                            </div>
                        ) : (
                            mode !== 'forgot' && (
                                <button className="auth-submit" disabled={busy}>
                                    <span>
                                        {busy
                                            ? locale === 'en'
                                                ? 'Please wait...'
                                                : 'Veuillez patienter...'
                                            : words.action}
                                    </span>
                                </button>
                            )
                        )}
                        <div className="auth-switch">
                            {mode === 'forgot' ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode('login');
                                        setError('');
                                        setForgotSuccess(false);
                                    }}
                                >
                                    {locale === 'en'
                                        ? '← Back to sign in'
                                        : '← Retour à la connexion'}
                                </button>
                            ) : (
                                <>
                                    <span>{words.switchText}</span>
                                    <button
                                        type="button"
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
                                </>
                            )}
                        </div>
                        <p className="auth-assurance">
                            <ShieldCheck /> Your connection is encrypted and protected.
                        </p>
                    </form>
                )}
            </section>
        </main>
    );
}
