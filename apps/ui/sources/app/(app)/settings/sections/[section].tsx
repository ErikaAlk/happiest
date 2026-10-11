import * as React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';

import { SettingsView } from '@/components/settings/SettingsView';
import { SETTINGS_SECTIONS } from '@/components/settings/SettingsSectionContent';
import { t } from '@/text';

export default function SettingsSectionScreen() {
    const params = useLocalSearchParams<{ section: string }>();
    const section = SETTINGS_SECTIONS.find((entry) => entry.id === params.section);
    if (!section) throw new Error(`Unknown settings section: ${params.section}`);
    return <>
        <Stack.Screen options={{ title: t(section.titleKey), headerTitle: t(section.titleKey) }} />
        <SettingsView section={section.id} />
    </>;
}
