import * as React from 'react';
import type { ViewInstance } from 'react-native';

export function useAgentInputSelectionAnchors(): Readonly<{
    overlayAnchorRef: React.RefObject<ViewInstance | null>;
    actionMenuAnchorRef: React.RefObject<ViewInstance | null>;
    agentChipAnchorRef: React.RefObject<ViewInstance | null>;
    permissionChipAnchorRef: React.RefObject<ViewInstance | null>;
    machineChipAnchorRef: React.RefObject<ViewInstance | null>;
    sessionModeChipAnchorRef: React.RefObject<ViewInstance | null>;
    pathChipAnchorRef: React.RefObject<ViewInstance | null>;
    resumeChipAnchorRef: React.RefObject<ViewInstance | null>;
    profileChipAnchorRef: React.RefObject<ViewInstance | null>;
    envVarsChipAnchorRef: React.RefObject<ViewInstance | null>;
}> {
    const overlayAnchorRef = React.useRef<ViewInstance>(null);
    const actionMenuAnchorRef = React.useRef<ViewInstance>(null);
    const agentChipAnchorRef = React.useRef<ViewInstance>(null);
    const permissionChipAnchorRef = React.useRef<ViewInstance>(null);
    const machineChipAnchorRef = React.useRef<ViewInstance>(null);
    const sessionModeChipAnchorRef = React.useRef<ViewInstance>(null);
    const pathChipAnchorRef = React.useRef<ViewInstance>(null);
    const resumeChipAnchorRef = React.useRef<ViewInstance>(null);
    const profileChipAnchorRef = React.useRef<ViewInstance>(null);
    const envVarsChipAnchorRef = React.useRef<ViewInstance>(null);

    return {
        overlayAnchorRef,
        actionMenuAnchorRef,
        agentChipAnchorRef,
        permissionChipAnchorRef,
        machineChipAnchorRef,
        sessionModeChipAnchorRef,
        pathChipAnchorRef,
        resumeChipAnchorRef,
        profileChipAnchorRef,
        envVarsChipAnchorRef,
    };
}
