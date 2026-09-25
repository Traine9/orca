import { readFileSync } from 'node:fs'

const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/

function unquote(value: string): string {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.length >= 2 && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/** Parses KEY=VALUE lines the way docker compose env_file does: blank lines and # comments skipped. */
export function parseForgeEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (/^\s*(#|$)/.test(line)) {
      continue
    }
    const match = ENV_LINE.exec(line)
    if (match) {
      env[match[1]] = unquote(match[2])
    }
  }
  return env
}

/** Reads the forge env file; a missing or unreadable file yields no variables. */
export function readForgeEnv(path: string): Record<string, string> {
  try {
    return parseForgeEnv(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/** Splits CC_TABDIFF_ARGS (extra server flags) on whitespace. */
export function splitExtraArgs(value: string | undefined): string[] {
  return value?.trim() ? value.trim().split(/\s+/) : []
}
