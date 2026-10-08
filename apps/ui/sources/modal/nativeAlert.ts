import { Alert } from 'react-native';

import type { AlertButton } from './types';

export type NativeAlertOptions = Readonly<{
    /** Whether tapping outside or the back key closes the alert without running a button. */
    cancelable: boolean;
    /** The button that is the alert's main action; the ColorOS dialog draws it as the recommended capsule. */
    recommendedIndex?: number;
}>;

/** The one native alert presenter behind `Modal.alert`, `Modal.alertAsync` and `Modal.confirm` (not web). */
export function showNativeAlert(title: string, message: string | undefined, buttons: AlertButton[], options: NativeAlertOptions): void {
    Alert.alert(title, message, buttons, { cancelable: options.cancelable });
}
