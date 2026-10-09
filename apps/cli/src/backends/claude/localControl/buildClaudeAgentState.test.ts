import { describe, expect, it } from 'vitest';

import { buildClaudeAgentState, canUseClaudeLocalTerminal } from './buildClaudeAgentState';

describe('buildClaudeAgentState', () => {
  it('rejects hidden runners and accepts an actual interactive or Windows hosted terminal', () => {
    expect(canUseClaudeLocalTerminal({ stdinIsTTY: false, stdoutIsTTY: false, terminalMode: 'plain' })).toBe(false);
    expect(canUseClaudeLocalTerminal({ stdinIsTTY: true, stdoutIsTTY: false })).toBe(false);
    expect(canUseClaudeLocalTerminal({ stdinIsTTY: true, stdoutIsTTY: true })).toBe(true);
    expect(canUseClaudeLocalTerminal({ stdinIsTTY: false, stdoutIsTTY: false, terminalMode: 'windows_console' })).toBe(true);
    expect(canUseClaudeLocalTerminal({ stdinIsTTY: false, stdoutIsTTY: false, terminalMode: 'windows_terminal' })).toBe(true);
  });
  it('does not advertise user-message handler readiness until explicitly ready', () => {
    expect(buildClaudeAgentState({
      currentState: {},
      mode: 'remote',
      claudeUnifiedTerminalEnabled: false,
      localPermissionBridgeEnabled: false,
    }).capabilities).toMatchObject({
      userMessageHandlerReady: false,
    });
  });

  it('publishes unified terminal sessions as shared and remote-writable instead of locally controlled', () => {
    expect(buildClaudeAgentState({
      currentState: {
        capabilities: {
          inFlightSteer: true,
        },
      },
      mode: 'remote',
      claudeUnifiedTerminalEnabled: true,
      localPermissionBridgeEnabled: true,
      userMessageHandlerReady: true,
    })).toMatchObject({
      controlledByUser: false,
      localControl: {
        attached: true,
        topology: 'shared',
        remoteWritable: true,
        canAttach: true,
        canDetach: false,
      },
      capabilities: {
        inFlightSteer: true,
        inFlightSteerSupported: true,
        inFlightSteerAvailable: true,
        askUserQuestionAnswersInPermission: true,
        localPermissionBridgeInLocalMode: true,
        permissionsInUiWhileLocal: true,
        userMessageHandlerReady: true,
      },
    });
  });

  it('publishes inFlightConfigApplySupported for unified sessions with TUI runtime control (lane Q)', () => {
    const withControl = buildClaudeAgentState({
      currentState: {},
      mode: 'remote',
      claudeUnifiedTerminalEnabled: true,
      localPermissionBridgeEnabled: false,
      tuiRuntimeControlEnabled: true,
      userMessageHandlerReady: true,
    });
    expect(withControl.capabilities).toMatchObject({ inFlightConfigApplySupported: true });

    const withoutControl = buildClaudeAgentState({
      currentState: {},
      mode: 'remote',
      claudeUnifiedTerminalEnabled: true,
      localPermissionBridgeEnabled: false,
      tuiRuntimeControlEnabled: false,
      userMessageHandlerReady: true,
    });
    expect((withoutControl.capabilities as Record<string, unknown>).inFlightConfigApplySupported).toBeUndefined();

    const legacy = buildClaudeAgentState({
      currentState: {},
      mode: 'local',
      claudeUnifiedTerminalEnabled: false,
      localPermissionBridgeEnabled: false,
      tuiRuntimeControlEnabled: true,
    });
    expect((legacy.capabilities as Record<string, unknown>).inFlightConfigApplySupported).toBeUndefined();
  });

  it('publishes exclusive local control for legacy Claude with an interactive terminal', () => {
    expect(buildClaudeAgentState({
      currentState: {
        localControl: {
          attached: true,
          topology: 'shared',
          remoteWritable: true,
        },
      },
      mode: 'local',
      claudeUnifiedTerminalEnabled: false,
      localPermissionBridgeEnabled: false,
      localTerminalAvailable: true,
    })).toMatchObject({
      controlledByUser: true,
      localControl: {
        attached: true,
        topology: 'exclusive',
        remoteWritable: false,
        canAttach: false,
        canDetach: true,
      },
      capabilities: {
        askUserQuestionAnswersInPermission: true,
        localPermissionBridgeInLocalMode: false,
        permissionsInUiWhileLocal: false,
      },
    });
  });

  it('offers return to the computer only when the legacy runner has an interactive terminal', () => {
    const input = {
      currentState: {},
      mode: 'remote' as const,
      claudeUnifiedTerminalEnabled: false,
      localPermissionBridgeEnabled: false,
    };
    expect(buildClaudeAgentState({ ...input, localTerminalAvailable: true }).localControl).toMatchObject({
      attached: false,
      topology: 'exclusive',
      remoteWritable: true,
      canAttach: true,
      canDetach: false,
    });
    expect(buildClaudeAgentState({ ...input, localTerminalAvailable: false }).localControl?.canAttach).toBe(false);
  });
});
