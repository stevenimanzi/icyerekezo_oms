import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Labels } from '../core/labels';
import type { AuthUser, Locale } from '../core/types';
import type { RoleFlags } from './flags';

export type NavItem = readonly [page: string, icon: LucideIcon, label: string, permission: string];

export type NavGroup = { label: string; icon: LucideIcon; children: string[] };

export type RoleContext = {
    user: AuthUser;
    locale: Locale;
    labels: Labels;
    flags: RoleFlags;
    text: (en: string, fr: string) => string;
};

export type RoleModule = {
    id: string;
    matches: (context: RoleContext) => boolean;
    nav: (context: RoleContext) => NavItem[];
};

export type HomeProps = {
    user: AuthUser;
    locale: Locale;
    onNavigate: (page: string) => void;
    pages: string[];
};

export type HomeComponent = ComponentType<HomeProps>;
