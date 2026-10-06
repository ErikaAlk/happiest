import type { ActivityIndicatorProps } from 'react-native';

/**
 * The ActivitySpinner contract shared by `ActivitySpinner.tsx` (iOS, web, desktop) and
 * `ActivitySpinner.android.tsx` (the ColorOS UI kit loading ring). On Android the ring keeps COUI's
 * two sizes and the theme colour: `'large'` or a numeric size of 26 or more is COUI's large ring,
 * anything else the small one, and `color` applies on web and desktop only.
 */
export type ActivitySpinnerProps = Omit<ActivityIndicatorProps, 'size'> & {
    size?: ActivityIndicatorProps['size'] | number;
    /**
     * Keep the spinner visible but stop it turning.
     *
     * Used wherever ambient motion must pause without the mark disappearing: a mounted offscreen
     * list row, an entry that has stopped reporting. Honoured on every platform — web drops the CSS
     * animation, native stops the `ActivityIndicator` while overriding `hidesWhenStopped` so the
     * ring stays on screen. A paused spinner still says "this is the running state"; a missing one
     * says the work ended.
     */
    animationEnabled?: boolean;
};

/**
 * A vector icon draws its circle INSET in its em box, but a spinner's diameter IS its box. So a
 * spinner and an Ionicons `checkmark-circle` given the same number render at visibly different
 * sizes, and a status slot that swaps one for the other appears to change size as it settles.
 *
 * Measured from a rendered transcript at matched scale: a filled circle glyph declared at 16 draws
 * ~12.8px of ink, next to a `size="small"` spinner's full 20px ring — the running state read 1.55x
 * the size of the success state it turns into.
 *
 * Every status slot that pairs a spinner with a glyph derives the spinner from the glyph size here.
 * Before this existed, four of them each guessed separately and all four disagreed.
 */
export const ICON_CIRCLE_INK_RATIO = 0.8;

export function iconMatchedSpinnerSize(iconSize: number): number {
    return Math.round(iconSize * ICON_CIRCLE_INK_RATIO);
}
