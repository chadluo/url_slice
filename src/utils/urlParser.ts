import type { TextFragment, MediaFragment } from './fragmentCodec.ts'
import { parseAllFragments } from './fragmentCodec.ts'

export type { TextFragment, MediaFragment }
export { parseAllFragments, parseTextFragment, parseMediaFragment } from './fragmentCodec.ts'

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

  const hostname = url.hostname
  let subdomains: string[] = []
  let domain: string

  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  const isIpv6 = hostname.startsWith('[')
  const isLocalhost = hostname === 'localhost'

  if (isLocalhost || isIpv4 || isIpv6) {
    domain = hostname
    subdomains = []
  } else {
    const parts = hostname.split('.')
    if (parts.length <= 2) {
      domain = hostname
      subdomains = []
    } else {
      domain = parts.slice(-2).join('.')
      subdomains = parts.slice(0, -2)
    }
  }

  const port = url.port

  const pathSegments = url.pathname.split('/').filter((s) => s !== '').map((s) => {
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

export function pageKey(m: UrlModel): string {
  const host = [...m.subdomains, m.domain].filter(Boolean).join('.')
  const path = m.pathSegments.length ? '/' + m.pathSegments.join('/') : ''
  return `${host}${path}`
}
