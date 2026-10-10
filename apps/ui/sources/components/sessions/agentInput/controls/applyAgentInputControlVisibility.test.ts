import { describe, expect, it } from 'vitest';
import type { AgentInputProps } from '../AgentInput';
import { applyAgentInputControlVisibility } from './applyAgentInputControlVisibility';

describe('applyAgentInputControlVisibility', () => {
    it('removes every engine picker entry while retaining the launch selection', () => {
        const props: AgentInputProps = {
            value: '任务', placeholder: '任务', onChangeText: () => {}, onSend: () => {},
            autocompleteKinds: [], autocompleteSuggestions: async () => [],
            agentType: 'codex', hiddenControlIds: ['engine'],
            acpConfigOptionsOverride: [{ id: 'effort', name: 'Effort', type: 'select', currentValue: 'high', options: [{ value: 'high', name: 'High' }] }],
        };
        const result = applyAgentInputControlVisibility(props);
        expect(result.acpConfigOptionsOverride).toEqual([]);
        expect(result.agentType).toBe('codex');
        expect(props.acpConfigOptionsOverride).toHaveLength(1);
    });

    it('retains the original input when all options are visible', () => {
        const props: AgentInputProps = {
            value: '任务', placeholder: '任务', onChangeText: () => {}, onSend: () => {},
            autocompleteKinds: [], autocompleteSuggestions: async () => [],
        };
        expect(applyAgentInputControlVisibility(props)).toBe(props);
    });
});
