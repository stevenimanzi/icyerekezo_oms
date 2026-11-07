import React from 'react';
import type { Locale } from '../core/types';

export function AuthShowcase({ locale = 'en' }: { locale?: Locale }) {
    const isFr = locale === 'fr';

    return (
        <section className="auth-showcase-panel white-theme">
            <div className="showcase-header">
                <h1 className="showcase-title">
                    {isFr
                        ? 'Gérez facilement vos équipes et opérations d’usine.'
                        : 'Effortlessly manage your team and factory operations.'}
                </h1>
                <p className="showcase-subtitle">
                    {isFr
                        ? 'Connectez-vous pour accéder à votre tableau de bord, suivre les lots et gérer les commandes scolaires.'
                        : 'Log in to access your operations dashboard, track live batches, and manage school orders.'}
                </p>
            </div>
            <div className="showcase-illustration-container">
                <img
                    src="/assets/images/factory-illustration.jpg"
                    alt="Factory Operations Illustration"
                    className="showcase-illustration-img"
                />
            </div>
            <div className="showcase-footer">
                <span className="direction-motto">
                    {isFr ? 'Nous automatisons le flux de données de votre usine' : 'We Automate your Factory Data Flow'}
                </span>
            </div>
        </section>
    );
}
