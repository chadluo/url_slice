import { describe, expect, it } from 'vitest'
import { isGitHubQuery, parseQualifiers, serializeQualifiers } from './githubQuery.js'

describe('GitHub query qualifiers', () => {
  it('splits qualifiers, keeps quoted values and free text, and round-trips', () => {
    const q = 'sort:updated-desc is:issue -label:"good first issue" fix crash '
    const pairs = parseQualifiers(q)
    expect(pairs).toEqual([
      ['sort', 'updated-desc'],
      ['is', 'issue'],
      ['-label', '"good first issue"'],
      ['', 'fix'],
      ['', 'crash'],
    ])
    expect(serializeQualifiers(pairs)).toBe(q.trim())
  })

  it('only applies on github.com with at least one qualifier', () => {
    expect(isGitHubQuery('github.com', 'is:open')).toBe(true)
    expect(isGitHubQuery('github.com', 'plain text')).toBe(false)
    expect(isGitHubQuery('gitlab.com', 'is:open')).toBe(false)
  })
})
