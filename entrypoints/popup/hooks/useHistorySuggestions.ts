import { useState, useEffect } from 'react';

export function useHistorySuggestions(
  prefix: string,
  field: 'host' | 'path' | 'port' | 'subdomain' | 'path-segment',
  currentHost: string,
  excludeValue?: string,
): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!prefix || prefix.length < 1) {
      setSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        let searchText = prefix;
        if (field === 'subdomain') {
          searchText = currentHost;
        } else if (field === 'path-segment' && prefix === '/') {
          searchText = currentHost;
        }

        const results = await browser.history.search({
          text: searchText,
          maxResults: 50,
          startTime: 0,
        });

        const extracted = new Set<string>();

        for (const item of results) {
          if (!item.url) continue;

          try {
            const url = new URL(item.url);

            if (field === 'host') {
              const hostname = url.hostname;
              if (hostname) extracted.add(hostname);
            } else if (field === 'subdomain') {
              if (url.hostname.endsWith(`.${currentHost}`)) {
                const subdomain = url.hostname.slice(0, -(currentHost.length + 1));
                if (subdomain) extracted.add(subdomain);
              }
            } else if (field === 'path-segment') {
              // Extract the single segment at this depth from matching paths on the same host
              if (url.hostname === currentHost && url.pathname.startsWith(prefix)) {
                const rest = url.pathname.slice(prefix.length);
                const segment = rest.split('/')[0];
                if (segment) extracted.add(segment);
              }
            } else if (field === 'path') {
              if (url.hostname === currentHost) {
                const pathname = url.pathname;
                if (pathname) extracted.add(pathname);
              }
            } else if (field === 'port') {
              if (url.hostname === currentHost) {
                const port = url.port;
                if (port) extracted.add(port);
              }
            }
          } catch {
            // Skip invalid URLs
          }
        }

        let filtered = Array.from(extracted).filter((s) => s !== '');

        // Exclude the current value (explicit override or fall back to prefix)
        const toExclude = excludeValue !== undefined ? excludeValue : prefix;
        filtered = filtered.filter((s) => s !== toExclude);

        const sorted = filtered.sort().slice(0, 10);
        setSuggestions(sorted);
      } catch {
        setSuggestions([]);
      }
    }, 150);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [prefix, field, currentHost, excludeValue]);

  return suggestions;
}
