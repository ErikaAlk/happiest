import { describe, expect, it } from 'vitest';

import { resolveRenderedAgentInputControls } from './resolveRenderedAgentInputControls';

describe('resolveRenderedAgentInputControls', () => {
    it('hides disabled controls in every action-bar layout while preserving visible controls', () => {
        for (const layout of ['collapsed', 'wrap', 'scroll'] as const) {
            const result = resolveRenderedAgentInputControls({
                layout,
                coreControlNodesById: { engine: ['engine'], permission: ['permission'], machine: ['machine'] },
                extraControlNodesById: { mcp: ['mcp'] },
                extraChips: [],
                collapsedMenuControlIds: [],
                ...{ hiddenControlIds: ['permission', 'machine', 'mcp'] as const },
            });
            expect(result.chips).toEqual(['engine']);
            expect(result.secondaryLeadingControls).toEqual([]);
        }
    });

    it('keeps primary controls inline and moves available secondary actions into the collapsed menu', () => {
        const result = resolveRenderedAgentInputControls({
            layout: 'collapsed',
            coreControlNodesById: {
                engine: ['engine'], permission: ['permission'], actionMenu: ['menu'],
                machine: ['machine'], path: ['path'], resume: ['resume'],
                profile: ['profile'], env: ['env'], recipient: ['recipient'],
            },
            extraControlNodesById: { mcp: ['mcp'], linkedFiles: ['linked-file'] },
            extraChips: ['custom'],
            collapsedMenuControlIds: ['engine', 'profile', 'env', 'machine', 'path', 'resume', 'mcp'],
        });

        expect(result.chips).toEqual(['engine', 'permission', 'menu', 'recipient', 'linked-file', 'custom']);
        expect(result.secondaryLeadingControls).toEqual([]);
    });
});
