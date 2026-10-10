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
                ...{ hiddenControlIds: ['permission', 'machine', 'mcp'] as const },
            });
            expect(result.chips).toEqual(['engine']);
            expect(result.secondaryLeadingControls).toEqual([]);
        }
    });
});
