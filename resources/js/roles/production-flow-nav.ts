import { Workflow } from 'lucide-react';
import type { NavItem, RoleContext } from './types';

export const productionFlowNav = ({ flags, text }: RoleContext): NavItem[] =>
    flags.hasProductionFlow
        ? [
              [
                  'production-flow',
                  Workflow,
                  text('Production flow', 'Flux de production'),
                  'production.view',
              ],
          ]
        : [];
