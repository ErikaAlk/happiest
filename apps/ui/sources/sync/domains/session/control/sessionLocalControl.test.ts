import { describe, expect, it } from 'vitest';

import {
    getSessionLocalControlState,
    isSessionRemoteWritableWhileLocallyAttached,
    resolveSessionControlSwitchStatus,
    resolveSessionReturnToComputerMode,
} from './sessionLocalControl';
import type { Session } from '@/sync/domains/state/storageTypes';

describe('session local control state', () => {
    it('waits for an explicit runtime control report before completing a remote switch', () => {
        const session: Pick<Session, 'active' | 'presence' | 'resumingAt' | 'agentState'> = {
            active: true, presence: 'online', resumingAt: null, agentState: null,
        };
        const input = { session, to: 'remote' as const, phase: 'switching' as const, machineOnline: true };
        expect(resolveSessionControlSwitchStatus(input)).toBe('pending');
        session.agentState = {};
        expect(resolveSessionControlSwitchStatus(input)).toBe('pending');
        session.agentState = { controlledByUser: false };
        expect(resolveSessionControlSwitchStatus(input)).toBe('completed');
        session.agentState = { localControl: { attached: false, remoteWritable: false } };
        expect(resolveSessionControlSwitchStatus(input)).toBe('pending');
        session.agentState.localControl!.remoteWritable = true;
        expect(resolveSessionControlSwitchStatus(input)).toBe('completed');
    });

    it('returns hidden Windows runners through an existing vendor resume identity', () => {
        expect(resolveSessionReturnToComputerMode({
            machinePlatform: 'win32',
            machineOnline: true,
            supportsLocalControl: true,
            vendorResumeId: 'provider-session',
            localControl: { attached: false, topology: 'exclusive', canAttach: false, canDetach: false, remoteWritable: true },
            windowsLaunchMode: 'hidden',
        })).toEqual({ type: 'resume', windowsRemoteSessionLaunchMode: 'console' });
    });

    it('does not stop a runner whose original provider session cannot be restored', () => {
        expect(resolveSessionReturnToComputerMode({
            machinePlatform: 'win32',
            machineOnline: true,
            supportsLocalControl: true,
            vendorResumeId: null,
            localControl: null,
        })).toBeNull();
    });

    it('uses runtime switching for an existing terminal and respects the Windows terminal choice', () => {
        const input = {
            machinePlatform: 'win32', machineOnline: true, supportsLocalControl: true,
            vendorResumeId: 'provider-session', localControl: null,
        };
        expect(resolveSessionReturnToComputerMode({ ...input, windowsLaunchMode: 'windows_terminal' }))
            .toEqual({ type: 'resume', windowsRemoteSessionLaunchMode: 'windows_terminal' });
        expect(resolveSessionReturnToComputerMode({ ...input, machinePlatform: 'linux' })).toBeNull();
        expect(resolveSessionReturnToComputerMode({ ...input, machineOnline: false })).toBeNull();
        expect(resolveSessionReturnToComputerMode({ ...input, supportsLocalControl: false })).toBeNull();
        expect(resolveSessionReturnToComputerMode({ ...input, localControl: {
            attached: false, topology: 'exclusive', canAttach: true, canDetach: false, remoteWritable: true,
        } })).toEqual({ type: 'switch' });
    });

    it('waits for local control after a resume acceptance and reports its terminal failure', () => {
        const session: Pick<Session, 'active' | 'presence' | 'resumingAt' | 'agentState'> = {
            active: false, presence: 0, resumingAt: 10, agentState: null,
        };
        expect(resolveSessionControlSwitchStatus({ session, to: 'local', phase: 'starting', machineOnline: true })).toBe('pending');
        expect(resolveSessionControlSwitchStatus({ session, to: 'local', phase: 'waiting_for_control', machineOnline: true })).toBe('pending');
        session.resumingAt = null;
        expect(resolveSessionControlSwitchStatus({ session, to: 'local', phase: 'waiting_for_control', machineOnline: true })).toBe('failed');
        session.active = true;
        session.presence = 'online';
        session.agentState = { controlledByUser: true };
        expect(resolveSessionControlSwitchStatus({ session, to: 'local', phase: 'waiting_for_control', machineOnline: true })).toBe('completed');
        expect(resolveSessionControlSwitchStatus({
            session, to: 'local', phase: 'waiting_for_control', machineOnline: true,
            expectedVendorResumeId: 'original-session', vendorResumeId: 'another-session',
        })).toBe('failed');
        expect(resolveSessionControlSwitchStatus({ session, to: 'local', phase: 'waiting_for_control', machineOnline: false })).toBe('failed');
    });

    it('keeps an accepted stop pending until exit and fails an ordinary switch when the runner exits', () => {
        const session: Pick<Session, 'active' | 'presence' | 'resumingAt' | 'agentState'> = {
            active: false, presence: 0, resumingAt: null, agentState: null,
        };
        expect(resolveSessionControlSwitchStatus({ session, to: 'local', phase: 'waiting_for_exit', machineOnline: true })).toBe('pending');
        expect(resolveSessionControlSwitchStatus({ session, to: 'remote', phase: 'switching', machineOnline: true })).toBe('failed');
        session.active = true;
        session.presence = 'online';
        session.agentState = { controlledByUser: true };
        expect(resolveSessionControlSwitchStatus({ session, to: 'remote', phase: 'switching', machineOnline: true })).toBe('pending');
        session.agentState = { controlledByUser: false };
        expect(resolveSessionControlSwitchStatus({ session, to: 'remote', phase: 'switching', machineOnline: true })).toBe('completed');
    });

    it('requires an explicit runtime capability before offering return to the computer', () => {
        const session = {
            agentState: {
                localControl: { attached: false, topology: 'shared', remoteWritable: true },
            },
        } as Session;

        expect(getSessionLocalControlState(session)?.canAttach).toBe(false);
        session.agentState!.localControl!.canAttach = true;
        expect(getSessionLocalControlState(session)?.canAttach).toBe(true);
    });

    it('does not infer remote writeability from shared topology when the field is omitted', () => {
        const session = {
            agentState: {
                localControl: {
                    attached: true,
                    topology: 'shared',
                },
            },
        } as Session;

        expect(getSessionLocalControlState(session)).toMatchObject({
            attached: true,
            topology: 'shared',
            remoteWritable: false,
        });
        expect(isSessionRemoteWritableWhileLocallyAttached(session)).toBe(false);
    });

    it('preserves explicit provider-server writeability for shared attachment', () => {
        const session = {
            agentState: {
                localControl: {
                    attached: true,
                    topology: 'shared',
                    remoteWritable: true,
                },
            },
        } as Session;

        expect(getSessionLocalControlState(session)?.remoteWritable).toBe(true);
        expect(isSessionRemoteWritableWhileLocallyAttached(session)).toBe(true);
    });
});
