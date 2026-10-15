import React, { useState } from 'react';
import { ChevronRight, Eye, EyeOff, Languages, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { api } from '../core/api';
import { type Locale } from '../core/types';
import { Logo } from '../app/Logo';
import { AuthInput } from './AuthInput';

export function ResetPasswordPage() {
    const token = window.location.pathname.split('/reset-password/')[1] ?? '';
    const params = new URLSearchParams(window.location.search);
    const emailFromUrl = params.get('email') ?? '';

    const [locale, setLocale] = useState<Locale>('en');
    const [email, setEmail] = useState(emailFromUrl);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setError(
                locale === 'en'
                    ? 'Passwords do not match.'
                    : 'Les mots de passe ne correspondent pas.',
            );
            return;
        }
        if (password.length < 10) {
            setError(
                locale === 'en'
                    ? 'Password must be at least 10 characters.'
                    : 'Le mot de passe doit comporter au moins 10 caractères.',
            );
            return;
        }
        setBusy(true);
        setError('');
        try {
            await api('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, email, password, password_confirmation: confirm }),
            });
            setDone(true);
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        } catch (reason: any) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Reset failed. The link may have expired.',
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <main
            className="auth-page"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100svh',
                background: '#fff',
            }}
        >
            <section
                className="auth-form-side"
                style={{ width: 'min(100%, 480px)', padding: '48px 32px', background: '#fff' }}
            >
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
                <form
                    className="auth-card"
                    onSubmit={submit}
                    style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}
                >
                    <div className="auth-heading">
                        <h2 style={{ fontSize: 'clamp(28px,3vw,38px)' }}>
                            {locale === 'en'
                                ? 'Set a new password'
                                : 'Définir un nouveau mot de passe'}
                        </h2>
                        <p style={{ whiteSpace: 'nowrap' }}>
                            {locale === 'en'
                                ? 'Choose a strong password for your account.'
                                : 'Choisissez un mot de passe sécurisé.'}
                        </p>
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    {done ? (
                        <div
                            style={{
                                padding: '18px',
                                borderRadius: '14px',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#166534',
                                fontSize: '14px',
                                lineHeight: '1.7',
                                marginBottom: '20px',
                            }}
                        >
                            <strong style={{ display: 'block', marginBottom: '6px' }}>
                                {locale === 'en'
                                    ? '✓ Password updated!'
                                    : '✓ Mot de passe mis à jour !'}
                            </strong>
                            {locale === 'en'
                                ? 'Your password has been reset. Redirecting you to sign in…'
                                : 'Votre mot de passe a été réinitialisé. Redirection vers la connexion…'}
                        </div>
                    ) : (
                        <>
                            <AuthInput
                                icon={<Mail />}
                                label={locale === 'en' ? 'Email address' : 'Adresse e-mail'}
                            >
                                <input
                                    placeholder="owner@company.com"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </AuthInput>
                            <AuthInput
                                icon={<LockKeyhole />}
                                label={locale === 'en' ? 'New password' : 'Nouveau mot de passe'}
                                action={
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPw((v) => !v)}
                                        aria-label="Toggle password"
                                    >
                                        {showPw ? <EyeOff /> : <Eye />}
                                    </button>
                                }
                            >
                                <input
                                    placeholder={
                                        locale === 'en'
                                            ? 'At least 10 characters'
                                            : 'Au moins 10 caractères'
                                    }
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={10}
                                    autoComplete="new-password"
                                />
                            </AuthInput>
                            <AuthInput
                                icon={<LockKeyhole />}
                                label={
                                    locale === 'en'
                                        ? 'Confirm password'
                                        : 'Confirmer le mot de passe'
                                }
                            >
                                <input
                                    placeholder={
                                        locale === 'en'
                                            ? 'Repeat your new password'
                                            : 'Répétez le mot de passe'
                                    }
                                    type={showPw ? 'text' : 'password'}
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </AuthInput>
                            <button className="auth-submit" disabled={busy}>
                                <span>
                                    {busy
                                        ? locale === 'en'
                                            ? 'Saving...'
                                            : 'Enregistrement...'
                                        : locale === 'en'
                                          ? 'Reset password'
                                          : 'Réinitialiser'}
                                </span>
                                <i>
                                    <ChevronRight size={18} />
                                </i>
                            </button>
                        </>
                    )}

                    <div className="auth-switch" style={{ justifyContent: 'center' }}>
                        <button type="button" onClick={() => (window.location.href = '/')}>
                            {locale === 'en' ? '← Back to sign in' : '← Retour à la connexion'}
                        </button>
                    </div>
                    <p className="auth-assurance">
                        <ShieldCheck /> Your connection is encrypted and protected.
                    </p>
                </form>
            </section>
        </main>
    );
}
