import { describe, expect, it } from 'vitest';
import { createMachineFixture } from '@/dev/testkit';
import { encodeSessionRecentPathEntry } from '@/utils/sessions/recentPathEntries';
import { buildNewSessionProjects } from './newSessionProjects';

describe('buildNewSessionProjects', () => {
    it('orders repeated projects by their newest session', () => {
        const machine = createMachineFixture({ id: 'available' });
        const projects = buildNewSessionProjects({
            machines: [machine], selectedMachineId: machine.id, favoriteDirectories: [], recentMachinePaths: [],
            sessions: [
                encodeSessionRecentPathEntry({ sessionId: 'old', machineId: machine.id, path: '/project-a', createdAt: 1 }),
                encodeSessionRecentPathEntry({ sessionId: 'middle', machineId: machine.id, path: '/project-b', createdAt: 10 }),
                encodeSessionRecentPathEntry({ sessionId: 'new', machineId: machine.id, path: '/project-a', createdAt: 20 }),
            ],
        });
        expect(projects.map((project) => project.path)).toEqual(['/project-a', '/project-b']);
    });
    it('binds a favorite to its recorded machine and deduplicates recent entries', () => {
        const first = createMachineFixture({ id: 'first' });
        const second = createMachineFixture({ id: 'second' });
        const projects = buildNewSessionProjects({
            machines: [first, second], selectedMachineId: 'first', favoriteDirectories: ['/repo/favorite'],
            recentMachinePaths: [{ machineId: 'second', path: '/repo/favorite' }],
            sessions: [
                encodeSessionRecentPathEntry({ sessionId: 'one', machineId: 'second', path: '/repo/favorite', createdAt: 20 }),
                encodeSessionRecentPathEntry({ sessionId: 'two', machineId: 'first', path: '/repo/recent', createdAt: 10 }),
            ],
        });
        expect(projects).toEqual([
            { machineId: 'second', path: '/repo/favorite', favorite: true },
            { machineId: 'first', path: '/repo/recent', favorite: false },
        ]);
    });

    it('expands portable favorites using the selected machine and excludes unavailable machines', () => {
        const machine = createMachineFixture({ id: 'available' });
        expect(buildNewSessionProjects({
            machines: [machine], selectedMachineId: machine.id, favoriteDirectories: ['~/project'],
            recentMachinePaths: [{ machineId: 'missing', path: '/unavailable' }], sessions: [],
        })).toEqual([{ machineId: machine.id, path: `${machine.metadata!.homeDir}/project`, favorite: true }]);
    });
});
