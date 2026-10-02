import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME } from '@happier-dev/protocol';

import { renderSettingsView } from '@/dev/testkit/harness/settingsViewHarness';
import { installSessionSettingsCommonModuleMocks } from './sessionSettingsViewTestHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const settingsState: Record<string, unknown> = {};

installSessionSettingsCommonModuleMocks({
    storage: async (importOriginal) => {
        const { createStorageModuleMock } = await import('@/dev/testkit/mocks/storage');
        return createStorageModuleMock({
            importOriginal,
            overrides: {
                useSettingMutable: (key: string) => [
                    settingsState[key],
                    (next: unknown) => {
                        settingsState[key] = next;
                    },
                ],
            },
        });
    },
});

describe('SessionRuntimeSettingsView', () => {
    it('shows the Windows Terminal window that sessions open in while no window name is set', async () => {
        const { SessionRuntimeSettingsView } = await import('./SessionRuntimeSettingsView');
        const screen = await renderSettingsView(React.createElement(SessionRuntimeSettingsView));

        const windowNameInput = screen.findByTestId('settings-session-windows-terminal-window-name-input');
        expect(windowNameInput?.props.value).toBe('');
        expect(windowNameInput?.props.placeholder).toBe(DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME);
    });
});
