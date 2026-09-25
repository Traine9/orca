import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { CC_TABDIFF_DEFAULT_PORT, isCcTabdiffServerEnabled } from '../../shared/cc-tabdiff/base-url'
import { getMainE2EConfig } from '../startup/testing/e2e-config'
import { ensureCcTabdiffServer, stopCcTabdiffServer, type CcTabdiffServerOptions } from './service'

type SettingsSource = {
  getSettings(): GlobalSettings
  onSettingsChanged(
    listener: (updates: Partial<GlobalSettings>, settings: GlobalSettings) => void
  ): () => void
}

export function resolveCcTabdiffBinaryPath(options: {
  isPackaged: boolean
  resourcesPath: string
  appPath: string
  arch: string
}): string {
  const relative = join('cc-tabdiff', `linux-${options.arch}`, 'cc-tabdiff')
  return options.isPackaged
    ? join(options.resourcesPath, relative)
    : join(options.appPath, 'resources', relative)
}

function buildOptions(): CcTabdiffServerOptions {
  // Same defaults (and overrides) as the cc-tabdiff hooks and its compose file.
  const home = homedir()
  return {
    binaryPath: resolveCcTabdiffBinaryPath({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
      arch: process.arch
    }),
    dataDir: process.env.CC_TABDIFF_SPOOL || join(home, '.cache', 'cc-tabdiff'),
    forgeEnvPath:
      process.env.CC_TABDIFF_FORGE_ENV || join(home, '.config', 'cc-tabdiff', 'forge.env'),
    port: CC_TABDIFF_DEFAULT_PORT,
    baseEnv: process.env
  }
}

/** Runs the bundled cc-tabdiff server while the ccTabdiffServer setting is on (Linux only). */
export function startCcTabdiffService(store: SettingsSource): void {
  if (process.platform !== 'linux' || getMainE2EConfig().enabled) {
    return
  }
  const options = buildOptions()
  let queue: Promise<void> = Promise.resolve()
  // Serialized so a quick off/on toggle cannot race a spawn against a stop.
  const apply = (enabled: boolean): void => {
    queue = queue
      .then(async () => {
        await (enabled ? ensureCcTabdiffServer(options) : stopCcTabdiffServer(options))
      })
      .catch((error: unknown) => console.warn('[cc-tabdiff] server control failed:', error))
  }
  if (isCcTabdiffServerEnabled(store.getSettings())) {
    apply(true)
  }
  store.onSettingsChanged((updates, settings) => {
    if ('ccTabdiffServer' in updates) {
      apply(isCcTabdiffServerEnabled(settings))
    }
  })
}
