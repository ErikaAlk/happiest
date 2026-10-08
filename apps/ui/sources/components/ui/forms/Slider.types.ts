/**
 * A horizontal slider over 0..1, shared by `Slider.tsx` (iOS, web and desktop) and `Slider.android.tsx`
 * (the ColorOS UI kit seek bar). The caller maps its own value onto 0..1 and snaps what comes back.
 */
export type SliderProps = Readonly<{
    /** 0..1. */
    value: number;
    /** Intervals between the ends. Android ticks once per interval while dragging, and a screen reader moves one interval per adjustment. */
    steps: number;
    /** Called while dragging with the new position, 0..1. */
    onValueChange: (value: number) => void;
    accessibilityLabel: string;
    /** The value as a screen reader speaks it, in the caller's own units. */
    accessibilityValueText: string;
    testID?: string;
}>;
