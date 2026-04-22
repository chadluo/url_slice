import { useState, useEffect } from 'react';

export function useHistorySuggestions(
  prefix: string,
  field: 'host' | 'path' | 'port',
  currentHost: string,
): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Return early if prefix is empty or less than 1 character
    if (!prefix || prefix.length < 1) {
      setSuggestions([]);
      return;
    }

    // Set up debounce timer
    const debounceTimer = setTimeout(async () => {
      try {
        const results = await browser.history.search({
          text: prefix,
          maxResults: 50,
          startTime: 0,
        });

        const extracted = new Set<string>();

        for (const item of results) {
          if (!item.url) continue;

          try {
            const url = new URL(item.url);

            if (field === 'host') {
              // Extract hostname
              const hostname = url.hostname;
              if (hostname) {
                extracted.add(hostname);
              }
            } else if (field === 'path') {
              // Only include paths from URLs matching the current host
              if (url.hostname === currentHost) {
                const pathname = url.pathname;
                if (pathname) {
                  extracted.add(pathname);
                }
              }
            } else if (field === 'port') {
              // Only include ports from URLs matching the current host
              if (url.hostname === currentHost) {
                const port = url.port;
                if (port) {
                  extracted.add(port);
                }
              }
            }
          } catch {
            // Skip invalid URLs
          }
        }

        // Convert to array, filter out empty strings, deduplicate
        let filtered = Array.from(extracted).filter((s) => s !== '');

        // Filter out the current prefix if it's an exact match
        filtered = filtered.filter((s) => s !== prefix);

        // Sort and limit to 10 results
        const sorted = filtered.sort().slice(0, 10);

        setSuggestions(sorted);
      } catch {
        // Handle browser API errors gracefully - just set empty suggestions
        setSuggestions([]);
      }
    }, 150); // 150ms debounce

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [prefix, field, currentHost]);

  return suggestions;
}
