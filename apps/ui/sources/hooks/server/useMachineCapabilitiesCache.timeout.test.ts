import { describe, expect, it } from 'vitest';
import { CHECKLIST_IDS } from '@happier-dev/protocol/checklists';
import { resolveMachineCapabilitiesTimeoutMs } from './useMachineCapabilitiesCache';

describe('CLI capability detection deadline', () => {
    it('uses the same CLI detection budget for discovery and the new-session checklist', () => {
        const checklistBudget = resolveMachineCapabilitiesTimeoutMs({ checklistId: CHECKLIST_IDS.NEW_SESSION }, 2_500);
        expect(resolveMachineCapabilitiesTimeoutMs({ requests: [
            { id: 'cli.claude' }, { id: 'cli.codex' }, { id: 'cli.opencode' }, { id: 'cli.pi' },
        ] }, 2_500)).toBe(checklistBudget);
        expect(resolveMachineCapabilitiesTimeoutMs({ requests: [{ id: 'cli.codex' }] }, checklistBudget + 1)).toBe(checklistBudget + 1);
    });
});
