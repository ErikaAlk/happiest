import type * as React from 'react';
import type { ViewInstance } from 'react-native';

export type SessionReminderPickerProps = Readonly<{
    mode: 'date' | 'time';
    anchorRef: React.RefObject<ViewInstance | null>;
    value: Date;
    minimumDate: Date;
    accentColor: string;
    onChange: (value: Date) => void;
    onDismiss: () => void;
}>;

export function SessionReminderPicker(_props: SessionReminderPickerProps) { return null; }
