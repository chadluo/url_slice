import { describe, expect, it } from 'vitest'
import { subscribe } from './appState.js'
import { getPerfTimes, isPerfEnabled, setPerfEnabled, withPerf } from './perf.js'

describe('withPerf', () => {
  it('records a duration and returns the wrapped result', () => {
    const result = withPerf('host', () => 'rendered')
    expect(result).toBe('rendered')
    expect(getPerfTimes().host).toBeGreaterThanOrEqual(0)
  })

  it('does not notify appState subscribers', () => {
    // Editors call withPerf from render() and subscribe to appState, so an
    // appState write here re-enters every editor and loops forever.
    let notified = 0
    const unsub = subscribe(() => { notified++ })
    withPerf('path', () => null)
    unsub()
    expect(notified).toBe(0)
  })

  it('skips timing and clears recorded times when disabled', () => {
    withPerf('port', () => null)
    setPerfEnabled(false)
    expect(isPerfEnabled()).toBe(false)
    expect(getPerfTimes()).toEqual({})

    withPerf('port', () => null)
    expect(getPerfTimes()).toEqual({})

    setPerfEnabled(true)
  })
})
