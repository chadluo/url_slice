import { useState, useEffect } from 'react';

/** Returns a map of param key → unique values seen in history for the given host+path. */
export function useHistorySearchParams(
  hostname: string,
  path: string,
): Map<string, string[]> {
  const [params, setParams] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (!hostname) return;

    browser.history
      .search({ text: `${hostname}${path}`, maxResults: 100, startTime: 0 })
      .then((results) => {
        const map = new Map<string, Set<string>>();
        for (const item of results) {
          if (!item.url) continue;
          try {
            const url = new URL(item.url);
            if (url.hostname !== hostname || url.pathname !== path) continue;
            url.searchParams.forEach((value, key) => {
              if (!map.has(key)) map.set(key, new Set());
              map.get(key)!.add(value);
            });
          } catch {}
        }
        setParams(new Map(Array.from(map.entries()).map(([k, v]) => [k, Array.from(v)])));
      })
      .catch(() => {});
  }, [hostname, path]);

  return params;
}
