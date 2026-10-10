import type { AgentInputProps } from '../AgentInput';

export function applyAgentInputControlVisibility(props: AgentInputProps): AgentInputProps {
    if (!props.hiddenControlIds?.length && props.showModelSelection !== false) return props;
    const hidden = new Set(props.hiddenControlIds);
    const next = { ...props };
    next.extraActionChips = props.extraActionChips?.filter((chip) => !chip.controlId || !hidden.has(chip.controlId));
    if (hidden.has('engine')) {
        next.onAgentClick = undefined;
        next.onAgentPickerSelect = undefined;
        next.agentPickerOptions = undefined;
        next.onAgentPickerIntent = undefined;
        next.onModelModeChange = undefined;
        next.onSessionConfigOptionChange = undefined;
        next.acpConfigOptionsOverride = [];
    }
    if (props.showModelSelection === false) next.onModelModeChange = undefined;
    if (hidden.has('permission')) {
        next.onPermissionModeChange = undefined;
        next.onPermissionClick = undefined;
    }
    if (hidden.has('mode')) {
        next.onAcpSessionModeChange = undefined;
        next.acpSessionModeOptionsOverride = [];
    }
    if (hidden.has('providerOption')) next.acpConfigOptionsOverride = [];
    if (hidden.has('profile')) {
        next.onProfileClick = undefined;
        next.profilePopover = undefined;
        next.onEnvVarsClick = undefined;
        next.envVarsPopover = undefined;
    }
    if (hidden.has('machine')) {
        next.onMachineClick = undefined;
        next.machinePopover = undefined;
    }
    if (hidden.has('path')) {
        next.onPathClick = undefined;
        next.pathPopover = undefined;
    }
    if (hidden.has('resume')) {
        next.onResumeClick = undefined;
        next.resumePopover = undefined;
    }
    return next;
}
