export type { TextFragment, MediaFragment } from './urlParser.js'
export {
  parseTextFragment,
  parseMediaFragment,
} from './urlParser.js'

import type { TextFragment, MediaFragment } from './urlParser.js'

export function serializeTextFragment(f: TextFragment): string {
  let result = ''
  if (f.prefix !== undefined) {
    result += encodeURIComponent(f.prefix) + '-,'
  }
  result += encodeURIComponent(f.textStart)
  if (f.textEnd !== undefined) {
    result += ',' + encodeURIComponent(f.textEnd)
  }
  if (f.suffix !== undefined) {
    result += ',-' + encodeURIComponent(f.suffix)
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
