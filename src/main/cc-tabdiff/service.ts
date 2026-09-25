import { spawn } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { request } from 'node:http'
import { dirname, join } from 'node:path'
import { readForgeEnv, splitExtraArgs } from './forge-env'

const SERVER_COMM = 'cc-tabdiff'
const LOG_ROTATE_BYTES = 5 * 1024 * 1024

export type CcTabdiffServerOptions = {
  binaryPath: string
  dataDir: string
  forgeEnvPath: string
  port: number
  baseEnv: NodeJS.ProcessEnv
  /** How long to wait for the server to come up or go down. */
  settleTimeoutMs?: number
  /** Test seam: the process name of a pid (Linux /proc/<pid>/comm). */
  readComm?: (pid: number) => string | null
}

export type CcTabdiffServerOutcome =
  | 'no-binary'
  | 'already-running'
  | 'spawned'
  | 'restarted'
  | 'failed'

type PidFile = { pid: number; version: string }

function pidFilePath(options: CcTabdiffServerOptions): string {
  return join(options.dataDir, 'server.pid')
}

function logPath(options: CcTabdiffServerOptions): string {
  return join(options.dataDir, 'server.log')
}

// Only Orca's own lines go through here; values from forge.env never do.
function log(options: CcTabdiffServerOptions, line: string): void {
  const text = `${new Date().toISOString()} [orca] ${line}`
  console.info(`[cc-tabdiff] ${line}`)
  try {
    appendFileSync(logPath(options), `${text}\n`)
  } catch {
    // The log is best effort; a read-only spool must not stop the server.
  }
}

export function readBundledVersion(binaryPath: string): string {
  try {
    return readFileSync(join(dirname(binaryPath), 'VERSION'), 'utf8').trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

function readPidFile(path: string): PidFile | null {
  try {
    const [pidText, version = ''] = readFileSync(path, 'utf8').split('\n')
    const pid = Number.parseInt(pidText, 10)
    return Number.isInteger(pid) && pid > 1 ? { pid, version: version.trim() } : null
  } catch {
    return null
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: alive but owned by another user.
    return error instanceof Error && 'code' in error && error.code === 'EPERM'
  }
}

function readProcComm(pid: number): string | null {
  try {
    return readFileSync(`/proc/${pid}/comm`, 'utf8').trim()
  } catch {
    return null
  }
}

// A pid from the pidfile may have been reused by an unrelated process since.
function isOwnServer(options: CcTabdiffServerOptions, pid: number): boolean {
  return isAlive(pid) && (options.readComm ?? readProcComm)(pid) === SERVER_COMM
}

/** True when something answers GET /healthz on the loopback port. */
export function probeHealth(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request(
      { host: '127.0.0.1', port, path: '/healthz', method: 'GET', timeout: timeoutMs },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      }
    )
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(false))
    req.end()
  })
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await check()) {
      return true
    }
    if (Date.now() >= deadline) {
      return false
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

function rotateLog(options: CcTabdiffServerOptions): void {
  try {
    if (statSync(logPath(options)).size > LOG_ROTATE_BYTES) {
      renameSync(logPath(options), `${logPath(options)}.1`)
    }
  } catch {
    // No log yet.
  }
}

async function spawnServer(options: CcTabdiffServerOptions, version: string): Promise<boolean> {
  rotateLog(options)
  const forgeEnv = readForgeEnv(options.forgeEnvPath)
  // GOMEMLIMIT mirrors the Docker compose default; forge.env may override it.
  const env: NodeJS.ProcessEnv = { GOMEMLIMIT: '100MiB', ...options.baseEnv, ...forgeEnv }
  const extraArgs = splitExtraArgs(env.CC_TABDIFF_ARGS)
  // Why 0.0.0.0: the phone reaches it over the LAN; the server's Host allowlist guards it.
  const args = ['-data', options.dataDir, '-addr', `0.0.0.0:${options.port}`, ...extraArgs]
  log(
    options,
    `starting ${options.binaryPath} (${version}) on :${options.port}, ` +
      `${Object.keys(forgeEnv).length} variables from forge.env, ${extraArgs.length} extra args`
  )
  const fd = openSync(logPath(options), 'a')
  let pid: number | null
  try {
    // Detached like the PTY daemon, so the server outlives GUI restarts.
    const child = spawn(options.binaryPath, args, {
      detached: true,
      stdio: ['ignore', fd, fd],
      env
    })
    pid = await new Promise<number | null>((resolve) => {
      child.once('spawn', () => resolve(child.pid ?? null))
      child.once('error', (error) => {
        log(options, `spawn failed: ${error.message}`)
        resolve(null)
      })
    })
    child.unref()
  } finally {
    closeSync(fd)
  }
  if (pid === null) {
    return false
  }
  writeFileSync(pidFilePath(options), `${pid}\n${version}\n`)
  const up = await waitFor(() => probeHealth(options.port, 300), options.settleTimeoutMs ?? 5000)
  log(options, up ? `server pid ${pid} is up` : `server pid ${pid} does not answer /healthz yet`)
  return true
}

/** Starts the bundled server unless one already answers; restarts Orca's own on a version change. */
export async function ensureCcTabdiffServer(
  options: CcTabdiffServerOptions
): Promise<CcTabdiffServerOutcome> {
  if (!existsSync(options.binaryPath)) {
    return 'no-binary'
  }
  mkdirSync(options.dataDir, { recursive: true })
  const version = readBundledVersion(options.binaryPath)
  if (!(await probeHealth(options.port))) {
    return (await spawnServer(options, version)) ? 'spawned' : 'failed'
  }
  const running = readPidFile(pidFilePath(options))
  // A Docker instance has no pidfile; a live pidfile of the same version needs nothing.
  if (!running || running.version === version || !isOwnServer(options, running.pid)) {
    log(options, `a server already answers on :${options.port}; leaving it running`)
    return 'already-running'
  }
  log(options, `upgrading server pid ${running.pid} from ${running.version} to ${version}`)
  process.kill(running.pid, 'SIGTERM')
  const settleMs = options.settleTimeoutMs ?? 5000
  if (!(await waitFor(async () => !(await probeHealth(options.port, 300)), settleMs))) {
    log(options, `server pid ${running.pid} did not stop; leaving it running`)
    return 'failed'
  }
  return (await spawnServer(options, version)) ? 'restarted' : 'failed'
}

/** Stops the server only when Orca started it (pidfile names a live cc-tabdiff process). */
export function stopCcTabdiffServer(options: CcTabdiffServerOptions): boolean {
  const running = readPidFile(pidFilePath(options))
  if (!running || !isOwnServer(options, running.pid)) {
    return false
  }
  process.kill(running.pid, 'SIGTERM')
  rmSync(pidFilePath(options), { force: true })
  log(options, `stopped server pid ${running.pid}`)
  return true
}
