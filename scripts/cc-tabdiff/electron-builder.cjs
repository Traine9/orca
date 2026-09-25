// Packaging entries for the bundled cc-tabdiff server, used by config/electron-builder.config.cjs.

module.exports = {
  // A real file next to app.asar, so the main process can exec it.
  linuxResource: { from: 'resources/cc-tabdiff/linux-${arch}', to: 'cc-tabdiff/linux-${arch}' },
  // The binary already ships via extraResources, and the build scripts are not runtime inputs.
  asarExcludes: ['!resources/cc-tabdiff{,/**/*}', '!scripts/cc-tabdiff{,/**/*}']
}
