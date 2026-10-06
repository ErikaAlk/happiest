import * as React from 'react';
import { View, type NativeSyntheticEvent } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/ui/icons/Icon';
import { t } from '@/text';

import {
    CoCategoryFooterNative,
    CoCategoryTitleNative,
    CoListItemNative,
    CoTopBarNative,
    type CoCardPosition,
    type CoListItemNativeProps,
} from './colorOsNativeViews';
import { ColorOsSlot } from './ColorOsSlot';
import { useColorOsHostEnvironment } from './useColorOsHostEnvironment';

type DemoRow = Readonly<{
    key: string;
    title: string;
    summary?: string;
    trailing: CoListItemNativeProps['trailing'];
    statusText?: string;
    trailingArrow?: boolean;
    selected?: boolean;
    destructive?: boolean;
    enabled?: boolean;
    leadingIcon?: 'gear' | 'trash';
}>;

function rowPosition(index: number, count: number): CoCardPosition {
    if (count === 1) return 'full';
    if (index === 0) return 'head';
    return index === count - 1 ? 'tail' : 'middle';
}

/**
 * The kit's top bar and list rows, which screens do not use yet: the top bar waits for the page
 * reorganization, and `Item` / `ItemGroup` carry content the kit's rows cannot express. Shown here
 * for visual confirmation only.
 */
export function ColorOsNativeOnlyDemos(props: Readonly<{ onResult: (result: string) => void }>): React.ReactElement {
    const environment = useColorOsHostEnvironment();
    const { theme } = useUnistyles();
    const { onResult } = props;
    const [switchChecked, setSwitchChecked] = React.useState(true);

    const rows: ReadonlyArray<DemoRow> = [
        { key: 'arrow', title: t('common.edit'), trailing: 'arrow', leadingIcon: 'gear' },
        { key: 'status', title: t('common.default'), summary: t('common.comingSoon'), trailing: 'status', statusText: t('common.on'), trailingArrow: true },
        { key: 'switch', title: t('common.enabled'), trailing: 'switch' },
        { key: 'selected', title: t('common.all'), trailing: 'none', selected: true },
        { key: 'disabled', title: t('common.disabled'), trailing: 'arrow', enabled: false },
        { key: 'destructive', title: t('common.delete'), trailing: 'none', destructive: true, leadingIcon: 'trash' },
    ];

    return (
        <View>
            <CoTopBarNative
                {...environment}
                testID="coloros-gallery:top-bar"
                title={t('common.details')}
                backDescription={t('common.back')}
                actions={[
                    { contentDescription: t('common.add'), enabled: true },
                    { contentDescription: t('common.done'), text: t('common.done'), enabled: true },
                ]}
                onBack={() => onResult(t('common.back'))}
                onAction={(event: NativeSyntheticEvent<{ index: number }>) => onResult(event.nativeEvent.index === 0 ? t('common.add') : t('common.done'))}
            >
                <ColorOsSlot><Icon name="plus" size={24} color={theme.colors.text.primary} /></ColorOsSlot>
            </CoTopBarNative>

            <CoCategoryTitleNative {...environment} text={t('common.files')} />
            {rows.map((row, index) => (
                <CoListItemNative
                    {...environment}
                    key={row.key}
                    testID={`coloros-gallery:list:${row.key}`}
                    title={row.title}
                    summary={row.summary}
                    position={rowPosition(index, rows.length)}
                    trailing={row.trailing}
                    statusText={row.statusText}
                    trailingArrow={row.trailingArrow ?? false}
                    switchChecked={switchChecked}
                    hasLeading={row.leadingIcon !== undefined}
                    enabled={row.enabled ?? true}
                    selected={row.selected ?? false}
                    destructive={row.destructive ?? false}
                    // The row above a selected row hides its divider (COUI).
                    showDivider={rows[index + 1]?.selected !== true}
                    pressable={row.trailing !== 'switch'}
                    longPressable={row.key === 'arrow'}
                    onPress={() => onResult(row.title)}
                    onLongPress={() => onResult(`${row.title} · ${t('common.moreActions')}`)}
                    onSwitchChange={(event: NativeSyntheticEvent<{ checked: boolean }>) => setSwitchChecked(event.nativeEvent.checked)}
                >
                    {row.leadingIcon ? (
                        <ColorOsSlot><Icon name={row.leadingIcon} size={24} color={theme.colors.text.primary} /></ColorOsSlot>
                    ) : null}
                </CoListItemNative>
            ))}
            <CoCategoryFooterNative {...environment} text={t('common.unsavedChangesWarning')} />
        </View>
    );
}
