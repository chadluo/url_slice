export function createDebouncer(ms = 150) {
  const timers = new Map<string | number, ReturnType<typeof setTimeout>>();
  return {
    schedule(key: string | number, fn: () => void) {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms));
    },
    cancelAll() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}

export type HistorySuggestion = { value: string; title: string };

export async function getHistorySuggestions(
  prefix: string,
  field: 'host' | 'path' | 'port' | 'subdomain' | 'path-segment' | 'subdomain-segment',
  currentHost: string,
  excludeValue?: string,
): Promise<HistorySuggestion[]> {
  if (!prefix || prefix.length < 1) return [];

  try {
    let searchText = prefix;
    if (field === 'subdomain') {
      searchText = currentHost;
    } else if (field === 'path-segment' && prefix === '/') {
      searchText = currentHost;
    }

    const results = await browser.history.search({ text: searchText, maxResults: 50, startTime: 0 });
    const extracted = new Map<string, string>(); // value → title

    for (const item of results) {
      if (!item.url) continue;
      try {
        const url = new URL(item.url);
        if (field === 'host') {
          if (url.hostname && !extracted.has(url.hostname)) extracted.set(url.hostname, '');
        } else if (field === 'subdomain') {
          if (url.hostname.endsWith(`.${currentHost}`)) {
            const sub = url.hostname.slice(0, -(currentHost.length + 1));
            if (sub && !extracted.has(sub)) extracted.set(sub, '');
          }
        } else if (field === 'subdomain-segment') {
          if (url.hostname.endsWith(`.${prefix}`)) {
            const before = url.hostname.slice(0, -(prefix.length + 1));
            const seg = before.split('.')[0];
            if (!seg) continue;
            const isRoot = url.pathname === '/' || url.pathname === '';
            if (!extracted.has(seg)) {
              extracted.set(seg, isRoot ? (item.title ?? '') : '');
            } else if (isRoot && !extracted.get(seg)) {
              extracted.set(seg, item.title ?? '');
            }
          }
        } else if (field === 'path-segment') {
          if (url.hostname === currentHost && url.pathname.startsWith(prefix)) {
            const rest = url.pathname.slice(prefix.length);
            const seg = rest.split('/')[0];
            if (!seg) continue;
            const isExactLevel = rest === seg || rest === seg + '/';
            if (!extracted.has(seg)) {
              extracted.set(seg, isExactLevel ? (item.title ?? '') : '');
            } else if (isExactLevel && !extracted.get(seg)) {
              extracted.set(seg, item.title ?? '');
            }
          }
        } else if (field === 'path') {
          if (url.hostname === currentHost && url.pathname && !extracted.has(url.pathname)) extracted.set(url.pathname, '');
        } else if (field === 'port') {
          if (url.hostname === currentHost && url.port && !extracted.has(url.port)) extracted.set(url.port, '');
        }
      } catch {}
    }

    const toExclude = excludeValue !== undefined ? excludeValue : prefix;
    return Array.from(extracted.entries())
      .filter(([s]) => s !== '' && s !== toExclude)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 10)
      .map(([value, title]) => ({ value, title }));
  } catch {
    return [];
  }
}

export type OriginEntry = { origin: string; protocol: string };

export async function getHistoryOrigins(path: string): Promise<OriginEntry[]> {
  if (!path || path === '/') return [];
  try {
    const results = await browser.history.search({ text: path, maxResults: 100, startTime: 0 });
    const seen = new Map<string, string>(); // origin → protocol
    const normalizedPath = path.replace(/\/$/, '');
    for (const item of results) {
      if (!item.url) continue;
      try {
        const url = new URL(item.url);
        if (url.pathname.replace(/\/$/, '') !== normalizedPath) continue;
        const origin = url.hostname + (url.port ? `:${url.port}` : '');
        if (!seen.has(origin)) seen.set(origin, url.protocol);
      } catch {}
    }
    return Array.from(seen.entries())
      .map(([origin, protocol]) => ({ origin, protocol }))
      .sort((a, b) => a.origin.localeCompare(b.origin));
  } catch {
    return [];
  }
}

export async function getHistorySearchParams(
  hostname: string,
  path: string,
): Promise<Map<string, string[]>> {
  if (!hostname) return new Map();
  try {
    const results = await browser.history.search({ text: `${hostname}${path}`, maxResults: 100, startTime: 0 });
    const map = new Map<string, Set<string>>();
    for (const item of results) {
      if (!item.url) continue;
      try {
        const url = new URL(item.url);
        if (url.hostname !== hostname || url.pathname.replace(/\/$/, '') !== path.replace(/\/$/, '')) continue;
        url.searchParams.forEach((value, key) => {
          if (!map.has(key)) map.set(key, new Set());
          map.get(key)!.add(value);
        });
      } catch {}
    }
    return new Map(Array.from(map.entries()).map(([k, v]) => [k, Array.from(v)]));
  } catch {
    return new Map();
  }
}
