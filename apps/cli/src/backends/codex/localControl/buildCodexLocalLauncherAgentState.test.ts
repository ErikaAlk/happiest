import { describe, expect, it } from 'vitest';

import { buildCodexLocalLauncherAgentState } from './buildCodexLocalLauncherAgentState';

describe('buildCodexLocalLauncherAgentState', () => {
  it('replaces inherited remote control when a resumed terminal takes control', () => {
    const remote = {
      controlledByUser: false,
      localControl: { attached: false, topology: 'exclusive' as const, remoteWritable: true, canAttach: false, canDetach: false },
      capabilities: { inFlightSteerSupported: true },
    };
    const local = buildCodexLocalLauncherAgentState(remote, 'local');
    expect(local).toMatchObject({
      controlledByUser: true,
      localControl: { attached: true, topology: 'exclusive', remoteWritable: false, canAttach: false, canDetach: true },
      capabilities: remote.capabilities,
    });
    expect(remote.localControl.attached).toBe(false);
    expect(buildCodexLocalLauncherAgentState(local, 'remote')).toMatchObject({
      controlledByUser: false,
      localControl: { attached: false, topology: 'exclusive', remoteWritable: true, canAttach: false, canDetach: false },
    });
  });
});
