import React, { useState } from 'react';
import { Languages, Mail, Send, ShieldCheck } from 'lucide-react';
import { api } from '../core/api';
import { type Locale } from '../core/types';
import { Logo } from '../app/Logo';

export function ForgotPasswordPage() {
    const [locale, setLocale] = useState<Locale>("en");
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
            setSent(true);
        } catch (reason: any) {
            setError(reason instanceof Error ? reason.message : "Unable to send. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="auth-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100svh", background: "#fff" }}>
            <section className="auth-form-side" style={{ width: "min(100%, 480px)", padding: "48px 32px", background: "#fff" }}>
                <div className="auth-topbar">
                    <div className="auth-mobile-logo"><Logo /></div>
                    <button type="button" className="auth-language" onClick={() => setLocale(locale === "en" ? "fr" : "en")}>
                        <Languages size={18} />
                        {locale === "en" ? "Francais" : "English"}
                    </button>
                </div>
                <form className="auth-card" onSubmit={submit} style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
                    <div className="auth-heading">
                        <h2 style={{ fontSize: "clamp(28px,3vw,38px)" }}>
                            {locale === "en" ? "Forgot your password?" : "Mot de passe oublié ?"}
                        </h2>
                        <p style={{ whiteSpace: "nowrap" }}>
                            {locale === "en" ? "Enter your email to receive a reset link." : "Entrez votre e-mail pour recevoir un lien."}
                        </p>
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    {sent ? (
                        <div style={{ padding: "18px", borderRadius: "14px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", fontSize: "14px", lineHeight: "1.7", marginBottom: "20px" }}>
                            <strong style={{ display: "block", marginBottom: "6px" }}>
                                {locale === "en" ? "✓ Reset link sent!" : "✓ Lien envoyé !"}
                            </strong>
                            {locale === "en"
                                ? `If an account exists for ${email}, we've sent a reset link from support@icyerekezooms.com. It can take a few minutes to arrive — check your spam or junk folder if you don't see it.`
                                : `Si un compte existe pour ${email}, nous avons envoyé un lien depuis support@icyerekezooms.com. Cela peut prendre quelques minutes — vérifiez votre dossier spam si vous ne le voyez pas.`}
                        </div>
                    ) : (
                        <>
                            <AuthInput icon={<Mail />} label={locale === "en" ? "Email address" : "Adresse e-mail"}>
                                <input
                                    placeholder="owner@company.com"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    autoComplete="email"
                                />
                            </AuthInput>
                            <button className="auth-submit" disabled={busy}>
                                <span>{busy ? (locale === "en" ? "Sending..." : "Envoi...") : (locale === "en" ? "Send reset link" : "Envoyer le lien")}</span>
                            </button>
                        </>
                    )}

                    <div className="auth-switch" style={{ justifyContent: "center" }}>
                        <button type="button" onClick={() => window.location.href = "/"}>
                            {locale === "en" ? "← Back to sign in" : "← Retour à la connexion"}
                        </button>
                    </div>
                    <p className="auth-assurance"><ShieldCheck /> Your connection is encrypted and protected.</p>
                </form>
            </section>
        </main>
    );
}
