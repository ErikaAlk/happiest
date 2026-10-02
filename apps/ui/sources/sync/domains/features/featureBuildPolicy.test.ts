import { afterEach, describe, expect, it } from 'vitest';

import { getFeatureBuildPolicyDecision } from './featureBuildPolicy';

const previousPolicyEnv = process.env.EXPO_PUBLIC_HAPPIER_FEATURE_POLICY_ENV;

describe('getFeatureBuildPolicyDecision', () => {
    afterEach(() => {
        if (previousPolicyEnv === undefined) delete process.env.EXPO_PUBLIC_HAPPIER_FEATURE_POLICY_ENV;
        else process.env.EXPO_PUBLIC_HAPPIER_FEATURE_POLICY_ENV = previousPolicyEnv;
    });

    it.each(['production', 'preview'])(
        'denies the hosted voice option, which needs an upstream subscription, in %s builds',
        (policyEnv) => {
            process.env.EXPO_PUBLIC_HAPPIER_FEATURE_POLICY_ENV = policyEnv;

            expect(getFeatureBuildPolicyDecision('voice.happierVoice')).toBe('deny');
            // Local voice and a person's own ElevenLabs account stay available.
            expect(getFeatureBuildPolicyDecision('voice')).not.toBe('deny');
        },
    );
});
