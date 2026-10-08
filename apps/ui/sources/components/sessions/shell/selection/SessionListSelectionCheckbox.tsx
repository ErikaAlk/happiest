import * as React from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { CheckboxMark } from '@/components/ui/forms/CheckboxMark';
import { t } from '@/text';

import { useOptionalSessionListSelectionRow } from './SessionListSelectionContext';

const stylesheet = StyleSheet.create({
    root: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export type SessionListSelectionCheckboxProps = Readonly<{
    sessionId: string;
    selectionKey: string;
    selected?: boolean;
    onPress?: (event?: GestureResponderEvent) => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}>;

export function SessionListSelectionCheckbox(props: SessionListSelectionCheckboxProps): React.ReactElement {
    const styles = stylesheet;
    const rowSelection = useOptionalSessionListSelectionRow(props.selectionKey);
    const selected = props.selected ?? rowSelection.isSelected;
    const handlePress = React.useCallback((event?: GestureResponderEvent) => {
        const maybeEvent = event as unknown as {
            stopPropagation?: () => void;
            preventDefault?: () => void;
        } | undefined;
        maybeEvent?.stopPropagation?.();
        if (props.onPress) {
            props.onPress(event);
            return;
        }
        rowSelection.toggle();
    }, [props.onPress, rowSelection]);

    return (
        <Pressable
            testID={`session-list-selection-checkbox-${props.sessionId}`}
            accessibilityRole="checkbox"
            accessibilityLabel={props.accessibilityLabel ?? t('sessionsList.selectionCheckboxA11yLabel')}
            accessibilityState={{ checked: selected }}
            {...({
                'aria-checked': selected ? 'true' : 'false',
                'data-selected': selected ? 'true' : 'false',
                'data-state': selected ? 'selected' : 'unselected',
                dataSet: {
                    selected: selected ? 'true' : 'false',
                    state: selected ? 'selected' : 'unselected',
                },
            } as Record<string, unknown>)}
            onPress={handlePress}
            style={[styles.root, props.style]}
        >
            <CheckboxMark
                appearance="ring"
                checked={selected}
                testID={`session-list-selection-checkbox-mark-${props.sessionId}`}
            />
        </Pressable>
    );
}
