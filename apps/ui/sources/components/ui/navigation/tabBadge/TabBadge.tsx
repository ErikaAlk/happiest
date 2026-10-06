import * as React from 'react';

import { ComposedTabBadge, type TabBadgeProps } from './TabBadgeComposed';

export type { TabBadgeCountTone, TabBadgeProps } from './TabBadgeComposed';

/**
 * Unified tab-bar badge. Replaces the per-bar inline badge/indicator markup so
 * counts, dots, and git diff chips share spacing, capping, and theme tokens.
 */
export function TabBadge(props: TabBadgeProps): React.ReactElement {
    return <ComposedTabBadge {...props} />;
}
