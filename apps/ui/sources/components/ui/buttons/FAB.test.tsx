import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderScreen } from '@/dev/testkit';

vi.mock('@/text', async () => {
    const { createTextModuleMock } = await import('@/dev/testkit/mocks/text');
    return createTextModuleMock({ translate: (key: string) => key });
});

vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('FAB', () => {
    it('names itself "Add" for screen readers when the screen gives no label', async () => {
        const { FAB } = await import('./FAB');

        const screen = await renderScreen(<FAB onPress={() => {}} />);

        const button = screen.find((node) => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function');
        expect(button.props.accessibilityLabel).toBe('common.add');
    });

    it('keeps the label the screen gives', async () => {
        const { FAB } = await import('./FAB');

        const screen = await renderScreen(<FAB onPress={() => {}} accessibilityLabel="New automation" />);

        const button = screen.find((node) => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function');
        expect(button.props.accessibilityLabel).toBe('New automation');
    });
});
