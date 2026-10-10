import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text } from '@/components/ui/text/Text';
import { Icon } from '@/components/ui/icons/Icon';
import { CoTokens } from '@/theme/coloros/tokens.g';
import { formatPathRelativeToHome } from '@/utils/sessions/formatPathRelativeToHome';
import { resolveDirectoryFavoriteComparisonKey } from '../hooks/favoriteDirectoriesToggle';
import type { NewSessionProject } from '../modules/newSessionProjects';
import type { Machine } from '@/sync/domains/state/storageTypes';

export type NewSessionProjectSelection = Readonly<{
    projects: readonly NewSessionProject[];
    machines: readonly Machine[];
    selectedMachineId: string | null;
    selectedPath: string;
    disabled: boolean;
    onSelect: (project: NewSessionProject) => void;
    onHeightChange?: (height: number) => void;
}>;

export const NewSessionProjectShortcuts = React.memo(function NewSessionProjectShortcuts(props: NewSessionProjectSelection) {
    const { theme } = useUnistyles();
    const machines = React.useMemo(() => new Map(props.machines.map((machine) => [machine.id, machine])), [props.machines]);
    if (props.projects.length === 0) return null;
    return (
        <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row} testID="new-session-projects" onLayout={(event) => props.onHeightChange?.(event.nativeEvent.layout.height)}>
            {props.projects.map((project) => {
                const machine = machines.get(project.machineId);
                const machineName = machine?.metadata?.displayName || machine?.metadata?.host || project.machineId;
                const path = formatPathRelativeToHome(project.path, machine?.metadata?.homeDir);
                const selected = props.selectedMachineId === project.machineId
                    && resolveDirectoryFavoriteComparisonKey(props.selectedPath, machine?.metadata?.homeDir)
                    === resolveDirectoryFavoriteComparisonKey(project.path, machine?.metadata?.homeDir);
                return (
                    <Pressable
                        key={JSON.stringify([project.machineId, project.path])}
                        testID={`new-session-project:${project.machineId}:${project.path}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${path}，${machineName}`}
                        accessibilityState={{ selected, disabled: props.disabled }}
                        disabled={props.disabled}
                        onPress={() => props.onSelect(project)}
                        style={({ pressed }) => [styles.project, selected && styles.selected, pressed && styles.pressed]}
                    >
                        <Icon name={project.favorite ? 'star' : 'clock'} size={CoTokens.type.bodyM.size} color={theme.colors.text.secondary} />
                        <View style={styles.labels}>
                            <Text numberOfLines={1} style={styles.path}>{path}</Text>
                            <Text numberOfLines={1} style={styles.machine}>{machineName}</Text>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
});

const styles = StyleSheet.create((theme) => ({
    row: { gap: CoTokens.button.smallPaddingH, paddingVertical: CoTokens.button.smallPaddingV },
    project: {
        flexDirection: 'row', alignItems: 'center', gap: CoTokens.button.smallPaddingV,
        paddingHorizontal: CoTokens.button.largePaddingH, paddingVertical: CoTokens.button.largePaddingV,
        borderRadius: CoTokens.radius.l, backgroundColor: theme.colors.surface.elevated,
        minHeight: 48,
    },
    labels: { maxWidth: 240 },
    path: { fontSize: CoTokens.type.bodyM.size, color: theme.colors.text.primary },
    machine: { fontSize: CoTokens.type.bodyXS.size, color: theme.colors.text.secondary },
    selected: { backgroundColor: theme.colors.surface.selected },
    pressed: { backgroundColor: theme.colors.surface.pressedOverlay },
}));
