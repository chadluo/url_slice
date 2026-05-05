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

export function parseTextFragment(raw: string): TextFragment {
  // Parse on the raw (percent-encoded) string so that encoded %2C and %2D
  // inside values are never mistaken for the literal , and - delimiters.
  // Decode each component individually after splitting.
  let rest = raw
  let prefix: string | undefined
  let suffix: string | undefined

  const dashCommaIdx = rest.indexOf('-,')
  if (dashCommaIdx !== -1) {
    prefix = decodeURIComponent(rest.slice(0, dashCommaIdx))
    rest = rest.slice(dashCommaIdx + 2)
  }

  const lastDashCommaIdx = rest.lastIndexOf(',-')
  if (lastDashCommaIdx !== -1) {
    suffix = decodeURIComponent(rest.slice(lastDashCommaIdx + 2))
    rest = rest.slice(0, lastDashCommaIdx)
  }

  const commaIdx = rest.indexOf(',')
  let textStart: string
  let textEnd: string | undefined

  if (commaIdx !== -1) {
    textStart = decodeURIComponent(rest.slice(0, commaIdx))
    textEnd = decodeURIComponent(rest.slice(commaIdx + 1)) || undefined
  } else {
    textStart = decodeURIComponent(rest)
  }

  const result: TextFragment = { textStart }
  if (prefix) result.prefix = prefix
  if (textEnd) result.textEnd = textEnd
  if (suffix) result.suffix = suffix

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

  // id or unknown key
  return { type: 'id', raw, value }
}

export function parseAllFragments(hash: string): {
  textFragments: TextFragment[]
  mediaFragments: MediaFragment[]
} {
  if (!hash || hash === '#') {
    return { textFragments: [], mediaFragments: [] }
  }

  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash

  const textFragments: TextFragment[] = []
  const mediaFragments: MediaFragment[] = []

  const textDirectiveIdx = withoutHash.indexOf(':~:')

  let mediaPart = withoutHash
  let textPart = ''

  if (textDirectiveIdx !== -1) {
    mediaPart = withoutHash.slice(0, textDirectiveIdx)
    textPart = withoutHash.slice(textDirectiveIdx + 3)
  }

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

  if (textPart) {
    const parts = textPart.split('&').filter(Boolean)
    for (const part of parts) {
      if (part.startsWith('text=')) {
        textFragments.push(parseTextFragment(part.slice(5)))
      }
    }
  }

  return { textFragments, mediaFragments }
}

// - and , are delimiter characters in the text fragment syntax and must be
// percent-encoded inside component values so they can't form false delimiters.
// encodeURIComponent already handles , → %2C; we additionally encode - → %2D.
function encodeTextComponent(s: string): string {
  return encodeURIComponent(s).replace(/-/g, '%2D')
}

export function serializeTextFragment(f: TextFragment): string {
  let result = ''
  if (f.prefix !== undefined) {
    result += encodeTextComponent(f.prefix) + '-,'
  }
  result += encodeTextComponent(f.textStart)
  if (f.textEnd !== undefined) {
    result += ',' + encodeTextComponent(f.textEnd)
  }
  if (f.suffix !== undefined) {
    result += ',-' + encodeTextComponent(f.suffix)
  }
  return result
}

export function serializeMediaFragment(f: MediaFragment): string {
  switch (f.type) {
    case 'time': {
      const start = f.startTime !== undefined ? String(f.startTime) : ''
      if (f.endTime !== undefined) {
        return `t=${start},${f.endTime}`
      }
      return `t=${start}`
    }
    case 'spatial': {
      const x = f.x ?? 0
      const y = f.y ?? 0
      const w = f.width ?? 0
      const h = f.height ?? 0
      return `xywh=${x},${y},${w},${h}`
    }
    case 'track':
      return `track=${f.value ?? ''}`
    case 'id':
      return `id=${f.value ?? ''}`
  }
}
