import { describe, expect, it } from 'vitest';
import { resolveHugeIcon } from './resolveHugeIcon';

describe('resolveHugeIcon', () => {
    it('keeps navigation glyphs identical when selected', () => {
        for (const name of ['mailbox', 'chats-circle', 'sliders-horizontal', 'users', 'terminal', 'list', 'folder', 'git-branch', 'stack'] as const) {
            const regular = resolveHugeIcon(name, 'regular');
            expect(regular).toBeUndefined();
            expect(resolveHugeIcon(name, 'fill')).toBe(regular);
        }
    });

    it('keeps filled favorites and stop controls in Phosphor', () => {
        for (const name of ['star', 'stop'] as const) {
            expect(resolveHugeIcon(name, 'regular')).toBeUndefined();
            expect(resolveHugeIcon(name, 'fill')).toBeUndefined();
        }
    });
});
