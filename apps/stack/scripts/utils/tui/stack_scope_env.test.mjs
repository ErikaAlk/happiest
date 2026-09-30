import test from 'node:test';
import assert from 'node:assert/strict';

import { applyTuiStackAuthScopeEnv } from './stack_scope_env.mjs';

test('applyTuiStackAuthScopeEnv overrides HAPPIEST_ACTIVE_SERVER_ID per stack', () => {
  const env = applyTuiStackAuthScopeEnv({
    env: {
      HAPPIEST_ACTIVE_SERVER_ID: 'main',
      HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID: 'stack_other__id_default',
      HAPPIER_STACK_CLI_IDENTITY: 'default',
    },
    stackName: 'repo-dev-a1cc5e0671',
  });
  assert.equal(env.HAPPIEST_ACTIVE_SERVER_ID, 'stack_repo-dev-a1cc5e0671__id_default');
  assert.equal(env.HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID, 'stack_repo-dev-a1cc5e0671__id_default');
});

test('applyTuiStackAuthScopeEnv deletes HAPPIEST_ACTIVE_SERVER_ID when stable scope is disabled', () => {
  const env = applyTuiStackAuthScopeEnv({
    env: { HAPPIEST_ACTIVE_SERVER_ID: 'main', HAPPIER_STACK_DISABLE_STABLE_SCOPE: '1' },
    stackName: 'repo-dev-a1cc5e0671',
  });
  assert.equal(env.HAPPIEST_ACTIVE_SERVER_ID, undefined);
  assert.equal(env.HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID, undefined);
});
