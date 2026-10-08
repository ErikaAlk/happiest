import { readColorOsHostEnvironment } from '@/components/ui/coloros/colorOsHostEnvironment';
import { ColorOsUiModule, type CoAlertButtonRole } from '@/components/ui/coloros/colorOsNativeViews';

import type { NativeAlertOptions } from './nativeAlert';
import type { AlertButton } from './types';

export type { NativeAlertOptions } from './nativeAlert';

function buttonRole(button: AlertButton, index: number, options: NativeAlertOptions): CoAlertButtonRole {
    if (button.style === 'destructive') return 'danger';
    return index === options.recommendedIndex ? 'recommended' : 'normal';
}

/** Android: the ColorOS UI kit dialog. Runs the pressed button; dismissing from the scrim or back key runs none. */
export function showNativeAlert(title: string, message: string | undefined, buttons: AlertButton[], options: NativeAlertOptions): void {
    void ColorOsUiModule.showAlert({
        ...readColorOsHostEnvironment(),
        title,
        message,
        buttons: buttons.map((button, index) => ({ text: button.text, role: buttonRole(button, index, options) })),
        dismissible: options.cancelable,
    }).then((index) => {
        if (index >= 0) buttons[index]!.onPress?.();
    });
}
