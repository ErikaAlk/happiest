export function resolveCodexTuiTerm(params: {
  term: string | undefined;
  platform: NodeJS.Platform;
  interactive: boolean;
}): string | undefined {
  if (params.platform === 'win32' && params.interactive && (!params.term || params.term === 'dumb')) {
    return 'xterm-256color';
  }
  return params.term;
}
