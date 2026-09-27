import { readWin32ProcessRows } from '../../worktree/happiest-experience/packages/cli-common/processInstance.mjs';

const samples = [];
for (let i = 0; i < 5; i += 1) {
  const started = performance.now();
  const rows = await readWin32ProcessRows([process.pid]);
  samples.push(Math.round(performance.now() - started));
  if (rows.size === 0) throw new Error('no rows');
}
console.log(JSON.stringify({ samplesMs: samples }));
