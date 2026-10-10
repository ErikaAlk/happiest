import type { Machine, Session } from '@/sync/domains/state/storageTypes';
import { isMachineVisibleForLaunchSelection } from '@/sync/domains/machines/identity/filterVisibleMachines';
import { getRecentMachinePaths } from '@/utils/sessions/recentPaths';
import { resolveAbsolutePath } from '@/utils/path/pathUtils';
import { normalizeDirectoryFavoritePaths, resolveDirectoryFavoriteComparisonKey } from '../hooks/favoriteDirectoriesToggle';

export type NewSessionProject = Readonly<{ machineId: string; path: string; favorite: boolean }>;

export function buildNewSessionProjects(params: Readonly<{
    machines: readonly Machine[];
    recentMachinePaths: readonly Readonly<{ machineId: string; path: string }>[];
    sessions: readonly (Session | string)[] | null | undefined;
    favoriteDirectories: readonly string[];
    selectedMachineId: string | null;
}>): readonly NewSessionProject[] {
    const machines = params.machines.filter(isMachineVisibleForLaunchSelection);
    const machinesById = new Map(machines.map((machine) => [machine.id, machine]));
    const recent = getRecentMachinePaths(params).filter((entry) => machinesById.has(entry.machineId));
    const projects: NewSessionProject[] = [];
    const seen = new Set<string>();
    const add = (machine: Machine, path: string, favorite: boolean) => {
        const absolutePath = resolveAbsolutePath(path, machine.metadata?.homeDir);
        const key = JSON.stringify([machine.id, resolveDirectoryFavoriteComparisonKey(absolutePath, machine.metadata?.homeDir)]);
        if (seen.has(key)) return;
        seen.add(key);
        projects.push({ machineId: machine.id, path: absolutePath, favorite });
    };
    for (const favorite of normalizeDirectoryFavoritePaths(params.favoriteDirectories, null)) {
        const matching = recent.filter((entry) => {
            const machine = machinesById.get(entry.machineId)!;
            return resolveDirectoryFavoriteComparisonKey(entry.path, machine.metadata?.homeDir)
                === resolveDirectoryFavoriteComparisonKey(favorite, machine.metadata?.homeDir);
        });
        if (matching.length > 0) {
            for (const entry of matching) add(machinesById.get(entry.machineId)!, entry.path, true);
        } else {
            const machine = machinesById.get(params.selectedMachineId ?? '');
            if (machine) add(machine, favorite, true);
        }
    }
    for (const entry of recent) add(machinesById.get(entry.machineId)!, entry.path, false);
    return projects;
}
