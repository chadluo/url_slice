export interface TextFragment {
  prefix?: string
  textStart: string
  textEnd?: string
  suffix?: string
}

export interface MediaFragment {
  type: 'time' | 'spatial' | 'track' | 'id'
  raw: string
  // time
  startTime?: number
  endTime?: number
  // spatial (xywh)
  x?: number
  y?: number
  width?: number
  height?: number
  // track / id
  value?: string
}

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

export function parseTextFragment(raw: string): TextFragment {
  // Format: [prefix-,]textStart[,textEnd][,-suffix]
  // Decode percent-encoding
  const decoded = decodeURIComponent(raw)

  let rest = decoded
  let prefix: string | undefined
  let suffix: string | undefined

  // Check for prefix: starts with something ending in `-,`
  // prefix separator is `-,` at the beginning
  const dashCommaIdx = rest.indexOf('-,')
  if (dashCommaIdx !== -1) {
    prefix = rest.slice(0, dashCommaIdx)
    rest = rest.slice(dashCommaIdx + 2)
  }

  // Check for suffix: ends with `,-something`
  const suffixMatch = /^(.*?),-([^,]*)$/.exec(rest)
  if (suffixMatch) {
    // suffix separator is `,-` at the end
    const lastDashCommaIdx = rest.lastIndexOf(',-')
    if (lastDashCommaIdx !== -1) {
      suffix = rest.slice(lastDashCommaIdx + 2)
      rest = rest.slice(0, lastDashCommaIdx)
    }
  }

  // Remaining is textStart[,textEnd]
  const commaIdx = rest.indexOf(',')
  let textStart: string
  let textEnd: string | undefined

  if (commaIdx !== -1) {
    textStart = rest.slice(0, commaIdx)
    textEnd = rest.slice(commaIdx + 1)
    if (textEnd === '') textEnd = undefined
  } else {
    textStart = rest
  }

  const result: TextFragment = { textStart }
  if (prefix !== undefined && prefix !== '') result.prefix = prefix
  if (textEnd !== undefined) result.textEnd = textEnd
  if (suffix !== undefined && suffix !== '') result.suffix = suffix

  return result
}

export function parseMediaFragment(key: string, value: string): MediaFragment {
  const raw = `${key}=${value}`

  if (key === 't') {
    const parts = value.split(',')
    const startTime = parseFloat(parts[0])
    const endTime = parts.length > 1 ? parseFloat(parts[1]) : undefined
    const frag: MediaFragment = {
      type: 'time',
      raw,
      startTime: isNaN(startTime) ? undefined : startTime,
    }
    if (endTime !== undefined && !isNaN(endTime)) frag.endTime = endTime
    return frag
  }

  if (key === 'xywh') {
    const parts = value.split(',')
    return {
      type: 'spatial',
      raw,
      x: parseFloat(parts[0]),
      y: parseFloat(parts[1]),
      width: parseFloat(parts[2]),
      height: parseFloat(parts[3]),
    }
  }

  if (key === 'track') {
    return { type: 'track', raw, value }
  }

  if (key === 'id') {
    return { type: 'id', raw, value }
  }

  // fallback: treat as id
  return { type: 'id', raw, value }
}

export function parseAllFragments(hash: string): {
  textFragments: TextFragment[]
  mediaFragments: MediaFragment[]
} {
  if (!hash || hash === '#') {
    return { textFragments: [], mediaFragments: [] }
  }

  // Remove leading #
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash

  const textFragments: TextFragment[] = []
  const mediaFragments: MediaFragment[] = []

  // Separate text fragment directive from the rest
  // Text fragments use the `:~:` separator
  const textDirectiveIdx = withoutHash.indexOf(':~:')

  let mediaPart = withoutHash
  let textPart = ''

  if (textDirectiveIdx !== -1) {
    mediaPart = withoutHash.slice(0, textDirectiveIdx)
    textPart = withoutHash.slice(textDirectiveIdx + 3)
  }

  // Parse media fragments from mediaPart
  if (mediaPart) {
    const pairs = mediaPart.split('&').filter(Boolean)
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) continue
      const key = pair.slice(0, eqIdx)
      const value = pair.slice(eqIdx + 1)
      if (key === 't' || key === 'xywh' || key === 'track' || key === 'id') {
        mediaFragments.push(parseMediaFragment(key, value))
      }
    }
  }

  // Parse text fragments from textPart
  if (textPart) {
    const parts = textPart.split('&').filter(Boolean)
    for (const part of parts) {
      if (part.startsWith('text=')) {
        const raw = part.slice(5)
        textFragments.push(parseTextFragment(raw))
      }
    }
  }

  return { textFragments, mediaFragments }
}

export function parseUrl(raw: string): UrlModel {
  const url = new URL(raw)

  const protocol = url.protocol

  // Split hostname: last two parts = domain, rest = subdomains
  // Special cases: localhost, IP addresses
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

  // Path segments: split by '/', filter empty strings
  const pathSegments = url.pathname.split('/').filter((s) => s !== '')

  // Search params: ordered pairs
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
