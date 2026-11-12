import type { TextFragment, MediaFragment } from './fragmentCodec.ts'
import { parseAllFragments } from './fragmentCodec.ts'
import { parse as parseHost } from 'tldts-icann'

export interface UrlModel {
  protocol: string
  subdomains: string[]
  domain: string
  port: string
  pathSegments: string[]
  searchParams: [string, string][]
  textFragments: TextFragment[]
  mediaFragments: MediaFragment[]
}

export const EMPTY_URL_MODEL: UrlModel = {
  protocol: 'https:',
  subdomains: [],
  domain: '',
  port: '',
  pathSegments: [],
  searchParams: [],
  textFragments: [],
  mediaFragments: [],
}

export function parseUrl(raw: string): UrlModel {
  const url = new URL(raw)

  const protocol = url.protocol

  // ICANN suffixes only: www.bbc.co.uk → bbc.co.uk + [www]; user.github.io → github.io + [user] (private
  // suffixes such as github.io are ignored). IPs, localhost and single-label hosts have no registrable
  // domain, so the whole hostname is the domain.
  const { domain: registrable, subdomain } = parseHost(url.hostname)
  const domain = registrable ?? url.hostname
  const subdomains = registrable && subdomain ? subdomain.split('.') : []

  const port = url.port

  // Empty segments are kept: a trailing slash is a final '' (the same as a new blank segment), so `/a/` and `//` round-trip.
  const pathSegments = (url.pathname === '/' ? [] : url.pathname.slice(1).split('/')).map((s) => {
    try { return decodeURIComponent(s) } catch { return s }
  })

  const searchParams: [string, string][] = []
  url.searchParams.forEach((value, key) => {
    searchParams.push([key, value])
  })

  const { textFragments, mediaFragments } = parseAllFragments(url.hash)

  return {
    protocol,
    subdomains,
    domain,
    port,
    pathSegments,
    searchParams,
    textFragments,
    mediaFragments,
  }
}

// Blank subdomain chips (new, not typed yet) are left out.
export function hostname(m: UrlModel): string {
  return [...m.subdomains, m.domain].filter(Boolean).join('.')
}

export function pageKey(m: UrlModel): string {
  const host = hostname(m)
  const path = m.pathSegments.length ? '/' + m.pathSegments.join('/') : ''
  return `${host}${path}`
}
