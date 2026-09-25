import { describe, expect, it } from 'vitest'
import { buildDiffViewerUrl, isMergeRequestUrl } from './diff-viewer-links'

describe('isMergeRequestUrl', () => {
  it.each([
    'https://gitlab.com/group/project/-/merge_requests/42',
    'https://gitlab.example.com/group/sub/project/-/merge_requests/42/diffs',
    'http://gitlab.local/group/project/merge_requests/7',
    'https://github.com/owner/repo/pull/123',
    'https://github.com/owner/repo/pull/123/files?w=1#diff-abc',
    'https://ghe.example.com/owner/repo/pull/1/',
    'https://bitbucket.org/workspace/repo/pull-requests/5',
    'https://bitbucket.org/workspace/repo/pull-requests/5/diff'
  ])('matches %s', (url) => {
    expect(isMergeRequestUrl(url)).toBe(true)
  })

  it.each([
    'https://gitlab.com/group/project/-/merge_requests',
    'https://gitlab.com/group/project/-/merge_requests/new',
    'https://github.com/owner/repo/pulls',
    'https://github.com/owner/repo/pull/abc',
    'https://github.com/owner/repo/issues/12',
    'https://github.com/pull/12',
    'https://bitbucket.org/workspace/repo/pull-requests',
    // Bitbucket Server / Data Center: the diff viewer only supports bitbucket.org.
    'https://bitbucket.example.com/projects/P/repos/r/pull-requests/9/overview',
    'https://bitbucket.example.com/users/me/repos/r/pull-requests/9',
    'https://bitbucket.example.com/ws/repo/pull-requests/9',
    'https://bitbucket.org/projects/P/repos/r/pull-requests/9',
    'https://github.com/group/project/-/merge_requests/1',
    'https://github.com/owner/repo/pull/0',
    'ftp://github.com/owner/repo/pull/1',
    'file:///owner/repo/pull/1',
    'not a url',
    ''
  ])('rejects %s', (url) => {
    expect(isMergeRequestUrl(url)).toBe(false)
  })
})

describe('buildDiffViewerUrl', () => {
  it('appends /open with the encoded MR URL', () => {
    expect(
      buildDiffViewerUrl(
        'http://192.168.0.3:8787',
        'https://gitlab.com/g/p/-/merge_requests/1?x=1&y=2#note'
      )
    ).toBe(
      'http://192.168.0.3:8787/open?url=https%3A%2F%2Fgitlab.com%2Fg%2Fp%2F-%2Fmerge_requests%2F1%3Fx%3D1%26y%3D2%23note'
    )
  })

  it('trims whitespace and trailing slashes from the base', () => {
    expect(buildDiffViewerUrl('  http://host:8787/app//  ', 'https://github.com/o/r/pull/1')).toBe(
      'http://host:8787/app/open?url=https%3A%2F%2Fgithub.com%2Fo%2Fr%2Fpull%2F1'
    )
  })
})
