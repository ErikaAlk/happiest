import * as React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type RoundButtonSize = 'large' | 'normal' | 'small';
export type RoundButtonDisplay = 'default' | 'inverted';

const RoundButtonSizeContext = React.createContext<RoundButtonSize | undefined>(undefined);

export function RoundButtonSizeScope(props: Readonly<{
    size: RoundButtonSize;
    children: React.ReactNode;
}>) {
    return (
        <RoundButtonSizeContext.Provider value={props.size}>
            {props.children}
        </RoundButtonSizeContext.Provider>
    );
}

/** The button's size: its own prop, else the nearest `RoundButtonSizeScope`, else large. */
export function useRoundButtonSize(size: RoundButtonSize | undefined): RoundButtonSize {
    const scopedSize = React.useContext(RoundButtonSizeContext);
    return size ?? scopedSize ?? 'large';
}

/**
 * The RoundButton contract shared by `RoundButton.tsx` (iOS, web, desktop) and
 * `RoundButton.android.tsx` (the ColorOS UI kit button). On Android `default` is COUI's primary
 * button and `inverted` its text button; `large` and `normal` are COUI's large button and `small`
 * its small one. `style` lays the button out on every platform; its background colour, like
 * `textStyle` apart from its colour, applies on web and desktop only.
 */
export type RoundButtonProps = {
    size?: RoundButtonSize,
    display?: RoundButtonDisplay,
    title?: string,
    /**
     * A mark drawn before the title, inside the same fill.
     *
     * The button still hugs its content — the mark widens it rather than sitting in
     * a fixed box — so a logo-and-label button is this primitive with one more
     * child, not a second pill implementation beside it.
     */
    leading?: React.ReactNode,
    /**
     * The same mark, drawn after the title instead.
     *
     * Which side a mark belongs on is a property of the sentence, not of the
     * button: "Continue with {Agent}" closes with the Agent while "{Agent} で続ける"
     * opens with it. Both slots exist so the caller can put the mark where its
     * words put it, rather than the button imposing an order on every language.
     */
    trailing?: React.ReactNode,
    style?: StyleProp<ViewStyle>,
    textStyle?: StyleProp<TextStyle>,
    disabled?: boolean,
    loading?: boolean,
    testID?: string,
    accessibilityLabel?: string,
    /**
     * Why the button is in the state it is in — most usefully, why a disabled one
     * cannot be pressed. The name says what the press does; the hint says what is
     * missing, and without it a disabled pill reads to a screen reader as an
     * action with no explanation.
     */
    accessibilityHint?: string,
    onPress?: (event: unknown) => void,
    action?: () => Promise<unknown>
};

/**
 * One press: `onPress` wins, otherwise `action` runs with the button showing its loading state
 * until it settles. Presses while loading are ignored.
 */
export function useRoundButtonPress(props: Pick<RoundButtonProps, 'onPress' | 'action' | 'loading'>): Readonly<{
    loading: boolean;
    press: (event?: unknown) => void;
}> {
    const [pending, setPending] = React.useState(false);
    const pendingRef = React.useRef(false);
    const loading = props.loading === true || pending;
    const { onPress, action } = props;
    const press = React.useCallback((event?: unknown) => {
        if (loading || pendingRef.current) return;
        if (onPress) {
            onPress(event);
            return;
        }
        if (action) {
            pendingRef.current = true;
            setPending(true);
            (async () => {
                try {
                    await action();
                } finally {
                    pendingRef.current = false;
                    setPending(false);
                }
            })();
        }
    }, [loading, onPress, action]);
    return { loading, press };
}
