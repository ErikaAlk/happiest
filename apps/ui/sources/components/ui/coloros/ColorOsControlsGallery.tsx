import * as React from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { FAB } from '@/components/ui/buttons/FAB';
import { RoundButton } from '@/components/ui/buttons/RoundButton';
import { EmptyState } from '@/components/ui/empty/EmptyState';
import { ActivitySpinner } from '@/components/ui/feedback/ActivitySpinner';
import { CheckboxMark } from '@/components/ui/forms/CheckboxMark';
import { Slider } from '@/components/ui/forms/Slider';
import { Switch } from '@/components/ui/forms/Switch';
import { Icon } from '@/components/ui/icons/Icon';
import { Item } from '@/components/ui/lists/Item';
import { ItemGroup } from '@/components/ui/lists/ItemGroup';
import { ItemList } from '@/components/ui/lists/ItemList';
import { MeterBar } from '@/components/ui/lists/MeterBar';
import { TabBar, type TabBarAccessory, type TabType } from '@/components/ui/navigation/TabBar';
import { TabBadge } from '@/components/ui/navigation/tabBadge/TabBadge';
import { Modal } from '@/modal';
import { t } from '@/text';

import { ColorOsNativeOnlyDemos } from './ColorOsNativeOnlyDemos';

const SLIDER_STEPS = 15;

const styles = StyleSheet.create((theme) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    meters: {
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    badgeAnchor: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: theme.colors.surface.pressedOverlay,
    },
    fabArea: {
        height: 120,
    },
    buttons: {
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkbox: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slider: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
}));

/**
 * Every control that has a ColorOS UI kit implementation, rendered through the shared props
 * contracts that screens use. On Android each control is the kit's Compose component hosted as a
 * native view; elsewhere it is the React Native implementation. Used for device QA of light/dark,
 * large text and reduced motion.
 */
export function ColorOsControlsGallery() {
    const { theme } = useUnistyles();
    const [analytics, setAnalytics] = React.useState(true);
    const [crashReports, setCrashReports] = React.useState(false);
    const [compact, setCompact] = React.useState(true);
    const [spinning, setSpinning] = React.useState(true);
    const [lastDialogResult, setLastDialogResult] = React.useState<string | null>(null);
    const [buttonLoading, setButtonLoading] = React.useState(false);
    const [chipChecked, setChipChecked] = React.useState(false);
    const [ringChecked, setRingChecked] = React.useState(true);
    const [sliderValue, setSliderValue] = React.useState(5 / SLIDER_STEPS);
    const [activeTab, setActiveTab] = React.useState<TabType>('sessions');
    const sliderPercent = Math.round((0.75 + sliderValue * 0.75) * 100);

    const tabAccessory = React.useMemo((): TabBarAccessory => ({
        testID: 'coloros-gallery:tab-bar:accessory',
        accessibilityLabel: t('common.add'),
        icon: 'plus',
        onPress: () => setLastDialogResult(t('common.add')),
    }), []);
    const runSlowAction = React.useCallback(() => new Promise<void>((resolve) => setTimeout(resolve, 2000)), []);
    const snapSlider = React.useCallback((value: number) => {
        setSliderValue(Math.round(value * SLIDER_STEPS) / SLIDER_STEPS);
    }, []);

    const showConfirm = React.useCallback(async () => {
        const confirmed = await Modal.confirm(t('common.delete'), t('common.unsavedChangesWarning'), { destructive: true, confirmText: t('common.delete') });
        setLastDialogResult(confirmed ? t('common.yes') : t('common.no'));
    }, []);
    const showAlert = React.useCallback(() => {
        Modal.alert(t('common.info'), t('common.comingSoon'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.ok'), onPress: () => setLastDialogResult(t('common.ok')) },
        ]);
    }, []);

    return (
        <ItemList testID="coloros-gallery">
            <ItemGroup title="Switch">
                <Item
                    title={t('settingsAccount.analytics')}
                    detail={analytics ? t('common.on') : t('common.off')}
                    rightElement={(
                        <Switch
                            testID="coloros-gallery:switch:analytics"
                            value={analytics}
                            onValueChange={setAnalytics}
                            accessibilityLabel={t('settingsAccount.analytics')}
                        />
                    )}
                    showChevron={false}
                />
                <Item
                    title={t('settingsAccount.crashReports')}
                    detail={crashReports ? t('common.on') : t('common.off')}
                    rightElement={(
                        <Switch
                            testID="coloros-gallery:switch:crash-reports"
                            value={crashReports}
                            onValueChange={setCrashReports}
                            accessibilityLabel={t('settingsAccount.crashReports')}
                        />
                    )}
                    showChevron={false}
                />
                <Item
                    title={t('common.disabled')}
                    rightElement={<Switch testID="coloros-gallery:switch:disabled" value disabled onValueChange={setAnalytics} />}
                    showChevron={false}
                />
                <Item
                    title={t('common.default')}
                    rightElement={<Switch testID="coloros-gallery:switch:display-only" value={analytics} />}
                    showChevron={false}
                />
                <Item
                    title={t('common.collapse')}
                    rightElement={<Switch testID="coloros-gallery:switch:compact" compact value={compact} onValueChange={setCompact} />}
                    showChevron={false}
                />
            </ItemGroup>

            <ItemGroup title="ActivitySpinner">
                <View style={styles.row}>
                    <ActivitySpinner testID="coloros-gallery:spinner:small" size="small" animationEnabled={spinning} accessibilityLabel={t('common.loading')} />
                    <ActivitySpinner testID="coloros-gallery:spinner:large" size="large" animationEnabled={spinning} />
                    <ActivitySpinner testID="coloros-gallery:spinner:numeric" size={14} animationEnabled={spinning} />
                </View>
                <Item
                    title={t('common.start')}
                    rightElement={<Switch testID="coloros-gallery:spinner:toggle" value={spinning} onValueChange={setSpinning} />}
                    showChevron={false}
                />
            </ItemGroup>

            <ItemGroup title="MeterBar">
                <View style={styles.meters}>
                    <MeterBar testID="coloros-gallery:meter:neutral" tone="neutral" fillFraction={0.35} caption="35%" progressAccessibilityLabel={t('common.loading')} />
                    <MeterBar testID="coloros-gallery:meter:warning" tone="warning" fillFraction={0.72} height={6} />
                    <MeterBar testID="coloros-gallery:meter:danger" tone="danger" fillFraction={0.96} height={2} />
                </View>
            </ItemGroup>

            <ItemGroup title="TabBadge">
                <View style={styles.row}>
                    <View style={styles.badgeAnchor}><TabBadge testID="coloros-gallery:badge:dot" variant="dot" /></View>
                    <View style={styles.badgeAnchor}><TabBadge testID="coloros-gallery:badge:count" variant="count" value={7} /></View>
                    <View style={styles.badgeAnchor}><TabBadge testID="coloros-gallery:badge:large-count" variant="count" value={1234} /></View>
                    <View style={styles.badgeAnchor}><TabBadge testID="coloros-gallery:badge:neutral" variant="count" tone="neutral" value={3} /></View>
                </View>
            </ItemGroup>

            <ItemGroup title="EmptyState">
                <EmptyState
                    testID="coloros-gallery:empty"
                    icon={<Icon name="check-circle" size={29} color={theme.colors.state.success.foreground} />}
                    title={t('common.noMatches')}
                    subtitle={t('common.comingSoon')}
                    action={{ label: t('common.retry'), onPress: () => setLastDialogResult(t('common.retry')), testID: 'coloros-gallery:empty:action' }}
                />
            </ItemGroup>

            <ItemGroup title="Dialog" footer={lastDialogResult ?? undefined}>
                <Item testID="coloros-gallery:dialog:confirm" title={t('common.delete')} onPress={showConfirm} />
                <Item testID="coloros-gallery:dialog:alert" title={t('common.info')} onPress={showAlert} />
            </ItemGroup>

            <ItemGroup title="RoundButton" footer={lastDialogResult ?? undefined}>
                <View style={styles.buttons}>
                    <RoundButton testID="coloros-gallery:button:primary" title={t('common.save')} onPress={() => setLastDialogResult(t('common.save'))} />
                    <View style={styles.buttonRow}>
                        <RoundButton testID="coloros-gallery:button:small" size="small" title={t('common.continue')} onPress={() => setLastDialogResult(t('common.continue'))} />
                        <RoundButton testID="coloros-gallery:button:text" size="small" display="inverted" title={t('common.cancel')} onPress={() => setLastDialogResult(t('common.cancel'))} />
                        <RoundButton testID="coloros-gallery:button:disabled" size="small" title={t('common.disabled')} disabled />
                    </View>
                    <RoundButton
                        testID="coloros-gallery:button:leading"
                        title={t('common.add')}
                        leading={<Icon name="plus" size={18} color={theme.colors.button.primary.tint} />}
                        style={{ width: '100%' }}
                        onPress={() => setLastDialogResult(t('common.add'))}
                    />
                    <RoundButton testID="coloros-gallery:button:action" title={t('common.retry')} action={runSlowAction} />
                    <RoundButton
                        testID="coloros-gallery:button:content-icons"
                        title={t('common.add')}
                        leading={<Icon name="plus" size={18} color={theme.colors.button.primary.tint} />}
                        trailing={<Icon name="plus" size={18} color={theme.colors.button.primary.tint} />}
                        onPress={() => setLastDialogResult(t('common.add'))}
                    />
                    <RoundButton
                        testID="coloros-gallery:button:loading"
                        size="small"
                        title={t('common.loading')}
                        loading={buttonLoading}
                        onPress={() => setLastDialogResult(t('common.loading'))}
                    />
                </View>
                <Item
                    title={t('common.loading')}
                    rightElement={<Switch testID="coloros-gallery:button:loading-toggle" value={buttonLoading} onValueChange={setButtonLoading} />}
                    showChevron={false}
                />
            </ItemGroup>

            <ItemGroup title="CheckboxMark">
                <View style={styles.row}>
                    <Pressable
                        testID="coloros-gallery:checkbox:chip"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: chipChecked }}
                        accessibilityLabel={t('common.all')}
                        onPress={() => setChipChecked((checked) => !checked)}
                        style={styles.checkbox}
                    >
                        {({ pressed }) => <CheckboxMark appearance="chip" checked={chipChecked} pressed={pressed} />}
                    </Pressable>
                    <Pressable
                        testID="coloros-gallery:checkbox:ring"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: ringChecked }}
                        accessibilityLabel={t('common.default')}
                        onPress={() => setRingChecked((checked) => !checked)}
                        style={styles.checkbox}
                    >
                        <CheckboxMark appearance="ring" checked={ringChecked} />
                    </Pressable>
                </View>
            </ItemGroup>

            <ItemGroup title="Slider" footer={`${sliderPercent}%`}>
                <View style={styles.slider}>
                    <Slider
                        testID="coloros-gallery:slider"
                        value={sliderValue}
                        steps={SLIDER_STEPS}
                        onValueChange={snapSlider}
                        accessibilityLabel={t('common.default')}
                        accessibilityValueText={`${sliderPercent}%`}
                    />
                </View>
            </ItemGroup>

            <ItemGroup title="TabBar" footer={activeTab}>
                <TabBar activeTab={activeTab} onTabPress={setActiveTab} trailingAccessory={tabAccessory} />
            </ItemGroup>

            <ColorOsNativeOnlyDemos onResult={setLastDialogResult} />

            <ItemGroup title="FAB">
                <View style={styles.fabArea}>
                    <FAB onPress={() => setLastDialogResult(t('common.add'))} />
                </View>
            </ItemGroup>
        </ItemList>
    );
}
