import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createServer as createHttpServer, type Server } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureCcTabdiffServer,
  probeHealth,
  stopCcTabdiffServer,
  type CcTabdiffServerOptions
} from './service'

const TOKEN = 'glpat-dummy-secret-value-123'

// Stand-in for the Go server: answers /healthz on -addr, records argv and env, exits on SIGTERM.
const FAKE_SERVER = `
const http = require('node:http')
const fs = require('node:fs')
const argv = process.argv.slice(2)
const [, port] = argv[argv.indexOf('-addr') + 1].split(':')
const data = argv[argv.indexOf('-data') + 1]
fs.writeFileSync(data + '/fake-seen.json', JSON.stringify({ argv, token: process.env.CC_TABDIFF_GITLAB_TOKEN, hosts: process.env.CC_TABDIFF_HOSTS }))
http.createServer((req, res) => res.end('ok\\n')).listen(Number(port), '127.0.0.1')
process.on('SIGTERM', () => process.exit(0))
`

let root: string
let options: CcTabdiffServerOptions
const extraServers: Server[] = []

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })
}

function writeVersion(version: string): void {
  writeFileSync(join(root, 'bin', 'VERSION'), `${version}\n`)
}

function readPid(): { pid: number; version: string } {
  const [pid, version] = readFileSync(join(options.dataDir, 'server.pid'), 'utf8').split('\n')
  return { pid: Number(pid), version }
}

function fakeServerComm(pid: number, binaryPath: string): string | null {
  try {
    const argv = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0')
    return argv.includes(binaryPath)
      ? 'cc-tabdiff'
      : readFileSync(`/proc/${pid}/comm`, 'utf8').trim()
  } catch {
    return null
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitDead(pid: number): Promise<boolean> {
  for (let i = 0; i < 50 && isAlive(pid); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return !isAlive(pid)
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'cc-tabdiff-service-'))
  const binDir = join(root, 'bin')
  const binaryPath = join(binDir, 'cc-tabdiff')
  mkdirSync(binDir)
  writeFileSync(binaryPath, `#!${process.execPath}\n${FAKE_SERVER}`)
  chmodSync(binaryPath, 0o755)
  writeVersion('v1')
  options = {
    binaryPath,
    dataDir: join(root, 'data'),
    forgeEnvPath: join(root, 'forge.env'),
    port: await freePort(),
    baseEnv: { PATH: process.env.PATH },
    // Node 24 renames its main thread to MainThread, so the fake's /proc comm is not cc-tabdiff
    // the way the real Go binary's is; report the binary's name for the fake's own process.
    readComm: (pid) => fakeServerComm(pid, binaryPath),
    settleTimeoutMs: 5000
  }
})

afterEach(async () => {
  const pidPath = join(options.dataDir, 'server.pid')
  if (existsSync(pidPath)) {
    const { pid } = readPid()
    if (isAlive(pid)) {
      process.kill(pid, 'SIGKILL')
    }
  }
  await Promise.all(extraServers.splice(0).map((s) => new Promise((r) => s.close(r))))
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('ensureCcTabdiffServer', () => {
  it('does nothing without a bundled binary', async () => {
    rmSync(options.binaryPath)
    expect(await ensureCcTabdiffServer(options)).toBe('no-binary')
  })

  it('leaves a server that already answers /healthz alone (Docker, no pidfile)', async () => {
    const docker = createHttpServer((_req, res) => res.end('ok\n'))
    extraServers.push(docker)
    await new Promise<void>((resolve) => docker.listen(options.port, '127.0.0.1', resolve))
    expect(await ensureCcTabdiffServer(options)).toBe('already-running')
    expect(existsSync(join(options.dataDir, 'server.pid'))).toBe(false)
    expect(readFileSync(join(options.dataDir, 'server.log'), 'utf8')).toContain('already answers')
  })

  it('spawns the binary detached and records pid and version', async () => {
    expect(await ensureCcTabdiffServer(options)).toBe('spawned')
    const { pid, version } = readPid()
    expect(version).toBe('v1')
    expect(await probeHealth(options.port)).toBe(true)
    // Detached: the child leads its own process group, so it survives the GUI's group.
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const pgrp = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[2])
    expect(pgrp).toBe(pid)
    const seen = JSON.parse(readFileSync(join(options.dataDir, 'fake-seen.json'), 'utf8'))
    expect(seen.argv).toEqual(['-data', options.dataDir, '-addr', `0.0.0.0:${options.port}`])
  })

  it('keeps a running server of the same version', async () => {
    await ensureCcTabdiffServer(options)
    const first = readPid().pid
    expect(await ensureCcTabdiffServer(options)).toBe('already-running')
    expect(readPid().pid).toBe(first)
  })

  it('restarts its own server when the bundled version changed', async () => {
    await ensureCcTabdiffServer(options)
    const old = readPid().pid
    writeVersion('v2')
    expect(await ensureCcTabdiffServer(options)).toBe('restarted')
    expect(await waitDead(old)).toBe(true)
    const next = readPid()
    expect(next.pid).not.toBe(old)
    expect(next.version).toBe('v2')
    expect(await probeHealth(options.port)).toBe(true)
  })

  it('never kills a pid that is not a cc-tabdiff process', async () => {
    await ensureCcTabdiffServer(options)
    const old = readPid().pid
    writeVersion('v2')
    const foreign = { ...options, readComm: () => 'docker-proxy' }
    expect(await ensureCcTabdiffServer(foreign)).toBe('already-running')
    expect(isAlive(old)).toBe(true)
  })

  it('passes forge.env to the server without ever logging its values', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    writeFileSync(
      options.forgeEnvPath,
      [
        '# tokens',
        `CC_TABDIFF_GITLAB_TOKEN=${TOKEN}`,
        'export CC_TABDIFF_HOSTS="desktop.lan"',
        "CC_TABDIFF_ARGS='-presets 1h  -retain 72h'",
        ''
      ].join('\n')
    )
    expect(await ensureCcTabdiffServer(options)).toBe('spawned')
    const seen = JSON.parse(readFileSync(join(options.dataDir, 'fake-seen.json'), 'utf8'))
    expect(seen.token).toBe(TOKEN)
    expect(seen.hosts).toBe('desktop.lan')
    expect(seen.argv.slice(4)).toEqual(['-presets', '1h', '-retain', '72h'])
    expect(readFileSync(join(options.dataDir, 'server.log'), 'utf8')).not.toContain(TOKEN)
    expect(JSON.stringify(info.mock.calls)).not.toContain(TOKEN)
  })
})

describe('stopCcTabdiffServer', () => {
  it('stops the server Orca started and nothing else', async () => {
    expect(stopCcTabdiffServer(options)).toBe(false)
    await ensureCcTabdiffServer(options)
    const { pid } = readPid()
    expect(stopCcTabdiffServer(options)).toBe(true)
    expect(await waitDead(pid)).toBe(true)
  })
})
