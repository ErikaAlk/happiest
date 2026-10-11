import { View, Platform, Linking, useWindowDimensions } from 'react-native';
import * as React from 'react';
import { Text } from '@/components/ui/text/Text';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Item } from '@/components/ui/lists/Item';
import { ItemGroup } from '@/components/ui/lists/ItemGroup';
import { ItemList } from '@/components/ui/lists/ItemList';
import { useConnectTerminal } from '@/hooks/session/useConnectTerminal';
import { useAuth } from '@/auth/context/AuthContext';
import { useEntitlement, useLocalSettingMutable, useSetting, useProfile } from '@/sync/domains/state/storage';
import { sync } from '@/sync/sync';
import { trackPaywallButtonClicked } from '@/track';
import { Modal } from '@/modal';
import { useMultiClick } from '@/hooks/ui/useMultiClick';
import { useUnistyles } from 'react-native-unistyles';
import { layout } from '@/components/ui/layout/layout';
import { useHappyAction } from '@/hooks/ui/useHappyAction';
import { getDisplayName, getAvatarUrl, getBio } from '@/sync/domains/profiles/profile';
import { Avatar } from '@/components/ui/avatar/Avatar';
import { t } from '@/text';
import { canRequestReview } from '@/utils/system/requestReview';
import { DEFAULT_AGENT_ID, getAgentCore, resolveAgentIdFromConnectedServiceId } from '@/agents/catalog/catalog';
import { AgentIcon } from '@/agents/registry/AgentIcon';
import { resolveSupportUsAction } from '@/components/settings/supportUsBehavior';
import { recordBugReportUserAction } from '@/utils/system/bugReportActionTrail';
import { fireAndForget } from '@/utils/system/fireAndForget';
import { useAutomationsSupport } from '@/hooks/server/useAutomationsSupport';
import { useFeatureEnabled } from '@/hooks/server/useFeatureEnabled';
import { useScannedAuthUrlProcessor } from '@/hooks/auth/useScannedAuthUrlProcessor';
import type { FeatureId } from '@happier-dev/protocol';
import { getFeatureBuildPolicyDecision } from '@/sync/domains/features/featureBuildPolicy';
import { isRunningOnMac } from '@/utils/platform/platform';
import { isWebMobileLikeQrScannerHost } from '@/utils/platform/webMobileHeuristics';
import { navigateWithBlurOnWeb } from '@/utils/platform/navigateWithBlurOnWeb';
import { deferOnWeb } from '@/utils/platform/deferOnWeb';
import { isTauriDesktop } from '@/utils/platform/tauri';
import { DesktopSettingsSection } from '@/components/settings/desktop/DesktopSettingsSection';
import { SETTINGS_SECTIONS, SettingsSectionContent, type SettingsSection } from '@/components/settings/SettingsSectionContent';
import { Icon } from '@/components/ui/icons/Icon';
import { describeUpdatesSettingsSubtitle } from '@/components/updates/describeUpdatesSummary';
import { useSharedUpdatesSummary } from '@/updates/useUpdatesSummary';
import { productLinks } from '@/constants/productLinks';

export const SettingsView = React.memo(function SettingsView({ section }: { section?: SettingsSection }) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const auth = useAuth();
    const isPhoneSizedWeb = Platform.OS === 'web' && isWebMobileLikeQrScannerHost({ width, height });
    const [devModeEnabled, setDevModeEnabled] = useLocalSettingMutable('devModeEnabled');
    const voiceEntitlement = useEntitlement('voice');
    const isPro = __DEV__ || voiceEntitlement;
    const usageReportingEnabled = useFeatureEnabled('usage.reporting');
    const executionRunsEnabled = useFeatureEnabled('execution.runs');
    const connectedServicesEnabled = useFeatureEnabled('connectedServices');
    const memorySearchEnabled = useFeatureEnabled('memory.search');
    const voiceEnabled = useFeatureEnabled('voice');
    const sourceControlEnabled = useFeatureEnabled('scm.writeOperations');
    const attachmentsUploadsEnabled = useFeatureEnabled('attachments.uploads');
    const promptsLibraryEnabled = useFeatureEnabled('prompts.library');
    const mcpServersEnabled = useFeatureEnabled('mcp.servers');
    const petsCompanionEnabled = useFeatureEnabled('pets.companion');
    const petsSyncEnabled = useFeatureEnabled('pets.sync');
    const showChangelog = getFeatureBuildPolicyDecision('app.ui.changelog' as const satisfies FeatureId) !== 'deny';
    const [showRateUs, setShowRateUs] = React.useState(false);
    const useProfiles = useSetting('useProfiles');
    const terminalUseTmux = useSetting('sessionUseTmux');
    const automationsSupport = useAutomationsSupport();
    const showAutomations = automationsSupport?.discoverable !== false;
    const automationsNeedLocalEnablement = automationsSupport?.blockedBy === 'local_policy';
    const profile = useProfile();
    const displayName = getDisplayName(profile);
    const avatarUrl = getAvatarUrl(profile);
    const bio = getBio(profile);
    const updatesSubtitle = describeUpdatesSettingsSubtitle(useSharedUpdatesSummary());
    const pushRoute = React.useCallback((route: Parameters<typeof router.push>[0]) => {
        deferOnWeb(() => {
            navigateWithBlurOnWeb(() => {
                router.push(route);
            });
        });
    }, [router]);

    const anthropicAgentId = resolveAgentIdFromConnectedServiceId('anthropic') ?? DEFAULT_AGENT_ID;
    const anthropicAgentCore = getAgentCore(anthropicAgentId);

    const showHiddenSettingsButtons = devModeEnabled;
    const showDesktopSettings = isTauriDesktop();

    const { connectTerminal, isLoading } = useConnectTerminal();
    const { processAuthUrl: processScannedAuthUrl } = useScannedAuthUrlProcessor();

    useFocusEffect(
        React.useCallback(() => {
            fireAndForget(sync.refreshMachinesThrottled({ staleMs: 30_000 }), { tag: 'SettingsView.refreshMachinesThrottled' });
        }, [])
    );

    React.useEffect(() => {
        let cancelled = false;

        const refreshRateUsAvailability = async () => {
            let available = false;
            try {
                available = await canRequestReview();
            } catch {
                available = false;
            }
            if (!cancelled) {
                setShowRateUs(available);
            }
        };

        void refreshRateUsAvailability();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleGitHub = async () => {
        const url = productLinks.repository;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        }
    };

    const handleReportIssue = async () => {
        recordBugReportUserAction('settings.report_issue_open');
        const overrideUrl = String(process.env.EXPO_PUBLIC_HAPPIER_REPORT_ISSUE_URL ?? '').trim();
        if (overrideUrl.length > 0) {
            const supported = await Linking.canOpenURL(overrideUrl);
            if (supported) {
                await Linking.openURL(overrideUrl);
                return;
            }
        }
        pushRoute('/settings/report-issue');
    };

    const handleSubscribe = async () => {
        trackPaywallButtonClicked();
        const result = await sync.presentPaywall();
        if (!result.success) {
            Modal.alert(t('common.error'), result.error || t('errors.unknownError'));
        }
    };

    const handleSupportUs = async () => {
        const action = resolveSupportUsAction({ isPro });
        if (action === 'github') {
            await handleGitHub();
            return;
        }
        await handleSubscribe();
    };

    // Use the multi-click hook for version clicks
    const handleVersionClick = useMultiClick(() => {
        // Toggle dev mode
        const newDevMode = !devModeEnabled;
        setDevModeEnabled(newDevMode);
        Modal.alert(
            t('modals.developerMode'),
            newDevMode ? t('modals.developerModeEnabled') : t('modals.developerModeDisabled')
        );
    }, {
        requiredClicks: 10,
        resetTimeout: 2000,
    });

    // Connection status
    const isAnthropicConnected = profile.connectedServices?.includes('anthropic') || false;

    // Anthropic connection
    const [connectingAnthropic, connectAnthropic] = useHappyAction(async () => {
        const route = anthropicAgentCore.uiConnectedService.connectRoute;
        if (route) {
            pushRoute(route);
        }
    });

    const profileAndAccountSection = React.useMemo(() => (
        <ItemGroup title={t('settings.profileAndAccount')}>
            <Item
                title={t('settings.account')}
                icon={<Icon name="user-circle" size={29} color={theme.colors.text.secondary} />}
                onPress={() => router.push('/settings/account')}
            />
            {useProfiles && (
                <Item
                    title={t('settings.secrets')}
                    icon={<Icon name="key" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/secrets')}
                />
            )}
            {usageReportingEnabled && (
                <Item
                    title={t('settings.usage')}
                    icon={<Icon name="chart-line" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => router.push('/settings/usage')}
                />
            )}
            <Item
                title={t('settings.machines')}
                icon={<Icon name="desktop" size={29} color={theme.colors.text.secondary} />}
                onPress={() => pushRoute('/settings/machines')}
            />
        </ItemGroup>
    ), [
        pushRoute,
        router,
        theme.colors.text.secondary,
        usageReportingEnabled,
        useProfiles,
    ]);

    const generalSection = React.useMemo(() => (
        <ItemGroup title={t('settings.general')}>
            <Item
                testID="settings-updates-row"
                title={t('updates.title')}
                subtitle={updatesSubtitle}
                icon={<Icon name="arrow-circle-up" size={29} color={theme.colors.text.secondary} />}
                onPress={() => pushRoute('/settings/updates')}
            />
            <Item
                title={t('settings.appearance')}
                icon={<Icon name="palette" size={29} color={theme.colors.text.secondary} />}
                onPress={() => pushRoute('/settings/appearance')}
            />
            <Item
                title={t('settings.featuresTitle')}
                icon={<Icon name="flask" size={29} color={theme.colors.text.secondary} />}
                onPress={() => pushRoute('/settings/features')}
            />
            <Item
                testID="settings-keyboard-shortcuts-row"
                title={t('settingsKeyboard.title')}
                icon={<Icon name="squares-four" size={29} color={theme.colors.text.secondary} />}
                onPress={() => pushRoute('/settings/keyboard')}
            />
            {petsCompanionEnabled || petsSyncEnabled ? (
                <Item
                    testID="settings-pets-row"
                    title={t('settings.pets')}
                    icon={<Icon name="paw-print" size={29} color={theme.colors.text.secondary} />}
                    onPress={() => pushRoute('/settings/pets')}
                />
            ) : null}
        </ItemGroup>
    ), [
        updatesSubtitle,
        petsCompanionEnabled,
        petsSyncEnabled,
        pushRoute,
        theme.colors.text.secondary,
    ]);

    return (
        <ItemList testID={section ? `settings-list-${section}` : 'settings-list'} style={{ paddingTop: 0 }}>
            {!section ? (<>
            {profile.firstName ? (
                <View style={{ maxWidth: layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                <Avatar
                                    id={profile.id}
                                    size={48}
                                    imageUrl={avatarUrl}
                                    thumbhash={profile.avatar?.thumbhash}
                                />
                    <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 20, fontWeight: '600', color: theme.colors.text.primary }}>
                                {displayName}
                            </Text>
                            {bio && (
                                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 4 }}>
                                    {bio}
                                </Text>
                            )}
                    </View>
                </View>
            ) : null}

            {profileAndAccountSection}
            {generalSection}

            {/* Add your phone (desktop/web only) */}
            {(isRunningOnMac() || (Platform.OS === 'web' && !isPhoneSizedWeb)) &&
            auth.isAuthenticated ? (
                <ItemGroup>
                    <Item
                        testID="settings-add-your-phone-shortcut"
                        title={t('settings.addYourPhone')}
                        icon={<Icon name="device-mobile" size={29} color={theme.colors.text.secondary} />}
                        onPress={() => router.push('/settings/add-phone')}
                    />
                </ItemGroup>
            ) : null}

            {showDesktopSettings ? <DesktopSettingsSection /> : null}

            {/* Connect Terminal */}
            {!isRunningOnMac() && (Platform.OS !== 'web' || isPhoneSizedWeb) && (
                <ItemGroup>
                    <Item
                        testID="settings-connect-terminal-scan"
                        title={t('settingsAccount.linkNewDevice')}
                        icon={<Icon name="qr-code" size={29} color={theme.colors.text.secondary} />}
                        onPress={connectTerminal}
                        loading={isLoading}
                        showChevron={false}
                    />
                    <Item
                        testID="settings-connect-terminal-enter-url"
                        title={t('connect.enterUrlManually')}
                        icon={<Icon name="link" size={29} color={theme.colors.text.secondary} />}
                        onPress={async () => {
                            const url = await Modal.prompt(
                                t('connect.linkNewDeviceTitle'),
                                undefined,
                                {
                                    confirmText: t('common.continue'),
                                    cancelText: t('common.cancel'),
                                }
                            );
                            if (url?.trim()) {
                                processScannedAuthUrl(url.trim());
                            }
                        }}
                        showChevron={false}
                    />
                </ItemGroup>
            )}

            {/* Hidden / unfinished buttons (toggle via Developer Mode) */}
            {showHiddenSettingsButtons && (
                <>
                    {/* Support Us */}
                    <ItemGroup>
                        <Item
                            title={t('settings.supportUs')}
                            subtitle={isPro ? t('settings.supportUsSubtitlePro') : t('settings.supportUsSubtitle')}
                            icon={<Icon name="heart" size={29} color={theme.colors.state.danger.foreground} />}
                            showChevron={false}
                            onPress={handleSupportUs}
                        />
                    </ItemGroup>

                    <ItemGroup title={t('settings.connectedAccounts')}>
                        <Item
                            title={anthropicAgentCore.uiConnectedService.label}
                            subtitle={isAnthropicConnected
                                ? t('settingsAccount.statusActive')
                                : t('settings.connectAccount')
                            }
                            icon={
                                <AgentIcon agentId={anthropicAgentId} size={29} />
                            }
                            onPress={isAnthropicConnected
                                ? () => pushRoute({
                                    pathname: '/settings/connected-services/[serviceId]',
                                    params: { serviceId: 'anthropic' },
                                })
                                : connectAnthropic}
                            loading={connectingAnthropic}
                        />
                    </ItemGroup>
                </>
            )}

            <ItemGroup>
                {SETTINGS_SECTIONS.filter((entry) => entry.id !== 'files' || sourceControlEnabled || attachmentsUploadsEnabled).map((entry) => (
                    <Item
                        key={entry.id}
                        testID={`settings-section-${entry.id}`}
                        title={t(entry.entryTitleKey)}
                        icon={<Icon name={entry.icon} size={29} color={theme.colors.text.secondary} />}
                        onPress={() => pushRoute({ pathname: '/settings/sections/[section]', params: { section: entry.id } })}
                    />
                ))}
            </ItemGroup>
            </>) : (
                <SettingsSectionContent
                    section={section}
                    appVersion={appVersion}
                    attachmentsUploadsEnabled={attachmentsUploadsEnabled}
                    automationsNeedLocalEnablement={automationsNeedLocalEnablement}
                    connectedServicesEnabled={connectedServicesEnabled}
                    devModeEnabled={devModeEnabled}
                    executionRunsEnabled={executionRunsEnabled}
                    handleGitHub={handleGitHub}
                    handleReportIssue={handleReportIssue}
                    handleVersionClick={handleVersionClick}
                    mcpServersEnabled={mcpServersEnabled}
                    memorySearchEnabled={memorySearchEnabled}
                    promptsLibraryEnabled={promptsLibraryEnabled}
                    router={router}
                    showAutomations={showAutomations}
                    showChangelog={showChangelog}
                    showRateUs={showRateUs}
                    sourceControlEnabled={sourceControlEnabled}
                    terminalUseTmux={terminalUseTmux}
                    theme={theme}
                    useProfiles={useProfiles}
                    voiceEnabled={voiceEnabled}
                />
            )}

        </ItemList>
    );
});
