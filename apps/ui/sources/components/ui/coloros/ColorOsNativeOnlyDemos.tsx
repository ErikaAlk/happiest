import type * as React from 'react';

/** The kit's top bar and list rows have no shared control contract yet, so only Android shows them. */
export function ColorOsNativeOnlyDemos(_props: Readonly<{ onResult: (result: string) => void }>): React.ReactElement | null {
    return null;
}
