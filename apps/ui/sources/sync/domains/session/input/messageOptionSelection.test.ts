import { afterEach, describe, expect, it } from 'vitest';

import {
    beginMessageOptionSelection,
    messageOptionSelectionStore,
    releaseMessageOptionSelection,
} from './messageOptionSelection';

afterEach(() => {
    messageOptionSelectionStore.setState({ bySessionId: {} });
});

describe('message option selection lock', () => {
    it('admits only the first selection of a session until it is released', () => {
        const first = beginMessageOptionSelection('s1', { messageId: 'agent-1', title: '安装' });
        const second = beginMessageOptionSelection('s1', { messageId: 'agent-1', title: '先不安装' });

        expect(first).not.toBeNull();
        expect(second).toBeNull();
        expect(messageOptionSelectionStore.getState().bySessionId.s1).toEqual({ messageId: 'agent-1', title: '安装' });

        releaseMessageOptionSelection('s1', first!);
        expect(messageOptionSelectionStore.getState().bySessionId.s1).toBeUndefined();
        expect(beginMessageOptionSelection('s1', { messageId: 'agent-1', title: '先不安装' })).not.toBeNull();
    });

    it('keeps sessions independent and ignores a release from a superseded selection', () => {
        const s1 = beginMessageOptionSelection('s1', { messageId: 'agent-1', title: '安装' });
        const s2 = beginMessageOptionSelection('s2', { messageId: 'agent-9', title: '继续' });
        expect(s1).not.toBeNull();
        expect(s2).not.toBeNull();

        releaseMessageOptionSelection('s1', s1!);
        const next = beginMessageOptionSelection('s1', { messageId: 'agent-2', title: '好' });
        releaseMessageOptionSelection('s1', s1!);

        expect(messageOptionSelectionStore.getState().bySessionId.s1).toBe(next);
        expect(messageOptionSelectionStore.getState().bySessionId.s2).toBe(s2);
    });
});
