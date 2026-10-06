import * as React from 'react';
import { Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { TranscriptSelectableMessageRole } from './_types';
import { formatMessageSelectionRowAccessibilityLabel } from './messageSelectionAccessibility';
import { useOptionalTranscriptSelectionRow } from './TranscriptMessageSelectionContext';
import { CheckboxMark } from '@/components/ui/forms/CheckboxMark';

export function MessageSelectionCheckbox(props: Readonly<{
    messageId: string;
    role: TranscriptSelectableMessageRole;
    previewText: string;
    testID?: string;
}>): React.ReactElement | null {
    const row = useOptionalTranscriptSelectionRow(props.messageId);
    if (!row.isSelectionMode) return null;

    const accessibilityLabel = formatMessageSelectionRowAccessibilityLabel({
        role: props.role,
        previewText: props.previewText,
    });

    return (
        <Pressable
            testID={props.testID}
            onPress={row.toggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: row.isSelected }}
            accessibilityLabel={accessibilityLabel}
            hitSlop={10}
            style={styles.checkbox}
        >
            {({ pressed }) => <CheckboxMark appearance="chip" checked={row.isSelected} pressed={pressed} />}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    checkbox: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 32,
        minWidth: 32,
        marginRight: 6,
    },
});
