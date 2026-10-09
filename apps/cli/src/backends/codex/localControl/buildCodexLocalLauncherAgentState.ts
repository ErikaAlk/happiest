import type { AgentState } from '@/api/types';
import { createAgentLocalControlState } from '@/agent/localControl/createAgentLocalControlState';

export function buildCodexLocalLauncherAgentState(current: AgentState, mode: 'local' | 'remote'): AgentState {
  return {
    ...current,
    controlledByUser: mode === 'local',
    localControl: createAgentLocalControlState({
      attached: mode === 'local',
      topology: 'exclusive',
      remoteWritable: mode === 'remote',
      canAttach: false,
    }),
  };
}
