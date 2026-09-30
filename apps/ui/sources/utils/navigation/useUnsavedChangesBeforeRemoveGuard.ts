import * as React from 'react';
import { usePreventRemove } from 'expo-router';

import { fireAndForget } from '@/utils/system/fireAndForget';
import type { UnsavedChangesDecision } from '@/utils/ui/promptUnsavedChangesAlert';

export type { UnsavedChangesDecision };

/**
 * Blocks leaving the screen while it has unsaved changes and asks what to do with them. Discarding,
 * or a successful save when `continueOnSave` is not `false`, continues the blocked navigation.
 *
 * The screen's own exits (save-and-close, a confirmed cancel) run before the cleared dirty state
 * re-renders, so they either call the returned `allowRemoval` right before navigating or set
 * `ignoreRef` to let the exit pass without a prompt.
 */
export function useUnsavedChangesBeforeRemoveGuard(params: Readonly<{
    isDirty: boolean;
    enabled?: boolean;
    ignoreRef?: React.MutableRefObject<boolean>;
    requestDecision: () => Promise<UnsavedChangesDecision>;
    onDiscard?: () => void;
    onSave?: () => boolean | Promise<boolean>;
    continueOnSave?: boolean;
    tag: string;
}>): () => void {
    const {
        isDirty,
        enabled = true,
        ignoreRef,
        requestDecision,
        onDiscard,
        onSave,
        continueOnSave,
        tag,
    } = params;

    return usePreventRemove(enabled && isDirty, ({ repeat }) => {
        if (ignoreRef?.current) {
            repeat();
            return;
        }

        fireAndForget((async () => {
            const decision = await requestDecision();

            if (decision === 'discard') {
                onDiscard?.();
                repeat();
                return;
            }

            if (decision === 'save') {
                const didSave = await onSave?.() ?? false;
                if (didSave && continueOnSave !== false) {
                    repeat();
                }
            }
        })(), { tag });
    });
}
