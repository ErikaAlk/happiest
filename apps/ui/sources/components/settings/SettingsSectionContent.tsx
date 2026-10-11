import { View, Platform, Linking } from 'react-native';
import * as React from 'react';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/ui/lists/Item';
import { ItemGroup } from '@/components/ui/lists/ItemGroup';
import { t } from '@/text';
import { trackWhatsNewClicked } from '@/track';
import { requestReview } from '@/utils/system/requestReview';
import { ICON_SIZE, Icon } from '@/components/ui/icons/Icon';
import { productLinks } from '@/constants/productLinks';
import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

type SettingsSectionRouter = ReturnType<typeof useRouter>;
type SettingsSectionTheme = ReturnType<typeof useUnistyles>['theme'];

export const SETTINGS_SECTIONS = [
    { id: 'agents', titleKey: 'settings.aiAndAgents', entryTitleKey: 'settings.moreAgentSettings', icon: 'sparkle' },
    { id: 'sessions', titleKey: 'settings.sessionsBehavior', entryTitleKey: 'settings.moreSessionSettings', icon: 'chats-circle' },
    { id: 'files', titleKey: 'settings.filesAndSourceControl', entryTitleKey: 'settings.moreFileSettings', icon: 'folder' },
    { id: 'system', titleKey: 'settings.system', entryTitleKey: 'settings.moreSystemSettings', icon: 'sliders-horizontal' },
    { id: 'about', titleKey: 'settings.about', entryTitleKey: 'settings.about', icon: 'info' },
] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number]['id'];

type SettingsSectionContentProps = Readonly<{
    appVersion: string;
    attachmentsUploadsEnabled: boolean;
    automationsNeedLocalEnablement: boolean;
    connectedServicesEnabled: boolean;
    devModeEnabled: boolean;
    executionRunsEnabled: boolean;
    handleGitHub: () => void | Promise<void>;
    handleReportIssue: () => void | Promise<void>;
    handleVersionClick: () => void;
    mcpServersEnabled: boolean;
    memorySearchEnabled: boolean;
    promptsLibraryEnabled: boolean;
    router: SettingsSectionRouter;
    showAutomations: boolean;
    showChangelog: boolean;
    showRateUs: boolean;
    sourceControlEnabled: boolean;
    terminalUseTmux: boolean | null | undefined;
    theme: SettingsSectionTheme;
    useProfiles: boolean | null | undefined;
    voiceEnabled: boolean;
    section: SettingsSection;
}>;

export const SettingsSectionContent = React.memo(function SettingsSectionContent({
    appVersion,
    attachmentsUploadsEnabled,
    automationsNeedLocalEnablement,
    connectedServicesEnabled,
    devModeEnabled,
    executionRunsEnabled,
    handleGitHub,
    handleReportIssue,
    handleVersionClick,
    mcpServersEnabled,
    memorySearchEnabled,
    promptsLibraryEnabled,
    router,
    showAutomations,
    showChangelog,
    showRateUs,
    sourceControlEnabled,
    terminalUseTmux,
    theme,
    useProfiles,
    voiceEnabled,
    section,
}: SettingsSectionContentProps) {
    return (
        <>
            {section === 'agents' ? (
                <SettingsAiAndAgentsSection
                    connectedServicesEnabled={connectedServicesEnabled}
                    mcpServersEnabled={mcpServersEnabled}
                    memorySearchEnabled={memorySearchEnabled}
                    promptsLibraryEnabled={promptsLibraryEnabled}
                    router={router}
                    theme={theme}
                    useProfiles={useProfiles}
                    voiceEnabled={voiceEnabled}
                />
            ) : null}
            {section === 'sessions' ? (
                <SettingsSessionsBehaviorSection
                    automationsNeedLocalEnablement={automationsNeedLocalEnablement}
                    executionRunsEnabled={executionRunsEnabled}
                    router={router}
                    showAutomations={showAutomations}
                    terminalUseTmux={terminalUseTmux}
                    theme={theme}
                />
            ) : null}
            {section === 'files' ? (
                <>
                    <SettingsFilesAndSourceControlSection
                        attachmentsUploadsEnabled={attachmentsUploadsEnabled}
                        router={router}
                        sourceControlEnabled={sourceControlEnabled}
                        theme={theme}
                    />
                </>
            ) : null}
            {section === 'system' ? (
                <>
                    <SettingsSystemSection router={router} theme={theme} />
                    <SettingsDeveloperSection devModeEnabled={devModeEnabled} router={router} theme={theme} />
                </>
            ) : null}
            {section === 'about' ? (
                <SettingsAboutSection
                    appVersion={appVersion}
                    handleGitHub={handleGitHub}
                    handleReportIssue={handleReportIssue}
                    handleVersionClick={handleVersionClick}
                    router={router}
                    showChangelog={showChangelog}
                    showRateUs={showRateUs}
                    theme={theme}
                />
            ) : null}
        </>
    );
});

type SettingsAiAndAgentsSectionProps = Readonly<Pick<SettingsSectionContentProps,
    | 'connectedServicesEnabled'
    | 'mcpServersEnabled'
    | 'memorySearchEnabled'
    | 'promptsLibraryEnabled'
    | 'router'
    | 'theme'
    | 'useProfiles'
    | 'voiceEnabled'
>>;

const SettingsAiAndAgentsSection = React.memo(function SettingsAiAndAgentsSection({
    connectedServicesEnabled,
    mcpServersEnabled,
    memorySearchEnabled,
    promptsLibraryEnabled,
    router,
    theme,
    useProfiles,
    voiceEnabled,
}: SettingsAiAndAgentsSectionProps) {
    return (
        <ItemGroup>
            <Item
                title={t('settingsProviders.title')}
                icon={<Icon name="sparkle" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/providers')}
            />
            <Item
                title={t('subAgentGuidance.settings.groupTitle')}
                icon={(
                    <View style={{ width: 29, height: 29, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="robot" size={ICON_SIZE.lg} color={theme.colors.text.secondary} />
                    </View>
                )}
                onPress={() => router.push('/settings/sub-agent')}
            />
            {useProfiles && (
                <Item
                    title={t('settings.profiles')}
                    icon={<Icon name="person" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/profiles')}
                />
            )}
            {connectedServicesEnabled ? (
                <Item
                    title={t('settings.connectedServices')}
                    icon={<Icon name="key" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/connected-services')}
                />
            ) : null}
            {mcpServersEnabled && (
                <Item
                    testID="settings-mcp-servers-item"
                    title={t('settings.mcpServers')}
                    icon={<Icon name="puzzle-piece" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/mcp')}
                />
            )}
            {promptsLibraryEnabled ? (
                <Item
                    title={t('settings.prompts')}
                    icon={<Icon name="books" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/prompts')}
                />
            ) : null}
            {voiceEnabled ? (
                <Item
                    title={t('settings.voiceAssistant')}
                    icon={<Icon name="microphone" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/voice')}
                />
            ) : null}
            {memorySearchEnabled ? (
                <Item
                    title={t('settings.memorySearch')}
                    icon={<Icon name="magnifying-glass" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/memory')}
                />
            ) : null}
        </ItemGroup>
    );
});

type SettingsSessionsBehaviorSectionProps = Readonly<Pick<SettingsSectionContentProps,
    | 'automationsNeedLocalEnablement'
    | 'executionRunsEnabled'
    | 'router'
    | 'showAutomations'
    | 'terminalUseTmux'
    | 'theme'
>>;

const SettingsSessionsBehaviorSection = React.memo(function SettingsSessionsBehaviorSection({
    automationsNeedLocalEnablement,
    executionRunsEnabled,
    router,
    showAutomations,
    terminalUseTmux,
    theme,
}: SettingsSessionsBehaviorSectionProps) {
    return (
        <ItemGroup>
            <Item
                title={t('settings.sessions')}
                detail={terminalUseTmux ? 'tmux' : undefined}
                icon={<Icon name="terminal" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/session')}
            />
            <Item
                title={t('common.actions')}
                icon={<Icon name="lightning" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/actions')}
            />
            <Item
                title={t('settings.transcript')}
                icon={<Icon name="chats-circle" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/session/transcript')}
            />
            <Item
                title={t('settings.permissions')}
                icon={<Icon name="shield" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/session/permissions')}
            />
            {showAutomations ? (
                <Item
                    title={t('settings.automations')}
                    subtitle={automationsNeedLocalEnablement ? t('settingsFeatures.expAutomationsSubtitle') : undefined}
                    icon={<Icon name="timer" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push(automationsNeedLocalEnablement ? '/settings/features' : '/automations')}
                />
            ) : null}
            {executionRunsEnabled ? (
                <Item
                    title={t('runs.title')}
                    icon={<Icon name="play" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/runs')}
                />
            ) : null}
        </ItemGroup>
    );
});

type SettingsFilesAndSourceControlSectionProps = Readonly<Pick<SettingsSectionContentProps,
    | 'attachmentsUploadsEnabled'
    | 'router'
    | 'sourceControlEnabled'
    | 'theme'
>>;

const SettingsFilesAndSourceControlSection = React.memo(function SettingsFilesAndSourceControlSection({
    attachmentsUploadsEnabled,
    router,
    sourceControlEnabled,
    theme,
}: SettingsFilesAndSourceControlSectionProps) {
    return (
        <ItemGroup>
            {sourceControlEnabled ? (
                <Item
                    title={t('settings.filesSourceControl')}
                    icon={<Icon name="git-branch" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/source-control')}
                />
            ) : null}
            {attachmentsUploadsEnabled ? (
                <Item
                    title={t('settings.attachments')}
                    icon={<Icon name="paperclip" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/attachments')}
                />
            ) : null}
        </ItemGroup>
    );
});

type SettingsSystemSectionProps = Readonly<Pick<SettingsSectionContentProps, 'router' | 'theme'>>;

const SettingsSystemSection = React.memo(function SettingsSystemSection({ router, theme }: SettingsSystemSectionProps) {
    return (
        <ItemGroup title={t('settings.system')}>
            <Item
                title={t('settings.servers')}
                icon={<Icon name="hard-drives" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/server')}
            />
            <Item
                testID="settings-system-status-item"
                title={t('settings.systemStatus')}
                icon={<Icon name="pulse" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/system-status')}
            />
            <Item
                title={t('settings.notifications')}
                icon={<Icon name="bell" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/notifications')}
            />
        </ItemGroup>
    );
});

type SettingsDeveloperSectionProps = Readonly<Pick<SettingsSectionContentProps,
    | 'devModeEnabled'
    | 'router'
    | 'theme'
>>;

const SettingsDeveloperSection = React.memo(function SettingsDeveloperSection({
    devModeEnabled,
    router,
    theme,
}: SettingsDeveloperSectionProps) {
    if (!__DEV__ && !devModeEnabled) return null;

    return (
        <ItemGroup title={t('settings.developer')}>
            <Item
                title={t('settings.developerTools')}
                icon={<Icon name="wrench" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/(app)/dev')}
            />
        </ItemGroup>
    );
});

type SettingsAboutSectionProps = Readonly<Pick<SettingsSectionContentProps,
    | 'appVersion'
    | 'handleGitHub'
    | 'handleReportIssue'
    | 'handleVersionClick'
    | 'router'
    | 'showChangelog'
    | 'showRateUs'
    | 'theme'
>>;

const SettingsAboutSection = React.memo(function SettingsAboutSection({
    appVersion,
    handleGitHub,
    handleReportIssue,
    handleVersionClick,
    router,
    showChangelog,
    showRateUs,
    theme,
}: SettingsAboutSectionProps) {
    return (
        <ItemGroup>
            {showChangelog ? (
                <Item
                    title={t('settings.whatsNew')}
                    icon={<Icon name="sparkle" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => {
                        trackWhatsNewClicked();
                        router.push('/(app)/changelog');
                    }}
                />
            ) : null}
            {showRateUs ? (
                <Item
                    title={t('settings.rateUs')}
                    icon={<Icon name="star" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => {
                        void requestReview();
                    }}
                />
            ) : null}
            <Item
                title={t('settings.github')}
                icon={<Icon name="github-logo" size={29} color={theme.colors.text.primary} />}
                subtitle={productIdentity.githubRepo}
                onPress={handleGitHub}
            />
            <Item
                title={t('settings.reportIssue')}
                icon={<Icon name="bug" size={29} color={theme.colors.state.danger.foreground} />}
                onPress={handleReportIssue}
            />
            <Item
                title={t('settings.privacyPolicy')}
                icon={<Icon name="shield-check" size={29} color={theme.colors.text.secondary} />}
                onPress={async () => {
                    const url = productLinks.docsPage('legal/privacy');
                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                        await Linking.openURL(url);
                    }
                }}
            />
            <Item
                title={t('settings.termsOfService')}
                icon={<Icon name="file-text" size={29} color={theme.colors.text.secondary} />}
                onPress={async () => {
                    const url = productLinks.docsPage('legal/terms');
                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                        await Linking.openURL(url);
                    }
                }}
            />
            {Platform.OS === 'ios' && (
                <Item
                    title={t('settings.eula')}
                    icon={<Icon name="file-text" size={29} color={theme.colors.text.secondary} />}
                    onPress={async () => {
                        const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
                        const supported = await Linking.canOpenURL(url);
                        if (supported) {
                            await Linking.openURL(url);
                        }
                    }}
                />
            )}
            <Item
                title={t('common.version')}
                detail={appVersion}
                icon={<Icon name="info" size={29} color={theme.colors.text.secondary} />}
                onPress={handleVersionClick}
                showChevron={false}
            />
        </ItemGroup>
    );
});
