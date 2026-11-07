import React, { useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    ChevronRight,
    Globe,
    Mail,
    Shield,
} from 'lucide-react';
import { api } from '../core/api';
import { type Locale } from '../core/types';
import { Logo } from '../app/Logo';
import { AuthInput } from './AuthInput';
import { AuthShowcase } from './AuthShowcase';

export function ForgotPasswordPage() {
    const [locale, setLocale] = useState<Locale>('en');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await api('/api/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            setSent(true);
        } catch (reason: any) {
            setError(
                reason instanceof Error ? reason.message : 'Unable to send. Please try again.',
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
                        <button
                            type="button"
                            className="auth-lang-btn"
                            onClick={() => setLocale(isFr ? 'en' : 'fr')}
                            title={isFr ? 'Switch to English' : 'Passer en Français'}
                        >
                            <Globe size={15} />
                            <span className="auth-lang-text">{isFr ? 'EN' : 'FR'}</span>
                        </button>
                    </div>

                    <div className="auth-body">
                        <div className="auth-heading">
                            <h1 className="auth-title">
                                {isFr ? 'Mot de passe oublié ?' : 'Forgot your password?'}
                            </h1>
                            <p className="auth-subtitle">
                                {isFr
                                    ? 'Saisissez votre e-mail pour recevoir un lien sécurisé de réinitialisation.'
                                    : 'Enter your registered email address to receive a password reset link.'}
                            </p>
                        </div>

                        {error && (
                            <div className="auth-alert auth-alert-error">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        {sent ? (
                            <div className="auth-alert auth-alert-success">
                                <div className="flex gap-2.5">
                                    <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="block font-semibold text-emerald-900 mb-1">
                                            {isFr ? 'Lien de réinitialisation envoyé !' : 'Reset link sent!'}
                                        </strong>
                                        <p className="text-emerald-800 text-sm leading-relaxed">
                                            {isFr
                                                ? `Si un compte existe pour ${email}, nous avons envoyé les instructions de réinitialisation depuis support@icyerekezooms.com.`
                                                : `If an account exists for ${email}, we've sent reset instructions from support@icyerekezooms.com.`}
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
                                        autoFocus
                                        autoComplete="email"
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
                                                ? 'Envoi en cours...'
                                                : 'Sending link...'
                                            : isFr
                                              ? 'Envoyer le lien de réinitialisation'
                                              : 'Send reset link'}
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

                        <div className="auth-assurance-badge">
                            <Shield size={13} className="text-blue-600" />
                            <span>
                                {isFr
                                    ? 'Votre connexion est chiffrée et protégée'
                                    : 'Your connection is encrypted and protected'}
                            </span>
                        </div>
                    </div>

                    <div className="auth-bottom-copyright">
                        <span>© 2026 ICYEREKEZO OMS. All rights reserved.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
