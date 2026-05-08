import { describe, expect, it } from 'vitest'
import { buildUrl } from './urlBuilder.js'
import { parseUrl } from './urlParser.js'

describe('parseUrl – domain / subdomain splitting', () => {
  it('splits gemini.google.com correctly', () => {
    const m = parseUrl('https://gemini.google.com/')
    expect(m.domain).toBe('google.com')
    expect(m.subdomains).toEqual(['gemini'])
  })

  it('splits www.apple.com correctly', () => {
    const m = parseUrl('https://www.apple.com/')
    expect(m.domain).toBe('apple.com')
    expect(m.subdomains).toEqual(['www'])
  })

  it('splits multi-level subdomain a.b.example.com correctly', () => {
    const m = parseUrl('https://a.b.example.com/path')
    expect(m.domain).toBe('example.com')
    expect(m.subdomains).toEqual(['a', 'b'])
  })

  it('bare domain has no subdomains', () => {
    const m = parseUrl('https://google.com/')
    expect(m.domain).toBe('google.com')
    expect(m.subdomains).toEqual([])
  })

  it('localhost has no subdomains', () => {
    const m = parseUrl('http://localhost:3000/')
    expect(m.domain).toBe('localhost')
    expect(m.subdomains).toEqual([])
    expect(m.port).toBe('3000')
  })

  it('IPv4 address has no subdomains', () => {
    const m = parseUrl('http://192.168.1.1:8080/')
    expect(m.domain).toBe('192.168.1.1')
    expect(m.subdomains).toEqual([])
  })
})

describe('parseUrl – path, query, port', () => {
  it('parses path segments', () => {
    const m = parseUrl('https://example.com/a/b/c')
    expect(m.pathSegments).toEqual(['a', 'b', 'c'])
  })

  it('parses search params', () => {
    const m = parseUrl('https://example.com/?foo=1&bar=2')
    expect(m.searchParams).toEqual([['foo', '1'], ['bar', '2']])
  })

  it('parses port', () => {
    const m = parseUrl('https://example.com:8443/')
    expect(m.port).toBe('8443')
  })

  it('empty port for standard https', () => {
    const m = parseUrl('https://example.com/')
    expect(m.port).toBe('')
  })
})

describe('buildUrl - host segments', () => {
  it('omits blank subdomain segments', () => {
    const m = parseUrl('https://example.com/')
    expect(buildUrl({ ...m, subdomains: ['', 'docs'] })).toBe('https://docs.example.com/')
  })
})
