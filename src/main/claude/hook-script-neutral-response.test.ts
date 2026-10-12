import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/userData'
  }
}))

import { CLAUDE_SILENT_HOOK_EVENTS, getManagedScript } from './hook-script'

const SCRIPT_OPTIONS = { skipWhenDevinImportsClaude: true, skipWhenGrokImportsClaude: true }

function runHook(
  input: string,
  inOrcaPane: boolean,
  decidesPreToolUse = false
): { stdout: string; status: number | null; curlCalled: boolean } {
  const dir = mkdtempSync(join(tmpdir(), 'orca-claude-neutral-'))
  const scriptPath = join(dir, 'hook.sh')
  const curlPath = join(dir, 'curl')
  const curlLog = join(dir, 'curl.log')
  try {
    writeFileSync(scriptPath, getManagedScript('posix', { ...SCRIPT_OPTIONS, decidesPreToolUse }))
    writeFileSync(
      curlPath,
      '#!/bin/sh\n{ command -p cat 2>/dev/null || cat; } >/dev/null\nprintf "called\\n" >> "$CURL_LOG"\n'
    )
    chmodSync(scriptPath, 0o755)
    chmodSync(curlPath, 0o755)
    const result = spawnSync('/bin/sh', [scriptPath], {
      encoding: 'utf8',
      input,
      env: {
        PATH: `${dir}:${process.env.PATH ?? ''}`,
        HOME: dir,
        CURL_LOG: curlLog,
        ORCA_AGENT_HOOK_ENDPOINT: '',
        ...(inOrcaPane
          ? {
              ORCA_AGENT_HOOK_PORT: '1234',
              ORCA_AGENT_HOOK_TOKEN: 'token',
              ORCA_PANE_KEY: 'tab:leaf'
            }
          : {})
      }
    })
    expect(result.error).toBeUndefined()
    return { stdout: result.stdout, status: result.status, curlCalled: existsSync(curlLog) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// Why: Claude Code stores every non-empty hook stdout as a transcript record carrying the whole
// registered command, so non-gating events stay silent while gating ones keep the #14818 answer.
describe.skipIf(process.platform === 'win32').each([
  ['print-then-post', false],
  ['PreToolUse decision', true]
])('Claude managed hook neutral response (%s)', (_mode, decides) => {
  it('stays silent on non-gating Claude events but still posts them', () => {
    for (const event of CLAUDE_SILENT_HOOK_EVENTS) {
      const result = runHook(`{"session_id":"s","hook_event_name":"${event}"}`, true, decides)
      expect(result.stdout, event).toBe('')
      expect(result.status, event).toBe(0)
      expect(result.curlCalled, event).toBe(true)
    }
  })

  it('answers {} on gating and unknown events, inside and outside an Orca pane', () => {
    for (const inOrcaPane of [true, false]) {
      for (const event of [
        'PreToolUse',
        'PermissionRequest',
        'UserPromptSubmit',
        'Stop',
        'SubagentStop',
        'TeammateIdle',
        'SomeFutureEvent'
      ]) {
        const result = runHook(
          `{"session_id":"s","hook_event_name":"${event}"}`,
          inOrcaPane,
          decides
        )
        expect(result.stdout, `${event} inOrcaPane=${inOrcaPane}`).toBe('{}\n')
        expect(result.status, event).toBe(0)
      }
    }
  })

  it('answers {} on an empty payload and on a non-compact event key', () => {
    expect(runHook('', true, decides).stdout).toBe('{}\n')
    expect(runHook('{"hook_event_name": "PostToolUse"}', true, decides).stdout).toBe('{}\n')
  })

  it('does not let a quoted event name inside a gating payload silence it', () => {
    const payload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_input: { command: 'echo \'"hook_event_name":"PostToolUse"\'' }
    })
    expect(payload).toContain('\\"hook_event_name\\":\\"PostToolUse\\"')
    expect(runHook(payload, true, decides).stdout).toBe('{}\n')
  })
})
