import * as React from 'react';
import type { WindowsRemoteSessionLaunchMode } from '@happier-dev/protocol';

export type SessionResumeRequestOptions = Readonly<{
    /** Windows host for the resumed runner; omitted requests use the machine/account default. */
    windowsRemoteSessionLaunchMode?: WindowsRemoteSessionLaunchMode;
}>;

export type SessionResumeRequestListener = (options?: SessionResumeRequestOptions) => Promise<boolean>;

const listenersBySessionId = new Map<string, Set<SessionResumeRequestListener>>();
const presenceSubscribers = new Set<() => void>();

function notifyPresenceSubscribers(): void {
    for (const subscriber of presenceSubscribers) subscriber();
}

function subscribeToListenerPresence(onChange: () => void): () => void {
    presenceSubscribers.add(onChange);
    return () => {
        presenceSubscribers.delete(onChange);
    };
}

/** Whether a mounted session screen can run a resume requested for `sessionId`. */
export function useHasSessionResumeRequestListener(sessionId: string): boolean {
    return React.useSyncExternalStore(
        subscribeToListenerPresence,
        () => (listenersBySessionId.get(sessionId)?.size ?? 0) > 0,
    );
}

export async function emitSessionResumeRequest(sessionId: string, options?: SessionResumeRequestOptions): Promise<boolean> {
    const listeners = listenersBySessionId.get(sessionId);
    if (!listeners || listeners.size === 0) {
        throw new Error(`No resume listener is registered for session ${sessionId}`);
    }

    const results = await Promise.all(Array.from(listeners, (listener) => listener(options)));
    return results.every(Boolean);
}

export function useSessionResumeRequestListener(
    sessionId: string,
    listener: SessionResumeRequestListener,
): void {
    React.useEffect(() => {
        const listeners = listenersBySessionId.get(sessionId) ?? new Set<SessionResumeRequestListener>();
        listeners.add(listener);
        listenersBySessionId.set(sessionId, listeners);
        if (listeners.size === 1) notifyPresenceSubscribers();
        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                listenersBySessionId.delete(sessionId);
                notifyPresenceSubscribers();
            }
        };
    }, [listener, sessionId]);
}
