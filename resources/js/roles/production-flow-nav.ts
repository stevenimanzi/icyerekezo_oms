import { ClipboardList, Workflow } from 'lucide-react';
import type { NavItem, RoleContext } from './types';

type Stage = 'cutting' | 'sewing' | 'finishing' | 'packing';

const MATERIAL_PAGES: Record<Stage, string> = {
    cutting: 'fabric-request',
    sewing: 'sewing-materials',
    finishing: 'finishing-materials',
    packing: 'packing-materials',
};

/** The link a stage team uses to ask the warehouse for materials; only where the garment flow is used. */
export const requestMaterialsNav = (stage: Stage, { flags, text }: RoleContext): NavItem[] =>
    flags.hasProductionFlow
        ? [
              [
                  MATERIAL_PAGES[stage],
                  ClipboardList,
                  text('Requests', 'Demandes'),
                  'production.execute',
              ],
          ]
        : [];

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
