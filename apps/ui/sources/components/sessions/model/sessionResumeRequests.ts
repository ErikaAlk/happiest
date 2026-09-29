import * as React from 'react';
import type { WindowsRemoteSessionLaunchMode } from '@happier-dev/protocol';

export type SessionResumeRequestOptions = Readonly<{
    /** Windows host for the resumed runner; omitted requests use the machine/account default. */
    windowsRemoteSessionLaunchMode?: WindowsRemoteSessionLaunchMode;
}>;

export type SessionResumeRequestListener = (options?: SessionResumeRequestOptions) => Promise<boolean>;

const listenersBySessionId = new Map<string, Set<SessionResumeRequestListener>>();

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
        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                listenersBySessionId.delete(sessionId);
            }
        };
    }, [listener, sessionId]);
}
