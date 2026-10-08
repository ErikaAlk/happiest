/**
 * The FAB contract shared by `FAB.tsx` (iOS, web, desktop) and `FAB.android.tsx` (the ColorOS UI kit
 * floating button). Both sit bottom-right above the safe area and draw a plus.
 */
export type FABProps = Readonly<{
    onPress: () => void;
    /** Defaults to "Add" (`common.add`). */
    accessibilityLabel?: string;
}>;
