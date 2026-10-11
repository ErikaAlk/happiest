import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderScreen } from '@/dev/testkit';
import { installSessionShellCommonModuleMocks } from './sessionShellTestHelpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const routerState = vi.hoisted(() => ({
    push: vi.fn(),
}));

installSessionShellCommonModuleMocks({
    router: async () => ({
        useRouter: () => routerState,
    }),
});

vi.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('SessionsListStorageChrome sidebar surface', () => {
    it('renders the direct browse action without main-content ItemGroup constraints', async () => {
        const { SessionsListStorageChrome } = await import('./SessionsListStorageChrome');

        const screen = await renderScreen(
            <SessionsListStorageChrome
                directSessionsEnabled
            />,
        );

        const itemGroups = screen.tree.findAll((node) => node.props.constrainToContentWidth === false);
        expect(itemGroups).toHaveLength(2);
        const usageGroup = itemGroups.find((group) => group.findAllByProps({ testID: 'account-usage-limits-entry' }).length > 0);
        const browseGroup = itemGroups.find((group) => group.findAllByProps({ testID: 'direct-sessions-browse-button' }).length > 0);
        expect(usageGroup?.props.constrainToContentWidth).toBe(false);
        expect(browseGroup?.props.constrainToContentWidth).toBe(false);
        expect(usageGroup).not.toBe(browseGroup);
    });
});
