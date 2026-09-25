// Prebuild step of config/scripts/build-linux-local.mjs: builds the cc-tabdiff server for the target arch.

export function buildCcTabdiffServer({ arch, cwd, env, execFile, platform }) {
  // Cross-host packaging from Windows has no bash; the service skips a missing binary.
  if (platform === 'win32') {
    return
  }
  execFile('bash', ['scripts/cc-tabdiff/build-server.sh', arch], { cwd, env, stdio: 'inherit' })
}
