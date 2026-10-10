import * as React from 'react';
import { Stack, useIsFocused } from 'expo-router';
import { Item } from '@/components/ui/lists/Item';
import { ItemGroup } from '@/components/ui/lists/ItemGroup';
import { ItemList } from '@/components/ui/lists/ItemList';
import { useAllMachines } from '@/sync/store/hooks';
import { useProviderAccountUsageSnapshots } from '@/hooks/server/connectedServices/useProviderAccountUsageSnapshots';
import { selectAccountUsageWindows } from '@/sync/domains/connectedServices/accountUsage/windows';
import { t } from '@/text';

export function AccountUsageLimitsScreen() {
    const machines = useAllMachines();
    const focused = useIsFocused();
    const recordIds = React.useMemo(() => [...new Set(machines.flatMap((machine) =>
        machine.metadata?.providerAccountUsageRecordIds ?? []))].sort(), [machines]);
    const snapshots = useProviderAccountUsageSnapshots(recordIds, focused);
    return <>
        <Stack.Screen options={{ title: t('agentInput.providerUsage.limitsTitle') }} />
        <ItemList>
            {recordIds.length === 0 ? <ItemGroup>
                <Item title={t('agentInput.providerUsage.limitsEmpty')} showChevron={false} />
            </ItemGroup> : null}
            {machines.flatMap((machine) => (machine.metadata?.providerAccountUsageRecordIds ?? []).map((recordId) => {
                const snapshot = snapshots[recordId];
                const computer = machine.metadata?.displayName ?? machine.metadata?.host ?? machine.id;
                const windows = snapshot ? selectAccountUsageWindows(snapshot.meters) : [];
                const stale = snapshot && Date.now() >= snapshot.fetchedAtMs + snapshot.staleAfterMs;
                return <ItemGroup key={`${machine.id}:${recordId}`} title={computer}>
                    <Item title={snapshot?.providerId ?? t('agentInput.providerUsage.limitsTitle')}
                        subtitle={snapshot?.accountLabel ?? snapshot?.accountSubject.id}
                        showChevron={false} />
                    {stale ? <Item title={t('agentInput.providerUsage.limitsStale')} showChevron={false} /> : null}
                    {windows.length === 0 ? <Item title={snapshot === undefined ? t('common.loading') : t('agentInput.providerUsage.limitsUnavailable')} showChevron={false} /> : null}
                    {windows.map((window) => <Item key={window.kind}
                        title={t(window.kind === 'fiveHour' ? 'agentInput.providerUsage.fiveHourWindow' : 'agentInput.providerUsage.weeklyWindow')}
                        detail={window.usedPct === null ? t('agentInput.providerUsage.limitsUnavailable')
                            : t('agentInput.providerUsage.usedPercent', { percent: String(window.usedPct) })}
                        subtitle={window.resetsAt === null ? undefined : t('agentInput.providerUsage.resetTime', { time: new Date(window.resetsAt).toLocaleString() })}
                        showChevron={false} />)}
                </ItemGroup>;
            }))}
        </ItemList>
    </>;
}
