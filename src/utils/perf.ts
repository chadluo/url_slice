const _times: Record<string, number> = {};
const _bus = new EventTarget();
export const PERF_STORAGE_KEY = 'perfTracking';

// localStorage is missing outside the extension (e.g. tests); default to on.
let _enabled = read() !== 'off';

function read(): string | null {
  try {
    return localStorage.getItem(PERF_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getPerfTimes(): Record<string, number> {
  return _times;
}

export function isPerfEnabled(): boolean {
  return _enabled;
}

export function setPerfEnabled(enabled: boolean): void {
  _enabled = enabled;
  try {
    localStorage.setItem(PERF_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {}
  if (!enabled) for (const name of Object.keys(_times)) delete _times[name];
  _bus.dispatchEvent(new Event('change'));
}

export function subscribePerf(cb: () => void): () => void {
  _bus.addEventListener('change', cb);
  return () => _bus.removeEventListener('change', cb);
}

// Must not write to appState: every editor subscribes to it, so a write from
// inside render() re-enters all of them and loops forever.
export function withPerf<T>(name: string, fn: () => T): T {
  if (!_enabled) return fn();
  const t0 = performance.now();
  const result = fn();
  _times[name] = performance.now() - t0;
  _bus.dispatchEvent(new Event('change'));
  return result;
}
