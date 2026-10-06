import { beforeEach, describe, expect, it, vi } from 'vitest';

type ShowAlertOptions = Readonly<{
    title?: string;
    message?: string;
    buttons: ReadonlyArray<Readonly<{ text: string; role: string }>>;
    dismissible: boolean;
}>;

// The Expo native module is the system boundary: it opens a ColorOS dialog and resolves with the
// pressed button index, or -1 when the dialog is dismissed from the scrim or back key.
const showAlert = vi.fn<(options: ShowAlertOptions) => Promise<number>>();

vi.mock('@/components/ui/coloros/colorOsNativeViews', () => ({
    ColorOsUiModule: { showAlert: (options: ShowAlertOptions) => showAlert(options) },
}));

// Metro resolves `./nativeAlert` to the `.android` file on Android.
vi.mock('./nativeAlert', async () => await import('./nativeAlert.android'));

vi.mock('@/text', async () => {
    const { createTextModuleMock } = await import('@/dev/testkit/mocks/text');
    return createTextModuleMock({ translate: (key: string) => key });
});

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock({
        Platform: { OS: 'android', select: (options: any) => options.android ?? options.default },
    });
});

vi.mock('react-native-unistyles', async () => {
    const { createUnistylesMock } = await import('@/dev/testkit/mocks/unistyles');
    return createUnistylesMock();
});

vi.mock('@/sync/domains/state/storage', async () => {
    const { createStorageModuleStub, createStorageStoreMock } = await import('@/dev/testkit/mocks/storage');
    const { localSettingsDefaults } = await import('@/sync/domains/settings/localSettings');
    return createStorageModuleStub({ storage: createStorageStoreMock({ localSettings: localSettingsDefaults }) });
});

async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('native alerts on Android', () => {
    beforeEach(() => {
        showAlert.mockReset();
    });

    it('confirm makes the confirm button the recommended action and cannot be dismissed', async () => {
        showAlert.mockResolvedValue(1);
        const { Modal } = await import('./ModalManager');

        const result = Modal.confirm('Delete?', 'This cannot be undone', { confirmText: 'Delete' });

        expect(showAlert).toHaveBeenCalledTimes(1);
        const options = showAlert.mock.calls[0]![0];
        expect(options.title).toBe('Delete?');
        expect(options.message).toBe('This cannot be undone');
        expect(options.dismissible).toBe(false);
        expect(options.buttons).toEqual([
            { text: 'common.cancel', role: 'normal' },
            { text: 'Delete', role: 'recommended' },
        ]);
        await expect(result).resolves.toBe(true);
    });

    it('a destructive confirm uses the danger role and resolves false on cancel', async () => {
        showAlert.mockResolvedValue(0);
        const { Modal } = await import('./ModalManager');

        const result = Modal.confirm('Delete?', undefined, { destructive: true });

        expect(showAlert.mock.calls[0]![0].buttons.map((button) => button.role)).toEqual(['normal', 'danger']);
        await expect(result).resolves.toBe(false);
    });

    it('a plain alert can be dismissed, and dismissing runs no button', async () => {
        showAlert.mockResolvedValue(-1);
        const onPress = vi.fn();
        const { Modal } = await import('./ModalManager');

        Modal.alert('Saved', undefined, [{ text: 'Open', onPress }]);
        await flush();

        expect(showAlert.mock.calls[0]![0].dismissible).toBe(true);
        expect(onPress).not.toHaveBeenCalled();
    });

    it('a plain alert without buttons shows OK', async () => {
        showAlert.mockResolvedValue(0);
        const { Modal } = await import('./ModalManager');

        Modal.alert('Saved');
        await flush();

        expect(showAlert.mock.calls[0]![0].buttons).toEqual([{ text: 'common.ok', role: 'normal' }]);
    });

    it('alertAsync waits for the pressed button and runs it', async () => {
        showAlert.mockResolvedValue(1);
        const onRetry = vi.fn();
        const { Modal } = await import('./ModalManager');

        await Modal.alertAsync('Failed', 'Try again?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: onRetry },
        ]);

        expect(showAlert.mock.calls[0]![0].dismissible).toBe(false);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
