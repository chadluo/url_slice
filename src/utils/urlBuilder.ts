import type { UrlModel } from './urlParser.js'
import { serializeTextFragment, serializeMediaFragment } from './fragmentCodec.ts'

export function buildFragment(model: UrlModel): string {
  const { textFragments, mediaFragments } = model

  if (textFragments.length === 0 && mediaFragments.length === 0) {
    return ''
  }

  const mediaParts = mediaFragments.map(serializeMediaFragment)
  const textParts = textFragments.map((f) => 'text=' + serializeTextFragment(f))

  if (mediaParts.length > 0 && textParts.length === 0) {
    return '#' + mediaParts.join('&')
  }

  if (mediaParts.length === 0 && textParts.length > 0) {
    return '#:~:' + textParts.join('&')
  }

  // Both present
  return '#' + mediaParts.join('&') + ':~:' + textParts.join('&')
}

export function buildUrl(model: UrlModel): string {
  const hostname = [...model.subdomains, model.domain].join('.')
  const portSuffix = model.port ? ':' + model.port : ''
  const origin = `${model.protocol}//${hostname}${portSuffix}`

  const path = '/' + model.pathSegments.map(encodeURIComponent).join('/')

  const searchParams = new URLSearchParams()
  for (const [key, value] of model.searchParams) {
    if (key !== '') searchParams.append(key, value)
  }
  const searchString = searchParams.toString()
  const search = searchString ? '?' + searchString : ''

  const fragment = buildFragment(model)

  return origin + path + search + fragment
}
