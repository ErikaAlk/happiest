import type { Session, AgentState } from '@/sync/domains/state/storageTypes';

export type SessionLocalControlTopology = 'exclusive' | 'shared';

export type SessionLocalControlState = Readonly<{
    attached: boolean;
    topology: SessionLocalControlTopology;
    remoteWritable: boolean;
    canAttach: boolean;
    canDetach: boolean;
}>;

export type SessionControlSwitchPhase = 'switching' | 'stopping' | 'waiting_for_exit' | 'starting' | 'waiting_for_control';

export function resolveSessionReturnToComputerMode(params: Readonly<{
    machinePlatform: string | null | undefined;
    machineOnline: boolean;
    supportsLocalControl: boolean;
    vendorResumeId: string | null | undefined;
    localControl: SessionLocalControlState | null;
    windowsLaunchMode?: 'hidden' | 'console' | 'windows_terminal' | null;
}>): Readonly<{ type: 'switch' }> | Readonly<{
    type: 'resume';
    windowsRemoteSessionLaunchMode: 'console' | 'windows_terminal';
}> | null {
    if (!params.machineOnline || !params.supportsLocalControl || params.localControl?.attached) return null;
    if (params.localControl?.canAttach) return { type: 'switch' };
    if (params.machinePlatform !== 'win32' || !params.vendorResumeId?.trim()) return null;
    return {
        type: 'resume',
        windowsRemoteSessionLaunchMode: params.windowsLaunchMode === 'windows_terminal' ? 'windows_terminal' : 'console',
    };
}

export function resolveSessionControlSwitchStatus(params: Readonly<{
    session: Pick<Session, 'active' | 'presence' | 'resumingAt' | 'agentState'>;
    to: 'remote' | 'local';
    phase: SessionControlSwitchPhase;
    machineOnline: boolean;
    expectedVendorResumeId?: string;
    vendorResumeId?: string | null;
}>): 'pending' | 'completed' | 'failed' {
    if (!params.machineOnline) return 'failed';
    if (params.phase === 'stopping' || params.phase === 'waiting_for_exit' || params.phase === 'starting') return 'pending';
    if (!params.session.active) {
        return params.phase === 'waiting_for_control' && params.session.resumingAt ? 'pending' : 'failed';
    }
    const localControl = getSessionLocalControlState(params.session);
    const reachedTarget = params.to === 'local'
        ? localControl?.attached === true
        : params.session.agentState?.localControl
            ? params.session.agentState.localControl.attached === false && localControl?.remoteWritable === true
            : params.session.agentState?.controlledByUser === false;
    if (reachedTarget) {
        if (params.expectedVendorResumeId && params.vendorResumeId !== params.expectedVendorResumeId) return 'failed';
        return 'completed';
    }
    if (params.session.presence !== 'online') return 'failed';
    return 'pending';
}

function normalizeBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function readAgentStateLocalControl(agentState: AgentState | null | undefined): SessionLocalControlState | null {
    if (!agentState || typeof agentState !== 'object') return null;
    const raw = agentState.localControl;
    if (!raw || typeof raw !== 'object') return null;

    const attached = normalizeBoolean(raw.attached) === true;
    const topology = raw.topology === 'shared' ? 'shared' : 'exclusive';
    const remoteWritable = normalizeBoolean(raw.remoteWritable) ?? false;
    const canAttach = normalizeBoolean(raw.canAttach) === true;
    const canDetach = normalizeBoolean(raw.canDetach) ?? attached;

    return {
        attached,
        topology,
        remoteWritable,
        canAttach,
        canDetach,
    };
}

export function getSessionLocalControlState(session: Pick<Session, 'agentState'> | null): SessionLocalControlState | null {
    const state = readAgentStateLocalControl(session?.agentState ?? null);
    if (state) return state;

    if (session?.agentState?.controlledByUser === true) {
        return {
            attached: true,
            topology: 'exclusive',
            remoteWritable: false,
            canAttach: false,
            canDetach: true,
        };
    }

    return null;
}

export function isSessionLocallyAttached(session: Pick<Session, 'agentState'> | null): boolean {
    return getSessionLocalControlState(session)?.attached === true;
}

export function isSessionExclusiveLocalControl(session: Session | null): boolean {
    const state = getSessionLocalControlState(session);
    return state?.attached === true && state.topology === 'exclusive';
}

export function isSessionRemoteWritableWhileLocallyAttached(session: Session | null): boolean {
    const state = getSessionLocalControlState(session);
    return state?.attached === true && state.remoteWritable === true;
}
