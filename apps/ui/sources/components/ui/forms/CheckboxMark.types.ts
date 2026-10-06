/**
 * The visible mark of a checkbox whose press and accessibility belong to the pressable around it.
 * `CheckboxMark.tsx` draws it on iOS, web and desktop; `CheckboxMark.android.tsx` is the ColorOS UI
 * kit check box.
 */
export type CheckboxMarkProps = Readonly<{
    checked: boolean;
    /**
     * iOS, web and desktop only; Android always draws the ColorOS check box. `chip`: a square check
     * inside a tinted round chip (transcript message selection). `ring`: a ring that fills with a
     * check (session list selection).
     */
    appearance: 'chip' | 'ring';
    /** The surrounding pressable's pressed state; the chip darkens while pressed. */
    pressed?: boolean;
    testID?: string;
}>;
