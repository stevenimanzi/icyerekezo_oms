import React, { useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    ChevronRight,
    Eye,
    EyeOff,
    Globe,
    LockKeyhole,
    Mail,
    Shield,
} from 'lucide-react';
import { api } from '../core/api';
import { type Locale } from '../core/types';
import { Logo } from '../app/Logo';
import { AuthInput } from './AuthInput';
import { AuthShowcase } from './AuthShowcase';
import { LanguageFlagDropdown } from './CountryFlags';

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
            }, 2500);
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

    const isFr = locale === 'fr';

    return (
        <div className="auth-viewport">
            <div className="auth-container">
                {/* Left Panel: Showcase Side */}
                <AuthShowcase locale={locale} />

                {/* Right Panel: Form Side */}
                <div className="auth-form-panel">
                    <div className="auth-header-bar">
                        <div className="auth-logo-wrapper">
                            <Logo />
                        </div>
                        <LanguageFlagDropdown locale={locale} onChange={setLocale} />
                    </div>

                    <div className="auth-body">
                        <div className="auth-heading">
                            <h1 className="auth-title">
                                {isFr ? 'Définir un nouveau mot de passe' : 'Set a new password'}
                            </h1>
                            <p className="auth-subtitle">
                                {isFr
                                    ? 'Choisissez un mot de passe sécurisé comportant au moins 10 caractères.'
                                    : 'Create a new secure password of at least 10 characters.'}
                            </p>
                        </div>

                        {error && (
                            <div className="auth-alert auth-alert-error">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        {done ? (
                            <div className="auth-alert auth-alert-success">
                                <div className="flex gap-2.5">
                                    <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="block font-semibold text-emerald-900 mb-1">
                                            {isFr ? 'Mot de passe mis à jour !' : 'Password updated successfully!'}
                                        </strong>
                                        <p className="text-emerald-800 text-sm leading-relaxed">
                                            {isFr
                                                ? 'Votre mot de passe a été réinitialisé. Redirection vers la page de connexion...'
                                                : 'Your password has been changed. Redirecting you to sign in...'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={submit} className="auth-form">
                                <AuthInput
                                    icon={<Mail size={18} />}
                                    label={isFr ? 'Adresse e-mail' : 'Email address'}
                                >
                                    <input
                                        placeholder="owner@company.com"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="auth-input-control"
                                    />
                                </AuthInput>

                                <AuthInput
                                    icon={<LockKeyhole size={18} />}
                                    label={isFr ? 'Nouveau mot de passe' : 'New password'}
                                    action={
                                        <button
                                            type="button"
                                            className="auth-password-toggle-btn"
                                            onClick={() => setShowPw((v) => !v)}
                                            aria-label="Toggle password"
                                        >
                                            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    }
                                >
                                    <input
                                        placeholder={
                                            isFr
                                                ? 'Au moins 10 caractères'
                                                : 'At least 10 characters'
                                        }
                                        type={showPw ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={10}
                                        autoComplete="new-password"
                                        autoFocus
                                        className="auth-input-control"
                                    />
                                </AuthInput>

                                <AuthInput
                                    icon={<LockKeyhole size={18} />}
                                    label={isFr ? 'Confirmer le mot de passe' : 'Confirm password'}
                                >
                                    <input
                                        placeholder={
                                            isFr
                                                ? 'Répétez le nouveau mot de passe'
                                                : 'Repeat new password'
                                        }
                                        type={showPw ? 'text' : 'password'}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        className="auth-input-control"
                                    />
                                </AuthInput>

                                <button
                                    type="submit"
                                    className="auth-btn-primary"
                                    disabled={busy}
                                >
                                    <span>
                                        {busy
                                            ? isFr
                                                ? 'Enregistrement...'
                                                : 'Saving...'
                                            : isFr
                                              ? 'Réinitialiser le mot de passe'
                                              : 'Save new password'}
                                    </span>
                                    <ChevronRight size={18} />
                                </button>
                            </form>
                        )}

                        <div className="auth-footer-switch">
                            <button
                                type="button"
                                className="auth-link-back"
                                onClick={() => (window.location.href = '/')}
                            >
                                <ArrowLeft size={15} />
                                <span>
                                    {isFr ? 'Retour à la connexion' : 'Back to sign in'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="auth-bottom-copyright">
                        <span>
                            Copyright © 2026 ICYEREKEZO OMS. All rights reserved. Powered by ICYEREKEZO DIGITAL INNOVATION Ltd
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
