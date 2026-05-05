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

export async function getHistorySuggestions(
  prefix: string,
  field: 'host' | 'path' | 'port' | 'subdomain' | 'path-segment' | 'subdomain-segment',
  currentHost: string,
  excludeValue?: string,
): Promise<string[]> {
  if (!prefix || prefix.length < 1) return [];

  try {
    let searchText = prefix;
    if (field === 'subdomain') {
      searchText = currentHost;
    } else if (field === 'path-segment' && prefix === '/') {
      searchText = currentHost;
    }

    const results = await browser.history.search({ text: searchText, maxResults: 50, startTime: 0 });
    const extracted = new Set<string>();

    for (const item of results) {
      if (!item.url) continue;
      try {
        const url = new URL(item.url);
        if (field === 'host') {
          if (url.hostname) extracted.add(url.hostname);
        } else if (field === 'subdomain') {
          if (url.hostname.endsWith(`.${currentHost}`)) {
            const sub = url.hostname.slice(0, -(currentHost.length + 1));
            if (sub) extracted.add(sub);
          }
        } else if (field === 'subdomain-segment') {
          if (url.hostname.endsWith(`.${prefix}`)) {
            const before = url.hostname.slice(0, -(prefix.length + 1));
            const seg = before.split('.')[0];
            if (seg) extracted.add(seg);
          }
        } else if (field === 'path-segment') {
          if (url.hostname === currentHost && url.pathname.startsWith(prefix)) {
            const rest = url.pathname.slice(prefix.length);
            const seg = rest.split('/')[0];
            if (seg) extracted.add(seg);
          }
        } else if (field === 'path') {
          if (url.hostname === currentHost && url.pathname) extracted.add(url.pathname);
        } else if (field === 'port') {
          if (url.hostname === currentHost && url.port) extracted.add(url.port);
        }
      } catch {}
    }

    const toExclude = excludeValue !== undefined ? excludeValue : prefix;
    return Array.from(extracted)
      .filter((s) => s !== '' && s !== toExclude)
      .sort()
      .slice(0, 10);
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
