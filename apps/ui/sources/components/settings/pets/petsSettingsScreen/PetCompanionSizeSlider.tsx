import * as React from 'react';
import { View, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Typography } from '@/constants/Typography';
import { Slider } from '@/components/ui/forms/Slider';
import { Text } from '@/components/ui/text/Text';
import {
    PET_COMPANION_SIZE_SCALE_STEPS,
    petCompanionSizeScaleFromProgress,
    petCompanionSizeScaleToPercent,
    petCompanionSizeScaleToProgress,
} from '@/sync/domains/pets/companionSizeScale';
import { t } from '@/text';

type PetCompanionSizeSliderProps = Readonly<{
    value: number;
    onValueChange: (value: number) => void;
}>;

export function PetCompanionSizeSlider(props: PetCompanionSizeSliderProps): React.ReactElement {
    const { theme } = useUnistyles();
    const percent = petCompanionSizeScaleToPercent(props.value);
    const valueText = t('settingsPets.companionSizeValue', { percent });
    const { onValueChange } = props;
    const handleProgressChange = React.useCallback((progress: number) => {
        onValueChange(petCompanionSizeScaleFromProgress(progress));
    }, [onValueChange]);

    return (
        <View testID="settings-pets-companion-size-slider" style={styles.row}>
            <View style={styles.header}>
                <View style={styles.copy}>
                    <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text.primary }]}>
                        {t('settingsPets.companionSizeTitle')}
                    </Text>
                    <Text numberOfLines={2} style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
                        {t('settingsPets.companionSizeSubtitle')}
                    </Text>
                </View>
                <Text
                    testID="settings-pets-companion-size-slider-value"
                    style={[styles.value, { color: theme.colors.text.secondary }]}
                >
                    {valueText}
                </Text>
            </View>
            <Slider
                testID="settings-pets-companion-size-slider-track"
                value={petCompanionSizeScaleToProgress(props.value)}
                steps={PET_COMPANION_SIZE_SCALE_STEPS}
                onValueChange={handleProgressChange}
                accessibilityLabel={t('settingsPets.companionSizeTitle')}
                accessibilityValueText={valueText}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        gap: 10,
    } satisfies ViewStyle,
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 14,
        justifyContent: 'space-between',
    },
    copy: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        ...Typography.default('semiBold'),
        fontSize: 15,
        lineHeight: 20,
    },
    subtitle: {
        ...Typography.default('regular'),
        fontSize: 13,
        lineHeight: 18,
    },
    value: {
        ...Typography.default('semiBold'),
        fontSize: 13,
        fontVariant: ['tabular-nums'],
        lineHeight: 18,
    },
});
