import { HUGE_ICON_REGISTRY, type HugeIconName } from './iconRegistryHuge.generated';
import type { IconName, IconWeight } from './Icon';

const PHOSPHOR_PINNED = new Set<IconName>([
    'star', 'stop', 'mailbox', 'chats-circle', 'sliders-horizontal', 'users',
    'terminal', 'list', 'folder', 'git-branch', 'stack',
]);

export function resolveHugeIcon(name: IconName, weight?: IconWeight) {
    return PHOSPHOR_PINNED.has(name) || weight === 'fill' ? undefined : HUGE_ICON_REGISTRY[name as HugeIconName];
}
