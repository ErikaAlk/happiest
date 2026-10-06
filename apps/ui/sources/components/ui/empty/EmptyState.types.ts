import type * as React from 'react';

export type EmptyStateAction = Readonly<{
    label: string;
    onPress: () => void;
    testID?: string;
}>;

/**
 * The EmptyState contract shared by `EmptyState.tsx` (iOS, web, desktop) and `EmptyState.android.tsx`
 * (the ColorOS UI kit empty state, drawn natively). i18n is the caller's responsibility.
 */
export type EmptyStateProps = Readonly<{
    /** Leading glyph (e.g. an `Ionicons`/`SvgXml` element). Already themed by the caller. */
    icon: React.ReactNode;
    /** Already-translated title string. */
    title: string;
    /** Already-translated supporting copy. */
    subtitle?: string;
    /** A fix-it action drawn as a text button below the copy. */
    action?: EmptyStateAction;
    testID?: string;
    /** Web and desktop only: the ColorOS empty state draws its text natively. */
    titleTestID?: string;
    subtitleTestID?: string;
    actionTestID?: string;
    paddingHorizontal?: number;
}>;
