import React from 'react';
import {
    Activity,
    CheckCircle2,
    Layers,
    PackageCheck,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Users,
} from 'lucide-react';
import type { Locale } from '../core/types';

export function AuthShowcase({ locale = 'en' }: { locale?: Locale }) {
    const isFr = locale === 'fr';

    return (
        <aside className="auth-showcase">
            <div className="auth-showcase-bg-grid" />
            <div className="auth-showcase-glow auth-showcase-glow-1" />
            <div className="auth-showcase-glow auth-showcase-glow-2" />

            <div className="auth-showcase-content">
                {/* Header Tag */}
                <div className="auth-showcase-kicker">
                    <Sparkles size={14} className="text-blue-200" />
                    <span>
                        {isFr ? 'Opérations d’usine intelligentes' : 'Intelligent Factory Operations'}
                    </span>
                </div>

                {/* Main Heading & Subtitle */}
                <h2 className="auth-showcase-title">
                    {isFr ? (
                        <>
                            La solution complète pour <br />
                            <span className="auth-showcase-title-accent">piloter votre production</span>
                        </>
                    ) : (
                        <>
                            The simplest way to manage <br />
                            <span className="auth-showcase-title-accent">your factory workforce</span>
                        </>
                    )}
                </h2>

                <p className="auth-showcase-subtitle">
                    {isFr
                        ? 'Traçabilité des lots, registre de stock inviolable et flux de fabrication en temps réel.'
                        : 'Batch traceability, immutable stock ledger, and real-time shop-floor workflows.'}
                </p>

                {/* Floating Mockup Card - Inspired by Reference Images */}
                <div className="auth-showcase-mockup">
                    <div className="auth-mockup-header">
                        <div className="auth-mockup-header-left">
                            <span className="auth-mockup-dot auth-mockup-dot-live" />
                            <span className="auth-mockup-title">
                                {isFr ? 'Atelier de Production' : 'Production Floor Monitor'}
                            </span>
                        </div>
                        <div className="auth-mockup-badge">
                            <Activity size={12} />
                            <span>{isFr ? 'En direct' : 'Live'}</span>
                        </div>
                    </div>

                    <div className="auth-mockup-stats">
                        <div className="auth-mockup-stat-card">
                            <span className="auth-mockup-stat-label">
                                {isFr ? 'Rendement du Jour' : 'Daily Output'}
                            </span>
                            <div className="auth-mockup-stat-value">
                                <span>12,480</span>
                                <span className="auth-mockup-trend">
                                    <TrendingUp size={11} /> +18%
                                </span>
                            </div>
                            <div className="auth-mockup-sparkline">
                                <span style={{ height: '40%' }} />
                                <span style={{ height: '55%' }} />
                                <span style={{ height: '45%' }} />
                                <span style={{ height: '70%' }} />
                                <span style={{ height: '65%' }} />
                                <span style={{ height: '90%' }} />
                                <span style={{ height: '100%' }} />
                            </div>
                        </div>

                        <div className="auth-mockup-stat-card">
                            <span className="auth-mockup-stat-label">
                                {isFr ? 'Qualité & Conformité' : 'Quality Pass Rate'}
                            </span>
                            <div className="auth-mockup-stat-value">
                                <span>99.2%</span>
                                <span className="auth-mockup-trend-positive">
                                    <CheckCircle2 size={11} />
                                </span>
                            </div>
                            <div className="auth-mockup-progress-bar">
                                <div
                                    className="auth-mockup-progress-fill"
                                    style={{ width: '99.2%' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stage Pipeline Miniature */}
                    <div className="auth-mockup-stages">
                        <div className="auth-mockup-stage-item done">
                            <span className="auth-mockup-stage-icon">✓</span>
                            <span className="auth-mockup-stage-name">
                                {isFr ? 'Coupe' : 'Cutting'}
                            </span>
                            <span className="auth-mockup-stage-qty">4.2k</span>
                        </div>
                        <div className="auth-mockup-stage-divider" />
                        <div className="auth-mockup-stage-item active">
                            <span className="auth-mockup-stage-icon">●</span>
                            <span className="auth-mockup-stage-name">
                                {isFr ? 'Couture' : 'Sewing'}
                            </span>
                            <span className="auth-mockup-stage-qty">3.8k</span>
                        </div>
                        <div className="auth-mockup-stage-divider" />
                        <div className="auth-mockup-stage-item pending">
                            <span className="auth-mockup-stage-icon">○</span>
                            <span className="auth-mockup-stage-name">
                                {isFr ? 'Finition' : 'Finishing'}
                            </span>
                            <span className="auth-mockup-stage-qty">2.9k</span>
                        </div>
                    </div>

                    {/* Team Members footer preview */}
                    <div className="auth-mockup-footer">
                        <div className="auth-mockup-avatars">
                            <span className="avatar avatar-1">ST</span>
                            <span className="avatar avatar-2">KM</span>
                            <span className="avatar avatar-3">AL</span>
                            <span className="avatar-more">+14</span>
                        </div>
                        <span className="auth-mockup-footer-text">
                            {isFr ? 'Opérateurs actifs' : 'Active shift operators'}
                        </span>
                    </div>
                </div>

                {/* Bottom Trust Pills */}
                <div className="auth-showcase-pills">
                    <div className="auth-showcase-pill">
                        <ShieldCheck size={14} />
                        <span>{isFr ? 'Registre Inviolable' : 'Immutable Ledger'}</span>
                    </div>
                    <div className="auth-showcase-pill">
                        <PackageCheck size={14} />
                        <span>{isFr ? 'Traçabilité des Lots' : 'Lot Traceability'}</span>
                    </div>
                    <div className="auth-showcase-pill">
                        <Layers size={14} />
                        <span>{isFr ? 'Multi-Industries' : 'Multi-Tenant ERP'}</span>
                    </div>
                </div>

                {/* Carousel Pagination Dots */}
                <div className="auth-showcase-carousel-dots">
                    <span className="dot active" />
                    <span className="dot" />
                    <span className="dot" />
                </div>
            </div>
        </aside>
    );
}
