import { useFeatureDecision } from '@/hooks/server/useFeatureDecision';
import { useLocalSettingMutable } from '@/sync/domains/state/storage';
import type { SessionStorageKind, SessionListStorageFilter } from '@/sync/domains/session/sessionStorageKind';

export function useSessionListStorageKind(): Readonly<{
    directSessionsEnabled: boolean;
    storageKind: SessionListStorageFilter;
    setStorageKind: (storageKind: SessionStorageKind) => void;
}> {
    const directSessionsDecision = useFeatureDecision('sessions.direct');
    const directSessionsEnabled = directSessionsDecision?.state === 'enabled';
    const [, setSessionsListStorageTab] = useLocalSettingMutable('sessionsListStorageTab');

    return {
        directSessionsEnabled,
        storageKind: directSessionsEnabled ? 'all' : 'persisted',
        setStorageKind: setSessionsListStorageTab,
    };
}
