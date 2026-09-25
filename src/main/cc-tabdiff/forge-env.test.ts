import { describe, expect, it } from 'vitest'
import { parseForgeEnv, splitExtraArgs } from './forge-env'

describe('parseForgeEnv', () => {
  it('reads KEY=VALUE lines like docker compose env_file', () => {
    expect(
      parseForgeEnv(
        [
          '# comment',
          '',
          'CC_TABDIFF_GITLAB_TOKEN=abc=def',
          'export CC_TABDIFF_HOSTS=desktop.lan',
          'CC_TABDIFF_BITBUCKET_TOKEN="me@example.com:tok"',
          "CC_TABDIFF_ARGS='-presets 1h'",
          'not a variable line',
          '  SPACED = value \r'
        ].join('\n')
      )
    ).toEqual({
      CC_TABDIFF_GITLAB_TOKEN: 'abc=def',
      CC_TABDIFF_HOSTS: 'desktop.lan',
      CC_TABDIFF_BITBUCKET_TOKEN: 'me@example.com:tok',
      CC_TABDIFF_ARGS: '-presets 1h',
      SPACED: 'value'
    })
  })
})

describe('splitExtraArgs', () => {
  it('splits on any whitespace and ignores empty values', () => {
    expect(splitExtraArgs(' -tls-cert /c.pem\t-tls-key  /k.pem ')).toEqual([
      '-tls-cert',
      '/c.pem',
      '-tls-key',
      '/k.pem'
    ])
    expect(splitExtraArgs('  ')).toEqual([])
    expect(splitExtraArgs(undefined)).toEqual([])
  })
})
